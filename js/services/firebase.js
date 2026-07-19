/**
 * Firebase Core Service & Real-Time Sync Engine
 * Dilengkapi dengan Auto-Registrar & Dynamic Learning Smart Mapper
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getDatabase, ref, push, update, remove, onValue, get 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { 
    getAuth, GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, signInAnonymously, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

import { FIREBASE_CONFIG, APP_CONFIG } from '../config/constants.js';
import { Logger } from '../core/logger.js';
import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';

let firebaseAppInstance = null;
let dbInstance = null;
let authInstance = null;
let googleAuthProviderInstance = null;

Logger.info('Core', 'Menginisialisasi Firebase SDK Environment...');

let isInitialLoadComplete = false;
let initialDataArrived = { transactions: false, settings: false, goals: false };

const forceUIRender = () => {
    const renderers = ['renderDashboard', 'renderTransactions', 'renderAnalytics', 'renderBudgets', 'renderTrash'];
    renderers.forEach(fn => {
        try {
            if (typeof window[fn] === 'function') window[fn]();
        } catch(e) {
            console.warn(`Peringatan: Render tertahan di modul ${fn}`);
        }
    });
    // Ikut memicu kalkulasi saldo dompet & statistik periode (sebelumnya dipicu
    // secara terpisah oleh listener duplikat di dashboard.js).
    if (typeof window.debouncedCalculateAll === 'function') window.debouncedCalculateAll();
};

const smartRender = () => {
    if (!isInitialLoadComplete) {
        if (initialDataArrived.transactions && initialDataArrived.settings && initialDataArrived.goals) {
            isInitialLoadComplete = true;
            if (typeof window.hideLoading === 'function') window.hideLoading();
        } else {
            return; 
        }
    }
    requestAnimationFrame(() => forceUIRender());
};

// ============================================================================
// 🛡️ PENGELOLA SIKLUS HIDUP LISTENER REALTIME (ANTI-DUPLIKASI)
// ============================================================================
// PERBAIKAN KRITIS: Sebelumnya `dashboard.js` memasang SET LISTENER KEDUA yang
// terpisah untuk path yang SAMA (transactions/settings/goals), sehingga kedua
// listener menulis ke AuraState secara independen dan saling tumpang tindih
// (race condition: urutan transaksi & koreksi tipe mutasi legacy jadi tidak
// konsisten tergantung listener mana yang terakhir menembak). Sekarang HANYA
// firebase.js yang boleh memasang listener realtime; semua unsubscribe-nya
// dilacak di AuraState.listeners agar bisa dibersihkan saat re-login/logout.
const detachAllRealtimeListeners = () => {
    const listeners = AuraState.listeners || [];
    for (let i = 0; i < listeners.length; i++) {
        if (typeof listeners[i] === 'function') {
            try { listeners[i](); } catch(e) { /* abaikan */ }
        }
    }
    AuraState.listeners = [];
};

