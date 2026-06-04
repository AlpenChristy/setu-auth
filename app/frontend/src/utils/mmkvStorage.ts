import { createMMKV } from 'react-native-mmkv';
import * as SQLite from 'expo-sqlite';

// Fallback 1: SQLite-based synchronous persistent storage for dev clients lacking MMKV native binary
class MMKVSQLiteFallback {
    private db: any;
    constructor() {
        console.warn('MMKV: Native client unavailable. Initializing SQLite key-value persistence.');
        try {
            this.db = SQLite.openDatabaseSync('setuauth_local.db');
            this.db.execSync(`
                CREATE TABLE IF NOT EXISTS mmkv_fallback (
                    key TEXT PRIMARY KEY,
                    value TEXT
                );
            `);
        } catch (e) {
            console.error('MMKV SQLite Fallback init error:', e);
        }
    }
    getString(key: string): string | undefined {
        if (!this.db) return undefined;
        try {
            const row = this.db.getFirstSync('SELECT value FROM mmkv_fallback WHERE key = ?', [key]) as { value: string } | null;
            return row ? row.value : undefined;
        } catch (e) {
            console.error('MMKV SQLite Fallback getString error:', e);
            return undefined;
        }
    }
    set(key: string, value: string | number | boolean | Uint8Array): void {
        if (!this.db) return;
        try {
            this.db.runSync(
                `INSERT INTO mmkv_fallback (key, value) VALUES (?, ?)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
                [key, String(value)]
            );
        } catch (e) {
            console.error('MMKV SQLite Fallback set error:', e);
        }
    }
    remove(key: string): void {
        if (!this.db) return;
        try {
            this.db.runSync('DELETE FROM mmkv_fallback WHERE key = ?', [key]);
        } catch (e) {
            console.error('MMKV SQLite Fallback remove error:', e);
        }
    }
    clearAll(): void {
        if (!this.db) return;
        try {
            this.db.runSync('DELETE FROM mmkv_fallback');
        } catch (e) {
            console.error('MMKV SQLite Fallback clearAll error:', e);
        }
    }
}

// Fallback 2: In-memory map for environments where neither MMKV nor SQLite is available (e.g. Web, Jest)
class MMKVMock {
    private store = new Map<string, string>();
    constructor() {
        console.warn('MMKV: SQLite and Native MMKV unavailable. Using temporary in-memory fallback.');
    }
    getString(key: string): string | undefined {
        return this.store.get(key);
    }
    set(key: string, value: string | number | boolean | Uint8Array): void {
        this.store.set(key, String(value));
    }
    remove(key: string): void {
        this.store.delete(key);
    }
    clearAll(): void {
        this.store.clear();
    }
}

let mmkvInstance: any;
try {
    // Attempt to instantiate MMKV using the new createMMKV() v4 API function
    mmkvInstance = createMMKV({ id: 'setuauth-storage' });
} catch {
    try {
        // Fallback to SQLite synchronous persistent storage
        mmkvInstance = new MMKVSQLiteFallback();
    } catch {
        // Ultimate fallback to in-memory map mock
        mmkvInstance = new MMKVMock();
    }
}

export const mmkv = mmkvInstance;

export const mmkvStorage = {
    getItem: (key: string): string | null => {
        try {
            return mmkv.getString(key) || null;
        } catch (e) {
            console.error('MMKV getItem error:', e);
            return null;
        }
    },
    setItem: (key: string, value: string): void => {
        try {
            mmkv.set(key, value);
        } catch (e) {
            console.error('MMKV setItem error:', e);
        }
    },
    removeItem: (key: string): void => {
        try {
            // Use .remove(key) which is the V4 method name
            mmkv.remove(key);
        } catch (e) {
            console.error('MMKV removeItem error:', e);
        }
    },
    clear: (): void => {
        try {
            mmkv.clearAll();
        } catch (e) {
            console.error('MMKV clear error:', e);
        }
    }
};

