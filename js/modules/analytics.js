/**
 * Analytics & Statistics Module
 * Mengelola kalkulasi pengeluaran, UI Accordion, Chart, CSV, Tracker Dinamis, Smart Grouper,
 * dan fitur Drill-Down (Rincian Item Sub-Kategori).
 */

import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';
import { CategoryManager } from './categories.js';
import { APP_CONFIG } from '../config/constants.js';
import { ref, update } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// === MESIN PENYORTIR PINTAR (GABUNGAN MANUAL + AI) ===
function getParentCategory(catName) {
    const customMap = AuraState.data.settings?.categoryMappings || {};
    if (customMap[catName]) return customMap[catName];

    const n = catName.toLowerCase();
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

window.renderAnalytics = function() {
    const transactions = AuraState.data.transactions || [];
    
    // 1. FILTER WAKTU
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

    if (typeof window.renderDynamicTrackers === 'function') {
        window.renderDynamicTrackers(startDate, endDate);
    }

    let catMap = {}; 
    let merchantMap = {};
    let totalExpense = 0;
    const trend7Days = [0, 0, 0, 0, 0, 0, 0];

    // 2. PROSES DATA TRANSAKSI
    transactions.forEach(trx => {
        if (trx.is_deleted || trx.tipe !== 'pengeluaran') return;
        
        const trxTime = new Date(trx.tanggal || trx.createdAt).getTime();
        const daysDiff = Math.floor((now.getTime() - trxTime) / (1000 * 3600 * 24));
        
        if (daysDiff >= 0 && daysDiff < 7) trend7Days[6 - daysDiff] += (trx.nominal || 0);

        if (trxTime >= startDate && trxTime <= endDate) {
            const safeMerchant = (trx.merchantName || trx.storeName || 'Tidak Diketahui').trim().toUpperCase();
            let trxExpense = 0;

            (trx.items || []).forEach(it => {
                let rawCat = (it.kategori_barang || 'Lainnya').trim();
                let cleanCat = rawCat.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
                let val = (Number(it.harga) || 0) * (Number(it.qty) || 1);
                
                const parentName = getParentCategory(cleanCat);
                const styleInfo = CategoryManager.resolveStyle(parentName);

                if (!catMap[parentName]) {
                    catMap[parentName] = { total: 0, style: styleInfo, subs: {} };
                }

                catMap[parentName].total += val;
                catMap[parentName].subs[cleanCat] = (catMap[parentName].subs[cleanCat] || 0) + val;
                trxExpense += val;
            });

            merchantMap[safeMerchant] = (merchantMap[safeMerchant] || 0) + trxExpense;
            totalExpense += trxExpense;
        }
    });

    // 3. RENDER UI DISTRIBUSI KATEGORI
    const catContainer = document.getElementById('top-categories-list');
    AuraUtils.safeDOM('pie-total-label', el => el.innerText = AuraUtils.formatCurrency(totalExpense));
    
    const sortedParents = Object.keys(catMap).map(k => ({
        name: k, total: catMap[k].total, style: catMap[k].style, subs: catMap[k].subs
    })).sort((a,b) => b.total - a.total);

    AuraUtils.safeDOM('category-pie-chart', el => {
        if (totalExpense > 0 && sortedParents.length > 0) {
            let conicStops = []; let currentAngle = 0;
            for (let i = 0; i < sortedParents.length; i++) {
                let pct = (sortedParents[i].total / totalExpense) * 100; 
                let hex = sortedParents[i].style.hex;
                conicStops.push(`${hex} ${currentAngle}% ${currentAngle + pct}%`); 
                currentAngle += pct;
            }
            el.style.background = `conic-gradient(${conicStops.join(', ')})`;
        } else { el.style.background = `conic-gradient(var(--border-glass) 0% 100%)`; }
    });
    
    if (catContainer) {
        catContainer.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <span class="text-xs font-bold text-[var(--text-muted)]"><i class="fa-solid fa-layer-group mr-1"></i> Hierarki Data</span>
            <button onclick="window.openCategoryMapper()" class="bg-accent/20 border border-accent/50 hover:bg-accent hover:text-black px-3 py-1.5 rounded-lg text-[9px] font-black tracking-wider text-accent transition flex items-center gap-1.5 active:scale-95">
                <i class="fa-solid fa-sliders"></i> ATUR INDUK
            </button>
        </div>`;
        
        if (sortedParents.length === 0) {
            catContainer.innerHTML += '<p class="text-xs text-center text-[var(--text-muted)] py-4">Belum ada pengeluaran di siklus ini.</p>';
        } else {
            sortedParents.forEach((p, idx) => {
                let percent = totalExpense > 0 ? Math.round((p.total / totalExpense) * 100) : 0;
                const sortedSubs = Object.keys(p.subs).map(subK => ({ name: subK, total: p.subs[subK] })).sort((a,b) => b.total - a.total);

                let subsHtml = '';
                const hasSpecificSubs = sortedSubs.some(sub => sub.name !== p.name);

                // --- SUNTIKAN KLIK DRILL-DOWN PADA SUB-KATEGORI ---
                const safeParent = p.name.replace(/'/g, "\\'");

                if (hasSpecificSubs) {
                    sortedSubs.forEach(sub => {
                        const displayName = sub.name === p.name ? `Item Umum ${p.name}` : sub.name;
                        const safeSub = sub.name.replace(/'/g, "\\'");
                        
                        subsHtml += `
                        <div class="flex justify-between items-center px-3 py-2 border-b border-white/5 last:border-0 hover:bg-white/10 transition cursor-pointer active:scale-[0.99] group" onclick="window.openSubCategoryItems('${safeParent}', '${safeSub}')">
                            <span class="text-[10px] text-slate-300 flex items-center gap-2 group-hover:text-white transition">
                                <div class="w-1.5 h-1.5 rounded-full" style="background-color: ${p.style.hex};"></div> 
                                ${displayName}
                            </span>
                            <span class="text-[10px] font-mono font-bold text-slate-300 group-hover:text-white transition flex items-center gap-2">
                                ${AuraUtils.formatCurrency(sub.total)}
                                <i class="fa-solid fa-chevron-right text-[8px] text-[var(--text-muted)] opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"></i>
                            </span>
                        </div>`;
                    });
                } else {
                    subsHtml += `
                    <div class="px-3 py-2 text-[10px] text-[var(--text-muted)] italic text-center cursor-pointer hover:bg-white/10 hover:text-white transition active:scale-[0.99]" onclick="window.openSubCategoryItems('${safeParent}', '${safeParent}')">
                        Seluruhnya adalah item umum ${p.name}. <span class="text-accent underline decoration-accent/50 ml-1">Lihat Rincian</span>
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

    // 4. RENDER TOP MERCHANTS & STATS
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

    const daysElapsed = Math.max(1, Math.ceil((now.getTime() - startDate) / (1000 * 3600 * 24)));
    const totalDays = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 3600 * 24)));
    const dailyAvg = totalExpense / daysElapsed;
    const projected = dailyAvg * totalDays;

    AuraUtils.safeDOM('stats-daily-avg', el => el.innerText = AuraUtils.formatCurrency(dailyAvg));
    AuraUtils.safeDOM('stats-proj-mth', el => el.innerText = AuraUtils.formatCurrency(projected));
    drawCanvasChart(trend7Days);
};

