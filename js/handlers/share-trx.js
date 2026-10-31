/**
 * Bagikan Transaksi (permintaan pemilik 2026-10-31): dari kartu transaksi,
 * pengguna memilih format — teks rapi (panel berbagi perangkat / salin) atau
 * PDF bergaya struk — lalu mengirimnya ke chat tujuan. Modal menampilkan
 * pratinjau teks persis seperti yang akan diterima pihak lain.
 * Teks memakai penanda tebal gaya WhatsApp (*...*) pada judul & total.
 */
import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';

function findTrx(id) {
    const list = AuraState.data.transactions || [];
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
}

function walletNameOf(id) {
    const w = AuraState.data.wallets || {};
    if (Array.isArray(w)) {
        for (let i = 0; i < w.length; i++) if (w[i].id === id) return w[i].name || '';
    } else if (id && w[id]) return w[id].name || '';
    return '';
}

function fmtVal(trx, v) {
    const conv = AuraUtils.convertCurrency(Number(v) || 0, trx.mata_uang || 'JPY');
    return window.formatAuraCurrency ? window.formatAuraCurrency(conv) : String(conv);
}

function dateLong(tanggal) {
    const d = new Date((tanggal || '') + 'T00:00:00');
    return isNaN(d.getTime()) ? (tanggal || '') : d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function timeOf(trx) {
    const d = trx.createdAt ? new Date(trx.createdAt) : null;
    return (d && !isNaN(d.getTime())) ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
}

function titleOf(trx, partner) {
    if (partner) return 'Mutasi: ' + walletNameOf(trx.wallet_id) + ' → ' + walletNameOf(partner.wallet_id);
    return trx.merchantName || trx.storeName || trx.kategori || 'Transaksi';
}

function showItemsOf(trx, partner) {
    if (partner) return false;
    if (trx.tipe === 'mutasi_keluar' || trx.tipe === 'mutasi_masuk') return false;
    return Array.isArray(trx.items) && trx.items.length > 0;
}

function buildShareText(trx, partner) {
    const lines = [];
    lines.push('*AuraFi — Detail Transaksi*');
    lines.push('');
    lines.push('*' + titleOf(trx, partner) + '*');
    let meta = dateLong(trx.tanggal);
    const tm = timeOf(trx);
    if (tm) meta += ' • ' + tm;
    lines.push(meta);
    if (partner) {
        lines.push('Dari: ' + walletNameOf(trx.wallet_id));
        lines.push('Ke: ' + walletNameOf(partner.wallet_id));
    } else {
        const wn = walletNameOf(trx.wallet_id);
        if (wn) lines.push('Dompet: ' + wn);
        if (trx.kategori) lines.push('Kategori: ' + trx.kategori);
    }
    if (showItemsOf(trx, partner)) {
        lines.push('');
        lines.push('Rincian:');
        for (let i = 0; i < trx.items.length; i++) {
            const it = trx.items[i];
            const sub = (Number(it.harga) || 0) * (Number(it.qty) || 1);
            lines.push('- ' + (it.nama_barang || 'Item') + ' — ' + (it.qty || 1) + ' x ' + fmtVal(trx, it.harga) + ' = ' + fmtVal(trx, sub));
        }
    }
    lines.push('');
    let jenis = 'Total';
    if (trx.tipe === 'pemasukan') jenis = 'Total Pemasukan';
    else if (trx.tipe === 'pengeluaran') jenis = 'Total Pengeluaran';
    else if (partner || trx.tipe === 'mutasi_keluar' || trx.tipe === 'mutasi_masuk') jenis = 'Jumlah Mutasi';
    lines.push('*' + jenis + ': ' + fmtVal(trx, trx.nominal) + '*');
    const desc = trx.description || trx.catatan_ai || '';
    if (desc) {
        lines.push('');
        lines.push('Catatan: "' + desc + '"');
    }
    lines.push('');
    lines.push('— Dibagikan dari AuraFi');
    return lines.join('\n');
}

async function copyText(text) {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        throw new Error('no-clipboard');
    } catch (e) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return !!ok;
        } catch (e2) {
            return false;
        }
    }
}

