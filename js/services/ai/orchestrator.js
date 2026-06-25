/**
 * AI Orchestrator (Versi Ultimate - Load Balancing & Anti Limit)
 * Mengatur rute eksekusi antara model Groq dan varian Gemini berdasarkan jenis data.
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
    
    // PEMBAGIAN TUGAS MODEL DINAMIS (Bisa diatur dari UI nantinya)
    // Jika belum diatur, otomatis menggunakan taktik Load Balancing terbaik
    const modelMataOCR = prefs.modelOcr || 'gemini-2.5-flash'; 
    const modelOtakJSON = prefs.modelBrain || 'gemini-3.5-flash';

    // ========================================================================
    // SKENARIO 1: DETEKSI STRUK GAMBAR (MODEL CHAINING PIPELINE)
    // ========================================================================
    if (base64Image) {
        if (!hasGemini) throw new Error("Fitur penglihatan (OCR) butuh Gemini. Pastikan Anda sudah login PIN Brankas!");

        if (window.showToast) window.showToast(`Tahap 1: Membaca teks (${modelMataOCR})...`, false);
        
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
            // PARAMETER KETIGA DITAMBAHKAN: modelMataOCR
            teksMentahStruk = await AuraState.instances.geminiEngine.fetch(geminiPayload, base64Image, modelMataOCR);
        } catch(e) {
            throw new Error(`Mata Gemini (${modelMataOCR}) Gagal: ${e.message}`);
        }

        if(!teksMentahStruk || teksMentahStruk.trim() === '') {
            throw new Error("Mata Gemini tidak menemukan teks apa pun di dalam gambar struk ini.");
        }

        // --- PENDINGIN MESIN UNTUK MENGHINDARI LIMIT 5 RPM ---
        if (window.showToast) window.showToast("Mendinginkan mesin sesaat (Anti-Limit)...", false);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Jeda 3 detik
        // -----------------------------------------------------

        if (window.showToast) window.showToast(`Tahap 2: Merakit data keuangan...`, false);

        // TAHAP 2: Otak (Merakit JSON)
        const finalMessages = [
            { role: "user", content: `[TEKS STRUK MENTAH DARI OCR]\n${teksMentahStruk}\n\n[INSTRUKSI ASLI USER]\n${userPrompt}` }
        ];

        let fallbackToGeminiBrain = false;

        // Opsi A: Groq
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

        // Opsi B: Gemini Otak (Model Chaining)
        if (chatModel === 'Gemini' || fallbackToGeminiBrain) {
            try {
                if (window.showToast && fallbackToGeminiBrain) window.showToast(`Beralih ke Otak ${modelOtakJSON}...`, false);

                const geminiBrainPayload = { 
                    contents: [{ role: "user", parts: [{ text: finalMessages[0].content }] }], 
                    systemInstruction: { parts: [{ text: systemPrompt }] } 
                };
                
                // PARAMETER KETIGA DITAMBAHKAN: modelOtakJSON
                const resultJSON = await AuraState.instances.geminiEngine.fetch(geminiBrainPayload, null, modelOtakJSON);
                return resultJSON;
            } catch(e) {
                throw new Error(`Otak Gemini (${modelOtakJSON}) Gagal: ${e.message}`);
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
            
            if (requireJson) {
                geminiPayload.generationConfig = { responseMimeType: "application/json" };
            }
            
            // Menggunakan Otak yang sama untuk Chat biasa
            const result = await AuraState.instances.geminiEngine.fetch(geminiPayload, null, modelOtakJSON);
            return result;
        } catch(e) { 
            lastError = e;
        }
    }
    
    throw new Error(`Koneksi Transmisi Intelek Terputus: ${lastError ? lastError.message : "Semua kunci AI sedang bermasalah."}`);
};
