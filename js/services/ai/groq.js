/**
 * Groq AI Service Engine
 * Mengelola komunikasi ke Groq API. Dilengkapi sistem Auto-Decryption dan Failover Pool.
 */

import { AuraState } from '../../core/state.js';

export const GroqAPI = {
    currentIndex: 0,
    keysPool: [], // <--- Jembatan agar Orchestrator tahu kunci sudah terpasang
    
    // Fungsi khusus untuk menarik dan mendekripsi kunci dari Cloud secara instan
    refreshKeys: function() {
        let rawKeys = AuraState.data?.settings?.groqKeysEncrypted || [];
        let encKeys = Array.isArray(rawKeys) ? rawKeys : Object.values(rawKeys);
        const secret = AuraState.user?.uid || "aura_secret_fallback";
        
        this.keysPool = []; // Bersihkan memori sebelum diisi ulang
        
        for (let k of encKeys) {
            try {
                let text = atob(k); let result = '';
                for (let i = 0; i < text.length; i++) {
                    result += String.fromCharCode(text.charCodeAt(i) ^ secret.charCodeAt(i % secret.length));
                }
                if (result.startsWith('gsk_')) this.keysPool.push(result);
            } catch(e) {}
        }
    },

    callGroq: async function(messages, systemPrompt, requireJson = false, imgBase64 = null) {
        
        // Tarik kunci segar dari Cloud setiap kali mau menembak
        this.refreshKeys();
        
        if (this.keysPool.length === 0) {
            throw new Error("API Key Groq kosong! Silakan pasang minimal 1 Key di menu Pengaturan.");
        }

        if (imgBase64) {
            console.warn('GroqAPI: Gambar terdeteksi. Groq murni teks, gambar diabaikan.');
        }

        const modelName = "qwen/qwen3.6-27b";
        const url = "https://api.groq.com/openai/v1/chat/completions";

        const groqMessages = [{ role: "system", content: systemPrompt }];
        messages.forEach(msg => {
            if (msg.role !== 'system') {
                groqMessages.push({ role: msg.role === 'ai' || msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content });
            }
        });

        const payload = { model: modelName, messages: groqMessages, temperature: requireJson ? 0.0 : 0.7 };
        if (requireJson) payload.response_format = { type: "json_object" };

        let attempt = 0;
        const maxLimit = Math.min(this.keysPool.length, 3);
        
        while (attempt < maxLimit) {
            // Menggunakan this.keysPool yang sudah ditarik dari fungsi refreshKeys
            const activeKey = this.keysPool[this.currentIndex % this.keysPool.length];
            
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${activeKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (response.status === 429 || response.status >= 500) {
                    this.currentIndex++; attempt++; continue;
                }

                if (!response.ok) {
                    console.error('GroqAPI Error', data);
                    throw new Error(data.error?.message || "Gagal terkoneksi ke otak Groq.");
                }

                return data.choices[0].message.content;
            } catch (err) {
                this.currentIndex++; attempt++;
                if (attempt >= maxLimit) throw err;
            }
        }
        
        throw new Error("Semua kunci Groq di pool sibuk (Limit Terlampaui) atau jaringan offline.");
    }
};

window.GroqAPI = GroqAPI;
