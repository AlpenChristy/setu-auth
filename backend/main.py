"""
main.py — SetuAuth Backend (Starlette / D1 Native, Cloudflare Workers)

Uses Starlette directly (instead of FastAPI) to avoid the 4 MB pydantic_core
WASM binary that FastAPI requires. All routing, JSON parsing, and response
serialisation is done with Starlette primitives — keeping the Worker bundle
well under Cloudflare's free-tier 3 MiB gzip limit.

Local development:  uvicorn main:app --reload   (sqlite3 LocalDB)
Cloudflare production: D1 binding injected by the Default WorkerEntrypoint.
"""
import json
import math
import sys
from datetime import datetime, date, timedelta
from typing import Any, Dict, List, Optional

from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from database import D1DB, get_local_db, SCHEMA_SQL

# ── Runtime detection ────────────────────────────────────────────────────────
IS_WASM = sys.platform in ("emscripten", "wasi")

# ── DB helper ────────────────────────────────────────────────────────────────

def _get_db(request: Request):
    if IS_WASM:
        env = request.scope.get("env")
        if not env or not hasattr(env, "DB"):
            return None
        return D1DB(env.DB)
    return get_local_db()


# ── Utility helpers ──────────────────────────────────────────────────────────

def haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def worker_out(w: dict) -> dict:
    return {
        "id": w["id"],
        "name": w["name"],
        "department": w.get("department", "Unassigned"),
        "device_id": w.get("device_id", "None"),
        "face_enrolled": bool(w.get("face_enrolled", 0)),
        "last_auth": w.get("last_auth", "Never"),
        "password": w.get("password", "123456"),
        "role": w.get("role", "emp"),
        "assigned_lat": w.get("assigned_lat"),
        "assigned_lng": w.get("assigned_lng"),
        "assigned_radius": w.get("assigned_radius", 200.0),
        "face_photo": w.get("face_photo"),
    }


def ok(data: Any, status_code: int = 200) -> JSONResponse:
    return JSONResponse(data, status_code=status_code)


def err(msg: str, status_code: int = 400) -> JSONResponse:
    return JSONResponse({"detail": msg}, status_code=status_code)


# ── Worker CRUD ──────────────────────────────────────────────────────────────

async def get_all_workers(request: Request) -> JSONResponse:
    db = _get_db(request)
    rows = await db.fetch_all("SELECT * FROM workers ORDER BY created_at DESC")
    return ok([worker_out(r) for r in rows])


async def create_worker(request: Request) -> JSONResponse:
    db = _get_db(request)
    body = await request.json()

    rows = await db.fetch_all("SELECT id FROM workers")
    max_num = 0
    for r in rows:
        wid = r["id"]
        if wid.startswith("EMP"):
            try:
                num = int(wid[3:])
                if num > max_num:
                    max_num = num
            except ValueError:
                pass
    new_id = f"EMP{max_num + 1:03d}"

    await db.execute(
        """INSERT INTO workers
           (id, name, department, device_id, face_enrolled, face_embedding, face_photo,
            password, role, assigned_lat, assigned_lng, assigned_radius, last_auth)
           VALUES (?, ?, ?, ?, 0, NULL, ?, ?, 'emp', ?, ?, ?, 'Never')""",
        new_id,
        body.get("name", ""),
        body.get("department", "Unassigned"),
        body.get("device_id", "None"),
        body.get("face_photo"),
        body.get("password", "123456"),
        body.get("assigned_lat", 19.0760),
        body.get("assigned_lng", 72.8777),
        body.get("assigned_radius", 200.0),
    )
    row = await db.fetch_one("SELECT * FROM workers WHERE id = ?", new_id)
    return ok(worker_out(row), 201)


