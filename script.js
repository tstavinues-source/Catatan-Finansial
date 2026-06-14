import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, update, remove, onValue, get } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { 
    getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, 
    signInWithEmailAndPassword, signInAnonymously, onAuthStateChanged, 
    signOut, setPersistence, browserLocalPersistence 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDuGNM793lZOUJEX_LAEaxCipFOw6TT35E",
    authDomain: "agrivision-574be.firebaseapp.com",
    databaseURL: "https://agrivision-574be-default-rtdb.firebaseio.com",
    projectId: "agrivision-574be",
    storageBucket: "agrivision-574be.firebasestorage.app",
    messagingSenderId: "732120986243",
    appId: "1:732120986243:web:d025c9a2908b1ca892a1b6"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const ledgerNode = 'aurafi_ledger'; 

window.currentUserUid = null;
localStorage.removeItem('aurafi_device_id'); 

// Helper: Generate Unique UUID-like String for Item ID
window.generateItemId = function() {
    return 'itm_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
};

// Helper: Sanitasi Item agar Selalu Memiliki Atribut Lengkap & Aman
// Diperbarui: Normalisasi format name, category, price, tax, qty, subtotal ke format Firebase
window.sanitizeItems = function(items, defaultPayment, timestamp) {
    return (items || []).map(item => {
        const priceVal = Number(item.harga !== undefined ? item.harga : (item.price || 0));
        const qtyVal = Number(item.qty !== undefined ? item.qty : 1);
        const calcSubtotal = Number(item.subtotal !== undefined ? item.subtotal : (priceVal * qtyVal));
        
        return {
            itemId: item.itemId || window.generateItemId(),
            nama_barang: item.nama_barang || item.name || "Item Unik",
            harga: priceVal,
            qty: qtyVal,
            subtotal: calcSubtotal,
            kategori_barang: item.kategori_barang || item.category || "Lainnya",
            tax_rate: Number(item.tax_rate !== undefined ? item.tax_rate : (item.tax || 0)),
            paymentMethod: item.paymentMethod || defaultPayment || "cashless",
            timestamp: item.timestamp || timestamp || new Date().toISOString()
        };
    });
};

// Helper: Builder Prompt Dinamis AI Berdasarkan Preferensi User
window.getOraclePromptConfigs = function() {
    const prefs = window.settingsData?.aiPreferences || {
        persona: 'Kombinasi Humble + Jenius + Profesional',
        style: 'Normal'
    };
    
    let personaStr = "kombinasi humble, jenius, dan profesional";
    if (prefs.persona === "Humble Profesional") personaStr = "humble dan profesional";
    else if (prefs.persona === "Santai dan Asyik") personaStr = "santai, asyik, dan ramah";
    else if (prefs.persona === "Sarkas Cerdas") personaStr = "cerdas dengan sedikit sarkas elegan";
    else if (prefs.persona === "Mentor Keuangan") personaStr = "seperti mentor keuangan yang tegas dan bijak";
    else if (prefs.persona === "Formal") personaStr = "sangat formal, baku, dan analitis";
    else if (prefs.persona === "Lucu") personaStr = "lucu, humoris, dan menghibur";

    let styleStr = "Jawab dengan panjang normal (sekitar 3-8 kalimat).";
    if (prefs.style === "Singkat") styleStr = "Jawab SINGKAT, padat, dan jelas. Maksimal 2 paragraf saja.";
    else if (prefs.style === "Detail") styleStr = "Jawab dengan SANGAT DETAIL, komprehensif, dan panjang lebar. Lengkapi dengan poin-poin.";

    return { personaStr, styleStr };
};

// ==========================================
// AUTHENTICATION LOGIC (PERSISTENT & MULTI-METHOD)
// ==========================================
window.loginWithGoogle = async function() {
    try {
        await setPersistence(auth, browserLocalPersistence);
        await signInWithPopup(auth, provider).catch(async (e) => {
            console.warn("Popup blocked/failed, trying redirect", e);
            await signInWithRedirect(auth, provider);
        });
    } catch (error) {
        console.error("Login failed", error);
        window.showToast("Login gagal atau dibatalkan.", true);
    }
};

window.loginWithEmail = async function() {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    if(!email || !pass) return window.showToast("Harap isi email & password!", true);
    try {
        await setPersistence(auth, browserLocalPersistence);
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        window.showToast("Login gagal: " + error.message, true);
    }
};

window.loginAnonymously = async function() {
    try {
        await setPersistence(auth, browserLocalPersistence);
        await signInAnonymously(auth);
    } catch (error) {
        window.showToast("Mode Tamu Gagal: " + error.message, true);
    }
};

window.logoutAccount = async function() {
    await signOut(auth);
    window.oracleChats = [];
    window.allTransactions = [];
    window.trashTransactions = [];
    window.location.reload();
};

// ==========================================
// 1. SERVICES / ENCRYPTION_SERVICE
// ==========================================
window.EncryptionService = {
    encryptApiKey(apiKey, secretKey) {
        if(!secretKey) return null;
        return CryptoJS.AES.encrypt(apiKey, secretKey).toString();
    },
    decryptApiKey(cipherText, secretKey) {
        try {
            const bytes = CryptoJS.AES.decrypt(cipherText, secretKey);
            const decrypted = bytes.toString(CryptoJS.enc.Utf8);
            return decrypted || null;
        } catch(e) { return null; }
    },
    validate(apiKey, secretKey) {
        const encrypted = this.encryptApiKey(apiKey, secretKey);
        const decrypted = this.decryptApiKey(encrypted, secretKey);
        return decrypted === apiKey;
    }
};

// ==========================================
// 2. SERVICES / FIREBASE_SERVICE (Incremental & Safe Merging)
// ==========================================
window.FirebaseService = {
    async saveTransaction(data) { 
        await push(ref(db, `${ledgerNode}/${window.currentUserUid}/transactions`), data);
    },
    async updateTransaction(id, data) { 
        await update(ref(db, `${ledgerNode}/${window.currentUserUid}/transactions/${id}`), data);
    },
    async moveToTrash(id) { 
        await update(ref(db, `${ledgerNode}/${window.currentUserUid}/transactions/${id}`), { is_deleted: true, deletedAt: new Date().toISOString() });
    },
    async deleteTransactionPermanently(id) { 
        await remove(ref(db, `${ledgerNode}/${window.currentUserUid}/transactions/${id}`));
    },
    async saveGoal(data) { 
        await push(ref(db, `${ledgerNode}/${window.currentUserUid}/goals`), data);
    },
    async deleteGoal(id) { 
        await remove(ref(db, `${ledgerNode}/${window.currentUserUid}/goals/${id}`));
    },
    async updateSettings(data) { 
        await update(ref(db, `${ledgerNode}/${window.currentUserUid}/settings`), data);
    },
    async saveGroqKey(encryptedKey) {
        await push(ref(db, `${ledgerNode}/${window.currentUserUid}/groqApiKeys`), {
            encryptedKey: encryptedKey, createdAt: new Date().toISOString(), active: true, usageCount: 0
        });
    },
    async deleteGroqKey(keyId) { 
        await remove(ref(db, `${ledgerNode}/${window.currentUserUid}/groqApiKeys/${keyId}`));
    },
    async pushOracleChat(chatObj) { 
        await push(ref(db, `${ledgerNode}/${window.currentUserUid}/oracleChats`), chatObj); 
    },
    async deleteOracleChat(id) { 
        await remove(ref(db, `${ledgerNode}/${window.currentUserUid}/oracleChats/${id}`)); 
    }
};

// ==========================================
// 3. SERVICES / MEMORY RETRIEVAL (MENGHEMAT TOKEN)
// ==========================================
window.MemoryService = {
    getRelevantTransactions(query) {
        if (!window.allTransactions || window.allTransactions.length === 0) return [];
        const keyword = (query || "").toLowerCase().trim();
        
        let matched = window.allTransactions.filter(t => {
            const matchCategory = (t.kategori || "").toLowerCase().includes(keyword);
            const matchStore = (t.merchantName || t.storeName || "").toLowerCase().includes(keyword);
            const matchDesc = (t.description || t.catatan_ai || "").toLowerCase().includes(keyword);
            const matchItems = t.items && t.items.some(it => (it.nama_barang || "").toLowerCase().includes(keyword));
            return matchCategory || matchStore || matchItems || matchDesc;
        });

        if (matched.length > 0) {
            return matched.slice(0, 5);
        } else {
            return window.allTransactions.slice(0, 5);
        }
    },
    getRelevantChats() {
        return window.oracleChats ? window.oracleChats.slice(-8) : [];
    }
};

// ==========================================
// 4. FINANCIAL SUMMARY SERVICE
// ==========================================
window.FinancialSummaryService = {
    getSummaryString() {
        let cashBal = 0, cashlessBal = 0, totSpent = 0;
        const today = new Date();
        
        const txList = window.allTransactions || [];
        txList.forEach(t => {
            const val = Number(t.nominal || 0);
            const isCash = t.metode_pembayaran === 'tunai';
            
            if (t.tipe === 'pemasukan') {
                if (isCash) cashBal += val; else cashlessBal += val;
            } else if (t.tipe === 'tarik_tunai') {
                let adminFee = Number(t.admin_fee || 0);
                cashBal += val;
                cashlessBal -= (val + adminFee);
            } else if (t.tipe === 'setor_tunai') {
                let adminFee = Number(t.admin_fee || 0);
                cashBal -= val; 
                cashlessBal += val; 
                cashlessBal -= adminFee; 
            } else {
                if (isCash) cashBal -= val; 
                else cashlessBal -= val;
                if (new Date(t.tanggal).getMonth() === today.getMonth() && new Date(t.tanggal).getFullYear() === today.getFullYear()) {
                    totSpent += val;
                }
            }
        });

        const profile = window.settingsData?.profile || {};
        const nickname = profile.nickname || "User";
        const fullName = profile.fullName || "User AuraFi";

        return `--- PROFIL & RINGKASAN PENGGUNA ---
Nama: ${fullName} (${nickname})
Mata Uang Utama Aktif: ${window.displayCurrency}
Sisa Tunai (Cash): ${cashBal} ${window.displayCurrency}
Sisa Cashless: ${cashlessBal} ${window.displayCurrency}
Total Aset Net Worth: ${cashBal + cashlessBal} ${window.displayCurrency}
Pengeluaran Bulan Ini: ${totSpent} ${window.displayCurrency}
Sisa Limit Anggaran Bulanan: ${window.monthlyBudget - totSpent} ${window.displayCurrency}`;
    }
};

// ==========================================
// 5. SERVICES / GROQ_SERVICE (HANYA UNTUK TEKS/NLP)
// ==========================================
let groqSecretKey = localStorage.getItem('aurafi_groq_secret');
if(!groqSecretKey) {
    groqSecretKey = CryptoJS.lib.WordArray.random(128/8).toString();
    localStorage.setItem('aurafi_groq_secret', groqSecretKey);
}

window.GroqService = {
    keysPool: [],
    currentIndex: 0,
    model: "llama-3.3-70b-versatile", 
    secret: groqSecretKey,

    init(rawKeysArray) {
        this.keysPool = [];
        for(let item of rawKeysArray) {
            if(item.active) {
                const decrypted = window.EncryptionService.decryptApiKey(item.encryptedKey, this.secret);
                if(decrypted && decrypted.startsWith('gsk_')) {
                    this.keysPool.push({ id: item.id, value: decrypted });
                }
            }
        }
        this.currentIndex = 0;
        return this.keysPool.length;
    },

    getCurrentApiKey() {
        if(this.keysPool.length === 0) return null;
        return this.keysPool[this.currentIndex].value;
    },

    switchToNextApiKey() {
        if(this.keysPool.length <= 1) return false;
        this.currentIndex = (this.currentIndex + 1) % this.keysPool.length;
        console.log(`[GROQ FAILOVER] Rotasi Kunci ke Index: ${this.currentIndex}`);
        return true;
    },

    async fetch(messages, requireJson = false) {
        if(this.keysPool.length === 0) throw new Error("API Key Groq Kosong.");
        
        let attempt = 0;
        const totalKeys = this.keysPool.length;

        while (attempt < totalKeys) {
            const apiKey = this.getCurrentApiKey();
            try {
                const payload = { model: this.model, messages: messages, temperature: requireJson ? 0.1 : 0.7 };
                if(requireJson) payload.response_format = { type: "json_object" };

                const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if(response.status === 429 || response.status === 400 || response.status === 401 || response.status === 503) {
                    console.warn(`[GROQ] HTTP ${response.status}. Limit Exceeded. Merotasi Kunci...`);
                    this.switchToNextApiKey(); attempt++; continue;
                }
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error?.message || "Groq Error");
                }

                const data = await response.json();
                return data.choices[0].message.content;
            } catch (err) {
                console.error("[GROQ ERROR]", err.message);
                this.switchToNextApiKey(); attempt++;
            }
        }
        throw new Error("Semua API Key Groq gagal.");
    }
};

