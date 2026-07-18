/**
 * Utility & Security Functions
 * Kumpulan fungsi bantuan yang digunakan di seluruh aplikasi.
 */
import { AuraState } from './state.js';
import { Logger } from './logger.js';
import { APP_CONFIG } from '../config/constants.js';

export const AuraUtils = {
    generateId: function(prefix = 'id') {
        const time = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 10);
        return `${prefix}_${time}_${random}`;
    },

    escapeHtml: function(text) {
        if (typeof text !== 'string') return text;
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    },

    parseCleanJSON: function(text) {
        try {
            if (!text || typeof text !== 'string') throw new Error("Output AI kosong.");
            let cleanedText = text.trim()
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/, '')
                .replace(/\s*```$/, '');
            
            const firstBrace = cleanedText.indexOf('{');
            const firstBracket = cleanedText.indexOf('[');
            let startIdx = 0;
            
            if (firstBrace !== -1 && firstBracket !== -1) {
                startIdx = Math.min(firstBrace, firstBracket);
            } else if (firstBrace !== -1) {
                startIdx = firstBrace;
            } else if (firstBracket !== -1) {
                startIdx = firstBracket;
            }
            
            if (startIdx > 0) cleanedText = cleanedText.substring(startIdx);
            return JSON.parse(cleanedText);
        } catch (e) {
            Logger.error('Utility', 'Gagal memparsing JSON hasil ekstraksi AI.', text);
            throw new Error("Gagal mengurai respons AI.");
        }
    },

    formatCurrency: function(amount) {
        try {
            const currency = AuraState.system.displayCurrency || APP_CONFIG.DEFAULT_CURRENCY;
            const styleOpts = { style: 'currency', currency: currency, maximumFractionDigits: 0 };
            return currency === 'JPY' 
                ? new Intl.NumberFormat('ja-JP', styleOpts).format(amount)
                : new Intl.NumberFormat('id-ID', styleOpts).format(amount);
        } catch (e) { 
            const fallbackCurr = AuraState.system.displayCurrency || APP_CONFIG.DEFAULT_CURRENCY;
            return `${fallbackCurr} ${Number(amount).toLocaleString()}`; 
        }
    },

    convertCurrency: function(amount, fromCurrency) {
        const numAmount = Number(amount);
        if (isNaN(numAmount)) return 0;
        
        const currentDisplay = AuraState.system.displayCurrency || APP_CONFIG.DEFAULT_CURRENCY;
        if (!fromCurrency || typeof fromCurrency !== 'string' || fromCurrency === currentDisplay) {
            return numAmount;
        }
        
        const rate = AuraState.system.exchangeRateIDR || 110.27; // Beri fallback rate agar aman
        if (fromCurrency === 'JPY' && currentDisplay === 'IDR') return numAmount * rate;
        if (fromCurrency === 'IDR' && currentDisplay === 'JPY') return numAmount / rate;
        return numAmount; 
    },

    safeDOM: function(id, callback) {
        const el = document.getElementById(id);
        if (el && typeof callback === 'function') {
            try { callback(el); } 
            catch (err) { Logger.error('Utility', `Kesalahan eksekusi DOM pada [${id}]`, err); }
        }
        return el;
    },

    sanitizeItemsArray: function(items, defaultPaymentMethod, defaultTimestamp) {
        if (!items || !Array.isArray(items)) return [];
        return items.map(function(item) {
            let safePrice = Number(item.harga !== undefined ? item.harga : (item.price || 0));
            if (isNaN(safePrice) || safePrice < 0) safePrice = 0;
            
            let safeQty = Number(item.qty !== undefined ? item.qty : 1);
            if (isNaN(safeQty) || safeQty <= 0) safeQty = 1;
            
            let safeTax = Number(item.tax_rate !== undefined ? item.tax_rate : 0);
            if (isNaN(safeTax) || safeTax < 0) safeTax = 0;

            // PERBAIKAN BUG DOUBLE-ESCAPING: Biarkan raw text disimpan ke DB/State
            let rawName = item.nama_barang || item.name || "Item Abstrak";
            if (typeof rawName === 'string') rawName = rawName.trim();

            return {
                itemId: item.itemId || AuraUtils.generateId('itm'),
                nama_barang: rawName, // <--- Tidak ada lagi escapeHtml di sini!
                harga: safePrice, 
                qty: safeQty,                      
                kategori_barang: item.kategori_barang || item.category || "Lainnya",
                tax_rate: safeTax,
                paymentMethod: item.paymentMethod || defaultPaymentMethod || "cashless",
                timestamp: item.timestamp || defaultTimestamp || new Date().toISOString()
            };
        });
    },

    formatDateToReadable: function(isoString) {
        try {
            const d = new Date(isoString);
            if (isNaN(d.getTime())) return "---";
            const yr = d.getFullYear(); 
            const mo = String(d.getMonth() + 1).padStart(2, '0');
            const da = String(d.getDate()).padStart(2, '0'); 
            const hr = String(d.getHours()).padStart(2, '0');
            const mi = String(d.getMinutes()).padStart(2, '0');
            return `${yr}/${mo}/${da} ${hr}:${mi}`;
        } catch (e) { return "---"; }
    },

    getPeriodRange: function() {
        const now = new Date();
        const mode = AuraState.filters?.periodMode || 'month'; // Fallback aman
        let start, end;
        
        if (mode === 'period') {
            // FITUR BARU: siklus sebelumnya paten 16-15. Sekarang tanggal mulai
            // bisa diatur user lewat Settings (AuraState.data.settings.cycleStartDay),
            // default tetap 16 kalau belum pernah diatur.
            const cycleDay = Math.min(28, Math.max(2, Number(AuraState.data.settings?.cycleStartDay) || 16));
            if (now.getDate() >= cycleDay) {
                start = new Date(now.getFullYear(), now.getMonth(), cycleDay, 0, 0, 0);
                end = new Date(now.getFullYear(), now.getMonth() + 1, cycleDay - 1, 23, 59, 59);
            } else {
                start = new Date(now.getFullYear(), now.getMonth() - 1, cycleDay, 0, 0, 0);
                end = new Date(now.getFullYear(), now.getMonth(), cycleDay - 1, 23, 59, 59);
            }
        } else if (mode === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        } else if (mode === 'custom') {
            // FITUR BARU: rentang tanggal bebas dipilih user (dari Analytics).
            // AuraState.filters.customStart/customEnd berisi string "YYYY-MM-DD"
            // dari <input type="date">. Kalau tidak valid/kosong, aman fallback ke all-time.
            const rawStart = AuraState.filters?.customStart;
            const rawEnd = AuraState.filters?.customEnd;
            const parsedStart = rawStart ? new Date(rawStart + 'T00:00:00') : null;
            const parsedEnd = rawEnd ? new Date(rawEnd + 'T23:59:59') : null;
            
            if (parsedStart && !isNaN(parsedStart.getTime()) && parsedEnd && !isNaN(parsedEnd.getTime())) {
                start = parsedStart;
                end = parsedEnd;
            } else {
                start = new Date(1970, 0, 1);
                end = new Date(2100, 0, 1);
            }
        } else {
            start = new Date(1970, 0, 1);
            end = new Date(2100, 0, 1);
        }
        
        return { start: start.getTime(), end: end.getTime(), startObj: start, endObj: end };
    },

    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = function() {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// Global Exposure untuk fungsi utilitas yang dipakai di HTML
window.AuraUtils = AuraUtils;
window.generateItemId = function() { return AuraUtils.generateId('itm'); };
window.parseCleanJSON = AuraUtils.parseCleanJSON;
window.formatVal = AuraUtils.formatCurrency;
window.convertVal = AuraUtils.convertCurrency;
window.sanitizeItems = AuraUtils.sanitizeItemsArray;