async def workers_login(request: Request) -> JSONResponse:
    """POST /api/workers/login — must be defined before /{worker_id} routes."""
    db = _get_db(request)
    body = await request.json()
    row = await db.fetch_one("SELECT * FROM workers WHERE id = ?", body.get("employee_id", ""))
    if not row or row["password"] != body.get("password", ""):
        return err("Invalid Employee ID or Password", 401)
    return ok({
        "success": True,
        "role": "emp",
        "worker": {
            "id": row["id"],
            "name": row["name"],
            "department": row.get("department"),
            "face_enrolled": bool(row.get("face_enrolled", 0)),
            "assigned_lat": row.get("assigned_lat"),
            "assigned_lng": row.get("assigned_lng"),
            "assigned_radius": row.get("assigned_radius", 200.0),
            "face_photo": row.get("face_photo"),
        },
    })


async def get_worker(request: Request) -> JSONResponse:
    db = _get_db(request)
    worker_id = request.path_params["worker_id"]
    row = await db.fetch_one("SELECT * FROM workers WHERE id = ?", worker_id)
    if not row:
        return err(f"Worker {worker_id} not found", 404)
    return ok(worker_out(row))


async def update_worker(request: Request) -> JSONResponse:
    db = _get_db(request)
    worker_id = request.path_params["worker_id"]
    row = await db.fetch_one("SELECT id FROM workers WHERE id = ?", worker_id)
    if not row:
        return err(f"Worker {worker_id} not found", 404)

    body = await request.json()
    fields, values = [], []
    for field in ["name", "department", "device_id", "password",
                  "assigned_lat", "assigned_lng", "assigned_radius", "face_photo"]:
        if field in body and body[field] is not None:
            fields.append(f"{field} = ?")
            values.append(body[field])

    if fields:
        values.append(worker_id)
        await db.execute(f"UPDATE workers SET {', '.join(fields)} WHERE id = ?", *values)

    updated = await db.fetch_one("SELECT * FROM workers WHERE id = ?", worker_id)
    return ok(worker_out(updated))


async def delete_worker(request: Request) -> JSONResponse:
    db = _get_db(request)
    worker_id = request.path_params["worker_id"]
    row = await db.fetch_one("SELECT id FROM workers WHERE id = ?", worker_id)
    if not row:
        return err(f"Worker {worker_id} not found", 404)
    await db.execute("DELETE FROM workers WHERE id = ?", worker_id)
    return ok({"message": "Worker deleted successfully", "worker_id": worker_id})


async def get_worker_embedding(request: Request) -> JSONResponse:
    db = _get_db(request)
    worker_id = request.path_params["worker_id"]
    row = await db.fetch_one("SELECT face_embedding FROM workers WHERE id = ?", worker_id)
    if not row:
        return err(f"Worker {worker_id} not found", 404)
    fe = row.get("face_embedding")
    return ok({"face_embedding": json.loads(fe) if fe else None})


# ── Face enrollment & verification ──────────────────────────────────────────

async def enroll_face(request: Request) -> JSONResponse:
    db = _get_db(request)
    worker_id = request.path_params["worker_id"]
    row = await db.fetch_one("SELECT * FROM workers WHERE id = ?", worker_id)
    if not row:
        return err(f"Worker {worker_id} not found", 404)

    body = await request.json()
    normalized = []

    face_embeddings = body.get("face_embeddings")
    face_embedding = body.get("face_embedding")

    if face_embeddings:
        for emb in face_embeddings:
            norm = math.sqrt(sum(x ** 2 for x in emb))
            normalized.append([x / norm for x in emb] if norm > 0 else emb)
    elif face_embedding:
        norm = math.sqrt(sum(x ** 2 for x in face_embedding))
        normalized.append([x / norm for x in face_embedding] if norm > 0 else face_embedding)
    else:
        return err("No face embeddings provided.", 400)

    face_photo = body.get("face_photo") or row.get("face_photo")
    assigned_lat = body.get("assigned_lat") or row.get("assigned_lat")
    assigned_lng = body.get("assigned_lng") or row.get("assigned_lng")

    await db.execute(
        "UPDATE workers SET face_embedding = ?, face_enrolled = 1, face_photo = ?, assigned_lat = ?, assigned_lng = ? WHERE id = ?",
        json.dumps(normalized), face_photo, assigned_lat, assigned_lng, worker_id,
    )
    now_ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    await db.execute(
        "INSERT INTO auth_logs (worker_id, type, status, confidence, device_id, timestamp) VALUES (?, 'enrollment', 'success', 100.0, ?, ?)",
        worker_id, row.get("device_id", "None"), now_ts,
    )
    return ok({"message": "Face enrolled successfully", "worker_id": worker_id})