// ==========================================
// 6. SERVICES / GEMINI_SERVICE (OCR & FALLBACK ENGINE)
// ==========================================
window.GeminiFailoverEngine = class GeminiFailoverEngine {
    constructor(pinCode) { this.pin = pinCode; this.keysPool = []; this.currentIndex = 0; }

    async init() {
        this.keysPool = [];
        const snapshot = await get(ref(db, 'nexus_api_vault'));
        
        if (snapshot.exists()) {
            const vaultData = snapshot.val();
            for (const id in vaultData) {
                const item = vaultData[id];
                let decrypted = window.EncryptionService.decryptApiKey(item.value, this.pin);
                if (!decrypted) {
                    try {
                        let text = atob(item.value);
                        let result = '';
                        for (let i = 0; i < text.length; i++) { result += String.fromCharCode(text.charCodeAt(i) ^ this.pin.charCodeAt(i % this.pin.length)); }
                        decrypted = result;
                    } catch(e) {}
                }
                if (decrypted && (decrypted.startsWith('AIza') || decrypted.startsWith('AQ.'))) {
                    this.keysPool.push({ id: item.name, value: decrypted.trim() });
                }
            }
        }
        return this.keysPool.length;
    }

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

            try {
                const response = await fetch(url, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestPayload)
                });

                if (response.status === 429 || response.status === 400 || response.status === 401) {
                    this.currentIndex = (this.currentIndex + 1) % this.keysPool.length;
                    attempt++; continue; 
                }
                if (!response.ok) throw new Error(`HTTP Status ${response.status}`);

                const result = await response.json();
                const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!textResponse) throw new Error("Format respons API tidak sesuai");
                return textResponse;
            } catch (err) {
                this.currentIndex = (this.currentIndex + 1) % this.keysPool.length;
                attempt++;
            }
        }
        throw new Error("SEMUA KUNCI GEMINI TERKENA LIMIT!");
    }
};

// ==========================================
// INIT DATABASE LISTENER REALTIME (TERIKAT PADA AUTH)
// ==========================================
function loadRealtimeDatabaseData() {
    if (!window.currentUserUid) return;

    onValue(ref(db, `${ledgerNode}/${window.currentUserUid}/transactions`), (snapshot) => {
        const all = [];
        const data = snapshot.val();
        if (data) {
            Object.entries(data).forEach(([key, val]) => {
                // SINKRONISASI & PERBAIKAN ITEM ID BUG - Assign secara dinamis agar UI Edit Item aman
                if (val.items && Array.isArray(val.items)) {
                    val.items = val.items.map(it => ({ ...it, itemId: it.itemId || window.generateItemId() }));
                }
                all.push({ id: key, ...val });
            });
        }
        
        window.allTransactions = all.filter(t => !t.is_deleted).sort((a,b) => new Date(b.createdAt || b.tanggal) - new Date(a.createdAt || a.tanggal));
        window.trashTransactions = all.filter(t => t.is_deleted).sort((a,b) => new Date(b.deletedAt) - new Date(a.deletedAt));
        
        window.checkAndExecuteRecurringPayments();

        if(window.reCalculateAll) window.reCalculateAll();
    });

    onValue(ref(db, `${ledgerNode}/${window.currentUserUid}/goals`), (snapshot) => {
        const goals = [];
        const data = snapshot.val();
        if (data) Object.entries(data).forEach(([key, val]) => goals.push({ id: key, ...val }));
        window.allGoals = goals;
        if(window.reCalculateAll) window.reCalculateAll();
    });

    onValue(ref(db, `${ledgerNode}/${window.currentUserUid}/settings`), (snapshot) => {
        const d = snapshot.val();
        window.settingsData = d || {};
        if (d) {
            if(d.monthlyBudget && d.monthlyBudget.limit) {
                window.monthlyBudget = d.monthlyBudget.limit;
            }
            if(d.theme && d.theme !== window.currentTheme) {
                window.currentTheme = d.theme;
                if(window.applyTheme) window.applyTheme();
            }
            if(d.profile) {
                const elFullName = document.getElementById('user-fullname');
                const elNickName = document.getElementById('user-nickname');
                if (elFullName) elFullName.value = d.profile.fullName || '';
                if (elNickName) elNickName.value = d.profile.nickname || '';
            }
            
            if (d.aiPreferences) {
                const elC = document.getElementById('setting-ai-chat'); if(elC) elC.value = d.aiPreferences.modelChat;
                const elV = document.getElementById('setting-ai-vision'); if(elV) elV.value = d.aiPreferences.modelVision;
                const elP = document.getElementById('setting-ai-persona'); if(elP) elP.value = d.aiPreferences.persona;
                const elS = document.getElementById('setting-ai-style'); if(elS) elS.value = d.aiPreferences.style;
            }
            window.renderRecurringUI();
        }
        if(window.reCalculateAll) window.reCalculateAll();
    });

    onValue(ref(db, `${ledgerNode}/${window.currentUserUid}/groqApiKeys`), (snapshot) => {
        window.rawGroqKeysData = [];
        const data = snapshot.val();
        if (data) {
            Object.entries(data).forEach(([key, val]) => window.rawGroqKeysData.push({ id: key, ...val }));
        }
        const activeCount = window.GroqService.init(window.rawGroqKeysData);
        
        const grBadge = document.getElementById('groq-status-badge');
        
        if(grBadge) {
            if(activeCount > 0) {
                grBadge.className = "text-[9px] bg-emerald-950/40 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded uppercase tracking-[0.1em] font-mono";
                grBadge.innerText = `ACTIVE (${activeCount})`;
            } else {
                grBadge.className = "text-[9px] bg-red-950/40 text-rose-400 border border-red-900/50 px-2 py-0.5 rounded uppercase tracking-[0.1em] font-mono";
                grBadge.innerText = "OFFLINE";
            }
        }
        if(window.renderGroqKeysUI) window.renderGroqKeysUI();
    });

    onValue(ref(db, `${ledgerNode}/${window.currentUserUid}/oracleChats`), (snapshot) => {
        const chats = [];
        const data = snapshot.val();
        if (data) {
            Object.entries(data).forEach(([key, val]) => chats.push({ id: key, ...val }));
            chats.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
        }
        
        const nickname = window.settingsData?.profile?.nickname || "Bos";
        if(chats.length === 0) {
            window.oracleChats = [{id: 'init', role: 'ai', text: `Halo ${nickname}! Aku Aura Oracle V3. Aku siap jadi penasihat keuangan handalmu. Mau ngobrol hari ini? 😎`, timestamp: new Date().toISOString()}];
        } else {
            window.oracleChats = chats;
        }
        if(window.renderOracleChats) window.renderOracleChats();
    });
}

// ==========================================
// AUTH STATE LISTENER (PERSISTENSI LOGIN)
// ==========================================
onAuthStateChanged(auth, (user) => {
    const modalLogin = document.getElementById('modal-login');
    if (user) {
        window.currentUserUid = user.uid;
        if(modalLogin) modalLogin.classList.add('hidden');
        
        loadRealtimeDatabaseData();

        const savedGeminiPin = localStorage.getItem('aurafi_gemini_pin');
        if (savedGeminiPin && window.syncGeminiEngine) {
            setTimeout(() => window.syncGeminiEngine(true), 800); 
        }

    } else {
        window.currentUserUid = null;
        if(modalLogin) modalLogin.classList.remove('hidden');
    }
});

// ==========================================
// UI & CONFIG SETTINGS FOR AI & RECURRING
// ==========================================
window.saveUserProfile = async function() {
    const fn = document.getElementById('user-fullname').value.trim();
    const nn = document.getElementById('user-nickname').value.trim();
    if(!fn || !nn) return window.showToast("Lengkapi form nama profil!", true);

    try {
        await window.FirebaseService.updateSettings({
            profile: { fullName: fn, nickname: nn }
        });
        window.showToast("Profil pengguna berhasil disimpan!");
    } catch(e) {
        window.showToast("Gagal menyimpan profil: " + e.message, true);
    }
};

window.saveAIPreferences = async function() {
    const chatM = document.getElementById('setting-ai-chat').value;
    const visM = document.getElementById('setting-ai-vision').value;
    const pers = document.getElementById('setting-ai-persona').value;
    const style = document.getElementById('setting-ai-style').value;
    
    try {
        await window.FirebaseService.updateSettings({
            aiPreferences: { modelChat: chatM, modelVision: visM, persona: pers, style: style }
        });
        window.showToast("Setelan Oracle AI berhasil disimpan!");
    } catch(e) { 
        window.showToast("Gagal menyimpan setelan AI.", true); 
    }
};

window.addRecurringPayment = async function() {
    const name = document.getElementById('new-rec-name').value.trim();
    const amount = parseFloat(document.getElementById('new-rec-amt').value);
    const date = parseInt(document.getElementById('new-rec-date').value);
    const method = document.getElementById('new-rec-method').value;

    if(!name || isNaN(amount) || isNaN(date) || date < 1 || date > 31) {
        return window.showToast("Lengkapi form tagihan dengan benar (Tanggal 1-31)!", true);
    }

    const recId = 'rec_' + Date.now();
    const updates = {};
    updates[`recurringPayments/${recId}`] = {
        name, amount, date, method, active: true
    };

    try {
        await window.FirebaseService.updateSettings(updates);
        document.getElementById('new-rec-name').value = "";
        document.getElementById('new-rec-amt').value = "";
        document.getElementById('new-rec-date').value = "";
        window.showToast("Tagihan bulanan berhasil dikonfigurasi!");
    } catch(e) {
        window.showToast("Gagal menambahkan tagihan: " + e.message, true);
    }
};

window.removeRecurringPayment = async function(recId) {
    if(confirm("Hapus tagihan bulanan ini?")) {
        const dbRef = ref(db, `${ledgerNode}/${window.currentUserUid}/settings/recurringPayments/${recId}`);
        await remove(dbRef);
        window.showToast("Tagihan bulanan berhasil dihapus!");
    }
};

window.renderRecurringUI = function() {
    // 1. Settings Tab Recurring
    const container = document.getElementById('recurring-list');
    const rPayments = window.settingsData?.recurringPayments || {};
    const entries = Object.entries(rPayments);

    if(container) {
        if(entries.length === 0) {
            container.innerHTML = '<p class="text-[10px] text-[var(--text-muted)] text-center my-2">Belum ada tagihan rutin bulanan.</p>';
        } else {
            container.innerHTML = entries.map(([id, rp]) => {
                return `<div class="flex justify-between items-center bg-[var(--bg-base)] p-2 rounded-xl border border-[var(--border-glass)]">
                    <div class="flex flex-col">
                        <span class="font-bold text-xs text-sky-400">${rp.name}</span>
                        <span class="text-[9px] text-[var(--text-muted)] font-mono">Tgl ${rp.date} | ${rp.amount.toLocaleString()} JPY (${rp.method})</span>
                    </div>
                    <button onclick="window.removeRecurringPayment('${id}')" class="text-rose-500 p-1 hover:text-rose-400 transition active:scale-90">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                </div>`;
            }).join('');
        }
    }

    // 2. Budget Tab Recurring (Budgets V3)
    const budList = document.getElementById('budget-bills-container');
    if(budList) {
        budList.innerHTML = entries.length === 0 ? '<p class="text-[10px] text-[var(--text-muted)] text-center my-3">Belum ada tagihan otomatis terdaftar.</p>' : entries.map(([id, rp]) => {
            const due = new Date(); due.setDate(rp.date); 
            const diff = rp.date - new Date().getDate();
            const statText = diff < 0 ? 'LEWAT JATUH TEMPO' : diff === 0 ? 'HARI INI' : `${diff} Hari Lagi`;
            const statCol = diff <= 2 ? 'text-rose-400' : 'text-[var(--text-muted)]';
            return `<div class="glass-panel p-4 relative group"><div class="flex justify-between items-center mb-1"><h4 class="font-bold text-sm text-[var(--text-main)]"><i class="fa-solid fa-file-invoice-dollar mr-1 text-sky-400"></i> ${rp.name}</h4><span class="font-mono text-sm font-bold text-accent">${formatVal(convertVal(rp.amount, 'JPY'))}</span></div><div class="flex justify-between items-center text-[9px] uppercase tracking-widest mt-2"><span class="${statCol} font-extrabold">${statText} (Tgl ${rp.date})</span><span class="text-[var(--text-muted)]">Metode: ${rp.method}</span></div><button onclick="window.removeRecurringPayment('${id}')" class="absolute top-2 right-2 p-2 text-rose-500 opacity-0 group-hover:opacity-100 transition"><i class="fa-solid fa-trash text-xs"></i></button></div>`;
        }).join('');
    }
};

