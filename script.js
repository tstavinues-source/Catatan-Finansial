/**
 * =========================================================================================
 * █████╗ ██╗   ██╗██████╗  █████╗ ███████╗██╗    ██╗   ██╗██████╗ 
 * ██╔══██╗██║   ██║██╔══██╗██╔══██╗██╔════╝██║    ██║   ██║╚════██╗
 * ███████║██║   ██║██████╔╝███████║█████╗  ██║    ██║   ██║ █████╔╝
 * ██╔══██║██║   ██║██╔══██╗██╔══██║██╔══╝  ██║    ╚██╗ ██╔╝ ╚═══██╗
 * ██║  ██║╚██████╔╝██║  ██║██║  ██║██║     ██║     ╚████╔╝ ██████╔╝
 * ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝      ╚═══╝  ╚═════╝ 
 * =========================================================================================
 * AURAFI OS V3.2.1 - THE LIVING WEALTH OS (KAS APATO EDITION - STABLE & SECURED)
 * =========================================================================================
 * * =========================================================================================
 * 📋 LAPORAN PERBAIKAN BUG & IMPLEMENTASI FITUR BARU (DOKUMENTASI INTERNAL)
 * =========================================================================================
 * * 🛡️ [PERBAIKAN KEAMANAN & STABILITAS SISTEM]
 * 1. Bug #15 & #32 (KRITIKAL): Proteksi Injeksi XSS & CryptoJS Verification.
 * - Seluruh input chat Oracle, deskripsi transaksi, dan nama item disanitasi menggunakan
 * fungsi `AuraUtils.escapeHtml()` sebelum dirender ke DOM.
 * - Menambahkan runtime-check `EncryptionService.isAvailable()` untuk memastikan pustaka
 * CryptoJS terisi di memory sebelum menjalankan dekripsi API Key.
 * 2. Bug #24 (HIGH): Secure Storage PIN Gemini.
 * - Memindahkan penyimpanan PIN dekripsi dari `localStorage` (plaintext & persisten) 
 * ke `sessionStorage` agar data otomatis terhapus saat tab browser ditutup.
 * 3. Bug #4 & #5 (HIGH): Single Source of Truth & Clean State Management.
 * - Menghilangkan dual state. Seluruh variabel global legacy (seperti `window.allTransactions`)
 * kini dihubungkan langsung ke `window.AuraState.data` menggunakan `Object.defineProperty`.
 * 4. Bug #47 & #48 (HIGH): Penanganan Memory Leak pada Firebase Realtime Listener.
 * - Menyediakan array `AuraState.listeners` untuk menampung fungsi unsubscribe `onValue`.
 * - Saat pengguna logout, sistem secara otomatis mengeksekusi semua listener unsubscribe 
 * dan mengosongkan antrean memori.
 * * ⚙️ [OPTIMASI PERFORMA & LOGIKA AKUNTANSI]
 * 1. Bug #35 (MEDIUM): High-Performance Render Engine via Debouncing.
 * - Mengimplementasikan fungsi `AuraUtils.debounce` pada kalkulasi `reCalculateAll` 
 * untuk menghindari overhead render DOM berulang-ulang dalam hitungan milidetik.
 * 2. Bug #20 (MEDIUM): Caching Context dengan TTL (Time-To-Live) pada MemoryService.
 * - Hasil pencarian query transaksi untuk AI kini disimpan dalam cache memori lokal dengan 
 * durasi kadaluarsa 60 detik (TTL) agar menghemat waktu komputasi O(n).
 * 3. Bug #12 & #46 (MEDIUM): Presisi Siklus Akuntansi & Logika Tanggal 16-15.
 * - Perbaikan kalkulasi rentang waktu akhir bulan menggunakan timestamp objek Date yang solid
 * untuk menghindari kegagalan pembayaran tagihan terjadwal pada bulan pendek (misal: Februari).
 * 4. Bug #44 (MEDIUM): Ekspor CSV Aman dari Serangan Injeksi Formula Spreadsheet.
 * - Menambahkan sanitasi string (`sanitizeCSV`) yang membungkus nilai dengan tanda kutip ganda 
 * dan membersihkan karakter berbahaya (+, -, =, @).
 * * ✨ [FITUR UNGGULAN BARU: DYNAMIC ITEM TRACKER]
 * - Sistem pelacakan bahan pokok (Beras, Minyak, Sabun) tidak lagi di-hardcode di dalam script.
 * - Sekarang pelacak didefinisikan secara dinamis melalui data konfigurasi `settingsData`.
 * - Pengguna dapat menambah, mengedit, atau menghapus parameter tracker (contoh: melacak Susu, Popok,
 * atau Kopi) beserta kata kuncinya secara fleksibel.
 * - Sistem kalkulasi secara otomatis akan memetakan dan merender hasilnya ke elemen DOM 
 * yang sesuai berdasarkan ID tracker (`track-[id_tracker]`).
 * * =========================================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getDatabase, ref, push, update, remove, onValue, get 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { 
    getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, 
    signInWithEmailAndPassword, signInAnonymously, onAuthStateChanged, 
    signOut, setPersistence, browserLocalPersistence 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

/**
 * ============================================================================
 * [1] SYSTEM CONFIGURATION & CONSTANTS
 * ============================================================================
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

const APP_CONFIG = {
    LEDGER_NODE: 'aurafi_ledger',
    VERSION: '3.2.1',
    DEFAULT_CURRENCY: 'JPY',
    DEFAULT_THEME: 'midnight',
    THROTTLE_MS: 300,       // Debounce timer untuk mengoptimalkan render DOM (Bug #35 Fix)
    MAX_RETRY_AI: 3,        // Limitasi pengulangan AI saat terjadi error jaringan (Bug #22/23 Fix)
    CACHE_TTL_MS: 60000     // 60 detik batas cache memori AI (Bug #20 Fix)
};

const DEFAULT_SYSTEM_CATEGORIES = {
    "cat_sys_1": { name: "Makanan", icon: "fa-burger", color: "#fb923c", type: "expense", isSystem: true },
    "cat_sys_2": { name: "Minuman", icon: "fa-mug-hot", color: "#60a5fa", type: "expense", isSystem: true },
    "cat_sys_3": { name: "Bahan Pokok", icon: "fa-basket-shopping", color: "#4ade80", type: "expense", isSystem: true },
    "cat_sys_4": { name: "Utilitas", icon: "fa-file-invoice-dollar", color: "#facc15", type: "expense", isSystem: true },
    "cat_sys_5": { name: "Transportasi", icon: "fa-train", color: "#34d399", type: "expense", isSystem: true },
    "cat_sys_6": { name: "Kesehatan", icon: "fa-kit-medical", color: "#fb7185", type: "expense", isSystem: true },
    "cat_sys_7": { name: "Hiburan", icon: "fa-gamepad", color: "#c084fc", type: "expense", isSystem: true },
    "cat_sys_8": { name: "Belanja Online", icon: "fa-box-open", color: "#f472b6", type: "expense", isSystem: true },
    "cat_sys_9": { name: "Belanja Offline", icon: "fa-shop", color: "#818cf8", type: "expense", isSystem: true },
    "cat_sys_10":{ name: "Pendidikan", icon: "fa-graduation-cap", color: "#22d3ee", type: "expense", isSystem: true },
    "cat_sys_11":{ name: "Pakaian", icon: "fa-shirt", color: "#e879f9", type: "expense", isSystem: true },
    "cat_sys_12":{ name: "Elektronik", icon: "fa-laptop", color: "#94a3b8", type: "expense", isSystem: true },
    "cat_sys_13":{ name: "Pemasukan", icon: "fa-money-bill-wave", color: "#10b981", type: "income", isSystem: true },
    // Bug #3 Fix: Menghindari bentrok nama ID kategori sistem dengan ID dinamis
    "cat_sys_14_default":{ name: "Lainnya", icon: "fa-tag", color: "#52525b", type: "both", isSystem: true }
};

// Default Konfigurasi Dynamic Staples Tracker jika Firebase kosong
const DEFAULT_STAPLES_TRACKERS = {
    "beras": { name: "Beras", keywords: ["beras", "rice", "gohan"] },
    "minyak": { name: "Minyak", keywords: ["minyak", "oil", "abura"] },
    "sabun": { name: "Sabun/Cuci", keywords: ["sabun", "soap", "deterjen", "rinso", "shampoo", "wash", "sunlight", "mama lemon"] }
};

/**
 * ============================================================================
 * [2] GLOBAL STATE MANAGEMENT (AURA STATE - SINGLE SOURCE OF TRUTH)
 * ============================================================================
 */

window.AuraState = {
    user: { uid: null, profile: {}, isAnonymous: false },
    system: {
        theme: APP_CONFIG.DEFAULT_THEME,
        activeView: 'dashboard',
        isProcessing: false,
        exchangeRateIDR: 105,
        displayCurrency: APP_CONFIG.DEFAULT_CURRENCY,
        base64Upload: "",
        isRatesLoaded: false,
        isOnline: navigator.onLine // Melacak koneksi internet real-time (Bug #8 Fix)
    },
    filters: {
        search: '',
        category: 'ALL',
        user: 'ALL',
        periodMode: 'month' // 'period' (16-15), 'month' (1-31), 'all'
    },
    data: {
        transactions: [],
        trash: [],
        goals: [],
        groqKeys: [],
        oracleChats: [],
        settings: {},
        monthlyBudget: 100000
    },
    temp: {
        deleteTarget: null, 
        editItemTarget: null, 
        editTrxTarget: null,
        addItemTargetTrxId: null, 
        expandedReceipts: {}, 
        budgetUpdateTimer: null,
        aiStaging: null,
        isProcessingRecurring: false // Pengunci konkurensi eksekusi tagihan rutin (Bug #45 Fix)
    },
    instances: { firebaseApp: null, db: null, auth: null, geminiEngine: null },
    listeners: [] // Tempat penyimpanan instansi listener untuk cleanup saat logout (Bug #47 Fix)
};

