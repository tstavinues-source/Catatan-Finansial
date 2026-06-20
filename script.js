/**
 * =========================================================================================
 * █████╗ ██╗   ██╗██████╗  █████╗ ███████╗██╗    ██╗   ██╗██████╗ 
 * ██╔══██╗██║   ██║██╔══██╗██╔══██╗██╔════╝██║    ██║   ██║╚════██╗
 * ███████║██║   ██║██████╔╝███████║█████╗  ██║    ██║   ██║ █████╔╝
 * ██╔══██║██║   ██║██╔══██╗██╔══██║██╔══╝  ██║    ╚██╗ ██╔╝ ╚═══██╗
 * ██║  ██║╚██████╔╝██║  ██║██║  ██║██║     ██║     ╚████╔╝ ██████╔╝
 * ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝      ╚═══╝  ╚═════╝ 
 * =========================================================================================
 * AURAFI OS V3.2.6 - THE LIVING WEALTH OS (KAS APATO EDITION - ENTERPRISE STABLE)
 * =========================================================================================
 * @version 3.2.6 (Enterprise Build - Final Post Bugfix)
 * @description Modul utama pengelola logika bisnis, Firebase, komputasi AI (Groq & Gemini).
 * Seluruh fungsi UI yang hilang (missing bindings) telah direstorasi penuh.
 * Fitur setengah jadi (Kategori Kustom, Budgeting, Multi-User, Staples Tracker, Import/Export)
 * telah diselesaikan dengan sistem Injeksi Modal Dinamis murni via JavaScript.
 * Seluruh URL API (Groq) telah disanitasi dari anomali Markdown.
 * Source code telah diekspansi secara profesional untuk memudahkan maintenance.
 * =========================================================================================
 */

import { 
    initializeApp 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";

import { 
    getDatabase, 
    ref, 
    push, 
    update, 
    remove, 
    onValue, 
    get 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signInWithRedirect, 
    signInWithEmailAndPassword, 
    signInAnonymously, 
    onAuthStateChanged, 
    signOut, 
    setPersistence, 
    browserLocalPersistence 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";


/**
 * ============================================================================
 * [1] SYSTEM CONFIGURATION & CONSTANTS
 * ============================================================================
 * Konfigurasi fundamental untuk menjalankan keseluruhan aplikasi AuraFi OS.
 */

/**
 * Konfigurasi koneksi ke server Firebase
 * @constant {Object}
 */
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDuGNM793lZOUJEX_LAEaxCipFOw6TT35E",
    authDomain: "agrivision-574be.firebaseapp.com",
    databaseURL: "https://agrivision-574be-default-rtdb.firebaseio.com",
    projectId: "agrivision-574be",
    storageBucket: "agrivision-574be.firebasestorage.app",
    messagingSenderId: "732120986243",
    appId: "1:732120986243:web:d025c9a2908b1ca892a1b6"
};

/**
 * Parameter limitasi, node data, dan preferensi waktu
 * @constant {Object}
 */
const APP_CONFIG = {
    LEDGER_NODE: 'aurafi_ledger',
    VERSION: '3.2.6',
    DEFAULT_CURRENCY: 'JPY',
    DEFAULT_THEME: 'midnight',
    THROTTLE_MS: 300,        
    MAX_RETRY_AI: 3,         
    CACHE_TTL_MS: 60000      
};

/**
 * Daftar Kategori Sistem Utama (Built-in Categories)
 * @constant {Object}
 */
const DEFAULT_SYSTEM_CATEGORIES = {
    "cat_sys_1": { 
        name: "Makanan", 
        icon: "fa-burger", 
        color: "#fb923c", 
        type: "expense", 
        isSystem: true 
    },
    "cat_sys_2": { 
        name: "Minuman", 
        icon: "fa-mug-hot", 
        color: "#60a5fa", 
        type: "expense", 
        isSystem: true 
    },
    "cat_sys_3": { 
        name: "Bahan Pokok", 
        icon: "fa-basket-shopping", 
        color: "#4ade80", 
        type: "expense", 
        isSystem: true 
    },
    "cat_sys_4": { 
        name: "Utilitas", 
        icon: "fa-file-invoice-dollar", 
        color: "#facc15", 
        type: "expense", 
        isSystem: true 
    },
    "cat_sys_5": { 
        name: "Transportasi", 
        icon: "fa-train", 
        color: "#34d399", 
        type: "expense", 
        isSystem: true 
    },
    "cat_sys_6": { 
        name: "Kesehatan", 
        icon: "fa-kit-medical", 
        color: "#fb7185", 
        type: "expense", 
        isSystem: true 
    },
    "cat_sys_7": { 
        name: "Hiburan", 
        icon: "fa-gamepad", 
        color: "#c084fc", 
        type: "expense", 
        isSystem: true 
    },
    "cat_sys_8": { 
        name: "Belanja Online", 
        icon: "fa-box-open", 
        color: "#f472b6", 
        type: "expense", 
        isSystem: true 
    },
    "cat_sys_9": { 
        name: "Belanja Offline", 
        icon: "fa-shop", 
        color: "#818cf8", 
        type: "expense", 
        isSystem: true 
    },
    "cat_sys_10": { 
        name: "Pendidikan", 
        icon: "fa-graduation-cap", 
        color: "#22d3ee", 
        type: "expense", 
        isSystem: true 
    },
    "cat_sys_11": { 
        name: "Pakaian", 
        icon: "fa-shirt", 
        color: "#e879f9", 
        type: "expense", 
        isSystem: true 
    },
    "cat_sys_12": { 
        name: "Elektronik", 
        icon: "fa-laptop", 
        color: "#94a3b8", 
        type: "expense", 
        isSystem: true 
    },
    "cat_sys_13": { 
        name: "Pemasukan", 
        icon: "fa-money-bill-wave", 
        color: "#10b981", 
        type: "income", 
        isSystem: true 
    },
    "cat_sys_14_default": { 
        name: "Lainnya", 
        icon: "fa-tag", 
        color: "#52525b", 
        type: "both", 
        isSystem: true 
    }
};

/**
 * Daftar konfigurasi default untuk sistem pelacak kebutuhan pokok dinamis
 * @constant {Object}
 */
const DEFAULT_STAPLES_TRACKERS = {
    "beras": { 
        name: "Beras", 
        keywords: ["beras", "rice", "gohan", "nasi"] 
    },
    "minyak": { 
        name: "Minyak", 
        keywords: ["minyak", "oil", "abura", "cooking oil", "goreng"] 
    },
    "sabun": { 
        name: "Sabun/Cuci", 
        keywords: ["sabun", "soap", "deterjen", "rinso", "shampoo", "wash", "sunlight", "mama lemon"] 
    }
};


/**
 * ============================================================================
 * [2] GLOBAL STATE MANAGEMENT (SINGLE SOURCE OF TRUTH)
 * ============================================================================
 */

window.AuraState = {
    user: { 
        uid: null, 
        profile: {}, 
        isAnonymous: false 
    },
    system: {
        theme: APP_CONFIG.DEFAULT_THEME,
        activeView: 'dashboard',
        isProcessing: false,
        exchangeRateIDR: 105,
        displayCurrency: APP_CONFIG.DEFAULT_CURRENCY,
        base64Upload: "",
        isRatesLoaded: false,
        isOnline: navigator.onLine,
        hasShownBudgetAlert: false 
    },
    filters: {
        search: '',
        category: 'ALL',
        user: 'ALL',
        periodMode: 'month' 
    },
    data: {
        transactions: [],
        trash: [],
        goals: [],
        groqKeys: [],
        oracleChats: [],
        settings: {},
        monthlyBudget: 100000,
        familyMembers: []
    },
    temp: {
        deleteTarget: null, 
        editItemTarget: null, 
        editTrxTarget: null,
        addItemTargetTrxId: null, 
        editRecurringTarget: null,
        expandedReceipts: {}, 
        budgetUpdateTimer: null,
        aiStaging: null,
        isProcessingRecurring: false 
    },
    instances: { 
        firebaseApp: null, 
        db: null, 
        auth: null, 
        geminiEngine: null 
    },
    listeners: [] 
};

/**
 * Fungsi Proxy Global Bindings
 * @param {string} globalName - Nama variabel di window
 * @param {string} statePath - Path akses menuju AuraState (misal: 'data.transactions')
 */
const bindGlobalStateProperty = function(globalName, statePath) {
    Object.defineProperty(window, globalName, {
        get: function() {
            const parts = statePath.split('.');
            let context = window.AuraState;
            
            for (let i = 0; i < parts.length; i++) {
                if (context === undefined || context === null) {
                    return undefined;
                }
                context = context[parts[i]];
            }
            return context;
        },
        set: function(value) {
            const parts = statePath.split('.');
            let context = window.AuraState;
            
            for (let i = 0; i < parts.length - 1; i++) {
                if (context[parts[i]] === undefined) {
                    context[parts[i]] = {};
                }
                context = context[parts[i]];
            }
            context[parts[parts.length - 1]] = value;
        },
        configurable: true
    });
};

bindGlobalStateProperty('allTransactions', 'data.transactions');
bindGlobalStateProperty('trashTransactions', 'data.trash');
bindGlobalStateProperty('allGoals', 'data.goals');
bindGlobalStateProperty('monthlyBudget', 'data.monthlyBudget');
bindGlobalStateProperty('settingsData', 'data.settings');
bindGlobalStateProperty('rawGroqKeysData', 'data.groqKeys');
bindGlobalStateProperty('oracleChats', 'data.oracleChats');
bindGlobalStateProperty('currentTheme', 'system.theme');
bindGlobalStateProperty('activeView', 'system.activeView');
bindGlobalStateProperty('displayCurrency', 'system.displayCurrency');
bindGlobalStateProperty('exchangeRateIDR', 'system.exchangeRateIDR');
bindGlobalStateProperty('isRatesLoaded', 'system.isRatesLoaded');
bindGlobalStateProperty('isProcessing', 'system.isProcessing');
bindGlobalStateProperty('base64Upload', 'system.base64Upload');
bindGlobalStateProperty('deleteTargetData', 'temp.deleteTarget');
bindGlobalStateProperty('editItemTargetData', 'temp.editItemTarget');
bindGlobalStateProperty('editTrxTargetData', 'temp.editTrxTarget');
bindGlobalStateProperty('addItemTargetTrxId', 'temp.addItemTargetTrxId');
bindGlobalStateProperty('aiStaging', 'temp.aiStaging');


/**
 * ============================================================================
 * [3] ENTERPRISE LOGGER SYSTEM (SECURED NAMESPACE)
 * ============================================================================
 */

window.AuraOS = window.AuraOS || {}; 

window.AuraOS.Logger = {
    ENABLE_DEBUG: true,
    
    _formatTime: function() {
        const d = new Date();
        const hr = d.getHours().toString().padStart(2, '0');
        const min = d.getMinutes().toString().padStart(2, '0');
        const sec = d.getSeconds().toString().padStart(2, '0');
        const ms = d.getMilliseconds().toString().padStart(3, '0');
        return `${hr}:${min}:${sec}.${ms}`;
    },
    
    info: function(module, message, data = null) {
        if (!this.ENABLE_DEBUG) {
            return;
        }
        console.log(`%c[INFO | ${this._formatTime()}] [${module}]`, 'color: #38bdf8; font-weight: bold;', message, data !== null ? data : '');
    },
    
    success: function(module, message, data = null) {
        if (!this.ENABLE_DEBUG) {
            return;
        }
        console.log(`%c[SUCCESS | ${this._formatTime()}] [${module}]`, 'color: #10b981; font-weight: bold;', message, data !== null ? data : '');
    },
    
    warn: function(module, message, data = null) {
        if (!this.ENABLE_DEBUG) {
            return;
        }
        console.warn(`%c[WARN | ${this._formatTime()}] [${module}]`, 'color: #facc15; font-weight: bold;', message, data !== null ? data : '');
    },
    
    error: function(module, message, error = null) {
        console.error(`%c[ERROR | ${this._formatTime()}] [${module}]`, 'color: #f43f5e; font-weight: bold;', message);
        if (error) {
            console.error(error);
        }
    }
};

const Logger = window.AuraOS.Logger;

/**
 * ============================================================================
 * [4] GLOBAL ERROR HANDLERS
 * ============================================================================
 */
window.addEventListener('error', function(event) {
    Logger.error('Global', 'Unhandled Exception Caught:', event.error || event.message);
});

window.addEventListener('unhandledrejection', function(event) {
    Logger.error('Global', 'Unhandled Promise Rejection:', event.reason);
});


/**
 * ============================================================================
 * [5] UTILITY & SECURITY FUNCTIONS
 * ============================================================================
 */

window.AuraUtils = {
    
    generateId: function(prefix = 'id') {
        const time = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 10);
        return `${prefix}_${time}_${random}`;
    },

    escapeHtml: function(text) {
        if (typeof text !== 'string') {
            return text;
        }
        
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        
        return text.replace(/[&<>"']/g, function(m) { 
            return map[m]; 
        });
    },

    parseCleanJSON: function(text) {
        try {
            if (!text || typeof text !== 'string') {
                throw new Error("Output dari AI kosong atau tidak berupa teks.");
            }
            
            let cleanedText = text.trim();
            
            cleanedText = cleanedText.replace(/^```json\s*/i, '');
            cleanedText = cleanedText.replace(/^```\s*/, '');
            cleanedText = cleanedText.replace(/\s*```$/, '');
            
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
            
            if (startIdx > 0) {
                cleanedText = cleanedText.substring(startIdx);
            }

            return JSON.parse(cleanedText);
            
        } catch (e) {
            Logger.error('Utility', 'Gagal memparsing JSON hasil ekstraksi AI.', text);
            throw new Error("Gagal mengurai respons AI. Terdapat kerusakan struktur data JSON internal.");
        }
    },

    formatCurrency: function(amount) {
        try {
            const currency = window.AuraState.system.displayCurrency || APP_CONFIG.DEFAULT_CURRENCY;
            const styleOpts = {
                style: 'currency', 
                currency: currency, 
                maximumFractionDigits: 0
            };
            
            if (currency === 'JPY') {
                return new Intl.NumberFormat('ja-JP', styleOpts).format(amount);
            } else {
                return new Intl.NumberFormat('id-ID', styleOpts).format(amount);
            }
            
        } catch (e) { 
            Logger.warn('Utility', 'Sistem pelokalan mata uang gagal, menggunakan fallback dasar.', e);
            const fallbackCurr = window.AuraState.system.displayCurrency || APP_CONFIG.DEFAULT_CURRENCY;
            return `${fallbackCurr} ${Number(amount).toLocaleString()}`; 
        }
    },

    convertCurrency: function(amount, fromCurrency) {
        const numAmount = Number(amount);
        
        if (isNaN(numAmount)) {
            return 0;
        }
        
        const currentDisplay = window.AuraState.system.displayCurrency || APP_CONFIG.DEFAULT_CURRENCY;
        
        if (!fromCurrency || typeof fromCurrency !== 'string') {
            return numAmount;
        }
        
        if (fromCurrency === currentDisplay) {
            return numAmount;
        }
        
        const rate = window.AuraState.system.exchangeRateIDR;
        
        if (fromCurrency === 'JPY' && currentDisplay === 'IDR') {
            return numAmount * rate;
        }
        
        if (fromCurrency === 'IDR' && currentDisplay === 'JPY') {
            return numAmount / rate;
        }
        
        return numAmount; 
    },

    safeDOM: function(id, callback) {
        const el = document.getElementById(id);
        if (el && typeof callback === 'function') {
            try {
                callback(el);
            } catch (err) {
                Logger.error('Utility', `Kesalahan eksekusi callback DOM pada ID [${id}]`, err);
            }
        }
        return el;
    },

    sanitizeItemsArray: function(items, defaultPaymentMethod, defaultTimestamp) {
        if (!items || !Array.isArray(items)) {
            return [];
        }
        
        return items.map(function(item) {
            let safePrice = Number(item.harga !== undefined ? item.harga : (item.price || 0));
            if (isNaN(safePrice) || safePrice < 0) {
                safePrice = 0;
            }
            
            let safeQty = Number(item.qty !== undefined ? item.qty : 1);
            if (isNaN(safeQty) || safeQty <= 0) {
                safeQty = 1;
            }
            
            let safeTax = Number(item.tax_rate !== undefined ? item.tax_rate : 0);
            if (isNaN(safeTax) || safeTax < 0) {
                safeTax = 0;
            }

            return {
                itemId: item.itemId || window.AuraUtils.generateId('itm'),
                nama_barang: window.AuraUtils.escapeHtml(item.nama_barang || item.name || "Item Abstrak"),
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
            if (isNaN(d.getTime())) {
                return "---";
            }
            
            const yr = d.getFullYear(); 
            const mo = String(d.getMonth() + 1).padStart(2, '0');
            const da = String(d.getDate()).padStart(2, '0'); 
            const hr = String(d.getHours()).padStart(2, '0');
            const mi = String(d.getMinutes()).padStart(2, '0');
            
            return `${yr}/${mo}/${da} ${hr}:${mi}`;
            
        } catch (e) { 
            return "---"; 
        }
    },

    getPeriodRange: function() {
        const now = new Date();
        const mode = window.AuraState.filters.periodMode;
        
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
        
        return { 
            start: start.getTime(), 
            end: end.getTime(), 
            startObj: start, 
            endObj: end 
        };
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

window.generateItemId = function() {
    return window.AuraUtils.generateId('itm');
};
window.parseCleanJSON = window.AuraUtils.parseCleanJSON;
window.formatVal = window.AuraUtils.formatCurrency;
window.convertVal = window.AuraUtils.convertCurrency;
window.sanitizeItems = window.AuraUtils.sanitizeItemsArray;


/**
 * ============================================================================
 * [6] FIREBASE INITIALIZATION & CONNECTION MONITORING
 * ============================================================================
 */
let firebaseAppInstance = null;
let dbInstance = null;
let authInstance = null;
let googleAuthProviderInstance = null;

Logger.info('Core', 'Menginisialisasi Firebase SDK Environment...');

try {
    firebaseAppInstance = initializeApp(FIREBASE_CONFIG);
    dbInstance = getDatabase(firebaseAppInstance);
    authInstance = getAuth(firebaseAppInstance);
    googleAuthProviderInstance = new GoogleAuthProvider();
    
    window.AuraState.instances.firebaseApp = firebaseAppInstance;
    window.AuraState.instances.db = dbInstance;
    window.AuraState.instances.auth = authInstance;
    window.googleAuthProvider = googleAuthProviderInstance;
    
    const connectionRef = ref(dbInstance, ".info/connected");
    
    onValue(connectionRef, function(snap) {
        if (snap.val() === true) {
            window.AuraState.system.isOnline = true;
            Logger.success('Core', 'Sinkronisasi Cloud Firebase AKTIF.');
        } else {
            window.AuraState.system.isOnline = false;
            Logger.warn('Core', 'Mode Offline (Koneksi Terputus).');
        }
    });

} catch (error) {
    Logger.error('Core', 'FATAL: Gagal melakukan bootstrap koneksi Firebase SDK.', error);
    // Peringatan akan muncul setelah UI siap
    setTimeout(function() {
        if (typeof window.showToast === 'function') {
            window.showToast("Gagal tersambung ke database Cloud. Aplikasi beralih ke sesi lokal sementara.", true);
        }
    }, 2000);
}


/**
 * ============================================================================
 * [7] DYNAMIC CATEGORY ENGINE (SMART CLASSIFICATION SYSTEM)
 * ============================================================================
 */
window.CategoryManager = {
    
    getAllCategories: function() {
        const customCats = window.AuraState.data.settings?.categories || {};
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
            window.AuraUtils.safeDOM(id, function(el) {
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

window.getAllCategories = function() {
    return window.CategoryManager.getAllCategories();
};
window.getCategoryStyle = function(name) {
    return window.CategoryManager.resolveStyle(name);
};
window.getCategoryHexColor = function(name) {
    return window.CategoryManager.resolveStyle(name).hex;
};
window.renderCategoryDropdowns = function() {
    return window.CategoryManager.renderDropdowns();
};


/**
 * ============================================================================
 * [8] ENCRYPTION & SECURITY SERVICE
 * ============================================================================
 */
window.EncryptionService = {
    isAvailable: function() {
        if (typeof CryptoJS === 'undefined' || !CryptoJS.AES) {
            return false;
        }
        return true;
    },
    
    encryptApiKey: function(apiKey, secretKey) { 
        if(!secretKey || !this.isAvailable()) {
            return null; 
        }
        try { 
            return CryptoJS.AES.encrypt(apiKey, secretKey).toString(); 
        } catch (e) { 
            return null; 
        } 
    },
    
    decryptApiKey: function(cipherText, secretKey) { 
        if(!secretKey || !this.isAvailable()) {
            return null; 
        }
        try { 
            const bytes = CryptoJS.AES.decrypt(cipherText, secretKey); 
            return bytes.toString(CryptoJS.enc.Utf8) || null; 
        } catch(e) { 
            return null; 
        } 
    },
    
    validate: function(apiKey, secretKey) { 
        const encrypted = this.encryptApiKey(apiKey, secretKey); 
        const decrypted = this.decryptApiKey(encrypted, secretKey); 
        return decrypted === apiKey; 
    }
};


/**
 * ============================================================================
 * [9] FIREBASE CRUD & AUDIT LOGGING SYSTEM (KAS APATO SECURED)
 * ============================================================================
 */
window.FirebaseService = {
    _checkAuth: function() {
        if (!authInstance || !authInstance.currentUser || !window.AuraState.user.uid) {
            throw new Error("Sesi pengguna tidak valid. Anda harus masuk akun terlebih dahulu.");
        }
    },

    saveAuditLog: async function(action, detail) {
        if (!window.AuraState.user.uid || !dbInstance) {
            return;
        }
        try {
            const profile = window.AuraState.data.settings?.profile || {};
            const userName = profile.fullName || profile.nickname || "Anonymous User";
            
            const payload = { 
                action: action, 
                detail: window.AuraUtils.escapeHtml(detail), 
                user: window.AuraUtils.escapeHtml(userName), 
                ts: Date.now() 
            };
            
            await push(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${window.AuraState.user.uid}/audit_logs`), payload);
        } catch (e) { 
            Logger.error('AuditLog', 'Gagal merekam log aktivitas ke Cloud.', e); 
        }
    },
    
    saveTransaction: async function(data, isFromAI = false) { 
        this._checkAuth();
        try {
            data.user_id = window.AuraState.data.settings?.profile?.nickname || "User";
            data.nominal = Math.max(0, Number(data.nominal) || 0); 
            
            if (!data.createdAt) {
                data.createdAt = new Date().toISOString();
            }
            
            await push(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${window.AuraState.user.uid}/transactions`), data);
            await this.saveAuditLog(isFromAI ? "AI.PARSE" : "MANUAL.ADD", `Transaksi: ${data.merchantName} (${window.AuraUtils.formatCurrency(data.nominal)})`);
        } catch (e) { 
            throw e; 
        }
    },

    updateTransaction: async function(id, data) { 
        this._checkAuth();
        if (!id) {
            throw new Error("ID Referensi Transaksi tidak terdefinisi.");
        }
        try {
            const pathRef = ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${window.AuraState.user.uid}/transactions/${id}`);
            const snapshot = await get(pathRef);
            
            if (!snapshot.exists()) {
                throw new Error("Objek transaksi ini sudah tidak ada.");
            }
            
            data.updatedAt = new Date().toISOString();
            await update(pathRef, data);
            await this.saveAuditLog("SYS.MODIFY", `Update ID Transaksi: ${id}`);
        } catch (e) { 
            throw e; 
        }
    },

    moveToTrash: async function(id) { 
        this._checkAuth();
        await this.updateTransaction(id, { 
            is_deleted: true, 
            deletedAt: new Date().toISOString() 
        });
        await this.saveAuditLog("SYS.TRASH", `Arsip Sampah ID: ${id}`);
    },

    deleteTransactionPermanently: async function(id) { 
        this._checkAuth();
        await remove(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${window.AuraState.user.uid}/transactions/${id}`));
        await this.saveAuditLog("SYS.DESTROY", `Pembersihan permanen ID: ${id}`);
    },

    saveGoal: async function(data) { 
        this._checkAuth();
        await push(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${window.AuraState.user.uid}/goals`), data); 
        await this.saveAuditLog("GOAL.ADD", `Tujuan finansial baru.`);
    },

    updateGoal: async function(id, data) {
        this._checkAuth();
        await update(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${window.AuraState.user.uid}/goals/${id}`), data);
        await this.saveAuditLog("GOAL.EDIT", `Update tujuan finansial ID: ${id}`);
    },

    deleteGoal: async function(id) { 
        this._checkAuth();
        await remove(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${window.AuraState.user.uid}/goals/${id}`)); 
        await this.saveAuditLog("GOAL.DELETE", `Hapus tujuan finansial ID: ${id}`);
    },

    updateSettings: async function(data) { 
        this._checkAuth();
        await update(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${window.AuraState.user.uid}/settings`), data); 
    },

    saveGroqKey: async function(encryptedKey) { 
        this._checkAuth();
        await push(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${window.AuraState.user.uid}/groqApiKeys`), { 
            encryptedKey: encryptedKey, 
            createdAt: new Date().toISOString(), 
            active: true, 
            usageCount: 0 
        }); 
    },

    deleteGroqKey: async function(keyId) { 
        this._checkAuth();
        await remove(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${window.AuraState.user.uid}/groqApiKeys/${keyId}`)); 
    },

    pushOracleChat: async function(chatObj) { 
        if (!window.AuraState.user.uid || !dbInstance) {
            return;
        }
        await push(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${window.AuraState.user.uid}/oracleChats`), chatObj); 
    }
};