// === FUNGSI BARU: MODAL DRILL-DOWN RINCIAN ITEM ===
window.openSubCategoryItems = function(parentName, subName) {
    let modal = document.getElementById('modal-subcat-items');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-subcat-items';
        modal.className = 'fixed inset-0 bg-black/90 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm transition-all duration-300 opacity-0 hidden';
        document.body.appendChild(modal);
    }

    // Ambil Filter Tanggal Saat Ini (Agar sesuai dengan layar Stats)
    let startDate = 0, endDate = Infinity;
    const now = new Date();
    const mode = AuraState.system.viewMode || 'period';
    
    if (mode === 'period') {
        const y = now.getFullYear(); const m = now.getMonth(); const d = now.getDate();
        if (d >= 16) { startDate = new Date(y, m, 16, 0, 0, 0).getTime(); endDate = new Date(y, m + 1, 15, 23, 59, 59).getTime(); } 
        else { startDate = new Date(y, m - 1, 16, 0, 0, 0).getTime(); endDate = new Date(y, m, 15, 23, 59, 59).getTime(); }
    } else if (mode === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0).getTime(); endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
    }

    const tx = AuraState.data.transactions || [];
    let itemsHtml = '';
    let totalVal = 0;

    // Saring data untuk mencari item yang cocok
    tx.forEach(t => {
        if (t.is_deleted || t.tipe !== 'pengeluaran') return;
        const tTime = new Date(t.tanggal || t.createdAt).getTime();
        
        if (tTime >= startDate && tTime <= endDate) {
            const safeMerchant = (t.merchantName || t.storeName || 'Unknown').trim();
            
            (t.items || []).forEach(it => {
                let rawCat = (it.kategori_barang || 'Lainnya').trim();
                let cleanCat = rawCat.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                const currentParent = getParentCategory(cleanCat);
                
                // Jika Induk dan Sub-nya cocok dengan yang diklik user
                if (currentParent === parentName && cleanCat === subName) {
                    const val = (Number(it.harga) || 0) * (Number(it.qty) || 1);
                    totalVal += val;
                    
                    const tDate = new Date(t.tanggal || t.createdAt);
                    const dateStr = `${tDate.getDate().toString().padStart(2,'0')}/${(tDate.getMonth()+1).toString().padStart(2,'0')}`;

                    itemsHtml += `
                    <div class="flex justify-between items-center p-3 border-b border-[var(--border-glass)] hover:bg-white/5 transition">
                        <div class="flex-1 min-w-0 pr-3">
                            <p class="text-xs font-bold text-white truncate">${AuraUtils.escapeHtml(it.nama_barang || 'Item')}</p>
                            <p class="text-[9px] text-[var(--text-muted)] mt-0.5 truncate"><i class="fa-solid fa-store mr-1"></i>${AuraUtils.escapeHtml(safeMerchant)} • ${dateStr}</p>
                        </div>
                        <div class="text-right shrink-0">
                            <p class="text-xs font-mono font-bold text-accent">${AuraUtils.formatCurrency(val)}</p>
                            <p class="text-[8px] text-[var(--text-muted)] font-mono mt-0.5">${it.qty}x @ ${AuraUtils.formatCurrency(it.harga || 0)}</p>
                        </div>
                    </div>`;
                }
            });
        }
    });

    if (itemsHtml === '') itemsHtml = '<p class="text-xs text-center text-[var(--text-muted)] py-6">Tidak ada rincian item ditemukan.</p>';
    const displayName = subName === parentName ? `Item Umum ${parentName}` : subName;

    modal.innerHTML = `
    <div class="glass-panel w-full sm:w-[400px] h-[85vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden border-t-2 border-accent">
        <div class="flex justify-between items-center p-4 border-b border-[var(--border-glass)] bg-black/40">
            <div>
                <h3 class="font-bold text-sm text-accent"><i class="fa-solid fa-receipt mr-1"></i> Rincian: ${AuraUtils.escapeHtml(displayName)}</h3>
                <p class="text-[9px] text-[var(--text-muted)] mt-0.5 font-mono">Total Akumulasi: ${AuraUtils.formatCurrency(totalVal)}</p>
            </div>
            <button onclick="document.getElementById('modal-subcat-items').classList.add('opacity-0'); setTimeout(() => document.getElementById('modal-subcat-items').classList.add('hidden'), 300);" class="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 rounded-full transition active:scale-90 text-[var(--text-muted)]">
                <i class="fa-solid fa-xmark text-sm"></i>
            </button>
        </div>
        <div class="flex-1 overflow-y-auto p-0 space-y-0 relative hide-scrollbar bg-black/20">
            ${itemsHtml}
        </div>
    </div>`;

    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.remove('opacity-0'));
};


