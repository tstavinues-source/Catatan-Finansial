/**
 * Navigation & UI State Handlers
 * Mengelola perpindahan tab, tema (Serenity), filter, dan mata uang.
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';
import { Logger } from '../core/logger.js';

// ============================================================================
// SISTEM NAVIGASI TAB (SINGLE PAGE APPLICATION)
// ============================================================================

// Perpindahan tab meluncur seperti UI ponsel modern: tampilan baru masuk
// dari sisi arah tab-nya, tampilan lama bergeser sebagian ke arah berlawanan
// (paralaks). Setiap tampilan adalah lapisan mandiri di dalam #view-container
// (lihat style.css) sehingga posisi gulir tiap tab tersimpan. Bila animasi
// tidak tersedia / gerak dikurangi, perpindahan terjadi seketika.
const TAB_SLIDE_ORDER = ['dashboard', 'transactions', 'analytics', 'budgets', 'oracle'];
let viewAnim = null;

function finalizeViewAnim() {
    if (!viewAnim) return;
    viewAnim.anims.forEach(function(a) { try { a.cancel(); } catch (e) {} });
    if (viewAnim.prevEl && viewAnim.prevEl !== viewAnim.targetEl) {
        viewAnim.prevEl.classList.add('hidden');
        viewAnim.prevEl.classList.remove('block');
    }
    [viewAnim.prevEl, viewAnim.targetEl].forEach(function(el) {
        if (!el) return;
        el.style.zIndex = '';
        el.style.transform = '';
        el.style.background = '';
        el.style.boxShadow = '';
    });
    viewAnim = null;
}

window.switchView = function(viewId) {
    const views = ['dashboard', 'transactions', 'analytics', 'budgets', 'oracle', 'trash', 'brankas'];
    finalizeViewAnim();

    const prevId = AuraState.system.activeView;
    const prevEl = prevId ? document.getElementById(`view-${prevId}`) : null;
    const targetEl = document.getElementById(`view-${viewId}`);

    for (let i = 0; i < views.length; i++) {
        if (views[i] === viewId || views[i] === prevId) continue;
        AuraUtils.safeDOM(`view-${views[i]}`, function(el) {
            el.classList.add('hidden');
            el.classList.remove('block');
        });
    }

    AuraUtils.safeDOM(`view-${viewId}`, function(el) {
        el.classList.remove('hidden');
        el.classList.add('block');
    });

    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prevEl && targetEl && prevEl !== targetEl && typeof targetEl.animate === 'function' && !reduced) {
        const pi = TAB_SLIDE_ORDER.indexOf(prevId);
        const ni = TAB_SLIDE_ORDER.indexOf(viewId);
        let dir = 1;
        if (pi >= 0 && ni >= 0) dir = ni >= pi ? 1 : -1;
        else if (pi === -1 && ni >= 0) dir = -1;

        prevEl.style.zIndex = '1';
        targetEl.style.zIndex = '2';
        targetEl.style.background = 'var(--bg-base)';
        targetEl.style.boxShadow = dir > 0 ? '-18px 0 36px rgba(0,0,0,0.45)' : '18px 0 36px rgba(0,0,0,0.45)';

        const easing = 'cubic-bezier(.32,.72,.24,1)';
        const inAnim = targetEl.animate(
            [{ transform: `translateX(${dir * 100}%)` }, { transform: 'translateX(0)' }],
            { duration: 300, easing: easing }
        );
        const outAnim = prevEl.animate(
            [{ transform: 'translateX(0)' }, { transform: `translateX(${-dir * 28}%)` }],
            { duration: 300, easing: easing }
        );
        viewAnim = { anims: [inAnim, outAnim], prevEl: prevEl, targetEl: targetEl };
        inAnim.onfinish = function() { finalizeViewAnim(); };
    } else if (prevEl && prevEl !== targetEl) {
        prevEl.classList.add('hidden');
        prevEl.classList.remove('block');
    }

    AuraState.system.activeView = viewId;

    const navBtns = document.querySelectorAll('.nav-btn');
    for (let i = 0; i < navBtns.length; i++) {
        const btn = navBtns[i];
        if (btn.dataset.target === viewId) {
            btn.classList.remove('text-[var(--text-muted)]');
            btn.classList.add('text-[var(--accent-primary)]');
        } else {
            btn.classList.add('text-[var(--text-muted)]');
            btn.classList.remove('text-[var(--accent-primary)]');
        }
    }

    if (viewId === 'dashboard' || viewId === 'analytics') {
        if (typeof window.debouncedCalculateAll === 'function') window.debouncedCalculateAll();
    } else if (viewId === 'transactions') {
        if (typeof window.populateUserFilterDropdown === 'function') window.populateUserFilterDropdown();
    } else if (viewId === 'budgets') {
        if (typeof window.renderRecurringUIForBudget === 'function') window.renderRecurringUIForBudget();
    } else if (viewId === 'oracle') {
        if (typeof window.renderWawasan === 'function') window.renderWawasan();
    } else if (viewId === 'brankas') {
        if (typeof window.renderBrankas === 'function') window.renderBrankas();
    }
};

// ============================================================================
// KONTROL TEMA VISUAL (SERENITY MODE)
// ============================================================================

window.toggleTheme = function() {
    // Daftar tema diperbarui: Neon diganti dengan Serenity
    const themes = ['midnight', 'sakura', 'serenity']; 
    let currentTheme = AuraState.system.theme || document.documentElement.getAttribute('data-theme') || 'midnight';
    
    let currentIndex = themes.indexOf(currentTheme);
    if (currentIndex === -1) currentIndex = 0;
    
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    
    document.documentElement.setAttribute('data-theme', nextTheme);
    // Satu gestur mengganti seluruh varian (dasar + aksen berpasangan)
    const accentPair = { midnight: 'tembaga', sakura: 'sage', serenity: 'frost' };
    if (typeof window.applyAndSaveTheme === 'function') window.applyAndSaveTheme(accentPair[nextTheme] || 'tembaga', true);
    AuraState.system.theme = nextTheme;
    
    if (AuraState.user.uid && window.FirebaseService) {
        window.FirebaseService.updateSettings({ theme: nextTheme }).catch(err => {
            Logger.warn('Navigation', 'Gagal menyimpan preferensi tema ke Cloud', err);
        });
    }
    
    const themeLabel = { midnight: 'TEMBAGA', sakura: 'SAGE', serenity: 'FROST' };
    if (window.showToast) window.showToast(`Tampilan berganti ke varian: ${themeLabel[nextTheme] || nextTheme.toUpperCase()}`);
};

// ============================================================================
// FILTER, MULTI-USER & MODE PERIODE WAKTU
// ============================================================================

window.changeViewMode = function(mode) {
    AuraState.filters.periodMode = mode;
    // Bersihkan rentang custom kalau user balik ke mode siklus/bulan/semua
    AuraState.filters.customStart = null;
    AuraState.filters.customEnd = null;
    
    const modes = ['period', 'month', 'all'];
    for (let i = 0; i < modes.length; i++) {
        AuraUtils.safeDOM(`btn-mode-${modes[i]}`, function(el) {
            if (modes[i] === mode) {
                el.classList.add('text-accent', 'bg-white/10');
            } else {
                el.classList.remove('text-accent', 'bg-white/10');
            }
        });
    }
    
    if (typeof window.debouncedCalculateAll === 'function') window.debouncedCalculateAll();
    // FITUR BARU: Analytics sekarang ikut pakai AuraState.filters.periodMode
    // yang sama (lihat perbaikan di analytics.js), jadi harus ikut di-refresh juga.
    if (typeof window.renderAnalytics === 'function') window.renderAnalytics();
};

// FITUR BARU: siklus "16-15" sebelumnya paten di kode. Sekarang tanggal mulainya
// bisa diatur user sendiri (disimpan di settings.cycleStartDay), berlaku untuk
// SEMUA fitur yang pakai mode 'period' (Dashboard, Analytics, Download CSV)
// karena semuanya sudah disatukan lewat AuraUtils.getPeriodRange().
window.promptCycleStartDay = function() {
    const current = AuraState.data.settings?.cycleStartDay || 16;
    window.AuraAlert.prompt("Tanggal berapa siklus bulanan dimulai? (2-28):", String(current), (val) => {
        if (val === null) return;
        const day = parseInt(val, 10);
        if (isNaN(day) || day < 2 || day > 28) {
            if (window.showToast) window.showToast("Masukkan angka 2-28.", true);
            return;
        }
        
        if (!AuraState.data.settings) AuraState.data.settings = {};
        AuraState.data.settings.cycleStartDay = day;
        
        if (AuraState.user.uid && window.FirebaseService) {
            window.FirebaseService.updateSettings({ cycleStartDay: day }).catch(err => Logger.warn('Navigation', 'Gagal simpan hari siklus', err));
        }
        
        window.updateCycleButtonLabel();
        if (typeof window.debouncedCalculateAll === 'function') window.debouncedCalculateAll();
        if (typeof window.renderAnalytics === 'function') window.renderAnalytics();
        if (window.showToast) window.showToast(`Siklus diatur mulai tanggal ${day}.`);
    });
};

// FITUR BARU: siklus mengikuti tanggal gajian nyata. Tombol "Mulai Siklus
// Baru" mencatat tanggal gajian (bawaan: hari ini, boleh diubah) sebagai
// jangkar siklus baru di settings.cycleAnchors. getPeriodRange memakai
// jangkar terakhir sebagai awal siklus berjalan, jadi siklus tidak lagi
// paten di tanggal tetap. Ren juga memasang jangkar yang sama setiap kali
// gaji dicatat, jadi tombol ini jalur manual cadangannya.
window.startNewCycle = function() {
    const now = new Date();
    const pad = function(n) { return String(n).padStart(2, '0'); };
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    window.AuraAlert.prompt("Mulai siklus baru — tanggal gajian (YYYY-MM-DD):", todayStr, (val) => {
        if (val === null) return;
        const str = String(val).trim();
        const d = new Date(str + 'T00:00:00');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(str) || isNaN(d.getTime())) {
            if (window.showToast) window.showToast("Format tanggal tidak valid.", true);
            return;
        }
        if (d.getTime() > now.getTime()) {
            if (window.showToast) window.showToast("Tanggal gajian tidak boleh di masa depan.", true);
            return;
        }
        
        if (!AuraState.data.settings) AuraState.data.settings = {};
        const anchors = Array.isArray(AuraState.data.settings.cycleAnchors) ? [...AuraState.data.settings.cycleAnchors] : [];
        if (!anchors.includes(str)) anchors.push(str);
        anchors.sort();
        AuraState.data.settings.cycleAnchors = anchors;
        AuraState.data.settings.cycleAnchorDate = str;
        
        if (AuraState.user.uid && window.FirebaseService) {
            window.FirebaseService.updateSettings({ cycleAnchors: anchors, cycleAnchorDate: str }).catch(err => Logger.warn('Navigation', 'Gagal simpan jangkar siklus', err));
        }
        
        window.updateCycleButtonLabel();
        if (typeof window.debouncedCalculateAll === 'function') window.debouncedCalculateAll();
        if (typeof window.renderAnalytics === 'function') window.renderAnalytics();
        if (window.showToast) window.showToast(`Siklus baru dimulai ${str}.`);
    });
};

// Perbarui label tombol "Siklus" supaya mencerminkan jangkar yang dipakai
window.updateCycleButtonLabel = function() {
    const anchorStr = AuraState.data.settings?.cycleAnchorDate;
    const anchor = anchorStr ? new Date(anchorStr + 'T00:00:00') : null;
    AuraUtils.safeDOM('btn-mode-period', el => {
        if (anchor && !isNaN(anchor.getTime())) {
            el.innerHTML = `Siklus ${anchor.getDate()}/${anchor.getMonth() + 1}`;
        } else {
            const day = AuraState.data.settings?.cycleStartDay || 16;
            el.innerHTML = `Siklus ${day}-${day - 1}`;
        }
    });
};

window.applyFilters = function() {
    AuraUtils.safeDOM('filter-search', el => AuraState.filters.search = el.value || '');
    AuraUtils.safeDOM('filter-category', el => AuraState.filters.category = el.value || 'ALL');
    AuraUtils.safeDOM('filter-user', el => AuraState.filters.user = el.value || 'ALL');
    
    if (typeof window.debouncedCalculateAll === 'function') window.debouncedCalculateAll();
};

window.populateUserFilterDropdown = function() {
    AuraUtils.safeDOM('filter-user', function(el) {
        const transactions = AuraState.data.transactions || [];
        const membersSettings = AuraState.data.settings?.familyMembers || [];
        const uniqueUsers = new Set();
        
        transactions.forEach(t => t.user_id && uniqueUsers.add(t.user_id));
        membersSettings.forEach(m => uniqueUsers.add(m));

        let htmlOpts = `<option value="ALL">SEMUA PENGGUNA</option>`;
        Array.from(uniqueUsers).forEach(user => {
            const userNm = AuraUtils.escapeHtml(user);
            htmlOpts += `<option value="${userNm}">${userNm}</option>`;
        });
        
        const currentVal = el.value;
        el.innerHTML = htmlOpts;
        if (currentVal && uniqueUsers.has(currentVal)) el.value = currentVal;
    });
};

// ============================================================================
// KONTROL MATA UANG
// ============================================================================

// PERBAIKAN: Sebelumnya ada DUA definisi window.setCurrency (di sini dan di
// main.js). Karena main.js dievaluasi belakangan, definisinya menimpa versi
// ini — dan versi main.js TIDAK PERNAH menyimpan preferensi mata uang ke
// Firebase (cuma ke localStorage), jadi preferensi mata uang gagal sinkron
// lintas perangkat. Definisi duplikat di main.js sudah dihapus; versi di sini
// sekarang jadi satu-satunya sumber, dan tetap menulis ke localStorage juga
// (agar bisa langsung dipakai untuk render awal sebelum Firebase termuat).
window.setCurrency = function(curr) {
    if (curr !== 'JPY' && curr !== 'IDR') return;
    AuraState.system.displayCurrency = curr;
    AuraState.system.currency = curr;

    try { localStorage.setItem('aurafi_active_currency', curr); } catch(e) { /* abaikan jika storage diblokir */ }
    
    const btnJpy = document.getElementById('btn-curr-jpy');
    const btnIdr = document.getElementById('btn-curr-idr');
    
    if (btnJpy && btnIdr) {
        if (curr === 'JPY') {
            btnJpy.className = "px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all bg-accent text-[var(--bg-base)]";
            btnIdr.className = "px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all text-[var(--text-muted)]";
        } else {
            btnIdr.className = "px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all bg-accent text-[var(--bg-base)]";
            btnJpy.className = "px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all text-[var(--text-muted)]";
        }
    }
    
    if (AuraState.user.uid && window.FirebaseService) {
        window.FirebaseService.updateSettings({ currency: curr }).catch(err => Logger.warn('Navigation', 'Gagal menyimpan mata uang', err));
    }
    
    if (typeof window.loadRealtimeDatabaseData === 'function') {
        window.loadRealtimeDatabaseData(true);
    } else if (typeof window.debouncedCalculateAll === 'function') {
        window.debouncedCalculateAll();
    }
};

// ============================================================================
// UI TOGGLES
// ============================================================================

window.toggleGoalForm = function() {
    AuraUtils.safeDOM('goal-form', el => el.classList.toggle('hidden'));
};

window.promptBudget = function() {
    // Menggunakan AURA ALERT PROMPT untuk UI yang lebih premium
    window.AuraAlert.prompt("Ubah Batas Anggaran (Nominal Angka):", "Masukkan nominal...", (amt) => {
        if (amt !== null) {
            const parsedAmt = parseFloat(amt);
            if (!isNaN(parsedAmt) && parsedAmt >= 0) {
                AuraState.data.monthlyBudget = parsedAmt;
                if (AuraState.user.uid && window.FirebaseService) {
                    window.FirebaseService.updateSettings({ monthlyBudget: { limit: parsedAmt } });
                }
                if (typeof window.debouncedCalculateAll === 'function') window.debouncedCalculateAll();
                if (window.showToast) window.showToast(`Anggaran diperbarui!`);
            } else {
                if (window.showToast) window.showToast("Input tidak valid!", true);
            }
        }
    });
};