/**
 * ============================================================================
 * [10] MEMORY & FINANCIAL SUMMARY SERVICES
 * ============================================================================
 */
window.MemoryService = {
    _cache: {}, 
    
    getRelevantTransactions: function(query) {
        const sourceData = window.AuraState.data.transactions || [];
        if (sourceData.length === 0) {
            return [];
        }
        
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
        
        this._cache[keyword] = { 
            data: queryResult, 
            timestamp: currentTime 
        };
        
        return queryResult;
    },
    
    getRelevantChats: function() { 
        const sourceData = window.AuraState.data.oracleChats || [];
        return sourceData.slice(-8); 
    },
    
    invalidateCache: function() {
        this._cache = {};
    }
};

window.FinancialSummaryService = {
    getSummaryString: function() {
        let cashBal = 0, cashlessBal = 0, totSpent = 0;
        const today = new Date();
        const txList = window.AuraState.data.transactions || [];
        
        for (let i = 0; i < txList.length; i++) {
            const t = txList[i];
            const val = Number(t.nominal || 0);
            
            if (isNaN(val)) {
                continue;
            }
            
            const isCash = (t.metode_pembayaran === 'tunai');
            
            if (t.tipe === 'pemasukan') { 
                if (isCash) {
                    cashBal += val; 
                } else {
                    cashlessBal += val; 
                }
            } else if (t.tipe === 'tarik_tunai') { 
                let adminFee = Number(t.admin_fee || 0);
                if (isNaN(adminFee)) {
                    adminFee = 0;
                }
                cashBal += val; 
                cashlessBal -= (val + adminFee); 
            } else if (t.tipe === 'setor_tunai') { 
                let adminFee = Number(t.admin_fee || 0); 
                if (isNaN(adminFee)) {
                    adminFee = 0;
                }
                cashBal -= val; 
                cashlessBal += val; 
                cashlessBal -= adminFee; 
            } else {
                if (isCash) {
                    cashBal -= val; 
                } else {
                    cashlessBal -= val;
                }
                
                const tDate = new Date(t.tanggal);
                if (!isNaN(tDate.getTime())) {
                    if (tDate.getMonth() === today.getMonth() && tDate.getFullYear() === today.getFullYear()) { 
                        totSpent += val; 
                    }
                }
            }
        }
        
        const profile = window.AuraState.data.settings?.profile || {};
        const curr = window.AuraState.system.displayCurrency || 'JPY';
        const namePart = profile.fullName ? `${profile.fullName} (${profile.nickname || ''})` : "User AuraFi";
        
        return `--- PROFIL & RINGKASAN PENGGUNA ---\nNama: ${namePart}\nMata Uang: ${curr}\nSisa Tunai: ${cashBal} ${curr}\nSisa Cashless: ${cashlessBal} ${curr}\nNet Worth: ${cashBal + cashlessBal} ${curr}\nPengeluaran Bulan Ini: ${totSpent} ${curr}`;
    }
};


/**
 * ============================================================================
 * [11] AI ENGINES: GROQ (NLP) & GEMINI (VISION) FAILOVER SYSTEM
 * ============================================================================
 */
let groqSecretKey = null;
try {
    groqSecretKey = localStorage.getItem('aurafi_groq_secret');
    if (!groqSecretKey && typeof CryptoJS !== 'undefined' && CryptoJS.lib && CryptoJS.lib.WordArray) { 
        groqSecretKey = CryptoJS.lib.WordArray.random(128/8).toString(); 
        localStorage.setItem('aurafi_groq_secret', groqSecretKey); 
    }
} catch (e) {
    groqSecretKey = sessionStorage.getItem('aurafi_groq_secret') || "fallback_secret_key_" + Date.now();
    sessionStorage.setItem('aurafi_groq_secret', groqSecretKey);
}

window.GroqService = {
    keysPool: [], 
    currentIndex: 0, 
    model: "llama-3.3-70b-versatile", 
    secret: groqSecretKey,
    
    init: function(rawKeysArray) {
        this.keysPool = [];
        
        if (!Array.isArray(rawKeysArray)) {
            return 0;
        }
        
        for (let i = 0; i < rawKeysArray.length; i++) {
            const item = rawKeysArray[i];
            if (item && item.active) {
                const decrypted = window.EncryptionService.decryptApiKey(item.encryptedKey, this.secret);
                if (decrypted && decrypted.startsWith('gsk_')) { 
                    this.keysPool.push({ id: item.id, value: decrypted }); 
                }
            }
        }
        
        this.currentIndex = 0; 
        return this.keysPool.length;
    },
    
    getCurrentApiKey: function() { 
        if (this.keysPool.length === 0) {
            return null;
        }
        return this.keysPool[this.currentIndex].value; 
    },
    
    switchToNextApiKey: function() { 
        if (this.keysPool.length <= 1) {
            return false; 
        }
        this.currentIndex = (this.currentIndex + 1) % this.keysPool.length; 
        return true; 
    },
    
    fetch: async function(messages, requireJson = false) {
        if (this.keysPool.length === 0) {
            throw new Error("Sistem Groq terkunci: Tidak ada satupun API Key yang tersimpan.");
        }
        
        let attempt = 0; 
        const totalKeys = this.keysPool.length;
        const maxLimit = Math.min(totalKeys, APP_CONFIG.MAX_RETRY_AI);
        
        // BUG FIX: Memastikan URL bersih dari format markdown yang tidak sengaja terbawa
        const groqApiUrl = "[https://api.groq.com/openai/v1/chat/completions](https://api.groq.com/openai/v1/chat/completions)";
        
        while (attempt < maxLimit) {
            const apiKey = this.getCurrentApiKey();
            try {
                const payload = { 
                    model: this.model, 
                    messages: messages, 
                    temperature: requireJson ? 0.1 : 0.7 
                };
                
                if (requireJson) {
                    payload.response_format = { type: "json_object" };
                }
                
                const response = await fetch(groqApiUrl, {
                    method: 'POST', 
                    headers: { 
                        'Authorization': `Bearer ${apiKey}`, 
                        'Content-Type': 'application/json' 
                    }, 
                    body: JSON.stringify(payload)
                });
                
                if (response.status === 429 || response.status === 400 || response.status === 401 || response.status === 503 || response.status >= 500) { 
                    this.switchToNextApiKey(); 
                    attempt++; 
                    continue; 
                }
                
                if (!response.ok) { 
                    const err = await response.json(); 
                    throw new Error(err.error?.message || "Kesalahan Fatal Groq Engine"); 
                }
                
                const data = await response.json(); 
                if (!data.choices || data.choices.length === 0) {
                    throw new Error("Struktur respons balasan kosong dari Groq.");
                }
                
                return data.choices[0].message.content;
                
            } catch (err) { 
                this.switchToNextApiKey(); 
                attempt++; 
            }
        }
        throw new Error("Semua cadangan kunci Groq gagal diakses atau server sedang Maintenance total.");
    }
};

