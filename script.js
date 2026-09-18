'use strict';

const LS = {
  rooms:    'simkos_rooms',
  tenants:  'simkos_tenants',
  payments: 'simkos_payments',
  settings: 'simkos_settings',
  session:  'simkos_session'
};

const DB = { rooms: [], tenants: [], payments: [], settings: {} };

const ui = {
  page: 'dashboard',
  kamar:     { q: '', status: 'all' },
  penghuni:  { q: '', status: 'Aktif', page: 1 },
  bayar:     { q: '', bulan: 'all', status: 'all', page: 1 },
  laporan:   { bulan: 'all', tahun: 'all', status: 'all' },
  riwayat:   { q: '' }
};

const PER_PAGE = 8;

const BULAN = ['Januari','Februari','Maret','April','Mei','Juni',
               'Juli','Agustus','September','Oktober','November','Desember'];
const BULAN_SINGKAT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.prototype.slice.call(root.querySelectorAll(sel));

function rupiah(n) {
  return 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
}

function pad2(n) { return String(n).padStart(2, '0'); }

function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function monthKeyOf(date) {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1);
}

function addMonths(key, diff) {
  const parts = key.split('-');
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1 + diff, 1);
  return monthKeyOf(d);
}

function labelBulan(key) {
  if (!key) return '-';
  const p = key.split('-');
  return BULAN[Number(p[1]) - 1] + ' ' + p[0];
}

function labelBulanSingkat(key) {
  const p = key.split('-');
  return BULAN_SINGKAT[Number(p[1]) - 1] + ' ' + p[0];
}

function labelTanggal(iso) {
  if (!iso) return '-';
  const p = iso.split('-');
  return Number(p[2]) + ' ' + BULAN_SINGKAT[Number(p[1]) - 1] + ' ' + p[0];
}

function tanggalJatuhTempo(monthKey, hari) {
  const p = monthKey.split('-');
  const tahun = Number(p[0]);
  const bulan = Number(p[1]);
  const hariTerakhir = new Date(tahun, bulan, 0).getDate();
  const d = Math.min(Math.max(Number(hari) || 5, 1), hariTerakhir);
  return monthKey + '-' + pad2(d);
}

function selisihHari(aISO, bISO) {
  const a = new Date(aISO + 'T00:00:00');
  const b = new Date(bISO + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function uid(prefix) {
  return prefix + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
}

function badgeClass(status) {
  const map = {
    'Terisi': 'terisi', 'Kosong': 'kosong', 'Maintenance': 'maintenance',
    'Lunas': 'lunas', 'Sebagian': 'sebagian', 'Belum Bayar': 'belum', 'Terlambat': 'terlambat',
    'Aktif': 'aktif', 'Tidak Aktif': 'nonaktif'
  };
  return map[status] || 'belum';
}

function badge(status) {
  return '<span class="badge badge--' + badgeClass(status) + '">' + escapeHtml(status) + '</span>';
}

function simpanSemua() {
  localStorage.setItem(LS.rooms, JSON.stringify(DB.rooms));
  localStorage.setItem(LS.tenants, JSON.stringify(DB.tenants));
  localStorage.setItem(LS.payments, JSON.stringify(DB.payments));
  localStorage.setItem(LS.settings, JSON.stringify(DB.settings));
}

function bacaJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Data ' + key + ' rusak, akan dibuat ulang.', e);
    return null;
  }
}

function muatData() {
  const rooms = bacaJSON(LS.rooms);
  const tenants = bacaJSON(LS.tenants);
  const payments = bacaJSON(LS.payments);
  const settings = bacaJSON(LS.settings);

  if (!Array.isArray(rooms) || !Array.isArray(tenants) || !Array.isArray(payments) || !settings) {
    isiDataDemo();
    simpanSemua();
    return;
  }

  DB.rooms = rooms;
  DB.tenants = tenants;
  DB.payments = payments;
  DB.settings = settings;
  sinkronStatusKamar();
}

function isiDataDemo() {
  const bulanIni = monthKeyOf(new Date());
  const hariJatuhTempo = 5;

  DB.settings = {
    namaKos: 'Kos Melati Asri',
    alamat: 'Jl. Kenanga No. 21, Margahayu, Bekasi Timur',
    telepon: '081234567890',
    jatuhTempo: hariJatuhTempo,
    username: 'admin',
    password: 'admin123'
  };

  const tipe = {
    Standar: { harga: 700000,  fasilitas: ['Kasur', 'Lemari', 'Meja', 'Kamar mandi luar'] },
    Deluxe:  { harga: 950000,  fasilitas: ['Kasur', 'Lemari', 'AC', 'Kamar mandi dalam'] },
    Premium: { harga: 1250000, fasilitas: ['Kasur', 'Lemari', 'AC', 'Kamar mandi dalam', 'WiFi', 'Meja kerja'] }
  };
  const daftarKamar = [
    ['A1','Standar'], ['A2','Standar'], ['A3','Standar'], ['A4','Standar'], ['A5','Standar'], ['A6','Standar'],
    ['B1','Deluxe'],  ['B2','Deluxe'],  ['B3','Deluxe'],  ['B4','Deluxe'],  ['B5','Deluxe'],
    ['C1','Premium'], ['C2','Premium'], ['C3','Premium'], ['C4','Premium']
  ];

  DB.rooms = daftarKamar.map(function (item, i) {
    return {
      id: 'KMR-' + pad2(i + 1),
      nomor: item[0],
      tipe: item[1],
      harga: tipe[item[1]].harga,
      fasilitas: tipe[item[1]].fasilitas.slice(),
      status: 'Kosong'
    };
  });
 
  DB.rooms[5].status = 'Maintenance'; // kamar A6

  const cariKamar = function (nomor) {
    return DB.rooms.filter(function (r) { return r.nomor === nomor; })[0];
  };

  const aktif = [
    ['Rani Puspita',      '081234567801', 'Perempuan', 'A1', -14, 'Jl. Mawar No. 3, Bekasi'],
    ['Dimas Prakoso',     '081234567802', 'Laki-laki', 'A2', -11, 'Jl. Anggrek No. 12, Cikarang'],
    ['Ayu Lestari',       '081234567803', 'Perempuan', 'A3',  -9, 'Jl. Melati No. 7, Tambun'],
    ['Bagas Saputra',     '081234567804', 'Laki-laki', 'A4',  -8, 'Jl. Merdeka No. 45, Bogor'],
    ['Nur Aini',          '081234567805', 'Perempuan', 'B1',  -6, 'Jl. Cempaka No. 9, Depok'],
    ['Fajar Ramadhan',    '081234567806', 'Laki-laki', 'B2',  -5, 'Jl. Kenari No. 18, Jakarta Timur'],
    ['Intan Permata',     '081234567807', 'Perempuan', 'B3',  -4, 'Jl. Flamboyan No. 2, Bekasi'],
    ['Rizky Maulana',     '081234567808', 'Laki-laki', 'C1',  -3, 'Jl. Pahlawan No. 31, Karawang'],
    ['Dewi Anggraini',    '081234567809', 'Perempuan', 'C2',  -2, 'Jl. Dahlia No. 5, Bekasi'],
    ['Yoga Pratama',      '081234567810', 'Laki-laki', 'C4',  -1, 'Jl. Sudirman No. 88, Bandung']
  ];

  const keluar = [
    ['Andi Kurniawan',   '081298765401', 'Laki-laki', 'A5', -12, -1, 'Jl. Gatot Subroto No. 4, Bekasi'],
    ['Melati Safitri',   '081298765402', 'Perempuan', 'B4', -10, -2, 'Jl. Teratai No. 16, Cibitung'],
    ['Hendra Gunawan',   '081298765403', 'Laki-laki', 'C3',  -9, -3, 'Jl. Diponegoro No. 22, Bekasi'],
    ['Tika Ramadhani',   '081298765404', 'Perempuan', 'B5', -13, -4, 'Jl. Kartini No. 11, Tangerang'],
    ['Bayu Saputro',     '081298765405', 'Laki-laki', 'A6', -15, -5, 'Jl. Veteran No. 27, Bekasi']
  ];

  DB.tenants = [];
  aktif.forEach(function (t, i) {
    const kamar = cariKamar(t[3]);
    DB.tenants.push({
      id: 'PGH-' + pad2(i + 1),
      nama: t[0],
      hp: t[1],
      jk: t[2],
      roomId: kamar.id,
      tglMasuk: addMonths(bulanIni, t[4]) + '-' + pad2(3 + (i % 5) * 4),
      tglKeluar: '',
      alamat: t[5],
      status: 'Aktif'
    });
  });
  keluar.forEach(function (t, i) {
    const kamar = cariKamar(t[3]);
    DB.tenants.push({
      id: 'PGH-' + pad2(11 + i),
      nama: t[0],
      hp: t[1],
      jk: t[2],
      roomId: kamar.id,
      tglMasuk: addMonths(bulanIni, t[4]) + '-' + pad2(2 + i * 3),
      tglKeluar: addMonths(bulanIni, t[5]) + '-' + pad2(25 - i * 2),
      alamat: t[6],
      status: 'Tidak Aktif'
    });
  });

   
  DB.payments = [];
  let urut = 1;

  const buatTagihan = function (tenant, monthKey, dibayar, tglBayar) {
    const kamar = DB.rooms.filter(function (r) { return r.id === tenant.roomId; })[0];
    const tagihan = kamar ? kamar.harga : 700000;
    DB.payments.push({
      id: 'BYR-' + pad2(urut++),
      tenantId: tenant.id,
      roomId: tenant.roomId,
      bulan: monthKey,
      jatuhTempo: tanggalJatuhTempo(monthKey, hariJatuhTempo),
      tagihan: tagihan,
      dibayar: dibayar === 'penuh' ? tagihan : Number(dibayar),
      tglBayar: tglBayar || ''
    });
  };

  const bulanWindow = [];
  for (let i = 5; i >= 0; i--) bulanWindow.push(addMonths(bulanIni, -i));
  const bulanDepan = addMonths(bulanIni, 1);
  const bulanLalu = addMonths(bulanIni, -1);

  const polaBulanIni = ['penuh', 'penuh', 'penuh', 500000, 0, 0, 'penuh', 600000, 'penuh', 0];
  const polaBulanDepan = ['penuh', 0, 0, 500000, 0, 0, 0, 600000, 0, 0];

  DB.tenants.filter(function (t) { return t.status === 'Aktif'; }).forEach(function (t, i) {
    const masukBulan = t.tglMasuk.slice(0, 7);

    bulanWindow.forEach(function (m) {
      if (m < masukBulan) return;

      if (m === bulanIni) {
        const pola = polaBulanIni[i];
        const bayar = pola === 'penuh' ? 'penuh' : pola;
        const tgl = bayar === 0 ? '' : m + '-' + pad2(2 + (i % 4));
        buatTagihan(t, m, bayar, tgl);
      } else if (m === bulanLalu && (i === 4 || i === 5)) {
        buatTagihan(t, m, 0, '');
      } else {
        buatTagihan(t, m, 'penuh', m + '-' + pad2(2 + (i % 4)));
      }
    });

    const polaDepan = polaBulanDepan[i];
    buatTagihan(t, bulanDepan, polaDepan, polaDepan === 0 ? '' : todayISO());
  });

  DB.tenants.filter(function (t) { return t.status === 'Tidak Aktif'; }).forEach(function (t, i) {
    const masukBulan = t.tglMasuk.slice(0, 7);
    const keluarBulan = t.tglKeluar.slice(0, 7);
    bulanWindow.forEach(function (m) {
      if (m < masukBulan || m > keluarBulan) return;
      buatTagihan(t, m, 'penuh', m + '-' + pad2(3 + (i % 3)));
    });
  });

  sinkronStatusKamar();
}

