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
    if (typeof window.showModal === 'function') window.showModal('modal-share-trx');
};

window.shareTrxAsText = async function() {
    const cur = currentTarget();
    if (!cur) return;
    const text = buildShareText(cur.trx, cur.partner);
    const Cap = window.Capacitor;
    try {
        if (Cap && Cap.Plugins && Cap.Plugins.Share) {
            await Cap.Plugins.Share.share({ title: 'Detail Transaksi AuraFi', text: text, dialogTitle: 'Bagikan transaksi' });
            if (typeof window.closeModal === 'function') window.closeModal('modal-share-trx');
            return;
        }
        if (navigator.share) {
            await navigator.share({ title: 'Detail Transaksi AuraFi', text: text });
            if (typeof window.closeModal === 'function') window.closeModal('modal-share-trx');
            return;
        }
        throw new Error('no-share-api');
    } catch (e) {
        const msg = (e && (e.message || e.name) || '').toString().toLowerCase();
        if (msg.indexOf('abort') >= 0 || msg.indexOf('cancel') >= 0) return;
        const ok = await copyText(text);
        if (window.showToast) window.showToast(ok ? 'Panel berbagi tidak tersedia — teks disalin, tempel di chat tujuan.' : 'Gagal membagikan teks.', !ok);
        if (ok && typeof window.closeModal === 'function') window.closeModal('modal-share-trx');
    }
};

window.copyShareTrxText = async function() {
    const cur = currentTarget();
    if (!cur) return;
    const ok = await copyText(buildShareText(cur.trx, cur.partner));
    if (window.showToast) window.showToast(ok ? 'Teks transaksi disalin.' : 'Gagal menyalin teks.', !ok);
    if (ok && typeof window.closeModal === 'function') window.closeModal('modal-share-trx');
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
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(gray[0], gray[1], gray[2]);
        const wrapped = doc.splitTextToSize('Catatan: "' + desc + '"', W - M * 2);
        for (let i = 0; i < wrapped.length; i++) { doc.text(wrapped[i], M, y); y += 12; }
        y += 4;
    }
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