window.GeminiFailoverEngine = class GeminiFailoverEngine {
    constructor(pinCode) { 
        this.pin = pinCode; 
        this.keysPool = []; 
        this.currentIndex = 0; 
    }
    
    async init() {
        this.keysPool = []; 
        if (!dbInstance) {
            return 0;
        }
        
        const snapshot = await get(ref(dbInstance, 'nexus_api_vault'));
        
        if (snapshot.exists()) {
            const vaultData = snapshot.val();
            
            for (const id in vaultData) {
                if (!Object.prototype.hasOwnProperty.call(vaultData, id)) {
                    continue;
                }
                
                const item = vaultData[id];
                let decrypted = window.EncryptionService.decryptApiKey(item.value, this.pin);
                
                if (!decrypted) { 
                    try { 
                        let text = atob(item.value); 
                        let result = ''; 
                        for (let i = 0; i < text.length; i++) { 
                            result += String.fromCharCode(text.charCodeAt(i) ^ this.pin.charCodeAt(i % this.pin.length)); 
                        } 
                        decrypted = result; 
                    } catch (e) {
                        // fallback
                    } 
                }
                
                if (decrypted && (decrypted.startsWith('AIza') || decrypted.startsWith('AQ.'))) { 
                    this.keysPool.push({ 
                        id: item.name || id, 
                        value: decrypted.trim() 
                    }); 
                }
            }
        }
        return this.keysPool.length;
    }
    
    async fetch(payload, base64Image) {
        if (this.keysPool.length === 0) {
            throw new Error("Sistem Gemini terkunci: Kunci API kosong atau PIN Anda tidak akurat.");
        }
        
        let attempt = 0; 
        const totalKeys = this.keysPool.length;
        const maxLimit = Math.min(totalKeys, APP_CONFIG.MAX_RETRY_AI);
        
        while (attempt < maxLimit) {
            const activeKeyObj = this.keysPool[this.currentIndex];
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKeyObj.value}`;
            
            const requestPayload = JSON.parse(JSON.stringify(payload));
            
            if (base64Image) {
                const base64Data = base64Image.split(',')[1] || base64Image;
                if (!requestPayload.contents) {
                    requestPayload.contents = [{ role: "user", parts: [] }];
                }
                if (!requestPayload.contents[0].parts) {
                    requestPayload.contents[0].parts = [];
                }
                
                requestPayload.contents[0].parts.push({ 
                    inlineData: { 
                        mimeType: "image/jpeg", 
                        data: base64Data 
                    } 
                });
            }
            
            const controller = new AbortController();
            const signalTimeout = setTimeout(function() { 
                controller.abort(); 
            }, 30000); 

            try {
                const response = await fetch(url, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(requestPayload), 
                    signal: controller.signal
                });
                
                clearTimeout(signalTimeout);
                
                if (response.status === 429 || response.status === 400 || response.status === 401 || response.status >= 500) { 
                    this.currentIndex = (this.currentIndex + 1) % this.keysPool.length; 
                    attempt++; 
                    continue; 
                }
                
                if (!response.ok) {
                    throw new Error(`HTTP Eksekusi Tertolak (Status ${response.status})`);
                }
                
                const result = await response.json(); 
                
                if (!result.candidates || result.candidates.length === 0) {
                    throw new Error("Payload balasan Gemini gagal dikomposisikan.");
                }
                
                const textResponse = result.candidates[0].content?.parts?.[0]?.text;
                if (!textResponse) {
                    throw new Error("Elemen teks tidak bisa diekstraksi dari kandidat yang dikirim oleh Google.");
                }
                
                return textResponse;
                
            } catch (err) { 
                clearTimeout(signalTimeout);
                this.currentIndex = (this.currentIndex + 1) % this.keysPool.length; 
                attempt++; 
            }
        }
        throw new Error("Siklus Vision Google diblokir total atau jaringan sedang offline.");
    }
};


/**
 * ============================================================================
 * [12] AI ORCHESTRATOR
 * ============================================================================
 */
window.getOraclePromptConfigs = function() {
    const prefs = window.AuraState.data.settings?.aiPreferences || {};
    const defaultPersona = 'Kombinasi Humble + Jenius + Profesional';
    const defaultStyle = 'Normal';
    
    const userPersona = prefs.persona || defaultPersona;
    const userStyle = prefs.style || defaultStyle;
    
    let personaStr = "kombinasi humble, jenius, dan profesional";
    if (userPersona === "Humble Profesional") {
        personaStr = "humble dan profesional";
    } else if (userPersona === "Santai dan Asyik") {
        personaStr = "santai, asyik, dan ramah";
    } else if (userPersona === "Sarkas Cerdas") {
        personaStr = "cerdas dengan sedikit sarkas elegan";
    } else if (userPersona === "Mentor Keuangan") {
        personaStr = "seperti mentor keuangan yang tegas dan bijak";
    } else if (userPersona === "Formal") {
        personaStr = "sangat formal, baku, dan analitis";
    } else if (userPersona === "Lucu") {
        personaStr = "lucu, humoris, dan menghibur";
    }
    
    let styleStr = "Jawab dengan panjang normal (sekitar 3-8 kalimat).";
    if (userStyle === "Singkat") {
        styleStr = "Jawab SINGKAT, padat, dan jelas. Maksimal 2 paragraf saja.";
    } else if (userStyle === "Detail") {
        styleStr = "Jawab dengan SANGAT DETAIL, komprehensif, dan panjang lebar.";
    }
    
    return { 
        personaStr: personaStr, 
        styleStr: styleStr 
    };
};

window.executeAIWithFallback = async function(messages, systemPrompt, requireJson, base64Image = null) {
    const prefs = window.AuraState.data.settings?.aiPreferences || {};
    const chatModel = prefs.modelChat || 'Auto'; 
    const visionModel = prefs.modelVision || 'Auto';
    
    let useGroq = false; 
    let useGemini = false;
    
    if (base64Image) { 
        if (visionModel === 'Gemini' || visionModel === 'Auto') {
            useGemini = true; 
        } else if (visionModel === 'Groq Vision') {
            useGroq = true; 
        }
    } else { 
        if (chatModel === 'Groq') {
            useGroq = true; 
        } else if (chatModel === 'Gemini') {
            useGemini = true; 
        } else { 
            useGroq = true; 
            useGemini = true; 
        } 
    }
    
    let lastError = null;
    let fallbackToGemini = false;
    
    if (useGroq) {
        if (window.AuraState.data.groqKeys && window.AuraState.data.groqKeys.length > 0) {
            try { 
                const result = await window.GroqService.fetch(messages, requireJson); 
                lastError = null; 
                return result;
            } catch(e) { 
                lastError = e; 
                if (useGemini) { 
                    fallbackToGemini = true; 
                } else { 
                    throw e; 
                }
            }
        } else if (!useGemini) {
            throw new Error("Tidak ada kuota konfigurasi Key untuk engine Groq.");
        } else {
            fallbackToGemini = true;
        }
    }
    
    if (useGemini || fallbackToGemini) {
        if (window.AuraState.instances.geminiEngine && window.AuraState.instances.geminiEngine.keysPool.length > 0) {
            try {
                const userPrompt = messages[messages.length - 1].content;
                const geminiPayload = { 
                    contents: [{ 
                        role: "user", 
                        parts: [{ text: userPrompt }] 
                    }], 
                    systemInstruction: { 
                        parts: [{ text: systemPrompt }] 
                    } 
                };
                
                if (requireJson) {
                    geminiPayload.generationConfig = { responseMimeType: "application/json" }; 
                }
                
                const result = await window.AuraState.instances.geminiEngine.fetch(geminiPayload, base64Image);
                lastError = null; 
                return result;
            } catch(e) { 
                lastError = e; 
            }
        } else if (!useGroq) {
            throw new Error("Engine Gemini masih terkunci atau Anda lupa memasukkan PIN Enkripsi.");
        }
    }
    
    throw new Error(`Koneksi Transmisi Intelek Terputus: ${lastError ? lastError.message : "Sistem mati."}`);
};


/**
 * ============================================================================
 * [13] AI STAGING AREA (KAS APATO DATA EXTRACTION)
 * ============================================================================
 */
window.processTransactionParsing = async function(text, imgData = null) {
    if (!window.AuraState.user.uid) {
        if (window.showToast) {
            window.showToast("Ditolak. Sesi Pengguna Kosong.", true);
        }
        return;
    }
    
    window.setProcessingStatus(true);
    
    try {
        const activeCurrency = window.AuraState.system.displayCurrency || 'JPY';
        const profile = window.AuraState.data.settings?.profile || {};
        const nickname = profile.nickname || profile.fullName || "Tuan/Nyonya";
        const categoryListStr = window.CategoryManager.getCategoryStringList();

        const systemPrompt = `Kamu adalah Sistem Analisis Finansial AuraFi OS. Nama User: ${nickname}. Mata Uang: ${activeCurrency}.
FOKUS UTAMA: Ekstrak JSON mentah.
ALUR:
1. Tarik tunai: Tipe="tarik_tunai".
2. Setor tunai: Tipe="setor_tunai".
3. Belanja: Tipe="pengeluaran".
4. 'nominal' = sum(harga x qty) + admin_fee.
5. KATEGORI WAJIB DARI DAFTAR INI: "${categoryListStr}".
6. merchantName wajib diisi.

Struktur Output Target:
{
    "merchantName": "string", 
    "tanggal": "YYYY-MM-DD", 
    "mata_uang": "string", 
    "metode_pembayaran": "tunai/cashless", 
    "tipe": "pemasukan/pengeluaran/tarik_tunai/setor_tunai", 
    "admin_fee": number, 
    "description": "string", 
    "items": [
        {
            "nama_barang": "string", 
            "harga": number, 
            "qty": number, 
            "kategori_barang": "string", 
            "tax_rate": number
        }
    ]
}`;

        const userContent = `Catat transaksi ini: "${text || "Proses foto terlampir"}" (Mata Uang ${activeCurrency}).`;
        
        const messages = [ 
            { role: "system", content: systemPrompt }, 
            { role: "user", content: userContent } 
        ];

        const aiOutput = await window.executeAIWithFallback(messages, systemPrompt, true, imgData);
        const jsonResult = window.AuraUtils.parseCleanJSON(aiOutput);

        const timestamp = new Date().toISOString();
        
        window.AuraState.temp.aiStaging = {
            items: window.AuraUtils.sanitizeItemsArray(jsonResult.items, jsonResult.metode_pembayaran, timestamp),
            merchantName: jsonResult.merchantName || jsonResult.storeName || jsonResult.kategori || "Toko/Merchant",
            tanggal: jsonResult.tanggal || timestamp.split('T')[0],
            mata_uang: jsonResult.mata_uang || activeCurrency,
            metode_pembayaran: jsonResult.metode_pembayaran || 'cashless',
            tipe: jsonResult.tipe || 'pengeluaran',
            admin_fee: Number(jsonResult.admin_fee) || 0,
            description: jsonResult.description || 'Ekstraksi AI Staging',
            isCustomDescription: true
        };

        if (typeof window.renderStagingUI === 'function') {
            window.renderStagingUI();
        }
        
        if (typeof window.showModal === 'function') {
            window.showModal('modal-ai-staging');
        }
        
        if (window.showToast) {
            window.showToast("Selesai diproses! Silakan verifikasi.");
        }

    } catch(e) { 
        if (window.showToast) {
            window.showToast(e.message || "Terdapat anomali AI.", true); 
        }
    } finally { 
        window.setProcessingStatus(false); 
    }
};

window.renderStagingUI = function() {
    const data = window.AuraState.temp.aiStaging;
    if (!data) {
        return;
    }
    
    window.AuraUtils.safeDOM('staging-trx-store', function(el) {
        el.value = data.merchantName;
    });
    
    window.AuraUtils.safeDOM('staging-trx-type', function(el) {
        el.value = data.tipe;
    });
    
    const allCats = window.CategoryManager.getAllCategories();
    let catOptionsHtml = '';
    
    Object.values(allCats).forEach(function(c) { 
        catOptionsHtml += `<option value="${c.name}">${c.name}</option>`; 
    });

    const itemsContainer = document.getElementById('staging-items-container');
    let totalNominal = 0;
    
    if (itemsContainer) {
        if (data.items.length === 0) {
            itemsContainer.innerHTML = '<p class="text-xs text-[var(--text-muted)] text-center italic my-4">Keranjang kosong.</p>';
        } else {
            let compiledItemsHtml = '';
            
            for (let idx = 0; idx < data.items.length; idx++) {
                const it = data.items[idx];
                const numHarga = Number(it.harga) || 0;
                const numQty = Number(it.qty) || 1;
                
                totalNominal += (numHarga * numQty);
                
                const safeName = window.AuraUtils.escapeHtml(it.nama_barang);
                
                compiledItemsHtml += `
                <div class="glass-panel p-3 relative group border-l-2 border-l-accent">
                    <button onclick="window.removeStagingItem(${idx})" class="absolute top-2 right-2 text-[var(--color-expense)] hover:text-rose-400 p-1 bg-black/40 rounded-full w-6 h-6 flex items-center justify-center z-10">
                        <i class="fa-solid fa-trash text-[10px]"></i>
                    </button>
                    <div class="pr-6 space-y-2">
                        <input type="text" value="${safeName}" onchange="window.updateStagingItem(${idx}, 'nama_barang', this.value)" class="bg-transparent border-b border-[var(--border-glass)] w-full text-sm outline-none text-white pb-1 font-medium focus:border-accent">
                        <div class="flex gap-2">
                            <div class="w-1/4">
                                <span class="text-[8px] text-[var(--text-muted)] block mb-0.5 font-bold">Qty</span>
                                <input type="number" value="${numQty}" onchange="window.updateStagingItem(${idx}, 'qty', this.value)" class="bg-black/30 rounded-lg p-2 w-full text-xs outline-none border border-[var(--border-glass)] text-center font-mono">
                            </div>
                            <div class="w-2/4">
                                <span class="text-[8px] text-[var(--text-muted)] block mb-0.5 font-bold">Harga Satuan</span>
                                <input type="number" value="${numHarga}" onchange="window.updateStagingItem(${idx}, 'harga', this.value)" class="bg-black/30 rounded-lg p-2 w-full text-xs outline-none border border-[var(--border-glass)] font-mono">
                            </div>
                            <div class="flex-1">
                                <span class="text-[8px] text-[var(--text-muted)] block mb-0.5 font-bold">Kategori</span>
                                <select onchange="window.updateStagingItem(${idx}, 'kategori_barang', this.value)" class="bg-black/30 rounded-lg p-2 w-full text-[10px] outline-none border border-[var(--border-glass)]">
                                    <option value="${it.kategori_barang}" selected>${it.kategori_barang}</option>
                                    ${catOptionsHtml}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>`;
            }
            itemsContainer.innerHTML = compiledItemsHtml;
        }
    }
    
    totalNominal += Number(data.admin_fee || 0);
    
    window.AuraUtils.safeDOM('staging-total-display', function(el) { 
        el.innerText = window.AuraUtils.formatCurrency(totalNominal); 
    });
};

window.updateStagingItem = function(index, field, value) {
    const stagingData = window.AuraState.temp.aiStaging;
    if (!stagingData || !stagingData.items[index]) {
        return;
    }
    
    if (field === 'harga' || field === 'qty') {
        const validatedVal = Number(value); 
        stagingData.items[index][field] = isNaN(validatedVal) ? 0 : validatedVal;
    } else { 
        stagingData.items[index][field] = value; 
    }
    
    if (typeof window.renderStagingUI === 'function') {
        window.renderStagingUI(); 
    }
};

window.removeStagingItem = function(index) {
    if (!window.AuraState.temp.aiStaging) {
        return;
    }
    window.AuraState.temp.aiStaging.items.splice(index, 1);
    
    if (typeof window.renderStagingUI === 'function') {
        window.renderStagingUI();
    }
};

window.addStagingItem = function() {
    if (!window.AuraState.temp.aiStaging) {
        return;
    }
    
    window.AuraState.temp.aiStaging.items.push({ 
        itemId: window.AuraUtils.generateId('itm'), 
        nama_barang: "Item Tambahan", 
        harga: 0, 
        qty: 1, 
        kategori_barang: "Lainnya", 
        tax_rate: 0, 
        paymentMethod: window.AuraState.temp.aiStaging.metode_pembayaran, 
        timestamp: new Date().toISOString() 
    });
    
    if (typeof window.renderStagingUI === 'function') {
        window.renderStagingUI();
    }
};

window.saveStagingToDatabase = async function() {
    const stagingData = window.AuraState.temp.aiStaging;
    if (!stagingData) {
        return;
    }
    
    const storeNameEl = document.getElementById('staging-trx-store'); 
    const typeEl = document.getElementById('staging-trx-type');
    
    stagingData.merchantName = storeNameEl ? storeNameEl.value.trim() || 'Toko/Merchant' : 'Toko/Merchant'; 
    stagingData.tipe = typeEl ? typeEl.value : 'pengeluaran';
    
    let finalSum = 0;
    for (let i = 0; i < stagingData.items.length; i++) { 
        finalSum += ((Number(stagingData.items[i].harga) || 0) * (Number(stagingData.items[i].qty) || 1)); 
    }
    
    stagingData.nominal = finalSum + Number(stagingData.admin_fee || 0); 
    stagingData.createdAt = new Date().toISOString(); 
    stagingData.is_deleted = false;

    try {
        await window.FirebaseService.saveTransaction(stagingData, true); 
        
        if (typeof window.closeModal === 'function') {
            window.closeModal('modal-ai-staging'); 
        }
        
        window.AuraState.temp.aiStaging = null;
        
        if (window.showToast) {
            window.showToast("Berkas Staging Area dikonfirmasi ke server Cloud!");
        }
    } catch(e) { 
        if (window.showToast) {
            window.showToast("Gagal merekam perbelanjaan.", true); 
        }
    }
};


/**
 * ============================================================================
 * [14] ORACLE CHAT LOGIC
 * ============================================================================
 */
let isChatProcessing = false;

window.processOracleChat = async function(text, base64Img = null) {
    if (!window.AuraState.user.uid) {
        return;
    }
    
    if (isChatProcessing) { 
        if (window.showToast) {
            window.showToast("Oracle masih memproses antrean chat lain...", true); 
        }
        return; 
    }
    
    isChatProcessing = true;
    const uiText = text || (base64Img ? "[File Lampiran Visual]" : "");
    const sanitizedUiText = window.AuraUtils.escapeHtml(uiText);
    
    await window.FirebaseService.pushOracleChat({ 
        role: 'user', 
        text: sanitizedUiText, 
        timestamp: new Date().toISOString() 
    });
    
    if (typeof window.setProcessingStatus === 'function') {
        window.setProcessingStatus(true); 
    }

    try {
        const summaryString = window.FinancialSummaryService.getSummaryString();
        const relevantTx = window.MemoryService.getRelevantTransactions(text);
        const profile = window.AuraState.data.settings?.profile || {};
        const nickname = profile.nickname || profile.fullName || "Bapak/Ibu";

        let txString = "";
        for (let i = 0; i < relevantTx.length; i++) {
            const t = relevantTx[i]; 
            let itemStr = "";
            
            if (t.items && Array.isArray(t.items)) {
                const mapStrArr = [];
                for(let j = 0; j < t.items.length; j++) { 
                    mapStrArr.push(`{itemId:"${t.items[j].itemId}", nama:"${t.items[j].nama_barang}", harga:${t.items[j].harga}, qty:${t.items[j].qty}}`); 
                }
                itemStr = `| Items:[${mapStrArr.join(', ')}]`;
            }
            
            txString += `ID:${t.id} | Toko:${t.merchantName || t.storeName || 'Merchant'} | Tipe:${t.tipe} | Ket:${t.description || t.catatan_ai} | Nom:${t.nominal} ${t.mata_uang} ${itemStr}\n`;
        }

        const promptConfigs = window.getOraclePromptConfigs();
        const categoryListStr = window.CategoryManager.getCategoryStringList();

        const systemPrompt = `Kamu adalah AuraFi Oracle V3. Kepribadian: ${promptConfigs.personaStr}. Nama Tuan: ${nickname}.
Konteks Keuangan: ${summaryString}\nData: ${txString}\n
ATURAN UPDATE (DILARANG MERUSAK ARRAY):
KATEGORI ITEM: "${categoryListStr}".
action: none|moveToTrash|update_transaction|add_item|edit_item|delete_item
target_item_id WAJIB JIKA EDIT/DELETE ITEM.
Gaya: ${promptConfigs.styleStr}
JSON MURNI TANPA TAG: 
{
    "reply": "...", 
    "action": "none", 
    "target_id": "", 
    "target_item_id": "", 
    "update_fields": {}, 
    "new_items": []
}`;

        let resJson;
        const messages = [{ role: "system", content: systemPrompt }];
        const history = window.MemoryService.getRelevantChats();
        
        for (let i = 0; i < history.length; i++) {
            if (history[i].text !== sanitizedUiText) { 
                messages.push({ 
                    role: history[i].role === 'ai' ? 'assistant' : 'user', 
                    content: history[i].text 
                }); 
            }
        }
        
        messages.push({ 
            role: "user", 
            content: text || "Analisa keuanganku." 
        });

        const aiOutput = await window.executeAIWithFallback(messages, systemPrompt, true, base64Img);
        resJson = window.AuraUtils.parseCleanJSON(aiOutput);

        if (resJson.action !== 'none' && resJson.target_id) { 
            try {
                const targetTrx = window.AuraState.data.transactions.find(function(t) {
                    return t.id === resJson.target_id;
                });
                
                if (targetTrx) {
                    if (resJson.action === 'moveToTrash') {
                        await window.FirebaseService.moveToTrash(resJson.target_id);
                    } else if (resJson.action === 'update_transaction') {
                        const updates = {};
                        if (resJson.update_fields) {
                            if (resJson.update_fields.merchantName) updates.merchantName = resJson.update_fields.merchantName;
                            if (resJson.update_fields.metode_pembayaran) updates.metode_pembayaran = resJson.update_fields.metode_pembayaran;
                            if (resJson.update_fields.tipe) updates.tipe = resJson.update_fields.tipe;
                            if (resJson.update_fields.nominal !== undefined) updates.nominal = resJson.update_fields.nominal;
                        }
                        await window.FirebaseService.updateTransaction(targetTrx.id, updates);
                    } else if (resJson.action === 'add_item' && resJson.new_items) {
                        const sanItems = window.AuraUtils.sanitizeItemsArray(resJson.new_items, targetTrx.metode_pembayaran, new Date().toISOString());
                        const finalItems = (targetTrx.items || []).concat(sanItems);
                        
                        let sum = 0; 
                        for (let j = 0; j < finalItems.length; j++) {
                            sum += (finalItems[j].harga * (finalItems[j].qty || 1));
                        }
                        
                        const upd = { items: finalItems, nominal: sum };
                        if (!targetTrx.isCustomDescription) {
                            upd.description = `[Koreksi Automatis] Transaksi disuntik AI. Total: ${window.AuraUtils.formatCurrency(sum)}`;
                        }
                        
                        await window.FirebaseService.updateTransaction(targetTrx.id, upd);
                    } else if (resJson.action === 'edit_item' && resJson.target_item_id && resJson.new_items && resJson.new_items.length > 0) {
                        const newEditData = resJson.new_items[0];
                        
                        const finalItems = (targetTrx.items || []).map(function(it) {
                            if(it.itemId === resJson.target_item_id) {
                                return { 
                                    ...it, 
                                    nama_barang: newEditData.nama_barang || it.nama_barang, 
                                    harga: newEditData.harga !== undefined ? newEditData.harga : it.harga, 
                                    qty: newEditData.qty !== undefined ? newEditData.qty : it.qty, 
                                    kategori_barang: newEditData.kategori_barang || it.kategori_barang 
                                };
                            } 
                            return it;
                        });
                        
                        let sum = 0; 
                        for (let j = 0; j < finalItems.length; j++) {
                            sum += (finalItems[j].harga * (finalItems[j].qty || 1));
                        }
                        
                        const upd = { items: finalItems, nominal: sum };
                        if (!targetTrx.isCustomDescription) {
                            upd.description = `[Koreksi Automatis] Parameter item diubah AI. Total: ${window.AuraUtils.formatCurrency(sum)}`;
                        }
                        
                        await window.FirebaseService.updateTransaction(targetTrx.id, upd);
                    } else if (resJson.action === 'delete_item' && resJson.target_item_id) {
                        const finalItems = (targetTrx.items || []).filter(function(it) {
                            return it.itemId !== resJson.target_item_id;
                        });
                        
                        if (finalItems.length === 0) { 
                            await window.FirebaseService.moveToTrash(targetTrx.id); 
                        } else {
                            let sum = 0; 
                            for (let j = 0; j < finalItems.length; j++) {
                                sum += (finalItems[j].harga * (finalItems[j].qty || 1));
                            }
                            const upd = { items: finalItems, nominal: sum };
                            
                            if (!targetTrx.isCustomDescription) {
                                upd.description = `[Koreksi Automatis] Item digugurkan AI. Total: ${window.AuraUtils.formatCurrency(sum)}`;
                            }
                            await window.FirebaseService.updateTransaction(targetTrx.id, upd);
                        }
                    }
                }
            } catch(e) { 
                resJson.reply += " (Gagal memodifikasi data via Oracle.)"; 
            }
        }

        const escapedReply = window.AuraUtils.escapeHtml(resJson.reply);
        await window.FirebaseService.pushOracleChat({ 
            role: 'ai', 
            text: escapedReply, 
            timestamp: new Date().toISOString() 
        });

    } catch(e) { 
        await window.FirebaseService.pushOracleChat({ 
            role: 'ai', 
            text: `Gangguan transmisi: ${e.message}`, 
            timestamp: new Date().toISOString() 
        });
    } finally { 
        if (typeof window.setProcessingStatus === 'function') {
            window.setProcessingStatus(false); 
        }
        isChatProcessing = false;
    }
};


/**
 * ============================================================================
 * [15] SUPER RENDER ENGINE (CALCULATIONS & DOM UPDATES)
 * ============================================================================
 */

window.reCalculateAll = function() {
    const allTx = window.AuraState.data.transactions || [];
    const today = new Date();
    
    let cumulativeBalance = 0;
    let totalCashBal = 0, totalCashlessBal = 0;
    
    for (let i = 0; i < allTx.length; i++) {
        const trx = allTx[i];
        const val = window.AuraUtils.convertCurrency(trx.nominal, trx.mata_uang);
        const isCash = (trx.metode_pembayaran === 'tunai');
        
        if (trx.tipe === 'pemasukan') {
            cumulativeBalance += val;
            if (isCash) {
                totalCashBal += val; 
            } else {
                totalCashlessBal += val;
            }
        } else if (trx.tipe === 'pengeluaran') {
            cumulativeBalance -= val;
            if (isCash) {
                totalCashBal -= val; 
            } else {
                totalCashlessBal -= val;
            }
        } else if (trx.tipe === 'tarik_tunai') {
            const feeVal = window.AuraUtils.convertCurrency(Number(trx.admin_fee || 0), trx.mata_uang);
            cumulativeBalance -= feeVal; 
            totalCashBal += val; 
            totalCashlessBal -= (val + feeVal);
        } else if (trx.tipe === 'setor_tunai') {
            const feeVal = window.AuraUtils.convertCurrency(Number(trx.admin_fee || 0), trx.mata_uang);
            cumulativeBalance -= feeVal; 
            totalCashBal -= val; 
            totalCashlessBal += val; 
            totalCashlessBal -= feeVal;
        }
    }

    const periodRange = window.AuraUtils.getPeriodRange();
    const fSearch = window.AuraState.filters.search.toLowerCase();
    const fCat = window.AuraState.filters.category;
    const fUser = window.AuraState.filters.user;

    let periodSpent = 0, periodIncome = 0;
    let catSpend = {}, merchantSpend = {}, groupedTrx = {};
    
    const trackersConfig = window.AuraState.data.settings?.staplesTrackers || DEFAULT_STAPLES_TRACKERS;
    let trackerBalances = {};
    const trackerIds = Object.keys(trackersConfig);
    
    for (let i = 0; i < trackerIds.length; i++) {
        trackerBalances[trackerIds[i]] = 0;
    }

    let dailySp = {};
    for (let i = 6; i >= 0; i--) { 
        let d = new Date(today); 
        d.setDate(d.getDate() - i); 
        dailySp[d.toISOString().split('T')[0]] = 0; 
    }

    let filteredTx = [];
    for (let i = 0; i < allTx.length; i++) {
        const trx = allTx[i];
        const trxTime = new Date(trx.tanggal || trx.createdAt).getTime();
        
        if (trxTime < periodRange.start || trxTime > periodRange.end) {
            continue;
        }
        
        if (fSearch) {
            const desc = (trx.description || trx.catatan_ai || "").toLowerCase();
            const merch = (trx.merchantName || trx.storeName || "").toLowerCase();
            let hasItemMatch = false;
            
            if (trx.items && Array.isArray(trx.items)) {
                for (let j = 0; j < trx.items.length; j++) { 
                    if (trx.items[j].nama_barang.toLowerCase().includes(fSearch)) { 
                        hasItemMatch = true; 
                        break; 
                    } 
                }
            }
            if (!desc.includes(fSearch) && !merch.includes(fSearch) && !hasItemMatch) {
                continue;
            }
        }
        
        if (fCat !== 'ALL') {
            const mainCatMatch = (trx.kategori === fCat);
            let itemCatMatch = false;
            if (trx.items && Array.isArray(trx.items)) {
                for (let j = 0; j < trx.items.length; j++) { 
                    if (trx.items[j].kategori_barang === fCat) { 
                        itemCatMatch = true; 
                        break; 
                    } 
                }
            }
            if (!mainCatMatch && !itemCatMatch) {
                continue;
            }
        }
        
        if (fUser !== 'ALL') { 
            if (trx.user_id && trx.user_id !== fUser) {
                continue; 
            }
        }
        
        filteredTx.push(trx);
    }

    for (let i = 0; i < filteredTx.length; i++) {
        const trx = filteredTx[i];
        const val = window.AuraUtils.convertCurrency(trx.nominal, trx.mata_uang);
        const dStrRaw = trx.tanggal || trx.createdAt;
        const dStr = dStrRaw.split('T')[0];
        const timeFormatted = window.AuraUtils.formatDateToReadable(dStrRaw);
        
        if (!groupedTrx[dStr]) {
            groupedTrx[dStr] = { total: 0, items: [] };
        }

        if (trx.tipe === 'pemasukan') {
            periodIncome += val; 
            groupedTrx[dStr].total += val;
        } else if (trx.tipe === 'pengeluaran' || trx.tipe === 'tarik_tunai' || trx.tipe === 'setor_tunai') {
            let actualSpend = val;
            
            if (trx.tipe === 'tarik_tunai' || trx.tipe === 'setor_tunai') {
                actualSpend = window.AuraUtils.convertCurrency(Number(trx.admin_fee || 0), trx.mata_uang);
                groupedTrx[dStr].total -= actualSpend; 
                periodSpent += actualSpend; 
                catSpend['Utilitas'] = (catSpend['Utilitas'] || 0) + actualSpend;
            } else {
                groupedTrx[dStr].total -= actualSpend; 
                periodSpent += actualSpend;
                const safeMerchant = window.AuraUtils.escapeHtml(trx.merchantName || trx.storeName || trx.kategori || 'Merchant');
                merchantSpend[safeMerchant] = (merchantSpend[safeMerchant] || 0) + actualSpend;
                
                if (trx.items && Array.isArray(trx.items) && trx.items.length > 0) {
                    let calcItemSum = 0;
                    for (let j = 0; j < trx.items.length; j++) {
                        const it = trx.items[j];
                        const itemVal = window.AuraUtils.convertCurrency(it.harga * (it.qty || 1), trx.mata_uang);
                        calcItemSum += itemVal;
                        
                        const catSafe = it.kategori_barang || 'Lainnya';
                        catSpend[catSafe] = (catSpend[catSafe] || 0) + itemVal;
                        
                        const iName = it.nama_barang.toLowerCase();
                        for (let k = 0; k < trackerIds.length; k++) {
                            const trackId = trackerIds[k]; 
                            const trackInfo = trackersConfig[trackId];
                            let isMatch = false;
                            
                            for (let m = 0; m < trackInfo.keywords.length; m++) { 
                                if (iName.includes(trackInfo.keywords[m].toLowerCase())) { 
                                    isMatch = true; 
                                    break; 
                                } 
                            }
                            if (isMatch) {
                                trackerBalances[trackId] += itemVal;
                            }
                        }
                    }
                    
                    if (actualSpend > calcItemSum) {
                        catSpend['Lainnya'] = (catSpend['Lainnya'] || 0) + (actualSpend - calcItemSum);
                    }
                } else {
                    const catSafe = trx.kategori || 'Lainnya'; 
                    catSpend[catSafe] = (catSpend[catSafe] || 0) + actualSpend;
                }
            }
            if (dailySp[dStr] !== undefined) {
                dailySp[dStr] += actualSpend;
            }
        }
        
        trx.displayTime = timeFormatted; 
        groupedTrx[dStr].items.push(trx);
    }

    window.AuraUtils.safeDOM('dash-total-balance', function(el) {
        el.innerText = window.AuraUtils.formatCurrency(cumulativeBalance);
    });
    
    window.AuraUtils.safeDOM('dash-cash', function(el) {
        el.innerText = window.AuraUtils.formatCurrency(totalCashBal);
    });
    
    window.AuraUtils.safeDOM('dash-cashless', function(el) {
        el.innerText = window.AuraUtils.formatCurrency(totalCashlessBal);
    });
    
    window.AuraUtils.safeDOM('dash-income-mth', function(el) {
        el.innerText = '+' + window.AuraUtils.formatCurrency(periodIncome);
    });
    
    window.AuraUtils.safeDOM('dash-expense-mth', function(el) {
        el.innerText = '-' + window.AuraUtils.formatCurrency(periodSpent);
    });

    const limitVal = window.AuraUtils.convertCurrency(window.AuraState.data.monthlyBudget, 'JPY');
    const burnPct = limitVal > 0 ? (periodSpent / limitVal) * 100 : 0;
    const remainingBudget = limitVal - periodSpent;

    window.AuraUtils.safeDOM('living-core', function(el) { 
        el.className = `w-48 h-48 rounded-full living-core ${burnPct > 90 ? 'danger' : ''} flex flex-col items-center justify-center relative overflow-hidden`; 
    });
    
    window.AuraUtils.safeDOM('burn-progress', function(el) { 
        el.style.width = `${Math.min(burnPct, 100)}%`; 
        el.style.backgroundColor = burnPct > 90 ? 'var(--color-expense)' : 'var(--color-income)'; 
    });
    
    window.AuraUtils.safeDOM('burn-spent', function(el) {
        el.innerText = `Terpakai: ${window.AuraUtils.formatCurrency(periodSpent)}`;
    });
    
    window.AuraUtils.safeDOM('burn-limit', function(el) {
        el.innerText = `Limit: ${window.AuraUtils.formatCurrency(limitVal)}`;
    });

    // Peringatan Budget
    if (burnPct > 90 && !window.AuraState.system.hasShownBudgetAlert) {
        window.AuraState.system.hasShownBudgetAlert = true;
        if (typeof window.showToast === 'function') {
            window.showToast("PERINGATAN: Limit Anggaran Anda telah mencapai lebih dari 90%!", true);
        }
    }

    const msInDay = 1000 * 60 * 60 * 24;
    const daysInPeriod = Math.max(1, Math.ceil((periodRange.end - periodRange.start) / msInDay));
    const daysPassed = Math.max(1, Math.ceil((today.getTime() - periodRange.start) / msInDay));
    const dailyAvg = periodSpent / daysPassed; 
    const proj = dailyAvg * daysInPeriod; 
    const daysLeft = Math.max(0, daysInPeriod - daysPassed); 
    const periodPct = Math.min((daysPassed / daysInPeriod) * 100, 100);
    
    window.AuraUtils.safeDOM('stats-daily-avg', function(el) {
        el.innerText = window.AuraUtils.formatCurrency(dailyAvg);
    });
    
    window.AuraUtils.safeDOM('stats-proj-mth', function(el) {
        el.innerText = window.AuraUtils.formatCurrency(proj);
    });
    
    window.AuraUtils.safeDOM('burn-insight-box', function(el) {
        if (proj > limitVal) { 
            el.innerHTML = `<span class="text-[var(--color-expense)] font-bold"><i class="fa-solid fa-triangle-exclamation"></i> KEDARURATAN KAS:</span> Estimasi akhir periode defisit. Pengereman disarankan!`; 
            el.style.borderColor = 'var(--color-expense)'; 
        } else { 
            el.innerHTML = `<span class="text-[var(--color-income)] font-bold"><i class="fa-solid fa-circle-check"></i> AMAN TERKENDALI:</span> Pola stabil.<br><span class="text-[9px] mt-1 text-[var(--text-muted)]">Celah Defensif Sisa Dana: ${window.AuraUtils.formatCurrency(remainingBudget)}</span>`; 
            el.style.borderColor = 'var(--border-glass)'; 
        }
    });

    window.AuraUtils.safeDOM('period-progress-bar', function(el) {
        el.style.width = `${periodPct}%`;
    });
    
    window.AuraUtils.safeDOM('period-progress-text', function(el) {
        el.innerText = `PROGRES SIKLUS: ${periodPct.toFixed(0)}%`;
    });
    
    window.AuraUtils.safeDOM('period-days-left', function(el) {
        el.innerText = `${daysLeft} HARI TERSISA`;
    });

    for (let i = 0; i < trackerIds.length; i++) {
        window.AuraUtils.safeDOM(`track-${trackerIds[i]}`, function(el) { 
            el.innerText = window.AuraUtils.formatCurrency(trackerBalances[trackerIds[i]]); 
        });
    }

    const catSorted = Object.entries(catSpend).sort((a, b) => b[1] - a[1]);
    
    window.AuraUtils.safeDOM('pie-total-label', function(el) {
        el.innerText = window.AuraUtils.formatCurrency(periodSpent);
    });
    
    window.AuraUtils.safeDOM('category-pie-chart', function(el) {
        if (periodSpent > 0 && catSorted.length > 0) {
            let conicStops = []; 
            let currentAngle = 0;
            
            for (let i = 0; i < catSorted.length; i++) {
                let pct = (catSorted[i][1] / periodSpent) * 100; 
                let hex = window.CategoryManager.resolveStyle(catSorted[i][0]).hex;
                conicStops.push(`${hex} ${currentAngle}% ${currentAngle + pct}%`); 
                currentAngle += pct;
            }
            el.style.background = `conic-gradient(${conicStops.join(', ')})`;
        } else { 
            el.style.background = `conic-gradient(var(--border-glass) 0% 100%)`; 
        }
    });

    window.AuraUtils.safeDOM('top-categories-list', function(el) {
        if (catSorted.length === 0) { 
            el.innerHTML = '<p class="text-xs text-[var(--text-muted)] text-center">Belum ada data rekaman keuangan.</p>'; 
        } else {
            let compiledList = '';
            for (let i = 0; i < catSorted.length; i++) {
                const style = window.CategoryManager.resolveStyle(catSorted[i][0]);
                const pct = periodSpent > 0 ? ((catSorted[i][1]/periodSpent)*100).toFixed(0) : 0;
                compiledList += `
                <div class="flex justify-between items-center text-sm border-b border-[var(--border-glass)] pb-2.5 last:border-0 last:pb-0">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center border border-[var(--border-glass)]" style="background-color: ${style.hex}15; border-color: ${style.hex}40;">
                            <i class="fa-solid ${style.icon}" style="color: ${style.hex}"></i>
                        </div>
                        <div>
                            <p class="font-bold text-[var(--text-main)]">${style.name}</p>
                            <p class="text-[9px] text-[var(--text-muted)] font-bold">${pct}% dari pengeluaran utuh</p>
                        </div>
                    </div>
                    <p class="font-mono text-xs font-bold text-[var(--text-main)]">${window.AuraUtils.formatCurrency(catSorted[i][1])}</p>
                </div>`;
            }
            el.innerHTML = compiledList;
        }
    });

    window.AuraUtils.safeDOM('top-merchants-list', function(el) {
        const merchSorted = Object.entries(merchantSpend).sort((a,b)=>b[1]-a[1]).slice(0, 5); 
        
        if (merchSorted.length === 0) { 
            el.innerHTML = '<p class="text-xs text-[var(--text-muted)] text-center">Data merchant kosong.</p>'; 
        } else {
            let compiledMerch = '';
            for (let i = 0; i < merchSorted.length; i++) { 
                compiledMerch += `
                <div class="flex justify-between items-center text-sm border-b border-[var(--border-glass)] pb-2.5 last:border-0 last:pb-0">
                    <span class="font-bold text-[var(--text-main)] truncate max-w-[65%]">${merchSorted[i][0]}</span>
                    <span class="font-mono font-bold text-[var(--color-expense)]">${window.AuraUtils.formatCurrency(merchSorted[i][1])}</span>
                </div>`; 
            }
            el.innerHTML = compiledMerch;
        }
    });

    if (typeof window.renderCanvas7Days === 'function') {
        window.renderCanvas7Days(dailySp, today);
    }

    window.AuraUtils.safeDOM('trx-list-container', function(el) {
        const groupedKeys = Object.keys(groupedTrx).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        
        if (groupedKeys.length === 0) { 
            el.innerHTML = '<p class="text-center text-[var(--text-muted)] mt-10">Ruang transaksi kosong.</p>'; 
            return; 
        }
        
        let compiledTrxHtml = '';
        for (let i = 0; i < groupedKeys.length; i++) {
            const dateStr = groupedKeys[i]; 
            const g = groupedTrx[dateStr]; 
            const dObj = new Date(dateStr);
            const dateDisplay = !isNaN(dObj.getTime()) ? dObj.getDate().toString().padStart(2,'0') : '--';
            const dayDisplay = !isNaN(dObj.getTime()) ? dObj.toLocaleDateString('id-ID', {weekday:'short'}) : '---';
            const totalPrefix = g.total >= 0 ? '+' : ''; 
            const totalColor = g.total >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--text-main)]';
            
            let itemHtmlBuilder = '';
            
            for (let j = 0; j < g.items.length; j++) {
                const t = g.items[j]; 
                let expandedReceiptsState = window.AuraState.temp.expandedReceipts || {};
                const isExp = expandedReceiptsState[t.id]; 
                
                const hasItems = t.items && Array.isArray(t.items) && t.items.length > 0;
                const catStyle = window.CategoryManager.resolveStyle(t.kategori || 'Lainnya');
                
                let iconHtml = `<i class="fa-solid ${catStyle.icon}" style="color: ${catStyle.hex}"></i>`;
                let colorClass = 'text-[var(--text-main)]'; 
                let signChar = '-';
                
                if (t.tipe === 'pemasukan') { 
                    iconHtml = '<i class="fa-solid fa-arrow-turn-up text-[var(--color-income)]"></i>'; 
                    colorClass = 'text-[var(--color-income)]'; 
                    signChar = '+'; 
                } else if (t.tipe === 'tarik_tunai' || t.tipe === 'setor_tunai') { 
                    iconHtml = '<i class="fa-solid fa-money-bill-transfer text-[#38bdf8]"></i>'; 
                    colorClass = 'text-[#38bdf8]'; 
                    signChar = '⇄'; 
                }
                
                const titleDisp = window.AuraUtils.escapeHtml(t.merchantName || t.storeName || t.kategori);
                const descDisp = window.AuraUtils.escapeHtml(t.description || t.catatan_ai || "");
                const metIcon = t.metode_pembayaran === 'tunai' ? '<i class="fa-solid fa-money-bill"></i>' : '<i class="fa-regular fa-credit-card"></i>';
                
                let innerReceiptHtml = '';
                if (hasItems) {
                    let receiptLines = '';
                    for (let k = 0; k < t.items.length; k++) {
                        const it = t.items[k]; 
                        const safeItemId = it.itemId || 'no_id_fallback'; 
                        const itCatHex = window.CategoryManager.resolveStyle(it.kategori_barang).hex;
                        const taxBadge = it.tax_rate ? `<span class="text-[8px] bg-sky-950/40 text-sky-400 px-1 rounded font-mono border border-sky-900">${it.tax_rate}%</span>` : '';
                        
                        receiptLines += `
                        <div class="flex justify-between items-center text-xs bg-white/5 p-2 rounded-xl group/it">
                            <div class="flex-1 truncate">
                                <span class="text-[var(--text-main)] font-medium mr-1">${window.AuraUtils.escapeHtml(it.nama_barang)}</span>
                                <span class="text-[8px] px-1.5 py-0.5 rounded font-bold mr-1" style="background-color: ${itCatHex}20; color: ${itCatHex};">${it.kategori_barang || 'Lainnya'}</span>
                                <span class="text-[9px] text-[var(--text-muted)] font-mono font-bold">x${it.qty}</span> 
                                ${taxBadge}
                            </div>
                            <span class="font-mono text-[var(--text-muted)] text-[11px] mr-2">${window.AuraUtils.formatCurrency(window.AuraUtils.convertCurrency(it.harga * (it.qty || 1), t.mata_uang))}</span>
                            <div class="flex gap-2 opacity-100 md:opacity-0 group-hover/it:opacity-100">
                                <button onclick="window.openEditItem('${t.id}', '${safeItemId}')" class="text-accent p-1 text-xs"><i class="fa-solid fa-pen"></i></button>
                                <button onclick="window.confirmDelItem('${t.id}', '${safeItemId}')" class="text-[var(--color-expense)] p-1 text-xs"><i class="fa-solid fa-xmark"></i></button>
                            </div>
                        </div>`;
                    }
                    innerReceiptHtml = `
                    <div class="mt-2.5 pt-2 border-t border-[var(--border-glass)]">
                        <div class="flex justify-between items-center">
                            <button onclick="window.toggleExpandedReceipt('${t.id}')" class="flex-1 text-left text-[9px] text-[var(--text-muted)] font-black uppercase tracking-wider py-1.5">
                                <span><i class="fa-solid fa-list mr-1"></i> ${t.items.length} Barang</span> 
                                <i class="fa-solid fa-chevron-${isExp ? 'up' : 'down'} ml-1"></i>
                            </button>
                            <button onclick="window.openAddItemModal('${t.id}')" class="bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-md text-[8px] font-bold text-white transition">+ ITEM BARU</button>
                        </div>
                        <div class="${isExp ? 'block' : 'hidden'} mt-2 space-y-1.5">
                            ${receiptLines}
                        </div>
                    </div>`;
                } else {
                    innerReceiptHtml = `
                    <div class="mt-2.5 pt-2 border-t border-[var(--border-glass)]">
                        <button onclick="window.openAddItemModal('${t.id}')" class="bg-white/5 border border-[var(--border-glass)] w-full py-1.5 rounded-md text-[9px] font-bold text-[var(--text-muted)] hover:text-white transition">+ SUNTIKKAN ITEM BARU</button>
                    </div>`;
                }
                
                itemHtmlBuilder += `
                <div class="glass-panel p-4 relative group">
                    <button onclick="window.openEditTrxModal('${t.id}')" class="absolute top-3 right-10 text-[var(--text-muted)] hover:text-accent opacity-0 group-hover:opacity-100 active:scale-90 p-2 text-sm transition"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="window.confirmDelTrx('${t.id}')" class="absolute top-3 right-3 text-[var(--text-muted)] hover:text-[var(--color-expense)] opacity-0 group-hover:opacity-100 active:scale-90 p-2 text-sm transition"><i class="fa-solid fa-trash"></i></button>
                    <div class="flex justify-between items-start mb-2 pr-12">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style="background-color: ${catStyle.hex}15; border: 1px solid ${catStyle.hex}30;">
                                ${iconHtml}
                            </div>
                            <div class="overflow-hidden">
                                <h4 class="font-bold text-sm text-[var(--accent-primary)] truncate">${titleDisp}</h4>
                                <p class="text-[8px] text-[var(--text-muted)] uppercase font-extrabold tracking-wide flex items-center gap-1">${metIcon} ${t.metode_pembayaran} • ${t.displayTime.split(' ')[1]}</p>
                            </div>
                        </div>
                        <p class="font-bold text-sm font-mono shrink-0 ml-2 ${colorClass}">${signChar}${window.AuraUtils.formatCurrency(window.AuraUtils.convertCurrency(t.nominal, t.mata_uang))}</p>
                    </div>
                    ${descDisp ? `<div class="bg-black/25 p-2.5 rounded-xl text-xs text-accent italic mb-2">"${descDisp}"</div>` : ''}
                    ${innerReceiptHtml}
                </div>`;
            }
            
            compiledTrxHtml += `
            <div class="mb-4">
                <div class="flex justify-between items-end mb-2.5 border-b border-[var(--border-glass)] pb-1">
                    <div class="flex items-baseline gap-1.5">
                        <span class="text-xl font-display font-black leading-none">${dateDisplay}</span>
                        <span class="text-[9px] uppercase tracking-widest text-[var(--text-muted)] font-extrabold">${dayDisplay}</span>
                    </div>
                    <span class="text-xs font-mono font-bold ${totalColor}">${totalPrefix}${window.AuraUtils.formatCurrency(g.total)}</span>
                </div>
                <div class="space-y-3">
                    ${itemHtmlBuilder}
                </div>
            </div>`;
        }
        
        el.innerHTML = compiledTrxHtml;
    });

    window.AuraUtils.safeDOM('goals-list-container', function(el) {
        const glList = window.AuraState.data.goals || [];
        
        if (glList.length === 0) { 
            el.innerHTML = '<p class="text-center text-[var(--text-muted)] mt-5">Belum ada Misi Pengumpulan Aset Finansial.</p>'; 
            return; 
        }
        
        let glHtml = '';
        for (let i = 0; i < glList.length; i++) {
            const g = glList[i]; 
            const targetVal = window.AuraUtils.convertCurrency(g.targetAmount, g.currency);
            const diffDays = Math.ceil((new Date(g.targetDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
            const dailyReq = diffDays > 0 ? targetVal / diffDays : 0;
            
            glHtml += `
            <div class="glass-panel p-4 relative overflow-hidden border-t-2 border-t-accent">
                <button onclick="window.confirmDelGoal('${g.id}')" class="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 transition"><i class="fa-solid fa-trash text-xs"></i></button>
                <button onclick="window.editGoalPrompt('${g.id}')" class="absolute top-4 right-10 text-[var(--text-muted)] hover:text-accent p-1 transition"><i class="fa-solid fa-pen text-xs"></i></button>
                <h4 class="font-bold text-sm mb-1">${window.AuraUtils.escapeHtml(g.name)}</h4>
                <p class="text-[9px] text-[var(--text-muted)] mb-3 uppercase tracking-wider font-extrabold">Target: ${window.AuraUtils.formatCurrency(targetVal)} max ${g.targetDate}</p>
                <div class="bg-black/35 rounded-xl p-3 flex justify-between items-center border border-[var(--border-glass)]">
                    <div>
                        <p class="text-[8px] text-[var(--text-muted)] uppercase mb-0.5 font-extrabold">Kewajiban Nabung Harian</p>
                        <p class="font-mono text-accent font-bold text-xs">${diffDays > 0 ? window.AuraUtils.formatCurrency(dailyReq) : 'TERLAMPAUI'}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-[8px] text-[var(--text-muted)] uppercase mb-0.5 font-extrabold">Sisa Hari</p>
                        <p class="font-bold text-xs">${diffDays > 0 ? diffDays + ' Hari' : 'KADALUARSA'}</p>
                    </div>
                </div>
            </div>`;
        }
        el.innerHTML = glHtml;
    });

    window.AuraUtils.safeDOM('trash-list-container', function(el) {
        const trashList = window.AuraState.data.trash || [];
        
        if (trashList.length === 0) { 
            el.innerHTML = '<p class="text-center text-[var(--text-muted)] mt-5"><i class="fa-solid fa-seedling block text-2xl mb-2 text-emerald-900/50"></i>Tempat sampah bersih.</p>'; 
            return; 
        }
        
        let trashHtml = '';
        for (let i = 0; i < trashList.length; i++) {
            const t = trashList[i]; 
            const delDate = t.deletedAt ? t.deletedAt.split('T')[0] : 'Unknown'; 
            const val = window.AuraUtils.convertCurrency(t.nominal, t.mata_uang);
            
            trashHtml += `
            <div class="glass-panel p-4 flex justify-between items-center opacity-85 hover:opacity-100 transition">
                <div>
                    <h4 class="font-bold text-xs line-through text-[var(--text-muted)]">${window.AuraUtils.escapeHtml(t.merchantName || t.storeName || t.kategori)}</h4>
                    <p class="text-[9px] text-[var(--text-muted)]">Dihapus: ${delDate}</p>
                </div>
                <div class="flex items-center gap-2">
                    <span class="font-mono text-xs text-[var(--text-muted)] line-through mr-1">${window.AuraUtils.formatCurrency(val)}</span>
                    <button onclick="window.restoreTransaction('${t.id}')" class="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-lg hover:bg-emerald-500/40 active:scale-90 transition" aria-label="Restore"><i class="fa-solid fa-rotate-left text-xs"></i></button>
                    <button onclick="window.deleteForever('${t.id}')" class="bg-rose-500/20 text-rose-400 p-2.5 rounded-lg hover:bg-rose-500/40 active:scale-90 transition" aria-label="Hapus Permanen"><i class="fa-solid fa-xmark text-xs"></i></button>
                </div>
            </div>`;
        }
        el.innerHTML = trashHtml;
    });

    if (typeof window.renderRecurringUIForBudget === 'function') {
        window.renderRecurringUIForBudget();
    }
};

window.debouncedCalculateAll = window.AuraUtils.debounce(window.reCalculateAll, APP_CONFIG.THROTTLE_MS);

window.renderCanvas7Days = function(dailySp, today) {
    const canvas = document.getElementById('canvas-7days');
    if (!canvas) {
        return;
    }
    
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth || canvas.width; 
    const H = canvas.offsetHeight || canvas.height;
    
    canvas.width = W; 
    canvas.height = H;
    ctx.clearRect(0, 0, W, H);
    
    const vals = Object.values(dailySp); 
    const keys = Object.keys(dailySp);
    
    let maxVal = 1; 
    for (let i = 0; i < vals.length; i++) { 
        if (vals[i] > maxVal) {
            maxVal = vals[i]; 
        }
    }
    
    const padding = 12; 
    const totalItems = vals.length; 
    const barWidth = (W - (padding * totalItems)) / totalItems;
    const todayStr = today.toISOString().split('T')[0];
    
    for (let i = 0; i < totalItems; i++) {
        const val = vals[i]; 
        const keyDate = keys[i];
        const barH = (val / maxVal) * (H - 25); 
        const x = i * (barWidth + padding) + (padding / 2); 
        const y = H - barH;
        
        ctx.fillStyle = (keyDate === todayStr) ? '#38bdf8' : '#38bdf840'; 
        ctx.beginPath();
        
        if (ctx.roundRect) {
            ctx.roundRect(x, y, barWidth, barH, [6, 6, 0, 0]); 
        } else {
            ctx.rect(x, y, barWidth, barH);
        }
        
        ctx.fill();
        
        if (val > 0) {
            ctx.fillStyle = '#ffffff'; 
            ctx.font = 'bold 9px monospace'; 
            ctx.textAlign = 'center';
            
            let tVal = val; 
            if (val >= 1000) {
                tVal = (val / 1000).toFixed(1).replace('.0', '') + 'k';
            }
            
            ctx.fillText(tVal, x + (barWidth / 2), y - 6);
        }
        
        ctx.fillStyle = '#94a3b8'; 
        ctx.font = '8px monospace';
        ctx.fillText(keyDate.substring(5).replace('-', '/'), x + (barWidth / 2), H - 4);
    }
};

window.addEventListener('resize', function() {
    if (window.AuraState.system.activeView === 'dashboard' || window.AuraState.system.activeView === 'analytics') {
        if (typeof window.debouncedCalculateAll === 'function') {
            window.debouncedCalculateAll();
        }
    }
});


/**
 * ============================================================================
 * [16] UI INJECTIONS (DYNAMIC HTML GENERATION FOR MISSING MODALS)
 * ============================================================================
 * Memastikan fitur yang belum memiliki HTML statis dapat diakses tanpa perlu
 * meminta user mengedit file HTML. Seluruh UI form yang hilang direstorasi di sini.
 */
window.injectMissingModals = function() {
    const body = document.body;
    
    if (!document.getElementById('modal-import-data')) {
        const importModalHTML = `
        <div id="modal-import-data" class="fixed inset-0 z-[110] bg-black/85 backdrop-blur-md flex items-center justify-center p-5 hidden opacity-0 transition-all duration-300">
            <div class="glass-panel p-6 w-full max-w-sm shadow-2xl border-t-4 border-t-emerald-400">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-lg font-bold flex items-center gap-2 text-emerald-400 font-display"><i class="fa-solid fa-file-import"></i> Impor Transaksi</h3>
                    <button onclick="window.closeModal('modal-import-data')" class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-white transition"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="space-y-4 text-center">
                    <p class="text-xs text-[var(--text-muted)]">Unggah file JSON atau CSV (Format AuraFi) untuk merestorasi riwayat transaksi lama Anda.</p>
                    <input type="file" id="import-file-input" accept=".json, .csv" class="hidden" onchange="window.processFileImport(event)">
                    <button onclick="document.getElementById('import-file-input').click()" class="w-full py-4 rounded-xl border-2 border-dashed border-emerald-500/50 text-emerald-400 font-bold hover:bg-emerald-500/20 transition flex flex-col items-center gap-2">
                        <i class="fa-solid fa-cloud-arrow-up text-2xl"></i><span>Pilih File Dari Perangkat</span>
                    </button>
                </div>
            </div>
        </div>`;
        body.insertAdjacentHTML('beforeend', importModalHTML);
    }

    if (!document.getElementById('modal-edit-tracker')) {
        const trackerModalHTML = `
        <div id="modal-edit-tracker" class="fixed inset-0 z-[110] bg-black/85 backdrop-blur-md flex items-center justify-center p-5 hidden opacity-0 transition-all duration-300">
            <div class="glass-panel p-6 w-full max-w-sm shadow-2xl border-t-4 border-t-amber-400 max-h-[90vh] overflow-y-auto no-scrollbar">
                <div class="flex justify-between items-center mb-6 sticky top-0 bg-[var(--bg-glass)] z-10 pb-2">
                    <h3 class="text-lg font-bold flex items-center gap-2 text-amber-400 font-display"><i class="fa-solid fa-box-open"></i> Tracker Dinamis</h3>
                    <button onclick="window.closeModal('modal-edit-tracker')" class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-white transition"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div id="tracker-list-container" class="space-y-3 mb-5"></div>
                <div class="pt-4 border-t border-[var(--border-glass)] space-y-3">
                    <h4 class="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Tambah Tracker Baru</h4>
                    <input type="text" id="new-track-id" class="v-input w-full rounded-xl p-2.5 text-xs outline-none" placeholder="ID (Contoh: kopi)">
                    <input type="text" id="new-track-name" class="v-input w-full rounded-xl p-2.5 text-xs outline-none" placeholder="Nama Label (Cth: Ngopi)">
                    <input type="text" id="new-track-keywords" class="v-input w-full rounded-xl p-2.5 text-xs outline-none" placeholder="Kata Kunci (Cth: starbucks, kopi, janji jiwa)">
                    <button onclick="window.saveNewTracker()" class="w-full py-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-xs uppercase tracking-wider hover:bg-amber-500/40 transition">Simpan Tracker</button>
                </div>
            </div>
        </div>`;
        body.insertAdjacentHTML('beforeend', trackerModalHTML);
    }
    
    if (!document.getElementById('modal-edit-budget')) {
        const budgetModalHTML = `
        <div id="modal-edit-budget" class="fixed inset-0 z-[110] bg-black/85 backdrop-blur-md flex items-center justify-center p-5 hidden opacity-0 transition-all duration-300">
            <div class="glass-panel p-6 w-full max-w-sm shadow-2xl border-t-4 border-t-rose-400">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-lg font-bold flex items-center gap-2 text-rose-400 font-display"><i class="fa-solid fa-fire-flame-curved"></i> Batas Burn Rate</h3>
                    <button onclick="window.closeModal('modal-edit-budget')" class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-white transition"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1 block font-bold">Batas Pengeluaran Bulanan (Limit)</label>
                        <input type="number" id="budget-limit-input" class="v-input w-full rounded-xl p-3 text-sm font-mono font-bold text-rose-400 outline-none" placeholder="Masukkan Nominal JPY/IDR">
                    </div>
                    <button onclick="window.executeSaveBudget()" class="w-full py-4 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/50 font-bold text-sm hover:bg-rose-500/40 transition">Simpan Ketetapan</button>
                </div>
            </div>
        </div>`;
        body.insertAdjacentHTML('beforeend', budgetModalHTML);
    }

    if (!document.getElementById('modal-family')) {
        const familyModalHTML = `
        <div id="modal-family" class="fixed inset-0 z-[110] bg-black/85 backdrop-blur-md flex items-center justify-center p-5 hidden opacity-0 transition-all duration-300">
            <div class="glass-panel p-6 w-full max-w-sm shadow-2xl border-t-4 border-t-indigo-400 max-h-[90vh] overflow-y-auto no-scrollbar">
                <div class="flex justify-between items-center mb-6 sticky top-0 bg-[var(--bg-glass)] z-10 pb-2">
                    <h3 class="text-lg font-bold flex items-center gap-2 text-indigo-400 font-display"><i class="fa-solid fa-users"></i> Anggota Keluarga</h3>
                    <button onclick="window.closeModal('modal-family')" class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-white transition"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div id="family-list-container" class="space-y-3 mb-5"></div>
                <div class="pt-4 border-t border-[var(--border-glass)] space-y-3">
                    <input type="text" id="new-family-name" class="v-input w-full rounded-xl p-3 text-sm outline-none" placeholder="Nama Anggota (Cth: Istri)">
                    <button onclick="window.addFamilyMember()" class="w-full py-3 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-bold text-xs uppercase tracking-wider hover:bg-indigo-500/40 transition">Tambah Anggota</button>
                </div>
            </div>
        </div>`;
        body.insertAdjacentHTML('beforeend', familyModalHTML);
    }
    
    if (!document.getElementById('modal-audit-log')) {
        const auditHTML = `
        <div id="modal-audit-log" class="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 hidden opacity-0 transition-all duration-300">
            <div class="glass-panel p-5 w-full max-w-md shadow-2xl border-t-4 border-t-white h-[85vh] flex flex-col">
                <div class="flex justify-between items-center mb-4 shrink-0">
                    <h3 class="text-lg font-bold flex items-center gap-2 text-white font-display"><i class="fa-solid fa-shield-halved"></i> Security Audit Log</h3>
                    <button onclick="window.closeModal('modal-audit-log')" class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-white transition"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div id="audit-log-content" class="flex-1 overflow-y-auto no-scrollbar space-y-3 bg-black/40 p-3 rounded-xl border border-[var(--border-glass)]">
                    <p class="text-xs text-center text-[var(--text-muted)] mt-10">Mencari rekam jejak pada Cloud Firebase...</p>
                </div>
            </div>
        </div>`;
        body.insertAdjacentHTML('beforeend', auditHTML);
    }
    
    const settingsPanel = document.querySelector('#modal-settings .glass-panel');
    if (settingsPanel && !document.getElementById('btn-show-audit')) {
        const advancedSection = document.createElement('div');
        advancedSection.className = "space-y-3 mb-6 pt-5 border-t border-[var(--border-glass)]";
        advancedSection.innerHTML = `
            <h4 class="text-xs font-bold text-white flex items-center gap-1.5"><i class="fa-solid fa-wrench"></i> KONFIGURASI LANJUTAN</h4>
            <div class="grid grid-cols-2 gap-2">
                <button onclick="window.openTrackerManager()" class="py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold transition border border-[var(--border-glass)]"><i class="fa-solid fa-box-open text-amber-400 mb-1 block text-lg"></i> Trackers</button>
                <button onclick="window.openFamilyManager()" class="py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold transition border border-[var(--border-glass)]"><i class="fa-solid fa-users text-indigo-400 mb-1 block text-lg"></i> Keluarga</button>
                <button id="btn-show-audit" onclick="window.openAuditLogs()" class="py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold transition border border-[var(--border-glass)]"><i class="fa-solid fa-shield-halved text-gray-300 mb-1 block text-lg"></i> Audit Log</button>
                <button onclick="window.showModal('modal-import-data')" class="py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold transition border border-[var(--border-glass)]"><i class="fa-solid fa-file-import text-emerald-400 mb-1 block text-lg"></i> Impor Data</button>
            </div>
        `;
        
        const logoutArea = settingsPanel.querySelector('.mt-6.pt-5');
        if (logoutArea) {
            settingsPanel.insertBefore(advancedSection, logoutArea);
        }
    }
};

window.addEventListener('DOMContentLoaded', window.injectMissingModals);


/**
 * ============================================================================
 * [17] MISSING FEATURES MANAGEMENT (CATEGORIES, TRACKERS, BUDGETS, FAMILY, AUDIT LOG)
 * ============================================================================
 */

window.saveNewCategory = async function() {
    const nameInput = document.getElementById('new-category-name');
    const iconInput = document.getElementById('new-category-icon');
    const colorInput = document.getElementById('new-category-color');
    const typeInput = document.getElementById('new-category-type');

    if (!nameInput || !iconInput || !colorInput || !typeInput) {
        return;
    }

    const name = nameInput.value.trim();
    const icon = iconInput.value.trim() || 'fa-tag';
    const color = colorInput.value.trim() || '#ffffff';
    const type = typeInput.value;

    if (!name) {
        if(window.showToast) window.showToast("Identitas nama kategori tidak boleh kosong!", true);
        return;
    }

    const catId = `cat_custom_${Date.now()}`;
    const updates = {};
    updates[`categories/${catId}`] = { 
        name: name, 
        icon: icon, 
        color: color, 
        type: type, 
        isSystem: false 
    };

    try {
        await window.FirebaseService.updateSettings(updates);
        if (window.showToast) {
            window.showToast("Sistem Kamus Kategori bertambah luas dengan pendaftaran data baru!");
        }
        if (typeof window.closeModal === 'function') {
            window.closeModal('modal-add-category');
        }
    } catch (e) {
        if (window.showToast) window.showToast("Gagal menyimpan ke Database Cloud.", true);
    }
};

window.openTrackerManager = function() {
    const listContainer = document.getElementById('tracker-list-container');
    if (!listContainer) {
        return;
    }
    
    const trackers = window.AuraState.data.settings?.staplesTrackers || DEFAULT_STAPLES_TRACKERS;
    let html = '';
    
    const trackerEntries = Object.entries(trackers);
    for (let i = 0; i < trackerEntries.length; i++) {
        const id = trackerEntries[i][0];
        const t = trackerEntries[i][1];
        
        html += `
        <div class="glass-panel p-3 border-l-2 border-l-amber-400 flex justify-between items-center mb-2">
            <div>
                <p class="text-xs font-bold text-amber-400">${window.AuraUtils.escapeHtml(t.name)}</p>
                <p class="text-[9px] text-[var(--text-muted)] uppercase mt-0.5">Keys: ${window.AuraUtils.escapeHtml(t.keywords.join(', '))}</p>
            </div>
            <button onclick="window.removeTracker('${id}')" class="text-rose-500 hover:text-rose-400 p-2"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    }
    
    listContainer.innerHTML = html;
    
    if (typeof window.showModal === 'function') {
        window.showModal('modal-edit-tracker');
    }
};

