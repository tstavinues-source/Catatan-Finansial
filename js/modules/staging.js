/**
 * AI Staging Area (Versi Ultimate - Strict Category, Real Timezone, Native Select, & Cashflow Logic)
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
        
        // AMBIL WAKTU LOKAL
        const hariIni = new Date();
        const localDateStr = hariIni.toLocaleDateString('en-CA'); 
        const localTimeStr = hariIni.toTimeString().substring(0, 5);

        // PROMPT AI - KINI DILENGKAPI PENGETAHUAN TENTANG "TARIK TUNAI"
        const systemPrompt = `Kamu adalah Sistem Analisis Finansial AuraFi OS. Nama User: ${nickname}. Mata Uang: ${activeCurrency}. 
WAKTU SAAT INI: ${localDateStr} ${localTimeStr}.
FOKUS UTAMA: Ekstrak JSON mentah dari hasil analisis.

ATURAN ALIRAN DANA (TIPE TRANSAKSI) - SANGAT PENTING:
WAJIB isi parameter "tipe" dengan salah satu dari 4 opsi ini:
1. "pengeluaran" -> Untuk belanja, bayar tagihan, jajan, dsb.
2. "pemasukan" -> Untuk gaji, profit, dikasih uang, dsb.
3. "tarik_tunai" -> JIKA USER MENARIK/AMBIL UANG DARI ATM (Memindahkan uang dari Bank ke Dompet Fisik).
4. "setor_tunai" -> JIKA USER MENYETOR UANG KE ATM (Memindahkan uang Fisik ke Bank).

ATURAN WAKTU DAN TANGGAL:
- Ekstrak dari teks/struk jika ada. Format: "tanggal": "YYYY-MM-DD", "jam": "HH:MM".
- Jika tidak ada, gunakan waktu saat ini: ${localDateStr} ${localTimeStr}.

ATURAN KATEGORI:
1. INI DAFTAR KATEGORI USER: "${categoryListStr}".
2. KAMU WAJIB MENGGUNAKAN SALAH SATU DARI DAFTAR DI ATAS. 
3. Kelompokkan dengan logis! Jika user "tarik tunai" atau "setor tunai", isikan kategori_barang dengan "Lainnya".

Struktur Output Target JSON MURNI:
{
    "merchantName": "string", 
    "tanggal": "YYYY-MM-DD", 
    "jam": "HH:MM",
    "mata_uang": "string", 
    "metode_pembayaran": "tunai/cashless", 
    "tipe": "pengeluaran/pemasukan/tarik_tunai/setor_tunai", 
    "admin_fee": number, 
    "items": [
        { "nama_barang": "string", "harga": number, "qty": number, "kategori_barang": "string", "tax_rate": number }
    ]
}`;

        const userContent = `Catat transaksi ini: "${text || "Proses foto terlampir"}".`;
        const messages = [ 
            { role: "system", content: systemPrompt }, 
            { role: "user", content: userContent } 
        ];
        
        const aiOutput = await window.executeAIWithFallback(messages, systemPrompt, true, imgData);
        const jsonResult = AuraUtils.parseCleanJSON(aiOutput);

        const timestamp = new Date().toISOString();
        AuraState.temp.aiStaging = {
            items: AuraUtils.sanitizeItemsArray(jsonResult.items, jsonResult.metode_pembayaran, timestamp),
            merchantName: jsonResult.merchantName || "Toko/Merchant",
            tanggal: jsonResult.tanggal || localDateStr,
            jam: jsonResult.jam || localTimeStr, 
            mata_uang: jsonResult.mata_uang || activeCurrency,
            metode_pembayaran: jsonResult.metode_pembayaran || 'cashless',
            tipe: jsonResult.tipe || 'pengeluaran',
            admin_fee: Number(jsonResult.admin_fee) || 0
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
    AuraUtils.safeDOM('staging-trx-date', el => el.value = data.tanggal); 
    AuraUtils.safeDOM('staging-trx-time', el => el.value = data.jam); 
    
    const allCats = CategoryManager.getAllCategories();
    const catArray = Object.values(allCats).map(c => c.name);
    
    const itemsContainer = document.getElementById('staging-items-container');
    let totalNominal = 0;
    
    if (itemsContainer) {
        let compiledItemsHtml = '';
        
        if (data.admin_fee > 0) {
            compiledItemsHtml += `
            <div class="bg-amber-950/40 border border-amber-500/50 rounded-xl p-3 mb-4 shadow-lg">
                <div class="flex flex-col gap-2">
                    <div class="flex items-center gap-2">
                        <div class="bg-amber-500/20 text-amber-400 p-1.5 rounded-lg"><i class="fa-solid fa-receipt text-sm"></i></div>
                        <div>
                            <h4 class="text-xs font-bold text-amber-400">Pajak Terpisah (¥${data.admin_fee})</h4>
                            <p class="text-[9px] text-amber-200/70">Pilih bagaimana pajak ini dicatat:</p>
                        </div>
                    </div>
                    <div class="flex gap-2 mt-1">
                        <button onclick="window.actionDistributeTax()" class="flex-1 bg-amber-500 text-amber-950 text-[10px] font-bold py-2 rounded-lg hover:bg-amber-400">Leburkan ke Item</button>
                        <button onclick="window.actionTaxToItem()" class="flex-1 bg-black/40 border border-amber-500/50 text-amber-400 text-[10px] font-bold py-2 rounded-lg">Jadikan Item</button>
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
                let safeKategori = it.kategori_barang || "Lainnya";
                
                let selectOptionsHtml = '';
                let foundMatch = false;
                catArray.forEach(catName => {
                    const isSelected = (catName.toLowerCase() === safeKategori.toLowerCase());
                    if(isSelected) foundMatch = true;
                    selectOptionsHtml += `<option value="${AuraUtils.escapeHtml(catName)}" ${isSelected ? 'selected' : ''}>${AuraUtils.escapeHtml(catName)}</option>`;
                });
                
                if (!foundMatch) {
                    selectOptionsHtml = `<option value="${AuraUtils.escapeHtml(safeKategori)}" selected>${AuraUtils.escapeHtml(safeKategori)} (AI Baru)</option>` + selectOptionsHtml;
                }
                
                compiledItemsHtml += `
                <div class="glass-panel p-3 relative group border-l-2 border-l-accent mb-3">
                    <button onclick="window.removeStagingItem(${idx})" class="absolute top-2 right-2 text-[var(--color-expense)] hover:text-rose-400 p-1 bg-black/40 rounded-full w-6 h-6 flex items-center justify-center z-10 transition-colors"><i class="fa-solid fa-trash text-[10px]"></i></button>
                    <div class="pr-6 space-y-3">
                        <input type="text" value="${safeName}" onchange="window.updateStagingItem(${idx}, 'nama_barang', this.value)" class="bg-transparent border-b border-[var(--border-glass)] w-full text-sm outline-none text-white pb-1 font-medium focus:border-accent" placeholder="Nama Barang">
                        
                        <div class="grid grid-cols-12 gap-2 items-end">
                            <div class="col-span-2">
                                <span class="text-[8px] text-[var(--text-muted)] block mb-1 font-bold tracking-wider">QTY</span>
                                <input type="number" value="${numQty}" onchange="window.updateStagingItem(${idx}, 'qty', this.value)" class="bg-black/40 rounded-lg p-2 w-full text-xs outline-none border border-[var(--border-glass)] text-center font-mono focus:border-blue-400">
                            </div>
                            <div class="col-span-4">
                                <span class="text-[8px] text-[var(--text-muted)] block mb-1 font-bold tracking-wider">HARGA</span>
                                <input type="number" value="${numHarga}" onchange="window.updateStagingItem(${idx}, 'harga', this.value)" class="bg-black/40 rounded-lg p-2 w-full text-xs outline-none border border-[var(--border-glass)] font-mono focus:border-blue-400">
                            </div>
                            <div class="col-span-2">
                                <span class="text-[8px] text-rose-400/80 block mb-1 font-bold tracking-wider">TAX(%)</span>
                                <input type="number" value="${it.tax_rate || 0}" onchange="window.updateStagingItem(${idx}, 'tax_rate', this.value)" class="bg-rose-950/30 rounded-lg p-2 w-full text-xs outline-none border border-rose-900/50 text-center font-mono text-rose-300">
                            </div>
                            <div class="col-span-4">
                                <span class="text-[8px] text-emerald-400/80 block mb-1 font-bold tracking-wider">KATEGORI</span>
                                <select onchange="window.updateStagingItem(${idx}, 'kategori_barang', this.value)" class="bg-black/40 rounded-lg p-2 w-full text-[10px] outline-none border border-[var(--border-glass)] focus:border-emerald-400 text-white truncate">
                                    ${selectOptionsHtml}
                                </select>
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

window.saveStagingToDatabase = async function() {
    const stagingData = AuraState.temp.aiStaging;
    if (!stagingData) return;
    
    const storeNameEl = document.getElementById('staging-trx-store'); 
    const typeEl = document.getElementById('staging-trx-type');
    const dateEl = document.getElementById('staging-trx-date'); 
    const timeEl = document.getElementById('staging-trx-time'); 
    
    stagingData.merchantName = storeNameEl ? storeNameEl.value.trim() || 'Toko/Merchant' : 'Toko/Merchant'; 
    stagingData.tipe = typeEl ? typeEl.value : 'pengeluaran';
    
    let finalDateString = new Date().toISOString(); 
    if (dateEl && timeEl && dateEl.value && timeEl.value) {
        const localDateTime = new Date(`${dateEl.value}T${timeEl.value}:00`);
        if (!isNaN(localDateTime.getTime())) {
            finalDateString = localDateTime.toISOString();
        }
    }
    stagingData.createdAt = finalDateString;
    stagingData.tanggal = dateEl ? dateEl.value : stagingData.tanggal;
    
    let finalSum = 0;
    for (let i = 0; i < stagingData.items.length; i++) { 
        finalSum += ((Number(stagingData.items[i].harga) || 0) * (Number(stagingData.items[i].qty) || 1));
        if (!stagingData.items[i].kategori_barang) stagingData.items[i].kategori_barang = "Lainnya";
    }
    
    stagingData.nominal = finalSum + Number(stagingData.admin_fee || 0); 
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

window.actionDistributeTax = function() {
    const data = AuraState.temp.aiStaging;
    if (!data || data.admin_fee <= 0) return;
    const totalPajakAsli = data.admin_fee; let totalPajakDihitung = 0; let itemKenaPajak = [];
    data.items.forEach(item => {
        const hargaOri = Number(item.harga) || 0; const taxRate = Number(item.tax_rate) || 0;
        if (taxRate > 0) { const pajakItem = Math.round(hargaOri * (taxRate / 100)); item.tax_amount_temp = pajakItem; totalPajakDihitung += pajakItem; itemKenaPajak.push(item); } else { item.tax_amount_temp = 0; }
    });
    const selisih = totalPajakAsli - totalPajakDihitung;
    if (itemKenaPajak.length > 0 && selisih !== 0) itemKenaPajak[0].tax_amount_temp += selisih;
    data.items.forEach(item => { if (item.tax_amount_temp > 0) { item.harga = (Number(item.harga) || 0) + item.tax_amount_temp; } delete item.tax_amount_temp; });
    data.admin_fee = 0;
    if (typeof window.renderStagingUI === 'function') window.renderStagingUI();
};

window.actionTaxToItem = function() {
    const data = AuraState.temp.aiStaging; if (!data || data.admin_fee <= 0) return;
    data.items.push({ itemId: AuraUtils.generateId('tax'), nama_barang: "Pajak Struk (Tax)", harga: data.admin_fee, qty: 1, kategori_barang: "Lainnya", tax_rate: 0, paymentMethod: data.metode_pembayaran, timestamp: new Date().toISOString() });
    data.admin_fee = 0; if (typeof window.renderStagingUI === 'function') window.renderStagingUI();
};

window.updateStagingItem = function(index, field, value) {
    const stagingData = AuraState.temp.aiStaging; if (!stagingData || !stagingData.items[index]) return;
    if (field === 'harga' || field === 'qty' || field === 'tax_rate') { stagingData.items[index][field] = isNaN(Number(value)) ? 0 : Number(value); } else { stagingData.items[index][field] = value.trim(); }
    if (typeof window.renderStagingUI === 'function') window.renderStagingUI();
};

window.removeStagingItem = function(index) {
    if (!AuraState.temp.aiStaging) return; AuraState.temp.aiStaging.items.splice(index, 1);
    if (typeof window.renderStagingUI === 'function') window.renderStagingUI();
};

window.addStagingItem = function() {
    if (!AuraState.temp.aiStaging) return; AuraState.temp.aiStaging.items.push({ itemId: AuraUtils.generateId('itm'), nama_barang: "Item Baru", harga: 0, qty: 1, kategori_barang: "Lainnya", tax_rate: 0, paymentMethod: AuraState.temp.aiStaging.metode_pembayaran, timestamp: new Date().toISOString() });
    if (typeof window.renderStagingUI === 'function') window.renderStagingUI();
};
