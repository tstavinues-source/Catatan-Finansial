/**
 * AI Orchestrator (Versi Ultimate - Anti Pending / Rate Limit Safe)
 * Mengatur rute eksekusi antara model Groq dan Gemini berdasarkan jenis data.
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

    // ========================================================================
    // SKENARIO 1: DETEKSI STRUK GAMBAR (MODEL CHAINING PIPELINE)
    // ========================================================================
    if (base64Image) {
        if (!hasGemini) throw new Error("Fitur penglihatan (OCR) butuh Gemini. Pastikan Anda sudah login PIN Brankas!");

        if (window.showToast) window.showToast("Tahap 1: Membaca teks struk (OCR)...", false);
        
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
            teksMentahStruk = await AuraState.instances.geminiEngine.fetch(geminiPayload, base64Image);
        } catch(e) {
            throw new Error(`Mata Gemini Gagal Membaca: ${e.message}`);
        }

        if(!teksMentahStruk || teksMentahStruk.trim() === '') {
            throw new Error("Mata Gemini tidak menemukan teks apa pun di dalam gambar struk ini.");
        }

        // --- PENYEMBUHAN "PENDING ABADI" DIMULAI DI SINI ---
        // Memberi waktu napas 1.5 detik agar API Google tidak menganggap ini serangan spam (Burst Rate Limit)
        if (window.showToast) window.showToast("Mendinginkan mesin AI sesaat...", false);
        await new Promise(resolve => setTimeout(resolve, 1500));
        // ---------------------------------------------------

        if (window.showToast) window.showToast("Tahap 2: AI sedang merakit data keuangan...", false);

        // TAHAP 2: Otak (Merakit JSON)
        const finalMessages = [
            { role: "user", content: `[TEKS STRUK MENTAH DARI OCR]\n${teksMentahStruk}\n\n[INSTRUKSI ASLI USER]\n${userPrompt}` }
        ];

        let fallbackToGeminiBrain = false;

        if ((chatModel === 'Groq' || chatModel === 'Auto') && hasGroq) {
            try {
                const resultJSON = await ActiveGroq.callGroq(finalMessages, systemPrompt, requireJson, null);
                return resultJSON;
            } catch(e) {
                console.warn("Groq gagal menyusun JSON. Beralih ke Gemini sebagai Otak...", e);
                fallbackToGeminiBrain = true; 
            }
        } else if (!hasGroq) {
            fallbackToGeminiBrain = true;
        }

        if (chatModel === 'Gemini' || fallbackToGeminiBrain) {
            try {
                if (window.showToast && fallbackToGeminiBrain) window.showToast("Beralih ke Otak Gemini...", false);

                const geminiBrainPayload = { 
                    contents: [{ role: "user", parts: [{ text: finalMessages[0].content }] }], 
                    systemInstruction: { parts: [{ text: systemPrompt }] } 
                };
                
                // KITA MATIKAN responseMimeType agar Gemini tidak terjebak dalam loop JSON internalnya
                // Karena systemPrompt di staging.js sudah sangat memaksa bentuk JSON murni.
                
                const resultJSON = await AuraState.instances.geminiEngine.fetch(geminiBrainPayload, null);
                return resultJSON;
            } catch(e) {
                throw new Error(`Otak Gemini Gagal Merapikan Data: ${e.message}`);
            }
        }
    }

    // ========================================================================
    // SKENARIO 2: CHAT TEXT-ONLY (TANPA GAMBAR)
    // ========================================================================
    let useGroq = (chatModel === 'Groq' || chatModel === 'Auto'); 
    let useGemini = (chatModel === 'Gemini' || chatModel === 'Auto');
    let lastError = null;
    let fallbackToGeminiChat = false;
    
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
            const geminiPayload = { 
                contents: [{ role: "user", parts: [{ text: userPrompt }] }], 
                systemInstruction: { parts: [{ text: systemPrompt }] } 
            };
            
            // Untuk Chat murni tanpa gambar, kita tetap bisa pakai MimeType jika butuh JSON
            if (requireJson) {
                geminiPayload.generationConfig = { responseMimeType: "application/json" };
            }
            
            const result = await AuraState.instances.geminiEngine.fetch(geminiPayload, null);
            return result;
        } catch(e) { 
            lastError = e;
        }
    }
    
    throw new Error(`Koneksi Transmisi Intelek Terputus: ${lastError ? lastError.message : "Semua kunci AI sedang bermasalah."}`);
};