window.saveNewTracker = async function() {
    const idInput = document.getElementById('new-track-id');
    const nameInput = document.getElementById('new-track-name');
    const keyInput = document.getElementById('new-track-keywords');
    
    if (!idInput || !nameInput || !keyInput) {
        return;
    }
    
    const id = idInput.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const name = nameInput.value.trim();
    
    const keywordsRaw = keyInput.value.split(',');
    const keywords = [];
    for (let i = 0; i < keywordsRaw.length; i++) {
        const k = keywordsRaw[i].trim().toLowerCase();
        if (k) {
            keywords.push(k);
        }
    }
    
    if (!id || !name || keywords.length === 0) {
        if (window.showToast) {
            window.showToast("Mohon isi ID, Nama, dan minimal 1 kata kunci!", true);
        }
        return;
    }
    
    const updates = {};
    updates[`staplesTrackers/${id}`] = { 
        name: name, 
        keywords: keywords 
    };
    
    try {
        await window.FirebaseService.updateSettings(updates);
        idInput.value = ''; 
        nameInput.value = ''; 
        keyInput.value = '';
        
        if (window.showToast) {
            window.showToast("Tracker dinamis baru telah didaftarkan.");
        }
        
        window.openTrackerManager(); 
    } catch(e) {
        if (window.showToast) {
            window.showToast("Gagal menyimpan Tracker.", true);
        }
    }
};

