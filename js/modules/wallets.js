/**
 * AuraFi OS - Multi-Wallet Wealth Manager
 * Modul Canggih untuk Manajemen Dompet, Likuiditas, dan Filter Ilusi Kekayaan.
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';
import { ref, set } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

export const WalletManager = {
    // Inisialisasi State Dompet jika masih kosong
    init() {
        if (!AuraState.data.wallets) {
            AuraState.data.wallets = {};
        }
    },

    openManager() {
        this.renderList();
        if(typeof window.showModal === 'function') window.showModal('modal-wallet-manager');
    },

    openAddForm() {
        AuraUtils.safeDOM('wallet-form-id', el => el.value = '');
        AuraUtils.safeDOM('wallet-form-name', el => el.value = '');
        AuraUtils.safeDOM('wallet-form-type', el => el.value = 'cashless');
        AuraUtils.safeDOM('wallet-form-initial', el => el.value = '0');
        
        // Tampilkan input saldo awal hanya untuk dompet baru
        AuraUtils.safeDOM('wallet-form-initial-container', el => el.style.display = 'block');
        AuraUtils.safeDOM('wallet-form-title', el => el.innerText = 'Akun Dompet Baru');

        if(typeof window.showModal === 'function') window.showModal('modal-wallet-form');
    },

    editWallet(id) {
        const wallet = AuraState.data.wallets[id];
        if(!wallet) return;

        AuraUtils.safeDOM('wallet-form-id', el => el.value = id);
        AuraUtils.safeDOM('wallet-form-name', el => el.value = wallet.name);
        AuraUtils.safeDOM('wallet-form-type', el => el.value = wallet.type);
        
        // Sembunyikan input saldo awal saat mode edit (karena saldo dihitung otomatis nanti)
        AuraUtils.safeDOM('wallet-form-initial-container', el => el.style.display = 'none');
        AuraUtils.safeDOM('wallet-form-title', el => el.innerText = 'Edit Parameter Dompet');

        if(typeof window.showModal === 'function') window.showModal('modal-wallet-form');
    },

    async saveWallet() {
        const idEl = document.getElementById('wallet-form-id');
        const nameEl = document.getElementById('wallet-form-name');
        const typeEl = document.getElementById('wallet-form-type');
        const initEl = document.getElementById('wallet-form-initial');

        const id = idEl ? idEl.value : '';
        const name = nameEl ? nameEl.value.trim() : '';
        const type = typeEl ? typeEl.value : 'cashless';
        const initialBalance = initEl ? (Number(initEl.value) || 0) : 0;

        if(!name) {
            if(window.showToast) window.showToast("Instruksi ditolak: Nama dompet wajib diisi!", true);
            return;
        }

        if(typeof window.setProcessingStatus === 'function') window.setProcessingStatus(true);

        try {
            const isNew = !id;
            const walletId = id || AuraUtils.generateId('wal');
            const nowIso = new Date().toISOString();

            const walletData = {
                id: walletId,
                name: name,
                type: type,
                is_hidden: isNew ? false : (AuraState.data.wallets[walletId]?.is_hidden || false),
                updatedAt: nowIso
            };

            if (isNew) {
                walletData.createdAt = nowIso;
                walletData.initial_balance = initialBalance;
            } else {
                // Pertahankan data lama saat edit
                walletData.initial_balance = AuraState.data.wallets[walletId].initial_balance || 0;
                walletData.createdAt = AuraState.data.wallets[walletId].createdAt || nowIso;
            }

            // 1. Tembak Langsung ke Firebase Cloud Database
            const db = AuraState.instances.db;
            const uid = AuraState.user.uid;
            if (db && uid) {
                await set(ref(db, `users/${uid}/wallets/${walletId}`), walletData);
            } else {
                throw new Error("Koneksi Firebase Cloud terputus.");
            }

            // 2. Simpan di Memori Lokal agar UI langsung berubah tanpa refresh
            if(!AuraState.data.wallets) AuraState.data.wallets = {};
            AuraState.data.wallets[walletId] = walletData;

            if(typeof window.closeModal === 'function') window.closeModal('modal-wallet-form');
            this.renderList();
            
            // Kalkulasi Ulang Dashboard (Akan disempurnakan di Fase 3)
            if(typeof window.reCalculateAll === 'function') window.reCalculateAll();

            if(window.showToast) window.showToast("Struktur Dompet berhasil disinkronisasi!");
        } catch(e) {
            console.error(e);
            if(window.showToast) window.showToast("Gagal mengukir dompet ke sistem.", true);
        } finally {
            if(typeof window.setProcessingStatus === 'function') window.setProcessingStatus(false);
        }
    },

    async toggleVisibility(id) {
        const wallet = AuraState.data.wallets[id];
        if(!wallet) return;

        // Balikkan status visibilitas (True/False)
        wallet.is_hidden = !wallet.is_hidden;
        wallet.updatedAt = new Date().toISOString();
        
        // Render ulang UI secara instan agar terasa responsif
        this.renderList();

        try {
            const db = AuraState.instances.db;
            const uid = AuraState.user.uid;
            if (db && uid) {
                await set(ref(db, `users/${uid}/wallets/${id}`), wallet);
            }
            if(typeof window.reCalculateAll === 'function') window.reCalculateAll();
            
            if(window.showToast) window.showToast(wallet.is_hidden ? "Dompet disembunyikan dari Total Kekayaan." : "Dompet kembali masuk ke perhitungan.");
        } catch(e) {
            // Jika gagal tembak Firebase, kembalikan status UI seperti semula
            wallet.is_hidden = !wallet.is_hidden;
            this.renderList();
            if(window.showToast) window.showToast("Gagal mengubah visibilitas di Cloud.", true);
        }
    },

    renderList() {
        const container = document.getElementById('wallet-list-container');
        if(!container) return;

        const wallets = AuraState.data.wallets || {};
        const walletKeys = Object.keys(wallets);

        if(walletKeys.length === 0) {
            container.innerHTML = `
                <div class="text-center p-8 border border-dashed border-[var(--border-glass)] rounded-2xl bg-black/20 mt-4">
                    <div class="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3"><i class="fa-solid fa-ghost text-gray-500 text-lg"></i></div>
                    <p class="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold">Kekosongan Terdeteksi</p>
                    <p class="text-xs text-gray-500 mt-1">Anda belum mengonfigurasi dompet atau rekening fisik/digital apa pun.</p>
                </div>`;
            return;
        }

        let html = '';
        walletKeys.forEach(key => {
            const w = wallets[key];
            
            // Logika Estetika Dinamis (Cashless = Biru, Tunai = Hijau)
            const icon = w.type === 'cashless' ? '<i class="fa-solid fa-credit-card text-sky-400"></i>' : '<i class="fa-solid fa-money-bill-wave text-emerald-400"></i>';
            const bgIcon = w.type === 'cashless' ? 'bg-sky-500/10 border-sky-500/30 shadow-[0_0_10px_rgba(56,189,248,0.2)]' : 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]';
            
            // Logika Mata Gaib (Disembunyikan)
            const eyeIcon = w.is_hidden ? '<i class="fa-solid fa-eye-slash text-rose-400"></i>' : '<i class="fa-solid fa-eye text-[var(--text-muted)] group-hover:text-emerald-400"></i>';
            const hiddenBadge = w.is_hidden ? '<span class="text-[8px] text-rose-400 border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 rounded uppercase tracking-[0.15em] ml-2 font-bold animate-pulse">Gaib</span>' : '';
            const borderGlow = w.is_hidden ? 'border-l-rose-500 opacity-60' : (w.type === 'cashless' ? 'border-l-sky-400' : 'border-l-emerald-400');

            html += `
            <div class="glass-panel p-4 flex items-center justify-between border-l-[3px] ${borderGlow} transition-all duration-300 hover:bg-white/5 group">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-xl flex items-center justify-center border ${bgIcon} shrink-0 transition-transform group-hover:scale-105">
                        ${icon}
                    </div>
                    <div>
                        <h4 class="text-sm font-bold text-white tracking-wide">${AuraUtils.escapeHtml(w.name)} ${hiddenBadge}</h4>
                        <p class="text-[9px] text-[var(--text-muted)] uppercase tracking-widest mt-1 font-semibold">${w.type === 'cashless' ? 'Rekening Digital' : 'Tunai Fisik'}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <button onclick="window.toggleWalletVisibility('${key}')" class="w-8 h-8 rounded-full bg-black/60 border border-[var(--border-glass)] flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 shadow-md group" title="Sembunyikan dari Net Worth">
                        ${eyeIcon}
                    </button>
                    <button onclick="window.editWallet('${key}')" class="w-8 h-8 rounded-full bg-black/60 border border-[var(--border-glass)] flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 text-[var(--text-muted)] hover:text-white shadow-md">
                        <i class="fa-solid fa-pen text-[10px]"></i>
                    </button>
                </div>
            </div>
            `;
        });

        container.innerHTML = html;
    }
};

// ============================================================================
// BINDING GLOBAL: Agar fungsi ini bisa diakses dari atribut onclick di HTML
// ============================================================================
window.openWalletManager = () => WalletManager.openManager();
window.openAddWalletForm = () => WalletManager.openAddForm();
window.saveWalletData = () => WalletManager.saveWallet();
window.editWallet = (id) => WalletManager.editWallet(id);
window.toggleWalletVisibility = (id) => WalletManager.toggleVisibility(id);
