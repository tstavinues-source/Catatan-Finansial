/**
 * Groq AI Engine Service
 * Menangani koneksi ke model Groq LLM beserta sistem failover API Key.
 * [BULLETPROOF EDITION: Anti-Crash Tipe Data, Dukungan Vision LLaMA 3.2, & Safe JSON]
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
    // 🔥 Model standar super cepat Groq untuk percakapan teks
    model: "llama-3.1-8b-instant",
    // 🔥 Model khusus Groq untuk membedah struk bergambar
    visionModel: "llama-3.2-11b-vision-preview",
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
        
        let finalMessages = JSON.parse(JSON.stringify(messages));
        let hasVision = false;

        // 🛡️ PELINDUNG 1: Deteksi tipe data dengan aman agar JavaScript tidak TypeError/Crash!
        if (finalMessages.length > 0) {
            const lastMsg = finalMessages[finalMessages.length - 1];
            
            // Jika payload berbentuk array (Artinya ada Sisipan Gambar/Struk)
            if (Array.isArray(lastMsg.content)) {
                hasVision = true;
                if (requireJson) {
                    let textPart = lastMsg.content.find(p => p.type === 'text');
                    if (textPart && typeof textPart.text === 'string' && !textPart.text.toLowerCase().includes("json")) {
                        textPart.text += "\n\n(IMPORTANT: You must respond in valid JSON format only).";
                    } else if (!textPart) {
                        lastMsg.content.push({ type: "text", text: "(IMPORTANT: You must respond in valid JSON format only)." });
                    }
                }
            // Jika payload berbentuk string murni (Chat Biasa)
            } else if (typeof lastMsg.content === 'string') {
                if (requireJson && !lastMsg.content.toLowerCase().includes("json")) {
                    lastMsg.content += "\n\n(IMPORTANT: You must respond in valid JSON format only).";
                }
            }
        }
        
        // 🔥 Pilih model secara otomatis (Teks vs Gambar)
        const targetModel = hasVision ? this.visionModel : this.model;
        
        while (attempt < maxLimit) {
            const apiKey = this.getCurrentApiKey();
            try {
                const payload = { 
                    model: targetModel, 
                    messages: finalMessages, 
                    temperature: requireJson ? 0.1 : 0.7 
                };
                
                // 🛡️ PELINDUNG 2: Model Groq Vision akan error 400 jika kita memaksa format json_object.
                // Oleh karena itu, json_object DILARANG AKTIF jika sedang memproses gambar!
                if (requireJson && !hasVision) {
                    payload.response_format = { type: "json_object" };
                }
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 60000); // Batas 60 detik
                
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
                
                if (response.status === 429 || response.status === 401 || response.status === 503 || response.status >= 500) { 
                    this.switchToNextApiKey();
                    attempt++; 
                    continue; 
                }
                
                if (!response.ok) { 
                    const err = await response.json();
                    throw new Error(`[Groq HTTP ${response.status}] ` + (err.error?.message || "Kesalahan API")); 
                }
                
                const data = await response.json();
                if (!data.choices || data.choices.length === 0) {
                    throw new Error("Struktur respons balasan kosong dari Groq.");
                }
                
                return data.choices[0].message.content;
            } catch (err) { 
                console.error("[AuraFi Groq Debug]", err);
                
                // 🛡️ PELINDUNG 3: Jika data ditolak mentah-mentah (400) atau timeout, 
                // langsung HENTIKAN looping (jangan buang API Key lain) dan biarkan orchestrator melempar tugasnya ke Gemini!
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