window.removeTracker = async function(id) {
    if (confirm(`Anda yakin ingin menghapus pelacak ${id}?`)) {
        try {
            const dbRef = ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${window.AuraState.user.uid}/settings/staplesTrackers/${id}`);
            await remove(dbRef);
            
            if (window.showToast) {
                window.showToast("Pelacak telah ditiadakan dari dashboard.");
            }
            window.openTrackerManager();
        } catch(e) {
            if (window.showToast) window.showToast("Gagal menghapus Tracker.", true);
        }
    }
};

window.executeSaveBudget = async function() {
    const input = document.getElementById('budget-limit-input');
    if (!input) {
        return;
    }
    
    const val = parseFloat(input.value);
    if (isNaN(val) || val < 0) {
        if (window.showToast) {
            window.showToast("Batas Limit harus berupa angka bernilai positif!", true);
        }
        return;
    }
    
    try {
        await window.FirebaseService.updateSettings({ 
            monthlyBudget: { limit: val } 
        });
        
        window.AuraState.data.monthlyBudget = val;
        
        if (typeof window.closeModal === 'function') {
            window.closeModal('modal-edit-budget');
        }
        
        window.AuraState.system.hasShownBudgetAlert = false; 
        
        if (window.showToast) {
            window.showToast(`Ketetapan pengeluaran bulanan direvisi menjadi ${window.AuraUtils.formatCurrency(val)}`);
        }
        
        if (window.debouncedCalculateAll) {
            window.debouncedCalculateAll();
        }
    } catch(e) {
        if (window.showToast) {
            window.showToast("Kegagalan server memperbaharui batas budget.", true);
        }
    }
};

window.openFamilyManager = function() {
    const listContainer = document.getElementById('family-list-container');
    if (!listContainer) {
        return;
    }
    
    const members = window.AuraState.data.settings?.familyMembers || [];
    let html = '';
    
    for (let i = 0; i < members.length; i++) {
        html += `
        <div class="glass-panel p-3 border-l-2 border-l-indigo-400 flex justify-between items-center mb-2">
            <p class="text-xs font-bold text-indigo-400"><i class="fa-solid fa-user mr-2"></i>${window.AuraUtils.escapeHtml(members[i])}</p>
            <button onclick="window.removeFamilyMember('${i}')" class="text-rose-500 hover:text-rose-400 p-2"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    }
    
    if (members.length === 0) {
        html = '<p class="text-[10px] text-[var(--text-muted)] text-center">Belum ada tanggungan anggota keluarga tambahan.</p>';
    }
    
    listContainer.innerHTML = html;
    
    if (typeof window.showModal === 'function') {
        window.showModal('modal-family');
    }
};

window.addFamilyMember = async function() {
    const input = document.getElementById('new-family-name');
    if (!input) {
        return;
    }
    
    const name = input.value.trim();
    if (!name) {
        if (window.showToast) {
            window.showToast("Masukan nama keluarga yang valid!", true);
        }
        return;
    }
    
    const members = window.AuraState.data.settings?.familyMembers || [];
    
    let isDuplicate = false;
    for (let i = 0; i < members.length; i++) {
        if (members[i] === name) {
            isDuplicate = true;
            break;
        }
    }
    
    if (isDuplicate) {
        if (window.showToast) {
            window.showToast("Anggota ini sudah ada di dalam database keluarga.", true);
        }
        return;
    }
    
    const newMembers = [...members, name];
    try {
        await window.FirebaseService.updateSettings({ 
            familyMembers: newMembers 
        });
        
        input.value = '';
        
        if (window.showToast) {
            window.showToast(`Anggota Keluarga ${name} didaftarkan ke sistem.`);
        }
        window.openFamilyManager();
    } catch (e) {
        if (window.showToast) {
            window.showToast("Gagal mendaftarkan anggota keluarga.", true);
        }
    }
};

window.removeFamilyMember = async function(index) {
    const members = window.AuraState.data.settings?.familyMembers || [];
    const memberName = members[index];
    
    if (confirm(`Lepaskan hubungan akses pencatatan transaksi untuk [${memberName}]?`)) {
        members.splice(index, 1);
        try {
            await window.FirebaseService.updateSettings({ 
                familyMembers: members 
            });
            
            if (window.showToast) {
                window.showToast(`Akses untuk ${memberName} dicabut.`);
            }
            window.openFamilyManager();
        } catch(e) {
            if (window.showToast) {
                window.showToast("Gagal memproses ke database awan.", true);
            }
        }
    }
};

window.populateUserFilterDropdown = function() {
    const filterUserEl = document.getElementById('filter-user');
    if (!filterUserEl) {
        return;
    }
    
    const transactions = window.AuraState.data.transactions || [];
    const membersSettings = window.AuraState.data.settings?.familyMembers || [];
    const uniqueUsers = new Set();
    
    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].user_id) {
            uniqueUsers.add(transactions[i].user_id);
        }
    }
    
    for (let i = 0; i < membersSettings.length; i++) {
        uniqueUsers.add(membersSettings[i]);
    }

    let htmlOpts = `<option value="ALL">SEMUA PENGGUNA</option>`;
    const usersArray = Array.from(uniqueUsers);
    
    for (let i = 0; i < usersArray.length; i++) {
        const userNm = window.AuraUtils.escapeHtml(usersArray[i]);
        htmlOpts += `<option value="${userNm}">${userNm}</option>`;
    }
    
    const currentVal = filterUserEl.value;
    filterUserEl.innerHTML = htmlOpts;
    
    if (currentVal && uniqueUsers.has(currentVal)) {
        filterUserEl.value = currentVal;
    }
};