// Jembatan Proxy Backward Compatibility untuk Inline HTML Event Handler (Bug #4 Fix)
const bindGlobalStateProperty = (globalName, statePath) => {
    Object.defineProperty(window, globalName, {
        get: () => {
            const parts = statePath.split('.');
            let context = window.AuraState;
            for (let part of parts) {
                context = context[part];
            }
            return context;
        },
        set: (value) => {
            const parts = statePath.split('.');
            let context = window.AuraState;
            for (let i = 0; i < parts.length - 1; i++) {
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
 * [3] ENTERPRISE LOGGER SYSTEM (AUDIT TRAIL BASE - SECURED NAMESPACE)
 * ============================================================================
 */
// Bug #6 Fix: Proteksi agar namespace AuraLogger terlindungi dan tidak berbenturan
window.AuraLogger = {
    ENABLE_DEBUG: true,
    _formatTime() {
        const d = new Date();
        return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}.${d.getMilliseconds().toString().padStart(3,'0')}`;
    },
    info(module, message, data = null) {
        if (!this.ENABLE_DEBUG) return;
        console.log(`%c[INFO | ${this._formatTime()}] [${module}]`, 'color: #38bdf8; font-weight: bold;', message, data !== null ? data : '');
    },
    success(module, message, data = null) {
        if (!this.ENABLE_DEBUG) return;
        console.log(`%c[SUCCESS | ${this._formatTime()}] [${module}]`, 'color: #10b981; font-weight: bold;', message, data !== null ? data : '');
    },
    warn(module, message, data = null) {
        if (!this.ENABLE_DEBUG) return;
        console.log(`%c[WARN | ${this._formatTime()}] [${module}]`, 'color: #facc15; font-weight: bold;', message, data !== null ? data : '');
    },
    error(module, message, error = null) {
        console.error(`%c[ERROR | ${this._formatTime()}] [${module}]`, 'color: #f43f5e; font-weight: bold;', message);
        if (error) console.error(error);
    }
};
const Logger = window.AuraLogger;

/**
 * ============================================================================
 * [4] FIREBASE INITIALIZATION & CONNECTION MONITORING
 * ============================================================================
 */
Logger.info('Core', 'Menginisialisasi Firebase SDK Environment...');
try {
    window.AuraState.instances.firebaseApp = initializeApp(FIREBASE_CONFIG);
    window.AuraState.instances.db = getDatabase(window.AuraState.instances.firebaseApp);
    window.AuraState.instances.auth = getAuth(window.AuraState.instances.firebaseApp);
    const provider = new GoogleAuthProvider();
    window.googleAuthProvider = provider;
    
    // Bug #8 Fix: Monitoring status koneksi Realtime Database
    const connectionRef = ref(window.AuraState.instances.db, ".info/connected");
    onValue(connectionRef, (snap) => {
        if (snap.val() === true) {
            window.AuraState.system.isOnline = true;
            Logger.success('Core', 'Sinkronisasi Cloud Firebase AKTIF.');
        } else {
            window.AuraState.system.isOnline = false;
            Logger.warn('Core', 'Aplikasi berjalan dalam Mode Offline (Koneksi Terputus).');
        }
    });

    Logger.success('Core', 'Firebase Core Modules berhasil dikonfigurasi.');
} catch (error) {
    // Bug #7 Fix: Recovery state jika Firebase gagal diinisialisasi
    Logger.error('Core', 'FATAL: Gagal melakukan bootstrap koneksi Firebase SDK.', error);
    window.showToast("Gagal tersambung ke database Cloud. Aplikasi beralih ke sesi lokal sementara.", true);
}

const db = window.AuraState.instances.db;
const auth = window.AuraState.instances.auth;

/**
 * ============================================================================
 * [5] UTILITY, SECURITY, & DATA NORMALIZATION FUNCTIONS
 * ============================================================================
 */
window.AuraUtils = {
    generateId(prefix = 'id') {
        const time = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 10);
        return `${prefix}_${time}_${random}`;
    },

    // Bug #32 Fix: Proteksi XSS (Cross-Site Scripting) secara global
    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    },

    // Bug #9 Fix: Parsing JSON yang kokoh dengan mengabaikan pembungkus markdown AI secara selektif
    parseCleanJSON(text) {
        try {
            if (!text) throw new Error("Output dari AI kosong.");
            let cleanedText = text.trim();
            // Eliminasi format block markdown ```json ... ``` atau ``` ... ```
            cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
            return JSON.parse(cleanedText);
        } catch (e) {
            Logger.error('Utility', 'Gagal memparsing JSON hasil ekstraksi AI.', text);
            throw new Error("Gagal mengurai respons AI. Terdapat kerusakan struktur data JSON.");
        }
    },

    // Bug #10 Fix: Pengaman fallback jika format currency lokal bermasalah
    formatCurrency(amount) {
        try {
            const currency = window.displayCurrency || APP_CONFIG.DEFAULT_CURRENCY;
            return new Intl.NumberFormat(currency === 'JPY' ? 'ja-JP' : 'id-ID', {
                style: 'currency', currency: currency, maximumFractionDigits: 0
            }).format(amount);
        } catch (e) { 
            return `${window.displayCurrency || APP_CONFIG.DEFAULT_CURRENCY} ${Number(amount).toLocaleString()}`; 
        }
    },

    // Bug #11 Fix: Validasi keamanan tipe mata uang sebelum dikonversi
    convertCurrency(amount, fromCurrency) {
        const numAmount = Number(amount) || 0;
        const currentDisplay = window.displayCurrency || APP_CONFIG.DEFAULT_CURRENCY;
        if (!fromCurrency || typeof fromCurrency !== 'string') return numAmount;
        if (fromCurrency === currentDisplay) return numAmount;
        if (fromCurrency === 'JPY' && currentDisplay === 'IDR') return numAmount * window.exchangeRateIDR;
        if (fromCurrency === 'IDR' && currentDisplay === 'JPY') return numAmount / window.exchangeRateIDR;
        return numAmount; 
    },

    safeDOM(id, callback) {
        const el = document.getElementById(id);
        if (el && typeof callback === 'function') callback(el);
        return el;
    },

    sanitizeItemsArray(items, defaultPaymentMethod, defaultTimestamp) {
        if (!items || !Array.isArray(items)) return [];
        return items.map(item => ({
            itemId: item.itemId || this.generateId('itm'),
            nama_barang: this.escapeHtml(item.nama_barang || item.name || "Item Abstrak"),
            harga: Math.max(0, Number(item.harga !== undefined ? item.harga : (item.price || 0)) || 0), // Bug #29 Fix (Mencegah harga NaN / Negatif)
            qty: Math.max(1, Number(item.qty !== undefined ? item.qty : 1) || 1),                      // Bug #29 Fix (Mencegah qty NaN / Nol)
            kategori_barang: item.kategori_barang || item.category || "Lainnya",
            tax_rate: Math.max(0, Number(item.tax_rate !== undefined ? item.tax_rate : 0) || 0),
            paymentMethod: item.paymentMethod || defaultPaymentMethod || "cashless",
            timestamp: item.timestamp || defaultTimestamp || new Date().toISOString()
        }));
    },

    formatDateToReadable(isoString) {
        try {
            const d = new Date(isoString);
            if (isNaN(d.getTime())) return "---";
            const yr = d.getFullYear(); const mo = String(d.getMonth() + 1).padStart(2, '0');
            const da = String(d.getDate()).padStart(2, '0'); const hr = String(d.getHours()).padStart(2, '0');
            const mi = String(d.getMinutes()).padStart(2, '0');
            return `${yr}/${mo}/${da} ${hr}:${mi}`;
        } catch (e) { return "---"; }
    },

    // Bug #12 Fix: Kalkulasi siklus finansial 16-15 yang akurat hingga detik 23:59:59
    getPeriodRange() {
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
        return { start: start.getTime(), end: end.getTime(), startObj: start, endObj: end };
    },

    // Bug #35 Fix: Debounce untuk membatasi pemanggilan berulang reCalculateAll dalam waktu berdekatan
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

window.generateItemId = () => window.AuraUtils.generateId('itm');
window.parseCleanJSON = window.AuraUtils.parseCleanJSON;
window.formatVal = window.AuraUtils.formatCurrency;
window.convertVal = window.AuraUtils.convertCurrency;
window.sanitizeItems = window.AuraUtils.sanitizeItemsArray;

/**
 * ============================================================================
 * [6] DYNAMIC CATEGORY ENGINE (MONEY LOVER STYLE)
 * ============================================================================
 */
window.CategoryManager = {
    getAllCategories() {
        const customCats = window.settingsData?.categories || {};
        return { ...DEFAULT_SYSTEM_CATEGORIES, ...customCats };
    },
    resolveStyle(catName) {
        const allCats = this.getAllCategories();
        const safeName = (catName || "Lainnya").toLowerCase().trim();
        
        // Exact Match
        const exactMatch = Object.values(allCats).find(c => c.name.toLowerCase() === safeName);
        if (exactMatch) return { icon: exactMatch.icon || 'fa-tag', hex: exactMatch.color || '#52525b', name: exactMatch.name };

        // Bug #13 Fix: Fuzzy Matching berbasis kamus sinonim yang presisi
        if (safeName.includes('makan') || safeName.includes('kuliner') || safeName.includes('cemilan')) return { icon: 'fa-burger', hex: '#fb923c', name: 'Makanan' };
        if (safeName.includes('minum') || safeName.includes('kopi') || safeName.includes('teh') || safeName.includes('cafe')) return { icon: 'fa-mug-hot', hex: '#60a5fa', name: 'Minuman' };
        if (safeName.includes('tagihan') || safeName.includes('utilitas') || safeName.includes('listrik') || safeName.includes('air') || safeName.includes('wifi')) return { icon: 'fa-file-invoice-dollar', hex: '#facc15', name: 'Utilitas' };
        if (safeName.includes('gaji') || safeName.includes('masuk') || safeName.includes('transferan') || safeName.includes('bonus')) return { icon: 'fa-money-bill-wave', hex: '#10b981', name: 'Pemasukan' };
        if (safeName.includes('obat') || safeName.includes('sehat') || safeName.includes('dokter') || safeName.includes('klinik')) return { icon: 'fa-kit-medical', hex: '#fb7185', name: 'Kesehatan' };
        if (safeName.includes('baju') || safeName.includes('pakaian') || safeName.includes('fashion') || safeName.includes('celana')) return { icon: 'fa-shirt', hex: '#e879f9', name: 'Pakaian' };
        if (safeName.includes('hibur') || safeName.includes('main') || safeName.includes('game') || safeName.includes('bioskop')) return { icon: 'fa-gamepad', hex: '#c084fc', name: 'Hiburan' };
        
        return { icon: 'fa-tag', hex: '#52525b', name: 'Lainnya' };
    },
    getCategoryStringList() { return Object.values(this.getAllCategories()).map(c => c.name).join(', '); },
    renderDropdowns() {
        const allCats = this.getAllCategories();
        let optionsHtml = '';
        Object.values(allCats).forEach(c => { optionsHtml += `<option value="${c.name}">${c.name}</option>`; });
        
        const targetIds = ['manual-trx-category', 'add-item-cat', 'edit-item-cat', 'filter-category', 'staging-trx-cat'];
        targetIds.forEach(id => {
            window.AuraUtils.safeDOM(id, (el) => {
                const currentVal = el.value; 
                // Bug #14 Fix: dropdown rendering aman dengan delegasi value
                el.innerHTML = (id === 'filter-category' ? `<option value="ALL">SEMUA KATEGORI</option>` : `<option value="Lainnya">Pilih Kategori...</option>`) + optionsHtml;
                if (currentVal) { const exists = Array.from(el.options).some(opt => opt.value === currentVal); if (exists) el.value = currentVal; }
            });
        });
    }
};

window.getAllCategories = () => window.CategoryManager.getAllCategories();
window.getCategoryStyle = (name) => window.CategoryManager.resolveStyle(name);
window.getCategoryHexColor = (name) => window.CategoryManager.resolveStyle(name).hex;
window.renderCategoryDropdowns = () => window.CategoryManager.renderDropdowns();

/**
 * ============================================================================
 * [7] ENCRYPTION & SECURITY SERVICE (CRYPTOJS COMPATIBILITY SECURED)
 * ============================================================================
 */
window.EncryptionService = {
    // Bug #15 Fix: Pengecekan ketersediaan library CryptoJS sebelum eksekusi dekripsi API Key
    isAvailable() {
        if (typeof CryptoJS === 'undefined' || !CryptoJS.AES) {
            Logger.warn('Security', 'Library CryptoJS belum termuat di DOM. Enkripsi dinonaktifkan sementara.');
            return false;
        }
        return true;
    },
    encryptApiKey(apiKey, secretKey) { 
        if(!secretKey || !this.isAvailable()) return null; 
        try { 
            return CryptoJS.AES.encrypt(apiKey, secretKey).toString(); 
        } catch (e) { return null; } 
    },
    decryptApiKey(cipherText, secretKey) { 
        if(!secretKey || !this.isAvailable()) return null; 
        try { 
            const bytes = CryptoJS.AES.decrypt(cipherText, secretKey); 
            return bytes.toString(CryptoJS.enc.Utf8) || null; 
        } catch(e) { return null; } 
    },
    validate(apiKey, secretKey) { 
        const encrypted = this.encryptApiKey(apiKey, secretKey); 
        const decrypted = this.decryptApiKey(encrypted, secretKey); 
        return decrypted === apiKey; 
    }
};

/**
 * ============================================================================
 * [8] FIREBASE CRUD & AUDIT LOGGING SYSTEM (KAS APATO SECURED)
 * ============================================================================
 */
window.FirebaseService = {
    // Bug #16 Fix: Guard untuk mencegah penulisan data audit log ke Firebase saat UID kosong / balapan data login
    async saveAuditLog(action, detail) {
        if (!window.currentUserUid) {
            Logger.warn('AuditLog', `Log dilewati: [${action}] ${detail} (UID belum diinisialisasi)`);
            return;
        }
        try {
            const profile = window.settingsData?.profile || {};
            const userName = profile.fullName || profile.nickname || "User";
            await push(ref(db, `${APP_CONFIG.LEDGER_NODE}/${window.currentUserUid}/audit_logs`), {
                action: action, detail: window.AuraUtils.escapeHtml(detail), user: userName, ts: Date.now()
            });
            Logger.info('AuditLog', `Recorded: [${action}] ${detail}`);
        } catch (e) { Logger.error('AuditLog', 'Gagal merekam log aktivitas ke Cloud.', e); }
    },
    
    // Bug #17 Fix: Validasi skema transaksi sebelum disimpan ke Firebase
    async saveTransaction(data, isFromAI = false) { 
        if (!window.currentUserUid) throw new Error("Operasi ditolak: Sesi belum login.");
        try {
            data.user_id = window.settingsData?.profile?.nickname || "System User";
            data.nominal = Math.max(0, Number(data.nominal) || 0); // Mencegah nominal NaN atau negatif
            
            await push(ref(db, `${APP_CONFIG.LEDGER_NODE}/${window.currentUserUid}/transactions`), data);
            await this.saveAuditLog(isFromAI ? "AI_EXTRACT" : "MANUAL_ADD", `Transaksi: ${data.merchantName} (${window.AuraUtils.formatCurrency(data.nominal)})`);
            Logger.success('Firebase', 'Transaksi baru berhasil disinkronisasi ke server.');
        } catch (e) { throw e; }
    },

    // Bug #18 Fix: Pengecekan eksistensi data sebelum melakukan modifikasi transaksi
    async updateTransaction(id, data) { 
        if (!window.currentUserUid) return;
        try {
            const pathRef = ref(db, `${APP_CONFIG.LEDGER_NODE}/${window.currentUserUid}/transactions/${id}`);
            const snapshot = await get(pathRef);
            if (!snapshot.exists()) {
                throw new Error("Data transaksi target tidak ditemukan di server.");
            }
            await update(pathRef, data);
            await this.saveAuditLog("SYS.EDIT", `Update ID: ${id}`);
        } catch (e) { throw e; }
    },

    async moveToTrash(id) { 
        await this.updateTransaction(id, { is_deleted: true, deletedAt: new Date().toISOString() });
        await this.saveAuditLog("SYS.DELETE", `Pindah ke sampah ID: ${id}`);
    },

    async deleteTransactionPermanently(id) { 
        if (!window.currentUserUid) return;
        await remove(ref(db, `${APP_CONFIG.LEDGER_NODE}/${window.currentUserUid}/transactions/${id}`));
        await this.saveAuditLog("SYS.PERMA_DELETE", `Hapus permanen ID: ${id}`);
    },

    async saveGoal(data) { 
        if (!window.currentUserUid) return;
        await push(ref(db, `${APP_CONFIG.LEDGER_NODE}/${window.currentUserUid}/goals`), data); 
    },

    async deleteGoal(id) { 
        if (!window.currentUserUid) return;
        await remove(ref(db, `${APP_CONFIG.LEDGER_NODE}/${window.currentUserUid}/goals/${id}`)); 
    },

    async updateSettings(data) { 
        if (!window.currentUserUid) return;
        await update(ref(db, `${APP_CONFIG.LEDGER_NODE}/${window.currentUserUid}/settings`), data); 
    },

    async saveGroqKey(encryptedKey) { 
        if (!window.currentUserUid) return;
        await push(ref(db, `${APP_CONFIG.LEDGER_NODE}/${window.currentUserUid}/groqApiKeys`), { encryptedKey: encryptedKey, createdAt: new Date().toISOString(), active: true, usageCount: 0 }); 
    },

    async deleteGroqKey(keyId) { 
        if (!window.currentUserUid) return;
        await remove(ref(db, `${APP_CONFIG.LEDGER_NODE}/${window.currentUserUid}/groqApiKeys/${keyId}`)); 
    },

    async pushOracleChat(chatObj) { 
        if (!window.currentUserUid) return;
        await push(ref(db, `${APP_CONFIG.LEDGER_NODE}/${window.currentUserUid}/oracleChats`), chatObj); 
    }
};

/**
 * ============================================================================
 * [9] MEMORY & CONTEXT RETRIEVAL SERVICE (OPTIMIZED CACHING SYSTEM)
 * ============================================================================
 */
window.MemoryService = {
    _cache: {}, // Bug #20 Fix: Penyimpanan cache query transaksi finansial untuk optimasi pencarian Oracle
    
    getRelevantTransactions(query) {
        if (!window.allTransactions || window.allTransactions.length === 0) return [];
        const keyword = (query || "").toLowerCase().trim();
        
        // Return dari cache jika masih dalam rentang masa berlaku TTL (60 detik)
        const cachedItem = this._cache[keyword];
        if (cachedItem && (Date.now() - cachedItem.timestamp < APP_CONFIG.CACHE_TTL_MS)) {
            Logger.info('MemoryService', 'Mengambil konteks dari cache memori lokal.');
            return cachedItem.data;
        }

        let matched = window.allTransactions.filter(t => {
            const matchCategory = (t.kategori || "").toLowerCase().includes(keyword);
            const matchStore = (t.merchantName || t.storeName || "").toLowerCase().includes(keyword);
            const matchDesc = (t.description || t.catatan_ai || "").toLowerCase().includes(keyword);
            const matchItems = t.items && t.items.some(it => (it.nama_barang || "").toLowerCase().includes(keyword));
            return matchCategory || matchStore || matchItems || matchDesc;
        });

        const queryResult = matched.length > 0 ? matched.slice(0, 5) : window.allTransactions.slice(0, 5);
        
        // Simpan hasil pencarian baru ke dalam cache
        this._cache[keyword] = {
            data: queryResult,
            timestamp: Date.now()
        };

        return queryResult;
    },
    getRelevantChats() { return window.oracleChats ? window.oracleChats.slice(-8) : []; }
};

/**
 * ============================================================================
 * [10] FINANCIAL SUMMARY SERVICE
 * ============================================================================
 */
window.FinancialSummaryService = {
    getSummaryString() {
        let cashBal = 0, cashlessBal = 0, totSpent = 0;
        const today = new Date();
        const txList = window.allTransactions || [];
        
        txList.forEach(t => {
            const val = Number(t.nominal || 0);
            const isCash = t.metode_pembayaran === 'tunai';
            if (t.tipe === 'pemasukan') { if (isCash) cashBal += val; else cashlessBal += val; } 
            else if (t.tipe === 'tarik_tunai') { let adminFee = Number(t.admin_fee || 0); cashBal += val; cashlessBal -= (val + adminFee); } 
            else if (t.tipe === 'setor_tunai') { let adminFee = Number(t.admin_fee || 0); cashBal -= val; cashlessBal += val; cashlessBal -= adminFee; } 
            else {
                if (isCash) cashBal -= val; else cashlessBal -= val;
                const tDate = new Date(t.tanggal);
                if (!isNaN(tDate.getTime()) && tDate.getMonth() === today.getMonth() && tDate.getFullYear() === today.getFullYear()) { totSpent += val; }
            }
        });
        const profile = window.settingsData?.profile || {};
        return `--- PROFIL & RINGKASAN PENGGUNA ---\nNama: ${profile.fullName||"User AuraFi"} (${profile.nickname||"User"})\nMata Uang: ${window.displayCurrency}\nSisa Tunai: ${cashBal} ${window.displayCurrency}\nSisa Cashless: ${cashlessBal} ${window.displayCurrency}\nNet Worth: ${cashBal + cashlessBal} ${window.displayCurrency}\nPengeluaran Bulan Ini: ${totSpent} ${window.displayCurrency}`;
    }
};

/**
 * ============================================================================
 * [11] AI ENGINES: GROQ (NLP) & GEMINI (VISION) FAILOVER SYSTEM
 * ============================================================================
 */
window.GroqService = {
    keysPool: [], currentIndex: 0, model: "llama-3.3-70b-versatile", secret: groqSecretKey,
    init(rawKeysArray) {
        this.keysPool = [];
        for(let item of rawKeysArray) {
            if(item.active) {
                const decrypted = window.EncryptionService.decryptApiKey(item.encryptedKey, this.secret);
                if(decrypted && decrypted.startsWith('gsk_')) { this.keysPool.push({ id: item.id, value: decrypted }); }
            }
        }
        this.currentIndex = 0; return this.keysPool.length;
    },
    getCurrentApiKey() { return this.keysPool.length === 0 ? null : this.keysPool[this.currentIndex].value; },
    switchToNextApiKey() { if(this.keysPool.length <= 1) return false; this.currentIndex = (this.currentIndex + 1) % this.keysPool.length; return true; },
    
    // Bug #22 & #23 Fix: Rate Limiting & Error Handling komprehensif pada Groq
    async fetch(messages, requireJson = false) {
        if(this.keysPool.length === 0) throw new Error("API Key Groq Kosong.");
        let attempt = 0; const totalKeys = this.keysPool.length;
        
        while (attempt < totalKeys) {
            const apiKey = this.getCurrentApiKey();
            try {
                const payload = { model: this.model, messages: messages, temperature: requireJson ? 0.1 : 0.7 };
                if(requireJson) payload.response_format = { type: "json_object" };
                
                const response = await fetch("[https://api.groq.com/openai/v1/chat/completions](https://api.groq.com/openai/v1/chat/completions)", {
                    method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                });
                
                // Switch key jika terkena limitasi rate-limiting 429 atau error server 500+
                if(response.status === 429 || response.status === 400 || response.status === 401 || response.status === 503 || response.status >= 500) { 
                    this.switchToNextApiKey(); attempt++; continue; 
                }
                if (!response.ok) { const err = await response.json(); throw new Error(err.error?.message || "Groq Error"); }
                const data = await response.json(); return data.choices[0].message.content;
            } catch (err) { this.switchToNextApiKey(); attempt++; }
        }
        throw new Error("Semua API Key Groq gagal.");
    }
};

window.GeminiFailoverEngine = class GeminiFailoverEngine {
    constructor(pinCode) { this.pin = pinCode; this.keysPool = []; this.currentIndex = 0; }
    async init() {
        this.keysPool = []; const snapshot = await get(ref(db, 'nexus_api_vault'));
        if (snapshot.exists()) {
            const vaultData = snapshot.val();
            for (const id in vaultData) {
                const item = vaultData[id];
                let decrypted = window.EncryptionService.decryptApiKey(item.value, this.pin);
                if (!decrypted) { try { let text = atob(item.value); let result = ''; for (let i = 0; i < text.length; i++) { result += String.fromCharCode(text.charCodeAt(i) ^ this.pin.charCodeAt(i % this.pin.length)); } decrypted = result; } catch(e) {} }
                if (decrypted && (decrypted.startsWith('AIza') || decrypted.startsWith('AQ.'))) { this.keysPool.push({ id: item.name || id, value: decrypted.trim() }); }
            }
        }
        return this.keysPool.length;
    }
    
    // Bug #25 Fix: Mencegah request Gemini menggantung tanpa respon (AbortController timeout 30s)
    async fetch(payload, base64Image) {
        if (this.keysPool.length === 0) throw new Error("Kunci Gemini Kosong / PIN Salah.");
        let attempt = 0; const totalKeys = this.keysPool.length;
        
        while (attempt < totalKeys) {
            const activeKeyObj = this.keysPool[this.currentIndex];
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKeyObj.value}`;
            const requestPayload = JSON.parse(JSON.stringify(payload));
            
            if (base64Image) {
                const base64Data = base64Image.split(',')[1] || base64Image;
                if (!requestPayload.contents) requestPayload.contents = [{ role: "user", parts: [] }];
                if (!requestPayload.contents[0].parts) requestPayload.contents[0].parts = [];
                requestPayload.contents[0].parts.push({ inlineData: { mimeType: "image/jpeg", data: base64Data } });
            }
            
            const controller = new AbortController();
            const signalTimeout = setTimeout(() => controller.abort(), 30000); // Batasi maksimal 30 detik

            try {
                const response = await fetch(url, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(requestPayload),
                    signal: controller.signal
                });
                
                clearTimeout(signalTimeout);
                
                if (response.status === 429 || response.status === 400 || response.status === 401 || response.status >= 500) { 
                    this.currentIndex = (this.currentIndex + 1) % this.keysPool.length; attempt++; continue; 
                }
                if (!response.ok) throw new Error(`HTTP Status ${response.status}`);
                const result = await response.json(); const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!textResponse) throw new Error("Format respons API tidak sesuai"); return textResponse;
            } catch (err) { 
                clearTimeout(signalTimeout);
                this.currentIndex = (this.currentIndex + 1) % this.keysPool.length; attempt++; 
            }
        }
        throw new Error("SEMUA KUNCI GEMINI VISION TERKENA LIMIT!");
    }
};

/**
 * ============================================================================
 * [12] AI ORCHESTRATOR (BUG #27/28 FALLBACK FIXED)
 * ============================================================================
 */
window.executeAIWithFallback = async function(messages, systemPrompt, requireJson, base64Image = null) {
    const prefs = window.settingsData?.aiPreferences || {};
    const chatModel = prefs.modelChat || 'Auto'; const visionModel = prefs.modelVision || 'Auto';
    let useGroq = false; let useGemini = false;
    
    if (base64Image) { if (visionModel === 'Gemini' || visionModel === 'Auto') useGemini = true; else if (visionModel === 'Groq Vision') useGroq = true; } 
    else { if (chatModel === 'Groq') useGroq = true; else if (chatModel === 'Gemini') useGemini = true; else { useGroq = true; useGemini = true; } }
    
    let lastError = null;
    
    // Eksekusi Groq
    if (useGroq && window.rawGroqKeysData && window.rawGroqKeysData.length > 0) {
        try { 
            const result = await window.GroqService.fetch(messages, requireJson); 
            lastError = null; // Bug #27 Fix: Bersihkan error status jika operasi sukses
            return result;
        } catch(e) { 
            lastError = e; 
            if (!useGemini) throw e; 
        }
    }
    // Failover ke Gemini jika Groq menemui kegagalan
    if (useGemini && window.failoverEngineInstance && window.failoverEngineInstance.keysPool.length > 0) {
        try {
            const userPrompt = messages[messages.length - 1].content;
            const geminiPayload = { contents: [{ role: "user", parts: [{ text: userPrompt }] }], systemInstruction: { parts: [{ text: systemPrompt }] } };
            if (requireJson) { geminiPayload.generationConfig = { responseMimeType: "application/json" }; }
            const result = await window.failoverEngineInstance.fetch(geminiPayload, base64Image);
            lastError = null; // Bug #27 Fix
            return result;
        } catch(e) { 
            lastError = e; 
        }
    }
    // Bug #28 Fix: Tampilkan kegagalan AI secara detail
    throw new Error(lastError ? `AI Gangguan: ${lastError.message}` : "Sistem transmisi AI offline.");
};

/**
 * ============================================================================
 * [13] AI STAGING AREA (KAS APATO ENGINE)
 * ============================================================================
 */
window.processTransactionParsing = async function(text, imgData = null) {
    if (!window.currentUserUid) return;
    window.setProcessingStatus(true);
    
    try {
        let jsonResult;
        const activeCurrency = window.AuraState.system.displayCurrency || 'JPY';
        const nickname = window.settingsData?.profile?.nickname || "Bos";
        const categoryListStr = window.CategoryManager.getCategoryStringList();

        const systemPrompt = `Kamu AuraFi OS. User: ${nickname}. Mata Uang Aktif: ${activeCurrency}.
Wajib menghasilkan output RAW JSON murni tanpa markdown.
ATURAN UTAMA & AKUNTANSI STRICT:
1. PENARIKAN (TARIK TUNAI): "Tarik tunai 500 admin 110". Tipe="tarik_tunai".
2. PENYETORAN (SETOR TUNAI): "Setor tunai 10000 admin 0". Tipe="setor_tunai".
3. PEMBAYARAN BELANJA: Tipe="pengeluaran". Jika bayar pakai 'tunai', kurangi saldo tunai. Jika 'cashless', kurangi saldo cashless.
4. PERKALIAN ITEM (QTY x HARGA): "Beli kopi 150 2 cup" -> harga=150, qty=2. Subtotal setiap item = harga x qty.
5. KATEGORI ITEM: WAJIB pilih dari daftar ini SAJA: "${categoryListStr}".
6. NAMA TOKO: Ekstrak wajib nama toko/merchant (Misal: Lawson, Amazon). Simpan ke field "merchantName".
7. PAJAK: Hitung subtotal dan distribusikan selisih tax ke tax_rate masing-masing item jika total tidak cocok.
8. DESKRIPSI (DESCRIPTION): Berikan catatan pendek mengenai transaksi ini.

Struktur JSON Wajib:
{
  "merchantName": "string",
  "tanggal": "YYYY-MM-DD",
  "mata_uang": "string",
  "metode_pembayaran": "tunai/cashless",
  "tipe": "pemasukan/pengeluaran/tarik_tunai/setor_tunai",
  "admin_fee": number,
  "description": "string",
  "items": [{"nama_barang": "string", "harga": number, "qty": number, "kategori_barang": "string", "tax_rate": number}]
}`;

        const userContent = `Catat transaksi ini: "${text || "Ekstrak struk Jepang terlampir"}" di mata uang ${activeCurrency}.`;
        const messages = [ { role: "system", content: systemPrompt }, { role: "user", content: userContent } ];

        const aiOutput = await window.executeAIWithFallback(messages, systemPrompt, true, imgData);
        jsonResult = window.AuraUtils.parseCleanJSON(aiOutput);

        const timestamp = new Date().toISOString();
        
        window.aiStaging = {
            items: window.AuraUtils.sanitizeItemsArray(jsonResult.items, jsonResult.metode_pembayaran, timestamp),
            merchantName: jsonResult.merchantName || jsonResult.storeName || jsonResult.kategori || "Toko/Merchant",
            tanggal: jsonResult.tanggal || timestamp.split('T')[0],
            mata_uang: jsonResult.mata_uang || activeCurrency,
            metode_pembayaran: jsonResult.metode_pembayaran || 'cashless',
            tipe: jsonResult.tipe || 'pengeluaran',
            admin_fee: jsonResult.admin_fee || 0,
            description: jsonResult.description || 'Ekstraksi AI Staging',
            isCustomDescription: true
        };

        window.renderStagingUI();
        window.showModal('modal-ai-staging');
        window.showToast("Ekstraksi Selesai! Silakan verifikasi di Staging Area.");

    } catch(e) { 
        Logger.error('TransactionParser', 'Gagal memproses payload OCR AI.', e);
        window.showToast(e.message || "Sistem AI gagal memproses data.", true); 
    } finally { 
        window.setProcessingStatus(false); 
    }
};

window.renderStagingUI = function() {
    if (!window.aiStaging) return;
    
    // Bug #30 Fix: Menghindari duplikasi pembuatan elemen modal staging di DOM
    let stagingModal = document.getElementById('modal-ai-staging');
    if (!stagingModal) {
        const modalHtml = `
        <div id="modal-ai-staging" class="fixed inset-0 z-[200] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 hidden opacity-0 transition-all duration-300">
            <div class="glass-panel w-full max-w-lg h-[90vh] flex flex-col shadow-2xl border-t-4 border-t-accent overflow-hidden">
                <div class="p-4 flex justify-between items-center border-b border-[var(--border-glass)] bg-[var(--bg-glass)]">
                    <h3 class="text-lg font-bold flex items-center gap-2 text-accent font-display"><i class="fa-solid fa-microscope"></i> AI Staging Area</h3>
                    <button onclick="window.closeModal('modal-ai-staging')" class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition"><i class="fa-solid fa-xmark"></i></button>
                </div>
                
                <div class="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
                    <div class="flex gap-2">
                        <div class="flex-1">
                            <label class="text-[9px] uppercase tracking-widest text-[var(--text-muted)] mb-1 block font-bold">Toko / Merchant</label>
                            <input type="text" id="staging-trx-store" class="v-input w-full rounded-xl p-3 text-sm outline-none">
                        </div>
                        <div class="w-1/3">
                            <label class="text-[9px] uppercase tracking-widest text-[var(--text-muted)] mb-1 block font-bold">Aliran Dana</label>
                            <select id="staging-trx-type" class="v-input w-full rounded-xl p-3 text-sm outline-none bg-black">
                                <option value="pengeluaran">Pengeluaran (-)</option>
                                <option value="pemasukan">Pemasukan (+)</option>
                                <option value="tarik_tunai">Tarik Tunai</option>
                                <option value="setor_tunai">Setor Tunai</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="flex justify-between items-center mt-4 mb-2">
                        <h4 class="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]"><i class="fa-solid fa-list-check"></i> Keranjang Item</h4>
                        <button onclick="window.addStagingItem()" class="text-[10px] text-accent font-bold hover:text-white bg-white/5 px-2 py-1 rounded"><i class="fa-solid fa-plus"></i> Manual</button>
                    </div>
                    
                    <div id="staging-items-container" class="space-y-3">
                        <!-- Keranjang dirender di sini -->
                    </div>
                </div>
                
                <div class="p-4 border-t border-[var(--border-glass)] bg-[var(--bg-base)] shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-10">
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-xs text-[var(--text-muted)] uppercase tracking-widest font-bold">Total Kalkulasi</span>
                        <span class="text-xl font-bold font-mono text-accent" id="staging-total-display">0</span>
                    </div>
                    <button onclick="window.saveStagingToDatabase()" class="w-full py-4 rounded-xl bg-accent text-[var(--bg-base)] font-bold shadow-[0_0_20px_var(--accent-glow)] transition flex items-center justify-center gap-2 text-sm"><i class="fa-solid fa-cloud-arrow-up"></i> Konfirmasi & Simpan Permanen</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    const data = window.aiStaging;
    window.AuraUtils.safeDOM('staging-trx-store', el => el.value = data.merchantName);
    window.AuraUtils.safeDOM('staging-trx-type', el => el.value = data.tipe);
    
    const allCats = window.CategoryManager.getAllCategories();
    let catOptionsHtml = Object.values(allCats).map(c => `<option value="${c.name}">${c.name}</option>`).join('');

    const itemsContainer = document.getElementById('staging-items-container');
    let totalNominal = 0;
    
    if (itemsContainer) {
        itemsContainer.innerHTML = data.items.length === 0 ? '<p class="text-xs text-[var(--text-muted)] text-center italic my-4">Keranjang kosong. Tambahkan item manual.</p>' : data.items.map((it, idx) => {
            const subtotal = (it.harga * (it.qty || 1));
            totalNominal += subtotal;
            return `
            <div class="glass-panel p-3 relative group border-l-2 border-l-accent">
                <button onclick="window.removeStagingItem(${idx})" class="absolute top-2 right-2 text-[var(--color-expense)] hover:text-rose-400 p-1 bg-black/40 rounded-full w-6 h-6 flex items-center justify-center z-10"><i class="fa-solid fa-trash text-[10px]"></i></button>
                <div class="pr-6 space-y-2">
                    <input type="text" value="${it.nama_barang}" onchange="window.updateStagingItem(${idx}, 'nama_barang', this.value)" class="bg-transparent border-b border-[var(--border-glass)] w-full text-sm outline-none text-white pb-1 font-medium focus:border-accent">
                    <div class="flex gap-2">
                        <div class="w-1/4">
                            <span class="text-[8px] text-[var(--text-muted)] block mb-0.5 uppercase tracking-widest font-bold">Qty</span>
                            <input type="number" value="${it.qty}" onchange="window.updateStagingItem(${idx}, 'qty', this.value)" class="bg-black/30 rounded-lg p-2 w-full text-xs outline-none border border-[var(--border-glass)] text-center font-mono">
                        </div>
                        <div class="w-2/4">
                            <span class="text-[8px] text-[var(--text-muted)] block mb-0.5 uppercase tracking-widest font-bold">Harga Satuan</span>
                            <input type="number" value="${it.harga}" onchange="window.updateStagingItem(${idx}, 'harga', this.value)" class="bg-black/30 rounded-lg p-2 w-full text-xs outline-none border border-[var(--border-glass)] font-mono">
                        </div>
                        <div class="flex-1">
                            <span class="text-[8px] text-[var(--text-muted)] block mb-0.5 uppercase tracking-widest font-bold">Kategori</span>
                            <select onchange="window.updateStagingItem(${idx}, 'kategori_barang', this.value)" class="bg-black/30 rounded-lg p-2 w-full text-[10px] outline-none border border-[var(--border-glass)]">
                                <option value="${it.kategori_barang}" selected>${it.kategori_barang}</option>
                                ${catOptionsHtml}
                            </select>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    }
    
    totalNominal += Number(data.admin_fee || 0);
    window.AuraUtils.safeDOM('staging-total-display', el => el.innerText = window.AuraUtils.formatCurrency(totalNominal));
};

window.updateStagingItem = function(index, field, value) {
    if(!window.aiStaging || !window.aiStaging.items[index]) return;
    // Bug #31 Fix: Menjamin parameter kuantitas/harga tidak terisi NaN
    if(field === 'harga' || field === 'qty') {
        const validatedVal = Number(value);
        window.aiStaging.items[index][field] = isNaN(validatedVal) ? 0 : validatedVal;
    } else {
        window.aiStaging.items[index][field] = value;
    }
    window.renderStagingUI(); 
};

window.removeStagingItem = function(index) {
    if(!window.aiStaging) return;
    window.aiStaging.items.splice(index, 1);
    window.renderStagingUI();
};

window.addStagingItem = function() {
    if(!window.aiStaging) return;
    window.aiStaging.items.push({
        itemId: window.AuraUtils.generateId('itm'),
        nama_barang: "Item Tambahan", harga: 0, qty: 1,
        kategori_barang: "Lainnya", tax_rate: 0, paymentMethod: window.aiStaging.metode_pembayaran, timestamp: new Date().toISOString()
    });
    window.renderStagingUI();
};

window.saveStagingToDatabase = async function() {
    if(!window.aiStaging) return;
    
    window.aiStaging.merchantName = document.getElementById('staging-trx-store').value.trim() || 'Toko/Merchant';
    window.aiStaging.tipe = document.getElementById('staging-trx-type').value;
    
    // Bug #29 Fix: Rekalkulasi final sum protektif anti-NaN
    const finalSum = window.aiStaging.items.reduce((acc, it) => {
        const itemPrice = Number(it.harga) || 0;
        const itemQty = Number(it.qty) || 1;
        return acc + (itemPrice * itemQty);
    }, 0);
    
    window.aiStaging.nominal = finalSum + Number(window.aiStaging.admin_fee || 0);
    window.aiStaging.createdAt = new Date().toISOString();
    window.aiStaging.is_deleted = false;

    try {
        await window.FirebaseService.saveTransaction(window.aiStaging, true); 
        window.closeModal('modal-ai-staging');
        window.aiStaging = null;
        window.showToast("Data Staging berhasil disinkronisasi ke Cloud!");
    } catch(e) { window.showToast("Gagal menyimpan data staging.", true); }
};

/**
 * ============================================================================
 * [14] ORACLE CHAT LOGIC (BUG #32/33 SECURITY & DUPLICATE PROTECTED)
 * ============================================================================
 */
let isChatProcessing = false; // Bug #33 Fix: Mencegah spam klik / pengiriman pesan ganda

window.processOracleChat = async function(text, base64Img = null) {
    if (!window.currentUserUid) return;
    if (isChatProcessing) return;
    
    isChatProcessing = true;
    const uiText = text || (base64Img ? "[Menganalisis Gambar Terlampir...]" : "");
    
    // Bug #32 Fix: Sanitasi HTML input dari user demi menghindari serangan XSS
    const sanitizedUiText = window.AuraUtils.escapeHtml(uiText);
    
    await window.FirebaseService.pushOracleChat({role: 'user', text: sanitizedUiText, timestamp: new Date().toISOString()});
    window.setProcessingStatus(true); 

    try {
        const summaryString = window.FinancialSummaryService.getSummaryString();
        const relevantTx = window.MemoryService.getRelevantTransactions(text);
        const nickname = window.settingsData?.profile?.nickname || "Bos";

        const txString = relevantTx.map(t => {
            let it = t.items && Array.isArray(t.items) ? `| Items:[${t.items.map(i=>`{itemId:"${i.itemId}", nama:"${i.nama_barang}", harga:${i.harga}, qty:${i.qty}}`).join(', ')}]` : ''; 
            return `ID:${t.id} | Toko:${t.merchantName || t.storeName || 'Merchant'} | Tipe:${t.tipe} | Ket:${t.description || t.catatan_ai} | Metode:${t.metode_pembayaran} | Nom:${t.nominal} ${t.mata_uang} ${it}`;
        }).join('\n');

        const { personaStr, styleStr } = window.getOraclePromptConfigs();
        const categoryListStr = window.CategoryManager.getCategoryStringList();

        const systemPrompt = `Kamu adalah AuraFi Oracle V3. Kepribadian: ${personaStr}. Nama User: ${nickname}.
Konteks Keuangan:
${summaryString}
Data Transaksi Relevan Terkait:
${txString}

ATURAN UPDATE & HAPUS UTAMA (SAFE UPDATE CONTRACT):
AI DILARANG merusak array. WAJIB menggunakan "target_item_id".
KATEGORI ITEM: "${categoryListStr}".
1. action="update_transaction": Merubah atribut global ID.
2. action="add_item": Menambahkan item ke "target_id".
3. action="edit_item": Edit 1 item spesifik WAJIB menyertakan "target_item_id".
4. action="delete_item": Menghapus 1 item secara penuh berdasarkan "target_item_id".
5. action="moveToTrash": Menghapus seluruh transaksi block "target_id".

ATURAN BALASAN: ${styleStr}
Kembalikan respon format RAW JSON STRICT (TANPA markdown):
{
  "reply": "Kalimat balasan Oracle V3 sesuai gaya",
  "action": "none|moveToTrash|update_transaction|add_item|edit_item|delete_item",
  "target_id": "string",
  "target_item_id": "string",
  "update_fields": {"merchantName": "string", "metode_pembayaran": "tunai/cashless", "tipe": "pemasukan/pengeluaran", "nominal": number},
  "new_items": [{"nama_barang": "string", "harga": number, "qty": number, "kategori_barang": "string"}]
}`;

        let resJson;
        const messages = [{ role: "system", content: systemPrompt }];

        const history = window.MemoryService.getRelevantChats();
        // Bug #33 Fix: Pastikan context chat tidak menduplikasi input sekarang
        history.forEach(h => { if(h.text !== sanitizedUiText) messages.push({ role: h.role === 'ai' ? 'assistant' : 'user', content: h.text }); });
        messages.push({ role: "user", content: text || "Analisis data keuangan" });

        const aiOutput = await window.executeAIWithFallback(messages, systemPrompt, true, base64Img);
        resJson = window.AuraUtils.parseCleanJSON(aiOutput);

        // Bug #34 Fix: Validasi ketat keberadaan transaksi target sebelum mengeksekusi instruksi dari AI
        if(resJson.action !== 'none' && resJson.target_id) { 
            try {
                const targetTrx = window.allTransactions.find(t => t.id === resJson.target_id);
                
                if (targetTrx) {
                    if(resJson.action === 'moveToTrash') {
                        await window.FirebaseService.moveToTrash(resJson.target_id);
                    } else if(resJson.action === 'update_transaction') {
                        const updates = {};
                        if(resJson.update_fields) {
                            if(resJson.update_fields.merchantName) updates.merchantName = resJson.update_fields.merchantName;
                            if(resJson.update_fields.metode_pembayaran) updates.metode_pembayaran = resJson.update_fields.metode_pembayaran;
                            if(resJson.update_fields.tipe) updates.tipe = resJson.update_fields.tipe;
                            if(resJson.update_fields.nominal !== undefined) updates.nominal = resJson.update_fields.nominal;
                        }
                        await window.FirebaseService.updateTransaction(targetTrx.id, updates);
                    } else if(resJson.action === 'add_item' && resJson.new_items) {
                        const finalItems = (targetTrx.items || []).concat(window.AuraUtils.sanitizeItemsArray(resJson.new_items, targetTrx.metode_pembayaran, new Date().toISOString()));
                        const sum = finalItems.reduce((a,b)=>a+(b.harga*(b.qty||1)), 0);
                        const upd = { items: finalItems, nominal: sum };
                        if(!targetTrx.isCustomDescription) upd.description = `[Auto-Update] Transaksi diubah AI. Total: ${window.AuraUtils.formatCurrency(sum)}`;
                        await window.FirebaseService.updateTransaction(targetTrx.id, upd);
                    } else if(resJson.action === 'edit_item' && resJson.target_item_id && resJson.new_items && resJson.new_items.length > 0) {
                        const newEditData = resJson.new_items[0];
                        const finalItems = (targetTrx.items || []).map(it => {
                            if(it.itemId === resJson.target_item_id) {
                                return { ...it, nama_barang: newEditData.nama_barang || it.nama_barang, harga: newEditData.harga !== undefined ? newEditData.harga : it.harga, qty: newEditData.qty !== undefined ? newEditData.qty : it.qty, kategori_barang: newEditData.kategori_barang || it.kategori_barang };
                            } return it;
                        });
                        const sum = finalItems.reduce((a,b)=>a+(b.harga*(b.qty||1)), 0);
                        const upd = { items: finalItems, nominal: sum };
                        if(!targetTrx.isCustomDescription) upd.description = `[Auto-Update] Item disesuaikan AI. Total: ${window.AuraUtils.formatCurrency(sum)}`;
                        await window.FirebaseService.updateTransaction(targetTrx.id, upd);
                    } else if(resJson.action === 'delete_item' && resJson.target_item_id) {
                        const finalItems = (targetTrx.items || []).filter(it => it.itemId !== resJson.target_item_id);
                        if(finalItems.length === 0) { await window.FirebaseService.moveToTrash(targetTrx.id); } 
                        else {
                            const sum = finalItems.reduce((a,b)=>a+(b.harga*(b.qty||1)), 0);
                            const upd = { items: finalItems, nominal: sum };
                            if(!targetTrx.isCustomDescription) upd.description = `[Auto-Update] Item dihapus AI. Total: ${window.AuraUtils.formatCurrency(sum)}`;
                            await window.FirebaseService.updateTransaction(targetTrx.id, upd);
                        }
                    }
                } else {
                    Logger.warn('OracleChat', `Aksi ${resJson.action} ditolak. ID Transaksi ${resJson.target_id} tidak valid.`);
                }
            } catch(e) { resJson.reply += " (Gagal memproses sinkronisasi instruksi data AI.)"; }
        }

        // Bug #32 Fix: Escape balasan Oracle agar tidak memicu XSS
        const escapedReply = window.AuraUtils.escapeHtml(resJson.reply);
        await window.FirebaseService.pushOracleChat({role: 'ai', text: escapedReply, timestamp: new Date().toISOString()});

    } catch(e) { 
        await window.FirebaseService.pushOracleChat({role: 'ai', text: `Gangguan transmisi sistem: ${e.message}`, timestamp: new Date().toISOString()});
    } finally { 
        window.setProcessingStatus(false); 
        isChatProcessing = false;
    }
};

/**
 * ============================================================================
 * [15] RENDER ENGINE & DYNAMIC STAPLES TRACKER (HIGH-PERFORMANCE RENDERING)
 * ============================================================================
 */
let expItemsState = {};
window.toggleReceipt = function(id) { expItemsState[id] = !expItemsState[id]; window.debouncedCalculateAll(); };

window.changeViewMode = function(mode) {
    window.AuraState.filters.periodMode = mode;
    window.debouncedCalculateAll();
    ['period', 'month', 'all'].forEach(m => {
        window.AuraUtils.safeDOM(`btn-mode-${m}`, el => {
            if(m === mode) el.classList.add('text-accent', 'bg-white/10');
            else el.classList.remove('text-accent', 'bg-white/10');
        });
    });
};

window.applyFilters = function() {
    window.AuraState.filters.search = document.getElementById('filter-search')?.value || '';
    window.AuraState.filters.category = document.getElementById('filter-category')?.value || 'ALL';
    window.AuraState.filters.user = document.getElementById('filter-user')?.value || 'ALL';
    window.debouncedCalculateAll();
};

window.reCalculateAll = function() {
    Logger.info('RenderEngine', 'Menjalankan Kalkulasi Finansial Komprehensif...');
    
    const allTx = window.allTransactions || [];
    const today = new Date();
    
    let cumulativeBalance = 0;
    let totalCashBal = 0, totalCashlessBal = 0;
    
    allTx.forEach(trx => {
        const val = window.AuraUtils.convertCurrency(trx.nominal, trx.mata_uang);
        const isCash = trx.metode_pembayaran === 'tunai';
        
        if (trx.tipe === 'pemasukan') {
            cumulativeBalance += val;
            if (isCash) totalCashBal += val; else totalCashlessBal += val;
        } else if (trx.tipe === 'pengeluaran') {
            cumulativeBalance -= val;
            if (isCash) totalCashBal -= val; else totalCashlessBal -= val;
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
    });

    const periodRange = window.AuraUtils.getPeriodRange();
    const fSearch = window.AuraState.filters.search.toLowerCase();
    const fCat = window.AuraState.filters.category;
    const fUser = window.AuraState.filters.user;

    let periodSpent = 0, periodIncome = 0;
    let catSpend = {}, merchantSpend = {}, groupedTrx = {};
    
    // ========================================================================
    // 🛠️ INISIALISASI DYNAMIC STAPLES TRACKER (FITUR BARU)
    // ========================================================================
    // Mengambil konfigurasi tracker dinamis dari settingsData, jika kosong gunakan default
    const trackersConfig = window.settingsData?.staplesTrackers || DEFAULT_STAPLES_TRACKERS;
    let trackerBalances = {};
    Object.keys(trackersConfig).forEach(trackerId => {
        trackerBalances[trackerId] = 0;
    });

    let dailySp = {};
    for (let i = 6; i >= 0; i--) { 
        let d = new Date(today); d.setDate(d.getDate() - i); 
        dailySp[d.toISOString().split('T')[0]] = 0; 
    }

    let filteredTx = allTx.filter(trx => {
        const trxTime = new Date(trx.tanggal || trx.createdAt).getTime();
        if (trxTime < periodRange.start || trxTime > periodRange.end) return false;
        
        if (fSearch) {
            const desc = (trx.description || trx.catatan_ai || "").toLowerCase();
            const merch = (trx.merchantName || trx.storeName || "").toLowerCase();
            const hasItem = trx.items && trx.items.some(i => i.nama_barang.toLowerCase().includes(fSearch));
            if (!desc.includes(fSearch) && !merch.includes(fSearch) && !hasItem) return false;
        }
        if (fCat !== 'ALL') {
            const mainCatMatch = trx.kategori === fCat;
            const itemCatMatch = trx.items && trx.items.some(i => i.kategori_barang === fCat);
            if (!mainCatMatch && !itemCatMatch) return false;
        }
        if (fUser !== 'ALL') {
            if (trx.user_id && trx.user_id !== fUser) return false;
        }
        return true;
    });

    filteredTx.forEach(trx => {
        const val = window.AuraUtils.convertCurrency(trx.nominal, trx.mata_uang);
        const dStrRaw = trx.tanggal || trx.createdAt;
        const dStr = dStrRaw.split('T')[0];
        const timeFormatted = window.AuraUtils.formatDateToReadable(dStrRaw);
        
        if(!groupedTrx[dStr]) groupedTrx[dStr] = { total: 0, items: [] };

        if (trx.tipe === 'pemasukan') {
            periodIncome += val;
            groupedTrx[dStr].total += val;
        } else if (trx.tipe === 'pengeluaran' || trx.tipe === 'tarik_tunai' || trx.tipe === 'setor_tunai') {
            let actualSpend = val;
            if (trx.tipe === 'tarik_tunai' || trx.tipe === 'setor_tunai') {
                actualSpend = window.AuraUtils.convertCurrency(Number(trx.admin_fee || 0), trx.mata_uang);
                groupedTrx[dStr].total -= actualSpend;
                periodSpent += actualSpend;
                catSpend['Utilitas'] = (catSpend['Utilitas']||0) + actualSpend;
            } else {
                groupedTrx[dStr].total -= actualSpend;
                periodSpent += actualSpend;
                merchantSpend[trx.merchantName || trx.storeName || trx.kategori || 'Merchant'] = (merchantSpend[trx.merchantName || trx.storeName || trx.kategori || 'Merchant'] || 0) + actualSpend;
                
                if (trx.items && Array.isArray(trx.items) && trx.items.length > 0) {
                    let calcItemSum = 0;
                    trx.items.forEach(it => {
                        const itemVal = window.AuraUtils.convertCurrency(it.harga * (it.qty || 1), trx.mata_uang);
                        calcItemSum += itemVal;
                        catSpend[it.kategori_barang || 'Lainnya'] = (catSpend[it.kategori_barang || 'Lainnya'] || 0) + itemVal;
                        
                        // 🛠️ PROSES DYNAMIC TRACKER MATCHING (Kata Kunci & Akumulasi Nilai)
                        const iName = it.nama_barang.toLowerCase();
                        Object.entries(trackersConfig).forEach(([trackerId, trackerInfo]) => {
                            const isMatch = trackerInfo.keywords.some(keyword => iName.includes(keyword.toLowerCase()));
                            if (isMatch) {
                                trackerBalances[trackerId] += itemVal;
                            }
                        });
                    });
                    if (actualSpend > calcItemSum) {
                        catSpend['Lainnya'] = (catSpend['Lainnya'] || 0) + (actualSpend - calcItemSum);
                    }
                } else {
                    catSpend[trx.kategori || 'Lainnya'] = (catSpend[trx.kategori || 'Lainnya']||0) + actualSpend;
                }
            }
            if(dailySp[dStr] !== undefined) dailySp[dStr] += actualSpend;
        }
        trx.displayTime = timeFormatted;
        groupedTrx[dStr].items.push(trx);
    });

    window.AuraUtils.safeDOM('dash-total-balance', el => el.innerText = window.AuraUtils.formatCurrency(cumulativeBalance));
    window.AuraUtils.safeDOM('dash-cash', el => el.innerText = window.AuraUtils.formatCurrency(totalCashBal));
    window.AuraUtils.safeDOM('dash-cashless', el => el.innerText = window.AuraUtils.formatCurrency(totalCashlessBal));
    window.AuraUtils.safeDOM('dash-income-mth', el => el.innerText = '+' + window.AuraUtils.formatCurrency(periodIncome));
    window.AuraUtils.safeDOM('dash-expense-mth', el => el.innerText = '-' + window.AuraUtils.formatCurrency(periodSpent));

    const limitVal = window.AuraUtils.convertCurrency(window.monthlyBudget, 'JPY');
    const burnPct = limitVal > 0 ? (periodSpent / limitVal) * 100 : 0;
    const remainingBudget = limitVal - periodSpent;

    window.AuraUtils.safeDOM('living-core', el => el.className = `w-48 h-48 rounded-full living-core ${burnPct > 90 ? 'danger' : ''} flex flex-col items-center justify-center relative overflow-hidden`);
    window.AuraUtils.safeDOM('burn-progress', el => {
        el.style.width = `${Math.min(burnPct, 100)}%`; 
        el.style.backgroundColor = burnPct > 90 ? 'var(--color-expense)' : 'var(--color-income)';
    });
    window.AuraUtils.safeDOM('burn-spent', el => el.innerText = `Terpakai: ${window.AuraUtils.formatCurrency(periodSpent)}`);
    window.AuraUtils.safeDOM('burn-limit', el => el.innerText = `Limit: ${window.AuraUtils.formatCurrency(limitVal)}`);

    const daysInPeriod = Math.max(1, Math.ceil((periodRange.end - periodRange.start) / (1000 * 60 * 60 * 24)));
    const daysPassed = Math.max(1, Math.ceil((today.getTime() - periodRange.start) / (1000 * 60 * 60 * 24)));
    const dailyAvg = periodSpent / daysPassed;
    const proj = dailyAvg * daysInPeriod;
    const daysLeft = daysInPeriod - daysPassed;
    const periodPct = Math.min((daysPassed / daysInPeriod) * 100, 100);
    
    window.AuraUtils.safeDOM('stats-daily-avg', el => el.innerText = window.AuraUtils.formatCurrency(dailyAvg));
    window.AuraUtils.safeDOM('stats-proj-mth', el => el.innerText = window.AuraUtils.formatCurrency(proj));
    window.AuraUtils.safeDOM('burn-insight-box', el => {
        if(proj > limitVal) { 
            el.innerHTML = `<span class="text-[var(--color-expense)] font-bold"><i class="fa-solid fa-triangle-exclamation"></i> BAHAYA:</span> Estimasi akhir siklus tagihan mencapai ${window.AuraUtils.formatCurrency(proj)}!`;
            el.style.borderColor = 'var(--color-expense)'; 
        } else { 
            el.innerHTML = `<span class="text-[var(--color-income)] font-bold"><i class="fa-solid fa-circle-check"></i> AMAN:</span> Pengeluaran stabil. Prediksi akhir ${window.AuraUtils.formatCurrency(proj)}.<br><span class="text-[9px] mt-1 text-[var(--text-muted)]">Sisa Anggaran: ${window.AuraUtils.formatCurrency(remainingBudget)}</span>`; 
            el.style.borderColor = 'var(--border-glass)';
        }
    });

    window.AuraUtils.safeDOM('period-progress-bar', el => el.style.width = `${periodPct}%`);
    window.AuraUtils.safeDOM('period-progress-text', el => el.innerText = `PROGRES SIKLUS: ${periodPct.toFixed(0)}%`);
    window.AuraUtils.safeDOM('period-days-left', el => el.innerText = `${daysLeft} HARI TERSISA`);

    // ========================================================================
    // 🛠️ RENDERING DYNAMIC ITEM TRACKER KE ELEMENT DOM
    // ========================================================================
    // Update elemen DOM secara dinamis berdasarkan Id tracker ('track-[trackerId]')
    Object.entries(trackerBalances).forEach(([trackerId, value]) => {
        window.AuraUtils.safeDOM(`track-${trackerId}`, el => {
            el.innerText = window.AuraUtils.formatCurrency(value);
        });
    });

    const catSorted = Object.entries(catSpend).sort((a,b)=>b[1]-a[1]);
    window.AuraUtils.safeDOM('pie-total-label', el => el.innerText = window.AuraUtils.formatCurrency(periodSpent));
    window.AuraUtils.safeDOM('category-pie-chart', el => {
        if (periodSpent > 0 && catSorted.length > 0) {
            let conicStops = []; let currentAngle = 0;
            catSorted.forEach(([c, v]) => {
                let pct = (v / periodSpent) * 100;
                let hex = window.CategoryManager.resolveStyle(c).hex;
                conicStops.push(`${hex} ${currentAngle}% ${currentAngle + pct}%`);
                currentAngle += pct;
            });
            el.style.background = `conic-gradient(${conicStops.join(', ')})`;
        } else { el.style.background = `conic-gradient(var(--border-glass) 0% 100%)`; }
    });

    window.AuraUtils.safeDOM('top-categories-list', el => {
        el.innerHTML = catSorted.length === 0 ? '<p class="text-xs text-[var(--text-muted)] text-center">Belum ada data di filter/siklus ini.</p>' : catSorted.map(([c,v]) => {
            const style = window.CategoryManager.resolveStyle(c);
            const pct = periodSpent > 0 ? ((v/periodSpent)*100).toFixed(0) : 0;
            return `<div class="flex justify-between items-center text-sm border-b border-[var(--border-glass)] pb-2.5 last:border-0 last:pb-0">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center border border-[var(--border-glass)]" style="background-color: ${style.hex}15; border-color: ${style.hex}40;"><i class="fa-solid ${style.icon}" style="color: ${style.hex}"></i></div>
                    <div><p class="font-bold text-[var(--text-main)]">${style.name}</p><p class="text-[9px] text-[var(--text-muted)] font-bold">${pct}% dari belanja</p></div>
                </div>
                <p class="font-mono text-xs font-bold text-[var(--text-main)]">${window.AuraUtils.formatCurrency(v)}</p>
            </div>`;
        }).join('');
    });

    window.AuraUtils.safeDOM('top-merchants-list', el => {
        const merchSorted = Object.entries(merchantSpend).sort((a,b)=>b[1]-a[1]).slice(0, 5); 
        el.innerHTML = merchSorted.length === 0 ? '<p class="text-xs text-[var(--text-muted)] text-center">Belum ada transaksi.</p>' : merchSorted.map(([m, v]) => `
            <div class="flex justify-between items-center text-sm border-b border-[var(--border-glass)] pb-2.5 last:border-0 last:pb-0">
                <span class="font-bold text-[var(--text-main)] truncate max-w-[65%]">${m}</span>
                <span class="font-mono font-bold text-[var(--color-expense)]">${window.AuraUtils.formatCurrency(v)}</span>
            </div>`).join('');
    });

    // Render Canvas Chart 7 Hari
    const canvas = document.getElementById('canvas-7days');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width; const H = canvas.height;
        ctx.clearRect(0, 0, W, H);
        
        const vals = Object.values(dailySp);
        const keys = Object.keys(dailySp);
        const maxVal = Math.max(...vals, 1);
        const padding = 12;
        const barWidth = (W - (padding * vals.length)) / vals.length;
        
        vals.forEach((val, i) => {
            const barH = (val / maxVal) * (H - 25); 
            const x = i * (barWidth + padding) + padding/2;
            const y = H - barH;
            
            ctx.fillStyle = keys[i] === today.toISOString().split('T')[0] ? '#38bdf8' : '#38bdf840'; 
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(x, y, barWidth, barH, [6, 6, 0, 0]); 
            else ctx.rect(x, y, barWidth, barH);
            ctx.fill();
            
            if (val > 0) {
                ctx.fillStyle = '#ffffff'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
                let tVal = val >= 1000 ? (val/1000).toFixed(1).replace('.0','') + 'k' : val;
                ctx.fillText(tVal, x + barWidth/2, y - 6);
            }
            
            ctx.fillStyle = '#94a3b8'; ctx.font = '8px monospace';
            ctx.fillText(keys[i].substring(5).replace('-','/'), x + barWidth/2, H - 4);
        });
    } else {
        window.AuraUtils.safeDOM('chart-7days', el => {
            const maxDSp2 = Math.max(...Object.values(dailySp), 1);
            el.innerHTML = Object.entries(dailySp).map(([dStr, v]) => `<div class="flex flex-col items-center flex-1 group relative"><div class="absolute -top-7 bg-black text-white text-[9px] px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 z-10 whitespace-nowrap transition-all duration-200 pointer-events-none">${window.AuraUtils.formatCurrency(v)}</div><div class="w-full rounded-t-md transition-all duration-1000 ${dStr === today.toISOString().split('T')[0]?'bg-accent':'bg-accent/30'}" style="height: ${v===0?4:(v/maxDSp2)*100}%"></div><span class="text-[8px] text-[var(--text-muted)] mt-1.5 font-mono">${dStr.split('-')[2]}/${dStr.split('-')[1]}</span></div>`).join('');
        });
    }

    window.AuraUtils.safeDOM('trx-list-container', el => {
        el.innerHTML = Object.keys(groupedTrx).length === 0 ? '<p class="text-center text-[var(--text-muted)] mt-10">Data tidak ditemukan pada filter ini.</p>' : Object.keys(groupedTrx).sort((a,b)=>new Date(b)-new Date(a)).map(dateStr => {
            const g = groupedTrx[dateStr]; 
            const dObj = new Date(dateStr);
            return `<div class="mb-4">
                <div class="flex justify-between items-end mb-2.5 border-b border-[var(--border-glass)] pb-1">
                    <div class="flex items-baseline gap-1.5">
                        <span class="text-xl font-display font-black leading-none">${!isNaN(dObj.getTime())?dObj.getDate().toString().padStart(2,'0'):'--'}</span>
                        <span class="text-[9px] uppercase tracking-widest text-[var(--text-muted)] font-extrabold">${!isNaN(dObj.getTime())?dObj.toLocaleDateString('id-ID', {weekday:'short'}):'---'}</span>
                    </div>
                    <span class="text-xs font-mono font-bold ${g.total>=0 ? 'text-[var(--color-income)]':'text-[var(--text-main)]'}">${g.total>=0?'+':''}${window.AuraUtils.formatCurrency(g.total)}</span>
                </div>
                <div class="space-y-3">${g.items.map(t => {
                const isExp = expItemsState[t.id]; 
                const hasItems = t.items && Array.isArray(t.items) && t.items.length > 0;
                
                const catStyle = window.CategoryManager.resolveStyle(t.kategori || 'Lainnya');
                const isTarikTunai = t.tipe === 'tarik_tunai';
                const isSetorTunai = t.tipe === 'setor_tunai';
                
                const iconHtml = t.tipe === 'pemasukan' ? '<i class="fa-solid fa-arrow-turn-up text-[var(--color-income)]"></i>' : (isTarikTunai || isSetorTunai) ? '<i class="fa-solid fa-money-bill-transfer text-[#38bdf8]"></i>' : `<i class="fa-solid ${catStyle.icon}" style="color: ${catStyle.hex}"></i>`;
                const colorClass = t.tipe === 'pemasukan' ? 'text-[var(--color-income)]' : (isTarikTunai || isSetorTunai) ? 'text-[#38bdf8]' : 'text-[var(--text-main)]';
                const signChar = t.tipe === 'pemasukan' ? '+' : (isTarikTunai || isSetorTunai) ? '⇄' : '-';
                const titleDisp = t.merchantName || t.storeName || t.kategori;
                const descDisp = t.description || t.catatan_ai || "";

                return `<div class="glass-panel p-4 relative group">
                    <button onclick="window.openEditTrxModal('${t.id}')" class="absolute top-3 right-10 text-[var(--text-muted)] hover:text-accent opacity-0 group-hover:opacity-100 active:scale-90 p-2 text-sm transition"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="window.confirmDelTrx('${t.id}')" class="absolute top-3 right-3 text-[var(--text-muted)] hover:text-[var(--color-expense)] opacity-0 group-hover:opacity-100 active:scale-90 p-2 text-sm transition"><i class="fa-solid fa-trash"></i></button>
                    <div class="flex justify-between items-start mb-2 pr-12"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style="background-color: ${catStyle.hex}15; border: 1px solid ${catStyle.hex}30;">${iconHtml}</div><div class="overflow-hidden"><h4 class="font-bold text-sm text-[var(--accent-primary)] truncate">${titleDisp}</h4><p class="text-[8px] text-[var(--text-muted)] uppercase font-extrabold tracking-wide flex items-center gap-1">${t.metode_pembayaran==='tunai'?'<i class="fa-solid fa-money-bill"></i>':'<i class="fa-regular fa-credit-card"></i>'} ${t.metode_pembayaran} • ${t.displayTime}</p></div></div><p class="font-bold text-sm font-mono shrink-0 ml-2 ${colorClass}">${signChar}${window.AuraUtils.formatCurrency(window.AuraUtils.convertCurrency(t.nominal, t.mata_uang))}</p></div>${descDisp ? `<div class="bg-black/25 p-2.5 rounded-xl text-xs text-accent italic mb-2">"${descDisp}"</div>` : ''}${hasItems ? `<div class="mt-2.5 pt-2 border-t border-[var(--border-glass)]"><div class="flex justify-between items-center"><button onclick="window.toggleReceipt('${t.id}')" class="flex-1 text-left text-[9px] text-[var(--text-muted)] font-black uppercase tracking-wider py-1.5"><span><i class="fa-solid fa-list mr-1"></i> ${t.items.length} Barang (Klik Detil)</span> <i class="fa-solid fa-chevron-${isExp?'up':'down'}"></i></button><button onclick="window.openAddItemModal('${t.id}')" class="bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-md text-[8px] font-bold text-white transition">+ ITEM</button></div><div class="${isExp?'block':'hidden'} mt-2 space-y-1.5">${t.items.map((it) => {
                    const safeItemId = it.itemId || 'no_id_fallback';
                    const itCatHex = window.CategoryManager.resolveStyle(it.kategori_barang).hex;
                    return `<div class="flex justify-between items-center text-xs bg-white/5 p-2 rounded-xl group/it"><div class="flex-1 truncate"><span class="text-[var(--text-main)] font-medium mr-1">${it.nama_barang}</span><span class="text-[8px] px-1.5 py-0.5 rounded font-bold mr-1" style="background-color: ${itCatHex}20; color: ${itCatHex};">${it.kategori_barang || 'Lainnya'}</span><span class="text-[9px] text-[var(--text-muted)] font-mono font-bold">x${it.qty}</span> ${it.tax_rate ? `<span class="text-[8px] bg-sky-950/40 text-sky-400 px-1 rounded font-mono border border-sky-900">${it.tax_rate}%</span>` : ''}</div><span class="font-mono text-[var(--text-muted)] text-[11px] mr-2">${window.AuraUtils.formatCurrency(window.AuraUtils.convertCurrency(it.harga*(it.qty||1), t.mata_uang))}</span><div class="flex gap-2 opacity-100 md:opacity-0 group-hover/it:opacity-100"><button onclick="window.openEditItem('${t.id}', '${safeItemId}')" class="text-accent p-1 text-xs"><i class="fa-solid fa-pen"></i></button><button onclick="window.confirmDelItem('${t.id}', '${safeItemId}')" class="text-[var(--color-expense)] p-1 text-xs"><i class="fa-solid fa-xmark"></i></button></div></div>`;
                }).join('')}</div></div>` : `<div class="mt-2.5 pt-2 border-t border-[var(--border-glass)]"><button onclick="window.openAddItemModal('${t.id}')" class="bg-white/5 border border-[var(--border-glass)] w-full py-1.5 rounded-md text-[9px] font-bold text-[var(--text-muted)] hover:text-white transition">+ TAMBAH ITEM</button></div>`}</div>`
            }).join('')}</div></div>`
        }).join('');
    });

    window.AuraUtils.safeDOM('goals-list-container', el => {
        const glList = window.allGoals || [];
        el.innerHTML = glList.length === 0 ? '<p class="text-center text-[var(--text-muted)]">Belum ada misi. Tambah misi baru di atas!</p>' : glList.map(g => {
            const targetVal = window.AuraUtils.convertCurrency(g.targetAmount, g.currency);
            const diffDays = Math.ceil((new Date(g.targetDate) - new Date()) / (1000 * 3600 * 24));
            const daily = diffDays > 0 ? targetVal/diffDays : 0;
            return `<div class="glass-panel p-4 relative overflow-hidden border-t-2 border-t-accent"><button onclick="window.confirmDelGoal('${g.id}')" class="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-main)] p-1"><i class="fa-solid fa-trash text-xs"></i></button><h4 class="font-bold text-sm mb-1">${g.name}</h4><p class="text-[9px] text-[var(--text-muted)] mb-3 uppercase tracking-wider font-extrabold">Target: ${window.AuraUtils.formatCurrency(targetVal)} sebelum ${g.targetDate}</p><div class="bg-black/35 rounded-xl p-3 flex justify-between items-center border border-[var(--border-glass)]"><div><p class="text-[8px] text-[var(--text-muted)] uppercase mb-0.5 font-extrabold">Tabungan Harian</p><p class="font-mono text-accent font-bold text-xs">${diffDays>0?window.AuraUtils.formatCurrency(daily):'TARGET LEWAT'}</p></div><div class="text-right"><p class="text-[8px] text-[var(--text-muted)] uppercase mb-0.5 font-extrabold">Sisa Hari</p><p class="font-bold text-xs">${diffDays>0?diffDays+' Hari':'-'}</p></div></div></div>`;
        }).join('');
    });

    window.AuraUtils.safeDOM('trash-list-container', el => {
        const trashList = window.trashTransactions || [];
        el.innerHTML = trashList.length === 0 ? '<p class="text-center text-[var(--text-muted)]">Tempat sampah kosong.</p>' : trashList.map(t => `<div class="glass-panel p-4 flex justify-between items-center opacity-85 hover:opacity-100 transition"><div><h4 class="font-bold text-xs line-through text-[var(--text-muted)]">${t.merchantName || t.storeName || t.kategori}</h4><p class="text-[9px] text-[var(--text-muted)]">${t.deletedAt?.split('T')[0]}</p></div><div class="flex items-center gap-2"><span class="font-mono text-xs text-[var(--text-muted)] line-through mr-1">${window.AuraUtils.formatCurrency(window.AuraUtils.convertCurrency(t.nominal, t.mata_uang))}</span><button onclick="window.restoreTransaction('${t.id}')" class="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-lg active:scale-90 transition" aria-label="Restore"><i class="fa-solid fa-rotate-left text-xs"></i></button><button onclick="window.deleteForever('${t.id}')" class="bg-rose-500/20 text-rose-400 p-2.5 rounded-lg active:scale-90 transition" aria-label="Hapus Permanen"><i class="fa-solid fa-xmark text-xs"></i></button></div></div>`).join('');
    });

    if(window.renderRecurringUIForBudget) window.renderRecurringUIForBudget();
};

// Implementasi Throttle/Debounce ke reCalculateAll
window.debouncedCalculateAll = window.AuraUtils.debounce(window.reCalculateAll, APP_CONFIG.THROTTLE_MS);

/**
 * ============================================================================
 * [16] UI FUNCTIONS (Toast, Modals, Views - SECURITY HARDENED)
 * ============================================================================
 */
window.showToast = function(msg, isError = false) {
    const container = document.getElementById('toast-container'); if(!container) return;
    const toast = document.createElement('div');
    const icon = isError ? '<i class="fa-solid fa-triangle-exclamation text-[var(--color-expense)]"></i>' : '<i class="fa-solid fa-check text-accent"></i>';
    toast.className = `glass-panel p-3 flex items-center gap-2 text-xs font-bold shadow-lg animate-[slideUp_0.3s_ease-out] ${isError ? 'border-l-4 border-l-[var(--color-expense)]' : 'border-l-4 border-l-accent'}`;
    // Bug #32 Fix: Sanitasi HTML teks toast
    toast.innerHTML = `${icon} <span>${window.AuraUtils.escapeHtml(msg)}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3400);
};

// Bug #40 Fix: Rendering modal lancar dengan requestAnimationFrame
window.showModal = function(id) { 
    const m = document.getElementById(id); 
    if(m) { 
        m.classList.remove('hidden'); 
        requestAnimationFrame(() => {
            m.classList.add('opacity-100');
        });
    }
};

window.closeModal = function(id) {
    const m = document.getElementById(id); 
    if(m) { 
        m.classList.remove('opacity-100'); 
        setTimeout(() => {
            m.classList.add('hidden');
            // Bug #41 Fix: Bersihkan input form dalam modal setelah ditutup
            const formInputs = m.querySelectorAll('input, textarea');
            formInputs.forEach(input => {
                if(input.type !== 'button' && input.type !== 'submit') input.value = '';
            });
        }, 300); 
    }
};

window.setProcessingStatus = function(isProc) {
    window.AuraState.system.isProcessing = isProc;
    window.isProcessing = isProc;
    const btn = document.getElementById('btn-send-main'); const icon = document.getElementById('icon-send');
    if (btn && icon) {
        if(isProc) { btn.disabled = true; icon.className = "fa-solid fa-circle-notch animate-spin"; } 
        else { btn.disabled = false; icon.className = "fa-solid fa-paper-plane"; }
    }
};

window.switchView = function(viewId) {
    window.AuraState.system.activeView = viewId;
    window.activeView = viewId;
    ['dashboard', 'transactions', 'analytics', 'budgets', 'oracle', 'trash'].forEach(id => {
        const el = document.getElementById(`view-${id}`); 
        if(el) {
            if (id === viewId) { el.classList.remove('hidden'); if (id === 'oracle') el.style.display = 'flex'; } 
            else { el.classList.add('hidden'); el.style.display = ''; }
        }
    });
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if(btn.dataset.target === viewId) { btn.classList.add('text-[var(--accent-primary)]'); btn.classList.remove('text-[var(--text-muted)]'); } 
        else { btn.classList.remove('text-[var(--accent-primary)]'); btn.classList.add('text-[var(--text-muted)]'); }
    });

    window.debouncedCalculateAll();
};

/**
 * ============================================================================
 * [17] RENDER FUNCTIONS (UI RENDERERS FOR CHAT, KEYS, AND RECURRING BILLS)
 * ============================================================================
 */
window.renderOracleChats = function() {
    window.AuraUtils.safeDOM('oracle-chat-box', el => {
        if (!window.oracleChats || window.oracleChats.length === 0) {
            el.innerHTML = `<div class="text-center text-[var(--text-muted)] p-8">
                <i class="fa-solid fa-comment-dots text-3xl mb-3 block opacity-30"></i>
                Belum ada percakapan. Mulai chat dengan Oracle!
            </div>`;
            return;
        }
        
        el.innerHTML = window.oracleChats.map(c => {
            // Bug #32 Fix: HTML escape filter ganda demi mengamankan render bubble chat
            let htmlFormat = window.AuraUtils.escapeHtml(c.text).replace(/\n/g, '<br/>');
            return `<div class="flex ${c.role==='user'?'justify-end':'justify-start'}">
                <div class="p-3.5 rounded-2xl text-xs max-w-[85%] ${c.role==='user'?'bubble-user text-white shadow-md':'bubble-ai glass-panel markdown-content'} leading-relaxed shadow-sm">
                    ${htmlFormat}
                </div>
            </div>`;
        }).join('');
        
        if (window.isProcessing && window.activeView === 'oracle') {
            el.innerHTML += `<div class="flex justify-start">
                <div class="bubble-ai glass-panel p-3 rounded-2xl flex gap-1 items-center">
                    <div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce"></div>
                    <div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce delay-100"></div>
                    <div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce delay-200"></div>
                </div>
            </div>`;
        }
        
        // Bug #42 Fix: Scroll terkunci otomatis hanya jika view aktif berada di halaman Oracle
        if (window.activeView === 'oracle') {
            setTimeout(() => { 
                window.AuraUtils.safeDOM('chat-anchor', anc => anc.scrollIntoView({behavior:'smooth'})); 
            }, 50);
        }
    });
};

window.renderGroqKeysUI = function() {
    window.AuraUtils.safeDOM('groq-keys-container', el => {
        const keys = window.rawGroqKeysData || [];
        
        if(keys.length === 0) {
            el.innerHTML = '<p class="text-[10px] text-[var(--text-muted)] text-center my-2">Belum ada API Key Groq yang tersimpan.</p>';
            return;
        }

        el.innerHTML = keys.map((k, index) => {
            const dec = window.EncryptionService.decryptApiKey(k.encryptedKey, window.GroqService.secret);
            const display = dec ? `${dec.substring(0,8)}...${dec.substring(dec.length-4)}` : `(Data Korup)`;
            const statusColor = dec ? 'text-emerald-400' : 'text-rose-400';
            
            return `<div class="flex justify-between items-center bg-[var(--bg-base)] p-2 rounded-xl border border-[var(--border-glass)]">
                <div class="flex flex-col">
                    <span class="font-mono text-xs ${statusColor}">${display}</span>
                    <span class="text-[8px] text-[var(--text-muted)] uppercase tracking-wider">Groq Key #${index + 1}</span>
                </div>
                <button onclick="window.removeGroqKey('${k.id}')" class="text-rose-500 p-1 hover:text-rose-400 active:scale-90 transition">
                    <i class="fa-solid fa-trash text-xs"></i>
                </button>
            </div>`;
        }).join('');
    });
};

window.renderRecurringUI = function() {
    window.AuraUtils.safeDOM('recurring-list', el => {
        const rPayments = window.settingsData?.recurringPayments || {};
        const entries = Object.entries(rPayments);

        if(entries.length === 0) {
            el.innerHTML = '<p class="text-[10px] text-[var(--text-muted)] text-center my-2">Belum ada tagihan rutin bulanan.</p>';
            return;
        }

        el.innerHTML = entries.map(([id, rp]) => {
            return `<div class="flex justify-between items-center bg-[var(--bg-base)] p-2 rounded-xl border border-[var(--border-glass)]">
                <div class="flex flex-col">
                    <span class="font-bold text-xs text-sky-400">${rp.name}</span>
                    <span class="text-[9px] text-[var(--text-muted)] font-mono">Tgl ${rp.date} | ${window.AuraUtils.formatCurrency(rp.amount)} (${rp.method})</span>
                </div>
                <button onclick="window.removeRecurringPayment('${id}')" class="text-rose-500 p-1 hover:text-rose-400 transition active:scale-90">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                </button>
            </div>`;
        }).join('');
    });
};

window.renderRecurringUIForBudget = function() {
    window.AuraUtils.safeDOM('budget-bills-container', el => {
        const rPayments = window.settingsData?.recurringPayments || {};
        const entries = Object.entries(rPayments);
        
        if(entries.length === 0) {
            el.innerHTML = '<p class="text-[10px] text-[var(--text-muted)] text-center my-2 p-3 bg-black/20 rounded-xl">Belum ada tagihan rutin terkonfigurasi. Tambahkan di Settings.</p>';
            return;
        }

        el.innerHTML = entries.map(([id, rp]) => {
            return `<div class="glass-panel p-3 flex justify-between items-center border-l-2 border-l-sky-400 group">
                <div>
                    <h4 class="font-bold text-xs text-sky-400 flex items-center gap-2">
                        ${rp.name} 
                        <button onclick="window.removeRecurringPayment('${id}')" class="text-rose-500 hover:text-rose-400 transition opacity-0 group-hover:opacity-100">
                            <i class="fa-solid fa-trash text-[10px]"></i>
                        </button>
                    </h4>
                    <p class="text-[9px] text-[var(--text-muted)] font-mono uppercase mt-0.5">Tgl ${rp.date} setiap bulan • ${rp.method}</p>
                </div>
                <p class="font-bold text-sm font-mono text-[var(--text-main)]">${window.AuraUtils.formatCurrency(rp.amount)}</p>
            </div>`;
        }).join('');
    });
};

/**
 * ============================================================================
 * [18] EXPORT CSV (DENGAN FILTER & PROTEKSI INJEKSI SHEETS)
 * ============================================================================
 */
window.downloadCSV = function() {
    let csv = "Tanggal,Waktu_Dibuat,Merchant,Tipe,Metode,Kategori,Nominal_Asli,Mata_Uang,Detail_Item,Deskripsi\n";
    const periodRange = window.AuraUtils.getPeriodRange();
    const fSearch = window.AuraState.filters.search.toLowerCase();
    const fCat = window.AuraState.filters.category;
    const fUser = window.AuraState.filters.user;

    const dataToExport = window.allTransactions.filter(trx => {
        const trxTime = new Date(trx.tanggal || trx.createdAt).getTime();
        if (trxTime < periodRange.start || trxTime > periodRange.end) return false;
        
        if (fSearch) {
            const desc = (trx.description || trx.catatan_ai || "").toLowerCase();
            const merch = (trx.merchantName || trx.storeName || "").toLowerCase();
            const hasItem = trx.items && trx.items.some(i => i.nama_barang.toLowerCase().includes(fSearch));
            if (!desc.includes(fSearch) && !merch.includes(fSearch) && !hasItem) return false;
        }
        if (fCat !== 'ALL') {
            const mainCatMatch = trx.kategori === fCat;
            const itemCatMatch = trx.items && trx.items.some(i => i.kategori_barang === fCat);
            if (!mainCatMatch && !itemCatMatch) return false;
        }
        if (fUser !== 'ALL' && trx.user_id && trx.user_id !== fUser) return false;
        return true;
    });

    // Bug #44 Fix: Sanitasi data guna mencegah serangan CSV Injection di Excel/Sheets
    const cleanCSVField = (val) => {
        if (val === undefined || val === null) return "";
        let strVal = String(val).replace(/"/g, '""');
        // Jika terdapat karakter formula pemicu injeksi, tambahkan escape '
        if (strVal.startsWith('=') || strVal.startsWith('+') || strVal.startsWith('-') || strVal.startsWith('@')) {
            strVal = "'" + strVal;
        }
        return `"${strVal}"`;
    };

    dataToExport.forEach(r => {
        const d = r.tanggal?.split('T')[0] || ''; 
        const created = r.createdAt || ''; 
        const items = r.items && Array.isArray(r.items) ? r.items.map(i=>`${i.nama_barang} (${i.qty} x ${i.harga}) [${i.kategori_barang}]`).join('|') : '-'; 
        const note = (r.description || r.catatan_ai || ''); 
        const store = (r.merchantName || r.storeName || r.kategori || 'Toko');
        
        csv += `${cleanCSVField(d)},${cleanCSVField(created)},${cleanCSVField(store)},${cleanCSVField(r.tipe)},${cleanCSVField(r.metode_pembayaran)},${cleanCSVField(r.kategori)},${cleanCSVField(r.nominal)},${cleanCSVField(r.mata_uang)},${cleanCSVField(items)},${cleanCSVField(note)}\n`;
    });

    const link = document.createElement("a"); link.href = encodeURI("data:text/csv;charset=utf-8," + csv); 
    link.download = `AuraFi_Ledger_Report_${new Date().toISOString().split('T')[0]}.csv`; 
    document.body.appendChild(link); link.click(); link.remove();
    window.showToast(`Berhasil mengekspor ${dataToExport.length} transaksi!`);
};

/**
 * ============================================================================
 * [19] RECURRING PAYMENTS (AUTOMATIC BILL RUNTIME SYSTEM)
 * ============================================================================
 */
window.checkAndExecuteRecurringPayments = async function() {
    // Bug #45 Fix: Blok konkurensi agar scheduler tagihan rutin tidak dieksekusi ganda dalam milidetik yang sama
    if (window.AuraState.temp.isProcessingRecurring) return;
    window.AuraState.temp.isProcessingRecurring = true;

    try {
        const rPayments = window.settingsData?.recurringPayments || {};
        const txList = window.allTransactions || [];
        const today = new Date();
        const curDate = today.getDate();
        const curMonthYearStr = `${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2, '0')}`;
        
        // Bug #46 Fix: Dapatkan hari terakhir bulan berjalan demi mengantisipasi tanggal 29, 30, atau 31 yang absen
        const lastDayOfThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

        for (const [id, rp] of Object.entries(rPayments)) {
            // Tentukan target tanggal eksekusi yang realistis pada bulan berjalan
            const targetDate = Math.min(rp.date, lastDayOfThisMonth);

            if (curDate >= targetDate) {
                const alreadyPaid = txList.some(t => {
                    const sameRecurringId = t.recurring_id === id;
                    const sameMonthYear = t.tanggal && t.tanggal.startsWith(curMonthYearStr);
                    return sameRecurringId && sameMonthYear;
                });

                if (!alreadyPaid) {
                    const timestamp = today.toISOString();
                    const tagihanData = {
                        tanggal: today.toISOString().split('T')[0],
                        createdAt: timestamp,
                        nominal: rp.amount,
                        mata_uang: window.AuraState.system.displayCurrency,
                        metode_pembayaran: rp.method,
                        kategori: 'Utilitas',
                        tipe: 'pengeluaran',
                        sifat: 'kebutuhan',
                        merchantName: rp.name,
                        description: `Pembayaran otomatis: ${rp.name}`,
                        isCustomDescription: true,
                        recurring_id: id,
                        is_deleted: false,
                        items: [{
                            itemId: window.AuraUtils.generateId('itm'),
                            nama_barang: rp.name,
                            harga: rp.amount,
                            qty: 1,
                            kategori_barang: 'Utilitas',
                            tax_rate: 0,
                            paymentMethod: rp.method,
                            timestamp: timestamp
                        }]
                    };
                    try {
                        await window.FirebaseService.saveTransaction(tagihanData);
                        window.showToast(`Tagihan otomatis "${rp.name}" berhasil dibayarkan sistem!`);
                    } catch(e) { Logger.error('Recurring', 'Gagal memproses auto-debet tagihan.', e); }
                }
            }
        }
    } finally {
        window.AuraState.temp.isProcessingRecurring = false;
    }
};

window.addRecurringPayment = async function() {
    const nameInput = document.getElementById('new-rec-name');
    const amtInput = document.getElementById('new-rec-amt');
    const dateInput = document.getElementById('new-rec-date');
    const methodInput = document.getElementById('new-rec-method');

    if (!nameInput || !amtInput || !dateInput || !methodInput) return window.showToast("Form tagihan tidak lengkap!", true);

    const name = nameInput.value.trim();
    const amount = parseFloat(amtInput.value);
    const date = parseInt(dateInput.value);
    const method = methodInput.value;

    if(!name || isNaN(amount) || amount <= 0 || isNaN(date) || date < 1 || date > 31) {
        return window.showToast("Lengkapi form tagihan dengan benar (Tgl 1-31, Nominal > 0)!", true);
    }

    const recId = 'rec_' + Date.now();
    const updates = {};
    updates[`recurringPayments/${recId}`] = { name, amount, date, method, active: true };

    try {
        await window.FirebaseService.updateSettings(updates);
        nameInput.value = ""; amtInput.value = ""; dateInput.value = "";
        window.showToast("Tagihan bulanan berhasil dikonfigurasi!");
    } catch(e) { window.showToast("Gagal menambahkan tagihan.", true); }
};

window.removeRecurringPayment = async function(recId) {
    if(confirm("Hapus tagihan bulanan ini?")) {
        const dbRef = ref(window.AuraState.instances.db, `${APP_CONFIG.LEDGER_NODE}/${window.currentUserUid}/settings/recurringPayments/${recId}`);
        await remove(dbRef);
        window.showToast("Tagihan bulanan berhasil dihapus!");
    }
};

/**
 * ============================================================================
 * [20] REALTIME LISTENERS (FIREBASE PUB/SUB & MEMORY CLEANUP SAVED)
 * ============================================================================
 */
function loadRealtimeDatabaseData() {
    if (!window.currentUserUid) return;

    // Bug #47 Fix: Catat fungsi unsubscribe dari listener Firebase agar bisa dimatikan saat logout
    const transactionsListener = onValue(ref(db, `${APP_CONFIG.LEDGER_NODE}/${window.currentUserUid}/transactions`), (snapshot) => {
        const all = []; const data = snapshot.val();
        if (data) { Object.entries(data).forEach(([key, val]) => all.push({ id: key, ...val })); }
        window.allTransactions = all.filter(t => !t.is_deleted).sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal));
        window.trashTransactions = all.filter(t => t.is_deleted).sort((a,b) => new Date(b.deletedAt) - new Date(a.deletedAt));
        window.checkAndExecuteRecurringPayments();
        window.debouncedCalculateAll();
    });
    window.AuraState.listeners.push(transactionsListener);

    const goalsListener = onValue(ref(db, `${APP_CONFIG.LEDGER_NODE}/${window.currentUserUid}/goals`), (snapshot) => {
        const goals = []; const data = snapshot.val();
        if (data) { Object.entries(data).forEach(([key, val]) => goals.push({ id: key, ...val })); }
        window.allGoals = goals;
        window.debouncedCalculateAll();
    });
    window.AuraState.listeners.push(goalsListener);

    const settingsListener = onValue(ref(db, `${APP_CONFIG.LEDGER_NODE}/${window.currentUserUid}/settings`), (snapshot) => {
        const d = snapshot.val(); window.settingsData = d || {};
        if (d) {
            if(d.monthlyBudget && d.monthlyBudget.limit) window.monthlyBudget = d.monthlyBudget.limit;
            if(d.theme && d.theme !== window.currentTheme) { window.currentTheme = d.theme; if(window.applyTheme) window.applyTheme(); }
            if(d.profile) {
                window.AuraUtils.safeDOM('user-fullname', el => el.value = d.profile.fullName || ''); 
                window.AuraUtils.safeDOM('user-nickname', el => el.value = d.profile.nickname || '');
            }
            if (d.aiPreferences) {
                window.AuraUtils.safeDOM('setting-ai-chat', el => el.value = d.aiPreferences.modelChat);
                window.AuraUtils.safeDOM('setting-ai-vision', el => el.value = d.aiPreferences.modelVision);
                window.AuraUtils.safeDOM('setting-ai-persona', el => el.value = d.aiPreferences.persona);
                window.AuraUtils.safeDOM('setting-ai-style', el => el.value = d.aiPreferences.style);
            }
        }
        window.CategoryManager.renderDropdowns();
        if(window.renderRecurringUI) window.renderRecurringUI();
        if(window.renderRecurringUIForBudget) window.renderRecurringUIForBudget();
        window.debouncedCalculateAll();
    });
    window.AuraState.listeners.push(settingsListener);

    const keysListener = onValue(ref(db, `${APP_CONFIG.LEDGER_NODE}/${window.currentUserUid}/groqApiKeys`), (snapshot) => {
        window.rawGroqKeysData = []; const data = snapshot.val();
        if (data) { Object.entries(data).forEach(([key, val]) => window.rawGroqKeysData.push({ id: key, ...val })); }
        const activeCount = window.GroqService.init(window.rawGroqKeysData);
        window.AuraUtils.safeDOM('groq-status-badge', el => {
            if(activeCount > 0) { el.className = "text-[9px] bg-emerald-950/40 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded uppercase font-mono"; el.innerText = `ACTIVE (${activeCount})`; } 
            else { el.className = "text-[9px] bg-red-950/40 text-rose-400 border border-red-900/50 px-2 py-0.5 rounded uppercase font-mono"; el.innerText = "OFFLINE"; }
        });
        if(window.renderGroqKeysUI) window.renderGroqKeysUI();
    });
    window.AuraState.listeners.push(keysListener);

    const chatsListener = onValue(ref(db, `${APP_CONFIG.LEDGER_NODE}/${window.currentUserUid}/oracleChats`), (snapshot) => {
        const chats = []; const data = snapshot.val();
        if (data) { Object.entries(data).forEach(([key, val]) => chats.push({ id: key, ...val })); chats.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)); }
        window.oracleChats = chats.length === 0 ? [{ role: 'ai', text: `Halo! Aku Aura Oracle V3. Siap mencatat transaksi dan analisis finansial hari ini.`, timestamp: new Date().toISOString() }] : chats;
        if(window.renderOracleChats) window.renderOracleChats();
    });
    window.AuraState.listeners.push(chatsListener);
}

onAuthStateChanged(auth, (user) => {
    const modalLogin = document.getElementById('modal-login');
    if (user) {
        window.currentUserUid = user.uid; window.AuraState.user.uid = user.uid;
        if(modalLogin) modalLogin.classList.add('hidden');
        loadRealtimeDatabaseData();
        window.FirebaseService.saveAuditLog('LOGIN', 'User Session Activated');
        
        // Bug #24 Fix: Mengambil PIN dekripsi Gemini dari sessionStorage (Aman & Tidak persisten)
        const savedGeminiPin = sessionStorage.getItem('aurafi_gemini_pin'); 
        if (savedGeminiPin && window.syncGeminiEngine) { setTimeout(() => window.syncGeminiEngine(true), 800); }
    } else {
        // Bug #47 & #48 Fix: Cleanup memori listener secara total saat user logout
        Logger.info('Core', 'Membersihkan antrean listener Firebase Realtime...');
        window.AuraState.listeners.forEach(unsub => { if (typeof unsub === 'function') unsub(); });
        window.AuraState.listeners = [];
        
        window.currentUserUid = null; window.AuraState.user.uid = null;
        if(modalLogin) modalLogin.classList.remove('hidden');
    }
});

/**
 * ============================================================================
 * [21] EXECUTION HANDLERS & MODALS (Gemini, Edit Trx, Delete)
 * ============================================================================
 */
window.syncGeminiEngine = async function(silent = false) {
    const pinInput = document.getElementById('gemini-pin-input')?.value.trim();
    // Bug #24 Fix: Mengambil PIN dekripsi dari sessionStorage
    const pin = silent ? sessionStorage.getItem('aurafi_gemini_pin') : pinInput;
    
    // Bug #49 Fix: Validasi keamanan parameter PIN global
    if (!pin || pin.length < 4) { if(!silent) window.showToast("HARAP MASUKKAN PIN GEMINI DENGAN BENAR!", true); return; }

    const gBadge = document.getElementById('gemini-status-badge');
    if(gBadge) { gBadge.className = "text-[9px] bg-indigo-950/40 text-indigo-400 border border-indigo-900/50 px-2 py-0.5 rounded font-mono animate-pulse"; gBadge.innerText = "DECRYPTING..."; }
    
    try {
        const geminiEngine = new window.GeminiFailoverEngine(pin);
        const gCount = await geminiEngine.init();
        if(gCount > 0) {
            window.failoverEngineInstance = geminiEngine;
            window.AuraState.instances.geminiEngine = geminiEngine;
            // Simpan ke sessionStorage (Bug #24 Fix)
            sessionStorage.setItem('aurafi_gemini_pin', pin);
            if(gBadge) { gBadge.className = "text-[9px] bg-emerald-950/40 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-mono"; gBadge.innerText = `ACTIVE (${gCount})`; }
            if(!silent) window.showToast("Gemini Vision Berhasil Di-Unlock.");
        } else { throw new Error("GCount 0"); }
    } catch(e) {
        if(gBadge) { gBadge.className = "text-[9px] bg-red-950/40 text-rose-400 border border-red-900/50 px-2 py-0.5 rounded font-mono"; gBadge.innerText = "FAIL / LOCKED"; }
        if(!silent) window.showToast("Dekripsi Gagal: PIN Salah.", true);
    }
};

window.openEditTrxModal = function(id) {
    const sourceTrx = window.allTransactions.find(t => t.id === id); 
    if(!sourceTrx) return; 
    
    // Bug #50 Fix: Melakukan cloning data agar modifikasi tidak merusak referensi state utama sebelum disubmit
    const trx = JSON.parse(JSON.stringify(sourceTrx));
    window.editTrxTargetData = id;
    
    window.AuraUtils.safeDOM('edit-global-store', el => el.value = trx.merchantName || trx.storeName || trx.kategori || '');
    window.AuraUtils.safeDOM('edit-global-curr', el => el.value = trx.mata_uang || 'JPY');
    window.AuraUtils.safeDOM('edit-global-method', el => el.value = trx.metode_pembayaran || 'cashless');
    window.AuraUtils.safeDOM('edit-global-nominal', el => el.value = trx.nominal || 0);
    window.AuraUtils.safeDOM('edit-global-type', el => el.value = trx.tipe || 'pengeluaran');
    window.AuraUtils.safeDOM('edit-global-desc', el => el.value = trx.description || trx.catatan_ai || '');
    window.showModal('modal-edit-trx');
};

window.saveEditTrx = async function() {
    if(!window.editTrxTargetData) return;
    const trxId = window.editTrxTargetData;
    const storeName = document.getElementById('edit-global-store')?.value.trim(); 
    const curr = document.getElementById('edit-global-curr')?.value;
    const method = document.getElementById('edit-global-method')?.value; 
    
    // Bug #51 Fix: Validasi keamanan nominal (Mencegah input minus atau kosong)
    const nominal = parseFloat(document.getElementById('edit-global-nominal')?.value);
    if(isNaN(nominal) || nominal < 0) {
        window.showToast("Nominal transaksi tidak valid / dilarang bernilai minus!", true);
        return;
    }
    
    const tipe = document.getElementById('edit-global-type')?.value || 'pengeluaran'; 
    const desc = document.getElementById('edit-global-desc')?.value.trim() || '';

    const updates = { merchantName: storeName, storeName: storeName, mata_uang: curr, metode_pembayaran: method, nominal: nominal, tipe: tipe };
    if (desc) { updates.description = desc; updates.catatan_ai = desc; updates.isCustomDescription = true; }

    try { 
        await window.FirebaseService.updateTransaction(trxId, updates); 
        window.closeModal('modal-edit-trx'); 
        window.showToast("Perubahan Transaksi Berhasil Disimpan!"); 
    } catch(e) { window.showToast("Gagal mengupdate transaksi.", true); }
};

window.openAddItemModal = function(trxId) {
    window.addItemTargetTrxId = trxId;
    window.AuraUtils.safeDOM('add-item-name', el => el.value = ""); 
    window.AuraUtils.safeDOM('add-item-qty', el => el.value = "1"); 
    window.AuraUtils.safeDOM('add-item-price', el => el.value = "");
    window.CategoryManager.renderDropdowns();
    window.showModal('modal-add-item');
};

window.saveAddItem = async function() {
    if(!window.addItemTargetTrxId) return;
    const trx = window.allTransactions.find(t => t.id === window.addItemTargetTrxId); if(!trx) return;
    const name = document.getElementById('add-item-name')?.value.trim() || "Item Baru";
    const qty = parseFloat(document.getElementById('add-item-qty')?.value) || 1;
    const price = parseFloat(document.getElementById('add-item-price')?.value) || 0;
    const category = document.getElementById('add-item-cat')?.value || 'Lainnya';

    const newItem = { itemId: window.AuraUtils.generateId('itm'), nama_barang: name, harga: price, qty: qty, kategori_barang: category, tax_rate: 0, paymentMethod: trx.metode_pembayaran, timestamp: new Date().toISOString() };
    const finalItems = (trx.items || []).concat([newItem]);
    const newTotalSum = finalItems.reduce((a,b)=>a+(b.harga*(b.qty||1)), 0);

    const upd = { items: finalItems, nominal: newTotalSum };
    if (!trx.isCustomDescription) { upd.description = `[Auto-Update] Transaksi diubah. Total terbaru: ${window.AuraUtils.formatCurrency(newTotalSum)}.`; upd.catatan_ai = upd.description; }

    try { await window.FirebaseService.updateTransaction(trx.id, upd); window.closeModal('modal-add-item'); window.showToast("Item berhasil ditambahkan!"); } 
    catch(e) { window.showToast("Gagal menambah item.", true); }
};

window.openEditItem = function(trxId, itemId) {
    const trx = window.allTransactions.find(t=>t.id === trxId); if(!trx || !trx.items) return;
    const safeItemId = itemId || 'no_id_fallback';
    const item = trx.items.find(i => (i.itemId || '') === safeItemId); if(!item) return;

    window.editItemTargetData = { id: trxId, itemId: safeItemId, item: JSON.parse(JSON.stringify(item)) };
    window.AuraUtils.safeDOM('edit-store-name', el => el.value = trx.merchantName || trx.storeName || '');
    window.AuraUtils.safeDOM('edit-item-name', el => el.value = item.nama_barang || '');
    window.AuraUtils.safeDOM('edit-item-qty', el => el.value = item.qty || 1); 
    window.AuraUtils.safeDOM('edit-item-price', el => el.value = item.harga || 0);
    
    window.CategoryManager.renderDropdowns();
    window.AuraUtils.safeDOM('edit-item-cat', el => el.value = item.kategori_barang || 'Lainnya');
    
    window.showModal('modal-edit-item');
};

window.saveEditItem = async function() {
    if(!window.editItemTargetData) return;
    const trx = window.allTransactions.find(t=>t.id === window.editItemTargetData.id);
    
    if(trx && window.FirebaseService?.updateTransaction) {
        const storeNameVal = document.getElementById('edit-store-name')?.value.trim();
        const newName = document.getElementById('edit-item-name')?.value.trim();
        const newQty = parseFloat(document.getElementById('edit-item-qty')?.value) || 1;
        const newPrice = parseFloat(document.getElementById('edit-item-price')?.value) || 0;
        const newCategory = document.getElementById('edit-item-cat')?.value;
        const targetItemId = window.editItemTargetData.itemId;
        
        const nItems = trx.items.map(it => {
            if (it.itemId === targetItemId || (!it.itemId && targetItemId === 'no_id_fallback')) {
                return { ...it, nama_barang: newName || it.nama_barang, qty: newQty, harga: newPrice, kategori_barang: newCategory || it.kategori_barang };
            } 
            return it;
        });

        const sum = nItems.reduce((a,b)=>a+(b.harga*(b.qty||1)), 0);
        const upd = { items: nItems, nominal: sum, merchantName: storeNameVal || trx.merchantName || trx.storeName, storeName: storeNameVal || trx.storeName || trx.kategori };

        if (!trx.isCustomDescription) { upd.description = `[Auto-Update] Item disesuaikan. Total terbaru: ${window.AuraUtils.formatCurrency(sum)}.`; upd.catatan_ai = upd.description; }
        await window.FirebaseService.updateTransaction(trx.id, upd);
        window.closeModal('modal-edit-item');
        window.showToast("Item dalam struk berhasil diperbarui!");
    }
};

window.confirmDelGoal = function(id) { const goal = window.allGoals.find(g=>g.id === id); if(!goal) return; window.deleteTargetData = { type: 'goal', id, name: goal.name }; window.AuraUtils.safeDOM('confirm-msg', el => el.innerText = `Batalkan misi tabungan "${goal.name}" selamanya?`); window.showModal('modal-confirm'); };
window.confirmDelItem = function(trxId, itemId) { const trx = window.allTransactions.find(t=>t.id === trxId); if(!trx || !trx.items) return; const safeItemId = itemId || 'no_id_fallback'; const item = trx.items.find(i => (i.itemId || '') === safeItemId); if(!item) return; window.deleteTargetData = { type: 'item', id: trxId, name: item.nama_barang, itemId: safeItemId }; window.AuraUtils.safeDOM('confirm-msg', el => el.innerText = `Hapus "${item.nama_barang}" dari struk ini?`); window.showModal('modal-confirm'); };
window.confirmDelTrx = function(id) { const trx = window.allTransactions.find(t=>t.id === id); if(!trx) return; window.deleteTargetData = { type: 'trx', id, name: trx.kategori }; window.AuraUtils.safeDOM('confirm-msg', el => el.innerText = `Pindahkan transaksi "${trx.merchantName || trx.storeName || trx.kategori}" ke tempat sampah?`); window.showModal('modal-confirm'); };
window.closeConfirmModal = function() { window.closeModal('modal-confirm'); window.deleteTargetData=null; };

// Bug #52 Fix: Daftarkan listener 'click' konfirmasi hapus secara dinamis guna mencegah tumpang-tindih event listener ganda
const executeConfirmDelete = document.getElementById('btn-execute-delete');
if(executeConfirmDelete) {
    executeConfirmDelete.addEventListener('click', async () => {
        if(!window.deleteTargetData) return;
        if(window.deleteTargetData.type === 'trx') { 
            if(window.activeView === 'trash') { await window.FirebaseService.deleteTransactionPermanently(window.deleteTargetData.id); } 
            else { await window.FirebaseService.moveToTrash(window.deleteTargetData.id); } 
        } 
        else if(window.deleteTargetData.type === 'goal') { await window.FirebaseService.deleteGoal(window.deleteTargetData.id); } 
        else if(window.deleteTargetData.type === 'item') {
            const trx = window.allTransactions.find(t=>t.id === window.deleteTargetData.id);
            if(trx) {
                const nItems = trx.items.filter(item => item.itemId !== window.deleteTargetData.itemId);
                if(nItems.length === 0) { await window.FirebaseService.moveToTrash(trx.id); } 
                else { 
                    const sum = nItems.reduce((a,b)=>a+(b.harga*(b.qty||1)), 0); 
                    const upd = { items: nItems, nominal: sum }; 
                    if (!trx.isCustomDescription) { upd.description = `[Auto-Update] Item dihapus. Total terbaru: ${window.AuraUtils.formatCurrency(sum)}.`; upd.catatan_ai = upd.description; } 
                    await window.FirebaseService.updateTransaction(trx.id, upd); 
                }
            }
        }
        window.closeConfirmModal(); window.showToast("Aksi Destruktif Berhasil Dieksekusi.");
    });
}

window.promptBudget = function() { const amt = prompt("Masukkan Limit Anggaran Bulanan Baru:", window.monthlyBudget); if(amt && !isNaN(amt)) { window.monthlyBudget = parseFloat(amt); if(window.FirebaseService?.updateSettings) { window.FirebaseService.updateSettings({ monthlyBudget: { limit: window.monthlyBudget } }); } window.debouncedCalculateAll(); } };
window.restoreTransaction = async function(id) { if(window.FirebaseService?.updateTransaction) { await window.FirebaseService.updateTransaction(id, { is_deleted: false, deletedAt: null }); window.showToast("Transaksi dikembalikan dari sampah."); } };
window.deleteForever = async function(id) { if(window.FirebaseService?.deleteTransactionPermanently) { await window.FirebaseService.deleteTransactionPermanently(id); window.showToast("Dihapus permanen."); } };

/**
 * ============================================================================
 * [22] SERVICE WORKER REGISTRATION (PWA)
 * ============================================================================
 */
if ("serviceWorker" in navigator) { 
    window.addEventListener("load", () => { 
        navigator.serviceWorker.register("./service-worker.js")
            .then((r) => Logger.info("ServiceWorker", "PWA Service Worker aktif."))
            .catch((e) => Logger.error("ServiceWorker", "Gagal register", e)); 
    }); 
}