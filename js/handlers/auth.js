/**
 * Authentication Handler
 * Menangani interaksi UI untuk Login, Register, dan Logout.
 * Terhubung langsung dengan tombol-tombol di index.html.
 */

import { AuraState } from '../core/state.js';
import { Logger } from '../core/logger.js';
import { FirebaseService } from '../services/firebase.js';

// ============================================================================
// FUNGSI LOGIN GLOBAL (Diikat ke window agar bisa dipanggil HTML)
// ============================================================================

// Kotak galat menetap di jendela login: pesan kegagalan tertulis di layar
// dan tidak hilang sendiri (berbeda dengan toast yang cuma melintas),
// supaya mudah dibaca dan ditangkap layar untuk dilaporkan.
window.showLoginError = function(msg) {
    const el = document.getElementById('login-error');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
};
window.clearLoginError = function() {
    const el = document.getElementById('login-error');
    if (!el) return;
    el.textContent = '';
    el.classList.add('hidden');
};

// Peta kode galat Firebase Auth -> pesan ramah berbahasa Indonesia.
// Pesan mentah Firebase (teknis, berbahasa Inggris) TIDAK pernah
// ditampilkan ke pengguna. Satu-satunya pengecualian: kode galat yang
// belum terpetakan ikut disebut dalam kurung pada pesan bawaan, supaya
// kegagalan yang belum dikenal bisa didiagnosis dari laporan pengguna.
function friendlyAuthError(error) {
    const code = (error && error.code) || '';
    switch (code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
            // Satu pesan untuk ketiganya: tidak membocorkan apakah
            // emailnya yang tidak terdaftar atau sandinya yang salah.
            return 'Email atau kata sandi tidak cocok. Periksa kembali, atau gunakan "Lupa kata sandi?" untuk mengatur ulang.';
        case 'auth/invalid-email':
            return 'Format alamat email tidak valid. Periksa kembali penulisannya.';
        case 'auth/user-disabled':
            return 'Akun ini sedang dinonaktifkan. Silakan hubungi dukungan untuk bantuan.';
        case 'auth/too-many-requests':
            return 'Terlalu banyak percobaan dalam waktu singkat. Tunggu beberapa menit, lalu coba lagi.';
        case 'auth/network-request-failed':
            return 'Koneksi internet bermasalah. Periksa jaringanmu, lalu coba lagi.';
        case 'auth/popup-closed-by-user':
        case 'auth/cancelled-popup-request':
        case 'auth/popup-blocked':
            return 'Jendela masuk Google ditutup atau terblokir sebelum selesai. Silakan coba lagi.';
        case 'auth/operation-not-allowed':
            return 'Metode masuk ini belum diaktifkan. Silakan coba metode lain.';
        case 'auth/unauthorized-domain':
            return 'Domain situs ini belum terdaftar untuk masuk Google. Beri tahu pengelola aplikasi agar domain ini didaftarkan sebagai domain resmi di konsol Firebase.';
        case 'auth/internal-error':
        case 'auth/missing-initial-state':
        case 'auth/web-storage-unsupported':
            return 'Penyimpanan peramban untuk sesi masuk Google terhalang. Izinkan cookie pihak ketiga untuk situs ini, atau coba gunakan peramban lain.';
        case 'auth/invalid-api-key':
        case 'auth/app-not-authorized':
            return 'Konfigurasi aplikasi untuk masuk Google bermasalah. Beri tahu pengelola aplikasi agar memeriksa kunci API dan domain resmi di konsol Firebase.';
        default:
            if (code) return 'Terjadi kesalahan tak terduga (kode: ' + code + '). Silakan coba lagi sebentar lagi.';
            return 'Terjadi kesalahan tak terduga. Silakan coba lagi sebentar lagi.';
    }
}

window.loginWithEmail = async function() {
    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-pass');
    
    if (!emailInput || !passInput) return;

    const email = emailInput.value.trim();
    const password = passInput.value;

    if (!email || !password) {
        if (typeof window.showToast === 'function') {
            window.showToast("Email dan Kata Sandi wajib diisi!", true);
        }
        return;
    }

    if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(true);
    window.clearLoginError();
    try {
        Logger.info('Auth', 'Mencoba login dengan Email...');
        // Memanggil Firebase Service untuk eksekusi otentikasi
        await FirebaseService.loginWithEmail(email, password);
        
        // Bersihkan input setelah berhasil
        emailInput.value = '';
        passInput.value = '';
        
    } catch (error) {
        Logger.error('Auth', 'Gagal login email:', error);
        const friendly = friendlyAuthError(error);
        window.showLoginError("Login gagal. " + friendly);
        if (typeof window.showToast === 'function') {
            window.showToast("Login gagal. " + friendly, true);
        }
    } finally {
        if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(false);
    }
};

