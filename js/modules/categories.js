/**
 * Dynamic Category Engine (Smart Classification System)
 * Mengelola aturan pencocokan kata kunci kategori bawaan dan custom dari database.
 * Dilengkapi dengan Auto-Learn untuk mempelajari kategori baru dari AI.
 */

import { DEFAULT_SYSTEM_CATEGORIES } from '../config/categories.js';
import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';

export const CategoryManager = {
    
    getAllCategories: function() {
        // PERBAIKAN: Sebelumnya modul ini membaca dari `settings.categories`,
        // padahal seluruh sistem lain (Firebase auto-register, Category Manager UI,
        // Analytics, Harvester sync) menyimpan & membaca dari `settings.customCategories`.
        // Akibatnya kategori buatan user / hasil auto-learn AI tidak pernah "terlihat" di sini.
        // Sekarang disatukan ke satu sumber kebenaran: `settings.customCategories`.
        const customCats = AuraState.data.settings?.customCategories || {};
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
            { words: ['makan', 'kuliner', 'cemilan', 'snack', 'food', 'resto', 'mie', 'daging', 'sayur'], icon: 'fa-burger', hex: '#fb923c', name: 'Makanan' },
            { words: ['minum', 'kopi', 'teh', 'cafe', 'drink', 'beverage'], icon: 'fa-mug-hot', hex: '#60a5fa', name: 'Minuman' },
            { words: ['tagihan', 'utilitas', 'listrik', 'air', 'wifi', 'pajak', 'internet', 'bill'], icon: 'fa-file-invoice-dollar', hex: '#facc15', name: 'Utilitas' },
            { words: ['gaji', 'masuk', 'transferan', 'bonus', 'pendapatan', 'income', 'salary'], icon: 'fa-money-bill-wave', hex: '#10b981', name: 'Pemasukan' },
            { words: ['obat', 'sehat', 'dokter', 'klinik', 'rs', 'health', 'hospital'], icon: 'fa-kit-medical', hex: '#fb7185', name: 'Kesehatan' },
            { words: ['baju', 'pakaian', 'fashion', 'celana', 'sepatu', 'aksesoris'], icon: 'fa-shirt', hex: '#e879f9', name: 'Pakaian' },
            { words: ['hibur', 'main', 'game', 'bioskop', 'rekreasi', 'entertainment'], icon: 'fa-gamepad', hex: '#c084fc', name: 'Hiburan' },
            { words: ['online', 'shopee', 'tokopedia', 'amazon', 'gojek', 'grab'], icon: 'fa-box-open', hex: '#f472b6', name: 'Belanja Online' },
            { words: ['transport', 'kereta', 'bus', 'bensin', 'parkir', 'tol', 'travel'], icon: 'fa-train', hex: '#34d399', name: 'Transportasi' },
            { words: ['pokok', 'pasar', 'supermarket', 'groceries', 'mart', 'dapur'], icon: 'fa-basket-shopping', hex: '#4ade80', name: 'Bahan Pokok' },
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

        const targetIds = ['manual-trx-category', 'add-item-cat', 'edit-item-cat', 'filter-category'];
        
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
    },

    // ============================================================================
    // FUNGSI AUTO-LEARN: Mendaftarkan Kategori Baru dari AI ke Firebase
    // ============================================================================
    autoLearnCategories: async function(itemsArray) {
        if (!itemsArray || !itemsArray.length) return;
        
        const existingCats = this.getAllCategories();
        // PERBAIKAN: samakan dengan sumber kebenaran `customCategories`
        let customCats = AuraState.data.settings?.customCategories || {};
        let isNewCategoryAdded = false;

        // Palet warna estetik untuk kategori baru buatan AI
        const autoColors = ['#f472b6', '#34d399', '#60a5fa', '#fb923c', '#c084fc', '#facc15', '#22d3ee', '#fb7185', '#a78bfa'];

        for (let i = 0; i < itemsArray.length; i++) {
            let rawCat = (itemsArray[i].kategori_barang || '').trim();
            if (!rawCat || rawCat.toLowerCase() === 'lainnya') continue;

            // Standarisasi: Huruf depan kapital (Contoh: "camilan" -> "Camilan")
            let cleanCatName = rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase();

            // Cek apakah kategori sudah ada (case-insensitive)
            const exists = Object.values(existingCats).some(c => c.name && c.name.toLowerCase() === cleanCatName.toLowerCase());

            if (!exists) {
                // Ciptakan ID & Profil Kategori Baru
                const newCatId = AuraUtils.generateId('cat');
                const randomColor = autoColors[Math.floor(Math.random() * autoColors.length)];
                
                // Coba tebak icon menggunakan smart matcher, jika gagal pakai default 'fa-tags'
                const styleHint = this.resolveStyle(cleanCatName);
                const finalIcon = styleHint.icon !== 'fa-tag' ? styleHint.icon : 'fa-tags';

                customCats[newCatId] = {
                    id: newCatId,
                    name: cleanCatName,
                    icon: finalIcon,
                    color: randomColor,
                    type: 'expense',
                    parentId: null, // Konsisten dengan skema hierarki customCategories (parent/child)
                    isAutoLearned: true // Penanda bahwa ini hasil buatan AI
                };

                // Tambahkan sementara ke cache agar tidak double jika ada 2 kategori baru yg sama di 1 struk
                existingCats[newCatId] = customCats[newCatId];
                isNewCategoryAdded = true;
                
                // Pastikan item di-update dengan nama yang sudah bersih
                itemsArray[i].kategori_barang = cleanCatName;
            } else {
                // Jika sudah ada, pastikan penulisannya mengikuti database (Mencegah Duplikat)
                const matchedCat = Object.values(existingCats).find(c => c.name && c.name.toLowerCase() === cleanCatName.toLowerCase());
                if (matchedCat) {
                    itemsArray[i].kategori_barang = matchedCat.name;
                }
            }
        }

        if (isNewCategoryAdded) {
            // 1. Update memory lokal (sumber kebenaran: customCategories)
            if (!AuraState.data.settings) AuraState.data.settings = {};
            AuraState.data.settings.customCategories = customCats;
            
            // 2. Tanamkan ke Database Cloud Firebase secara diam-diam (Silent Sync)
            try {
                const { ref, update } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js");
                const { APP_CONFIG } = await import("../config/constants.js");
                
                if (AuraState.user.uid && AuraState.instances.db) {
                    // PERBAIKAN: path disamakan ke settings/customCategories (sebelumnya settings/categories,
                    // sebuah node terpisah yang tidak pernah dibaca oleh modul manapun yang lain).
                    const dbPath = `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/settings/customCategories`;
                    await update(ref(AuraState.instances.db, dbPath), customCats);
                    
                    // Perbarui tampilan Dropdown di seluruh layar
                    this.renderDropdowns();
                    console.log("[AuraFi Auto-Learn] Kategori baru berhasil dipelajari dan diamankan ke Firebase.");
                }
            } catch(e) {
                console.error("[AuraFi Auto-Learn] Gagal sinkronisasi kategori baru:", e);
            }
        }
    }
};

// Global Bindings untuk menjaga fungsionalitas UI HTML lama
window.CategoryManager = CategoryManager;
window.getAllCategories = function() { return CategoryManager.getAllCategories(); };
window.getCategoryStyle = function(name) { return CategoryManager.resolveStyle(name); };
window.getCategoryHexColor = function(name) { return CategoryManager.resolveStyle(name).hex; };
window.renderCategoryDropdowns = function() { return CategoryManager.renderDropdowns(); };
