/**
 * Authentication Handlers
 * Menangani logika login, logout, dan pengawasan sesi pengguna (Auth Observer).
 */

import { 
    signInWithEmailAndPassword, 
    signInWithPopup, 
    signInAnonymously, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

import { AuraState } from '../core/state.js';
import { Logger } from '../core/logger.js';

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
    if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(true);
    
    try {
        await signInWithPopup(AuraState.instances.auth, window.googleAuthProvider);
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
        if (window.showToast) window.showToast("Sesi Tamu Terenkripsi Diaktifkan.");
    } catch (e) {
        Logger.error('Auth', 'Login Tamu Gagal', e);
        if (window.showToast) window.showToast("Gagal membuat sesi Tamu.", true);
    } finally {
        if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(false);
    }
};

window.logoutAccount = async function() {
    if (!confirm("Yakin ingin keluar dari perangkat ini? (Data Cloud akan tetap aman)")) return;
    
    try {
        await signOut(AuraState.instances.auth);
        if (window.showToast) window.showToast("Berhasil keluar. Sesi dibersihkan.");
    } catch (e) {
        Logger.error('Auth', 'Logout Gagal', e);
    }
};

// ============================================================================
// OBSERVER SESI OTENTIKASI (Pintu Gerbang Sistem)
// ============================================================================

function initializeAuthObserver() {
    // Memastikan instance Firebase Auth sudah dimuat oleh services/firebase.js
    if (!AuraState.instances.auth) {
        Logger.warn('Auth', 'Menunggu Firebase Auth instance...');
        setTimeout(initializeAuthObserver, 200);
        return;
    }

    onAuthStateChanged(AuraState.instances.auth, function(user) {
        const modalLogin = document.getElementById('modal-login');
        
        if (user) {
            AuraState.user.uid = user.uid; 
            AuraState.user.isAnonymous = user.isAnonymous;
            
            if (modalLogin) modalLogin.classList.add('hidden');
            
            // if (typeof window.loadRealtimeDatabaseData === 'function') {
            //     window.loadRealtimeDatabaseData();
            // }
            
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
                // Paksa modal login terlihat
                modalLogin.classList.remove('opacity-0');
                modalLogin.classList.add('opacity-100');
            }
        }
    });
}

// Inisiasi Observer saat modul diimpor
initializeAuthObserver();
