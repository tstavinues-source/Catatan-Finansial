/**
 * Settings UI Handlers & Renderers
 * Mengelola semua form di dalam Modal Settings: Profil, Preferensi AI, API Keys (XOR Cloud Sync), dll.
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';
import { APP_CONFIG } from '../config/constants.js';
import { DEFAULT_STAPLES_TRACKERS } from '../config/categories.js';
import { FirebaseService } from '../services/firebase.js';
import { get, ref, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// ============================================================================
// PROFIL & PREFERENSI AI
// ============================================================================

window.saveUserProfile = async function() {
    const nameEl = document.getElementById('user-fullname');
    const nickEl = document.getElementById('user-nickname');
    const countryEl = document.getElementById('user-country');
    const currEl = document.getElementById('user-currency');
    
    if (!nameEl || !nickEl) return;
    
    const name = nameEl.value.trim();
    const nick = nickEl.value.trim();
    const country = countryEl ? countryEl.value : 'Jepang';
    const currency = currEl ? currEl.value : 'JPY';
    
    if (!name || !nick) {
        if (window.showToast) window.showToast("Nama dan Panggilan tidak boleh kosong!", true);
        return;
    }
    try {
        await FirebaseService.updateSettings({ 
            profile: { 
                fullName: name, 
                nickname: nick,
                country: country,
                defaultCurrency: currency
            } 
        });
        
        if (typeof window.setCurrency === 'function' && AuraState.system.displayCurrency !== currency) {
            window.setCurrency(currency);
        }
        
        if (window.showToast) window.showToast("Profil, Negara & Mata Uang berhasil disimpan!");
    } catch (e) {
        if (window.showToast) window.showToast("Gagal menyimpan profil.", true);
    }
};

window.saveAIPreferences = async function() {
    const chatEl = document.getElementById('setting-ai-chat');
    const visionEl = document.getElementById('setting-ai-vision');
    const personaEl = document.getElementById('setting-ai-persona');
    const styleEl = document.getElementById('setting-ai-style');
    
    try {
        await FirebaseService.updateSettings({ 
            aiPreferences: { 
                modelChat: chatEl ? chatEl.value : 'Auto',
                modelVision: visionEl ? visionEl.value : 'Auto',
                persona: personaEl ? personaEl.value : 'Kombinasi Humble + Jenius + Profesional',
                style: styleEl ? styleEl.value : 'Normal'
            } 
        });
        if (window.showToast) window.showToast("Preferensi AI berhasil disimpan.");
    } catch (e) {
        if (window.showToast) window.showToast("Gagal menyimpan preferensi AI.", true);
    }
};

// ============================================================================
// MANAJEMEN API KEYS (GROQ CLOUD CIPHER & GEMINI)
// ============================================================================

window.addGroqKey = async function() {
    const input = document.getElementById('new-groq-key');
    if (!input) return;
    const key = input.value.trim();
    
    if (!key || !key.startsWith('gsk_')) {
        if (window.showToast) window.showToast("Format API Key tidak valid (harus gsk_...)", true);
        return;
    }
    
    // SISTEM ENKRIPSI XOR DENGAN UID (Aman & Tidak Terbaca di Firebase)
    const secret = AuraState.user?.uid || "aura_secret_fallback";
    let result = '';
    for (let i = 0; i < key.length; i++) {
        result += String.fromCharCode(key.charCodeAt(i) ^ secret.charCodeAt(i % secret.length));
    }
    const encryptedBase64 = btoa(result);
    
    try {
        await FirebaseService.updateSettings({ groqApiKeyEncrypted: encryptedBase64 });
        
        if(!AuraState.data.settings) AuraState.data.settings = {};
        AuraState.data.settings.groqApiKeyEncrypted = encryptedBase64;
        
        input.value = '';
        if (window.showToast) window.showToast("Kunci Groq dienkripsi dan diamankan ke Cloud Firebase!");
        
        if (typeof window.renderGroqKeysUI === 'function') window.renderGroqKeysUI();
    } catch(e) {
        if (window.showToast) window.showToast("Gagal mengunggah kunci ke Cloud.", true);
    }
};

window.removeGroqKey = async function() {
    if(!confirm("Yakin ingin mencabut LPU Master Key Groq dari Cloud?")) return;
    try {
        await FirebaseService.updateSettings({ groqApiKeyEncrypted: null });
        if(AuraState.data.settings) AuraState.data.settings.groqApiKeyEncrypted = null;
        if (window.showToast) window.showToast("Kunci berhasil dihancurkan dari Cloud.");
        if (typeof window.renderGroqKeysUI === 'function') window.renderGroqKeysUI();
    } catch(e) {
        if (window.showToast) window.showToast("Gagal mencabut kunci.", true);
    }
};

window.renderGroqKeysUI = function() {
    AuraUtils.safeDOM('groq-keys-container', function(el) {
        const encKey = AuraState.data.settings?.groqApiKeyEncrypted;
        const badge = document.getElementById('groq-status-badge');

        if (!encKey) {
            el.innerHTML = '<p class="text-[10px] text-[var(--text-muted)] text-center my-2 p-2 bg-black/40 rounded-lg border border-[var(--border-glass)]">Tidak ada Kunci Groq terpasang. Mesin Offline.</p>';
            if(badge) {
                badge.className = "text-[9px] bg-red-950/40 text-rose-400 border border-red-900/50 px-2 py-0.5 rounded uppercase tracking-[0.1em] font-mono";
                badge.innerText = "OFFLINE";
            }
            return;
        }

        // Dekripsi Visual untuk ditampilkan
        const secret = AuraState.user?.uid || "aura_secret_fallback";
        let dec = null;
        try {
            let text = atob(encKey);
            let result = '';
            for (let i = 0; i < text.length; i++) {
                result += String.fromCharCode(text.charCodeAt(i) ^ secret.charCodeAt(i % secret.length));
            }
            dec = result;
        } catch(e) {}

        const isValid = dec && dec.startsWith('gsk_');
        const display = isValid ? `${dec.substring(0,8)}...${dec.substring(dec.length-4)}` : `(Data Cloud Korup)`;
        const statusColor = isValid ? 'text-emerald-400' : 'text-rose-400';

        if(badge && isValid) {
             badge.className = "text-[9px] bg-emerald-950/40 text-emerald-400 border border-emerald-900/50 px-2 py-0.5 rounded uppercase tracking-[0.1em] font-mono shadow-[0_0_10px_rgba(16,185,129,0.2)]";
             badge.innerText = "ONLINE";
        }

        el.innerHTML = `
        <div class="flex justify-between items-center bg-[var(--bg-base)] p-2.5 rounded-xl border border-emerald-900/30 bg-emerald-900/10">
            <div class="flex flex-col">
                <span class="font-mono text-xs font-bold ${statusColor} flex items-center gap-2"><i class="fa-solid fa-cloud-check"></i> ${display}</span>
                <span class="text-[8px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5">Tersinkronisasi dengan Firebase Cloud</span>
            </div>
            <button onclick="window.removeGroqKey()" class="text-rose-500 p-2 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg active:scale-90 transition"><i class="fa-solid fa-trash text-xs"></i></button>
        </div>`;
    });
};

window.syncGeminiEngine = async function(silent = false) {
    const pinEl = document.getElementById('gemini-pin-input');
    const pinInput = pinEl ? pinEl.value.trim() : '';
    const pin = silent ? localStorage.getItem('aurafi_gemini_pin') : pinInput;
    
    if (!pin || pin.length < 3) { 
        if (!silent && window.showToast) window.showToast("HARAP MASUKKAN PIN GEMINI!", true); return; 
    }

    const gBadge = document.getElementById('gemini-status-badge');
    if (gBadge) { gBadge.className = "text-[9px] bg-indigo-950/40 text-indigo-400 border border-indigo-900/50 px-2 py-0.5 rounded font-mono animate-pulse"; gBadge.innerText = "DECRYPTING..."; }
    
    try {
        if(typeof window.GeminiFailoverEngine !== 'function') throw new Error("Modul AI belum siap.");
        const geminiEngine = new window.GeminiFailoverEngine(pin);
        const gCount = await geminiEngine.init();
        
        if (gCount > 0) {
            AuraState.instances.geminiEngine = geminiEngine;
            localStorage.setItem('aurafi_gemini_pin', pin);
            if (gBadge) { gBadge.className = "text-[9px] bg-emerald-950/40 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-mono"; gBadge.innerText = `ACTIVE (${gCount})`; }
            if (!silent && window.showToast) window.showToast("Gemini Vision Di-Unlock.");
        } else { throw new Error("0 Keys"); }
    } catch(e) {
        if (gBadge) { gBadge.className = "text-[9px] bg-red-950/40 text-rose-400 border border-red-900/50 px-2 py-0.5 rounded font-mono"; gBadge.innerText = "LOCKED"; }
        if (!silent && window.showToast) window.showToast("Dekripsi Gagal: PIN Salah.", true);
    }
};

// ============================================================================
// MANAJEMEN TAGIHAN RUTIN (RECURRING)
// ============================================================================

window.addRecurringPayment = async function() {
    const nameEl = document.getElementById('new-rec-name');
    const amtEl = document.getElementById('new-rec-amt');
    const dateEl = document.getElementById('new-rec-date');
    const methodEl = document.getElementById('new-rec-method');
    
    if(!nameEl || !amtEl || !dateEl) return;
    const name = nameEl.value.trim(); const amt = parseFloat(amtEl.value); const date = parseInt(dateEl.value); const method = methodEl ? methodEl.value : 'cashless';
    if(!name || isNaN(amt) || isNaN(date) || date < 1 || date > 31) { if(window.showToast) window.showToast("Form tidak valid!", true); return; }
    
    const recId = `rec_${Date.now()}`;
    const updates = {}; updates[`recurringPayments/${recId}`] = { name, amount: amt, date, method };
    try {
        await FirebaseService.updateSettings(updates);
        nameEl.value = ''; amtEl.value = ''; dateEl.value = '';
        if(window.showToast) window.showToast("Tagihan otomatis ditambahkan.");
    } catch(e) { if(window.showToast) window.showToast("Gagal menambah.", true); }
};

window.removeRecurringPayment = async function(id) {
    if(!confirm("Hapus tagihan otomatis ini?")) return;
    try { await remove(ref(AuraState.instances.db, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/settings/recurringPayments/${id}`)); if(window.showToast) window.showToast("Tagihan dihapus."); } 
    catch(e) { if(window.showToast) window.showToast("Gagal menghapus.", true); }
};

window.renderRecurringUI = function() {
    AuraUtils.safeDOM('recurring-list', function(el) {
        const rPayments = AuraState.data.settings?.recurringPayments || {};
        const entries = Object.entries(rPayments);
        if (entries.length === 0) { el.innerHTML = '<p class="text-[10px] text-[var(--text-muted)] text-center my-2">Mesin belum diajarkan mengenai rutinitas bulanan Anda.</p>'; return; }

        let htmlCompiled = '';
        entries.forEach(([id, rp]) => {
            htmlCompiled += `
            <div class="flex justify-between items-center bg-[var(--bg-base)] p-2 rounded-xl border border-[var(--border-glass)]">
                <div class="flex flex-col">
                    <span class="font-bold text-xs text-sky-400">${AuraUtils.escapeHtml(rp.name)}</span>
                    <span class="text-[9px] text-[var(--text-muted)] font-mono">H-(${rp.date}) | ${AuraUtils.formatCurrency(rp.amount)}</span>
                </div>
                <button onclick="window.removeRecurringPayment('${id}')" class="text-rose-500 p-1 hover:text-rose-400 transition active:scale-90"><i class="fa-solid fa-trash-can text-xs"></i></button>
            </div>`;
        });
        el.innerHTML = htmlCompiled;
    });
};

window.renderRecurringUIForBudget = function() {
    AuraUtils.safeDOM('budget-bills-container', function(el) {
        const rPayments = AuraState.data.settings?.recurringPayments || {};
        const entries = Object.entries(rPayments);
        if (entries.length === 0) { el.innerHTML = '<p class="text-[10px] text-[var(--text-muted)] text-center my-2 p-3 bg-black/20 rounded-xl">Konfigurasi Tagihan Kosong.</p>'; return; }

        let compiledBudgets = '';
        entries.forEach(([id, rp]) => {
            compiledBudgets += `
            <div class="glass-panel p-3 flex justify-between items-center border-l-2 border-l-sky-400 group">
                <div>
                    <h4 class="font-bold text-xs text-sky-400 flex items-center gap-2">
                        ${AuraUtils.escapeHtml(rp.name)} 
                        <button onclick="window.removeRecurringPayment('${id}')" class="text-rose-500 hover:text-rose-400 transition opacity-0 group-hover:opacity-100"><i class="fa-solid fa-trash text-[10px]"></i></button>
                    </h4>
                    <p class="text-[9px] text-[var(--text-muted)] font-mono uppercase mt-0.5">Tgl Eksekusi: ${rp.date} / Bulan</p>
                </div>
                <p class="font-bold text-sm font-mono text-[var(--text-main)]">${AuraUtils.formatCurrency(rp.amount)}</p>
            </div>`;
        });
        el.innerHTML = compiledBudgets;
    });
};

// ============================================================================
// LANJUTAN: TRACKER DINAMIS & FITUR LAINNYA
// ============================================================================

window.autoFillTrackerWithAI = async function() {
    const topic = prompt("Tracker apa yang ingin kamu buat? (Misal: Skincare, Kopi, Kucing)");
    if (!topic || topic.trim() === '') return;
    
    const btn = document.getElementById('btn-ai-tracker');
    const originalText = btn.innerHTML;
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-circle-notch animate-spin mr-1"></i> Memproses...'; btn.disabled = true; }

    try {
        const systemPrompt = `Kamu adalah ahli pembuat kata kunci untuk sistem Tracker Keuangan. 
TUGAS: Buat konfigurasi untuk melacak pengeluaran pengguna yang berkaitan dengan topik: "${topic}".
1. "id": satu kata pendek huruf kecil (contoh: kopi).
2. "name": Judul elegan dan rapi (contoh: Kopi & Kafe).
3. "keywords": array minimal 10 kata bersinonim/merek. Harus huruf kecil. (contoh: ["starbucks", "janji jiwa", "kopi"]).
WAJIB MENGEMBALIKAN DALAM FORMAT JSON MURNI TANPA TAG \`\`\`json:
{"id": "string", "name": "string", "keywords": ["string1", "string2"]}`;
        const messages = [{ role: "user", content: `Buatkan konfigurasi tracker untuk: ${topic}` }];
        
        const responseText = await window.executeAIWithFallback(messages, systemPrompt, true, null);
        const aiJson = AuraUtils.parseCleanJSON(responseText);

        AuraUtils.safeDOM('new-track-id', el => el.value = aiJson.id || '');
        AuraUtils.safeDOM('new-track-name', el => el.value = aiJson.name || '');
        AuraUtils.safeDOM('new-track-keywords', el => el.value = (aiJson.keywords || []).join(', '));
        if (window.showToast) window.showToast("Berhasil! AI telah mengisi form untukmu.");
    } catch (e) {
        if (window.showToast) window.showToast("AI gagal memproses permintaan: " + e.message, true);
    } finally {
        if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
    }
};

window.openTrackerManager = function() {
    const listContainer = document.getElementById('tracker-list-container');
    if (!listContainer) return;
    
    const trackers = AuraState.data.settings?.staplesTrackers || DEFAULT_STAPLES_TRACKERS;
    let html = '';
    
    Object.entries(trackers).forEach(([id, t]) => {
        html += `
        <div class="glass-panel p-3 border-l-2 border-l-amber-400 flex justify-between items-center mb-2">
            <div>
                <p class="text-xs font-bold text-amber-400">${AuraUtils.escapeHtml(t.name)}</p>
                <p class="text-[9px] text-[var(--text-muted)] uppercase mt-0.5 leading-relaxed">Keys: ${AuraUtils.escapeHtml(t.keywords.join(', '))}</p>
            </div>
            <button onclick="window.removeTracker('${id}')" class="text-rose-500 hover:text-rose-400 p-2"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    });
    listContainer.innerHTML = html;
    
    const formContainer = document.getElementById('new-tracker-form-container');
    if (formContainer && !document.getElementById('btn-ai-tracker')) {
        const aiBtnHtml = `<button id="btn-ai-tracker" onclick="window.autoFillTrackerWithAI()" class="w-full bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 border border-indigo-500/30 font-bold text-[10px] py-2 rounded-lg mb-3 transition active:scale-[0.98]"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i> Isi Otomatis dengan AI</button>`;
        formContainer.insertAdjacentHTML('afterbegin', aiBtnHtml);
    }

    if (typeof window.showModal === 'function') window.showModal('modal-edit-tracker');
};

window.saveNewTracker = async function() {
    const idInput = document.getElementById('new-track-id'); const nameInput = document.getElementById('new-track-name'); const keyInput = document.getElementById('new-track-keywords');
    if (!idInput || !nameInput || !keyInput) return;
    
    const id = idInput.value.trim().toLowerCase().replace(/[^a-z0-9]/g, ''); const name = nameInput.value.trim();
    const keywords = keyInput.value.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
    
    if (!id || !name || keywords.length === 0) { if (window.showToast) window.showToast("Isi ID, Nama, dan minimal 1 kata kunci!", true); return; }
    
    const updates = {}; updates[`staplesTrackers/${id}`] = { name: name, keywords: keywords };
    try { await FirebaseService.updateSettings(updates); idInput.value = ''; nameInput.value = ''; keyInput.value = ''; window.openTrackerManager(); } 
    catch(e) { if (window.showToast) window.showToast("Gagal menyimpan Tracker.", true); }
};

window.removeTracker = async function(id) {
    if (confirm(`Hapus pelacak ${id}?`)) {
        try { await remove(ref(AuraState.instances.db, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/settings/staplesTrackers/${id}`)); window.openTrackerManager(); } 
        catch(e) { if (window.showToast) window.showToast("Gagal menghapus Tracker.", true); }
    }
};

window.openFamilyManager = function() {
    const listContainer = document.getElementById('family-list-container');
    if (!listContainer) return;
    const members = AuraState.data.settings?.familyMembers || [];
    let html = '';
    
    members.forEach((m, i) => {
        html += `<div class="glass-panel p-3 border-l-2 border-l-indigo-400 flex justify-between items-center mb-2"><p class="text-xs font-bold text-indigo-400"><i class="fa-solid fa-user mr-2"></i>${AuraUtils.escapeHtml(m)}</p><button onclick="window.removeFamilyMember('${i}')" class="text-rose-500 hover:text-rose-400 p-2"><i class="fa-solid fa-trash"></i></button></div>`;
    });
    
    if (members.length === 0) html = '<p class="text-[10px] text-[var(--text-muted)] text-center">Belum ada tanggungan keluarga.</p>';
    listContainer.innerHTML = html;
    if (typeof window.showModal === 'function') window.showModal('modal-family');
};

window.addFamilyMember = async function() {
    const input = document.getElementById('new-family-name'); if (!input) return;
    const name = input.value.trim(); if (!name) return;
    const members = AuraState.data.settings?.familyMembers || [];
    if (members.includes(name)) { if (window.showToast) window.showToast("Anggota ini sudah terdaftar.", true); return; }
    
    try { await FirebaseService.updateSettings({ familyMembers: [...members, name] }); input.value = ''; window.openFamilyManager(); } 
    catch (e) { if (window.showToast) window.showToast("Gagal menambah anggota.", true); }
};

window.removeFamilyMember = async function(index) {
    const members = AuraState.data.settings?.familyMembers || [];
    if (confirm(`Lepaskan akses untuk [${members[index]}]?`)) {
        members.splice(index, 1);
        try { await FirebaseService.updateSettings({ familyMembers: members }); window.openFamilyManager(); } 
        catch(e) { if (window.showToast) window.showToast("Gagal mencabut akses.", true); }
    }
};

window.openAuditLogs = async function() {
    const container = document.getElementById('audit-log-content'); if (!container) return;
    if (typeof window.showModal === 'function') window.showModal('modal-audit-log');
    container.innerHTML = '<div class="text-center p-8"><i class="fa-solid fa-circle-notch animate-spin text-2xl text-white mb-2 block"></i><p class="text-[10px] text-[var(--text-muted)]">Mengunduh blok rantai...</p></div>';
    
    try {
        const snapshot = await get(ref(AuraState.instances.db, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/audit_logs`));
        if (snapshot.exists()) {
            const logsArray = Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.ts - a.ts);
            let logHtml = '';
            logsArray.forEach(log => {
                const dateObj = new Date(log.ts); const timeStr = `${dateObj.toLocaleDateString()} ${dateObj.getHours().toString().padStart(2,'0')}:${dateObj.getMinutes().toString().padStart(2,'0')}`;
                logHtml += `<div class="border-b border-[var(--border-glass)] pb-2 mb-2 last:border-0 last:pb-0 last:mb-0"><div class="flex justify-between items-start mb-1"><span class="text-[9px] bg-white/10 text-white px-1.5 py-0.5 rounded font-mono">${AuraUtils.escapeHtml(log.action)}</span><span class="text-[8px] text-[var(--text-muted)] font-mono">${timeStr}</span></div><p class="text-xs text-[var(--text-main)]">${AuraUtils.escapeHtml(log.detail)}</p><p class="text-[8px] text-[var(--text-muted)] uppercase mt-1">Executor: ${AuraUtils.escapeHtml(log.user)}</p></div>`;
            });
            container.innerHTML = logHtml;
        } else { container.innerHTML = '<p class="text-center text-xs text-[var(--text-muted)] p-5">Tidak ada riwayat aktivitas.</p>'; }
    } catch(e) { container.innerHTML = '<p class="text-center text-xs text-rose-500 p-5">Gagal membaca log dari Cloud.</p>'; }
};