function currentTarget() {
    const tgt = AuraState.temp.shareTrxTarget;
    if (!tgt) return null;
    if (tgt.multi) {
        const entries = [];
        for (let i = 0; i < tgt.multi.length; i++) {
            const trx = findTrx(tgt.multi[i].id);
            if (trx) entries.push({ trx: trx, partner: tgt.multi[i].pairId ? findTrx(tgt.multi[i].pairId) : null });
        }
        return entries.length ? { multi: entries } : null;
    }
    const trx = findTrx(tgt.id);
    if (!trx) return null;
    return { trx: trx, partner: tgt.pairId ? findTrx(tgt.pairId) : null };
}

window.openShareTrx = function(id, pairId) {
    const trx = findTrx(id);
    if (!trx) return;
    const partner = pairId ? findTrx(pairId) : null;
    AuraState.temp.shareTrxTarget = { id: id, pairId: pairId || null };
    AuraUtils.safeDOM('share-trx-title', el => el.innerText = titleOf(trx, partner));
    AuraUtils.safeDOM('share-trx-meta', el => {
        let meta = dateLong(trx.tanggal);
        const tm = timeOf(trx);
        if (tm) meta += ' • ' + tm;
        const wn = walletNameOf(trx.wallet_id);
        if (!partner && wn) meta += ' • ' + wn;
        el.innerText = meta;
    });
    AuraUtils.safeDOM('share-trx-amount', el => el.innerText = fmtVal(trx, trx.nominal));
    AuraUtils.safeDOM('share-trx-preview', el => el.innerText = buildShareText(trx, partner));
    AuraUtils.safeDOM('share-multi-btn', el => el.style.display = '');
    if (typeof window.showModal === 'function') window.showModal('modal-share-trx');
};

window.shareTrxAsText = async function() {
    const cur = currentTarget();
    if (!cur) return;
    const text = cur.multi ? buildShareTextMulti(cur.multi) : buildShareText(cur.trx, cur.partner);
    const Cap = window.Capacitor;
    try {
        if (Cap && Cap.Plugins && Cap.Plugins.Share) {
            await Cap.Plugins.Share.share({ title: 'Detail Transaksi AuraFi', text: text, dialogTitle: 'Bagikan transaksi' });
            if (typeof window.closeModal === 'function') window.closeModal('modal-share-trx');
            if (cur.multi) window.exitShareSelectMode();
            return;
        }
        if (navigator.share) {
            await navigator.share({ title: 'Detail Transaksi AuraFi', text: text });
            if (typeof window.closeModal === 'function') window.closeModal('modal-share-trx');
            if (cur.multi) window.exitShareSelectMode();
            return;
        }
        throw new Error('no-share-api');
    } catch (e) {
        const msg = (e && (e.message || e.name) || '').toString().toLowerCase();
        if (msg.indexOf('abort') >= 0 || msg.indexOf('cancel') >= 0) return;
        const ok = await copyText(text);
        if (window.showToast) window.showToast(ok ? 'Panel berbagi tidak tersedia — teks disalin, tempel di chat tujuan.' : 'Gagal membagikan teks.', !ok);
        if (ok && typeof window.closeModal === 'function') window.closeModal('modal-share-trx');
        if (ok && cur.multi) window.exitShareSelectMode();
    }
};

window.copyShareTrxText = async function() {
    const cur = currentTarget();
    if (!cur) return;
    const ok = await copyText(cur.multi ? buildShareTextMulti(cur.multi) : buildShareText(cur.trx, cur.partner));
    if (window.showToast) window.showToast(ok ? 'Teks transaksi disalin.' : 'Gagal menyalin teks.', !ok);
    if (ok && typeof window.closeModal === 'function') window.closeModal('modal-share-trx');
    if (ok && cur.multi) window.exitShareSelectMode();
};

