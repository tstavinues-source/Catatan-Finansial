/**
 * AI Staging Area
 * Mengelola hasil ekstraksi AI (Parsing JSON), rendering UI Staging, dan penyimpanan ke database.
 * TELAH DI-UPGRADE DENGAN SISTEM KATEGORI DINAMIS (AI ORGANIK)
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
        
        // Kita hanya menjadikan list kategori sebagai referensi, bukan kewajiban mutlak
        const categoryListStr = CategoryManager.getCategoryStringList();
        
        const systemPrompt = `Kamu adalah Sistem Analisis Finansial AuraFi OS tingkat lanjut. Nama User: ${nickname}. Mata Uang: ${activeCurrency}.
FOKUS UTAMA: Analisis detail dan ekstrak JSON murni.
ALUR LOGIKA:
1. Pahami bahasa struk (misal: Jepang), terjemahkan nama barang ke Bahasa Indonesia yang masuk akal.
2. Tentukan Tipe: "tarik_tunai", "setor_tunai", "pemasukan", atau "pengeluaran".
3. 'nominal' = sum(harga x qty) + admin_fee.
4. KATEGORI BARANG: Gunakan kategori yang paling spesifik dan tepat (misal: "Bahan Makanan", "Camilan", "Kebutuhan Mandi"). 
   Referensi kategori yang sudah ada: "${categoryListStr}". JIKA barang tersebut tidak cocok dengan referensi, CIPTAKAN nama kategori baru yang sangat akurat.
5. merchantName wajib diisi sesuai nama toko di struk.
Struktur Output Target (HANYA JSON MURNI TANPA BACKTICKS):
{
    "merchantName": "string", 
    "tanggal": "YYYY-MM-DD", 
    "mata_uang": "string", 
    "metode_pembayaran": "tunai/cashless", 
    "tipe": "pemasukan/pengeluaran/tarik_tunai/setor_tunai", 
    "admin_fee": number, 
    "description": "string", 
    "items": [
        {
            "nama_barang": "string", 
            "harga": number, 
            "qty": number, 
            "kategori_barang": "string", 
            "tax_rate": number
        }
    ]
}`;
        const userContent = `Catat transaksi ini secara detail dan akurat: "${text || "Proses foto terlampir"}" (Mata Uang ${activeCurrency}).`;
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
        if (window.showToast) window.showToast("Selesai diproses! Silakan verifikasi.");

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
    
    // Persiapan Opsi Datalist
    const allCats = CategoryManager.getAllCategories();
    let catOptionsHtml = '';
    Object.values(allCats).forEach(c => catOptionsHtml += `<option value="${c.name}">`);
    
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
                // Mengamankan string kategori dari bentrok tanda kutip
                const safeKategori = it.kategori_barang ? it.kategori_barang.replace(/"/g, '&quot;') : "Lainnya";
                
                compiledItemsHtml += `
                <div class="glass-panel p-3 relative group border-l-2 border-l-accent mb-3">
                    <button onclick="window.removeStagingItem(${idx})" class="absolute top-2 right-2 text-[var(--color-expense)] hover:text-rose-400 p-1 bg-black/40 rounded-full w-6 h-6 flex items-center justify-center z-10 transition-colors">
                        <i class="fa-solid fa-trash text-[10px]"></i>
                    </button>
                    <div class="pr-6 space-y-3">
                        <input type="text" value="${safeName}" onchange="window.updateStagingItem(${idx}, 'nama_barang', this.value)" class="bg-transparent border-b border-[var(--border-glass)] w-full text-sm outline-none text-white pb-1 font-medium focus:border-accent transition-colors" placeholder="Nama Barang">
                        
                        <div class="grid grid-cols-12 gap-2 items-end">
                            <div class="col-span-3">
                                <span class="text-[9px] text-[var(--text-muted)] block mb-1 font-bold tracking-wider">QTY</span>
                                <input type="number" value="${numQty}" onchange="window.updateStagingItem(${idx}, 'qty', this.value)" class="bg-black/40 rounded-lg p-2 w-full text-xs outline-none border border-[var(--border-glass)] text-center font-mono focus:border-blue-400 transition-colors">
                            </div>
                            <div class="col-span-5">
                                <span class="text-[9px] text-[var(--text-muted)] block mb-1 font-bold tracking-wider">HARGA SATUAN</span>
                                <input type="number" value="${numHarga}" onchange="window.updateStagingItem(${idx}, 'harga', this.value)" class="bg-black/40 rounded-lg p-2 w-full text-xs outline-none border border-[var(--border-glass)] font-mono focus:border-blue-400 transition-colors">
                            </div>
                            <div class="col-span-4">
                                <span class="text-[9px] text-[var(--text-muted)] block mb-1 font-bold tracking-wider text-emerald-400">KATEGORI (AI)</span>
                                
                                <input type="text" list="kategori-list-${idx}" value="${safeKategori}" onchange="window.updateStagingItem(${idx}, 'kategori_barang', this.value)" class="bg-black/40 rounded-lg p-2 w-full text-[10px] outline-none border border-[var(--border-glass)] focus:border-emerald-400 transition-colors placeholder-slate-600" placeholder="Ketik/Pilih">
                                <datalist id="kategori-list-${idx}">
                                    ${catOptionsHtml}
                                </datalist>
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
        stagingData.items[index][field] = value.trim();
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
        nama_barang: "Item Baru", 
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
        
        // Pastikan kategori yang baru diciptakan tersimpan dengan baik
        if (!stagingData.items[i].kategori_barang) {
            stagingData.items[i].kategori_barang = "Lainnya";
        }
    }
    
    stagingData.nominal = finalSum + Number(stagingData.admin_fee || 0); 
    stagingData.createdAt = new Date().toISOString();
    stagingData.is_deleted = false;

    try {
        // Karena kategori bisa baru, serahkan penyimpanannya ke database
        await FirebaseService.saveTransaction(stagingData, true);
        if (typeof window.closeModal === 'function') window.closeModal('modal-ai-staging');
        
        AuraState.temp.aiStaging = null;
        if (window.showToast) window.showToast("Berkas Staging Area dikonfirmasi ke server Cloud!");
    } catch(e) { 
        if (window.showToast) window.showToast("Gagal merekam perbelanjaan.", true);
    }
};
