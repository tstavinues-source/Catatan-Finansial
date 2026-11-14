/**
 * Anggaran per Kategori per Siklus
 * (rancangan disetujui pemilik 2026-11-14 dari mockup
 *  mockup-anggaran-kategori — lima keputusan rancangan di sana menjadi
 *  perilaku di sini.)
 *
 * DATA (settings Firebase):
 * - settings.categoryBudgets:
 *     { "<NamaKategori>": { batas: number, jenis: "plafon" | "minimal" } }
 *   "plafon"  = batas maksimum pengeluaran kategori dalam satu siklus.
 *   "minimal" = target minimal (untuk kategori yang justru ingin ditambah,
 *               mis. Sayuran) — statusnya terbalik.
 * - settings.categoryBudgetOptions:
 *     { alert80, alert100, hanyaPribadi, proyeksi } — bawaan semua true.
 *
 * HITUNGAN meniru Analisa (js/modules/analytics.js) + Dasbor
 * (js/renderers/dashboard.js) agar angka antar halaman konsisten:
 * - Rentang = AuraUtils.getPeriodRange() (siklus gajian berjalan).
 * - Hanya tipe 'pengeluaran', bukan is_deleted, kategori transaksi bukan
 *   'Penyesuaian Saldo', dompet tersembunyi dilewati.
 * - Per item: nilai = convertCurrency(harga × qty). Kelompok per item
 *   (item.kelompok || inferKelompokItem); bila opsi hanyaPribadi aktif,
 *   hanya kelompok 'Pribadi' yang dihitung.
 * - KUNCI per item: nama item ternormalisasi (Title Case, pola Analisa),
 *   kategori induknya, kategori utama transaksinya, dan induk dari
 *   kategori utama itu. Anggaran bernama X menerima nilai item bila X sama
 *   dengan salah satu kunci (item dihitung sekali per anggaran — anggaran
 *   adalah lensa bebas, satu item boleh terlihat di dua anggaran berbeda).
 *   Kunci transaksi diperlukan karena kategori utama adalah identitas
 *   transaksi campuran (aturan pemilik 2026-11-06): struk "Belanja
 *   Pribadi" berisi item Pakaian/Elektronik tetap belanja pribadi.
 *   Dengan ini anggaran bisa dipasang di tingkat induk ("Makanan"),
 *   tingkat transaksi ("Belanja Pribadi"), maupun tingkat item
 *   ("Sayuran").
 *
 * STATUS dihitung terhadap LAJU WAKTU siklus (bukan persen mentah):
 * progres waktu memakai rumus yang sama dengan Burn Rate di Dasbor.
 * Peringatan dalam aplikasi: toast sekali per ambang per siklus per
 * kategori (pola hasShownBudgetAlert di Dasbor).
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';
import { Logger } from '../core/logger.js';
import { CategoryManager } from '../modules/categories.js';
import { FirebaseService } from '../services/firebase.js';

const OPSI_BAWAAN = { alert80: true, alert100: true, hanyaPribadi: true, proyeksi: true };

function budgets() {
    const b = AuraState.data.settings?.categoryBudgets;
    return (b && typeof b === 'object') ? b : {};
}

function opsi() {
    return { ...OPSI_BAWAAN, ...(AuraState.data.settings?.categoryBudgetOptions || {}) };
}

function normalisasiNama(str) {
    return String(str || 'Lainnya').trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// Kategori induk — urutan: categoryMappings pemilik, nama kategori yang
// dikenal (sistem/kustom), lalu kata kunci yang SAMA dengan analytics.js,
// terakhir 'Lainnya'. Cerminan ini disengaja: anggaran harus cocok dengan
// angka di halaman Statistik.
function kategoriInduk(nama) {
    const customMap = AuraState.data.settings?.categoryMappings || {};
    if (customMap[nama]) return customMap[nama];
    const semua = CategoryManager.getAllCategories();
    const cocok = Object.values(semua).find(c => c.name && c.name.toLowerCase() === String(nama).toLowerCase());
    if (cocok) return cocok.name;
    const n = String(nama).toLowerCase();
    if (n.match(/makan|camilan|snack|susu|telur|daging|ayam|ikan|sayur|buah|bumbu|bahan|roti|kue|instan|kaleng|mie|jajanan/)) return 'Makanan';
    if (n.match(/minum|kopi|teh|kafe|cair|jus/)) return 'Minuman';
    if (n.match(/elektronik|pulsa|data|internet|listrik|gadget|game|wifi|topup/)) return 'Elektronik';
    if (n.match(/pokok|beras|minyak|gula|sembako/)) return 'Bahan Pokok';
    if (n.match(/rumah|alat|sabun|deterjen|sampo|odol|mandi|cuci|bersih/)) return 'Peralatan Rumah Tangga';
    if (n.match(/transport|bensin|parkir|kereta|bus|gojek|grab|tol/)) return 'Transportasi';
    if (n.match(/pakaian|baju|celana|sepatu|fashion/)) return 'Pakaian';
    if (n.match(/sehat|obat|medis|dokter|apotek|klinik/)) return 'Kesehatan';
    return 'Lainnya';
}

// Total terpakai per nama anggaran pada siklus berjalan.
// Mengembalikan { totals: {nama: nilai}, range, hariBerlalu, totalHari, progresWaktu }
function hitungTerpakai() {
    const range = AuraUtils.getPeriodRange();
    const startMs = new Date(range.start).getTime();
    const endMs = new Date(range.end).getTime();
    const msInDay = 1000 * 60 * 60 * 24;
    const totalHari = Math.max(1, Math.ceil((endMs - startMs) / msInDay));
    const hariBerlalu = Math.min(totalHari, Math.max(1, Math.ceil((Date.now() - startMs) / msInDay)));
    const progresWaktu = hariBerlalu / totalHari;

    const namaList = Object.keys(budgets());
    const totals = {};
    namaList.forEach(n => { totals[n] = 0; });
    if (!namaList.length) return { totals, range, hariBerlalu, totalHari, progresWaktu };

    const hanyaPribadi = opsi().hanyaPribadi;
    const wallets = AuraState.data.wallets || {};
    const allTx = AuraState.data.transactions || [];

    const tambahBilaCocok = function (kunciSet, val) {
        for (let i = 0; i < namaList.length; i++) {
            if (kunciSet.has(namaList[i])) totals[namaList[i]] += val;
        }
    };

    for (let i = 0; i < allTx.length; i++) {
        const trx = allTx[i];
        if (trx.is_deleted || trx.tipe !== 'pengeluaran') continue;
        if (trx.kategori === 'Penyesuaian Saldo') continue;
        const trxTime = new Date(trx.tanggal || trx.createdAt).getTime();
        if (isNaN(trxTime) || trxTime < startMs || trxTime > endMs) continue;
        if (trx.wallet_id && wallets[trx.wallet_id] && wallets[trx.wallet_id].is_hidden) continue;

        if (trx.items && trx.items.length > 0) {
            for (let j = 0; j < trx.items.length; j++) {
                const it = trx.items[j];
                const kel = it.kelompok || (typeof window.inferKelompokItem === 'function' ? window.inferKelompokItem(it.kategori_barang, 'pengeluaran') : 'Pribadi');
                if (hanyaPribadi && kel !== 'Pribadi') continue;
                const bersih = normalisasiNama(it.kategori_barang || 'Lainnya');
                const bersihTrx = normalisasiNama(trx.kategori || 'Lainnya');
                const kunci = new Set([bersih, kategoriInduk(bersih), bersihTrx, kategoriInduk(bersihTrx)]);
                const val = AuraUtils.convertCurrency((Number(it.harga) || 0) * (Number(it.qty) || 1), trx.mata_uang);
                tambahBilaCocok(kunci, val);
            }
        } else {
            const kel = typeof window.inferKelompokItem === 'function' ? window.inferKelompokItem(trx.kategori, 'pengeluaran') : 'Pribadi';
            if (hanyaPribadi && kel !== 'Pribadi') continue;
            const bersih = normalisasiNama(trx.kategori || 'Lainnya');
            const kunci = new Set([bersih, kategoriInduk(bersih)]);
            tambahBilaCocok(kunci, AuraUtils.convertCurrency(trx.nominal || 0, trx.mata_uang));
        }
    }
    return { totals, range, hariBerlalu, totalHari, progresWaktu };
}

function statusAnggaran(def, terpakai, progresWaktu) {
    const batas = Number(def.batas) || 0;
    const pct = batas > 0 ? (terpakai / batas) * 100 : 0;
    const proyeksi = progresWaktu > 0.02 ? terpakai / progresWaktu : terpakai;
    if (def.jenis === 'minimal') {
        if (pct >= 100) return { kunci: 'tercapai', label: 'Tercapai', warna: 'var(--color-income)', pct, proyeksi };
        if (proyeksi >= batas) return { kunci: 'jalur', label: 'Di jalur', warna: 'var(--accent)', pct, proyeksi };
        return { kunci: 'bawah', label: 'Di bawah target', warna: '#fbbf24', pct, proyeksi };
    }
    if (pct >= 100) return { kunci: 'lewat', label: 'Lewat', warna: 'var(--color-expense)', pct, proyeksi };
    if (pct >= 80 || proyeksi > batas) return { kunci: 'waspada', label: 'Waspada', warna: '#fbbf24', pct, proyeksi };
    if (pct <= progresWaktu * 100 + 5) return { kunci: 'sesuai', label: 'Sesuai laju', warna: 'var(--color-income)', pct, proyeksi };
    return { kunci: 'aman', label: 'Aman', warna: 'var(--color-income)', pct, proyeksi };
}

function barisHtml(nama, def, terpakai, ctx, lengkap) {
    const st = statusAnggaran(def, terpakai, ctx.progresWaktu);
    const style = CategoryManager.resolveStyle(nama);
    const fmt = window.formatAuraCurrency || (v => String(v));
    const sisa = (Number(def.batas) || 0) - terpakai;
    const hariSisa = Math.max(0, ctx.totalHari - ctx.hariBerlalu);
    let metaKanan, garisProyeksi = '';
    if (def.jenis === 'minimal') {
        metaKanan = st.kunci === 'tercapai' ? 'Target terpenuhi' : `Kurang ${fmt(Math.max(0, -sisa))} · ${hariSisa} hari`;
        if (lengkap && opsi().proyeksi) {
            garisProyeksi = st.kunci === 'tercapai'
                ? `<p class="text-[10px] mt-1.5" style="color:var(--color-income)">Target minimal siklus ini sudah terpenuhi.</p>`
                : st.kunci === 'jalur'
                    ? `<p class="text-[10px] mt-1.5 text-[var(--text-muted)]">Proyeksi laju: menutup di ±${fmt(st.proyeksi)} — target tercapai bila laju terjaga.</p>`
                    : `<p class="text-[10px] mt-1.5" style="color:#fbbf24">Proyeksi laju: menutup di ±${fmt(st.proyeksi)} — perlu ±${fmt(Math.max(0, -sisa) / Math.max(1, hariSisa))}/hari untuk mencapai target.</p>`;
        }
    } else {
        metaKanan = st.kunci === 'lewat' ? `Melebihi ${fmt(-sisa)}` : `Sisa ${fmt(Math.max(0, sisa))} · ${hariSisa} hari`;
        if (lengkap && opsi().proyeksi) {
            garisProyeksi = st.kunci === 'lewat'
                ? `<p class="text-[10px] mt-1.5" style="color:var(--color-expense)">Sudah melewati plafon sebesar ${fmt(-sisa)} pada siklus ini.</p>`
                : st.proyeksi > (Number(def.batas) || 0)
                    ? `<p class="text-[10px] mt-1.5" style="color:#fbbf24">Proyeksi laju: diperkirakan menutup siklus di ${fmt(st.proyeksi)} — lewat plafon ${fmt(st.proyeksi - (Number(def.batas) || 0))} bila laju tidak berubah.</p>`
                    : `<p class="text-[10px] mt-1.5 text-[var(--text-muted)]">Proyeksi laju: menutup di ±${fmt(st.proyeksi)} — aman di bawah plafon.</p>`;
        }
    }
    const labelBatas = def.jenis === 'minimal' ? 'min. ' : '';
    return `
    <div class="py-2.5 ${lengkap ? 'border-b border-[var(--border-glass)] last:border-b-0' : ''}">
        <div class="flex items-center gap-2">
            <div class="w-7 h-7 icon-chip shrink-0"><i class="fa-solid ${style.icon} text-[10px]" style="color:${style.hex}"></i></div>
            <span class="text-xs font-bold flex-1 truncate">${AuraUtils.escapeHtml(nama)}</span>
            <span class="text-xs font-bold num-tab">${fmt(terpakai)} <span class="text-[var(--text-muted)] font-medium">/ ${labelBatas}${fmt(Number(def.batas) || 0)}</span></span>
        </div>
        <div class="w-full h-2 bg-black/50 rounded-full overflow-hidden mt-2 border border-[var(--border-glass)]">
            <div class="h-full rounded-full transition-all duration-700" style="width:${Math.min(st.pct, 100)}%;background:${st.warna}"></div>
        </div>
        <div class="flex justify-between items-center mt-1.5">
            <span class="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style="color:${st.warna};background:rgba(255,255,255,0.06)">${st.label} · ${Math.round(st.pct)}%</span>
            <span class="text-[10px] text-[var(--text-muted)]">${metaKanan}</span>
        </div>
        ${garisProyeksi}
    </div>`;
}

function periksaPeringatan(ctx) {
    const o = opsi();
    if (!o.alert80 && !o.alert100) return;
    if (!AuraState.system) return;
    if (!AuraState.system.catBudgetAlertFlags) AuraState.system.catBudgetAlertFlags = {};
    const flags = AuraState.system.catBudgetAlertFlags;
    const kunciSiklus = new Date(ctx.range.start).toISOString().slice(0, 10);
    const semua = budgets();
    Object.keys(semua).forEach(nama => {
        const def = semua[nama];
        if (def.jenis === 'minimal') return;
        const pct = (Number(def.batas) || 0) > 0 ? (ctx.totals[nama] || 0) / def.batas * 100 : 0;
        if (o.alert100 && pct >= 100) {
            const k = `${kunciSiklus}|${nama}|100`;
            if (!flags[k]) {
                flags[k] = true;
                if (window.showToast) window.showToast(`Anggaran ${nama} sudah melewati plafon siklus ini (${Math.round(pct)}%).`, true);
            }
        } else if (o.alert80 && pct >= 80) {
            const k = `${kunciSiklus}|${nama}|80`;
            if (!flags[k]) {
                flags[k] = true;
                if (window.showToast) window.showToast(`Anggaran ${nama} sudah ${Math.round(pct)}% dari plafon siklus ini.`);
            }
        }
    });
}

window.renderCategoryBudgets = function () {
    const semua = budgets();
    const namaList = Object.keys(semua);
    const ctx = hitungTerpakai();

    // --- Kartu Dasbor ---
    AuraUtils.safeDOM('dash-catbudget', el => {
        if (!namaList.length) {
            el.innerHTML = `
            <div class="glass-panel p-4 flex items-center gap-3 cursor-pointer" onclick="window.switchView('budgets')">
                <div class="w-9 h-9 icon-chip shrink-0"><i class="fa-solid fa-chart-pie text-accent text-[14px]"></i></div>
                <div class="min-w-0">
                    <p class="text-[8px] text-[var(--text-muted)] uppercase tracking-widest font-bold">Anggaran per Kategori</p>
                    <span class="text-xs font-bold text-[var(--text-main)] block mt-0.5">Belum diatur — ketuk untuk memasang plafon per kategori</span>
                </div>
            </div>`;
            return;
        }
        const urgensi = { lewat: 0, waspada: 1, bawah: 2, sesuai: 3, jalur: 3, aman: 4, tercapai: 5 };
        const terurut = [...namaList].sort((a, b) => {
            const sa = statusAnggaran(semua[a], ctx.totals[a] || 0, ctx.progresWaktu);
            const sb = statusAnggaran(semua[b], ctx.totals[b] || 0, ctx.progresWaktu);
            if (urgensi[sa.kunci] !== urgensi[sb.kunci]) return urgensi[sa.kunci] - urgensi[sb.kunci];
            return sb.pct - sa.pct;
        });
        const tampil = terurut.slice(0, 3);
        el.innerHTML = `
        <div class="glass-panel p-4">
            <div class="flex justify-between items-center">
                <p class="text-[8px] text-[var(--text-muted)] uppercase tracking-widest font-bold"><i class="fa-solid fa-chart-pie text-accent mr-1"></i>Anggaran Kategori</p>
                <button onclick="window.switchView('budgets')" class="text-[10px] font-bold text-accent">Lihat semua</button>
            </div>
            <div class="flex justify-between text-[10px] text-[var(--text-muted)] mt-3">
                <span>Hari ke-<b class="text-white">${ctx.hariBerlalu}</b> dari ${ctx.totalHari}</span>
                <span>Waktu berlalu <b class="text-white">${Math.round(ctx.progresWaktu * 100)}%</b></span>
            </div>
            <div class="w-full h-1.5 bg-black/50 rounded-full overflow-hidden mt-1.5">
                <div class="h-full bg-[var(--text-muted)] rounded-full" style="width:${Math.round(ctx.progresWaktu * 100)}%"></div>
            </div>
            ${tampil.map(n => barisHtml(n, semua[n], ctx.totals[n] || 0, ctx, false)).join('')}
        </div>`;
    });

    // --- Daftar lengkap + pengaturan di Manajer Anggaran ---
    AuraUtils.safeDOM('catbudget-list', el => {
        if (!namaList.length) {
            el.innerHTML = '<p class="text-[11px] text-[var(--text-muted)] italic">Belum ada anggaran kategori. Pasang lewat formulir di bawah — plafon mengikuti siklus gajian, bukan bulan kalender.</p>';
        } else {
            el.innerHTML = namaList.map(n => barisHtml(n, semua[n], ctx.totals[n] || 0, ctx, true)).join('');
        }
    });

    AuraUtils.safeDOM('catbudget-settings-list', el => {
        if (!namaList.length) {
            el.innerHTML = '<p class="text-[10px] text-[var(--text-muted)] italic">Belum ada yang diatur.</p>';
            return;
        }
        el.innerHTML = namaList.map(n => {
            const def = semua[n];
            const enc = encodeURIComponent(n);
            return `
            <div class="flex items-center gap-2 py-2 border-b border-[var(--border-glass)] last:border-b-0">
                <span class="text-xs font-bold flex-1 truncate">${AuraUtils.escapeHtml(n)}</span>
                <select onchange="window.ubahJenisAnggaranKategori('${enc}', this.value)" class="v-input rounded-lg p-2 text-[10px] outline-none bg-black w-[104px]">
                    <option value="plafon" ${def.jenis !== 'minimal' ? 'selected' : ''}>Plafon maks</option>
                    <option value="minimal" ${def.jenis === 'minimal' ? 'selected' : ''}>Target min</option>
                </select>
                <input type="number" value="${Number(def.batas) || 0}" onchange="window.ubahBatasAnggaranKategori('${enc}', this.value)" class="v-input rounded-lg p-2 text-[11px] outline-none w-[96px] text-right font-mono" aria-label="Batas ${AuraUtils.escapeHtml(n)}">
                <button onclick="window.hapusAnggaranKategori('${enc}')" class="aura-icon-btn shrink-0" title="Hapus anggaran ${AuraUtils.escapeHtml(n)}"><i class="fa-solid fa-trash-can text-[10px]"></i></button>
            </div>`;
        }).join('');
    });

    AuraUtils.safeDOM('catbudget-new-cat', sel => {
        if (sel.options.length) return;
        const semuaKategori = CategoryManager.getAllCategories();
        const namaKategori = [...new Set(Object.values(semuaKategori).filter(c => c && c.name && c.type === 'expense').map(c => c.name))]
            .filter(n => n !== 'Penyesuaian Saldo')
            .sort((a, b) => a.localeCompare(b, 'id'));
        sel.innerHTML = namaKategori.map(n => `<option value="${AuraUtils.escapeHtml(n)}">${AuraUtils.escapeHtml(n)}</option>`).join('');
    });

    const o = opsi();
    AuraUtils.safeDOM('catbudget-opt-alert80', el => { el.checked = !!o.alert80; });
    AuraUtils.safeDOM('catbudget-opt-alert100', el => { el.checked = !!o.alert100; });
    AuraUtils.safeDOM('catbudget-opt-pribadi', el => { el.checked = !!o.hanyaPribadi; });
    AuraUtils.safeDOM('catbudget-opt-proyeksi', el => { el.checked = !!o.proyeksi; });

    periksaPeringatan(ctx);
};

function simpanAnggaran(patch) {
    if (!AuraState.data.settings) AuraState.data.settings = {};
    Object.assign(AuraState.data.settings, patch);
    if (AuraState.user?.uid && FirebaseService.updateSettings) {
        FirebaseService.updateSettings(patch).catch(err => Logger.warn('CategoryBudgets', 'Gagal simpan anggaran kategori', err));
    }
    if (typeof window.renderCategoryBudgets === 'function') window.renderCategoryBudgets();
    if (typeof window.debouncedCalculateAll === 'function') window.debouncedCalculateAll();
}

window.simpanAnggaranKategoriBaru = function () {
    const sel = document.getElementById('catbudget-new-cat');
    const jenisEl = document.getElementById('catbudget-new-jenis');
    const amtEl = document.getElementById('catbudget-new-amt');
    const nama = (sel?.value || '').trim();
    const batas = Number(amtEl?.value) || 0;
    if (!nama) { if (window.showToast) window.showToast('Pilih kategori dulu.', true); return; }
    if (batas <= 0) { if (window.showToast) window.showToast('Isi nominal batasnya dulu.', true); return; }
    const semua = { ...budgets() };
    semua[nama] = { batas, jenis: jenisEl?.value === 'minimal' ? 'minimal' : 'plafon' };
    simpanAnggaran({ categoryBudgets: semua });
    if (amtEl) amtEl.value = '';
    if (window.showToast) window.showToast(`Anggaran ${nama} disimpan untuk siklus berjalan.`);
};

window.ubahBatasAnggaranKategori = function (encNama, val) {
    const nama = decodeURIComponent(encNama);
    const batas = Number(val) || 0;
    const semua = { ...budgets() };
    if (!semua[nama]) return;
    if (batas <= 0) { if (window.showToast) window.showToast('Nominal batas harus lebih dari 0.', true); window.renderCategoryBudgets(); return; }
    semua[nama] = { ...semua[nama], batas };
    simpanAnggaran({ categoryBudgets: semua });
};

window.ubahJenisAnggaranKategori = function (encNama, jenis) {
    const nama = decodeURIComponent(encNama);
    const semua = { ...budgets() };
    if (!semua[nama]) return;
    semua[nama] = { ...semua[nama], jenis: jenis === 'minimal' ? 'minimal' : 'plafon' };
    simpanAnggaran({ categoryBudgets: semua });
};

window.hapusAnggaranKategori = function (encNama) {
    const nama = decodeURIComponent(encNama);
    const semua = { ...budgets() };
    if (!semua[nama]) return;
    delete semua[nama];
    simpanAnggaran({ categoryBudgets: semua });
    if (window.showToast) window.showToast(`Anggaran ${nama} dihapus.`);
};

window.ubahOpsiAnggaranKategori = function (kunci, checked) {
    const o = { ...opsi(), [kunci]: !!checked };
    simpanAnggaran({ categoryBudgetOptions: o });
};
