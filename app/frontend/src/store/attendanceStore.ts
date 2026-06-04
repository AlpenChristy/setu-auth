import { create } from 'zustand';
import { sqliteDb } from '@/src/utils/sqliteDb';
import { mmkvStorage } from '@/src/utils/mmkvStorage';
import { encryptData, decryptData } from '@/src/utils/encryption';
import { BACKEND_URL } from '@/src/utils/config';

export interface AttendanceRecord {
    id: string;
    userId: string;
    date: string;
    checkIn: string;
    checkOut: string | null;
    checkInLocation?: string | null;
    checkOutLocation?: string | null;
    status: 'present' | 'absent';
    workingHours: number;
    synced: boolean;
}

export interface AuthLog {
    id: string;
    userId: string;
    timestamp: string;
    type: 'face_auth' | 'login' | 'enrollment';
    status: 'success' | 'failed';
    synced: boolean;
}

interface AttendanceState {
    attendance: AttendanceRecord[];
    logs: AuthLog[];
    pendingSyncCount: number;
    addAttendance: (record: Omit<AttendanceRecord, 'id' | 'synced'>) => Promise<void>;
    addLog: (log: Omit<AuthLog, 'id' | 'synced'>) => Promise<void>;
    loadAttendance: () => Promise<void>;
    loadLogs: () => Promise<void>;
    markAsSynced: () => Promise<void>;
    clearSyncedData: () => Promise<void>;
    fetchAttendance: (workerId: string) => Promise<void>;
    fetchLogs: (workerId: string) => Promise<void>;
    syncOfflineData: () => Promise<void>;
}

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
    attendance: [],
    logs: [],
    pendingSyncCount: 0,

    addAttendance: async (record) => {
        const encCheckInLocation = record.checkInLocation ? await encryptData(record.checkInLocation) : null;
        const encCheckOutLocation = record.checkOutLocation ? await encryptData(record.checkOutLocation) : null;

        const existingRecords = sqliteDb.getAttendance(record.userId);
        const todayRecord = existingRecords.find(r => r.date === record.date);

        const dbRecord = {
            id: todayRecord ? todayRecord.id : Date.now().toString(),
            userId: record.userId,
            date: record.date,
            checkIn: record.checkIn,
            checkOut: record.checkOut,
            checkInLocation: encCheckInLocation,
            checkOutLocation: encCheckOutLocation,
            status: record.status,
            workingHours: record.workingHours,
            synced: false
        };

        sqliteDb.addOrUpdateAttendance(dbRecord);
        await get().loadAttendance();
    },

    addLog: async (log) => {
        const newLog = {
            id: Date.now().toString(),
            userId: log.userId,
            timestamp: log.timestamp,
            type: log.type,
            status: log.status,
            synced: false
        };
        sqliteDb.addLog(newLog);
        await get().loadLogs();
    },

    loadAttendance: async () => {
        try {
            const userStr = mmkvStorage.getItem('currentUser');
            if (!userStr) return;
            const user = JSON.parse(userStr);
            const records = sqliteDb.getAttendance(user.id);
            
            const decryptedRecords = [];
            for (const r of records) {
                decryptedRecords.push({
                    id: r.id,
                    userId: r.userId,
                    date: r.date,
                    checkIn: r.checkIn,
                    checkOut: r.checkOut,
                    checkInLocation: r.checkInLocation ? await decryptData(r.checkInLocation) : null,
                    checkOutLocation: r.checkOutLocation ? await decryptData(r.checkOutLocation) : null,
                    status: r.status,
                    workingHours: r.workingHours,
                    synced: r.synced === 1,
                });
            }
            
            const unsyncedCount = sqliteDb.getUnsyncedAttendance().length + sqliteDb.getUnsyncedLogs().length;
            set({ attendance: decryptedRecords, pendingSyncCount: unsyncedCount });
        } catch (error) {
            console.error('Error loading attendance from SQLite:', error);
        }
    },

    loadLogs: async () => {
        try {
            const userStr = mmkvStorage.getItem('currentUser');
            if (!userStr) return;
            const user = JSON.parse(userStr);
            const logs = sqliteDb.getLogs(user.id);
            
            const mapped = logs.map(l => ({
                id: l.id,
                userId: l.userId,
                timestamp: l.timestamp,
                type: l.type,
                status: l.status,
                synced: l.synced === 1
            }));
            
            const unsyncedCount = sqliteDb.getUnsyncedAttendance().length + sqliteDb.getUnsyncedLogs().length;
            set({ logs: mapped, pendingSyncCount: unsyncedCount });
        } catch (error) {
            console.error('Error loading logs from SQLite:', error);
        }
    },

    markAsSynced: async () => {
        const unsyncedAtt = sqliteDb.getUnsyncedAttendance();
        const unsyncedLogs = sqliteDb.getUnsyncedLogs();
        
        sqliteDb.markAttendanceSynced(unsyncedAtt.map(r => r.id));
        sqliteDb.markLogsSynced(unsyncedLogs.map(l => l.id));
        
        await get().loadAttendance();
        await get().loadLogs();
    },

    clearSyncedData: async () => {
        sqliteDb.clearSyncedAttendance();
        sqliteDb.clearSyncedLogs();
        await get().loadAttendance();
        await get().loadLogs();
    },

    fetchAttendance: async (workerId) => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/workers/${workerId}/attendance`);
            if (response.ok) {
                const data = await response.json();
                
                // Write backend records to local SQLite
                for (const r of data) {
                    const encCheckInLocation = r.checkInLocation ? await encryptData(r.checkInLocation) : null;
                    const encCheckOutLocation = r.checkOutLocation ? await encryptData(r.checkOutLocation) : null;
                    sqliteDb.addOrUpdateAttendance({
                        id: r.id,
                        userId: r.userId,
                        date: r.date,
                        checkIn: r.checkIn,
                        checkOut: r.checkOut,
                        checkInLocation: encCheckInLocation,
                        checkOutLocation: encCheckOutLocation,
                        status: r.status,
                        workingHours: r.workingHours,
                        synced: true
                    });
                }
                
                await get().loadAttendance();
            }
        } catch (error) {
            console.error('Error fetching attendance from backend:', error);
        }
    },

    fetchLogs: async (workerId) => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/workers/${workerId}/logs`);
            if (response.ok) {
                const data = await response.json();
                
                // Write backend logs to local SQLite
                for (const l of data) {
                    sqliteDb.addLog({
                        id: l.id,
                        userId: l.userId,
                        timestamp: l.timestamp,
                        type: l.type === 'Face Auth' ? 'face_auth' : l.type === 'Enrollment' ? 'enrollment' : 'login',
                        status: l.status.toLowerCase() === 'success' ? 'success' : 'failed',
                        synced: true
                    });
                }
                
                await get().loadLogs();
            }
        } catch (error) {
            console.error('Error fetching logs from backend:', error);
        }
    },

    syncOfflineData: async () => {
        try {
            const unsyncedAtt = sqliteDb.getUnsyncedAttendance();
            const unsyncedLogs = sqliteDb.getUnsyncedLogs();
            
            if (unsyncedAtt.length === 0 && unsyncedLogs.length === 0) {
                return;
            }
            
            const recordsToSync = [];
            for (const r of unsyncedAtt) {
                recordsToSync.push({
                    id: r.id,
                    userId: r.userId,
                    date: r.date,
                    checkIn: r.checkIn,
                    checkOut: r.checkOut,
                    checkInLocation: r.checkInLocation ? await decryptData(r.checkInLocation) : null,
                    checkOutLocation: r.checkOutLocation ? await decryptData(r.checkOutLocation) : null,
                    status: r.status,
                    workingHours: r.workingHours
                });
            }
            
            const response = await fetch(`${BACKEND_URL}/api/attendance/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    records: recordsToSync,
                    logs: unsyncedLogs
                })
            });
            
            if (response.ok) {
                sqliteDb.markAttendanceSynced(unsyncedAtt.map(r => r.id));
                sqliteDb.markLogsSynced(unsyncedLogs.map(l => l.id));
                
                await get().loadAttendance();
                await get().loadLogs();
                console.log('Background Sync: local SQLite synced with Postgres.');
            }
        } catch (error) {
            console.error('Background Sync: Connection failed:', error);
        }
    }
}));
