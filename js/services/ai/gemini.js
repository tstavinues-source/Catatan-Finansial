/**
 * Gemini Vision Engine (Versi Dynamic Endpoint)
 * Menangani ekstraksi gambar, failover API Key, dan Load Balancing lintas model.
 */

import { APP_CONFIG } from '../../config/constants.js';
import { EncryptionService } from '../encryption.js';
import { get, ref } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { AuraState } from '../../core/state.js';

export class GeminiFailoverEngine {
    constructor(pinCode) { 
        this.pin = pinCode;
        this.keysPool = []; 
        this.currentIndex = 0; 
        
        // DAFTAR MODEL EKSKLUSIF (Berdasarkan ketersediaan AI Studio Anda)
        // Array ini bisa diakses oleh UI Pengaturan untuk membuat menu Dropdown
        this.availableModels = [
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-2.5-pro",
            "gemini-3.0-flash",
            
        ];
    }
    
    // === MESIN GEMBOK NEXUS ===
    async init() {
        this.keysPool = [];
        if (!AuraState.instances.db) return 0;
        
        const snapshot = await get(ref(AuraState.instances.db, 'nexus_api_vault'));
        if (snapshot.exists()) {
            const vaultData = snapshot.val();
            for (const id in vaultData) {
                if (!Object.prototype.hasOwnProperty.call(vaultData, id)) continue;
                
                const item = vaultData[id];
                let decrypted = null;
                
                if(EncryptionService && EncryptionService.decryptApiKey) {
                    decrypted = EncryptionService.decryptApiKey(item.value, this.pin);
                }
                
                // Fallback Dekripsi Klasik
                if (!decrypted) { 
                    try { 
                        let text = atob(item.value);
                        let result = ''; 
                        for (let i = 0; i < text.length; i++) { 
                            result += String.fromCharCode(text.charCodeAt(i) ^ this.pin.charCodeAt(i % this.pin.length));
                        } 
                        decrypted = result;
                    } catch (e) { /* fallback */ } 
                }
                
                if (decrypted && (decrypted.startsWith('AIza') || decrypted.startsWith('AQ.'))) { 
                    this.keysPool.push({ 
                        id: item.name || id, 
                        value: decrypted.trim() 
                    });
                }
            }
        }
        return this.keysPool.length;
    }
    
    // === MESIN EKSEKUSI AI DINAMIS ===
    // Menambahkan parameter 'targetModel' untuk kebebasan memilih versi AI
    async fetch(payload, base64Image, targetModel = "gemini-2.5-flash") {
        if (this.keysPool.length === 0) {
            throw new Error("Sistem Gemini terkunci: Kunci API kosong atau PIN Anda tidak akurat.");
        }
        
        // Proteksi jika targetModel kosong atau tidak valid, kembalikan ke model unggulan
        if (!targetModel || typeof targetModel !== 'string') {
            targetModel = "gemini-3.5-flash";
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
