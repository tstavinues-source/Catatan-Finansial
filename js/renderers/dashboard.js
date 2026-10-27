/**
 * Super Render Engine [V3 - MULTI-WALLET & GHOST WEALTH FILTER]
 * (FIX: Global Analytics Interceptor & Nuklir Basmi Hantu)
 */
import { Logger } from '../core/logger.js';
import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';
import { APP_CONFIG } from '../config/constants.js';
import { CategoryManager } from '../modules/categories.js';

// ============================================================================
// 💥 TOMBOL NUKLIR (Ketik window.BasmiHantuMutasi() di Eruda Console)
// ============================================================================
window.BasmiHantuMutasi = function() {
    if (!AuraState || !AuraState.data) {
        console.error("Sistem belum siap. Tunggu 5 detik lalu coba lagi.");
        return;
    }
    const txs = [...(AuraState.data.transactions || []), ...(AuraState.data.trash || [])];
    let count = 0;
    
    console.log("🕵️‍♂️ MEMULAI OPERASI PEMUSNAHAN HANTU MUTASI...");
    
    txs.forEach(t => {
        const name = (t.merchantName || t.storeName || "").toLowerCase();
        // Cari semua transaksi yang mengandung kata mutasi, hirogin, atau rekening lawas
        if (name.includes('mutasi') || name.includes('hirogin') || name.includes('rekening lawas')) {
            console.log("💥 Menembak target:", t.merchantName);
            if(window.deleteForever) {
                window.deleteForever(t.id);
                count++;
            }
        }
    });
    
    if (count > 0) {
        console.log(`✅ BERHASIL! ${count} data hantu dimusnahkan.`);
        console.log("🔄 SILAKAN REFRESH HALAMAN BROWSER ANDA SEKARANG!");
        if (window.showToast) window.showToast(`${count} Data Hantu Berhasil Dimusnahkan!`, false);
    } else {
        console.log("✅ Aman! Tidak ada data hantu ditemukan.");
    }
};

window.renderRecurringUIForBudget = function() {
    AuraUtils.safeDOM('budget-bills-container', function(el) {
        const rPayments = AuraState.data.settings?.recurringPayments || {};
        const entries = Object.entries(rPayments);
        
        if (entries.length === 0) {
            el.innerHTML = '<p class="text-[10px] text-[var(--text-muted)] text-center my-2 p-3 bg-black/20 rounded-xl">Konfigurasi Tagihan Kosong.</p>';
            return;
        }
        
        let compiledBudgets = '';
        entries.forEach(([id, rp]) => {
            const convertedAmt = AuraUtils.convertCurrency(rp.amount || 0, rp.currency || 'JPY');
            const formattedMoney = window.formatAuraCurrency(convertedAmt);
            
            compiledBudgets += `
            <div class="glass-panel p-3 flex justify-between items-center border-l-2 border-l-sky-400 group">
                <div>
                    <h4 class="font-bold text-xs text-sky-400 flex items-center gap-2">
                        ${AuraUtils.escapeHtml(rp.name)} 
                        <button onclick="window.removeRecurringPayment('${id}')" class="text-rose-500 hover:text-rose-400 transition opacity-0 group-hover:opacity-100">
                            <i class="fa-solid fa-trash text-[10px]"></i>
                        </button>
                    </h4>
                    <p class="text-[9px] text-[var(--text-muted)] font-mono uppercase mt-0.5">
                        Tgl Eksekusi: ${rp.date} / Bulan
                    </p>
                </div>
                <p class="font-bold text-sm font-mono text-[var(--text-main)]">
                    ${formattedMoney}
                </p>
            </div>`;
        });
        
        el.innerHTML = compiledBudgets;
    });
};

