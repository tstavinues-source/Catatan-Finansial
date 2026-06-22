/**
 * AI Orchestrator
 * Mengatur rute eksekusi antara model Groq dan Gemini berdasarkan jenis data.
 */

import { AuraState } from '../../core/state.js';
// PERBAIKAN: Menggunakan nama export yang benar dari groq.js yang baru
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
    const prefs = AuraState.data.settings?.aiPreferences || {};
    const chatModel = prefs.modelChat || 'Auto'; 
    const visionModel = prefs.modelVision || 'Auto';
    
    let useGroq = false; 
    let useGemini = false;
    
    if (base64Image) { 
        if (visionModel === 'Gemini' || visionModel === 'Auto') useGemini = true;
        else if (visionModel === 'Groq Vision') useGroq = true;
    } else { 
        if (chatModel === 'Groq') useGroq = true;
        else if (chatModel === 'Gemini') useGemini = true;
        else { useGroq = true; useGemini = true; } 
    }
    
    let lastError = null;
    let fallbackToGemini = false;
    
    if (useGroq) {
        try { 
            // PERBAIKAN: Memanggil GroqAPI dengan parameter yang benar sesuai arsitektur baru
            const result = await GroqAPI.callGroq(messages, systemPrompt, requireJson, base64Image);
            lastError = null; 
            return result;
        } catch(e) { 
            lastError = e;
            if (useGemini) fallbackToGemini = true;
            else throw e;
        }
    }
    
    if (useGemini || fallbackToGemini) {
        if (AuraState.instances.geminiEngine && AuraState.instances.geminiEngine.keysPool.length > 0) {
            try {
                // PERBAIKAN: Membangun payload Gemini sesuai arsitektur Gembok Nexus yang baru
                const userPrompt = messages[messages.length - 1].content;
                const geminiPayload = { 
                    contents: [{ role: "user", parts: [{ text: userPrompt }] }], 
                    system_instruction: { parts: [{ text: systemPrompt }] } 
                };
                
                // Orchestrator akan menyuntikkan instruksi JSON ke payload agar ditangkap oleh GeminiFailoverEngine
                if (requireJson) {
                    if (!geminiPayload.system_instruction) geminiPayload.system_instruction = { parts: [{ text: "" }] };
                    geminiPayload.system_instruction.parts[0].text += " FORMAT WAJIB: JSON.";
                }
                
                const result = await AuraState.instances.geminiEngine.fetch(geminiPayload, base64Image);
                lastError = null; 
                return result;
            } catch(e) { 
                lastError = e;
            }
        } else if (!useGroq) {
            throw new Error("Engine Gemini masih terkunci atau Anda lupa memasukkan PIN Enkripsi.");
        }
    }
    
    throw new Error(`Koneksi Transmisi Intelek Terputus: ${lastError ? lastError.message : "Sistem mati."}`);
};
