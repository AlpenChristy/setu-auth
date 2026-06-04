import * as SecureStore from 'expo-secure-store';

const KEY_NAME = 'setuauth_enc_key_v1';

async function getOrCreateKey(): Promise<string> {
    try {
        let key = await SecureStore.getItemAsync(KEY_NAME);
        if (!key) {
            key = Array.from({ length: 32 }, () => Math.random().toString(36)[2] || 'a').join('');
            await SecureStore.setItemAsync(KEY_NAME, key);
        }
        return key;
    } catch (e) {
        console.error('Error getting/creating encryption key in SecureStore:', e);
        return 'fallback_secure_key_setuauth_32_chars';
    }
}

export async function encryptData(plaintext: string): Promise<string> {
    if (!plaintext) return '';
    try {
        const key = await getOrCreateKey();
        let result = '';
        for (let i = 0; i < plaintext.length; i++) {
            const charCode = plaintext.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            result += String.fromCharCode(charCode);
        }
        return btoa(result);
    } catch (e) {
        console.error('Encryption failed:', e);
        return plaintext;
    }
}

export async function decryptData(ciphertext: string): Promise<string> {
    if (!ciphertext) return '';
    try {
        const key = await getOrCreateKey();
        const decoded = atob(ciphertext);
        let result = '';
        for (let i = 0; i < decoded.length; i++) {
            const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            result += String.fromCharCode(charCode);
        }
        return result;
    } catch (e) {
        console.error('Decryption failed:', e);
        return ciphertext;
    }
}
