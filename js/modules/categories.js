/**
 * Dynamic Category Engine (Smart Classification System)
 * Mengelola aturan pencocokan kata kunci kategori bawaan dan custom dari database.
 * Dilengkapi dengan Auto-Learn untuk mempelajari kategori baru dari AI.
 */

import { DEFAULT_SYSTEM_CATEGORIES } from '../config/categories.js';
import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';

/**
 * Kelompok pengeluaran per item — selaras dengan pemisahan di Buku Kas:
 * item berkategori kewajiban (istri, asuransi, nenkin, pajak penghasilan,
 * apato, utilitas rumah, admin pengiriman) dipisahkan dari pengeluaran
 * pribadi, agar pengeluaran pribadi murni bisa dibaca sendiri.
 */
const KEWAJIBAN_ITEM_CATEGORIES = ['istri', 'asuransi', 'nenkin', 'pajak penghasilan', 'apato (sewa)', 'kas apato', 'listrik, air & gas', 'admin pengiriman'];

window.inferKelompokItem = function(kategoriBarang, tipe) {
    if (tipe === 'pemasukan') return 'Pemasukan';
    const key = (kategoriBarang || '').toString().trim().toLowerCase();
    return KEWAJIBAN_ITEM_CATEGORIES.includes(key) ? 'Kewajiban Terpisah' : 'Pribadi';
};

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
    
    // Ikon & warna kategori sistem bersifat PERMANEN dari script
    // (js/config/categories.js). Nilai icon/color tersimpan di Firebase
    // tidak boleh menimpa kategori sistem.
    getSystemStyle: function(catName) {
        if (!catName || typeof catName !== 'string') return null;
        const safeName = catName.toLowerCase().trim();
        const sys = Object.values(DEFAULT_SYSTEM_CATEGORIES).find(function(c) {
            return c.name && c.name.toLowerCase() === safeName;
        });
        return sys ? { icon: sys.icon || 'fa-tag', hex: sys.color || '#52525b', name: sys.name } : null;
    },
    
    resolveStyle: function(catName) {
        const allCats = this.getAllCategories();
        if (!catName || typeof catName !== 'string') {
            return { icon: 'fa-tag', hex: '#52525b', name: 'Lainnya' };
        }

        const safeName = catName.toLowerCase().trim();
        const systemStyle = this.getSystemStyle(catName);
        if (systemStyle) return systemStyle;
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
            { words: ['makan', 'kuliner', 'cemilan', 'snack', 'food', 'resto', 'mie', 'daging', 'sayur'], icon: 'fa-utensils', hex: '#cf8a5f', name: 'Makanan' },
            { words: ['minum', 'kopi', 'teh', 'cafe', 'drink', 'beverage'], icon: 'fa-mug-hot', hex: '#7ea6c9', name: 'Minuman' },
            { words: ['tagihan', 'utilitas', 'listrik', 'air', 'wifi', 'pajak', 'internet', 'bill'], icon: 'fa-file-invoice-dollar', hex: '#7fb2d9', name: 'Utilitas' },
            { words: ['gaji', 'masuk', 'transferan', 'bonus', 'pendapatan', 'income', 'salary'], icon: 'fa-money-bill-wave', hex: '#82b366', name: 'Pemasukan' },
            { words: ['obat', 'sehat', 'dokter', 'klinik', 'rs', 'health', 'hospital'], icon: 'fa-kit-medical', hex: '#d48a8a', name: 'Kesehatan' },
            { words: ['baju', 'pakaian', 'fashion', 'celana', 'sepatu', 'aksesoris'], icon: 'fa-shirt', hex: '#c48bb0', name: 'Pakaian' },
            { words: ['hibur', 'main', 'game', 'bioskop', 'rekreasi', 'entertainment'], icon: 'fa-gamepad', hex: '#a58bd4', name: 'Hiburan' },
            { words: ['online', 'shopee', 'tokopedia', 'amazon', 'gojek', 'grab'], icon: 'fa-box-open', hex: '#a390c9', name: 'Belanja Online' },
            { words: ['transport', 'kereta', 'bus', 'bensin', 'parkir', 'tol', 'travel'], icon: 'fa-train', hex: '#6fa8a0', name: 'Transportasi' },
            { words: ['pokok', 'pasar', 'supermarket', 'groceries', 'mart', 'dapur'], icon: 'fa-basket-shopping', hex: '#a3b86b', name: 'Bahan Pokok' },
            { words: ['elektronik', 'gadget', 'laptop', 'hp', 'device'], icon: 'fa-laptop', hex: '#94a3b8', name: 'Elektronik' },
            { words: ['didik', 'sekolah', 'kursus', 'buku', 'edukasi', 'education'], icon: 'fa-graduation-cap', hex: '#7ea8c4', name: 'Pendidikan' }
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
        // PERBAIKAN: Sebelumnya fungsi ini menganggap 'manual-trx-category',
        // 'add-item-cat', dan 'edit-item-cat' adalah elemen <select> — padahal
        // di HTML-nya ketiganya sudah lama diganti jadi <input type="hidden">
        // yang dikontrol lewat picker kustom (window.openCategoryPicker), bukan
        // dropdown native lagi. 'manual-trx-category' bahkan sudah tidak ada
        // sebagai ID sama sekali (senyap, tidak error). Tapi 'add-item-cat' dan
        // 'edit-item-cat' MASIH ADA sebagai <input> — coba dibaca .options-nya
        // (properti yang cuma dimiliki <select>) selalu error
        // "undefined is not iterable" setiap kali fungsi ini dipanggil.
        // Satu-satunya elemen yang MASIH benar-benar <select> adalah 'filter-category'.
        const allCats = this.getAllCategories();
        let optionsHtml = '';
        
        Object.values(allCats).forEach(function(c) { 
            optionsHtml += `<option value="${c.name}">${c.name}</option>`; 
        });

        AuraUtils.safeDOM('filter-category', function(el) {
            const currentVal = el.value; 
            el.innerHTML = `<option value="ALL">SEMUA KATEGORI</option>` + optionsHtml;
            
            if (currentVal) { 
                const exists = Array.from(el.options).some(function(opt) {
                    return opt.value === currentVal;
                }); 
                if (exists) {
                    el.value = currentVal; 
                }
            }
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
        const autoColors = ['#cf8a5f', '#7ea6c9', '#a3b86b', '#7fb2d9', '#9d8bc4', '#7fb5a8', '#c9a25e', '#cf7d7d', '#8b98a8'];

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