function sinkronStatusKamar() {
  DB.rooms.forEach(function (room) {
    const adaPenghuni = DB.tenants.some(function (t) {
      return t.status === 'Aktif' && t.roomId === room.id;
    });
    if (adaPenghuni) room.status = 'Terisi';
    else if (room.status !== 'Maintenance') room.status = 'Kosong';
  });
}

function getRoom(id)   { return DB.rooms.filter(function (r) { return r.id === id; })[0] || null; }
function getTenant(id) { return DB.tenants.filter(function (t) { return t.id === id; })[0] || null; }
function getPayment(id){ return DB.payments.filter(function (p) { return p.id === id; })[0] || null; }

function nomorKamar(id) {
  const r = getRoom(id);
  return r ? r.nomor : '—';
}
function namaPenghuni(id) {
  const t = getTenant(id);
  return t ? t.nama : '(penghuni dihapus)';
}

function penghuniKamar(roomId) {
  return DB.tenants.filter(function (t) {
    return t.status === 'Aktif' && t.roomId === roomId;
  })[0] || null;
}

function sisaTagihan(p) {
  return Math.max(0, Number(p.tagihan) - Number(p.dibayar));
}

function statusBayar(p) {
  if (Number(p.dibayar) >= Number(p.tagihan)) return 'Lunas';
  if (todayISO() > p.jatuhTempo) return 'Terlambat';
  return Number(p.dibayar) > 0 ? 'Sebagian' : 'Belum Bayar';
}

function infoJatuhTempo(p) {
  const hari = selisihHari(todayISO(), p.jatuhTempo);
  if (hari > 0) return 'Akan jatuh tempo ' + hari + ' hari lagi';
  if (hari === 0) return 'Jatuh tempo hari ini';
  return 'Terlambat ' + Math.abs(hari) + ' hari';
}

const IKON = {
  ok:    '<svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5"/></svg>',
  warn:  '<svg viewBox="0 0 24 24"><path d="M12 8v5"/><path d="M12 16.5h.01"/><path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3.1L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  err:   '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
  info:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>',
  plus:  '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  print: '<svg viewBox="0 0 24 24"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 15h12v6H6z"/></svg>'
};

function toast(pesan, tipe) {
  const root = $('#toastRoot');
  const el = document.createElement('div');
  const jenis = tipe || 'ok';
  el.className = 'toast toast--' + jenis;
  el.innerHTML = (jenis === 'err' ? IKON.err : jenis === 'warn' ? IKON.warn : IKON.ok) +
                 '<span>' + escapeHtml(pesan) + '</span>';
  root.appendChild(el);
  setTimeout(function () { el.remove(); }, 3200);
}

function tutupModal() { $('#modalRoot').innerHTML = ''; }

function bukaModal(opsi) {
  const lebar = opsi.lebar ? ' modal__box--' + opsi.lebar : '';
  $('#modalRoot').innerHTML = `
    <div class="modal" id="modalOverlay">
      <div class="modal__box${lebar}" role="dialog" aria-modal="true">
        <div class="modal__head">
          <div>
            <h3>${escapeHtml(opsi.judul)}</h3>
            ${opsi.sub ? `<p>${escapeHtml(opsi.sub)}</p>` : ''}
          </div>
          <button class="iconbtn" data-close aria-label="Tutup">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div class="modal__body">${opsi.isi}</div>
        <div class="modal__foot">${opsi.footer || ''}</div>
      </div>
    </div>`;

  const overlay = $('#modalOverlay');
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay || e.target.closest('[data-close]')) tutupModal();
  });
  const fokus = overlay.querySelector('input, select, textarea, button');
  if (fokus) fokus.focus();
  return overlay;
}

function konfirmasi(opsi) {
  return new Promise(function (resolve) {
    const overlay = bukaModal({
      judul: opsi.judul,
      isi: `<p style="color:var(--ink-2)">${escapeHtml(opsi.pesan)}</p>`,
      footer: `
        <button class="btn" data-no>Batal</button>
        <button class="btn ${opsi.bahaya ? 'btn--danger' : 'btn--primary'}" data-yes>${escapeHtml(opsi.tombol || 'Ya, lanjutkan')}</button>`,
      lebar: 'narrow'
    });
    overlay.addEventListener('click', function (e) {
      if (e.target.closest('[data-yes]')) { tutupModal(); resolve(true); }
      else if (e.target.closest('[data-no]') || e.target.closest('[data-close]') || e.target === overlay) {
        tutupModal(); resolve(false);
      }
    });
  });
}

function htmlPager(grup, totalData, halaman) {
  const totalHal = Math.max(1, Math.ceil(totalData / PER_PAGE));
  if (totalData === 0) return '';
  const dari = (halaman - 1) * PER_PAGE + 1;
  const sampai = Math.min(halaman * PER_PAGE, totalData);

  let tombol = `<button data-action="pager" data-grup="${grup}" data-hal="${halaman - 1}" ${halaman === 1 ? 'disabled' : ''}>‹</button>`;
  for (let i = 1; i <= totalHal; i++) {
    tombol += `<button data-action="pager" data-grup="${grup}" data-hal="${i}" class="${i === halaman ? 'is-active' : ''}">${i}</button>`;
  }
  tombol += `<button data-action="pager" data-grup="${grup}" data-hal="${halaman + 1}" ${halaman === totalHal ? 'disabled' : ''}>›</button>`;

  return `<div class="pager">
      <span class="pager__info">Menampilkan ${dari}–${sampai} dari ${totalData} data</span>
      <div class="pager__btns">${tombol}</div>
    </div>`;
}

function potongHalaman(arr, halaman) {
  const mulai = (halaman - 1) * PER_PAGE;
  return arr.slice(mulai, mulai + PER_PAGE);
}

function htmlKosong(judul, pesan) {
  return `<div class="empty"><strong>${escapeHtml(judul)}</strong>${escapeHtml(pesan)}</div>`;
}


function sedangLogin() {
  return localStorage.getItem(LS.session) === 'aktif' || sessionStorage.getItem(LS.session) === 'aktif';
}

function prosesLogin(e) {
  e.preventDefault();
  const user = $('#loginUser').value.trim();
  const pass = $('#loginPass').value;
  let valid = true;

  $('#errUser').textContent = '';
  $('#errPass').textContent = '';

  if (!user) { $('#errUser').textContent = 'Username wajib diisi.'; valid = false; }
  if (!pass) { $('#errPass').textContent = 'Password wajib diisi.'; valid = false; }
  if (!valid) return;

  if (user !== DB.settings.username || pass !== DB.settings.password) {
    $('#errPass').textContent = 'Username atau password salah.';
    toast('Login gagal. Periksa kembali data Anda.', 'err');
    return;
  }

  if ($('#loginRemember').checked) localStorage.setItem(LS.session, 'aktif');
  else sessionStorage.setItem(LS.session, 'aktif');

  $('#loginPass').value = '';
  tampilkanAplikasi();
  toast('Selamat datang kembali, pengelola.');
}

function logout() {
  konfirmasi({ judul: 'Keluar dari sistem?', pesan: 'Anda akan kembali ke halaman login. Data tetap tersimpan.', tombol: 'Keluar' })
    .then(function (ya) {
      if (!ya) return;
      localStorage.removeItem(LS.session);
      sessionStorage.removeItem(LS.session);
      $('#app').classList.add('hidden');
      $('#loginScreen').classList.remove('hidden');
      $('#loginUser').value = '';
      $('#loginPass').value = '';
    });
}

function tampilkanAplikasi() {
  $('#loginScreen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#sidebarKosName').textContent = DB.settings.namaKos;
  $('#avatarInitial').textContent = (DB.settings.username || 'A').charAt(0).toUpperCase();

  const d = new Date();
  $('#todayLabel').textContent = d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear();
  navigasi(ui.page);
}


const HALAMAN = {
  dashboard:  { judul: 'Dashboard',          sub: 'Ringkasan kondisi kos hari ini',           render: renderDashboard },
  kamar:      { judul: 'Data Kamar',         sub: 'Kelola kamar, harga, dan ketersediaan',    render: renderKamar },
  penghuni:   { judul: 'Data Penghuni',      sub: 'Data penyewa yang tinggal di kos',         render: renderPenghuni },
  pembayaran: { judul: 'Pembayaran',         sub: 'Tagihan sewa bulanan dan pelunasannya',    render: renderPembayaran },
  laporan:    { judul: 'Laporan',            sub: 'Rekap tagihan dan penerimaan per periode', render: renderLaporan },
  riwayat:    { judul: 'Riwayat Penghuni',   sub: 'Penghuni yang sudah keluar dari kos',      render: renderRiwayat },
  pengaturan: { judul: 'Pengaturan',         sub: 'Identitas kos dan preferensi sistem',      render: renderPengaturan }
};

function navigasi(nama) {
  const halaman = HALAMAN[nama] ? nama : 'dashboard';
  ui.page = halaman;

  $$('#mainNav .navitem').forEach(function (b) {
    b.classList.toggle('is-active', b.dataset.page === halaman);
  });
  $('#pageTitle').textContent = HALAMAN[halaman].judul;
  $('#pageSub').textContent = HALAMAN[halaman].sub;

  $('#content').innerHTML = '';
  HALAMAN[halaman].render();

  tutupSidebar();
  window.scrollTo({ top: 0 });
}

