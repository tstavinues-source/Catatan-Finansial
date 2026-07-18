/**
 * Data Import & Export Handlers
 * Menangani konversi data ke format CSV untuk diunduh, serta parsing file CSV/JSON untuk pemulihan data.
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';
import { APP_CONFIG } from '../config/constants.js';
import { FirebaseService } from '../services/firebase.js';
import { Logger } from '../core/logger.js';
import { push, ref } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// ============================================================================
// EKSPOR DATA (DOWNLOAD CSV)
// ============================================================================

window.downloadCSV = function() {
    let csv = "Tanggal,Waktu_Dibuat,Merchant,Tipe,Metode,Kategori,Nominal_Asli,Mata_Uang,Detail_Item,Deskripsi\n";
    const periodRange = AuraUtils.getPeriodRange();
    const fSearch = AuraState.filters.search.toLowerCase();
    const fCat = AuraState.filters.category;
    const fUser = AuraState.filters.user;
    const baseList = AuraState.data.transactions || [];
    const dataToExport = [];

    for (let i = 0; i < baseList.length; i++) {
        const trx = baseList[i];
        const trxTime = new Date(trx.tanggal || trx.createdAt).getTime();
        
        if (trxTime < periodRange.start || trxTime > periodRange.end) continue;
        
        if (fSearch) {
            const desc = (trx.description || trx.catatan_ai || "").toLowerCase();
            const merch = (trx.merchantName || trx.storeName || "").toLowerCase();
            let itemMatch = false;
            if (trx.items && Array.isArray(trx.items)) {
                for (let j = 0; j < trx.items.length; j++) {
                    if (trx.items[j].nama_barang.toLowerCase().includes(fSearch)) {
                        itemMatch = true;
                        break;
                    }
                }
            }
            if (!desc.includes(fSearch) && !merch.includes(fSearch) && !itemMatch) continue;
        }
        
        if (fCat !== 'ALL') {
            const mainCatMatch = (trx.kategori === fCat);
            let itemCatMatch = false;
            if (trx.items && Array.isArray(trx.items)) {
                for (let j = 0; j < trx.items.length; j++) {
                    if (trx.items[j].kategori_barang === fCat) {
                        itemCatMatch = true;
                        break;
                    }
                }
            }
            if (!mainCatMatch && !itemCatMatch) continue;
        }
        
        if (fUser !== 'ALL') {
            if (trx.user_id && trx.user_id !== fUser) continue;
        }
        
        dataToExport.push(trx);
    }

    const cleanCSVField = function(val) {
        if (val === undefined || val === null) return "";
        let strVal = String(val).replace(/"/g, '""');
        if (strVal.startsWith('=') || strVal.startsWith('+') || strVal.startsWith('-') || strVal.startsWith('@')) {
            strVal = "'" + strVal;
        }
        return `"${strVal}"`;
    };

    for (let i = 0; i < dataToExport.length; i++) {
        const r = dataToExport[i];
        const d = r.tanggal ? r.tanggal.split('T')[0] : ''; 
        const created = r.createdAt || ''; 
        
        let itemsStr = '-';
        if (r.items && Array.isArray(r.items)) {
            let innerMap = [];
            for (let j = 0; j < r.items.length; j++) {
                const itm = r.items[j];
                innerMap.push(`${itm.nama_barang} (${itm.qty} x ${itm.harga}) [${itm.kategori_barang}]`);
            }
            itemsStr = innerMap.join(' | ');
        }
        
        const note = r.description || r.catatan_ai || ''; 
        const store = r.merchantName || r.storeName || r.kategori || 'Toko Default';
        
        csv += `${cleanCSVField(d)},${cleanCSVField(created)},${cleanCSVField(store)},${cleanCSVField(r.tipe)},${cleanCSVField(r.metode_pembayaran)},${cleanCSVField(r.kategori)},${cleanCSVField(r.nominal)},${cleanCSVField(r.mata_uang)},${cleanCSVField(itemsStr)},${cleanCSVField(note)}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.href = url;
    link.download = `AuraFi_Ledger_Report_Secured_${new Date().toISOString().split('T')[0]}.csv`; 
    
    document.body.appendChild(link); 
    link.click();
    
    setTimeout(function() {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
    
    if (window.showToast) window.showToast(`Berhasil membundel log sejumlah ${dataToExport.length} ke dalam Format CSV!`);
};

// ============================================================================
// IMPOR DATA (RESTORASI DARI JSON/CSV)
// ============================================================================

window.processFileImport = async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // MENGGUNAKAN AURA CONFIRM BARU
    const isConfirmed = await window.AuraConfirm("Peringatan: Melakukan pemaksaan impor data berpotensi menduplikasi entri jika data tersebut sudah ada di Cloud. Tetap Lanjutkan?");

    if (isConfirmed) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const contents = e.target.result;
            try {
                let parsedTransactions = [];
                if (file.name.endsWith('.json')) {
                    parsedTransactions = JSON.parse(contents);
                    if (!Array.isArray(parsedTransactions)) {
                        throw new Error("Akar objek JSON harus berupa kumpulan Array Transaksi.");
                    }
                } else if (file.name.endsWith('.csv')) {
                    const lines = contents.split('\n');
                    for (let i = 1; i < lines.length; i++) {
                        if (!lines[i].trim()) continue;
                        
                        const cols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || []; 
                        let nominalRaw = parseFloat(cols[6]?.replace(/["']/g, '')) || 0;
                        
                        parsedTransactions.push({
                            tanggal: cols[0]?.replace(/["']/g, '') || new Date().toISOString().split('T')[0],
                            createdAt: cols[1]?.replace(/["']/g, '') || new Date().toISOString(),
                            merchantName: cols[2]?.replace(/["']/g, '') || "Imported Merchant",
                            tipe: cols[3]?.replace(/["']/g, '') || "pengeluaran",
                            metode_pembayaran: cols[4]?.replace(/["']/g, '') || "cashless",
                            kategori: cols[5]?.replace(/["']/g, '') || "Lainnya",
                            nominal: nominalRaw,
                            mata_uang: cols[7]?.replace(/["']/g, '') || "JPY",
                            description: "[IMPORTED] " + (cols[9]?.replace(/["']/g, '') || ""),
                            is_deleted: false,
                            items: [{
                                itemId: AuraUtils.generateId('itm'),
                                nama_barang: cols[2]?.replace(/["']/g, '') || "Barang Impor",
                                harga: nominalRaw,
                                qty: 1,
                                kategori_barang: cols[5]?.replace(/["']/g, '') || "Lainnya"
                            }]
                        });
                    }
                }
                
                if (parsedTransactions.length === 0) {
                    if (window.showToast) window.showToast("Data file kosong atau tidak valid", true);
                    return;
                }
                
                if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(true);
                
                let importSuccessCount = 0;
                
                for(let i = 0; i < parsedTransactions.length; i++) {
                    const data = parsedTransactions[i];
                    data.user_id = AuraState.data.settings?.profile?.nickname || "Imported User";
                    // PERBAIKAN: sebelumnya transaksi hasil import ditulis LANGSUNG ke
                    // Firebase tanpa lewat _autoRegisterToVault (satu-satunya jalur yang
                    // dipakai input manual/AI/staging) — jadi kategori dari data yang
                    // diimpor tidak pernah terdaftar di customCategories, dan dropdown
                    // kategori/ikon di Dashboard & Analytics tidak mengenalinya.
                    // (Sengaja tidak memakai FirebaseService.saveTransaction() penuh di
                    // sini agar tidak membuat satu entri audit log per baris — ringkasan
                    // "DATA.IMPORT" di bawah sudah cukup mewakili.)
                    await FirebaseService._autoRegisterToVault(data);
                    data.nominal = Math.max(0, Number(data.nominal) || 0);
                    if (!data.createdAt) data.createdAt = new Date().toISOString();
                    await push(ref(AuraState.instances.db, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/transactions`), data);
                    importSuccessCount++;
                }
                
                FirebaseService.saveAuditLog("DATA.IMPORT", `Impor massal ${importSuccessCount} transaksi dari arsip eksternal ${file.name}.`);
                if (window.showToast) window.showToast(`Berhasil merestorasi ${importSuccessCount} arsip transaksi dari ${file.name}.`);
                
                if (typeof window.closeModal === 'function') window.closeModal('modal-import-data');
                
            } catch (err) {
                Logger.error('Import', 'Parsing gagal', err);
                if (window.showToast) window.showToast("Gagalan parsing: Struktur file rusak atau melanggar format protokol.", true);
            } finally {
                if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(false);
                event.target.value = '';
            }
        };
        
        reader.readAsText(file);
    } else {
        event.target.value = '';
    }
};
