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

// 2. Services & Modules Imports
import './services/firebase.js';
import './modules/categories.js';
import './modules/analytics.js'; // Inject file analytics yang baru kita buat

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
import './handlers/input.js';
import './renderers/oracle.js';

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

// ==========================================
// 3. FUNGSI PREFERENSI MATA UANG & KURS REALTIME
// ==========================================

window.setCurrency = function(curr) {
    // 1. Simpan pilihan ke memori HP agar tidak reset saat refresh
    localStorage.setItem('aurafi_active_currency', curr);
    
    if (window.AuraState) {
        window.AuraState.system.displayCurrency = curr; // Sinkronisasi variabel untuk utils.js
        window.AuraState.system.currency = curr;
    }
    
    // 2. Update warna tombol JPY / IDR di Header
    const btnJpy = document.getElementById('btn-curr-jpy');
    const btnIdr = document.getElementById('btn-curr-idr');
    
    if (btnJpy && btnIdr) {
        if(curr === 'JPY') {
            btnJpy.className = "px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all bg-accent text-[var(--bg-base)]";
            btnIdr.className = "px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all text-[var(--text-muted)]";
        } else {
            btnIdr.className = "px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all bg-accent text-[var(--bg-base)]";
            btnJpy.className = "px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all text-[var(--text-muted)]";
        }
    }
    
    // 3. PAKSA SEMUA LAYAR ME-REFRESH ANGKA DAN LAMBANG UANG SECARA INSTAN!
    if (typeof window.loadRealtimeDatabaseData === 'function') {
        window.loadRealtimeDatabaseData(true); // Memanggil fungsi refresh rahasia tanpa notif
    } else {
        // Jaring pengaman jika fungsi Realtime belum dimuat
        if(typeof window.renderDashboard === 'function') window.renderDashboard();
        if(typeof window.renderTransactions === 'function') window.renderTransactions();
        if(typeof window.renderAnalytics === 'function') window.renderAnalytics();
        if(typeof window.renderBudgets === 'function') window.renderBudgets();
    }
};

window.fetchLiveExchangeRate = async function() {
    const display = document.getElementById('live-rate-display');
    if (!display) return;

    try {
        display.innerText = "Menarik data kurs dunia...";

        // Mengambil kurs JPY ke IDR secara langsung dan gratis
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/JPY');
        const data = await response.json();
        const idrRate = data.rates.IDR;
        
        display.innerText = `1 JPY = Rp ${idrRate.toLocaleString('id-ID')}`;

        // Simpan rate di state agar kalkulasi total aset menjadi akurat
        if (window.AuraState) {
            window.AuraState.data.exchangeRate = idrRate;
            window.AuraState.system.exchangeRate = idrRate;
        }
    } catch (e) {
        display.innerText = "Kurs Offline (Gagal memuat)";
    }
};