function loadJsPDF() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s.onload = () => (window.jspdf && window.jspdf.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error('jsPDF kosong')));
        s.onerror = () => reject(new Error('CDN jsPDF tidak terjangkau'));
        document.head.appendChild(s);
    });
}

window.shareTrxAsPdf = async function() {
    const cur = currentTarget();
    if (!cur) return;
    if (cur.multi) {
        if (typeof window.closeModal === 'function') window.closeModal('modal-share-trx');
        await shareMultiAsPdf(cur.multi);
        window.exitShareSelectMode();
        return;
    }
    const trx = cur.trx;
    const partner = cur.partner;
    if (typeof window.closeModal === 'function') window.closeModal('modal-share-trx');
    if (window.showToast) window.showToast('Menyusun PDF...');

    let jsPDF;
    try {
        jsPDF = await loadJsPDF();
    } catch (e) {
        if (window.showToast) window.showToast('Gagal memuat pustaka PDF — periksa koneksi internet.', true);
        return;
    }

    const doc = new jsPDF({ unit: 'pt', format: 'a5' });
    const W = doc.internal.pageSize.getWidth();
    const M = 34;
    let y = 42;
    const dark = [30, 41, 59];
    const gray = [100, 116, 139];
    const pageH = doc.internal.pageSize.getHeight();
    function ensureSpace(h) {
        if (y + h > pageH - M) { doc.addPage(); y = M + 6; }
    }

    function centered(text, size, bold, color) {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(text, W / 2, y, { align: 'center' });
        y += size + 6;
    }
    function left(text, size, bold, color, gap) {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        const wrapped = doc.splitTextToSize(text, W - M * 2);
        for (let i = 0; i < wrapped.length; i++) { doc.text(wrapped[i], M, y); y += size + 3; }
        y += (gap || 0);
    }
    function dash() {
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.7);
        if (doc.setLineDashPattern) doc.setLineDashPattern([3, 3], 0);
        doc.line(M, y, W - M, y);
        if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);
        y += 12;
    }

    centered('AuraFi', 17, true, dark);
    centered('BUKTI TRANSAKSI', 8.5, false, gray);
    y += 2;
    dash();
    left(titleOf(trx, partner), 13, true, dark, 2);
    let meta = dateLong(trx.tanggal);
    const tm = timeOf(trx);
    if (tm) meta += ' • ' + tm;
    left(meta, 9, false, gray, 0);
    if (partner) {
        left('Dari: ' + walletNameOf(trx.wallet_id), 9.5, false, dark, 0);
        left('Ke: ' + walletNameOf(partner.wallet_id), 9.5, false, dark, 2);
    } else {
        const wn = walletNameOf(trx.wallet_id);
        if (wn) left('Dompet: ' + wn, 9.5, false, dark, 0);
        if (trx.kategori) left('Kategori: ' + trx.kategori, 9.5, false, dark, 2);
    }
    y += 4;
    dash();

    if (showItemsOf(trx, partner)) {
        for (let i = 0; i < trx.items.length; i++) {
            ensureSpace(30);
            const it = trx.items[i];
            const sub = (Number(it.harga) || 0) * (Number(it.qty) || 1);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(dark[0], dark[1], dark[2]);
            const nameLines = doc.splitTextToSize(it.nama_barang || 'Item', W - M * 2 - 92);
            doc.text(nameLines[0], M, y);
            doc.text(fmtVal(trx, sub), W - M, y, { align: 'right' });
            y += 12;
            for (let nl = 1; nl < nameLines.length; nl++) { doc.text(nameLines[nl], M, y); y += 12; }
            doc.setFontSize(8);
            doc.setTextColor(gray[0], gray[1], gray[2]);
            doc.text((it.qty || 1) + ' x ' + fmtVal(trx, it.harga) + (it.kategori_barang ? ' • ' + it.kategori_barang : ''), M, y);
            y += 15;
        }
        dash();
    }

    ensureSpace(36);
    let jenis = 'TOTAL';
    if (trx.tipe === 'pemasukan') jenis = 'TOTAL PEMASUKAN';
    else if (trx.tipe === 'pengeluaran') jenis = 'TOTAL PENGELUARAN';
    else if (partner || trx.tipe === 'mutasi_keluar' || trx.tipe === 'mutasi_masuk') jenis = 'JUMLAH MUTASI';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.text(jenis, M, y);
    doc.text(fmtVal(trx, trx.nominal), W - M, y, { align: 'right' });
    y += 20;

    const desc = trx.description || trx.catatan_ai || '';
    if (desc) {
        ensureSpace(30);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(gray[0], gray[1], gray[2]);
        const wrapped = doc.splitTextToSize('Catatan: "' + desc + '"', W - M * 2);
        for (let i = 0; i < wrapped.length; i++) { doc.text(wrapped[i], M, y); y += 12; }
        y += 4;
    }
    ensureSpace(34);
    dash();
    centered('Dibagikan dari AuraFi • ' + new Date().toLocaleString('id-ID'), 7.5, false, gray);

    const slug = titleOf(trx, partner).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'Transaksi';
    const fileName = 'Transaksi-' + (trx.tanggal || '') + '-' + slug + '.pdf';
    try {
        const Cap = window.Capacitor;
        if (Cap && Cap.Plugins && Cap.Plugins.Filesystem && Cap.Plugins.Share) {
            const dataUri = doc.output('datauristring');
            const base64 = dataUri.split(',')[1];
            const written = await Cap.Plugins.Filesystem.writeFile({ path: fileName, data: base64, directory: 'CACHE' });
            await Cap.Plugins.Share.share({ title: fileName, url: written.uri, dialogTitle: 'Simpan / bagikan PDF transaksi' });
        } else {
            doc.save(fileName);
        }
        if (window.showToast) window.showToast('PDF transaksi dibuat.');
    } catch (e) {
        try { doc.save(fileName); if (window.showToast) window.showToast('PDF transaksi dibuat.'); }
        catch (e2) { if (window.showToast) window.showToast('Gagal membuat PDF di perangkat ini.', true); }
    }
};

