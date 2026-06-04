import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
    getItem: async (key: string): Promise<string | null> => {
        try {
            return await AsyncStorage.getItem(key);
        } catch (error) {
            console.error('Error reading from storage', error);
            return null;
        }
    },
    setItem: async (key: string, value: string): Promise<void> => {
        try {
            await AsyncStorage.setItem(key, value);
        } catch (error) {
            console.error('Error writing to storage', error);
        }
    },
    removeItem: async (key: string): Promise<void> => {
        try {
            await AsyncStorage.removeItem(key);
        } catch (error) {
            console.error('Error removing from storage', error);
        }
    },
};
