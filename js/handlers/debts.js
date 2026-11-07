/**
 * Utang & Piutang Handlers
 * Fitur catatan utang (kita berutang) & piutang (orang berutang ke kita).
 *
 * MEKANISME (keputusan desain tahap ini):
 * - Arus dompet dibukukan sebagai transaksi bertipe BARU berpasangan
 *   'utangpiutang_masuk' (dana masuk dompet) dan 'utangpiutang_keluar'
 *   (dana keluar dompet) — meniru pola 'mutasi_masuk'/'mutasi_keluar'.
 *   Semua total pemasukan/pengeluaran di aplikasi (dashboard, statistik,
 *   Wawasan, laporan tutup siklus) hanya menghitung tipe 'pemasukan' /
 *   'pengeluaran' (dan 'nabung' untuk tabungan), jadi gerakan utang/piutang
 *   TIDAK PERNAH terhitung sebagai pemasukan/pengeluaran pribadi — terkecuali
 *   secara konstruksi, bukan lewat penyaringan kategori. Saldo dompet tetap
 *   bergerak karena setiap jalur hitung saldo punya cabang tanda untuk
 *   kedua tipe ini (modules/wallets.js, renderers/dashboard.js,
 *   handlers/reconcile.js, handlers/motion.js, services/memory.js,
 *   handlers/widget-sync.js, validasi mutasi di handlers/transactions.js).
 * - Catatan disimpan di node 'debts'. Sisa & status DITURUNKAN dari data
 *   (jumlah awal − jumlah pembayaran yang masih aktif), tidak disimpan
 *   sebagai angka bebas. Pembayaran yang transaksi dompetnya sudah dibuang
 *   dari Log (is_deleted) ikut dianggap tidak aktif lewat cek silang id
 *   transaksi aktif — jadi menghapus dari Log pun konsisten.
 * - Penulisan catatan + transaksi pendampingnya ATOMIK satu operasi
 *   multi-path (pola executeAtomicTransfer di services/firebase.js).
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';
import { FirebaseService } from '../services/firebase.js';

// ============================================================================
// MATEMATIKA MURNI — sisa, status, total (tanpa DOM; diekspos untuk pengujian)
// ============================================================================

function pembayaranAktif(debt, activeTrxIds) {
    const list = Array.isArray(debt && debt.pembayaran) ? debt.pembayaran : [];
    return list.filter(function(p) {
        if (!p || p.is_deleted) return false;
        if (p.trx_id && activeTrxIds && !activeTrxIds.has(p.trx_id)) return false;
        return true;
    });
}

function hitungTerbayar(debt, activeTrxIds) {
    return pembayaranAktif(debt, activeTrxIds).reduce(function(sum, p) {
        return sum + (Number(p.jumlah) || 0);
    }, 0);
}

function hitungSisa(debt, activeTrxIds) {
    const sisa = (Number(debt && debt.jumlah) || 0) - hitungTerbayar(debt, activeTrxIds);
    return Math.max(0, sisa);
}

function statusDebt(debt, activeTrxIds) {
    if (hitungSisa(debt, activeTrxIds) <= 0) return 'Lunas';
    return hitungTerbayar(debt, activeTrxIds) > 0 ? 'Sebagian' : 'Aktif';
}

function isLewatTempo(debt, activeTrxIds, todayStr) {
    if (!debt || !debt.jatuh_tempo) return false;
    if (statusDebt(debt, activeTrxIds) === 'Lunas') return false;
    return debt.jatuh_tempo < todayStr;
}

// convertFn(amount, mataUang) mengubah nominal bercap ke mata uang tampilan.
function totalUtangPiutang(debts, activeTrxIds, convertFn) {
    const conv = typeof convertFn === 'function' ? convertFn : function(v) { return Number(v) || 0; };
    const hasil = { utang: 0, piutang: 0, bersih: 0, aktifUtang: 0, aktifPiutang: 0, belumLunas: 0, lunas: 0 };
    (debts || []).forEach(function(d) {
        if (!d || d.is_deleted) return;
        const sisa = conv(hitungSisa(d, activeTrxIds), d.mata_uang);
        const st = statusDebt(d, activeTrxIds);
        if (st === 'Lunas') { hasil.lunas++; return; }
        hasil.belumLunas++;
        if (d.arah === 'piutang') { hasil.piutang += sisa; hasil.aktifPiutang++; }
        else { hasil.utang += sisa; hasil.aktifUtang++; }
    });
    hasil.bersih = hasil.piutang - hasil.utang;
    return hasil;
}

window.DebtMath = {
    pembayaranAktif: pembayaranAktif,
    terbayar: hitungTerbayar,
    sisa: hitungSisa,
    status: statusDebt,
    lewatTempo: isLewatTempo,
    total: totalUtangPiutang
};

// ============================================================================
// PEMBANTU TAMPILAN
// ============================================================================

function esc(v) { return AuraUtils.escapeHtml(String(v == null ? '' : v)); }

function todayStr() {
    const d = new Date();
    const p = function(n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function fmtTgl(v) {
    if (!v) return '-';
    const d = new Date(v + 'T00:00:00');
    if (isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

function fmtAmt(amount, mataUang) {
    if (typeof window.convertAndFormatCurrency === 'function') return window.convertAndFormatCurrency(Number(amount) || 0, mataUang);
    return AuraUtils.formatCurrency(Number(amount) || 0);
}

function fmtTotal(amount) {
    if (typeof window.formatAuraCurrency === 'function') return window.formatAuraCurrency(Number(amount) || 0);
    return AuraUtils.formatCurrency(Number(amount) || 0);
}

function activeTrxIds() {
    const set = new Set();
    (AuraState.data.transactions || []).forEach(function(t) { if (t && t.id) set.add(t.id); });
    return set;
}

function walletName(id) {
    const w = (AuraState.data.wallets || {})[id];
    return w ? w.name : '';
}

function selisihHari(tglStr) {
    const a = new Date(todayStr() + 'T00:00:00').getTime();
    const b = new Date(tglStr + 'T00:00:00').getTime();
    return Math.round((b - a) / 86400000);
}

function chipStatus(debt, ids) {
    if (isLewatTempo(debt, ids, todayStr())) {
        return '<span class="up-chip up-chip-lewat"><i class="fa-solid fa-triangle-exclamation"></i>Lewat Jatuh Tempo</span>';
    }
    const st = statusDebt(debt, ids);
    if (st === 'Lunas') return '<span class="up-chip up-chip-lunas"><i class="fa-solid fa-check"></i>Lunas</span>';
    if (st === 'Sebagian') return '<span class="up-chip up-chip-sebagian">Sebagian</span>';
    return '<span class="up-chip up-chip-aktif">Aktif</span>';
}

function teksJatuhTempo(debt, ids) {
    if (!debt.jatuh_tempo) return '<i class="fa-regular fa-calendar"></i>Tanpa jatuh tempo';
    const hari = selisihHari(debt.jatuh_tempo);
    const lunas = statusDebt(debt, ids) === 'Lunas';
    let ekor;
    if (lunas) ekor = '';
    else if (hari < 0) ekor = ' · <span class="text-[var(--color-expense)] font-bold">lewat ' + Math.abs(hari) + ' hari</span>';
    else if (hari === 0) ekor = ' · <span class="font-bold">hari ini</span>';
    else ekor = ' · ' + hari + ' hari lagi';
    return '<i class="fa-regular fa-calendar"></i>Jatuh tempo ' + fmtTgl(debt.jatuh_tempo) + ekor;
}

// ============================================================================
// RENDER — KARTU DASHBOARD (dapat dilipat) + HALAMAN FITUR
// ============================================================================

const UP_CARD_KEY = 'aurafi_up_card_open';

window.toggleDebtCard = function() {
    const open = localStorage.getItem(UP_CARD_KEY) === '1';
    localStorage.setItem(UP_CARD_KEY, open ? '0' : '1');
    window.applyDebtCardState();
};

window.applyDebtCardState = function() {
    const card = document.getElementById('up-card');
    if (!card) return;
    card.classList.toggle('open', localStorage.getItem(UP_CARD_KEY) === '1');
};

window.switchDebtTab = function(arah) {
    AuraState.temp.debtTab = arah === 'piutang' ? 'piutang' : 'utang';
    window.renderDebts();
};

window.renderDebts = function() {
    const debts = (AuraState.data.debts || []).filter(function(d) { return d && !d.is_deleted; });
    const ids = activeTrxIds();
    const conv = function(v, cur) { return AuraUtils.convertCurrency(Number(v) || 0, cur); };
    const tot = totalUtangPiutang(debts, ids, conv);
    const tab = AuraState.temp.debtTab === 'piutang' ? 'piutang' : 'utang';

    // --- Kartu dashboard ---
    AuraUtils.safeDOM('up-sum-line', function(el) {
        if (tot.belumLunas === 0 && tot.lunas === 0) {
            el.innerHTML = 'Belum ada utang atau piutang';
            return;
        }
        const bersihCls = tot.bersih < 0 ? 'text-[var(--color-expense)]' : 'text-[var(--color-income)]';
        const bersihTxt = (tot.bersih > 0 ? '+' : '') + fmtTotal(tot.bersih);
        el.innerHTML = 'Utang <span class="text-[var(--color-expense)] font-extrabold">' + fmtTotal(tot.utang) + '</span>'
            + ' · Piutang <span class="text-[var(--color-income)] font-extrabold">' + fmtTotal(tot.piutang) + '</span>'
            + ' · Bersih <span class="' + bersihCls + ' font-extrabold">' + bersihTxt + '</span>';
    });
    AuraUtils.safeDOM('up-total-utang', function(el) { el.innerText = fmtTotal(tot.utang); });
    AuraUtils.safeDOM('up-total-piutang', function(el) { el.innerText = fmtTotal(tot.piutang); });
    AuraUtils.safeDOM('up-posisi-bersih', function(el) {
        el.innerText = (tot.bersih > 0 ? '+' : '') + fmtTotal(tot.bersih);
        el.className = 'font-mono font-extrabold text-[15px] ' + (tot.bersih < 0 ? 'text-[var(--color-expense)]' : 'text-[var(--color-income)]');
    });
    AuraUtils.safeDOM('up-card-foot', function(el) {
        el.innerText = tot.belumLunas + ' pinjaman belum lunas · ' + tot.lunas + ' lunas';
    });
    window.applyDebtCardState();

    // --- Kepala ringkasan halaman fitur ---
    AuraUtils.safeDOM('up-page-utang', function(el) { el.innerText = fmtTotal(tot.utang); });
    AuraUtils.safeDOM('up-page-piutang', function(el) { el.innerText = fmtTotal(tot.piutang); });
    AuraUtils.safeDOM('up-page-utang-sub', function(el) { el.innerText = tot.aktifUtang + ' catatan aktif'; });
    AuraUtils.safeDOM('up-page-piutang-sub', function(el) { el.innerText = tot.aktifPiutang + ' catatan aktif'; });
    AuraUtils.safeDOM('up-page-bersih', function(el) {
        el.innerText = (tot.bersih > 0 ? '+' : '') + fmtTotal(tot.bersih);
        el.className = 'font-mono font-extrabold ' + (tot.bersih < 0 ? 'text-[var(--color-expense)]' : 'text-[var(--color-income)]');
    });

    // --- Tab ---
    AuraUtils.safeDOM('up-tab-utang', function(el) {
        el.className = 'up-seg-btn' + (tab === 'utang' ? ' on-utang' : '');
    });
    AuraUtils.safeDOM('up-tab-piutang', function(el) {
        el.className = 'up-seg-btn' + (tab === 'piutang' ? ' on-piutang' : '');
    });

    // --- Daftar per arah ---
    ['utang', 'piutang'].forEach(function(arah) {
        AuraUtils.safeDOM('up-list-' + arah, function(el) {
            const daftar = debts.filter(function(d) { return (d.arah === 'piutang' ? 'piutang' : 'utang') === arah; });
            if (daftar.length === 0) {
                el.innerHTML = '<div class="glass-panel p-6 text-center">'
                    + '<div class="w-12 h-12 icon-chip mx-auto mb-3"><i class="fa-solid fa-handshake text-base"></i></div>'
                    + '<p class="font-bold text-sm mb-1">Belum ada catatan ' + arah + '</p>'
                    + '<p class="text-[11px] text-[var(--text-muted)] leading-relaxed mb-4">Catat utang atau piutang pertamamu di sini. Arus dompetnya tercatat, tetapi tidak dihitung sebagai pemasukan atau pengeluaran pribadi.</p>'
                    + '<button onclick="window.openDebtForm(\'' + arah + '\')" class="px-4 py-2.5 rounded-xl bg-accent text-[var(--invert-contrast)] font-bold text-[11px] active:scale-95 transition"><i class="fa-solid fa-plus"></i> Tambah Utang / Piutang</button>'
                    + '</div>';
                return;
            }
            el.innerHTML = daftar.map(function(d) { return kartuPinjamanHtml(d, ids); }).join('');
        });
        const listEl = document.getElementById('up-list-' + arah);
        if (listEl) listEl.style.display = tab === arah ? '' : 'none';
    });
};

function kartuPinjamanHtml(d, ids) {
    const arah = d.arah === 'piutang' ? 'piutang' : 'utang';
    const warna = arah === 'utang' ? 'var(--color-expense)' : 'var(--color-income)';
    const sisa = hitungSisa(d, ids);
    const terbayar = hitungTerbayar(d, ids);
    const jumlah = Number(d.jumlah) || 0;
    const pct = jumlah > 0 ? Math.min(100, Math.round(terbayar / jumlah * 100)) : 0;
    const st = statusDebt(d, ids);
    const lewat = isLewatTempo(d, ids, todayStr());
    let sub;
    if (st === 'Lunas') {
        const aktif = pembayaranAktif(d, ids);
        const tglLunas = aktif.length ? aktif.map(function(p) { return p.tanggal || ''; }).sort().pop() : '';
        sub = 'Pinjaman awal <span class="font-mono">' + fmtAmt(jumlah, d.mata_uang) + '</span>' + (tglLunas ? ' · lunas ' + fmtTgl(tglLunas) : '');
    } else if (terbayar > 0) {
        sub = 'Sisa dari pinjaman awal <span class="font-mono">' + fmtAmt(jumlah, d.mata_uang) + '</span> · ' + (arah === 'utang' ? 'terbayar' : 'kembali') + ' ' + pct + '%';
    } else {
        sub = 'Sisa dari pinjaman awal <span class="font-mono">' + fmtAmt(jumlah, d.mata_uang) + '</span> · ' + (arah === 'utang' ? 'belum ada pembayaran' : 'belum ada pengembalian');
    }
    return '<div class="glass-panel up-loan-card' + (lewat ? ' lewat' : '') + (st === 'Lunas' ? ' lunas-card' : '') + ' cursor-pointer active:scale-[0.99] transition" onclick="window.openDebtDetail(\'' + d.id + '\')">'
        + '<div class="flex justify-between items-start gap-2 mb-1.5">'
        + '<p class="font-bold text-sm truncate">' + esc(d.pihak) + '</p>' + chipStatus(d, ids)
        + '</div>'
        + '<p class="font-mono font-extrabold text-lg" style="color:' + warna + '">' + fmtAmt(sisa, d.mata_uang) + '</p>'
        + '<p class="text-[10px] text-[var(--text-muted)] mt-0.5">' + sub + '</p>'
        + '<div class="w-full h-1.5 bg-black/50 rounded-full overflow-hidden my-2.5"><div class="h-full rounded-full transition-all duration-700" style="width:' + pct + '%; background:' + warna + '"></div></div>'
        + '<p class="text-[10px] text-[var(--text-muted)]">' + teksJatuhTempo(d, ids) + '</p>'
        + '</div>';
}

// ============================================================================
// RINCIAN SATU PINJAMAN
// ============================================================================

window.openDebtDetail = function(id) {
    AuraState.temp.debtDetailId = id;
    if (typeof window.switchView === 'function') window.switchView('utang-piutang-detail');
    window.renderDebtDetail();
};

window.renderDebtDetail = function() {
    const container = document.getElementById('up-detail-container');
    if (!container) return;
    const id = AuraState.temp.debtDetailId;
    const d = (AuraState.data.debts || []).find(function(x) { return x.id === id && !x.is_deleted; });
    AuraUtils.safeDOM('up-detail-title', function(el) {
        el.innerHTML = '<i class="fa-solid fa-handshake text-accent"></i> Rincian ' + (d && d.arah === 'piutang' ? 'Piutang' : 'Utang');
    });
    if (!d) {
        container.innerHTML = '<div class="glass-panel p-6 text-center text-xs text-[var(--text-muted)]">Catatan tidak ditemukan (mungkin sudah dihapus).</div>';
        return;
    }

    const ids = activeTrxIds();
    const arah = d.arah === 'piutang' ? 'piutang' : 'utang';
    const warna = arah === 'utang' ? 'var(--color-expense)' : 'var(--color-income)';
    const sisa = hitungSisa(d, ids);
    const terbayar = hitungTerbayar(d, ids);
    const jumlah = Number(d.jumlah) || 0;
    const pct = jumlah > 0 ? Math.min(100, Math.round(terbayar / jumlah * 100)) : 0;
    const st = statusDebt(d, ids);
    const namaDompetAwal = d.wallet_id ? walletName(d.wallet_id) : '';
    const teksDompetAwal = !d.wallet_id
        ? 'Tanpa arus dompet (hanya catatan)'
        : (arah === 'utang' ? 'Diterima via <b class="text-[var(--text-main)]">' + esc(namaDompetAwal) + '</b>'
                            : 'Diberi dari <b class="text-[var(--text-main)]">' + esc(namaDompetAwal) + '</b>');

    let riwayat = '';
    // Baris awal: pinjaman diterima/diberikan
    riwayat += '<div class="up-hist-row">'
        + '<div class="up-dot" style="background:rgba(255,255,255,0.05);color:var(--text-muted)"><i class="fa-solid ' + (arah === 'utang' ? 'fa-arrow-down' : 'fa-arrow-up') + '"></i></div>'
        + '<div class="flex-1 min-w-0"><p class="text-xs font-bold">' + (arah === 'utang' ? 'Pinjaman diterima' : 'Pinjaman diberikan') + '</p>'
        + '<p class="text-[10px] text-[var(--text-muted)]">' + fmtTgl(d.tanggal_mulai) + (d.wallet_id ? ' · ' + (arah === 'utang' ? 'masuk ke ' : 'dari ') + esc(namaDompetAwal) : ' · tanpa arus dompet') + '</p></div>'
        + '<p class="font-mono font-bold text-xs">' + (arah === 'utang' ? '' : '−') + fmtAmt(jumlah, d.mata_uang) + '</p></div>';

    const aktif = pembayaranAktif(d, ids).slice().sort(function(a, b) {
        return String(a.tanggal || '').localeCompare(String(b.tanggal || '')) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });
    aktif.forEach(function(p) {
        const wn = p.wallet_id ? walletName(p.wallet_id) : '';
        riwayat += '<div class="up-hist-row">'
            + '<div class="up-dot" style="background:rgba(255,255,255,0.05);color:var(--text-muted)"><i class="fa-solid ' + (arah === 'utang' ? 'fa-arrow-up' : 'fa-arrow-down') + '"></i></div>'
            + '<div class="flex-1 min-w-0"><p class="text-xs font-bold">' + (arah === 'utang' ? 'Pembayaran cicilan' : 'Pembayaran diterima') + '</p>'
            + '<p class="text-[10px] text-[var(--text-muted)]">' + fmtTgl(p.tanggal) + (wn ? ' · ' + (arah === 'utang' ? 'dari ' : 'ke ') + esc(wn) : ' · tanpa arus dompet') + (p.catatan ? ' · ' + esc(p.catatan) : '') + '</p></div>'
            + '<p class="font-mono font-bold text-xs">' + (arah === 'utang' ? '−' : '+') + fmtAmt(p.jumlah, d.mata_uang) + '</p>'
            + '<button onclick="window.deleteDebtPayment(\'' + p.id + '\')" class="w-7 h-7 rounded-full bg-black/40 border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--color-expense)] active:scale-90 transition shrink-0" title="Hapus pembayaran ini"><i class="fa-solid fa-trash text-[10px]"></i></button>'
            + '</div>';
    });
    if (aktif.length === 0) {
        riwayat += '<p class="text-[10px] text-[var(--text-muted)] text-center py-3">Belum ada pembayaran tercatat.</p>';
    }

    container.innerHTML = ''
        + '<div class="glass-panel p-5">'
        +   '<div class="flex justify-between items-start gap-2 mb-4">'
        +     '<div class="flex items-center gap-3 min-w-0"><div class="w-10 h-10 rounded-full bg-white/5 border border-[var(--border-glass)] flex items-center justify-center shrink-0"><i class="fa-solid fa-user text-[var(--text-muted)]"></i></div>'
        +     '<div class="min-w-0"><p class="font-bold text-sm truncate">' + esc(d.pihak) + '</p>'
        +     '<p class="text-[9px] uppercase tracking-widest text-[var(--text-muted)] font-bold">' + (arah === 'utang' ? 'Utang' : 'Piutang') + ' · mulai ' + fmtTgl(d.tanggal_mulai) + '</p></div></div>'
        +     chipStatus(d, ids)
        +   '</div>'
        +   '<p class="text-[8px] uppercase tracking-widest text-[var(--text-muted)] mb-0.5 font-bold">Sisa ' + (arah === 'utang' ? 'Utang' : 'Piutang') + '</p>'
        +   '<p class="font-mono font-extrabold text-2xl mb-3" style="color:' + warna + '">' + fmtAmt(sisa, d.mata_uang) + '</p>'
        +   '<div class="w-full h-2 bg-black/50 rounded-full overflow-hidden mb-2"><div class="h-full rounded-full transition-all duration-700" style="width:' + pct + '%; background:' + warna + '"></div></div>'
        +   '<div class="flex justify-between text-[10px] text-[var(--text-muted)] font-mono mb-3"><span>' + (arah === 'utang' ? 'Terbayar ' : 'Kembali ') + fmtAmt(terbayar, d.mata_uang) + ' (' + pct + '%)</span><span>Awal ' + fmtAmt(jumlah, d.mata_uang) + '</span></div>'
        +   '<div class="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[var(--text-muted)]">'
        +     '<span>' + teksJatuhTempo(d, ids) + '</span>'
        +     '<span><i class="fa-solid fa-wallet"></i>' + teksDompetAwal + '</span>'
        +   '</div>'
        +   (d.catatan ? '<p class="text-[11px] text-[var(--text-muted)] leading-relaxed mt-3"><i class="fa-regular fa-note-sticky mr-1"></i>' + esc(d.catatan) + '</p>' : '')
        + '</div>'
        + '<h3 class="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest px-1"><i class="fa-solid fa-clock-rotate-left mr-1"></i>Riwayat Pembayaran</h3>'
        + '<div class="glass-panel px-4 py-1">' + riwayat + '</div>'
        + (st !== 'Lunas'
            ? '<div class="flex gap-2">'
              + '<button onclick="window.openDebtPayForm()" class="flex-1 py-3.5 rounded-xl bg-accent text-[var(--invert-contrast)] font-bold text-xs active:scale-[0.98] transition"><i class="fa-solid fa-money-bill-wave"></i> Catat Pembayaran</button>'
              + '<button onclick="window.markDebtLunas()" class="glass-panel px-4 rounded-xl text-xs font-bold text-[var(--text-muted)] hover:text-white active:scale-95 transition"><i class="fa-solid fa-circle-check"></i> Tandai Lunas</button>'
              + '</div>'
              + '<p class="text-[10px] text-[var(--text-muted)] leading-relaxed">Pembayaran dicatat sebagai arus dompet, tetapi tidak dihitung sebagai ' + (arah === 'utang' ? 'pengeluaran' : 'pemasukan') + ' pribadi.</p>'
            : '<p class="text-[10px] text-emerald-400 font-bold"><i class="fa-solid fa-circle-check"></i> Pinjaman ini sudah lunas.</p>')
        + '<button onclick="window.deleteDebtRecord()" class="w-full py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--color-expense)] transition"><i class="fa-solid fa-trash mr-1"></i> Hapus Catatan Ini</button>';
};

// ============================================================================
// FORMULIR TAMBAH CATATAN
// ============================================================================

function isiPilihanDompet(selectId, denganOpsiCatatan, terpilih) {
    if (typeof window.populateWalletDropdowns === 'function') window.populateWalletDropdowns(selectId, terpilih || null);
    const sel = document.getElementById(selectId);
    if (sel && denganOpsiCatatan) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Tanpa arus dompet (hanya catatan)';
        if (!terpilih) opt.selected = true;
        sel.appendChild(opt);
        if (!terpilih) sel.value = '';
    }
}

window.setDebtDir = function(arah) {
    AuraState.temp.debtDir = arah === 'piutang' ? 'piutang' : 'utang';
    const isUtang = AuraState.temp.debtDir === 'utang';
    AuraUtils.safeDOM('debt-dir-utang', function(el) { el.className = 'up-dir-btn' + (isUtang ? ' sel-utang' : ''); });
    AuraUtils.safeDOM('debt-dir-piutang', function(el) { el.className = 'up-dir-btn' + (!isUtang ? ' sel-piutang' : ''); });
    AuraUtils.safeDOM('debt-wallet-label', function(el) {
        el.innerText = isUtang ? 'Dompet Penerima Dana' : 'Dompet Sumber Dana';
    });
};

window.openDebtForm = function(arah) {
    window.setDebtDir(arah === 'piutang' ? 'piutang' : (AuraState.temp.debtTab || 'utang'));
    AuraUtils.safeDOM('debt-pihak', function(el) { el.value = ''; });
    AuraUtils.safeDOM('debt-jumlah', function(el) { el.value = ''; });
    AuraUtils.safeDOM('debt-tanggal', function(el) { el.value = todayStr(); });
    AuraUtils.safeDOM('debt-tempo', function(el) { el.value = ''; });
    AuraUtils.safeDOM('debt-catatan', function(el) { el.value = ''; });
    isiPilihanDompet('debt-wallet', true, null);
    if (typeof window.showModal === 'function') window.showModal('modal-debt-add');
};

function buatTrxPendamping(debt, peran, jumlah, tanggal, walletId, deskripsi) {
    const wallets = AuraState.data.wallets || {};
    const w = wallets[walletId] || {};
    const arah = debt.arah === 'piutang' ? 'piutang' : 'utang';
    // Tanda arus dompet: utang masuk & pelunasan piutang = masuk;
    // piutang diberikan & pembayaran utang = keluar.
    const masuk = (peran === 'awal' && arah === 'utang') || (peran === 'bayar' && arah === 'piutang');
    const capWaktu = new Date().toISOString();
    return {
        id: AuraUtils.generateId('trx'),
        merchantName: (arah === 'utang' ? 'Utang: ' : 'Piutang: ') + debt.pihak,
        storeName: 'AuraFi Utang Piutang',
        tanggal: tanggal,
        createdAt: capWaktu,
        nominal: jumlah,
        mata_uang: debt.mata_uang,
        wallet_id: walletId,
        metode_pembayaran: w.type || 'cashless',
        tipe: masuk ? 'utangpiutang_masuk' : 'utangpiutang_keluar',
        kategori: 'Utang Piutang',
        description: deskripsi,
        isCustomDescription: true,
        is_deleted: false,
        admin_fee: 0,
        debt_id: debt.id,
        debt_role: peran,
        items: [{
            itemId: AuraUtils.generateId('itm'),
            nama_barang: deskripsi,
            harga: jumlah,
            qty: 1,
            kategori_barang: 'Utang Piutang',
            kelompok: 'Penyesuaian',
            tax_rate: 0,
            paymentMethod: w.type || 'cashless',
            timestamp: capWaktu
        }]
    };
}

window.saveDebtForm = async function() {
    const arah = AuraState.temp.debtDir === 'piutang' ? 'piutang' : 'utang';
    const pihak = (document.getElementById('debt-pihak')?.value || '').trim();
    const jumlah = parseFloat(document.getElementById('debt-jumlah')?.value);
    const tanggal = document.getElementById('debt-tanggal')?.value || todayStr();
    const tempo = document.getElementById('debt-tempo')?.value || '';
    const walletId = document.getElementById('debt-wallet')?.value || '';
    const catatan = (document.getElementById('debt-catatan')?.value || '').trim();

    if (!pihak) { if (window.showToast) window.showToast('Nama pihak wajib diisi!', true); return; }
    if (isNaN(jumlah) || jumlah <= 0) { if (window.showToast) window.showToast('Jumlah pinjaman harus lebih dari 0!', true); return; }
    if (tempo && tempo < tanggal) { if (window.showToast) window.showToast('Jatuh tempo tidak boleh sebelum tanggal mulai!', true); return; }

    const nowIso = new Date().toISOString();
    const debt = {
        id: AuraUtils.generateId('debt'),
        arah: arah,
        pihak: pihak,
        jumlah: jumlah,
        tanggal_mulai: tanggal,
        jatuh_tempo: tempo || null,
        wallet_id: walletId || null,
        catatan: catatan,
        mata_uang: AuraState.system.displayCurrency || 'JPY',
        pembayaran: [],
        is_deleted: false,
        createdAt: nowIso,
        updatedAt: nowIso
    };

    let trx = null;
    if (walletId) {
        const deskripsi = arah === 'utang' ? 'Pinjaman diterima dari ' + pihak : 'Meminjamkan ke ' + pihak;
        trx = buatTrxPendamping(debt, 'awal', jumlah, tanggal, walletId, deskripsi);
        debt.trx_awal_id = trx.id;
    } else {
        debt.trx_awal_id = null;
    }

    try {
        await FirebaseService.saveDebt(debt, trx);
        if (typeof window.closeModal === 'function') window.closeModal('modal-debt-add');
        if (window.showToast) window.showToast('Catatan ' + (arah === 'utang' ? 'utang' : 'piutang') + ' tersimpan!');
        AuraState.temp.debtTab = arah;
        if (typeof window.switchView === 'function' && AuraState.system.activeView !== 'utang-piutang') window.switchView('utang-piutang');
        window.renderDebts();
    } catch (e) {
        if (window.showToast) window.showToast('Gagal menyimpan catatan.', true);
    }
};

// ============================================================================
// FORMULIR CATAT PEMBAYARAN
// ============================================================================

window.openDebtPayForm = function() {
    const d = (AuraState.data.debts || []).find(function(x) { return x.id === AuraState.temp.debtDetailId && !x.is_deleted; });
    if (!d) return;
    const arah = d.arah === 'piutang' ? 'piutang' : 'utang';
    const ids = activeTrxIds();
    const sisa = hitungSisa(d, ids);
    AuraState.temp.debtPaySisa = sisa;
    AuraState.temp.debtPayCurr = d.mata_uang;

    AuraUtils.safeDOM('debt-pay-sub', function(el) {
        el.innerText = (arah === 'utang' ? 'Utang ke ' : 'Piutang dari ') + d.pihak + ' · Sisa ' + fmtAmt(sisa, d.mata_uang);
    });
    AuraUtils.safeDOM('debt-pay-amount-label', function(el) {
        el.innerText = arah === 'utang' ? 'Jumlah Dibayar' : 'Jumlah Diterima';
    });
    AuraUtils.safeDOM('debt-pay-amount', function(el) { el.value = ''; });
    AuraUtils.safeDOM('debt-pay-tanggal', function(el) { el.value = todayStr(); });
    AuraUtils.safeDOM('debt-pay-catatan', function(el) { el.value = ''; });
    AuraUtils.safeDOM('debt-pay-wallet-label', function(el) {
        el.innerText = arah === 'utang' ? 'Dari Dompet' : 'Ke Dompet';
    });
    const walletRow = document.getElementById('debt-pay-wallet-row');
    if (walletRow) walletRow.style.display = d.wallet_id ? '' : 'none';
    if (d.wallet_id) isiPilihanDompet('debt-pay-wallet', false, d.wallet_id);
    window.updateDebtPayPreview();
    if (typeof window.showModal === 'function') window.showModal('modal-debt-pay');
};

window.updateDebtPayPreview = function() {
    const sisa = Number(AuraState.temp.debtPaySisa) || 0;
    const amt = parseFloat(document.getElementById('debt-pay-amount')?.value) || 0;
    const curr = AuraState.temp.debtPayCurr;
    AuraUtils.safeDOM('debt-pay-sisa-preview', function(el) {
        el.innerText = fmtAmt(sisa, curr) + ' → ' + fmtAmt(Math.max(0, sisa - amt), curr);
        el.className = 'font-mono font-extrabold text-sm ' + (amt > sisa ? 'text-[var(--color-expense)]' : 'text-[var(--text-main)]');
    });
};

window.saveDebtPayment = async function() {
    const d = (AuraState.data.debts || []).find(function(x) { return x.id === AuraState.temp.debtDetailId && !x.is_deleted; });
    if (!d) return;
    const arah = d.arah === 'piutang' ? 'piutang' : 'utang';
    const ids = activeTrxIds();
    const sisa = hitungSisa(d, ids);
    const jumlah = parseFloat(document.getElementById('debt-pay-amount')?.value);
    const tanggal = document.getElementById('debt-pay-tanggal')?.value || todayStr();
    const catatan = (document.getElementById('debt-pay-catatan')?.value || '').trim();
    const walletId = d.wallet_id ? (document.getElementById('debt-pay-wallet')?.value || d.wallet_id) : null;

    if (isNaN(jumlah) || jumlah <= 0) { if (window.showToast) window.showToast('Jumlah pembayaran harus lebih dari 0!', true); return; }
    if (jumlah > sisa) {
        if (window.showToast) window.showToast('Ditolak! Pembayaran ' + fmtAmt(jumlah, d.mata_uang) + ' melebihi sisa ' + fmtAmt(sisa, d.mata_uang) + '.', true);
        return;
    }

    let trx = null;
    if (walletId) {
        const deskripsi = arah === 'utang' ? 'Pembayaran utang ke ' + d.pihak : 'Pelunasan diterima dari ' + d.pihak;
        trx = buatTrxPendamping(d, 'bayar', jumlah, tanggal, walletId, deskripsi);
    }
    const pembayaran = (Array.isArray(d.pembayaran) ? d.pembayaran.slice() : []);
    pembayaran.push({
        id: AuraUtils.generateId('pay'),
        tanggal: tanggal,
        jumlah: jumlah,
        wallet_id: walletId,
        trx_id: trx ? trx.id : null,
        catatan: catatan,
        is_deleted: false,
        createdAt: new Date().toISOString()
    });
    if (trx) trx.debt_payment_id = pembayaran[pembayaran.length - 1].id;

    try {
        await FirebaseService.addDebtPayment(d.id, pembayaran, trx);
        if (typeof window.closeModal === 'function') window.closeModal('modal-debt-pay');
        if (window.showToast) window.showToast('Pembayaran tercatat!');
        window.renderDebtDetail();
    } catch (e) {
        if (window.showToast) window.showToast('Gagal mencatat pembayaran.', true);
    }
};

// Tandai Lunas = pembayaran penutup sebesar sisa persis (bukan status yang
// ditulis paksa): status tetap turunan, jadi riwayat & saldo selalu konsisten.
window.markDebtLunas = async function() {
    const d = (AuraState.data.debts || []).find(function(x) { return x.id === AuraState.temp.debtDetailId && !x.is_deleted; });
    if (!d) return;
    const ids = activeTrxIds();
    const sisa = hitungSisa(d, ids);
    if (sisa <= 0) return;
    const ok = await window.AuraConfirm('Tandai pinjaman ke/dari <b>' + esc(d.pihak) + '</b> sebagai lunas?<br><br>Ini mencatat <b>pembayaran penutup sebesar sisa ' + fmtAmt(sisa, d.mata_uang) + '</b>' + (d.wallet_id ? ' lewat dompet ' + esc(walletName(d.wallet_id)) : ' (tanpa arus dompet)') + ' — bukan sekadar mengganti status, agar riwayat dan saldo dompet tetap konsisten.');
    if (!ok) return;

    let trx = null;
    if (d.wallet_id) {
        const arah = d.arah === 'piutang' ? 'piutang' : 'utang';
        const deskripsi = arah === 'utang' ? 'Pelunasan utang ke ' + d.pihak : 'Pelunasan diterima dari ' + d.pihak;
        trx = buatTrxPendamping(d, 'bayar', sisa, todayStr(), d.wallet_id, deskripsi);
    }
    const pembayaran = (Array.isArray(d.pembayaran) ? d.pembayaran.slice() : []);
    pembayaran.push({
        id: AuraUtils.generateId('pay'),
        tanggal: todayStr(),
        jumlah: sisa,
        wallet_id: d.wallet_id || null,
        trx_id: trx ? trx.id : null,
        catatan: 'Pelunasan (Tandai Lunas)',
        is_deleted: false,
        createdAt: new Date().toISOString()
    });
    if (trx) trx.debt_payment_id = pembayaran[pembayaran.length - 1].id;

    try {
        await FirebaseService.addDebtPayment(d.id, pembayaran, trx);
        if (window.showToast) window.showToast('Pinjaman ditandai lunas!');
        window.renderDebtDetail();
    } catch (e) {
        if (window.showToast) window.showToast('Gagal menandai lunas.', true);
    }
};

// ============================================================================
// PENGHAPUSAN (soft-delete mengikuti pola aplikasi)
// ============================================================================

window.deleteDebtPayment = async function(payId) {
    const d = (AuraState.data.debts || []).find(function(x) { return x.id === AuraState.temp.debtDetailId && !x.is_deleted; });
    if (!d) return;
    const target = (d.pembayaran || []).find(function(p) { return p.id === payId; });
    if (!target) return;
    const ok = await window.AuraConfirm('Hapus pembayaran sebesar <b>' + fmtAmt(target.jumlah, d.mata_uang) + '</b> (' + fmtTgl(target.tanggal) + ')?<br><br>Sisa pinjaman dihitung ulang dan transaksi dompet pendampingnya ikut diarsipkan ke Sampah.');
    if (!ok) return;
    const pembayaran = (d.pembayaran || []).map(function(p) {
        return p.id === payId ? { ...p, is_deleted: true } : p;
    });
    try {
        await FirebaseService.removeDebtPayment(d.id, pembayaran, target.trx_id || null);
        if (window.showToast) window.showToast('Pembayaran dihapus.');
        window.renderDebtDetail();
    } catch (e) {
        if (window.showToast) window.showToast('Gagal menghapus pembayaran.', true);
    }
};

window.deleteDebtRecord = async function() {
    const d = (AuraState.data.debts || []).find(function(x) { return x.id === AuraState.temp.debtDetailId && !x.is_deleted; });
    if (!d) return;
    const ok = await window.AuraConfirm('Hapus catatan ' + (d.arah === 'piutang' ? 'piutang' : 'utang') + ' <b>' + esc(d.pihak) + '</b> selamanya dari daftar?<br><br>Catatan diarsipkan dan semua transaksi dompet pendampingnya (penerimaan awal + pembayaran) ikut diarsipkan ke Sampah, jadi saldo dompet kembali seperti sebelum catatan ini ada.');
    if (!ok) return;
    const trxIds = [];
    if (d.trx_awal_id) trxIds.push(d.trx_awal_id);
    (d.pembayaran || []).forEach(function(p) { if (p.trx_id) trxIds.push(p.trx_id); });
    try {
        await FirebaseService.trashDebt(d.id, trxIds);
        if (window.showToast) window.showToast('Catatan dihapus.');
        if (typeof window.switchView === 'function') window.switchView('utang-piutang');
        window.renderDebts();
    } catch (e) {
        if (window.showToast) window.showToast('Gagal menghapus catatan.', true);
    }
};

// ============================================================================
// PINTU TAMBAH DARI PEMILIH JENIS (Aura Picker) MODAL INPUT TRANSAKSI:
// memilih "Utang / Piutang" menutup modal transaksi biasa dan membuka
// formulir khusus — persis perilaku yang disetujui di mockup v2/v3.
// ============================================================================

(function () {
    const sel = document.getElementById('manual-trx-type');
    if (!sel) return;
    sel.addEventListener('change', function () {
        if (sel.value !== 'utang_piutang') return;
        sel.value = 'pengeluaran';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof window.closeModal === 'function') window.closeModal('modal-manual-trx');
        window.openDebtForm(AuraState.temp.debtTab || 'utang');
    });
})();
