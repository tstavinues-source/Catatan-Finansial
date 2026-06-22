/**
 * Groq AI Service Engine
 * Mengelola komunikasi ke Groq API. Dilengkapi sistem Auto-Decryption dan Failover Pool.
 */

import { AuraState } from '../../core/state.js';

export const GroqAPI = {
    currentIndex: 0, // Mengingat kunci mana yang sedang dipakai
    
    callGroq: async function(messages, systemPrompt, requireJson = false, imgBase64 = null) {
        
        // 1. Tarik Pool API Key
        const encKeys = AuraState.data.settings?.groqKeysEncrypted || [];
        
        if (!Array.isArray(encKeys) || encKeys.length === 0) {
            throw new Error("API Key Groq kosong! Silakan pasang minimal 1 Key di menu Pengaturan.");
        }

        // 2. Dekripsi semua kunci yang ada di Pool
        const secret = AuraState.user?.uid || "aura_secret_fallback";
        let rawKeys = [];
        
        for (let k of encKeys) {
            try {
                let text = atob(k);
                let result = '';
                for (let i = 0; i < text.length; i++) {
                    result += String.fromCharCode(text.charCodeAt(i) ^ secret.charCodeAt(i % secret.length));
                }
                if (result.startsWith('gsk_')) rawKeys.push(result);
            } catch(e) {}
        }

        if (rawKeys.length === 0) {
            throw new Error("Kunci Groq di Cloud korup atau tidak valid.");
        }

        if (imgBase64) {
            console.warn('GroqAPI: Gambar terdeteksi. Groq murni teks, gambar diabaikan.');
        }

        // 3. Persiapan Payload
        const modelName = requireJson ? "llama-3.1-8b-instant" : "openai/gpt-oss-120b";
        const url = "https://api.groq.com/openai/v1/chat/completions";

        const groqMessages = [{ role: "system", content: systemPrompt }];
        messages.forEach(msg => {
            if (msg.role !== 'system') {
                groqMessages.push({
                    role: msg.role === 'ai' || msg.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.content
                });
            }
        });

        const payload = {
            model: modelName,
            messages: groqMessages,
            temperature: requireJson ? 0.0 : 0.7,
        };

        if (requireJson) {
            payload.response_format = { type: "json_object" };
        }

        // 4. MESIN FAILOVER (Otomatis ganti kunci jika error 429/Limit)
        let attempt = 0;
        const maxLimit = Math.min(rawKeys.length, 3); // Coba maksimal 3 kali ganti kunci
        
        while (attempt < maxLimit) {
            const activeKey = rawKeys[this.currentIndex % rawKeys.length];
            
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${activeKey}`,
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                // Jika terkena Rate Limit atau Server Error, lompat ke kunci berikutnya
                if (response.status === 429 || response.status >= 500) {
                    this.currentIndex++;
                    attempt++;
                    continue;
                }

                if (!response.ok) {
                    console.error('GroqAPI Error', data);
                    throw new Error(data.error?.message || "Gagal terkoneksi ke otak Groq.");
                }

                return data.choices[0].message.content;
            } catch (err) {
                this.currentIndex++;
                attempt++;
                if (attempt >= maxLimit) throw err;
            }
        }
        
        throw new Error("Semua kunci Groq di pool sibuk (Limit Terlampaui) atau jaringan offline.");
    }
};

window.GroqAPI = GroqAPI;
