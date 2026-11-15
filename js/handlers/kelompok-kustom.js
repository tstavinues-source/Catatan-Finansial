/**
 * Kelompok Kustom — pos laporan item tambahan per buku.
 * (Aturan pemilik 2026-11-15 "satu konsep": kelompok tidak lagi terkunci
 * pada lima nama bawaan; pemilik buku boleh menambah kelompoknya sendiri,
 * mis. "Kebutuhan Bayi", supaya pos seperti belanja bayi terlihat utuh
 * tanpa mengotori angka Pribadi.)
 *
 * DATA (settings Firebase):
 * - settings.customKelompok: string[] — nama kelompok kustom buku ini.
 *   Jembatan MCP membaca daftar yang sama (konteks_buku.kelompok_sah) dan
 *   hanya mengizinkan kelompok bawaan + daftar ini pada item transaksi.
 *
 * PERILAKU LAPORAN: kelompok kustom adalah pos tersendiri yang
 * diperlakukan seperti Pribadi (bukan Kewajiban) — pemecahan
 * personal/obligation di Dasbor & Laporan Tutup Buku sudah menghitung
 * semua kelompok selain Kewajiban/Kewajiban Terpisah sebagai personal,
 * jadi tidak ada perubahan rumus di sana.
 */

import { AuraState } from '../core/state.js';
import { FirebaseService } from '../services/firebase.js';

export const KELOMPOK_BAWAAN = ['Pribadi', 'Kewajiban', 'Kewajiban Terpisah', 'Pemasukan', 'Penyesuaian'];

export function getCustomKelompok() {
    const d = AuraState.data.settings?.customKelompok;
    return Array.isArray(d) ? d.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()) : [];
}

export function getKelompokSah() {
    return [...KELOMPOK_BAWAAN, ...getCustomKelompok()];
}
window.getKelompokSah = getKelompokSah;

// Suntikkan opsi kelompok kustom ke pemilih kelompok item (modal tambah
// item + modal ubah item). Dipanggil dari listener settings firebase.js
// setiap pengaturan berubah — termasuk perubahan yang dibuat AI lewat
// jembatan MCP — dan sesudah tambah/hapus di Pengaturan.
window.refreshKelompokSelects = function() {
    for (const id of ['add-item-kelompok', 'edit-item-kelompok']) {
        const sel = document.getElementById(id);
        if (!sel) continue;
        const cur = sel.value;
        sel.querySelectorAll('option[data-custom-kelompok]').forEach(o => o.remove());
        for (const nama of getCustomKelompok()) {
            const opt = document.createElement('option');
            opt.value = nama;
            opt.textContent = nama;
            opt.dataset.customKelompok = '1';
            sel.appendChild(opt);
        }
        // Pulihkan pilihan yang sedang aktif bila masih ada opsinya.
        if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
    }
    // Filter kelompok panel Distribusi Kategori (STATS): kelompok kustom
    // ikut menjadi pilihan saringan "<Nama> Saja", sejalan dengan
    // "Pribadi Saja"/"Kewajiban Saja". Tanpa ini kelompok kustom hanya
    // terlihat pada "Semua Kelompok" dan tidak bisa disaring sendiri.
    const statsSel = document.getElementById('stats-kelompok-filter');
    if (statsSel) {
        const cur = statsSel.value;
        statsSel.querySelectorAll('option[data-custom-kelompok]').forEach(o => o.remove());
        for (const nama of getCustomKelompok()) {
            const opt = document.createElement('option');
            opt.value = nama;
            opt.textContent = nama + ' Saja';
            opt.dataset.customKelompok = '1';
            statsSel.appendChild(opt);
        }
        if (cur && [...statsSel.options].some(o => o.value === cur)) {
            statsSel.value = cur;
        } else if (AuraState.temp?.analyticsKelompok && ![...statsSel.options].some(o => o.value === AuraState.temp.analyticsKelompok)) {
            // Kelompok yang sedang menyaring sudah dihapus — kembali ke Semua.
            AuraState.temp.analyticsKelompok = 'ALL';
            statsSel.value = 'ALL';
        }
    }
};

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

window.renderKelompokKustomPengaturan = function() {
    const daftar = document.getElementById('kelompok-kustom-daftar');
    if (!daftar) return;
    const list = getCustomKelompok();
    if (!list.length) {
        daftar.innerHTML = '<p class="text-[10px] text-[var(--text-muted)] italic">Belum ada kelompok kustom. Kelompok bawaan: Pribadi, Kewajiban, Kewajiban Terpisah, Pemasukan, Penyesuaian.</p>';
        return;
    }
    daftar.innerHTML = list.map(nama =>
        `<div class="flex items-center justify-between gap-2 bg-black/30 border border-[var(--border-glass)] rounded-lg px-3 py-2">
            <span class="text-[11px] font-bold text-white"><i class="fa-solid fa-layer-group text-emerald-400 mr-2"></i>${escapeHtml(nama)}</span>
            <button onclick="window.hapusKelompokKustom('${escapeHtml(nama).replace(/'/g, "\\'")}')" class="aura-icon-btn shrink-0" title="Hapus kelompok ini"><i class="fa-solid fa-trash-can text-[10px]"></i></button>
        </div>`
    ).join('');
};

window.tambahKelompokKustom = async function() {
    const input = document.getElementById('kelompok-kustom-input');
    const nama = (input?.value || '').trim();
    if (!nama || nama.length > 40) {
        if (window.showToast) window.showToast('Nama kelompok harus 1–40 karakter.', true);
        return;
    }
    const key = nama.toLowerCase();
    if (KELOMPOK_BAWAAN.some(b => b.toLowerCase() === key)) {
        if (window.showToast) window.showToast(`"${nama}" adalah kelompok bawaan — sudah selalu tersedia.`, true);
        return;
    }
    const list = getCustomKelompok();
    if (list.some(x => x.toLowerCase() === key)) {
        if (window.showToast) window.showToast(`Kelompok "${nama}" sudah ada.`, true);
        return;
    }
    try {
        await FirebaseService.updateSettings({ customKelompok: [...list, nama] });
        if (input) input.value = '';
        window.renderKelompokKustomPengaturan();
        window.refreshKelompokSelects();
        if (window.showToast) window.showToast(`Kelompok "${nama}" ditambahkan.`);
    } catch (e) {
        if (window.showToast) window.showToast('Gagal menambah kelompok.', true);
    }
};

window.hapusKelompokKustom = async function(nama) {
    const list = getCustomKelompok().filter(x => x !== nama);
    try {
        await FirebaseService.updateSettings({ customKelompok: list });
        window.renderKelompokKustomPengaturan();
        window.refreshKelompokSelects();
        if (window.showToast) window.showToast(`Kelompok "${nama}" dihapus. Transaksi lama tidak berubah.`);
    } catch (e) {
        if (window.showToast) window.showToast('Gagal menghapus kelompok.', true);
    }
};