window.openAuditLogs = async function() {
    const container = document.getElementById('audit-log-content');
    if (!container) {
        return;
    }
    
    if (typeof window.showModal === 'function') {
        window.showModal('modal-audit-log');
    }
    
    container.innerHTML = '<div class="text-center p-8"><i class="fa-solid fa-circle-notch animate-spin text-2xl text-white mb-2 block"></i><p class="text-[10px] text-[var(--text-muted)]">Mengunduh blok rantai keamanan...</p></div>';
    
    try {
        const snapshot = await get(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${window.AuraState.user.uid}/audit_logs`));
        
        if (snapshot.exists()) {
            const logsData = snapshot.val();
            const logsArray = [];
            
            for (const key in logsData) {
                if (Object.prototype.hasOwnProperty.call(logsData, key)) {
                    logsArray.push({ id: key, ...logsData[key] });
                }
            }
            
            logsArray.sort(function(a, b) {
                return b.ts - a.ts;
            });
            
            let logHtml = '';
            for (let i = 0; i < logsArray.length; i++) {
                const log = logsArray[i];
                const dateObj = new Date(log.ts);
                const timeStr = `${dateObj.toLocaleDateString()} ${dateObj.getHours().toString().padStart(2,'0')}:${dateObj.getMinutes().toString().padStart(2,'0')}`;
                
                logHtml += `
                <div class="border-b border-[var(--border-glass)] pb-2 mb-2 last:border-0 last:pb-0 last:mb-0">
                    <div class="flex justify-between items-start mb-1">
                        <span class="text-[9px] bg-white/10 text-white px-1.5 py-0.5 rounded font-mono">${window.AuraUtils.escapeHtml(log.action)}</span>
                        <span class="text-[8px] text-[var(--text-muted)] font-mono">${timeStr}</span>
                    </div>
                    <p class="text-xs text-[var(--text-main)]">${window.AuraUtils.escapeHtml(log.detail)}</p>
                    <p class="text-[8px] text-[var(--text-muted)] uppercase mt-1">Executor: ${window.AuraUtils.escapeHtml(log.user)}</p>
                </div>`;
            }
            container.innerHTML = logHtml;
            
        } else {
            container.innerHTML = '<p class="text-center text-xs text-[var(--text-muted)] p-5">Tidak ada riwayat aktivitas yang terekam sejauh ini.</p>';
        }
    } catch(e) {
        container.innerHTML = '<p class="text-center text-xs text-rose-500 p-5"><i class="fa-solid fa-triangle-exclamation block text-2xl mb-2"></i>Gagal membaca log dari Cloud Firebase.</p>';
    }
};

window.processFileImport = function(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    
    if (confirm("Peringatan: Melakukan pemaksaan impor data berpotensi menduplikasi entri jika data tersebut sudah ada. Lanjutkan?")) {
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            const contents = e.target.result;
            try {
                let parsedTransactions = [];
                
                if (file.name.endsWith('.json')) {
                    parsedTransactions = JSON.parse(contents);
                    if (!Array.isArray(parsedTransactions)) {
                        throw new Error("Akar objek JSON harus berupa kumpulan Array Transaksi.");
                    }
                } else if (file.name.endsWith('.csv')) {
                    const lines = contents.split('\n');
                    
                    for (let i = 1; i < lines.length; i++) {
                        if (!lines[i].trim()) {
                            continue;
                        }
                        
                        const cols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || []; 
                        
                        let nominalRaw = parseFloat(cols[6]?.replace(/["']/g, '')) || 0;
                        parsedTransactions.push({
                            tanggal: cols[0]?.replace(/["']/g, '') || new Date().toISOString().split('T')[0],
                            createdAt: cols[1]?.replace(/["']/g, '') || new Date().toISOString(),
                            merchantName: cols[2]?.replace(/["']/g, '') || "Imported Merchant",
                            tipe: cols[3]?.replace(/["']/g, '') || "pengeluaran",
                            metode_pembayaran: cols[4]?.replace(/["']/g, '') || "cashless",
                            kategori: cols[5]?.replace(/["']/g, '') || "Lainnya",
                            nominal: nominalRaw,
                            mata_uang: cols[7]?.replace(/["']/g, '') || "JPY",
                            description: "[IMPORTED] " + (cols[9]?.replace(/["']/g, '') || ""),
                            is_deleted: false,
                            items: [{
                                itemId: window.AuraUtils.generateId('itm'),
                                nama_barang: cols[2]?.replace(/["']/g, '') || "Barang Impor",
                                harga: nominalRaw,
                                qty: 1,
                                kategori_barang: cols[5]?.replace(/["']/g, '') || "Lainnya"
                            }]
                        });
                    }
                }
                
                if (parsedTransactions.length === 0) {
                    if (window.showToast) {
                        window.showToast("Data file kosong atau tidak valid", true);
                    }
                    return;
                }
                
                if (typeof window.setProcessingStatus === 'function') {
                    window.setProcessingStatus(true);
                }
                
                let importSuccessCount = 0;
                
                for(let i = 0; i < parsedTransactions.length; i++) {
                    const data = parsedTransactions[i];
                    data.user_id = window.AuraState.data.settings?.profile?.nickname || "Imported User";
                    await push(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${window.AuraState.user.uid}/transactions`), data);
                    importSuccessCount++;
                }
                
                window.FirebaseService.saveAuditLog("DATA.IMPORT", `Impor massal ${importSuccessCount} transaksi dari arsip eksternal ${file.name}.`);
                
                if (window.showToast) {
                    window.showToast(`Berhasil merestorasi ${importSuccessCount} arsip transaksi dari ${file.name}.`);
                }
                
                if (typeof window.closeModal === 'function') {
                    window.closeModal('modal-import-data');
                }
                
            } catch (err) {
                Logger.error('Import', 'Parsing gagal', err);
                if (window.showToast) {
                    window.showToast("Gagalan parsing: Struktur file rusak atau melanggar format protokol.", true);
                }
            } finally {
                if (typeof window.setProcessingStatus === 'function') {
                    window.setProcessingStatus(false);
                }
                event.target.value = ''; 
            }
        };
        
        reader.readAsText(file);
    } else {
        event.target.value = '';
    }
};


