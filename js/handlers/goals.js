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
    
    if (!nameEl || !amtEl || !dtEl) return;
    
    const name = nameEl.value.trim(); 
    const amt = parseFloat(amtEl.value); 
    const dt = dtEl.value;

    if (!name || isNaN(amt) || !dt) {
        if (window.showToast) window.showToast("Harap lengkapi semua isian formulir!", true);
        return;
    }
    
    try {
        await FirebaseService.saveGoal({ 
            name: name, 
            targetAmount: amt, 
            targetDate: dt, 
            currency: AuraState.system.displayCurrency 
        });

        const formContainer = document.getElementById('goal-form');
        if (formContainer) formContainer.classList.add('hidden');
        
        nameEl.value = "";
        amtEl.value = ""; 
        dtEl.value = ""; 
        
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

// SUDAH DIPERBAIKI: Menambahkan 'async' pada deklarasi fungsi
window.editGoalPrompt = async function(id) {
    const goals = AuraState.data.goals || [];
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    
    const newName = prompt("Nama Misi Baru:", goal.name);
    if (newName === null) return;
    
    const newTarget = prompt("Target Dana Baru:", goal.targetAmount);
    if (newTarget === null) return;
    
    const newDate = prompt("Tanggal Target Baru (YYYY-MM-DD):", goal.targetDate);
    if (newDate === null) return;
    
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
        });
        if (window.showToast) window.showToast("Misi berhasil diperbarui!");
    } catch(e) {
        if (window.showToast) window.showToast("Gagal update misi.", true);
    }
};