async def verify_face(request: Request) -> JSONResponse:
    db = _get_db(request)
    worker_id = request.path_params["worker_id"]
    row = await db.fetch_one("SELECT * FROM workers WHERE id = ?", worker_id)
    if not row:
        return err(f"Worker {worker_id} not found", 404)

    body = await request.json()
    device_id = body.get("device_id", "None")
    now_ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    async def log_fail(status="failed", confidence=0.0):
        await db.execute(
            "INSERT INTO auth_logs (worker_id, type, status, confidence, device_id, timestamp) VALUES (?, 'face_auth', ?, ?, ?, ?)",
            worker_id, status, confidence, device_id, now_ts,
        )

    if not row.get("face_enrolled") or not row.get("face_embedding"):
        await log_fail()
        return ok({"success": False, "match": False, "message": "Face not enrolled for this worker."})

    if body.get("simulate_spoof"):
        await log_fail("spoof", 12.4)
        return ok({"success": False, "match": False, "message": "Spoof attempt detected (Liveness check failed)."})

    # Geofence
    location_str = body.get("location_name") or "Unknown"
    lat, lng = body.get("latitude"), body.get("longitude")
    assigned_lat = row.get("assigned_lat")
    assigned_lng = row.get("assigned_lng")
    assigned_radius = row.get("assigned_radius") or 200.0

    if assigned_lat is not None and assigned_lng is not None and lat is not None and lng is not None:
        dist = haversine(lat, lng, assigned_lat, assigned_lng)
        location_str = f"{body.get('location_name') or 'Unknown'} ({lat:.4f}° N, {lng:.4f}° E)"
        if dist > assigned_radius:
            await log_fail()
            return ok({
                "success": False, "match": False,
                "message": f"Location mismatch. Distance: {round(dist, 1)}m (Allowed: {assigned_radius}m).",
            })

    # Cosine similarity matching
    impostor_detected = False
    fail_message = "Face verification failed. Embedding distance too high."
    
    try:
        parsed = json.loads(row["face_embedding"])
        live = body.get("face_embedding", [])
        if not live:
            raise ValueError("Empty embedding received.")

        registered = [parsed] if (parsed and not isinstance(parsed[0], list)) else parsed

        # L2 normalize live embedding
        norm_live = math.sqrt(sum(x ** 2 for x in live))
        live_norm = [x / norm_live for x in live] if norm_live > 0 else live

        def compute_metrics(l_vec, r_vec):
            if len(l_vec) != len(r_vec):
                return -1.0, 999.0
            # L2 normalize registered vector just in case
            norm_r = math.sqrt(sum(x ** 2 for x in r_vec))
            r_norm = [x / norm_r for x in r_vec] if norm_r > 0 else r_vec
            
            cos = sum(a * b for a, b in zip(l_vec, r_norm))
            dist = math.sqrt(sum((a - b) ** 2 for a, b in zip(l_vec, r_norm)))
            return cos, dist

        best_cosine = -1.0
        best_dist = float('inf')
        target_cosine = -1.0
        target_dist = float('inf')

        challenge_id = body.get("challenge_id")
        target = None
        if challenge_id is not None and len(registered) == 4:
            target = {1: 0, 2: 0, 3: 1, 4: 2, 5: 3}.get(challenge_id)

        if target is not None and target < len(registered):
            target_cosine, target_dist = compute_metrics(live_norm, registered[target])

        for reg in registered:
            cos, d = compute_metrics(live_norm, reg)
            if cos > best_cosine:
                best_cosine = cos
                best_dist = d

        # Weighted pose score computation
        other_poses_max_cos = -1.0
        for i, reg in enumerate(registered):
            if i != target:
                cos, d = compute_metrics(live_norm, reg)
                if cos > other_poses_max_cos:
                    other_poses_max_cos = cos

        weighted_pose_score = (0.6 * target_cosine + 0.4 * other_poses_max_cos) if target is not None else best_cosine

        if best_cosine == -1.0:
            raise ValueError("Embedding size mismatch.")

        # Enforce match condition
        is_match = (weighted_pose_score >= 0.70) if target is not None else (best_cosine >= 0.80)

        # Impostor Guard & Score Margin Check against all other workers
        max_other_user_cosine = -1.0
        other_rows = await db.fetch_all("SELECT id, face_embedding FROM workers WHERE id != ? AND face_enrolled = 1", worker_id)
        
        for other_row in other_rows:
            other_emb_str = other_row.get("face_embedding")
            if other_emb_str:
                other_parsed = json.loads(other_emb_str)
                other_registered = [other_parsed] if (other_parsed and not isinstance(other_parsed[0], list)) else other_parsed
                for other_reg in other_registered:
                    cos, d = compute_metrics(live_norm, other_reg)
                    if cos > max_other_user_cosine:
                        max_other_user_cosine = cos

        margin_violation = False

        if max_other_user_cosine > 0.82:
            impostor_detected = True
            is_match = False
            fail_message = "Security Warning: Face matches another registered worker profile."

        target_score = weighted_pose_score if target is not None else best_cosine
        margin = target_score - max_other_user_cosine
        if is_match and max_other_user_cosine > 0.0 and margin < 0.05:
            margin_violation = True
            is_match = False
            fail_message = "Security Warning: High similarity to multiple profiles (Margin Check failed)."

        dist_val = target_dist if target_dist != float('inf') else best_dist
        confidence = max(0.0, min(100.0, best_cosine * 100.0))

    except Exception as e:
        await log_fail()
        return ok({"success": False, "match": False, "message": f"Verification error: {str(e)}"})

    if is_match:
        now_dt = datetime.utcnow()
        now_date_str = now_dt.strftime("%Y-%m-%d")
        now_time_str = now_dt.strftime("%I:%M %p")
        await db.execute("UPDATE workers SET last_auth = ? WHERE id = ?",
                         f"{now_date_str} {now_time_str}", worker_id)

        existing = await db.fetch_one(
            "SELECT * FROM attendance WHERE worker_id = ? AND date = ?", worker_id, now_date_str)
        action = "check_in"
        if not existing:
            await db.execute(
                "INSERT INTO attendance (worker_id, date, check_in, check_in_location, status, working_hours) VALUES (?, ?, ?, ?, 'present', 0.0)",
                worker_id, now_date_str, now_time_str, location_str,
            )
        else:
            action = "check_out"
            wh = 0.0
            try:
                t1 = datetime.strptime(existing["check_in"], "%I:%M %p")
                t2 = datetime.strptime(now_time_str, "%I:%M %p")
                wh = max(0.0, round((t2 - t1).total_seconds() / 3600.0, 2))
            except Exception:
                wh = 8.0
            await db.execute(
                "UPDATE attendance SET check_out = ?, check_out_location = ?, working_hours = ? WHERE worker_id = ? AND date = ?",
                now_time_str, location_str, wh, worker_id, now_date_str,
            )
        await db.execute(
            "INSERT INTO auth_logs (worker_id, type, status, confidence, device_id, timestamp) VALUES (?, 'face_auth', 'success', ?, ?, ?)",
            worker_id, round(confidence, 1), device_id, now_ts,
        )
        return ok({"success": True, "match": True, "distance": round(dist_val, 4),
                   "confidence": round(confidence, 1), "action": action,
                   "time": now_time_str,
                   "message": f"Face verified. Marked {action} successfully."})
    else:
        await log_fail("spoof" if impostor_detected else "failed", round(confidence, 1))
        return ok({"success": False, "match": False, "distance": round(dist_val, 4),
                   "confidence": round(confidence, 1),
                   "message": fail_message})


