/**
 * AuraFi OS - Onboarding & User Guide
 * File terisolasi khusus untuk memandu pengguna baru mencakup seluruh fitur kompleks.
 */

import { AuraUtils } from '../core/utils.js';

export const Onboarding = {
    currentStep: 0,
    
    steps: [
        {
            title: "Selamat Datang di AuraFi OS",
            icon: "fa-meteor",
            color: "text-accent",
            desc: "Sistem Manajemen Kekayaan Cerdas (Cognitive Wealth System). Berbeda dari sekadar aplikasi pencatat kas, ini adalah Asisten Akuntan Pribadi Anda. Mari pelajari cara memaksimalkannya."
        },
        {
            title: "1. Setup Awal: Dompet & Saldo",
            icon: "fa-vault",
            color: "text-sky-400",
            desc: "Pertama-tama, masuk ke menu <b>⚙️ (Settings) -> Dompet & Bank</b>. Buat dompet untuk setiap rekening, e-wallet, atau uang tunai Anda, dan isi saldo awalnya. Dari sinilah semua transaksi Anda akan bermuara."
        },
        {
            title: "2. Input Ajaib: Foto & Suara",
            icon: "fa-brain",
            color: "text-indigo-400",
            desc: "Lupakan input manual yang melelahkan! Di bar bawah, gunakan tombol 📷 untuk memfoto struk belanja, atau 🎤 untuk berbicara (misal: <i>'Beli kopi 25 ribu pakai OVO'</i>). AI akan memprosesnya otomatis."
        },
        {
            title: "3. Area Transit & Pajak (Staging)",
            icon: "fa-microscope",
            color: "text-rose-400",
            desc: "Saat AI memproses struk, data akan masuk ke <b>Staging Area</b> terlebih dahulu untuk Anda periksa. Jika ada pajak (Tax/PPN), sistem bisa secara cerdas <i>menyebar</i> pajak tersebut ke setiap barang atau <i>memisahnya</i>."
        },
        {
            title: "4. Kendali Anggaran & Tagihan",
            icon: "fa-fire-flame-curved",
            color: "text-orange-500",
            desc: "Masuk ke tab <b>Budget</b>. Tetapkan 'Batas Anggaran Bulanan' Anda. Di sini Anda juga bisa menambahkan <b>Tagihan Otomatis</b> (seperti Netflix, Listrik, atau Internet) agar sistem menagihnya setiap bulan."
        },
        {
            title: "5. Mutasi & Misi Tabungan",
            icon: "fa-money-bill-transfer",
            color: "text-emerald-400",
            desc: "Pindah saldo antar bank tanpa dihitung sebagai pengeluaran? Gunakan fitur <b>Mutasi Saldo</b> di Manajer Dompet. Untuk menabung, buat <b>Misi Tabungan</b> 🎯 dan kunci dana Anda ke dalam Brankas Sistem."
        },
        {
            title: "6. Lacak Kebiasaan Boros",
            icon: "fa-box-open",
            color: "text-amber-500",
            desc: "Punya kebiasaan jajan Boba, Rokok, atau Kopi? Buka <b>⚙️ -> Trackers</b>. Buat tracker dinamis dengan kata kunci. AI akan melacak total pengeluaran untuk 'kebiasaan' tersebut dan menampilkannya di tab <b>Stats</b>."
        },
        {
            title: "7. Siklus Kustom & Tutup Buku",
            icon: "fa-book-bookmark",
            color: "text-amber-400",
            desc: "Gajian tanggal 25? Atur 'Hari Mulai Siklus' dengan menekan tombol roda gigi kecil di Dashboard. Jika siklus berakhir, masuk ke tab <b>Stats</b>, tekan <b>Tutup Buku</b>, dan biarkan AI membuat laporan evaluasi keuangan Anda!"
        }
    ],

    init: function() {
        if (!document.getElementById('modal-onboarding')) {
            const modalHTML = `
            <div id="modal-onboarding" class="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-5 hidden opacity-0 transition-all duration-300">
                <div class="glass-panel w-full max-w-sm shadow-2xl border-t-4 border-t-accent flex flex-col overflow-hidden relative">
                    
                    <div class="w-full h-1 bg-black/50 absolute top-0 left-0">
                        <div id="onboarding-progress" class="h-full bg-accent transition-all duration-300" style="width: 0%"></div>
                    </div>

                    <div id="onboarding-counter" class="absolute top-3 right-4 text-[10px] font-mono font-bold text-[var(--text-muted)] tracking-widest bg-black/40 px-2 py-1 rounded-lg border border-[var(--border-glass)]">
                        1/8
                    </div>

                    <div class="p-8 text-center flex-1 flex flex-col justify-center items-center min-h-[300px] mt-4">
                        <div id="onboarding-icon-container" class="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/10 shadow-lg transition-all duration-500">
                            <i id="onboarding-icon" class="fa-solid fa-meteor text-4xl text-accent transition-all duration-500"></i>
                        </div>
                        <h2 id="onboarding-title" class="text-lg font-display font-black text-white mb-3 transition-all duration-300">Memuat...</h2>
                        <p id="onboarding-desc" class="text-xs text-[var(--text-muted)] leading-relaxed transition-all duration-300">Silakan tunggu.</p>
                    </div>

                    <div class="p-4 border-t border-[var(--border-glass)] bg-black/40 flex gap-2">
                        <button id="btn-onboarding-prev" onclick="window.AuraOnboarding.prev()" class="w-12 h-12 rounded-xl border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-white transition active:scale-95 flex items-center justify-center hidden"><i class="fa-solid fa-arrow-left"></i></button>
                        <button id="btn-onboarding-skip" onclick="window.AuraOnboarding.close()" class="flex-1 h-12 rounded-xl border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-white font-bold text-xs transition active:scale-95">Tutup Panduan</button>
                        <button id="btn-onboarding-next" onclick="window.AuraOnboarding.next()" class="flex-[2] h-12 rounded-xl bg-accent text-[var(--bg-base)] font-bold text-xs shadow-[0_0_15px_var(--accent-glow)] hover:opacity-90 transition active:scale-95 flex items-center justify-center gap-2">Lanjut <i class="fa-solid fa-arrow-right"></i></button>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }

        const hasSeenGuide = localStorage.getItem('aurafi_has_seen_guide_v3');
        if (!hasSeenGuide) {
            setTimeout(() => { this.show(); }, 1500); 
        }
    },

    renderStep: function() {
        const step = this.steps[this.currentStep];
        const isFirstStep = this.currentStep === 0;
        const isLastStep = this.currentStep === this.steps.length - 1;
        const progress = ((this.currentStep + 1) / this.steps.length) * 100;

        AuraUtils.safeDOM('onboarding-progress', el => el.style.width = `${progress}%`);
        AuraUtils.safeDOM('onboarding-counter', el => el.innerText = `${this.currentStep + 1}/${this.steps.length}`);
        
        AuraUtils.safeDOM('onboarding-icon', el => {
            el.className = `fa-solid ${step.icon} text-4xl ${step.color} transition-all duration-500 transform scale-110`;
            setTimeout(() => el.classList.remove('scale-110'), 200);
        });

        AuraUtils.safeDOM('onboarding-title', el => el.innerHTML = step.title);
        AuraUtils.safeDOM('onboarding-desc', el => el.innerHTML = step.desc);

        AuraUtils.safeDOM('btn-onboarding-prev', el => {
            if (isFirstStep) el.classList.add('hidden');
            else el.classList.remove('hidden');
        });

        AuraUtils.safeDOM('btn-onboarding-skip', el => {
            el.style.display = isLastStep ? 'none' : 'block';
        });

        AuraUtils.safeDOM('btn-onboarding-next', el => {
            if (isLastStep) {
                el.innerHTML = 'Mulai Gunakan <i class="fa-solid fa-check"></i>';
                el.className = "flex-[2] h-12 rounded-xl bg-emerald-400 text-black font-bold text-xs shadow-[0_0_15px_rgba(52,211,153,0.4)] hover:opacity-90 transition active:scale-95 flex items-center justify-center gap-2";
            } else {
                el.innerHTML = 'Lanjut <i class="fa-solid fa-arrow-right"></i>';
                el.className = "flex-[2] h-12 rounded-xl bg-accent text-[var(--bg-base)] font-bold text-xs shadow-[0_0_15px_var(--accent-glow)] hover:opacity-90 transition active:scale-95 flex items-center justify-center gap-2";
            }
        });
    },

    next: function() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.renderStep();
        } else {
            this.close();
        }
    },

    prev: function() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.renderStep();
        }
    },

    show: function() {
        this.currentStep = 0;
        this.renderStep();
        const modal = document.getElementById('modal-onboarding');
        if (modal) {
            modal.classList.remove('hidden');
            requestAnimationFrame(() => modal.classList.remove('opacity-0'));
        }
    },

    close: function() {
        const modal = document.getElementById('modal-onboarding');
        if (modal) {
            modal.classList.add('opacity-0');
            setTimeout(() => modal.classList.add('hidden'), 300);
        }
        // Gunakan key baru agar user lama juga dipaksa melihat panduan baru ini 1x
        localStorage.setItem('aurafi_has_seen_guide_v3', 'true');
    }
};

window.AuraOnboarding = Onboarding;

document.addEventListener('DOMContentLoaded', () => {
    Onboarding.init();
});
