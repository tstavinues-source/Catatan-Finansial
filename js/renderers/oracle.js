/**
 * Oracle Chat Renderer & Processor
 * Menangani render riwayat chat dan memproses input AI untuk modifikasi otonom.
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';
import { FirebaseService } from '../services/firebase.js';
import { CategoryManager } from '../modules/categories.js';
import { MemoryService, FinancialSummaryService } from '../services/memory.js';

let isChatProcessing = false;

// --- FUNGSI SCROLL OTOMATIS (STANDAR APLIKASI CHAT) ---
window.scrollToBottomOracle = function() {
    AuraUtils.safeDOM('oracle-chat-box', function(el) {
        requestAnimationFrame(() => {
            el.scrollTop = el.scrollHeight;
        });
    });
};

window.processOracleChat = async function(text, base64Img = null) {
    if (!AuraState.user.uid) return;
    
    if (isChatProcessing) { 
        if (window.showToast) window.showToast("Oracle masih memproses antrean chat lain...", true);
        return; 
    }
    
    isChatProcessing = true;
    const uiText = text || (base64Img ? "[File Lampiran Visual]" : "");
    const sanitizedUiText = AuraUtils.escapeHtml(uiText);
    
    if (!AuraState.data.oracleChats) AuraState.data.oracleChats = [];
    AuraState.data.oracleChats.push({ 
        role: 'user', text: sanitizedUiText, timestamp: new Date().toISOString() 
    });
    window.renderOracleChats();
    
    if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(true);

    FirebaseService.pushOracleChat({ 
        role: 'user', text: sanitizedUiText, timestamp: new Date().toISOString() 
    }).catch(e => console.warn("Sinkronisasi chat tertunda"));

    try {
        const summaryString = FinancialSummaryService.getSummaryString();
        const relevantTx = MemoryService.getRelevantTransactions(text);
        const profile = AuraState.data.settings?.profile || {};
        const nickname = profile.nickname || profile.fullName || "Bapak/Ibu";
        
        let txString = "";
        for (let i = 0; i < relevantTx.length; i++) {
            const t = relevantTx[i];
            let itemStr = "";
            if (t.items && Array.isArray(t.items)) {
                const mapStrArr = [];
                for(let j = 0; j < t.items.length; j++) { 
                    mapStrArr.push(`{itemId:"${t.items[j].itemId}", nama:"${t.items[j].nama_barang}", harga:${t.items[j].harga}, qty:${t.items[j].qty}}`);
                }
                itemStr = `| Items:[${mapStrArr.join(', ')}]`;
            }
            txString += `ID:${t.id} | Toko:${t.merchantName || t.storeName || 'Merchant'} | Tipe:${t.tipe} | Ket:${t.description || t.catatan_ai} | Nom:${t.nominal} ${t.mata_uang} ${itemStr}\n`;
        }

        const promptConfigs = window.getOraclePromptConfigs ? window.getOraclePromptConfigs() : { personaStr: "Kombinasi Humble + Jenius", styleStr: "Normal" };
        const categoryListStr = CategoryManager.getCategoryStringList();
        
        const systemPrompt = `Kamu adalah AuraFi Oracle V3. Kepribadian: ${promptConfigs.personaStr}. Nama Tuan: ${nickname}.
Konteks Keuangan: ${summaryString}\nData: ${txString}\n
ATURAN UPDATE (DILARANG MERUSAK ARRAY):
KATEGORI ITEM: "${categoryListStr}".
action: none|moveToTrash|update_transaction|add_item|edit_item|delete_item|create_transaction
target_item_id WAJIB JIKA EDIT/DELETE ITEM.
target_id WAJIB DIISI DAN HARUS PERSIS SAMA DENGAN SALAH SATU "ID:" DI ATAS untuk selain create_transaction.
JANGAN PERNAH memaksakan target_id ke transaksi yang tidak benar-benar cocok hanya supaya ada aksi yang jalan.
Kalau Tuan menyebut BELANJA/PENGELUARAN BARU yang TIDAK merujuk transaksi manapun di atas, pakai action "create_transaction" (target_id boleh kosong), isi update_fields (merchantName, tipe, metode_pembayaran, nominal, wallet_id opsional) dan new_items.
SEMUA aksi (termasuk create_transaction) akan dikonfirmasi dulu ke Tuan sebelum benar-benar disimpan, jadi boleh proaktif menyarankan aksi.
Gaya: ${promptConfigs.styleStr}
JSON MURNI TANPA TAG: 
{
    "reply": "...", 
    "action": "none", 
    "target_id": "", 
    "target_item_id": "", 
    "update_fields": {}, 
    "new_items": []
}`;
        let resJson;
        const messages = [{ role: "system", content: systemPrompt }];
        
        const history = MemoryService.getRelevantChats();
        
        for (let i = 0; i < history.length; i++) {
            if (history[i].text !== sanitizedUiText) { 
                messages.push({ 
                    role: history[i].role === 'ai' ? 'assistant' : 'user', 
                    content: history[i].text 
                });
            }
        }
        
        messages.push({ role: "user", content: text || "Analisa keuanganku." });
        
        const aiOutput = await window.executeAIWithFallback(messages, systemPrompt, true, base64Img);
        resJson = AuraUtils.parseCleanJSON(aiOutput);
        
        // ====================================================================
        // 🛡️ PERBAIKAN KRITIS (KEAMANAN): Sebelumnya blok di bawah ini langsung
        // MENGEKSEKUSI aksi dari AI (moveToTrash/update_transaction/add_item/dst)
        // ke Firebase TANPA konfirmasi user sama sekali. Karena input Oracle bisa
        // datang dari gambar (OCR), ini membuka celah prompt-injection: teks
        // tersembunyi di foto berpotensi memicu aksi destruktif otomatis.
        // Sekarang SEMUA aksi (termasuk fitur baru "create_transaction" untuk
        // mencatat transaksi baru dari chat) WAJIB lewat window.AuraAlert.confirm
        // dulu — eksekusi Firebase hanya terjadi setelah user menekan konfirmasi.
        // ====================================================================
        if (resJson.action && resJson.action !== 'none') {
            try {
                // Sanitasi kategori item dari AI (berlaku untuk semua aksi yang bawa new_items,
                // termasuk create_transaction) — cocokkan ke nama kategori yang SUDAH ADA,
                // kalau tidak ketemu sama sekali baru fallback ke "Lainnya".
                if (resJson.new_items && Array.isArray(resJson.new_items)) {
                    const allCats = CategoryManager.getAllCategories();
                    const validCategoryNames = Object.values(allCats).map(c => c.name);
                    const validCategoryNamesLower = validCategoryNames.map(name => name.toLowerCase());
                    
                    resJson.new_items.forEach(newIt => {
                        if (!newIt || typeof newIt !== 'object') return;
                        let aiCat = (newIt.kategori_barang || "Lainnya").trim();
                        let idx = validCategoryNamesLower.indexOf(aiCat.toLowerCase());
                        newIt.kategori_barang = (idx !== -1) ? validCategoryNames[idx] : "Lainnya";
                    });
                }

                if (resJson.action === 'create_transaction') {
                    // -----------------------------------------------------------
                    // FITUR BARU: mencatat transaksi baru murni dari chat (bukan
                    // menumpang ke transaksi lain yang sudah ada via add_item).
                    // -----------------------------------------------------------
                    const f = resJson.update_fields || {};
                    const nowIso = new Date().toISOString();
                    const sanItems = AuraUtils.sanitizeItemsArray(resJson.new_items || [], f.metode_pembayaran || 'cashless', nowIso);
                    
                    let sum = 0;
                    for (let j = 0; j < sanItems.length; j++) sum += (sanItems[j].harga * (sanItems[j].qty || 1));
                    const finalNominal = sanItems.length > 0 ? sum : (Number(f.nominal) || 0);
                    
                    if (finalNominal > 0) {
                        const newTrxData = {
                            merchantName: f.merchantName || 'Catatan via Oracle',
                            tipe: f.tipe || 'pengeluaran',
                            metode_pembayaran: f.metode_pembayaran || 'cashless',
                            wallet_id: f.wallet_id || '',
                            tanggal: nowIso,
                            mata_uang: AuraState.system.displayCurrency || 'JPY',
                            items: sanItems,
                            nominal: finalNominal,
                            description: `[Dicatat via Oracle Chat]`
                        };
                        
                        const summaryMsg = `Oracle ingin mencatat transaksi baru "${newTrxData.merchantName}" senilai ${AuraUtils.formatCurrency(finalNominal)} (${newTrxData.tipe}). Simpan?`;
                        
                        window.AuraAlert.confirm(summaryMsg, async () => {
                            try {
                                await FirebaseService.saveTransaction(newTrxData, true);
                                if (window.showToast) window.showToast("Transaksi baru dari Oracle berhasil disimpan.");
                            } catch(e) {
                                if (window.showToast) window.showToast("Gagal menyimpan transaksi baru dari Oracle.", true);
                            }
                        });
                    }
                } else if (resJson.target_id) {
                    const targetTrx = AuraState.data.transactions.find(t => t.id === resJson.target_id);
                    if (targetTrx) {
                        const trxLabel = targetTrx.merchantName || targetTrx.storeName || 'transaksi ini';
                        let summaryMsg = `Oracle ingin melakukan perubahan pada "${trxLabel}". Lanjutkan?`;

                        if (resJson.action === 'moveToTrash') {
                            summaryMsg = `Oracle ingin memindahkan "${trxLabel}" (${AuraUtils.formatCurrency(targetTrx.nominal)}) ke Sampah. Lanjutkan?`;
                        } else if (resJson.action === 'update_transaction') {
                            const f = resJson.update_fields || {};
                            const parts = [];
                            if (f.merchantName) parts.push(`nama → "${f.merchantName}"`);
                            if (f.tipe) parts.push(`tipe → "${f.tipe}"`);
                            if (f.metode_pembayaran) parts.push(`metode → "${f.metode_pembayaran}"`);
                            if (f.nominal !== undefined) parts.push(`nominal → ${AuraUtils.formatCurrency(f.nominal)}`);
                            summaryMsg = `Oracle ingin mengubah "${trxLabel}": ${parts.join(', ') || 'tidak ada perubahan terdeteksi'}. Lanjutkan?`;
                        } else if (resJson.action === 'add_item') {
                            const n = (resJson.new_items || []).length;
                            summaryMsg = `Oracle ingin menambahkan ${n} item baru ke "${trxLabel}". Lanjutkan?`;
                        } else if (resJson.action === 'edit_item') {
                            summaryMsg = `Oracle ingin mengubah salah satu item di "${trxLabel}". Lanjutkan?`;
                        } else if (resJson.action === 'delete_item') {
                            summaryMsg = `Oracle ingin menghapus salah satu item dari "${trxLabel}". Lanjutkan?`;
                        }

                        window.AuraAlert.confirm(summaryMsg, async () => {
                            try {
                                if (resJson.action === 'moveToTrash') {
                                    await FirebaseService.moveToTrash(resJson.target_id);
                                } else if (resJson.action === 'update_transaction') {
                                    const updates = {};
                                    if (resJson.update_fields) {
                                        if (resJson.update_fields.merchantName) updates.merchantName = resJson.update_fields.merchantName;
                                        if (resJson.update_fields.metode_pembayaran) updates.metode_pembayaran = resJson.update_fields.metode_pembayaran;
                                        if (resJson.update_fields.tipe) updates.tipe = resJson.update_fields.tipe;
                                        if (resJson.update_fields.nominal !== undefined) updates.nominal = resJson.update_fields.nominal;
                                    }
                                    await FirebaseService.updateTransaction(targetTrx.id, updates);
                                } else if (resJson.action === 'add_item' && resJson.new_items) {
                                    const sanItems = AuraUtils.sanitizeItemsArray(resJson.new_items, targetTrx.metode_pembayaran, new Date().toISOString());
                                    const finalItems = (targetTrx.items || []).concat(sanItems);
                                    let sum = 0;
                                    for (let j = 0; j < finalItems.length; j++) sum += (finalItems[j].harga * (finalItems[j].qty || 1));
                                    const upd = { items: finalItems, nominal: sum };
                                    if (!targetTrx.isCustomDescription) upd.description = `[Koreksi Automatis] Transaksi disuntik AI. Total: ${AuraUtils.formatCurrency(sum)}`;
                                    await FirebaseService.updateTransaction(targetTrx.id, upd);
                                } else if (resJson.action === 'edit_item' && resJson.target_item_id && resJson.new_items && resJson.new_items.length > 0) {
                                    const newEditData = resJson.new_items[0];
                                    const finalItems = (targetTrx.items || []).map(it => {
                                        if(it.itemId === resJson.target_item_id) {
                                            return { 
                                                ...it, 
                                                nama_barang: newEditData.nama_barang || it.nama_barang, 
                                                harga: newEditData.harga !== undefined ? newEditData.harga : it.harga, 
                                                qty: newEditData.qty !== undefined ? newEditData.qty : it.qty, 
                                                kategori_barang: newEditData.kategori_barang || it.kategori_barang 
                                            };
                                        } 
                                        return it;
                                    });
                                    let sum = 0; 
                                    for (let j = 0; j < finalItems.length; j++) sum += (finalItems[j].harga * (finalItems[j].qty || 1));
                                    const upd = { items: finalItems, nominal: sum };
                                    if (!targetTrx.isCustomDescription) upd.description = `[Koreksi Automatis] Parameter item diubah AI. Total: ${AuraUtils.formatCurrency(sum)}`;
                                    await FirebaseService.updateTransaction(targetTrx.id, upd);
                                } else if (resJson.action === 'delete_item' && resJson.target_item_id) {
                                    const finalItems = (targetTrx.items || []).filter(it => it.itemId !== resJson.target_item_id);
                                    if (finalItems.length === 0) { 
                                        await FirebaseService.moveToTrash(targetTrx.id);
                                    } else {
                                        let sum = 0;
                                        for (let j = 0; j < finalItems.length; j++) sum += (finalItems[j].harga * (finalItems[j].qty || 1));
                                        const upd = { items: finalItems, nominal: sum };
                                        if (!targetTrx.isCustomDescription) upd.description = `[Koreksi Automatis] Item digugurkan AI. Total: ${AuraUtils.formatCurrency(sum)}`;
                                        await FirebaseService.updateTransaction(targetTrx.id, upd);
                                    }
                                }
                                if (window.showToast) window.showToast("Perubahan dari Oracle berhasil diterapkan.");
                            } catch(e) {
                                if (window.showToast) window.showToast("Gagal menerapkan perubahan dari Oracle.", true);
                            }
                        });
                    }
                }
            } catch(e) { 
                resJson.reply += " (Oracle mendeteksi masalah saat menyiapkan aksi.)";
            }
        }

        const escapedReply = AuraUtils.escapeHtml(resJson.reply);
        
        AuraState.data.oracleChats.push({ 
            role: 'ai', text: escapedReply, timestamp: new Date().toISOString() 
        });
        window.renderOracleChats();

        FirebaseService.pushOracleChat({ 
            role: 'ai', text: escapedReply, timestamp: new Date().toISOString() 
        }).catch(e => console.warn(e));

    } catch(e) { 
        const errMsg = `Gangguan transmisi: ${e.message}`;
        
        AuraState.data.oracleChats.push({ 
            role: 'ai', text: errMsg, timestamp: new Date().toISOString() 
        });
        window.renderOracleChats();
        
        FirebaseService.pushOracleChat({ 
            role: 'ai', text: errMsg, timestamp: new Date().toISOString() 
        }).catch(e => console.warn(e));
        
    } finally { 
        if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(false);
        isChatProcessing = false;
        window.scrollToBottomOracle(); // Pastikan scroll setelah animasi loading selesai
    }
};

window.renderOracleChats = function() {
    AuraUtils.safeDOM('oracle-chat-box', function(el) {
        if (!AuraState.data.oracleChats || AuraState.data.oracleChats.length === 0) {
            el.innerHTML = `
            <div class="text-center text-[var(--text-muted)] p-8 mt-10">
                <i class="fa-solid fa-comment-dots text-3xl mb-3 block opacity-30"></i>
                <p class="text-xs">Belum ada percakapan.<br>Mulai chat dengan Oracle!</p>
            </div>`;
            return;
        }
        
        let chatsHtml = '';
        for (let i = 0; i < AuraState.data.oracleChats.length; i++) {
            const c = AuraState.data.oracleChats[i];
            let htmlFormat = AuraUtils.escapeHtml(c.text).replace(/\n/g, '<br/>');
            const alignment = c.role === 'user' ? 'justify-end' : 'justify-start';
            const bubbleStyle = c.role === 'user' ? 'bubble-user text-white shadow-md' : 'bubble-ai glass-panel markdown-content';
            
            chatsHtml += `
            <div class="flex ${alignment} mb-4">
                <div class="p-3.5 rounded-2xl text-[13px] max-w-[85%] ${bubbleStyle} leading-relaxed shadow-sm">
                    ${htmlFormat}
                </div>
            </div>`;
        }
        
        el.innerHTML = chatsHtml;
        
        if (AuraState.system.isProcessing && AuraState.system.activeView === 'oracle') {
            el.innerHTML += `
            <div class="flex justify-start mb-4">
                <div class="bubble-ai glass-panel p-3.5 rounded-2xl flex gap-1.5 items-center">
                    <div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce"></div>
                    <div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                    <div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                </div>
            </div>`;
        }
        
        window.scrollToBottomOracle();
    });
};

// --- SENSOR KLIK UNTUK NAVIGASI BAWAH ---
// Memaksa chat scroll ke bawah setiap kali user membuka tab Oracle
document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('.nav-btn');
    if (navBtn && navBtn.dataset.target === 'oracle') {
        setTimeout(() => {
            window.scrollToBottomOracle();
        }, 50); // Menunggu animasi layar pindah selesai
    }
});

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if(typeof window.renderOracleChats === 'function') window.renderOracleChats();
    }, 1500);
});
