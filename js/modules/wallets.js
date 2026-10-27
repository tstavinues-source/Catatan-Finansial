/**
 * AuraFi OS - Multi-Wallet Wealth Manager
 * Modul Canggih untuk Manajemen Dompet, Likuiditas, dan Filter Ilusi Kekayaan.
 * (SAFE MODE: Steril dari Backtick Multi-baris)
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
                await set(ref(db, ledgerNode + "/" + uid + "/wallets/" + walletId), walletData);
                
                if (isNew && initialBalance > 0) {
                    const trxId = AuraUtils.generateId('trx');
                    const activeCurr = AuraState.system?.displayCurrency || 'JPY';
                    
                    const modalTrx = {
                        id: trxId,
                        merchantName: "Saldo Awal: " + name,
                        storeName: "Saldo Awal: " + name,
                        tanggal: nowIso.split('T')[0],
                        createdAt: nowIso,
                        nominal: initialBalance,
                        mata_uang: activeCurr,
                        wallet_id: walletId,
                        metode_pembayaran: type,
                        tipe: 'pemasukan',
                        kategori: 'Lainnya',
                        description: "Deposit modal awal pembuatan dompet " + name + ".",
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
                    await set(ref(db, ledgerNode + "/" + uid + "/transactions/" + trxId), modalTrx);
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

        const isConfirmed = await window.AuraConfirm("Yakin ingin memusnahkan dompet <b>" + wallet.name + "</b>? Transaksi yang sudah masuk ke dompet ini akan tetap ada, tapi kehilangan identitas sumbernya.");
        if (!isConfirmed) return;

        try {
            const db = AuraState.instances.db;
            const uid = AuraState.user.uid;
            const ledgerNode = APP_CONFIG.LEDGER_NODE;
            
            if (db && uid) {
                await remove(ref(db, ledgerNode + "/" + uid + "/wallets/" + id));
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
                await set(ref(db, ledgerNode + "/" + uid + "/wallets/" + id), wallet);
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
            container.innerHTML = "<div class='col-span-2 text-center p-8 border border-dashed border-[var(--border-glass)] rounded-2xl bg-black/20 mt-4'>" +
                "<div class='w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3'><i class='fa-solid fa-ghost text-gray-500 text-lg'></i></div>" +
                "<p class='text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold'>Kekosongan Terdeteksi</p>" +
                "<p class='text-xs text-gray-500 mt-1'>Anda belum mengonfigurasi dompet atau rekening fisik/digital apa pun.</p>" +
                "</div>";
            return;
        }

        // Saldo per dompet dihitung dari transaksi — aturan yang sama dengan dashboard
        const balances = {};
        walletKeys.forEach(k => balances[k] = 0);
        (AuraState.data.transactions || []).forEach(trx => {
            if (!trx || trx.is_deleted || !trx.wallet_id || balances[trx.wallet_id] === undefined) return;
            const val = AuraUtils.convertCurrency(trx.nominal || 0, trx.mata_uang || 'JPY');
            const fee = AuraUtils.convertCurrency(Number(trx.admin_fee || 0), trx.mata_uang || 'JPY');
            if (trx.tipe === 'pemasukan' || trx.tipe === 'mutasi_masuk') balances[trx.wallet_id] += val;
            else if (trx.tipe === 'pengeluaran' || trx.tipe === 'mutasi_keluar') balances[trx.wallet_id] -= val;
            else if (trx.tipe === 'tarik_tunai' || trx.tipe === 'setor_tunai') balances[trx.wallet_id] -= (val + fee);
            else if (trx.tipe === 'nabung') balances[trx.wallet_id] -= val;
        });

        let html = '';
        walletKeys.forEach(key => {
            const w = wallets[key];
            const icon = w.type === 'cashless' ? "fa-credit-card" : "fa-money-bill-wave";
            const eyeIcon = w.is_hidden ? "<i class='fa-solid fa-eye-slash text-rose-400'></i>" : "<i class='fa-solid fa-eye text-[var(--text-muted)]'></i>";
            const hiddenBadge = w.is_hidden ? "<span class='text-[8px] text-rose-400 border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 rounded uppercase tracking-[0.15em] ml-1 font-bold'>Gaib</span>" : "";
            const walletTypeLabel = w.type === 'cashless' ? "Rekening Digital" : "Tunai Fisik";
            const balText = (typeof window.formatAuraCurrencyCompact === 'function') ? window.formatAuraCurrencyCompact(balances[key]) : balances[key];

            html += "<div class='glass-panel p-3.5 flex flex-col gap-2.5 " + (w.is_hidden ? "opacity-60" : "") + "'>" +
                "<div class='flex items-start justify-between gap-2'>" +
                "<div class='w-10 h-10 icon-chip shrink-0'><i class='fa-solid " + icon + " text-accent'></i></div>" +
                "<div class='flex gap-1 shrink-0'>" +
                "<button onclick=\"window.toggleWalletVisibility('" + key + "')\" class='w-7 h-7 rounded-full bg-black/60 border border-[var(--border-glass)] flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 text-[10px]' title='Sembunyikan dari Net Worth'>" + eyeIcon + "</button>" +
                "<button onclick=\"window.editWallet('" + key + "')\" class='w-7 h-7 rounded-full bg-black/60 border border-[var(--border-glass)] flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 text-[var(--text-muted)] hover:text-white text-[10px]'><i class='fa-solid fa-pen'></i></button>" +
                "<button onclick=\"window.deleteWallet('" + key + "')\" class='w-7 h-7 rounded-full bg-black/60 border border-[var(--border-glass)] flex items-center justify-center hover:bg-rose-500/20 transition-all active:scale-90 text-[var(--text-muted)] hover:text-rose-400 text-[10px]'><i class='fa-solid fa-trash'></i></button>" +
                "</div></div>" +
                "<div><h4 class='text-[13px] font-bold text-white tracking-wide leading-tight'>" + AuraUtils.escapeHtml(w.name) + hiddenBadge + "</h4>" +
                "<p class='text-[9px] text-[var(--text-muted)] uppercase tracking-widest mt-0.5 font-semibold'>" + walletTypeLabel + "</p></div>" +
                "<p class='font-display font-extrabold text-[15px] mt-auto " + (w.is_hidden ? "line-through text-rose-400" : "") + "'>" + balText + "</p>" +
                "</div>";
        });

        container.innerHTML = html;
    }
};

window.openWalletManager = () => WalletManager.openManager();
window.openAddWalletForm = () => WalletManager.openAddForm();
window.saveWalletData = () => WalletManager.saveWallet();
window.editWallet = (id) => WalletManager.editWallet(id);
window.deleteWallet = (id) => WalletManager.deleteWallet(id);
window.toggleWalletVisibility = (id) => WalletManager.toggleVisibility(id);
