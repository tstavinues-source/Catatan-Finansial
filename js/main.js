/**
 * ============================================================================
 * AURAFI OS - ENTRY POINT (main.js)
 * ============================================================================
 */

// 1. Core & Config Imports
import { APP_CONFIG } from './config/constants.js';
import { Logger } from './core/logger.js';
import { AuraState } from './core/state.js';
import { AuraUtils } from './core/utils.js';

// 2. Services & Modules Imports
import { FirebaseService } from './services/firebase.js';
import { CategoryManager } from './modules/categories.js';

// 3. Renderers Imports
import './renderers/dashboard.js';
import { injectMissingModals } from './renderers/modals.js';

// 4. AI Engines Imports
import './services/memory.js';
import './services/ai/groq.js';
import './services/ai/gemini.js';
import './services/ai/orchestrator.js';

// 5. Handlers Imports
import './handlers/auth.js';
import './handlers/navigation.js';
import './handlers/transactions.js';
import './handlers/confirm.js';
import './handlers/goals.js';
import './handlers/settings-ui.js';
import './handlers/import-export.js';
import './modules/staging.js';
import './handlers/input.js';
import './renderers/oracle.js';

// ============================================================================
// GLOBAL UI FUNCTIONS (WAJIB ADA SEBELUM HTML ONCLICK DIPANGGIL)
// ============================================================================

/**
 * Tampilkan notifikasi toast
 */
window.showToast = function(message, isError = false) {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.warn('[Toast] Container tidak ditemukan:', message);
        return;
    }
    
    const toast = document.createElement('div');
    toast.className = `glass-panel p-4 text-sm font-medium pointer-events-auto transition-all duration-300 ${
        isError ? 'border-red-500 text-red-400' : 'border-accent text-accent'
    }`;
    toast.innerText = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
};

/**
 * Tampilkan modal
 */
window.showModal = function(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('hidden');
        void el.offsetWidth;
        el.style.opacity = '1';
    } else {
        console.warn('[Modal] Element tidak ditemukan:', id);
    }
};

/**
 * Tutup modal
 */
window.closeModal = function(id) {
    const el = document.getElementById(id);
    if (el) {
        el.style.opacity = '0';
        setTimeout(() => {
            el.classList.add('hidden');
        }, 300);
    }
};

/**
 * Set status processing
 */
window.setProcessingStatus = function(isProcessing) {
    AuraState.system.isProcessing = isProcessing;
    const btn = document.getElementById('btn-send-main');
    if (btn) {
        btn.disabled = isProcessing;
        btn.classList.toggle('opacity-50', isProcessing);
    }
    const icon = document.getElementById('icon-send');
    if (icon) {
        icon.className = isProcessing 
            ? 'fa-solid fa-spinner fa-spin text-base' 
            : 'fa-solid fa-paper-plane text-base';
    }
};

/**
 * Tutup modal konfirmasi
 */
window.closeConfirmModal = function() {
    window.closeModal('modal-confirm');
    AuraState.temp.deleteTarget = null;
};

/**
 * Prompt budget
 */
window.promptBudget = function() {
    const currentBudget = AuraState.data.monthlyBudget || 100000;
    const amt = prompt("Ubah Batas Anggaran (Nominal Angka):", currentBudget);
    if (amt !== null) {
        const parsedAmt = parseFloat(amt);
        if (!isNaN(parsedAmt) && parsedAmt >= 0) {
            AuraState.data.monthlyBudget = parsedAmt;
            
            if (AuraState.user.uid && FirebaseService) {
                FirebaseService.updateSettings({ 
                    monthlyBudget: { limit: parsedAmt } 
                }).catch(err => {
                    console.warn('Gagal simpan budget ke Cloud', err);
                });
            }
            
            if (typeof window.debouncedCalculateAll === 'function') {
                window.debouncedCalculateAll();
            }
            window.showToast(`Anggaran diperbarui menjadi ${AuraUtils.formatCurrency(parsedAmt)}`);
        } else {
            window.showToast("Input anggaran tidak valid!", true);
        }
    }
};

/**
 * Toggle goal form
 */
window.toggleGoalForm = function() {
    AuraUtils.safeDOM('goal-form', function(el) {
        el.classList.toggle('hidden');
    });
};

// ============================================================================
// GLOBAL ERROR HANDLERS
// ============================================================================

window.addEventListener('error', function(event) {
    Logger.error('Global', 'Unhandled Exception Caught:', event.error || event.message);
});

window.addEventListener('unhandledrejection', function(event) {
    Logger.error('Global', 'Unhandled Promise Rejection:', event.reason);
});

// ============================================================================
// BOOTSTRAPPING
// ============================================================================

window.addEventListener('DOMContentLoaded', function() {
    Logger.info('System', `AuraFi OS v${APP_CONFIG.VERSION} Bootstrapping initiated...`);
    
    // 1. Inject Missing Modals
    if (typeof injectMissingModals === 'function') {
        injectMissingModals();
        Logger.success('System', '✅ Modal UI dinamis berhasil diinjeksi.');
    }
    
    // 2. Render Category Dropdowns
    if (CategoryManager && typeof CategoryManager.renderDropdowns === 'function') {
        CategoryManager.renderDropdowns();
        Logger.success('System', '✅ Dropdown kategori berhasil dirender.');
    }
    
    // 3. Set Currency Button State
    const curr = AuraState.system.displayCurrency || APP_CONFIG.DEFAULT_CURRENCY;
    const btnJpy = document.getElementById('btn-curr-jpy');
    const btnIdr = document.getElementById('btn-curr-idr');
    if (btnJpy && btnIdr) {
        btnJpy.className = `px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all ${
            curr === 'JPY' ? 'bg-accent text-[var(--bg-base)]' : 'text-[var(--text-muted)]'
        }`;
        btnIdr.className = `px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all ${
            curr === 'IDR' ? 'bg-accent text-[var(--bg-base)]' : 'text-[var(--text-muted)]'
        }`;
    }
    
    // 4. Set Theme
    const theme = AuraState.system.theme || APP_CONFIG.DEFAULT_THEME;
    document.documentElement.setAttribute('data-theme', theme);
    
    // 5. Load Exchange Rate
    const savedRate = localStorage.getItem('aurafi_exchange_rate');
    if (savedRate) {
        AuraState.system.exchangeRateIDR = parseFloat(savedRate) || 105;
    } else {
        AuraState.system.exchangeRateIDR = 105;
        localStorage.setItem('aurafi_exchange_rate', '105');
    }
    const rateDisplay = document.getElementById('live-rate-display');
    if (rateDisplay) {
        rateDisplay.textContent = `💱 1 JPY = ${AuraState.system.exchangeRateIDR} IDR`;
    }
    
    // 6. Default View
    if (typeof window.switchView === 'function') {
        window.switchView('dashboard');
    }
    
    Logger.success('System', '🎉 AuraFi OS v3.2.6 siap digunakan!');
});

// ============================================================================
// PWA SERVICE WORKER
// ============================================================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('./service-worker.js')
            .then(function(registration) {
                Logger.success('PWA', 'Service Worker terdaftar sukses.');
            })
            .catch(function(error) {
                Logger.error('PWA', 'Gagal mendaftarkan Service Worker:', error);
            });
    });
}