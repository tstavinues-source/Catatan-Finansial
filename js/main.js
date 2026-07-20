/**
 * ============================================================================
 * AURAFI OS - ENTRY POINT (main.js)
 * ============================================================================
 * Mengorkestrasi seluruh modul, error handling, inisialisasi awal sistem,
 * serta registrasi PWA Service Worker untuk instalasi mobile.
 */

// 1. Core & Config Imports
import { APP_CONFIG } from './config/constants.js';
import { Logger } from './core/logger.js';
import { AuraState } from './core/state.js';
import { AuraUtils } from './core/utils.js';

// ============================================================================
// MESIN FORMAT KURS DINAMIS (MEMPERBAIKI DESIMAL & DOUBLE MULTIPLICATION)
// ============================================================================

// 1. FORMATTER MURNI (Untuk Dashboard & UI yang sudah mengalikan kurs sendiri)
window.formatAuraCurrency = function(amount, explicitCurr) {
    const curr = explicitCurr || AuraState.system?.displayCurrency || 'JPY';
    const num = Math.round(Number(amount) || 0); // Pembulatan mutlak (hapus desimal)
    
    if (curr === 'IDR') {
        return 'Rp ' + num.toLocaleString('id-ID');
    } else {
        return '¥' + num.toLocaleString('en-US');
    }
};

// Pasang override ke utils bawaan
if (window.AuraUtils) {
    window.AuraUtils.formatCurrency = window.formatAuraCurrency;
}

// 2. KONVERTER + FORMATTER (Khusus untuk Statistik & Modul yang butuh dikalikan)
window.convertAndFormatCurrency = function(amount) {
    const num = Number(amount) || 0;
    const curr = AuraState.system?.displayCurrency || 'JPY';
    const rate = (curr === 'IDR') ? (AuraState.system?.exchangeRate || 110.27) : 1;
    
    const finalAmount = Math.round(num * rate); // Kalikan kurs & bulatkan
    
    if (curr === 'IDR') {
        return 'Rp ' + finalAmount.toLocaleString('id-ID');
    } else {
        return '¥' + finalAmount.toLocaleString('en-US');
    }
};

// 2. Services & Modules Imports
import './services/firebase.js';
import './modules/categories.js';
import './modules/analytics.js';
import { WalletManager } from './modules/wallets.js';

// 3. Renderers Imports
import './renderers/dashboard.js';
import './renderers/modals.js';

// 4. AI Engines Imports
import './services/memory.js';
import './services/ai/groq.js';
import './services/ai/gemini.js';
import './services/ai/orchestrator.js';

// 5. Handlers Imports
import './handlers/auth.js'; 
import './handlers/navigation.js'; 
import './handlers/transactions.js';
import './handlers/confirm.js'; 
import './handlers/goals.js';   
import './handlers/settings-ui.js'; 
import './handlers/import-export.js';
import './modules/staging.js';
import './modules/onboarding.js';
import './handlers/input.js';
import './handlers/telegram.js';
import './renderers/oracle.js';
import './tools/migrateMutasi.js';


// ============================================================================
// GLOBAL ERROR HANDLERS
// ============================================================================
window.addEventListener('error', function(event) {
    Logger.error('Global', 'Unhandled Exception Caught:', event.error || event.message);
});

window.addEventListener('unhandledrejection', function(event) {
    Logger.error('Global', 'Unhandled Promise Rejection:', event.reason);
});

// ============================================================================
// GLOBAL UI & PROCESSING FUNCTIONS
// ============================================================================

window.setProcessingStatus = function(isProcessing) {
    AuraState.system.isProcessing = isProcessing;
    const btnSend = document.getElementById('btn-send-main');
    const iconSend = document.getElementById('icon-send');
    
    if (btnSend && iconSend) {
        if (isProcessing) {
            btnSend.disabled = true;
            iconSend.className = "fa-solid fa-circle-notch animate-spin text-base";
        } else {
            btnSend.disabled = false;
            iconSend.className = "fa-solid fa-paper-plane text-base";
        }
    }
};

window.showToast = function(message, isError = false) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `p-3 rounded-xl shadow-2xl text-xs font-bold transition-all duration-300 transform translate-y-[-20px] opacity-0 border backdrop-blur-md flex items-center gap-2 ${
        isError 
        ? 'bg-rose-950/80 text-rose-100 border-rose-900/50' 
        : 'bg-emerald-950/80 text-emerald-100 border-emerald-900/50'
    }`;

    const icon = isError ? '<i class="fa-solid fa-triangle-exclamation"></i>' : '<i class="fa-solid fa-circle-check"></i>';
    toast.innerHTML = `${icon} <span>${AuraUtils.escapeHtml(message)}</span>`;
    
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-[-20px]', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
    });

    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-[-20px]', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

window.showModal = function(id) {
    AuraUtils.safeDOM(id, function(el) {
        el.classList.remove('hidden');
        requestAnimationFrame(() => {
            el.classList.remove('opacity-0');
            el.classList.add('opacity-100');
        });
    });
};

window.closeModal = function(id) {
    AuraUtils.safeDOM(id, function(el) {
        el.classList.remove('opacity-100');
        el.classList.add('opacity-0');
        setTimeout(() => {
            el.classList.add('hidden');
        }, 300);
    });
};

