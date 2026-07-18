/**
 * Omnipresent Input Handlers
 * Menangani kolom ketik utama, upload gambar/struk, dan penyaluran ke sistem AI.
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';

window.handleImage = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    // PERBAIKAN: sebelumnya tidak ada validasi tipe/ukuran sama sekali — file
    // apa pun ukurannya langsung diproses FileReader jadi base64. File besar
    // (foto resolusi tinggi/screenshot besar) bisa bikin proses ini berat dan
    // browser tab freeze/crash, terutama di device dengan RAM terbatas.
    if (!file.type.startsWith('image/')) {
        if (window.showToast) window.showToast("Hanya file gambar yang diperbolehkan.", true);
        event.target.value = ''; // Reset agar user bisa pilih ulang
        return;
    }

    const MAX_MB = 10;
    if (file.size > MAX_MB * 1024 * 1024) {
        if (window.showToast) window.showToast(`Ukuran file terlalu besar! Maksimal ${MAX_MB}MB.`, true);
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        AuraState.system.base64Upload = e.target.result;
        AuraUtils.safeDOM('img-preview', el => el.src = e.target.result);
        AuraUtils.safeDOM('image-preview-box', el => el.classList.remove('hidden'));
    };
    reader.readAsDataURL(file);
};

window.removeImage = function() {
    AuraState.system.base64Upload = "";
    AuraUtils.safeDOM('img-preview', el => el.src = "");
    AuraUtils.safeDOM('image-preview-box', el => el.classList.add('hidden'));
    AuraUtils.safeDOM('file-upload', el => el.value = "");
};

window.handleSend = async function() {
    const inputEl = document.getElementById('main-input-field');
    if (!inputEl) return;
    
    const text = inputEl.value.trim();
    const base64Img = AuraState.system.base64Upload;

    if (!text && !base64Img) return;

    // Bersihkan input
    inputEl.value = "";
    window.removeImage();

    const activeView = AuraState.system.activeView;

    // Arahkan pemrosesan berdasarkan tab aktif
    if (activeView === 'oracle') {
        if (typeof window.processOracleChat === 'function') {
            await window.processOracleChat(text, base64Img);
        }
    } else {
        // Jika di dashboard/transactions, otomatis proses ekstraksi struk
        if (typeof window.processTransactionParsing === 'function') {
            await window.processTransactionParsing(text, base64Img);
        }
    }
};

window.startVoice = function() {
    if (window.showToast) window.showToast("Fitur Voice Recognition sedang dalam pengembangan.");
};
/**
 * Omnipresent Input Handlers
 * Menangani kolom ketik utama, upload gambar/struk, dan penyaluran ke sistem AI.
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';

window.handleImage = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        AuraState.system.base64Upload = e.target.result;
        AuraUtils.safeDOM('img-preview', el => el.src = e.target.result);
        AuraUtils.safeDOM('image-preview-box', el => el.classList.remove('hidden'));
    };
    reader.readAsDataURL(file);
};

window.removeImage = function() {
    AuraState.system.base64Upload = "";
    AuraUtils.safeDOM('img-preview', el => el.src = "");
    AuraUtils.safeDOM('image-preview-box', el => el.classList.add('hidden'));
    AuraUtils.safeDOM('file-upload', el => el.value = "");
};

window.handleSend = async function() {
    const inputEl = document.getElementById('main-input-field');
    if (!inputEl) return;
    
    const text = inputEl.value.trim();
    const base64Img = AuraState.system.base64Upload;

    if (!text && !base64Img) return;

    // Bersihkan input
    inputEl.value = "";
    window.removeImage();

    const activeView = AuraState.system.activeView;

    // Arahkan pemrosesan berdasarkan tab aktif
    if (activeView === 'oracle') {
        if (typeof window.processOracleChat === 'function') {
            await window.processOracleChat(text, base64Img);
        }
    } else {
        // Jika di dashboard/transactions, otomatis proses ekstraksi struk
        if (typeof window.processTransactionParsing === 'function') {
            await window.processTransactionParsing(text, base64Img);
        }
    }
};

window.startVoice = function() {
    if (window.showToast) window.showToast("Fitur Voice Recognition sedang dalam pengembangan.");
};
