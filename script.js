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

window.generateItemId = function() {
    return 'itm_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
};

// NORMALISASI ITEM: Menyamakan Output Groq & Gemini (Bhs Indonesia, Kategori Wajib, Multiplikasi)
window.sanitizeItems = function(items, defaultPayment, timestamp) {
    return (items || []).map(item => {
        const harga = Number(item.price !== undefined ? item.price : (item.harga !== undefined ? item.harga : 0));
        const qty = Number(item.qty !== undefined ? item.qty : 1);
        
        // Pengecekan Kategori Ketat
        const validCategories = ["Makanan", "Minuman", "Bahan Pokok", "Utilitas", "Transportasi", "Kesehatan", "Hiburan", "Belanja Online", "Belanja Offline", "Pendidikan", "Pakaian", "Elektronik"];
        let rawCat = item.category || item.kategori_barang || item.kategori || "Lainnya";
        let finalCat = validCategories.includes(rawCat) ? rawCat : "Lainnya";

        return {
            itemId: item.itemId || window.generateItemId(),
            nama_barang: item.name || item.nama_barang || item.nama || "Item Unik",
            harga: harga,
            qty: qty,
            kategori_barang: finalCat,
            tax_rate: Number(item.tax !== undefined ? item.tax : (item.tax_rate !== undefined ? item.tax_rate : 0)),
            subtotal: Number(item.subtotal !== undefined ? item.subtotal : (harga * qty)),
            paymentMethod: item.paymentMethod || defaultPayment || "cashless",
            timestamp: item.timestamp || timestamp || new Date().toISOString()
        };
    });
};

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

    let styleStr = "Jawab dengan panjang normal (sekitar 3-8 kalimat). Berikan penjelasan, alasan, dampak pada saldo, dan solusi/alternatif.";
    if (prefs.style === "Singkat") styleStr = "Jawab SINGKAT, padat, dan jelas. Maksimal 2 paragraf saja. Tetap berikan alasan dan solusi.";
    else if (prefs.style === "Detail") styleStr = "Jawab dengan SANGAT DETAIL, komprehensif, dan panjang lebar. Lengkapi dengan poin-poin dampak pada saldo dan solusi.";

    return { personaStr, styleStr };
};

// ==========================================
// AUTHENTICATION LOGIC
// ==========================================
window.loginWithGoogle = async function() {
    try {
        await setPersistence(auth, browserLocalPersistence);
        await signInWithPopup(auth, provider).catch(async (e) => {
            console.warn("Popup blocked, trying redirect");
            await signInWithRedirect(auth, provider);
        });
    } catch (error) { window.showToast("Login gagal atau dibatalkan.", true); }
};

window.loginWithEmail = async function() {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    if(!email || !pass) return window.showToast("Harap isi email & password!", true);
    try {
        await setPersistence(auth, browserLocalPersistence);
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) { window.showToast("Login gagal: " + error.message, true); }
};

window.loginAnonymously = async function() {
    try {
        await setPersistence(auth, browserLocalPersistence);
        await signInAnonymously(auth);
    } catch (error) { window.showToast("Mode Tamu Gagal: " + error.message, true); }
};

window.logoutAccount = async function() {
    await signOut(auth);
    window.location.reload();
};

window.EncryptionService = {
    encryptApiKey(apiKey, secretKey) {
        if(!secretKey) return null;
        return CryptoJS.AES.encrypt(apiKey, secretKey).toString();
    },
    decryptApiKey(cipherText, secretKey) {
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

window.FirebaseService = {
    async saveTransaction(data) { await push(ref(db, `${ledgerNode}/${window.currentUserUid}/transactions`), data); },
    async updateTransaction(id, data) { await update(ref(db, `${ledgerNode}/${window.currentUserUid}/transactions/${id}`), data); },
    async moveToTrash(id) { await update(ref(db, `${ledgerNode}/${window.currentUserUid}/transactions/${id}`), { is_deleted: true, deletedAt: new Date().toISOString() }); },
    async deleteTransactionPermanently(id) { await remove(ref(db, `${ledgerNode}/${window.currentUserUid}/transactions/${id}`)); },
    async saveGoal(data) { await push(ref(db, `${ledgerNode}/${window.currentUserUid}/goals`), data); },
    async deleteGoal(id) { await remove(ref(db, `${ledgerNode}/${window.currentUserUid}/goals/${id}`)); },
    async updateSettings(data) { await update(ref(db, `${ledgerNode}/${window.currentUserUid}/settings`), data); },
    async saveGroqKey(encryptedKey) { await push(ref(db, `${ledgerNode}/${window.currentUserUid}/groqApiKeys`), { encryptedKey: encryptedKey, createdAt: new Date().toISOString(), active: true, usageCount: 0 }); },
    async deleteGroqKey(keyId) { await remove(ref(db, `${ledgerNode}/${window.currentUserUid}/groqApiKeys/${keyId}`)); },
    async pushOracleChat(chatObj) { await push(ref(db, `${ledgerNode}/${window.currentUserUid}/oracleChats`), chatObj); },
    async deleteOracleChat(id) { await remove(ref(db, `${ledgerNode}/${window.currentUserUid}/oracleChats/${id}`)); }
};

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
        if (matched.length > 0) return matched.slice(0, 5);
        return window.allTransactions.slice(0, 5);
    },
    getRelevantChats() { return window.oracleChats ? window.oracleChats.slice(-8) : []; }
};

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
                cashBal += val; cashlessBal -= (val + adminFee);
            } else if (t.tipe === 'setor_tunai') {
                let adminFee = Number(t.admin_fee || 0);
                cashBal -= val; cashlessBal += val; cashlessBal -= adminFee; 
            } else {
                if (isCash) cashBal -= val; else cashlessBal -= val;
                if (new Date(t.tanggal).getMonth() === today.getMonth() && new Date(t.tanggal).getFullYear() === today.getFullYear()) {
                    totSpent += val;
                }
            }
        });

        const profile = window.settingsData?.profile || {};
        const nickname = profile.nickname || "User";
        const fullName = profile.fullName || "User AuraFi";

        return `--- PROFIL & RINGKASAN ---
Nama: ${fullName} (${nickname})
Mata Uang Aktif: ${window.displayCurrency}
Tunai: ${cashBal} ${window.displayCurrency}
Cashless: ${cashlessBal} ${window.displayCurrency}
Total Aset: ${cashBal + cashlessBal} ${window.displayCurrency}
Pengeluaran Bulan Ini: ${totSpent} ${window.displayCurrency}`;
    }
};

let groqSecretKey = localStorage.getItem('aurafi_groq_secret');
if(!groqSecretKey) {
    groqSecretKey = CryptoJS.lib.WordArray.random(128/8).toString();
    localStorage.setItem('aurafi_groq_secret', groqSecretKey);
}