// ============================================================================
// SISTEM TEMA WARNA DINAMIS (PERSISTEN KE CLOUD)
// ============================================================================
const AURA_THEMES = {
    emerald: { primary: '#10b981', glow: 'rgba(16,185,129,0.4)' },
    sky: { primary: '#38bdf8', glow: 'rgba(56,189,248,0.4)' },
    rose: { primary: '#fb7185', glow: 'rgba(251,113,133,0.4)' },
    amber: { primary: '#fbbf24', glow: 'rgba(251,191,36,0.4)' },
    violet: { primary: '#a78bfa', glow: 'rgba(167,139,250,0.4)' }
};

window.applyAndSaveTheme = async function(themeKey, skipSave = false) {
    const theme = AURA_THEMES[themeKey] || AURA_THEMES['emerald'];
    
    document.documentElement.style.setProperty('--accent-primary', theme.primary);
    document.documentElement.style.setProperty('--accent-glow', theme.glow);
    
    const selectEl = document.getElementById('user-theme-color');
    if (selectEl) selectEl.value = themeKey;

    localStorage.setItem('aurafi_active_theme', themeKey);

    if (!skipSave && AuraState.user.uid && window.FirebaseService) {
        try {
            await window.FirebaseService.updateSettings({ appTheme: themeKey });
            if (window.showToast) window.showToast(`Tema aplikasi diubah ke ${themeKey.toUpperCase()}!`);
        } catch(e) {
            console.error("Gagal menyimpan tema:", e);
        }
    }
};

// ============================================================================
// AURA CUSTOM DIALOGS (PENGGANTI ALERT, PROMPT, CONFIRM)
// ============================================================================
window.AuraPrompt = function(title, message, placeholder = "") {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-aura-prompt');
        const titleEl = document.getElementById('aura-prompt-title');
        const msgEl = document.getElementById('aura-prompt-msg');
        const inputEl = document.getElementById('aura-prompt-input');
        const btnOk = document.getElementById('aura-prompt-ok');
        const btnCancel = document.getElementById('aura-prompt-cancel');

        titleEl.innerHTML = title;
        msgEl.innerHTML = message;
        inputEl.placeholder = placeholder;
        inputEl.value = "";

        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            modal.classList.remove('opacity-0');
            modal.firstElementChild.classList.remove('scale-95');
        });
        inputEl.focus();

        const cleanup = () => {
            modal.classList.add('opacity-0');
            modal.firstElementChild.classList.add('scale-95');
            setTimeout(() => modal.classList.add('hidden'), 300);
            btnOk.onclick = null;
            btnCancel.onclick = null;
        };

        btnOk.onclick = () => { cleanup(); resolve(inputEl.value); };
        btnCancel.onclick = () => { cleanup(); resolve(null); };
        inputEl.onkeydown = (e) => { if(e.key === 'Enter') { cleanup(); resolve(inputEl.value); } };
    });
};

window.AuraConfirm = function(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-aura-confirm');
        const msgEl = document.getElementById('aura-confirm-msg');
        const btnOk = document.getElementById('aura-confirm-ok');
        const btnCancel = document.getElementById('aura-confirm-cancel');

        msgEl.innerHTML = message;

        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            modal.classList.remove('opacity-0');
            modal.firstElementChild.classList.remove('scale-95');
        });

        const cleanup = () => {
            modal.classList.add('opacity-0');
            modal.firstElementChild.classList.add('scale-95');
            setTimeout(() => modal.classList.add('hidden'), 300);
            btnOk.onclick = null;
            btnCancel.onclick = null;
        };

        btnOk.onclick = () => { cleanup(); resolve(true); };
        btnCancel.onclick = () => { cleanup(); resolve(false); };
    });
};

// ==========================================
// FUNGSI PREFERENSI MATA UANG & KURS REALTIME
// ==========================================

// PERBAIKAN: window.setCurrency versi ini DIHAPUS karena duplikat dengan
// handlers/navigation.js, dan versi ini tidak pernah menyimpan preferensi
// mata uang ke Firebase (cuma localStorage) — jadi preferensi tidak sinkron
// ke perangkat lain. Karena main.js dievaluasi paling akhir, definisi ini
// dulu selalu menimpa punya navigation.js. Sekarang navigation.js adalah
// satu-satunya sumber (sudah mencakup localStorage + sinkron ke Firebase).

window.fetchLiveExchangeRate = async function() {
    const display = document.getElementById('live-rate-display');
    if (!display) return;

    try {
        display.innerText = "Menarik data kurs dunia...";
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/JPY');
        const data = await response.json();
        const idrRate = data.rates.IDR;
        
        display.innerText = `1 JPY = Rp ${idrRate.toLocaleString('id-ID')}`;

        if (window.AuraState) {
            window.AuraState.data.exchangeRate = idrRate;
            window.AuraState.system.exchangeRate = idrRate;
        }
        
        if(typeof window.renderDashboard === 'function') window.renderDashboard();
        if(typeof window.renderTransactions === 'function') window.renderTransactions();
        if(typeof window.renderAnalytics === 'function') window.renderAnalytics();
        if(typeof window.renderBudgets === 'function') window.renderBudgets();

    } catch (e) {
        display.innerText = "Kurs Offline (Gagal memuat)";
        if (window.AuraState) {
            window.AuraState.system.exchangeRate = 110.27; // Fallback jika offline
        }
    }
};