window.checkAndExecuteRecurringPayments = async function() {
    const rPayments = window.settingsData?.recurringPayments || {};
    const txList = window.allTransactions || [];
    const today = new Date();
    const curDate = today.getDate();
    const curMonthYearStr = `${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2, '0')}`;

    for (const [id, rp] of Object.entries(rPayments)) {
        if (curDate >= rp.date) {
            const alreadyPaid = txList.some(t => {
                const sameRecurringId = t.recurring_id === id;
                const sameMonthYear = t.tanggal && t.tanggal.startsWith(curMonthYearStr);
                return sameRecurringId && sameMonthYear;
            });

            if (!alreadyPaid) {
                const timestamp = today.toISOString();
                const itemUnikId = window.generateItemId();
                const tagihanData = {
                    tanggal: today.toISOString().split('T')[0],
                    createdAt: timestamp,
                    nominal: rp.amount,
                    mata_uang: window.displayCurrency,
                    metode_pembayaran: rp.method,
                    kategori: 'Tagihan',
                    tipe: 'pengeluaran',
                    sifat: 'kebutuhan',
                    merchantName: rp.name,
                    description: `Pembayaran otomatis: ${rp.name}`,
                    isCustomDescription: true,
                    recurring_id: id,
                    is_deleted: false,
                    items: [
                        {
                            itemId: itemUnikId,
                            nama_barang: rp.name,
                            harga: rp.amount,
                            qty: 1,
                            subtotal: rp.amount,
                            kategori_barang: 'Utilitas',
                            tax_rate: 0,
                            paymentMethod: rp.method,
                            timestamp: timestamp
                        }
                    ]
                };
                try {
                    await window.FirebaseService.saveTransaction(tagihanData);
                    window.showToast(`Tagihan otomatis "${rp.name}" berhasil dibayarkan!`);
                } catch(e) {
                    console.error("Gagal menjalankan tagihan otomatis", e);
                }
            }
        }
    }
};

window.syncGeminiEngine = async function(silent = false) {
    const pinInput = document.getElementById('gemini-pin-input')?.value.trim();
    const pin = silent ? localStorage.getItem('aurafi_gemini_pin') : pinInput;
    
    if (!pin) { 
        if(!silent) window.showToast("HARAP MASUKKAN PIN GEMINI GLOBAL!", true);
        return; 
    }

    const gBadge = document.getElementById('gemini-status-badge');
    if(gBadge) {
        gBadge.className = "text-[9px] bg-indigo-950/40 text-indigo-400 border border-indigo-900/50 px-2 py-0.5 rounded uppercase tracking-[0.1em] font-mono animate-pulse";
        gBadge.innerText = "DECRYPTING...";
    }
    
    try {
        const geminiEngine = new window.GeminiFailoverEngine(pin);
        const gCount = await geminiEngine.init();
        if(gCount > 0) {
            window.failoverEngineInstance = geminiEngine;
            localStorage.setItem('aurafi_gemini_pin', pin);
            
            if(gBadge) {
                gBadge.className = "text-[9px] bg-emerald-950/40 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded uppercase tracking-[0.1em] font-mono";
                gBadge.innerText = `ACTIVE (${gCount})`;
            }
            if(!silent) window.showToast("Gemini Vision Berhasil Di-Unlock.");
        } else { throw new Error(); }
    } catch(e) {
        if(gBadge) {
            gBadge.className = "text-[9px] bg-red-950/40 text-rose-400 border border-red-900/50 px-2 py-0.5 rounded uppercase tracking-[0.1em] font-mono";
            gBadge.innerText = "FAIL / LOCKED";
        }
        if(!silent) window.showToast("Dekripsi Gagal: PIN Salah.", true);
    }
};

window.addGroqKey = async function() {
    const keyInput = document.getElementById('new-groq-key').value.trim();
    if(!keyInput.startsWith('gsk_')) return window.showToast("Format API Key Groq salah (harus diawali gsk_).", true);
    
    if(!window.EncryptionService.validate(keyInput, window.GroqService.secret)) return window.showToast("Kesalahan Enkripsi Fatal.", true);
    
    const enc = window.EncryptionService.encryptApiKey(keyInput, window.GroqService.secret);
    await window.FirebaseService.saveGroqKey(enc);
    
    document.getElementById('new-groq-key').value = "";
    window.showToast("Kunci Groq berhasil disimpan.");
};

window.removeGroqKey = async function(id) {
    if(confirm("Hapus kunci Groq ini dari Database?")) {
        await window.FirebaseService.deleteGroqKey(id);
    }
};

window.renderGroqKeysUI = function() {
    const container = document.getElementById('groq-keys-container');
    if(!container) return;

    const keys = window.rawGroqKeysData || [];
    if(keys.length === 0) {
        container.innerHTML = '<p class="text-[10px] text-[var(--text-muted)] text-center my-2">Belum ada API Key Groq yang tersimpan.</p>';
        return;
    }

    container.innerHTML = keys.map((k, index) => {
        const dec = window.EncryptionService.decryptApiKey(k.encryptedKey, window.GroqService.secret);
        const display = dec ? `${dec.substring(0,8)}...${dec.substring(dec.length-4)}` : `(Data Rusak/Corrupt)`;
        const statusColor = dec ? 'text-emerald-400' : 'text-rose-400';
        
        return `<div class="flex justify-between items-center bg-[var(--bg-base)] p-2 rounded-xl border border-[var(--border-glass)]">
            <div class="flex flex-col">
                <span class="font-mono text-xs ${statusColor}">${display}</span>
                <span class="text-[8px] text-[var(--text-muted)] uppercase tracking-wider">Groq Key #${index + 1}</span>
            </div>
            <button onclick="window.removeGroqKey('${k.id}')" class="text-rose-500 p-1 hover:text-rose-400 active:scale-90 transition"><i class="fa-solid fa-trash text-xs"></i></button>
        </div>`;
    }).join('');
};

// ==========================================
// UNIFIED CALL ENGINE DENGAN FALLBACK OTOMATIS (GROQ -> GEMINI)
// ==========================================
window.executeAIWithFallback = async function(messages, systemPrompt, requireJson, base64Image = null) {
    const prefs = window.settingsData?.aiPreferences || {};
    const chatModel = prefs.modelChat || 'Auto';
    const visionModel = prefs.modelVision || 'Auto';
    
    let useGroq = false;
    let useGemini = false;

    if (base64Image) {
        if (visionModel === 'Gemini' || visionModel === 'Auto') useGemini = true;
        else if (visionModel === 'Groq Vision') useGroq = true; 
    } else {
        if (chatModel === 'Groq') useGroq = true;
        else if (chatModel === 'Gemini') useGemini = true;
        else { useGroq = true; useGemini = true; } // Auto mode
    }

    let lastError = null;

    if (useGroq && window.rawGroqKeysData && window.rawGroqKeysData.length > 0) {
        try {
            console.log("[AuraFi Engine] Mencoba Groq API...");
            return await window.GroqService.fetch(messages, requireJson);
        } catch(e) {
            console.warn("[AuraFi Engine] Groq API Gagal/Quota Limit...", e);
            lastError = e;
            if (!useGemini) throw e; 
        }
    }

    if (useGemini && window.failoverEngineInstance && window.failoverEngineInstance.keysPool.length > 0) {
        try {
            console.log("[AuraFi Engine] Mencoba Gemini API...");
            const userPrompt = messages[messages.length - 1].content;
            
            const geminiPayload = {
                contents: [{ role: "user", parts: [{ text: userPrompt }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] }
            };

            if (requireJson) {
                geminiPayload.generationConfig = { responseMimeType: "application/json" };
            }

            return await window.failoverEngineInstance.fetch(geminiPayload, base64Image);
        } catch(e) {
            console.error("[AuraFi Engine] Gemini API juga gagal.", e);
            lastError = e;
        }
    }

    throw new Error(lastError ? lastError.message : "Sistem AI offline. Konfigurasikan PIN Gemini atau API Key Groq di Setelan.");
};

window.processTransactionParsing = async function(text, imgData = null) {
    if (!window.currentUserUid) return;
    window.setProcessingStatus(true);
    
    try {
        let jsonResult;
        const activeCurrency = window.displayCurrency || 'JPY';
        const nickname = window.settingsData?.profile?.nickname || "Bos";

        // MEROMBAK SYSTEM PROMPT UNTUK ATURAN AKUNTANSI, FORMAT ITEM, MULTIPLIKASI, DAN KATEGORI
        const systemPrompt = `Kamu AuraFi OS. User: ${nickname}. Mata Uang: ${activeCurrency}.
Wajib menghasilkan output RAW JSON tanpa markdown backticks (\`\`\`).
ATURAN UTAMA & AKUNTANSI STRICT:
1. PENARIKAN (TARIK TUNAI): "Tarik tunai 500 admin 110" -> Tipe="tarik_tunai". nominal=500, admin_fee=110. (Saldo cashless berkurang 610, tunai bertambah 500, aset terpotong 110).
2. PENYETORAN (SETOR TUNAI): "Setor tunai 10000 admin 0" -> Tipe="setor_tunai". nominal=10000, admin_fee=0. (Saldo tunai berkurang 10000, cashless bertambah 10000. Total aset statis).
3. PEMBAYARAN BELANJA: Tipe="pengeluaran". Jika bayar pakai 'tunai', otomatis mengurangi saldo tunai. Jika 'cashless', mengurangi saldo cashless. JANGAN SILANG.
4. NORMALISASI BAHASA ITEM: Terjemahkan SEMUA nama barang berbahasa asing/Jepang ke bahasa Indonesia/bahasa user. Tidak boleh ada bahasa Jepang pada nama item.
5. PERKALIAN ITEM (QTY x HARGA): Pahami kuantitas (x2, 2x, 2 cup, isi 2, dua bungkus). "Beli kopi 150 2 cup" -> price=150, qty=2, subtotal=300. 'nominal' total block wajib = sum(price x qty) + admin_fee.
6. KATEGORI ITEM OTOMATIS: Setiap item WAJIB diklasifikasikan ke dalam kategori ini: "Makanan", "Minuman", "Bahan Pokok", "Kebutuhan Rumah", "Utilitas", "Transportasi", "Kesehatan", "Hiburan", "Belanja Online", "Belanja Offline", "Pendidikan", "Pakaian", "Elektronik", "Lainnya". JANGAN PERNAH MEMBIARKAN CATEGORY KOSONG.
7. NAMA TOKO: Ekstrak wajib nama toko/merchant (Misal: Lawson, Amazon). Simpan ke "merchantName". Jika tidak ada, isi "Toko/Merchant".
8. PAJAK JEPANG: Hitung subtotal dan distribusikan selisih tax (8% pangan non-alkohol, 10% lainnya) ke "tax" masing-masing item.
9. DESKRIPSI (DESCRIPTION): Berikan catatan detail singkat mengenai transaksi ini ke field "description" untuk disimpan.

Struktur JSON Wajib:
{
  "merchantName": "string",
  "tanggal": "YYYY-MM-DD",
  "nominal": number,
  "mata_uang": "string",
  "metode_pembayaran": "tunai/cashless",
  "kategori": "string",
  "tipe": "pemasukan/pengeluaran/tarik_tunai/setor_tunai",
  "admin_fee": number,
  "description": "string",
  "is_receipt": boolean,
  "items": [
    {
      "name": "string",
      "category": "string",
      "price": number,
      "tax": number,
      "qty": number,
      "subtotal": number
    }
  ]
}`;

        const userContent = `Catat transaksi ini: "${text || "Ekstrak struk Jepang"}" di mata uang ${activeCurrency}.`;

        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent }
        ];

        const aiOutput = await window.executeAIWithFallback(messages, systemPrompt, true, imgData);
        jsonResult = window.parseCleanJSON(aiOutput);

        const timestamp = new Date().toISOString();
        jsonResult.items = window.sanitizeItems(jsonResult.items, jsonResult.metode_pembayaran, timestamp);

        if(!jsonResult.merchantName) jsonResult.merchantName = jsonResult.storeName || jsonResult.kategori || "Toko/Merchant";
        if(!jsonResult.mata_uang) jsonResult.mata_uang = activeCurrency;
        
        await window.FirebaseService.saveTransaction({ 
            ...jsonResult, 
            is_deleted: false, 
            createdAt: timestamp 
        });
        
        window.switchView('transactions');
        window.showToast("Transaksi berhasil dianalisis & disimpan secara aman!");

    } catch(e) { 
        console.error(e);
        window.showToast(e.message || "AI gagal memproses data.", true); 
    } finally { 
        window.setProcessingStatus(false); 
    }
};

