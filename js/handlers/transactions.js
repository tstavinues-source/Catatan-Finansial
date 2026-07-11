/**
 * Transactions CRUD Handlers
 * Menangani semua logika input manual, edit transaksi, manajemen keranjang struk, 
 * serta fungsi soft-delete (sampah) dan restorasi.
 * [UPDATE: MULTI-WALLET COMPATIBILITY & FITUR MUTASI + VALIDASI SALDO]
 * (MOBILE COPY-PASTE SAFE MODE)
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';
import { Logger } from '../core/logger.js';
import { FirebaseService } from '../services/firebase.js';
import { CategoryManager } from '../modules/categories.js';
import { WalletManager } from '../modules/wallets.js';

document.addEventListener('DOMContentLoaded', () => {
    const typeSelect = document.getElementById('manual-trx-type');
    if (typeSelect) {
        typeSelect.addEventListener('change', function() {
            const valEl = document.getElementById('manual-trx-category-val');
            const displayEl = document.getElementById('manual-trx-category-display');
            if (valEl && displayEl) {
                valEl.value = "Lainnya";
                displayEl.innerText = "Lainnya";
                displayEl.classList.add('text-white', 'font-bold');
                displayEl.classList.remove('text-[var(--text-muted)]');
            }
        });
    }
});

window.populateWalletDropdowns = function(dropdownId, selectedId = null) {
    const selectEl = document.getElementById(dropdownId);
    if (!selectEl) return;
    
    const wallets = AuraState.data.wallets || {};
    const walletKeys = Object.keys(wallets);
    
    if (walletKeys.length === 0) {
        selectEl.innerHTML = '<option value="">(Belum Ada Dompet - Buat di Settings)</option>';
        return;
    }
    
    let html = '';
    walletKeys.forEach(key => {
        const w = wallets[key];
        const isSelected = selectedId === key ? 'selected' : '';
        const symbol = w.type === 'cashless' ? '💳' : '💵';
        html += "<option value='" + key + "' " + isSelected + ">" + symbol + " " + AuraUtils.escapeHtml(w.name) + "</option>";
    });
    
    selectEl.innerHTML = html;
};

// ============================================================================
// FITUR MUTASI SALDO & MIGRASI LAWAS DENGAN VALIDASI
// ============================================================================
window.openTransferModal = function() {
    const sourceSelect = document.getElementById('transfer-source');
    const destSelect = document.getElementById('transfer-dest');
    if (!sourceSelect || !destSelect) return;

    const wallets = AuraState.data.wallets || {};
    let optionsHtml = '';

    optionsHtml += '<option value="legacy_cash">📦 Dana Fisik Lawas (Tunai)</option>';
    optionsHtml += '<option value="legacy_cashless">💳 Rekening Lawas (Cashless)</option>';

    Object.keys(wallets).forEach(key => {
        const w = wallets[key];
        const symbol = w.type === 'cashless' ? '💳' : '💵';
        optionsHtml += "<option value='" + key + "'>" + symbol + " " + AuraUtils.escapeHtml(w.name) + "</option>";
    });

    sourceSelect.innerHTML = optionsHtml;
    destSelect.innerHTML = optionsHtml;
    
    document.getElementById('transfer-amount').value = '';
    
    if(typeof window.showModal === 'function') window.showModal('modal-transfer');
};

window.executeTransfer = async function() {
    const sourceId = document.getElementById('transfer-source').value;
    const destId = document.getElementById('transfer-dest').value;
    const amountEl = document.getElementById('transfer-amount');
    const amount = parseFloat(amountEl.value);

    if (sourceId === destId) {
        if (window.showToast) window.showToast("Sumber dan Tujuan tidak boleh sama!", true);
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        if (window.showToast) window.showToast("Nominal transfer tidak valid!", true);
        return;
    }

    const wallets = AuraState.data.wallets || {};

    let sourceName = ""; let sourceType = "cashless"; let realSourceWalletId = null;
    if (sourceId === 'legacy_cash') { sourceName = "Dana Fisik Lawas"; sourceType = "tunai"; }
    else if (sourceId === 'legacy_cashless') { sourceName = "Rekening Lawas"; sourceType = "cashless"; }
    else { sourceName = wallets[sourceId].name; sourceType = wallets[sourceId].type; realSourceWalletId = sourceId; }

    let destName = ""; let destType = "cashless"; let realDestWalletId = null;
    if (destId === 'legacy_cash') { destName = "Dana Fisik Lawas"; destType = "tunai"; }
    else if (destId === 'legacy_cashless') { destName = "Rekening Lawas"; destType = "cashless"; }
    else { destName = wallets[destId].name; destType = wallets[destId].type; realDestWalletId = destId; }

    if (realSourceWalletId) {
        let currentBalance = 0;
        const allTx = AuraState.data.transactions || [];
        
        for (let i = 0; i < allTx.length; i++) {
            const trx = allTx[i];
            if (trx.wallet_id === realSourceWalletId) {
                const val = AuraUtils.convertCurrency(trx.nominal || 0, trx.mata_uang || 'JPY');
                const feeVal = AuraUtils.convertCurrency(Number(trx.admin_fee || 0), trx.mata_uang || 'JPY');
                
                let tTipe = trx.tipe;
                if (tTipe !== 'mutasi_keluar' && tTipe !== 'mutasi_masuk') {
                    if (trx.merchantName && trx.merchantName.indexOf('Mutasi ke ') === 0) tTipe = 'mutasi_keluar';
                    if (trx.merchantName && trx.merchantName.indexOf('Mutasi dari ') === 0) tTipe = 'mutasi_masuk';
                }

                if (tTipe === 'pemasukan' || tTipe === 'mutasi_masuk') currentBalance += val;
                else if (tTipe === 'pengeluaran' || tTipe === 'mutasi_keluar') currentBalance -= val;
                else if (tTipe === 'tarik_tunai' || tTipe === 'setor_tunai') currentBalance -= (val + feeVal);
            }
        }

        if (currentBalance < amount) {
            const formattedBalance = window.formatAuraCurrency ? window.formatAuraCurrency(currentBalance) : currentBalance;
            if (window.showToast) window.showToast("Ditolak! Saldo " + sourceName + " tidak cukup (Sisa: " + formattedBalance + ").", true);
            return; 
        }
    }

    const formattedAmount = window.formatAuraCurrency ? window.formatAuraCurrency(amount) : amount;
    const confirmMsg = "Konfirmasi Mutasi Saldo:<br><br>" +
        "Dari: <b class='text-rose-400'>" + sourceName + "</b><br>" +
        "Ke: <b class='text-emerald-400'>" + destName + "</b><br>" +
        "Total: <b class='text-white font-mono'>" + formattedAmount + "</b><br><br>" +
        "Lanjutkan pemindahan dana?";
    
    const isConfirmed = await window.AuraConfirm(confirmMsg);
    if (!isConfirmed) return; 

    if(typeof window.setProcessingStatus === 'function') window.setProcessingStatus(true);

    try {
        const activeCurr = AuraState.system?.displayCurrency || 'JPY';
        const nowIso = new Date().toISOString();
        const dateStr = nowIso.split('T')[0];

        const idKeluar = AuraUtils.generateId('trx');
        const trxKeluar = {
            id: idKeluar,
            merchantName: "Mutasi ke " + destName,
            storeName: "Mutasi Keluar",
            tanggal: dateStr,
            createdAt: nowIso,
            nominal: amount,
            mata_uang: activeCurr,
            wallet_id: realSourceWalletId,
            metode_pembayaran: sourceType,
            tipe: 'mutasi_keluar', 
            kategori: 'Lainnya',
            description: "Memindahkan dana ke " + destName,
            isCustomDescription: true,
            is_deleted: false,
            items: [{
                itemId: AuraUtils.generateId('itm'),
                nama_barang: 'Transfer Keluar',
                harga: amount,
                qty: 1,
                kategori_barang: 'Lainnya',
                tax_rate: 0,
                paymentMethod: sourceType,
                timestamp: nowIso
            }]
        };

        const idMasuk = AuraUtils.generateId('trx');
        const nowIso2 = new Date(Date.now() + 1000).toISOString(); 
        const trxMasuk = {
            id: idMasuk,
            merchantName: "Mutasi dari " + sourceName,
            storeName: "Mutasi Masuk",
            tanggal: dateStr,
            createdAt: nowIso2,
            nominal: amount,
            mata_uang: activeCurr,
            wallet_id: realDestWalletId,
            metode_pembayaran: destType,
            tipe: 'mutasi_masuk', 
            kategori: 'Lainnya',
            description: "Menerima dana dari " + sourceName,
            isCustomDescription: true,
            is_deleted: false,
            items: [{
                itemId: AuraUtils.generateId('itm'),
                nama_barang: 'Transfer Masuk',
                harga: amount,
                qty: 1,
                kategori_barang: 'Lainnya',
                tax_rate: 0,
                paymentMethod: destType,
                timestamp: nowIso2
            }]
        };

        await FirebaseService.saveTransaction(trxKeluar, true); 
        await FirebaseService.saveTransaction(trxMasuk, false);

        if (typeof window.closeModal === 'function') window.closeModal('modal-transfer');
        if (window.showToast) window.showToast("Mutasi saldo berhasil dieksekusi!");

    } catch (e) {
        console.error(e);
        if (window.showToast) window.showToast("Gagal mengeksekusi mutasi saldo.", true);
    } finally {
        if(typeof window.setProcessingStatus === 'function') window.setProcessingStatus(false);
    }
};

window.openManualTrxModal = function() {
    const valEl = document.getElementById('manual-trx-category-val');
    const displayEl = document.getElementById('manual-trx-category-display');
    if (valEl && displayEl) {
        valEl.value = "Lainnya";
        displayEl.innerText = "Lainnya";
        displayEl.classList.add('text-white', 'font-bold');
        displayEl.classList.remove('text-[var(--text-muted)]');
    }

    window.populateWalletDropdowns('manual-trx-wallet');

    if (typeof window.showModal === 'function') {
        window.showModal('modal-manual-trx');
    }
};

window.saveManualTransaction = async function() {
    const storeInput = document.getElementById('manual-trx-store');
    const typeInput = document.getElementById('manual-trx-type');
    const walletInput = document.getElementById('manual-trx-wallet'); 
    const currInput = document.getElementById('manual-trx-curr');
    const amtInput = document.getElementById('manual-trx-amount');
    const catInput = document.getElementById('manual-trx-category-val');

    if (!storeInput || !amtInput) return;
    
    const store = storeInput.value.trim();
    const type = typeInput ? typeInput.value : 'pengeluaran';
    const walletId = walletInput ? walletInput.value : null; 
    const currency = currInput ? currInput.value : 'JPY';
    const amount = parseFloat(amtInput.value);
    const category = (catInput && catInput.value.trim() !== '') ? catInput.value : 'Lainnya';

    if (!store) {
        if (window.showToast) window.showToast("Nama toko/merchant wajib diisi!", true);
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        if (window.showToast) window.showToast("Nominal harus berupa angka dan lebih dari 0!", true);
        return;
    }
    if (!walletId) {
        if (window.showToast) window.showToast("Pilih Dompet Sumber terlebih dahulu!", true);
        return;
    }
    
    const walletType = AuraState.data.wallets[walletId]?.type || 'cashless';

    const timestamp = new Date().toISOString();
    const data = {
        merchantName: store,
        storeName: store,
        tanggal: timestamp.split('T')[0],
        createdAt: timestamp,
        nominal: amount,
        mata_uang: currency,
        wallet_id: walletId,           
        metode_pembayaran: walletType, 
        tipe: type,
        kategori: category,
        description: "Manual input: " + store,
        isCustomDescription: true,
        is_deleted: false,
        items: [{
            itemId: AuraUtils.generateId('itm'),
            nama_barang: store,
            harga: amount,
            qty: 1,
            kategori_barang: category,
            tax_rate: 0,
            paymentMethod: walletType,
            timestamp: timestamp
        }]
    };

    try {
        await FirebaseService.saveTransaction(data, false);
        if (typeof window.closeModal === 'function') window.closeModal('modal-manual-trx');
        if (window.showToast) window.showToast("✅ Transaksi manual berhasil disimpan ke dompet!");
        
        storeInput.value = '';
        amtInput.value = '';
    } catch (e) {
        if (window.showToast) window.showToast("❌ Gagal menyimpan transaksi manual.", true);
    }
};

window.openEditTrxModal = function(id) {
    const transactions = AuraState.data.transactions || [];
    let sourceTrx = null;
    
    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].id === id) {
            sourceTrx = transactions[i];
            break;
        }
    }
     
    if (!sourceTrx) return;
    const trx = JSON.parse(JSON.stringify(sourceTrx));
    AuraState.temp.editTrxTargetData = trx.id;

    window.populateWalletDropdowns('edit-global-wallet', trx.wallet_id);

    AuraUtils.safeDOM('edit-global-store', el => el.value = AuraUtils.escapeHtml(trx.merchantName || trx.storeName || trx.kategori || ''));
    AuraUtils.safeDOM('edit-global-curr', el => el.value = trx.mata_uang || 'JPY');
    AuraUtils.safeDOM('edit-global-nominal', el => el.value = trx.nominal || 0);
    AuraUtils.safeDOM('edit-global-type', el => el.value = trx.tipe || 'pengeluaran');
    AuraUtils.safeDOM('edit-global-desc', el => el.value = AuraUtils.escapeHtml(trx.description || trx.catatan_ai || ''));
    
    if (typeof window.showModal === 'function') window.showModal('modal-edit-trx');
};

window.saveEditTrx = async function() {
    if (!AuraState.temp.editTrxTargetData) return;
    
    const trxId = AuraState.temp.editTrxTargetData;
    const storeEl = document.getElementById('edit-global-store');
    const currEl = document.getElementById('edit-global-curr');
    const walletEl = document.getElementById('edit-global-wallet'); 
    const nominalEl = document.getElementById('edit-global-nominal');
    const typeEl = document.getElementById('edit-global-type');
    const descEl = document.getElementById('edit-global-desc');

    const storeName = storeEl ? storeEl.value.trim() : ''; 
    const curr = currEl ? currEl.value : 'JPY';
    const walletId = walletEl ? walletEl.value : null; 
    const nominal = nominalEl ? parseFloat(nominalEl.value) : 0;
    const tipe = typeEl ? typeEl.value : 'pengeluaran'; 
    const desc = descEl ? descEl.value.trim() : '';

    if (isNaN(nominal) || nominal < 0) {
        if (window.showToast) window.showToast("Nominal tidak boleh negatif atau kosong!", true);
        return;
    }

    const walletType = AuraState.data.wallets[walletId]?.type || 'cashless';

    const updates = { 
        merchantName: storeName, 
        storeName: storeName, 
        mata_uang: curr, 
        wallet_id: walletId, 
        metode_pembayaran: walletType, 
        nominal: nominal, 
        tipe: tipe 
    };

    if (desc) { 
        updates.description = desc; 
        updates.catatan_ai = desc; 
        updates.isCustomDescription = true;
    }

    try { 
        await FirebaseService.updateTransaction(trxId, updates);
        if (typeof window.closeModal === 'function') window.closeModal('modal-edit-trx');
        if (window.showToast) window.showToast("Perubahan Induk Transaksi Berhasil Disimpan!");
    } catch(e) { 
        if (window.showToast) window.showToast("Gagal mengupdate induk transaksi.", true);
    }
};

window.openAddItemModal = function(trxId) {
    AuraState.temp.addItemTargetTrxId = trxId;
    AuraUtils.safeDOM('add-item-name', el => el.value = "");
    AuraUtils.safeDOM('add-item-qty', el => el.value = "1");
    AuraUtils.safeDOM('add-item-price', el => el.value = "");
    
    AuraUtils.safeDOM('add-item-cat', el => {
        el.value = "Lainnya";
        const dEl = document.getElementById('add-item-cat-display');
        if(dEl) { 
            dEl.innerText = "Lainnya"; 
            dEl.classList.add('text-white', 'font-bold'); 
            dEl.classList.remove('text-[var(--text-muted)]'); 
        }
    });

    if (typeof window.showModal === 'function') window.showModal('modal-add-item');
};

window.saveAddItem = async function() {
    if (!AuraState.temp.addItemTargetTrxId) return;
    
    const transactions = AuraState.data.transactions || [];
    let trx = null;
    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].id === AuraState.temp.addItemTargetTrxId) {
            trx = transactions[i];
            break;
        }
    }
    
    if (!trx) return;
    
    const nameEl = document.getElementById('add-item-name');
    const qtyEl = document.getElementById('add-item-qty');
    const priceEl = document.getElementById('add-item-price');
    const catEl = document.getElementById('add-item-cat');
    
    const name = nameEl ? nameEl.value.trim() || "Item Baru" : "Item Baru";
    const qty = qtyEl ? parseFloat(qtyEl.value) || 1 : 1;
    const price = priceEl ? parseFloat(priceEl.value) : NaN;

    if (isNaN(price) || price < 0) {
        if (window.showToast) window.showToast("Harga satuan tidak valid!", true);
        return;
    }
    
    const category = catEl ? catEl.value || 'Lainnya' : 'Lainnya';

    const newItem = { 
        itemId: AuraUtils.generateId('itm'), 
        nama_barang: name, 
        harga: price, 
        qty: qty, 
        kategori_barang: category, 
        tax_rate: 0, 
        paymentMethod: trx.metode_pembayaran, 
        timestamp: new Date().toISOString() 
    };

    const finalItems = (trx.items || []).concat([newItem]);
    
    let newTotalSum = 0;
    for (let i = 0; i < finalItems.length; i++) {
        newTotalSum += (finalItems[i].harga * (finalItems[i].qty || 1));
    }

    const upd = { items: finalItems, nominal: newTotalSum };
    if (!trx.isCustomDescription) { 
        upd.description = "[Auto-Update] Transaksi diubah. Total terbaru: " + AuraUtils.formatCurrency(newTotalSum) + ".";
        upd.catatan_ai = upd.description; 
    }

    try { 
        await FirebaseService.updateTransaction(trx.id, upd);
        if (typeof window.closeModal === 'function') window.closeModal('modal-add-item');
        if (window.showToast) window.showToast("Item berhasil ditambahkan ke keranjang struk!");
    } catch(e) { 
        if (window.showToast) window.showToast("Gagal menambah item.", true);
    }
};

window.openEditItem = function(trxId, itemId) {
    const transactions = AuraState.data.transactions || [];
    let trx = null;
    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].id === trxId) {
            trx = transactions[i];
            break;
        }
    }
    
    if (!trx || !trx.items) return;
    
    const safeItemId = itemId || 'no_id_fallback';
    let item = null;
    for (let i = 0; i < trx.items.length; i++) {
        if ((trx.items[i].itemId || '') === safeItemId) {
            item = trx.items[i];
            break;
        }
    }
    
    if (!item) return;

    AuraState.temp.editItemTargetData = { 
        id: trxId, 
        itemId: safeItemId, 
        item: JSON.parse(JSON.stringify(item)) 
    };

    AuraUtils.safeDOM('edit-store-name', el => el.value = AuraUtils.escapeHtml(trx.merchantName || trx.storeName || ''));
    AuraUtils.safeDOM('edit-item-name', el => el.value = AuraUtils.escapeHtml(item.nama_barang || ''));
    AuraUtils.safeDOM('edit-item-qty', el => el.value = item.qty || 1);
    AuraUtils.safeDOM('edit-item-price', el => el.value = item.harga || 0);
    
    AuraUtils.safeDOM('edit-item-cat', el => {
        el.value = item.kategori_barang || 'Lainnya';
        const dEl = document.getElementById('edit-item-cat-display');
        if(dEl) { 
            dEl.innerText = el.value; 
            dEl.classList.add('text-white', 'font-bold'); 
            dEl.classList.remove('text-[var(--text-muted)]'); 
        }
    });
    
    if (typeof window.showModal === 'function') window.showModal('modal-edit-item');
};

window.saveEditItem = async function() {
    if (!AuraState.temp.editItemTargetData) return;
    
    const transactions = AuraState.data.transactions || [];
    let trx = null;
    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].id === AuraState.temp.editItemTargetData.id) {
            trx = transactions[i];
            break;
        }
    }
    
    if (trx) {
        const storeEl = document.getElementById('edit-store-name');
        const nameEl = document.getElementById('edit-item-name');
        const qtyEl = document.getElementById('edit-item-qty');
        const priceEl = document.getElementById('edit-item-price');
        const catEl = document.getElementById('edit-item-cat');

        const storeNameVal = storeEl ? storeEl.value.trim() : '';
        const newName = nameEl ? nameEl.value.trim() : '';
        const newQty = qtyEl ? parseFloat(qtyEl.value) || 1 : 1;
        const newPrice = priceEl ? parseFloat(priceEl.value) : NaN;

        if (isNaN(newPrice) || newPrice < 0 || isNaN(newQty) || newQty <= 0) {
            if (window.showToast) window.showToast("Input kuantitas atau harga tidak valid!", true);
            return;
        }

        const newCategory = catEl ? catEl.value : 'Lainnya';
        const targetItemId = AuraState.temp.editItemTargetData.itemId;
        
        const nItems = [];
        let sum = 0;
        
        for (let i = 0; i < trx.items.length; i++) {
            let it = trx.items[i];
            if (it.itemId === targetItemId || (!it.itemId && targetItemId === 'no_id_fallback')) {
                it = { 
                    ...it, 
                    nama_barang: newName || it.nama_barang, 
                    qty: newQty, 
                    harga: newPrice, 
                    kategori_barang: newCategory || it.kategori_barang 
                };
            }
            nItems.push(it);
            sum += (it.harga * (it.qty || 1));
        }

        const upd = { 
            items: nItems, 
            nominal: sum, 
            merchantName: storeNameVal || trx.merchantName || trx.storeName, 
            storeName: storeNameVal || trx.storeName || trx.kategori 
        };

        if (!trx.isCustomDescription) { 
            upd.description = "[Auto-Update] Item disesuaikan. Total terbaru: " + AuraUtils.formatCurrency(sum) + "."; 
            upd.catatan_ai = upd.description; 
        }
        
        try {
            await FirebaseService.updateTransaction(trx.id, upd);
            if (typeof window.closeModal === 'function') window.closeModal('modal-edit-item');
            if (window.showToast) window.showToast("Item dalam keranjang struk berhasil diperbarui!");
        } catch(e) {
            if (window.showToast) window.showToast("Gagal memodifikasi item.", true);
        }
    }
};

window.confirmDelTrx = function(id) { 
    const transactions = AuraState.data.transactions || [];
    let trx = null;
    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].id === id) {
            trx = transactions[i];
            break;
        }
    }
    
    if (!trx) return;
    AuraState.temp.deleteTarget = { type: 'trx', id: id, name: trx.kategori };
    
    AuraUtils.safeDOM('confirm-msg', el => {
        el.innerText = "Lemparkan arsip struk \"" + AuraUtils.escapeHtml(trx.merchantName || trx.storeName || trx.kategori) + "\" ke dalam Tempat Sampah?";
    });
    
    if (typeof window.showModal === 'function') window.showModal('modal-confirm'); 
};

window.confirmDelItem = function(trxId, itemId) { 
    const transactions = AuraState.data.transactions || [];
    let trx = null;
    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].id === trxId) {
            trx = transactions[i];
            break;
        }
    }
    
    if (!trx || !trx.items) return;
    
    const safeItemId = itemId || 'no_id_fallback'; 
    let item = null;
    for (let i = 0; i < trx.items.length; i++) {
        if ((trx.items[i].itemId || '') === safeItemId) {
            item = trx.items[i];
            break;
        }
    }
    
    if (!item) return;

    AuraState.temp.deleteTarget = { 
        type: 'item', 
        id: trxId, 
        name: item.nama_barang, 
        itemId: safeItemId 
    };
    
    AuraUtils.safeDOM('confirm-msg', el => {
        el.innerText = "Hapus item parsial \"" + AuraUtils.escapeHtml(item.nama_barang) + "\" dari keranjang struk ini?";
    });
    
    if (typeof window.showModal === 'function') window.showModal('modal-confirm'); 
};

window.restoreTransaction = async function(id) { 
    try {
        await FirebaseService.updateTransaction(id, { is_deleted: false, deletedAt: null });
        if (window.showToast) window.showToast("Arsip direstorasi dari pembuangan.");
    } catch(e) {
        if (window.showToast) window.showToast("Gagal merestorasi.", true);
    }
};

window.deleteForever = async function(id) { 
    try {
        await FirebaseService.deleteTransactionPermanently(id);
        if (window.showToast) window.showToast("Materi dihapus permanen dan musnah dari cloud.");
    } catch(e) {
        if (window.showToast) window.showToast("Gagal musnahkan materi.", true);
    }
};
