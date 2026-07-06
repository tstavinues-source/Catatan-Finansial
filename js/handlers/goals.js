/**
 * Financial Goals Handlers
 * Menangani penambahan, modifikasi, penghapusan, dan setor uang ke target tabungan finansial.
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';
import { FirebaseService } from '../services/firebase.js';

// ============================================================================
// UI PICKER SATUAN WAKTU (HARI / MINGGU / BULAN)
// ============================================================================
let activeTimeUnitTargetVal = '';
let activeTimeUnitTargetDisplay = '';

window.openTimeUnitPicker = function(valId, displayId) {
    activeTimeUnitTargetVal = valId;
    activeTimeUnitTargetDisplay = displayId;
    if(typeof window.showModal === 'function') window.showModal('modal-time-unit-picker');
    
    // Animasikan Bottom Sheet
    const panel = document.getElementById('time-picker-panel');
    if (panel) {
        requestAnimationFrame(() => {
            panel.classList.remove('translate-y-full');
            panel.classList.add('translate-y-0');
        });
    }
};

window.closeTimeUnitPicker = function() {
    const panel = document.getElementById('time-picker-panel');
    if (panel) {
        panel.classList.remove('translate-y-0');
        panel.classList.add('translate-y-full');
    }
    setTimeout(() => {
        if(typeof window.closeModal === 'function') window.closeModal('modal-time-unit-picker');
    }, 300);
};

window.selectTimeUnit = function(unit) {
    const valEl = document.getElementById(activeTimeUnitTargetVal);
    const displayEl = document.getElementById(activeTimeUnitTargetDisplay);
    if(valEl) valEl.value = unit;
    if(displayEl) displayEl.innerText = unit;
    window.closeTimeUnitPicker();
};

// Fungsi Helper untuk mengonversi Angka + Satuan menjadi Total Hari
function getFreqDays(val, unit) {
    const num = parseInt(val) || 1;
    if (unit === 'minggu') return num * 7;
    if (unit === 'bulan') return Math.round(num * 30.416); // Rata-rata hari dalam sebulan
    return num; // hari
}

// ============================================================================
// MEMBUAT MISI TABUNGAN BARU
// ============================================================================
window.saveGoal = async function() { 
    const name = document.getElementById('goal-name')?.value.trim();
    const amt = parseFloat(document.getElementById('goal-target')?.value);
    const startDate = document.getElementById('goal-start-date')?.value;
    const endDate = document.getElementById('goal-end-date')?.value;
    const periodVal = document.getElementById('goal-period-val')?.value;
    const periodUnit = document.getElementById('goal-period-unit-val')?.value;

    if (!name || isNaN(amt) || !startDate || !endDate) {
        if (window.showToast) window.showToast("Harap lengkapi semua isian formulir!", true);
        return;
    }

    const freqDays = getFreqDays(periodVal, periodUnit);

    try {
        await FirebaseService.saveGoal({ 
            name: name, 
            targetAmount: amt, 
            savedAmount: 0, // Tabungan dimulai dari 0
            startDate: startDate,         
            targetDate: endDate,
            frequencyDays: freqDays,
            periodVal: periodVal,
            periodUnit: periodUnit,
            currency: AuraState.system.displayCurrency || 'JPY'
        });

        const formContainer = document.getElementById('goal-form');
        if (formContainer) formContainer.classList.add('hidden');
        
        // Bersihkan Form
        document.getElementById('goal-name').value = "";
        document.getElementById('goal-target').value = ""; 
        document.getElementById('goal-start-date').value = ""; 
        document.getElementById('goal-end-date').value = ""; 
        
        if (window.showToast) window.showToast("Misi Tabungan Berhasil Ditambahkan!");
    } catch(e) {
        if (window.showToast) window.showToast("Gagal menyimpan misi baru.", true);
    }
};

window.confirmDelGoal = function(id) { 
    const goals = AuraState.data.goals || [];
    const goal = goals.find(g => g.id === id);
    if (!goal) return;

    AuraState.temp.deleteTarget = { type: 'goal', id: id, name: goal.name };
    AuraUtils.safeDOM('confirm-msg', el => {
        el.innerText = `Batalkan misi tabungan "${AuraUtils.escapeHtml(goal.name)}" selamanya? Uang yang terkumpul akan tetap ada di saldo Anda.`;
    });
    if (typeof window.showModal === 'function') window.showModal('modal-confirm'); 
};

// ============================================================================
// EDIT MISI SECARA KESELURUHAN (FULL EDIT)
// ============================================================================
window.openEditGoalFull = function(id) {
    const goal = (AuraState.data.goals || []).find(g => g.id === id);
    if(!goal) return;
    
    AuraState.temp.editGoalId = id;
    
    document.getElementById('edit-goal-name').value = goal.name || '';
    document.getElementById('edit-goal-target').value = goal.targetAmount || 0;
    document.getElementById('edit-goal-saved').value = goal.savedAmount || 0;
    document.getElementById('edit-goal-start-date').value = goal.startDate || '';
    document.getElementById('edit-goal-end-date').value = goal.targetDate || '';
    document.getElementById('edit-goal-period-val').value = goal.periodVal || 1;
    document.getElementById('edit-goal-period-unit-val').value = goal.periodUnit || 'bulan';
    
    const displayEl = document.getElementById('edit-goal-period-unit-display');
    if (displayEl) displayEl.innerText = goal.periodUnit || 'bulan';
    
    if (typeof window.showModal === 'function') window.showModal('modal-edit-goal-full');
};

window.saveFullEditGoal = async function() {
    const id = AuraState.temp.editGoalId;
    if(!id) return;

    const name = document.getElementById('edit-goal-name')?.value.trim();
    const targetAmount = parseFloat(document.getElementById('edit-goal-target')?.value);
    const savedAmount = parseFloat(document.getElementById('edit-goal-saved')?.value);
    const startDate = document.getElementById('edit-goal-start-date')?.value;
    const targetDate = document.getElementById('edit-goal-end-date')?.value;
    const periodVal = document.getElementById('edit-goal-period-val')?.value;
    const periodUnit = document.getElementById('edit-goal-period-unit-val')?.value;

    if (!name || isNaN(targetAmount) || isNaN(savedAmount) || !startDate || !targetDate) {
        if (window.showToast) window.showToast("Harap isi nama, target, dan tanggal dengan benar!", true);
        return;
    }

    const freqDays = getFreqDays(periodVal, periodUnit);

    try {
        await FirebaseService.updateGoal(id, { 
            name, 
            targetAmount, 
            savedAmount, 
            startDate, 
            targetDate, 
            frequencyDays: freqDays, 
            periodVal, 
            periodUnit 
        });
        
        if (typeof window.closeModal === 'function') window.closeModal('modal-edit-goal-full');
        if (window.showToast) window.showToast("Kalkulasi misi berhasil diperbarui!");
    } catch(e) {
        if (window.showToast) window.showToast("Gagal mengupdate misi.", true);
    }
};

// ============================================================================
// SETOR / TOP-UP UANG TABUNGAN
// ============================================================================
window.openTopupGoal = function(id, name) {
    AuraState.temp.topupGoalId = id;
    document.getElementById('topup-goal-name').innerText = name;
    document.getElementById('topup-goal-amount').value = '';
    
    if (typeof window.showModal === 'function') window.showModal('modal-topup-goal');
};

window.saveProgressGoal = async function() {
    const id = AuraState.temp.topupGoalId;
    const amt = parseFloat(document.getElementById('topup-goal-amount')?.value);
    
    if(!id || isNaN(amt) || amt <= 0) {
        if (window.showToast) window.showToast("Nominal tidak valid!", true);
        return;
    }

    const goal = (AuraState.data.goals || []).find(g => g.id === id);
    if(!goal) return;

    const currentSaved = parseFloat(goal.savedAmount) || 0;
    
    try {
        await FirebaseService.updateGoal(id, { savedAmount: currentSaved + amt });
        if (typeof window.closeModal === 'function') window.closeModal('modal-topup-goal');
        if (window.showToast) window.showToast("Tabungan berhasil disetor ke dalam sistem!");
    } catch(e) {
        if (window.showToast) window.showToast("Gagal menyetor tabungan.", true);
    }
};
