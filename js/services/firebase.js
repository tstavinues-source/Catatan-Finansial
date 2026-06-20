/**
 * Firebase Core Service & Audit Logging Module
 * Mengelola koneksi database realtime, status sinkronisasi, dan operasi CRUD.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getDatabase, 
    ref, 
    push, 
    update, 
    remove, 
    onValue, 
    get 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

import { FIREBASE_CONFIG, APP_CONFIG } from '../config/constants.js';
import { Logger } from '../core/logger.js';
import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';

// Module-scoped instances
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
    
    // Simpan instance ke dalam State Global untuk diakses modul lain secara internal
    AuraState.instances.firebaseApp = firebaseAppInstance;
    AuraState.instances.db = dbInstance;
    AuraState.instances.auth = authInstance; // <--- PERBAIKAN SINKRONISASI GERBANG AUTH
    
    Logger.success('Core', 'Firebase SDK Environment & Instance Auth Berhasil Tersinkronisasi.');
} catch (e) {
    Logger.error('Core', 'Gagal menginisialisasi koneksi Firebase:', e);
}

// ============================================================================
// SERVICE EXPORTS & BUSINESS LOGIC IMPLEMENTATION
// ============================================================================
export const FirebaseService = {
    
    _checkAuth: function() {
        if (!AuraState.user.uid) {
            throw new Error("Protokol Keamanan: Sesi tidak terautentikasi untuk melakukan mutasi data Cloud.");
        }
    },

    saveAuditLog: async function(action, detail) {
        if (!dbInstance || !AuraState.user.uid) return;
        try {
            const nickname = AuraState.data.settings?.profile?.nickname || "System User";
            await push(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/auditLogs`), {
                action: action,
                detail: detail,
                ts: new Date().getTime(),
                user: nickname
            });
        } catch (e) {
            console.error("Gagal mencatat log audit ke sistem cloud:", e);
        }
    },

    saveTransaction: async function(trxData) {
        this._checkAuth();
        const cleanData = {
            ...trxData,
            createdAt: new Date().toISOString(),
            is_deleted: false
        };
        const newRef = await push(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/transactions`), cleanData);
        await this.saveAuditLog("TRX.INSERT", `Menambahkan catatan transaksi baru pada merchant: ${trxData.merchant || 'Manual Input'}`);
        return newRef.key;
    },

    updateTransaction: async function(id, data) {
        this._checkAuth();
        const updatedData = {
            ...data,
            updatedAt: new Date().toISOString()
        };
        await update(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/transactions/${id}`), updatedData);
        await this.saveAuditLog("TRX.UPDATE", `Mengubah entri data pada transaksi ID: ${id}`);
    },

    moveToTrash: async function(id) {
        this._checkAuth();
        await update(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/transactions/${id}`), {
            is_deleted: true,
            deletedAt: new Date().toISOString()
        });
        await this.saveAuditLog("TRX.TRASH", `Memindahkan transaksi ID: ${id} ke dalam folder sampah`);
    },

    deleteTransactionPermanently: async function(id) {
        this._checkAuth();
        await remove(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/transactions/${id}`));
        await this.saveAuditLog("TRX.HARD_DELETE", `Menghapus permanen data riwayat transaksi ID: ${id}`);
    },

    saveGoal: async function(goalData) {
        this._checkAuth();
        const cleanGoal = {
            ...goalData,
            createdAt: new Date().toISOString(),
            currentAmount: 0
        };
        await push(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/goals`), cleanGoal);
        await this.saveAuditLog("GOAL.INSERT", `Membuat misi target finansial baru: ${goalData.name}`);
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
        await this.saveAuditLog("SETTINGS.UPDATE", "Memperbarui konfigurasi preferensi pengguna di cloud.");
    },

    saveGroqKey: async function(encryptedKey) { 
        this._checkAuth();
        await push(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/groqApiKeys`), { 
            encryptedKey: encryptedKey, 
            createdAt: new Date().toISOString(), 
            active: true, 
            usageCount: 0 
        });
        await this.saveAuditLog("APIKEY.SAVE", "Menyimpan konfigurasi token enkripsi API Groq baru.");
    },

    deleteGroqKey: async function(keyId) { 
        this._checkAuth();
        await remove(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/groqApiKeys/${keyId}`));
        await this.saveAuditLog("APIKEY.DELETE", `Menghapus konfigurasi token API Groq ID: ${keyId}`);
    },

    pushOracleChat: async function(chatObj) { 
        if (!AuraState.user.uid || !dbInstance) return;
        try {
            await push(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/oracleChats`), {
                ...chatObj,
                timestamp: new Date().getTime()
            });
        } catch (e) {
            console.error("Gagal mengarsipkan log interaksi AI Oracle:", e);
        }
    }
};

// Ekspos ke window layer demi kompatibilitas modul legacy/inline HTML handler
window.FirebaseService = FirebaseService;
