/**
 * Firebase Core Service & Real-Time Sync Engine
 * Dilengkapi dengan Auto-Registrar & Dynamic Learning Smart Mapper
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getDatabase, ref, push, update, remove, onValue, get 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { 
    getAuth, GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithCredential, signOut, onAuthStateChanged, deleteUser, reauthenticateWithPopup, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

import { FIREBASE_CONFIG, APP_CONFIG } from '../config/constants.js';
import { Logger } from '../core/logger.js';
import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';

let firebaseAppInstance = null;
let dbInstance = null;
let authInstance = null;
let googleAuthProviderInstance = null;
let redirectResultPromise = null;

Logger.info('Core', 'Menginisialisasi Firebase SDK Environment...');

let isInitialLoadComplete = false;
let initialDataArrived = { transactions: false, settings: false, goals: false };

const forceUIRender = () => {
    const renderers = ['renderDashboard', 'renderTransactions', 'renderAnalytics', 'renderBudgets', 'renderTrash', 'renderDebts', 'renderDebtDetail'];
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

    // Gerbang masuk: menutupi aplikasi sampai panggilan pertama pengamat
    // auth selesai, supaya dasbor tidak terlihat berkedip sebelum jendela
    // login tampil (atau sebelum sesi terkonfirmasi masuk).
    function hideAuthGate() {
        const g = document.getElementById('auth-gate');
        if (!g) return;
        g.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(function() { if (g.parentNode) g.remove(); }, 400);
    }
    setTimeout(function() {
        const m = document.getElementById('auth-gate-msg');
        if (m && document.getElementById('auth-gate')) {
            m.textContent = 'Koneksi lambat — periksa internet, lalu coba buka ulang aplikasinya.';
            m.classList.remove('animate-pulse');
        }
    }, 10000);

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
            hideAuthGate();
            
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
                    if (typeof window.renderGeminiKeysUI === 'function') window.renderGeminiKeysUI();
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
                // Dropdown dompet tagihan rutin diisi ulang di sini karena data
                // dompet bisa tiba SETELAH tampilan budget dirender (listener
                // settings jalan lebih dulu) — tanpa ini dropdown-nya kosong.
                if (typeof window.populateRecurringWalletSelect === 'function') window.populateRecurringWalletSelect();
                if (typeof window.renderRecurringUIForBudget === 'function') window.renderRecurringUIForBudget();
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

            // ====================================================================
            // 6. UTANG & PIUTANG (node 'debts'; catatan terhapus lunak disaring
            //    keluar dari daftar aktif — sisa & status diturunkan di handler)
            // ====================================================================
            const debtsRef = ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${uid}/debts`);
            const debtsUnsub = onValue(debtsRef, (snapshot) => {
                const data = snapshot.val();
                const arr = [];
                if (data) {
                    for (const key in data) {
                        const item = { id: key, ...data[key] };
                        if (!item.is_deleted) arr.push(item);
                    }
                }
                arr.sort((a, b) => new Date(b.createdAt || b.tanggal_mulai || 0) - new Date(a.createdAt || a.tanggal_mulai || 0));
                AuraState.data.debts = arr;
                smartRender();
            });
            AuraState.listeners.push(debtsUnsub);

        } else {
            AuraState.user.uid = null;
            AuraState.data.transactions = [];
            AuraState.data.settings = {};
            AuraState.data.goals = [];
            AuraState.data.debts = [];
            AuraState.data.trash = [];
            AuraState.data.wallets = {};
            AuraState.data.oracleChats = [];
            isInitialLoadComplete = false;
            if (typeof window.showModal === 'function') window.showModal('modal-login');
            hideAuthGate();
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

// Keputusan murni: bolehkah kegagalan popup Google dijatuhkan ke alur
// alih-halaman (redirect)? Hanya dua kode yang TIDAK boleh: metode masuk
// dimatikan di konsol (redirect akan gagal dengan cara yang sama) dan akun
// dinonaktifkan (persoalan akun, bukan persoalan jendela). Semua kegagalan
// lain — popup terblokir/ditutup, galat internal, domain belum terdaftar,
// bahkan galat tanpa kode — layak dicoba ulang lewat redirect. Diekspor
// terpisah agar logika pemilihnya bisa diuji harness tanpa SDK.
export function shouldFallbackToRedirect(error) {
    const code = (error && error.code) || '';
    return code !== 'auth/operation-not-allowed' && code !== 'auth/user-disabled';
}

export const FirebaseService = {
    loginWithEmail: async function(email, password) { return await signInWithEmailAndPassword(authInstance, email, password); },
    resetPassword: async function(email) { return await sendPasswordResetEmail(authInstance, email); },
    loginWithGoogle: async function() {
        // Di aplikasi Android, popup web selalu gagal ("missing initial state /
        // storage-partitioned") karena WebView tidak bisa menuntaskan alur
        // firebaseapp.com. Bila plugin autentikasi native tersedia, pakai
        // pemilih akun Google bawaan Android lalu tukar tokennya ke sesi web.
        const Cap = window.Capacitor;
        const nativeAuth = Cap && Cap.Plugins && Cap.Plugins.FirebaseAuthentication;
        const isNative = !!(Cap && typeof Cap.isNativePlatform === "function" && Cap.isNativePlatform());
        if (isNative) {
            if (!nativeAuth || typeof nativeAuth.signInWithGoogle !== "function") {
                throw new Error("Plugin login Google tidak ditemukan pada build aplikasi ini.");
            }
            let timer = null;
            try {
                const res = await Promise.race([
                    nativeAuth.signInWithGoogle(),
                    new Promise(function(_, reject) {
                        timer = setTimeout(function() { reject(new Error("Pemilih akun Google tidak merespons (waktu habis 30 detik).")); }, 30000);
                    })
                ]);
                const idToken = res && res.credential && res.credential.idToken;
                if (!idToken) throw new Error("Token Google tidak diterima dari perangkat.");
                const cred = GoogleAuthProvider.credential(idToken);
                return await signInWithCredential(authInstance, cred);
            } catch (e) {
                const msg = (e && (e.message || e.code)) ? String(e.message || e.code) : String(e);
                throw new Error("Google native: " + msg);
            } finally {
                if (timer) clearTimeout(timer);
            }
        }
        // Jalur web: popup adalah jalan utama, tetapi di peramban yang
        // menghalangi popup atau penyimpanan pihak ketiga, popup bisa gagal
        // SEKETIKA tanpa pemilih akun sempat tampil. Untuk kegagalan yang
        // lolos shouldFallbackToRedirect, jatuhkan ke alur alih-halaman
        // (redirect) yang tidak bergantung pada popup; hasilnya dipanen
        // oleh consumeRedirectResult() saat halaman kembali termuat, dan
        // observer auth memperlakukannya seperti login popup yang sukses.
        try {
            return await signInWithPopup(authInstance, googleAuthProviderInstance);
        } catch (popupError) {
            if (!shouldFallbackToRedirect(popupError)) throw popupError;
            Logger.warn('Core', 'Login Google via popup gagal; menjatuhkan ke alur alih-halaman.', popupError);
            return await signInWithRedirect(authInstance, googleAuthProviderInstance);
        }
    },

    // Panen hasil alur alih-halaman Google. Dipanggil sekali oleh handler
    // auth saat halaman termuat — termasuk muatan biasa tanpa redirect
    // (getRedirectResult menjawab null dan tidak terjadi apa-apa). Promise
    // di-cache supaya panggilan berulang tidak memanen dua kali. Tidak
    // pernah melempar: hasil selalu { user } atau { error }.
    consumeRedirectResult: function() {
        if (!redirectResultPromise) {
            redirectResultPromise = (async () => {
                try {
                    const result = await getRedirectResult(authInstance);
                    return { user: (result && result.user) || null };
                } catch (error) {
                    return { error };
                }
            })();
        }
        return redirectResultPromise;
    },
    logout: async function() { return await signOut(authInstance); },

    // Metode masuk utama pengguna saat ini ('google.com', 'password', ...)
    getCurrentProvider: function() {
        if (!authInstance || !authInstance.currentUser) return '';
        const p = authInstance.currentUser.providerData || [];
        return (p[0] && p[0].providerId) || '';
    },

    // Hapus akun & seluruh data pengguna (Kebijakan Privasi + syarat Google Play):
    // sesi disegarkan dulu untuk akun Google, lalu subpohon data milik pengguna
    // dihapus dari basis data, terakhir akun Firebase Auth-nya sendiri.
    // Bila penghapusan akun tertahan syarat masuk-baru saja (sesi lama, akun
    // email), data sudah terhapus dan galat 'PERLU_MASUK_ULANG' dilempar agar
    // antarmuka dapat meminta pengguna masuk lagi lalu mengulangi langkah ini.
    deleteAccountAndData: async function() {
        this._checkAuth();
        const user = authInstance.currentUser;
        const uid = AuraState.user.uid;
        const providerId = this.getCurrentProvider();
        if (providerId === 'google.com') {
            await reauthenticateWithPopup(user, googleAuthProviderInstance);
        }
        await remove(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${uid}`));
        try {
            await deleteUser(user);
        } catch (e) {
            if (e && e.code === 'auth/requires-recent-login') throw new Error('PERLU_MASUK_ULANG');
            throw e;
        }
    },

    _checkAuth: function() {
        if (!authInstance || !authInstance.currentUser || !AuraState.user.uid) throw new Error("Sesi pengguna tidak valid.");
    },

    // Kode Koneksi Muse: kredensial milik pengguna yang sedang masuk —
    // token penyegar Firebase Auth-nya sendiri, dibungkus bersama konfigurasi
    // publik aplikasi. Muse milik pengguna menukar token penyegar ini
    // menjadi token akses jangka pendek dan hanya menyentuh subpohon
    // aurafi_ledger/<uid pengguna itu>. Bukan kunci basis data proyek.
    // Versi koneksi AI akun ini (kontrak cabut akses): tersimpan di
    // settings/aiConnection.version, bawaan 0. Kode koneksi menyematkan versi
    // saat dibuat sebagai aiVersion; server MCP menolak kode yang versinya
    // lebih rendah dari versi tersimpan.
    getAiConnectionVersion: function() {
        const v = parseInt(AuraState?.data?.settings?.aiConnection?.version, 10);
        return Number.isFinite(v) && v > 0 ? v : 0;
    },

    getConnectionCode: function() {
        if (!authInstance || !authInstance.currentUser) throw new Error("Sesi pengguna tidak valid.");
        const u = authInstance.currentUser;
        const payload = {
            app: "AuraFi", version: 1,
            apiKey: FIREBASE_CONFIG.apiKey,
            databaseURL: FIREBASE_CONFIG.databaseURL,
            uid: u.uid,
            refreshToken: u.refreshToken,
            aiVersion: this.getAiConnectionVersion(),
        };
        return "AURAFI1:" + btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    },

    // Cabut Akses AI: naikkan versi koneksi + catat waktu cabut di
    // settings/aiConnection. Semua kode berversi lebih rendah yang sudah
    // beredar langsung ditolak server. Kode baru yang dibuat setelah ini
    // memakai versi baru, jadi pengguna bisa tersambung lagi kapan pun.
    revokeAiAccess: async function() {
        this._checkAuth();
        const uid = AuraState.user.uid;
        const now = new Date().toISOString();
        const next = {
            version: this.getAiConnectionVersion() + 1,
            updatedAt: now,
            revokedAt: now,
        };
        await update(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${uid}/settings/aiConnection`), next);
        if (!AuraState.data.settings) AuraState.data.settings = {};
        AuraState.data.settings.aiConnection = next;
        return next.version;
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
            
            const pStyle = (window.CategoryManager && window.CategoryManager.resolveStyle) ? window.CategoryManager.resolveStyle(targetParent) : null;
            const icon = (pStyle && pStyle.icon) ? pStyle.icon : 'fa-layer-group';
            const color = (pStyle && pStyle.hex) ? pStyle.hex : '#818cf8';
            
            rawCats[pId] = { name: targetParent, type: type, icon: icon, color: color, parentId: null };
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
                        const cStyle = (window.CategoryManager && window.CategoryManager.resolveStyle) ? window.CategoryManager.resolveStyle(cName) : null;
                        rawCats[cId] = { name: cName, type: type, icon: (cStyle && cStyle.icon) ? cStyle.icon : 'fa-tag', color: (cStyle && cStyle.hex) ? cStyle.hex : rawCats[pId].color, parentId: pId };
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
        // Kelompok item (Pribadi / Kewajiban Terpisah / Pemasukan) diisi otomatis
        // dari kategori bila belum ditetapkan — jaring pengaman untuk semua
        // jalur simpan (manual, AI, tagihan otomatis, impor).
        if (Array.isArray(data.items) && typeof window.inferKelompokItem === 'function') {
            data.items = data.items.map(it => (it && !it.kelompok) ? { ...it, kelompok: window.inferKelompokItem(it.kategori_barang, data.tipe) } : it);
        }

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

    // ========================================================================
    // UTANG & PIUTANG — semua penulisan yang menyentuh catatan + transaksi
    // dompet pendamping dilakukan dalam SATU update() multi-path atomik
    // (pola executeAtomicTransfer): catatan dan arus dompetnya tidak pernah
    // tersimpan setengah-setengah. Id catatan & transaksi dibuat pemanggil
    // (AuraUtils.generateId) agar keduanya bisa saling menautkan.
    // ========================================================================

    saveDebt: async function(debtData, trxData) {
        this._checkAuth();
        if (!debtData || !debtData.id) throw new Error("Catatan utang/piutang wajib punya id.");

        const updates = {};
        updates[`debts/${debtData.id}`] = debtData;
        if (trxData) {
            if (!trxData.id) throw new Error("Transaksi pendamping wajib punya id.");
            trxData.user_id = AuraState.data.settings?.profile?.nickname || "User";
            trxData.nominal = Math.max(0, Number(trxData.nominal) || 0);
            if (!trxData.createdAt) trxData.createdAt = new Date().toISOString();
            updates[`transactions/${trxData.id}`] = trxData;
        }

        await update(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}`), updates);
        await this.saveAuditLog("DEBT.ADD", `Catatan utang/piutang: ${debtData.pihak || '-'} (${AuraUtils.formatCurrency(debtData.jumlah || 0)})`);
        forceUIRender();
    },

    addDebtPayment: async function(debtId, payments, trxData) {
        this._checkAuth();
        if (!debtId) throw new Error("ID catatan utang/piutang tidak terdefinisi.");

        const nowIso = new Date().toISOString();
        const updates = {};
        updates[`debts/${debtId}/pembayaran`] = payments;
        updates[`debts/${debtId}/updatedAt`] = nowIso;
        if (trxData) {
            if (!trxData.id) throw new Error("Transaksi pendamping wajib punya id.");
            trxData.user_id = AuraState.data.settings?.profile?.nickname || "User";
            trxData.nominal = Math.max(0, Number(trxData.nominal) || 0);
            if (!trxData.createdAt) trxData.createdAt = nowIso;
            updates[`transactions/${trxData.id}`] = trxData;
        }

        await update(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}`), updates);
        await this.saveAuditLog("DEBT.PAY", `Pembayaran utang/piutang pada catatan ID: ${debtId}`);
        forceUIRender();
    },

    removeDebtPayment: async function(debtId, payments, trxId) {
        this._checkAuth();
        if (!debtId) throw new Error("ID catatan utang/piutang tidak terdefinisi.");

        const nowIso = new Date().toISOString();
        const updates = {};
        updates[`debts/${debtId}/pembayaran`] = payments;
        updates[`debts/${debtId}/updatedAt`] = nowIso;
        if (trxId) {
            updates[`transactions/${trxId}/is_deleted`] = true;
            updates[`transactions/${trxId}/deletedAt`] = nowIso;
        }

        await update(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}`), updates);
        await this.saveAuditLog("DEBT.PAYDEL", `Pembayaran dihapus pada catatan ID: ${debtId}`);
        forceUIRender();
    },

    trashDebt: async function(debtId, trxIds) {
        this._checkAuth();
        if (!debtId) throw new Error("ID catatan utang/piutang tidak terdefinisi.");

        const nowIso = new Date().toISOString();
        const updates = {};
        updates[`debts/${debtId}/is_deleted`] = true;
        updates[`debts/${debtId}/deletedAt`] = nowIso;
        updates[`debts/${debtId}/updatedAt`] = nowIso;
        (trxIds || []).forEach(function(tid) {
            if (!tid) return;
            updates[`transactions/${tid}/is_deleted`] = true;
            updates[`transactions/${tid}/deletedAt`] = nowIso;
        });

        await update(ref(dbInstance, `${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}`), updates);
        await this.saveAuditLog("DEBT.DELETE", `Catatan utang/piutang diarsipkan ID: ${debtId}`);
        forceUIRender();
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