try {
    firebaseAppInstance = initializeApp(FIREBASE_CONFIG);
    dbInstance = getDatabase(firebaseAppInstance);
    authInstance = getAuth(firebaseAppInstance);
    googleAuthProviderInstance = new GoogleAuthProvider();
    
    AuraState.instances.firebaseApp = firebaseAppInstance;
    AuraState.instances.db = dbInstance;
    AuraState.instances.auth = authInstance;
    window.googleAuthProvider = googleAuthProviderInstance;
    
    const connectionRef = ref(dbInstance, ".info/connected");
    onValue(connectionRef, function(snap) {
        AuraState.system.isOnline = snap.val() === true;
    });

    onAuthStateChanged(authInstance, (user) => {
        // Selalu bersihkan listener lama dulu (mencegah listener dobel jika
        // event auth berubah lagi sebelum listener sebelumnya sempat dilepas,
        // misalnya saat ganti akun tanpa reload penuh).
        detachAllRealtimeListeners();

        if (user) {
            AuraState.user.uid = user.uid;
            
            isInitialLoadComplete = false;
            initialDataArrived = { transactions: false, settings: false, goals: false };
            
            if (typeof window.showLoading === 'function') window.showLoading();
            if (typeof window.closeModal === 'function') window.closeModal('modal-login');
            if (typeof window.switchView === 'function') window.switchView('dashboard');
            
            const uid = user.uid;

            // ====================================================================
            // 1. TRANSAKSI (+ koreksi tipe mutasi legacy berbasis nama merchant,
            //    digabung dari listener duplikat yang sebelumnya ada di dashboard.js)
            // ====================================================================
            const txRef = ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${uid}/transactions`);
            const txUnsub = onValue(txRef, (snapshot) => {
                const data = snapshot.val();
                const activeArr = [];
                const trashArr = [];
                
                if (data) {
                    for (const key in data) {
                        const item = { id: key, ...data[key] };
                        
                        // 🛡️ Pencegat legacy: transaksi mutasi lama yang belum sempat
                        // dimigrasi (belum punya tipe 'mutasi_keluar'/'mutasi_masuk')
                        // masih dikenali lewat awalan nama merchant.
                        if (item.tipe !== 'mutasi_keluar' && item.tipe !== 'mutasi_masuk' && typeof item.merchantName === 'string') {
                            const mName = item.merchantName.toLowerCase();
                            if (mName.startsWith('mutasi ke ')) item.tipe = 'mutasi_keluar';
                            else if (mName.startsWith('mutasi dari ')) item.tipe = 'mutasi_masuk';
                        }
                        
                        if (item.is_deleted) trashArr.push(item);
                        else activeArr.push(item);
                    }
                }
                
                activeArr.sort((a, b) => new Date(b.tanggal || b.createdAt) - new Date(a.tanggal || a.createdAt));
                trashArr.sort((a, b) => new Date(b.deletedAt || b.createdAt) - new Date(a.deletedAt || a.createdAt));
                
                AuraState.data.transactions = activeArr;
                AuraState.data.trash = trashArr; 
                initialDataArrived.transactions = true; 
                
                if (typeof window.populateUserFilterDropdown === 'function') window.populateUserFilterDropdown();
                smartRender();
            });
            AuraState.listeners.push(txUnsub);

            // ====================================================================
            // 2. SETTINGS (+ efek samping UI yang sebelumnya ada di listener
            //    duplikat dashboard.js: budget, groq keys, preferensi AI, profil)
            // ====================================================================
            const settingsRef = ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${uid}/settings`);
            const settingsUnsub = onValue(settingsRef, (snapshot) => {
                const data = snapshot.val() || {};
                AuraState.data.settings = data;

                if (data.monthlyBudget?.limit !== undefined) {
                    AuraState.data.monthlyBudget = data.monthlyBudget.limit;
                }

                if (data.groqApiKeys) {
                    AuraState.data.groqKeys = Object.keys(data.groqApiKeys).map(key => ({ id: key, ...data.groqApiKeys[key] }));
                    if (typeof window.renderGroqKeysUI === 'function') window.renderGroqKeysUI();
                }

                if (data.aiPreferences) {
                    AuraUtils.safeDOM('setting-ai-chat', el => el.value = data.aiPreferences.modelChat || 'Auto');
                    AuraUtils.safeDOM('setting-ai-vision', el => el.value = data.aiPreferences.modelVision || 'Auto');
                    AuraUtils.safeDOM('setting-ai-persona', el => el.value = data.aiPreferences.persona || 'Kombinasi Humble + Jenius + Profesional');
                    AuraUtils.safeDOM('setting-ai-style', el => el.value = data.aiPreferences.style || 'Normal');
                }

                if (data.profile) {
                    AuraUtils.safeDOM('user-fullname', el => el.value = data.profile.fullName || '');
                    AuraUtils.safeDOM('user-nickname', el => el.value = data.profile.nickname || '');
                }

                if (typeof window.renderRecurringUI === 'function') window.renderRecurringUI();
                if (typeof window.renderRecurringUIForBudget === 'function') window.renderRecurringUIForBudget();
                if (typeof window.renderCategoryDropdowns === 'function') window.renderCategoryDropdowns();
                // FITUR BARU: label tombol "Siklus X-Y" ikut update sesuai settings.cycleStartDay
                if (typeof window.updateCycleButtonLabel === 'function') window.updateCycleButtonLabel();

                initialDataArrived.settings = true; 
                smartRender();
            });
            AuraState.listeners.push(settingsUnsub);

            // ====================================================================
            // 3. GOALS
            // ====================================================================
            const goalsRef = ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${uid}/goals`);
            const goalsUnsub = onValue(goalsRef, (snapshot) => {
                const data = snapshot.val();
                const arr = [];
                if (data) {
                    for (const key in data) arr.push({ id: key, ...data[key] });
                }
                AuraState.data.goals = arr;
                initialDataArrived.goals = true; 
                smartRender();
            });
            AuraState.listeners.push(goalsUnsub);

            // ====================================================================
            // 4. WALLETS (sebelumnya hanya dipasang lewat listener duplikat)
            // ====================================================================
            const walletsRef = ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${uid}/wallets`);
            const walletsUnsub = onValue(walletsRef, (snapshot) => {
                AuraState.data.wallets = snapshot.val() || {};
                if (typeof window.debouncedCalculateAll === 'function') window.debouncedCalculateAll();
            });
            AuraState.listeners.push(walletsUnsub);

            // ====================================================================
            // 5. ORACLE CHATS (sebelumnya hanya dipasang lewat listener duplikat)
            // ====================================================================
            const chatRef = ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${uid}/oracleChats`);
            const chatUnsub = onValue(chatRef, (snapshot) => {
                const data = snapshot.val() || {};
                AuraState.data.oracleChats = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                if (typeof window.renderOracleChats === 'function') window.renderOracleChats();
            });
            AuraState.listeners.push(chatUnsub);
            
        } else {
            AuraState.user.uid = null;
            AuraState.data.transactions = [];
            AuraState.data.settings = {};
            AuraState.data.goals = [];
            AuraState.data.trash = [];
            AuraState.data.wallets = {};
            AuraState.data.oracleChats = [];
            isInitialLoadComplete = false;
            if (typeof window.showModal === 'function') window.showModal('modal-login');
        }
    });

} catch (error) {
    Logger.error('Core', 'Gagal memuat arsitektur Firebase.', error);
}

// PERBAIKAN: fungsi ini TIDAK LAGI memasang listener baru (itu sudah eksklusif
// dilakukan sekali di onAuthStateChanged di atas). Sekarang murni memicu
// refresh tampilan dari state yang sudah ada di memori — dipanggil oleh tombol
// "Refresh Data" manual dan oleh main.js setelah ganti preferensi (mis. mata uang).
window.loadRealtimeDatabaseData = function(silent = false) {
    if (AuraState.user.uid) {
        requestAnimationFrame(() => forceUIRender());
        if (!silent && typeof window.showToast === 'function') window.showToast("Sinkronisasi antarmuka berhasil.");
    }
};

export const FirebaseService = {
    loginWithEmail: async function(email, password) { return await signInWithEmailAndPassword(authInstance, email, password); },
    loginWithGoogle: async function() { return await signInWithPopup(authInstance, googleAuthProviderInstance); },
    loginAnonymously: async function() { return await signInAnonymously(authInstance); },
    logout: async function() { return await signOut(authInstance); },

    _checkAuth: function() {
        if (!authInstance || !authInstance.currentUser || !AuraState.user.uid) throw new Error("Sesi pengguna tidak valid.");
    },

    // ========================================================================
    // 🛡️ GUDANG OTOMATIS & AURA DYNAMIC LEARNING MAPPER
    // ========================================================================
    _autoRegisterToVault: async function(trxData) {
        if (!trxData) return;
        let rawCats = AuraState.data.settings?.customCategories || {};
        let isUpdated = false;

        let pName = trxData.kategori;
        if (!pName || pName.trim() === '' || pName.toLowerCase() === 'uncategorized') pName = 'Lainnya';
        
        // --- 🧠 AURA SMART MAPPER (Kamus Bawaan) ---
        const pNameLower = pName.toLowerCase();
        let targetParent = pName; 
        let forcedChild = null;

        const PARENT_ALIASES = {
            "Makanan": ["makan", "makanan", "sarapan", "siang", "malam", "jajan", "kuliner", "restoran", "snack", "cemilan", "buah", "sayur", "daging", "bumbu"],
            "Minuman": ["minum", "minuman", "kafe", "kopi", "teh", "susu", "jus", "sirup", "air"],
            "Transportasi": ["transportasi", "transport", "kendaraan", "bensin", "parkir", "tol", "gojek", "grab", "ojol", "kereta", "bus", "pesawat", "tiket"],
            "Tagihan & Utilitas": ["tagihan", "utilitas", "listrik", "air", "internet", "wifi", "pulsa", "kuota", "pajak", "bpjs", "asuransi"],
            "Kesehatan & Medis": ["kesehatan", "medis", "obat", "dokter", "sakit", "klinik", "apotek", "perawatan", "vitamin"],
            "Belanja Pribadi": ["belanja", "pakaian", "baju", "sepatu", "skincare", "kosmetik", "fashion", "elektronik", "gadget", "kebutuhan"],
            "Hiburan & Hobi": ["hiburan", "hobi", "game", "bioskop", "langganan", "streaming", "netflix", "spotify", "rekreasi", "liburan", "mainan"],
            "Pemasukan": ["gaji", "bonus", "upah", "investasi", "laba", "pemasukan", "pendapatan", "jual", "thr"]
        };

        // 🧠 DYNAMIC LEARNING: Jika user membuat kategori induk manual di luar script,
        // sistem akan menambahkannya otomatis ke dalam memori kamusnya!
        Object.values(rawCats).forEach(cat => {
            if (!cat.parentId && !PARENT_ALIASES[cat.name]) {
                PARENT_ALIASES[cat.name] = [cat.name.toLowerCase()];
            }
        });

        // Proses penyaringan (Matching)
        for (const [stdParent, keywords] of Object.entries(PARENT_ALIASES)) {
            if (keywords.some(kw => pNameLower.includes(kw))) {
                if (pNameLower !== stdParent.toLowerCase()) {
                    targetParent = stdParent; 
                    forcedChild = pName; 
                }
                break;
            }
        }

        // KOREKSI TRANSAKSI SEBELUM DISIMPAN
        trxData.kategori = targetParent;
        if (forcedChild && trxData.items && trxData.items.length > 0) {
            trxData.items.forEach(item => {
                if (!item.kategori_barang || item.kategori_barang.toLowerCase() === targetParent.toLowerCase() || item.kategori_barang.toLowerCase() === 'uncategorized' || item.kategori_barang.toLowerCase() === 'lainnya') {
                    item.kategori_barang = forcedChild;
                }
            });
        }
        // --------------------------------------------------------------

        const type = (trxData.tipe === 'pemasukan' || trxData.jenis === 'pemasukan' || trxData.tipe === 'income') ? 'income' : 'expense';

        // 1. Daftarkan Induk ke Gudang
        let pId = Object.keys(rawCats).find(id => rawCats[id].name.toLowerCase() === targetParent.toLowerCase() && !rawCats[id].parentId);
        if (!pId) {
            pId = `cat_auto_p_${Date.now()}_${Math.floor(Math.random()*1000)}`;
            
            let icon = 'fa-layer-group';
            if(targetParent === 'Makanan') icon = 'fa-burger';
            if(targetParent === 'Minuman') icon = 'fa-mug-hot';
            if(targetParent === 'Transportasi') icon = 'fa-car';
            
            rawCats[pId] = { name: targetParent, type: type, icon: icon, color: '#818cf8', parentId: null };
            isUpdated = true;
        }

        // 2. Daftarkan Sub-Kategori (Anak) ke Gudang
        if (trxData.items && Array.isArray(trxData.items)) {
            trxData.items.forEach(item => {
                if (!item || typeof item !== 'object') return;
                const cName = item.kategori_barang || item.kategori || item.category || item.sub_kategori;
                
                if (cName && cName.toLowerCase() !== targetParent.toLowerCase() && cName.toLowerCase() !== 'uncategorized' && cName.toLowerCase() !== 'lainnya') {
                    // PERBAIKAN KRITIS: Sebelumnya pengecekan "sudah ada atau belum" hanya
                    // dicari SEBAGAI ANAK dari targetParent (kategori level transaksi).
                    // Karena kategori level-transaksi sering tidak sinkron dengan kategori
                    // per-item yang dipilih user (mis. transaksi tetap "Lainnya" walau user
                    // ganti kategori item jadi "Makanan"), sistem selalu gagal menemukan
                    // "Makanan" yang SUDAH ADA sebagai kategori induk sendiri, lalu bikin
                    // "Makanan" baru sebagai anak dari "Lainnya" — jadi duplikat.
                    // Sekarang: cek dulu apakah nama ini SUDAH ADA di MANAPUN di vault
                    // (baik sebagai induk sendiri, maupun sebagai anak dari induk lain).
                    // Kalau sudah ada di manapun, jangan buat baru.
                    let cIdExisting = Object.keys(rawCats).find(id => rawCats[id].name.toLowerCase() === cName.toLowerCase());
                    if (!cIdExisting) {
                        const cId = `cat_auto_c_${Date.now()}_${Math.floor(Math.random()*1000)}`;
                        rawCats[cId] = { name: cName, type: type, icon: 'fa-tag', color: rawCats[pId].color, parentId: pId };
                        isUpdated = true;
                    }
                }
            });
        }

        if (isUpdated) {
            if (AuraState.data.settings) AuraState.data.settings.customCategories = rawCats;
            await update(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/settings`), { customCategories: rawCats });
        }
    },

    saveAuditLog: async function(action, detail) {
        if (!AuraState.user.uid || !dbInstance) return;
        try {
            const profile = AuraState.data.settings?.profile || {};
            const userName = profile.fullName || profile.nickname || "Anonymous User";
            const payload = { action: action, detail: AuraUtils.escapeHtml(detail), user: AuraUtils.escapeHtml(userName), ts: Date.now() };
            await push(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/audit_logs`), payload);
        } catch (e) { console.error('Audit Log gagal disimpan', e); }
    },
    
    saveTransaction: async function(data, isFromAI = false) { 
        this._checkAuth();

        // Tembuskan data ke filter Smart Mapper
        await this._autoRegisterToVault(data);

        data.user_id = AuraState.data.settings?.profile?.nickname || "User";
        data.nominal = Math.max(0, Number(data.nominal) || 0); 
        if (!data.createdAt) data.createdAt = new Date().toISOString();
        
        await push(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/transactions`), data);
        await this.saveAuditLog(isFromAI ? "AI.PARSE" : "MANUAL.ADD", `Transaksi: ${data.merchantName || data.storeName || 'Sistem'} (${AuraUtils.formatCurrency(data.nominal)})`);
        forceUIRender();
    },

    // PERBAIKAN KRITIS: Sebelumnya transfer/mutasi saldo antar dompet disimpan
    // lewat DUA panggilan saveTransaction() TERPISAH secara berurutan (satu untuk
    // "keluar", satu untuk "masuk"). Kalau panggilan kedua gagal (mis. koneksi
    // putus di tengah proses), transaksi PERTAMA sudah kepalang tersimpan —
    // dana tercatat KELUAR dari sumber tanpa pernah MASUK ke tujuan; dana
    // "hilang" tanpa jejak dan tanpa rollback otomatis.
    // Sekarang keduanya ditulis dalam SATU operasi update() multi-path yang
    // atomik: Firebase Realtime Database menjamin either KEDUA path tertulis,
    // ATAU TIDAK SAMA SEKALI (all-or-nothing) — tidak ada lagi kondisi
    // "setengah jalan" dimana dana hilang tanpa pasangannya.
    executeAtomicTransfer: async function(trxKeluar, trxMasuk) {
        this._checkAuth();

        const userLabel = AuraState.data.settings?.profile?.nickname || "User";
        const nowIso = new Date().toISOString();
        
        trxKeluar.user_id = userLabel;
        trxMasuk.user_id = userLabel;
        trxKeluar.nominal = Math.max(0, Number(trxKeluar.nominal) || 0);
        trxMasuk.nominal = Math.max(0, Number(trxMasuk.nominal) || 0);
        if (!trxKeluar.createdAt) trxKeluar.createdAt = nowIso;
        if (!trxMasuk.createdAt) trxMasuk.createdAt = nowIso;
        if (!trxKeluar.id) throw new Error("trxKeluar wajib punya id sebelum transfer atomik.");
        if (!trxMasuk.id) throw new Error("trxMasuk wajib punya id sebelum transfer atomik.");

        const multiPathUpdate = {};
        multiPathUpdate[`transactions/${trxKeluar.id}`] = trxKeluar;
        multiPathUpdate[`transactions/${trxMasuk.id}`] = trxMasuk;

        await update(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}`), multiPathUpdate);
        await this.saveAuditLog("MANUAL.TRANSFER", `Mutasi Saldo: ${trxKeluar.merchantName || 'Sumber'} → ${trxMasuk.merchantName || 'Tujuan'} (${AuraUtils.formatCurrency(trxKeluar.nominal)})`);
        forceUIRender();
    },

    updateTransaction: async function(id, data) { 
        this._checkAuth();
        if (!id) throw new Error("ID Referensi Transaksi tidak terdefinisi.");
        
        await this._autoRegisterToVault(data);

        if (AuraState.data.transactions) {
            const idx = AuraState.data.transactions.findIndex(t => t.id === id);
            if (idx !== -1) AuraState.data.transactions[idx] = { ...AuraState.data.transactions[idx], ...data };
        }
        forceUIRender();

        const pathRef = ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/transactions/${id}`);
        data.updatedAt = new Date().toISOString();
        
        await update(pathRef, data);
        await this.saveAuditLog("SYS.MODIFY", `Update ID Transaksi: ${id}`);
    },

    moveToTrash: async function(id) { 
        this._checkAuth();

        if (AuraState.data.transactions) {
            AuraState.data.transactions = AuraState.data.transactions.filter(t => t.id !== id);
        }
        forceUIRender(); 

        await update(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/transactions/${id}`), { 
            is_deleted: true, 
            deletedAt: new Date().toISOString() 
        });
        await this.saveAuditLog("SYS.TRASH", `Arsip Sampah ID: ${id}`);
    },

    deleteTransactionPermanently: async function(id) { 
        this._checkAuth();

        if (AuraState.data.trash) {
            AuraState.data.trash = AuraState.data.trash.filter(t => t.id !== id);
        }
        forceUIRender();

        await remove(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/transactions/${id}`));
        await this.saveAuditLog("SYS.DESTROY", `Pembersihan permanen ID: ${id}`);
    },

    saveGoal: async function(data) { 
        this._checkAuth();
        await push(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/goals`), data); 
        await this.saveAuditLog("GOAL.ADD", `Tujuan finansial baru.`);
        forceUIRender();
    },

    updateGoal: async function(id, data) {
        this._checkAuth();

        if (AuraState.data.goals) {
            const idx = AuraState.data.goals.findIndex(g => g.id === id);
            if (idx !== -1) AuraState.data.goals[idx] = { ...AuraState.data.goals[idx], ...data };
        }
        forceUIRender();

        await update(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/goals/${id}`), data);
        await this.saveAuditLog("GOAL.EDIT", `Update tujuan finansial ID: ${id}`);
    },

    deleteGoal: async function(id) { 
        this._checkAuth();

        if (AuraState.data.goals) {
            AuraState.data.goals = AuraState.data.goals.filter(g => g.id !== id);
        }
        forceUIRender();

        await remove(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/goals/${id}`));
        await this.saveAuditLog("GOAL.DELETE", `Hapus tujuan finansial ID: ${id}`);
    },

    updateSettings: async function(data) { 
        this._checkAuth();
        await update(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/settings`), data); 
    },

    saveGroqKey: async function(encryptedKey) { 
        this._checkAuth();
        await push(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/groqApiKeys`), { encryptedKey: encryptedKey, createdAt: new Date().toISOString(), active: true, usageCount: 0 });
    },

    deleteGroqKey: async function(keyId) { 
        this._checkAuth();
        await remove(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/groqApiKeys/${keyId}`));
    },

    pushOracleChat: async function(chatObj) { 
        if (!AuraState.user.uid || !dbInstance) return;
        await push(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/oracleChats`), chatObj); 
    },

    // ========================================================================
    // GUDANG BRANKAS ARSIP (LAPORAN TUTUP BUKU)
    // ========================================================================
    saveArchive: async function(data) {
        this._checkAuth();
        await push(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/archives`), data);
        await this.saveAuditLog("ARSIP.CREATE", `Tutup Buku: ${data.name}`);
    },
    
    getArchives: async function() {
        this._checkAuth();
        const snapshot = await get(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/archives`));
        const arr = [];
        if (snapshot.exists()) {
            const data = snapshot.val();
            for (const key in data) arr.push({ id: key, ...data[key] });
        }
        // Urutkan dari yang terbaru
        return arr.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    
    deleteArchive: async function(id) {
        this._checkAuth();
        await remove(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/archives/${id}`));
        await this.saveAuditLog("ARSIP.DELETE", `Membakar Arsip Laporan ID: ${id}`);
    }
};

window.FirebaseService = FirebaseService;
