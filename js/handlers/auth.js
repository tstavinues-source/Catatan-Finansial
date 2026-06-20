 /**
 * Authentication Handlers
 * Menangani logika login, logout, dan pengawasan sesi pengguna (Auth Observer).
 */

import { 
    signInWithEmailAndPassword, 
    signInWithPopup, 
    signInAnonymously, 
    signOut, 
    onAuthStateChanged,
    GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Menggunakan Jalur Absolut untuk mencegah Error 404
import { AuraState } from '/js/core/state.js';
import { Logger } from '/js/core/logger.js';

// ============================================================================
// FUNGSI AKSI LOGIN & LOGOUT (Terekspos ke HTML)
// ============================================================================

window.loginWithEmail = async function() {
    const email = document.getElementById('login-email')?.value;
    const pass = document.getElementById('login-pass')?.value;
    
    if (!email || !pass) {
        if (window.showToast) window.showToast("Email dan sandi wajib diisi!", true);
        return;
    }
    
    if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(true);
    
    try {
        await signInWithEmailAndPassword(AuraState.instances.auth, email, pass);
        if (window.showToast) window.showToast("Berhasil masuk via Email.");
    } catch (e) {
        Logger.error('Auth', 'Login Email Gagal', e);
        if (window.showToast) window.showToast("Gagal masuk: Kredensial tidak valid atau ditolak.", true);
    } finally {
        if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(false);
    }
};

window.loginWithGoogle = async function() {

    alert("Google Login dipanggil");

    if (typeof window.setProcessingStatus === 'function')
        window.setProcessingStatus(true);

    ...
}
    if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(true);
    
    try {
        // Inisialisasi provider secara mandiri (lokal) sebelum popup dipanggil
        const googleProvider = new GoogleAuthProvider();
        
        // Memaksa Google menampilkan pilihan akun setiap kali tombol login diklik
        googleProvider.setCustomParameters({ prompt: 'select_account' });
        
        // Melakukan proses otentikasi menggunakan provider lokal baru
        await signInWithPopup(AuraState.instances.auth, googleProvider);
        
        if (window.showToast) window.showToast("Berhasil masuk via Akun Google.");
    } catch (e) {
        Logger.error('Auth', 'Login Google Gagal', e);
        if (window.showToast) window.showToast("Gagal otentikasi via Google Provider.", true);
    } finally {
        if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(false);
    }
};

window.loginAnonymously = async function() {
    if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(true);
    
    try {
        await signInAnonymously(AuraState.instances.auth);
        if (window.showToast) window.showToast("Masuk sebagai Tamu (Anonim).");
    } catch (e) {
        Logger.error('Auth', 'Login Anonim Gagal', e);
        if (window.showToast) window.showToast("Gagal masuk sebagai tamu.", true);
    } finally {
        if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(false);
    }
};

window.logoutSystem = async function() {
    if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(true);
    
    try {
        await signOut(AuraState.instances.auth);
        if (window.showToast) window.showToast("Berhasil keluar dari sistem.");
    } catch (e) {
        Logger.error('Auth', 'Logout Gagal', e);
        if (window.showToast) window.showToast("Gagal keluar dari sesi.", true);
    } finally {
        if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(false);
    }
};

// ============================================================================
// AUTH STATE OBSERVER (PENGAWAS SESI AKTIF)
// ============================================================================
export function initializeAuthObserver() {
    const modalLogin = document.getElementById('modal-login');
    
    onAuthStateChanged(AuraState.instances.auth, (user) => {
        if (user) {
            Logger.success('Auth', `Sesi Dokumen Aktif: ${user.email || 'Anonymous'} [${user.uid}]`);
            AuraState.user.uid = user.uid;
            
            if (modalLogin) {
                modalLogin.classList.add('opacity-0');
                setTimeout(() => {
                    modalLogin.classList.add('hidden');
                }, 300);
            }
            
            // Memantik trigger fetching listener database
            if (typeof window.loadRealtimeDatabaseData === 'function') {
                window.loadRealtimeDatabaseData();
            }
            
            if (window.FirebaseService) {
                window.FirebaseService.saveAuditLog('LOGIN.SUCCESS', 'Validasi Gerbang Pertahanan User Lulus Otorisasi Penuh.');
            }
            
            const savedGeminiPin = sessionStorage.getItem('aurafi_gemini_pin');
            if (savedGeminiPin && typeof window.syncGeminiEngine === 'function') { 
                setTimeout(function() {
                    window.syncGeminiEngine(true);
                }, 1000);
            }
        } else {
            Logger.info('Auth', 'Sesi Otorisasi Kosong. Memutus jalur antrean Cloud...');
            const subs = AuraState.listeners;
            for (let i = 0; i < subs.length; i++) {
                if (typeof subs[i] === 'function') subs[i]();
            }
            AuraState.listeners = [];
            AuraState.user.uid = null;
            
            if (modalLogin) {
                modalLogin.classList.remove('hidden');
                modalLogin.classList.remove('opacity-0');
                modalLogin.classList.add('opacity-100');
            }
        }
    });
}

// Inisiasi Observer saat modul diimpor
initializeAuthObserver();