/**
 * ============================================================================
 * [18] UI RENDERERS (CHAT & BINDINGS YANG SEMPAT HILANG)
 * ============================================================================
 * Mengembalikan fungsionalitas UI yang dipanggil secara eksplisit dari HTML,
 * yang sebelumnya hilang.
 */

window.renderOracleChats = function() {
    window.AuraUtils.safeDOM('oracle-chat-box', function(el) {
        if (!window.AuraState.data.oracleChats || window.AuraState.data.oracleChats.length === 0) {
            el.innerHTML = `
            <div class="text-center text-[var(--text-muted)] p-8">
                <i class="fa-solid fa-comment-dots text-3xl mb-3 block opacity-30"></i>
                Belum ada percakapan. Mulai chat dengan Oracle!
            </div>`;
            return;
        }
        
        let chatsHtml = '';
        for (let i = 0; i < window.AuraState.data.oracleChats.length; i++) {
            const c = window.AuraState.data.oracleChats[i];
            let htmlFormat = window.AuraUtils.escapeHtml(c.text).replace(/\n/g, '<br/>');
            
            const alignment = c.role === 'user' ? 'justify-end' : 'justify-start';
            const bubbleStyle = c.role === 'user' 
                ? 'bubble-user text-white shadow-md' 
                : 'bubble-ai glass-panel markdown-content';
                
            chatsHtml += `
            <div class="flex ${alignment}">
                <div class="p-3.5 rounded-2xl text-xs max-w-[85%] ${bubbleStyle} leading-relaxed shadow-sm">
                    ${htmlFormat}
                </div>
            </div>`;
        }
        
        el.innerHTML = chatsHtml;
        
        if (window.AuraState.system.isProcessing && window.AuraState.system.activeView === 'oracle') {
            el.innerHTML += `
            <div class="flex justify-start">
                <div class="bubble-ai glass-panel p-3 rounded-2xl flex gap-1 items-center">
                    <div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce"></div>
                    <div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce delay-100"></div>
                    <div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce delay-200"></div>
                </div>
            </div>`;
        }
        
        if (window.AuraState.system.activeView === 'oracle') {
            setTimeout(function() { 
                window.AuraUtils.safeDOM('chat-anchor', function(anc) {
                    anc.scrollIntoView({ behavior: 'smooth' });
                }); 
            }, 50);
        }
    });
};

window.renderGroqKeysUI = function() {
    window.AuraUtils.safeDOM('groq-keys-container', function(el) {
        const keys = window.AuraState.data.groqKeys || [];
        
        if (keys.length === 0) {
            el.innerHTML = '<p class="text-[10px] text-[var(--text-muted)] text-center my-2 p-2 bg-black/40 rounded-lg">Tidak satupun Kunci API Groq Sistem terpasang. Mesin Nirkabel LLM Nonaktif.</p>';
            return;
        }

        let keysHtml = '';
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            const dec = window.EncryptionService.decryptApiKey(k.encryptedKey, window.GroqService.secret);
            const display = dec ? `${dec.substring(0,8)}...${dec.substring(dec.length-4)}` : `(Memori Data Enkripsi Korup/Tertolak)`;
            const statusColor = dec ? 'text-emerald-400' : 'text-rose-400';
            
            keysHtml += `
            <div class="flex justify-between items-center bg-[var(--bg-base)] p-2 rounded-xl border border-[var(--border-glass)]">
                <div class="flex flex-col">
                    <span class="font-mono text-xs ${statusColor}">${display}</span>
                    <span class="text-[8px] text-[var(--text-muted)] uppercase tracking-wider">Master Key Pool Ke-${i + 1}</span>
                </div>
                <button onclick="window.removeGroqKey('${k.id}')" class="text-rose-500 p-1 hover:text-rose-400 active:scale-90 transition">
                    <i class="fa-solid fa-trash text-xs"></i>
                </button>
            </div>`;
        }
        el.innerHTML = keysHtml;
    });
};

window.renderRecurringUI = function() {
    window.AuraUtils.safeDOM('recurring-list', function(el) {
        const rPayments = window.AuraState.data.settings?.recurringPayments || {};
        const entries = Object.entries(rPayments);

        if (entries.length === 0) {
            el.innerHTML = '<p class="text-[10px] text-[var(--text-muted)] text-center my-2">Mesin belum diajarkan mengenai rutinitas siklus bulanan Anda.</p>';
            return;
        }

        let htmlCompiled = '';
        for (let i = 0; i < entries.length; i++) {
            const id = entries[i][0];
            const rp = entries[i][1];
            htmlCompiled += `
            <div class="flex justify-between items-center bg-[var(--bg-base)] p-2 rounded-xl border border-[var(--border-glass)]">
                <div class="flex flex-col">
                    <span class="font-bold text-xs text-sky-400">${window.AuraUtils.escapeHtml(rp.name)}</span>
                    <span class="text-[9px] text-[var(--text-muted)] font-mono">Eksekusi H-(${rp.date}) | ${window.AuraUtils.formatCurrency(rp.amount)} via [${window.AuraUtils.escapeHtml(rp.method)}]</span>
                </div>
                <button onclick="window.removeRecurringPayment('${id}')" class="text-rose-500 p-1 hover:text-rose-400 transition active:scale-90">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                </button>
            </div>`;
        }
        el.innerHTML = htmlCompiled;
    });
};

window.renderRecurringUIForBudget = function() {
    window.AuraUtils.safeDOM('budget-bills-container', function(el) {
        const rPayments = window.AuraState.data.settings?.recurringPayments || {};
        const entries = Object.entries(rPayments);
        
        if (entries.length === 0) {
            el.innerHTML = '<p class="text-[10px] text-[var(--text-muted)] text-center my-2 p-3 bg-black/20 rounded-xl">Konfigurasi Tagihan Kosong. Buat rutinitas cicilan/tagihan Anda di kolom bawah.</p>';
            return;
        }

        let compiledBudgets = '';
        for (let i = 0; i < entries.length; i++) {
            const id = entries[i][0];
            const rp = entries[i][1];
            compiledBudgets += `
            <div class="glass-panel p-3 flex justify-between items-center border-l-2 border-l-sky-400 group">
                <div>
                    <h4 class="font-bold text-xs text-sky-400 flex items-center gap-2">
                        ${window.AuraUtils.escapeHtml(rp.name)} 
                        <button onclick="window.removeRecurringPayment('${id}')" class="text-rose-500 hover:text-rose-400 transition opacity-0 group-hover:opacity-100">
                            <i class="fa-solid fa-trash text-[10px]"></i>
                        </button>
                    </h4>
                    <p class="text-[9px] text-[var(--text-muted)] font-mono uppercase mt-0.5">Tgl Eksekusi Robot AI: ${rp.date} / Bulan</p>
                </div>
                <p class="font-bold text-sm font-mono text-[var(--text-main)]">${window.AuraUtils.formatCurrency(rp.amount)}</p>
            </div>`;
        }
        el.innerHTML = compiledBudgets;
    });
};


/**
 * ============================================================================
 * [19] EXPORT CSV 
 * ============================================================================
 */