window.loginWithGoogle = async function() {
    if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(true);
    window.clearLoginError();
    
    try {
        Logger.info('Auth', 'Mencoba login dengan Google...');
        await FirebaseService.loginWithGoogle();
        // Modal login biasanya otomatis ditutup oleh observer di firebase.js saat login sukses
    } catch (error) {
        Logger.error('Auth', 'Gagal login Google:', error);
        const friendly = friendlyAuthError(error);
        window.showLoginError("Login Google gagal. " + friendly);
        if (typeof window.showToast === 'function') {
            window.showToast("Login Google gagal. " + friendly, true);
        }
    } finally {
        if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(false);
    }
};

// Alur "Lupa kata sandi?": memakai email yang sedang terisi di formulir
// login, lalu meminta Firebase mengirim tautan atur ulang sandi.
window.forgotPassword = async function() {
    const emailInput = document.getElementById('login-email');
    const email = emailInput ? emailInput.value.trim() : '';

    if (!email) {
        if (typeof window.showToast === 'function') {
            window.showToast('Isi alamat email dulu, lalu ketuk "Lupa kata sandi?" lagi.', true);
        }
        if (emailInput) emailInput.focus();
        return;
    }

    if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(true);
    window.clearLoginError();
    try {
        await FirebaseService.resetPassword(email);
        if (typeof window.showToast === 'function') {
            window.showToast('Tautan atur ulang sandi sudah dikirim ke ' + email + '. Periksa kotak masuk atau folder spam, ya.');
        }
    } catch (error) {
        Logger.error('Auth', 'Gagal mengirim atur ulang sandi:', error);
        if (error && error.code === 'auth/user-not-found') {
            // Netral demi keamanan: jangan membocorkan apakah sebuah
            // alamat email benar-benar terdaftar atau tidak.
            if (typeof window.showToast === 'function') {
                window.showToast('Jika email itu terdaftar, tautan atur ulang sandi sudah dikirim. Periksa kotak masuk atau folder spam, ya.');
            }
        } else {
            const friendly = friendlyAuthError(error);
            window.showLoginError('Atur ulang sandi gagal. ' + friendly);
            if (typeof window.showToast === 'function') {
                window.showToast('Atur ulang sandi gagal. ' + friendly, true);
            }
        }
    } finally {
        if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(false);
    }
};

window.logoutAccount = async function() {
    // PERBAIKAN: sebelumnya pakai confirm() bawaan browser (nge-block thread,
    // tampilannya beda sendiri dibanding modal konfirmasi custom yang dipakai
    // konsisten di seluruh aplikasi). Sekarang pakai window.AuraAlert.confirm.
    if (typeof window.AuraAlert === 'undefined' || typeof window.AuraAlert.confirm !== 'function') {
        Logger.error('Auth', 'AuraAlert tidak tersedia, logout dibatalkan demi keamanan.');
        return;
    }

    window.AuraAlert.confirm("Keluar dari akun di perangkat ini? Data keuanganmu tetap aman tersimpan — kamu bisa masuk lagi kapan saja.", async () => {
        if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(true);
        
        try {
            Logger.info('Auth', 'Memutus sesi pengguna...');
            await FirebaseService.logout();
            
            if (typeof window.showToast === 'function') {
                window.showToast("Berhasil keluar dari sistem.");
            }
            
            // Tutup modal settings jika sedang terbuka
            if (typeof window.closeModal === 'function') {
                window.closeModal('modal-settings');
            }

            // Tampilkan kembali modal login
            if (typeof window.showModal === 'function') {
                window.showModal('modal-login');
            }

            // Opsional: Muat ulang halaman untuk membersihkan sisa memori browser
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (error) {
            Logger.error('Auth', 'Gagal logout:', error);
            if (typeof window.showToast === 'function') {
                window.showToast("Terjadi kesalahan saat memutus sesi.", true);
            }
        } finally {
            if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(false);
        }
    }, { confirmLabel: 'Keluar Akun' });
};

// Panen hasil masuk Google lewat alur alih-halaman, sekali saat modul ini
// dimuat: bila pengguna baru kembali dari halaman Google (redirect dipakai
// karena popup gagal), hasil masuknya menunggu untuk dipanen di sini.
// Suksesnya tidak ditangani di sini — observer auth di firebase.js menutup
// jendela login seperti login biasa. Galatnya ditampilkan dengan awalan
// dan peta pesan yang sama seperti jalur popup.
FirebaseService.consumeRedirectResult().then(function(outcome) {
    if (outcome && outcome.error) {
        Logger.error('Auth', 'Gagal login Google (alih-halaman):', outcome.error);
        const friendly = friendlyAuthError(outcome.error);
        window.showLoginError("Login Google gagal. " + friendly);
        if (typeof window.showToast === 'function') {
            window.showToast("Login Google gagal. " + friendly, true);
        }
    }
}).catch(function() { /* consumeRedirectResult tidak pernah melempar; pengaman saja */ });
