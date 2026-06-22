/**
 * Gemini AI Service Engine
 * Mengelola komunikasi ke Google Gemini API dengan arsitektur mutakhir.
 */

import { AuraState } from '../../core/state.js';
import { Logger } from '../../core/logger.js';

export const GeminiAPI = {
    callGemini: async function(messages, systemPrompt, requireJson = false, imgBase64 = null) {
        // 1. Tarik API Key dari pengaturan
        const apiKey = AuraState.data.settings?.geminiApiKey || localStorage.getItem('aurafi_gemini_key');
        
        if (!apiKey) {
            throw new Error("API Key Gemini kosong! Silakan isi di menu Pengaturan.");
        }

        // 2. PEMILIHAN MODEL PINTAR
        // Flash untuk kecepatan ekstrak JSON, Pro untuk Oracle yang butuh analisa tajam
        const model = requireJson ? "gemini-1.5-flash" : "gemini-1.5-pro";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const geminiMessages = [];
        
        // 3. Konversi format Role dari standar UI ke standar Gemini
        messages.forEach(msg => {
            if (msg.role !== 'system') {
                geminiMessages.push({
                    role: msg.role === 'assistant' || msg.role === 'ai' ? 'model' : 'user',
                    parts: [{ text: msg.content }]
                });
            }
        });

        // 4. Sisipkan payload gambar jika ada (untuk Staging Scan Visual)
        if (imgBase64) {
            const base64Data = imgBase64.includes(',') ? imgBase64.split(',')[1] : imgBase64;
            const mimeType = imgBase64.includes(',') ? imgBase64.split(';')[0].split(':')[1] : 'image/jpeg';
            
            if (geminiMessages.length > 0) {
                geminiMessages[geminiMessages.length - 1].parts.push({
                    inline_data: { mime_type: mimeType, data: base64Data }
                });
            }
        }

        // 5. Rakit Payload Final
        const payload = {
            system_instruction: {
                parts: [{ text: systemPrompt }]
            },
            contents: geminiMessages,
            generationConfig: {
                temperature: requireJson ? 0.0 : 0.7,
            }
        };

        // 6. PAKSAAN JSON MURNI (Mencegah AI menjawab di luar struktur yang diminta)
        if (requireJson) {
            payload.generationConfig.response_mime_type = "application/json";
        }

        // 7. Eksekusi ke Server Google
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            Logger.error('GeminiAPI', 'API Error', data);
            throw new Error(data.error?.message || "Gagal terkoneksi ke otak AI Gemini.");
        }

        return data.candidates[0].content.parts[0].text;
    }
};

// Global Binding agar bisa dipanggil oleh Orchestrator
window.GeminiAPI = GeminiAPI;
