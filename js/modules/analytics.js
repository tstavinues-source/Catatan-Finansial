/**
 * Analytics & Statistics Module
 * Mengelola kalkulasi pengeluaran, pembersihan kategori (anti-duplikat), 
 * rendering grafik, dan eksport data (CSV).
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';

window.renderAnalytics = function() {
    const transactions = AuraState.data.transactions || [];
    
    // 1. FILTER WAKTU (Siklus 16-15 vs Bulanan)
    let startDate = 0, endDate = Infinity;
    const now = new Date();
    const mode = AuraState.system.viewMode || 'period';
    
    if (mode === 'period') {
        const y = now.getFullYear(); const m = now.getMonth(); const d = now.getDate();
        if (d >= 16) {
            startDate = new Date(y, m, 16, 0, 0, 0).getTime();
            endDate = new Date(y, m + 1, 15, 23, 59, 59).getTime();
        } else {
            startDate = new Date(y, m - 1, 16, 0, 0, 0).getTime();
            endDate = new Date(y, m, 15, 23, 59, 59).getTime();
        }
    } else if (mode === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0).getTime();
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
    } else {
        startDate = 0; // Mode All-Time
    }

    // Variabel Penyimpanan
    let catMap = {};
    let merchantMap = {};
    let totalExpense = 0;
    const trend7Days = [0, 0, 0, 0, 0, 0, 0];

    // 2. PROSES & FILTER DATA TRANSAKSI
    transactions.forEach(trx => {
        if (trx.is_deleted || trx.tipe !== 'pengeluaran') return;
        
        const trxTime = new Date(trx.tanggal || trx.createdAt).getTime();

        // Data untuk Grafik Tren 7 Hari (Tidak terpengaruh filter siklus)
        const daysDiff = Math.floor((now.getTime() - trxTime) / (1000 * 3600 * 24));
        if (daysDiff >= 0 && daysDiff < 7) {
            trend7Days[6 - daysDiff] += (trx.nominal || 0);
        }

        // Data untuk Statistik Siklus
        if (trxTime >= startDate && trxTime <= endDate) {
            const safeMerchant = (trx.merchantName || trx.storeName || 'Tidak Diketahui').trim().toUpperCase();
            let trxExpense = 0;

            (trx.items || []).forEach(it => {
                // PEMBERSIH KATEGORI (ANTI-DUPLIKAT)
                // Menghilangkan spasi dan membuat Huruf Kapital di setiap awal kata
                let rawCat = (it.kategori_barang || 'Lainnya').trim();
                let cleanCat = rawCat.split(' ').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                ).join(' ');

                let val = (Number(it.harga) || 0) * (Number(it.qty) || 1);
                catMap[cleanCat] = (catMap[cleanCat] || 0) + val;
                trxExpense += val;
            });

            merchantMap[safeMerchant] = (merchantMap[safeMerchant] || 0) + trxExpense;
            totalExpense += trxExpense;
        }
    });

    // 3. RENDER DISTRIBUSI KATEGORI
    const catContainer = document.getElementById('top-categories-list');
    AuraUtils.safeDOM('pie-total-label', el => el.innerText = AuraUtils.formatCurrency(totalExpense));
    
    if (catContainer) {
        catContainer.innerHTML = '';
        const sortedCats = Object.keys(catMap).map(k => ({name: k, total: catMap[k]})).sort((a,b) => b.total - a.total);
        
        if (sortedCats.length === 0) {
            catContainer.innerHTML = '<p class="text-xs text-center text-[var(--text-muted)] py-4">Belum ada pengeluaran di siklus ini.</p>';
        } else {
            sortedCats.forEach(c => {
                let percent = totalExpense > 0 ? Math.round((c.total / totalExpense) * 100) : 0;
                catContainer.innerHTML += `
                <div class="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-[var(--border-glass)] hover:border-white/10 transition mb-2">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><i class="fa-solid fa-tag text-[var(--text-muted)] text-xs"></i></div>
                        <div>
                            <p class="text-xs font-bold text-white">${c.name}</p>
                            <p class="text-[9px] text-[var(--text-muted)]">${percent}% dari total pengeluaran</p>
                        </div>
                    </div>
                    <p class="text-xs font-bold font-mono text-white">${AuraUtils.formatCurrency(c.total)}</p>
                </div>`;
            });
        }
    }

    // 4. RENDER TOP MERCHANTS
    const merchantContainer = document.getElementById('top-merchants-list');
    if (merchantContainer) {
        merchantContainer.innerHTML = '';
        const sortedMerchants = Object.keys(merchantMap).map(k => ({name: k, total: merchantMap[k]})).sort((a,b) => b.total - a.total).slice(0, 5); // Ambil Top 5
        
        if (sortedMerchants.length === 0) {
            merchantContainer.innerHTML = '<p class="text-xs text-center text-[var(--text-muted)] py-4">Belum ada toko yang dikunjungi.</p>';
        } else {
            sortedMerchants.forEach((m, idx) => {
                let rankColor = idx === 0 ? 'text-amber-400' : (idx === 1 ? 'text-slate-300' : (idx === 2 ? 'text-orange-400' : 'text-[var(--text-muted)]'));
                merchantContainer.innerHTML += `
                <div class="flex justify-between items-center bg-black/30 p-2.5 rounded-lg border border-[var(--border-glass)] mb-2">
                    <div class="flex items-center gap-2">
                        <span class="font-black text-sm w-4 text-center ${rankColor}">#${idx+1}</span>
                        <span class="text-[10px] font-bold text-white truncate max-w-[150px]">${m.name}</span>
                    </div>
                    <span class="text-[10px] font-mono text-accent font-bold">${AuraUtils.formatCurrency(m.total)}</span>
                </div>`;
            });
        }
    }

    // 5. RENDER STATISTIK & PROYEKSI
    const daysElapsed = Math.max(1, Math.ceil((now.getTime() - startDate) / (1000 * 3600 * 24)));
    const totalDays = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 3600 * 24)));
    
    const dailyAvg = totalExpense / daysElapsed;
    const projected = dailyAvg * totalDays;

    AuraUtils.safeDOM('stats-daily-avg', el => el.innerText = AuraUtils.formatCurrency(dailyAvg));
    AuraUtils.safeDOM('stats-proj-mth', el => el.innerText = AuraUtils.formatCurrency(projected));

    // 6. GAMBAR GRAFIK 7 HARI (CANVAS)
    drawCanvasChart(trend7Days);
};

function drawCanvasChart(dataArray) {
    const canvas = document.getElementById('canvas-7days');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const width = canvas.offsetWidth || 350;
    const height = canvas.offsetHeight || 150;
    
    // Setup Retina Display
    canvas.width = width * 2;
    canvas.height = height * 2;
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, width, height);

    const maxVal = Math.max(...dataArray, 100); 
    const padding = 15;
    const barWidth = (width - padding * 2) / 7 - 10;

    dataArray.forEach((val, i) => {
        const barHeight = (val / maxVal) * (height - padding * 2.5);
        const x = padding + i * (barWidth + 10);
        const y = height - padding - barHeight;
        
        // Warna batang grafik
        ctx.fillStyle = '#f43f5e'; // Rose-500 (Warna Expense)
        ctx.globalAlpha = i === 6 ? 1.0 : 0.4; // Hari ini lebih terang
        
        // Gambar batang dengan sudut membulat (jika disupport)
        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, 6);
            ctx.fill();
        } else {
            ctx.fillRect(x, y, barWidth, barHeight);
        }
        
        // Teks nominal di atas batang
        if (val > 0) {
            ctx.globalAlpha = 1.0;
            ctx.fillStyle = '#9ca3af'; // Text-muted
            ctx.font = "bold 9px 'Space Grotesk', monospace";
            ctx.textAlign = "center";
            ctx.fillText((val / 1000).toFixed(1) + 'k', x + barWidth / 2, y - 5);
        }
    });
}

// 7. FITUR EXPORT CSV
window.downloadCSV = function() {
    const transactions = AuraState.data.transactions || [];
    if (transactions.length === 0) {
        if (window.showToast) window.showToast("Tidak ada data untuk diunduh.", true);
        return;
    }

    let csvContent = "TANGGAL,WAKTU,TIPE,METODE,MATA_UANG,MERCHANT,ITEM,KATEGORI,HARGA_SATUAN,QTY,TOTAL_BARANG\n";
    
    transactions.forEach(trx => {
        if (trx.is_deleted) return;
        
        const dateObj = new Date(trx.tanggal || trx.createdAt);
        const dateStr = dateObj.toLocaleDateString('id-ID');
        const timeStr = dateObj.toLocaleTimeString('id-ID');
        const safeMerchant = `"${(trx.merchantName || trx.storeName || 'Unknown').replace(/"/g, '""')}"`;
        
        (trx.items || []).forEach(it => {
            const safeItemName = `"${(it.nama_barang || 'Item').replace(/"/g, '""')}"`;
            const safeCat = `"${(it.kategori_barang || 'Lainnya').replace(/"/g, '""')}"`;
            const harga = Number(it.harga) || 0;
            const qty = Number(it.qty) || 1;
            const subtotal = harga * qty;
            
            csvContent += `${dateStr},${timeStr},${trx.tipe.toUpperCase()},${trx.metode_pembayaran},${trx.mata_uang},${safeMerchant},${safeItemName},${safeCat},${harga},${qty},${subtotal}\n`;
        });
    });

    const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `AuraFi_Export_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (window.showToast) window.showToast("Data CSV berhasil diunduh!");
};