window.reCalculateAll = function() {
    const allTx = AuraState.data.transactions || [];
    const wallets = AuraState.data.wallets || {};
    const today = new Date();
    
    let walletBalances = {};
    Object.keys(wallets).forEach(wId => {
        walletBalances[wId] = 0; 
    });

    let legacyCash = 0;
    let legacyCashless = 0;

    for (let i = 0; i < allTx.length; i++) {
        const trx = allTx[i];
        const val = AuraUtils.convertCurrency(trx.nominal || 0, trx.mata_uang || 'JPY'); 
        const feeVal = AuraUtils.convertCurrency(Number(trx.admin_fee || 0), trx.mata_uang || 'JPY');
        const wId = trx.wallet_id;
        const isLegacyCash = (trx.metode_pembayaran === 'tunai');

        if (trx.tipe === 'pemasukan' || trx.tipe === 'mutasi_masuk') {
            if (wId && walletBalances[wId] !== undefined) walletBalances[wId] += val;
            else { if (isLegacyCash) legacyCash += val; else legacyCashless += val; }
        } else if (trx.tipe === 'pengeluaran' || trx.tipe === 'mutasi_keluar') {
            if (wId && walletBalances[wId] !== undefined) walletBalances[wId] -= val;
            else { if (isLegacyCash) legacyCash -= val; else legacyCashless -= val; }
        } else if (trx.tipe === 'tarik_tunai') {
            if (wId && walletBalances[wId] !== undefined) walletBalances[wId] -= (val + feeVal);
            else legacyCashless -= (val + feeVal);
            legacyCash += val; 
        } else if (trx.tipe === 'setor_tunai') {
            if (wId && walletBalances[wId] !== undefined) walletBalances[wId] -= (val + feeVal);
            else legacyCash -= (val + feeVal);
            legacyCashless += val; 
        } else if (trx.tipe === 'nabung') {
            // PERBAIKAN: sebelumnya tipe 'nabung' (setor ke misi tabungan, lihat
            // goals.js) tidak punya cabang sama sekali di sini, jadi tidak pernah
            // memotong saldo dompet manapun — padahal komentar desainnya sendiri
            // bilang "MENABUNG MEMOTONG SALDO". Akibatnya uang yang disetor ke
            // goal terhitung DUA KALI: tetap ada di saldo dompet, DAN ikut masuk
            // ke savedAmount goal — Net Worth jadi lebih besar dari kenyataan.
            if (wId && walletBalances[wId] !== undefined) walletBalances[wId] -= val;
            else { if (isLegacyCash) legacyCash -= val; else legacyCashless -= val; }
        }
    }

    let totalCashBal = legacyCash;
    let totalCashlessBal = legacyCashless;
    let totalActiveWealth = legacyCash + legacyCashless;

    let breakdownCashHtml = '';
    if (legacyCash !== 0) {
        breakdownCashHtml += `
        <div class="flex justify-between w-full text-[9px] mt-2 opacity-50 border-b border-white/10 pb-0.5">
            <span class="truncate pr-1">Dana Fisik Lawas</span>
            <span>${window.formatAuraCurrencyCompact(legacyCash)}</span>
        </div>`;
    }

    let breakdownCashlessHtml = '';
    if (legacyCashless !== 0) {
        breakdownCashlessHtml += `
        <div class="flex justify-between w-full text-[9px] mt-2 opacity-50 border-b border-white/10 pb-0.5">
            <span class="truncate pr-1">Rekening Lawas</span>
            <span>${window.formatAuraCurrencyCompact(legacyCashless)}</span>
        </div>`;
    }

    Object.keys(wallets).forEach(wId => {
        const w = wallets[wId];
        const bal = walletBalances[wId];
        const isHidden = w.is_hidden;

        const hiddenStyle = isHidden ? 'opacity-40 line-through text-rose-400' : 'text-white';
        const iconEye = isHidden ? '<i class="fa-solid fa-eye-slash ml-1 text-[8px] text-rose-500"></i>' : '';
        
        const lineHtml = `
        <div class="flex justify-between w-full text-[10px] mt-2 border-b border-white/5 pb-1 font-sans font-medium transition-all ${hiddenStyle}">
            <span class="truncate pr-1">${AuraUtils.escapeHtml(w.name)} ${iconEye}</span>
            <span class="font-mono font-bold">${window.formatAuraCurrencyCompact(bal)}</span>
        </div>`;

        if (w.type === 'cashless') {
            totalCashlessBal += bal;
            breakdownCashlessHtml += lineHtml;
        } else {
            totalCashBal += bal;
            breakdownCashHtml += lineHtml;
        }

        if (!isHidden) {
            totalActiveWealth += bal;
        }
    });

    const periodRange = AuraUtils.getPeriodRange();
    const fSearch = (AuraState.filters && AuraState.filters.search) ? AuraState.filters.search.toLowerCase() : "";
    const fCat = (AuraState.filters && AuraState.filters.category) ? AuraState.filters.category : "ALL";
    const fUser = (AuraState.filters && AuraState.filters.user) ? AuraState.filters.user : "ALL";
    
    let periodSpent = 0, periodIncome = 0;
    let periodPersonal = 0, periodObligation = 0;
    let groupedTrx = {};
    let filteredTx = [];
    
    for (let i = 0; i < allTx.length; i++) {
        const trx = allTx[i];
        const safeDateRaw = trx.tanggal || trx.createdAt || new Date().toISOString();
        const trxTime = new Date(safeDateRaw).getTime();
        
        if (trxTime < periodRange.start || trxTime > periodRange.end) continue;
        
        if (fSearch) {
            const desc = (trx.description || trx.catatan_ai || "").toLowerCase();
            const merch = (trx.merchantName || trx.storeName || "").toLowerCase();
            let hasItemMatch = false;
            if (trx.items && Array.isArray(trx.items)) {
                for (let j = 0; j < trx.items.length; j++) { 
                    if (trx.items[j].nama_barang && trx.items[j].nama_barang.toLowerCase().includes(fSearch)) { 
                        hasItemMatch = true; 
                        break; 
                    } 
                }
            }
            if (!desc.includes(fSearch) && !merch.includes(fSearch) && !hasItemMatch) continue;
        }
        
        if (fCat !== 'ALL') {
            const mainCatMatch = (trx.kategori === fCat);
            let itemCatMatch = false;
            if (trx.items && Array.isArray(trx.items)) {
                for (let j = 0; j < trx.items.length; j++) { 
                    if (trx.items[j].kategori_barang === fCat) { 
                        itemCatMatch = true; 
                        break; 
                    } 
                }
            }
            if (!mainCatMatch && !itemCatMatch) continue;
        }
        
        if (fUser !== 'ALL') { 
            if (trx.user_id && trx.user_id !== fUser) continue;
        }
        
        filteredTx.push(trx);
    }

    for (let i = 0; i < filteredTx.length; i++) {
        const trx = filteredTx[i];
        const val = AuraUtils.convertCurrency(trx.nominal || 0, trx.mata_uang || 'JPY'); 
        
        let dStrRaw = trx.tanggal || trx.createdAt || new Date().toISOString();
        const dStr = dStrRaw.includes('T') ? dStrRaw.split('T')[0] : dStrRaw;
        const timeFormatted = AuraUtils.formatDateToReadable(dStrRaw);
        
        const wId = trx.wallet_id;
        const isHiddenTrx = wId && wallets[wId] && wallets[wId].is_hidden;

        if (!groupedTrx[dStr]) {
            groupedTrx[dStr] = { total: 0, items: [] };
        }

        if (trx.tipe === 'pemasukan') {
            if (!isHiddenTrx) periodIncome += val;
            groupedTrx[dStr].total += val;
        } else if (trx.tipe === 'pengeluaran' || trx.tipe === 'tarik_tunai' || trx.tipe === 'setor_tunai' || trx.tipe === 'nabung') {
            let actualSpend = val;
            if (trx.tipe === 'tarik_tunai' || trx.tipe === 'setor_tunai') {
                actualSpend = AuraUtils.convertCurrency(Number(trx.admin_fee || 0), trx.mata_uang || 'JPY');
            } else if (trx.tipe === 'nabung') {
                actualSpend = 0; 
            }
            
            if (!isHiddenTrx) {
                periodSpent += actualSpend;
            }
            if (trx.tipe === 'pengeluaran' && !isHiddenTrx) {
                // Rincian kelompok dihitung per ITEM agar kewajiban (istri, pajak,
                // nenkin, asuransi, apato, utilitas) terpisah dari pribadi.
                if (trx.items && trx.items.length > 0) {
                    for (let j = 0; j < trx.items.length; j++) {
                        const it = trx.items[j];
                        const itemVal = AuraUtils.convertCurrency((Number(it.harga) || 0) * (Number(it.qty) || 1), trx.mata_uang || 'JPY');
                        const kel = it.kelompok || (typeof window.inferKelompokItem === 'function' ? window.inferKelompokItem(it.kategori_barang, trx.tipe) : 'Pribadi');
                        if (kel === 'Kewajiban Terpisah') periodObligation += itemVal; else periodPersonal += itemVal;
                    }
                } else {
                    const kel = typeof window.inferKelompokItem === 'function' ? window.inferKelompokItem(trx.kategori, trx.tipe) : 'Pribadi';
                    if (kel === 'Kewajiban Terpisah') periodObligation += val; else periodPersonal += val;
                }
            }
            groupedTrx[dStr].total -= actualSpend; 
        } else if (trx.tipe === 'mutasi_masuk') {
            groupedTrx[dStr].total += val;
        } else if (trx.tipe === 'mutasi_keluar') {
            groupedTrx[dStr].total -= val;
        }
        
        trx.displayTime = timeFormatted;
        groupedTrx[dStr].items.push(trx);
    }

    let totalBrankas = 0;
    const glListForBrankas = AuraState.data.goals || [];
    for (let i = 0; i < glListForBrankas.length; i++) {
        const g = glListForBrankas[i];
        totalBrankas += AuraUtils.convertCurrency(g.savedAmount || 0, g.currency || 'JPY');
    }

    AuraUtils.safeDOM('dash-total-balance', el => el.innerText = window.formatAuraCurrencyCompact(totalActiveWealth));
    AuraUtils.safeDOM('dash-savings', el => el.innerText = window.formatAuraCurrencyCompact(totalBrankas)); 
    AuraUtils.safeDOM('dash-income-mth', el => el.innerText = '+' + window.formatAuraCurrencyCompact(periodIncome));
    AuraUtils.safeDOM('dash-expense-mth', el => el.innerText = '-' + window.formatAuraCurrencyCompact(periodSpent));
    AuraUtils.safeDOM('dash-personal-mth', el => el.innerText = '-' + window.formatAuraCurrencyCompact(periodPersonal));
    AuraUtils.safeDOM('dash-obligation-mth', el => el.innerText = window.formatAuraCurrencyCompact(periodObligation));

    AuraUtils.safeDOM('dash-cash', el => {
        el.innerHTML = `
            ${window.formatAuraCurrencyCompact(totalCashBal)}
            <div id="breakdown-cash" class="mt-3 w-full text-left bg-black/40 rounded-xl p-2.5 border border-[var(--border-glass)] shadow-inner hidden transition-all max-h-40 overflow-y-auto no-scrollbar">
                ${breakdownCashHtml || '<span class="text-[8px] text-gray-500 block text-center mt-1">Kosong</span>'}
            </div>
        `;
        el.parentElement.classList.add('cursor-pointer');
        el.parentElement.onclick = function() {
            document.getElementById('breakdown-cash').classList.toggle('hidden');
        };
    });

    AuraUtils.safeDOM('dash-cashless', el => {
        el.innerHTML = `
            ${window.formatAuraCurrencyCompact(totalCashlessBal)}
            <div id="breakdown-cashless" class="mt-3 w-full text-left bg-black/40 rounded-xl p-2.5 border border-[var(--border-glass)] shadow-inner hidden transition-all max-h-40 overflow-y-auto no-scrollbar">
                ${breakdownCashlessHtml || '<span class="text-[8px] text-gray-500 block text-center mt-1">Kosong</span>'}
            </div>
        `;
        el.parentElement.classList.add('cursor-pointer');
        el.parentElement.onclick = function() {
            document.getElementById('breakdown-cashless').classList.toggle('hidden');
        };
    });

    const limitVal = AuraUtils.convertCurrency(AuraState.data.monthlyBudget || 0, 'JPY');
    const burnPct = limitVal > 0 ? (periodSpent / limitVal) * 100 : 0;
    const remainingBudget = limitVal - periodSpent;
    
    AuraUtils.safeDOM('living-core', el => el.className = `w-full h-44 living-core ${burnPct > 90 ? 'danger' : ''} flex flex-col items-center justify-center relative overflow-hidden cursor-pointer rounded-[1.5rem]`);
    AuraUtils.safeDOM('burn-progress', el => { 
        el.style.width = `${Math.min(burnPct, 100)}%`; 
        el.style.backgroundColor = burnPct > 90 ? 'var(--color-expense)' : 'var(--color-income)'; 
    });
    AuraUtils.safeDOM('burn-spent', el => el.innerText = `Terpakai: ${window.formatAuraCurrencyCompact(periodSpent)}`);
    AuraUtils.safeDOM('burn-limit', el => el.innerText = `Limit: ${window.formatAuraCurrencyCompact(limitVal)}`);
    
    if (burnPct > 90 && !AuraState.system.hasShownBudgetAlert) {
        AuraState.system.hasShownBudgetAlert = true;
        if (typeof window.showToast === 'function') window.showToast("PERINGATAN: Limit Anggaran Anda telah mencapai lebih dari 90%!", true);
    }

    const msInDay = 1000 * 60 * 60 * 24;
    const daysInPeriod = Math.max(1, Math.ceil((periodRange.end - periodRange.start) / msInDay));
    const daysPassed = Math.max(1, Math.ceil((today.getTime() - periodRange.start) / msInDay));
    const daysLeft = Math.max(0, daysInPeriod - daysPassed);
    const periodPct = Math.min((daysPassed / daysInPeriod) * 100, 100);
    
    AuraUtils.safeDOM('burn-insight-box', el => {
        if (periodSpent > limitVal && limitVal > 0) { 
            el.innerHTML = `<span class="text-[var(--color-expense)] font-bold"><i class="fa-solid fa-triangle-exclamation"></i> KEDARURATAN KAS:</span> Limit telah terlampaui. Pengereman ekstrim disarankan!`; 
            el.style.borderColor = 'var(--color-expense)'; 
        } else { 
            el.innerHTML = `<span class="text-[var(--color-income)] font-bold"><i class="fa-solid fa-circle-check"></i> AMAN TERKENDALI:</span> Pola stabil.<br><span class="text-[9px] mt-1 text-[var(--text-muted)]">Sisa aman siklus ini: ${window.formatAuraCurrency(remainingBudget)}</span>`; 
            el.style.borderColor = 'var(--border-glass)'; 
        }
    });
    
    AuraUtils.safeDOM('period-progress-bar', el => el.style.width = `${periodPct}%`);
    AuraUtils.safeDOM('period-progress-text', el => el.innerText = `PROGRES SIKLUS: ${periodPct.toFixed(0)}%`);
    AuraUtils.safeDOM('period-days-left', el => el.innerText = `${daysLeft} HARI TERSISA`);

    AuraUtils.safeDOM('trx-list-container', el => {
        const groupedKeys = Object.keys(groupedTrx).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        
        if (groupedKeys.length === 0) { 
            el.innerHTML = '<p class="text-center text-[var(--text-muted)] mt-10">Ruang transaksi kosong.</p>'; 
            return; 
        }
        
        let compiledTrxHtml = '';
        for (let i = 0; i < groupedKeys.length; i++) {
            const dateStr = groupedKeys[i]; 
            const g = groupedTrx[dateStr]; 
            const dObj = new Date(dateStr);
            const dateDisplay = !isNaN(dObj.getTime()) ? dObj.getDate().toString().padStart(2,'0') : '--';
            const dayDisplay = !isNaN(dObj.getTime()) ? dObj.toLocaleDateString('id-ID', {weekday:'short'}) : '---';
            const totalPrefix = g.total >= 0 ? '+' : ''; 
            const totalColor = g.total >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--text-main)]';
            
            let itemHtmlBuilder = '';
            for (let j = 0; j < g.items.length; j++) {
                const t = g.items[j];
                let expandedReceiptsState = AuraState.temp.expandedReceipts || {};
                const isExp = expandedReceiptsState[t.id]; 
                
                const hasItems = t.items && Array.isArray(t.items) && t.items.length > 0;
                const catStyle = CategoryManager.resolveStyle(t.kategori || 'Lainnya');
                
                let iconHtml = `<i class="fa-solid ${catStyle.icon}" style="color: ${catStyle.hex}"></i>`;
                let colorClass = 'text-[var(--text-main)]';
                let signChar = '-';
                
                if (t.tipe === 'pemasukan') { 
                    iconHtml = '<i class="fa-solid fa-arrow-turn-up text-[var(--color-income)]"></i>';
                    colorClass = 'text-[var(--color-income)]'; 
                    signChar = '+'; 
                } else if (t.tipe === 'mutasi_masuk') { 
                    iconHtml = '<i class="fa-solid fa-arrow-right-to-bracket text-indigo-400"></i>';
                    colorClass = 'text-indigo-400'; 
                    signChar = '+'; 
                } else if (t.tipe === 'mutasi_keluar') { 
                    iconHtml = '<i class="fa-solid fa-arrow-right-from-bracket text-indigo-400"></i>';
                    colorClass = 'text-indigo-400'; 
                    signChar = '-'; 
                } else if (t.tipe === 'tarik_tunai' || t.tipe === 'setor_tunai') { 
                    iconHtml = '<i class="fa-solid fa-money-bill-transfer text-[#38bdf8]"></i>';
                    colorClass = 'text-[#38bdf8]'; 
                    signChar = '⇄'; 
                } else if (t.tipe === 'nabung') {
                    iconHtml = '<i class="fa-solid fa-piggy-bank text-emerald-400"></i>';
                    colorClass = 'text-emerald-400'; 
                    signChar = '🔒'; 
                }
                
                const titleDisp = AuraUtils.escapeHtml(t.merchantName || t.storeName || t.kategori);
                const descDisp = AuraUtils.escapeHtml(t.description || t.catatan_ai || "");
                
                const walletName = t.wallet_id && wallets[t.wallet_id] ? wallets[t.wallet_id].name : t.metode_pembayaran;
                const metIcon = (t.metode_pembayaran === 'tunai' || wallets[t.wallet_id]?.type === 'tunai') ?
                '<i class="fa-solid fa-money-bill"></i>' : '<i class="fa-regular fa-credit-card"></i>';
                
                let innerReceiptHtml = '';
                if (hasItems) {
                    let receiptLines = '';
                    for (let k = 0; k < t.items.length; k++) {
                        const it = t.items[k];
                        const safeItemId = it.itemId || 'no_id_fallback'; 
                        const itCatHex = CategoryManager.resolveStyle(it.kategori_barang).hex;
                        const taxBadge = it.tax_rate ?
                        `<span class="text-[8px] bg-sky-950/40 text-sky-400 px-1 rounded font-mono border border-sky-900">${it.tax_rate}%</span>` : '';
                        
                        const totalItemHarga = AuraUtils.convertCurrency(it.harga * (it.qty || 1), t.mata_uang || 'JPY');
                        
                        receiptLines += `
                        <div class="flex justify-between items-center text-xs bg-white/5 p-2 rounded-xl group/it">
                            <div class="flex-1 truncate">
                                <span class="text-[var(--text-main)] font-medium mr-1">${AuraUtils.escapeHtml(it.nama_barang)}</span>
                                <span class="text-[8px] px-1.5 py-0.5 rounded font-bold mr-1" style="background-color: ${itCatHex}20; color: ${itCatHex};">${it.kategori_barang || 'Lainnya'}</span>
                                <span class="text-[9px] text-[var(--text-muted)] font-mono font-bold">x${it.qty}</span> 
                                ${taxBadge}
                            </div>
                            <span class="font-mono text-[var(--text-muted)] text-[11px] mr-2">${window.formatAuraCurrency(totalItemHarga)}</span>
                            <div class="flex gap-2 opacity-100 md:opacity-0 group-hover/it:opacity-100">
                                <button onclick="window.openEditItem('${t.id}', '${safeItemId}')" class="text-accent p-1 text-xs"><i class="fa-solid fa-pen"></i></button>
                                <button onclick="window.confirmDelItem('${t.id}', '${safeItemId}')" class="text-[var(--color-expense)] p-1 text-xs"><i class="fa-solid fa-xmark"></i></button>
                            </div>
                        </div>`;
                    }
                    innerReceiptHtml = `
                    <div class="mt-2.5 pt-2 border-t border-[var(--border-glass)]">
                        <div class="flex justify-between items-center">
                            <button onclick="window.toggleExpandedReceipt('${t.id}')" class="flex-1 text-left text-[9px] text-[var(--text-muted)] font-black uppercase tracking-wider py-1.5">
                                <span><i class="fa-solid fa-list mr-1"></i> ${t.items.length} Barang</span> 
                                <i class="fa-solid fa-chevron-${isExp ? 'up' : 'down'} ml-1"></i>
                            </button>
                            <button onclick="window.openAddItemModal('${t.id}')" class="bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-md text-[8px] font-bold text-white transition">+ ITEM BARU</button>
                        </div>
                        <div class="${isExp ? 'block' : 'hidden'} mt-2 space-y-1.5">
                            ${receiptLines}
                        </div>
                    </div>`;
                } else {
                    innerReceiptHtml = `
                    <div class="mt-2.5 pt-2 border-t border-[var(--border-glass)]">
                        <button onclick="window.openAddItemModal('${t.id}')" class="bg-white/5 border border-[var(--border-glass)] w-full py-1.5 rounded-md text-[9px] font-bold text-[var(--text-muted)] hover:text-white transition">+ SUNTIKKAN ITEM BARU</button>
                    </div>`;
                }
                
                const valTrx = AuraUtils.convertCurrency(t.nominal || 0, t.mata_uang || 'JPY');
                itemHtmlBuilder += `
                <div class="glass-panel p-4 relative group">
                    <button onclick="window.openEditTrxModal('${t.id}')" class="absolute top-3 right-12 text-[var(--text-muted)] hover:text-accent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 active:scale-90 p-2 text-sm transition bg-black/60 rounded-full shadow-lg z-10"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="window.confirmDelTrx('${t.id}')" class="absolute top-3 right-3 text-[var(--text-muted)] hover:text-[var(--color-expense)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 active:scale-90 p-2 text-sm transition bg-black/60 rounded-full shadow-lg z-10"><i class="fa-solid fa-trash"></i></button>
                    <div class="flex justify-between items-start mb-2 pr-20">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 icon-chip shrink-0" style="background-color: ${catStyle.hex}15;">
                                ${iconHtml}
                            </div>
                            <div class="overflow-hidden">
                                <h4 class="font-bold text-sm text-[var(--text-main)] truncate">${titleDisp}</h4>
                                <p class="text-[8px] text-[var(--text-muted)] uppercase font-extrabold tracking-wide flex items-center gap-1">${metIcon} ${walletName} • ${t.displayTime.split(' ')[1] || '--:--'}</p>
                            </div>
                        </div>
                        <p class="font-bold text-sm font-mono shrink-0 ml-2 ${colorClass}">${signChar}${window.formatAuraCurrency(valTrx)}</p>
                    </div>
                    ${descDisp ? `<div class="bg-black/25 p-2.5 rounded-xl text-xs text-accent italic mb-2">"${descDisp}"</div>` : ''}
                    ${innerReceiptHtml}
                </div>`;
            }
            
            compiledTrxHtml += `
            <div class="mb-4">
                <div class="flex justify-between items-end mb-2.5 border-b border-[var(--border-glass)] pb-1">
                    <div class="flex items-baseline gap-1.5">
                        <span class="text-xl font-display font-black leading-none">${dateDisplay}</span>
                        <span class="text-[9px] uppercase tracking-widest text-[var(--text-muted)] font-extrabold">${dayDisplay}</span>
                    </div>
                    <span class="text-xs font-mono font-bold ${totalColor}">${totalPrefix}${window.formatAuraCurrency(g.total)}</span>
                </div>
                <div class="space-y-3">
                    ${itemHtmlBuilder}
                </div>
            </div>`;
        }
        el.innerHTML = compiledTrxHtml;
    });

    if (typeof window.renderAnalytics === 'function') window.renderAnalytics();
    if (typeof window.renderNextBill === 'function') window.renderNextBill();
    if (typeof window.renderWawasan === 'function') window.renderWawasan();
    if (typeof window.renderBrankas === 'function') window.renderBrankas();
    
    AuraUtils.safeDOM('goals-list-container', el => {
        const glList = AuraState.data.goals || [];
        if (glList.length === 0) { 
            el.innerHTML = '<p class="text-center text-[var(--text-muted)] mt-5 opacity-70"><i class="fa-solid fa-bullseye text-2xl block mb-2"></i>Belum ada Misi Pengumpulan Aset Finansial.</p>'; 
            return; 
        }
        
        let glHtml = '';
        const todayObj = new Date();
        todayObj.setHours(0,0,0,0);
        
        for (let i = 0; i < glList.length; i++) {
            const g = glList[i]; 
            
            const originalCurrency = g.currency || 'JPY';
            const targetVal = AuraUtils.convertCurrency(g.targetAmount || 0, originalCurrency); 
            const savedVal = AuraUtils.convertCurrency(g.savedAmount || 0, originalCurrency);
            
            const remainingTarget = Math.max(0, targetVal - savedVal);
            const progressPct = targetVal > 0 ? Math.min(100, (savedVal / targetVal) * 100) : 0;
            
            const targetDateObj = new Date(g.targetDate);
            targetDateObj.setHours(23,59,59,999);
            
            const diffDaysLeft = Math.ceil((targetDateObj.getTime() - todayObj.getTime()) / (1000 * 3600 * 24));
            const freq = parseInt(g.frequencyDays) || 1;
            
            let freqText = "Harian";
            if (g.periodUnit && g.periodVal) {
                freqText = `Per ${g.periodVal} <span class="capitalize">${g.periodUnit}</span>`;
            } else if (freq === 7) freqText = "Mingguan";
            else if (freq === 30) freqText = "Bulanan";
            else freqText = `Per ${freq} Hari`;

            const remainingPeriods = Math.max(1, Math.ceil(diffDaysLeft / freq));
            const requiredPerPeriod = remainingTarget / remainingPeriods;
            
            let requiredStatusHtml = '';
            if (remainingTarget <= 0) {
                requiredStatusHtml = '<span class="text-emerald-400"><i class="fa-solid fa-check-double"></i> TERCAPAI</span>';
            } else if (diffDaysLeft < 0) {
                requiredStatusHtml = '<span class="text-rose-400"><i class="fa-solid fa-clock-rotate-left"></i> KADALUARSA</span>';
            } else {
                requiredStatusHtml = window.formatAuraCurrency(requiredPerPeriod);
            }
            
            glHtml += `
            <div class="glass-panel p-4 relative overflow-hidden border-t-2 ${remainingTarget <= 0 ? 'border-t-emerald-400' : 'border-t-accent'} mb-4 group">
                
                <div class="absolute top-3 right-3 flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
                    <button onclick="window.openTopupGoal('${g.id}', '${AuraUtils.escapeHtml(g.name)}')" class="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/50 hover:text-white flex items-center justify-center transition shadow-lg active:scale-90" title="Setor Tabungan"><i class="fa-solid fa-plus text-xs"></i></button>
                    <button onclick="window.openEditGoalFull('${g.id}')" class="w-8 h-8 rounded-full bg-accent/20 text-accent hover:bg-accent/50 hover:text-white flex items-center justify-center transition shadow-lg active:scale-90" title="Edit Misi"><i class="fa-solid fa-pen text-xs"></i></button>
                    <button onclick="window.confirmDelGoal('${g.id}')" class="w-8 h-8 rounded-full bg-rose-500/20 text-rose-400 hover:bg-rose-500/50 hover:text-white flex items-center justify-center transition shadow-lg active:scale-90" title="Hapus Permanen"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>

                <h4 class="font-bold text-sm mb-1 pr-28 truncate">${AuraUtils.escapeHtml(g.name)}</h4>
                
                <div class="mb-4 mt-3">
                    <div class="flex justify-between text-[9px] font-bold uppercase tracking-widest mb-1.5 text-[var(--text-muted)]">
                        <span class="text-emerald-400">Terkumpul: ${window.formatAuraCurrency(savedVal)}</span>
                        <span>Target: ${window.formatAuraCurrency(targetVal)}</span>
                    </div>
                    <div class="w-full h-2.5 bg-black/60 rounded-full overflow-hidden border border-[var(--border-glass)] shadow-inner">
                        <div class="h-full ${remainingTarget <= 0 ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]' : 'bg-accent'} transition-all duration-1000 relative" style="width: ${progressPct}%">
                            <div class="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]"></div>
                        </div>
                    </div>
                </div>

                <div class="bg-black/35 rounded-xl p-3 flex justify-between items-center border border-[var(--border-glass)]">
                    <div>
                        <p class="text-[8px] text-[var(--text-muted)] uppercase mb-0.5 font-extrabold flex items-center gap-1"><i class="fa-solid fa-coins text-amber-400"></i> Wajib Nabung <span class="text-white">${freqText}</span></p>
                        <p class="font-mono text-accent font-bold text-xs">${requiredStatusHtml}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-[8px] text-[var(--text-muted)] uppercase mb-0.5 font-extrabold flex items-center gap-1 justify-end"><i class="fa-regular fa-calendar text-sky-400"></i> Sisa Waktu</p>
                        <p class="font-bold text-xs ${diffDaysLeft < 0 ? 'text-rose-400' : 'text-white'}">${diffDaysLeft > 0 ? diffDaysLeft + ' Hari' : (diffDaysLeft === 0 ? 'Hari Ini' : 'Selesai')}</p>
                    </div>
                </div>
            </div>`;
        }
        el.innerHTML = glHtml;
    });

    AuraUtils.safeDOM('trash-list-container', el => {
        const trashList = AuraState.data.trash || [];
        if (trashList.length === 0) { 
            el.innerHTML = '<p class="text-center text-[var(--text-muted)] mt-5"><i class="fa-solid fa-seedling block text-2xl mb-2 text-emerald-900/50"></i>Tempat sampah bersih.</p>'; 
            return; 
        }
        
        let trashHtml = '';
        
        for (let i = 0; i < trashList.length; i++) {
            const t = trashList[i]; 
            const delDate = t.deletedAt ? t.deletedAt.split('T')[0] : 'Unknown'; 
            const val = AuraUtils.convertCurrency(t.nominal || 0, t.mata_uang || 'JPY'); 
            
            trashHtml += `
            <div class="glass-panel p-4 flex justify-between items-center opacity-85 hover:opacity-100 transition">
                <div>
                    <h4 class="font-bold text-xs line-through text-[var(--text-muted)]">${AuraUtils.escapeHtml(t.merchantName || t.storeName || t.kategori)}</h4>
                    <p class="text-[9px] text-[var(--text-muted)]">Dihapus: ${delDate}</p>
                </div>
                <div class="flex items-center gap-2">
                    <span class="font-mono text-xs text-[var(--text-muted)] line-through mr-1">${window.formatAuraCurrency(val)}</span>
                    <button onclick="window.restoreTransaction('${t.id}')" class="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-lg hover:bg-emerald-500/40 active:scale-90 transition" aria-label="Restore"><i class="fa-solid fa-rotate-left text-xs"></i></button>
                    <button onclick="window.deleteForever('${t.id}')" class="bg-rose-500/20 text-rose-400 p-2.5 rounded-lg hover:bg-rose-500/40 active:scale-90 transition" aria-label="Hapus Permanen"><i class="fa-solid fa-xmark text-xs"></i></button>
                </div>
            </div>`;
        }
        el.innerHTML = trashHtml;
    });
    
    if (typeof window.renderRecurringUIForBudget === 'function') {
        window.renderRecurringUIForBudget();
    }
};