const RENDER_ULANG = {
  kamar: function () { renderKamarList(); },
  penghuni: function () { renderPenghuniList(); },
  bayar: function () { renderBayarList(); },
  laporan: function () { renderLaporanIsi(); },
  riwayat: function () { renderRiwayatList(); }
};


function renderDashboard() {
  const bulanIni = monthKeyOf(new Date());
  const hariIni = todayISO();

  const totalKamar = DB.rooms.length;
  const terisi = DB.rooms.filter(function (r) { return r.status === 'Terisi'; }).length;
  const kosong = DB.rooms.filter(function (r) { return r.status === 'Kosong'; }).length;
  const maintenance = DB.rooms.filter(function (r) { return r.status === 'Maintenance'; }).length;
  const penghuniAktif = DB.tenants.filter(function (t) { return t.status === 'Aktif'; }).length;
  const okupansi = totalKamar ? Math.round((terisi / totalKamar) * 100) : 0;

  const bayarBulanIni = DB.payments.filter(function (p) { return p.bulan === bulanIni; });
  const pendapatan = bayarBulanIni.reduce(function (s, p) { return s + Number(p.dibayar); }, 0);

  const belumLunas = DB.payments.filter(function (p) {
    return p.bulan <= bulanIni && statusBayar(p) !== 'Lunas';
  });
  const terlambat = DB.payments.filter(function (p) { return statusBayar(p) === 'Terlambat'; });
  const tunggakan = belumLunas.reduce(function (s, p) { return s + sisaTagihan(p); }, 0);


  const akanJatuhTempo = DB.payments.filter(function (p) {
    return statusBayar(p) !== 'Lunas' && p.jatuhTempo >= hariIni && selisihHari(hariIni, p.jatuhTempo) <= 30;
  }).sort(function (a, b) { return a.jatuhTempo < b.jatuhTempo ? -1 : 1; });

  const penghuniTerbaru = DB.tenants.filter(function (t) { return t.status === 'Aktif'; })
    .slice().sort(function (a, b) { return a.tglMasuk < b.tglMasuk ? 1 : -1; }).slice(0, 5);


  let notif = '';
  if (terlambat.length) {
    const contoh = terlambat[0];
    notif += `<div class="notice notice--danger">${IKON.warn}
      <div><b>${terlambat.length} penghuni memiliki pembayaran terlambat.</b><br>
      ${escapeHtml(namaPenghuni(contoh.tenantId))} — pembayaran ${escapeHtml(labelBulan(contoh.bulan))} belum lunas,
      kurang ${rupiah(sisaTagihan(contoh))}.</div></div>`;
  }
  const jatuhTempoHariIni = akanJatuhTempo.filter(function (p) { return p.jatuhTempo === hariIni; });
  if (jatuhTempoHariIni.length) {
    notif += `<div class="notice notice--warn">${IKON.info}
      <div><b>${jatuhTempoHariIni.length} tagihan jatuh tempo hari ini.</b> Segera ingatkan penghuni terkait.</div></div>`;
  }
  if (!terlambat.length && !jatuhTempoHariIni.length) {
    notif = `<div class="notice notice--ok">${IKON.ok}
      <div>Tidak ada pembayaran yang terlambat. Semua tagihan dalam kondisi terkendali.</div></div>`;
  }


  const bulanGrafik = [];
  for (let i = 5; i >= 0; i--) bulanGrafik.push(addMonths(bulanIni, -i));
  const nilai = bulanGrafik.map(function (m) {
    return DB.payments.filter(function (p) { return p.bulan === m; })
      .reduce(function (s, p) { return s + Number(p.dibayar); }, 0);
  });
  const maksimal = Math.max.apply(null, nilai.concat([1]));
  const grafik = bulanGrafik.map(function (m, i) {
    const tinggi = Math.round((nilai[i] / maksimal) * 100);
    return `<div class="chart__col">
        <span class="chart__val">${nilai[i] ? Math.round(nilai[i] / 1000) + 'rb' : '0'}</span>
        <div class="chart__bar ${m === bulanIni ? 'is-current' : ''}" style="height:${Math.max(tinggi, 2)}%"></div>
        <span class="chart__lbl">${BULAN_SINGKAT[Number(m.split('-')[1]) - 1]}</span>
      </div>`;
  }).join('');

  
  $('#content').innerHTML = `
    ${notif}

    <div class="stats">
      <div class="stat stat--accent">
        <div class="stat__label">Pendapatan ${escapeHtml(labelBulan(bulanIni))}</div>
        <div class="stat__value is-money">${rupiah(pendapatan)}</div>
        <div class="stat__foot">Dari ${bayarBulanIni.length} tagihan bulan ini</div>
      </div>
      <div class="stat">
        <div class="stat__label">Okupansi kamar</div>
        <div class="stat__value">${okupansi}%</div>
        <div class="progress"><div class="progress__fill" style="width:${okupansi}%"></div></div>
        <div class="stat__foot">${terisi} dari ${totalKamar} kamar terisi</div>
      </div>
      <div class="stat">
        <div class="stat__label">Total kamar</div>
        <div class="stat__value">${totalKamar}</div>
        <div class="stat__foot">${kosong} kosong · ${maintenance} perbaikan</div>
      </div>
      <div class="stat">
        <div class="stat__label">Penghuni aktif</div>
        <div class="stat__value">${penghuniAktif}</div>
        <div class="stat__foot">Tercatat tinggal saat ini</div>
      </div>
      <div class="stat">
        <div class="stat__label">Pembayaran belum lunas</div>
        <div class="stat__value">${belumLunas.length}</div>
        <div class="stat__foot">Nilai tunggakan ${rupiah(tunggakan)}</div>
      </div>
      <div class="stat">
        <div class="stat__label">Pembayaran terlambat</div>
        <div class="stat__value">${terlambat.length}</div>
        <div class="stat__foot">Melewati tanggal jatuh tempo</div>
      </div>
    </div>

    <div class="grid-3 section">
      <div class="card">
        <div class="card__head">
          <div><h3>Pendapatan enam bulan terakhir</h3><p>Jumlah uang yang benar-benar diterima</p></div>
        </div>
        <div class="card__body"><div class="chart">${grafik}</div></div>
      </div>

      <div class="card">
        <div class="card__head"><div><h3>Akan jatuh tempo</h3><p>30 hari ke depan</p></div></div>
        ${akanJatuhTempo.length ? `<div class="list">${akanJatuhTempo.slice(0, 5).map(function (p) {
          return `<div class="list__item">
              <div class="list__main">
                <strong>${escapeHtml(namaPenghuni(p.tenantId))}</strong>
                <span>Kamar ${escapeHtml(nomorKamar(p.roomId))} · ${escapeHtml(labelBulan(p.bulan))}</span>
              </div>
              <div class="list__side">${rupiah(sisaTagihan(p))}<br><span class="sub muted">${escapeHtml(infoJatuhTempo(p))}</span></div>
            </div>`;
        }).join('')}</div>` : htmlKosong('Tidak ada tagihan mendekati jatuh tempo', 'Semua tagihan terdekat sudah dilunasi.')}
      </div>
    </div>

    <div class="grid2">
      <div class="card">
        <div class="card__head"><div><h3>Pembayaran terlambat</h3><p>Perlu segera ditagih</p></div></div>
        ${terlambat.length ? `<div class="list">${terlambat.slice(0, 5).map(function (p) {
          return `<div class="list__item">
              <div class="list__main">
                <strong>${escapeHtml(namaPenghuni(p.tenantId))}</strong>
                <span>Kamar ${escapeHtml(nomorKamar(p.roomId))} · ${escapeHtml(labelBulan(p.bulan))} · jatuh tempo ${escapeHtml(labelTanggal(p.jatuhTempo))}</span>
              </div>
              <div class="list__side">${badge('Terlambat')}<br><span class="sub muted">Sisa ${rupiah(sisaTagihan(p))}</span></div>
            </div>`;
        }).join('')}</div>` : htmlKosong('Tidak ada keterlambatan', 'Semua penghuni membayar tepat waktu.')}
      </div>

      <div class="card">
        <div class="card__head"><div><h3>Penghuni terbaru</h3><p>Lima penghuni yang paling akhir masuk</p></div></div>
        ${penghuniTerbaru.length ? `<div class="list">${penghuniTerbaru.map(function (t) {
          return `<div class="list__item">
              <div class="list__main">
                <strong>${escapeHtml(t.nama)}</strong>
                <span>Kamar ${escapeHtml(nomorKamar(t.roomId))} · ${escapeHtml(t.hp)}</span>
              </div>
              <div class="list__side">${escapeHtml(labelTanggal(t.tglMasuk))}</div>
            </div>`;
        }).join('')}</div>` : htmlKosong('Belum ada penghuni', 'Tambahkan penghuni melalui menu Data Penghuni.')}
      </div>
    </div>`;
}


function renderKamar() {
  $('#content').innerHTML = `
    <div class="toolbar">
      <div class="search">${IKON.search}
        <input type="text" placeholder="Cari nomor atau tipe kamar" data-filter="kamar.q" value="${escapeHtml(ui.kamar.q)}" />
      </div>
      <select data-filter="kamar.status">
        <option value="all">Semua status</option>
        <option value="Kosong">Kosong</option>
        <option value="Terisi">Terisi</option>
        <option value="Maintenance">Maintenance</option>
      </select>
      <div class="toolbar__spacer"></div>
      <button class="btn btn--primary" data-action="kamar-tambah">${IKON.plus} Tambah kamar</button>
    </div>
    <div id="listArea"></div>`;

  $('[data-filter="kamar.status"]').value = ui.kamar.status;
  renderKamarList();
}

function filterKamar() {
  const q = ui.kamar.q.toLowerCase().trim();
  return DB.rooms.filter(function (r) {
    const cocokTeks = !q || r.nomor.toLowerCase().indexOf(q) > -1 || r.tipe.toLowerCase().indexOf(q) > -1;
    const cocokStatus = ui.kamar.status === 'all' || r.status === ui.kamar.status;
    return cocokTeks && cocokStatus;
  });
}

