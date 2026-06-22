/**
 * Gemini Vision Engine
 * Menangani ekstraksi gambar struk dan failover API Key Google Gemini Nexus.
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
    }
    
    // === MESIN GEMBOK NEXUS (MEMBUKA PIN 123) ===
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
                
                // Fallback Dekripsi Klasik jika EncryptionService gagal
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
    
    // === MESIN EKSEKUSI AI YANG SUDAH DI-UPGRADE ===
    async fetch(payload, base64Image) {
        if (this.keysPool.length === 0) {
            throw new Error("Sistem Gemini terkunci: Kunci API kosong atau PIN Anda tidak akurat.");
        }
        
        let attempt = 0;
        const totalKeys = this.keysPool.length;
        const maxLimit = Math.min(totalKeys, APP_CONFIG.MAX_RETRY_AI || 3);
        
        while (attempt < maxLimit) {
            const activeKeyObj = this.keysPool[this.currentIndex];
            
            // MENGGUNAKAN ENDPOINT 2.5-FLASH MUTAKHIR UNTUK STABILITAS JSON
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${activeKeyObj.value}`;
            
            const requestPayload = JSON.parse(JSON.stringify(payload));
            
            // SUNTIKAN OTOMATIS: Memaksa AI menjawab JSON Murni jika ia mendeteksi instruksi JSON
            let isJsonRequest = false;
            if (requestPayload.system_instruction && requestPayload.system_instruction.parts) {
                const sysText = requestPayload.system_instruction.parts[0].text.toLowerCase();
                if (sysText.includes("json")) isJsonRequest = true;
            }
            
            if (isJsonRequest) {
                if (!requestPayload.generationConfig) requestPayload.generationConfig = {};
                requestPayload.generationConfig.response_mime_type = "application/json";
                requestPayload.generationConfig.temperature = 0.0; // Paksa ke mode akurasi absolut
            }
            
            // Injeksi Gambar Cerdas (Menghindari Error Format)
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
                
                if (!response.ok) throw new Error(`HTTP Eksekusi Tertolak (Status ${response.status})`);
                
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
        throw new Error("Siklus Vision Google diblokir total atau jaringan sedang offline.");
    }
}

window.GeminiFailoverEngine = GeminiFailoverEngine;