window.debouncedCalculateAll = AuraUtils.debounce(window.reCalculateAll, APP_CONFIG.THROTTLE_MS);

window.addEventListener('resize', function() {
    if (AuraState.system.activeView === 'dashboard' || AuraState.system.activeView === 'analytics') {
        if (typeof window.debouncedCalculateAll === 'function') {
            window.debouncedCalculateAll();
        }
    }
});

window.toggleExpandedReceipt = function(trxId) {
    if (!AuraState.temp.expandedReceipts) AuraState.temp.expandedReceipts = {};
    AuraState.temp.expandedReceipts[trxId] = !AuraState.temp.expandedReceipts[trxId];
    if (typeof window.debouncedCalculateAll === 'function') window.debouncedCalculateAll();
};

// ============================================================================
// PERBAIKAN: window.loadRealtimeDatabaseData DIHAPUS dari file ini.
// ============================================================================
// Sebelumnya fungsi ini memasang SET LISTENER KEDUA yang terpisah untuk path
// yang SAMA (transactions/settings/goals/wallets/oracleChats) dengan yang
// sudah dipasang oleh `services/firebase.js` saat login (onAuthStateChanged).
// Karena main.js mengimpor firebase.js LEBIH DULU lalu dashboard.js BELAKANGAN,
// definisi di sini menimpa punya firebase.js — sehingga tombol "Refresh Data"
// dan pemanggilan `loadRealtimeDatabaseData(true)` di main.js justru membuat
// listener realtime baru yang duplikat, berjalan berdampingan dengan listener
// asli dari firebase.js yang tidak pernah dilepas. Dua listener ini memproses
// data dengan cara sedikit berbeda (satu mengurutkan tanggal, satu mengoreksi
// tipe mutasi legacy) sehingga hasil akhirnya tidak konsisten tergantung mana
// yang menembak terakhir.
//
// Sekarang satu-satunya tempat yang boleh memasang listener realtime adalah
// `services/firebase.js`. Definisi `window.loadRealtimeDatabaseData` yang aktif
// juga sudah dipindah ke sana sebagai fungsi refresh tampilan murni (tanpa buat
// listener baru). Lihat services/firebase.js untuk implementasi barunya.