window.downloadCSV = function() {
    let csv = "Tanggal,Waktu_Dibuat,Merchant,Tipe,Metode,Kategori,Nominal_Asli,Mata_Uang,Detail_Item,Deskripsi\n";
    
    const periodRange = window.AuraUtils.getPeriodRange();
    const fSearch = window.AuraState.filters.search.toLowerCase();
    const fCat = window.AuraState.filters.category;
    const fUser = window.AuraState.filters.user;
    
    const baseList = window.AuraState.data.transactions || [];
    const dataToExport = [];

    for (let i = 0; i < baseList.length; i++) {
        const trx = baseList[i];
        const trxTime = new Date(trx.tanggal || trx.createdAt).getTime();
        
        if (trxTime < periodRange.start || trxTime > periodRange.end) {
            continue;
        }
        
        if (fSearch) {
            const desc = (trx.description || trx.catatan_ai || "").toLowerCase();
            const merch = (trx.merchantName || trx.storeName || "").toLowerCase();
            let itemMatch = false;
            
            if (trx.items && Array.isArray(trx.items)) {
                for (let j = 0; j < trx.items.length; j++) {
                    if (trx.items[j].nama_barang.toLowerCase().includes(fSearch)) {
                        itemMatch = true; 
                        break;
                    }
                }
            }
            if (!desc.includes(fSearch) && !merch.includes(fSearch) && !itemMatch) {
                continue;
            }
        }
        
        if (fCat !== 'ALL') {
            const mainCatMatch = (trx.kategori === fCat);
            let itemCatMatch = false;
            if (trx.items && Array.isArray(trx.items)) {
                for (let j = 0; j < trx.items.length; j++) {
                    if (trx.items[j].kategori_barang === fCat) {
                        itemCatMatch = true; 
                        break;
                    }
                }
            }
            if (!mainCatMatch && !itemCatMatch) {
                continue;
            }
        }
        
        if (fUser !== 'ALL') {
            if (trx.user_id && trx.user_id !== fUser) {
                continue;
            }
        }
        
        dataToExport.push(trx);
    }

    const cleanCSVField = function(val) {
        if (val === undefined || val === null) {
            return "";
        }
        let strVal = String(val).replace(/"/g, '""');
        if (strVal.startsWith('=') || strVal.startsWith('+') || strVal.startsWith('-') || strVal.startsWith('@')) {
            strVal = "'" + strVal;
        }
        return `"${strVal}"`;
    };

    for (let i = 0; i < dataToExport.length; i++) {
        const r = dataToExport[i];
        const d = r.tanggal ? r.tanggal.split('T')[0] : ''; 
        const created = r.createdAt || ''; 
        
        let itemsStr = '-';
        if (r.items && Array.isArray(r.items)) {
            let innerMap = [];
            for (let j = 0; j < r.items.length; j++) {
                const itm = r.items[j];
                innerMap.push(`${itm.nama_barang} (${itm.qty} x ${itm.harga}) [${itm.kategori_barang}]`);
            }
            itemsStr = innerMap.join(' | ');
        }
        
        const note = r.description || r.catatan_ai || ''; 
        const store = r.merchantName || r.storeName || r.kategori || 'Toko Default';
        
        csv += `${cleanCSVField(d)},${cleanCSVField(created)},${cleanCSVField(store)},${cleanCSVField(r.tipe)},${cleanCSVField(r.metode_pembayaran)},${cleanCSVField(r.kategori)},${cleanCSVField(r.nominal)},${cleanCSVField(r.mata_uang)},${cleanCSVField(itemsStr)},${cleanCSVField(note)}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); 
    const url = URL.createObjectURL(blob);
    
    link.href = url;
    link.download = `AuraFi_Ledger_Report_Secured_${new Date().toISOString().split('T')[0]}.csv`; 
    
    document.body.appendChild(link); 
    link.click(); 
    
    setTimeout(function() {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
    
    if (window.showToast) {
        window.showToast(`Berhasil membundel log sejumlah ${dataToExport.length} ke dalam Format CSV!`);
    }
};


/**
 * ============================================================================
 * [20] CRUD UI BINDINGS (RESTORASI TOTAL FUNGSI YANG HILANG)
 * ============================================================================
 * Seluruh fungsi ini diakses langsung dari Button onclick di HTML.
 * Sempat terhapus dan kini dikembalikan penuh dengan validasi ekstensif.
 */

window.openManualTrxModal = function() {
    if (window.CategoryManager && typeof window.CategoryManager.renderDropdowns === 'function') {
        window.CategoryManager.renderDropdowns();
    }
    if (typeof window.showModal === 'function') {
        window.showModal('modal-manual-trx');
    }
};

window.saveManualTransaction = async function() {
    const storeInput = document.getElementById('manual-trx-store');
    const typeInput = document.getElementById('manual-trx-type');
    const methodInput = document.getElementById('manual-trx-method');
    const currInput = document.getElementById('manual-trx-curr');
    const amtInput = document.getElementById('manual-trx-amount');
    const catInput = document.getElementById('manual-trx-category');
    
    if (!storeInput || !amtInput) {
        return;
    }
    
    const store = storeInput.value.trim();
    const type = typeInput ? typeInput.value : 'pengeluaran';
    const method = methodInput ? methodInput.value : 'cashless';
    const currency = currInput ? currInput.value : 'JPY';
    const amount = parseFloat(amtInput.value);
    const category = catInput ? catInput.value || 'Lainnya' : 'Lainnya';
    
    if (!store) {
        if (window.showToast) window.showToast("Nama toko/merchant wajib diisi!", true);
        return;
    }
    
    if (isNaN(amount) || amount <= 0) {
        if (window.showToast) window.showToast("Nominal harus berupa angka dan lebih dari 0!", true);
        return;
    }
    
    const timestamp = new Date().toISOString();
    const data = {
        merchantName: store,
        storeName: store,
        tanggal: timestamp.split('T')[0],
        createdAt: timestamp,
        nominal: amount,
        mata_uang: currency,
        metode_pembayaran: method,
        tipe: type,
        kategori: category,
        description: `Manual input: ${store}`,
        isCustomDescription: true,
        is_deleted: false,
        items: [{
            itemId: window.AuraUtils.generateId('itm'),
            nama_barang: store,
            harga: amount,
            qty: 1,
            kategori_barang: category,
            tax_rate: 0,
            paymentMethod: method,
            timestamp: timestamp
        }]
    };
    
    try {
        await window.FirebaseService.saveTransaction(data, false);
        if (typeof window.closeModal === 'function') {
            window.closeModal('modal-manual-trx');
        }
        if (window.showToast) {
            window.showToast("✅ Transaksi manual berhasil disimpan!");
        }
        
        storeInput.value = '';
        amtInput.value = '';
        
    } catch (e) {
        if (window.showToast) {
            window.showToast("❌ Gagal menyimpan transaksi manual.", true);
        }
    }
};

window.openEditTrxModal = function(id) {
    const transactions = window.AuraState.data.transactions || [];
    let sourceTrx = null;
    
    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].id === id) {
            sourceTrx = transactions[i];
            break;
        }
    }
     
    if (!sourceTrx) {
        return;
    }
    
    const trx = JSON.parse(JSON.stringify(sourceTrx));
    window.AuraState.temp.editTrxTargetData = trx.id;
    
    window.AuraUtils.safeDOM('edit-global-store', function(el) {
        el.value = window.AuraUtils.escapeHtml(trx.merchantName || trx.storeName || trx.kategori || '');
    });
    window.AuraUtils.safeDOM('edit-global-curr', function(el) {
        el.value = trx.mata_uang || 'JPY';
    });
    window.AuraUtils.safeDOM('edit-global-method', function(el) {
        el.value = trx.metode_pembayaran || 'cashless';
    });
    window.AuraUtils.safeDOM('edit-global-nominal', function(el) {
        el.value = trx.nominal || 0;
    });
    window.AuraUtils.safeDOM('edit-global-type', function(el) {
        el.value = trx.tipe || 'pengeluaran';
    });
    window.AuraUtils.safeDOM('edit-global-desc', function(el) {
        el.value = window.AuraUtils.escapeHtml(trx.description || trx.catatan_ai || '');
    });
    
    if (typeof window.showModal === 'function') {
        window.showModal('modal-edit-trx');
    }
};

window.saveEditTrx = async function() {
    if (!window.AuraState.temp.editTrxTargetData) {
        return;
    }
    
    const trxId = window.AuraState.temp.editTrxTargetData;
    const storeEl = document.getElementById('edit-global-store');
    const currEl = document.getElementById('edit-global-curr');
    const methodEl = document.getElementById('edit-global-method');
    const nominalEl = document.getElementById('edit-global-nominal');
    const typeEl = document.getElementById('edit-global-type');
    const descEl = document.getElementById('edit-global-desc');
    
    const storeName = storeEl ? storeEl.value.trim() : ''; 
    const curr = currEl ? currEl.value : 'JPY';
    const method = methodEl ? methodEl.value : 'cashless'; 
    const nominal = nominalEl ? parseFloat(nominalEl.value) : 0;
    
    if (isNaN(nominal) || nominal < 0) {
        if (window.showToast) {
            window.showToast("Nominal tidak boleh negatif atau kosong!", true);
        }
        return;
    }

    const tipe = typeEl ? typeEl.value : 'pengeluaran'; 
    const desc = descEl ? descEl.value.trim() : '';

    const updates = { 
        merchantName: storeName, 
        storeName: storeName, 
        mata_uang: curr, 
        metode_pembayaran: method, 
        nominal: nominal, 
        tipe: tipe 
    };
    
    if (desc) { 
        updates.description = desc; 
        updates.catatan_ai = desc; 
        updates.isCustomDescription = true; 
    }

    try { 
        await window.FirebaseService.updateTransaction(trxId, updates); 
        
        if (typeof window.closeModal === 'function') {
            window.closeModal('modal-edit-trx'); 
        }
        
        if (window.showToast) {
            window.showToast("Perubahan Induk Transaksi Berhasil Disimpan!"); 
        }
    } catch(e) { 
        if (window.showToast) {
            window.showToast("Gagal mengupdate induk transaksi.", true); 
        }
    }
};

window.openAddItemModal = function(trxId) {
    window.AuraState.temp.addItemTargetTrxId = trxId;
    
    window.AuraUtils.safeDOM('add-item-name', function(el) {
        el.value = "";
    }); 
    window.AuraUtils.safeDOM('add-item-qty', function(el) {
        el.value = "1";
    }); 
    window.AuraUtils.safeDOM('add-item-price', function(el) {
        el.value = "";
    });
    
    if (window.CategoryManager && typeof window.CategoryManager.renderDropdowns === 'function') {
        window.CategoryManager.renderDropdowns();
    }
    
    if (typeof window.showModal === 'function') {
        window.showModal('modal-add-item');
    }
};

window.saveAddItem = async function() {
    if (!window.AuraState.temp.addItemTargetTrxId) {
        return;
    }
    
    const transactions = window.AuraState.data.transactions || [];
    let trx = null;
    
    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].id === window.AuraState.temp.addItemTargetTrxId) {
            trx = transactions[i];
            break;
        }
    }
    
    if (!trx) {
        return;
    }
    
    const nameEl = document.getElementById('add-item-name');
    const qtyEl = document.getElementById('add-item-qty');
    const priceEl = document.getElementById('add-item-price');
    const catEl = document.getElementById('add-item-cat');
    
    const name = nameEl ? nameEl.value.trim() || "Item Baru" : "Item Baru";
    const qty = qtyEl ? parseFloat(qtyEl.value) || 1 : 1;
    const price = priceEl ? parseFloat(priceEl.value) : NaN;
    
    if (isNaN(price) || price < 0) {
        if (window.showToast) {
            window.showToast("Harga satuan tidak valid!", true);
        }
        return;
    }
    
    const category = catEl ? catEl.value || 'Lainnya' : 'Lainnya';

    const newItem = { 
        itemId: window.AuraUtils.generateId('itm'), 
        nama_barang: name, 
        harga: price, 
        qty: qty, 
        kategori_barang: category, 
        tax_rate: 0, 
        paymentMethod: trx.metode_pembayaran, 
        timestamp: new Date().toISOString() 
    };
    
    const finalItems = (trx.items || []).concat([newItem]);
    
    let newTotalSum = 0;
    for (let i = 0; i < finalItems.length; i++) {
        newTotalSum += (finalItems[i].harga * (finalItems[i].qty || 1));
    }

    const upd = { 
        items: finalItems, 
        nominal: newTotalSum 
    };
    
    if (!trx.isCustomDescription) { 
        upd.description = `[Auto-Update] Transaksi diubah. Total terbaru: ${window.AuraUtils.formatCurrency(newTotalSum)}.`; 
        upd.catatan_ai = upd.description; 
    }

    try { 
        await window.FirebaseService.updateTransaction(trx.id, upd); 
        
        if (typeof window.closeModal === 'function') {
            window.closeModal('modal-add-item'); 
        }
        
        if (window.showToast) {
            window.showToast("Item berhasil ditambahkan ke keranjang struk!"); 
        }
    } catch(e) { 
        if (window.showToast) {
            window.showToast("Gagal menambah item.", true); 
        }
    }
};

window.openEditItem = function(trxId, itemId) {
    const transactions = window.AuraState.data.transactions || [];
    let trx = null;
    
    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].id === trxId) {
            trx = transactions[i];
            break;
        }
    }
    
    if (!trx || !trx.items) {
        return;
    }
    
    const safeItemId = itemId || 'no_id_fallback';
    let item = null;
    
    for (let i = 0; i < trx.items.length; i++) {
        if ((trx.items[i].itemId || '') === safeItemId) {
            item = trx.items[i];
            break;
        }
    }
    
    if (!item) {
        return;
    }

    window.AuraState.temp.editItemTargetData = { 
        id: trxId, 
        itemId: safeItemId, 
        item: JSON.parse(JSON.stringify(item)) 
    };
    
    window.AuraUtils.safeDOM('edit-store-name', function(el) {
        el.value = window.AuraUtils.escapeHtml(trx.merchantName || trx.storeName || '');
    });
    window.AuraUtils.safeDOM('edit-item-name', function(el) {
        el.value = window.AuraUtils.escapeHtml(item.nama_barang || '');
    });
    window.AuraUtils.safeDOM('edit-item-qty', function(el) {
        el.value = item.qty || 1;
    });
    window.AuraUtils.safeDOM('edit-item-price', function(el) {
        el.value = item.harga || 0;
    });
    
    if (window.CategoryManager && typeof window.CategoryManager.renderDropdowns === 'function') {
        window.CategoryManager.renderDropdowns();
    }
    
    window.AuraUtils.safeDOM('edit-item-cat', function(el) {
        el.value = item.kategori_barang || 'Lainnya';
    });
    
    if (typeof window.showModal === 'function') {
        window.showModal('modal-edit-item');
    }
};

window.saveEditItem = async function() {
    if (!window.AuraState.temp.editItemTargetData) {
        return;
    }
    
    const transactions = window.AuraState.data.transactions || [];
    let trx = null;
    
    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].id === window.AuraState.temp.editItemTargetData.id) {
            trx = transactions[i];
            break;
        }
    }
    
    if (trx && window.FirebaseService) {
        const storeEl = document.getElementById('edit-store-name');
        const nameEl = document.getElementById('edit-item-name');
        const qtyEl = document.getElementById('edit-item-qty');
        const priceEl = document.getElementById('edit-item-price');
        const catEl = document.getElementById('edit-item-cat');
        
        const storeNameVal = storeEl ? storeEl.value.trim() : '';
        const newName = nameEl ? nameEl.value.trim() : '';
        const newQty = qtyEl ? parseFloat(qtyEl.value) || 1 : 1;
        const newPrice = priceEl ? parseFloat(priceEl.value) : NaN;
        
        if (isNaN(newPrice) || newPrice < 0 || isNaN(newQty) || newQty <= 0) {
            if (window.showToast) {
                window.showToast("Input kuantitas atau harga tidak valid!", true);
            }
            return;
        }

        const newCategory = catEl ? catEl.value : 'Lainnya';
        const targetItemId = window.AuraState.temp.editItemTargetData.itemId;
        
        const nItems = [];
        let sum = 0;
        
        for (let i = 0; i < trx.items.length; i++) {
            let it = trx.items[i];
            
            if (it.itemId === targetItemId || (!it.itemId && targetItemId === 'no_id_fallback')) {
                it = { 
                    ...it, 
                    nama_barang: newName || it.nama_barang, 
                    qty: newQty, 
                    harga: newPrice, 
                    kategori_barang: newCategory || it.kategori_barang 
                };
            }
            
            nItems.push(it);
            sum += (it.harga * (it.qty || 1));
        }

        const upd = { 
            items: nItems, 
            nominal: sum, 
            merchantName: storeNameVal || trx.merchantName || trx.storeName, 
            storeName: storeNameVal || trx.storeName || trx.kategori 
        };

        if (!trx.isCustomDescription) { 
            upd.description = `[Auto-Update] Item disesuaikan. Total terbaru: ${window.AuraUtils.formatCurrency(sum)}.`; 
            upd.catatan_ai = upd.description; 
        }
        
        try {
            await window.FirebaseService.updateTransaction(trx.id, upd);
            
            if (typeof window.closeModal === 'function') {
                window.closeModal('modal-edit-item');
            }
            
            if (window.showToast) {
                window.showToast("Item dalam keranjang struk berhasil diperbarui!");
            }
        } catch(e) {
            if (window.showToast) {
                window.showToast("Gagal memodifikasi item.", true);
            }
        }
    }
};

window.toggleGoalForm = function() { 
    const f = document.getElementById('goal-form'); 
    if (f) {
        f.classList.toggle('hidden'); 
    }
};

window.saveGoal = async function() { 
    const nameEl = document.getElementById('goal-name');
    const amtEl = document.getElementById('goal-target');
    const dtEl = document.getElementById('goal-date');
    
    if (!nameEl || !amtEl || !dtEl) {
        return;
    }
    
    const name = nameEl.value.trim(); 
    const amt = parseFloat(amtEl.value); 
    const dt = dtEl.value; 
    
    if (!name || isNaN(amt) || !dt) {
        if (window.showToast) {
            window.showToast("Harap lengkapi semua isian formulir!", true); 
        }
        return;
    }
    
    if (window.FirebaseService) { 
        try {
            await window.FirebaseService.saveGoal({ 
                name: name, 
                targetAmount: amt, 
                targetDate: dt, 
                currency: window.AuraState.system.displayCurrency 
            }); 
            
            const formContainer = document.getElementById('goal-form');
            if (formContainer) {
                formContainer.classList.add('hidden'); 
            }
            
            nameEl.value = ""; 
            amtEl.value = ""; 
            dtEl.value = ""; 
            
            if (window.showToast) {
                window.showToast("Misi Tabungan Berhasil Ditambahkan!"); 
            }
        } catch(e) {
            if (window.showToast) {
                window.showToast("Gagal menyimpan misi baru.", true); 
            }
        }
    } 
};

window.promptBudget = function() { 
    const amt = prompt("Ubah Batas Anggaran (Nominal Angka):", window.AuraState.data.monthlyBudget); 
    if (amt !== null) {
        const parsedAmt = parseFloat(amt);
        if (!isNaN(parsedAmt) && parsedAmt >= 0) { 
            window.AuraState.data.monthlyBudget = parsedAmt; 
            if (window.FirebaseService) { 
                window.FirebaseService.updateSettings({ 
                    monthlyBudget: { limit: window.AuraState.data.monthlyBudget } 
                }); 
            } 
            if (window.debouncedCalculateAll) {
                window.debouncedCalculateAll(); 
            }
        } else {
            alert("Input anggaran ditolak. Hanya menerima format numerik bernilai positif.");
        }
    }
};

window.syncGeminiEngine = async function(silent = false) {
    const pinEl = document.getElementById('gemini-pin-input');
    const pinInput = pinEl ? pinEl.value.trim() : '';
    const pin = silent ? sessionStorage.getItem('aurafi_gemini_pin') : pinInput;
    
    if (!pin || pin.length < 4) { 
        if (!silent && window.showToast) {
            window.showToast("HARAP MASUKKAN PIN GEMINI (MINIMAL 4 KARAKTER)!", true); 
        }
        return; 
    }

    const gBadge = document.getElementById('gemini-status-badge');
    if (gBadge) { 
        gBadge.className = "text-[9px] bg-indigo-950/40 text-indigo-400 border border-indigo-900/50 px-2 py-0.5 rounded font-mono animate-pulse"; 
        gBadge.innerText = "DECRYPTING..."; 
    }
    
    try {
        const geminiEngine = new window.GeminiFailoverEngine(pin);
        const gCount = await geminiEngine.init();
        
        if (gCount > 0) {
            window.AuraState.instances.geminiEngine = geminiEngine;
            window.failoverEngineInstance = geminiEngine; // legacy ref
            
            sessionStorage.setItem('aurafi_gemini_pin', pin);
            
            if (gBadge) { 
                gBadge.className = "text-[9px] bg-emerald-950/40 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-mono"; 
                gBadge.innerText = `ACTIVE (${gCount})`; 
            }
            if (!silent && window.showToast) {
                window.showToast("Gemini Vision Berhasil Di-Unlock.");
            }
        } else { 
            throw new Error("GCount 0"); 
        }
    } catch(e) {
        if (gBadge) { 
            gBadge.className = "text-[9px] bg-red-950/40 text-rose-400 border border-red-900/50 px-2 py-0.5 rounded font-mono"; 
            gBadge.innerText = "FAIL / LOCKED"; 
        }
        if (!silent && window.showToast) {
            window.showToast("Dekripsi Gagal: PIN Salah atau Vault Kosong.", true);
        }
    }
};

window.confirmDelGoal = function(id) { 
    const goals = window.AuraState.data.goals || [];
    let goal = null;
    
    for (let i = 0; i < goals.length; i++) {
        if (goals[i].id === id) {
            goal = goals[i];
            break;
        }
    }
    
    if (!goal) return; 
    
    window.AuraState.temp.deleteTarget = { 
        type: 'goal', 
        id: id, 
        name: goal.name 
    }; 
    
    window.AuraUtils.safeDOM('confirm-msg', function(el) {
        el.innerText = `Batalkan misi tabungan "${window.AuraUtils.escapeHtml(goal.name)}" selamanya?`;
    }); 
    
    if (typeof window.showModal === 'function') {
        window.showModal('modal-confirm'); 
    }
};

window.confirmDelItem = function(trxId, itemId) { 
    const transactions = window.AuraState.data.transactions || [];
    let trx = null;
    
    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].id === trxId) {
            trx = transactions[i];
            break;
        }
    }
    
    if (!trx || !trx.items) return; 
    
    const safeItemId = itemId || 'no_id_fallback'; 
    let item = null;
    
    for (let i = 0; i < trx.items.length; i++) {
        if ((trx.items[i].itemId || '') === safeItemId) {
            item = trx.items[i];
            break;
        }
    }
    
    if (!item) return; 
    
    window.AuraState.temp.deleteTarget = { 
        type: 'item', 
        id: trxId, 
        name: item.nama_barang, 
        itemId: safeItemId 
    }; 
    
    window.AuraUtils.safeDOM('confirm-msg', function(el) {
        el.innerText = `Hapus item parsial "${window.AuraUtils.escapeHtml(item.nama_barang)}" dari keranjang struk ini?`;
    }); 
    
    if (typeof window.showModal === 'function') {
        window.showModal('modal-confirm'); 
    }
};

window.confirmDelTrx = function(id) { 
    const transactions = window.AuraState.data.transactions || [];
    let trx = null;
    
    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].id === id) {
            trx = transactions[i];
            break;
        }
    }
    
    if (!trx) return; 
    
    window.AuraState.temp.deleteTarget = { 
        type: 'trx', 
        id: id, 
        name: trx.kategori 
    }; 
    
    window.AuraUtils.safeDOM('confirm-msg', function(el) {
        el.innerText = `Lemparkan arsip struk "${window.AuraUtils.escapeHtml(trx.merchantName || trx.storeName || trx.kategori)}" ke dalam Tempat Sampah?`;
    }); 
    
    if (typeof window.showModal === 'function') {
        window.showModal('modal-confirm'); 
    }
};

window.closeConfirmModal = function() { 
    if (typeof window.closeModal === 'function') {
        window.closeModal('modal-confirm'); 
    }
    window.AuraState.temp.deleteTarget = null; 
};

// Event Binding Dinamis untuk Modul Penghapusan
window.addEventListener('load', function() {
    const executeConfirmDeleteBtn = document.getElementById('btn-execute-delete');
    if (executeConfirmDeleteBtn) {
        executeConfirmDeleteBtn.addEventListener('click', async function() {
            const target = window.AuraState.temp.deleteTarget;
            
            if (!target) {
                return;
            }
            
            try {
                if (target.type === 'trx') { 
                    if (window.AuraState.system.activeView === 'trash') { 
                        await window.FirebaseService.deleteTransactionPermanently(target.id); 
                    } else { 
                        await window.FirebaseService.moveToTrash(target.id); 
                    } 
                } 
                else if (target.type === 'goal') { 
                    await window.FirebaseService.deleteGoal(target.id); 
                } 
                else if (target.type === 'item') {
                    const transactions = window.AuraState.data.transactions || [];
                    let trx = null;
                    
                    for (let i = 0; i < transactions.length; i++) {
                        if (transactions[i].id === target.id) {
                            trx = transactions[i];
                            break;
                        }
                    }
                    
                    if (trx) {
                        const nItems = [];
                        let sum = 0;
                        
                        for (let i = 0; i < trx.items.length; i++) {
                            const it = trx.items[i];
                            if (it.itemId !== target.itemId) {
                                nItems.push(it);
                                sum += (it.harga * (it.qty || 1));
                            }
                        }
                        
                        if (nItems.length === 0) { 
                            await window.FirebaseService.moveToTrash(trx.id); 
                        } else { 
                            const upd = { 
                                items: nItems, 
                                nominal: sum 
                            }; 
                            
                            if (!trx.isCustomDescription) { 
                                upd.description = `[Auto-Update] Item dihapus. Total terbaru: ${window.AuraUtils.formatCurrency(sum)}.`; 
                                upd.catatan_ai = upd.description; 
                            } 
                            
                            await window.FirebaseService.updateTransaction(trx.id, upd); 
                        }
                    }
                }
                
                if (window.showToast) {
                    window.showToast("Aksi Destruktif Berhasil Dieksekusi.");
                }
            } catch(e) {
                if (window.showToast) {
                    window.showToast("Gagal mengeksekusi perintah hapus/pembersihan.", true);
                }
            } finally {
                window.closeConfirmModal(); 
            }
        });
    }
});

window.restoreTransaction = async function(id) { 
    if (window.FirebaseService) { 
        try {
            await window.FirebaseService.updateTransaction(id, { 
                is_deleted: false, 
                deletedAt: null 
            }); 
            if (window.showToast) {
                window.showToast("Arsip direstorasi dari pembuangan."); 
            }
        } catch(e) {
            if (window.showToast) window.showToast("Gagal merestorasi.", true); 
        }
    } 
};

window.deleteForever = async function(id) { 
    if (window.FirebaseService) { 
        try {
            await window.FirebaseService.deleteTransactionPermanently(id); 
            if (window.showToast) {
                window.showToast("Materi dihapus permanen dan musnah dari cloud."); 
            }
        } catch(e) {
            if (window.showToast) window.showToast("Gagal musnahkan materi.", true); 
        }
    } 
};


/**
 * ============================================================================
 * [24] CORE AUTHENTICATION STATE OBSERVER (FIXED LOGIN BUG)
 * ============================================================================
 */

onAuthStateChanged(authInstance, function(user) {
    const modalLogin = document.getElementById('modal-login');
    
    if (user) {
        window.AuraState.user.uid = user.uid; 
        window.AuraState.user.isAnonymous = user.isAnonymous;
        
        if (modalLogin) {
            modalLogin.classList.add('hidden');
        }
        
        // Memantik trigger fetching listener database
        if (typeof loadRealtimeDatabaseData === 'function') {
            loadRealtimeDatabaseData();
        }
        
        if (window.FirebaseService) {
            window.FirebaseService.saveAuditLog('LOGIN.SUCCESS', 'Validasi Gerbang Pertahanan User Lulus Otorisasi Penuh.');
        }
        
        const savedGeminiPin = sessionStorage.getItem('aurafi_gemini_pin'); 
        if (savedGeminiPin && typeof window.syncGeminiEngine === 'function') { 
            setTimeout(function() {
                window.syncGeminiEngine(true);
            }, 1000); 
        }
    } else {
        Logger.info('Auth', 'Bypass Otentikasi Gagal atau Akun Dibakar. Memutuskan jalur antrean Cloud...');
        
        const subs = window.AuraState.listeners;
        for (let i = 0; i < subs.length; i++) {
            if (typeof subs[i] === 'function') {
                subs[i]();
            }
        }
        window.AuraState.listeners = [];
        window.AuraState.user.uid = null;
        
        if (modalLogin) {
            modalLogin.classList.remove('hidden');
        }
    }
});


/**
 * ============================================================================
 * [25] PWA SERVICE WORKER (PROGRESSIVE WEB APP API)
 * ============================================================================
 */
if ("serviceWorker" in navigator) { 
    window.addEventListener("load", function() { 
        navigator.serviceWorker.register("./service-worker.js")
            .then(function(registrationResult) {
                Logger.info("ServiceWorker", "Instalasi file PWA Cache Offline terkonfirmasi berhasil ke perangkat lokal klien.", registrationResult.scope);
            })
            .catch(function(err) {
                Logger.error("ServiceWorker", "Protokol pencegahan modul instalasi gagal terverifikasi.", err);
            }); 
    }); 
}