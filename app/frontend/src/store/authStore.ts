import { create } from 'zustand';
import { mmkvStorage } from '@/src/utils/mmkvStorage';
import { BACKEND_URL } from '@/src/utils/config';
import { encryptData } from '@/src/utils/encryption';
import { sqliteDb } from '@/src/utils/sqliteDb';

interface User {
    id: string;
    employeeId: string;
    name: string;
    department: string;
    faceEnrolled: boolean;
    facePhoto?: string | null;
    assignedLat?: number | null;
    assignedLng?: number | null;
    assignedRadius?: number;
    role?: string;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    lastSync: string | null;
    setUser: (user: User) => void;
    login: (employeeId: string, password: string) => Promise<boolean>;
    logout: () => void;
    updateFaceEnrollment: (enrolled: boolean) => void;
    setLastSync: (date: string) => void;
    loadStoredAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    lastSync: null,

    setUser: (user) => {
        set({ user, isAuthenticated: true });
        mmkvStorage.setItem('currentUser', JSON.stringify(user));
    },

    login: async (employeeId, password) => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/workers/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    employee_id: employeeId,
                    password: password
                }),
            });
            if (response.ok) {
                const data = await response.json();
                const worker = data.worker;
                const loggedInUser: User = {
                    id: worker.id,
                    employeeId: worker.id,
                    name: worker.name,
                    department: worker.department,
                    faceEnrolled: worker.face_enrolled,
                    facePhoto: worker.face_photo,
                    assignedLat: worker.assigned_lat,
                    assignedLng: worker.assigned_lng,
                    assignedRadius: worker.assigned_radius,
                    role: data.role,
                };
                set({ user: loggedInUser, isAuthenticated: true });
                mmkvStorage.setItem('currentUser', JSON.stringify(loggedInUser));
                
                // Pre-cache embedding in SQLite and encrypt it
                try {
                    const embedRes = await fetch(`${BACKEND_URL}/api/workers/${worker.id}/embedding`);
                    if (embedRes.ok) {
                        const embedData = await embedRes.json();
                        if (embedData.face_embedding) {
                            const encEmbedding = await encryptData(JSON.stringify(embedData.face_embedding));
                            
                            sqliteDb.saveCachedEmbedding(
                                worker.id,
                                encEmbedding,
                                worker.face_photo || null,
                                worker.assigned_lat,
                                worker.assigned_lng,
                                worker.assigned_radius || 200.0
                            );
                            console.log('Stored and encrypted worker embedding locally in SQLite.');
                        }
                    }
                } catch (err) {
                    console.error('Failed to pre-cache embedding:', err);
                }

                return true;
            }
            return false;
        } catch (error) {
            console.error('Error calling login API:', error);
            return false;
        }
    },

    logout: async () => {
        mmkvStorage.removeItem('currentUser');
        mmkvStorage.removeItem('isAuthenticated');
        set({ user: null, isAuthenticated: false });
    },

    updateFaceEnrollment: (enrolled) => {
        set((state) => {
            if (state.user) {
                const updatedUser = { ...state.user, faceEnrolled: enrolled };
                mmkvStorage.setItem('currentUser', JSON.stringify(updatedUser));
                return { user: updatedUser };
            }
            return state;
        });
    },

    setLastSync: (date) => {
        set({ lastSync: date });
        mmkvStorage.setItem('lastSync', date);
    },

    loadStoredAuth: async () => {
        try {
            const userStr = mmkvStorage.getItem('currentUser');
            const lastSync = mmkvStorage.getItem('lastSync');

            if (userStr) {
                const user = JSON.parse(userStr);
                set({ user, isAuthenticated: true, lastSync: lastSync || null, isLoading: false });
            } else {
                set({ isLoading: false });
            }
        } catch (error) {
            console.error('Error loading stored auth:', error);
            set({ isLoading: false });
        }
    },
}));