// ============================================================================
// BOOTSTRAPPING SYSTEM & PWA REGISTRATION
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
    Logger.info('System', `AuraFi OS v${APP_CONFIG.VERSION} Bootstrapping initiated...`);
    
    // --- INISIALISASI DOMPET ---
    WalletManager.init();
    
    if (typeof window.injectMissingModals === 'function') window.injectMissingModals();
    
    const savedCurr = localStorage.getItem('aurafi_active_currency') || 'JPY';
    window.setCurrency(savedCurr);
    
    const savedTheme = localStorage.getItem('aurafi_active_theme') || 'emerald';
    window.applyAndSaveTheme(savedTheme, true);
    
    window.fetchLiveExchangeRate();
    
    setTimeout(() => {
        if(typeof window.syncGeminiEngine === 'function') {
            window.syncGeminiEngine(true); 
        }
    }, 1500);

    Logger.success('System', 'Sistem Kendali Utama (main.js) Berhasil Disinkronisasikan.');
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then((registration) => {
                Logger.success('PWA', `Service Worker terdaftar sukses.`);
            })
            .catch((error) => {
                Logger.error('PWA', 'Gagal mendaftarkan Service Worker:', error);
            });
    });
}

// ============================================================================
// MESIN PENANGKAP SUARA (WEB SPEECH API)
// ============================================================================

window.startVoice = function() {
    const btnVoice = document.getElementById('btn-voice');
    const inputField = document.getElementById('main-input-field');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        if (window.showToast) window.showToast("Maaf, browser Anda belum mendukung fitur input suara.", true);
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID'; 
    recognition.interimResults = false; 
    recognition.maxAlternatives = 1;

    recognition.onstart = function() {
        btnVoice.classList.add('text-rose-500', 'animate-pulse');
        btnVoice.classList.remove('text-[var(--text-muted)]', 'hover:text-accent');
        inputField.placeholder = "Mendengarkan suara Anda...";
    };

    recognition.onspeechend = function() {
        recognition.stop();
    };

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        inputField.value = (inputField.value + ' ' + transcript).trim();
        resetVoiceUI();
        inputField.style.height = 'auto';
        inputField.style.height = (inputField.scrollHeight) + 'px';
        if (window.showToast) window.showToast("Suara berhasil diterjemahkan!");
    };

    recognition.onerror = function(event) {
        if (event.error === 'not-allowed') {
            if (window.showToast) window.showToast("Izin mikrofon ditolak oleh browser.", true);
        } else {
            if (window.showToast) window.showToast("Gagal mengenali suara. Coba bicara lebih keras.", true);
        }
        resetVoiceUI();
    };

    function resetVoiceUI() {
        btnVoice.classList.remove('text-rose-500', 'animate-pulse');
        btnVoice.classList.add('text-[var(--text-muted)]', 'hover:text-accent');
        inputField.placeholder = "Ketik transaksi / chat AI...";
    }

    try {
        recognition.start();
    } catch(e) {
        resetVoiceUI();
    }
};

// ============================================================================
// SISTEM MANAJEMEN KATEGORI VISUAL & HIERARKI (AURA STUDIO)
// ============================================================================

const AURA_PALETTE = [
    '#ff9a9e', '#ffb199', '#f6d365', '#a1c4fd', '#84fab0', '#fbc2eb', 
    '#a6c1ee', '#fccb90', '#e0c3fc', '#d4fc79', '#10b981', '#38bdf8', 
    '#f59e0b', '#fb7185', '#818cf8', '#34d399', '#f472b6', '#c084fc'
];

const RAW_ICONS = [
    'fa-utensils', 'fa-burger', 'fa-pizza-slice', 'fa-bowl-food', 'fa-ice-cream', 'fa-apple-whole', 'fa-carrot', 'fa-cheese', 'fa-bread-slice', 'fa-mug-hot', 'fa-wine-glass', 'fa-beer-mug-empty', 'fa-cupcake', 'fa-martini-glass-citrus', 'fa-cake-candles',
    'fa-basket-shopping', 'fa-cart-shopping', 'fa-bag-shopping', 'fa-store', 'fa-shop', 'fa-gifts', 'fa-box', 'fa-boxes-stacked', 'fa-tag', 'fa-tags', 'fa-barcode',
    'fa-car', 'fa-gas-pump', 'fa-motorcycle', 'fa-bus', 'fa-train', 'fa-train-subway', 'fa-plane', 'fa-plane-departure', 'fa-ship', 'fa-ferry', 'fa-bicycle', 'fa-taxi', 'fa-truck', 'fa-route', 'fa-map-location-dot',
    'fa-house', 'fa-bolt', 'fa-droplet', 'fa-wifi', 'fa-couch', 'fa-bed', 'fa-bath', 'fa-broom', 'fa-fan', 'fa-fire', 'fa-plug', 'fa-key', 'fa-lightbulb', 'fa-toilet-paper', 'fa-trash-can',
    'fa-mobile-screen', 'fa-tv', 'fa-laptop', 'fa-headphones', 'fa-camera', 'fa-gamepad', 'fa-desktop', 'fa-mouse', 'fa-keyboard', 'fa-print', 'fa-satellite-dish', 'fa-server',
    'fa-heart-pulse', 'fa-pills', 'fa-stethoscope', 'fa-scissors', 'fa-tooth', 'fa-eye', 'fa-spa', 'fa-dumbbell', 'fa-person-running', 'fa-bottle-droplet', 'fa-weight-scale', 'fa-virus-covid',
    'fa-graduation-cap', 'fa-book', 'fa-pen-nib', 'fa-briefcase', 'fa-building', 'fa-paperclip', 'fa-chalkboard', 'fa-school', 'fa-laptop-file', 'fa-calculator', 'fa-scale-balanced',
    'fa-ticket', 'fa-music', 'fa-film', 'fa-video', 'fa-masks-theater', 'fa-palette', 'fa-dice', 'fa-puzzle-piece', 'fa-bowling-ball', 'fa-microphone', 'fa-campground', 'fa-tree', 'fa-volleyball', 'fa-guitar', 'fa-book-open',
    'fa-piggy-bank', 'fa-building-columns', 'fa-wallet', 'fa-hand-holding-dollar', 'fa-sack-dollar', 'fa-money-bill-trend-up', 'fa-money-bill', 'fa-coins', 'fa-credit-card', 'fa-chart-line', 'fa-chart-pie', 'fa-vault', 'fa-receipt', 'fa-file-invoice-dollar', 'fa-file-signature',
    'fa-children', 'fa-baby', 'fa-child', 'fa-person', 'fa-users', 'fa-user-group', 'fa-ring', 'fa-paw', 'fa-cat', 'fa-dog', 'fa-bone', 'fa-fish',
    'fa-shirt', 'fa-gem', 'fa-glasses', 'fa-hat-cowboy', 'fa-shoe-prints', 'fa-socks', 'fa-crown',
    'fa-wrench', 'fa-hammer', 'fa-screwdriver', 'fa-screwdriver-wrench', 'fa-envelope', 'fa-box-archive', 'fa-calendar', 'fa-bell', 'fa-star', 'fa-heart', 'fa-thumbs-up', 'fa-gear', 'fa-lock', 'fa-magnifying-glass'
];