function renderKamarList() {
  const data = filterKamar();
  const area = $('#listArea');
  if (!area) return;

  if (!data.length) {
    area.innerHTML = `<div class="card">${htmlKosong('Kamar tidak ditemukan', 'Ubah kata kunci pencarian atau filter status.')}</div>`;
    return;
  }

  area.innerHTML = `<div class="rooms">${data.map(function (r) {
    const penghuni = penghuniKamar(r.id);
    return `<article class="room">
        <div class="room__top">
          <div>
            <div class="room__no">Kamar ${escapeHtml(r.nomor)}</div>
            <div class="room__type">${escapeHtml(r.tipe)}</div>
          </div>
          ${badge(r.status)}
        </div>
        <div class="room__price">${rupiah(r.harga)} <span>/ bulan</span></div>
        <div class="room__facs">${r.fasilitas.slice(0, 4).map(function (f) {
          return `<span class="chip">${escapeHtml(f)}</span>`;
        }).join('')}</div>
        <div class="room__tenant">${penghuni
          ? 'Ditempati <b>' + escapeHtml(penghuni.nama) + '</b>'
          : (r.status === 'Maintenance' ? 'Sedang diperbaiki' : 'Belum ada penghuni')}</div>
        <div class="room__actions">
          <button class="btn btn--sm" data-action="kamar-detail" data-id="${r.id}">Detail</button>
          <button class="btn btn--sm" data-action="kamar-edit" data-id="${r.id}">Edit</button>
          <button class="btn btn--sm btn--ghost" data-action="kamar-hapus" data-id="${r.id}">Hapus</button>
        </div>
      </article>`;
  }).join('')}</div>`;
}

function formKamar(id) {
  const kamar = id ? getRoom(id) : null;
  const overlay = bukaModal({
    judul: kamar ? 'Edit kamar ' + kamar.nomor : 'Tambah kamar baru',
    sub: 'Nomor kamar tidak boleh sama dengan kamar lain.',
    isi: `
      <form id="formKamar" novalidate>
        <div class="form-grid">
          <label class="field">
            <span>Nomor kamar *</span>
            <input type="text" name="nomor" value="${escapeHtml(kamar ? kamar.nomor : '')}" placeholder="Contoh: A7" />
            <small class="err" data-err="nomor"></small>
          </label>
          <label class="field">
            <span>Tipe kamar *</span>
            <select name="tipe">
              <option value="Standar">Standar</option>
              <option value="Deluxe">Deluxe</option>
              <option value="Premium">Premium</option>
            </select>
            <small class="err"></small>
          </label>
          <label class="field">
            <span>Harga sewa per bulan *</span>
            <input type="number" name="harga" min="1" step="50000" value="${kamar ? kamar.harga : ''}" placeholder="700000" />
            <small class="err" data-err="harga"></small>
          </label>
          <label class="field">
            <span>Status kamar</span>
            <select name="status">
              <option value="Kosong">Kosong</option>
              <option value="Maintenance">Maintenance</option>
            </select>
            <small class="err" data-err="status"></small>
          </label>
          <label class="field full">
            <span>Fasilitas</span>
            <input type="text" name="fasilitas" value="${escapeHtml(kamar ? kamar.fasilitas.join(', ') : '')}" placeholder="Kasur, Lemari, AC (pisahkan dengan koma)" />
            <small class="err"></small>
          </label>
        </div>
      </form>`,
    footer: `<button class="btn" data-close>Batal</button>
             <button class="btn btn--primary" data-simpan>${kamar ? 'Simpan perubahan' : 'Simpan kamar'}</button>`,
    lebar: 'wide'
  });

  const form = $('#formKamar');
  if (kamar) {
    form.tipe.value = kamar.tipe;
    form.status.value = kamar.status === 'Terisi' ? 'Kosong' : kamar.status;
    if (kamar.status === 'Terisi') {
      form.status.disabled = true;
      form.querySelector('[data-err="status"]').textContent = 'Kamar sedang ditempati, status dikunci menjadi Terisi.';
    }
  }

  const simpan = function () {
    const nomor = form.nomor.value.trim();
    const harga = Number(form.harga.value);
    let valid = true;

    $$('[data-err]', form).forEach(function (el) { if (el.dataset.err !== 'status') el.textContent = ''; });

    if (!nomor) { form.querySelector('[data-err="nomor"]').textContent = 'Nomor kamar wajib diisi.'; valid = false; }
    else {
      const kembar = DB.rooms.some(function (r) {
        return r.nomor.toLowerCase() === nomor.toLowerCase() && (!kamar || r.id !== kamar.id);
      });
      if (kembar) { form.querySelector('[data-err="nomor"]').textContent = 'Nomor kamar ini sudah dipakai.'; valid = false; }
    }
    if (!harga || harga <= 0) { form.querySelector('[data-err="harga"]').textContent = 'Harga sewa harus lebih dari 0.'; valid = false; }
    if (!valid) return;

    const fasilitas = form.fasilitas.value.split(',').map(function (f) { return f.trim(); })
      .filter(function (f) { return f.length; });

    if (kamar) {
      kamar.nomor = nomor;
      kamar.tipe = form.tipe.value;
      kamar.harga = harga;
      kamar.fasilitas = fasilitas;
      if (!form.status.disabled) kamar.status = form.status.value;
    } else {
      DB.rooms.push({
        id: uid('KMR'), nomor: nomor, tipe: form.tipe.value, harga: harga,
        fasilitas: fasilitas, status: form.status.value
      });
    }

    sinkronStatusKamar();
    simpanSemua();
    tutupModal();
    renderKamarList();
    toast(kamar ? 'Perubahan kamar tersimpan.' : 'Kamar baru ditambahkan.');
  };

  overlay.addEventListener('click', function (e) { if (e.target.closest('[data-simpan]')) simpan(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); simpan(); });
}

function detailKamar(id) {
  const r = getRoom(id);
  if (!r) return;
  const penghuni = penghuniKamar(r.id);
  const riwayat = DB.tenants.filter(function (t) { return t.roomId === r.id && t.status === 'Tidak Aktif'; });

  bukaModal({
    judul: 'Kamar ' + r.nomor,
    sub: 'Kode kamar ' + r.id,
    isi: `<dl class="detail">
        <dt>Tipe</dt><dd>${escapeHtml(r.tipe)}</dd>
        <dt>Harga sewa</dt><dd>${rupiah(r.harga)} / bulan</dd>
        <dt>Status</dt><dd>${badge(r.status)}</dd>
        <dt>Fasilitas</dt><dd>${r.fasilitas.length ? escapeHtml(r.fasilitas.join(', ')) : '—'}</dd>
        <dt>Penghuni saat ini</dt><dd>${penghuni ? escapeHtml(penghuni.nama) + ' · ' + escapeHtml(penghuni.hp) : '—'}</dd>
        <dt>Pernah dihuni</dt><dd>${riwayat.length ? escapeHtml(riwayat.map(function (t) { return t.nama; }).join(', ')) : '—'}</dd>
      </dl>`,
    footer: `<button class="btn" data-close>Tutup</button>`
  });
}

function hapusKamar(id) {
  const r = getRoom(id);
  if (!r) return;
  const penghuni = penghuniKamar(r.id);

  const pesan = penghuni
    ? 'Kamar ' + r.nomor + ' sedang ditempati ' + penghuni.nama + '. Jika dilanjutkan, penghuni tersebut ikut dinonaktifkan dan masuk ke riwayat penghuni.'
    : 'Kamar ' + r.nomor + ' akan dihapus permanen dari daftar kamar. Tindakan ini tidak bisa dibatalkan.';

  konfirmasi({ judul: 'Hapus kamar ' + r.nomor + '?', pesan: pesan, tombol: 'Hapus kamar', bahaya: true })
    .then(function (ya) {
      if (!ya) return;
      if (penghuni) {
        penghuni.status = 'Tidak Aktif';
        penghuni.tglKeluar = todayISO();
      }
      DB.rooms = DB.rooms.filter(function (x) { return x.id !== id; });
      sinkronStatusKamar();
      simpanSemua();
      renderKamarList();
      toast('Kamar ' + r.nomor + ' dihapus.', 'warn');
    });
}


function renderPenghuni() {
  $('#content').innerHTML = `
    <div class="toolbar">
      <div class="search">${IKON.search}
        <input type="text" placeholder="Cari nama, nomor HP, atau kamar" data-filter="penghuni.q" value="${escapeHtml(ui.penghuni.q)}" />
      </div>
      <select data-filter="penghuni.status">
        <option value="all">Semua status</option>
        <option value="Aktif">Aktif</option>
        <option value="Tidak Aktif">Tidak aktif</option>
      </select>
      <div class="toolbar__spacer"></div>
      <button class="btn btn--primary" data-action="penghuni-tambah">${IKON.plus} Tambah penghuni</button>
    </div>
    <div class="card card__body--flush" id="listArea"></div>`;

  $('[data-filter="penghuni.status"]').value = ui.penghuni.status;
  renderPenghuniList();
}

function filterPenghuni() {
  const q = ui.penghuni.q.toLowerCase().trim();
  return DB.tenants.filter(function (t) {
    const kamar = nomorKamar(t.roomId).toLowerCase();
    const cocokTeks = !q || t.nama.toLowerCase().indexOf(q) > -1 || t.hp.indexOf(q) > -1 || kamar.indexOf(q) > -1;
    const cocokStatus = ui.penghuni.status === 'all' || t.status === ui.penghuni.status;
    return cocokTeks && cocokStatus;
  }).sort(function (a, b) { return a.nama.localeCompare(b.nama); });
}

