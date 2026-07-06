/**
 * Super Render Engine
 */
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { Logger } from '../core/logger.js';
import { AuraState } from '../core/state.js';
import { AuraUtils } from '../core/utils.js';
import { APP_CONFIG } from '../config/constants.js';
import { CategoryManager } from '../modules/categories.js';

// ============================================================================
// UI TAGIHAN OTOMATIS (MENGGUNAKAN KONVERSI KURS)
// ============================================================================
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
            // Konversi dari mata uang asal ke mata uang tampilan
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
    const today = new Date();
    
    let cumulativeBalance = 0;
    let totalCashBal = 0, totalCashlessBal = 0;

    for (let i = 0; i < allTx.length; i++) {
        const trx = allTx[i];
        const val = AuraUtils.convertCurrency(trx.nominal || 0, trx.mata_uang || 'JPY'); 
        const isCash = (trx.metode_pembayaran === 'tunai');

        if (trx.tipe === 'pemasukan') {
            cumulativeBalance += val;
            if (isCash) totalCashBal += val;
            else totalCashlessBal += val;
        } else if (trx.tipe === 'pengeluaran') {
            cumulativeBalance -= val;
            if (isCash) totalCashBal -= val;
            else totalCashlessBal -= val;
        } else if (trx.tipe === 'tarik_tunai') {
            const feeVal = AuraUtils.convertCurrency(Number(trx.admin_fee || 0), trx.mata_uang || 'JPY');
            cumulativeBalance -= feeVal; 
            totalCashBal += val; 
            totalCashlessBal -= (val + feeVal);
        } else if (trx.tipe === 'setor_tunai') {
            const feeVal = AuraUtils.convertCurrency(Number(trx.admin_fee || 0), trx.mata_uang || 'JPY');
            cumulativeBalance -= feeVal; 
            totalCashBal -= val; 
            totalCashlessBal += val; 
            totalCashlessBal -= feeVal;
        }
    }

    const periodRange = AuraUtils.getPeriodRange();
    const fSearch = (AuraState.filters && AuraState.filters.search) ? AuraState.filters.search.toLowerCase() : "";
    const fCat = (AuraState.filters && AuraState.filters.category) ? AuraState.filters.category : "ALL";
    const fUser = (AuraState.filters && AuraState.filters.user) ? AuraState.filters.user : "ALL";
    
    let periodSpent = 0, periodIncome = 0;
    let groupedTrx = {};
    let filteredTx = [];
    
    for (let i = 0; i < allTx.length; i++) {
        const trx = allTx[i];
        const trxTime = new Date(trx.tanggal || trx.createdAt).getTime();
        
        if (trxTime < periodRange.start || trxTime > periodRange.end) continue;
        
        if (fSearch) {
            const desc = (trx.description || trx.catatan_ai || "").toLowerCase();
            const merch = (trx.merchantName || trx.storeName || "").toLowerCase();
            let hasItemMatch = false;
            if (trx.items && Array.isArray(trx.items)) {
                for (let j = 0; j < trx.items.length; j++) { 
                    if (trx.items[j].nama_barang.toLowerCase().includes(fSearch)) { 
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
        const dStrRaw = trx.tanggal || trx.createdAt;
        const dStr = dStrRaw.split('T')[0];
        const timeFormatted = AuraUtils.formatDateToReadable(dStrRaw);
        
        if (!groupedTrx[dStr]) {
            groupedTrx[dStr] = { total: 0, items: [] };
        }

        if (trx.tipe === 'pemasukan') {
            periodIncome += val;
            groupedTrx[dStr].total += val;
        } else if (trx.tipe === 'pengeluaran' || trx.tipe === 'tarik_tunai' || trx.tipe === 'setor_tunai') {
            let actualSpend = val;
            if (trx.tipe === 'tarik_tunai' || trx.tipe === 'setor_tunai') {
                actualSpend = AuraUtils.convertCurrency(Number(trx.admin_fee || 0), trx.mata_uang || 'JPY');
            }
            groupedTrx[dStr].total -= actualSpend; 
            periodSpent += actualSpend;
        }
        
        trx.displayTime = timeFormatted;
        groupedTrx[dStr].items.push(trx);
    }

    AuraUtils.safeDOM('dash-total-balance', el => el.innerText = window.formatAuraCurrency(cumulativeBalance));
    AuraUtils.safeDOM('dash-cash', el => el.innerText = window.formatAuraCurrency(totalCashBal));
    AuraUtils.safeDOM('dash-cashless', el => el.innerText = window.formatAuraCurrency(totalCashlessBal));
    AuraUtils.safeDOM('dash-income-mth', el => el.innerText = '+' + window.formatAuraCurrency(periodIncome));
    AuraUtils.safeDOM('dash-expense-mth', el => el.innerText = '-' + window.formatAuraCurrency(periodSpent));

    const limitVal = AuraUtils.convertCurrency(AuraState.data.monthlyBudget || 0, 'JPY');
    const burnPct = limitVal > 0 ? (periodSpent / limitVal) * 100 : 0;
    const remainingBudget = limitVal - periodSpent;
    
    AuraUtils.safeDOM('living-core', el => el.className = `w-48 h-48 rounded-full living-core ${burnPct > 90 ? 'danger' : ''} flex flex-col items-center justify-center relative overflow-hidden cursor-pointer`);
    AuraUtils.safeDOM('burn-progress', el => { 
        el.style.width = `${Math.min(burnPct, 100)}%`; 
        el.style.backgroundColor = burnPct > 90 ? 'var(--color-expense)' : 'var(--color-income)'; 
    });
    AuraUtils.safeDOM('burn-spent', el => el.innerText = `Terpakai: ${window.formatAuraCurrency(periodSpent)}`);
    AuraUtils.safeDOM('burn-limit', el => el.innerText = `Limit: ${window.formatAuraCurrency(limitVal)}`);
    
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
            el.innerHTML = `<span class="text-[var(--color-income)] font-bold"><i class="fa-solid fa-circle-check"></i> AMAN TERKENDALI:</span> Pola stabil.<br><span class="text-[9px] mt-1 text-[var(--text-muted)]">Celah Defensif Sisa Dana: ${window.formatAuraCurrency(remainingBudget)}</span>`; 
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
                } else if (t.tipe === 'tarik_tunai' || t.tipe === 'setor_tunai') { 
                    iconHtml = '<i class="fa-solid fa-money-bill-transfer text-[#38bdf8]"></i>';
                    colorClass = 'text-[#38bdf8]'; 
                    signChar = '⇄'; 
                }
                
                const titleDisp = AuraUtils.escapeHtml(t.merchantName || t.storeName || t.kategori);
                const descDisp = AuraUtils.escapeHtml(t.description || t.catatan_ai || "");
                const metIcon = t.metode_pembayaran === 'tunai' ?
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
                    <button onclick="window.openEditTrxModal('${t.id}')" class="absolute top-3 right-10 text-[var(--text-muted)] hover:text-accent opacity-0 group-hover:opacity-100 active:scale-90 p-2 text-sm transition"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="window.confirmDelTrx('${t.id}')" class="absolute top-3 right-3 text-[var(--text-muted)] hover:text-[var(--color-expense)] opacity-0 group-hover:opacity-100 active:scale-90 p-2 text-sm transition"><i class="fa-solid fa-trash"></i></button>
                    <div class="flex justify-between items-start mb-2 pr-12">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style="background-color: ${catStyle.hex}15; border: 1px solid ${catStyle.hex}30;">
                                ${iconHtml}
                            </div>
                            <div class="overflow-hidden">
                                <h4 class="font-bold text-sm text-[var(--accent-primary)] truncate">${titleDisp}</h4>
                                <p class="text-[8px] text-[var(--text-muted)] uppercase font-extrabold tracking-wide flex items-center gap-1">${metIcon} ${t.metode_pembayaran} • ${t.displayTime.split(' ')[1]}</p>
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
    
    // ============================================================================
    // LOGIKA PERBAIKAN: MANAJER MISI TABUNGAN (TIDAK ADA LAGI DESIMAL/BENGKAK)
    // ============================================================================
        AuraUtils.safeDOM('goals-list-container', el => {
        const glList = AuraState.data.goals || [];
        if (glList.length === 0) { 
            el.innerHTML = '<p class="text-center text-[var(--text-muted)] mt-5 opacity-70"><i class="fa-solid fa-bullseye text-2xl block mb-2"></i>Belum ada Misi Pengumpulan Aset Finansial.</p>'; 
            return; 
        }
        
        let glHtml = '';
        const todayObj = new Date();
        todayObj.setHours(0,0,0,0); // Normalisasi hari ini ke jam 00:00
        
        for (let i = 0; i < glList.length; i++) {
            const g = glList[i]; 
            
            const originalCurrency = g.currency || 'JPY';
            const targetVal = AuraUtils.convertCurrency(g.targetAmount || 0, originalCurrency); 
            // Menarik saldo yang sudah ditabung
            const savedVal = AuraUtils.convertCurrency(g.savedAmount || 0, originalCurrency);
            
            // Kalkulasi sisa target
            const remainingTarget = Math.max(0, targetVal - savedVal);
            const progressPct = targetVal > 0 ? Math.min(100, (savedVal / targetVal) * 100) : 0;
            
            const targetDateObj = new Date(g.targetDate);
            targetDateObj.setHours(23,59,59,999);
            
            // Sisa hari dari HARI INI ke TARGET AKHIR
            const diffDaysLeft = Math.ceil((targetDateObj.getTime() - todayObj.getTime()) / (1000 * 3600 * 24));
            
            const freq = parseInt(g.frequencyDays) || 1;
            
            let freqText = "Harian";
            if (g.periodUnit && g.periodVal) {
                freqText = `Per ${g.periodVal} <span class="capitalize">${g.periodUnit}</span>`;
            } else if (freq === 7) freqText = "Mingguan";
            else if (freq === 30) freqText = "Bulanan";
            else freqText = `Per ${freq} Hari`;

            // ========================================================
            // DYNAMIC SINKING FUND CALCULATION
            // Membagi sisa uang yang dibutuhkan dengan sisa periode waktu
            // ========================================================
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

window.loadRealtimeDatabaseData = function() {
    if (!AuraState.user.uid) {
        Logger.warn('Dashboard', 'loadRealtimeDatabaseData: Tidak ada user UID aktif');
        return;
    }
    
    const uid = AuraState.user.uid;
    const db = AuraState.instances.db;
    const ledgerNode = APP_CONFIG.LEDGER_NODE;
    const listeners = AuraState.listeners || [];
    
    for (let i = 0; i < listeners.length; i++) {
        if (typeof listeners[i] === 'function') listeners[i]();
    }
    AuraState.listeners = [];
    
    Logger.info('Dashboard', 'Membangun koneksi listener Realtime Firebase...');
    
    const txRef = ref(db, `${ledgerNode}/${uid}/transactions`);
    const txUnsubscribe = onValue(txRef, (snapshot) => {
        const data = snapshot.val() || {};
        const transactions = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        AuraState.data.transactions = transactions.filter(t => !t.is_deleted);
        AuraState.data.trash = transactions.filter(t => t.is_deleted);
        
        if (typeof window.populateUserFilterDropdown === 'function') window.populateUserFilterDropdown();
        if (typeof window.debouncedCalculateAll === 'function') window.debouncedCalculateAll();
    });
    AuraState.listeners.push(txUnsubscribe);
    
    const goalsRef = ref(db, `${ledgerNode}/${uid}/goals`);
    const goalsUnsubscribe = onValue(goalsRef, (snapshot) => {
        const data = snapshot.val() || {};
        AuraState.data.goals = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        if (typeof window.debouncedCalculateAll === 'function') window.debouncedCalculateAll();
    });
    AuraState.listeners.push(goalsUnsubscribe);
    
    const settingsRef = ref(db, `${ledgerNode}/${uid}/settings`);
    const settingsUnsubscribe = onValue(settingsRef, (snapshot) => {
        const data = snapshot.val() || {};
        AuraState.data.settings = data;
        
        if (data.monthlyBudget?.limit !== undefined) {
            AuraState.data.monthlyBudget = data.monthlyBudget.limit;
        }
        
        if (data.groqApiKeys) {
            AuraState.data.groqKeys = Object.keys(data.groqApiKeys).map(key => ({ id: key, ...data.groqApiKeys[key] }));
            if (typeof window.renderGroqKeysUI === 'function') window.renderGroqKeysUI();
        }
        
        if (data.aiPreferences) {
            AuraUtils.safeDOM('setting-ai-chat', el => el.value = data.aiPreferences.modelChat || 'Auto');
            AuraUtils.safeDOM('setting-ai-vision', el => el.value = data.aiPreferences.modelVision || 'Auto');
            AuraUtils.safeDOM('setting-ai-persona', el => el.value = data.aiPreferences.persona || 'Kombinasi Humble + Jenius + Profesional');
            AuraUtils.safeDOM('setting-ai-style', el => el.value = data.aiPreferences.style || 'Normal');
        }
        
        if (data.profile) {
            AuraUtils.safeDOM('user-fullname', el => el.value = data.profile.fullName || '');
            AuraUtils.safeDOM('user-nickname', el => el.value = data.profile.nickname || '');
        }
        
        if (typeof window.renderRecurringUI === 'function') window.renderRecurringUI();
        if (typeof window.renderRecurringUIForBudget === 'function') window.renderRecurringUIForBudget();
        if (typeof window.renderCategoryDropdowns === 'function') window.renderCategoryDropdowns();
        if (typeof window.debouncedCalculateAll === 'function') window.debouncedCalculateAll();
    });
    AuraState.listeners.push(settingsUnsubscribe);
    
    const chatRef = ref(db, `${ledgerNode}/${uid}/oracleChats`);
    const chatUnsubscribe = onValue(chatRef, (snapshot) => {
        const data = snapshot.val() || {};
        AuraState.data.oracleChats = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        if (typeof window.renderOracleChats === 'function') window.renderOracleChats();
    });
    AuraState.listeners.push(chatUnsubscribe);
    
    Logger.success('Dashboard', 'Pipa koneksi data realtime telah dikunci rapat.');
};