// ============================================================================
// TAGIHAN BERIKUTNYA (sekilas di kartu Analisa Kas Siklus)
// ============================================================================
window.computeNextBill = function() {
    try {
        const rp = (AuraState.data.settings && AuraState.data.settings.recurringPayments) || {};
        const now = new Date();
        const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let best = null;
        Object.values(rp).forEach(function(b) {
            if (!b || !b.date) return;
            const day = Math.min(Number(b.date) || 1, 28);
            let due = new Date(now.getFullYear(), now.getMonth(), day);
            const key = due.getFullYear() + '-' + (due.getMonth() + 1);
            if (due < today0 || b.lastExecutedMonth === key) {
                due = new Date(now.getFullYear(), now.getMonth() + 1, day);
            }
            if (!best || due < best.date) {
                best = { name: b.name || 'Tagihan', amount: Number(b.amount) || 0, date: due, days: Math.round((due - today0) / 86400000) };
            }
        });
        return best;
    } catch (e) { return null; }
};

window.renderNextBill = function() {
    AuraUtils.safeDOM('dash-next-bill', function(el) {
        const nb = window.computeNextBill();
        if (!nb) { el.innerText = 'Tidak ada tagihan rutin'; return; }
        const tgl = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(nb.date);
        el.innerText = nb.name + ' \u2022 ' + window.formatAuraCurrency(nb.amount) + ' \u2022 ' + tgl + ' (' + (nb.days === 0 ? 'hari ini' : nb.days + ' hari lagi') + ')';
    });
};

