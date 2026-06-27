/**
 * AI Staging Area (Versi Ultimate - In-Modal Tax Action UI)
 * Mengelola hasil ekstraksi AI, rendering UI Staging dengan Kategori Dinamis & Banner Pajak In-Line.
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
        
        const systemPrompt = `Kamu adalah Sistem Analisis Finansial AuraFi OS. Nama User: ${nickname}. Mata Uang: ${activeCurrency}.
FOKUS UTAMA: Ekstrak JSON mentah berdasarkan teks OCR struk.

ATURAN MUTLAK (ANGKA & ITEM):
1. JANGAN PERNAH menghapus atau menggabungkan baris item. Ekstrak SEMUA baris di struk.
2. TERJEMAHKAN "nama_barang" ke dalam Bahasa Indonesia yang singkat, rapi, dan BEBAS TYPO.
3. JANGAN MELAKUKAN MATEMATIKA KOMPLEKS PADA HARGA. Salin angka "harga" PERSIS seperti nominal yang tertulis di sebelah nama barang di struk.
4. PENANGANAN PAJAK BAWAH STRUK (Uchizei vs Sotozei):
   - Jika struk menggunakan "Pajak Termasuk" (Uchizei) dimana harga barang sudah berisikan pajak, isi "admin_fee": 0.
   - Jika struk menggunakan "Pajak Terpisah" (Sotozei) dimana pajak ditambahkan di akhir, jumlahkan total pajak tersebut dan masukkan ke "admin_fee".
   - CARA CEK SILANG: Pastikan (Total Harga Item + admin_fee) SAMA PERSIS dengan Grand Total di struk. Jika melebihi, berarti Uchizei, jadikan admin_fee 0.
5. Indikator persentase pajak (misal 8 atau 10) di sebelah barang, cukup masukkan ke "tax_rate". Jika tidak ada, isi 0.

ATURAN KATEGORI (ORGANIK):
1. Referensi kategori aplikasi nyata: "${categoryListStr}".
2. Cocokkan barang secara logis dengan daftar di atas.
3. Jika tidak ada yang cocok di referensi, kamu BEBAS menciptakan nama kategori baru yang sangat akurat.

ATURAN LAIN:
- Tipe wajib antara: "pemasukan", "pengeluaran", "tarik_tunai", "setor_tunai".
- "merchantName" wajib diisi sesuai nama toko di struk, TETAPI WAJIB diubah ke huruf Alfabet/Latin (Romaji). Jika struk menggunakan huruf Jepang (Katakana/Kanji/Hiragana seperti アルゾ), transkripsikan menjadi huruf Latin (misal: ALZO).

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
        
        // HAPUS AuraAlert yang bentrok. Langsung render dan buka modal Staging!
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
    
    const allCats = CategoryManager.getAllCategories();
    let catOptionsHtml = '';
    Object.values(allCats).forEach(c => {
        catOptionsHtml += `<option value="${AuraUtils.escapeHtml(c.name)}"></option>`;
    });
    
    const itemsContainer = document.getElementById('staging-items-container');
    let totalNominal = 0;
    
    if (itemsContainer) {
        let compiledItemsHtml = '';
        
        // ====================================================================
        // BANNER PAJAK IN-LINE (Menggantikan Pop-Up Alert)
        // ====================================================================
        if (data.admin_fee > 0) {
            compiledItemsHtml += `
            <div class="bg-amber-950/40 border border-amber-500/50 rounded-xl p-3 mb-4 shadow-lg">
                <div class="flex flex-col gap-2">
                    <div class="flex items-center gap-2">
                        <div class="bg-amber-500/20 text-amber-400 p-1.5 rounded-lg">
                            <i class="fa-solid fa-receipt text-sm"></i>
                        </div>
                        <div>
                            <h4 class="text-xs font-bold text-amber-400">Pajak Terpisah (¥${data.admin_fee})</h4>
                            <p class="text-[9px] text-amber-200/70">Pilih bagaimana pajak ini dicatat:</p>
                        </div>
                    </div>
                    <div class="flex gap-2 mt-1">
                        <button onclick="window.actionDistributeTax()" class="flex-1 bg-amber-500 text-amber-950 text-[10px] font-bold py-2 rounded-lg hover:bg-amber-400 transition active:scale-95 shadow-lg">
                            <i class="fa-solid fa-code-merge mr-1"></i> Leburkan ke Item
                        </button>
                        <button onclick="window.actionTaxToItem()" class="flex-1 bg-black/40 border border-amber-500/50 text-amber-400 text-[10px] font-bold py-2 rounded-lg hover:bg-amber-900/40 transition active:scale-95">
                            <i class="fa-solid fa-plus mr-1"></i> Jadikan Item Tersendiri
                        </button>
                    </div>
                </div>
            </div>`;
        }

        if (data.items.length === 0) {
            compiledItemsHtml += '<p class="text-xs text-[var(--text-muted)] text-center italic my-4">Keranjang kosong.</p>';
        } else {
            for (let idx = 0; idx < data.items.length; idx++) {
                const it = data.items[idx];
                const numHarga = Number(it.harga) || 0;
                const numQty = Number(it.qty) || 1;
                totalNominal += (numHarga * numQty);
                const safeName = AuraUtils.escapeHtml(it.nama_barang);
                const safeKategori = it.kategori_barang ? it.kategori_barang.replace(/"/g, '&quot;') : "Lainnya";
                
                compiledItemsHtml += `
                <div class="glass-panel p-3 relative group border-l-2 border-l-accent mb-3">
                    <button onclick="window.removeStagingItem(${idx})" class="absolute top-2 right-2 text-[var(--color-expense)] hover:text-rose-400 p-1 bg-black/40 rounded-full w-6 h-6 flex items-center justify-center z-10 transition-colors">
                        <i class="fa-solid fa-trash text-[10px]"></i>
                    </button>
                    <div class="pr-6 space-y-3">
                        <input type="text" value="${safeName}" onchange="window.updateStagingItem(${idx}, 'nama_barang', this.value)" class="bg-transparent border-b border-[var(--border-glass)] w-full text-sm outline-none text-white pb-1 font-medium focus:border-accent transition-colors" placeholder="Nama Barang">
                        
                        <div class="grid grid-cols-12 gap-2 items-end">
                            <div class="col-span-2">
                                <span class="text-[8px] text-[var(--text-muted)] block mb-1 font-bold tracking-wider">QTY</span>
                                <input type="number" value="${numQty}" onchange="window.updateStagingItem(${idx}, 'qty', this.value)" class="bg-black/40 rounded-lg p-2 w-full text-xs outline-none border border-[var(--border-glass)] text-center font-mono focus:border-blue-400 transition-colors">
                            </div>
                            
                            <div class="col-span-4">
                                <span class="text-[8px] text-[var(--text-muted)] block mb-1 font-bold tracking-wider">HARGA</span>
                                <input type="number" value="${numHarga}" onchange="window.updateStagingItem(${idx}, 'harga', this.value)" class="bg-black/40 rounded-lg p-2 w-full text-xs outline-none border border-[var(--border-glass)] font-mono focus:border-blue-400 transition-colors">
                            </div>

                            <div class="col-span-2">
                                <span class="text-[8px] text-rose-400/80 block mb-1 font-bold tracking-wider">TAX(%)</span>
                                <input type="number" value="${it.tax_rate || 0}" onchange="window.updateStagingItem(${idx}, 'tax_rate', this.value)" class="bg-rose-950/30 rounded-lg p-2 w-full text-xs outline-none border border-rose-900/50 text-center font-mono focus:border-rose-400 transition-colors text-rose-300">
                            </div>

                            <div class="col-span-4">
                                <span class="text-[8px] text-emerald-400/80 block mb-1 font-bold tracking-wider">KATEGORI (AI)</span>
                                <input type="text" list="kategori-list-${idx}" value="${safeKategori}" onchange="window.updateStagingItem(${idx}, 'kategori_barang', this.value)" class="bg-black/40 rounded-lg p-2 w-full text-[10px] outline-none border border-[var(--border-glass)] focus:border-emerald-400 transition-colors placeholder-slate-600" placeholder="Ketik/Pilih">
                                <datalist id="kategori-list-${idx}">
                                    ${catOptionsHtml}
                                </datalist>
                            </div>
                        </div>
                    </div>
                </div>`;
            }
        }
        itemsContainer.innerHTML = compiledItemsHtml;
    }
    
    totalNominal += Number(data.admin_fee || 0);
    AuraUtils.safeDOM('staging-total-display', el => el.innerText = AuraUtils.formatCurrency(totalNominal));
};

// ============================================================================
// FUNGSI AKSI PAJAK IN-LINE
// ============================================================================

window.actionDistributeTax = function() {
    const data = AuraState.temp.aiStaging;
    if (!data || data.admin_fee <= 0) return;

    data.items.forEach(item => {
        const hargaOri = Number(item.harga) || 0;
        const taxRate = Number(item.tax_rate) || 0;
        
        if (taxRate > 0) {
            const pajakItem = Math.round(hargaOri * (taxRate / 100));
            item.harga = hargaOri + pajakItem; // Meleburkan pajak ke harga item
        }
    });
    
    data.admin_fee = 0; // Nol-kan agar banner hilang & tidak hitung ganda
    if (typeof window.renderStagingUI === 'function') window.renderStagingUI();
    if (window.showToast) window.showToast("Pajak berhasil dileburkan ke harga masing-masing barang.");
};

window.actionTaxToItem = function() {
    const data = AuraState.temp.aiStaging;
    if (!data || data.admin_fee <= 0) return;

    // Tambahkan pajak sebagai item baru bernama "Pajak Struk (Tax)"
    data.items.push({ 
        itemId: AuraUtils.generateId('tax'), 
        nama_barang: "Pajak Struk (Tax)", 
        harga: data.admin_fee, 
        qty: 1, 
        kategori_barang: "Lainnya", 
        tax_rate: 0, 
        paymentMethod: data.metode_pembayaran, 
        timestamp: new Date().toISOString() 
    });
    
    data.admin_fee = 0; // Nol-kan agar banner hilang & tidak hitung ganda
    if (typeof window.renderStagingUI === 'function') window.renderStagingUI();
    if (window.showToast) window.showToast("Pajak telah dicatat sebagai item tersendiri.");
};

// ============================================================================
// FUNGSI UTILITAS STAGING
// ============================================================================

window.updateStagingItem = function(index, field, value) {
    const stagingData = AuraState.temp.aiStaging;
    if (!stagingData || !stagingData.items[index]) return;
    
    if (field === 'harga' || field === 'qty' || field === 'tax_rate') {
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
        if (!stagingData.items[i].kategori_barang) {
            stagingData.items[i].kategori_barang = "Lainnya";
        }
    }
    
    stagingData.nominal = finalSum + Number(stagingData.admin_fee || 0); 
    stagingData.createdAt = new Date().toISOString();
    stagingData.is_deleted = false;

    try {
        await FirebaseService.saveTransaction(stagingData, true);
        if (typeof window.closeModal === 'function') window.closeModal('modal-ai-staging');
        
        AuraState.temp.aiStaging = null;
        if (window.showToast) window.showToast("Berkas Staging Area dikonfirmasi ke server Cloud!");
    } catch(e) { 
        if (window.showToast) window.showToast("Gagal merekam perbelanjaan.", true);
    }
};