// ============================================================================
// PILIH BEBERAPA TRANSAKSI (permintaan pemilik 2026-11-01): mode pilih dari
// modal Bagikan — ketuk lingkaran di pojok kiri atas kartu untuk menandai,
// lalu bagikan semuanya sekaligus sebagai satu teks / satu PDF gabungan.
// Pasangan mutasi dihitung SATU entri (kaki keluar mewakili pasangannya).
// Total mengikuti aturan dashboard: tarik/setor tunai hanya fee-nya yang
// dihitung pengeluaran; mutasi & nabung netral (tidak masuk total masuk/
// keluar).
// ============================================================================
function convOf(trx, v) {
    return AuraUtils.convertCurrency(Number(v) || 0, trx.mata_uang || 'JPY');
}
function fmtConv(v) {
    return window.formatAuraCurrency ? window.formatAuraCurrency(v) : String(Math.round(v));
}
function signOf(trx, partner) {
    if (partner || trx.tipe === 'mutasi_keluar' || trx.tipe === 'mutasi_masuk') return '⇄';
    if (trx.tipe === 'pemasukan') return '+';
    return '−';
}
function totalsOf(entries) {
    let inn = 0, out = 0;
    for (let i = 0; i < entries.length; i++) {
        const trx = entries[i].trx;
        if (entries[i].partner) continue;
        if (trx.tipe === 'pemasukan') inn += convOf(trx, trx.nominal);
        else if (trx.tipe === 'pengeluaran') out += convOf(trx, trx.nominal);
        else if (trx.tipe === 'tarik_tunai' || trx.tipe === 'setor_tunai') out += convOf(trx, trx.admin_fee || 0);
    }
    return { inn: inn, out: out };
}