// ============================================================================
// WAWASAN (pengganti Oracle): ringkasan yang dihitung dari catatan sendiri
// ============================================================================
window.renderWawasan = function() {
    AuraUtils.safeDOM('wawasan-container', function(el) {
        try {
            const range = AuraUtils.getPeriodRange();
            const txs = (AuraState.data.transactions || []).filter(function(t) { return !t.is_deleted && t.tanggal; });
            const inRange = function(t, a, b) { const d = new Date(t.tanggal).getTime(); return d >= Number(a) && d <= Number(b); };
            const cur = txs.filter(function(t) { return inRange(t, range.start, range.end); });
            if (cur.length === 0) {
                el.innerHTML = '<p class="text-center text-xs text-[var(--text-muted)] p-8 leading-relaxed">Belum ada catatan pada siklus ini.<br>Wawasan akan muncul begitu ada transaksi.</p>';
                return;
            }
            const fmt = window.formatAuraCurrency;
            const fmtTgl = function(v) { return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(v)); };
            let pribadi = 0, kewajiban = 0, totalOut = 0;
            const catMap = {};
            cur.forEach(function(t) {
                if (t.tipe !== 'pengeluaran') return;
                totalOut += Number(t.nominal) || 0;
                (t.items || []).forEach(function(it) {
                    const sub = (Number(it.harga) || 0) * (Number(it.qty) || 1);
                    const kel = it.kelompok || (typeof window.inferKelompokItem === 'function' ? window.inferKelompokItem(it.kategori_barang, t.tipe) : 'Pribadi');
                    if (kel === 'Kewajiban Terpisah') kewajiban += sub;
                    else { pribadi += sub; const k = it.kategori_barang || 'Lainnya'; catMap[k] = (catMap[k] || 0) + sub; }
                });
            });
            const split = pribadi + kewajiban;
            const pctP = split > 0 ? Math.round(pribadi / split * 100) : 0;
            const topTx = cur.filter(function(t) { return t.tipe === 'pengeluaran'; }).sort(function(a, b) { return (Number(b.nominal) || 0) - (Number(a.nominal) || 0); }).slice(0, 3);
            const topCat = Object.entries(catMap).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 3);
            const hasRealPrev = typeof range.prevStart === 'number' && typeof range.prevEnd === 'number';
            const prevEnd = hasRealPrev ? new Date(range.prevEnd) : new Date(Number(range.start) - 1);
            const prevStart = hasRealPrev ? new Date(range.prevStart) : new Date(prevEnd.getTime() - Math.max(86400000, range.end - range.start));
            let prevOut = 0;
            txs.forEach(function(t) { if (t.tipe === 'pengeluaran' && inRange(t, prevStart, prevEnd)) prevOut += Number(t.nominal) || 0; });
            const delta = prevOut > 0 ? Math.round((totalOut - prevOut) / prevOut * 100) : 0;
            const days = Math.max(1, Math.round(len / 86400000));
            const avgDaily = Math.round(pribadi / days);
            const head = function(icon, title) { return '<h3 class="font-bold text-xs flex items-center gap-2 mb-3"><i class="fa-solid ' + icon + ' text-accent"></i> ' + title + '</h3>'; };
            let html = '';
            html += '<div class="glass-panel p-4">' + head('fa-scale-balanced', 'Pribadi vs Kewajiban — Siklus Ini')
                + '<div class="flex h-2.5 rounded-full overflow-hidden bg-black/50 mb-2"><div style="width:' + pctP + '%; background: var(--accent-primary)"></div><div style="width:' + (100 - pctP) + '%; background: var(--color-expense); opacity: .75"></div></div>'
                + '<div class="flex justify-between text-[10px] font-mono"><span>Pribadi <b class="text-[var(--text-main)]">' + fmt(pribadi) + '</b> (' + pctP + '%)</span><span>Kewajiban <b class="text-[var(--text-main)]">' + fmt(kewajiban) + '</b></span></div></div>';
            html += '<div class="glass-panel p-4">' + head('fa-arrow-trend-up', 'Pengeluaran Terbesar Siklus Ini')
                + (topTx.length ? topTx.map(function(t) { return '<div class="flex justify-between items-center py-1.5 border-b border-[var(--border-glass)] last:border-0"><div><p class="text-xs font-bold">' + (t.merchantName || t.storeName || '-') + '</p><p class="text-[9px] text-[var(--text-muted)]">' + fmtTgl(t.tanggal) + '</p></div><p class="font-mono font-bold text-xs text-[var(--color-expense)]">-' + fmt(t.nominal) + '</p></div>'; }).join('') : '<p class="text-[10px] text-[var(--text-muted)]">Tidak ada pengeluaran.</p>') + '</div>';
            html += '<div class="glass-panel p-4">' + head('fa-tags', 'Kategori Pribadi Teratas')
                + (topCat.length ? topCat.map(function(c) { return '<div class="flex justify-between items-center py-1.5 border-b border-[var(--border-glass)] last:border-0"><p class="text-xs font-bold">' + c[0] + '</p><p class="font-mono font-bold text-xs">' + fmt(c[1]) + '</p></div>'; }).join('') : '<p class="text-[10px] text-[var(--text-muted)]">Tidak ada data kategori.</p>') + '</div>';
            html += '<div class="glass-panel p-4">' + head('fa-gauge-high', 'Laju Belanja')
                + '<p class="text-[11px] leading-relaxed text-[var(--text-muted)]">Total pengeluaran siklus ini <b class="text-[var(--text-main)]">' + fmt(totalOut) + '</b>'
                + (prevOut > 0 ? ' — ' + (delta >= 0 ? '<span class="text-[var(--color-expense)] font-bold">naik ' + delta + '%</span>' : '<span class="text-[var(--color-income)] font-bold">turun ' + Math.abs(delta) + '%</span>') + ' dibanding siklus lalu (' + fmt(prevOut) + ').' : '.')
                + '<br>Rata-rata pengeluaran pribadi: <b class="text-[var(--text-main)]">' + fmt(avgDaily) + '/hari</b>.</p></div>';
            el.innerHTML = html;
        } catch (e) {
            console.warn('[Wawasan]', e);
            try { el.innerHTML = '<p class="text-center text-[10px] text-[var(--text-muted)] p-6">Wawasan gagal dimuat. Muat ulang aplikasi untuk mencoba lagi.</p>'; } catch (ignored) {}
        }
    });
};

