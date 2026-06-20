/**
 * Confirmation Modal Handler
 * Mengelola eksekusi aksi destruktif (soft-delete, hard-delete, hapus item/goal) via Modal Konfirmasi.
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js'; // Memastikan AuraUtils diimpor
import { FirebaseService } from '../services/firebase.js';

window.closeConfirmModal = function() { 
    if (typeof window.closeModal === 'function') {
        window.closeModal('modal-confirm');
    }
    AuraState.temp.deleteTarget = null; 
};

window.addEventListener('load', function() {
    const executeConfirmDeleteBtn = document.getElementById('btn-execute-delete');
    
    if (executeConfirmDeleteBtn) {
        executeConfirmDeleteBtn.addEventListener('click', async function() {
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
                                // SUDAH DIPERBAIKI: Menggunakan AuraUtils secara langsung tanpa window.
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