window.processOracleChat = async function(text, base64Img = null) {
    if (!window.currentUserUid) return;
    const uiText = text || (base64Img ? "[Menganalisis Gambar Terlampir...]" : "");
    
    const pushObjId = await push(ref(db, `${ledgerNode}/${window.currentUserUid}/oracleChats`), { role: 'user', text: uiText, timestamp: new Date().toISOString() }).key;
    window.setProcessingStatus(true); 

    const summaryString = window.FinancialSummaryService.getSummaryString();
    const relevantTx = window.MemoryService.getRelevantTransactions(text);
    const nickname = window.settingsData?.profile?.nickname || "Bos";

    const txString = relevantTx.map(t => {
        let it = t.items && Array.isArray(t.items) ? `| Items:[${t.items.map(i=>`{itemId:"${i.itemId}", nama:"${i.nama_barang}", harga:${i.harga}, qty:${i.qty}}`).join(', ')}]` : ''; 
        return `ID:${t.id} | Toko:${t.merchantName || t.storeName || 'Merchant'} | Tipe:${t.tipe} | Ket:${t.description || t.catatan_ai} | Metode:${t.metode_pembayaran} | Nom:${t.nominal} ${t.mata_uang} ${it}`;
    }).join('\n');

    // INJECT PERSONA & RESPONSE STYLE SECARA DINAMIS
    const { personaStr, styleStr } = window.getOraclePromptConfigs();

    const systemPrompt = `Kamu adalah AuraFi Oracle V3. Kepribadian: ${personaStr}.
Nama User Panggilan: ${nickname}.

Konteks Keuangan Ringkas:
${summaryString}

Data Transaksi Relevan Terkait:
${txString}

ATURAN UPDATE & HAPUS UTAMA (SAFE UPDATE CONTRACT):
AI DILARANG merusak struktur array. Jangan pernah menggunakan index. WAJIB menggunakan "target_item_id" dari data transaksi di atas.
Ketika menghapus atau mengedit 1 item, data item lain dalam struk tersebut DILARANG berubah menjadi undefined atau terganti.
KATEGORI ITEM YANG DIDUKUNG: Makanan, Minuman, Bahan Pokok, Kebutuhan Rumah, Utilitas, Transportasi, Kesehatan, Hiburan, Belanja Online, Belanja Offline, Pendidikan, Pakaian, Elektronik, Lainnya.
1. action="update_transaction": Merubah merchantName, metode_pembayaran, tipe (pemasukan/pengeluaran), atau nominal global dari ID transaksi.
2. action="add_item": Menambahkan item ke "target_id". "new_items" berisi array item baru.
3. action="edit_item": Edit 1 item spesifik. WAJIB menyertakan "target_item_id". "new_items" hanya berisi data 1 item yang menimpa id tersebut (pastikan harga dan qty sesuai instruksi).
4. action="delete_item": Menghapus 1 item secara penuh berdasarkan "target_item_id".
5. action="moveToTrash": Menghapus seluruh transaksi block "target_id".

ATURAN BALASAN (WAJIB):
${styleStr} Jangan menjawab kelewat ringkas seperti "Saldo tidak cukup", berikan alasan, dampak, dan alternatif.

Kembalikan respon format RAW JSON STRICT (TANPA backticks markdown):
{
  "reply": "Kalimat balasan Oracle V3 sesuai gaya dan kepribadian",
  "action": "none|moveToTrash|update_transaction|add_item|edit_item|delete_item",
  "target_id": "string",
  "target_item_id": "string",
  "update_fields": {"merchantName": "string", "metode_pembayaran": "tunai/cashless", "tipe": "pemasukan/pengeluaran", "nominal": number},
  "new_items": [
    {
      "name": "string",
      "category": "string",
      "price": number,
      "tax": number,
      "qty": number,
      "subtotal": number
    }
  ]
}`;

    try {
        let resJson;
        const messages = [{ role: "system", content: systemPrompt }];

        const history = window.MemoryService.getRelevantChats();
        history.forEach(h => {
            if(h.text === uiText) return; 
            messages.push({ role: h.role === 'ai' ? 'assistant' : 'user', content: h.text });
        });
        messages.push({ role: "user", content: text || "Analisis data keuangan" });

        const prefs = window.settingsData?.aiPreferences || {};
        const activeModel = base64Img ? (prefs.modelVision || 'Auto') : (prefs.modelChat || 'Auto');

        const aiOutput = await window.executeAIWithFallback(messages, systemPrompt, true, base64Img);
        resJson = window.parseCleanJSON(aiOutput);

        if(resJson.action !== 'none' && resJson.target_id) { 
            try {
                const targetTrx = window.allTransactions.find(t => t.id === resJson.target_id);
                
                if(resJson.action === 'moveToTrash') {
                    await window.FirebaseService.moveToTrash(resJson.target_id);
                } else if(resJson.action === 'update_transaction' && targetTrx) {
                    const updates = {};
                    if(resJson.update_fields) {
                        if(resJson.update_fields.merchantName) updates.merchantName = resJson.update_fields.merchantName;
                        if(resJson.update_fields.metode_pembayaran) updates.metode_pembayaran = resJson.update_fields.metode_pembayaran;
                        if(resJson.update_fields.tipe) updates.tipe = resJson.update_fields.tipe;
                        if(resJson.update_fields.nominal !== undefined) updates.nominal = resJson.update_fields.nominal;
                    }
                    await window.FirebaseService.updateTransaction(targetTrx.id, updates);
                } else if(resJson.action === 'add_item' && targetTrx && resJson.new_items) {
                    const currentItems = targetTrx.items || [];
                    const sanitizedNew = window.sanitizeItems(resJson.new_items, targetTrx.metode_pembayaran, new Date().toISOString());
                    const finalItems = currentItems.concat(sanitizedNew);
                    const sum = finalItems.reduce((a,b)=>a+(b.harga*(b.qty||1)), 0);
                    
                    const upd = { items: finalItems, nominal: sum };
                    if(!targetTrx.isCustomDescription) upd.description = `[Auto-Update] Transaksi diubah via AI. Total: ${formatVal(sum)}`;
                    
                    await window.FirebaseService.updateTransaction(targetTrx.id, upd);
                } else if(resJson.action === 'edit_item' && targetTrx && resJson.target_item_id && resJson.new_items && resJson.new_items.length > 0) {
                    const currentItems = targetTrx.items || [];
                    const newEditData = resJson.new_items[0];
                    const finalItems = currentItems.map(it => {
                        if(it.itemId === resJson.target_item_id) {
                            const newPrice = newEditData.price !== undefined ? newEditData.price : (newEditData.harga !== undefined ? newEditData.harga : it.harga);
                            const newQty = newEditData.qty !== undefined ? newEditData.qty : it.qty;
                            return {
                                ...it, 
                                nama_barang: newEditData.name || newEditData.nama_barang || it.nama_barang,
                                harga: newPrice,
                                qty: newQty,
                                subtotal: newEditData.subtotal !== undefined ? newEditData.subtotal : (newPrice * newQty),
                                kategori_barang: newEditData.category || newEditData.kategori_barang || it.kategori_barang
                            };
                        }
                        return it;
                    });
                    const sum = finalItems.reduce((a,b)=>a+(b.harga*(b.qty||1)), 0);
                    
                    const upd = { items: finalItems, nominal: sum };
                    if(!targetTrx.isCustomDescription) upd.description = `[Auto-Update] Item diedit via AI. Total: ${formatVal(sum)}`;
                    
                    await window.FirebaseService.updateTransaction(targetTrx.id, upd);
                } else if(resJson.action === 'delete_item' && targetTrx && resJson.target_item_id) {
                    const currentItems = targetTrx.items || [];
                    const finalItems = currentItems.filter(it => it.itemId !== resJson.target_item_id);
                    if(finalItems.length === 0) {
                        await window.FirebaseService.moveToTrash(targetTrx.id);
                    } else {
                        const sum = finalItems.reduce((a,b)=>a+(b.harga*(b.qty||1)), 0);
                        const upd = { items: finalItems, nominal: sum };
                        if(!targetTrx.isCustomDescription) upd.description = `[Auto-Update] Item dihapus via AI. Total: ${formatVal(sum)}`;
                        await window.FirebaseService.updateTransaction(targetTrx.id, upd);
                    }
                }
            } catch(e) {
                resJson.reply += "<br><br><i class='text-[10px] text-rose-400'>(Gagal memproses sinkronisasi database)</i>";
                console.error("AI Safe Sync Error:", e);
            }
        }

        await window.FirebaseService.pushOracleChat({role: 'ai', text: resJson.reply, timestamp: new Date().toISOString(), model: activeModel });

    } catch(e) { 
        await window.FirebaseService.pushOracleChat({role: 'ai', text: `Gangguan transmisi sistem: ${e.message}`, timestamp: new Date().toISOString(), model: 'Error' }); 
    } finally { 
        window.setProcessingStatus(false); 
    }
};

window.copyChatText = function(text) {
    if (navigator.clipboard) { navigator.clipboard.writeText(text); window.showToast("Teks disalin ke clipboard!"); }
};

window.deleteChatLog = async function(id) {
    if(confirm("Hapus log chat ini?")) { await window.FirebaseService.deleteOracleChat(id); }
};

// ==========================================
// GLOBAL GUI HELPER SCRIPT & EVENT LISTENERS
// ==========================================
window.currentTheme = 'midnight';
window.displayCurrency = 'JPY'; 
window.exchangeRateIDR = 105;
window.isRatesLoaded = false;
window.allTransactions = []; 
window.trashTransactions = []; 
window.allGoals = []; 
window.monthlyBudget = 100000;
window.activeView = 'dashboard';

window.base64Upload = ""; 
window.oracleChats = []; 
window.deleteTargetData = null; 
window.editItemTargetData = null;
window.editTrxTargetData = null;
window.addItemTargetTrxId = null;
window.isProcessing = false;
window.failoverEngineInstance = null; 

window.parseCleanJSON = function(text) {
    try { return JSON.parse(text.replace(/```json/gi, '').replace(/```/g, '').trim()); } 
    catch (e) { throw new Error("Format JSON respon tidak valid."); }
};

window.onload = () => {
    window.fetchExchangeRate();
    window.applyTheme();
    
    const tx = document.getElementById('main-input-field');
    if (tx) {
        tx.addEventListener('input', function() {
            this.style.height = '40px'; 
            this.style.height = (this.scrollHeight) + 'px';
        });
    }

    // --- DOM INJECTION UNTUK UI BARU (TANPA MENGUBAH HTML) ---
    setTimeout(() => {
        // 1. Ekstensi Modal Edit Transaksi (Tipe & Deskripsi Kustom)
        const editTrxSpace = document.querySelector('#modal-edit-trx .space-y-4');
        if (editTrxSpace && !document.getElementById('edit-global-type')) {
            editTrxSpace.insertAdjacentHTML('afterbegin', `
                <div class="flex gap-3 mb-3">
                    <div class="w-full">
                        <label class="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1 block font-bold">Tipe Mutasi Saldo</label>
                        <select id="edit-global-type" class="v-input w-full rounded-xl p-3 text-sm outline-none bg-black">
                            <option value="pengeluaran">Pengeluaran (Expense / -)</option>
                            <option value="pemasukan">Pemasukan (Income / +)</option>
                        </select>
                    </div>
                </div>
            `);
            editTrxSpace.insertAdjacentHTML('beforeend', `
                <div class="mt-3">
                    <label class="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1 block font-bold">Keterangan Transaksi</label>
                    <textarea id="edit-global-desc" rows="2" class="v-input w-full rounded-xl p-3 text-sm outline-none bg-black" placeholder="Cth: Belanja mingguan bersama keluarga..."></textarea>
                </div>
            `);
        }

        // 2. Ekstensi Modal Pengaturan (Menu AI Oracle)
        const settingsBody = document.querySelector('#modal-settings .glass-panel');
        if (settingsBody && !document.getElementById('ai-preferences-section')) {
            const logoutSection = settingsBody.querySelector('.mt-6.pt-5.border-t');
            const newSection = document.createElement('div');
            newSection.id = 'ai-preferences-section';
            newSection.className = 'space-y-3 mb-6 pt-5 border-t border-[var(--border-glass)]';
            newSection.innerHTML = `
                <h4 class="text-xs font-bold text-violet-400 flex items-center gap-1.5"><i class="fa-solid fa-robot"></i> KEPRIBADIAN & PREFERENSI AI</h4>
                
                <div class="flex gap-2">
                    <div class="w-1/2">
                        <label class="text-[9px] uppercase tracking-widest text-[var(--text-muted)] mb-1 block">Model Chat</label>
                        <select id="setting-ai-chat" class="v-input w-full rounded-xl p-2 text-xs outline-none bg-black">
                            <option value="Auto">Auto (Groq->Gemini)</option>
                            <option value="Groq">Groq</option>
                            <option value="Gemini">Gemini</option>
                        </select>
                    </div>
                    <div class="w-1/2">
                        <label class="text-[9px] uppercase tracking-widest text-[var(--text-muted)] mb-1 block">Model Vision</label>
                        <select id="setting-ai-vision" class="v-input w-full rounded-xl p-2 text-xs outline-none bg-black">
                            <option value="Auto">Auto / Gemini</option>
                            <option value="Gemini">Gemini</option>
                            <option value="Groq Vision">Groq Vision</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label class="text-[9px] uppercase tracking-widest text-[var(--text-muted)] mb-1 block">Kepribadian Oracle (Personality)</label>
                    <select id="setting-ai-persona" class="v-input w-full rounded-xl p-2 text-xs outline-none bg-black">
                        <option value="Humble Profesional">1. Humble Profesional</option>
                        <option value="Santai dan Asyik">2. Santai dan Asyik</option>
                        <option value="Sarkas Cerdas">3. Sarkas Cerdas</option>
                        <option value="Mentor Keuangan">4. Mentor Keuangan</option>
                        <option value="Formal">5. Formal</option>
                        <option value="Lucu">6. Lucu</option>
                        <option value="Kombinasi Humble + Jenius + Profesional">7. Kombinasi Humble + Jenius</option>
                    </select>
                </div>

                <div>
                    <label class="text-[9px] uppercase tracking-widest text-[var(--text-muted)] mb-1 block">Gaya Jawaban AI</label>
                    <select id="setting-ai-style" class="v-input w-full rounded-xl p-2 text-xs outline-none bg-black">
                        <option value="Normal">Normal (Sedang)</option>
                        <option value="Singkat">Singkat (Max 2 Paragraf)</option>
                        <option value="Detail">Detail (Panjang & Lengkap)</option>
                    </select>
                </div>
                
                <button onclick="window.saveAIPreferences()" class="w-full py-2.5 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30 font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:bg-violet-500/30">
                    <i class="fa-solid fa-floppy-disk"></i> Simpan Setelan AI
                </button>
            `;
            if(logoutSection) settingsBody.insertBefore(newSection, logoutSection);
            else settingsBody.appendChild(newSection);
            
            // Populasikan nilai lama jika ada
            if (window.settingsData && window.settingsData.aiPreferences) {
                document.getElementById('setting-ai-chat').value = window.settingsData.aiPreferences.modelChat || 'Auto';
                document.getElementById('setting-ai-vision').value = window.settingsData.aiPreferences.modelVision || 'Auto';
                document.getElementById('setting-ai-persona').value = window.settingsData.aiPreferences.persona || 'Kombinasi Humble + Jenius + Profesional';
                document.getElementById('setting-ai-style').value = window.settingsData.aiPreferences.style || 'Normal';
            }
        }
    }, 800);
};

