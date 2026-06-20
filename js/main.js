/**
 * ============================================================================
 * AURAFI OS - ENTRY POINT (main.js)
 * ============================================================================
 * Mengorkestrasi seluruh modul, error handling, inisialisasi awal sistem,
 * serta registrasi PWA Service Worker untuk instalasi mobile.
 */

// 1. Core & Config Imports (Ini aman karena strukturnya statis)
import { APP_CONFIG } from './config/constants.js';
import { Logger } from './core/logger.js';
import { AuraState } from './core/state.js';
import { AuraUtils } from './core/utils.js';

// 2. Services & Modules Imports (UBAH: Gunakan Safe Import tanpa Kurung Kurawal)
import './services/firebase.js';
import './modules/categories.js'; 

// 3. Renderers Imports
import './renderers/dashboard.js';
import './renderers/modals.js';

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
// GLOBAL ERROR HANDLERS
// ============================================================================
window.addEventListener('error', function(event) {
    Logger.error('Global', 'Unhandled Exception Caught:', event.error || event.message);
});

window.addEventListener('unhandledrejection', function(event) {
    Logger.error('Global', 'Unhandled Promise Rejection:', event.reason);
});

// ============================================================================
// GLOBAL UI & PROCESSING FUNCTIONS
// ============================================================================

window.setProcessingStatus = function(isProcessing) {
    AuraState.system.isProcessing = isProcessing;
    const btnSend = document.getElementById('btn-send-main');
    const iconSend = document.getElementById('icon-send');
    
    if (btnSend && iconSend) {
        if (isProcessing) {
            btnSend.disabled = true;
            iconSend.className = "fa-solid fa-circle-notch animate-spin text-base";
        } else {
            btnSend.disabled = false;
            iconSend.className = "fa-solid fa-paper-plane text-base";
        }
    }
};

window.showToast = function(message, isError = false) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `p-3 rounded-xl shadow-2xl text-xs font-bold transition-all duration-300 transform translate-y-[-20px] opacity-0 border backdrop-blur-md flex items-center gap-2 ${
        isError 
        ? 'bg-rose-950/80 text-rose-100 border-rose-900/50' 
        : 'bg-emerald-950/80 text-emerald-100 border-emerald-900/50'
    }`;
    
    const icon = isError ? '<i class="fa-solid fa-triangle-exclamation"></i>' : '<i class="fa-solid fa-circle-check"></i>';
    toast.innerHTML = `${icon} <span>${AuraUtils.escapeHtml(message)}</span>`;
    
    container.appendChild(toast);
    
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-[-20px]', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
    });

    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-[-20px]', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

window.showModal = function(id) {
    AuraUtils.safeDOM(id, function(el) {
        el.classList.remove('hidden');
        requestAnimationFrame(() => {
            el.classList.remove('opacity-0');
            el.classList.add('opacity-100');
        });
    });
};

window.closeModal = function(id) {
    AuraUtils.safeDOM(id, function(el) {
        el.classList.remove('opacity-100');
        el.classList.add('opacity-0');
        setTimeout(() => {
            el.classList.add('hidden');
        }, 300);
    });
};

// ============================================================================
// BOOTSTRAPPING SYSTEM
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
    Logger.info('System', `AuraFi OS v${APP_CONFIG.VERSION} Bootstrapping initiated...`);
    
    // UBAH: Panggil lewat window agar aman
    if (typeof window.injectMissingModals === 'function') window.injectMissingModals();
    
    Logger.success('System', 'Sistem Kendali Utama (main.js) Berhasil Disinkronisasikan.');
});

// ============================================================================
// PWA & SERVICE WORKER REGISTRATION
// ============================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then((registration) => {
                Logger.success('PWA', `Service Worker terdaftar sukses.`);
            })
            .catch((error) => {
                Logger.error('PWA', 'Gagal mendaftarkan Service Worker:', error);
            });
    });
}
