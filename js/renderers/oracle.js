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

window.processOracleChat = async function(text, base64Img = null) {
    if (!AuraState.user.uid) return;
    
    if (isChatProcessing) { 
        if (window.showToast) window.showToast("Oracle masih memproses antrean chat lain...", true);
        return; 
    }
    
    isChatProcessing = true;
    const uiText = text || (base64Img ? "[File Lampiran Visual]" : "");
    const sanitizedUiText = AuraUtils.escapeHtml(uiText);
    
    // --- PERBAIKAN 1: Tampilkan chat user ke layar secara instan ---
    if (!AuraState.data.oracleChats) AuraState.data.oracleChats = [];
    AuraState.data.oracleChats.push({ 
        role: 'user', text: sanitizedUiText, timestamp: new Date().toISOString() 
    });
    window.renderOracleChats();
    
    if (typeof window.setProcessingStatus === 'function') window.setProcessingStatus(true);

    // --- PERBAIKAN 2: Hilangkan 'await' agar tidak hang jika sinyal jelek ---
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

        const promptConfigs = window.getOraclePromptConfigs();
        const categoryListStr = CategoryManager.getCategoryStringList();
        
        const systemPrompt = `Kamu adalah AuraFi Oracle V3. Kepribadian: ${promptConfigs.personaStr}. Nama Tuan: ${nickname}.
Konteks Keuangan: ${summaryString}\nData: ${txString}\n
ATURAN UPDATE (DILARANG MERUSAK ARRAY):
KATEGORI ITEM: "${categoryListStr}".
action: none|moveToTrash|update_transaction|add_item|edit_item|delete_item
target_item_id WAJIB JIKA EDIT/DELETE ITEM.
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
        
        // --- MENGKEMBALIKAN FITUR MEMORY ORIGINAL MILIKMU ---
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
        
        if (resJson.action !== 'none' && resJson.target_id) { 
            try {
                const targetTrx = AuraState.data.transactions.find(t => t.id === resJson.target_id);
                if (targetTrx) {
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
                }
            } catch(e) { 
                resJson.reply += " (Gagal memodifikasi data via Oracle.)";
            }
        }

        const escapedReply = AuraUtils.escapeHtml(resJson.reply);
        
        // --- PERBAIKAN 3: Tampilkan balasan AI ke layar secara instan ---
        AuraState.data.oracleChats.push({ 
            role: 'ai', text: escapedReply, timestamp: new Date().toISOString() 
        });
        window.renderOracleChats();

        // --- PERBAIKAN 4: Hilangkan 'await' ---
        FirebaseService.pushOracleChat({ 
            role: 'ai', text: escapedReply, timestamp: new Date().toISOString() 
        }).catch(e => console.warn(e));

    } catch(e) { 
        const errMsg = `Gangguan transmisi: ${e.message}`;
        
        // Tampilkan error ke layar
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
        window.renderOracleChats();
    }
};

window.renderOracleChats = function() {
    AuraUtils.safeDOM('oracle-chat-box', function(el) {
        if (!AuraState.data.oracleChats || AuraState.data.oracleChats.length === 0) {
            el.innerHTML = `
            <div class="text-center text-[var(--text-muted)] p-8">
                <i class="fa-solid fa-comment-dots text-3xl mb-3 block opacity-30"></i>
                Belum ada percakapan. Mulai chat dengan Oracle!
            </div>`;
            return;
        }
        
        let chatsHtml = '';
        for (let i = 0; i < AuraState.data.oracleChats.length; i++) {
            const c = AuraState.data.oracleChats[i];
            let htmlFormat = AuraUtils.escapeHtml(c.text).replace(/\n/g, '<br/>');
            const alignment = c.role === 'user' ? 'justify-end' : 'justify-start';
            const bubbleStyle = c.role === 'user' ? 'bubble-user text-white shadow-md' : 'bubble-ai glass-panel markdown-content';
            
            // Perbaikan tampilan: Menambahkan mb-3 agar antar chat ada jarak
            chatsHtml += `
            <div class="flex ${alignment} mb-3">
                <div class="p-3.5 rounded-2xl text-xs max-w-[85%] ${bubbleStyle} leading-relaxed shadow-sm">
                    ${htmlFormat}
                </div>
            </div>`;
        }
        
        el.innerHTML = chatsHtml;
        if (AuraState.system.isProcessing && AuraState.system.activeView === 'oracle') {
            el.innerHTML += `
            <div class="flex justify-start mb-3">
                <div class="bubble-ai glass-panel p-3 rounded-2xl flex gap-1 items-center">
                    <div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce"></div>
                    <div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce delay-100"></div>
                    <div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce delay-200"></div>
                </div>
            </div>`;
        }
        
        if (AuraState.system.activeView === 'oracle') {
            setTimeout(() => { 
                AuraUtils.safeDOM('chat-anchor', anc => anc.scrollIntoView({ behavior: 'smooth' })); 
            }, 50);
        }
    });
};

// --- PERBAIKAN 5: Mencegah layar hitam saat pertama kali buka ---
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if(typeof window.renderOracleChats === 'function') window.renderOracleChats();
    }, 1500);
});