window.fetchExchangeRate = async function() {
    try {
        const res = await fetch('https://open.er-api.com/v6/latest/JPY');
        const data = await res.json();
        if(data?.rates?.IDR) { 
            window.exchangeRateIDR = data.rates.IDR;
            window.isRatesLoaded = true; 
            document.getElementById('live-rate-display').innerText = `1 JPY = Rp ${window.exchangeRateIDR.toLocaleString('id-ID')}`;
        }
    } catch(e) { 
        document.getElementById('live-rate-display').innerText = "1 JPY = Rp 105 (OFFLINE)";
    }
};

window.toggleTheme = function() {
    const themes = ['midnight', 'sakura', 'neon'];
    window.currentTheme = themes[(themes.indexOf(window.currentTheme) + 1) % themes.length];
    window.applyTheme(); 
    if(window.FirebaseService?.updateSettings) window.FirebaseService.updateSettings({ theme: window.currentTheme });
};

window.applyTheme = function() { document.documentElement.setAttribute('data-theme', window.currentTheme); };

window.promptSettingsAccess = function() { window.showModal('modal-settings'); };

window.closeSettingsModal = function() {
    const m = document.getElementById('modal-settings');
    if(m) { m.classList.remove('opacity-100'); setTimeout(() => m.classList.add('hidden'), 300); }
};

window.toggleAccordion = function(id) {
    const el = document.getElementById(id);
    const icon = document.getElementById(id + '-icon');
    if (el && el.classList.contains('hidden')) { el.classList.remove('hidden'); icon.style.transform = 'rotate(180deg)'; } 
    else if (el) { el.classList.add('hidden'); icon.style.transform = 'rotate(0deg)'; }
};

window.setCurrency = function(curr) {
    window.displayCurrency = curr;
    document.getElementById('btn-curr-jpy').className = `px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all ${curr==='JPY'?'bg-accent text-[var(--bg-base)]':'text-[var(--text-muted)]'}`;
    document.getElementById('btn-curr-idr').className = `px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all ${curr==='IDR'?'bg-accent text-[var(--bg-base)]':'text-[var(--text-muted)]'}`;
    window.reCalculateAll();
};