// ============================================================================
// BRANKAS: kantong Simpanan (bebas) & Misi (target + tenggat + rencana)
// Isi brankas TIDAK masuk Kekayaan Bersih — lihat reCalculateAll (dash-savings
// memang selalu terpisah dari total dompet).
// ============================================================================
window.renderBrankas = function() {
    const goals = AuraState.data.goals || [];
    const fmt = window.formatAuraCurrency;
    const esc = function(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    const escQ = function(v) { return esc(v).replace(/'/g, "\\'"); };
    const conv = function(g, v) { return AuraUtils.convertCurrency(Number(v) || 0, g.currency || 'JPY'); };
    let totalAll = 0;
    const simpanan = [], misi = [];
    goals.forEach(function(g) {
        totalAll += conv(g, g.savedAmount);
        if (g.jenis === 'simpanan' || !(Number(g.targetAmount) > 0)) simpanan.push(g); else misi.push(g);
    });
    AuraUtils.safeDOM('brankas-total', function(el) { el.innerText = fmt(totalAll); });
    AuraUtils.safeDOM('brankas-simpanan-list', function(el) {
        if (simpanan.length === 0) { el.innerHTML = '<p class="text-[10px] text-[var(--text-muted)] text-center py-3 opacity-70">Belum ada kantong simpanan. Buat satu untuk cadangan bebasmu.</p>'; return; }
        el.innerHTML = simpanan.map(function(g) {
            const gid = g.id || '';
            return '<div class="glass-panel p-4 flex items-center justify-between gap-3"><div class="flex items-center gap-3 min-w-0"><div class="w-10 h-10 icon-chip shrink-0 text-emerald-400"><i class="fa-solid fa-piggy-bank"></i></div><div class="min-w-0"><p class="font-bold text-sm truncate">' + esc(g.name) + '</p><p class="font-mono font-bold text-xs text-emerald-400">' + fmt(conv(g, g.savedAmount)) + '</p></div></div>'
                + '<div class="flex gap-2 shrink-0"><button onclick="window.openTopupGoal(\'' + gid + '\', \'' + escQ(g.name) + '\')" class="glass-panel px-3 py-2 rounded-xl text-[10px] font-bold text-accent active:scale-95 transition"><i class="fa-solid fa-plus"></i> Isi</button>'
                + '<button onclick="window.openEditGoalFull(\'' + gid + '\')" class="glass-panel w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-muted)] active:scale-95 transition"><i class="fa-solid fa-pen text-[10px]"></i></button></div></div>';
        }).join('');
    });
    AuraUtils.safeDOM('brankas-misi-list', function(el) {
        if (misi.length === 0) { el.innerHTML = '<p class="text-[10px] text-[var(--text-muted)] text-center py-3 opacity-70">Belum ada misi. Buat misi pertamamu — misal laptop impianmu.</p>'; return; }
        const now = new Date(); const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const fmtTgl = function(v) { return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(v)); };
        el.innerHTML = misi.map(function(g) {
            const gid = g.id || '';
            const target = conv(g, g.targetAmount), saved = conv(g, g.savedAmount);
            const pct = target > 0 ? Math.min(100, Math.round(saved / target * 100)) : 0;
            const start = new Date(g.startDate || now), end = new Date(g.targetDate || now);
            const freq = Math.max(1, parseInt(g.frequencyDays) || 30);
            const totalPeriods = Math.max(1, Math.ceil(Math.max(1, (end - start) / 86400000) / freq));
            const elapsed = Math.min(totalPeriods, Math.max(0, Math.floor(Math.max(0, (today0 - start) / 86400000) / freq)));
            const expected = Math.min(target, (target / totalPeriods) * elapsed);
            const remaining = Math.max(0, target - saved);
            const daysLeft = Math.max(0, Math.ceil((end - today0) / 86400000));
            const periodsLeft = Math.max(1, Math.ceil(daysLeft / freq));
            const planNext = remaining / periodsLeft;
            let chip, chipCls;
            if (saved >= target && target > 0) { chip = 'Tercapai'; chipCls = 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10'; }
            else if (saved >= expected) { chip = 'Sesuai Rencana'; chipCls = 'text-[var(--color-income)] border-[var(--color-income)]/30 bg-[var(--color-income)]/10'; }
            else if (saved >= expected * 0.8) { chip = 'Hampir Sesuai'; chipCls = 'text-amber-400 border-amber-400/30 bg-amber-400/10'; }
            else { chip = 'Tertinggal ' + fmt(expected - saved); chipCls = 'text-[var(--color-expense)] border-[var(--color-expense)]/30 bg-[var(--color-expense)]/10'; }
            return '<div class="glass-panel p-4"><div class="flex justify-between items-start gap-2 mb-2"><p class="font-bold text-sm">' + esc(g.name) + '</p><span class="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ' + chipCls + ' shrink-0">' + chip + '</span></div>'
                + '<div class="w-full h-2 bg-black/50 rounded-full overflow-hidden mb-2"><div class="h-full bg-accent rounded-full transition-all duration-700" style="width:' + pct + '%"></div></div>'
                + '<div class="flex justify-between text-[10px] text-[var(--text-muted)] font-mono mb-2"><span>' + fmt(saved) + ' terkumpul (' + pct + '%)</span><span>Target ' + fmt(target) + '</span></div>'
                + '<div class="text-[10px] text-[var(--text-muted)] space-y-1"><p><i class="fa-regular fa-calendar mr-1"></i> Tenggat ' + fmtTgl(g.targetDate) + ' \u2022 ' + daysLeft + ' hari lagi</p>'
                + '<p><i class="fa-solid fa-coins mr-1"></i> Rencana periode berikut: <b class="text-[var(--text-main)]">' + fmt(planNext) + '</b></p></div>'
                + '<div class="flex gap-2 mt-3"><button onclick="window.openTopupGoal(\'' + gid + '\', \'' + escQ(g.name) + '\')" class="flex-1 bg-accent text-[var(--bg-base)] font-bold py-2.5 rounded-xl text-[11px] active:scale-[0.98] transition"><i class="fa-solid fa-plus"></i> Nabung</button>'
                + '<button onclick="window.openEditGoalFull(\'' + gid + '\')" class="glass-panel px-4 rounded-xl text-[11px] font-bold text-[var(--text-muted)] active:scale-95 transition"><i class="fa-solid fa-pen"></i></button></div></div>';
        }).join('');
    });
};
