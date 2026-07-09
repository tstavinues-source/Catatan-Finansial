/**
 * AuraFi OS - Multi-Wallet Wealth Manager
 * Modul Canggih untuk Manajemen Dompet, Likuiditas, dan Filter Ilusi Kekayaan.
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';
import { APP_CONFIG } from '../config/constants.js';
import { ref, set, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

export const WalletManager = {
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
        
        // Sembunyikan saldo awal saat diedit. Jika ingin ubah saldo, edit transaksinya di Menu Log!
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
            } else {
                walletData.createdAt = AuraState.data.wallets[walletId].createdAt || nowIso;
            }

            const db = AuraState.instances.db;
            const uid = AuraState.user.uid;
            const ledgerNode = APP_CONFIG.LEDGER_NODE;
            
            if (db && uid) {
                // 1. Simpan data struktur dompet
                await set(ref(db, `${ledgerNode}/${uid}/wallets/${walletId}`), walletData);
                
                // 2. JIKA DOMPET BARU & ADA SALDO AWAL -> CATAT SEBAGAI TRANSAKSI PEMASUKAN!
                if (isNew && initialBalance > 0) {
                    const trxId = AuraUtils.generateId('trx');
                    const activeCurr = AuraState.system?.displayCurrency || 'JPY';
                    
                    const modalTrx = {
                        id: trxId,
                        merchantName: `Saldo Awal: ${name}`,
                        storeName: `Saldo Awal: ${name}`,
                        tanggal: nowIso.split('T')[0],
                        createdAt: nowIso,
                        nominal: initialBalance,
                        mata_uang: activeCurr,
                        wallet_id: walletId,
                        metode_pembayaran: type,
                        tipe: 'pemasukan',
                        kategori: 'Lainnya',
                        description: `Deposit modal awal pembuatan dompet ${name}.`,
                        isCustomDescription: true,
                        is_deleted: false,
                        items: [{
                            itemId: AuraUtils.generateId('itm'),
                            nama_barang: 'Modal Awal Dompet',
                            harga: initialBalance,
                            qty: 1,
                            kategori_barang: 'Lainnya',
                            tax_rate: 0,
                            paymentMethod: type,
                            timestamp: nowIso
                        }]
                    };
                    await set(ref(db, `${ledgerNode}/${uid}/transactions/${trxId}`), modalTrx);
                }
            } else {
                throw new Error("Koneksi Firebase Cloud terputus.");
            }

            if(!AuraState.data.wallets) AuraState.data.wallets = {};
            AuraState.data.wallets[walletId] = walletData;

            if(typeof window.closeModal === 'function') window.closeModal('modal-wallet-form');
            this.renderList();
            
            if(window.showToast) window.showToast("Struktur Dompet berhasil disinkronisasi permanen!");
        } catch(e) {
            console.error(e);
            if(window.showToast) window.showToast("Gagal mengukir dompet ke sistem.", true);
        } finally {
            if(typeof window.setProcessingStatus === 'function') window.setProcessingStatus(false);
        }
    },

    async deleteWallet(id) {
        const wallet = AuraState.data.wallets[id];
        if(!wallet) return;

        // Gunakan dialog kustom bawaan AuraFi Anda
        const isConfirmed = await window.AuraConfirm(`Yakin ingin memusnahkan dompet <b>${wallet.name}</b>? Transaksi yang sudah masuk ke dompet ini akan tetap ada, tapi kehilangan identitas sumbernya.`);
        if (!isConfirmed) return;

        try {
            const db = AuraState.instances.db;
            const uid = AuraState.user.uid;
            const ledgerNode = APP_CONFIG.LEDGER_NODE;
            
            if (db && uid) {
                await remove(ref(db, `${ledgerNode}/${uid}/wallets/${id}`));
            }
            
            delete AuraState.data.wallets[id];
            this.renderList();
            if(typeof window.reCalculateAll === 'function') window.reCalculateAll();
            
            if(window.showToast) window.showToast("Dompet berhasil dimusnahkan.");
        } catch(e) {
            if(window.showToast) window.showToast("Gagal menghapus dompet dari Cloud.", true);
        }
    },

    async toggleVisibility(id) {
        const wallet = AuraState.data.wallets[id];
        if(!wallet) return;

        wallet.is_hidden = !wallet.is_hidden;
        wallet.updatedAt = new Date().toISOString();
        this.renderList();

        try {
            const db = AuraState.instances.db;
            const uid = AuraState.user.uid;
            const ledgerNode = APP_CONFIG.LEDGER_NODE;
            if (db && uid) {
                await set(ref(db, `${ledgerNode}/${uid}/wallets/${id}`), wallet);
            }
            if(typeof window.reCalculateAll === 'function') window.reCalculateAll();
            if(window.showToast) window.showToast(wallet.is_hidden ? "Dompet disembunyikan dari Total Kekayaan." : "Dompet kembali masuk ke perhitungan.");
        } catch(e) {
            wallet.is_hidden = !wallet.is_hidden;
            this.renderList();
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
            const icon = w.type === 'cashless' ? '<i class="fa-solid fa-credit-card text-sky-400"></i>' : '<i class="fa-solid fa-money-bill-wave text-emerald-400"></i>';
            const bgIcon = w.type === 'cashless' ? 'bg-sky-500/10 border-sky-500/30 shadow-[0_0_10px_rgba(56,189,248,0.2)]' : 'bg-emerald-50