function renderPenghuniList() {
  const semua = filterPenghuni();
  const totalHal = Math.max(1, Math.ceil(semua.length / PER_PAGE));
  if (ui.penghuni.page > totalHal) ui.penghuni.page = totalHal;
  const data = potongHalaman(semua, ui.penghuni.page);

  const area = $('#listArea');
  if (!area) return;

  if (!semua.length) {
    area.innerHTML = htmlKosong('Penghuni tidak ditemukan', 'Coba ubah kata kunci atau filter status.');
    return;
  }

  area.innerHTML = `
    <div class="tablewrap">
      <table class="tbl">
        <thead><tr>
          <th>Penghuni</th><th>Jenis kelamin</th><th>Kamar</th><th>Tanggal masuk</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>${data.map(function (t) {
          return `<tr>
            <td><div class="name">${escapeHtml(t.nama)}</div><div class="sub">${escapeHtml(t.hp)}</div></td>
            <td>${escapeHtml(t.jk)}</td>
            <td>${escapeHtml(nomorKamar(t.roomId))}</td>
            <td class="nowrap">${escapeHtml(labelTanggal(t.tglMasuk))}</td>
            <td>${badge(t.status)}</td>
            <td><div class="rowact">
              <button class="btn btn--sm" data-action="penghuni-detail" data-id="${t.id}">Detail</button>
              <button class="btn btn--sm" data-action="penghuni-edit" data-id="${t.id}">Edit</button>
              ${t.status === 'Aktif'
                ? `<button class="btn btn--sm btn--ghost" data-action="penghuni-nonaktif" data-id="${t.id}">Nonaktifkan</button>`
                : `<button class="btn btn--sm btn--ghost" data-action="penghuni-hapus" data-id="${t.id}">Hapus</button>`}
            </div></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>
    ${htmlPager('penghuni', semua.length, ui.penghuni.page)}`;
}

function opsiKamar(terpilih) {
  return DB.rooms.filter(function (r) {
    if (r.id === terpilih) return true;
    return r.status === 'Kosong';
  }).map(function (r) {
    return `<option value="${r.id}" ${r.id === terpilih ? 'selected' : ''}>Kamar ${escapeHtml(r.nomor)} — ${escapeHtml(r.tipe)} (${rupiah(r.harga)})</option>`;
  }).join('');
}

function formPenghuni(id) {
  const t = id ? getTenant(id) : null;
  const pilihanKamar = opsiKamar(t ? t.roomId : '');

  if (!pilihanKamar) {
    toast('Tidak ada kamar kosong. Tambah kamar dulu.', 'warn');
    return;
  }

  const overlay = bukaModal({
    judul: t ? 'Edit data ' + t.nama : 'Tambah penghuni baru',
    sub: 'Satu kamar hanya boleh ditempati satu penghuni aktif.',
    isi: `
      <form id="formPenghuni" novalidate>
        <div class="form-grid">
          <label class="field">
            <span>Nama lengkap *</span>
            <input type="text" name="nama" value="${escapeHtml(t ? t.nama : '')}" placeholder="Contoh: Rani Puspita" />
            <small class="err" data-err="nama"></small>
          </label>
          <label class="field">
            <span>Nomor HP *</span>
            <input type="text" name="hp" value="${escapeHtml(t ? t.hp : '')}" placeholder="08xxxxxxxxxx" />
            <small class="err" data-err="hp"></small>
          </label>
          <label class="field">
            <span>Jenis kelamin *</span>
            <select name="jk">
              <option value="Laki-laki">Laki-laki</option>
              <option value="Perempuan">Perempuan</option>
            </select>
            <small class="err"></small>
          </label>
          <label class="field">
            <span>Kamar *</span>
            <select name="roomId">${pilihanKamar}</select>
            <small class="err" data-err="roomId"></small>
          </label>
          <label class="field">
            <span>Tanggal masuk *</span>
            <input type="date" name="tglMasuk" value="${escapeHtml(t ? t.tglMasuk : todayISO())}" />
            <small class="err" data-err="tglMasuk"></small>
          </label>
          <label class="field">
            <span>Status penghuni</span>
            <select name="status">
              <option value="Aktif">Aktif</option>
              <option value="Tidak Aktif">Tidak aktif (sudah keluar)</option>
            </select>
            <small class="err"></small>
          </label>
          <label class="field full" id="wrapKeluar" style="display:none">
            <span>Tanggal keluar *</span>
            <input type="date" name="tglKeluar" value="${escapeHtml(t ? t.tglKeluar : '')}" />
            <small class="err" data-err="tglKeluar"></small>
          </label>
          <label class="field full">
            <span>Alamat asal</span>
            <textarea name="alamat" placeholder="Alamat rumah penghuni">${escapeHtml(t ? t.alamat : '')}</textarea>
            <small class="err"></small>
          </label>
        </div>
      </form>`,
    footer: `<button class="btn" data-close>Batal</button>
             <button class="btn btn--primary" data-simpan>${t ? 'Simpan perubahan' : 'Simpan penghuni'}</button>`,
    lebar: 'wide'
  });

  const form = $('#formPenghuni');
  if (t) { form.jk.value = t.jk; form.status.value = t.status; }

  const aturTampilanKeluar = function () {
    $('#wrapKeluar').style.display = form.status.value === 'Tidak Aktif' ? 'block' : 'none';
  };
  form.status.addEventListener('change', aturTampilanKeluar);
  aturTampilanKeluar();

  const simpan = function () {
    const nama = form.nama.value.trim();
    const hp = form.hp.value.trim();
    const roomId = form.roomId.value;
    const tglMasuk = form.tglMasuk.value;
    const status = form.status.value;
    const tglKeluar = form.tglKeluar.value;
    let valid = true;

    $$('[data-err]', form).forEach(function (el) { el.textContent = ''; });

    if (!nama) { form.querySelector('[data-err="nama"]').textContent = 'Nama wajib diisi.'; valid = false; }
    if (!hp) { form.querySelector('[data-err="hp"]').textContent = 'Nomor HP wajib diisi.'; valid = false; }
    else if (!/^(\+62|62|0)8[1-9][0-9]{6,11}$/.test(hp.replace(/[\s-]/g, ''))) {
      form.querySelector('[data-err="hp"]').textContent = 'Format nomor HP tidak valid. Contoh: 081234567890.'; valid = false;
    }
    if (!roomId) { form.querySelector('[data-err="roomId"]').textContent = 'Kamar wajib dipilih.'; valid = false; }
    if (!tglMasuk) { form.querySelector('[data-err="tglMasuk"]').textContent = 'Tanggal masuk wajib diisi.'; valid = false; }
    if (status === 'Tidak Aktif') {
      if (!tglKeluar) { form.querySelector('[data-err="tglKeluar"]').textContent = 'Tanggal keluar wajib diisi.'; valid = false; }
      else if (tglKeluar < tglMasuk) { form.querySelector('[data-err="tglKeluar"]').textContent = 'Tanggal keluar tidak boleh sebelum tanggal masuk.'; valid = false; }
    }

    // Pastikan kamar tidak ditempati penghuni aktif lain
    if (status === 'Aktif' && roomId) {
      const penghuniLain = DB.tenants.some(function (x) {
        return x.status === 'Aktif' && x.roomId === roomId && (!t || x.id !== t.id);
      });
      if (penghuniLain) {
        form.querySelector('[data-err="roomId"]').textContent = 'Kamar ini sudah memiliki penghuni aktif.'; valid = false;
      }
    }
    if (!valid) return;

    if (t) {
      t.nama = nama; t.hp = hp; t.jk = form.jk.value;
      t.roomId = roomId; t.tglMasuk = tglMasuk; t.alamat = form.alamat.value.trim();
      t.status = status;
      t.tglKeluar = status === 'Tidak Aktif' ? tglKeluar : '';
    } else {
      DB.tenants.push({
        id: uid('PGH'), nama: nama, hp: hp, jk: form.jk.value, roomId: roomId,
        tglMasuk: tglMasuk, tglKeluar: status === 'Tidak Aktif' ? tglKeluar : '',
        alamat: form.alamat.value.trim(), status: status
      });
    }

    sinkronStatusKamar(); // kamar lama otomatis kosong, kamar baru terisi
    simpanSemua();
    tutupModal();
    renderPenghuniList();
    toast(t ? 'Data penghuni diperbarui.' : 'Penghuni baru ditambahkan.');
  };

  overlay.addEventListener('click', function (e) { if (e.target.closest('[data-simpan]')) simpan(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); simpan(); });
}

function detailPenghuni(id) {
  const t = getTenant(id);
  if (!t) return;
  const tagihan = DB.payments.filter(function (p) { return p.tenantId === t.id; })
    .sort(function (a, b) { return a.bulan < b.bulan ? 1 : -1; });
  const tunggakan = tagihan.filter(function (p) { return statusBayar(p) !== 'Lunas'; })
    .reduce(function (s, p) { return s + sisaTagihan(p); }, 0);

  bukaModal({
    judul: t.nama,
    sub: 'Kode penghuni ' + t.id,
    isi: `
      <dl class="detail">
        <dt>Nomor HP</dt><dd>${escapeHtml(t.hp)}</dd>
        <dt>Jenis kelamin</dt><dd>${escapeHtml(t.jk)}</dd>
        <dt>Kamar</dt><dd>${escapeHtml(nomorKamar(t.roomId))}</dd>
        <dt>Tanggal masuk</dt><dd>${escapeHtml(labelTanggal(t.tglMasuk))}</dd>
        ${t.tglKeluar ? `<dt>Tanggal keluar</dt><dd>${escapeHtml(labelTanggal(t.tglKeluar))}</dd>` : ''}
        <dt>Alamat asal</dt><dd>${t.alamat ? escapeHtml(t.alamat) : '—'}</dd>
        <dt>Status</dt><dd>${badge(t.status)}</dd>
        <dt>Tunggakan</dt><dd>${tunggakan ? rupiah(tunggakan) : 'Tidak ada'}</dd>
      </dl>
      <h4 style="margin:18px 0 8px;font-size:14.5px">Riwayat pembayaran</h4>
      ${tagihan.length ? `<div class="tablewrap"><table class="tbl">
        <thead><tr><th>Bulan</th><th>Tagihan</th><th>Dibayar</th><th>Status</th></tr></thead>
        <tbody>${tagihan.slice(0, 8).map(function (p) {
          return `<tr><td class="nowrap">${escapeHtml(labelBulan(p.bulan))}</td><td>${rupiah(p.tagihan)}</td>
                  <td>${rupiah(p.dibayar)}</td><td>${badge(statusBayar(p))}</td></tr>`;
        }).join('')}</tbody></table></div>`
      : '<p class="muted">Belum ada data pembayaran.</p>'}`,
    footer: `<button class="btn" data-close>Tutup</button>`,
    lebar: 'wide'
  });
}

function nonaktifkanPenghuni(id) {
  const t = getTenant(id);
  if (!t) return;

  const overlay = bukaModal({
    judul: 'Nonaktifkan ' + t.nama + '?',
    sub: 'Data penghuni tetap tersimpan dan pindah ke Riwayat Penghuni.',
    isi: `
      <form id="formKeluar" novalidate>
        <label class="field">
          <span>Tanggal keluar *</span>
          <input type="date" name="tglKeluar" value="${todayISO()}" />
          <small class="err" data-err="tglKeluar"></small>
        </label>
        <p class="muted" style="font-size:13.5px">Kamar ${escapeHtml(nomorKamar(t.roomId))} otomatis berubah menjadi kosong.</p>
      </form>`,
    footer: `<button class="btn" data-close>Batal</button>
             <button class="btn btn--primary" data-simpan>Nonaktifkan</button>`,
    lebar: 'narrow'
  });

  const form = $('#formKeluar');
  const simpan = function () {
    const tgl = form.tglKeluar.value;
    const errEl = form.querySelector('[data-err="tglKeluar"]');
    errEl.textContent = '';
    if (!tgl) { errEl.textContent = 'Tanggal keluar wajib diisi.'; return; }
    if (tgl < t.tglMasuk) { errEl.textContent = 'Tanggal keluar tidak boleh sebelum tanggal masuk.'; return; }

    t.status = 'Tidak Aktif';
    t.tglKeluar = tgl;
    sinkronStatusKamar();
    simpanSemua();
    tutupModal();
    renderPenghuniList();
    toast(t.nama + ' dipindahkan ke riwayat penghuni.');
  };

  overlay.addEventListener('click', function (e) { if (e.target.closest('[data-simpan]')) simpan(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); simpan(); });
}

function hapusPenghuni(id) {
  const t = getTenant(id);
  if (!t) return;
  const jumlahBayar = DB.payments.filter(function (p) { return p.tenantId === t.id; }).length;

  konfirmasi({
    judul: 'Hapus data ' + t.nama + '?',
    pesan: 'Data penghuni beserta ' + jumlahBayar + ' catatan pembayarannya akan hilang permanen. Untuk penghuni yang sekadar pindah keluar, gunakan tombol Nonaktifkan agar riwayat tetap tersimpan.',
    tombol: 'Hapus permanen',
    bahaya: true
  }).then(function (ya) {
    if (!ya) return;
    DB.tenants = DB.tenants.filter(function (x) { return x.id !== id; });
    DB.payments = DB.payments.filter(function (p) { return p.tenantId !== id; });
    sinkronStatusKamar();
    simpanSemua();
    if (ui.page === 'riwayat') renderRiwayatList(); else renderPenghuniList();
    toast('Data penghuni dihapus.', 'warn');
  });
}

/* ============================================================
   11. HALAMAN PEMBAYARAN
   ============================================================ */

function daftarBulanTersedia() {
  const set = {};
  DB.payments.forEach(function (p) { set[p.bulan] = true; });
  return Object.keys(set).sort().reverse();
}

function renderPembayaran() {
  const opsiBulan = daftarBulanTersedia().map(function (m) {
    return `<option value="${m}">${escapeHtml(labelBulan(m))}</option>`;
  }).join('');

  $('#content').innerHTML = `
    <div class="toolbar">
      <div class="search">${IKON.search}
        <input type="text" placeholder="Cari nama penghuni atau kamar" data-filter="bayar.q" value="${escapeHtml(ui.bayar.q)}" />
      </div>
      <select data-filter="bayar.bulan"><option value="all">Semua bulan</option>${opsiBulan}</select>
      <select data-filter="bayar.status">
        <option value="all">Semua status</option>
        <option value="Lunas">Lunas</option>
        <option value="Sebagian">Sebagian</option>
        <option value="Belum Bayar">Belum bayar</option>
        <option value="Terlambat">Terlambat</option>
      </select>
      <div class="toolbar__spacer"></div>
      <button class="btn btn--primary" data-action="bayar-tambah">${IKON.plus} Tambah pembayaran</button>
    </div>
    <div class="card card__body--flush" id="listArea"></div>`;

  $('[data-filter="bayar.bulan"]').value = ui.bayar.bulan;
  $('[data-filter="bayar.status"]').value = ui.bayar.status;
  renderBayarList();
}

function filterBayar() {
  const q = ui.bayar.q.toLowerCase().trim();
  return DB.payments.filter(function (p) {
    const nama = namaPenghuni(p.tenantId).toLowerCase();
    const kamar = nomorKamar(p.roomId).toLowerCase();
    const cocokTeks = !q || nama.indexOf(q) > -1 || kamar.indexOf(q) > -1;
    const cocokBulan = ui.bayar.bulan === 'all' || p.bulan === ui.bayar.bulan;
    const cocokStatus = ui.bayar.status === 'all' || statusBayar(p) === ui.bayar.status;
    return cocokTeks && cocokBulan && cocokStatus;
  }).sort(function (a, b) {
    if (a.bulan !== b.bulan) return a.bulan < b.bulan ? 1 : -1;
    return namaPenghuni(a.tenantId).localeCompare(namaPenghuni(b.tenantId));
  });
}

function renderBayarList() {
  const semua = filterBayar();
  const totalHal = Math.max(1, Math.ceil(semua.length / PER_PAGE));
  if (ui.bayar.page > totalHal) ui.bayar.page = totalHal;
  const data = potongHalaman(semua, ui.bayar.page);

  const area = $('#listArea');
  if (!area) return;

  if (!semua.length) {
    area.innerHTML = htmlKosong('Data pembayaran tidak ditemukan', 'Ubah filter, atau tambahkan tagihan baru.');
    return;
  }

  area.innerHTML = `
    <div class="tablewrap">
      <table class="tbl">
        <thead><tr>
          <th>Penghuni</th><th>Bulan</th><th>Jatuh tempo</th>
          <th class="right">Tagihan</th><th class="right">Dibayar</th><th class="right">Sisa</th>
          <th>Status</th><th></th>
        </tr></thead>
        <tbody>${data.map(function (p) {
          const st = statusBayar(p);
          return `<tr>
            <td><div class="name">${escapeHtml(namaPenghuni(p.tenantId))}</div>
                <div class="sub">Kamar ${escapeHtml(nomorKamar(p.roomId))}</div></td>
            <td class="nowrap">${escapeHtml(labelBulanSingkat(p.bulan))}</td>
            <td class="nowrap">${escapeHtml(labelTanggal(p.jatuhTempo))}</td>
            <td class="right nowrap">${rupiah(p.tagihan)}</td>
            <td class="right nowrap">${rupiah(p.dibayar)}</td>
            <td class="right nowrap">${sisaTagihan(p) ? rupiah(sisaTagihan(p)) : '—'}</td>
            <td>${badge(st)}</td>
            <td><div class="rowact">
              ${st !== 'Lunas' ? `<button class="btn btn--sm" data-action="bayar-lunas" data-id="${p.id}">Tandai lunas</button>` : ''}
              <button class="btn btn--sm" data-action="bayar-edit" data-id="${p.id}">Edit</button>
              <button class="btn btn--sm btn--ghost" data-action="bayar-hapus" data-id="${p.id}">Hapus</button>
            </div></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>
    ${htmlPager('bayar', semua.length, ui.bayar.page)}`;
}

function formPembayaran(id) {
  const p = id ? getPayment(id) : null;

  // Pilihan penghuni: yang aktif + penghuni dari tagihan yang sedang diedit
  const kandidat = DB.tenants.filter(function (t) {
    return t.status === 'Aktif' || (p && t.id === p.tenantId);
  });
  if (!kandidat.length) {
    toast('Belum ada penghuni aktif untuk ditagih.', 'warn');
    return;
  }

  const opsiPenghuni = kandidat.map(function (t) {
    const terpilih = p && p.tenantId === t.id ? 'selected' : '';
    return `<option value="${t.id}" ${terpilih}>${escapeHtml(t.nama)} — Kamar ${escapeHtml(nomorKamar(t.roomId))}</option>`;
  }).join('');

  const bulanAwal = p ? p.bulan : monthKeyOf(new Date());

  const overlay = bukaModal({
    judul: p ? 'Edit pembayaran' : 'Tambah pembayaran',
    sub: 'Sisa dan status dihitung otomatis oleh sistem.',
    isi: `
      <form id="formBayar" novalidate>
        <div class="form-grid">
          <label class="field full">
            <span>Penghuni *</span>
            <select name="tenantId">${opsiPenghuni}</select>
            <small class="err" data-err="tenantId"></small>
          </label>
          <label class="field">
            <span>Bulan pembayaran *</span>
            <input type="month" name="bulan" value="${escapeHtml(bulanAwal)}" />
            <small class="err" data-err="bulan"></small>
          </label>
          <label class="field">
            <span>Tanggal jatuh tempo *</span>
            <input type="date" name="jatuhTempo" value="${escapeHtml(p ? p.jatuhTempo : tanggalJatuhTempo(bulanAwal, DB.settings.jatuhTempo))}" />
            <small class="err" data-err="jatuhTempo"></small>
          </label>
          <label class="field">
            <span>Jumlah tagihan *</span>
            <input type="number" name="tagihan" min="1" step="50000" value="${p ? p.tagihan : ''}" />
            <small class="err" data-err="tagihan"></small>
          </label>
          <label class="field">
            <span>Jumlah dibayar</span>
            <input type="number" name="dibayar" min="0" step="50000" value="${p ? p.dibayar : 0}" />
            <small class="err" data-err="dibayar"></small>
          </label>
          <label class="field">
            <span>Sisa pembayaran</span>
            <input type="text" id="sisaInfo" readonly value="Rp0" />
            <small class="err"></small>
          </label>
          <label class="field">
            <span>Tanggal pembayaran</span>
            <input type="date" name="tglBayar" value="${escapeHtml(p ? p.tglBayar : '')}" />
            <small class="err">Kosongkan bila belum ada pembayaran.</small>
          </label>
        </div>
      </form>`,
    footer: `<button class="btn" data-close>Batal</button>
             <button class="btn btn--primary" data-simpan>${p ? 'Simpan perubahan' : 'Simpan pembayaran'}</button>`,
    lebar: 'wide'
  });

  const form = $('#formBayar');

  const hitungSisa = function () {
    const sisa = Math.max(0, (Number(form.tagihan.value) || 0) - (Number(form.dibayar.value) || 0));
    $('#sisaInfo').value = rupiah(sisa);
  };

  // Isi otomatis tagihan dari harga kamar penghuni terpilih
  const isiHarga = function () {
    const t = getTenant(form.tenantId.value);
    const kamar = t ? getRoom(t.roomId) : null;
    if (kamar) form.tagihan.value = kamar.harga;
    hitungSisa();
  };
  if (!p) isiHarga();
  hitungSisa();

  form.tenantId.addEventListener('change', isiHarga);
  form.bulan.addEventListener('change', function () {
    if (form.bulan.value) form.jatuhTempo.value = tanggalJatuhTempo(form.bulan.value, DB.settings.jatuhTempo);
  });
  form.tagihan.addEventListener('input', hitungSisa);
  form.dibayar.addEventListener('input', hitungSisa);

  const simpan = function () {
    const tenantId = form.tenantId.value;
    const bulan = form.bulan.value;
    const jatuhTempo = form.jatuhTempo.value;
    const tagihan = Number(form.tagihan.value);
    const dibayar = Number(form.dibayar.value) || 0;
    let tglBayar = form.tglBayar.value;
    let valid = true;

    $$('[data-err]', form).forEach(function (el) { el.textContent = ''; });

    if (!tenantId) { form.querySelector('[data-err="tenantId"]').textContent = 'Penghuni wajib dipilih.'; valid = false; }
    if (!bulan) { form.querySelector('[data-err="bulan"]').textContent = 'Bulan pembayaran wajib diisi.'; valid = false; }
    if (!jatuhTempo) { form.querySelector('[data-err="jatuhTempo"]').textContent = 'Tanggal jatuh tempo wajib diisi.'; valid = false; }
    if (!tagihan || tagihan <= 0) { form.querySelector('[data-err="tagihan"]').textContent = 'Jumlah tagihan harus lebih dari 0.'; valid = false; }
    if (dibayar < 0) { form.querySelector('[data-err="dibayar"]').textContent = 'Jumlah dibayar tidak boleh negatif.'; valid = false; }
    if (tagihan && dibayar > tagihan) {
      form.querySelector('[data-err="dibayar"]').textContent = 'Jumlah dibayar tidak boleh melebihi tagihan.'; valid = false;
    }

    // Satu penghuni hanya boleh punya satu tagihan per bulan
    const kembar = DB.payments.some(function (x) {
      return x.tenantId === tenantId && x.bulan === bulan && (!p || x.id !== p.id);
    });
    if (kembar) {
      form.querySelector('[data-err="bulan"]').textContent = 'Penghuni ini sudah punya tagihan untuk bulan tersebut.'; valid = false;
    }
    if (!valid) return;

    if (dibayar > 0 && !tglBayar) tglBayar = todayISO();
    if (dibayar === 0) tglBayar = '';

    const tenant = getTenant(tenantId);

    if (p) {
      p.tenantId = tenantId; p.roomId = tenant ? tenant.roomId : p.roomId;
      p.bulan = bulan; p.jatuhTempo = jatuhTempo;
      p.tagihan = tagihan; p.dibayar = dibayar; p.tglBayar = tglBayar;
    } else {
      DB.payments.push({
        id: uid('BYR'), tenantId: tenantId, roomId: tenant ? tenant.roomId : '',
        bulan: bulan, jatuhTempo: jatuhTempo, tagihan: tagihan, dibayar: dibayar, tglBayar: tglBayar
      });
    }

    simpanSemua();
    tutupModal();
    renderPembayaran(); // dirender ulang agar filter bulan ikut diperbarui
    toast(p ? 'Data pembayaran diperbarui.' : 'Pembayaran tersimpan.');
  };

  overlay.addEventListener('click', function (e) { if (e.target.closest('[data-simpan]')) simpan(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); simpan(); });
}

function tandaiLunas(id) {
  const p = getPayment(id);
  if (!p) return;
  konfirmasi({
    judul: 'Tandai lunas?',
    pesan: namaPenghuni(p.tenantId) + ' — ' + labelBulan(p.bulan) + '. Sisa ' + rupiah(sisaTagihan(p)) + ' akan dicatat sebagai diterima hari ini.',
    tombol: 'Tandai lunas'
  }).then(function (ya) {
    if (!ya) return;
    p.dibayar = p.tagihan;
    p.tglBayar = todayISO();
    simpanSemua();
    renderBayarList();
    toast('Pembayaran ditandai lunas.');
  });
}

function hapusPembayaran(id) {
  const p = getPayment(id);
  if (!p) return;
  konfirmasi({
    judul: 'Hapus data pembayaran?',
    pesan: 'Tagihan ' + labelBulan(p.bulan) + ' atas nama ' + namaPenghuni(p.tenantId) + ' akan dihapus permanen.',
    tombol: 'Hapus',
    bahaya: true
  }).then(function (ya) {
    if (!ya) return;
    DB.payments = DB.payments.filter(function (x) { return x.id !== id; });
    simpanSemua();
    renderBayarList();
    toast('Data pembayaran dihapus.', 'warn');
  });
}

/* ============================================================
   12. HALAMAN LAPORAN
   ============================================================ */

function renderLaporan() {
  const tahunSet = {};
  DB.payments.forEach(function (p) { tahunSet[p.bulan.split('-')[0]] = true; });
  const tahunList = Object.keys(tahunSet).sort().reverse();

  $('#content').innerHTML = `
    <div class="toolbar no-print">
      <select data-filter="laporan.bulan">
        <option value="all">Semua bulan</option>
        ${BULAN.map(function (b, i) { return `<option value="${pad2(i + 1)}">${b}</option>`; }).join('')}
      </select>
      <select data-filter="laporan.tahun">
        <option value="all">Semua tahun</option>
        ${tahunList.map(function (t) { return `<option value="${t}">${t}</option>`; }).join('')}
      </select>
      <select data-filter="laporan.status">
        <option value="all">Semua status</option>
        <option value="Lunas">Lunas</option>
        <option value="Sebagian">Sebagian</option>
        <option value="Belum Bayar">Belum bayar</option>
        <option value="Terlambat">Terlambat</option>
      </select>
      <div class="toolbar__spacer"></div>
      <button class="btn btn--primary" data-action="cetak">${IKON.print} Cetak laporan</button>
    </div>
    <div id="listArea"></div>`;

  $('[data-filter="laporan.bulan"]').value = ui.laporan.bulan;
  $('[data-filter="laporan.tahun"]').value = ui.laporan.tahun;
  $('[data-filter="laporan.status"]').value = ui.laporan.status;
  renderLaporanIsi();
}

function filterLaporan() {
  return DB.payments.filter(function (p) {
    const parts = p.bulan.split('-');
    const cocokBulan = ui.laporan.bulan === 'all' || parts[1] === ui.laporan.bulan;
    const cocokTahun = ui.laporan.tahun === 'all' || parts[0] === ui.laporan.tahun;
    const cocokStatus = ui.laporan.status === 'all' || statusBayar(p) === ui.laporan.status;
    return cocokBulan && cocokTahun && cocokStatus;
  }).sort(function (a, b) { return a.bulan < b.bulan ? 1 : -1; });
}

function renderLaporanIsi() {
  const data = filterLaporan();
  const area = $('#listArea');
  if (!area) return;

  const totalTagihan = data.reduce(function (s, p) { return s + Number(p.tagihan); }, 0);
  const totalBayar = data.reduce(function (s, p) { return s + Number(p.dibayar); }, 0);
  const totalTunggakan = data.reduce(function (s, p) { return s + sisaTagihan(p); }, 0);
  const jumlahLunas = data.filter(function (p) { return statusBayar(p) === 'Lunas'; }).length;
  const jumlahTerlambat = data.filter(function (p) { return statusBayar(p) === 'Terlambat'; }).length;
  const jumlahBelumLunas = data.length - jumlahLunas;

  const periode = (ui.laporan.bulan === 'all' ? 'Semua bulan' : BULAN[Number(ui.laporan.bulan) - 1]) +
                  ' ' + (ui.laporan.tahun === 'all' ? '(semua tahun)' : ui.laporan.tahun) +
                  (ui.laporan.status === 'all' ? '' : ' — status ' + ui.laporan.status);

  area.innerHTML = `
    <div class="printhead">
      <h2>Laporan Pembayaran — ${escapeHtml(DB.settings.namaKos)}</h2>
      <p>${escapeHtml(DB.settings.alamat)} · ${escapeHtml(DB.settings.telepon)}</p>
      <p>Periode: ${escapeHtml(periode)} · Dicetak ${escapeHtml(labelTanggal(todayISO()))}</p>
    </div>

    <div class="section">
      <dl class="report-sum">
        <div><dt>Total tagihan</dt><dd>${rupiah(totalTagihan)}</dd></div>
        <div><dt>Total pembayaran</dt><dd>${rupiah(totalBayar)}</dd></div>
        <div><dt>Total tunggakan</dt><dd>${rupiah(totalTunggakan)}</dd></div>
        <div><dt>Lunas</dt><dd>${jumlahLunas} tagihan</dd></div>
        <div><dt>Belum lunas</dt><dd>${jumlahBelumLunas} tagihan</dd></div>
        <div><dt>Terlambat</dt><dd>${jumlahTerlambat} tagihan</dd></div>
      </dl>
    </div>

    <div class="card card__body--flush">
      <div class="card__head no-print">
        <div><h3>Rincian pembayaran</h3><p>${data.length} baris data pada periode terpilih</p></div>
      </div>
      ${data.length ? `<div class="tablewrap"><table class="tbl">
        <thead><tr>
          <th>No</th><th>Penghuni</th><th>Kamar</th><th>Bulan</th><th>Jatuh tempo</th>
          <th class="right">Tagihan</th><th class="right">Dibayar</th><th class="right">Sisa</th><th>Status</th>
        </tr></thead>
        <tbody>${data.map(function (p, i) {
          return `<tr>
            <td>${i + 1}</td>
            <td>${escapeHtml(namaPenghuni(p.tenantId))}</td>
            <td>${escapeHtml(nomorKamar(p.roomId))}</td>
            <td class="nowrap">${escapeHtml(labelBulanSingkat(p.bulan))}</td>
            <td class="nowrap">${escapeHtml(labelTanggal(p.jatuhTempo))}</td>
            <td class="right nowrap">${rupiah(p.tagihan)}</td>
            <td class="right nowrap">${rupiah(p.dibayar)}</td>
            <td class="right nowrap">${sisaTagihan(p) ? rupiah(sisaTagihan(p)) : '—'}</td>
            <td>${badge(statusBayar(p))}</td>
          </tr>`;
        }).join('')}</tbody>
        <tfoot><tr>
          <th colspan="5">Total</th>
          <th class="right">${rupiah(totalTagihan)}</th>
          <th class="right">${rupiah(totalBayar)}</th>
          <th class="right">${rupiah(totalTunggakan)}</th>
          <th></th>
        </tr></tfoot>
      </table></div>` : htmlKosong('Tidak ada data pada periode ini', 'Ubah filter bulan, tahun, atau status.')}
    </div>`;
}


function renderRiwayat() {
  $('#content').innerHTML = `
    <div class="toolbar">
      <div class="search">${IKON.search}
        <input type="text" placeholder="Cari nama penghuni" data-filter="riwayat.q" value="${escapeHtml(ui.riwayat.q)}" />
      </div>
    </div>
    <div class="card card__body--flush" id="listArea"></div>`;
  renderRiwayatList();
}

function renderRiwayatList() {
  const q = ui.riwayat.q.toLowerCase().trim();
  const data = DB.tenants.filter(function (t) {
    return t.status === 'Tidak Aktif' && (!q || t.nama.toLowerCase().indexOf(q) > -1 || t.hp.indexOf(q) > -1);
  }).sort(function (a, b) { return a.tglKeluar < b.tglKeluar ? 1 : -1; });

  const area = $('#listArea');
  if (!area) return;

  if (!data.length) {
    area.innerHTML = htmlKosong('Belum ada riwayat penghuni', 'Penghuni yang dinonaktifkan akan muncul di halaman ini.');
    return;
  }

  area.innerHTML = `
    <div class="tablewrap">
      <table class="tbl">
        <thead><tr>
          <th>Nama</th><th>Nomor HP</th><th>Kamar terakhir</th><th>Tanggal masuk</th>
          <th>Tanggal keluar</th><th>Lama tinggal</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>${data.map(function (t) {
          const hari = t.tglKeluar ? selisihHari(t.tglMasuk, t.tglKeluar) : 0;
          const bulan = Math.max(1, Math.round(hari / 30));
          return `<tr>
            <td class="name">${escapeHtml(t.nama)}</td>
            <td>${escapeHtml(t.hp)}</td>
            <td>${escapeHtml(nomorKamar(t.roomId))}</td>
            <td class="nowrap">${escapeHtml(labelTanggal(t.tglMasuk))}</td>
            <td class="nowrap">${escapeHtml(labelTanggal(t.tglKeluar))}</td>
            <td class="nowrap">± ${bulan} bulan</td>
            <td>${badge(t.status)}</td>
            <td><div class="rowact">
              <button class="btn btn--sm" data-action="penghuni-detail" data-id="${t.id}">Detail</button>
            </div></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;
}


function renderPengaturan() {
  const s = DB.settings;
  $('#content').innerHTML = `
    <div class="grid2">
      <div class="card">
        <div class="card__head"><div><h3>Identitas kos</h3><p>Dipakai pada sidebar dan kepala laporan</p></div></div>
        <div class="card__body">
          <form id="formPengaturan" novalidate>
            <label class="field">
              <span>Nama kos *</span>
              <input type="text" name="namaKos" value="${escapeHtml(s.namaKos)}" />
              <small class="err" data-err="namaKos"></small>
            </label>
            <label class="field">
              <span>Alamat kos</span>
              <textarea name="alamat">${escapeHtml(s.alamat)}</textarea>
              <small class="err"></small>
            </label>
            <label class="field">
              <span>Nomor telepon *</span>
              <input type="text" name="telepon" value="${escapeHtml(s.telepon)}" />
              <small class="err" data-err="telepon"></small>
            </label>
            <label class="field">
              <span>Tanggal jatuh tempo default *</span>
              <input type="number" name="jatuhTempo" min="1" max="28" value="${escapeHtml(s.jatuhTempo)}" />
              <small class="err" data-err="jatuhTempo">Dipakai saat membuat tagihan baru (1–28).</small>
            </label>
            <label class="field">
              <span>Username admin *</span>
              <input type="text" name="username" value="${escapeHtml(s.username)}" />
              <small class="err" data-err="username"></small>
            </label>
            <label class="field">
              <span>Password baru</span>
              <input type="password" name="password" placeholder="Kosongkan bila tidak diubah" />
              <small class="err" data-err="password"></small>
            </label>
            <button class="btn btn--primary" type="submit">Simpan pengaturan</button>
          </form>
        </div>
      </div>

      <div>
        <div class="card section">
          <div class="card__head"><div><h3>Data demo</h3><p>Kembalikan sistem ke data contoh</p></div></div>
          <div class="card__body">
            <p class="muted" style="margin-bottom:14px">Semua kamar, penghuni, dan pembayaran yang Anda buat akan diganti dengan data contoh bawaan sistem.</p>
            <button class="btn btn--danger" data-action="reset-demo">Reset data demo</button>
          </div>
        </div>

        <div class="card">
          <div class="card__head"><div><h3>Penyimpanan</h3><p>Data tersimpan di browser ini</p></div></div>
          <div class="card__body">
            <dl class="detail">
              <dt>Jumlah kamar</dt><dd>${DB.rooms.length}</dd>
              <dt>Jumlah penghuni</dt><dd>${DB.tenants.length}</dd>
              <dt>Data pembayaran</dt><dd>${DB.payments.length}</dd>
              <dt>Media simpan</dt><dd>localStorage</dd>
            </dl>
            <p class="muted" style="margin-top:14px;font-size:13.5px">Menghapus data browser (clear site data) akan menghapus seluruh data SIMKOS.</p>
          </div>
        </div>
      </div>
    </div>`;

  $('#formPengaturan').addEventListener('submit', simpanPengaturan);
}

function simpanPengaturan(e) {
  e.preventDefault();
  const form = e.target;
  const namaKos = form.namaKos.value.trim();
  const telepon = form.telepon.value.trim();
  const jatuhTempo = Number(form.jatuhTempo.value);
  const username = form.username.value.trim();
  const password = form.password.value;
  let valid = true;

  $$('[data-err]', form).forEach(function (el) {
    if (el.dataset.err !== 'jatuhTempo') el.textContent = '';
  });

  if (!namaKos) { form.querySelector('[data-err="namaKos"]').textContent = 'Nama kos wajib diisi.'; valid = false; }
  if (!telepon) { form.querySelector('[data-err="telepon"]').textContent = 'Nomor telepon wajib diisi.'; valid = false; }
  else if (!/^(\+62|62|0)[0-9]{8,13}$/.test(telepon.replace(/[\s-]/g, ''))) {
    form.querySelector('[data-err="telepon"]').textContent = 'Format nomor telepon tidak valid.'; valid = false;
  }
  if (!jatuhTempo || jatuhTempo < 1 || jatuhTempo > 28) {
    form.querySelector('[data-err="jatuhTempo"]').textContent = 'Tanggal jatuh tempo harus antara 1 dan 28.'; valid = false;
  }
  if (!username) { form.querySelector('[data-err="username"]').textContent = 'Username wajib diisi.'; valid = false; }
  if (password && password.length < 5) {
    form.querySelector('[data-err="password"]').textContent = 'Password minimal 5 karakter.'; valid = false;
  }
  if (!valid) return;

  DB.settings.namaKos = namaKos;
  DB.settings.alamat = form.alamat.value.trim();
  DB.settings.telepon = telepon;
  DB.settings.jatuhTempo = jatuhTempo;
  DB.settings.username = username;
  if (password) DB.settings.password = password;

  simpanSemua();
  $('#sidebarKosName').textContent = namaKos;
  $('#avatarInitial').textContent = username.charAt(0).toUpperCase();
  form.password.value = '';
  toast('Pengaturan tersimpan.');
}

function resetDataDemo() {
  konfirmasi({
    judul: 'Reset ke data demo?',
    pesan: 'Seluruh data yang ada sekarang akan dihapus dan diganti data contoh (15 kamar, 10 penghuni aktif, 5 riwayat, serta pembayaran beberapa bulan).',
    tombol: 'Reset sekarang',
    bahaya: true
  }).then(function (ya) {
    if (!ya) return;
    isiDataDemo();
    simpanSemua();
    $('#sidebarKosName').textContent = DB.settings.namaKos;
    $('#avatarInitial').textContent = DB.settings.username.charAt(0).toUpperCase();
    navigasi('dashboard');
    toast('Data demo berhasil dikembalikan.');
  });
}


function bukaSidebar() {
  $('#sidebar').classList.add('is-open');
  $('#backdrop').classList.add('is-open');
}
function tutupSidebar() {
  $('#sidebar').classList.remove('is-open');
  $('#backdrop').classList.remove('is-open');
}


function tanganiKlikKonten(e) {
  const tombol = e.target.closest('[data-action]');
  if (!tombol) return;
  const id = tombol.dataset.id;

  switch (tombol.dataset.action) {
    case 'kamar-tambah':      formKamar(); break;
    case 'kamar-edit':        formKamar(id); break;
    case 'kamar-detail':      detailKamar(id); break;
    case 'kamar-hapus':       hapusKamar(id); break;

    case 'penghuni-tambah':   formPenghuni(); break;
    case 'penghuni-edit':     formPenghuni(id); break;
    case 'penghuni-detail':   detailPenghuni(id); break;
    case 'penghuni-nonaktif': nonaktifkanPenghuni(id); break;
    case 'penghuni-hapus':    hapusPenghuni(id); break;

    case 'bayar-tambah':      formPembayaran(); break;
    case 'bayar-edit':        formPembayaran(id); break;
    case 'bayar-lunas':       tandaiLunas(id); break;
    case 'bayar-hapus':       hapusPembayaran(id); break;

    case 'cetak':             window.print(); break;
    case 'reset-demo':        resetDataDemo(); break;

    case 'pager': {
      const grup = tombol.dataset.grup;
      ui[grup].page = Number(tombol.dataset.hal);
      RENDER_ULANG[grup]();
      break;
    }
  }
}


function tanganiFilter(e) {
  const el = e.target.closest('[data-filter]');
  if (!el) return;
  const bagian = el.dataset.filter.split('.');
  const grup = bagian[0];
  const kunci = bagian[1];

  ui[grup][kunci] = el.value;
  if (Object.prototype.hasOwnProperty.call(ui[grup], 'page')) ui[grup].page = 1;
  RENDER_ULANG[grup]();
}

function init() {
  muatData();

  $('#loginForm').addEventListener('submit', prosesLogin);

  $('#mainNav').addEventListener('click', function (e) {
    const item = e.target.closest('.navitem');
    if (item) navigasi(item.dataset.page);
  });
  $('#btnLogoutSide').addEventListener('click', logout);
  $('#btnMenu').addEventListener('click', bukaSidebar);
  $('#backdrop').addEventListener('click', tutupSidebar);

  const konten = $('#content');
  konten.addEventListener('click', tanganiKlikKonten);
  konten.addEventListener('input', tanganiFilter);
  konten.addEventListener('change', tanganiFilter);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && $('#modalOverlay')) tutupModal();
  });

  if (sedangLogin()) tampilkanAplikasi();
}

document.addEventListener('DOMContentLoaded', init);
