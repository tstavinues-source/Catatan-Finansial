/**
 * Analytics & Statistics Module
 * Mengelola kalkulasi pengeluaran dengan sistem Induk-Anak (Accordion), 
 * rendering grafik, Pie Chart, eksport data (CSV), dan Smart Grouper.
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';
import { CategoryManager } from './categories.js';

// === MESIN PENYORTIR PINTAR (SMART GROUPER) ===
// Mencegat kategori buatan AI dan memaksanya masuk ke folder Induk yang tepat
function getParentCategory(catName) {
    const n = catName.toLowerCase();
    
    // Rumpun Minuman
    if (n.includes('minum') || n.includes('kopi') || n.includes('teh') || n.includes('kafe')) {
        return 'Minuman';
    }
    // Rumpun Makanan (Termasuk bahan mentah, camilan, dan susu)
    if (n.match(/makan|camilan|snack|susu|telur|daging|ayam|ikan|sayur|buah|bumbu|roti|kue|instan|kaleng|mie|jajanan/)) {
        return 'Makanan';
    }
    // Rumpun Elektronik & Digital
    if (n.match(/elektronik|pulsa|data|internet|listrik|gadget|game|wifi|topup/)) {
        return 'Elektronik';
    }
    // Rumpun Bahan Pokok
    if (n.match(/pokok|beras|minyak|gula|sembako/)) {
        return 'Bahan Pokok';
    }
    // Rumpun Rumah Tangga & Utilitas
    if (n.match(/rumah|alat|sabun|deterjen|sampo|odol|mandi|cuci/)) {
        return 'Peralatan Rumah Tangga';
    }
    // Rumpun Transportasi
    if (n.match(/transport|bensin|parkir|kereta|bus|gojek|grab|tol/)) {
        return 'Transportasi';
    }
    // Rumpun Pakaian & Kesehatan
    if (n.match(/pakaian|baju|celana|sepatu|fashion/)) return 'Pakaian';
    if (n.match(/sehat|obat|medis|dokter|apotek/)) return 'Kesehatan';
    
    // Jika AI membuat kategori yang sangat asing, buang ke Lainnya
    return 'Lainnya';
}

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
        startDate = 0; 
    }

    // Variabel Penyimpanan Hierarki
    let catMap = {}; 
    let merchantMap = {};
    let totalExpense = 0;
    const trend7Days = [0, 0, 0, 0, 0, 0, 0];

    // 2. PROSES & FILTER DATA TRANSAKSI
    transactions.forEach(trx => {
        if (trx.is_deleted || trx.tipe !== 'pengeluaran') return;
        
        const trxTime = new Date(trx.tanggal || trx.createdAt).getTime();

        if (daysDiff >= 0 && daysDiff < 7) {
            trend7Days[6 - daysDiff] += (trx.nominal || 0);
        }

        if (trxTime >= startDate && trxTime <= endDate) {
            const safeMerchant = (trx.merchantName || trx.storeName || 'Tidak Diketahui').trim().toUpperCase();
            let trxExpense = 0;

            (trx.items || []).forEach(it => {
                // Pembersih Kategori
                let rawCat = (it.kategori_barang || 'Lainnya').trim();
                let cleanCat = rawCat.split(' ').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                ).join(' ');

                let val = (Number(it.harga) || 0) * (Number(it.qty) || 1);
                
                // Panggil Penyortir Pintar untuk menentukan Induknya
                const parentName = getParentCategory(cleanCat);
                const styleInfo = CategoryManager.resolveStyle(parentName);

                if (!catMap[parentName]) {
                    catMap[parentName] = { 
                        total: 0, 
                        style: styleInfo, 
                        subs: {} 
                    };
                }

                // Masukkan ke Induk dan Sub-kategorinya
                catMap[parentName].total += val;
                catMap[parentName].subs[cleanCat] = (catMap[parentName].subs[cleanCat] || 0) + val;
                
                trxExpense += val;
            });

            merchantMap[safeMerchant] = (merchantMap[safeMerchant] || 0) + trxExpense;
            totalExpense += trxExpense;
        }
    });

    // 3. RENDER DISTRIBUSI KATEGORI (ACCORDION UI)
    const catContainer = document.getElementById('top-categories-list');
    AuraUtils.safeDOM('pie-total-label', el => el.innerText = AuraUtils.formatCurrency(totalExpense));
    
    const sortedParents = Object.keys(catMap).map(k => ({
        name: k, 
        total: catMap[k].total,
        style: catMap[k].style,
        subs: catMap[k].subs
    })).sort((a,b) => b.total - a.total);

    // Pie Chart Renderer
    AuraUtils.safeDOM('category-pie-chart', el => {
        if (totalExpense > 0 && sortedParents.length > 0) {
            let conicStops = []; 
            let currentAngle = 0;
            
            for (let i = 0; i < sortedParents.length; i++) {
                let pct = (sortedParents[i].total / totalExpense) * 100; 
                let hex = sortedParents[i].style.hex;
                conicStops.push(`${hex} ${currentAngle}% ${currentAngle + pct}%`); 
                currentAngle += pct;
            }
            el.style.background = `conic-gradient(${conicStops.join(', ')})`;
        } else { 
            el.style.background = `conic-gradient(var(--border-glass) 0% 100%)`; 
        }
    });
    
    if (catContainer) {
        catContainer.innerHTML = '';
        
        if (sortedParents.length === 0) {
            catContainer.innerHTML = '<p class="text-xs text-center text-[var(--text-muted)] py-4">Belum ada pengeluaran di siklus ini.</p>';
        } else {
            sortedParents.forEach((p, idx) => {
                let percent = totalExpense > 0 ? Math.round((p.total / totalExpense) * 100) : 0;
                
                const sortedSubs = Object.keys(p.subs).map(subK => ({
                    name: subK,
                    total: p.subs[subK]
                })).sort((a,b) => b.total - a.total);

                let subsHtml = '';
                const hasSpecificSubs = sortedSubs.some(sub => sub.name !== p.name);

                if (hasSpecificSubs) {
                    sortedSubs.forEach(sub => {
                        // Jangan tampilkan sub-kategori jika namanya persis sama dengan induknya (mencegah redundansi visual)
                        const displayName = sub.name === p.name ? `Item Umum ${p.name}` : sub.name;
                        
                        subsHtml += `
                        <div class="flex justify-between items-center px-3 py-2 border-b border-white/5 last:border-0 hover:bg-white/5 transition">
                            <span class="text-[10px] text-slate-300 flex items-center gap-2">
                                <div class="w-1.5 h-1.5 rounded-full" style="background-color: ${p.style.hex};"></div> 
                                ${displayName}
                            </span>
                            <span class="text-[10px] font-mono font-bold text-slate-300">${AuraUtils.formatCurrency(sub.total)}</span>
                        </div>`;
                    });
                } else {
                    subsHtml += `
                        <div class="px-3 py-2 text-[10px] text-[var(--text-muted)] italic text-center">
                            Seluruhnya adalah item umum ${p.name}.
                        </div>`;
                }

                catContainer.innerHTML += `
                <div class="mb-2 bg-black/20 border border-[var(--border-glass)] rounded-xl overflow-hidden group">
                    <div class="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition active:scale-[0.99]" onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.fa-chevron-down').classList.toggle('rotate-180');">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style="background-color: ${p.style.hex}20;">
                                <i class="fa-solid ${p.style.icon}" style="color: ${p.style.hex};"></i>
                            </div>
                            <div>
                                <p class="text-xs font-bold text-white">${p.name}</p>
                                <p class="text-[9px] text-[var(--text-muted)]">${percent}% dari total pengeluaran</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <p class="text-xs font-bold font-mono text-white">${AuraUtils.formatCurrency(p.total)}</p>
                            <div class="w-5 h-5 flex items-center justify-center bg-black/30 rounded-full shrink-0">
                                <i class="fa-solid fa-chevron-down text-[9px] text-[var(--text-muted)] transition-transform duration-300"></i>
                            </div>
                        </div>
                    </div>
                    <div class="hidden border-t border-[var(--border-glass)] bg-black/40 py-1">
                        ${subsHtml}
                    </div>
                </div>`;
            });
        }
    }

    // 4. RENDER TOP MERCHANTS
    const merchantContainer = document.getElementById('top-merchants-list');
    if (merchantContainer) {
        merchantContainer.innerHTML = '';
        const sortedMerchants = Object.keys(merchantMap).map(k => ({name: k, total: merchantMap[k]})).sort((a,b) => b.total - a.total).slice(0, 5);
        
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

    drawCanvasChart(trend7Days);
};

function drawCanvasChart(dataArray) {
    const canvas = document.getElementById('canvas-7days');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const width = canvas.offsetWidth || 350;
    const height = canvas.offsetHeight || 150;
    
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
        
        ctx.fillStyle = '#f43f5e';
        ctx.globalAlpha = i === 6 ? 1.0 : 0.4;
        
        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, 6);
            ctx.fill();
        } else {
            ctx.fillRect(x, y, barWidth, barHeight);
        }
        
        if (val > 0) {
            ctx.globalAlpha = 1.0;
            ctx.fillStyle = '#9ca3af';
            ctx.font = "bold 9px 'Space Grotesk', monospace";
            ctx.textAlign = "center";
            
            const rate = AuraState.system.displayCurrency === 'IDR' ? (AuraState.system.exchangeRate || 105) : 1;
            const convertedVal = val * rate;
            
            const displayStr = AuraState.system.displayCurrency === 'IDR' ? (convertedVal / 1000).toFixed(0) + 'k' : (convertedVal / 1000).toFixed(1) + 'k';
            ctx.fillText(displayStr, x + barWidth / 2, y - 5);
        }
    });
}

window.downloadCSV = function() {
    // Biarkan fungsi export CSV ini tetap utuh
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