const AURA_ICONS = RAW_ICONS.map((iconStr, index) => ({ icon: iconStr, color: AURA_PALETTE[index % AURA_PALETTE.length] }));

let currentCatTab = 'expense';

// ============================================================================
// MESIN PEMANEN DATA (HARVESTER) - VERSI PINTAR & ANTI-ZOMBIE
// ============================================================================
window.syncCategoriesData = async function() {
    let rawCats = AuraState.data.settings?.customCategories || {};
    let tombstones = AuraState.data.settings?.tombstones || []; 
    let isUpdated = false;
    const transactions = AuraState.data.transactions || [];
    
    transactions.forEach(trx => {
        let pName = trx.kategori; 
        if (!pName || pName.trim() === '' || pName.toLowerCase() === 'uncategorized') pName = 'Lainnya';
        const pNameLower = pName.toLowerCase();
        
        const type = (trx.tipe === 'pemasukan' || trx.jenis === 'pemasukan' || trx.tipe === 'income') ? 'income' : 'expense';
        
        let pId = Object.keys(rawCats).find(id => rawCats[id].name.toLowerCase() === pNameLower && !rawCats[id].parentId);
        if (!pId && !tombstones.includes(pNameLower)) {
            pId = `cat_sync_p_${Date.now()}_${Math.floor(Math.random()*10000)}`;
            rawCats[pId] = { name: pName, type: type, icon: 'fa-box-archive', color: '#a1a1aa', parentId: null };
            isUpdated = true;
        }
        
        if (trx.items && Array.isArray(trx.items)) {
            trx.items.forEach(item => {
                if(!item || typeof item !== 'object') return;
                const cName = item.kategori_barang || item.kategori || item.category || item.sub_kategori; 
                
                if (cName && cName.toLowerCase() !== pNameLower && cName.toLowerCase() !== 'uncategorized' && cName.toLowerCase() !== 'lainnya') {
                    const cNameLower = cName.toLowerCase();
                    let cExists = Object.values(rawCats).some(cat => cat.name.toLowerCase() === cNameLower);
                    if (!cExists && !tombstones.includes(cNameLower) && pId) {
                        let cId = `cat_sync_c_${Date.now()}_${Math.floor(Math.random()*10000)}`;
                        rawCats[cId] = { name: cName, type: type, icon: 'fa-tag', color: rawCats[pId].color, parentId: pId };
                        isUpdated = true;
                    }
                }
            });
        }
    });

    if (isUpdated) {
        if (AuraState.data.settings) AuraState.data.settings.customCategories = rawCats;
        if (window.FirebaseService) {
            try {
                await window.FirebaseService.updateSettings({ customCategories: rawCats });
            } catch(e) {
                console.error("Harvester sync failed to save to Firebase:", e);
            }
        }
    }
};

window.openCategoryManager = async function() {
    await window.syncCategoriesData();
    window.switchCatTab('expense');
    if(typeof window.showModal === 'function') window.showModal('modal-category-manager');
};

window.switchCatTab = function(type) {
    currentCatTab = type;
    const tabExp = document.getElementById('tab-cat-expense');
    const tabInc = document.getElementById('tab-cat-income');
    
    if(type === 'expense') {
        tabExp.className = "flex-1 py-3 text-xs font-bold uppercase tracking-widest text-[var(--color-expense)] border-b-2 border-[var(--color-expense)] transition-all";
        tabInc.className = "flex-1 py-3 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] border-b-2 border-transparent hover:text-white transition-all";
    } else {
        tabInc.className = "flex-1 py-3 text-xs font-bold uppercase tracking-widest text-[var(--color-income)] border-b-2 border-[var(--color-income)] transition-all";
        tabExp.className = "flex-1 py-3 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] border-b-2 border-transparent hover:text-white transition-all";
    }
    
    window.renderCategoryList();
};

