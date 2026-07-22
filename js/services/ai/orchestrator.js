/**
 * AI Orchestrator (Versi Ultimate - Chain of Specialization)
 * Mengatur rute eksekusi antara model Groq dan varian Gemini berdasarkan jenis data.
 * Alur Struk: Gemini (Penerjemah & Analis Konteks 1x) ➔ Groq (Merakit JSON & Pajak 1x secara instan)
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
    
    // JALAN PINTAS: Perintahkan Groq mendekripsi dan memuat kunci dari Cloud sebelum validasi pool dilakukan
    if (ActiveGroq && typeof ActiveGroq.refreshKeys === 'function') {
        ActiveGroq.refreshKeys();
    }
    
    const hasGroq = ActiveGroq && ActiveGroq.keysPool && ActiveGroq.keysPool.length > 0;
    const hasGemini = AuraState.instances.geminiEngine && AuraState.instances.geminiEngine.keysPool && AuraState.instances.geminiEngine.keysPool.length > 0;

    const prefs = AuraState.data.settings?.aiPreferences || {};
    const chatModel = prefs.modelChat || 'Auto'; 
    
    // Versi Gemini disederhanakan: hanya model terbaru yang dipakai
    // (lihat gemini.js availableModels).
    const modelMataOCR = prefs.modelOcr || 'gemini-3.6-flash';
    const modelOtakJSON = prefs.modelBrain || 'gemini-3.6-flash';

    // ========================================================================
    // SKENARIO 1: DETEKSI STRUK GAMBAR (CHAIN OF SPECIALIZATION PIPELINE)
    // ========================================================================
    if (base64Image) {
        if (!hasGemini) throw new Error("Fitur penglihatan (OCR) butuh Gemini. Pastikan Anda sudah login PIN Brankas!");
        if (!hasGroq) throw new Error("Sistem Hibrida membutuhkan API Key Groq yang terpasang di Cloud!");

        if (window.showToast) window.showToast(`Tahap 1: Analisis & Translasi via ${modelMataOCR}...`, false);
        
        // TAHAP 1: Gemini (Mata OCR, Penerjemah & Analis Konteks)
        const userPrompt = messages[messages.length - 1].content;
        
        const geminiOCRSystem = `Kamu adalah Ahli Bahasa Jepang dan Analis Data Finansial.
Tugas Multimodal-mu:
1. Baca seluruh teks dalam gambar struk ini secara akurat.
2. NAMA TOKO: Ekstrak namanya. Jika menggunakan Katakana/Kanji, WAJIB transkripsikan ke Alfabet/Romaji.
3. NAMA BARANG: TERJEMAHKAN nama barang ke Bahasa Indonesia yang NATURAL, LAZIM, dan MASUK AKAL untuk konteks belanjaan supermarket. JANGAN gunakan terjemahan harfiah yang kaku/aneh.
4. KATEGORI: Berikan usulan nama kategori yang logis untuk setiap barang tersebut (misal: Sayuran, Bahan Pokok, Daging, Minuman, dll).
5. ANGKA: Catat harga setiap barang, jumlah (qty), dan indikator persentase pajak (8% atau 10%) yang ada di sebelahnya.
6. PAJAK BAWAH: Catat total belanja keseluruhan dan temukan total pajak terpisah di bawah struk (jika ada).

Keluarkan hasil analisismu sebagai TEKS MENTAH YANG RAPI DAN TERSTRUKTUR (seperti daftar/list). JANGAN membuat format JSON, karena teksmu ini akan dibaca oleh mesin akuntan untuk tahap selanjutnya.`;
        
        const geminiPayload = { 
            contents: [{ 
                role: "user", 
                parts: [
                    { text: "LAKUKAN ANALISIS DAN TERJEMAHAN NATURAL UNTUK GAMBAR STRUK INI." } 
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

        if (window.showToast) window.showToast(`Tahap 2: Groq sedang merakit JSON keuangan...`, false);

        // TAHAP 2: Otak Groq (Merakit JSON dari hasil analisis & terjemahan matang Gemini)
        const hybridMessages = [
            { role: "user", content: `[HASIL ANALISIS & TERJEMAHAN DARI AHLI BAHASA]\n${teksMentahStruk}\n\n[INSTRUKSI ASLI USER]\n${userPrompt}` }
        ];

        try {
            // Jalur dipaksa langsung ke Groq untuk eksekusi JSON super kilat
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
            
            const result = await AuraState.instances.geminiEngine.fetch(geminiPayload, null, modelOtakJSON);
            return result;
        } catch(e) { 
            lastError = e;
        }
    }
    
    throw new Error(`Koneksi Transmisi Intelek Terputus: ${lastError ? lastError.message : "Semua kunci AI sedang bermasalah."}`);
};
