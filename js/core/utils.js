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
            // Mengambil dari state terbaru yang diupdate oleh window.setCurrency
            const currency = AuraState.system.displayCurrency || 'JPY';
            const val = Number(amount) || 0;
            
            if (currency === 'IDR') {
                const rate = AuraState.system.exchangeRate || 105;
                return 'Rp ' + Math.round(val * rate).toLocaleString('id-ID');
            } else {
                return '¥' + Math.round(val).toLocaleString('ja-JP');
            }
        } catch (e) { 
            return `${AuraState.system.displayCurrency || 'JPY'} ${Number(amount).toLocaleString()}`; 
        }
    },

    convertCurrency: function(amount, fromCurrency) {
        const numAmount = Number(amount);
        if (isNaN(numAmount)) return 0;
        
        const currentDisplay = AuraState.system.displayCurrency || 'JPY';
        if (!fromCurrency || fromCurrency === currentDisplay) return numAmount;
        
        // Memastikan variabel rate sesuai dengan yang disimpan di main.js
        const rate = AuraState.system.exchangeRate || 105;
        
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

            return {
                itemId: item.itemId || AuraUtils.generateId('itm'),
                nama_barang: AuraUtils.escapeHtml(item.nama_barang || item.name || "Item Abstrak"),
                harga: safePrice, qty: safeQty,                      
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
        const mode = AuraState.filters.periodMode;
        let start, end;
        
        if (mode === 'period') {
            if (now.getDate() >= 16) {
                start = new Date(now.getFullYear(), now.getMonth(), 16, 0, 0, 0);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 15, 23, 59, 59);
            } else {
                start = new Date(now.getFullYear(), now.getMonth() - 1, 16, 0, 0, 0);
                end = new Date(now.getFullYear(), now.getMonth(), 15, 23, 59, 59);
            }
        } else if (mode === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
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

window.AuraUtils = AuraUtils;
window.generateItemId = function() { return AuraUtils.generateId('itm'); };
window.parseCleanJSON = AuraUtils.parseCleanJSON;
window.formatVal = AuraUtils.formatCurrency;
window.convertVal = AuraUtils.convertCurrency;
window.sanitizeItems = AuraUtils.sanitizeItemsArray;
