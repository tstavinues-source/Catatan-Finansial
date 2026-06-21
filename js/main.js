/**
 * ============================================================================
 * AURAFI OS - ENTRY POINT (main.js)
 * ============================================================================
 * Mengorkestrasi seluruh modul, error handling, inisialisasi awal sistem,
 * serta registrasi PWA Service Worker untuk instalasi mobile.
 */

// 1. Core & Config Imports
import { APP_CONFIG } from './config/constants.js';
import { Logger } from './core/logger.js';
import { AuraState } from './core/state.js';
import { AuraUtils } from './core/utils.js';

// 2. Services & Modules Imports
import './services/firebase.js';
import './modules/categories.js';
import './modules/analytics.js'; // Inject file analytics yang baru kita buat

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

// ==========================================
// 3. FUNGSI PREFERENSI MATA UANG & KURS REALTIME
// ==========================================

window.setCurrency = function(curr) {
    // 1. Simpan pilihan ke memori HP agar tidak reset saat refresh
    localStorage.setItem('aurafi_active_currency', curr);
    
    if (window.AuraState) {
        window.AuraState.system.displayCurrency = curr; // Sinkronisasi variabel untuk utils.js
        window.AuraState.system.currency = curr;
    }
    
    // 2. Update warna tombol JPY / IDR di Header
    const btnJpy = document.getElementById('btn-curr-jpy');
    const btnIdr = document.getElementById('btn-curr-idr');
    
    if (btnJpy && btnIdr) {
        if(curr === 'JPY') {
            btnJpy.className = "px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all bg-accent text-[var(--bg-base)]";
            btnIdr.className = "px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all text-[var(--text-muted)]";
        } else {
            btnIdr.className = "px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all bg-accent text-[var(--bg-base)]";
            btnJpy.className = "px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all text-[var(--text-muted)]";
        }
    }
    
    // 3. PAKSA SEMUA LAYAR ME-REFRESH ANGKA DAN LAMBANG UANG!
    if(typeof window.renderDashboard === 'function') window.renderDashboard();
    if(typeof window.renderTransactions === 'function') window.renderTransactions();
    if(typeof window.renderAnalytics === 'function') window.renderAnalytics();
    if(typeof window.renderBudgets === 'function') window.renderBudgets();
};

window.fetchLiveExchangeRate = async function() {
    const display = document.getElementById('live-rate-display');
    if (!display) return;

    try {
        display.innerText = "Menarik data kurs dunia...";

        // Mengambil kurs JPY ke IDR secara langsung dan gratis
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/JPY');
        const data = await response.json();
        const idrRate = data.rates.IDR;
        
        display.innerText = `1 JPY = Rp ${idrRate.toLocaleString('id-ID')}`;

        // Simpan rate di state agar kalkulasi total aset menjadi akurat
        if (window.AuraState) {
            window.AuraState.data.exchangeRate = idrRate;
            window.AuraState.system.exchangeRate = idrRate;
        }
    } catch (e) {
        display.innerText = "Kurs Offline (Gagal memuat)";
    }
};

// ============================================================================
// BOOTSTRAPPING SYSTEM & PWA REGISTRATION
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
    Logger.info('System', `AuraFi OS v${APP_CONFIG.VERSION} Bootstrapping initiated...`);
    
    if (typeof window.injectMissingModals === 'function') window.injectMissingModals();
    
    // Tarik memori mata uang terakhir yang dipilih user (Default: JPY)
    const savedCurr = localStorage.getItem('aurafi_active_currency') || 'JPY';
    window.setCurrency(savedCurr);
    
    // Jalankan penarik kurs
    window.fetchLiveExchangeRate();
    
    // Buka Gemini secara diam-diam jika PIN-nya sudah pernah disimpan
    setTimeout(() => {
        if(typeof window.syncGeminiEngine === 'function') {
            window.syncGeminiEngine(true); // true = mode silent (tanpa notif)
        }
    }, 1500);

    Logger.success('System', 'Sistem Kendali Utama (main.js) Berhasil Disinkronisasikan.');
});

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
