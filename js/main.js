window.onerror = function(msg, url, line, col, error) {
    alert(
        "ERROR:\n" +
        msg +
        "\nLine: " + line +
        "\nColumn: " + col
    );
};

window.onunhandledrejection = function(event) {
    alert(
        "PROMISE ERROR:\n" +
        event.reason
    );
};
/**
 * ============================================================================
 * AURAFI OS - ENTRY POINT (main.js)
 * ============================================================================
 * Mengorkestrasi seluruh modul, error handling, inisialisasi awal sistem,
 * serta registrasi PWA Service Worker untuk instalasi mobile.
 * Hak Cipta Enterprise Build - Final Post Bugfix.
 */

// 1. Core & Config Imports (Diperbarui ke Jalur Absolut)
import { APP_CONFIG } from '/js/config/constants.js';
import { Logger } from '/js/core/logger.js';
import { AuraState } from '/js/core/state.js';
import { AuraUtils } from '/js/core/utils.js';

// 2. Services & Modules Imports (Diperbarui ke Jalur Absolut)
import { FirebaseService } from '/js/services/firebase.js';
import { CategoryManager } from '/js/modules/categories.js'; 

// 3. Renderers Imports (Diperbarui ke Jalur Absolut)
import '/js/renderers/dashboard.js';
import { injectMissingModals } from '/js/renderers/modals.js';

// 4. AI Engines Imports (Diperbarui ke Jalur Absolut)
import '/js/services/memory.js';
// import '/js/services/ai/groq.js';
// import '/js/services/ai/gemini.js';
// import '/js/services/ai/orchestrator.js';

// 5. Handlers Imports (Diperbarui ke Jalur Absolut)
import '/js/handlers/auth.js'; 
import '/js/handlers/navigation.js'; 
import '/js/handlers/transactions.js';
import '/js/handlers/confirm.js'; 
import '/js/handlers/goals.js';   
import '/js/handlers/settings-ui.js'; 
import '/js/handlers/import-export.js';
import '/js/modules/staging.js';
import '/js/handlers/input.js';
import '/js/renderers/oracle.js';

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
// GLOBAL UI & PROCESSING FUNCTIONS (Dibutuhkan langsung oleh HTML inline onclick)
// ============================================================================

/**
 * Mengatur status indikator pemrosesan aplikasi (loading state)
 * @param {boolean} isProcessing - Status aktif/nonaktif pemrosesan
 */
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

/**
 * Menampilkan pesan notifikasi pop-up (Toast) dinamis
 * @param {string} message - Isi pesan yang akan ditampilkan
 * @param {boolean} isError - Penentu skema warna (true untuk merah, false untuk hijau)
 */
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
    
    // Animasi Masuk (Fade In & Slide Down)
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-[-20px]', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
    });

    // Otomatis Hancurkan Elemen Setelah 3 Detik
    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-[-20px]', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

/**
 * Membuka komponen modal antarmuka
 * @param {string} id - ID elemen HTML modal target
 */
window.showModal = function(id) {
    AuraUtils.safeDOM(id, function(el) {
        el.classList.remove('hidden');
        requestAnimationFrame(() => {
            el.classList.remove('opacity-0');
            el.classList.add('opacity-100');
        });
    });
};

/**
 * Menutup komponen modal antarmuka dengan efek transisi
 * @param {string} id - ID elemen HTML modal target
 */
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
    
    // Injeksi Modals dinamis otomatis berjalan di sini
    if (typeof injectMissingModals === 'function') injectMissingModals();
    
    Logger.success('System', 'Sistem Kendali Utama (main.js) dan Protokol Terkait Berhasil Disinkronisasikan.');
});

// ============================================================================
// PWA & SERVICE WORKER REGISTRATION (Mobile Installability)
// ============================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then((registration) => {
                Logger.success('PWA', `Service Worker terdaftar sukses. Scope: ${registration.scope}`);
            })
            .catch((error) => {
                Logger.error('PWA', 'Gagal mendaftarkan Service Worker:', error);
            });
    });
}
