/**
 * Gemini Vision Engine (Versi Dynamic Endpoint)
 * Menangani ekstraksi gambar, failover API Key, dan Load Balancing lintas model.
 */

import { APP_CONFIG } from '../../config/constants.js';
import { AuraState } from '../../core/state.js';

export class GeminiFailoverEngine {
    constructor() {
        this.keysPool = []; 
        this.currentIndex = 0; 
        
        // DAFTAR MODEL EKSKLUSIF (Berdasarkan ketersediaan AI Studio Anda)
        // Array ini bisa diakses oleh UI Pengaturan untuk membuat menu Dropdown
        // Disederhanakan: hanya generasi terbaru (3.6 & 3.5-lite) yang dipakai.
        this.availableModels = [
            "gemini-3.6-flash",
            "gemini-3.5-flash-lite",
        ];
    }
    
    // === PEMUATAN KUNCI (manual saja) ===
    async init() {
        this.keysPool = [];
        if (!AuraState.instances.db) return 0;
        
        // === KUNCI MANUAL DARI PENGATURAN (pola sama seperti Groq) ===
        // Hanya kunci yang dipasang sendiri oleh pengguna yang dipakai.
        try {
            let rawManual = AuraState.data?.settings?.geminiKeysEncrypted || [];
            let encManual = Array.isArray(rawManual) ? rawManual : Object.values(rawManual);
            const secret = AuraState.user?.uid || "aura_secret_fallback";
            for (const enc of encManual) {
                try {
                    let text = atob(enc); let result = '';
                    for (let i = 0; i < text.length; i++) {
                        result += String.fromCharCode(text.charCodeAt(i) ^ secret.charCodeAt(i % secret.length));
                    }
                    const key = result.trim();
                    if (key.startsWith('AIza') || key.startsWith('AQ.')) {
                        this.keysPool.push({ id: 'Manual', value: key });
                    }
                } catch (e) { /* abaikan entri rusak */ }
            }
        } catch (e) { /* kunci manual tidak tersedia */ }
        
        return this.keysPool.length;
    }
    
    // === MESIN EKSEKUSI AI DINAMIS ===
    // Menambahkan parameter 'targetModel' untuk kebebasan memilih versi AI
    async fetch(payload, base64Image, targetModel = "gemini-3.6-flash") {
        if (this.keysPool.length === 0) {
            throw new Error("Sistem Gemini belum aktif: belum ada kunci API Gemini manual.");
        }
        
        // Proteksi jika targetModel kosong atau tidak valid, kembalikan ke model unggulan
        // Hanya satu versi yang didukung sekarang: gemini-3.6-flash.
        if (!targetModel || typeof targetModel !== 'string' || !this.availableModels.includes(targetModel)) {
            targetModel = "gemini-3.6-flash";
        }
        
        let attempt = 0;
        const totalKeys = this.keysPool.length;
        const maxLimit = Math.min(totalKeys, APP_CONFIG.MAX_RETRY_AI || 3);
        
        while (attempt < maxLimit) {
            const activeKeyObj = this.keysPool[this.currentIndex];
            
            // INJEKSI ENDPOINT DINAMIS (Memanggil server sesuai pilihan)
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${activeKeyObj.value}`;
            
            const requestPayload = JSON.parse(JSON.stringify(payload));
            
            // SUNTIKAN OTOMATIS: JSON Mode
            let isJsonRequest = false;
            if (requestPayload.system_instruction && requestPayload.system_instruction.parts) {
                const sysText = requestPayload.system_instruction.parts[0].text.toLowerCase();
                if (sysText.includes("json")) isJsonRequest = true;
            }
            
            if (isJsonRequest) {
                if (!requestPayload.generationConfig) requestPayload.generationConfig = {};
                requestPayload.generationConfig.response_mime_type = "application/json";
                requestPayload.generationConfig.temperature = 0.0;
            }
            
            // Injeksi Gambar Cerdas
            if (base64Image) {
                const base64Data = base64Image.split(',')[1] || base64Image;
                const mimeType = base64Image.includes(',') ? base64Image.split(';')[0].split(':')[1] : 'image/jpeg';
                
                if (!requestPayload.contents) requestPayload.contents = [{ role: "user", parts: [] }];
                if (!requestPayload.contents[0].parts) requestPayload.contents[0].parts = [];
                
                requestPayload.contents[0].parts.push({ 
                    inlineData: { mimeType: mimeType, data: base64Data } 
                });
            }
            
            const controller = new AbortController();
            const signalTimeout = setTimeout(() => { controller.abort(); }, 30000);
            
            try {
                const response = await fetch(url, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(requestPayload), 
                    signal: controller.signal
                });
                clearTimeout(signalTimeout);
                
                if (response.status === 429 || response.status === 400 || response.status === 401 || response.status >= 500) { 
                    this.currentIndex = (this.currentIndex + 1) % this.keysPool.length;
                    attempt++; 
                    continue; 
                }
                
                if (!response.ok) throw new Error(`HTTP Eksekusi Tertolak di ${targetModel} (Status ${response.status})`);
                
                const result = await response.json();
                if (!result.candidates || result.candidates.length === 0) {
                    throw new Error("Payload balasan Gemini gagal dikomposisikan.");
                }
                
                const textResponse = result.candidates[0].content?.parts?.[0]?.text;
                if (!textResponse) throw new Error("Elemen teks tidak bisa diekstraksi dari kandidat Google.");
                
                return textResponse;
            } catch (err) { 
                clearTimeout(signalTimeout);
                this.currentIndex = (this.currentIndex + 1) % this.keysPool.length; 
                attempt++; 
            }
        }
        throw new Error(`Siklus API diblokir total untuk model ${targetModel}. Silakan periksa limit/koneksi.`);
    }
}

window.GeminiFailoverEngine = GeminiFailoverEngine;
