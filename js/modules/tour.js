/**
 * AuraFi OS - Tur Panduan Interaktif
 * Tur hidup: layar digelapkan, elemen asli dilingkari cahaya, dan kartu
 * penjelasan mengikuti elemen itu sambil pengguna dipandu berpindah tab.
 * Menggantikan panduan slide lama (modules/onboarding.js tidak lagi dipakai).
 * Muncul satu kali otomatis setelah masuk; dapat diulang lewat
 * Pengaturan -> Panduan (window.AuraTour.mulai()).
 */

const KUNCI_TUR = 'aurafi_tur_v1';

function elId(id) { return document.getElementById(id); }

function seksiTerbuka(id) {
    const c = elId(id);
    return !!c && !c.classList.contains('max-h-0');
}

function pastikanSeksi(id, buka) {
    const ada = seksiTerbuka(id);
    if (ada === buka) return;
    if (typeof window.toggleSettingsSection === 'function') window.toggleSettingsSection(id);
}

function bukaPengaturanSeksi(id) {
    if (typeof window.showModal === 'function') window.showModal('modal-settings');
    if (id === 'sec-siklus' && typeof window.renderSiklusPengaturan === 'function') window.renderSiklusPengaturan();
    pastikanSeksi(id, true);
}

function tutupPengaturan() {
    const m = elId('modal-settings');
    if (m && !m.classList.contains('hidden') && typeof window.closeModal === 'function') {
        window.closeModal('modal-settings');
    }
}

const LANGKAH = [
    {
        judul: 'Selamat Datang di AuraFi',
        isi: 'Tur singkat ini mengelilingi fitur-fitur utama aplikasi, langsung di tempatnya masing-masing. Pakai tombol <b>Lanjut</b> dan <b>Kembali</b> untuk berpindah, dan <b>Lewati</b> bila ingin berhenti di tengah jalan.',
        el: null
    },
    {
        judul: 'Net Worth — Saldo Utama',
        isi: 'Angka besar ini adalah total aset bersih dari semua dompetmu. Simpanan di <b>Brankas</b> sengaja <b>tidak</b> ikut dihitung di sini, supaya yang terlihat adalah uang yang benar-benar bisa dipakai.',
        el: () => elId('living-core')
    },
    {
        judul: 'Rentang Data: Siklus / Bulan Ini / Semua',
        isi: 'Semua angka di Beranda mengikuti rentang ini. <b>Siklus</b> berarti gajian ke gajian — bukan bulan kalender — dan rentang persisnya tertulis di label kecil di atas tombol-tombol ini.',
        el: () => { const b = elId('btn-mode-period'); return b ? b.parentElement : null; }
    },
    {
        judul: 'Tombol Siklus Baru',
        isi: 'Begitu gaji masuk, tekan tombol ini untuk menandai <b>hari ini sebagai awal siklus baru</b>. Tanggalnya tersimpan dan menjadi jangkar siklus — caranya diatur lebih lanjut di Pengaturan, nanti kita ke sana.',
        el: () => document.querySelector('button[onclick*="startNewCycle"]')
    },
    {
        judul: 'Catat Lewat Kotak Ini',
        isi: 'Tidak perlu formulir panjang. Ketik kalimat biasa — misalnya <i>"kopi 15 ribu tunai"</i> — atau kirim <b>foto struk</b> dan <b>suara</b>. AI akan memecahnya menjadi item-item dan menawarkannya untuk diperiksa sebelum tersimpan.',
        el: () => elId('chat-bar')
    },
    {
        judul: 'Dompet-Dompetmu',
        isi: 'Setiap sumber uang punya kartunya sendiri: bank, tunai, e-wallet. Lewat tombol <b>Kelola</b> di atas daftar ini kamu bisa memindahkan saldo antar dompet (mutasi, bukan pengeluaran) dan menjalankan <b>Cek Saldo Nyata</b> — membandingkan saldo aplikasi dengan saldo bank atau hitungan uang fisik.',
        el: () => elId('dash-wallets')
    },
    {
        judul: 'Brankas: Simpanan & Misi',
        isi: 'Di sini tempat kantung tabungan biasa dan <b>Misi</b> (target belanja bertenggat, misalnya laptop). Uang yang masuk Brankas langsung mengurangi saldo yang bisa dibelanjakan, dan tidak ikut Net Worth. Ketuk panel ini untuk membukanya.',
        el: () => { const s = elId('dash-savings'); return s ? s.closest('[onclick]') : null; }
    },
    {
        judul: 'Riwayat Transaksi',
        isi: 'Seluruh catatan ada di tab ini. Cari menurut nama atau toko, saring menurut kategori, dan ketuk satu transaksi untuk mengubah atau menghapusnya. Transaksi yang terhapus masuk ke Tempat Sampah dulu, belum hilang permanen.',
        aksi: () => { if (typeof window.switchView === 'function') window.switchView('transactions'); },
        el: () => elId('filter-search')
    },
    {
        judul: 'Statistik',
        isi: 'Grafik arus masuk-keluar dan rincian per kategori untuk rentang yang sedang dipilih — Siklus, Bulan Ini, Semua, atau rentang tanggal khusus.',
        aksi: () => { if (typeof window.switchView === 'function') window.switchView('analytics'); },
        el: () => document.querySelector('#view-analytics .glass-panel')
    },
    {
        judul: 'Wawasan',
        isi: 'Analisa AI atas pola keuanganmu pada siklus berjalan, lengkap dengan <b>daftar periksa kewajiban</b> — kirim ke istri, kas apato, internet — supaya tidak ada yang terlewat sebelum siklus berganti.',
        aksi: () => { if (typeof window.switchView === 'function') window.switchView('oracle'); },
        el: () => elId('wawasan-container')
    },
    {
        judul: 'Pengaturan Siklus & Gajian',
        isi: 'Di sinilah tanggal-tanggal gajian nyatamu ditandai. Bulan yang belum ditandai akan diisi <b>hari gajian rutin</b> pilihanmu sebagai perkiraan — tanggal nyata selalu menang. Tanggal mendatang pun boleh ditandai dari sekarang.',
        aksi: () => { bukaPengaturanSeksi('sec-siklus'); },
        el: () => elId('sec-siklus')
    },
    {
        judul: 'Kulit Tampilan',
        isi: 'AuraFi punya lima kulit penuh — bukan sekadar ganti warna: tata letak rasa, huruf, sudut, dan bayangannya ikut berubah. Coba satu per satu dan pakai yang paling nyaman di mata.',
        aksi: () => { pastikanSeksi('sec-siklus', false); bukaPengaturanSeksi('sec-tampilan'); },
        el: () => { const b = document.querySelector('[data-skin-btn]'); return b ? b.parentElement : null; }
    },
    {
        judul: 'Selesai — Selamat Memakai',
        isi: 'Tur berakhir di sini. Bila suatu saat ingin mengulanginya, buka <b>Pengaturan → Panduan</b>. Selamat mencatat — semoga setiap yen-nya terlihat jelas.',
        aksi: () => { tutupPengaturan(); if (typeof window.switchView === 'function') window.switchView('dashboard'); },
        el: null
    }
];

