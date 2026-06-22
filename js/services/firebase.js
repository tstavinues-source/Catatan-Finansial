/**
 * Firebase Core Service & Real-Time Sync Engine
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

// ============================================================================
// 🚀 THE ULTIMATE DEBOUNCER (DENGAN REQUEST ANIMATION FRAME)
// ============================================================================
let syncTimeout = null;
window.forceSyncUI = function() {
    if (syncTimeout) clearTimeout(syncTimeout);
    
    // Kombinasi timeout ringan dan requestAnimationFrame untuk UI yang super mulus
    syncTimeout = setTimeout(() => {
        requestAnimationFrame(() => {
            const renderers = [
                'renderDashboard', 
                'renderTransactions', 
                'renderAnalytics', 
                'renderBudgets', 
                'renderTrash'
            ];

            renderers.forEach(fn => {
                try {
                    if (typeof window[fn] === 'function') {
                        window[fn]();
                    }
                } catch (e) {
                    console.warn(`Peringatan: Gagal menyinkronkan UI pada modul ${fn}`, e);
                }
            });
        });
    }, 100); // Latensi diturunkan untuk responsivitas maksimal
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
            
            if (typeof window.closeModal === 'function') window.closeModal('modal-login');
            if (typeof window.switchView === 'function') window.switchView('dashboard');
            
            // 1. STREAM TRANSAKSI MURNI (Tanpa duplikasi get())
            const txRef = ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${user.uid}/transactions`);
            onValue(txRef, (snapshot) => {
                const data = snapshot.val();
                const activeArr = [];
                const trashArr = [];
                
                if (data) {
                    for (const key in data) {
                        const item = { id: key, ...data[key] };
                        if (item.is_deleted) {
                            trashArr.push(item);
                        } else {
                            activeArr.push(item);
                        }
                    }
                }
                
                activeArr.sort((a, b) => new Date(b.tanggal || b.createdAt) - new Date(a.tanggal || a.createdAt));
                trashArr.sort((a, b) => new Date(b.deletedAt || b.createdAt) - new Date(a.deletedAt || a.createdAt));
                
                AuraState.data.transactions = activeArr;
                AuraState.data.trash = trashArr; 
                
                window.forceSyncUI();
            });

            // 2. STREAM PENGATURAN
            const settingsRef = ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${user.uid}/settings`);
            onValue(settingsRef, (snapshot) => {
                AuraState.data.settings = snapshot.val() || {};
                window.forceSyncUI();
            });

            // 3. STREAM GOALS
            const goalsRef = ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${user.uid}/goals`);
            onValue(goalsRef, (snapshot) => {
                const data = snapshot.val();
                const arr = [];
                if (data) {
                    for (const key in data) arr.push({ id: key, ...data[key] });
                }
                AuraState.data.goals = arr;
                window.forceSyncUI();
            });
            
        } else {
            AuraState.user.uid = null;
            AuraState.data.transactions = [];
            AuraState.data.settings = {};
            AuraState.data.goals = [];
            AuraState.data.trash = [];
            
            if (typeof window.showModal === 'function') window.showModal('modal-login');
        }
    });

} catch (error) {
    Logger.error('Core', 'Gagal memuat Firebase.', error);
}

window.loadRealtimeDatabaseData = function(silent = false) {
    if (AuraState.user.uid) {
        window.forceSyncUI();
        if (!silent && typeof window.showToast === 'function') {
            window.showToast("Data Disinkronisasi Secara Paksa!");
        }
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
        data.user_id = AuraState.data.settings?.profile?.nickname || "User";
        data.nominal = Math.max(0, Number(data.nominal) || 0); 
        if (!data.createdAt) data.createdAt = new Date().toISOString();
        
        await push(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/transactions`), data);
        await this.saveAuditLog(isFromAI ? "AI.PARSE" : "MANUAL.ADD", `Transaksi: ${data.merchantName} (${AuraUtils.formatCurrency(data.nominal)})`);
    },

    updateTransaction: async function(id, data) { 
        this._checkAuth();
        if (!id) throw new Error("ID Referensi Transaksi tidak terdefinisi.");
        
        const pathRef = ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/transactions/${id}`);
        data.updatedAt = new Date().toISOString();
        
        // Optimasi latensi: Langsung tembak update tanpa 'get'
        await update(pathRef, data);
        await this.saveAuditLog("SYS.MODIFY", `Update ID Transaksi: ${id}`);
    },

    moveToTrash: async function(id) { 
        this._checkAuth();
        // Langsung eksekusi pembaruan status ke Firebase. onValue akan otomatis menyegarkan antarmuka!
        await update(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/transactions/${id}`), { 
            is_deleted: true, 
            deletedAt: new Date().toISOString() 
        });
        await this.saveAuditLog("SYS.TRASH", `Arsip Sampah ID: ${id}`);
        window.forceSyncUI();
    },

    deleteTransactionPermanently: async function(id) { 
        this._checkAuth();
        await remove(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/transactions/${id}`));
        await this.saveAuditLog("SYS.DESTROY", `Pembersihan permanen ID: ${id}`);
    },

    saveGoal: async function(data) { 
        this._checkAuth();
        await push(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/goals`), data); 
        await this.saveAuditLog("GOAL.ADD", `Tujuan finansial baru.`);
    },

    updateGoal: async function(id, data) {
        this._checkAuth();
        await update(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/goals/${id}`), data);
        await this.saveAuditLog("GOAL.EDIT", `Update tujuan finansial ID: ${id}`);
    },

    deleteGoal: async function(id) { 
        this._checkAuth();
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
