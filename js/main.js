/**
 * ============================================================================
 * AURAFI OS - ENTRY POINT (main.js)
 * ============================================================================
 * Mengorkestrasi seluruh modul, error handling, inisialisasi awal sistem,
 * serta registrasi PWA Service Worker untuk instalasi mobile.
 * Hak Cipta Enterprise Build - Final Post Bugfix.
 */

// 1. Core & Config Imports (Menggunakan Jalur Absolut)
import { APP_CONFIG } from '/js/config/constants.js';
import { Logger } from '/js/core/logger.js';
import { AuraState } from '/js/core/state.js';
import { AuraUtils } from '/js/core/utils.js';

// 2. Services & Modules Imports
import { FirebaseService } from '/js/services/firebase.js';
import { CategoryManager } from '/js/modules/categories.js'; 

// 3. Renderers Imports
import '/js/renderers/dashboard.js';
import { injectMissingModals } from '/js/renderers/modals.js';

// 4. AI Engines Imports
import '/js/services/memory.js';
import '/js/services/ai/groq.js';
import '/js/services/ai/gemini.js';
import '/js/services/ai/orchestrator.js';

// 5. Handlers Imports
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
// GLOBAL WINDOW LAYERING & BACKWARD COMPATIBILITY
// ============================================================================
// Mengekspos utilitas inti agar dapat diakses oleh komponen UI inline HTML legacy
window.AuraState = AuraState;
window.AuraUtils = AuraUtils;
window.Logger = Logger;

// Global Window Helpers untuk manipulasi Modal & DOM secara cepat
window.showModal = function(id) {
    AuraUtils.safeDOM(id, function(el) {
        el.classList.remove('hidden');
        setTimeout(() => {
            el.classList.remove('opacity-0');
            el.classList.add('opacity-100');
        }, 50);
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