window.renderDynamicTrackers = function(startDate, endDate) {
    let container = document.getElementById('staples-container');
    if (!container) {
        const headers = document.querySelectorAll('h4, h3');
        for (let el of headers) {
            if (el.innerText.toUpperCase().includes('KEBUTUHAN POKOK')) {
                container = el.nextElementSibling; break;
            }
        }
    }
    
    if (!container) return; 

    const trackers = AuraState.data.settings?.staplesTrackers || {};
    const entries = Object.entries(trackers);
    
    if (entries.length === 0) {
        container.innerHTML = '<p class="text-[10px] text-[var(--text-muted)] text-center w-full py-4 bg-black/20 rounded-xl">Belum ada Tracker Dinamis yang aktif. Tambahkan di Pengaturan.</p>';
        container.className = "mt-3";
        return;
    }

    const tx = AuraState.data.transactions || [];
    const totals = {};
    entries.forEach(([id, t]) => totals[id] = 0);

    tx.forEach(t => {
        if (t.is_deleted || t.tipe !== 'pengeluaran') return;
        const tTime = new Date(t.tanggal || t.createdAt).getTime();
        if (tTime >= startDate && tTime <= endDate) {
            (t.items || []).forEach(it => {
                const itemName = (it.nama_barang || '').toLowerCase();
                const itemCat = (it.kategori_barang || '').toLowerCase();
                const val = (Number(it.harga) || 0) * (Number(it.qty) || 1);
                
                entries.forEach(([id, tracker]) => {
                    const match = tracker.keywords.some(kw => itemName.includes(kw) || itemCat.includes(kw));
                    if (match) totals[id] += val;
                });
            });
        }
    });

    let html = '';
    entries.forEach(([id, tracker]) => {
        let icon = 'fa-box-open'; let color = 'text-amber-400';
        const nameLower = tracker.name.toLowerCase();
        
        if (nameLower.match(/sayur|buah|segar|tani/)) { icon = 'fa-carrot'; color = 'text-emerald-400'; }
        else if (nameLower.match(/kopi|minum|cafe|kafe|boba/)) { icon = 'fa-mug-hot'; color = 'text-amber-600'; }
        else if (nameLower.match(/listrik|token|pln/)) { icon = 'fa-bolt'; color = 'text-yellow-400'; }
        else if (nameLower.match(/air|pdam/)) { icon = 'fa-droplet'; color = 'text-blue-400'; }
        else if (nameLower.match(/kucing|anjing|anabul|hewan/)) { icon = 'fa-cat'; color = 'text-orange-400'; }
        else if (nameLower.match(/skincare|wajah|cantik|makeup/)) { icon = 'fa-spa'; color = 'text-pink-400'; }
        else if (nameLower.match(/beras|nasi|pokok/)) { icon = 'fa-bowl-rice'; color = 'text-amber-200'; }
        else if (nameLower.match(/minyak|goreng/)) { icon = 'fa-bottle-droplet'; color = 'text-yellow-500'; }
        else if (nameLower.match(/sabun|mandi|cuci/)) { icon = 'fa-pump-soap'; color = 'text-sky-300'; }
        else if (nameLower.match(/rokok|cigar/)) { icon = 'fa-smoking'; color = 'text-slate-400'; }
        else if (nameLower.match(/bensin|bbm|pertamina/)) { icon = 'fa-gas-pump'; color = 'text-rose-400'; }

        html += `
        <div class="bg-black/30 p-3 rounded-xl min-w-[100px] flex-1 flex flex-col items-center justify-center text-center border border-[var(--border-glass)] border-t-2 shadow-lg" style="border-top-color: currentColor; color: inherit;">
            <i class="fa-solid ${icon} ${color} text-xl mb-2"></i>
            <span class="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 truncate w-full px-1">${AuraUtils.escapeHtml(tracker.name)}</span>
            <span class="font-mono font-bold text-sm text-white">${AuraUtils.formatCurrency(totals[id])}</span>
        </div>`;
    });

    container.className = "flex gap-3 overflow-x-auto hide-scrollbar snap-x mt-3 pb-2";
    container.innerHTML = html;
};

