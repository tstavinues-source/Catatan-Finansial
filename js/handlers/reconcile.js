/**
 * AuraFi OS - Rekonsiliasi Dompet & Pengingat Kewajiban Siklus
 *
 * Rekonsiliasi: pengguna memasukkan saldo nyata (aplikasi bank / hitung
 * fisik), aplikasi menghitung selisih terhadap saldo hasil catatan, lalu
 * selisih dibukukan sebagai salah satu dari:
 *   1. Pindah ke Kantung Receh (nabung ke kantong Brankas "Kantung Receh",
 *      khusus dompet tunai & selisih minus) — keluar dari Net Worth.
 *   2. Pengeluaran Tidak Tercatat (pengeluaran sungguhan, merchant
 *      TIDAK TERCATAT) — selisih minus yang memang terpakai.
 *   3. Penyesuaian Saldo (kategori "Penyesuaian Saldo") — koreksi salah
 *      catat / data lama; TIDAK dihitung sebagai pemasukan/pengeluaran
 *      pada ringkasan & Wawasan (lihat gerbang di dashboard.js).
 *
 * Pengingat Kewajiban: daftar tersimpan di Firebase
 * (settings.obligationReminders, BUKAN hardcode) dan bisa di-CRUD dari
 * Pengaturan. Wawasan menampilkan status tiap pengingat pada siklus
 * berjalan: Tercatat (ada transaksi yang cocok) / Belum tercatat
 * (+ tombol Catat Sekarang).
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';

// ---------------------------------------------------------------------------
// Pembantu umum
// ---------------------------------------------------------------------------

function esc(v) { return AuraUtils.escapeHtml(String(v == null ? '' : v)); }

function todayLocalStr() {
    const d = new Date();
    const p = function(n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function toJPY(trx) {
    const n = Number(trx.nominal) || 0;
    if ((trx.mata_uang || 'JPY') === 'IDR') {
        const rate = AuraState.system?.exchangeRateIDR || 110.27;
        return n / rate;
    }
    return n;
}

function feeJPY(trx) {
    const n = Number(trx.admin_fee) || 0;
    if ((trx.mata_uang || 'JPY') === 'IDR') {
        const rate = AuraState.system?.exchangeRateIDR || 110.27;
        return n / rate;
    }
    return n;
}

// Saldo dompet dalam JPY murni — aturan sama persis dengan modules/wallets.js,
// hanya tanpa konversi mata uang tampilan agar rekonsiliasi selalu berbasis
// angka nyata (yen) dari aplikasi bank / hitungan fisik.
function walletBalanceJPY(walletId) {
    let bal = 0;
    (AuraState.data.transactions || []).forEach(function(trx) {
        if (!trx || trx.is_deleted || trx.wallet_id !== walletId) return;
        const val = toJPY(trx);
        const fee = feeJPY(trx);
        if (trx.tipe === 'pemasukan' || trx.tipe === 'mutasi_masuk') bal += val;
        else if (trx.tipe === 'pengeluaran' || trx.tipe === 'mutasi_keluar') bal -= val;
        else if (trx.tipe === 'tarik_tunai' || trx.tipe === 'setor_tunai') bal -= (val + fee);
        else if (trx.tipe === 'nabung') bal -= val;
    });
    return Math.round(bal);
}

function findRecehGoal() {
    const goals = AuraState.data.goals || [];
    return goals.find(function(g) { return g && g.jenis === 'simpanan' && String(g.name || '').trim().toLowerCase() === 'kantung receh'; }) || null;
}

function fmtJPY(v) { return window.convertAndFormatCurrency(Math.round(Number(v) || 0)); }

// ---------------------------------------------------------------------------
// REKONSILIASI DOMPET
// ---------------------------------------------------------------------------

window.openReconcileModal = function(walletId) {
    const wallets = AuraState.data.wallets || {};
    const w = wallets[walletId];
    if (!w) return;
    AuraState.temp.reconcileWalletId = walletId;
    AuraState.temp.reconcileAppBal = walletBalanceJPY(walletId);

    AuraUtils.safeDOM('reconcile-wallet-name', function(el) { el.innerText = w.name; });
    AuraUtils.safeDOM('reconcile-app-balance', function(el) { el.innerText = fmtJPY(AuraState.temp.reconcileAppBal); });
    const input = document.getElementById('reconcile-real');
    if (input) { input.value = ''; setTimeout(function() { input.focus(); }, 250); }
    window.updateReconcileDiff();
    if (typeof window.showModal === 'function') window.showModal('modal-reconcile');
};

window.updateReconcileDiff = function() {
    const walletId = AuraState.temp.reconcileWalletId;
    const wallets = AuraState.data.wallets || {};
    const w = wallets[walletId] || {};
    const appBal = Number(AuraState.temp.reconcileAppBal) || 0;
    const raw = document.getElementById('reconcile-real')?.value;
    const real = raw === '' || raw == null ? NaN : Number(raw);
    const diffEl = document.getElementById('reconcile-diff');
    const modesEl = document.getElementById('reconcile-modes');
    const btn = document.getElementById('reconcile-submit');
    if (!diffEl || !modesEl || !btn) return;

    if (isNaN(real)) {
        diffEl.innerHTML = '<span class="text-[var(--text-muted)]">Masukkan saldo nyata untuk melihat selisih.</span>';
        modesEl.innerHTML = '';
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        return;
    }

    const diff = Math.round(real - appBal);
    AuraState.temp.reconcileDiff = diff;

    if (diff === 0) {
        diffEl.innerHTML = '<span class="text-[var(--color-income)] font-bold"><i class="fa-solid fa-circle-check"></i> Saldo sudah cocok — tidak ada selisih.</span>';
        modesEl.innerHTML = '';
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        return;
    }

    const sign = diff > 0 ? '+' : '−';
    const diffCls = diff > 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]';
    diffEl.innerHTML = 'Selisih: <b class="' + diffCls + '">' + sign + fmtJPY(Math.abs(diff)).replace('−', '') + '</b>' +
        (diff < 0 ? ' <span class="text-[var(--text-muted)]">(uang nyata lebih sedikit dari catatan)</span>' : ' <span class="text-[var(--text-muted)]">(uang nyata lebih banyak dari catatan)</span>');

    const radio = function(val, title, desc, checked) {
        return '<label class="flex gap-3 items-start bg-black/30 border border-[var(--border-glass)] rounded-xl p-3 cursor-pointer">' +
            '<input type="radio" name="reconcile-mode" value="' + val + '"' + (checked ? ' checked' : '') + ' class="mt-1 accent-[#e08a4c]">' +
            '<span><span class="block text-xs font-bold">' + title + '</span>' +
            '<span class="block text-[10px] text-[var(--text-muted)] leading-relaxed mt-0.5">' + desc + '</span></span></label>';
    };

    let html = '';
    if (diff < 0) {
        const goal = findRecehGoal();
        if (w.type === 'tunai' && goal) {
            html += radio('receh', 'Pindah ke Kantung Receh', 'Selisih receh mingguan — keluar dari Net Worth, tersimpan sebagai perkiraan di Brankas Kantung Receh.', true);
        }
        html += radio('tercatat', 'Pengeluaran Tidak Tercatat', 'Uang memang terpakai tapi lupa dicatat — dihitung sebagai pengeluaran pribadi bulan ini.', !goal || w.type !== 'tunai');
        html += radio('penyesuaian', 'Penyesuaian Saldo', 'Koreksi salah catat / data lama — bukan belanja, tidak masuk laporan pemasukan/pengeluaran.', false);
    } else {
        html += radio('penyesuaian', 'Penyesuaian Saldo', 'Uang nyata lebih banyak dari catatan (salah catat / data lama) — dikoreksi tanpa masuk laporan pemasukan.', true);
    }
    modesEl.innerHTML = html;
    btn.disabled = false;
    btn.classList.remove('opacity-50', 'cursor-not-allowed');
};

window.submitReconcile = async function() {
    const walletId = AuraState.temp.reconcileWalletId;
    const wallets = AuraState.data.wallets || {};
    const w = wallets[walletId];
    const diff = Number(AuraState.temp.reconcileDiff) || 0;
    const mode = document.querySelector('input[name="reconcile-mode"]:checked')?.value;
    if (!w || diff === 0 || !mode) return;

    const amt = Math.abs(diff);
    const metode = w.type === 'tunai' ? 'tunai' : 'cashless';
    const today = todayLocalStr();
    const nowIso = new Date().toISOString();
    const btn = document.getElementById('reconcile-submit');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Membukukan...'; }

    try {
        if (mode === 'receh') {
            const goal = findRecehGoal();
            if (!goal) throw new Error('Kantung Receh tidak ditemukan');
            await FirebaseService.updateGoal(goal.id, { savedAmount: (Number(goal.savedAmount) || 0) + amt });
            await FirebaseService.saveTransaction({
                merchantName: 'Brankas: ' + goal.name,
                storeName: 'AuraFi Vault',
                tanggal: today,
                createdAt: nowIso,
                nominal: amt,
                mata_uang: 'JPY',
                wallet_id: walletId,
                metode_pembayaran: metode,
                tipe: 'nabung',
                kategori: 'Tabungan',
                description: 'Selisih rekonsiliasi mingguan dipindah ke Kantung Receh.',
                isCustomDescription: true,
                is_deleted: false,
                items: [{
                    itemId: AuraUtils.generateId('itm'),
                    nama_barang: 'Selisih Receh ke Kantung Receh',
                    harga: amt,
                    qty: 1,
                    kategori_barang: 'Tabungan',
                    kelompok: 'Pribadi',
                    tax_rate: 0,
                    paymentMethod: metode,
                    timestamp: nowIso
                }]
            }, false);
            if (window.showToast) window.showToast('Selisih ' + fmtJPY(amt) + ' dipindah ke Kantung Receh.');
        } else if (mode === 'tercatat') {
            await FirebaseService.saveTransaction({
                merchantName: 'TIDAK TERCATAT',
                storeName: 'TIDAK TERCATAT',
                tanggal: today,
                createdAt: nowIso,
                nominal: amt,
                mata_uang: 'JPY',
                wallet_id: walletId,
                metode_pembayaran: metode,
                tipe: 'pengeluaran',
                kategori: 'Pengeluaran Tidak Tercatat',
                description: 'Rekonsiliasi ' + w.name + ': pengeluaran yang belum tercatat.',
                isCustomDescription: true,
                is_deleted: false,
                items: [{
                    itemId: AuraUtils.generateId('itm'),
                    nama_barang: 'Pengeluaran Tidak Tercatat',
                    harga: amt,
                    qty: 1,
                    kategori_barang: 'Pengeluaran Tidak Tercatat',
                    kelompok: 'Pribadi',
                    tax_rate: 0,
                    paymentMethod: metode,
                    timestamp: nowIso
                }]
            }, false);
            if (window.showToast) window.showToast('Selisih ' + fmtJPY(amt) + ' dibukukan sebagai Pengeluaran Tidak Tercatat.');
        } else {
            const isPlus = diff > 0;
            await FirebaseService.saveTransaction({
                merchantName: 'PENYESUAIAN SALDO',
                storeName: 'PENYESUAIAN SALDO',
                tanggal: today,
                createdAt: nowIso,
                nominal: amt,
                mata_uang: 'JPY',
                wallet_id: walletId,
                metode_pembayaran: metode,
                tipe: isPlus ? 'pemasukan' : 'pengeluaran',
                kategori: 'Penyesuaian Saldo',
                description: 'Rekonsiliasi ' + w.name + ': saldo aplikasi ' + fmtJPY(AuraState.temp.reconcileAppBal) + ', saldo nyata ' + fmtJPY(document.getElementById('reconcile-real')?.value) + '.',
                isCustomDescription: true,
                is_deleted: false,
                items: [{
                    itemId: AuraUtils.generateId('itm'),
                    nama_barang: 'Penyesuaian Saldo Rekonsiliasi',
                    harga: amt,
                    qty: 1,
                    kategori_barang: 'Lainnya',
                    kelompok: 'Penyesuaian',
                    tax_rate: 0,
                    paymentMethod: metode,
                    timestamp: nowIso
                }]
            }, false);
            if (window.showToast) window.showToast('Saldo ' + w.name + ' disesuaikan sebesar ' + fmtJPY(amt) + '.');
        }
        if (typeof window.closeModal === 'function') window.closeModal('modal-reconcile');
    } catch (e) {
        console.error('[Rekonsiliasi]', e);
        if (window.showToast) window.showToast('Gagal membukukan rekonsiliasi.', true);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-scale-balanced"></i> Bukukan Selisih'; }
    }
};

// ---------------------------------------------------------------------------
// PENGINGAT KEWAJIBAN SIKLUS (Firebase: settings.obligationReminders)
// ---------------------------------------------------------------------------

function getReminders() {
    const v = AuraState.data.settings?.obligationReminders;
    if (Array.isArray(v)) return v.slice();
    if (v && typeof v === 'object') return Object.values(v);
    return [];
}

async function saveReminders(list) {
    if (AuraState.data.settings) AuraState.data.settings.obligationReminders = list;
    await FirebaseService.updateSettings({ obligationReminders: list });
}

function reminderMatch(rem, range) {
    const txs = AuraState.data.transactions || [];
    const merch = String(rem.merchantName || '').trim().toLowerCase();
    for (let i = 0; i < txs.length; i++) {
        const t = txs[i];
        if (!t || t.is_deleted || t.tipe !== 'pengeluaran' || !t.tanggal) continue;
        const d = new Date(t.tanggal).getTime();
        if (d < Number(range.start) || d > Number(range.end)) continue;
        if (merch) {
            if (String(t.merchantName || t.storeName || '').trim().toLowerCase() === merch) return t;
        } else if (t.kategori === rem.kategori) {
            return t;
        }
    }
    return null;
}

window.renderObligationChecklist = function() {
    try {
        const container = document.getElementById('wawasan-checklist');
        if (!container) return;
        const reminders = getReminders();
        const head = '<div class="glass-panel p-4"><div class="flex justify-between items-center gap-2 mb-3"><h3 class="font-bold text-xs flex items-center gap-2"><i class="fa-solid fa-bell text-accent"></i> Pengingat Kewajiban Siklus Ini</h3>' +
            '<button onclick="window.showModal(\'modal-settings\')" class="text-[9px] font-bold px-2 py-1 rounded-full border border-[var(--border-glass)] text-[var(--text-muted)] shrink-0"><i class="fa-solid fa-gear"></i> Kelola</button></div>';
        if (reminders.length === 0) {
            container.innerHTML = head + '<p class="text-[10px] text-[var(--text-muted)] leading-relaxed">Belum ada pengingat. Tambahkan kewajiban yang biasa dicatat manual (transfer istri, kas apato, tagihan) lewat tombol Kelola — daftar ini tersimpan di Firebase dan bisa diubah kapan pun.</p></div>';
            return;
        }
        const range = AuraUtils.getPeriodRange();
        const fmtTgl = function(v) { return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(v)); };
        let done = 0;
        const rows = reminders.map(function(rem) {
            const hit = reminderMatch(rem, range);
            if (hit) done++;
            const left = '<div class="min-w-0"><p class="text-xs font-bold truncate">' + esc(rem.name) + '</p>' +
                '<p class="text-[9px] text-[var(--text-muted)]">' + (hit ? 'Tercatat ' + fmtTgl(hit.tanggal) + ' · ' + fmtJPY(hit.nominal) : 'Perkiraan ' + fmtJPY(rem.amount) + ' · belum ada catatan siklus ini') + '</p></div>';
            const right = hit
                ? '<span class="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full border text-emerald-400 border-emerald-400/30 bg-emerald-400/10 shrink-0"><i class="fa-solid fa-check"></i> Tercatat</span>'
                : '<span class="flex items-center gap-2 shrink-0"><span class="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full border text-amber-400 border-amber-400/30 bg-amber-400/10">Belum tercatat</span>' +
                  '<button onclick="window.bookReminderNow(\'' + esc(rem.id) + '\')" class="text-[9px] font-bold px-2.5 py-1.5 rounded-lg bg-accent text-[var(--bg-base)] active:scale-95 transition">Catat Sekarang</button></span>';
            return '<div class="flex justify-between items-center gap-2 py-2 border-b border-[var(--border-glass)] last:border-0">' + left + right + '</div>';
        }).join('');
        const pct = Math.round(done / reminders.length * 100);
        container.innerHTML = head + rows +
            '<div class="flex items-center gap-2 mt-3"><div class="flex-1 flex h-1.5 rounded-full overflow-hidden bg-black/50"><div style="width:' + pct + '%; background: var(--color-income)"></div></div><p class="text-[9px] font-bold text-[var(--text-muted)]">' + done + ' dari ' + reminders.length + ' tercatat</p></div>' +
            '<p class="text-[9px] text-[var(--text-muted)] italic leading-relaxed mt-2">Status dicocokkan otomatis dari transaksi siklus berjalan. Potongan gaji (asuransi, nenkin, pajak, sewa) tidak masuk daftar — sudah tercatat lewat slip gaji.</p></div>';
        if (typeof window.renderReminderManager === 'function') window.renderReminderManager();
    } catch (e) {
        console.warn('[Pengingat]', e);
    }
};

window.bookReminderNow = async function(reminderId) {
    const rem = getReminders().find(function(r) { return r.id === reminderId; });
    if (!rem) return;
    const wallets = AuraState.data.wallets || {};
    const w = wallets[rem.wallet_id] || {};
    const metode = w.type === 'tunai' ? 'tunai' : 'cashless';
    const ok = await window.AuraConfirm('Catat "' + rem.name + '" sebesar ' + fmtJPY(rem.amount) + ' sekarang?');
    if (!ok) return;
    const today = todayLocalStr();
    const nowIso = new Date().toISOString();
    try {
        await FirebaseService.saveTransaction({
            merchantName: rem.merchantName || String(rem.name || '').toUpperCase(),
            storeName: rem.merchantName || String(rem.name || '').toUpperCase(),
            tanggal: today,
            createdAt: nowIso,
            nominal: Number(rem.amount) || 0,
            mata_uang: 'JPY',
            wallet_id: rem.wallet_id || '',
            metode_pembayaran: metode,
            tipe: 'pengeluaran',
            kategori: rem.kategori || 'Lainnya',
            description: 'Dicatat dari Pengingat Kewajiban Siklus.',
            isCustomDescription: true,
            is_deleted: false,
            items: [{
                itemId: AuraUtils.generateId('itm'),
                nama_barang: rem.name,
                harga: Number(rem.amount) || 0,
                qty: 1,
                kategori_barang: rem.itemKategori || rem.kategori || 'Lainnya',
                kelompok: typeof window.inferKelompokItem === 'function' ? window.inferKelompokItem(rem.itemKategori || rem.kategori, 'pengeluaran') : 'Pribadi',
                tax_rate: 0,
                paymentMethod: metode,
                timestamp: nowIso
            }]
        }, false);
        if (window.showToast) window.showToast(rem.name + ' tercatat.');
        if (typeof window.renderObligationChecklist === 'function') window.renderObligationChecklist();
    } catch (e) {
        console.error('[Pengingat]', e);
        if (window.showToast) window.showToast('Gagal mencatat pengingat.', true);
    }
};

// ---------------------------------------------------------------------------
// KELOLA PENGINGAT (panel Pengaturan)
// ---------------------------------------------------------------------------

window.renderReminderManager = function() {
    const container = document.getElementById('reminder-list');
    if (!container) return;
    const reminders = getReminders();
    const wallets = AuraState.data.wallets || {};
    if (reminders.length === 0) {
        container.innerHTML = '<p class="text-[10px] text-[var(--text-muted)] text-center py-2">Belum ada pengingat tersimpan.</p>';
        return;
    }
    container.innerHTML = reminders.map(function(rem) {
        const wName = wallets[rem.wallet_id]?.name || '-';
        return '<div class="flex justify-between items-center gap-2 bg-black/30 p-3 rounded-xl border border-[var(--border-glass)]">' +
            '<div class="min-w-0"><p class="text-xs font-bold truncate">' + esc(rem.name) + '</p>' +
            '<p class="text-[9px] text-[var(--text-muted)]">' + fmtJPY(rem.amount) + ' · ' + esc(wName) + ' · ' + esc(rem.kategori || '') + '</p></div>' +
            '<div class="flex gap-1.5 shrink-0">' +
            '<button onclick="window.openReminderEditor(\'' + esc(rem.id) + '\')" class="w-8 h-8 rounded-lg bg-white/5 border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-muted)] hover:text-white active:scale-95 transition" title="Ubah"><i class="fa-solid fa-pen text-[10px]"></i></button>' +
            '<button onclick="window.deleteReminder(\'' + esc(rem.id) + '\')" class="w-8 h-8 rounded-lg bg-white/5 border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-muted)] hover:text-rose-400 active:scale-95 transition" title="Hapus"><i class="fa-solid fa-trash text-[10px]"></i></button>' +
            '</div></div>';
    }).join('');
};

function fillSelect(id, values, selected) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = values.map(function(v) {
        return '<option value="' + esc(v.value) + '"' + (String(v.value) === String(selected) ? ' selected' : '') + '>' + esc(v.label) + '</option>';
    }).join('');
}

window.openReminderEditor = function(reminderId) {
    const rem = reminderId ? getReminders().find(function(r) { return r.id === reminderId; }) : null;
    AuraState.temp.editReminderId = rem ? rem.id : '';

    const catNames = (typeof window.getDisplayCategories === 'function')
        ? window.getDisplayCategories().map(function(c) { return c.name; }).filter(Boolean)
        : [];
    const catOpts = catNames.map(function(n) { return { value: n, label: n }; });
    const walletOpts = Object.keys(AuraState.data.wallets || {}).map(function(k) {
        return { value: k, label: (AuraState.data.wallets[k].name || k) };
    });

    AuraUtils.safeDOM('reminder-editor-title', function(el) { el.innerText = rem ? 'Ubah Pengingat' : 'Tambah Pengingat'; });
    const setVal = function(id, v) { const el = document.getElementById(id); if (el) el.value = v == null ? '' : v; };
    setVal('rem-name', rem?.name || '');
    setVal('rem-amount', rem?.amount || '');
    setVal('rem-merchant', rem?.merchantName || '');
    fillSelect('rem-kategori', catOpts.length ? catOpts : [{ value: rem?.kategori || 'Lainnya', label: rem?.kategori || 'Lainnya' }], rem?.kategori || 'Lainnya');
    fillSelect('rem-item-kategori', catOpts.length ? catOpts : [{ value: rem?.itemKategori || 'Lainnya', label: rem?.itemKategori || 'Lainnya' }], rem?.itemKategori || rem?.kategori || 'Lainnya');
    fillSelect('rem-wallet', walletOpts, rem?.wallet_id || walletOpts[0]?.value || '');
    if (typeof window.showModal === 'function') window.showModal('modal-reminder');
};

window.saveReminder = async function() {
    const name = document.getElementById('rem-name')?.value.trim();
    const amount = Number(document.getElementById('rem-amount')?.value);
    if (!name || !(amount > 0)) {
        if (window.showToast) window.showToast('Nama dan nominal pengingat wajib diisi.', true);
        return;
    }
    const data = {
        name: name,
        amount: amount,
        merchantName: document.getElementById('rem-merchant')?.value.trim().toUpperCase() || '',
        kategori: document.getElementById('rem-kategori')?.value || 'Lainnya',
        itemKategori: document.getElementById('rem-item-kategori')?.value || 'Lainnya',
        wallet_id: document.getElementById('rem-wallet')?.value || ''
    };
    const list = getReminders();
    const editId = AuraState.temp.editReminderId;
    if (editId) {
        const idx = list.findIndex(function(r) { return r.id === editId; });
        if (idx !== -1) list[idx] = Object.assign({}, list[idx], data);
    } else {
        data.id = AuraUtils.generateId('rem');
        list.push(data);
    }
    try {
        await saveReminders(list);
        if (typeof window.closeModal === 'function') window.closeModal('modal-reminder');
        if (window.showToast) window.showToast('Pengingat disimpan.');
        window.renderReminderManager();
        if (typeof window.renderObligationChecklist === 'function') window.renderObligationChecklist();
    } catch (e) {
        console.error('[Pengingat]', e);
        if (window.showToast) window.showToast('Gagal menyimpan pengingat.', true);
    }
};

window.deleteReminder = async function(reminderId) {
    const rem = getReminders().find(function(r) { return r.id === reminderId; });
    if (!rem) return;
    const ok = await window.AuraConfirm('Hapus pengingat "' + rem.name + '"?');
    if (!ok) return;
    const list = getReminders().filter(function(r) { return r.id !== reminderId; });
    try {
        await saveReminders(list);
        if (window.showToast) window.showToast('Pengingat dihapus.');
        window.renderReminderManager();
        if (typeof window.renderObligationChecklist === 'function') window.renderObligationChecklist();
    } catch (e) {
        console.error('[Pengingat]', e);
        if (window.showToast) window.showToast('Gagal menghapus pengingat.', true);
    }
};

// Render awal panel kelola begitu state siap (pola interval yang sama
// seperti monitor status lama): aman karena render bersifat idempoten.
document.addEventListener('DOMContentLoaded', function() {
    const boot = setInterval(function() {
        if (AuraState.user?.uid && AuraState.data.settings) {
            clearInterval(boot);
            if (typeof window.renderReminderManager === 'function') window.renderReminderManager();
        }
    }, 1500);
    setTimeout(function() { clearInterval(boot); }, 30000);
});