const Tur = {
    idx: 0,
    aktif: false,
    akar: null,
    sorot: null,
    kartu: null,
    penunggu: null,

    mulai() {
        if (this.aktif) return;
        tutupPengaturan();
        if (typeof window.switchView === 'function') window.switchView('dashboard');
        this.bangunDom();
        this.aktif = true;
        this.ke(0, 1);
    },

    bangunDom() {
        this.hancurkanDom();
        const akar = document.createElement('div');
        akar.id = 'auraTour';
        akar.innerHTML =
            '<div id="auraTourSorot"></div>' +
            '<div id="auraTourKartu">' +
                '<p id="auraTourHitung"></p>' +
                '<h3 id="auraTourJudul"></h3>' +
                '<p id="auraTourIsi"></p>' +
                '<div id="auraTourTombol">' +
                    '<button id="auraTourLewati" type="button">Lewati</button>' +
                    '<span class="aura-tour-spasi"></span>' +
                    '<button id="auraTourKembali" type="button">Kembali</button>' +
                    '<button id="auraTourLanjut" type="button">Lanjut</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(akar);
        this.akar = akar;
        this.sorot = elId('auraTourSorot');
        this.kartu = elId('auraTourKartu');
        elId('auraTourLewati').addEventListener('click', () => this.selesai());
        elId('auraTourKembali').addEventListener('click', () => this.ke(this.idx - 1, -1));
        elId('auraTourLanjut').addEventListener('click', () => {
            if (this.idx >= LANGKAH.length - 1) this.selesai();
            else this.ke(this.idx + 1, 1);
        });
        this._padaGeser = () => this.posisiUlang();
        window.addEventListener('resize', this._padaGeser);
        window.addEventListener('scroll', this._padaGeser, true);
    },

    hancurkanDom() {
        if (this.penunggu) { clearInterval(this.penunggu); this.penunggu = null; }
        if (this._padaGeser) {
            window.removeEventListener('resize', this._padaGeser);
            window.removeEventListener('scroll', this._padaGeser, true);
            this._padaGeser = null;
        }
        const lama = elId('auraTour');
        if (lama) lama.remove();
        this.akar = this.sorot = this.kartu = null;
    },

    ke(i, arah) {
        if (i < 0) i = 0;
        if (i >= LANGKAH.length) { this.selesai(); return; }
        this.idx = i;
        const langkah = LANGKAH[i];
        if (typeof langkah.aksi === 'function') { try { langkah.aksi(); } catch (e) { /* abaikan */ } }
        elId('auraTourJudul').textContent = langkah.judul;
        elId('auraTourIsi').innerHTML = langkah.isi;
        elId('auraTourHitung').textContent = 'Langkah ' + (i + 1) + ' dari ' + LANGKAH.length;
        elId('auraTourKembali').style.visibility = i === 0 ? 'hidden' : 'visible';
        elId('auraTourLanjut').textContent = i >= LANGKAH.length - 1 ? 'Selesai' : 'Lanjut';
        this.tungguTarget(langkah, arah);
    },

    tungguTarget(langkah, arah) {
        if (this.penunggu) { clearInterval(this.penunggu); this.penunggu = null; }
        if (typeof langkah.el !== 'function') { this.posisi(null); return; }
        let target = null;
        try { target = langkah.el(); } catch (e) { target = null; }
        if (target) { try { target.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (e) { /* abaikan */ } }
        let terakhir = null;
        let stabil = 0;
        let percobaan = 0;
        this.penunggu = setInterval(() => {
            percobaan++;
            let t = null;
            try { t = langkah.el(); } catch (e) { t = null; }
            if (!t) {
                if (percobaan >= 14) {
                    clearInterval(this.penunggu); this.penunggu = null;
                    // Elemen tidak ditemukan (tampilan berubah): lewati langkah ini.
                    if (arah >= 0 && this.idx < LANGKAH.length - 1) this.ke(this.idx + 1, 1);
                    else if (arah < 0 && this.idx > 0) this.ke(this.idx - 1, -1);
                    else this.posisi(null);
                }
                return;
            }
            const r = t.getBoundingClientRect();
            const kunci = [Math.round(r.top), Math.round(r.left), Math.round(r.width), Math.round(r.height)].join(',');
            if (kunci === terakhir) stabil++; else { stabil = 0; terakhir = kunci; }
            if (stabil >= 2 || percobaan >= 14) {
                clearInterval(this.penunggu); this.penunggu = null;
                this._target = t;
                this.posisi(t);
            }
        }, 120);
    },

    posisiUlang() {
        if (!this.aktif) return;
        const langkah = LANGKAH[this.idx];
        if (!langkah || typeof langkah.el !== 'function') return;
        let t = null;
        try { t = langkah.el(); } catch (e) { t = null; }
        if (t) this.posisi(t);
    },

    posisi(target) {
        if (!this.sorot || !this.kartu) return;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const lebarKartu = Math.min(vw * 0.92, 350);
        this.kartu.style.width = lebarKartu + 'px';
        if (!target) {
            this.akar.style.background = 'rgba(3,7,12,0.78)';
            this.sorot.style.opacity = '0';
            const h = this.kartu.offsetHeight || 210;
            this.kartu.style.left = Math.max(12, (vw - lebarKartu) / 2) + 'px';
            this.kartu.style.top = Math.max(12, (vh - h) / 2) + 'px';
            return;
        }
        this.akar.style.background = 'transparent';
        this.sorot.style.opacity = '1';
        const r = target.getBoundingClientRect();
        const pad = 6;
        this.sorot.style.left = (r.left - pad) + 'px';
        this.sorot.style.top = (r.top - pad) + 'px';
        this.sorot.style.width = (r.width + pad * 2) + 'px';
        this.sorot.style.height = (r.height + pad * 2) + 'px';
        const hKartu = this.kartu.offsetHeight || 210;
        let atas;
        if (r.bottom + pad + 12 + hKartu <= vh - 8) atas = r.bottom + pad + 12;
        else if (r.top - pad - 12 - hKartu >= 8) atas = r.top - pad - 12 - hKartu;
        else atas = Math.max(8, vh - hKartu - 8);
        let kiri = Math.min(Math.max(12, r.left), vw - lebarKartu - 12);
        this.kartu.style.left = kiri + 'px';
        this.kartu.style.top = atas + 'px';
    },

    selesai() {
        try { localStorage.setItem(KUNCI_TUR, 'selesai'); } catch (e) { /* abaikan */ }
        this.aktif = false;
        this.hancurkanDom();
        tutupPengaturan();
        if (typeof window.switchView === 'function') window.switchView('dashboard');
    }
};

window.AuraTour = Tur;

// Muncul satu kali otomatis setelah masuk & data tampil.
(function jadwalMulaiOtomatis() {
    let percobaan = 0;
    const periksa = setInterval(() => {
        percobaan++;
        if (percobaan > 45 || Tur.aktif) { clearInterval(periksa); return; }
        let sudah = false;
        try { sudah = !!localStorage.getItem(KUNCI_TUR); } catch (e) { sudah = true; }
        if (sudah) { clearInterval(periksa); return; }
        const gerbang = elId('auth-gate');
        const gerbangTampil = gerbang && gerbang.offsetParent !== null && !gerbang.classList.contains('hidden');
        const beranda = elId('view-dashboard');
        const berandaTampil = beranda && !beranda.classList.contains('hidden');
        const dompet = elId('dash-wallets');
        const dataSiap = dompet && dompet.children.length > 0;
        if (!gerbangTampil && berandaTampil && dataSiap) {
            clearInterval(periksa);
            setTimeout(() => { if (!Tur.aktif) Tur.mulai(); }, 600);
        }
    }, 1000);
})();