// === FUNGSI MANAJER KATEGORI ===
window.openCategoryMapper = function() {
    let modal = document.getElementById('modal-category-mapper');
    if (!modal) {
        modal = document.createElement('div'); modal.id = 'modal-category-mapper';
        modal.className = 'fixed inset-0 bg-black/90 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm transition-all duration-300 opacity-0 hidden';
        document.body.appendChild(modal);
    }

    const tx = AuraState.data.transactions || [];
    const uniqueSubs = new Set();
    tx.forEach(t => {
        if(t.is_deleted || t.tipe !== 'pengeluaran') return;
        (t.items || []).forEach(it => {
            let cleanCat = (it.kategori_barang || 'Lainnya').trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            uniqueSubs.add(cleanCat);
        });
    });

    const parentOptions = [ 'Makanan', 'Minuman', 'Elektronik', 'Bahan Pokok', 'Peralatan Rumah Tangga', 'Transportasi', 'Pakaian', 'Kesehatan', 'Pendidikan', 'Hiburan', 'Lainnya' ];
    let listHtml = '';
    
    Array.from(uniqueSubs).sort().forEach(sub => {
        const currentParent = getParentCategory(sub);
        let opts = parentOptions.map(p => `<option value="${p}" ${p === currentParent ? 'selected' : ''}>${p}</option>`).join('');
        listHtml += `
        <div class="flex justify-between items-center bg-black/30 p-2.5 border-b border-[var(--border-glass)] group hover:bg-white/5 transition">
            <span class="text-xs font-bold text-slate-200 group-hover:text-accent truncate pr-2">${sub}</span>
            <select class="bg-black/60 border border-[var(--border-glass)] text-[10px] rounded p-1.5 outline-none focus:border-accent text-[var(--text-muted)] cursor-pointer" onchange="window.updateCategoryMapping('${sub}', this.value)">
                ${opts}
            </select>
        </div>`;
    });

    if (listHtml === '') listHtml = '<p class="text-xs text-center text-[var(--text-muted)] py-4">Belum ada data sub-kategori.</p>';

    modal.innerHTML = `
    <div class="glass-panel w-full sm:w-[400px] h-[85vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden border-t-2 border-accent">
        <div class="flex justify-between items-center p-4 border-b border-[var(--border-glass)] bg-black/40">
            <div>
                <h3 class="font-bold text-sm text-accent"><i class="fa-solid fa-folder-tree mr-1"></i> Manajer Hierarki</h3>
                <p class="text-[9px] text-[var(--text-muted)] mt-0.5">Pindahkan item salah alamat ke Induk yang benar.</p>
            </div>
            <button onclick="window.closeCategoryMapper()" class="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 rounded-full transition active:scale-90 text-[var(--text-muted)]">
                <i class="fa-solid fa-xmark text-sm"></i>
            </button>
        </div>
        <div class="flex-1 overflow-y-auto p-2 space-y-1 relative hide-scrollbar">${listHtml}</div>
    </div>`;

    modal.classList.remove('hidden'); requestAnimationFrame(() => modal.classList.remove('opacity-0'));
};

