/**
 * Pengaturan Siklus & Gajian (r46) — model HIBRIDA:
 * 1) Tanggal gajian NYATA yang ditandai pengguna (settings.cycleAnchors)
 *    adalah sumber utama awal siklus.
 * 2) Hari gajian rutin (settings.cycleRoutineDay) hanya mengisi bulan
 *    yang belum punya tanggal nyata — diterapkan di AuraUtils.getPeriodRange.
 * 3) Bila keduanya kosong, getPeriodRange jatuh ke tanggal tetap lama
 *    (settings.cycleStartDay).
 * Penyimpanan mengikuti pola startNewCycle: mutasi AuraState lokal lalu
 * FirebaseService.updateSettings.
 */
import { AuraState } from '../core/state.js';
import { Logger } from '../core/logger.js';

const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function formatTanggal(str) {
    const d = new Date(str + 'T00:00:00');
    if (isNaN(d.getTime())) return str;
    return `${d.getDate()} ${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

function simpanSiklus(patch) {
    if (!AuraState.data.settings) AuraState.data.settings = {};
    Object.assign(AuraState.data.settings, patch);
    if (AuraState.user?.uid && window.FirebaseService) {
        window.FirebaseService.updateSettings(patch).catch(err => Logger.warn('CycleSettings', 'Gagal simpan pengaturan siklus', err));
    }
    // cycleAnchorDate menunjuk gajian nyata terakhir yang sudah lewat
    // (dipakai label tombol Siklus); pertahankan konsistensinya di sini.
    const anchors = Array.isArray(AuraState.data.settings.cycleAnchors) ? AuraState.data.settings.cycleAnchors : [];
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const elapsed = anchors.filter(a => a <= todayStr);
    const anchorDate = elapsed.length ? elapsed[elapsed.length - 1] : null;
    AuraState.data.settings.cycleAnchorDate = anchorDate;
    if (AuraState.user?.uid && window.FirebaseService) {
        window.FirebaseService.updateSettings({ cycleAnchorDate: anchorDate }).catch(err => Logger.warn('CycleSettings', 'Gagal simpan cycleAnchorDate', err));
    }
    if (typeof window.updateCycleButtonLabel === 'function') window.updateCycleButtonLabel();
    if (typeof window.debouncedCalculateAll === 'function') window.debouncedCalculateAll();
    if (typeof window.renderAnalytics === 'function') window.renderAnalytics();
}

window.renderSiklusPengaturan = function() {
    const sel = document.getElementById('siklus-hari-rutin');
    if (sel && sel.options.length <= 1) {
        for (let d = 1; d <= 28; d++) {
            const opt = document.createElement('option');
            opt.value = String(d);
            opt.textContent = `Tanggal ${d} setiap bulan`;
            sel.appendChild(opt);
        }
    }
    if (sel) sel.value = String(Number(AuraState.data.settings?.cycleRoutineDay) || 0);

    const daftar = document.getElementById('siklus-daftar-jangkar');
    if (!daftar) return;
    const anchors = [...(AuraState.data.settings?.cycleAnchors || [])].sort().reverse();
    if (!anchors.length) {
        daftar.innerHTML = '<p class="text-[10px] text-[var(--text-muted)] italic">Belum ada tanggal gajian yang ditandai.</p>';
        return;
    }
    daftar.innerHTML = anchors.map(str =>
        `<div class="flex items-center justify-between gap-2 bg-black/30 border border-[var(--border-glass)] rounded-lg px-3 py-2">
            <span class="text-[11px] font-bold text-white"><i class="fa-solid fa-calendar-check text-emerald-400 mr-2"></i>${formatTanggal(str)}</span>
            <button onclick="window.hapusJangkarSiklus('${str}')" class="aura-icon-btn shrink-0" title="Hapus tanggal ini"><i class="fa-solid fa-trash-can text-[10px]"></i></button>
        </div>`
    ).join('');
};

window.tambahJangkarSiklus = function() {
    const input = document.getElementById('siklus-input-tanggal');
    const str = (input?.value || '').trim();
    const d = new Date(str + 'T00:00:00');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str) || isNaN(d.getTime())) {
        if (window.showToast) window.showToast('Pilih tanggal gajian dulu.', true);
        return;
    }
    if (!AuraState.data.settings) AuraState.data.settings = {};
    const anchors = Array.isArray(AuraState.data.settings.cycleAnchors) ? [...AuraState.data.settings.cycleAnchors] : [];
    if (anchors.includes(str)) {
        if (window.showToast) window.showToast('Tanggal itu sudah ditandai.', true);
        return;
    }
    anchors.push(str);
    anchors.sort();
    simpanSiklus({ cycleAnchors: anchors });
    if (input) input.value = '';
    window.renderSiklusPengaturan();
    if (window.showToast) window.showToast(`Tanggal gajian ${formatTanggal(str)} ditandai.`);
};

window.hapusJangkarSiklus = function(str) {
    if (!AuraState.data.settings) AuraState.data.settings = {};
    const anchors = (AuraState.data.settings.cycleAnchors || []).filter(a => a !== str);
    simpanSiklus({ cycleAnchors: anchors });
    window.renderSiklusPengaturan();
    if (window.showToast) window.showToast(`Tanggal gajian ${formatTanggal(str)} dihapus.`);
};

window.ubahHariRutinSiklus = function(val) {
    const day = Math.min(28, Math.max(0, Number(val) || 0));
    simpanSiklus({ cycleRoutineDay: day });
    if (window.showToast) window.showToast(day ? `Perkiraan gajian rutin: tanggal ${day}.` : 'Perkiraan gajian rutin dimatikan.');
};
