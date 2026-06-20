/**
 * Dynamic Category Engine (Smart Classification System)
 * Mengelola aturan pencocokan kata kunci kategori bawaan dan custom dari database.
 */

import { DEFAULT_SYSTEM_CATEGORIES } from '../config/categories.js';
import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';

export const CategoryManager = {
    
    getAllCategories: function() {
        const customCats = AuraState.data.settings?.categories || {};
        return { ...DEFAULT_SYSTEM_CATEGORIES, ...customCats };
    },
    
    resolveStyle: function(catName) {
        const allCats = this.getAllCategories();
        if (!catName || typeof catName !== 'string') {
            return { icon: 'fa-tag', hex: '#52525b', name: 'Lainnya' };
        }

        const safeName = catName.toLowerCase().trim();
        const exactMatch = Object.values(allCats).find(function(c) {
            return c.name && c.name.toLowerCase() === safeName;
        });

        if (exactMatch) {
            return { 
                icon: exactMatch.icon || 'fa-tag', 
                hex: exactMatch.color || '#52525b', 
                name: exactMatch.name 
            };
        }

        // Aturan fallback berbasis kecocokan kata kunci (Smart Keyword Matcher)
        const rules = [
            { words: ['makan', 'kuliner', 'cemilan', 'snack', 'food', 'resto'], icon: 'fa-burger', hex: '#fb923c', name: 'Makanan' },
            { words: ['minum', 'kopi', 'teh', 'cafe', 'drink', 'beverage'], icon: 'fa-mug-hot', hex: '#60a5fa', name: 'Minuman' },
            { words: ['tagihan', 'utilitas', 'listrik', 'air', 'wifi', 'pajak', 'internet', 'bill'], icon: 'fa-file-invoice-dollar', hex: '#facc15', name: 'Utilitas' },
            { words: ['gaji', 'masuk', 'transferan', 'bonus', 'pendapatan', 'income', 'salary'], icon: 'fa-money-bill-wave', hex: '#10b981', name: 'Pemasukan' },
            { words: ['obat', 'sehat', 'dokter', 'klinik', 'rs', 'health', 'hospital'], icon: 'fa-kit-medical', hex: '#fb7185', name: 'Kesehatan' },
            { words: ['baju', 'pakaian', 'fashion', 'celana', 'sepatu', 'aksesoris'], icon: 'fa-shirt', hex: '#e879f9', name: 'Pakaian' },
            { words: ['hibur', 'main', 'game', 'bioskop', 'rekreasi', 'entertainment'], icon: 'fa-gamepad', hex: '#c084fc', name: 'Hiburan' },
            { words: ['online', 'shopee', 'tokopedia', 'amazon', 'gojek', 'grab'], icon: 'fa-box-open', hex: '#f472b6', name: 'Belanja Online' },
            { words: ['transport', 'kereta', 'bus', 'bensin', 'parkir', 'tol', 'travel'], icon: 'fa-train', hex: '#34d399', name: 'Transportasi' },
            { words: ['pokok', 'pasar', 'supermarket', 'groceries', 'mart'], icon: 'fa-basket-shopping', hex: '#4ade80', name: 'Bahan Pokok' },
            { words: ['elektronik', 'gadget', 'laptop', 'hp', 'device'], icon: 'fa-laptop', hex: '#94a3b8', name: 'Elektronik' },
            { words: ['didik', 'sekolah', 'kursus', 'buku', 'edukasi', 'education'], icon: 'fa-graduation-cap', hex: '#22d3ee', name: 'Pendidikan' }
        ];

        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            for (let j = 0; j < rule.words.length; j++) {
                if (safeName.includes(rule.words[j])) {
                    return { icon: rule.icon, hex: rule.hex, name: rule.name };
                }
            }
        }
        
        return { icon: 'fa-tag', hex: '#52525b', name: 'Lainnya' };
    },
    
    getCategoryStringList: function() { 
        return Object.values(this.getAllCategories()).map(function(c) {
            return c.name;
        }).join(', ');
    },
    
    renderDropdowns: function() {
        const allCats = this.getAllCategories();
        let optionsHtml = '';
        
        Object.values(allCats).forEach(function(c) { 
            optionsHtml += `<option value="${c.name}">${c.name}</option>`; 
        });

        const targetIds = ['manual-trx-category', 'add-item-cat', 'edit-item-cat', 'filter-category', 'staging-trx-cat'];
        
        targetIds.forEach(function(id) {
            AuraUtils.safeDOM(id, function(el) {
                const currentVal = el.value; 
                let preHtml = (id === 'filter-category') ? `<option value="ALL">SEMUA KATEGORI</option>` : `<option value="Lainnya">Pilih Kategori...</option>`;
                el.innerHTML = preHtml + optionsHtml;
                
                if (currentVal) { 
                    const exists = Array.from(el.options).some(function(opt) {
                        return opt.value === currentVal;
                    }); 
                    if (exists) {
                        el.value = currentVal; 
                    }
                }
            });
        });
    }
};

// Global Bindings untuk menjaga fungsionalitas UI HTML lama
window.CategoryManager = CategoryManager;
window.getAllCategories = function() { return CategoryManager.getAllCategories(); };
window.getCategoryStyle = function(name) { return CategoryManager.resolveStyle(name); };
window.getCategoryHexColor = function(name) { return CategoryManager.resolveStyle(name).hex; };
window.renderCategoryDropdowns = function() { return CategoryManager.renderDropdowns(); };