function buildShareTextMulti(entries) {
    const lines = [];
    lines.push('*AuraFi — ' + entries.length + ' Transaksi*');
    for (let i = 0; i < entries.length; i++) {
        const trx = entries[i].trx, partner = entries[i].partner;
        lines.push('');
        lines.push('*' + titleOf(trx, partner) + '*');
        let meta = dateLong(trx.tanggal);
        const tm = timeOf(trx);
        if (tm) meta += ' • ' + tm;
        if (partner) meta += ' • ' + walletNameOf(trx.wallet_id) + ' → ' + walletNameOf(partner.wallet_id);
        else { const wn = walletNameOf(trx.wallet_id); if (wn) meta += ' • ' + wn; }
        lines.push(meta);
        if (showItemsOf(trx, partner)) {
            for (let j = 0; j < trx.items.length; j++) {
                const it = trx.items[j];
                const sub = (Number(it.harga) || 0) * (Number(it.qty) || 1);
                lines.push('- ' + (it.nama_barang || 'Item') + ' — ' + (it.qty || 1) + ' x ' + fmtVal(trx, it.harga) + ' = ' + fmtVal(trx, sub));
            }
        }
        lines.push('Subtotal: ' + signOf(trx, partner) + fmtVal(trx, trx.nominal));
    }
    const t = totalsOf(entries);
    lines.push('');
    lines.push('——————————');
    if (t.inn > 0) lines.push('*Total Pemasukan: ' + fmtConv(t.inn) + '*');
    if (t.out > 0) lines.push('*Total Pengeluaran: ' + fmtConv(t.out) + '*');
    if (t.inn > 0 && t.out > 0) lines.push('*Selisih Bersih: ' + (t.inn - t.out >= 0 ? '+' : '−') + fmtConv(Math.abs(t.inn - t.out)) + '*');
    lines.push('');
    lines.push('— Dibagikan dari AuraFi');
    return lines.join('\n');
}

function selectionMap() {
    if (!AuraState.temp.shareSelection) AuraState.temp.shareSelection = {};
    return AuraState.temp.shareSelection;
}
function selectionEntries() {
    const sel = selectionMap();
    const entries = [];
    Object.keys(sel).forEach(function (id) {
        const trx = findTrx(id);
        if (trx) entries.push({ trx: trx, partner: sel[id] ? findTrx(sel[id]) : null });
    });
    entries.sort(function (a, b) {
        const ka = (a.trx.tanggal || '') + (a.trx.createdAt || ''), kb = (b.trx.tanggal || '') + (b.trx.createdAt || '');
        return kb < ka ? -1 : kb > ka ? 1 : 0;
    });
    return entries;
}
function updateShareBar() {
    const bar = document.getElementById('share-select-bar');
    if (!bar) return;
    const n = Object.keys(selectionMap()).length;
    const cnt = bar.querySelector('.ssb-count');
    if (cnt) cnt.textContent = n + ' transaksi dipilih';
    const go = bar.querySelector('.ssb-go');
    if (go) { go.disabled = n === 0; go.style.opacity = n === 0 ? '.45' : '1'; }
}

window.enterShareSelectMode = function () {
    AuraState.temp.shareSelection = {};
    document.querySelectorAll('.share-select-check.sel').forEach(function (b) { b.classList.remove('sel'); });
    document.querySelectorAll('[data-trx-card].share-selected').forEach(function (c) { c.classList.remove('share-selected'); });
    if (typeof window.closeModal === 'function') window.closeModal('modal-share-trx');
    document.body.classList.add('share-selecting');
    if (!document.getElementById('share-select-bar')) {
        const bar = document.createElement('div');
        bar.id = 'share-select-bar';
        bar.innerHTML = '<span class="ssb-count">0 transaksi dipilih</span>' +
            '<button class="ssb-cancel" onclick="window.exitShareSelectMode()">BATAL</button>' +
            '<button class="ssb-go" onclick="window.openShareSelected()">BAGIKAN <i class="fa-solid fa-share-nodes"></i></button>';
        document.body.appendChild(bar);
    }
    updateShareBar();
    if (window.showToast) window.showToast('Mode pilih: ketuk lingkaran di pojok kartu yang ingin dibagikan.');
};