window.GroqService = {
    keysPool: [], currentIndex: 0, model: "llama-3.3-70b-versatile", secret: groqSecretKey,
    init(rawKeysArray) {
        this.keysPool = [];
        for(let item of rawKeysArray) {
            if(item.active) {
                const decrypted = window.EncryptionService.decryptApiKey(item.encryptedKey, this.secret);
                if(decrypted && decrypted.startsWith('gsk_')) this.keysPool.push({ id: item.id, value: decrypted });
            }
        }
        this.currentIndex = 0; return this.keysPool.length;
    },
    getCurrentApiKey() { return this.keysPool.length === 0 ? null : this.keysPool[this.currentIndex].value; },
    switchToNextApiKey() {
        if(this.keysPool.length <= 1) return false;
        this.currentIndex = (this.currentIndex + 1) % this.keysPool.length; return true;
    },
    async fetch(messages, requireJson = false) {
        if(this.keysPool.length === 0) throw new Error("API Key Groq Kosong.");
        let attempt = 0; const totalKeys = this.keysPool.length;
        while (attempt < totalKeys) {
            const apiKey = this.getCurrentApiKey();
            try {
                const payload = { model: this.model, messages: messages, temperature: requireJson ? 0.1 : 0.7 };
                if(requireJson) payload.response_format = { type: "json_object" };
                const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if(response.status === 429 || response.status === 400 || response.status === 401 || response.status === 503) {
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
        this.keysPool = [];
        const snapshot = await get(ref(db, 'nexus_api_vault'));
        if (snapshot.exists()) {
            const vaultData = snapshot.val();
            for (const id in vaultData) {
                const item = vaultData[id];
                let decrypted = window.EncryptionService.decryptApiKey(item.value, this.pin);
                if (!decrypted) {
                    try {
                        let text = atob(item.value); let result = '';
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
        if (this.keysPool.length === 0) throw new Error("Kunci Gemini Kosong.");
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
                const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestPayload) });
                if (response.status === 429 || response.status === 400 || response.status === 401) { this.currentIndex = (this.currentIndex + 1) % this.keysPool.length; attempt++; continue; }
                if (!response.ok) throw new Error(`HTTP Status ${response.status}`);
                const result = await response.json();
                return result.candidates?.[0]?.content?.parts?.[0]?.text;
            } catch (err) { this.currentIndex = (this.currentIndex + 1) % this.keysPool.length; attempt++; }
        }
        throw new Error("SEMUA KUNCI GEMINI TERKENA LIMIT!");
    }
};

function loadRealtimeDatabaseData() {
    if (!window.currentUserUid) return;

    onValue(ref(db, `${ledgerNode}/${window.currentUserUid}/transactions`), (snapshot) => {
        const all = [];
        const data = snapshot.val();
        if (data) {
            Object.entries(data).forEach(([key, val]) => {
                // BUG FIX EDIT ITEM: Inject itemId ke memory jika transaksi lawas belum memilikinya
                if (val.items && Array.isArray(val.items)) {
                    val.items.forEach(it => { if(!it.itemId) it.itemId = window.generateItemId(); });
                }
                all.push({ id: key, ...val });
            });
        }
        window.allTransactions = all.filter(t => !t.is_deleted).sort((a,b) => new Date(b.createdAt || b.tanggal) - new Date(a.createdAt || a.tanggal)).reverse();
        window.trashTransactions = all.filter(t => t.is_deleted).sort((a,b) => new Date(b.deletedAt) - new Date(a.deletedAt));
        window.checkAndExecuteRecurringPayments();
        if(window.reCalculateAll) window.reCalculateAll();
    });

    onValue(ref(db, `${ledgerNode}/${window.currentUserUid}/goals`), (snapshot) => {
        const goals = []; const data = snapshot.val();
        if (data) Object.entries(data).forEach(([key, val]) => goals.push({ id: key, ...val }));
        window.allGoals = goals;
        if(window.reCalculateAll) window.reCalculateAll();
    });

    onValue(ref(db, `${ledgerNode}/${window.currentUserUid}/settings`), (snapshot) => {
        const d = snapshot.val(); window.settingsData = d || {};
        if (d) {
            if(d.monthlyBudget && d.monthlyBudget.limit) window.monthlyBudget = d.monthlyBudget.limit;
            if(d.theme && d.theme !== window.currentTheme) { window.currentTheme = d.theme; if(window.applyTheme) window.applyTheme(); }
            if(d.profile) {
                const elFn = document.getElementById('user-fullname'); if(elFn) elFn.value = d.profile.fullName || '';
                const elNn = document.getElementById('user-nickname'); if(elNn) elNn.value = d.profile.nickname || '';
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
        window.rawGroqKeysData = []; const data = snapshot.val();
        if (data) Object.entries(data).forEach(([key, val]) => window.rawGroqKeysData.push({ id: key, ...val }));
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
        const chats = []; const data = snapshot.val();
        if (data) Object.entries(data).forEach(([key, val]) => chats.push({ id: key, ...val }));
        chats.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
        const nickname = window.settingsData?.profile?.nickname || "Bos";
        if(chats.length === 0) {
            window.oracleChats = [{id: 'init', role: 'ai', text: `Halo ${nickname}! Aku Aura Oracle V3. Aku siap jadi penasihat keuangan handalmu. Mau ngobrol hari ini? 😎`, timestamp: new Date().toISOString()}];
        } else { window.oracleChats = chats; }
        if(window.renderOracleChats) window.renderOracleChats();
    });
}

onAuthStateChanged(auth, (user) => {
    const modalLogin = document.getElementById('modal-login');
    if (user) {
        window.currentUserUid = user.uid;
        if(modalLogin) modalLogin.classList.add('hidden');
        loadRealtimeDatabaseData();
        const savedGeminiPin = localStorage.getItem('aurafi_gemini_pin');
        if (savedGeminiPin && window.syncGeminiEngine) setTimeout(() => window.syncGeminiEngine(true), 800); 
    } else {
        window.currentUserUid = null;
        if(modalLogin) modalLogin.classList.remove('hidden');
    }
});

// UI & SETTINGS
window.saveUserProfile = async function() {
    const fn = document.getElementById('user-fullname').value.trim();
    const nn = document.getElementById('user-nickname').value.trim();
    if(!fn || !nn) return window.showToast("Lengkapi form nama profil!", true);
    try { await window.FirebaseService.updateSettings({ profile: { fullName: fn, nickname: nn } }); window.showToast("Profil tersimpan!"); } catch(e) { window.showToast("Gagal menyimpan profil.", true); }
};

window.saveAIPreferences = async function() {
    const chatM = document.getElementById('setting-ai-chat').value;
    const visM = document.getElementById('setting-ai-vision').value;
    const pers = document.getElementById('setting-ai-persona').value;
    const style = document.getElementById('setting-ai-style').value;
    try {
        await window.FirebaseService.updateSettings({ aiPreferences: { modelChat: chatM, modelVision: visM, persona: pers, style: style } });
        window.showToast("Setelan Oracle AI V3 tersimpan!");
    } catch(e) { window.showToast("Gagal menyimpan setelan AI.", true); }
};

window.addRecurringPayment = async function() {
    const name = document.getElementById('new-rec-name').value.trim();
    const amount = parseFloat(document.getElementById('new-rec-amt').value);
    const date = parseInt(document.getElementById('new-rec-date').value);
    const method = document.getElementById('new-rec-method').value;
    if(!name || isNaN(amount) || isNaN(date) || date < 1 || date > 31) return window.showToast("Lengkapi form dengan benar (Tanggal 1-31)!", true);
    const recId = 'rec_' + Date.now();
    const updates = {}; updates[`recurringPayments/${recId}`] = { name, amount, date, method, active: true };
    try {
        await window.FirebaseService.updateSettings(updates);
        document.getElementById('new-rec-name').value = ""; document.getElementById('new-rec-amt').value = ""; document.getElementById('new-rec-date').value = "";
        window.showToast("Tagihan bulanan dikonfigurasi!");
    } catch(e) { window.showToast("Gagal menambahkan tagihan.", true); }
};

window.removeRecurringPayment = async function(recId) {
    if(confirm("Hapus tagihan bulanan ini?")) {
        await remove(ref(db, `${ledgerNode}/${window.currentUserUid}/settings/recurringPayments/${recId}`));
        window.showToast("Tagihan bulanan dihapus!");
    }
};

window.renderRecurringUI = function() {
    const rPayments = window.settingsData?.recurringPayments || {};
    const entries = Object.entries(rPayments);
    
    // Ke Settings Modal
    const setList = document.getElementById('recurring-list');
    if(setList) {
        setList.innerHTML = entries.length === 0 ? '<p class="text-[10px] text-[var(--text-muted)] text-center my-2">Belum ada tagihan.</p>' : entries.map(([id, rp]) => `<div class="flex justify-between items-center bg-[var(--bg-base)] p-2 rounded-xl border border-[var(--border-glass)]"><div class="flex flex-col"><span class="font-bold text-xs text-sky-400">${rp.name}</span><span class="text-[9px] text-[var(--text-muted)] font-mono">Tgl ${rp.date} | ${rp.amount.toLocaleString()} JPY (${rp.method})</span></div><button onclick="window.removeRecurringPayment('${id}')" class="text-rose-500 p-1 hover:text-rose-400 transition active:scale-90"><i class="fa-solid fa-trash-can text-xs"></i></button></div>`).join('');
    }

    // Ke Tab Anggaran (Budgets V3)
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
    const today = new Date(); const curDate = today.getDate();
    const curMonthYearStr = `${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2, '0')}`;

    for (const [id, rp] of Object.entries(rPayments)) {
        if (curDate >= rp.date) {
            const alreadyPaid = txList.some(t => t.recurring_id === id && t.tanggal && t.tanggal.startsWith(curMonthYearStr));
            if (!alreadyPaid) {
                const timestamp = today.toISOString();
                const itemUnikId = window.generateItemId();
                const tagihanData = {
                    tanggal: timestamp.split('T')[0], createdAt: timestamp,
                    nominal: rp.amount, mata_uang: window.displayCurrency,
                    metode_pembayaran: rp.method, kategori: 'Tagihan', tipe: 'pengeluaran', sifat: 'kebutuhan',
                    merchantName: rp.name, description: `Pembayaran otomatis: ${rp.name}`, isCustomDescription: true, recurring_id: id, is_deleted: false,
                    items: [{ itemId: itemUnikId, nama_barang: rp.name, harga: rp.amount, qty: 1, kategori_barang: 'Utilitas', tax_rate: 0, paymentMethod: rp.method, timestamp: timestamp }]
                };
                try { await window.FirebaseService.saveTransaction(tagihanData); window.showToast(`Tagihan otomatis "${rp.name}" berhasil dibayarkan!`); } catch(e) {}
            }
        }
    }
};

window.syncGeminiEngine = async function(silent = false) {
    const pinInput = document.getElementById('gemini-pin-input')?.value.trim();
    const pin = silent ? localStorage.getItem('aurafi_gemini_pin') : pinInput;
    if (!pin) { if(!silent) window.showToast("HARAP MASUKKAN PIN GEMINI!", true); return; }

    const gBadge = document.getElementById('gemini-status-badge');
    if(gBadge) { gBadge.className = "text-[9px] bg-indigo-950/40 text-indigo-400 border border-indigo-900/50 px-2 py-0.5 rounded uppercase tracking-[0.1em] font-mono animate-pulse"; gBadge.innerText = "DECRYPTING..."; }
    
    try {
        const geminiEngine = new window.GeminiFailoverEngine(pin);
        const gCount = await geminiEngine.init();
        if(gCount > 0) {
            window.failoverEngineInstance = geminiEngine;
            localStorage.setItem('aurafi_gemini_pin', pin);
            if(gBadge) { gBadge.className = "text-[9px] bg-emerald-950/40 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded uppercase tracking-[0.1em] font-mono"; gBadge.innerText = `ACTIVE (${gCount})`; }
            if(!silent) window.showToast("Gemini Vision Berhasil Di-Unlock.");
        } else { throw new Error(); }
    } catch(e) {
        if(gBadge) { gBadge.className = "text-[9px] bg-red-950/40 text-rose-400 border border-red-900/50 px-2 py-0.5 rounded uppercase tracking-[0.1em] font-mono"; gBadge.innerText = "FAIL / LOCKED"; }
        if(!silent) window.showToast("Dekripsi Gagal: PIN Salah.", true);
    }
};

window.addGroqKey = async function() {
    const keyInput = document.getElementById('new-groq-key').value.trim();
    if(!keyInput.startsWith('gsk_')) return window.showToast("Format API Key Groq salah.", true);
    if(!window.EncryptionService.validate(keyInput, window.GroqService.secret)) return window.showToast("Kesalahan Enkripsi Fatal.", true);
    const enc = window.EncryptionService.encryptApiKey(keyInput, window.GroqService.secret);
    await window.FirebaseService.saveGroqKey(enc);
    document.getElementById('new-groq-key').value = ""; window.showToast("Kunci Groq tersimpan.");
};

window.removeGroqKey = async function(id) { if(confirm("Hapus kunci Groq ini?")) await window.FirebaseService.deleteGroqKey(id); };

window.renderGroqKeysUI = function() {
    const container = document.getElementById('groq-keys-container'); if(!container) return;
    const keys = window.rawGroqKeysData || [];
    if(keys.length === 0) { container.innerHTML = '<p class="text-[10px] text-[var(--text-muted)] text-center my-2">Belum ada API Key Groq.</p>'; return; }
    container.innerHTML = keys.map((k, i) => {
        const dec = window.EncryptionService.decryptApiKey(k.encryptedKey, window.GroqService.secret);
        const display = dec ? `${dec.substring(0,8)}...${dec.substring(dec.length-4)}` : `(Corrupt)`;
        const statusColor = dec ? 'text-emerald-400' : 'text-rose-400';
        return `<div class="flex justify-between items-center bg-[var(--bg-base)] p-2 rounded-xl border border-[var(--border-glass)]"><div class="flex flex-col"><span class="font-mono text-xs ${statusColor}">${display}</span><span class="text-[8px] text-[var(--text-muted)] uppercase tracking-wider">Key #${i + 1}</span></div><button onclick="window.removeGroqKey('${k.id}')" class="text-rose-500 p-1 hover:text-rose-400 active:scale-90 transition"><i class="fa-solid fa-trash text-xs"></i></button></div>`;
    }).join('');
};

window.executeAIWithFallback = async function(messages, systemPrompt, requireJson, base64Image = null) {
    const prefs = window.settingsData?.aiPreferences || {};
    const chatModel = prefs.modelChat || 'Auto'; const visionModel = prefs.modelVision || 'Auto';
    let useGroq = false; let useGemini = false;

    if (base64Image) {
        if (visionModel === 'Gemini' || visionModel === 'Auto') useGemini = true;
        else if (visionModel === 'Groq Vision') useGroq = true; 
    } else {
        if (chatModel === 'Groq') useGroq = true;
        else if (chatModel === 'Gemini') useGemini = true;
        else { useGroq = true; useGemini = true; }
    }

    let lastError = null;

    if (useGroq && window.rawGroqKeysData && window.rawGroqKeysData.length > 0) {
        try { return await window.GroqService.fetch(messages, requireJson); } 
        catch(e) { lastError = e; if (!useGemini) throw e; }
    }

    if (useGemini && window.failoverEngineInstance && window.failoverEngineInstance.keysPool.length > 0) {
        try {
            const userPrompt = messages[messages.length - 1].content;
            const geminiPayload = { contents: [{ role: "user", parts: [{ text: userPrompt }] }], systemInstruction: { parts: [{ text: systemPrompt }] } };
            if (requireJson) geminiPayload.generationConfig = { responseMimeType: "application/json" };
            return await window.failoverEngineInstance.fetch(geminiPayload, base64Image);
        } catch(e) { lastError = e; }
    }
    throw new Error(lastError ? lastError.message : "Sistem AI offline.");
};

window.processTransactionParsing = async function(text, imgData = null) {
    if (!window.currentUserUid) return;
    window.setProcessingStatus(true);
    
    try {
        let jsonResult; const activeCurrency = window.displayCurrency || 'JPY';
        const nickname = window.settingsData?.profile?.nickname || "Bos";

        // NORMALISASI PROMPT FORMAT WAJIB & TERJEMAHAN BAHASA INDONESIA
        const systemPrompt = `Kamu AuraFi OS. User: ${nickname}. Mata Uang: ${activeCurrency}.
Output HANYA RAW JSON tanpa markdown backticks (\`\`\`).
ATURAN UTAMA & AKUNTANSI STRICT:
1. "Tarik tunai 500 admin 110" -> Tipe="tarik_tunai". nominal=500, admin_fee=110. (Saldo cashless berkurang 610, tunai bertambah 500).
2. "Setor tunai 10000 admin 0" -> Tipe="setor_tunai". nominal=10000, admin_fee=0. (Saldo tunai berkurang 10000, cashless bertambah 10000).
3. PEMBAYARAN BELANJA: Tipe="pengeluaran".
4. PERKALIAN ITEM (QTY x HARGA): Pahami jumlah (x2, 2 cup, isi 2). Subtotal item = harga x qty. 'nominal' total wajib = sum(subtotal) + admin_fee.
5. KATEGORI ITEM: Setiap item WAJIB diklasifikasi dari daftar ini: "Makanan", "Minuman", "Bahan Pokok", "Utilitas", "Transportasi", "Kesehatan", "Hiburan", "Belanja Online", "Belanja Offline", "Pendidikan", "Pakaian", "Elektronik", "Lainnya". Jangan pernah kosongkan kategori.
6. NAMA BARANG: Harus diterjemahkan dan dinormalisasi ke Bahasa Indonesia. Jangan ada teks Jepang atau teks tak jelas pada nama barang.
7. NAMA TOKO: Ekstrak wajib (Misal: Lawson, Amazon). Simpan ke "merchantName".
8. DESKRIPSI: Berikan catatan jelas ke "description".

Struktur JSON WAJIB (Jangan gunakan key lain):
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
  "items": [
    {
      "name": "string (Bahasa Indonesia)",
      "category": "string (dari daftar kategori)",
      "price": number,
      "tax": number,
      "qty": number,
      "subtotal": number
    }
  ]
}`;

        const messages = [{ role: "system", content: systemPrompt }, { role: "user", content: text || "Ekstrak struk" }];
        const aiOutput = await window.executeAIWithFallback(messages, systemPrompt, true, imgData);
        jsonResult = window.parseCleanJSON(aiOutput);

        const timestamp = new Date().toISOString();
        jsonResult.items = window.sanitizeItems(jsonResult.items, jsonResult.metode_pembayaran, timestamp);

        if(!jsonResult.merchantName) jsonResult.merchantName = jsonResult.storeName || jsonResult.kategori || "Toko/Merchant";
        if(!jsonResult.mata_uang) jsonResult.mata_uang = activeCurrency;
        
        await window.FirebaseService.saveTransaction({ ...jsonResult, is_deleted: false, createdAt: timestamp });
        window.switchView('transactions'); window.showToast("Transaksi dianalisis & disimpan!");
    } catch(e) { window.showToast(e.message || "AI gagal memproses data.", true); } 
    finally { window.setProcessingStatus(false); }
};

window.processOracleChat = async function(text, base64Img = null) {
    if (!window.currentUserUid) return;
    const uiText = text || (base64Img ? "[Lampiran Gambar...]" : "");
    const pushObjId = await push(ref(db, `${ledgerNode}/${window.currentUserUid}/oracleChats`), { role: 'user', text: uiText, timestamp: new Date().toISOString() }).key;
    window.setProcessingStatus(true); 

    const summaryString = window.FinancialSummaryService.getSummaryString();
    const relevantTx = window.MemoryService.getRelevantTransactions(text);
    const nickname = window.settingsData?.profile?.nickname || "Bos";

    const txString = relevantTx.map(t => {
        let it = t.items && Array.isArray(t.items) ? `| Items:[${t.items.map(i=>`{itemId:"${i.itemId}", nama:"${i.nama_barang}", harga:${i.harga}, qty:${i.qty}}`).join(', ')}]` : ''; 
        return `ID:${t.id} | Toko:${t.merchantName || t.storeName || 'Merchant'} | Tipe:${t.tipe} | Ket:${t.description || t.catatan_ai} | Metode:${t.metode_pembayaran} | Nom:${t.nominal} ${t.mata_uang} ${it}`;
    }).join('\n');

    const { personaStr, styleStr } = window.getOraclePromptConfigs();

    const systemPrompt = `Kamu adalah AuraFi Oracle V3. Kepribadian: ${personaStr}. Nama User: ${nickname}.
Konteks Ringkas:\n${summaryString}\n\nData Relevan:\n${txString}

ATURAN UPDATE (SAFE UPDATE):
DILARANG merusak struktur array. WAJIB menggunakan "target_item_id" dari data transaksi di atas.
Ketika menghapus atau mengedit 1 item, item lain DILARANG berubah atau undefined.
KATEGORI ITEM: Wajib gunakan Makanan, Minuman, Bahan Pokok, Utilitas, Transportasi, Kesehatan, Hiburan, Belanja Online, Belanja Offline, Pendidikan, Pakaian, Elektronik, atau Lainnya. Jangan biarkan kategori kosong.
NAMA BARANG: Harus Bahasa Indonesia.
1. action="update_transaction": Merubah merchantName, metode_pembayaran, tipe (pemasukan/pengeluaran), atau nominal global.
2. action="add_item": Menambah item.
3. action="edit_item": Edit 1 item spesifik via "target_item_id".
4. action="delete_item": Hapus 1 item spesifik via "target_item_id".
5. action="moveToTrash": Hapus block "target_id".

ATURAN JAWABAN: ${styleStr}

Struktur Output JSON STRICT (Tanpa markdown):
{
  "reply": "Kalimat balasan Oracle V3 (Gunakan HTML <b>, <i>, <br> jika perlu)",
  "action": "none|moveToTrash|update_transaction|add_item|edit_item|delete_item",
  "target_id": "string",
  "target_item_id": "string",
  "update_fields": {"merchantName": "string", "metode_pembayaran": "tunai/cashless", "tipe": "pemasukan/pengeluaran", "nominal": number},
  "new_items": [{"name": "string (Bahasa Indonesia)", "category": "string (dari list)", "price": number, "tax": number, "qty": number, "subtotal": number}]
}`;

    try {
        const messages = [{ role: "system", content: systemPrompt }];
        window.MemoryService.getRelevantChats().forEach(h => { if(h.text !== uiText) messages.push({ role: h.role === 'ai' ? 'assistant' : 'user', content: h.text }); });
        messages.push({ role: "user", content: text || "Analisis..." });

        const prefs = window.settingsData?.aiPreferences || {};
        const activeModel = base64Img ? (prefs.modelVision || 'Auto') : (prefs.modelChat || 'Auto');
        
        const aiOutput = await window.executeAIWithFallback(messages, systemPrompt, true, base64Img);
        const resJson = window.parseCleanJSON(aiOutput);

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
                    const finalItems = (targetTrx.items || []).concat(window.sanitizeItems(resJson.new_items, targetTrx.metode_pembayaran, new Date().toISOString()));
                    const sum = finalItems.reduce((a,b)=>a+(b.harga*(b.qty||1)), 0);
                    const upd = { items: finalItems, nominal: sum };
                    if(!targetTrx.isCustomDescription) upd.description = `[Auto-Update] Transaksi diubah via AI. Total: ¥${sum}`;
                    await window.FirebaseService.updateTransaction(targetTrx.id, upd);
                } else if(resJson.action === 'edit_item' && targetTrx && resJson.target_item_id && resJson.new_items && resJson.new_items.length > 0) {
                    const newEditData = window.sanitizeItems(resJson.new_items, targetTrx.metode_pembayaran, new Date().toISOString())[0];
                    const finalItems = (targetTrx.items || []).map(it => {
                        if(it.itemId === resJson.target_item_id) {
                            return { ...it, nama_barang: newEditData.nama_barang, harga: newEditData.harga, qty: newEditData.qty, kategori_barang: newEditData.kategori_barang, subtotal: newEditData.subtotal };
                        }
                        return it;
                    });
                    const sum = finalItems.reduce((a,b)=>a+(b.harga*(b.qty||1)), 0);
                    const upd = { items: finalItems, nominal: sum };
                    if(!targetTrx.isCustomDescription) upd.description = `[Auto-Update] Item diedit via AI. Total: ¥${sum}`;
                    await window.FirebaseService.updateTransaction(targetTrx.id, upd);
                } else if(resJson.action === 'delete_item' && targetTrx && resJson.target_item_id) {
                    const finalItems = (targetTrx.items || []).filter(it => it.itemId !== resJson.target_item_id);
                    if(finalItems.length === 0) await window.FirebaseService.moveToTrash(targetTrx.id);
                    else {
                        const sum = finalItems.reduce((a,b)=>a+(b.harga*(b.qty||1)), 0);
                        const upd = { items: finalItems, nominal: sum };
                        if(!targetTrx.isCustomDescription) upd.description = `[Auto-Update] Item dihapus via AI. Total: ¥${sum}`;
                        await window.FirebaseService.updateTransaction(targetTrx.id, upd);
                    }
                }
            } catch(e) { resJson.reply += "<br><br><i class='text-[10px] text-rose-400'>(Gagal memproses sinkronisasi database)</i>"; }
        }

        await window.FirebaseService.pushOracleChat({role: 'ai', text: resJson.reply, timestamp: new Date().toISOString(), model: activeModel });

    } catch(e) { await window.FirebaseService.pushOracleChat({role: 'ai', text: `Gangguan transmisi: ${e.message}`, timestamp: new Date().toISOString(), model: 'Error' }); } 
    finally { window.setProcessingStatus(false); }
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
window.currentTheme = 'midnight'; window.displayCurrency = 'JPY'; window.exchangeRateIDR = 105;
window.isRatesLoaded = false; window.allTransactions = []; window.trashTransactions = []; 
window.allGoals = []; window.monthlyBudget = 100000; window.activeView = 'dashboard';
window.base64Upload = ""; window.oracleChats = []; window.deleteTargetData = null; 
window.editItemTargetData = null; window.editTrxTargetData = null; window.addItemTargetTrxId = null;
window.isProcessing = false; window.failoverEngineInstance = null; 

window.parseCleanJSON = function(text) { try { return JSON.parse(text.replace(/```json/gi, '').replace(/```/g, '').trim()); } catch (e) { throw new Error("Format JSON respon tidak valid."); } };

window.onload = () => {
    window.fetchExchangeRate(); window.applyTheme();
    const tx = document.getElementById('main-input-field');
    if (tx) { tx.addEventListener('input', function() { this.style.height = '48px'; this.style.height = (this.scrollHeight) + 'px'; }); }
};

window.fetchExchangeRate = async function() {
    try {
        const res = await fetch('https://open.er-api.com/v6/latest/JPY'); const data = await res.json();
        if(data?.rates?.IDR) { window.exchangeRateIDR = data.rates.IDR; window.isRatesLoaded = true; document.getElementById('live-rate-display').innerText = `1 JPY = Rp ${window.exchangeRateIDR.toLocaleString('id-ID')}`; }
    } catch(e) { document.getElementById('live-rate-display').innerText = "1 JPY = Rp 105 (OFFLINE)"; }
};

window.toggleTheme = function() {
    const themes = ['midnight', 'sakura', 'neon'];
    window.currentTheme = themes[(themes.indexOf(window.currentTheme) + 1) % themes.length]; window.applyTheme(); 
    if(window.FirebaseService?.updateSettings) window.FirebaseService.updateSettings({ theme: window.currentTheme });
};

window.applyTheme = function() { document.documentElement.setAttribute('data-theme', window.currentTheme); };
window.promptSettingsAccess = function() { window.showModal('modal-settings'); };
window.closeSettingsModal = function() { const m = document.getElementById('modal-settings'); if(m) { m.classList.remove('opacity-100'); setTimeout(() => m.classList.add('hidden'), 300); } };

window.toggleAccordion = function(id) {
    const el = document.getElementById(id); const icon = document.getElementById(id + '-icon');
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
    ['dashboard', 'transactions', 'analytics', 'budgets', 'oracle', 'trash'].forEach(id => {
        const el = document.getElementById(`view-${id}`); 
        if(el) { if (id === viewId) { el.classList.remove('hidden'); if (id === 'oracle') el.style.display = 'flex'; } else { el.classList.add('hidden'); el.style.display = ''; } }
    });
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if(btn.dataset.target === viewId) { btn.classList.add('text-[var(--accent-primary)]'); btn.classList.remove('text-[var(--text-muted)]'); } 
        else { btn.classList.remove('text-[var(--accent-primary)]'); btn.classList.add('text-[var(--text-muted)]'); }
    });

    const inputField = document.getElementById('main-input-field');
    if(viewId === 'oracle') { 
        inputField.placeholder = "Tanya Oracle V3 / Perintah...";
        setTimeout(() => { const anc = document.getElementById('chat-anchor'); if(anc) anc.scrollIntoView({behavior:'smooth'}); }, 100);
    } else { inputField.placeholder = "Ketik/Suara/Foto Transaksi..."; }
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

function getCategoryStyle(cat) {
    const c = (cat || "Lainnya").toLowerCase();
    if (c.includes('makan')) return { icon: 'fa-burger', color: 'text-orange-400', bg: 'bg-orange-400/10' };
    if (c.includes('minum')) return { icon: 'fa-mug-hot', color: 'text-blue-400', bg: 'bg-blue-400/10' };
    if (c.includes('pokok') || c.includes('bahan')) return { icon: 'fa-basket-shopping', color: 'text-green-400', bg: 'bg-green-400/10' };
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
function getCategoryIcon(cat) { return getCategoryStyle(cat).icon; }

// LOGIKA STATISTIK & KALKULATOR V3
window.reCalculateAll = function() {
    let totBal = 0, cashBal = 0, cashlessBal = 0;
    let thisMthSpent = 0, thisMthCashless = 0, thisMthIncome = 0, impulsif = 0;
    let catSpend = {}, dailySp = {}; let merchantSpend = {};
    const today = new Date();
    
    for(let i=6; i>=0; i--) { let d=new Date(today); d.setDate(d.getDate()-i); dailySp[d.toISOString().split('T')[0]] = 0; }
    let groupedTrx = {};

    const txList = window.allTransactions || [];
    txList.forEach(trx => {
        const val = convertVal(trx.nominal, trx.mata_uang);
        const isCash = trx.metode_pembayaran === 'tunai';
        
        const dStrRaw = trx.createdAt || trx.tanggal;
        const dStr = dStrRaw ? dStrRaw.split('T')[0] : '';
        const d = new Date(dStrRaw || trx.tanggal); 
        
        let timeFormatted = "";
        if (trx.createdAt) {
            const dObjFull = new Date(trx.createdAt);
            if(!isNaN(dObjFull)) {
                const yr = dObjFull.getFullYear(); const mo = String(dObjFull.getMonth()+1).padStart(2,'0'); const da = String(dObjFull.getDate()).padStart(2,'0');
                const hr = String(dObjFull.getHours()).padStart(2,'0'); const mi = String(dObjFull.getMinutes()).padStart(2,'0');
                timeFormatted = `${yr}/${mo}/${da} ${hr}:${mi}`;
            }
        } else { timeFormatted = (trx.tanggal || "---") + " 00:00"; }
        
        if(!groupedTrx[dStr]) groupedTrx[dStr] = { total: 0, items: [] };

        if(trx.tipe === 'pemasukan') {
            totBal += val; if(isCash) cashBal += val; else cashlessBal += val; 
            groupedTrx[dStr].total += val;
            if(!isNaN(d) && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) thisMthIncome += val;
        } else if (trx.tipe === 'tarik_tunai') {
            let adminFee = Number(trx.admin_fee || 0);
            if (!adminFee && trx.items && Array.isArray(trx.items)) {
                const adminItem = trx.items.find(i => i.nama_barang.toLowerCase().includes('admin'));
                if (adminItem) adminFee = Number(adminItem.harga * (adminItem.qty || 1));
            }
            const feeVal = convertVal(adminFee, trx.mata_uang); const mainVal = convertVal(trx.nominal, trx.mata_uang);
            totBal -= feeVal; cashBal += mainVal; cashlessBal -= (mainVal + feeVal); 
            groupedTrx[dStr].total -= feeVal;
            if(!isNaN(d) && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) { thisMthSpent += feeVal; thisMthCashless += feeVal; catSpend['Utilitas'] = (catSpend['Utilitas']||0) + feeVal; }
        } else if (trx.tipe === 'setor_tunai') {
            let adminFee = Number(trx.admin_fee || 0);
            if (!adminFee && trx.items && Array.isArray(trx.items)) {
                const adminItem = trx.items.find(i => i.nama_barang.toLowerCase().includes('admin'));
                if (adminItem) adminFee = Number(adminItem.harga * (adminItem.qty || 1));
            }
            const feeVal = convertVal(adminFee, trx.mata_uang); const mainVal = convertVal(trx.nominal, trx.mata_uang);
            totBal -= feeVal; cashBal -= mainVal; cashlessBal += mainVal; cashlessBal -= feeVal; 
            groupedTrx[dStr].total -= feeVal;
            if(!isNaN(d) && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) { thisMthSpent += feeVal; thisMthCashless += feeVal; catSpend['Utilitas'] = (catSpend['Utilitas']||0) + feeVal; }
        } else {
            totBal -= val; if(isCash) cashBal -= val; else cashlessBal -= val; 
            groupedTrx[dStr].total -= val;
            if(trx.sifat === 'impulsif') impulsif++;
            if(!isNaN(d) && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) {
                thisMthSpent += val; if(!isCash) thisMthCashless += val;
                
                const merc = trx.merchantName || trx.storeName || 'Lainnya';
                merchantSpend[merc] = (merchantSpend[merc] || 0) + val;

                if (trx.items && Array.isArray(trx.items) && trx.items.length > 0) {
                    let calcItemSum = 0;
                    trx.items.forEach(it => {
                        const itemCat = it.kategori_barang || 'Lainnya'; const itemVal = convertVal(it.harga * (it.qty || 1), trx.mata_uang);
                        calcItemSum += itemVal; catSpend[itemCat] = (catSpend[itemCat] || 0) + itemVal;
                    });
                    if (val > calcItemSum) { const diff = val - calcItemSum; catSpend['Lainnya'] = (catSpend['Lainnya'] || 0) + diff; }
                } else { const c = trx.kategori || 'Lainnya'; catSpend[c] = (catSpend[c]||0) + val; }
            }
            if(dailySp[dStr] !== undefined) dailySp[dStr] += val;
        }
        trx.displayTime = timeFormatted;
        groupedTrx[dStr].items.push(trx);
    });

    document.getElementById('dash-total-balance').innerText = formatVal(totBal);
    document.getElementById('dash-cash').innerText = formatVal(cashBal);
    document.getElementById('dash-cashless').innerText = formatVal(cashlessBal);
    
    const dInc = document.getElementById('dash-income-mth'); if(dInc) dInc.innerText = "+" + formatVal(thisMthIncome);
    const dExp = document.getElementById('dash-expense-mth'); if(dExp) dExp.innerText = "-" + formatVal(thisMthSpent);
    
    const limitVal = convertVal(window.monthlyBudget, 'JPY');
    const burnPct = limitVal > 0 ? (thisMthSpent / limitVal) * 100 : 0;
    const remainingBudget = limitVal - thisMthSpent;
    
    if (window.FirebaseService && window.currentUserUid) {
        clearTimeout(window.budgetUpdateTimer);
        window.budgetUpdateTimer = setTimeout(() => { window.FirebaseService.updateSettings({ monthlyBudget: { limit: window.monthlyBudget, spent: thisMthSpent, remaining: remainingBudget, percentage: burnPct.toFixed(2) } }); }, 5000);
    }

    const core = document.getElementById('living-core'); if (core) { core.className = `w-48 h-48 rounded-full living-core ${burnPct > 90 ? 'danger' : ''} flex flex-col items-center justify-center relative overflow-hidden`; }
    const bProg = document.getElementById('burn-progress'); if (bProg) { bProg.style.width = `${Math.min(burnPct, 100)}%`; bProg.style.backgroundColor = burnPct > 90 ? 'var(--color-expense)' : 'var(--color-income)'; }
    
    const sp = document.getElementById('burn-spent'); if (sp) sp.innerText = `Terpakai: ${formatVal(thisMthSpent)}`;
    const lm = document.getElementById('burn-limit'); if (lm) lm.innerText = `Limit: ${formatVal(limitVal)}`;

    const daysInMth = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
    const proj = (today.getDate() > 0 ? thisMthSpent / today.getDate() : 0) * daysInMth;
    
    const dAvg = document.getElementById('stats-daily-avg'); if (dAvg) dAvg.innerText = formatVal(today.getDate() > 0 ? thisMthSpent / today.getDate() : 0);
    const dProj = document.getElementById('stats-proj-mth'); if (dProj) dProj.innerText = formatVal(proj);
    
    const insightBox = document.getElementById('burn-insight-box');
    if (insightBox) {
        if(proj > limitVal) { insightBox.innerHTML = `<span class="text-[var(--color-expense)] font-bold"><i class="fa-solid fa-triangle-exclamation"></i> BAHAYA:</span> Proyeksi akhir bulan mencapai ${formatVal(proj)}! Kurangi laju pengeluaran.`; insightBox.style.borderColor = 'var(--color-expense)'; } 
        else { insightBox.innerHTML = `<span class="text-[var(--color-income)] font-bold"><i class="fa-solid fa-circle-check"></i> AMAN:</span> Pengeluaran stabil. Prediksi akhir bulan: ${formatVal(proj)}.<br><span class="text-[9px] mt-1 text-[var(--text-muted)]">Sisa Anggaran Harian: ${formatVal(remainingBudget / (daysInMth - today.getDate() + 1))}</span>`; insightBox.style.borderColor = 'var(--border-glass)'; }
    }

    // STATS V3: KATEGORI & PIE CHART
    const topCatDiv = document.getElementById('top-categories-list');
    const pieChart = document.getElementById('category-pie-chart');
    const pieTotal = document.getElementById('pie-total-label');
    const catSorted = Object.entries(catSpend).sort((a,b)=>b[1]-a[1]);
    
    if (topCatDiv && pieChart) {
        let pieCSS = ""; let currentPct = 0;
        
        if (catSorted.length === 0) {
            topCatDiv.innerHTML = '<p class="text-xs text-[var(--text-muted)] text-center">Belum ada data bulan ini.</p>';
            pieChart.style.background = 'conic-gradient(var(--border-glass) 0% 100%)';
            if(pieTotal) pieTotal.innerText = "0";
        } else {
            if(pieTotal) pieTotal.innerText = formatVal(thisMthSpent);
            topCatDiv.innerHTML = catSorted.map(([c,v]) => {
                const style = getCategoryStyle(c);
                const pct = thisMthSpent > 0 ? ((v/thisMthSpent)*100) : 0;
                
                let hexColor = '#94a3b8'; // default
                if(style.color.includes('orange')) hexColor = '#fb923c';
                else if(style.color.includes('blue')) hexColor = '#60a5fa';
                else if(style.color.includes('green')) hexColor = '#4ade80';
                else if(style.color.includes('yellow')) hexColor = '#facc15';
                else if(style.color.includes('emerald')) hexColor = '#34d399';
                else if(style.color.includes('rose')) hexColor = '#fb7185';
                else if(style.color.includes('purple')) hexColor = '#c084fc';
                else if(style.color.includes('pink')) hexColor = '#f472b6';
                else if(style.color.includes('indigo')) hexColor = '#818cf8';
                else if(style.color.includes('cyan')) hexColor = '#22d3ee';
                else if(style.color.includes('fuchsia')) hexColor = '#e879f9';

                pieCSS += `${hexColor} ${currentPct}% ${currentPct + pct}%, `;
                currentPct += pct;

                return `<div class="flex justify-between items-center text-sm border-b border-[var(--border-glass)] pb-2.5 last:border-0 last:pb-0 hover:bg-white/5 transition px-2 rounded-xl">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full ${style.bg} flex items-center justify-center border border-[var(--border-glass)] shadow-sm">
                            <i class="fa-solid ${style.icon} ${style.color}"></i>
                        </div>
                        <div>
                            <p class="font-bold text-[var(--text-main)]">${c}</p>
                            <div class="w-24 h-1.5 bg-black/40 rounded-full mt-1 overflow-hidden">
                                <div class="h-full" style="width: ${pct.toFixed(0)}%; background-color: ${hexColor}"></div>
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="font-mono text-xs font-bold text-[var(--text-main)]">${formatVal(v)}</p>
                        <p class="text-[9px] text-[var(--text-muted)] font-bold mt-0.5">${pct.toFixed(1)}%</p>
                    </div>
                </div>`;
            }).join('');
            
            pieCSS = pieCSS.slice(0, -2);
            pieChart.style.background = `conic-gradient(${pieCSS})`;
        }
    }

    // TOP MERCHANTS V3
    const mercDiv = document.getElementById('top-merchants-list');
    if (mercDiv) {
        const mercSorted = Object.entries(merchantSpend).sort((a,b)=>b[1]-a[1]).slice(0, 5);
        mercDiv.innerHTML = mercSorted.length === 0 ? '<p class="text-xs text-[var(--text-muted)] text-center">Belum ada merchant langganan.</p>' : mercSorted.map(([m, v], i) => `
            <div class="flex justify-between items-center p-3 bg-white/5 border border-[var(--border-glass)] rounded-xl">
                <div class="flex items-center gap-3">
                    <div class="w-6 h-6 rounded-md bg-black/40 border border-[var(--border-glass)] flex items-center justify-center text-[10px] font-black text-[var(--text-muted)]">#${i+1}</div>
                    <span class="font-bold text-sm truncate max-w-[120px]">${m}</span>
                </div>
                <span class="font-mono text-xs font-bold text-orange-400">${formatVal(v)}</span>
            </div>
        `).join('');
    }

    // LOG TRANSAKSI V3
    const trxListContainer = document.getElementById('trx-list-container');
    if (trxListContainer) {
        trxListContainer.innerHTML = Object.keys(groupedTrx).length === 0 ? '<p class="text-center text-[var(--text-muted)] mt-10">Ekosistem bersih. Belum ada rekam jejak.</p>' : Object.keys(groupedTrx).sort((a,b)=>new Date(b)-new Date(a)).map(dateStr => {
            const g = groupedTrx[dateStr]; const dObj = new Date(dateStr);
            return `<div class="mb-5"><div class="flex justify-between items-end mb-3 border-b border-[var(--border-glass)] pb-1.5"><div class="flex items-baseline gap-2"><span class="text-2xl font-display font-black leading-none text-white">${!isNaN(dObj)?dObj.getDate().toString().padStart(2,'0'):'--'}</span><span class="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-extrabold">${!isNaN(dObj)?dObj.toLocaleDateString('id-ID', {weekday:'short', month:'short'}):'---'}</span></div><span class="text-xs font-mono font-bold ${g.total>=0 ? 'text-[var(--color-income)]':'text-[var(--text-main)]'} shadow-sm bg-black/40 px-2 py-0.5 rounded-md border border-[var(--border-glass)]">${g.total>=0?'+':''}${formatVal(g.total)}</span></div><div class="space-y-4">${g.items.map(t => {
                const isExp = expItemsState[t.id]; const hasItems = t.items && Array.isArray(t.items) && t.items.length > 0;
                
                const isTarikTunai = t.tipe === 'tarik_tunai'; const isSetorTunai = t.tipe === 'setor_tunai';
                
                let typeBadgeBg = "bg-rose-500/20"; let typeBadgeColor = "text-rose-400"; let typeText = "PENGELUARAN"; let signChar = "-";
                if (t.tipe === 'pemasukan') { typeBadgeBg = "bg-emerald-500/20"; typeBadgeColor = "text-emerald-400"; typeText = "PEMASUKAN"; signChar = "+"; }
                else if (isTarikTunai) { typeBadgeBg = "bg-sky-500/20"; typeBadgeColor = "text-sky-400"; typeText = "TARIK TUNAI"; signChar = "⇄"; }
                else if (isSetorTunai) { typeBadgeBg = "bg-sky-500/20"; typeBadgeColor = "text-sky-400"; typeText = "SETOR TUNAI"; signChar = "⇄"; }

                const titleDisp = t.merchantName || t.storeName || t.kategori || "Transaksi";
                const descDisp = t.description || t.catatan_ai || "";
                
                // Collect unique categories in this trx
                let catBadges = "";
                if (hasItems) {
                    const uniqueCats = [...new Set(t.items.map(it => it.kategori_barang || 'Lainnya'))];
                    catBadges = uniqueCats.map(cat => {
                        const style = getCategoryStyle(cat);
                        return `<span class="inline-flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded-md border border-[var(--border-glass)] text-[var(--text-muted)] bg-black/30"><i class="fa-solid ${style.icon} ${style.color}"></i> ${cat}</span>`;
                    }).join(' ');
                }

                return `<div class="glass-panel p-4 relative group transition-all duration-300 hover:border-white/20 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] border-l-4 border-l-[var(--border-glass)]" style="border-left-color: ${t.tipe==='pemasukan'?'var(--color-income)':(isTarikTunai||isSetorTunai)?'#38bdf8':'var(--color-expense)'}">
                    
                    <div class="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--bg-glass)] backdrop-blur-md rounded-lg border border-[var(--border-glass)] p-1 z-10 shadow-xl">
                        <button onclick="window.openEditTrxModal('${t.id}')" class="w-7 h-7 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-accent hover:bg-white/10 active:scale-90 transition" title="Edit Transaksi"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="window.confirmDelTrx('${t.id}')" class="w-7 h-7 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--color-expense)] hover:bg-white/10 active:scale-90 transition" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                    </div>

                    <div class="flex justify-between items-start mb-3">
                        <div class="pr-10">
                            <h4 class="font-bold text-base text-[var(--text-main)] truncate max-w-[200px] leading-tight">${titleDisp}</h4>
                            <div class="flex flex-wrap gap-1.5 mt-1.5">
                                <span class="text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-full ${typeBadgeBg} ${typeBadgeColor}">${typeText}</span>
                                <span class="text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-full bg-white/10 text-gray-300 border border-white/5"><i class="fa-solid ${t.metode_pembayaran==='tunai'?'fa-money-bill':'fa-credit-card'} mr-0.5"></i> ${t.metode_pembayaran}</span>
                            </div>
                        </div>
                        <div class="text-right shrink-0">
                            <p class="font-bold text-lg font-mono ${typeBadgeColor}">${signChar}${formatVal(convertVal(t.nominal, t.mata_uang))}</p>
                            <p class="text-[8px] text-[var(--text-muted)] font-mono mt-0.5">${t.displayTime}</p>
                        </div>
                    </div>
                    
                    ${descDisp ? `<div class="bg-black/30 p-2.5 rounded-xl text-xs text-[var(--text-main)] leading-relaxed border border-[var(--border-glass)] mb-3 shadow-inner"><i class="fa-solid fa-quote-left text-accent opacity-50 mr-1 text-[10px]"></i> ${descDisp}</div>` : ''}
                    
                    ${catBadges ? `<div class="flex flex-wrap gap-1.5 mb-3">${catBadges}</div>` : ''}

                    ${hasItems ? `<div class="pt-2 border-t border-[var(--border-glass)]"><div class="flex justify-between items-center"><button onclick="window.toggleReceipt('${t.id}')" class="flex-1 text-left text-[9px] text-[var(--text-muted)] font-black uppercase tracking-wider py-1.5 flex items-center gap-1.5 hover:text-white transition"><span><i class="fa-solid fa-list-check"></i> ${t.items.length} Item Detail</span> <i class="fa-solid fa-chevron-${isExp?'up':'down'}"></i></button><button onclick="window.openAddItemModal('${t.id}')" class="bg-white/10 border border-[var(--border-glass)] hover:bg-white/20 px-2.5 py-1 rounded-md text-[8px] font-bold text-white transition active:scale-95 shadow-sm">+ ADD ITEM</button></div><div class="${isExp?'block':'hidden'} mt-2.5 space-y-2 relative before:content-[''] before:absolute before:left-3 before:top-0 before:bottom-0 before:w-px before:bg-[var(--border-glass)]">${t.items.map((it) => {
                        const safeItemId = it.itemId || window.generateItemId();
                        const stItem = getCategoryStyle(it.kategori_barang);
                        return `<div class="flex justify-between items-center text-xs bg-black/40 p-2.5 rounded-xl group/it border border-[var(--border-glass)] ml-6 relative"><div class="absolute -left-3 top-1/2 w-3 h-px bg-[var(--border-glass)]"></div><div class="flex-1 truncate"><div class="flex items-center gap-1.5 mb-0.5"><i class="fa-solid ${stItem.icon} ${stItem.color} text-[10px]"></i> <span class="text-[var(--text-main)] font-semibold truncate">${it.nama_barang}</span></div> <div class="flex items-center gap-1.5"><span class="text-[9px] text-[var(--text-muted)] font-mono font-bold bg-white/5 px-1 rounded">${formatVal(convertVal(it.harga, t.mata_uang))} x ${it.qty}</span> ${it.tax_rate ? `<span class="text-[8px] bg-rose-950/40 text-rose-400 px-1 rounded font-mono border border-rose-900 shadow-sm">${it.tax_rate}% Tax</span>` : ''}</div></div><div class="text-right flex flex-col items-end justify-center"><span class="font-mono font-bold text-[var(--text-main)] text-sm mr-1 shadow-sm">${formatVal(convertVal(it.harga*(it.qty||1), t.mata_uang))}</span><div class="flex gap-1 mt-1 opacity-100 md:opacity-0 group-hover/it:opacity-100 transition"><button onclick="window.openEditItem('${t.id}', '${safeItemId}')" class="text-accent bg-accent/10 hover:bg-accent/20 px-2 py-0.5 rounded text-[10px] transition"><i class="fa-solid fa-pen"></i> Edit</button><button onclick="window.confirmDelItem('${t.id}', '${safeItemId}')" class="text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 rounded text-[10px] transition"><i class="fa-solid fa-xmark"></i></button></div></div></div>`;
                    }).join('')}</div></div>` : `<div class="pt-2 border-t border-[var(--border-glass)]"><button onclick="window.openAddItemModal('${t.id}')" class="bg-black/40 border border-[var(--border-glass)] w-full py-2 rounded-xl text-[10px] font-bold text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition shadow-sm border-dashed"><i class="fa-solid fa-plus mr-1"></i> TAMBAH DETAIL ITEM</button></div>`}</div>`
            }).join('')}</div></div>`
        }).join('');
    }

    const c7d = document.getElementById('chart-7days');
    if (c7d) {
        const maxDSp2 = Math.max(...Object.values(dailySp), 1);
        c7d.innerHTML = Object.entries(dailySp).map(([dStr, v]) => `<div class="flex flex-col items-center flex-1 group relative h-full justify-end"><div class="absolute -top-7 bg-black text-white text-[9px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 z-10 whitespace-nowrap transition-all duration-200 pointer-events-none shadow-lg border border-[var(--border-glass)]">${formatVal(v)}</div><div class="w-full rounded-t-md transition-all duration-1000 ${dStr === today.toISOString().split('T')[0]?'bg-gradient-to-t from-[var(--bg-base)] to-accent':'bg-white/10'} shadow-[0_0_10px_rgba(56,189,248,0.1)]" style="height: ${v===0?4:(v/maxDSp2)*100}%"></div><span class="text-[8px] text-[var(--text-muted)] mt-2 font-mono font-bold">${dStr.split('-')[2]}/${dStr.split('-')[1]}</span></div>`).join('');
    }

    const gCon = document.getElementById('goals-list-container');
    if (gCon) {
        const glList = window.allGoals || [];
        gCon.innerHTML = glList.length === 0 ? '<p class="text-center text-[var(--text-muted)] text-xs">Belum ada misi. Tambah misi baru di atas!</p>' : glList.map(g => {
            const targetVal = convertVal(g.targetAmount, g.currency);
            const diffDays = Math.ceil((new Date(g.targetDate) - new Date()) / (1000 * 3600 * 24));
            const daily = diffDays > 0 ? targetVal/diffDays : 0;
            return `<div class="glass-panel p-4 relative overflow-hidden group"><button onclick="window.confirmDelGoal('${g.id}')" class="absolute top-2 right-2 text-rose-500 hover:text-white p-2 opacity-0 group-hover:opacity-100 transition"><i class="fa-solid fa-trash text-xs"></i></button><h4 class="font-bold text-sm mb-1 text-[var(--accent-primary)]"><i class="fa-solid fa-star mr-1"></i> ${g.name}</h4><p class="text-[9px] text-[var(--text-muted)] mb-3 uppercase tracking-wider font-extrabold">Target: ${formatVal(targetVal)} • Max: ${g.targetDate}</p><div class="bg-black/50 rounded-xl p-3 flex justify-between items-center border border-[var(--border-glass)] shadow-inner"><div><p class="text-[8px] text-[var(--text-muted)] uppercase mb-0.5 font-extrabold">Tabungan Harian</p><p class="font-mono text-accent font-bold text-sm">${diffDays>0?formatVal(daily):'TARGET LEWAT'}</p></div><div class="text-right"><p class="text-[8px] text-[var(--text-muted)] uppercase mb-0.5 font-extrabold">Sisa Waktu</p><p class="font-bold text-xs text-white">${diffDays>0?diffDays+' Hari':'-'}</p></div></div></div>`;
        }).join('');
    }

    const trCon = document.getElementById('trash-list-container');
    if (trCon) {
        const trashList = window.trashTransactions || [];
        trCon.innerHTML = trashList.length === 0 ? '<p class="text-center text-[var(--text-muted)] text-xs mt-10">Tempat sampah kosong.</p>' : trashList.map(t => `<div class="glass-panel p-4 flex justify-between items-center opacity-70 hover:opacity-100 transition border border-dashed border-[var(--border-glass)]"><div><h4 class="font-bold text-xs line-through text-[var(--text-muted)]">${t.merchantName || t.storeName || t.kategori}</h4><p class="text-[9px] text-[var(--text-muted)] font-mono">${t.deletedAt?.split('T')[0]}</p></div><div class="flex items-center gap-2"><span class="font-mono text-xs text-[var(--text-muted)] line-through mr-2">${formatVal(convertVal(t.nominal, t.mata_uang))}</span><button onclick="window.restoreTransaction('${t.id}')" class="bg-emerald-500/20 text-emerald-400 p-2 rounded-lg active:scale-90 transition shadow-lg"><i class="fa-solid fa-rotate-left text-xs"></i></button><button onclick="window.deleteForever('${t.id}')" class="bg-rose-500/20 text-rose-400 p-2 rounded-lg active:scale-90 transition shadow-lg"><i class="fa-solid fa-xmark text-xs"></i></button></div></div>`).join('');
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
    
    txtField.value = ""; txtField.style.height = '48px'; window.removeImage();
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
        chatBox.innerHTML += `<div class="flex justify-start"><div class="bubble-ai glass-panel p-4 rounded-2xl flex gap-1.5 items-center shadow-lg border-l-2 border-l-accent"><div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce"></div><div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce delay-100"></div><div class="w-1.5 h-1.5 bg-accent rounded-full animate-bounce delay-200"></div></div></div>`;
    }
    setTimeout(() => { const anc = document.getElementById('chat-anchor'); if(anc) anc.scrollIntoView({behavior:'smooth'}); }, 50);
};

window.showToast = function(msg, isError = false) {
    const container = document.getElementById('toast-container'); if(!container) return;
    const toast = document.createElement('div');
    const icon = isError ? '<i class="fa-solid fa-triangle-exclamation text-[var(--color-expense)]"></i>' : '<i class="fa-solid fa-check text-accent"></i>';
    toast.className = `glass-panel p-3.5 flex items-center gap-2.5 text-xs font-bold shadow-2xl animate-[slideUp_0.4s_ease-out] border border-[var(--border-glass)] ${isError ? 'border-b-4 border-b-[var(--color-expense)]' : 'border-b-4 border-b-accent'} bg-black/90 backdrop-blur-3xl`;
    toast.innerHTML = `${icon} <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('opacity-0', 'translate-y-[-10px]'); setTimeout(()=>toast.remove(), 300); }, 3400);
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
    
    // Set Date & Time
    const dObj = new Date(trx.createdAt || trx.tanggal);
    const dateEl = document.getElementById('edit-global-date');
    const timeEl = document.getElementById('edit-global-time');
    if(dateEl && !isNaN(dObj)) dateEl.value = dObj.toISOString().split('T')[0];
    if(timeEl && !isNaN(dObj)) timeEl.value = `${String(dObj.getHours()).padStart(2,'0')}:${String(dObj.getMinutes()).padStart(2,'0')}`;

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
    const dateEl = document.getElementById('edit-global-date') ? document.getElementById('edit-global-date').value : null;
    const timeEl = document.getElementById('edit-global-time') ? document.getElementById('edit-global-time').value : null;

    const updates = { merchantName: storeName, storeName: storeName, mata_uang: curr, metode_pembayaran: method, nominal: nominal, tipe: tipe };
    if (desc !== "") { updates.description = desc; updates.catatan_ai = desc; updates.isCustomDescription = true; }
    
    if (dateEl) {
        const h = timeEl ? timeEl.split(':')[0] : '00'; const m = timeEl ? timeEl.split(':')[1] : '00';
        const newD = new Date(`${dateEl}T${h}:${m}:00`).toISOString();
        updates.createdAt = newD; updates.tanggal = dateEl;
    }

    try { await window.FirebaseService.updateTransaction(trxId, updates); window.closeEditTrxModal(); window.showToast("Perubahan Global Tersimpan!"); } 
    catch(e) { window.showToast("Gagal mengupdate.", true); }
};

window.openAddItemModal = function(trxId) {
    window.addItemTargetTrxId = trxId;
    document.getElementById('add-item-name').value = ""; document.getElementById('add-item-qty').value = "1"; document.getElementById('add-item-price').value = "";
    const catSel = document.getElementById('add-item-cat'); if(catSel) catSel.value = "Lainnya";
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

    const newItem = { itemId: window.generateItemId(), nama_barang: name, harga: price, qty: qty, kategori_barang: cat, tax_rate: 0, paymentMethod: trx.metode_pembayaran, timestamp: new Date().toISOString() };
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
    
    // Inject custom categories combo if it exists in HTML
    const catSel = document.getElementById('edit-item-cat');
    if(catSel) {
        const cats = ["Makanan", "Minuman", "Bahan Pokok", "Utilitas", "Transportasi", "Kesehatan", "Hiburan", "Belanja Online", "Belanja Offline", "Pendidikan", "Pakaian", "Elektronik", "Lainnya"];
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
        const catSelEl = document.getElementById('edit-item-cat');
        const nItems = trx.items.map(it => {
            if (it.itemId === window.editItemTargetData.itemId) {
                const updatedPrice = parseFloat(document.getElementById('edit-item-price').value) || 0;
                const updatedQty = parseFloat(document.getElementById('edit-item-qty').value) || 1;
                return {
                    ...it,
                    nama_barang: document.getElementById('edit-item-name').value, 
                    qty: updatedQty, 
                    harga: updatedPrice,
                    kategori_barang: catSelEl ? catSelEl.value : (it.kategori_barang || 'Lainnya'),
                    subtotal: updatedPrice * updatedQty
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
        await window.FirebaseService.updateTransaction(id, { is_deleted: false, deletedAt: null }); window.showToast("Dikembalikan dari sampah.");
    }
};

window.deleteForever = async function(id) {
    if(window.FirebaseService?.deleteTransactionPermanently) {
        await window.FirebaseService.deleteTransactionPermanently(id); window.showToast("Dihapus permanen.");
    }
};

window.promptBudget = function() {
    const amt = prompt("Masukkan Limit Anggaran Bulanan Baru (dalam JPY):", window.monthlyBudget);
    if(amt && !isNaN(amt)) { 
        window.monthlyBudget = parseFloat(amt);
        if(window.FirebaseService?.updateSettings) { window.FirebaseService.updateSettings({ monthlyBudget: { limit: window.monthlyBudget } }); }
        window.reCalculateAll(); 
    }
};

window.toggleGoalForm = function() { const f = document.getElementById('goal-form'); if(f) f.classList.toggle('hidden'); };

window.saveGoal = async function() {
    const name = document.getElementById('goal-name').value; const amt = document.getElementById('goal-target').value; const dt = document.getElementById('goal-date').value;
    if(!name || !amt || !dt) return window.showToast("Harap lengkapi semua form!", true);
    if(window.FirebaseService?.saveGoal) {
        await window.FirebaseService.saveGoal({ name, targetAmount: parseFloat(amt), targetDate: dt, currency: window.displayCurrency });
        document.getElementById('goal-form').classList.add('hidden');
        document.getElementById('goal-name').value = ""; document.getElementById('goal-target').value = ""; document.getElementById('goal-date').value = "";
        window.showToast("Misi Tabungan Tersimpan!");
    }
};

window.downloadCSV = function() {
    let csv = "Tanggal,Waktu_Dibuat,Store,Tipe,Metode,Kategori,Nominal_Asli,Mata_Uang,Detail_Item,Deskripsi\n";
    window.allTransactions.forEach(r => {
        const d = r.tanggal?.split('T')[0] || ''; const created = r.createdAt || '';
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
        if(window.activeView === 'trash') { if(window.FirebaseService?.deleteTransactionPermanently) await window.FirebaseService.deleteTransactionPermanently(window.deleteTargetData.id); } 
        else { if(window.FirebaseService?.moveToTrash) await window.FirebaseService.moveToTrash(window.deleteTargetData.id); }
    } else if(window.deleteTargetData.type === 'goal') {
        if(window.FirebaseService?.deleteGoal) await window.FirebaseService.deleteGoal(window.deleteTargetData.id);
    } else if(window.deleteTargetData.type === 'item') {
        const trx = window.allTransactions.find(t=>t.id === window.deleteTargetData.id);
        if(trx && window.FirebaseService?.updateTransaction) {
            const nItems = trx.items.filter(item => item.itemId !== window.deleteTargetData.itemId);
            if(nItems.length === 0) { if(window.FirebaseService?.moveToTrash) await window.FirebaseService.moveToTrash(trx.id); } 
            else { 
                const sum = nItems.reduce((a,b)=>a+(b.harga*(b.qty||1)), 0);
                const upd = { items: nItems, nominal: sum };
                if (!trx.isCustomDescription) { upd.description = `[Auto-Update] Item dihapus. Total terbaru: ${formatVal(sum)}.`; upd.catatan_ai = upd.description; }
                await window.FirebaseService.updateTransaction(trx.id, upd); 
            }
        }
    }
    window.closeConfirmModal(); window.showToast("Perubahan Berhasil Disinkronkan.");
};

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .then((registration) => { console.log("Service Worker aktif:", registration.scope); })
      .catch((error) => { console.log("Service Worker gagal:", error); });
  });
}