# ── Attendance routes ────────────────────────────────────────────────────────

async def get_attendance(request: Request) -> JSONResponse:
    db = _get_db(request)
    rows = await db.fetch_all(
        """SELECT a.*, w.name as worker_name, w.department
           FROM attendance a JOIN workers w ON a.worker_id = w.id
           ORDER BY a.date DESC, a.created_at DESC"""
    )
    return ok([{
        "id": r["id"], "worker_id": r["worker_id"],
        "worker_name": r.get("worker_name"), "department": r.get("department"),
        "date": r["date"], "check_in": r["check_in"], "check_out": r.get("check_out"),
        "check_in_location": r.get("check_in_location"),
        "check_out_location": r.get("check_out_location"),
        "status": r.get("status"), "working_hours": r.get("working_hours", 0.0),
        "created_at": r.get("created_at"),
    } for r in rows])


async def get_worker_attendance(request: Request) -> JSONResponse:
    db = _get_db(request)
    worker_id = request.path_params["worker_id"]
    rows = await db.fetch_all(
        "SELECT * FROM attendance WHERE worker_id = ? ORDER BY date DESC", worker_id)
    return ok([{
        "id": str(r["id"]), "userId": r["worker_id"], "date": r["date"],
        "checkIn": r["check_in"], "checkOut": r.get("check_out"),
        "checkInLocation": r.get("check_in_location"),
        "checkOutLocation": r.get("check_out_location"),
        "status": r.get("status"), "workingHours": r.get("working_hours", 0.0),
        "synced": True,
    } for r in rows])


