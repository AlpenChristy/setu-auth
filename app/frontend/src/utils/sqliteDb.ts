import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('setuauth_local.db');

export const initSqliteDb = () => {
    try {
        db.execSync(`
            CREATE TABLE IF NOT EXISTS attendance (
                id TEXT PRIMARY KEY,
                userId TEXT,
                date TEXT,
                checkIn TEXT,
                checkOut TEXT,
                checkInLocation TEXT,
                checkOutLocation TEXT,
                status TEXT,
                workingHours REAL,
                synced INTEGER DEFAULT 0
            );
            
            CREATE TABLE IF NOT EXISTS auth_logs (
                id TEXT PRIMARY KEY,
                userId TEXT,
                timestamp TEXT,
                type TEXT,
                status TEXT,
                synced INTEGER DEFAULT 0
            );
            
            CREATE TABLE IF NOT EXISTS cached_embeddings (
                userId TEXT PRIMARY KEY,
                embedding TEXT,
                facePhoto TEXT,
                assignedLat REAL,
                assignedLng REAL,
                assignedRadius REAL
            );
        `);
        console.log('SQLite: Database tables initialized successfully.');
    } catch (e) {
        console.error('SQLite: Failed to initialize database tables:', e);
    }
};

export const sqliteDb = {
    // Attendance queries
    getAttendance: (userId: string) => {
        return db.getAllSync<any>('SELECT * FROM attendance WHERE userId = ? ORDER BY date DESC', [userId]);
    },
    
    getUnsyncedAttendance: () => {
        return db.getAllSync<any>('SELECT * FROM attendance WHERE synced = 0');
    },
    
    addOrUpdateAttendance: (rec: any) => {
        db.runSync(
            `INSERT INTO attendance (id, userId, date, checkIn, checkOut, checkInLocation, checkOutLocation, status, workingHours, synced)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
             checkOut = excluded.checkOut,
             checkOutLocation = excluded.checkOutLocation,
             workingHours = excluded.workingHours,
             synced = excluded.synced`,
            [
                rec.id,
                rec.userId,
                rec.date,
                rec.checkIn,
                rec.checkOut,
                rec.checkInLocation,
                rec.checkOutLocation,
                rec.status,
                rec.workingHours,
                rec.synced ? 1 : 0
            ]
        );
    },
    
    markAttendanceSynced: (ids: string[]) => {
        if (ids.length === 0) return;
        const placeholders = ids.map(() => '?').join(',');
        db.runSync(`UPDATE attendance SET synced = 1 WHERE id IN (${placeholders})`, ids);
    },
    
    clearSyncedAttendance: () => {
        db.runSync('DELETE FROM attendance WHERE synced = 1');
    },

    // Auth Logs queries
    getLogs: (userId: string) => {
        return db.getAllSync<any>('SELECT * FROM auth_logs WHERE userId = ? ORDER BY timestamp DESC', [userId]);
    },
    
    getUnsyncedLogs: () => {
        return db.getAllSync<any>('SELECT * FROM auth_logs WHERE synced = 0');
    },
    
    addLog: (log: any) => {
        db.runSync(
            `INSERT INTO auth_logs (id, userId, timestamp, type, status, synced)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
             synced = excluded.synced`,
            [log.id, log.userId, log.timestamp, log.type, log.status, log.synced ? 1 : 0]
        );
    },
    
    markLogsSynced: (ids: string[]) => {
        if (ids.length === 0) return;
        const placeholders = ids.map(() => '?').join(',');
        db.runSync(`UPDATE auth_logs SET synced = 1 WHERE id IN (${placeholders})`, ids);
    },
    
    clearSyncedLogs: () => {
        db.runSync('DELETE FROM auth_logs WHERE synced = 1');
    },

    // Cached Embeddings queries
    getAllCachedEmbeddings: () => {
        return db.getAllSync<any>('SELECT * FROM cached_embeddings');
    },
    
    getCachedEmbedding: (userId: string) => {
        return db.getFirstSync<any>('SELECT * FROM cached_embeddings WHERE userId = ?', [userId]);
    },
    
    saveCachedEmbedding: (userId: string, embedding: string, facePhoto: string | null, lat: number | null, lng: number | null, radius: number) => {
        db.runSync(
            `INSERT INTO cached_embeddings (userId, embedding, facePhoto, assignedLat, assignedLng, assignedRadius)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(userId) DO UPDATE SET
             embedding = excluded.embedding,
             facePhoto = excluded.facePhoto,
             assignedLat = excluded.assignedLat,
             assignedLng = excluded.assignedLng,
             assignedRadius = excluded.assignedRadius`,
            [userId, embedding, facePhoto, lat, lng, radius]
        );
    },
    
    clearCachedEmbeddings: () => {
        db.runSync('DELETE FROM cached_embeddings');
    }
};