window.closeCategoryMapper = function() {
    const modal = document.getElementById('modal-category-mapper');
    if (modal) { modal.classList.add('opacity-0'); setTimeout(() => modal.classList.add('hidden'), 300); }
};

window.updateCategoryMapping = async function(subCat, newParent) {
    if (!AuraState.user.uid) return;
    const updates = {};
    updates[`${APP_CONFIG.LEDGER_NODE}/${AuraState.user.uid}/settings/categoryMappings/${subCat}`] = newParent;
    try {
        await update(ref(AuraState.instances.db), updates);
        if (window.showToast) window.showToast(`Sukses: ${subCat} dipindahkan ke ${newParent}`);
        window.renderAnalytics();
    } catch(e) { if (window.showToast) window.showToast("Gagal menyimpan mapping ke server.", true); }
};

// === FUNGSI CHART & EXPORT ===
function drawCanvasChart(dataArray) {
    const canvas = document.getElementById('canvas-7days');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.offsetWidth || 350; const height = canvas.offsetHeight || 150;
    canvas.width = width * 2; canvas.height = height * 2; ctx.scale(2, 2); ctx.clearRect(0, 0, width, height);
    const maxVal = Math.max(...dataArray, 100); const padding = 15;
    const barWidth = (width - padding * 2) / 7 - 10;

    dataArray.forEach((val, i) => {
        const barHeight = (val / maxVal) * (height - padding * 2.5);
        const x = padding + i * (barWidth + 10); const y = height - padding - barHeight;
        ctx.fillStyle = '#f43f5e'; ctx.globalAlpha = i === 6 ? 1.0 : 0.4;
        if (typeof ctx.roundRect === 'function') { ctx.beginPath(); ctx.roundRect(x, y, barWidth, barHeight, 6); ctx.fill(); } 
        else { ctx.fillRect(x, y, barWidth, barHeight); }
        if (val > 0) {
            ctx.globalAlpha = 1.0; ctx.fillStyle = '#9ca3af'; ctx.font = "bold 9px 'Space Grotesk', monospace"; ctx.textAlign = "center";
            const rate = AuraState.system.displayCurrency === 'IDR' ? (AuraState.system.exchangeRate || 105) : 1;
            const convertedVal = val * rate;
            const displayStr = AuraState.system.displayCurrency === 'IDR' ? (convertedVal / 1000).toFixed(0) + 'k' : (convertedVal / 1000).toFixed(1) + 'k';
            ctx.fillText(displayStr, x + barWidth / 2, y - 5);
        }
    });
}

