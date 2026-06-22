/**
 * Groq AI Service Engine
 * Mengelola komunikasi ke Groq API menggunakan model tercepat dan terpintar.
 */

import { AuraState } from '../../core/state.js';
import { Logger } from '../../core/logger.js';

export const GroqAPI = {
    callGroq: async function(messages, systemPrompt, requireJson = false, imgBase64 = null) {
        // 1. Tarik API Key dari pengaturan lokal atau memori statis
        const apiKey = AuraState.data.settings?.groqApiKey || localStorage.getItem('aurafi_groq_key');
        
        if (!apiKey) {
            throw new Error("API Key Groq kosong! Silakan isi di menu Pengaturan.");
        }

        if (imgBase64) {
            Logger.warn('GroqAPI', 'Gambar terdeteksi. Groq murni mengandalkan teks, data gambar akan diabaikan.');
        }

        // 2. PEMILIHAN MODEL MUTAKHIR (Data Juni 2026)
        // Kualitas Tertinggi & Penalaran Oracle: openai/gpt-oss-120b
        // Kecepatan Super Kilat & JSON (Struk): llama-3.1-8b-instant
        const modelName = requireJson ? "llama-3.1-8b-instant" : "openai/gpt-oss-120b";
        
        // Groq menggunakan arsitektur endpoint standar yang kompatibel dengan OpenAI
        const url = "https://api.groq.com/openai/v1/chat/completions";

        const groqMessages = [
            { role: "system", content: systemPrompt }
        ];
        
        // 3. Konversi format Role dari standar UI ke standar Groq/OpenAI
        messages.forEach(msg => {
            if (msg.role !== 'system') {
                groqMessages.push({
                    role: msg.role === 'ai' || msg.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.content
                });
            }
        });

        // 4. Rakit Payload Final
        const payload = {
            model: modelName,
            messages: groqMessages,
            temperature: requireJson ? 0.0 : 0.7,
        };

        // 5. PAKSAAN JSON MURNI (Wajib untuk ekstraksi struk Staging)
        if (requireJson) {
            payload.response_format = { type: "json_object" };
        }

        // 6. Tembak ke Server LPU Groq
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

// Global Binding agar bisa dipanggil oleh Orchestrator
window.GroqAPI = GroqAPI;
