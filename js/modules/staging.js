/**
 * AI Staging Area
 * Mengelola hasil ekstraksi AI (Parsing JSON), rendering UI Staging, dan penyimpanan ke database.
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';
import { FirebaseService } from '../services/firebase.js';
import { CategoryManager } from './categories.js';

window.processTransactionParsing = async function(text, imgData = null) {
    if (!AuraState.user.uid) {
        if (window.showToast) window.showToast("Ditolak. Sesi Pengguna Kosong.", true);
        return;
    }
    
    if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(true);
    
    try {
        const activeCurrency = AuraState.system.displayCurrency || 'JPY';
        const profile = AuraState.data.settings?.profile || {};
        const nickname = profile.nickname || profile.fullName || "Tuan/Nyonya";
        const categoryListStr = CategoryManager.getCategoryStringList();
        
        // PROMPT PAMUNGKAS: LOGIKA PAJAK BERSYARAT & AUTO-LEARN KATEGORI
        const systemPrompt = `Kamu adalah Sistem Analisis Finansial AuraFi OS. Nama User: ${nickname}. Mata Uang: ${activeCurrency}.
FOKUS UTAMA: Ekstrak JSON mentah dengan sangat akurat dari struk/teks.

ATURAN KATEGORI (SMART LEARNING):
Prioritaskan memilih "kategori_barang" dari daftar ini: [${categoryListStr}]. 
NAMUN, jika barangnya sangat spesifik, KAMU DIIZINKAN membuat kategori baru (Maksimal 1-2 kata, Contoh: "Camilan", "Produk Daging", "Sayuran", "Bumbu Dapur", dll). Jangan gunakan kata "Lainnya" kecuali benar-benar terpaksa.

ATURAN PAJAK BERSYARAT (SANGAT KRITIKAL!):
Hitung dulu ada berapa jumlah barang di struk ini.
1. JIKA JUMLAH BARANG <= 10 (1 sampai 10 item): 
   Bagikan nilai persen pajak (8% atau 10%) ke harga masing-masing item secara proporsional. Masukkan harga final ini ke field 'harga'.
2. JIKA JUMLAH BARANG > 10 (11 item ke atas): 
   JANGAN membagikan pecahan pajak ke masing-masing item (untuk mencegah timeout). Masukkan harga item SAMA PERSIS dengan harga dasar di struk. LALU, buat item baru secara terpisah di bagian bawah untuk pajaknya (Contoh: nama_barang: "Pajak Konsumsi 8%", harga: nominal_pajaknya).
3. Pengecualian: JIKA total harga barang sudah sama dengan Grand Total (Tax-Inclusive), JANGAN tambahkan/hitung pajak apa pun, tulis harga apa adanya.
4. Total nominal dari semua item di JSON WAJIB sama persis dengan Total Akhir Pembayaran (Grand Total).

ATURAN TRANSLASI:
- Wajib TERJEMAHKAN nama toko (merchantName) dan nama barang (nama_barang) ke BAHASA INDONESIA yang lazim.

Struktur Output Target JSON MURNI:
{
    "merchantName": "string", 
    "tanggal": "YYYY-MM-DD", 
    "mata_uang": "string", 
    "metode_pembayaran": "tunai/cashless", 
    "tipe": "pengeluaran", 
    "admin_fee": 0, 
    "description": "string", 
    "items": [
        {
            "nama_barang": "string", 
            "harga": number, 
            "qty": number, 
            "kategori_barang": "string", 
            "tax_rate": 0
        }
    ]
}`;
        const userContent = `Catat transaksi ini: "${text || "Proses foto terlampir"}" (Mata Uang ${activeCurrency}).`;
        const messages = [ 
            { role: "system", content: systemPrompt }, 
            { role: "user", content: userContent } 
        ];
        
        const aiOutput = await window.executeAIWithFallback(messages, systemPrompt, true, imgData);
        const jsonResult = AuraUtils.parseCleanJSON(aiOutput);

        const timestamp = new Date().toISOString();
        AuraState.temp.aiStaging = {
            items: AuraUtils.sanitizeItemsArray(jsonResult.items, jsonResult.metode_pembayaran, timestamp),
            merchantName: jsonResult.merchantName || jsonResult.storeName || jsonResult.kategori || "Toko/Merchant",
            tanggal: jsonResult.tanggal || timestamp.split('T')[0],
            mata_uang: jsonResult.mata_uang || activeCurrency,
            metode_pembayaran: jsonResult.metode_pembayaran || 'cashless',
            tipe: jsonResult.tipe || 'pengeluaran',
            admin_fee: Number(jsonResult.admin_fee) || 0,
            description: jsonResult.description || 'Ekstraksi AI Staging',
            isCustomDescription: true
        };
        
        if (typeof window.renderStagingUI === 'function') window.renderStagingUI();
        if (typeof window.showModal === 'function') window.showModal('modal-ai-staging');
        if (window.showToast) window.showToast("Selesai diproses! Strategi komputasi pajak disesuaikan otomatis.");

    } catch(e) { 
        if (window.showToast) window.showToast(e.message || "Terdapat anomali AI.", true);
    } finally { 
        if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(false); 
    }
};

window.renderStagingUI = function() {
    const data = AuraState.temp.aiStaging;
    if (!data) return;
    
    AuraUtils.safeDOM('staging-trx-store', el => el.value = data.merchantName);
    AuraUtils.safeDOM('staging-trx-type', el => el.value = data.tipe);
    
    const allCats = CategoryManager.getAllCategories();
    let catOptionsHtml = '';
    Object.values(allCats).forEach(c => catOptionsHtml += `<option value="${c.name}">${c.name}</option>`);
    
    const itemsContainer = document.getElementById('staging-items-container');
    let totalNominal = 0;
    
    if (itemsContainer) {
        if (data.items.length === 0) {
            itemsContainer.innerHTML = '<p class="text-xs text-[var(--text-muted)] text-center italic my-4">Keranjang kosong.</p>';
        } else {
            let compiledItemsHtml = '';
            for (let idx = 0; idx < data.items.length; idx++) {
                const it = data.items[idx];
                const numHarga = Number(it.harga) || 0;
                const numQty = Number(it.qty) || 1;
                totalNominal += (numHarga * numQty);
                const safeName = AuraUtils.escapeHtml(it.nama_barang);
                
                compiledItemsHtml += `
                <div class="glass-panel p-3 relative group border-l-2 border-l-accent mb-2">
                    <button onclick="window.removeStagingItem(${idx})" class="absolute top-2 right-2 text-[var(--color-expense)] hover:text-rose-400 p-1 bg-black/40 rounded-full w-6 h-6 flex items-center justify-center z-10">
                        <i class="fa-solid fa-trash text-[10px]"></i>
                    </button>
                    <div class="pr-6 space-y-2">
                        <input type="text" value="${safeName}" onchange="window.updateStagingItem(${idx}, 'nama_barang', this.value)" class="bg-transparent border-b border-[var(--border-glass)] w-full text-sm outline-none text-white pb-1 font-medium focus:border-accent">
                        <div class="flex gap-2">
                            <div class="w-1/4">
                                <span class="text-[8px] text-[var(--text-muted)] block mb-0.5 font-bold">Qty</span>
                                <input type="number" value="${numQty}" onchange="window.updateStagingItem(${idx}, 'qty', this.value)" class="bg-black/30 rounded-lg p-2 w-full text-xs outline-none border border-[var(--border-glass)] text-center font-mono">
                            </div>
                            <div class="w-2/4">
                                <span class="text-[8px] text-[var(--text-muted)] block mb-0.5 font-bold">Harga Satuan</span>
                                <input type="number" value="${numHarga}" onchange="window.updateStagingItem(${idx}, 'harga', this.value)" class="bg-black/30 rounded-lg p-2 w-full text-xs outline-none border border-[var(--border-glass)] font-mono">
                            </div>
                            <div class="flex-1">
                                <span class="text-[8px] text-[var(--text-muted)] block mb-0.5 font-bold">Kategori</span>
                                <select onchange="window.updateStagingItem(${idx}, 'kategori_barang', this.value)" class="bg-black/30 rounded-lg p-2 w-full text-[10px] outline-none border border-[var(--border-glass)]">
                                    <option value="${it.kategori_barang}" selected>${it.kategori_barang}</option>
                                    ${catOptionsHtml}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>`;
            }
            itemsContainer.innerHTML = compiledItemsHtml;
        }
    }
    
    totalNominal += Number(data.admin_fee || 0);
    AuraUtils.safeDOM('staging-total-display', el => el.innerText = AuraUtils.formatCurrency(totalNominal));
};

window.updateStagingItem = function(index, field, value) {
    const stagingData = AuraState.temp.aiStaging;
    if (!stagingData || !stagingData.items[index]) return;
    
    if (field === 'harga' || field === 'qty') {
        const validatedVal = Number(value);
        stagingData.items[index][field] = isNaN(validatedVal) ? 0 : validatedVal;
    } else { 
        stagingData.items[index][field] = value;
    }
    if (typeof window.renderStagingUI === 'function') window.renderStagingUI();
};

window.removeStagingItem = function(index) {
    if (!AuraState.temp.aiStaging) return;
    AuraState.temp.aiStaging.items.splice(index, 1);
    if (typeof window.renderStagingUI === 'function') window.renderStagingUI();
};

window.addStagingItem = function() {
    if (!AuraState.temp.aiStaging) return;
    AuraState.temp.aiStaging.items.push({ 
        itemId: AuraUtils.generateId('itm'), 
        nama_barang: "Item Tambahan", 
        harga: 0, qty: 1, kategori_barang: "Lainnya", tax_rate: 0, 
        paymentMethod: AuraState.temp.aiStaging.metode_pembayaran, 
        timestamp: new Date().toISOString() 
    });
    if (typeof window.renderStagingUI === 'function') window.renderStagingUI();
};

window.saveStagingToDatabase = async function() {
    const stagingData = AuraState.temp.aiStaging;
    if (!stagingData) return;
    
    const storeNameEl = document.getElementById('staging-trx-store'); 
    const typeEl = document.getElementById('staging-trx-type');
    
    stagingData.merchantName = storeNameEl ? storeNameEl.value.trim() || 'Toko/Merchant' : 'Toko/Merchant'; 
    stagingData.tipe = typeEl ? typeEl.value : 'pengeluaran';
    
    let finalSum = 0;
    for (let i = 0; i < stagingData.items.length; i++) { 
        finalSum += ((Number(stagingData.items[i].harga) || 0) * (Number(stagingData.items[i].qty) || 1));
    }
    
    stagingData.nominal = finalSum + Number(stagingData.admin_fee || 0); 
    stagingData.createdAt = new Date().toISOString();
    stagingData.is_deleted = false;

    try {
        // === PELATUK AUTO-LEARN CATEGORY: BIARKAN SISTEM MEMPELAJARI KATEGORI BARU ===
        if (typeof CategoryManager.autoLearnCategories === 'function') {
            await CategoryManager.autoLearnCategories(stagingData.items);
        }
        
        // Simpan transaksi utamanya ke Firebase
        await FirebaseService.saveTransaction(stagingData, true);
        
        if (typeof window.closeModal === 'function') window.closeModal('modal-ai-staging');
        
        AuraState.temp.aiStaging = null;
        if (window.showToast) window.showToast("Berkas Staging Area dikonfirmasi ke server Cloud!");

        // PELATUK REFRESH MENGGUNAKAN MESIN ASLI
        if (typeof window.loadRealtimeDatabaseData === 'function') window.loadRealtimeDatabaseData();

    } catch(e) { 
        if (window.showToast) window.showToast("Gagal merekam perbelanjaan.", true);
    }
};
