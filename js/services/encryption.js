/**
 * Encryption & Security Service
 * Menangani enkripsi dan dekripsi API Keys secara lokal menggunakan CryptoJS.
 */

export const EncryptionService = {
    isAvailable: function() {
        return typeof CryptoJS !== 'undefined' && !!CryptoJS.AES;
    },
    
    encryptApiKey: function(apiKey, secretKey) { 
        if(!secretKey || !this.isAvailable()) return null;
        try { 
            return CryptoJS.AES.encrypt(apiKey, secretKey).toString();
        } catch (e) { 
            return null;
        } 
    },
    
    decryptApiKey: function(cipherText, secretKey) { 
        if(!secretKey || !this.isAvailable()) return null;
        try { 
            const bytes = CryptoJS.AES.decrypt(cipherText, secretKey);
            return bytes.toString(CryptoJS.enc.Utf8) || null; 
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

// Ekspos ke window agar bisa diakses oleh AI Failover Engine lama (sementara)
window.EncryptionService = EncryptionService;
