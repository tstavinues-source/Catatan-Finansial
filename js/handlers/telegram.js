/**
 * AuraFi OS - Telegram Account Linking Handlers
 * Mengelola pembuatan kode OTP pairing sementara dan pemantauan status sinkronisasi.
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';
import { APP_CONFIG } from '../config/constants.js';
import { ref, update, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// === FUNGSI GENERATOR KODE OTP ACK ===
window.requestTelegramPairingCode = async function() {
    if (!AuraState.user.uid) return;

    const btn = document.getElementById('btn-tg-generate');
    if (btn) btn.disabled = true;

    // Membuat 5 digit angka acak unik untuk OTP pairing
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    const pairingCode = `AURA-${randomDigits}`;

    const timestamp = Date.now();
    const updates = {};

    // 1. Tanam kode OTP di bawah profil user (agar PWA tahu kode aktifnya apa)
    updates[`${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/settings/telegramPairing`] = {
        code: pairingCode,
        createdAt: timestamp,
        status: "PENDING"
    };

    // 2. Tanam di global inverted-index node khusus Telegram (agar Bot bisa mencari siapa pemilik kode ini)
    updates[`telegram_pairings/${pairingCode}`] = {
        uid: AuraState.user.uid,
        createdAt: timestamp
    };

    try {
        await update(ref(AuraState.instances.db), updates);

        // Tampilkan kotak kode OTP ke layar DOM
        AuraUtils.safeDOM('tg-otp-code', el => el.innerText = pairingCode);
        AuraUtils.safeDOM('tg-otp-display-box', el => el.classList.remove('hidden'));
        
        if (window.showToast) window.showToast("Kode OTP dibuat! Silakan kirimkan ke Bot Telegram.");
    } catch(e) {
        console.error("Gagal mendaftarkan token Telegram pairing:", e);
        if (window.showToast) window.showToast("Gagal mendapatkan kode OTP cloud.", true);
        if (btn) btn.disabled = false;
    }
};

// === MONITORING STATUS HUBUNGAN TELEGRAM (REALTIME) ===
// Fungsi ini akan mendengarkan secara realtime apakah Bot Telegram sudah berhasil 
// menautkan akun orang ini atau belum. Jika sukses, UI akan otomatis berubah tanpa refresh!
document.addEventListener('DOMContentLoaded', () => {
    // Gunakan interval kecil untuk menunggu hingga sistem login Firebase termuat sepenuhnya
    const checkAuthLoop = setInterval(() => {
        if (AuraState.user?.uid && AuraState.instances.db) {
            clearInterval(checkAuthLoop);
            
            const tgSettingsRef = ref(AuraState.instances.db, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/settings/telegramProfile`);
            
            const tgUnsub = onValue(tgSettingsRef, (snapshot) => {
                if (snapshot.exists()) {
                    const tgProfile = snapshot.val();
                    
                    // Jika data username telegram ada, ubah badge menjadi TERHUBUNG
                    AuraUtils.safeDOM('tg-status-badge', el => {
                        el.className = "text-[9px] bg-emerald-950/40 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-mono font-bold tracking-wider shadow-[0_0_10px_rgba(16,185,129,0.2)]";
                        el.innerText = `CONNECTED (@${tgProfile.username || 'User'})`;
                    });

                    // Sembunyikan tombol generator karena sudah sukses terikat
                    AuraUtils.safeDOM('tg-binding-area', el => {
                        el.innerHTML = `<p class="text-[11px] text-emerald-400 font-bold bg-emerald-950/20 border border-emerald-900/30 p-3 rounded-xl leading-relaxed text-center"><i class="fa-solid fa-circle-check mr-1"></i> Brankas Terhubung! Akun Anda sukses terikat dengan ID Telegram <b>${tgProfile.chatId}</b>. Anda kini bisa mendikte kas lewat Telegram.</p>`;
                    });
                } else {
                    // Fallback jika belum terikat atau diputus
                    AuraUtils.safeDOM('tg-status-badge', el => {
                        el.className = "text-[9px] bg-red-950/40 text-rose-400 border border-red-900/50 px-2 py-0.5 rounded font-mono font-bold tracking-wider";
                        el.innerText = "TERPUTUS";
                    });
                }
            });

            // Daftarkan listener ke array pembersih global agar tidak memori bocor
            if (AuraState.listeners) AuraState.listeners.push(tgUnsub);
        }
    }, 2000);
});