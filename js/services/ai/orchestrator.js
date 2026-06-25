/**
 * AI Orchestrator (Versi Final - Menyesuaikan Struktur Asli GroqAPI)
 * Mengatur rute eksekusi antara model Groq dan Gemini berdasarkan jenis data.
 * MENGGUNAKAN PIPELINE KHUSUS UNTUK GAMBAR: Gemini (Mata) -> Groq (Otak).
 */

import { AuraState } from '../../core/state.js';

// Menggunakan kurung kurawal karena di groq.js Anda tertulis "export const GroqAPI"
import { GroqAPI } from './groq.js'; 

window.getOraclePromptConfigs = function() {
    const prefs = AuraState.data.settings?.aiPreferences || {};
    const defaultPersona = 'Kombinasi Humble + Jenius + Profesional';
    const defaultStyle = 'Normal';
    
    const userPersona = prefs.persona || defaultPersona;
    const userStyle = prefs.style || defaultStyle;
    
    let personaStr = "kombinasi humble, jenius, dan profesional";
    if (userPersona === "Humble Profesional") personaStr = "humble dan profesional";
    else if (userPersona === "Santai dan Asyik") personaStr = "santai, asyik, dan ramah";
    else if (userPersona === "Sarkas Cerdas") personaStr = "cerdas dengan sedikit sarkas elegan";
    else if (userPersona === "Mentor Keuangan") personaStr = "seperti mentor keuangan yang tegas dan bijak";
    else if (userPersona === "Formal") personaStr = "sangat formal, baku, dan analitis";
    else if (userPersona === "Lucu") personaStr = "lucu, humoris, dan menghibur";
    
    let styleStr = "Jawab dengan panjang normal (sekitar 3-8 kalimat).";
    if (userStyle === "Singkat") styleStr = "Jawab SINGKAT, padat, dan jelas. Maksimal 2 paragraf saja.";
    else if (userStyle === "Detail") styleStr = "Jawab dengan SANGAT DETAIL, komprehensif, dan panjang lebar.";
    
    return { personaStr: personaStr, styleStr: styleStr };
};

window.executeAIWithFallback = async function(messages, systemPrompt, requireJson, base64Image = null) {
    
    // Memastikan kita menggunakan GroqAPI yang tepat (dari import atau global)
    const ActiveGroq = (typeof GroqAPI !== 'undefined') ? GroqAPI : window.GroqAPI;

    if (!ActiveGroq) {
        throw new Error("Sistem Gagal Memuat GroqAPI. Pastikan file groq.js sudah dimuat.");
    }

    const hasGemini = AuraState.instances.geminiEngine && AuraState.instances.geminiEngine.keysPool.length > 0;

    // ========================================================================
    // SKENARIO 1: DETEKSI STRUK GAMBAR (PIPELINE GEMINI MATA -> GROQ OTAK)
    // ========================================================================
    if (base64Image) {
        if (!hasGemini) throw new Error("Fitur penglihatan (OCR) butuh Gemini. Pastikan Anda sudah login PIN Brankas!");

        if (window.showToast) window.showToast("Mata Gemini sedang memindai struk...", false);
        
        // TAHAP 1: Gemini (Hanya mengekstrak tulisan mentah)
        const userPrompt = messages[messages.length - 1].content;
        const geminiOCRSystem = "Anda adalah mesin OCR buta yang tidak bisa berpikir, hanya bisa membaca teks. Ekstrak seluruh teks dalam gambar secara baris demi baris termasuk karakter multi-bahasa. Dilarang merangkum, dilarang memberi penjelasan, tulis persis apa adanya.";
        
        const geminiPayload = { 
            contents: [{ 
                role: "user", 
                parts: [
                    { text: "SALIN DAN EKSTRAK SELURUH TEKS DALAM GAMBAR INI SECARA BARIS DEMI BARIS." } 
                ] 
            }], 
            systemInstruction: { parts: [{ text: geminiOCRSystem }] } 
        };
        
        let teksMentahStruk = "";
        try {
            teksMentahStruk = await AuraState.instances.geminiEngine.fetch(geminiPayload, base64Image);
        } catch(e) {
            throw new Error(`Mata Gemini Gagal Membaca: ${e.message}`);
        }

        if(!teksMentahStruk || teksMentahStruk.trim() === '') {
            throw new Error("Mata Gemini tidak menemukan teks apa pun di dalam gambar struk ini.");
        }

        if (window.showToast) window.showToast("Groq sedang merapikan data transaksi...", false);

        // TAHAP 2: Groq Merakit JSON (Memanggil fungsi callGroq milik Anda)
        const groqMessages = [
            { role: "user", content: `[TEKS STRUK MENTAH DARI OCR]\n${teksMentahStruk}\n\n[INSTRUKSI ASLI USER]\n${userPrompt}` }
        ];

        try {
            const resultJSON = await ActiveGroq.callGroq(groqMessages, systemPrompt, requireJson, null);
            return resultJSON;
        } catch(e) {
            throw new Error(`Otak Groq Gagal Merapikan Data: ${e.message}`);
        }
    }

    // ========================================================================
    // SKENARIO 2: CHAT TEXT-ONLY (TANPA GAMBAR)
    // ========================================================================
    const prefs = AuraState.data.settings?.aiPreferences || {};
    const chatModel = prefs.modelChat || 'Auto'; 
    let useGroq = (chatModel === 'Groq' || chatModel === 'Auto'); 
    let useGemini = (chatModel === 'Gemini' || chatModel === 'Auto');
    let lastError = null;
    let fallbackToGemini = false;
    
    if (useGroq) {
        try { 
            // Menggunakan callGroq untuk mode chat biasa
            const result = await ActiveGroq.callGroq(messages, systemPrompt, requireJson, null);
            return result;
        } catch(e) { 
            lastError = e;
            if (useGemini && hasGemini) fallbackToGemini = true;
            else throw e;
        }
    }
    
    if ((useGemini && hasGemini) || fallbackToGemini) {
        try {
            const userPrompt = messages[messages.length - 1].content;
            const geminiPayload = { 
                contents: [{ role: "user", parts: [{ text: userPrompt }] }], 
                systemInstruction: { parts: [{ text: systemPrompt }] } 
            };
            
            if (requireJson) {
                geminiPayload.generationConfig = { responseMimeType: "application/json" };
            }
            
            const result = await AuraState.instances.geminiEngine.fetch(geminiPayload, null);
            return result;
        } catch(e) { 
            lastError = e;
        }
    }
    
    throw new Error(`Koneksi Transmisi Intelek Terputus: ${lastError ? lastError.message : "Sistem mati atau tidak ada kunci AI aktif."}`);
};
