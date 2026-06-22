/**
 * Dynamic Modal Injector
 * Membangkitkan HTML form/modal yang tidak ditulis statis di dalam file HTML utama.
 */

export const injectMissingModals = function() {
    const body = document.body;
    
    if (!document.getElementById('modal-import-data')) {
        const importModalHTML = `
        <div id="modal-import-data" class="fixed inset-0 z-[110] bg-black/85 backdrop-blur-md flex items-center justify-center p-5 hidden opacity-0 transition-all duration-300">
            <div class="glass-panel p-6 w-full max-w-sm shadow-2xl border-t-4 border-t-emerald-400">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-lg font-bold flex items-center gap-2 text-emerald-400 font-display"><i class="fa-solid fa-file-import"></i> Impor Transaksi</h3>
                    <button onclick="window.closeModal('modal-import-data')" class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-white transition"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="space-y-4 text-center">
                    <p class="text-xs text-[var(--text-muted)]">Unggah file JSON atau CSV (Format AuraFi) untuk merestorasi riwayat transaksi lama Anda.</p>
                    <input type="file" id="import-file-input" accept=".json, .csv" class="hidden" onchange="window.processFileImport(event)">
                    <button onclick="document.getElementById('import-file-input').click()" class="w-full py-4 rounded-xl border-2 border-dashed border-emerald-500/50 text-emerald-400 font-bold hover:bg-emerald-500/20 transition flex flex-col items-center gap-2">
                        <i class="fa-solid fa-cloud-arrow-up text-2xl"></i><span>Pilih File Dari Perangkat</span>
                    </button>
                </div>
            </div>
        </div>`;
        body.insertAdjacentHTML('beforeend', importModalHTML);
    }

    if (!document.getElementById('modal-edit-tracker')) {
        const trackerModalHTML = `
        <div id="modal-edit-tracker" class="fixed inset-0 z-[110] bg-black/85 backdrop-blur-md flex items-center justify-center p-5 hidden opacity-0 transition-all duration-300">
            <div class="glass-panel p-6 w-full max-w-sm shadow-2xl border-t-4 border-t-amber-400 max-h-[90vh] overflow-y-auto no-scrollbar">
                <div class="flex justify-between items-center mb-6 sticky top-0 bg-[var(--bg-glass)] z-10 pb-2">
                    <h3 class="text-lg font-bold flex items-center gap-2 text-amber-400 font-display"><i class="fa-solid fa-box-open"></i> Tracker Dinamis</h3>
                    <button onclick="window.closeModal('modal-edit-tracker')" class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-white transition"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div id="tracker-list-container" class="space-y-3 mb-5"></div>
                <div class="pt-4 border-t border-[var(--border-glass)] space-y-3">
                    <h4 class="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Tambah Tracker Baru</h4>
                    <input type="text" id="new-track-id" class="v-input w-full rounded-xl p-2.5 text-xs outline-none" placeholder="ID (Contoh: kopi)">
                    <input type="text" id="new-track-name" class="v-input w-full rounded-xl p-2.5 text-xs outline-none" placeholder="Nama Label (Cth: Ngopi)">
                    <input type="text" id="new-track-keywords" class="v-input w-full rounded-xl p-2.5 text-xs outline-none" placeholder="Kata Kunci (Cth: starbucks, kopi, janji jiwa)">
                    <button onclick="window.saveNewTracker()" class="w-full py-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-xs uppercase tracking-wider hover:bg-amber-500/40 transition">Simpan Tracker</button>
                </div>
            </div>
        </div>`;
        body.insertAdjacentHTML('beforeend', trackerModalHTML);
    }
    
    if (!document.getElementById('modal-edit-budget')) {
        const budgetModalHTML = `
        <div id="modal-edit-budget" class="fixed inset-0 z-[110] bg-black/85 backdrop-blur-md flex items-center justify-center p-5 hidden opacity-0 transition-all duration-300">
            <div class="glass-panel p-6 w-full max-w-sm shadow-2xl border-t-4 border-t-rose-400">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-lg font-bold flex items-center gap-2 text-rose-400 font-display"><i class="fa-solid fa-fire-flame-curved"></i> Batas Burn Rate</h3>
                    <button onclick="window.closeModal('modal-edit-budget')" class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-white transition"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1 block font-bold">Batas Pengeluaran Bulanan (Limit)</label>
                        <input type="number" id="budget-limit-input" class="v-input w-full rounded-xl p-3 text-sm font-mono font-bold text-rose-400 outline-none" placeholder="Masukkan Nominal JPY/IDR">
                    </div>
                    <button onclick="window.executeSaveBudget()" class="w-full py-4 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/50 font-bold text-sm hover:bg-rose-500/40 transition">Simpan Ketetapan</button>
                </div>
            </div>
        </div>`;
        body.insertAdjacentHTML('beforeend', budgetModalHTML);
    }

    if (!document.getElementById('modal-family')) {
        const familyModalHTML = `
        <div id="modal-family" class="fixed inset-0 z-[110] bg-black/85 backdrop-blur-md flex items-center justify-center p-5 hidden opacity-0 transition-all duration-300">
            <div class="glass-panel p-6 w-full max-w-sm shadow-2xl border-t-4 border-t-indigo-400 max-h-[90vh] overflow-y-auto no-scrollbar">
                <div class="flex justify-between items-center mb-6 sticky top-0 bg-[var(--bg-glass)] z-10 pb-2">
                    <h3 class="text-lg font-bold flex items-center gap-2 text-indigo-400 font-display"><i class="fa-solid fa-users"></i> Anggota Keluarga</h3>
                    <button onclick="window.closeModal('modal-family')" class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-white transition"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div id="family-list-container" class="space-y-3 mb-5"></div>
                <div class="pt-4 border-t border-[var(--border-glass)] space-y-3">
                    <input type="text" id="new-family-name" class="v-input w-full rounded-xl p-3 text-sm outline-none" placeholder="Nama Anggota (Cth: Istri)">
                    <button onclick="window.addFamilyMember()" class="w-full py-3 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-bold text-xs uppercase tracking-wider hover:bg-indigo-500/40 transition">Tambah Anggota</button>
                </div>
            </div>
        </div>`;
        body.insertAdjacentHTML('beforeend', familyModalHTML);
    }
    
    if (!document.getElementById('modal-audit-log')) {
        const auditHTML = `
        <div id="modal-audit-log" class="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 hidden opacity-0 transition-all duration-300">
            <div class="glass-panel p-5 w-full max-w-md shadow-2xl border-t-4 border-t-white h-[85vh] flex flex-col">
                <div class="flex justify-between items-center mb-4 shrink-0">
                    <h3 class="text-lg font-bold flex items-center gap-2 text-white font-display"><i class="fa-solid fa-shield-halved"></i> Security Audit Log</h3>
                    <button onclick="window.closeModal('modal-audit-log')" class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-white transition"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div id="audit-log-content" class="flex-1 overflow-y-auto no-scrollbar space-y-3 bg-black/40 p-3 rounded-xl border border-[var(--border-glass)]">
                    <p class="text-xs text-center text-[var(--text-muted)] mt-10">Mencari rekam jejak pada Cloud Firebase...</p>
                </div>
            </div>
        </div>`;
        body.insertAdjacentHTML('beforeend', auditHTML);
    }

    // ============================================================================
    // MODAL BARU: CUSTOM PROMPT (Pengganti prompt() bawaan browser)
    // ============================================================================
    if (!document.getElementById('modal-custom-prompt')) {
        const promptHTML = `
        <div id="modal-custom-prompt" class="fixed inset-0 z-[250] bg-black/85 backdrop-blur-md flex items-center justify-center p-5 hidden opacity-0 transition-all duration-300">
            <div class="glass-panel p-6 w-full max-w-sm text-center border-t-4 border-t-indigo-400 shadow-2xl relative overflow-hidden">
                <div class="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
                    <i class="fa-solid fa-keyboard text-2xl text-indigo-400"></i>
                </div>
                <h3 class="text-xl font-bold mb-2 font-display text-white">Input Diperlukan</h3>
                <p class="text-sm text-[var(--text-muted)] mb-6 leading-relaxed" id="prompt-msg"></p>
                <input type="text" id="prompt-input" class="v-input w-full rounded-2xl p-4 text-sm outline-none mb-6 text-center font-bold text-indigo-300 placeholder-indigo-900/50" autocomplete="off" onkeydown="if(event.key==='Enter') window.executeCustomPrompt()">
                <div class="flex gap-3">
                    <button onclick="window.closePromptModal()" class="flex-1 py-3.5 rounded-2xl border border-[var(--border-glass)] hover:bg-white/5 font-semibold text-sm transition text-[var(--text-muted)]">Batal</button>
                    <button onclick="window.executeCustomPrompt()" class="flex-1 py-3.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/50 font-bold text-sm shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:bg-indigo-500/40 transition">Konfirmasi</button>
                </div>
            </div>
        </div>`;
        body.insertAdjacentHTML('beforeend', promptHTML);
    }
};

window.injectMissingModals = injectMissingModals;