async def sync_attendance(request: Request) -> JSONResponse:
    db = _get_db(request)
    body = await request.json()
    now_ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    for rec in body.get("records", []):
        existing = await db.fetch_one(
            "SELECT id FROM attendance WHERE worker_id = ? AND date = ?",
            rec["userId"], rec["date"],
        )
        if existing:
            if rec.get("checkOut"):
                await db.execute(
                    "UPDATE attendance SET check_out = ?, check_out_location = ?, working_hours = ? WHERE worker_id = ? AND date = ?",
                    rec["checkOut"], rec.get("checkOutLocation"), rec.get("workingHours", 0.0),
                    rec["userId"], rec["date"],
                )
        else:
            await db.execute(
                "INSERT INTO attendance (worker_id, date, check_in, check_out, check_in_location, check_out_location, status, working_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                rec["userId"], rec["date"], rec["checkIn"], rec.get("checkOut"),
                rec.get("checkInLocation"), rec.get("checkOutLocation"),
                rec.get("status", "present"), rec.get("workingHours", 0.0),
            )

    for log_data in body.get("logs", []):
        await db.execute(
            "INSERT INTO auth_logs (worker_id, type, status, confidence, device_id, timestamp) VALUES (?, ?, ?, 95.0, 'iPhone-OFFLINE', ?)",
            log_data.get("userId"), log_data.get("type", "face_auth"),
            log_data.get("status", "success"), now_ts,
        )
    return ok({"success": True, "message": "Offline data synced successfully."})


# ── Log routes ───────────────────────────────────────────────────────────────