window.renderCategoryList = function() {
    const rawCategories = AuraState.data.settings?.customCategories || {};
    const allCats = Object.entries(rawCategories).map(([id, data]) => ({ id, ...data }));
    const filteredCats = allCats.filter(c => c.type === currentCatTab);
    
    const parents = filteredCats.filter(c => !c.parentId);
    const children = filteredCats.filter(c => c.parentId);

    const container = document.getElementById('category-list-container');
    if (!container) return;

    if (parents.length === 0) {
        container.innerHTML = `<div class="text-center py-10 opacity-50"><i class="fa-solid fa-folder-open text-4xl mb-3 block"></i><p class="text-xs">Belum ada kategori ${currentCatTab}.</p></div>`;
        return;
    }

    let html = '';
    parents.forEach(parent => {
        const mySubs = children.filter(sub => sub.parentId === parent.id);
        
        html += `
        <div class="glass-panel p-3 flex flex-col mb-3 animate-[fadeIn_0.3s_ease-out]">
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border border-white/10 shadow-lg" style="background-color: ${parent.color}20; color: ${parent.color}">
                        <i class="fa-solid ${parent.icon} text-lg"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-sm text-[var(--text-main)] leading-tight">${AuraUtils.escapeHtml(parent.name)}</h4>
                        <p class="text-[9px] text-[var(--text-muted)] uppercase tracking-widest">${mySubs.length} Sub-Kategori</p>
                    </div>
                </div>
                <div class="flex gap-1">
                    <button onclick="window.editCategory('${parent.id}')" class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition"><i class="fa-solid fa-pen text-xs"></i></button>
                    <button onclick="window.deleteCategory('${parent.id}')" class="w-8 h-8 rounded-full flex items-center justify-center text-rose-500 hover:bg-rose-500/10 transition"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>
            </div>`;
        
        if (mySubs.length > 0) {
            html += `<div class="ml-5 mt-2 pl-4 border-l-2 border-[var(--border-glass)] space-y-2">`;
            mySubs.forEach(sub => {
                html += `
                <div class="flex justify-between items-center group">
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style="color: ${sub.color}">
                            <i class="fa-solid ${sub.icon} text-[10px]"></i>
                        </div>
                        <span class="text-xs text-[var(--text-muted)] group-hover:text-white transition">${AuraUtils.escapeHtml(sub.name)}</span>
                    </div>
                    <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="window.editCategory('${sub.id}')" class="p-1.5 text-[var(--text-muted)] hover:text-white"><i class="fa-solid fa-pen text-[10px]"></i></button>
                        <button onclick="window.deleteCategory('${sub.id}')" class="p-1.5 text-rose-500 hover:text-rose-400"><i class="fa-solid fa-trash text-[10px]"></i></button>
                    </div>
                </div>`;
            });
            html += `</div>`;
        }
        html += `</div>`;
    });
    
    container.innerHTML = html;
};

// ============================================================================
// AURA CUSTOM CATEGORY PICKER
// ============================================================================
let activePickerTargetVal = '';
let activePickerTargetDisplay = '';

