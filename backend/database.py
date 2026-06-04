"""
database.py — Lightweight D1/SQLite database layer for SetuAuth Backend.

This module provides a thin wrapper around Cloudflare D1's native `prepare()` API
and falls back to an in-memory SQLite3 connection for local development.
All SQLAlchemy and pydantic_core dependencies have been removed to keep
the Worker bundle under Cloudflare's free-tier 3 MiB limit.
"""
import sys
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

# Check if we're inside Cloudflare Workers (Pyodide / WebAssembly)
IS_WASM = sys.platform in ("emscripten", "wasi")

if IS_WASM:
    import js
    # In Pyodide, Python None translates to JS undefined, but Cloudflare D1
    # specifically requires JS null for SQL NULL parameters.
    JS_NULL = js.JSON.parse("null")
else:
    JS_NULL = None

def _clean_params(params):
    return tuple(JS_NULL if p is None else p for p in params)

# ---- SQL schema definitions (used for local SQLite init and D1 migrations) ----

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS admins (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    email    TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workers (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    department      TEXT DEFAULT 'Unassigned',
    device_id       TEXT DEFAULT 'None',
    face_enrolled   INTEGER DEFAULT 0,
    face_embedding  TEXT,
    face_photo      TEXT,
    password        TEXT DEFAULT '123456',
    role            TEXT DEFAULT 'emp',
    assigned_lat    REAL,
    assigned_lng    REAL,
    assigned_radius REAL DEFAULT 200.0,
    last_auth       TEXT DEFAULT 'Never',
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attendance (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id           TEXT NOT NULL,
    date                TEXT NOT NULL,
    check_in            TEXT NOT NULL,
    check_out           TEXT,
    check_in_location   TEXT,
    check_out_location  TEXT,
    status              TEXT DEFAULT 'present',
    working_hours       REAL DEFAULT 0.0,
    created_at          TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id   TEXT,
    timestamp   TEXT DEFAULT (datetime('now')),
    type        TEXT NOT NULL,
    status      TEXT NOT NULL,
    confidence  REAL DEFAULT 0.0,
    device_id   TEXT DEFAULT 'None',
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE SET NULL
);
"""


# ---- D1 Database Wrapper ----

class D1DB:
    """
    Thin async wrapper around Cloudflare D1's `prepare()` binding.
    Provides `fetch_all`, `fetch_one`, and `execute` helpers that
    translate between D1's Promise-based API and Python awaitable calls.
    """

    def __init__(self, binding):
        self._db = binding

    async def fetch_all(self, sql: str, *params) -> List[Dict[str, Any]]:
        """Run a SELECT query and return all rows as dicts."""
        stmt = self._db.prepare(sql)
        if params:
            stmt = stmt.bind(*_clean_params(params))
        result = await stmt.all()
        # D1 returns JS objects; convert recursively to native Python types
        return result.results.to_py() if result.results else []

    async def fetch_one(self, sql: str, *params) -> Optional[Dict[str, Any]]:
        """Run a SELECT query and return the first row as a dict, or None."""
        rows = await self.fetch_all(sql, *params)
        return rows[0] if rows else None

    async def execute(self, sql: str, *params) -> Dict[str, Any]:
        """Run an INSERT / UPDATE / DELETE statement."""
        stmt = self._db.prepare(sql)
        if params:
            stmt = stmt.bind(*_clean_params(params))
        result = await stmt.run()
        return {
            "success": result.success,
            "meta": result.meta.to_py() if result.meta else {},
        }

    async def batch(self, statements: List) -> List:
        """Execute multiple prepared statements atomically."""
        results = await self._db.batch(statements)
        return [{"success": r.success, "results": r.results.to_py() if r.results else []} for r in results]


# ---- Local SQLite fallback (for `python main.py` development) ----

class LocalDB:
    """
    Synchronous in-process SQLite3 backend used when running locally.
    Mirrors the D1DB async interface but uses sqlite3 under the hood.
    Async methods are actually synchronous here — FastAPI's thread-pool
    handles them correctly when running on Uvicorn locally.
    """

    def __init__(self, path: str = ":memory:"):
        import sqlite3
        self._path = path
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(SCHEMA_SQL)
        self._conn.commit()
        self._seed()

    def _seed(self):
        """Insert default admin account if the table is empty."""
        try:
            cur = self._conn.execute("SELECT COUNT(*) FROM admins")
            count = cur.fetchone()[0]
            if count == 0:
                self._conn.execute(
                    "INSERT INTO admins (email, password, name) VALUES (?, ?, ?)",
                    ("admin@millennium.com", "admin123", "System Admin"),
                )
                self._conn.commit()
                print("Database seeded: Default admin created.")
        except Exception as e:
            print("Seed error:", e)

    async def fetch_all(self, sql: str, *params) -> List[Dict[str, Any]]:
        cur = self._conn.execute(sql, params)
        rows = cur.fetchall()
        return [dict(row) for row in rows]

    async def fetch_one(self, sql: str, *params) -> Optional[Dict[str, Any]]:
        cur = self._conn.execute(sql, params)
        row = cur.fetchone()
        return dict(row) if row else None

    async def execute(self, sql: str, *params) -> Dict[str, Any]:
        cur = self._conn.execute(sql, params)
        self._conn.commit()
        return {
            "success": True,
            "meta": {"last_row_id": cur.lastrowid, "changes": cur.rowcount},
        }

    async def batch(self, statements: List) -> List:
        results = []
        for sql, params in statements:
            res = await self.execute(sql, *params)
            results.append({"success": res["success"], "results": []})
        return results


# ---- Global DB instance (replaced at runtime for Cloudflare Workers) ----

# Populated by `main.py` Default.fetch() for the Cloudflare path,
# and initialised here for local development.
_local_db: Optional[LocalDB] = None


def get_local_db() -> LocalDB:
    """Return (or create) the singleton LocalDB instance for local dev."""
    global _local_db
    if _local_db is None:
        db_path = os.getenv("LOCAL_DB_PATH", ":memory:")
        _local_db = LocalDB(db_path)
    return _local_db
