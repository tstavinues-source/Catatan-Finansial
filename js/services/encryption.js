/**
 * Encryption & Security Service
 * Menangani enkripsi dan dekripsi API Keys secara lokal menggunakan CryptoJS.
 */

export const EncryptionService = {
    isAvailable: function() {
        // PERBAIKAN: Tambahkan window. agar aman di Strict Mode
        return typeof window.CryptoJS !== 'undefined' && !!window.CryptoJS.AES;
    },
    
    encryptApiKey: function(apiKey, secretKey) { 
        if(!secretKey || !this.isAvailable()) return null;
        try { 
            return window.CryptoJS.AES.encrypt(apiKey, secretKey).toString();
        } catch (e) { 
            return null;
        } 
    },
    
    decryptApiKey: function(cipherText, secretKey) { 
        if(!secretKey || !this.isAvailable()) return null;
        try { 
            const bytes = window.CryptoJS.AES.decrypt(cipherText, secretKey);
            return bytes.toString(window.CryptoJS.enc.Utf8) || null; 
        } catch(e) { 
            return null;
        } 
    },
    
    validate: function(apiKey, secretKey) { 
        const encrypted = this.encryptApiKey(apiKey, secretKey);
        const decrypted = this.decryptApiKey(encrypted, secretKey); 
        return decrypted === apiKey; 
    }
};

window.EncryptionService = EncryptionService;
