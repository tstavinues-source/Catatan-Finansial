/**
 * Firebase Core Service & Audit Logging Module
 * Mengelola koneksi database realtime, status sinkronisasi, otentikasi, dan operasi CRUD.
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
        if (snap.val() === true) {
            AuraState.system.isOnline = true;
            Logger.success('Core', 'Sinkronisasi Cloud Firebase AKTIF.');
        } else {
            AuraState.system.isOnline = false;
            Logger.warn('Core', 'Mode Offline (Koneksi Terputus).');
        }
    });

    onAuthStateChanged(authInstance, (user) => {
        if (user) {
            AuraState.user.uid = user.uid;
            Logger.success('Auth', `Sesi pengguna dikonfirmasi: ${user.uid}`);
            
            if (typeof window.closeModal === 'function') window.closeModal('modal-login');
            if (typeof window.switchView === 'function') window.switchView('dashboard');
            
            // ================================================================
            // 🚀 MESIN REAL-TIME STREAMING (ANTI RACE-CONDITION)
            // ================================================================
            
            // FUNGSI PINTAR: Memastikan fungsi pelukis benar-benar sudah siap
            let renderTimeout = null;
            function triggerUIRender() {
                if (renderTimeout) clearTimeout(renderTimeout);
                renderTimeout = setTimeout(() => {
                    // Cek apakah fungsi pelukis sudah di-load oleh browser
                    if (typeof window.renderDashboard === 'function') {
                        window.renderDashboard();
                        if (typeof window.renderTransactions === 'function') window.renderTransactions();
                        if (typeof window.renderAnalytics === 'function') window.renderAnalytics();
                        if (typeof window.renderBudgets === 'function') window.renderBudgets();
                    } else {
                        // Jika belum siap (karena browser telat memuat file), coba lagi dalam 150ms!
                        triggerUIRender();
                    }
                }, 150);
            }

            // 1. STREAM TRANSAKSI
            const txRef = ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${user.uid}/transactions`);
            onValue(txRef, (snapshot) => {
                const data = snapshot.val();
                const arr = [];
                if (data) {
                    for (const key in data) {
                        if (!data[key].is_deleted) { // Anti-Sampah
                            arr.push({ id: key, ...data[key] });
                        }
                    }
                }
                arr.sort((a, b) => new Date(b.tanggal || b.createdAt) - new Date(a.tanggal || a.createdAt));
                AuraState.data.transactions = arr;
                triggerUIRender();
            });

            // 2. STREAM PENGATURAN
            const settingsRef = ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${user.uid}/settings`);
            onValue(settingsRef, (snapshot) => {
                AuraState.data.settings = snapshot.val() || {};
                triggerUIRender();
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
                triggerUIRender();
            });
            
        } else {
            AuraState.user.uid = null;
            AuraState.data.transactions = [];
            AuraState.data.settings = {};
            AuraState.data.goals = [];
            
            Logger.info('Auth', 'Sesi kosong. Menunggu login...');
            if (typeof window.showModal === 'function') window.showModal('modal-login');
        }
    });

} catch (error) {
    Logger.error('Core', 'FATAL: Gagal melakukan bootstrap koneksi Firebase SDK.', error);
}

// Fungsi manual untuk refresh UI jika user menekan tombol putar di pojok
window.loadRealtimeDatabaseData = function(silent = false) {
    if (AuraState.user.uid) {
        if (typeof window.renderDashboard === 'function') window.renderDashboard();
        if (typeof window.renderTransactions === 'function') window.renderTransactions();
        if (typeof window.renderAnalytics === 'function') window.renderAnalytics();
        if (typeof window.renderBudgets === 'function') window.renderBudgets();
        
        if (!silent && typeof window.showToast === 'function') {
            window.showToast("UI Disegarkan. Mode Real-Time Aktif!");
        }
    }
};

export const FirebaseService = {
    loginWithEmail: async function(email, password) { return await signInWithEmailAndPassword(authInstance, email, password); },
    loginWithGoogle: async function() { return await signInWithPopup(authInstance, googleAuthProviderInstance); },
    loginAnonymously: async function() { return await signInAnonymously(authInstance); },
    logout: async function() { return await signOut(authInstance); },

    _checkAuth: function() {
        if (!authInstance || !authInstance.currentUser || !AuraState.user.uid) {
            throw new Error("Sesi pengguna tidak valid. Anda harus masuk akun terlebih dahulu.");
        }
    },

    saveAuditLog: async function(action, detail) {
        if (!AuraState.user.uid || !dbInstance) return;
        try {
            const profile = AuraState.data.settings?.profile || {};
            const userName = profile.fullName || profile.nickname || "Anonymous User";
            const payload = { action: action, detail: AuraUtils.escapeHtml(detail), user: AuraUtils.escapeHtml(userName), ts: Date.now() };
            await push(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/audit_logs`), payload);
        } catch (e) { Logger.error('AuditLog', 'Gagal merekam log aktivitas ke Cloud.', e); }
    },
    
    saveTransaction: async function(data, isFromAI = false) { 
        this._checkAuth();
        try {
            data.user_id = AuraState.data.settings?.profile?.nickname || "User";
            data.nominal = Math.max(0, Number(data.nominal) || 0); 
            if (!data.createdAt) data.createdAt = new Date().toISOString();
            
            await push(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/transactions`), data);
            await this.saveAuditLog(isFromAI ? "AI.PARSE" : "MANUAL.ADD", `Transaksi: ${data.merchantName} (${AuraUtils.formatCurrency(data.nominal)})`);
        } catch (e) { throw e; }
    },

    updateTransaction: async function(id, data) { 
        this._checkAuth();
        if (!id) throw new Error("ID Referensi Transaksi tidak terdefinisi.");
        try {
            const pathRef = ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/transactions/${id}`);
            const snapshot = await get(pathRef);
            if (!snapshot.exists()) throw new Error("Objek transaksi ini sudah tidak ada.");
            
            data.updatedAt = new Date().toISOString();
            await update(pathRef, data);
            await this.saveAuditLog("SYS.MODIFY", `Update ID Transaksi: ${id}`);
        } catch (e) { throw e; }
    },

    moveToTrash: async function(id) { 
        this._checkAuth();
        await this.updateTransaction(id, { is_deleted: true, deletedAt: new Date().toISOString() });
        await this.saveAuditLog("SYS.TRASH", `Arsip Sampah ID: ${id}`);
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
