/**
 * Navigation & UI State Handlers
 * Mengelola perpindahan tab, tema (Serenity), filter, dan mata uang.
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';
import { Logger } from '../core/logger.js';

// ============================================================================
// SISTEM NAVIGASI TAB (SINGLE PAGE APPLICATION)
// ============================================================================

window.switchView = function(viewId) {
    const views = ['dashboard', 'transactions', 'analytics', 'budgets', 'oracle', 'trash'];
    
    for (let i = 0; i < views.length; i++) {
        AuraUtils.safeDOM(`view-${views[i]}`, function(el) {
            el.classList.add('hidden');
            el.classList.remove('block');
        });
    }
    
    AuraUtils.safeDOM(`view-${viewId}`, function(el) {
        el.classList.remove('hidden');
        el.classList.add('block');
    });

    AuraState.system.activeView = viewId;
    
    const navBtns = document.querySelectorAll('.nav-btn');
    for (let i = 0; i < navBtns.length; i++) {
        const btn = navBtns[i];
        if (btn.dataset.target === viewId) {
            btn.classList.remove('text-[var(--text-muted)]');
            btn.classList.add('text-[var(--accent-primary)]');
        } else {
            btn.classList.add('text-[var(--text-muted)]');
            btn.classList.remove('text-[var(--accent-primary)]');
        }
    }

    if (viewId === 'dashboard' || viewId === 'analytics') {
        if (typeof window.debouncedCalculateAll === 'function') window.debouncedCalculateAll();
    } else if (viewId === 'transactions') {
        if (typeof window.populateUserFilterDropdown === 'function') window.populateUserFilterDropdown();
    } else if (viewId === 'budgets') {
        if (typeof window.renderRecurringUIForBudget === 'function') window.renderRecurringUIForBudget();
    }
    
    window.scrollTo(0, 0);
};

// ============================================================================
// KONTROL TEMA VISUAL (SERENITY MODE)
// ============================================================================

window.toggleTheme = function() {
    // Daftar tema diperbarui: Neon diganti dengan Serenity
    const themes = ['midnight', 'sakura', 'serenity']; 
    let currentTheme = AuraState.system.theme || document.documentElement.getAttribute('data-theme') || 'midnight';
    
    let currentIndex = themes.indexOf(currentTheme);
    if (currentIndex === -1) currentIndex = 0;
    
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    
    document.documentElement.setAttribute('data-theme', nextTheme);
    AuraState.system.theme = nextTheme;
    
    if (AuraState.user.uid && window.FirebaseService) {
        window.FirebaseService.updateSettings({ theme: nextTheme }).catch(err => {
            Logger.warn('Navigation', 'Gagal menyimpan preferensi tema ke Cloud', err);
        });
    }
    
    if (window.showToast) window.showToast(`Tampilan berganti ke mode: ${nextTheme.toUpperCase()}`);
};

// ============================================================================
// FILTER, MULTI-USER & MODE PERIODE WAKTU
// ============================================================================

window.changeViewMode = function(mode) {
    AuraState.filters.periodMode = mode;
    
    const modes = ['period', 'month', 'all'];
    for (let i = 0; i < modes.length; i++) {
        AuraUtils.safeDOM(`btn-mode-${modes[i]}`, function(el) {
            if (modes[i] === mode) {
                el.classList.add('text-accent', 'bg-white/10');
            } else {
                el.classList.remove('text-accent', 'bg-white/10');
            }
        });
    }
    
    if (typeof window.debouncedCalculateAll === 'function') window.debouncedCalculateAll();
};

window.applyFilters = function() {
    AuraUtils.safeDOM('filter-search', el => AuraState.filters.search = el.value || '');
    AuraUtils.safeDOM('filter-category', el => AuraState.filters.category = el.value || 'ALL');
    AuraUtils.safeDOM('filter-user', el => AuraState.filters.user = el.value || 'ALL');
    
    if (typeof window.debouncedCalculateAll === 'function') window.debouncedCalculateAll();
};

window.populateUserFilterDropdown = function() {
    AuraUtils.safeDOM('filter-user', function(el) {
        const transactions = AuraState.data.transactions || [];
        const membersSettings = AuraState.data.settings?.familyMembers || [];
        const uniqueUsers = new Set();
        
        transactions.forEach(t => t.user_id && uniqueUsers.add(t.user_id));
        membersSettings.forEach(m => uniqueUsers.add(m));

        let htmlOpts = `<option value="ALL">SEMUA PENGGUNA</option>`;
        Array.from(uniqueUsers).forEach(user => {
            const userNm = AuraUtils.escapeHtml(user);
            htmlOpts += `<option value="${userNm}">${userNm}</option>`;
        });
        
        const currentVal = el.value;
        el.innerHTML = htmlOpts;
        if (currentVal && uniqueUsers.has(currentVal)) el.value = currentVal;
    });
};

// ============================================================================
// KONTROL MATA UANG
// ============================================================================

// PERBAIKAN: Sebelumnya ada DUA definisi window.setCurrency (di sini dan di
// main.js). Karena main.js dievaluasi belakangan, definisinya menimpa versi
// ini — dan versi main.js TIDAK PERNAH menyimpan preferensi mata uang ke
// Firebase (cuma ke localStorage), jadi preferensi mata uang gagal sinkron
// lintas perangkat. Definisi duplikat di main.js sudah dihapus; versi di sini
// sekarang jadi satu-satunya sumber, dan tetap menulis ke localStorage juga
// (agar bisa langsung dipakai untuk render awal sebelum Firebase termuat).
window.setCurrency = function(curr) {
    if (curr !== 'JPY' && curr !== 'IDR') return;
    AuraState.system.displayCurrency = curr;
    AuraState.system.currency = curr;

    try { localStorage.setItem('aurafi_active_currency', curr); } catch(e) { /* abaikan jika storage diblokir */ }
    
    const btnJpy = document.getElementById('btn-curr-jpy');
    const btnIdr = document.getElementById('btn-curr-idr');
    
    if (btnJpy && btnIdr) {
        if (curr === 'JPY') {
            btnJpy.className = "px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all bg-accent text-[var(--bg-base)]";
            btnIdr.className = "px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all text-[var(--text-muted)]";
        } else {
            btnIdr.className = "px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all bg-accent text-[var(--bg-base)]";
            btnJpy.className = "px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all text-[var(--text-muted)]";
        }
    }
    
    if (AuraState.user.uid && window.FirebaseService) {
        window.FirebaseService.updateSettings({ currency: curr }).catch(err => Logger.warn('Navigation', 'Gagal menyimpan mata uang', err));
    }
    
    if (typeof window.loadRealtimeDatabaseData === 'function') {
        window.loadRealtimeDatabaseData(true);
    } else if (typeof window.debouncedCalculateAll === 'function') {
        window.debouncedCalculateAll();
    }
};

// ============================================================================
// UI TOGGLES
// ============================================================================

window.toggleGoalForm = function() {
    AuraUtils.safeDOM('goal-form', el => el.classList.toggle('hidden'));
};

window.promptBudget = function() {
    // Menggunakan AURA ALERT PROMPT untuk UI yang lebih premium
    window.AuraAlert.prompt("Ubah Batas Anggaran (Nominal Angka):", "Masukkan nominal...", (amt) => {
        if (amt !== null) {
            const parsedAmt = parseFloat(amt);
            if (!isNaN(parsedAmt) && parsedAmt >= 0) {
                AuraState.data.monthlyBudget = parsedAmt;
                if (AuraState.user.uid && window.FirebaseService) {
                    window.FirebaseService.updateSettings({ monthlyBudget: { limit: parsedAmt } });
                }
                if (typeof window.debouncedCalculateAll === 'function') window.debouncedCalculateAll();
                if (window.showToast) window.showToast(`Anggaran diperbarui!`);
            } else {
                if (window.showToast) window.showToast("Input tidak valid!", true);
            }
        }
    });
};
