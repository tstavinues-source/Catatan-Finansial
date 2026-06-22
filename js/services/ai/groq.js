/**
 * Groq AI Service Engine
 * Mengelola komunikasi ke Groq API. Dilengkapi sistem Auto-Decryption Cloud Key.
 */

import { AuraState } from '../../core/state.js';
import { Logger } from '../../core/logger.js';

export const GroqAPI = {
    callGroq: async function(messages, systemPrompt, requireJson = false, imgBase64 = null) {
        
        // 1. Tarik API Key yang dienkripsi dari Cloud Firebase
        const encKey = AuraState.data.settings?.groqApiKeyEncrypted;
        
        if (!encKey) {
            throw new Error("API Key Groq kosong! Silakan pasang Key di menu Pengaturan.");
        }

        // 2. SISTEM DEKRIPSI OTOMATIS MENGGUNAKAN UID
        const secret = AuraState.user?.uid || "aura_secret_fallback";
        let apiKey = null;
        try {
            let text = atob(encKey);
            let result = '';
            for (let i = 0; i < text.length; i++) {
                result += String.fromCharCode(text.charCodeAt(i) ^ secret.charCodeAt(i % secret.length));
            }
            apiKey = result;
        } catch(e) {
            throw new Error("Gagal membuka brankas Cloud Groq Key.");
        }

        if (!apiKey || !apiKey.startsWith('gsk_')) {
            throw new Error("Groq API Key di Cloud korup atau tidak valid.");
        }

        if (imgBase64) {
            Logger.warn('GroqAPI', 'Gambar terdeteksi. Groq murni mengandalkan teks, data gambar akan diabaikan.');
        }

        // 3. Eksekusi Model Mutakhir (Llama 3.1 8B Instant untuk Kecepatan JSON)
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

        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            Logger.error('GroqAPI', 'Groq API Error', data);
            throw new Error(data.error?.message || "Gagal terkoneksi ke otak supercepat Groq.");
        }

        return data.choices[0].message.content;
    }
};

window.GroqAPI = GroqAPI;
