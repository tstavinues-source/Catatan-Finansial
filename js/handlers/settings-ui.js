/**
 * Settings UI Handlers & Renderers
 * Mengelola semua form di dalam Modal Settings: Profil, Preferensi AI, API Keys, Trackers, Family, Recurring, dan Audit Logs.
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';
import { APP_CONFIG } from '../config/constants.js';
import { DEFAULT_STAPLES_TRACKERS } from '../config/categories.js';
import { FirebaseService } from '../services/firebase.js';
import { EncryptionService } from '../services/encryption.js';
import { get, ref, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// ============================================================================
// PROFIL & PREFERENSI AI
// ============================================================================

window.saveUserProfile = async function() {
    const nameEl = document.getElementById('user-fullname');
    const nickEl = document.getElementById('user-nickname');
    if (!nameEl || !nickEl) return;
    
    const name = nameEl.value.trim();
    const nick = nickEl.value.trim();
    
    if (!name || !nick) {
        if (window.showToast) window.showToast("Nama dan Panggilan tidak boleh kosong!", true);
        return;
    }
    try {
        await FirebaseService.updateSettings({ profile: { fullName: name, nickname: nick } });
        if (window.showToast) window.showToast("Profil berhasil diperbarui.");
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
// MANAJEMEN API KEYS (GROQ & GEMINI)
// ============================================================================

// Memastikan fallback secret key terpasang
let groqSecretKey = null;
try {
    groqSecretKey = localStorage.getItem('aurafi_groq_secret');
    if (!groqSecretKey && typeof CryptoJS !== 'undefined' && CryptoJS.lib?.WordArray) { 
        groqSecretKey = CryptoJS.lib.WordArray.random(128/8).toString();
        localStorage.setItem('aurafi_groq_secret', groqSecretKey); 
    }
} catch (e) {
    groqSecretKey = sessionStorage.getItem('aurafi_groq_secret') || "fallback_secret_key_" + Date.now();
    sessionStorage.setItem('aurafi_groq_secret', groqSecretKey);
}

window.addGroqKey = async function() {
    const input = document.getElementById('new-groq-key');
    if (!input) return;
    const key = input.value.trim();
    if (!key || !key.startsWith('gsk_')) {
        if (window.showToast) window.showToast("Format API Key tidak valid (harus gsk_...)", true);
        return;
    }
    
    const encrypted = EncryptionService.encryptApiKey(key, groqSecretKey);
    if (!encrypted) {
        if (window.showToast) window.showToast("Sistem enkripsi gagal memproses kunci.", true);
        return;
    }
    
    try {
        await FirebaseService.saveGroqKey(encrypted);
        input.value = '';
        if (window.showToast) window.showToast("Kunci API Groq berhasil diamankan ke dalam brankas.");
    } catch(e) {
        if (window.showToast) window.showToast("Gagal menyimpan kunci.", true);
    }
};

window.removeGroqKey = async function(id) {
    if (confirm("Cabut otorisasi API Key ini dari ekosistem?")) {
        try {
            await FirebaseService.deleteGroqKey(id);
            if (window.showToast) window.showToast("Kunci dihapus.");
        } catch(e) {
            if (window.showToast) window.showToast("Gagal menghapus kunci.", true);
        }
    }
};

window.renderGroqKeysUI = function() {
    AuraUtils.safeDOM('groq-keys-container', function(el) {
        const keys = AuraState.data.groqKeys || [];
        if (keys.length === 0) {
            el.innerHTML = '<p class="text-[10px] text-[var(--text-muted)] text-center my-2 p-2 bg-black/40 rounded-lg">Tidak satupun Kunci API Groq Sistem terpasang. Mesin Nirkabel LLM Nonaktif.</p>';
            return;
        }

        let keysHtml = '';
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            const dec = EncryptionService.decryptApiKey(k.encryptedKey, groqSecretKey);
            const display = dec ? `${dec.substring(0,8)}...${dec.substring(dec.length-4)}` : `(Memori Data Enkripsi Korup/Tertolak)`;
            const statusColor = dec ? 'text-emerald-400' : 'text-rose-400';
            
            keysHtml += `
            <div class="flex justify-between items-center bg-[var(--bg-base)] p-2 rounded-xl border border-[var(--border-glass)]">
                <div class="flex flex-col">
                    <span class="font-mono text-xs ${statusColor}">${display}</span>
                    <span class="text-[8px] text-[var(--text-muted)] uppercase tracking-wider">Master Key Pool Ke-${i + 1}</span>
                </div>
                <button onclick="window.removeGroqKey('${k.id}')" class="text-rose-500 p-1 hover:text-rose-400 active:scale-90 transition"><i class="fa-solid fa-trash text-xs"></i></button>
            </div>`;
        }
        el.innerHTML = keysHtml;
    });
};

window.syncGeminiEngine = async function(silent = false) {
    const pinEl = document.getElementById('gemini-pin-input');
    const pinInput = pinEl ? pinEl.value.trim() : '';
    const pin = silent ? sessionStorage.getItem('aurafi_gemini_pin') : pinInput;
    
    if (!pin || pin.length < 3) { 
        if (!silent && window.showToast) window.showToast("HARAP MASUKKAN PIN GEMINI (MINIMAL 3 KARAKTER)!", true);
        return; 
    }

    const gBadge = document.getElementById('gemini-status-badge');
    if (gBadge) { 
        gBadge.className = "text-[9px] bg-indigo-950/40 text-indigo-400 border border-indigo-900/50 px-2 py-0.5 rounded font-mono animate-pulse";
        gBadge.innerText = "DECRYPTING..."; 
    }
    
    try {
        if(typeof window.GeminiFailoverEngine !== 'function') throw new Error("Modul AI belum dimuat penuh.");
        
        const geminiEngine = new window.GeminiFailoverEngine(pin);
        const gCount = await geminiEngine.init();
        
        if (gCount > 0) {
            AuraState.instances.geminiEngine = geminiEngine;
            sessionStorage.setItem('aurafi_gemini_pin', pin);
            if (gBadge) { 
                gBadge.className = "text-[9px] bg-emerald-950/40 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-mono";
                gBadge.innerText = `ACTIVE (${gCount})`; 
            }
            if (!silent && window.showToast) window.showToast("Gemini Vision Berhasil Di-Unlock.");
        } else { 
            throw new Error("GCount 0");
        }
    } catch(e) {
        if (gBadge) { 
            gBadge.className = "text-[9px] bg-red-950/40 text-rose-400 border border-red-900/50 px-2 py-0.5 rounded font-mono";
            gBadge.innerText = "FAIL / LOCKED"; 
        }
        if (!silent && window.showToast) window.showToast("Dekripsi Gagal: PIN Salah atau Modul Belum Siap.", true);
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
    const name = nameEl.value.trim();
    const amt = parseFloat(amtEl.value);
    const date = parseInt(dateEl.value);
    const method = methodEl ? methodEl.value : 'cashless';
    
    if(!name || isNaN(amt) || isNaN(date) || date < 1 || date > 31) {
        if(window.showToast) window.showToast("Form tagihan tidak valid!", true);
        return;
    }
    
    const recId = `rec_${Date.now()}`;
    const updates = {};
    updates[`recurringPayments/${recId}`] = { name, amount: amt, date, method };
    
    try {
        await FirebaseService.updateSettings(updates);
        nameEl.value = ''; amtEl.value = ''; dateEl.value = '';
        if(window.showToast) window.showToast("Tagihan otomatis ditambahkan.");
    } catch(e) {
        if(window.showToast) window.showToast("Gagal menambah tagihan.", true);
    }
};

window.removeRecurringPayment = async function(id) {
    if(!confirm("Hapus tagihan otomatis ini?")) return;
    try {
        const dbRef = ref(AuraState.instances.db, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/settings/recurringPayments/${id}`);
        await remove(dbRef);
        if(window.showToast) window.showToast("Tagihan dihapus.");
    } catch(e) {
        if(window.showToast) window.showToast("Gagal menghapus tagihan.", true);
    }
};

window.renderRecurringUI = function() {
    AuraUtils.safeDOM('recurring-list', function(el) {
        const rPayments = AuraState.data.settings?.recurringPayments || {};
        const entries = Object.entries(rPayments);

        if (entries.length === 0) {
            el.innerHTML = '<p class="text-[10px] text-[var(--text-muted)] text-center my-2">Mesin belum diajarkan mengenai rutinitas siklus bulanan Anda.</p>';
            return;
        }

        let htmlCompiled = '';
        for (let i = 0; i < entries.length; i++) {
            const id = entries[i][0];
            const rp = entries[i][1];
            htmlCompiled += `
            <div class="flex justify-between items-center bg-[var(--bg-base)] p-2 rounded-xl border border-[var(--border-glass)]">
                <div class="flex flex-col">
                    <span class="font-bold text-xs text-sky-400">${AuraUtils.escapeHtml(rp.name)}</span>
                    <span class="text-[9px] text-[var(--text-muted)] font-mono">Eksekusi H-(${rp.date}) | ${AuraUtils.formatCurrency(rp.amount)} via [${AuraUtils.escapeHtml(rp.method)}]</span>
                </div>
                <button onclick="window.removeRecurringPayment('${id}')" class="text-rose-500 p-1 hover:text-rose-400 transition active:scale-90"><i class="fa-solid fa-trash-can text-xs"></i></button>
            </div>`;
        }
        el.innerHTML = htmlCompiled;
    });
};

window.renderRecurringUIForBudget = function() {
    AuraUtils.safeDOM('budget-bills-container', function(el) {
        const rPayments = AuraState.data.settings?.recurringPayments || {};
        const entries = Object.entries(rPayments);
        
        if (entries.length === 0) {
            el.innerHTML = '<p class="text-[10px] text-[var(--text-muted)] text-center my-2 p-3 bg-black/20 rounded-xl">Konfigurasi Tagihan Kosong. Buat rutinitas cicilan/tagihan Anda di kolom bawah.</p>';
            return;
        }

        let compiledBudgets = '';
        for (let i = 0; i < entries.length; i++) {
            const id = entries[i][0];
            const rp = entries[i][1];
            compiledBudgets += `
            <div class="glass-panel p-3 flex justify-between items-center border-l-2 border-l-sky-400 group">
                <div>
                    <h4 class="font-bold text-xs text-sky-400 flex items-center gap-2">
                        ${AuraUtils.escapeHtml(rp.name)} 
                        <button onclick="window.removeRecurringPayment('${id}')" class="text-rose-500 hover:text-rose-400 transition opacity-0 group-hover:opacity-100">
                            <i class="fa-solid fa-trash text-[10px]"></i>
                        </button>
                    </h4>
                    <p class="text-[9px] text-[var(--text-muted)] font-mono uppercase mt-0.5">Tgl Eksekusi Robot AI: ${rp.date} / Bulan</p>
                </div>
                <p class="font-bold text-sm font-mono text-[var(--text-main)]">${AuraUtils.formatCurrency(rp.amount)}</p>
            </div>`;
        }
        el.innerHTML = compiledBudgets;
    });
};

// ============================================================================
// LANJUTAN: TRACKER, FAMILY, & AUDIT LOGS
// ============================================================================

window.openTrackerManager = function() {
    const listContainer = document.getElementById('tracker-list-container');
    if (!listContainer) return;
    
    const trackers = AuraState.data.settings?.staplesTrackers || DEFAULT_STAPLES_TRACKERS;
    let html = '';
    const trackerEntries = Object.entries(trackers);
    
    for (let i = 0; i < trackerEntries.length; i++) {
        const id = trackerEntries[i][0];
        const t = trackerEntries[i][1];
        
        html += `
        <div class="glass-panel p-3 border-l-2 border-l-amber-400 flex justify-between items-center mb-2">
            <div>
                <p class="text-xs font-bold text-amber-400">${AuraUtils.escapeHtml(t.name)}</p>
                <p class="text-[9px] text-[var(--text-muted)] uppercase mt-0.5">Keys: ${AuraUtils.escapeHtml(t.keywords.join(', '))}</p>
            </div>
            <button onclick="window.removeTracker('${id}')" class="text-rose-500 hover:text-rose-400 p-2"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    }
    listContainer.innerHTML = html;
    if (typeof window.showModal === 'function') window.showModal('modal-edit-tracker');
};

window.saveNewTracker = async function() {
    const idInput = document.getElementById('new-track-id');
    const nameInput = document.getElementById('new-track-name');
    const keyInput = document.getElementById('new-track-keywords');
    if (!idInput || !nameInput || !keyInput) return;
    
    const id = idInput.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const name = nameInput.value.trim();
    const keywordsRaw = keyInput.value.split(',');
    const keywords = [];
    
    for (let i = 0; i < keywordsRaw.length; i++) {
        const k = keywordsRaw[i].trim().toLowerCase();
        if (k) keywords.push(k);
    }
    
    if (!id || !name || keywords.length === 0) {
        if (window.showToast) window.showToast("Mohon isi ID, Nama, dan minimal 1 kata kunci!", true);
        return;
    }
    
    const updates = {};
    updates[`staplesTrackers/${id}`] = { name: name, keywords: keywords };
    
    try {
        await FirebaseService.updateSettings(updates);
        idInput.value = ''; nameInput.value = ''; keyInput.value = '';
        if (window.showToast) window.showToast("Tracker dinamis baru telah didaftarkan.");
        window.openTrackerManager();
    } catch(e) {
        if (window.showToast) window.showToast("Gagal menyimpan Tracker.", true);
    }
};

window.removeTracker = async function(id) {
    if (confirm(`Anda yakin ingin menghapus pelacak ${id}?`)) {
        try {
            const dbRef = ref(AuraState.instances.db, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/settings/staplesTrackers/${id}`);
            await remove(dbRef);
            if (window.showToast) window.showToast("Pelacak ditiadakan dari dashboard.");
            window.openTrackerManager();
        } catch(e) {
            if (window.showToast) window.showToast("Gagal menghapus Tracker.", true);
        }
    }
};

window.openFamilyManager = function() {
    const listContainer = document.getElementById('family-list-container');
    if (!listContainer) return;
    
    const members = AuraState.data.settings?.familyMembers || [];
    let html = '';
    
    for (let i = 0; i < members.length; i++) {
        html += `
        <div class="glass-panel p-3 border-l-2 border-l-indigo-400 flex justify-between items-center mb-2">
            <p class="text-xs font-bold text-indigo-400"><i class="fa-solid fa-user mr-2"></i>${AuraUtils.escapeHtml(members[i])}</p>
            <button onclick="window.removeFamilyMember('${i}')" class="text-rose-500 hover:text-rose-400 p-2"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    }
    
    if (members.length === 0) {
        html = '<p class="text-[10px] text-[var(--text-muted)] text-center">Belum ada tanggungan anggota keluarga tambahan.</p>';
    }
    
    listContainer.innerHTML = html;
    if (typeof window.showModal === 'function') window.showModal('modal-family');
};

window.addFamilyMember = async function() {
    const input = document.getElementById('new-family-name');
    if (!input) return;
    
    const name = input.value.trim();
    if (!name) {
        if (window.showToast) window.showToast("Masukan nama keluarga yang valid!", true);
        return;
    }
    
    const members = AuraState.data.settings?.familyMembers || [];
    if (members.includes(name)) {
        if (window.showToast) window.showToast("Anggota ini sudah ada di dalam database keluarga.", true);
        return;
    }
    
    const newMembers = [...members, name];
    try {
        await FirebaseService.updateSettings({ familyMembers: newMembers });
        input.value = '';
        if (window.showToast) window.showToast(`Anggota Keluarga ${name} didaftarkan.`);
        window.openFamilyManager();
    } catch (e) {
        if (window.showToast) window.showToast("Gagal mendaftarkan anggota keluarga.", true);
    }
};

window.removeFamilyMember = async function(index) {
    const members = AuraState.data.settings?.familyMembers || [];
    const memberName = members[index];
    
    if (confirm(`Lepaskan akses pencatatan transaksi untuk [${memberName}]?`)) {
        members.splice(index, 1);
        try {
            await FirebaseService.updateSettings({ familyMembers: members });
            if (window.showToast) window.showToast(`Akses untuk ${memberName} dicabut.`);
            window.openFamilyManager();
        } catch(e) {
            if (window.showToast) window.showToast("Gagal mencabut akses.", true);
        }
    }
};

window.openAuditLogs = async function() {
    const container = document.getElementById('audit-log-content');
    if (!container) return;
    
    if (typeof window.showModal === 'function') window.showModal('modal-audit-log');
    container.innerHTML = '<div class="text-center p-8"><i class="fa-solid fa-circle-notch animate-spin text-2xl text-white mb-2 block"></i><p class="text-[10px] text-[var(--text-muted)]">Mengunduh blok rantai keamanan...</p></div>';
    
    try {
        const snapshot = await get(ref(AuraState.instances.db, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/audit_logs`));
        if (snapshot.exists()) {
            const logsData = snapshot.val();
            const logsArray = [];
            for (const key in logsData) {
                if (Object.prototype.hasOwnProperty.call(logsData, key)) {
                    logsArray.push({ id: key, ...logsData[key] });
                }
            }
            logsArray.sort((a, b) => b.ts - a.ts);
            
            let logHtml = '';
            for (let i = 0; i < logsArray.length; i++) {
                const log = logsArray[i];
                const dateObj = new Date(log.ts);
                const timeStr = `${dateObj.toLocaleDateString()} ${dateObj.getHours().toString().padStart(2,'0')}:${dateObj.getMinutes().toString().padStart(2,'0')}`;
                logHtml += `
                <div class="border-b border-[var(--border-glass)] pb-2 mb-2 last:border-0 last:pb-0 last:mb-0">
                    <div class="flex justify-between items-start mb-1">
                        <span class="text-[9px] bg-white/10 text-white px-1.5 py-0.5 rounded font-mono">${AuraUtils.escapeHtml(log.action)}</span>
                        <span class="text-[8px] text-[var(--text-muted)] font-mono">${timeStr}</span>
                    </div>
                    <p class="text-xs text-[var(--text-main)]">${AuraUtils.escapeHtml(log.detail)}</p>
                    <p class="text-[8px] text-[var(--text-muted)] uppercase mt-1">Executor: ${AuraUtils.escapeHtml(log.user)}</p>
                </div>`;
            }
            container.innerHTML = logHtml;
        } else {
            container.innerHTML = '<p class="text-center text-xs text-[var(--text-muted)] p-5">Tidak ada riwayat aktivitas yang terekam sejauh ini.</p>';
        }
    } catch(e) {
        container.innerHTML = '<p class="text-center text-xs text-rose-500 p-5"><i class="fa-solid fa-triangle-exclamation block text-2xl mb-2"></i>Gagal membaca log dari Cloud Firebase.</p>';
    }
};
