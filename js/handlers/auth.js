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
        window.showLoginError("Login gagal: periksa kembali email dan sandi Anda." + (error && error.message ? " (" + error.message + ")" : ""));
        if (typeof window.showToast === 'function') {
            window.showToast("Login Gagal: Periksa kembali email dan sandi Anda.", true);
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
        const detail = error && error.message ? error.message : "Akses Google ditolak atau dibatalkan.";
        window.showLoginError("Login Google gagal: " + detail);
        if (typeof window.showToast === 'function') {
            window.showToast("Login Google gagal: " + detail, true);
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
