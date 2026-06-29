/**
 * Financial Goals Handlers
 * Menangani penambahan, modifikasi, dan penghapusan target tabungan finansial.
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';
import { FirebaseService } from '../services/firebase.js';

window.saveGoal = async function() { 
    const nameEl = document.getElementById('goal-name');
    const amtEl = document.getElementById('goal-target');
    const dtEl = document.getElementById('goal-date');
    const currEl = document.getElementById('goal-currency'); // Menangkap Pilihan Kurs
    
    if (!nameEl || !amtEl || !dtEl) return;
    
    const name = nameEl.value.trim(); 
    const amt = parseFloat(amtEl.value); 
    const dt = dtEl.value;
    const selectedCurr = currEl ? currEl.value : 'JPY'; // Default JPY jika tidak ditemukan

    if (!name || isNaN(amt) || !dt) {
        if (window.showToast) window.showToast("Harap lengkapi semua isian formulir!", true);
        return;
    }
    
    try {
        await FirebaseService.saveGoal({ 
            name: name, 
            targetAmount: amt, 
            targetDate: dt, 
            currency: selectedCurr // SIMPAN IDENTITAS KURS SECARA PERMANEN
        });

        const formContainer = document.getElementById('goal-form');
        if (formContainer) formContainer.classList.add('hidden');
        
        nameEl.value = "";
        amtEl.value = ""; 
        dtEl.value = ""; 
        if (currEl) currEl.value = "JPY"; // Reset kembali ke JPY
        
        if (window.showToast) window.showToast("Misi Tabungan Berhasil Ditambahkan!");
    } catch(e) {
        if (window.showToast) window.showToast("Gagal menyimpan misi baru.", true);
    }
};

window.confirmDelGoal = function(id) { 
    const goals = AuraState.data.goals || [];
    let goal = null;
    
    for (let i = 0; i < goals.length; i++) {
        if (goals[i].id === id) {
            goal = goals[i];
            break;
        }
    }
    
    if (!goal) return;

    AuraState.temp.deleteTarget = { type: 'goal', id: id, name: goal.name };
    
    AuraUtils.safeDOM('confirm-msg', el => {
        el.innerText = `Batalkan misi tabungan "${AuraUtils.escapeHtml(goal.name)}" selamanya?`;
    });
    
    if (typeof window.showModal === 'function') window.showModal('modal-confirm'); 
};

window.editGoalPrompt = async function(id) {
    const goals = AuraState.data.goals || [];
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    
    const newName = await window.AuraPrompt("<i class='fa-solid fa-pen mr-2'></i>Edit Misi", "Masukkan nama misi baru:", goal.name);
    if (!newName) return;
    
    const newTarget = await window.AuraPrompt("<i class='fa-solid fa-bullseye mr-2'></i>Edit Target", `Masukkan target dana baru (${goal.currency || 'JPY'}):`, goal.targetAmount);
    if (!newTarget) return;
    
    const newDate = await window.AuraPrompt("<i class='fa-solid fa-calendar mr-2'></i>Edit Tanggal", "Masukkan tanggal target baru (YYYY-MM-DD):", goal.targetDate);
    if (!newDate) return;
    
    const parsedTarget = parseFloat(newTarget);
    if (isNaN(parsedTarget) || parsedTarget <= 0) {
        if (window.showToast) window.showToast("Target harus angka positif!", true);
        return;
    }
    
    try {
        await FirebaseService.updateGoal(id, { 
            name: newName, 
            targetAmount: parsedTarget, 
            targetDate: newDate 
            // Kita tidak mengubah Currency-nya agar tetap konsisten dengan niat awal pembuatan
        });
        if (window.showToast) window.showToast("Misi berhasil diperbarui!");
    } catch(e) {
        if (window.showToast) window.showToast("Gagal update misi.", true);
    }
};
