/**
 * AI Orchestrator
 * Mengatur rute eksekusi antara model Groq dan Gemini berdasarkan jenis data.
 * MENGGUNAKAN PIPELINE KHUSUS UNTUK GAMBAR: Gemini (Mata) -> Groq (Otak).
 */

import { AuraState } from '../../core/state.js';
import { GroqService } from './groq.js';

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
    else if (userPersona === "Formal") personaStr = "sangt formal, baku, dan analitis";
    else if (userPersona === "Lucu") personaStr = "lucu, humoris, dan menghibur";
    
    let styleStr = "Jawab dengan panjang normal (sekitar 3-8 kalimat).";
    if (userStyle === "Singkat") styleStr = "Jawab SINGKAT, padat, dan jelas. Maksimal 2 paragraf saja.";
    else if (userStyle === "Detail") styleStr = "Jawab dengan SANGAT DETAIL, komprehensif, dan panjang lebar.";
    
    return { personaStr: personaStr, styleStr: styleStr };
};

window.executeAIWithFallback = async function(messages, systemPrompt, requireJson, base64Image = null) {
    
    // Pastikan kunci Groq termuat ke kolam antrean
    if (GroqService.keysPool.length === 0 && AuraState.data.groqKeys && AuraState.data.groqKeys.length > 0) {
        GroqService.init(AuraState.data.groqKeys);
    }
    
    const hasGemini = AuraState.instances.geminiEngine && AuraState.instances.geminiEngine.keysPool.length > 0;
    const hasGroq = GroqService.keysPool.length > 0;

    // ========================================================================
    // SKENARIO 1: ADA GAMBAR (PIPELINE GEMINI MATA -> GROQ OTAK)
    // ========================================================================
    if (base64Image) {
        if (!hasGemini) throw new Error("Fitur penglihatan (OCR) butuh Gemini. Pastikan Anda sudah login PIN Brankas!");
        if (!hasGroq) throw new Error("Fitur Otak AI (Groq) mati. Pastikan API Key Groq sudah terisi di Pengaturan!");

        if (window.showToast) window.showToast("Mata Gemini sedang memindai struk...", false);
        
        // TAHAP 1: Gemini (Hanya untuk Ekstrak Teks Mentah)
        const userPrompt = messages[messages.length - 1].content;
        const geminiOCRSystem = "Anda adalah mesin OCR buta yang tidak bisa berpikir, hanya bisa membaca teks. Ekstrak seluruh teks dalam gambar secara baris demi baris. Dilarang merangkum, dilarang memberi penjelasan, tulis persis apa adanya.";
        
        const geminiPayload = { 
            contents: [{ 
                role: "user", 
                parts: [
                    { text: "BACA SELURUH TEKS DALAM GAMBAR INI APA ADANYA." } 
                    // image base64 akan ditambahkan otomatis di dalam gemini.js
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
            throw new Error("Mata Gemini tidak menemukan teks apa pun di gambar ini.");
        }

        if (window.showToast) window.showToast("Groq sedang merapikan data transaksi...", false);

        // TAHAP 2: Groq (Llama 3.3) Merakit JSON
        // Kita timpa pesan User yang asli dengan Teks Mentah dari Gemini
        const groqMessages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: `[TEKS STRUK MENTAH DARI OCR]\n${teksMentahStruk}\n\n[INSTRUKSI ASLI USER]\n${userPrompt}` }
        ];

        try {
            const resultJSON = await GroqService.fetch(groqMessages, requireJson);
            return resultJSON;
        } catch(e) {
            throw new Error(`Otak Groq Gagal Merapikan Data: ${e.message}`);
        }
    }

    // ========================================================================
    // SKENARIO 2: TIDAK ADA GAMBAR (CHAT BIASA)
    // ========================================================================
    const prefs = AuraState.data.settings?.aiPreferences || {};
    const chatModel = prefs.modelChat || 'Auto'; 
    let useGroq = (chatModel === 'Groq' || chatModel === 'Auto'); 
    let useGemini = (chatModel === 'Gemini' || chatModel === 'Auto');
    let lastError = null;
    let fallbackToGemini = false;
    
    // Coba Groq terlebih dahulu (Karena cepat)
    if (useGroq && hasGroq) {
        try { 
            const result = await GroqService.fetch(messages, requireJson);
            return result;
        } catch(e) { 
            lastError = e;
            if (useGemini && hasGemini) fallbackToGemini = true;
            else throw e;
        }
    } else if (useGroq && !hasGroq) {
        if(hasGemini) fallbackToGemini = true;
        else throw new Error("Tidak ada kuota konfigurasi Key untuk engine Groq.");
    }
    
    // Coba Gemini (Sebagai Fallback / Pilihan User)
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
    
    throw new Error(`Koneksi Transmisi Intelek Terputus: ${lastError ? lastError.message : "Sistem mati atau tidak ada kunci AI."}`);
};