window.exitShareSelectMode = function () {
    AuraState.temp.shareSelection = {};
    document.body.classList.remove('share-selecting');
    document.querySelectorAll('.share-select-check.sel').forEach(function (b) { b.classList.remove('sel'); });
    document.querySelectorAll('[data-trx-card].share-selected').forEach(function (c) { c.classList.remove('share-selected'); });
    const bar = document.getElementById('share-select-bar');
    if (bar) bar.remove();
};

window.toggleShareSelect = function (id, pairId, btn) {
    const sel = selectionMap();
    if (sel[id]) delete sel[id]; else sel[id] = pairId || null;
    const on = !!sel[id];
    if (btn) {
        btn.classList.toggle('sel', on);
        const card = btn.closest('[data-trx-card]');
        if (card) card.classList.toggle('share-selected', on);
    }
    updateShareBar();
};

window.openShareSelected = function () {
    const entries = selectionEntries();
    if (!entries.length) return;
    AuraState.temp.shareTrxTarget = {
        multi: entries.map(function (e) { return { id: e.trx.id, pairId: e.partner ? e.partner.id : null }; })
    };
    const t = totalsOf(entries);
    const net = t.inn - t.out;
    AuraUtils.safeDOM('share-trx-title', el => el.innerText = entries.length + ' Transaksi Dipilih');
    AuraUtils.safeDOM('share-trx-meta', el => el.innerText = 'Gabungan beberapa transaksi');
    AuraUtils.safeDOM('share-trx-amount', el => el.innerText = (net >= 0 ? '+' : '−') + fmtConv(Math.abs(net)) + ' (bersih)');
    AuraUtils.safeDOM('share-trx-preview', el => el.innerText = buildShareTextMulti(entries));
    AuraUtils.safeDOM('share-multi-btn', el => el.style.display = 'none');
    if (typeof window.showModal === 'function') window.showModal('modal-share-trx');
};

