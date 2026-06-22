/**
 * AuraAlert & Confirmation Handler
 * Menggantikan pop-up bawaan browser dengan Custom Modal.
 * Mengelola eksekusi aksi destruktif via Modal Konfirmasi.
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';
import { FirebaseService } from '../services/firebase.js';

// ============================================================================
// 1. ENGINE AURA ALERT (Pengganti alert, confirm, prompt)
// ============================================================================
window.AuraAlert = {
    confirm: function(message, onConfirmCallback) {
        document.getElementById('confirm-msg').innerText = message;
        AuraState.temp.deleteTarget = null; // Kosongkan target transaksi agar tidak bertabrakan
        AuraState.temp.confirmCallback = onConfirmCallback;
        if (typeof window.showModal === 'function') window.showModal('modal-confirm');
    },
    prompt: function(message, placeholder, onConfirmCallback) {
        document.getElementById('prompt-msg').innerText = message;
        const input = document.getElementById('prompt-input');
        if(input) {
            input.placeholder = placeholder || "Ketik jawaban di sini...";
            input.value = "";
        }
        AuraState.temp.promptCallback = onConfirmCallback;
        if (typeof window.showModal === 'function') window.showModal('modal-custom-prompt');
        // Auto-focus ke input box setelah animasi modal selesai
        setTimeout(() => input?.focus(), 300);
    }
};

// ============================================================================
// 2. HANDLER MODAL PROMPT
// ============================================================================
window.closePromptModal = function() {
    if (typeof window.closeModal === 'function') window.closeModal('modal-custom-prompt');
    AuraState.temp.promptCallback = null;
};

window.executeCustomPrompt = function() {
    const inputVal = document.getElementById('prompt-input')?.value.trim();
    if (typeof AuraState.temp.promptCallback === 'function') {
        AuraState.temp.promptCallback(inputVal); // Kirim nilai ke fungsi pemanggil
        AuraState.temp.promptCallback = null;
    }
    window.closePromptModal();
};

// ============================================================================
// 3. HANDLER MODAL CONFIRM (Hybrid: Untuk Custom dan Hapus Transaksi)
// ============================================================================
window.closeConfirmModal = function() { 
    if (typeof window.closeModal === 'function') {
        window.closeModal('modal-confirm');
    }
    AuraState.temp.deleteTarget = null; 
    AuraState.temp.confirmCallback = null; // Bersihkan memori titipan
};

window.addEventListener('load', function() {
    const executeConfirmDeleteBtn = document.getElementById('btn-execute-delete');
    
    if (executeConfirmDeleteBtn) {
        executeConfirmDeleteBtn.addEventListener('click', async function() {
            
            // SKENARIO A: Jika ini adalah confirm custom dari AuraAlert
            if (typeof AuraState.temp.confirmCallback === 'function') {
                AuraState.temp.confirmCallback(); // Eksekusi fungsi yang dititipkan
                window.closeConfirmModal();
                return;
            }

            // SKENARIO B: Jika ini adalah perintah hapus transaksi (Logika Lama)
            const target = AuraState.temp.deleteTarget;
            if (!target) return;
            
            try {
                if (target.type === 'trx') { 
                    if (AuraState.system.activeView === 'trash') { 
                        await FirebaseService.deleteTransactionPermanently(target.id); 
                    } else { 
                        await FirebaseService.moveToTrash(target.id); 
                    } 
                } 
                else if (target.type === 'goal') { 
                    await FirebaseService.deleteGoal(target.id); 
                } 
                else if (target.type === 'item') {
                    const transactions = AuraState.data.transactions || [];
                    let trx = null;
                    
                    for (let i = 0; i < transactions.length; i++) {
                        if (transactions[i].id === target.id) {
                            trx = transactions[i];
                            break;
                        }
                    }
                    
                    if (trx) {
                        const nItems = [];
                        let sum = 0;
                        
                        for (let i = 0; i < trx.items.length; i++) {
                            const it = trx.items[i];
                            if (it.itemId !== target.itemId) {
                                nItems.push(it);
                                sum += (it.harga * (it.qty || 1));
                            }
                        }
                        
                        if (nItems.length === 0) { 
                            await FirebaseService.moveToTrash(trx.id);
                        } else { 
                            const upd = { items: nItems, nominal: sum };
                            if (!trx.isCustomDescription) { 
                                upd.description = `[Auto-Update] Item dihapus. Total terbaru: ${AuraUtils.formatCurrency(sum)}.`; 
                                upd.catatan_ai = upd.description; 
                            } 
                            
                            await FirebaseService.updateTransaction(trx.id, upd);
                        }
                    }
                }
                
                if (window.showToast) window.showToast("Aksi Destruktif Berhasil Dieksekusi.");
            } catch(e) {
                if (window.showToast) window.showToast("Gagal mengeksekusi perintah hapus/pembersihan.", true);
            } finally {
                window.closeConfirmModal();
            }
        });
    }
});