window.switchView = function(viewId) {
    window.activeView = viewId;
    ['dashboard', 'transactions', 'analytics', 'goals', 'oracle', 'trash'].forEach(id => {
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

    const inputField = document.getElementById('main-input-field');
    if(viewId === 'oracle') { 
        inputField.placeholder = "Chat Oracle / Edit Data...";
        setTimeout(() => { const anc = document.getElementById('chat-anchor'); if(anc) anc.scrollIntoView({behavior:'smooth'}); }, 100);
    } else {
        inputField.placeholder = "Ketik/Suara/Foto Transaksi...";
    }
    window.reCalculateAll();
};

const convertVal = (amt, fromCurr) => {
    if(fromCurr === window.displayCurrency) return amt;
    if(fromCurr === 'JPY' && window.displayCurrency === 'IDR') return amt * window.exchangeRateIDR;
    if(fromCurr === 'IDR' && window.displayCurrency === 'JPY') return amt / window.exchangeRateIDR;
    return amt;
};

const formatVal = (amt) => new Intl.NumberFormat(window.displayCurrency==='JPY'?'ja-JP':'id-ID', {style:'currency', currency:window.displayCurrency, maximumFractionDigits:0}).format(amt);

let expItemsState = {};
window.toggleReceipt = function(id) { expItemsState[id] = !expItemsState[id]; window.reCalculateAll(); };

// PETA KATEGORI CERDAS & PEWARNAAN OTOMATIS (Sesuai List Resmi User)
function getCategoryStyle(cat) {
    const c = (cat || "Lainnya").toLowerCase();
    if (c.includes('makan')) return { icon: 'fa-burger', color: 'text-orange-400', bg: 'bg-orange-400/10' };
    if (c.includes('minum')) return { icon: 'fa-mug-hot', color: 'text-blue-400', bg: 'bg-blue-400/10' };
    if (c.includes('pokok') || c.includes('bahan')) return { icon: 'fa-basket-shopping', color: 'text-green-400', bg: 'bg-green-400/10' };
    if (c.includes('rumah')) return { icon: 'fa-house', color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
    if (c.includes('utilitas') || c.includes('tagihan')) return { icon: 'fa-file-invoice-dollar', color: 'text-yellow-400', bg: 'bg-yellow-400/10' };
    if (c.includes('transport')) return { icon: 'fa-train', color: 'text-emerald-400', bg: 'bg-emerald-400/10' };
    if (c.includes('sehat') || c.includes('obat')) return { icon: 'fa-kit-medical', color: 'text-rose-400', bg: 'bg-rose-400/10' };
    if (c.includes('hibur')) return { icon: 'fa-gamepad', color: 'text-purple-400', bg: 'bg-purple-400/10' };
    if (c.includes('online')) return { icon: 'fa-box-open', color: 'text-pink-400', bg: 'bg-pink-400/10' };
    if (c.includes('offline') || c.includes('belanja')) return { icon: 'fa-shop', color: 'text-indigo-400', bg: 'bg-indigo-400/10' };
    if (c.includes('didik') || c.includes('pendidikan')) return { icon: 'fa-graduation-cap', color: 'text-cyan-400', bg: 'bg-cyan-400/10' };
    if (c.includes('pakaian') || c.includes('baju')) return { icon: 'fa-shirt', color: 'text-fuchsia-400', bg: 'bg-fuchsia-400/10' };
    if (c.includes('elektronik')) return { icon: 'fa-laptop', color: 'text-slate-400', bg: 'bg-slate-400/10' };
    if (c.includes('dapat') || c.includes('gaji')) return { icon: 'fa-money-bill-wave', color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
    return { icon: 'fa-tag', color: 'text-[var(--text-muted)]', bg: 'bg-white/5' };
}

function getCategoryIcon(cat) {
    return getCategoryStyle(cat).icon;
}

// LOGIKA STATISTIK & KALKULATOR REALTIME 
window.reCalculateAll = function() {
    let totBal = 0, cashBal = 0, cashlessBal = 0;
    let thisMthSpent = 0, thisMthCashless = 0, thisMthIncome = 0, impulsif = 0;
    let catSpend = {}, dailySp = {};
    const today = new Date();
    
    // Siapkan wadah bar chart 7 hari terakhir secara realtime
    for(let i=6; i>=0; i--) { 
        let d=new Date(today);
        d.setDate(d.getDate()-i); dailySp[d.toISOString().split('T')[0]] = 0; 
    }
    let groupedTrx = {};

    const txList = window.allTransactions || [];
    txList.forEach(trx => {
        const val = convertVal(trx.nominal, trx.mata_uang);
        const isCash = trx.metode_pembayaran === 'tunai';
        
        // PENGELOLAAN TANGGAL / TIMESTAMP PINTAR
        const dStrRaw = trx.createdAt || trx.tanggal;
        const dStr = dStrRaw ? dStrRaw.split('T')[0] : '';
        const d = new Date(dStrRaw || trx.tanggal); 
        
        let timeFormatted = "";
        if (trx.createdAt) {
            const dObjFull = new Date(trx.createdAt);
            if(!isNaN(dObjFull)) {
                const yr = dObjFull.getFullYear();
                const mo = String(dObjFull.getMonth()+1).padStart(2,'0');
                const da = String(dObjFull.getDate()).padStart(2,'0');
                const hr = String(dObjFull.getHours()).padStart(2,'0');
                const mi = String(dObjFull.getMinutes()).padStart(2,'0');
                timeFormatted = `${yr}/${mo}/${da} ${hr}:${mi}`;
            }
        } else {
            timeFormatted = (trx.tanggal || "---") + " 00:00"; // Fallback ke transaksi lawas
        }
        
        if(!groupedTrx[dStr]) groupedTrx[dStr] = { total: 0, items: [] };

        if(trx.tipe === 'pemasukan') {
            totBal += val; 
            if(isCash) cashBal += val; else cashlessBal += val; 
            groupedTrx[dStr].total += val;
            if(!isNaN(d) && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) thisMthIncome += val;
        
        } else if (trx.tipe === 'tarik_tunai') {
            let adminFee = Number(trx.admin_fee || 0);
            if (!adminFee && trx.items && Array.isArray(trx.items)) {
                const adminItem = trx.items.find(i => i.nama_barang.toLowerCase().includes('admin'));
                if (adminItem) adminFee = Number(adminItem.harga * (adminItem.qty || 1));
            }
            const feeVal = convertVal(adminFee, trx.mata_uang);
            const mainVal = convertVal(trx.nominal, trx.mata_uang);
            
            totBal -= feeVal; // Net worth terpotong hanya biaya admin
            cashBal += mainVal; // Uang di tangan/dompet bertambah
            cashlessBal -= (mainVal + feeVal); // Rekening Bank terpotong nilai tarikan + admin
            
            groupedTrx[dStr].total -= feeVal;
            if(!isNaN(d) && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) {
                thisMthSpent += feeVal;
                thisMthCashless += feeVal;
                catSpend['Utilitas'] = (catSpend['Utilitas']||0) + feeVal;
            }
        
        } else if (trx.tipe === 'setor_tunai') {
            let adminFee = Number(trx.admin_fee || 0);
            if (!adminFee && trx.items && Array.isArray(trx.items)) {
                const adminItem = trx.items.find(i => i.nama_barang.toLowerCase().includes('admin'));
                if (adminItem) adminFee = Number(adminItem.harga * (adminItem.qty || 1));
            }
            const feeVal = convertVal(adminFee, trx.mata_uang);
            const mainVal = convertVal(trx.nominal, trx.mata_uang);
            
            totBal -= feeVal; // Net worth terpotong hanya biaya admin
            cashBal -= mainVal; // Fisik cash berkurang disetor ke bank
            cashlessBal += mainVal; // Saldo cashless/bank bertambah
            cashlessBal -= feeVal; // Bank terpotong administrasi jika ada
            
            groupedTrx[dStr].total -= feeVal;
            if(!isNaN(d) && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) {
                thisMthSpent += feeVal;
                thisMthCashless += feeVal;
                catSpend['Utilitas'] = (catSpend['Utilitas']||0) + feeVal;
            }

        } else {
            // TIPE PENGELUARAN (BELANJA NORMAL)
            totBal -= val;
            if(isCash) cashBal -= val; else cashlessBal -= val; 
            groupedTrx[dStr].total -= val;
            if(trx.sifat === 'impulsif') impulsif++;
            
            if(!isNaN(d) && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) {
                thisMthSpent += val;
                if(!isCash) thisMthCashless += val;
                
                // MENGHITUNG KATEGORI BERDASARKAN "ITEM", BUKAN GLOBAL TRANSAKSI
                if (trx.items && Array.isArray(trx.items) && trx.items.length > 0) {
                    let calcItemSum = 0;
                    trx.items.forEach(it => {
                        const itemCat = it.kategori_barang || 'Lainnya';
                        const itemVal = convertVal(it.harga * (it.qty || 1), trx.mata_uang);
                        calcItemSum += itemVal;
                        catSpend[itemCat] = (catSpend[itemCat] || 0) + itemVal;
                    });
                    
                    // Alokasi selisih jika user input total lebih besar dari total item (Misal: Pajak/Tips yg tidak terdata)
                    if (val > calcItemSum) {
                        const diff = val - calcItemSum;
                        catSpend['Lainnya'] = (catSpend['Lainnya'] || 0) + diff;
                    }
                } else {
                    // Fallback aman untuk transaksi lama yang belum pakai itemize
                    const c = trx.kategori || 'Lainnya'; 
                    catSpend[c] = (catSpend[c]||0) + val;
                }
            }
            if(dailySp[dStr] !== undefined) dailySp[dStr] += val; // Populate Bar Chart 7 Hari
        }
        
        // Simpan timeFormatted ke object lokal sementara untuk UI map() di bawah
        trx.displayTime = timeFormatted;
        groupedTrx[dStr].items.push(trx);
    });

    document.getElementById('dash-total-balance').innerText = formatVal(totBal);
    document.getElementById('dash-cash').innerText = formatVal(cashBal);
    document.getElementById('dash-cashless').innerText = formatVal(cashlessBal);
    
    const core = document.getElementById('living-core'); 
    const limitVal = convertVal(window.monthlyBudget, 'JPY');
    
    const burnPct = limitVal > 0 ? (thisMthSpent / limitVal) * 100 : 0;
    const remainingBudget = limitVal - thisMthSpent;
    
    if (window.FirebaseService && window.currentUserUid) {
        clearTimeout(window.budgetUpdateTimer);
        window.budgetUpdateTimer = setTimeout(() => {
            window.FirebaseService.updateSettings({
                monthlyBudget: {
                    limit: window.monthlyBudget,
                    spent: thisMthSpent,
                    remaining: remainingBudget,
                    percentage: burnPct.toFixed(2)
                }
            });
        }, 5000);
    }

    if (core) { core.className = `w-44 h-44 rounded-full living-core ${burnPct > 90 ? 'danger' : ''} flex flex-col items-center justify-center relative overflow-hidden`; }
    const bProg = document.getElementById('burn-progress');
    if (bProg) { bProg.style.width = `${Math.min(burnPct, 100)}%`; bProg.style.backgroundColor = burnPct > 90 ? 'var(--color-expense)' : 'var(--color-income)'; }
    
    const sp = document.getElementById('burn-spent'); if (sp) sp.innerText = `Terpakai: ${formatVal(thisMthSpent)}`;
    const lm = document.getElementById('burn-limit'); if (lm) lm.innerText = `Limit: ${formatVal(limitVal)}`;

    const daysInMth = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
    const proj = (today.getDate() > 0 ? thisMthSpent / today.getDate() : 0) * daysInMth;
    const insightBox = document.getElementById('burn-insight-box');
    
    if (insightBox) {
        if(proj > limitVal) { 
            insightBox.innerHTML = `<span class="text-[var(--color-expense)] font-bold"><i class="fa-solid fa-triangle-exclamation"></i> BAHAYA:</span> Estimasi akhir bulan tagihan mencapai ${formatVal(proj)}!`;
            insightBox.style.borderColor = 'var(--color-expense)'; 
        } else { 
            insightBox.innerHTML = `<span class="text-[var(--color-income)] font-bold"><i class="fa-solid fa-circle-check"></i> AMAN:</span> Pengeluaran stabil. Prediksi akhir ${formatVal(proj)}.<br><span class="text-[9px] mt-1 text-[var(--text-muted)]">Sisa Anggaran: ${formatVal(remainingBudget)}</span>`; 
            insightBox.style.borderColor = 'var(--border-glass)';
        }
    }

    const cashRatio = thisMthSpent > 0 ? (thisMthCashless / thisMthSpent)*100 : 0;
    const warnBox = document.getElementById('warn-cashless');
    if (warnBox) {
        if(cashRatio > 80 && impulsif > 3) { warnBox.classList.remove('hidden'); document.getElementById('warn-cashless-pct').innerText = `${cashRatio.toFixed(0)}%`; } 
        else { warnBox.classList.add('hidden'); }
    }

    // RENDER SEMUA KATEGORI BULAN INI BERDASARKAN ITEM (TANPA LIMIT)
    const topCatDiv = document.getElementById('top-categories-list');
    const catSorted = Object.entries(catSpend).sort((a,b)=>b[1]-a[1]);
    if (topCatDiv) {
        topCatDiv.innerHTML = catSorted.length === 0 ? '<p class="text-xs text-[var(--text-muted)] text-center">Belum ada data bulan ini.</p>' : catSorted.map(([c,v]) => {
            const style = getCategoryStyle(c);
            const pct = thisMthSpent > 0 ? ((v/thisMthSpent)*100).toFixed(0) : 0;
            return `<div class="flex justify-between items-center text-sm border-b border-[var(--border-glass)] pb-2.5 last:border-0 last:pb-0">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full ${style.bg} flex items-center justify-center border border-[var(--border-glass)]">
                        <i class="fa-solid ${style.icon} ${style.color}"></i>
                    </div>
                    <div>
                        <p class="font-bold text-[var(--text-main)]">${c}</p>
                        <p class="text-[9px] text-[var(--text-muted)] font-bold">${pct}% dari total belanja</p>
                    </div>
                </div>
                <p class="font-mono text-xs font-bold text-[var(--text-main)]">${formatVal(v)}</p>
            </div>`;
        }).join('');
    }

    const trxListContainer = document.getElementById('trx-list-container');
    if (trxListContainer) {
        trxListContainer.innerHTML = Object.keys(groupedTrx).length === 0 ? '<p class="text-center text-[var(--text-muted)] mt-10">Ekosistem bersih. Belum ada rekam jejak.</p>' : Object.keys(groupedTrx).sort((a,b)=>new Date(b)-new Date(a)).map(dateStr => {
            const g = groupedTrx[dateStr]; 
            const dObj = new Date(dateStr);
            return `<div class="mb-4"><div class="flex justify-between items-end mb-2.5 border-b border-[var(--border-glass)] pb-1"><div class="flex items-baseline gap-1.5"><span class="text-xl font-display font-black leading-none">${!isNaN(dObj)?dObj.getDate().toString().padStart(2,'0'):'--'}</span><span class="text-[9px] uppercase tracking-widest text-[var(--text-muted)] font-extrabold">${!isNaN(dObj)?dObj.toLocaleDateString('id-ID', {weekday:'short'}):'---'}</span></div><span class="text-xs font-mono font-bold ${g.total>=0 ? 'text-[var(--color-income)]':'text-[var(--text-main)]'}">${g.total>=0?'+':''}${formatVal(g.total)}</span></div><div class="space-y-3">${g.items.map(t => {
                const isExp = expItemsState[t.id]; 
                const hasItems = t.items && Array.isArray(t.items) && t.items.length > 0;
                const catIcon = getCategoryIcon(t.kategori || 'Lainnya');
                
                const isTarikTunai = t.tipe === 'tarik_tunai';
                const isSetorTunai = t.tipe === 'setor_tunai';
                const iconHtml = t.tipe === 'pemasukan' ? '<i class="fa-solid fa-arrow-turn-up text-[var(--color-income)]"></i>' : (isTarikTunai || isSetorTunai) ? '<i class="fa-solid fa-money-bill-transfer text-[#38bdf8]"></i>' : `<i class="fa-solid ${catIcon} text-[var(--text-main)]"></i>`;
                const colorClass = t.tipe === 'pemasukan' ? 'text-[var(--color-income)]' : (isTarikTunai || isSetorTunai) ? 'text-[#38bdf8]' : 'text-[var(--text-main)]';
                const signChar = t.tipe === 'pemasukan' ? '+' : (isTarikTunai || isSetorTunai) ? '⇄' : '-';
                const titleDisp = t.merchantName || t.storeName || t.kategori;
                const descDisp = t.description || t.catatan_ai || "";

                return `<div class="glass-panel p-4 relative group">
                    <button onclick="window.openEditTrxModal('${t.id}')" class="absolute top-3 right-10 text-[var(--text-muted)] hover:text-accent opacity-0 group-hover:opacity-100 active:scale-90 p-2 text-sm transition"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="window.confirmDelTrx('${t.id}')" class="absolute top-3 right-3 text-[var(--text-muted)] hover:text-[var(--color-expense)] opacity-0 group-hover:opacity-100 active:scale-90 p-2 text-sm transition"><i class="fa-solid fa-trash"></i></button>
                    <div class="flex justify-between items-start mb-2 pr-12"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-full bg-[var(--bg-base)] flex items-center justify-center border border-[var(--border-glass)] shrink-0">${iconHtml}</div><div class="overflow-hidden"><h4 class="font-bold text-sm text-[var(--accent-primary)] truncate">${titleDisp}</h4><p class="text-[8px] text-[var(--text-muted)] uppercase font-extrabold tracking-wide flex items-center gap-1">${t.metode_pembayaran==='tunai'?'<i class="fa-solid fa-money-bill"></i>':'<i class="fa-regular fa-credit-card"></i>'} ${t.metode_pembayaran} • ${t.displayTime}</p></div></div><p class="font-bold text-sm font-mono shrink-0 ml-2 ${colorClass}">${signChar}${formatVal(convertVal(t.nominal, t.mata_uang))}</p></div>${descDisp ? `<div class="bg-black/25 p-2.5 rounded-xl text-xs text-accent italic mb-2">"${descDisp}"</div>` : ''}${hasItems ? `<div class="mt-2.5 pt-2 border-t border-[var(--border-glass)]"><div class="flex justify-between items-center"><button onclick="window.toggleReceipt('${t.id}')" class="flex-1 text-left text-[9px] text-[var(--text-muted)] font-black uppercase tracking-wider py-1.5"><span><i class="fa-solid fa-list mr-1"></i> ${t.items.length} Barang (Klik Detil)</span> <i class="fa-solid fa-chevron-${isExp?'up':'down'}"></i></button><button onclick="window.openAddItemModal('${t.id}')" class="bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-md text-[8px] font-bold text-white transition">+ ITEM</button></div><div class="${isExp?'block':'hidden'} mt-2 space-y-1.5">${t.items.map((it) => {
                            // AMBIL ITEM ID YANG UNIK (UUID) UNTUK SETIAP ITEM, DIAMBIL DARI ONVALUE
                            const safeItemId = it.itemId;
                            return `<div class="flex justify-between items-center text-xs bg-white/5 p-2 rounded-xl group/it"><div class="flex-1 truncate"><span class="text-[var(--text-main)] font-medium">${it.nama_barang}</span> <span class="text-[9px] text-[var(--text-muted)] font-mono font-bold">x${it.qty}</span> ${it.tax_rate ? `<span class="text-[8px] bg-sky-950/40 text-sky-400 px-1 rounded font-mono border border-sky-900">${it.tax_rate}%</span>` : ''}</div><span class="font-mono text-[var(--text-muted)] text-[11px] mr-2">${formatVal(convertVal(it.harga*(it.qty||1), t.mata_uang))}</span><div class="flex gap-2 opacity-100 md:opacity-0 group-hover/it:opacity-100"><button onclick="window.openEditItem('${t.id}', '${safeItemId}')" class="text-accent p-1 text-xs"><i class="fa-solid fa-pen"></i></button><button onclick="window.confirmDelItem('${t.id}', '${safeItemId}')" class="text-[var(--color-expense)] p-1 text-xs"><i class="fa-solid fa-xmark"></i></button></div></div>`;
                        }).join('')}</div></div>` : `<div class="mt-2.5 pt-2 border-t border-[var(--border-glass)]"><button onclick="window.openAddItemModal('${t.id}')" class="bg-white/5 border border-[var(--border-glass)] w-full py-1.5 rounded-md text-[9px] font-bold text-[var(--text-muted)] hover:text-white transition">+ TAMBAH ITEM</button></div>`}</div>`
                    }).join('')}</div></div>`
                }).join('');
            }

            const c7d = document.getElementById('chart-7days');
            if (c7d) {
                const maxDSp2 = Math.max(...Object.values(dailySp), 1);
                c7d.innerHTML = Object.entries(dailySp).map(([dStr, v]) => `<div class="flex flex-col items-center flex-1 group relative"><div class="absolute -top-7 bg-black text-white text-[9px] px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 z-10 whitespace-nowrap transition-all duration-200 pointer-events-none">${formatVal(v)}</div><div class="w-full rounded-t-md transition-all duration-1000 ${dStr === today.toISOString().split('T')[0]?'bg-accent':'bg-accent/30'}" style="height: ${v===0?4:(v/maxDSp2)*100}%"></div><span class="text-[8px] text-[var(--text-muted)] mt-1.5 font-mono">${dStr.split('-')[2]}/${dStr.split('-')[1]}</span></div>`).join('');
            }

            const gCon = document.getElementById('goals-list-container');
            if (gCon) {
                const glList = window.allGoals || [];
                gCon.innerHTML = glList.length === 0 ? '<p class="text-center text-[var(--text-muted)]">Belum ada misi. Tambah misi baru di atas!</p>' : glList.map(g => {
                    const targetVal = convertVal(g.targetAmount, g.currency);
                    const diffDays = Math.ceil((new Date(g.targetDate) - new Date()) / (1000 * 3600 * 24));
                    const daily = diffDays > 0 ? targetVal/diffDays : 0;
                    return `<div class="glass-panel p-4 relative overflow-hidden border-t-2 border-t-accent"><button onclick="window.confirmDelGoal('${g.id}')" class="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-main)] p-1"><i class="fa-solid fa-trash text-xs"></i></button><h4 class="font-bold text-sm mb-1">${g.name}</h4><p class="text-[9px] text-[var(--text-muted)] mb-3 uppercase tracking-wider font-extrabold">Target: ${formatVal(targetVal)} sebelum ${g.targetDate}</p><div class="bg-black/35 rounded-xl p-3 flex justify-between items-center border border-[var(--border-glass)]"><div><p class="text-[8px] text-[var(--text-muted)] uppercase mb-0.5 font-extrabold">Tabungan Harian</p><p class="font-mono text-accent font-bold text-xs">${diffDays>0?formatVal(daily):'TARGET LEWAT'}</p></div><div class="text-right"><p class="text-[8px] text-[var(--text-muted)] uppercase mb-0.5 font-extrabold">Sisa Hari</p><p class="font-bold text-xs">${diffDays>0?diffDays+' Hari':'-'}</p></div></div></div>`;
        }).join('');
    }

    const trCon = document.getElementById('trash-list-container');
    if (trCon) {
        const trashList = window.trashTransactions || [];
        trCon.innerHTML = trashList.length === 0 ? '<p class="text-center text-[var(--text-muted)]">Tempat sampah kosong.</p>' : trashList.map(t => `<div class="glass-panel p-4 flex justify-between items-center opacity-85 hover:opacity-100 transition"><div><h4 class="font-bold text-xs line-through text-[var(--text-muted)]">${t.merchantName || t.storeName || t.kategori}</h4><p class="text-[9px] text-[var(--text-muted)]">${t.deletedAt?.split('T')[0]}</p></div><div class="flex items-center gap-2"><span class="font-mono text-xs text-[var(--text-muted)] line-through mr-1">${formatVal(convertVal(t.nominal, t.mata_uang))}</span><button onclick="window.restoreTransaction('${t.id}')" class="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-lg active:scale-90 transition" aria-label="Restore"><i class="fa-solid fa-rotate-left text-xs"></i></button><button onclick="window.deleteForever('${t.id}')" class="bg-rose-500/20 text-rose-400 p-2.5 rounded-lg active:scale-90 transition" aria-label="Hapus Permanen"><i class="fa-solid fa-xmark text-xs"></i></button></div></div>`).join('');
    }
};

window.setProcessingStatus = function(isProc) {
    window.isProcessing = isProc;
    const btn = document.getElementById('btn-send-main'); const icon = document.getElementById('icon-send');
    if (btn && icon) {
        if(isProc) { btn.disabled = true; icon.className = "fa-solid fa-circle-notch animate-spin"; } 
        else { btn.disabled = false; icon.className = "fa-solid fa-paper-plane"; }
    }
};

window.handleImage = function(e) { 
    const f = e.target.files[0];
    if(!f) return; 
    document.getElementById('img-preview').src = URL.createObjectURL(f); 
    document.getElementById('image-preview-box').classList.remove('hidden'); 
    const r = new FileReader(); r.onload = () => { window.base64Upload = r.result.split(',')[1]; };
    r.readAsDataURL(f); 
};

window.removeImage = function() { 
    const box = document.getElementById('image-preview-box'); if (box) box.classList.add('hidden'); 
    window.base64Upload = ""; const fu = document.getElementById('file-upload'); if (fu) fu.value = "";
};

window.startVoice = function() { 
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!Speech) return alert("Browser tidak mendukung Web Speech API."); 
    const rec = new Speech(); rec.lang = 'id-ID'; rec.start(); 
    document.getElementById('btn-voice').classList.add('text-rose-500', 'animate-pulse');
    rec.onresult = e => { document.getElementById('main-input-field').value += " " + e.results[0][0].transcript; }; 
    rec.onend = () => document.getElementById('btn-voice').classList.remove('text-rose-500', 'animate-pulse'); 
};

window.handleSend = async function() {
    const txtField = document.getElementById('main-input-field');
    if (!txtField) return;
    const txt = txtField.value.trim();
    const imgData = window.base64Upload; 

    if(!txt && !imgData) return;
    
    txtField.value = ""; txtField.style.height = '40px'; window.removeImage();
    if(window.activeView === 'oracle') { await window.processOracleChat(txt, imgData); } 
    else { await window.processTransactionParsing(txt, imgData); }
};

window.renderOracleChats = function() {
    const chatBox = document.getElementById('oracle-chat-box');
    if(!chatBox) return;
    chatBox.innerHTML = window.oracleChats.map(c => {
        let htmlFormat = c.text.replace(/\n/g, '<br/>');
        const dObj = new Date(c.timestamp);
        const timeStr = !isNaN(dObj) ? `${String(dObj.getHours()).padStart(2,'0')}:${String(dObj.getMinutes()).padStart(2,'0')}` : '';
        const modelBadge = c.model ? `<span class="text-[7px] border border-white/20 px-1 rounded uppercase tracking-wider text-white/50 ml-2">${c.model}</span>` : '';
        
        if (c.role === 'user') {
            return `<div class="flex justify-end group">
                <div class="flex flex-col items-end max-w-[85%]">
                    <div class="p-3.5 rounded-2xl rounded-tr-sm text-[13px] bubble-user text-white shadow-lg leading-relaxed relative">${htmlFormat}</div>
                    <span class="text-[8px] text-[var(--text-muted)] mt-1 font-mono px-1 opacity-0 group-hover:opacity-100 transition">${timeStr}</span>
                </div>
            </div>`;
        } else {
            return `<div class="flex justify-start group">
                <div class="flex flex-col items-start max-w-[90%]">
                    <div class="p-4 rounded-2xl rounded-tl-sm text-[13px] bubble-ai glass-panel markdown-content leading-relaxed shadow-md border-l-2 border-l-accent relative">
                        ${htmlFormat}
                        <div class="absolute -right-10 top-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition bg-black/40 rounded p-1">
                            <button onclick="window.copyChatText('${c.text.replace(/'/g, "\\'")}')" class="text-[10px] text-[var(--text-muted)] hover:text-white p-1" title="Salin"><i class="fa-solid fa-copy"></i></button>
                            <button onclick="window.deleteChatLog('${c.id}')" class="text-[10px] text-rose-500 hover:text-white p-1" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                    <div class="flex items-center gap-1 mt-1 opacity-50 group-hover:opacity-100 transition px-1">
                        <span class="text-[8px] text-[var(--text-muted)] font-mono">${timeStr}</span>
                        ${modelBadge}
                    </div>
                </div>
            </div>`;
        }
    }).join('');
    
    if(window.isProcessing && window.activeView === 'oracle') {
        chatBox.innerHTML += `<div class="flex justify-start"><div class="bubble-ai glass-panel p-3 rounded-2xl flex gap-1 items-center"><div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce"></div><div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce delay-100"></div><div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce delay-200"></div></div></div>`;
    }
    setTimeout(() => { const anc = document.getElementById('chat-anchor'); if(anc) anc.scrollIntoView({behavior:'smooth'}); }, 50);
};

