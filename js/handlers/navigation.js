/**
 * Navigation & UI State Handlers
 * Mengelola perpindahan tab halaman, tema, filter pencarian, toggle mata uang, dan prompt UI dasar.
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';
import { Logger } from '../core/logger.js';

// ============================================================================
// SISTEM NAVIGASI TAB (SINGLE PAGE APPLICATION)
// ============================================================================

window.switchView = function(viewId) {
    const views = ['dashboard', 'transactions', 'analytics', 'budgets', 'oracle', 'trash'];
    
    // Sembunyikan semua view
    for (let i = 0; i < views.length; i++) {
        AuraUtils.safeDOM(`view-${views[i]}`, function(el) {
            el.classList.add('hidden');
            el.classList.remove('block');
        });
    }
    
    // Tampilkan view target
    AuraUtils.safeDOM(`view-${viewId}`, function(el) {
        el.classList.remove('hidden');
        el.classList.add('block');
    });

    AuraState.system.activeView = viewId;
    
    // Update styling tombol navigasi bawah
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

    // Trigger pembaruan UI otomatis saat halaman tertentu dibuka
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
// KONTROL TEMA VISUAL
// ============================================================================

window.toggleTheme = function() {
    const themes = ['midnight', 'sakura', 'neon'];
    const currentTheme = AuraState.system.theme;
    
    let currentIndex = themes.indexOf(currentTheme);
    if (currentIndex === -1) currentIndex = 0;
    
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    
    document.documentElement.setAttribute('data-theme', nextTheme);
    AuraState.system.theme = nextTheme;
    
    // Simpan ke database jika user sudah login
    if (AuraState.user.uid && window.FirebaseService) {
        window.FirebaseService.updateSettings({ theme: nextTheme }).catch(err => {
            Logger.warn('Navigation', 'Gagal menyimpan preferensi tema ke Cloud', err);
        });
    }
    
    if (window.showToast) window.showToast(`Tema diubah ke mode: ${nextTheme.toUpperCase()}`);
};

// ============================================================================
// FILTER, MULTI-USER & MODE PERIODE WAKTU (KAS APATO)
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
    AuraUtils.safeDOM('filter-search', function(el) {
        AuraState.filters.search = el.value || '';
    });
    AuraUtils.safeDOM('filter-category', function(el) {
        AuraState.filters.category = el.value || 'ALL';
    });
    AuraUtils.safeDOM('filter-user', function(el) {
        AuraState.filters.user = el.value || 'ALL';
    });
    
    if (typeof window.debouncedCalculateAll === 'function') window.debouncedCalculateAll();
};

window.populateUserFilterDropdown = function() {
    AuraUtils.safeDOM('filter-user', function(el) {
        const transactions = AuraState.data.transactions || [];
        const membersSettings = AuraState.data.settings?.familyMembers || [];
        const uniqueUsers = new Set();
        
        for (let i = 0; i < transactions.length; i++) {
            if (transactions[i].user_id) {
                uniqueUsers.add(transactions[i].user_id);
            }
        }
        
        for (let i = 0; i < membersSettings.length; i++) {
            uniqueUsers.add(membersSettings[i]);
        }

        let htmlOpts = `<option value="ALL">SEMUA PENGGUNA</option>`;
        const usersArray = Array.from(uniqueUsers);
        
        for (let i = 0; i < usersArray.length; i++) {
            const userNm = AuraUtils.escapeHtml(usersArray[i]);
            htmlOpts += `<option value="${userNm}">${userNm}</option>`;
        }
        
        const currentVal = el.value;
        el.innerHTML = htmlOpts;
        
        if (currentVal && uniqueUsers.has(currentVal)) {
            el.value = currentVal;
        }
    });
};

// ============================================================================
// KONTROL MATA UANG (CURRENCY TOGGLE)
// ============================================================================

window.setCurrency = function(curr) {
    if (curr !== 'JPY' && curr !== 'IDR') return;
    
    AuraState.system.displayCurrency = curr;
    
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
        window.FirebaseService.updateSettings({ currency: curr }).catch(err => {
            Logger.warn('Navigation', 'Gagal menyimpan preferensi mata uang', err);
        });
    }
    
    if (typeof window.debouncedCalculateAll === 'function') window.debouncedCalculateAll();
};

// ============================================================================
// UI TOGGLES & PROMPTS (Goal & Budget)
// ============================================================================

window.toggleGoalForm = function() {
    AuraUtils.safeDOM('goal-form', function(el) {
        el.classList.toggle('hidden');
    });
};

window.promptBudget = function() {
    const currentBudget = AuraState.data.monthlyBudget || 100000;
    const amt = prompt("Ubah Batas Anggaran (Nominal Angka):", currentBudget);
    if (amt !== null) {
        const parsedAmt = parseFloat(amt);
        if (!isNaN(parsedAmt) && parsedAmt >= 0) {
            AuraState.data.monthlyBudget = parsedAmt;
            
            if (AuraState.user.uid && window.FirebaseService) {
                window.FirebaseService.updateSettings({ 
                    monthlyBudget: { limit: parsedAmt } 
                }).catch(err => {
                    Logger.warn('Navigation', 'Gagal simpan budget ke Cloud', err);
                });
            }
            
            if (typeof window.debouncedCalculateAll === 'function') {
                window.debouncedCalculateAll();
            }
            if (window.showToast) {
                window.showToast(`Anggaran diperbarui menjadi ${AuraUtils.formatCurrency(parsedAmt)}`);
            }
        } else {
            if (window.showToast) window.showToast("Input anggaran tidak valid!", true);
        }
    }
};