window.downloadCSV = function() {
    const transactions = AuraState.data.transactions || [];
    if (transactions.length === 0) { if (window.showToast) window.showToast("Tidak ada data untuk diunduh.", true); return; }
    let csvContent = "TANGGAL,WAKTU,TIPE,METODE,MATA_UANG,MERCHANT,ITEM,KATEGORI,HARGA_SATUAN,QTY,TOTAL_BARANG\n";
    transactions.forEach(trx => {
        if (trx.is_deleted) return;
        const dateObj = new Date(trx.tanggal || trx.createdAt);
        const dateStr = dateObj.toLocaleDateString('id-ID'); const timeStr = dateObj.toLocaleTimeString('id-ID');
        const safeMerchant = `"${(trx.merchantName || trx.storeName || 'Unknown').replace(/"/g, '""')}"`;
        (trx.items || []).forEach(it => {
            const safeItemName = `"${(it.nama_barang || 'Item').replace(/"/g, '""')}"`;
            const safeCat = `"${(it.kategori_barang || 'Lainnya').replace(/"/g, '""')}"`;
            const harga = Number(it.harga) || 0; const qty = Number(it.qty) || 1; const subtotal = harga * qty;
            csvContent += `${dateStr},${timeStr},${trx.tipe.toUpperCase()},${trx.metode_pembayaran},${trx.mata_uang},${safeMerchant},${safeItemName},${safeCat},${harga},${qty},${subtotal}\n`;
        });
    });
    const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
    const link = document.createElement("a"); link.setAttribute("href", encodedUri);
    link.setAttribute("download", `AuraFi_Export_${new Date().getTime()}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    if (window.showToast) window.showToast("Data CSV berhasil diunduh!");
};
