/**
 * AI Orchestrator (Versi Single-Shot Hybrid Murni)
 * Alur: Gemini (Membaca Gambar 1x) ➔ Groq (Merakit JSON & Pajak 1x secara instan)
 * Menghilangkan waktu jeda dan memblokir tembakan beruntun ke server Google.
 */

import { AuraState } from '../../core/state.js';
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
    
    const ActiveGroq = (typeof GroqAPI !== 'undefined') ? GroqAPI : window.GroqAPI;
    const hasGroq = ActiveGroq && ActiveGroq.keysPool && ActiveGroq.keysPool.length > 0;
    const hasGemini = AuraState.instances.geminiEngine && AuraState.instances.geminiEngine.keysPool.length > 0;

    const prefs = AuraState.data.settings?.aiPreferences || {};
    const chatModel = prefs.modelChat || 'Auto'; 
    const modelMataOCR = prefs.modelOcr || 'gemini-2.5-flash'; 

    // ========================================================================
    // SKENARIO 1: DETEKSI STRUK GAMBAR (HYBRID LINTAS PROVIDER)
    // ========================================================================
    if (base64Image) {
        // Peringatan Keras: Hibrida butuh kedua kunci!
        if (!hasGemini) throw new Error("Fitur penglihatan (OCR) butuh Gemini. Pastikan PIN Brankas aktif!");
        if (!hasGroq) throw new Error("Sistem Hibrida membutuhkan API Key Groq yang terpasang di Cloud!");

        if (window.showToast) window.showToast(`Tahap 1: Membaca gambar via ${modelMataOCR}...`, false);
        
        // TAHAP 1: Gemini (Mata OCR - Ekstrak Mentah)
        const userPrompt = messages[messages.length - 1].content;
        const geminiOCRSystem = "Anda adalah mesin OCR buta yang tidak bisa berpikir, hanya bisa membaca teks. Ekstrak seluruh teks dalam gambar secara baris demi baris. Tulis persis apa adanya.";
        
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
            teksMentahStruk = await AuraState.instances.geminiEngine.fetch(geminiPayload, base64Image, modelMataOCR);
        } catch(e) {
            throw new Error(`Mata Gemini (${modelMataOCR}) Gagal: ${e.message}`);
        }

        if(!teksMentahStruk || teksMentahStruk.trim() === '') {
            throw new Error("Mata Gemini tidak menemukan teks apa pun di dalam gambar struk ini.");
        }

        // --- PENGHAPUSAN JEDA WAKTU (COOLDOWN) ---
        // Karena data dilempar ke Groq, kita hapus setTimeout 3000ms. Kecepatan maksimal!

        if (window.showToast) window.showToast(`Tahap 2: Groq sedang merakit JSON keuangan...`, false);

        // TAHAP 2: Otak Groq Llama (Merakit JSON)
        const hybridMessages = [
            { role: "user", content: `[TEKS STRUK MENTAH DARI OCR]\n${teksMentahStruk}\n\n[INSTRUKSI ASLI USER]\n${userPrompt}` }
        ];

        try {
            // PAKSA GROQ: Kita hapus opsi fallback ke Gemini untuk mencegah Rate Limit 503
            const resultJSON = await ActiveGroq.callGroq(hybridMessages, systemPrompt, requireJson, null);
            return resultJSON;
        } catch(e) {
            throw new Error(`Otak Groq Gagal Memproses Format: ${e.message}`);
        }
    }

    // ========================================================================
    // SKENARIO 2: CHAT TEXT-ONLY (TANPA GAMBAR)
    // ========================================================================
    let useGroq = (chatModel === 'Groq' || chatModel === 'Auto'); 
    let useGemini = (chatModel === 'Gemini' || chatModel === 'Auto');
    let lastError = null;
    let fallbackToGeminiChat = false;
    
    // Untuk Chat biasa, kita tetap pertahankan sistem Fallback normal
    if (useGroq && hasGroq) {
        try { 
            const result = await ActiveGroq.callGroq(messages, systemPrompt, requireJson, null);
            return result;
        } catch(e) { 
            lastError = e;
            if (useGemini && hasGemini) fallbackToGeminiChat = true;
            else throw e;
        }
    } else if (useGroq && !hasGroq) {
        if(hasGemini) fallbackToGeminiChat = true;
        else throw new Error("Tidak ada kuota API Key untuk engine AI aktif.");
    }
    
    if ((useGemini && hasGemini) || fallbackToGeminiChat) {
        try {
            const userPrompt = messages[messages.length - 1].content;
            const modelOtakJSON = prefs.modelBrain || 'gemini-3.5-flash';
            
            const geminiPayload = { 
                contents: [{ role: "user", parts: [{ text: userPrompt }] }], 
                systemInstruction: { parts: [{ text: systemPrompt }] } 
            };
            
            if (requireJson) {
                geminiPayload.generationConfig = { responseMimeType: "application/json" };
            }
            
            const result = await AuraState.instances.geminiEngine.fetch(geminiPayload, null, modelOtakJSON);
            return result;
        } catch(e) { 
            lastError = e;
        }
    }
    
    throw new Error(`Koneksi Transmisi Intelek Terputus: ${lastError ? lastError.message : "Semua kunci AI sedang bermasalah."}`);
};