// ============================================================================
// BOOTSTRAPPING SYSTEM & PWA REGISTRATION
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
    Logger.info('System', `AuraFi OS v${APP_CONFIG.VERSION} Bootstrapping initiated...`);
    
    if (typeof window.injectMissingModals === 'function') window.injectMissingModals();
    
    // Tarik memori mata uang terakhir yang dipilih user (Default: JPY)
    const savedCurr = localStorage.getItem('aurafi_active_currency') || 'JPY';
    window.setCurrency(savedCurr);
    
    // Jalankan penarik kurs
    window.fetchLiveExchangeRate();
    
    // Buka Gemini secara diam-diam jika PIN-nya sudah pernah disimpan
    setTimeout(() => {
        if(typeof window.syncGeminiEngine === 'function') {
            window.syncGeminiEngine(true); // true = mode silent (tanpa notif)
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

    // 1. Cek apakah browser mendukung fitur pengenalan suara
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        if (window.showToast) window.showToast("Maaf, browser Anda belum mendukung fitur input suara.", true);
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID'; // Mengatur bahasa pendengaran ke Bahasa Indonesia
    recognition.interimResults = false; // Hanya ambil hasil akhir yang sudah pasti
    recognition.maxAlternatives = 1;

    // 2. Saat mesin mulai mendengarkan
    recognition.onstart = function() {
        // Ubah tombol mikrofon menjadi merah berkedip sebagai indikator
        btnVoice.classList.add('text-rose-500', 'animate-pulse');
        btnVoice.classList.remove('text-[var(--text-muted)]', 'hover:text-accent');
        inputField.placeholder = "Mendengarkan suara Anda...";
    };

    // 3. Saat user selesai berbicara
    recognition.onspeechend = function() {
        recognition.stop();
    };

    // 4. Saat mesin berhasil menerjemahkan suara menjadi teks
    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        
        // Tambahkan teks hasil suara ke dalam kolom input (ditambah spasi jika sudah ada teks sebelumnya)
        inputField.value = (inputField.value + ' ' + transcript).trim();
        
        // Kembalikan tampilan tombol ke bentuk semula
        resetVoiceUI();
        
        // Otomatis menyesuaikan tinggi kolom input agar teksnya tidak terpotong
        inputField.style.height = 'auto';
        inputField.style.height = (inputField.scrollHeight) + 'px';
        
        if (window.showToast) window.showToast("Suara berhasil diterjemahkan!");
    };

    // 5. Jika terjadi error (misal: tidak ada suara atau izin mikrofon ditolak)
    recognition.onerror = function(event) {
        console.error("Kesalahan Speech API:", event.error);
        if (event.error === 'not-allowed') {
            if (window.showToast) window.showToast("Izin mikrofon ditolak oleh browser.", true);
        } else {
            if (window.showToast) window.showToast("Gagal mengenali suara. Coba bicara lebih keras.", true);
        }
        resetVoiceUI();
    };

    // Fungsi bantuan untuk mereset tampilan UI
    function resetVoiceUI() {
        btnVoice.classList.remove('text-rose-500', 'animate-pulse');
        btnVoice.classList.add('text-[var(--text-muted)]', 'hover:text-accent');
        inputField.placeholder = "Ketik transaksi / chat AI...";
    }

    // Eksekusi: Nyalakan mikrofon!
    try {
        recognition.start();
    } catch(e) {
        resetVoiceUI();
    }
};

// ============================================================================
// SISTEM MANAJEMEN KATEGORI VISUAL & HIERARKI (AURA STUDIO)
// ============================================================================

// 1. Daftar Warna Pastel Serenity untuk rotasi dinamis
const AURA_PALETTE = [
    '#ff9a9e', '#ffb199', '#f6d365', '#a1c4fd', '#84fab0', '#fbc2eb', 
    '#a6c1ee', '#fccb90', '#e0c3fc', '#d4fc79', '#10b981', '#38bdf8', 
    '#f59e0b', '#fb7185', '#818cf8', '#34d399', '#f472b6', '#c084fc'
];

// 2. Koleksi 150+ Ikon Premium (Generator Dinamis)
const RAW_ICONS = [
    // Makanan & Minuman
    'fa-utensils', 'fa-burger', 'fa-pizza-slice', 'fa-bowl-food', 'fa-ice-cream', 'fa-apple-whole', 'fa-carrot', 'fa-cheese', 'fa-bread-slice', 'fa-mug-hot', 'fa-wine-glass', 'fa-beer-mug-empty', 'fa-cupcake', 'fa-martini-glass-citrus', 'fa-cake-candles',
    // Belanja & Ritel
    'fa-basket-shopping', 'fa-cart-shopping', 'fa-bag-shopping', 'fa-store', 'fa-shop', 'fa-gifts', 'fa-box', 'fa-boxes-stacked', 'fa-tag', 'fa-tags', 'fa-barcode',
    // Transportasi & Perjalanan
    'fa-car', 'fa-gas-pump', 'fa-motorcycle', 'fa-bus', 'fa-train', 'fa-train-subway', 'fa-plane', 'fa-plane-departure', 'fa-ship', 'fa-ferry', 'fa-bicycle', 'fa-taxi', 'fa-truck', 'fa-route', 'fa-map-location-dot',
    // Rumah & Kebutuhan (Utilitas)
    'fa-house', 'fa-bolt', 'fa-droplet', 'fa-wifi', 'fa-couch', 'fa-bed', 'fa-bath', 'fa-broom', 'fa-fan', 'fa-fire', 'fa-plug', 'fa-key', 'fa-lightbulb', 'fa-toilet-paper', 'fa-trash-can',
    // Gadget & Teknologi
    'fa-mobile-screen', 'fa-tv', 'fa-laptop', 'fa-headphones', 'fa-camera', 'fa-gamepad', 'fa-desktop', 'fa-mouse', 'fa-keyboard', 'fa-print', 'fa-satellite-dish', 'fa-server',
    // Kesehatan, Olahraga & Perawatan
    'fa-heart-pulse', 'fa-pills', 'fa-stethoscope', 'fa-scissors', 'fa-tooth', 'fa-eye', 'fa-spa', 'fa-dumbbell', 'fa-person-running', 'fa-bottle-droplet', 'fa-weight-scale', 'fa-virus-covid',
    // Pendidikan & Pekerjaan
    'fa-graduation-cap', 'fa-book', 'fa-pen-nib', 'fa-briefcase', 'fa-building', 'fa-paperclip', 'fa-chalkboard', 'fa-school', 'fa-laptop-file', 'fa-calculator', 'fa-scale-balanced',
    // Hiburan & Hobi
    'fa-ticket', 'fa-music', 'fa-film', 'fa-video', 'fa-masks-theater', 'fa-palette', 'fa-dice', 'fa-puzzle-piece', 'fa-bowling-ball', 'fa-microphone', 'fa-campground', 'fa-tree', 'fa-volleyball', 'fa-guitar', 'fa-book-open',
    // Keuangan, Investasi & Pajak
    'fa-piggy-bank', 'fa-building-columns', 'fa-wallet', 'fa-hand-holding-dollar', 'fa-sack-dollar', 'fa-money-bill-trend-up', 'fa-money-bill', 'fa-coins', 'fa-credit-card', 'fa-chart-line', 'fa-chart-pie', 'fa-vault', 'fa-receipt', 'fa-file-invoice-dollar', 'fa-file-signature',
    // Keluarga, Sosial & Peliharaan
    'fa-children', 'fa-baby', 'fa-child', 'fa-person', 'fa-users', 'fa-user-group', 'fa-ring', 'fa-paw', 'fa-cat', 'fa-dog', 'fa-bone', 'fa-fish',
    // Pakaian & Aksesoris
    'fa-shirt', 'fa-gem', 'fa-glasses', 'fa-hat-cowboy', 'fa-shoe-prints', 'fa-socks', 'fa-crown',
    // Lain-lain & Perkakas Dasar
    'fa-wrench', 'fa-hammer', 'fa-screwdriver', 'fa-screwdriver-wrench', 'fa-envelope', 'fa-box-archive', 'fa-calendar', 'fa-bell', 'fa-star', 'fa-heart', 'fa-thumbs-up', 'fa-gear', 'fa-lock', 'fa-magnifying-glass'
];

// Mapping otomatis ikon dengan warna agar memori aplikasi tetap ringan
const AURA_ICONS = RAW_ICONS.map((iconStr, index) => ({
    icon: iconStr,
    color: AURA_PALETTE[index % AURA_PALETTE.length]
}));

// (Sisa kode di bawah ini seperti currentCatTab, window.openCategoryManager, dst. biarkan UTUH)

let currentCatTab = 'expense';

window.openCategoryManager = function() {
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
    // Ambil data kategori dari Firebase Settings (Fallback kosong jika belum ada)
    const rawCategories = AuraState.data.settings?.customCategories || {};
    
    // Konversi object ke array dan filter berdasarkan tab aktif
    const allCats = Object.entries(rawCategories).map(([id, data]) => ({ id, ...data }));
    const filteredCats = allCats.filter(c => c.type === currentCatTab);
    
    // Pisahkan Induk dan Anak
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
        // Cari sub-kategori milik induk ini
        const mySubs = children.filter(sub => sub.parentId === parent.id);
        
        html += `
        <div class="glass-panel p-3 flex flex-col mb-3">
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
        
        // Render Sub-kategori jika ada (Bentuk L-Shape Hierarki)
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
// LOGIKA FORM ICON STUDIO
// ============================================================================

window.openAddCategoryForm = function() {
    document.getElementById('cat-form-id').value = '';
    document.getElementById('cat-form-type').value = currentCatTab;
    document.getElementById('cat-form-name').value = '';
    document.getElementById('cat-form-title').innerText = "Kategori Baru";
    
    // Render Opsi Induk
    const rawCategories = AuraState.data.settings?.customCategories || {};
    const parents = Object.entries(rawCategories)
                          .map(([id, data]) => ({ id, ...data }))
                          .filter(c => c.type === currentCatTab && !c.parentId);
    
    let parentOpts = `<option value="">-- Menjadi Kategori Utama --</option>`;
    parents.forEach(p => parentOpts += `<option value="${p.id}">${p.name}</option>`);
    document.getElementById('cat-form-parent').innerHTML = parentOpts;

    window.renderIconPickerGrid(AURA_ICONS[0].icon, AURA_ICONS[0].color);
    if(typeof window.showModal === 'function') window.showModal('modal-category-form');
};

window.renderIconPickerGrid = function(activeIcon, activeColor) {
    const grid = document.getElementById('icon-picker-grid');
    document.getElementById('cat-form-icon').value = activeIcon;
    document.getElementById('cat-form-color').value = activeColor;
    
    let html = '';
    AURA_ICONS.forEach(item => {
        const isActive = item.icon === activeIcon;
        const baseClass = isActive ? 'scale-110 ring-2 ring-white shadow-lg' : 'hover:scale-110 opacity-70 hover:opacity-100';
        
        html += `
        <button onclick="window.renderIconPickerGrid('${item.icon}', '${item.color}')" 
                class="w-10 h-10 rounded-full flex items-center justify-center transition-all ${baseClass}" 
                style="background-color: ${item.color}30; color: ${item.color}">
            <i class="fa-solid ${item.icon}"></i>
        </button>`;
    });
    grid.innerHTML = html;
};

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
        if(window.showToast) window.showToast("Kategori berhasil disimpan!");
        window.closeModal('modal-category-form');
        window.renderCategoryList();
    } catch(e) {
        if(window.showToast) window.showToast("Gagal menyimpan kategori.", true);
    }
};

window.deleteCategory = function(id) {
    window.AuraAlert.confirm("Hapus kategori ini? (Sub-kategori di dalamnya juga akan ikut terhapus)", async () => {
        try {
            // Hapus Kategori tersebut
            const updates = {};
            updates[`customCategories/${id}`] = null;
            
            // Cari dan hapus semua anaknya jika dia adalah induk
            const rawCategories = AuraState.data.settings?.customCategories || {};
            Object.entries(rawCategories).forEach(([childId, data]) => {
                if(data.parentId === id) updates[`customCategories/${childId}`] = null;
            });

            await window.FirebaseService.updateSettings(updates);
            if(window.showToast) window.showToast("Kategori dihapus.");
            window.renderCategoryList();
        } catch(e) {
            if(window.showToast) window.showToast("Gagal menghapus.", true);
        }
    });
};