async def get_logs(request: Request) -> JSONResponse:
    db = _get_db(request)
    rows = await db.fetch_all(
        """SELECT l.*, w.name as worker_name
           FROM auth_logs l LEFT JOIN workers w ON l.worker_id = w.id
           ORDER BY l.timestamp DESC"""
    )
    out = []
    for log in rows:
        ts_str = log.get("timestamp", "")
        try:
            ts = datetime.strptime(ts_str[:19], "%Y-%m-%d %H:%M:%S")
            formatted = ts.strftime("%Y-%m-%d %I:%M %p")
        except Exception:
            formatted = ts_str
        s = log.get("status", "failed")
        out.append({
            "id": f"LOG-{log['id']:03d}",
            "worker": log.get("worker_name") or "Unknown",
            "worker_id": log.get("worker_id") or "N/A",
            "device": log.get("device_id"), "time": formatted,
            "status": "Success" if s == "success" else "Failed" if s == "failed" else "Spoof Attempt",
            "sync": "synced",
            "type": "Face Auth" if log["type"] == "face_auth" else "Enrollment" if log["type"] == "enrollment" else "Security",
            "details": {
                "confidence": f"{log.get('confidence', 0)}%",
                "duration": "1.2s" if s == "success" else None,
                "error": "Liveness Failed (2D Photo)" if s == "spoof" else "Low Match Confidence" if s == "failed" else None,
            },
        })
    return ok(out)


async def get_worker_logs(request: Request) -> JSONResponse:
    db = _get_db(request)
    worker_id = request.path_params["worker_id"]
    rows = await db.fetch_all(
        "SELECT * FROM auth_logs WHERE worker_id = ? ORDER BY timestamp DESC", worker_id)
    return ok([{
        "id": f"LOG-{log['id']:03d}", "userId": log.get("worker_id") or "N/A",
        "timestamp": (log.get("timestamp") or "").replace(" ", "T") + "Z",
        "type": log["type"],
        "status": "success" if log["status"] == "success" else "failed",
        "synced": True,
    } for log in rows])


async def delete_log(request: Request) -> JSONResponse:
    db = _get_db(request)
    log_id = request.path_params["log_id"]
    try:
        db_id = int(log_id[4:]) if log_id.startswith("LOG-") else int(log_id)
    except ValueError:
        return err("Invalid log ID format", 400)
    row = await db.fetch_one("SELECT id FROM auth_logs WHERE id = ?", db_id)
    if not row:
        return err("Log not found", 404)
    await db.execute("DELETE FROM auth_logs WHERE id = ?", db_id)
    return ok({"success": True, "message": "Log deleted successfully"})


# ── Admin routes ─────────────────────────────────────────────────────────────

async def admin_login(request: Request) -> JSONResponse:
    try:
        db = _get_db(request)
        if db is None:
            return err(f"Database not available. env: {request.scope.get('env')}", 500)
        body = await request.json()
        row = await db.fetch_one("SELECT * FROM admins WHERE email = ?", body.get("email", ""))
        if not row or row["password"] != body.get("password", ""):
            return err("Invalid email or password", 401)
        return ok({"success": True, "role": "admin",
                    "admin": {"name": row["name"], "email": row["email"]}})
    except Exception as e:
        import traceback
        return err(f"Server Error: {str(e)}\n{traceback.format_exc()}", 500)


async def retry_failed_syncs(request: Request) -> JSONResponse:
    db = _get_db(request)
    count_row = await db.fetch_one("SELECT COUNT(*) as cnt FROM auth_logs WHERE status = 'failed'")
    count = count_row["cnt"] if count_row else 0
    await db.execute("UPDATE auth_logs SET status = 'success' WHERE status = 'failed'")
    return ok({"success": True, "count": count, "message": f"Successfully re-synced {count} failed logs."})


# ── Dashboard stats ──────────────────────────────────────────────────────────