async function shareMultiAsPdf(entries) {
    if (window.showToast) window.showToast('Menyusun PDF...');
    let jsPDF;
    try {
        jsPDF = await loadJsPDF();
    } catch (e) {
        if (window.showToast) window.showToast('Gagal memuat pustaka PDF — periksa koneksi internet.', true);
        return;
    }
    const doc = new jsPDF({ unit: 'pt', format: 'a5' });
    const W = doc.internal.pageSize.getWidth();
    const M = 34;
    let y = 42;
    const dark = [30, 41, 59];
    const gray = [100, 116, 139];
    const pageH = doc.internal.pageSize.getHeight();
    function ensureSpace(h) { if (y + h > pageH - M) { doc.addPage(); y = M + 6; } }
    function centered(text, size, bold, color) {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(text, W / 2, y, { align: 'center' });
        y += size + 6;
    }
    function left(text, size, bold, color, gap) {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        const wrapped = doc.splitTextToSize(text, W - M * 2);
        for (let i = 0; i < wrapped.length; i++) { doc.text(wrapped[i], M, y); y += size + 3; }
        y += (gap || 0);
    }
    function dash() {
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.7);
        if (doc.setLineDashPattern) doc.setLineDashPattern([3, 3], 0);
        doc.line(M, y, W - M, y);
        if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);
        y += 12;
    }

    centered('AuraFi', 17, true, dark);
    centered('BUKTI TRANSAKSI — ' + entries.length + ' TRANSAKSI', 8.5, false, gray);
    y += 2;
    dash();

    for (let i = 0; i < entries.length; i++) {
        const trx = entries[i].trx, partner = entries[i].partner;
        ensureSpace(64);
        left(titleOf(trx, partner), 12, true, dark, 1);
        let meta = dateLong(trx.tanggal);
        const tm = timeOf(trx);
        if (tm) meta += ' • ' + tm;
        left(meta, 8.5, false, gray, 0);
        if (partner) {
            left('Dari: ' + walletNameOf(trx.wallet_id) + '  →  Ke: ' + walletNameOf(partner.wallet_id), 9, false, dark, 1);
        } else {
            const wn = walletNameOf(trx.wallet_id);
            if (wn) left('Dompet: ' + wn + (trx.kategori ? ' • Kategori: ' + trx.kategori : ''), 9, false, dark, 1);
        }
        if (showItemsOf(trx, partner)) {
            for (let j = 0; j < trx.items.length; j++) {
                ensureSpace(28);
                const it = trx.items[j];
                const sub = (Number(it.harga) || 0) * (Number(it.qty) || 1);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(dark[0], dark[1], dark[2]);
                const nameLines = doc.splitTextToSize(it.nama_barang || 'Item', W - M * 2 - 92);
                doc.text(nameLines[0], M, y);
                doc.text(fmtVal(trx, sub), W - M, y, { align: 'right' });
                y += 11;
                for (let nl = 1; nl < nameLines.length; nl++) { doc.text(nameLines[nl], M, y); y += 11; }
                doc.setFontSize(7.5);
                doc.setTextColor(gray[0], gray[1], gray[2]);
                doc.text((it.qty || 1) + ' x ' + fmtVal(trx, it.harga) + (it.kategori_barang ? ' • ' + it.kategori_barang : ''), M, y);
                y += 14;
            }
        }
        ensureSpace(22);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(dark[0], dark[1], dark[2]);
        doc.text('Subtotal', M, y);
        doc.text(signOf(trx, partner) + fmtVal(trx, trx.nominal), W - M, y, { align: 'right' });
        y += 16;
        dash();
    }

    const t = totalsOf(entries);
    ensureSpace(64);
    function totalRow(label, valText) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(dark[0], dark[1], dark[2]);
        doc.text(label, M, y);
        doc.text(valText, W - M, y, { align: 'right' });
        y += 17;
    }
    if (t.inn > 0) totalRow('TOTAL PEMASUKAN', '+' + fmtConv(t.inn));
    if (t.out > 0) totalRow('TOTAL PENGELUARAN', '−' + fmtConv(t.out));
    if (t.inn > 0 && t.out > 0) totalRow('SELISIH BERSIH', (t.inn - t.out >= 0 ? '+' : '−') + fmtConv(Math.abs(t.inn - t.out)));
    y += 4;
    ensureSpace(30);
    dash();
    centered('Dibagikan dari AuraFi • ' + new Date().toLocaleString('id-ID'), 7.5, false, gray);

    const fileName = 'Transaksi-Pilihan-' + new Date().toISOString().slice(0, 10) + '-' + entries.length + 'trx.pdf';
    try {
        const Cap = window.Capacitor;
        if (Cap && Cap.Plugins && Cap.Plugins.Filesystem && Cap.Plugins.Share) {
            const dataUri = doc.output('datauristring');
            const base64 = dataUri.split(',')[1];
            const written = await Cap.Plugins.Filesystem.writeFile({ path: fileName, data: base64, directory: 'CACHE' });
            await Cap.Plugins.Share.share({ title: fileName, url: written.uri, dialogTitle: 'Simpan / bagikan PDF transaksi' });
        } else {
            doc.save(fileName);
        }
        if (window.showToast) window.showToast('PDF gabungan dibuat.');
    } catch (e) {
        try { doc.save(fileName); if (window.showToast) window.showToast('PDF gabungan dibuat.'); }
        catch (e2) { if (window.showToast) window.showToast('Gagal membuat PDF di perangkat ini.', true); }
    }
}
