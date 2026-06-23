/**
 * Transactions CRUD Handlers
 * Menangani semua logika input manual, edit transaksi, manajemen keranjang struk, 
 * serta fungsi soft-delete (sampah) dan restorasi.
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';
import { Logger } from '../core/logger.js';
import { FirebaseService } from '../services/firebase.js';
import { CategoryManager } from '../modules/categories.js';

// ============================================================================
// EVENT LISTENER GLOBAL UNTUK CUSTOM PICKER
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    const typeSelect = document.getElementById('manual-trx-type');
    if (typeSelect) {
        // Reset kategori setiap kali jenis transaksi (Pemasukan/Pengeluaran) diubah
        typeSelect.addEventListener('change', function() {
            const valEl = document.getElementById('manual-trx-category-val');
            const displayEl = document.getElementById('manual-trx-category-display');
            if (valEl && displayEl) {
                valEl.value = "";
                displayEl.innerText = "Pilih Kategori...";
                displayEl.classList.add('text-[var(--text-muted)]');
                displayEl.classList.remove('text-accent', 'font-bold');
            }
        });
    }
});

// ============================================================================
// INPUT TRANSAKSI MANUAL UTAMA
// ============================================================================

window.openManualTrxModal = function() {
    if (typeof CategoryManager.renderDropdowns === 'function') {
        CategoryManager.renderDropdowns(); // Untuk select kategori di item-item lain
    }
    
    // Pastikan Custom Picker selalu dalam keadaan kosong/reset saat modal dibuka
    const valEl = document.getElementById('manual-trx-category-val');
    const displayEl = document.getElementById('manual-trx-category-display');
    if (valEl && displayEl) {
        valEl.value = "";
        displayEl.innerText = "Pilih Kategori...";
        displayEl.classList.add('text-[var(--text-muted)]');
        displayEl.classList.remove('text-accent', 'font-bold');
    }

    if (typeof window.showModal === 'function') {
        window.showModal('modal-manual-trx');
    }
};

window.saveManualTransaction = async function() {
    const storeInput = document.getElementById('manual-trx-store');
    const typeInput = document.getElementById('manual-trx-type');
    const methodInput = document.getElementById('manual-trx-method');
    const currInput = document.getElementById('manual-trx-curr');
    const amtInput = document.getElementById('manual-trx-amount');
    
    // PERBAIKAN: Mengambil nilai dari Hidden Input milik Custom Picker
    const catInput = document.getElementById('manual-trx-category-val');

    if (!storeInput || !amtInput) return;
    
    const store = storeInput.value.trim();
    const type = typeInput ? typeInput.value : 'pengeluaran';
    const method = methodInput ? methodInput.value : 'cashless';
    const currency = currInput ? currInput.value : 'JPY';
    const amount = parseFloat(amtInput.value);
    
    // Jika tidak ada kategori yang dipilih, set default ke 'Lainnya'
    const category = (catInput && catInput.value.trim() !== '') ? catInput.value : 'Lainnya';

    if (!store) {
        if (window.showToast) window.showToast("Nama toko/merchant wajib diisi!", true);
        return;
    }
    
    if (isNaN(amount) || amount <= 0) {
        if (window.showToast) window.showToast("Nominal harus berupa angka dan lebih dari 0!", true);
        return;
    }
    
    const timestamp = new Date().toISOString();
    const data = {
        merchantName: store,
        storeName: store,
        tanggal: timestamp.split('T')[0],
        createdAt: timestamp,
        nominal: amount,
        mata_uang: currency,
        metode_pembayaran: method,
        tipe: type,
        kategori: category,
        description: `Manual input: ${store}`,
        isCustomDescription: true,
        is_deleted: false,
        items: [{
            itemId: AuraUtils.generateId('itm'),
            nama_barang: store,
            harga: amount,
            qty: 1,
            kategori_barang: category,
            tax_rate: 0,
            paymentMethod: method,
            timestamp: timestamp
        }]
    };

    try {
        await FirebaseService.saveTransaction(data, false);
        if (typeof window.closeModal === 'function') window.closeModal('modal-manual-trx');
        if (window.showToast) window.showToast("✅ Transaksi manual berhasil disimpan!");
        
        // Reset form setelah simpan
        storeInput.value = '';
        amtInput.value = '';
        if(catInput) catInput.value = '';
    } catch (e) {
        if (window.showToast) window.showToast("❌ Gagal menyimpan transaksi manual.", true);
    }
};

// ============================================================================
// EDIT TRANSAKSI GLOBAL
// ============================================================================

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

    AuraUtils.safeDOM('edit-global-store', el => el.value = AuraUtils.escapeHtml(trx.merchantName || trx.storeName || trx.kategori || ''));
    AuraUtils.safeDOM('edit-global-curr', el => el.value = trx.mata_uang || 'JPY');
    AuraUtils.safeDOM('edit-global-method', el => el.value = trx.metode_pembayaran || 'cashless');
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
    const methodEl = document.getElementById('edit-global-method');
    const nominalEl = document.getElementById('edit-global-nominal');
    const typeEl = document.getElementById('edit-global-type');
    const descEl = document.getElementById('edit-global-desc');

    const storeName = storeEl ? storeEl.value.trim() : ''; 
    const curr = currEl ? currEl.value : 'JPY';
    const method = methodEl ? methodEl.value : 'cashless'; 
    const nominal = nominalEl ? parseFloat(nominalEl.value) : 0;

    if (isNaN(nominal) || nominal < 0) {
        if (window.showToast) window.showToast("Nominal tidak boleh negatif atau kosong!", true);
        return;
    }

    const tipe = typeEl ? typeEl.value : 'pengeluaran'; 
    const desc = descEl ? descEl.value.trim() : '';

    const updates = { 
        merchantName: storeName, 
        storeName: storeName, 
        mata_uang: curr, 
        metode_pembayaran: method, 
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

// ============================================================================
// MANAJEMEN ITEM (KERANJANG STRUK)
// ============================================================================

window.openAddItemModal = function(trxId) {
    AuraState.temp.addItemTargetTrxId = trxId;
    AuraUtils.safeDOM('add-item-name', el => el.value = "");
    AuraUtils.safeDOM('add-item-qty', el => el.value = "1");
    AuraUtils.safeDOM('add-item-price', el => el.value = "");
    
    if (typeof CategoryManager.renderDropdowns === 'function') CategoryManager.renderDropdowns();
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
        upd.description = `[Auto-Update] Transaksi diubah. Total terbaru: ${AuraUtils.formatCurrency(newTotalSum)}.`;
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
    
    if (typeof CategoryManager.renderDropdowns === 'function') CategoryManager.renderDropdowns();
    AuraUtils.safeDOM('edit-item-cat', el => el.value = item.kategori_barang || 'Lainnya');
    
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
            upd.description = `[Auto-Update] Item disesuaikan. Total terbaru: ${AuraUtils.formatCurrency(sum)}.`; 
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

// ============================================================================
// PENGHAPUSAN, SAMPAH & RESTORASI
// ============================================================================

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
        el.innerText = `Lemparkan arsip struk "${AuraUtils.escapeHtml(trx.merchantName || trx.storeName || trx.kategori)}" ke dalam Tempat Sampah?`;
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
        el.innerText = `Hapus item parsial "${AuraUtils.escapeHtml(item.nama_barang)}" dari keranjang struk ini?`;
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
