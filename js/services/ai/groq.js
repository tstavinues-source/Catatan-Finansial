/**
 * Groq AI Engine Service
 * Menangani koneksi ke model Groq LLM beserta sistem failover API Key.
 * [UPDATED: LLaMA 3.1 8B Instant (128k Context) + Anti 400-Looping Fix]
 */

import { APP_CONFIG } from '../../config/constants.js';
import { EncryptionService } from '../encryption.js';

let groqSecretKey = null;
try {
    groqSecretKey = localStorage.getItem('aurafi_groq_secret');
    if (!groqSecretKey && typeof window.CryptoJS !== 'undefined' && window.CryptoJS.lib?.WordArray) { 
        groqSecretKey = window.CryptoJS.lib.WordArray.random(16).toString();
        localStorage.setItem('aurafi_groq_secret', groqSecretKey); 
    }
} catch (e) {
    groqSecretKey = sessionStorage.getItem('aurafi_groq_secret') || "fallback_secret_key_" + Date.now();
    try { sessionStorage.setItem('aurafi_groq_secret', groqSecretKey); } catch(err){}
}

export const GroqService = {
    keysPool: [], 
    currentIndex: 0, 
    // 🔥 Menggunakan LLaMA 3.1 Instant (Support hingga 128.000 token untuk data raksasa)
    model: "llama-3.1-8b-instant",
    secret: groqSecretKey,
    
    init: function(rawKeysArray) {
        this.keysPool = [];
        if (!Array.isArray(rawKeysArray)) return 0;
        
        for (let i = 0; i < rawKeysArray.length; i++) {
            const item = rawKeysArray[i];
            if (item && item.active) {
                const decrypted = EncryptionService.decryptApiKey(item.encryptedKey, this.secret);
                if (decrypted && decrypted.startsWith('gsk_')) { 
                    this.keysPool.push({ id: item.id, value: decrypted });
                }
            }
        }
        this.currentIndex = 0;
        return this.keysPool.length;
    },
    
    getCurrentApiKey: function() { 
        if (this.keysPool.length === 0) return null;
        return this.keysPool[this.currentIndex].value;
    },
    
    switchToNextApiKey: function() { 
        if (this.keysPool.length <= 1) return false;
        this.currentIndex = (this.currentIndex + 1) % this.keysPool.length; 
        return true;
    },
    
    fetch: async function(messages, requireJson = false) {
        if (this.keysPool.length === 0) {
            throw new Error("Sistem Groq terkunci: Tidak ada satupun API Key yang tersimpan.");
        }
        
        let attempt = 0;
        const totalKeys = this.keysPool.length;
        const maxLimit = Math.min(totalKeys, APP_CONFIG.MAX_RETRY_AI);
        const groqApiUrl = "https://api.groq.com/openai/v1/chat/completions";

        // 🔥 WAJIB GROQ: Menyelipkan instruksi "JSON" agar tidak ditolak dengan Error 400
        let finalMessages = JSON.parse(JSON.stringify(messages));
        if (requireJson) {
            const lastMsg = finalMessages[finalMessages.length - 1];
            if (!lastMsg.content.toLowerCase().includes("json")) {
                lastMsg.content += "\n\n(IMPORTANT: You must respond in valid JSON format only).";
            }
        }
        
        while (attempt < maxLimit) {
            const apiKey = this.getCurrentApiKey();
            try {
                const payload = { 
                    model: this.model, 
                    messages: finalMessages, 
                    temperature: requireJson ? 0.1 : 0.7 
                };
                if (requireJson) {
                    payload.response_format = { type: "json_object" };
                }

                // Memberikan keleluasaan waktu 60 Detik agar tidak terputus saat berpikir keras
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 60000);
                
                const response = await fetch(groqApiUrl, {
                    method: 'POST', 
                    headers: { 
                        'Authorization': `Bearer ${apiKey}`, 
                        'Content-Type': 'application/json' 
                    }, 
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                
                // 🔥 PERBAIKAN: Menghapus status 400 (Bad Request) dari daftar Ganti Key. 
                // Jika error 400, berarti datanya yang salah/kebesaran, kita harus langsung lempar ke Gemini!
                if (response.status === 429 || response.status === 401 || response.status === 503 || response.status >= 500) { 
                    this.switchToNextApiKey();
                    attempt++; 
                    continue; 
                }
                
                if (!response.ok) { 
                    const err = await response.json();
                    throw new Error(`Groq HTTP ${response.status}: ` + (err.error?.message || "Kesalahan Fatal")); 
                }
                
                const data = await response.json();
                if (!data.choices || data.choices.length === 0) {
                    throw new Error("Struktur respons balasan kosong dari Groq.");
                }
                
                return data.choices[0].message.content;
            } catch (err) { 
                // Jika request ditolak mentah-mentah karena data kebesaran (Error 400), Hentikan looping dan lempar tugasnya ke Gemini!
                if (err.message.includes("400") || err.name === 'AbortError') {
                    throw err; 
                }
                this.switchToNextApiKey();
                attempt++; 
            }
        }
        throw new Error("Semua cadangan kunci Groq gagal diakses atau server sedang Maintenance total.");
    }
};

window.GroqService = GroqService;
