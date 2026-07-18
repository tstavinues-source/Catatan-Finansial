/**
 * AI Staging Area (Versi Ultimate - Strict Category, Auto-Wallet Predictor & Tax Strategy)
 * [UPDATE: Pelatihan AI untuk mendeteksi Pajak/VAT/消費税 ke dalam admin_fee]
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
        
        const hariIni = new Date();
        const localDateStr = hariIni.toLocaleDateString('en-CA'); 
        const localTimeStr = hariIni.toTimeString().substring(0, 5);

        // ========================================================================
        // SUNTIKAN KECERDASAN PAJAK (TAX INSTRUCTION UPDATE)
        // ========================================================================
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

ATURAN PAJAK (TAX) - WAJIB DIIKUTI:
1. Harga pada "items" ("harga") harus diisi dengan harga SEBELUM PAJAK (Harga Netto).
2. Jika pada struk terdapat total pajak (Tax / VAT / 消費税), MASUKKAN NOMINAL TOTAL PAJAK tersebut ke parameter "admin_fee" di root JSON!
3. Masukkan persentase pajaknya ke dalam "tax_rate" di setiap item (misal: 8 atau 10).

ATURAN KATEGORI (HARGA MATI):
1. INI ADALAH DAFTAR KATEGORI ABSOLUT: "${categoryListStr}".
2. KAMU DILARANG KERAS MENCIPTAKAN NAMA KATEGORI BARU ATAU MENGUBAH HURUF BESAR/KECILNYA. 
3. KAMU WAJIB MEMILIH SALAH SATU NAMA PERSIS SEPERTI DI ATAS. Jika tidak ada yang cocok, gunakan "Lainnya".
4. Jika user "tarik tunai" atau "setor tunai", isikan kategori_barang dengan "Lainnya".

Struktur Output Target JSON MURNI:
{
    "merchantName": "string", 
    "tanggal": "YYYY-MM-DD", 
    "jam": "HH:MM",
    "mata_uang": "string", 
    "metode_pembayaran": "tunai/cashless", 
    "tipe": "pengeluaran/pemasukan/tarik_tunai/setor_tunai", 
    "admin_fee": number, // ISI DENGAN TOTAL PAJAK/TAX (JIKA ADA)
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

        // PENYAPU (SANITIZER) KATEGORI
        const allCats = CategoryManager.getAllCategories();
        const validCategoryNames = Object.values(allCats).map(c => c.name);
        const validCategoryNamesLower = validCategoryNames.map(name => name.toLowerCase());

        if (jsonResult.items && Array.isArray(jsonResult.items)) {
            jsonResult.items.forEach(item => {
                let aiCat = (item.kategori_barang || "Lainnya").trim();
                let idx = validCategoryNamesLower.indexOf(aiCat.toLowerCase());
                if (idx !== -1) {
                    item.kategori_barang = validCategoryNames[idx];
                } else {
                    item.kategori_barang = "Lainnya";
                }
            });
        }

        // AUTO-PREDICT DOMPET BERDASARKAN HASIL SCAN AI
        let predictedWalletId = "";
        const wallets = AuraState.data.wallets || {};
        const walletKeys = Object.keys(wallets);
        if (walletKeys.length > 0) {
            const fallbackType = jsonResult.metode_pembayaran === 'tunai' ? 'tunai' : 'cashless';
            const matchedWallet = walletKeys.find(k => wallets[k].type === fallbackType);
            predictedWalletId = matchedWallet ? matchedWallet : walletKeys[0];
        }

        const timestamp = new Date().toISOString();
        AuraState.temp.aiStaging = {
            items: AuraUtils.sanitizeItemsArray(jsonResult.items, jsonResult.metode_pembayaran, timestamp),
            merchantName: jsonResult.merchantName || "Toko/Merchant",
            tanggal: jsonResult.tanggal || localDateStr,
            jam: jsonResult.jam || localTimeStr, 
            mata_uang: jsonResult.mata_uang || activeCurrency,
            metode_pembayaran: jsonResult.metode_pembayaran || 'cashless',
            wallet_id: predictedWalletId, 
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
    
    if (typeof window.populateWalletDropdowns === 'function') {
        window.populateWalletDropdowns('staging-trx-wallet', data.wallet_id);
    }
    
    // MANAJEMEN UI PAJAK (TAX HANDLING)
    const taxSection = document.getElementById('staging-tax-section');
    const taxAmountEl = document.getElementById('staging-tax-amount');
    
    if (data.admin_fee > 0) {
        if (taxSection) taxSection.classList.remove('hidden');
        if (taxAmountEl) taxAmountEl.innerText = window.formatAuraCurrency ? window.formatAuraCurrency(data.admin_fee) : data.admin_fee;
    } else {
        if (taxSection) taxSection.classList.add('hidden');
    }

    // PERBAIKAN: sebelumnya dropdown kategori per-item dibangun dari daftar nama
    // yang FLAT (induk & anak dicampur rata tanpa struktur) — makanya isinya
    // terasa "beda"/acak dibanding picker kategori yang dipakai di form manual.
    // Sekarang dibangun terstruktur per induk (dengan <optgroup>) persis seperti
    // struktur asli di customCategories, supaya nama yang dipilih user PASTI
    // sama persis dengan kategori yang sudah ada (mencegah duplikat saat disimpan).
    const rawCatsForDropdown = AuraState.data.settings?.customCategories || {};
    const catEntries = Object.entries(rawCatsForDropdown).map(([id, c]) => ({ id, ...c }));
    const parentCats = catEntries.filter(c => !c.parentId);
    const childCats = catEntries.filter(c => c.parentId);
    // catArray dipertahankan untuk kompatibilitas pengecekan "foundMatch" di bawah
    const catArray = catEntries.map(c => c.name);
    const itemsContainer = document.getElementById('staging-items-container');
    let totalNominal = 0;
    
    if (itemsContainer) {
        let compiledItemsHtml = '';

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
                let foundMatch = catArray.some(catName => catName.toLowerCase() === safeKategori.toLowerCase());

                if (parentCats.length === 0) {
                    // Fallback kalau vault kategori masih kosong total
                    catArray.forEach(catName => {
                        const isSelected = (catName.toLowerCase() === safeKategori.toLowerCase());
                        selectOptionsHtml += "<option value='" + AuraUtils.escapeHtml(catName) + "' " + (isSelected ? 'selected' : '') + ">" + AuraUtils.escapeHtml(catName) + "</option>";
                    });
                } else {
                    parentCats.forEach(parent => {
                        const isParentSelected = (parent.name.toLowerCase() === safeKategori.toLowerCase());
                        selectOptionsHtml += "<option value='" + AuraUtils.escapeHtml(parent.name) + "' " + (isParentSelected ? 'selected' : '') + ">" + AuraUtils.escapeHtml(parent.name) + "</option>";
                        
                        const mySubs = childCats.filter(c => c.parentId === parent.id);
                        if (mySubs.length > 0) {
                            selectOptionsHtml += "<optgroup label='" + AuraUtils.escapeHtml(parent.name) + "'>";
                            mySubs.forEach(sub => {
                                const isSubSelected = (sub.name.toLowerCase() === safeKategori.toLowerCase());
                                selectOptionsHtml += "<option value='" + AuraUtils.escapeHtml(sub.name) + "' " + (isSubSelected ? 'selected' : '') + ">&nbsp;&nbsp;" + AuraUtils.escapeHtml(sub.name) + "</option>";
                            });
                            selectOptionsHtml += "</optgroup>";
                        }
                    });
                }
                
                if (!foundMatch) {
                    selectOptionsHtml = "<option value='" + AuraUtils.escapeHtml(safeKategori) + "' selected>" + AuraUtils.escapeHtml(safeKategori) + " (AI Baru)</option>" + selectOptionsHtml;
                }
                
                compiledItemsHtml += "<div class='glass-panel p-3 relative group border-l-2 border-l-accent mb-3'>" +
                    "<button onclick='window.removeStagingItem(" + idx + ")' class='absolute top-2 right-2 text-[var(--color-expense)] hover:text-rose-400 p-1 bg-black/40 rounded-full w-6 h-6 flex items-center justify-center z-10 transition-colors'><i class='fa-solid fa-trash text-[10px]'></i></button>" +
                    "<div class='pr-6 space-y-3'>" +
                    "<input type='text' value='" + safeName + "' onchange='window.updateStagingItem(" + idx + ", \"nama_barang\", this.value)' class='bg-transparent border-b border-[var(--border-glass)] w-full text-sm outline-none text-white pb-1 font-medium focus:border-accent' placeholder='Nama Barang'>" +
                    "<div class='grid grid-cols-12 gap-2 items-end'>" +
                    "<div class='col-span-2'><span class='text-[8px] text-[var(--text-muted)] block mb-1 font-bold tracking-wider'>QTY</span><input type='number' value='" + numQty + "' onchange='window.updateStagingItem(" + idx + ", \"qty\", this.value)' class='bg-black/40 rounded-lg p-2 w-full text-xs outline-none border border-[var(--border-glass)] text-center font-mono focus:border-blue-400'></div>" +
                    "<div class='col-span-4'><span class='text-[8px] text-[var(--text-muted)] block mb-1 font-bold tracking-wider'>HARGA</span><input type='number' value='" + numHarga + "' onchange='window.updateStagingItem(" + idx + ", \"harga\", this.value)' class='bg-black/40 rounded-lg p-2 w-full text-xs outline-none border border-[var(--border-glass)] font-mono focus:border-blue-400'></div>" +
                    "<div class='col-span-2'><span class='text-[8px] text-rose-400/80 block mb-1 font-bold tracking-wider'>TAX(%)</span><input type='number' value='" + (it.tax_rate || 0) + "' onchange='window.updateStagingItem(" + idx + ", \"tax_rate\", this.value)' class='bg-rose-950/30 rounded-lg p-2 w-full text-xs outline-none border border-rose-900/50 text-center font-mono text-rose-300'></div>" +
                    "<div class='col-span-4'><span class='text-[8px] text-emerald-400/80 block mb-1 font-bold tracking-wider'>KATEGORI</span><select onchange='window.updateStagingItem(" + idx + ", \"kategori_barang\", this.value)' class='bg-black/40 rounded-lg p-2 w-full text-[10px] outline-none border border-[var(--border-glass)] focus:border-emerald-400 text-white truncate'>" + selectOptionsHtml + "</select></div>" +
                    "</div></div></div>";
            }
        }
        itemsContainer.innerHTML = compiledItemsHtml;
    }
    
    totalNominal += Number(data.admin_fee || 0);
    AuraUtils.safeDOM('staging-total-display', el => el.innerText = window.formatAuraCurrency ? window.formatAuraCurrency(totalNominal) : totalNominal);
};

window.applyTaxStrategy = function(strategy) {
    const data = AuraState.temp.aiStaging;
    if (!data || data.admin_fee <= 0) return;

    if (strategy === 'distribute') {
        const totalPajakAsli = data.admin_fee; 
        let totalPajakDihitung = 0; 
        let itemKenaPajak = [];
        
        data.items.forEach(item => {
            const hargaOri = Number(item.harga) || 0; 
            const taxRate = Number(item.tax_rate) || 0;
            if (taxRate > 0) { 
                const pajakItem = Math.round(hargaOri * (taxRate / 100)); 
                item.tax_amount_temp = pajakItem; 
                totalPajakDihitung += pajakItem; 
                itemKenaPajak.push(item); 
            } else { 
                item.tax_amount_temp = 0; 
            }
        });
        
        const selisih = totalPajakAsli - totalPajakDihitung;
        if (itemKenaPajak.length > 0 && selisih !== 0) itemKenaPajak[0].tax_amount_temp += selisih;
        
        data.items.forEach(item => { 
            if (item.tax_amount_temp > 0) { 
                item.harga = (Number(item.harga) || 0) + item.tax_amount_temp; 
            } 
            delete item.tax_amount_temp; 
        });

    } else if (strategy === 'separate') {
        data.items.push({ 
            itemId: AuraUtils.generateId('itm'), 
            nama_barang: "Pajak Struk (Tax)", 
            harga: data.admin_fee, 
            qty: 1, 
            kategori_barang: "Lainnya", 
            tax_rate: 0, 
            paymentMethod: data.metode_pembayaran, 
            timestamp: new Date().toISOString() 
        });
    }

    data.admin_fee = 0;
    if (typeof window.renderStagingUI === 'function') window.renderStagingUI();
};


window.saveStagingToDatabase = async function() {
    const stagingData = AuraState.temp.aiStaging;
    if (!stagingData) return;
    
    const storeNameEl = document.getElementById('staging-trx-store'); 
    const typeEl = document.getElementById('staging-trx-type');
    const walletEl = document.getElementById('staging-trx-wallet'); 
    const dateEl = document.getElementById('staging-trx-date'); 
    const timeEl = document.getElementById('staging-trx-time'); 
    
    stagingData.merchantName = storeNameEl ? storeNameEl.value.trim() || 'Toko/Merchant' : 'Toko/Merchant'; 
    stagingData.tipe = typeEl ? typeEl.value : 'pengeluaran';
    
    if (walletEl && walletEl.value) {
        stagingData.wallet_id = walletEl.value;
        stagingData.metode_pembayaran = AuraState.data.wallets[walletEl.value]?.type || stagingData.metode_pembayaran;
    } else {
        if (window.showToast) window.showToast("Ditolak! Pilih Dompet Sumber terlebih dahulu.", true);
        return;
    }
    
    let finalDateString = new Date().toISOString(); 
    if (dateEl && timeEl && dateEl.value && timeEl.value) {
        const localDateTime = new Date(dateEl.value + "T" + timeEl.value + ":00");
        if (!isNaN(localDateTime.getTime())) {
            finalDateString = localDateTime.toISOString();
        }
    }
    stagingData.createdAt = finalDateString;
    stagingData.tanggal = dateEl ? dateEl.value : stagingData.tanggal;
    
    let finalSum = 0;
    const catTotals = {}; // PERBAIKAN: lacak total nominal per kategori item
    for (let i = 0; i < stagingData.items.length; i++) { 
        const itemTotal = (Number(stagingData.items[i].harga) || 0) * (Number(stagingData.items[i].qty) || 1);
        finalSum += itemTotal;
        if (!stagingData.items[i].kategori_barang) stagingData.items[i].kategori_barang = "Lainnya";
        
        const cKey = stagingData.items[i].kategori_barang;
        catTotals[cKey] = (catTotals[cKey] || 0) + itemTotal;
    }
    
    // PERBAIKAN: Sebelumnya `stagingData.kategori` (kategori level transaksi) tidak
    // pernah di-update walau user mengganti kategori tiap item di dropdown — jadi
    // tetap memakai tebakan awal AI (sering generik/"Lainnya"). Ini menyebabkan ikon
    // transaksi & filter kategori di Dashboard tidak nyambung dengan isi belanjaan
    // yang sebenarnya, dan membuat _autoRegisterToVault mendaftarkan kategori item
    // sebagai anak dari induk yang salah. Sekarang disinkronkan ke kategori dengan
    // nominal terbesar di antara item-item transaksi ini.
    let dominantCat = null, dominantVal = -1;
    for (const cKey in catTotals) {
        if (catTotals[cKey] > dominantVal) { dominantVal = catTotals[cKey]; dominantCat = cKey; }
    }
    if (dominantCat) stagingData.kategori = dominantCat;
    
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
