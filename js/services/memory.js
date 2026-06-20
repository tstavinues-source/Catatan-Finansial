/**
 * Memory & Financial Summary Services
 * Mengelola cache pencarian transaksi dan merangkum status keuangan untuk konteks AI.
 */

import { AuraState } from '../core/state.js';
import { APP_CONFIG } from '../config/constants.js';

export const MemoryService = {
    _cache: {}, 
    
    getRelevantTransactions: function(query) {
        const sourceData = AuraState.data.transactions || [];
        if (sourceData.length === 0) return [];
        
        const keyword = (query || "").toLowerCase().trim();
        const cachedItem = this._cache[keyword];
        const currentTime = Date.now();
        
        if (cachedItem && (currentTime - cachedItem.timestamp < APP_CONFIG.CACHE_TTL_MS)) {
            return cachedItem.data;
        }

        let matched = sourceData.filter(function(t) {
            const matchCategory = (t.kategori || "").toLowerCase().includes(keyword);
            const matchStore = (t.merchantName || t.storeName || "").toLowerCase().includes(keyword);
            const matchDesc = (t.description || t.catatan_ai || "").toLowerCase().includes(keyword);
            
            let matchItems = false;
            if (t.items && Array.isArray(t.items)) {
                matchItems = t.items.some(function(it) {
                    return (it.nama_barang || "").toLowerCase().includes(keyword);
                });
            }
            return matchCategory || matchStore || matchItems || matchDesc;
        });

        const queryResult = matched.length > 0 ? matched.slice(0, 5) : sourceData.slice(0, 5);
        this._cache[keyword] = { data: queryResult, timestamp: currentTime };
        return queryResult;
    },
    
    getRelevantChats: function() { 
        const sourceData = AuraState.data.oracleChats || [];
        return sourceData.slice(-8); 
    },
    
    invalidateCache: function() {
        this._cache = {};
    }
};

export const FinancialSummaryService = {
    getSummaryString: function() {
        let cashBal = 0, cashlessBal = 0, totSpent = 0;
        const today = new Date();
        const txList = AuraState.data.transactions || [];

        for (let i = 0; i < txList.length; i++) {
            const t = txList[i];
            const val = Number(t.nominal || 0);
            if (isNaN(val)) continue;
            
            const isCash = (t.metode_pembayaran === 'tunai');
            if (t.tipe === 'pemasukan') { 
                if (isCash) cashBal += val;
                else cashlessBal += val;
            } else if (t.tipe === 'tarik_tunai') { 
                let adminFee = Number(t.admin_fee || 0);
                if (isNaN(adminFee)) adminFee = 0;
                cashBal += val;
                cashlessBal -= (val + adminFee); 
            } else if (t.tipe === 'setor_tunai') { 
                let adminFee = Number(t.admin_fee || 0);
                if (isNaN(adminFee)) adminFee = 0;
                cashBal -= val;
                cashlessBal += val; 
                cashlessBal -= adminFee; 
            } else {
                if (isCash) cashBal -= val;
                else cashlessBal -= val;
                
                const tDate = new Date(t.tanggal);
                if (!isNaN(tDate.getTime())) {
                    if (tDate.getMonth() === today.getMonth() && tDate.getFullYear() === today.getFullYear()) { 
                        totSpent += val;
                    }
                }
            }
        }
        
        const profile = AuraState.data.settings?.profile || {};
        const curr = AuraState.system.displayCurrency || 'JPY';
        const namePart = profile.fullName ? `${profile.fullName} (${profile.nickname || ''})` : "User AuraFi";
        return `--- PROFIL & RINGKASAN PENGGUNA ---\nNama: ${namePart}\nMata Uang: ${curr}\nSisa Tunai: ${cashBal} ${curr}\nSisa Cashless: ${cashlessBal} ${curr}\nNet Worth: ${cashBal + cashlessBal} ${curr}\nPengeluaran Bulan Ini: ${totSpent} ${curr}`;
    }
};

window.MemoryService = MemoryService;
window.FinancialSummaryService = FinancialSummaryService;