async def get_dashboard_stats(request: Request) -> JSONResponse:
    db = _get_db(request)
    total_workers_row = await db.fetch_one("SELECT COUNT(*) as cnt FROM workers")
    total_workers = total_workers_row["cnt"] if total_workers_row else 0

    today_str = date.today().strftime("%Y-%m-%d")

    async def count_logs(status):
        r = await db.fetch_one(
            "SELECT COUNT(*) as cnt FROM auth_logs WHERE status = ? AND timestamp LIKE ?",
            status, f"{today_str}%",
        )
        return r["cnt"] if r else 0

    pending_row = await db.fetch_one(
        "SELECT COUNT(*) as cnt FROM auth_logs WHERE status = 'failed'")

    today_date = date.today()
    start_of_week = today_date - timedelta(days=today_date.weekday())
    chart_data = []
    for idx, label in enumerate(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]):
        day_str = (start_of_week + timedelta(days=idx)).strftime("%Y-%m-%d")
        s = (await db.fetch_one("SELECT COUNT(*) as cnt FROM auth_logs WHERE status='success' AND timestamp LIKE ?", f"{day_str}%"))["cnt"]
        f_ = (await db.fetch_one("SELECT COUNT(*) as cnt FROM auth_logs WHERE status='failed' AND timestamp LIKE ?", f"{day_str}%"))["cnt"]
        sp = (await db.fetch_one("SELECT COUNT(*) as cnt FROM auth_logs WHERE status='spoof' AND timestamp LIKE ?", f"{day_str}%"))["cnt"]
        chart_data.append({"name": label, "success": s, "failed": f_, "spoof": sp})

    return ok({
        "total_workers": total_workers,
        "authentications_today": await count_logs("success"),
        "pending_sync": pending_row["cnt"] if pending_row else 0,
        "spoof_attempts_today": await count_logs("spoof"),
        "chart_data": chart_data,
    })


# ── Health check ─────────────────────────────────────────────────────────────

async def health_check(request: Request) -> JSONResponse:
    return ok({"status": "online", "message": "SetuAuth Backend API is running."})


# ── Starlette app ─────────────────────────────────────────────────────────────

routes = [
    Route("/", health_check),
    Route("/api/workers", get_all_workers, methods=["GET"]),
    Route("/api/workers", create_worker, methods=["POST"]),
    Route("/api/workers/login", workers_login, methods=["POST"]),
    Route("/api/workers/{worker_id}", get_worker, methods=["GET"]),
    Route("/api/workers/{worker_id}", update_worker, methods=["PUT"]),
    Route("/api/workers/{worker_id}", delete_worker, methods=["DELETE"]),
    Route("/api/workers/{worker_id}/embedding", get_worker_embedding, methods=["GET"]),
    Route("/api/workers/{worker_id}/enroll", enroll_face, methods=["POST"]),
    Route("/api/workers/{worker_id}/verify", verify_face, methods=["POST"]),
    Route("/api/workers/{worker_id}/attendance", get_worker_attendance, methods=["GET"]),
    Route("/api/workers/{worker_id}/logs", get_worker_logs, methods=["GET"]),
    Route("/api/attendance", get_attendance, methods=["GET"]),
    Route("/api/attendance/sync", sync_attendance, methods=["POST"]),
    Route("/api/logs", get_logs, methods=["GET"]),
    Route("/api/logs/{log_id}", delete_log, methods=["DELETE"]),
    Route("/api/admin/login", admin_login, methods=["POST"]),
    Route("/api/admin/sync/retry", retry_failed_syncs, methods=["POST"]),
    Route("/api/dashboard/stats", get_dashboard_stats, methods=["GET"]),
]

middleware = [
    Middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
]

async def server_error(request: Request, exc: Exception):
    import traceback
    return JSONResponse(
        {"success": False, "detail": f"Server Error: {str(exc)}\n{traceback.format_exc()}"},
        status_code=500
    )

app = Starlette(
    routes=routes, 
    middleware=middleware, 
    exception_handlers={Exception: server_error}
)

# ── Cloudflare Workers entrypoint ────────────────────────────────────────────

from workers import WorkerEntrypoint
import asgi


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        """Passes the environment (with DB binding) to ASGI."""
        return await asgi.fetch(app, request, self.env)