window.openCategoryPicker = async function(targetValId, trxType, targetDisplayId) {
    activePickerTargetVal = targetValId;
    activePickerTargetDisplay = targetDisplayId;
    
    await window.syncCategoriesData();

    const rawCategories = AuraState.data.settings?.customCategories || {};
    const allCats = Object.entries(rawCategories).map(([id, data]) => ({ id, ...data }));
    
    let mappedType = 'expense'; 
    if (trxType) {
        const tStr = String(trxType).toLowerCase().trim();
        if (tStr === 'pemasukan' || tStr === 'income' || tStr === 'setor_tunai') {
            mappedType = 'income';
        }
    }

    const filteredCats = allCats.filter(c => c.type === mappedType || !c.type);
    
    const parents = filteredCats.filter(c => !c.parentId);
    const children = filteredCats.filter(c => c.parentId);

    const container = document.getElementById('picker-list-container');
    let html = '';

    if (parents.length === 0) {
        html = `<p class="text-center text-xs text-[var(--text-muted)] py-10">Belum ada kategori untuk jenis transaksi ini.</p>`;
    } else {
        parents.forEach(parent => {
            const mySubs = children.filter(sub => sub.parentId === parent.id);
            const safeParentName = parent.name.replace(/'/g, "\\'");
            
            html += `
            <button onclick="window.selectCategoryFromPicker('${safeParentName}', '${safeParentName}')" class="w-full text-left p-3 rounded-xl hover:bg-white/5 active:bg-white/10 transition flex items-center gap-3 group border border-transparent hover:border-[var(--border-glass)]">
                <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style="background-color: ${parent.color}20; color: ${parent.color}">
                    <i class="fa-solid ${parent.icon || 'fa-tag'} text-sm"></i>
                </div>
                <div class="flex-1">
                    <h4 class="font-bold text-sm text-[var(--text-main)] group-hover:text-white transition">${AuraUtils.escapeHtml(parent.name)}</h4>
                </div>
            </button>`;
            
            if (mySubs.length > 0) {
                html += `<div class="ml-4 pl-4 border-l border-[var(--border-glass)] space-y-1 mb-2">`;
                mySubs.forEach(sub => {
                    const safeSubName = sub.name.replace(/'/g, "\\'");
                    html += `
                    <button onclick="window.selectCategoryFromPicker('${safeSubName}', '${safeParentName}')" class="w-full text-left p-2.5 rounded-lg hover:bg-white/5 active:bg-white/10 transition flex items-center gap-3 group">
                        <div class="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style="color: ${sub.color || parent.color}">
                            <i class="fa-solid ${sub.icon || 'fa-tag'} text-[10px]"></i>
                        </div>
                        <span class="text-xs text-[var(--text-muted)] group-hover:text-white transition">${AuraUtils.escapeHtml(sub.name)}</span>
                    </button>`;
                });
                html += `</div>`;
            }
        });
    }

    container.innerHTML = html;

    const el = document.getElementById('modal-category-picker');
    const panel = document.getElementById('cat-picker-panel');
    el.classList.remove('hidden');
    requestAnimationFrame(() => {
        el.classList.remove('opacity-0');
        el.classList.add('opacity-100');
        panel.classList.remove('translate-y-full');
        panel.classList.add('translate-y-0');
    });
};

window.closeCategoryPicker = function() {
    const el = document.getElementById('modal-category-picker');
    const panel = document.getElementById('cat-picker-panel');
    el.classList.remove('opacity-100');
    el.classList.add('opacity-0');
    panel.classList.remove('translate-y-0');
    panel.classList.add('translate-y-full');
    setTimeout(() => { el.classList.add('hidden'); }, 300);
};

window.selectCategoryFromPicker = function(catName, parentName) {
    const valEl = document.getElementById(activePickerTargetVal);
    if(valEl) {
        valEl.value = catName;
        if (parentName) valEl.setAttribute('data-parent', parentName);
    }
    
    const displayEl = document.getElementById(activePickerTargetDisplay);
    if(displayEl) {
        if (parentName && parentName !== catName) {
            displayEl.innerHTML = `<span class="opacity-50">${AuraUtils.escapeHtml(parentName)} &rsaquo;</span> ${AuraUtils.escapeHtml(catName)}`;
        } else {
            displayEl.innerText = catName;
        }
        displayEl.classList.remove('text-[var(--text-muted)]');
        displayEl.classList.add('text-accent', 'font-bold');
    }
    window.closeCategoryPicker();
};

// ============================================================================
// LOGIKA FORM EDIT & TAMBAH KATEGORI
// ============================================================================

window.openAddCategoryForm = function() {
    document.getElementById('cat-form-id').value = '';
    document.getElementById('cat-form-type').value = currentCatTab;
    document.getElementById('cat-form-name').value = '';
    document.getElementById('cat-form-title').innerText = "Kategori Baru";
    
    const rawCategories = AuraState.data.settings?.customCategories || {};
    const parents = Object.entries(rawCategories)
                          .map(([id, data]) => ({ id, ...data }))
                          .filter(c => c.type === currentCatTab && !c.parentId);
    
    let parentOpts = `<option value="">-- Menjadi Kategori Utama --</option>`;
    parents.forEach(p => parentOpts += `<option value="${p.id}">${p.name}</option>`);
    
    const selectEl = document.getElementById('cat-form-parent');
    selectEl.innerHTML = parentOpts;
    selectEl.disabled = false;

    window.renderIconPickerGrid(AURA_ICONS[0].icon, AURA_ICONS[0].color);
    if(typeof window.showModal === 'function') window.showModal('modal-category-form');
};

window.editCategory = function(id) {
    const rawCategories = AuraState.data.settings?.customCategories || {};
    const cat = rawCategories[id];
    if (!cat) return;

    document.getElementById('cat-form-id').value = id;
    document.getElementById('cat-form-type').value = cat.type;
    document.getElementById('cat-form-name').value = cat.name;
    document.getElementById('cat-form-title').innerText = "Edit Kategori";
    
    const hasChildren = Object.values(rawCategories).some(c => c.parentId === id);
    const selectEl = document.getElementById('cat-form-parent');

    if (hasChildren) {
        selectEl.innerHTML = `<option value="">Kategori Utama (Memiliki Sub-Kategori)</option>`;
        selectEl.disabled = true; 
    } else {
        const parents = Object.entries(rawCategories)
                              .map(([cid, data]) => ({ id: cid, ...data }))
                              .filter(c => c.type === cat.type && !c.parentId && c.id !== id);
        
        let parentOpts = `<option value="">-- Menjadi Kategori Utama --</option>`;
        parents.forEach(p => {
            const selected = (cat.parentId === p.id) ? 'selected' : '';
            parentOpts += `<option value="${p.id}" ${selected}>${p.name}</option>`;
        });
        selectEl.innerHTML = parentOpts;
        selectEl.disabled = false;
    }

    window.renderIconPickerGrid(cat.icon, cat.color);
    if(typeof window.showModal === 'function') window.showModal('modal-category-form');
};

// ============================================================================
// SISTEM PEMILIHAN IKON, AI ICON FETCHER & COLOR PICKER
// ============================================================================

window.updateActiveColor = function(newColor) {
    const currentIcon = document.getElementById('cat-form-icon').value;
    window.renderIconPickerGrid(currentIcon, newColor);
};

window.renderIconPickerGrid = function(activeIcon, activeColor) {
    const grid = document.getElementById('icon-picker-grid');
    document.getElementById('cat-form-icon').value = activeIcon;
    document.getElementById('cat-form-color').value = activeColor;
    
    const customIcons = AuraState.data.settings?.customIcons || [];
    const customColors = AuraState.data.settings?.customColors || {}; 
    
    const ALL_ICONS = [
        ...RAW_ICONS.map((iconStr, i) => ({ icon: iconStr, color: AURA_PALETTE[i % AURA_PALETTE.length], isCustom: false })),
        ...customIcons.map((iconStr) => ({ 
            icon: iconStr, 
            color: customColors[iconStr] || '#10b981', 
            isCustom: true 
        }))
    ];
    
    let html = `
        <div class="col-span-full flex items-center gap-3 mb-3 p-2 bg-black/20 rounded-xl border border-white/5">
            <button type="button" onclick="window.openAIIconSearch()" class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center border-2 border-dashed border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]" title="Minta AI carikan ikon baru">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
            </button>
            
            <div class="h-8 w-[1px] bg-white/10 mx-1"></div>
            
            <div class="relative w-10 h-10 shrink-0 rounded-full overflow-hidden border-2 border-white/20 shadow-lg cursor-pointer transition-transform hover:scale-105" title="Ubah Warna Ikon">
                <input type="color" id="dynamic-color-picker" value="${activeColor}" onchange="window.updateActiveColor(this.value)" class="absolute -top-2 -left-2 w-16 h-16 cursor-pointer">
            </div>
            <div class="flex flex-col">
                <span class="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-tight">Warna Ikon</span>
                <span class="text-[9px] text-gray-500 font-mono">${activeColor.toUpperCase()}</span>
            </div>
        </div>
    `;
    
    ALL_ICONS.forEach(item => {
        const isActive = item.icon === activeIcon;
        const baseClass = isActive ? 'scale-110 ring-2 ring-white shadow-lg' : 'hover:scale-110 opacity-70 hover:opacity-100';
        
        const displayColor = isActive ? activeColor : item.color;
        
        if (item.isCustom) {
            html += `
            <div class="relative group">
                <button type="button" onclick="window.renderIconPickerGrid('${item.icon}', '${displayColor}')" 
                        class="w-10 h-10 rounded-full flex items-center justify-center transition-all ${baseClass}" 
                        style="background-color: ${displayColor}30; color: ${displayColor}">
                    <i class="fa-solid ${item.icon}"></i>
                </button>
                <button type="button" onclick="window.deleteCustomIcon('${item.icon}', event)" class="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center text-[8px] text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" title="Hapus Ikon Ini">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>`;
        } else {
            html += `
            <button type="button" onclick="window.renderIconPickerGrid('${item.icon}', '${displayColor}')" 
                    class="w-10 h-10 rounded-full flex items-center justify-center transition-all ${baseClass}" 
                    style="background-color: ${displayColor}30; color: ${displayColor}">
                <i class="fa-solid ${item.icon}"></i>
            </button>`;
        }
    });
    grid.innerHTML = html;
};

// --- FUNGSI PENCARIAN IKON (MENGGUNAKAN AURA PROMPT) ---
window.openAIIconSearch = async function() {
    const keyword = await window.AuraPrompt("<i class='fa-solid fa-wand-magic-sparkles mr-2'></i>AI Icon Search", "Ikon apa yang ingin Anda cari?<br><span class='text-[9px] opacity-70'>(Contoh: hewan, mobil sport, sekolah, komputer, api)</span>", "Ketik di sini...");
    if (!keyword || keyword.trim() === '') return;

    if (window.showToast) window.showToast("AI sedang membongkar perpustakaan ikon...", false);

    const systemPrompt = `Anda adalah asisten UI/UX. User mencari ikon FontAwesome v6 Free Solid untuk kata kunci: "${keyword}".
    Tugas Anda membalas dengan MAKSIMAL 5 nama class FontAwesome yang valid.
    ATURAN MUTLAK: Output HARUS berupa JSON murni.
    Format wajib persis seperti ini: {"icons": ["fa-dog", "fa-cat", "fa-paw", "fa-bone", "fa-fish"]}`;

    try {
        const ActiveGroq = window.GroqAPI;
        if (!ActiveGroq) throw new Error("Mesin AI Groq belum dimuat oleh sistem.");

        if (typeof ActiveGroq.refreshKeys === 'function') {
            ActiveGroq.refreshKeys();
        }

        if (!ActiveGroq.keysPool || ActiveGroq.keysPool.length === 0) {
            throw new Error("Mesin Groq kosong! Pastikan API Key Groq sudah tersimpan di Pengaturan.");
        }

        const messages = [
            { role: "user", content: `Carikan ikon untuk: ${keyword}` }
        ];

        const result = await ActiveGroq.callGroq(messages, systemPrompt, true, null);
        
        let cleanResult = result.replace(/```json/g, '').replace(/```/g, '').trim();
        let parsedData = JSON.parse(cleanResult);
        let iconArray = Array.isArray(parsedData) ? parsedData : (parsedData.icons || []);

        if (!Array.isArray(iconArray) || iconArray.length === 0) {
            throw new Error("Format JSON balasan AI tidak sesuai.");
        }

        window.renderAIIconSuggestions(iconArray);

    } catch (e) {
        console.error("Direct AI Icon Search Error:", e);
        if (window.showToast) {
            window.showToast(`Gagal: ${e.message}`, true);
        }
    }
};

window.renderAIIconSuggestions = function(icons) {
    const grid = document.getElementById('icon-picker-grid');
    
    let html = `
    <div class="col-span-full mb-3 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl animate-[fadeIn_0.3s_ease-out]">
        <p class="text-[10px] text-emerald-400 font-bold mb-3 text-center uppercase tracking-widest"><i class="fa-solid fa-robot mr-1"></i> Ikon Ditemukan (Klik untuk Simpan):</p>
        <div class="flex justify-center gap-3 flex-wrap">`;

    icons.forEach(iconClass => {
        let safeClass = iconClass.startsWith('fa-') ? iconClass : `fa-${iconClass}`;
        html += `
        <button type="button" onclick="window.saveCustomIcon('${safeClass}')" class="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center shadow-md hover:scale-110" title="${safeClass}">
            <i class="fa-solid ${safeClass}"></i>
        </button>`;
    });

    html += `
        </div>
        <button type="button" onclick="window.renderIconPickerGrid(document.getElementById('cat-form-icon').value, document.getElementById('cat-form-color').value)" class="w-full mt-3 py-1.5 text-[10px] bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors">Batal / Tutup</button>
    </div>`;

    grid.insertAdjacentHTML('afterbegin', html);
};

window.saveCustomIcon = async function(iconClass) {
    const pickedColor = document.getElementById('dynamic-color-picker').value || "#10b981";

    let customIcons = AuraState.data.settings?.customIcons || [];
    let customColors = AuraState.data.settings?.customColors || {};
    
    if (!customIcons.includes(iconClass) && !RAW_ICONS.includes(iconClass)) {
        customIcons.push(iconClass);
        customColors[iconClass] = pickedColor; 
        
        try {
            await window.FirebaseService.updateSettings({ 
                customIcons: customIcons,
                customColors: customColors
            });
            if(AuraState.data.settings) {
                AuraState.data.settings.customIcons = customIcons;
                AuraState.data.settings.customColors = customColors;
            }
            if(window.showToast) window.showToast(`Ikon berhasil disimpan ke menu!`);
        } catch (e) {
            if(window.showToast) window.showToast("Gagal menyimpan ikon ke Cloud.", true);
            return;
        }
    }
    
    window.renderIconPickerGrid(iconClass, pickedColor); 
};

window.deleteCustomIcon = async function(iconClass, event) {
    event.stopPropagation(); 
    
    const isConfirmed = await window.AuraConfirm(`Hapus ikon <b>${iconClass}</b> ini secara permanen dari menu Anda?`);
    if (!isConfirmed) return;

    let customIcons = AuraState.data.settings?.customIcons || [];
    customIcons = customIcons.filter(i => i !== iconClass);

    try {
        await window.FirebaseService.updateSettings({ customIcons: customIcons });
        if(AuraState.data.settings) AuraState.data.settings.customIcons = customIcons;
        if(window.showToast) window.showToast("Ikon berhasil dihapus dari menu.");
        
        window.renderIconPickerGrid(document.getElementById('cat-form-icon').value, document.getElementById('cat-form-color').value);
    } catch (e) {
        if(window.showToast) window.showToast("Gagal menghapus ikon dari Cloud.", true);
    }
};

// ============================================================================
// SIMPAN & HAPUS KATEGORI FINAL
// ============================================================================
window.saveCategoryData = async function() {
    const id = document.getElementById('cat-form-id').value || `cat_${Date.now()}`;
    const type = document.getElementById('cat-form-type').value;
    const name = document.getElementById('cat-form-name').value.trim();
    const parentId = document.getElementById('cat-form-parent').value;
    const icon = document.getElementById('cat-form-icon').value;
    const color = document.getElementById('cat-form-color').value;

    if (!name) {
        if(window.showToast) window.showToast("Nama kategori tidak boleh kosong!", true);
        return;
    }

    const payload = { name, type, icon, color, parentId: parentId || null };
    const updates = {};
    updates[`customCategories/${id}`] = payload;

    try {
        await window.FirebaseService.updateSettings(updates);
        if(AuraState.data.settings) {
            if(!AuraState.data.settings.customCategories) AuraState.data.settings.customCategories = {};
            AuraState.data.settings.customCategories[id] = payload;
        }
        
        if(window.showToast) window.showToast("Kategori berhasil disimpan!");
        window.closeModal('modal-category-form');
        window.renderCategoryList();
    } catch(e) {
        if(window.showToast) window.showToast("Gagal menyimpan kategori.", true);
    }
};

// ============================================================================
// HAPUS KATEGORI & MASUKKAN KE BUKU HITAM
// ============================================================================
window.deleteCategory = async function(id) {
    const isConfirmed = await window.AuraConfirm("Yakin ingin menghapus kategori ini? Sistem akan memblokirnya agar tidak muncul lagi dari riwayat lama.");
    
    if (!isConfirmed) return; 

    try {
        const rawCategories = AuraState.data.settings?.customCategories || {};
        let tombstones = AuraState.data.settings?.tombstones || []; 
        
        const updates = {};
        updates[`customCategories/${id}`] = null;
        
        if(rawCategories[id]) tombstones.push(rawCategories[id].name.toLowerCase());
        
        Object.entries(rawCategories).forEach(([childId, data]) => {
            if(data.parentId === id) {
                updates[`customCategories/${childId}`] = null;
                tombstones.push(data.name.toLowerCase()); 
            }
        });

        updates[`tombstones`] = tombstones;

        await window.FirebaseService.updateSettings(updates);
        
        if(AuraState.data.settings) {
            if(AuraState.data.settings.customCategories) {
                delete AuraState.data.settings.customCategories[id];
                Object.entries(rawCategories).forEach(([childId, data]) => {
                    if(data.parentId === id) delete AuraState.data.settings.customCategories[childId];
                });
            }
            AuraState.data.settings.tombstones = tombstones;
        }

        if(window.showToast) window.showToast("Kategori dihapus dan diblokir dari kemunculan ulang.");
        window.renderCategoryList(); 
    } catch(e) {
        console.error("Error Delete Category:", e);
        if(window.showToast) window.showToast("Gagal menghapus kategori.", true);
    }
};
