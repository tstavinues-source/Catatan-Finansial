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
        if (user) {
            AuraState.user.uid = user.uid;
            
            isInitialLoadComplete = false;
            initialDataArrived = { transactions: false, settings: false, goals: false };
            
            if (typeof window.showLoading === 'function') window.showLoading();
            if (typeof window.closeModal === 'function') window.closeModal('modal-login');
            if (typeof window.switchView === 'function') window.switchView('dashboard');
            
            const uid = user.uid;

            const txRef = ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${uid}/transactions`);
            onValue(txRef, (snapshot) => {
                const data = snapshot.val();
                const activeArr = [];
                const trashArr = [];
                
                if (data) {
                    for (const key in data) {
                        const item = { id: key, ...data[key] };
                        if (item.is_deleted) trashArr.push(item);
                        else activeArr.push(item);
                    }
                }
                
                activeArr.sort((a, b) => new Date(b.tanggal || b.createdAt) - new Date(a.tanggal || a.createdAt));
                trashArr.sort((a, b) => new Date(b.deletedAt || b.createdAt) - new Date(a.deletedAt || a.createdAt));
                
                AuraState.data.transactions = activeArr;
                AuraState.data.trash = trashArr; 
                initialDataArrived.transactions = true; 
                smartRender();
            });

            const settingsRef = ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${uid}/settings`);
            onValue(settingsRef, (snapshot) => {
                AuraState.data.settings = snapshot.val() || {};
                initialDataArrived.settings = true; 
                smartRender();
            });

            const goalsRef = ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${uid}/goals`);
            onValue(goalsRef, (snapshot) => {
                const data = snapshot.val();
                const arr = [];
                if (data) {
                    for (const key in data) arr.push({ id: key, ...data[key] });
                }
                AuraState.data.goals = arr;
                initialDataArrived.goals = true; 
                smartRender();
            });
            
        } else {
            AuraState.user.uid = null;
            AuraState.data.transactions = [];
            AuraState.data.settings = {};
            AuraState.data.goals = [];
            AuraState.data.trash = [];
            isInitialLoadComplete = false;
            if (typeof window.showModal === 'function') window.showModal('modal-login');
        }
    });

} catch (error) {
    Logger.error('Core', 'Gagal memuat arsitektur Firebase.', error);
}

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
                    let cId = Object.keys(rawCats).find(id => rawCats[id].name.toLowerCase() === cName.toLowerCase() && rawCats[id].parentId === pId);
                    if (!cId) {
                        cId = `cat_auto_c_${Date.now()}_${Math.floor(Math.random()*1000)}`;
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
    }
};

window.FirebaseService = FirebaseService;