window.showToast = function(msg, isError = false) {
    const container = document.getElementById('toast-container'); if(!container) return;
    const toast = document.createElement('div');
    const icon = isError ? '<i class="fa-solid fa-triangle-exclamation text-[var(--color-expense)]"></i>' : '<i class="fa-solid fa-check text-accent"></i>';
    toast.className = `glass-panel p-3 flex items-center gap-2 text-xs font-bold shadow-lg animate-[slideUp_0.3s_ease-out] ${isError ? 'border-l-4 border-l-[var(--color-expense)]' : 'border-l-4 border-l-accent'}`;
    toast.innerHTML = `${icon} <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3400);
};

window.showModal = function(id) { 
    const m = document.getElementById(id); 
    if(m) { m.classList.remove('hidden'); setTimeout(()=>m.classList.add('opacity-100'), 10); }
};

window.openManualTrxModal = function() {
    document.getElementById('manual-trx-amount').value = "";
    document.getElementById('manual-trx-store').value = "";
    document.getElementById('manual-trx-desc').value = "";
    window.toggleManualFormFields();
    window.showModal('modal-manual-trx');
};

window.closeManualTrxModal = function() {
    const m = document.getElementById('modal-manual-trx'); 
    if(m) { m.classList.remove('opacity-100'); setTimeout(()=>m.classList.add('hidden'), 300); }
};

window.toggleManualFormFields = function() {
    const tipe = document.getElementById('manual-trx-type').value;
    const storeLabel = document.getElementById('lbl-manual-store');
    const storeInput = document.getElementById('manual-trx-store');
    if(tipe === 'pemasukan' || tipe === 'setor_tunai') { storeLabel.innerText = "Sumber / Merchant"; storeInput.placeholder = "Contoh: Gaji / Top-Up / ATM"; } 
    else { storeLabel.innerText = "Nama Toko / Merchant"; storeInput.placeholder = "Contoh: 7-Eleven / Amazon"; }
};

window.saveManualTransaction = async function() {
    const tipe = document.getElementById('manual-trx-type').value;
    const curr = document.getElementById('manual-trx-curr').value;
    const method = document.getElementById('manual-trx-method').value;
    const amount = parseFloat(document.getElementById('manual-trx-amount').value) || 0;
    const storeName = document.getElementById('manual-trx-store').value.trim() || "Toko/Merchant";
    const desc = document.getElementById('manual-trx-desc').value.trim() || "Input Manual User";

    if (amount <= 0) return window.showToast("Nominal harus lebih dari 0!", true);

    const timestamp = new Date().toISOString();
    
    const payload = {
        merchantName: storeName, storeName: storeName,
        tanggal: timestamp.split('T')[0], nominal: amount, mata_uang: curr,
        metode_pembayaran: method, kategori: "Lainnya", tipe: tipe,
        description: desc, catatan_ai: desc, isCustomDescription: true,
        is_deleted: false, createdAt: timestamp, items: []
    };

    try {
        await window.FirebaseService.saveTransaction(payload);
        window.closeManualTrxModal();
        window.showToast("Transaksi Manual Tersimpan!");
    } catch(e) { window.showToast("Gagal menyimpan transaksi.", true); }
};

window.openEditTrxModal = function(id) {
    const trx = window.allTransactions.find(t => t.id === id);
    if(!trx) return;
    window.editTrxTargetData = id;
    
    document.getElementById('edit-global-store').value = trx.merchantName || trx.storeName || trx.kategori || '';
    document.getElementById('edit-global-curr').value = trx.mata_uang || 'JPY';
    document.getElementById('edit-global-method').value = trx.metode_pembayaran || 'cashless';
    document.getElementById('edit-global-nominal').value = trx.nominal || 0;
    
    const typeEl = document.getElementById('edit-global-type'); if (typeEl) typeEl.value = trx.tipe || 'pengeluaran';
    const descEl = document.getElementById('edit-global-desc'); if (descEl) descEl.value = trx.description || trx.catatan_ai || '';
    
    window.showModal('modal-edit-trx');
};

window.closeEditTrxModal = function() {
    const m = document.getElementById('modal-edit-trx');
    if(m) { m.classList.remove('opacity-100'); setTimeout(()=>m.classList.add('hidden'), 300); }
    window.editTrxTargetData = null;
};

window.saveEditTrx = async function() {
    if(!window.editTrxTargetData) return;
    const trxId = window.editTrxTargetData;
    
    const storeName = document.getElementById('edit-global-store').value.trim();
    const curr = document.getElementById('edit-global-curr').value;
    const method = document.getElementById('edit-global-method').value;
    const nominal = parseFloat(document.getElementById('edit-global-nominal').value) || 0;
    const typeEl = document.getElementById('edit-global-type'); const tipe = typeEl ? typeEl.value : 'pengeluaran';
    const descEl = document.getElementById('edit-global-desc'); const desc = descEl ? descEl.value.trim() : '';

    const updates = { merchantName: storeName, storeName: storeName, mata_uang: curr, metode_pembayaran: method, nominal: nominal, tipe: tipe };
    if (desc !== "") { updates.description = desc; updates.catatan_ai = desc; updates.isCustomDescription = true; }
    
    try { await window.FirebaseService.updateTransaction(trxId, updates); window.closeEditTrxModal(); window.showToast("Perubahan Global Tersimpan!"); } 
    catch(e) { window.showToast("Gagal mengupdate.", true); }
};

window.openAddItemModal = function(trxId) {
    window.addItemTargetTrxId = trxId;
    document.getElementById('add-item-name').value = ""; document.getElementById('add-item-qty').value = "1"; document.getElementById('add-item-price').value = "";
    
    const catSel = document.getElementById('add-item-cat');
    if(!catSel) {
        const spaceY4 = document.querySelector('#modal-add-item .space-y-4');
        if (spaceY4) {
            spaceY4.insertAdjacentHTML('beforeend', `
                <div>
                    <label class="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1 block font-bold">Kategori Item</label>
                    <select id="add-item-cat" class="v-input w-full rounded-xl p-3 text-sm outline-none bg-black">
                        ${["Makanan", "Minuman", "Bahan Pokok", "Kebutuhan Rumah", "Utilitas", "Transportasi", "Kesehatan", "Hiburan", "Belanja Online", "Belanja Offline", "Pendidikan", "Pakaian", "Elektronik", "Lainnya"].map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
            `);
        }
    }
    
    window.showModal('modal-add-item');
};

window.closeAddItemModal = function() {
    const m = document.getElementById('modal-add-item'); 
    if(m) { m.classList.remove('opacity-100'); setTimeout(()=>m.classList.add('hidden'), 300); }
    window.addItemTargetTrxId = null;
};

window.saveAddItem = async function() {
    if(!window.addItemTargetTrxId) return;
    const trx = window.allTransactions.find(t => t.id === window.addItemTargetTrxId); if(!trx) return;

    const name = document.getElementById('add-item-name').value.trim() || "Item Baru";
    const qty = parseFloat(document.getElementById('add-item-qty').value) || 1;
    const price = parseFloat(document.getElementById('add-item-price').value) || 0;
    const catSel = document.getElementById('add-item-cat');
    const cat = catSel ? catSel.value : "Lainnya";

    const newItem = { itemId: window.generateItemId(), nama_barang: name, harga: price, qty: qty, subtotal: (price * qty), kategori_barang: cat, tax_rate: 0, paymentMethod: trx.metode_pembayaran, timestamp: new Date().toISOString() };
    const currentItems = trx.items || []; const finalItems = currentItems.concat([newItem]);
    const newTotalSum = finalItems.reduce((a,b)=>a+(b.harga*(b.qty||1)), 0);

    const upd = { items: finalItems, nominal: newTotalSum };
    if (!trx.isCustomDescription) { upd.description = `[Auto-Update] Transaksi diubah. Total terbaru: ${formatVal(newTotalSum)}.`; upd.catatan_ai = upd.description; }

    try { await window.FirebaseService.updateTransaction(trx.id, upd); window.closeAddItemModal(); window.showToast("Item berhasil ditambahkan!"); } 
    catch(e) { window.showToast("Gagal menambah item.", true); }
};

window.confirmDelTrx = function(id) { 
    const trx = window.allTransactions.find(t=>t.id === id); if(!trx) return;
    window.deleteTargetData = { type: 'trx', id, name: trx.kategori }; 
    document.getElementById('confirm-msg').innerText = `Pindahkan transaksi "${trx.merchantName || trx.storeName || trx.kategori}" ke tempat sampah?`; 
    window.showModal('modal-confirm');
};

window.confirmDelItem = function(trxId, itemId) { 
    const trx = window.allTransactions.find(t=>t.id === trxId);
    if(!trx || !trx.items) return;

    const item = trx.items.find(i => (i.itemId || '') === itemId);
    if(!item) return;

    window.deleteTargetData = { type: 'item', id: trxId, name: item.nama_barang, itemId: itemId }; 
    document.getElementById('confirm-msg').innerText = `Hapus "${item.nama_barang}" dari struk ini? Total belanja akan dihitung ulang otomatis.`; 
    window.showModal('modal-confirm'); 
};

window.confirmDelGoal = function(id) { 
    const goal = window.allGoals.find(g=>g.id === id);
    if(!goal) return;
    window.deleteTargetData = { type: 'goal', id, name: goal.name }; 
    document.getElementById('confirm-msg').innerText = `Batalkan misi tabungan "${goal.name}" selamanya?`; 
    window.showModal('modal-confirm'); 
};

window.closeConfirmModal = function() { 
    const m = document.getElementById('modal-confirm'); 
    if(m) { m.classList.remove('opacity-100'); setTimeout(()=>m.classList.add('hidden'), 300); }
    window.deleteTargetData=null; 
};

window.openEditItem = function(trxId, itemId) {
    const trx = window.allTransactions.find(t=>t.id === trxId);
    if(!trx || !trx.items) return;
    
    const item = trx.items.find(i => (i.itemId || '') === itemId);
    if(!item) return;

    window.editItemTargetData = { id: trxId, itemId: itemId, item: item };
    document.getElementById('edit-store-name').value = trx.merchantName || trx.storeName || '';
    document.getElementById('edit-item-name').value = item.nama_barang || '';
    document.getElementById('edit-item-qty').value = item.qty || 1; 
    document.getElementById('edit-item-price').value = item.harga || 0;
    
    let catSel = document.getElementById('edit-item-cat');
    if(!catSel) {
        const spaceY4 = document.querySelector('#modal-edit-item .space-y-4');
        if (spaceY4) {
            spaceY4.insertAdjacentHTML('beforeend', `
                <div>
                    <label class="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1 block font-bold">Kategori Item</label>
                    <select id="edit-item-cat" class="v-input w-full rounded-xl p-3 text-sm outline-none bg-black"></select>
                </div>
            `);
            catSel = document.getElementById('edit-item-cat');
        }
    }
    
    if(catSel) {
        const cats = ["Makanan", "Minuman", "Bahan Pokok", "Kebutuhan Rumah", "Utilitas", "Transportasi", "Kesehatan", "Hiburan", "Belanja Online", "Belanja Offline", "Pendidikan", "Pakaian", "Elektronik", "Lainnya"];
        catSel.innerHTML = cats.map(c => `<option value="${c}" ${c === (item.kategori_barang||'Lainnya') ? 'selected' : ''}>${c}</option>`).join('');
    }

    window.showModal('modal-edit-item');
};

window.closeEditModal = function() { 
    const m = document.getElementById('modal-edit-item'); 
    if(m) { m.classList.remove('opacity-100'); setTimeout(()=>m.classList.add('hidden'), 300); }
    window.editItemTargetData=null; 
};

window.saveEditItem = async function() {
    if(!window.editItemTargetData) return;
    const trx = window.allTransactions.find(t=>t.id === window.editItemTargetData.id);
    if(trx && window.FirebaseService?.updateTransaction) {
        const storeNameVal = document.getElementById('edit-store-name').value.trim();
        const catSel = document.getElementById('edit-item-cat');
        const catSelVal = catSel ? catSel.value : 'Lainnya';
        
        const nItems = trx.items.map(it => {
            if (it.itemId === window.editItemTargetData.itemId) {
                const newPrice = parseFloat(document.getElementById('edit-item-price').value) || 0;
                const newQty = parseFloat(document.getElementById('edit-item-qty').value) || 1;
                return {
                    ...it,
                    nama_barang: document.getElementById('edit-item-name').value, 
                    qty: newQty, 
                    harga: newPrice,
                    subtotal: newPrice * newQty,
                    kategori_barang: catSelVal
                };
            }
            return it;
        });

        const sum = nItems.reduce((a,b)=>a+(b.harga*(b.qty||1)), 0);
        const upd = { 
            items: nItems, 
            nominal: sum,
            merchantName: storeNameVal || trx.merchantName || trx.storeName,
            storeName: storeNameVal || trx.storeName || trx.kategori
        };

        if (!trx.isCustomDescription) {
            upd.description = `[Auto-Update] Item telah disesuaikan. Total terbaru: ${formatVal(sum)}.`;
            upd.catatan_ai = upd.description;
        }

        await window.FirebaseService.updateTransaction(trx.id, upd);
    }
    window.closeEditModal();
};

window.restoreTransaction = async function(id) {
    if(window.FirebaseService?.updateTransaction) {
        await window.FirebaseService.updateTransaction(id, { is_deleted: false, deletedAt: null });
        window.showToast("Transaksi dikembalikan dari sampah.");
    }
};

window.deleteForever = async function(id) {
    if(window.FirebaseService?.deleteTransactionPermanently) {
        await window.FirebaseService.deleteTransactionPermanently(id);
        window.showToast("Dihapus permanen.");
    }
};

window.promptBudget = function() {
    const amt = prompt("Masukkan Limit Anggaran Bulanan Baru (dalam JPY):", window.monthlyBudget);
    if(amt && !isNaN(amt)) { 
        window.monthlyBudget = parseFloat(amt);
        if(window.FirebaseService?.updateSettings) {
            window.FirebaseService.updateSettings({ 
                monthlyBudget: { limit: window.monthlyBudget } 
            });
        }
        window.reCalculateAll(); 
    }
};

window.toggleGoalForm = function() { const f = document.getElementById('goal-form'); if(f) f.classList.toggle('hidden'); };

window.saveGoal = async function() {
    const name = document.getElementById('goal-name').value; 
    const amt = document.getElementById('goal-target').value;
    const dt = document.getElementById('goal-date').value;
    if(!name || !amt || !dt) return window.showToast("Harap lengkapi semua form!", true);

    if(window.FirebaseService?.saveGoal) {
        await window.FirebaseService.saveGoal({ name, targetAmount: parseFloat(amt), targetDate: dt, currency: window.displayCurrency });
        document.getElementById('goal-form').classList.add('hidden');
        document.getElementById('goal-name').value = ""; document.getElementById('goal-target').value = ""; document.getElementById('goal-date').value = "";
        window.showToast("Misi Tabungan Berhasil Ditambahkan!");
    }
};

window.downloadCSV = function() {
    let csv = "Tanggal,Waktu_Dibuat,Store,Tipe,Metode,Kategori,Nominal_Asli,Mata_Uang,Detail_Item,Deskripsi\n";
    window.allTransactions.forEach(r => {
        const d = r.tanggal?.split('T')[0] || ''; 
        const created = r.createdAt || '';
        const items = r.items && Array.isArray(r.items) ? r.items.map(i=>`${i.nama_barang} (${i.qty} x ${i.harga})`).join('|') : '-'; 
        const note = (r.description || r.catatan_ai || '').replace(/,/g, '');
        const store = r.merchantName || r.storeName || r.kategori || 'Toko';
        csv += `${d},${created},${store},${r.tipe},${r.metode_pembayaran},${r.kategori},${r.nominal},${r.mata_uang},"${items}","${note}"\n`;
    });

    const link = document.createElement("a"); link.href = encodeURI("data:text/csv;charset=utf-8," + csv); 
    link.download = `AuraFi_Report_${new Date().toISOString().split('T')[0]}.csv`; 
    document.body.appendChild(link); link.click(); link.remove();
};

document.getElementById('btn-execute-delete').onclick = async () => {
    if(!window.deleteTargetData) return;

    if(window.deleteTargetData.type === 'trx') {
        if(window.activeView === 'trash') {
            if(window.FirebaseService?.deleteTransactionPermanently) await window.FirebaseService.deleteTransactionPermanently(window.deleteTargetData.id);
        } else {
            if(window.FirebaseService?.moveToTrash) await window.FirebaseService.moveToTrash(window.deleteTargetData.id);
        }
    } else if(window.deleteTargetData.type === 'goal') {
        if(window.FirebaseService?.deleteGoal) await window.FirebaseService.deleteGoal(window.deleteTargetData.id);
    } else if(window.deleteTargetData.type === 'item') {
        const trx = window.allTransactions.find(t=>t.id === window.deleteTargetData.id);
        if(trx && window.FirebaseService?.updateTransaction) {
            // Filter menghapus item berdasarkan UUID, bukan index. 100% aman dan tidak merusak item lain.
            const nItems = trx.items.filter(item => item.itemId !== window.deleteTargetData.itemId);
            if(nItems.length === 0) {
                if(window.FirebaseService?.moveToTrash) await window.FirebaseService.moveToTrash(trx.id);
            } else { 
                const sum = nItems.reduce((a,b)=>a+(b.harga*(b.qty||1)), 0);
                const upd = { items: nItems, nominal: sum };
                if (!trx.isCustomDescription) {
                    upd.description = `[Auto-Update] Item dihapus. Total terbaru: ${formatVal(sum)}.`;
                    upd.catatan_ai = upd.description;
                }
                await window.FirebaseService.updateTransaction(trx.id, upd); 
            }
        }
    }
    window.closeConfirmModal();
    window.showToast("Perubahan Berhasil Disinkronkan secara Realtime.");
};

// ===============================
// SERVICE WORKER REGISTRATION (PWA)
// ===============================

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .then((registration) => {
        console.log("Service Worker aktif:", registration.scope);
      })
      .catch((error) => {
        console.log("Service Worker gagal:", error);
      });
  });
}