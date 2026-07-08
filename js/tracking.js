// ── Tracking Resi ─────────────────────────────────────────────────────────────
// UI diporting dari pola "Tracking Resi" di AdsyCRM: card grid + tab filter +
// stat card yang bisa diklik buat filter + stepper 5 tahap + modal detail histori.
//
// Sumber cek status pengiriman per ekspedisi:
// - SPX (Shopee Xpress)                           -> api/spx-tracking.js (proxy ke spx.co.id, publik tanpa API key)
// - POS Indonesia                                 -> api/pos-tracking.js (proxy ke bosampuh.id, sama kayak AdsyCRM)
// - JNE/J&T/SiCepat/Anteraja/Ninja/IDExpress/Lion  -> api/mengantar-tracking.js (proxy ke app.mengantar.com)
// - Kurir lain di luar daftar itu -> belum didukung, tombol "Cek Manual"

const TR_STEP_LABELS = ['Konfirmasi', 'Dikirim', 'Kota Tujuan', 'OTW', 'Sampai'];
const TR_STAGE_META = {
  MENUNGGU_RESI: { label: '⏳ Menunggu Resi', badge: 'badge-warning', step: 1 },
  BELUM_DICEK:   { label: '🔍 Belum Dicek',   badge: 'badge-gray',    step: 1 },
  DIKIRIM:       { label: '🚚 Dikirim',        badge: 'badge-primary', step: 2 },
  KOTA_TUJUAN:   { label: '🏙️ Kota Tujuan',   badge: 'badge-primary', step: 3 },
  OTW:           { label: '🛵 OTW',            badge: 'badge-warning', step: 4 },
  SAMPAI:        { label: '✅ Sampai',          badge: 'badge-success', step: 5 },
  BERMASALAH:    { label: '⚠️ Bermasalah',     badge: 'badge-danger',  step: 2, problem: true },
  RETUR:         { label: '↩️ Retur',          badge: 'badge-danger',  step: 2, problem: true },
};

const TR_TABS = [
  { key: 'SEMUA',          label: 'Semua' },
  { key: 'MENUNGGU_RESI',  label: '⏳ Menunggu Resi' },
  { key: 'DIKIRIM',        label: '🚚 Dikirim' },
  { key: 'KOTA_TUJUAN',    label: '🏙️ Kota Tujuan' },
  { key: 'OTW',            label: '🛵 OTW' },
  { key: 'SAMPAI',         label: '✅ Sampai' },
  { key: 'BERMASALAH',     label: '⚠️ Bermasalah' },
  { key: 'RETUR',          label: '↩️ Retur' },
];
// Peta klik stat-card ringkasan -> filter tab yang sesuai
const TR_STAT_CARD_FILTER = { SEMUA: 'SEMUA', ON_PROSES: 'ON_PROSES_GROUP', UNDEL: 'BERMASALAH', RETUR: 'RETUR', DELIVERY: 'SAMPAI' };
const TR_ON_PROSES_STAGES = ['MENUNGGU_RESI', 'BELUM_DICEK', 'DIKIRIM', 'KOTA_TUJUAN', 'OTW'];

// Bucket ringkasan 4 kategori buat angka stat card
function trCardState(stage) {
  if (stage === 'SAMPAI')     return 'DELIVERY';
  if (stage === 'RETUR')      return 'RETUR';
  if (stage === 'BERMASALAH') return 'UNDEL';
  return 'ON_PROSES';
}

// Dikonfirmasi dari resi asli tgl 2026-07-08: milestone_code 1 = "Preparing to ship"
// (Manifested/Kurir ditugaskan), 5 = "In transit" (pickup s/d hub transit),
// 6 = "Out for delivery" ("Pesanan dalam proses pengantaran"),
// 8 = "Delivered" ("Pesanan tiba di alamat tujuan, diterima oleh Yang bersangkutan").
// Kode buat "Bermasalah/Retur" BELUM ada contoh nyata — kalau hasil cek meleset,
// minta resi asli buat kalibrasi ulang lalu tambah di sini.
const SPX_STAGE_BY_MILESTONE = { 1: 'DIKIRIM', 5: 'KOTA_TUJUAN', 6: 'OTW', 8: 'SAMPAI' };
const TR_STAGE_ORDER = ['DIKIRIM', 'KOTA_TUJUAN', 'OTW', 'SAMPAI'];

// Kota tujuan cuma dicap "Kota Tujuan" kalau nama hub SPX (current_location) di-cocokin
// ke kota tujuan pembeli (kolom "Kota/Kabupaten" dkk dari file marketplace). Nama hub gak
// selalu persis nama kota (mis. "Yogyakarta DC" vs kota tujuan "Kab. Sleman"), jadi ini
// best-effort — gagal cocok = tetap "Dikirim" (lebih aman daripada kepagian klaim sampai).
function trNormalizeCity(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/^(KOTA|KAB\.?|KABUPATEN)\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function trCityMatches(destCity, locationName) {
  if (!destCity || !locationName) return false;
  const dest = trNormalizeCity(destCity);
  if (!dest) return false;
  const loc = String(locationName).toUpperCase();
  const firstWord = dest.split(' ')[0];
  return firstWord.length >= 4 && loc.includes(firstWord);
}

function mapSpxStage(apiData, destCity) {
  const info = apiData?.data?.sls_tracking_info || null;
  const records = info?.records || [];
  if (!records.length) return { stage: 'DIKIRIM', detail: info };

  const problemWords   = ['retur', 'return', 'gagal', 'bermasalah', 'batal', 'cancel', 'rts', 'ditolak', 'undelivered'];
  const deliveredWords = ['delivered', 'terkirim', 'diterima', 'selesai', 'complete'];
  const otwWords       = ['out for delivery', 'otw', 'sedang diantar', 'dalam pengiriman', 'kurir sedang', 'menuju alamat'];

  let stage = 'DIKIRIM';
  let problem = false;
  const higher = s => { if (TR_STAGE_ORDER.indexOf(s) > TR_STAGE_ORDER.indexOf(stage)) stage = s; };

  records.forEach(r => {
    const text = [r.milestone_name, r.tracking_name, r.description].filter(Boolean).join(' ').toLowerCase();
    if (problemWords.some(w => text.includes(w))) problem = true;
    if (deliveredWords.some(w => text.includes(w))) { higher('SAMPAI'); return; }
    if (otwWords.some(w => text.includes(w))) { higher('OTW'); return; }
    const ms = SPX_STAGE_BY_MILESTONE[r.milestone_code];
    if (ms === 'KOTA_TUJUAN') {
      // Cuma naik ke Kota Tujuan kalau lokasi event ini (yang udah ke-scan, bukan next_location
      // yang masih rencana) beneran cocok sama kota tujuan pembeli.
      if (trCityMatches(destCity, r.current_location?.location_name)) higher('KOTA_TUJUAN');
    } else if (ms) {
      higher(ms);
    }
  });

  if (problem) stage = 'BERMASALAH';
  return { stage, detail: info };
}

async function checkSpxResi(resi, destCity) {
  const r = await fetch(`/api/spx-tracking?resi=${encodeURIComponent(resi)}`);
  const data = await r.json();
  if (data.retcode !== 0) throw new Error(data.message || 'Resi tidak ditemukan');
  return mapSpxStage(data, destCity);
}

// ── POS (via bosampuh.id, dipakai juga di AdsyCRM) ─────────────────────────────
// connote_state dari POS udah terstruktur & self-explanatory, gak perlu banyak
// tebak kata kayak fallback SPX.
// "inBag/INVEHICLE/INLOCATION/unBag" bisa kejadian pas masih di kota ASAL juga (mindah
// antar hub lokal), bukan cuma pas udah nyampe kota tujuan. Histori POS untungnya punya
// field "city" eksplisit per event, jadi dicocokin ke kota tujuan pembeli dulu sebelum
// diklaim "Kota Tujuan" — sama kayak SPX.
const POS_TRANSIT_STATES = ['inBag', 'INVEHICLE', 'INLOCATION', 'unBag'];

function mapPosStage(apiData, destCity) {
  const history = apiData?.connote_history || [];
  const problemWords = ['retur', 'return', 'gagal', 'cancel', 'rts', 'ditolak', 'bermasalah'];
  const stateText = [apiData?.connote_state, ...history.map(h => h.content + ' ' + h.content2)].join(' ').toLowerCase();
  const problem = problemWords.some(w => stateText.includes(w));

  const state = apiData?.connote_state;
  let stage;
  if (state === 'DELIVERED') stage = 'SAMPAI';
  else if (state === 'DELIVERYRUNSHEET') stage = 'OTW';
  else if (POS_TRANSIT_STATES.includes(state)) {
    const latestCity = history.length ? history[history.length - 1].city : null;
    stage = trCityMatches(destCity, latestCity) ? 'KOTA_TUJUAN' : 'DIKIRIM';
  } else {
    stage = 'DIKIRIM';
  }
  if (problem) stage = 'BERMASALAH';

  const records = history.slice().reverse().map(h => ({
    description: h.content2 || h.content,
    tracking_name: h.action,
    actual_time: h.created_at ? Math.floor(new Date(h.created_at.replace(' ', 'T')).getTime() / 1000) : null,
    current_location: { location_name: h.location_name || h.city || '' },
  }));
  return { stage, detail: { records } };
}

async function checkPosResi(resi, destCity) {
  const r = await fetch(`/api/pos-tracking?resi=${encodeURIComponent(resi)}`);
  const data = await r.json();
  if (data.error || !data.connote_code) throw new Error(data.error || 'Resi tidak ditemukan');
  return mapPosStage(data, destCity);
}

// ── Kurir lain via Mengantar (JNE, J&T, SiCepat, Anteraja, Ninja, IDExpress, Lion) ─
// Heuristik + kode kurir diporting persis dari js/shared.js punya AdsyCRM.
const MENGANTAR_COURIER_MAP = {
  JNE: 'JNE', 'J&T': 'JT', SICEPAT: 'SiCepat', ANTERAJA: 'anteraja',
  NINJA: 'Ninja', IDEXPRESS: 'iDexpress', LION: 'lion',
};
const TR_RETUR_PATTERN   = /retur|dikembalikan|\brts\b|\brto\b|return to sender/i;
const TR_PROBLEM_PATTERN = /gagal|kendala|bermasalah|problematic|tidak ditemukan|alamat tidak (lengkap|dikenal)|tidak ada orang|tidak ditempat|tidak dihuni|menunggu konfirmasi|disimpan di gudang|ditolak|pindah alamat|box undel/i;
const TR_OTW_PATTERN     = /sedang diantar|dalam pengantaran|out for delivery|kurir menuju|\botw\b|akan dikirim ke alamat penerima|with delivery courier|delivery courier|diantar ke alamat|on delivery|1st attempt|2nd attempt|percobaan/i;
const TR_KOTA_TUJUAN_PATTERN = /kota tujuan|gudang tujuan|tiba di kota|received at destination|received at warehouse|process and forward|inbound|sti-dest/i;

function mengantarComputeStep(entries) {
  let step = 2; // resi sudah discan sistem kurir minimal = Dikirim
  (entries || []).forEach(e => {
    const d = (e.desc || '').toLowerCase();
    if (TR_OTW_PATTERN.test(d)) step = Math.max(step, 4);
    else if (TR_KOTA_TUJUAN_PATTERN.test(d)) step = Math.max(step, 3);
  });
  return step;
}

function mapMengantarStage(json) {
  if (!json || !json.success || !json.data) throw new Error(json?.message || 'Resi tidak ditemukan');
  const d = json.data;
  const history = Array.isArray(d.history) ? d.history : [];
  // Gabung desc + code — Lion taruh sinyal penting ("STI-DEST"/"POD"/"DEL") di code, bukan desc
  const entries = history.map(h => ({ desc: [h.desc, h.code].filter(Boolean).join(' '), group: h.type?.group || null, tag: h.type?.tag || null }));
  const cat = (d.statusCategory || d.status || '').toUpperCase();
  const latestDesc = (entries.length ? entries[entries.length - 1].desc : '').toLowerCase();
  const reachedStep = mengantarComputeStep(entries);

  let stage;
  if (cat.includes('RETUR') || cat.includes('RETURN') || entries.some(e => TR_RETUR_PATTERN.test(e.desc || ''))) {
    stage = 'RETUR';
  } else if (cat === 'DELIVERED' || /diterima oleh|delivered|\bpod\b/.test(latestDesc)) {
    stage = 'SAMPAI';
  } else {
    const hasStructuredProblem = entries.some(e => e.group === 'UNDELIVERED' || e.tag === 'actionRequired');
    if (hasStructuredProblem || entries.some(e => TR_PROBLEM_PATTERN.test(e.desc || ''))) stage = 'BERMASALAH';
    else if (reachedStep >= 4) stage = 'OTW';
    else if (reachedStep >= 3) stage = 'KOTA_TUJUAN';
    else stage = 'DIKIRIM';
  }

  // Tanggal/lokasi per-event Mengantar belum dikonfirmasi field-nya — tampilkan desc-nya saja
  // dulu di histori, biar gak salah tebak nama field.
  const records = history.slice().reverse().map(h => ({ description: [h.desc, h.code].filter(Boolean).join(' ') || '-' }));
  return { stage, detail: { records } };
}

async function checkMengantarResi(resi, ekspedisi) {
  const courier = MENGANTAR_COURIER_MAP[ekspedisi];
  if (!courier) throw new Error('Ekspedisi belum didukung');
  const r = await fetch(`/api/mengantar-tracking?tracking_number=${encodeURIComponent(resi)}&courier=${encodeURIComponent(courier)}`);
  const data = await r.json();
  return mapMengantarStage(data);
}

const TR_AUTO_EKSPEDISI = {
  SPX: o => checkSpxResi(o.id, o.kota_tujuan),
  POS: o => checkPosResi(o.id, o.kota_tujuan),
  JNE: o => checkMengantarResi(o.id, o.ekspedisi),
  'J&T': o => checkMengantarResi(o.id, o.ekspedisi),
  SICEPAT: o => checkMengantarResi(o.id, o.ekspedisi),
  ANTERAJA: o => checkMengantarResi(o.id, o.ekspedisi),
  NINJA: o => checkMengantarResi(o.id, o.ekspedisi),
  IDEXPRESS: o => checkMengantarResi(o.id, o.ekspedisi),
  LION: o => checkMengantarResi(o.id, o.ekspedisi),
};
function trIsAutoTrackable(ekspedisi) { return !!TR_AUTO_EKSPEDISI[ekspedisi]; }
async function checkResiAuto(o) { return TR_AUTO_EKSPEDISI[o.ekspedisi](o); }

// ── Page state ────────────────────────────────────────────────────────────────
let _trkOrders = [];
let trFilterStage = 'SEMUA';
let trModalKey = null;

function trOrderKey(o) { return o._table + '|' + o.id; }
function trFindOrder(key) { return _trkOrders.find(o => trOrderKey(o) === key); }

function trEffectiveStage(o) {
  if (String(o.id).startsWith('IMP-')) return 'MENUNGGU_RESI'; // resi asli gak ketemu di file sumber
  if (!o.status_resi || !TR_STAGE_META[o.status_resi]) return 'BELUM_DICEK';
  return o.status_resi;
}

// ── Date Range Picker (dropdown + kalender, default Bulan Ini) ─────────────────
// Diporting dari pola trDrp* di AdsyCRM, disederhanakan: kolom "date" di sini
// cuma string YYYY-MM-DD (bukan timestamp), jadi gak perlu konversi timezone WIB.
const DRP_MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const DRP_DAYS   = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

function trYmd(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function drpFmtDate(d) {
  if (!d) return '—';
  return `${d.getDate()} ${DRP_MONTHS[d.getMonth()].slice(0,3)} ${d.getFullYear()}`;
}

const _trToday = new Date();
let trFilterStart = new Date(_trToday.getFullYear(), _trToday.getMonth(), 1);
let trFilterEnd   = new Date(_trToday.getFullYear(), _trToday.getMonth(), _trToday.getDate());
let trDrpSelStart = trFilterStart, trDrpSelEnd = trFilterEnd;
let trDrpViewYear = _trToday.getFullYear(), trDrpViewMonth = _trToday.getMonth();
let trDrpLabelText = 'Bulan Ini';

function trDrpToggle() {
  const dd = document.getElementById('trDrp-dropdown');
  dd.classList.toggle('open');
  if (dd.classList.contains('open')) { trDrpRender(); document.addEventListener('click', trDrpOutside); }
  else document.removeEventListener('click', trDrpOutside);
}
function trDrpClose() {
  document.getElementById('trDrp-dropdown').classList.remove('open');
  document.removeEventListener('click', trDrpOutside);
}
function trDrpOutside(e) {
  const dd = document.getElementById('trDrp-dropdown'), tr = document.getElementById('trDrp-trigger');
  if (!dd.contains(e.target) && !tr.contains(e.target)) trDrpClose();
}
function _trDrpMarkActive(btn) {
  document.querySelectorAll('#trDrp-dropdown .drp-preset').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}
function trDrpPreset(days, label, btn) {
  const t = new Date();
  trDrpSelEnd = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const s = new Date(t); s.setDate(s.getDate() - (days - 1));
  trDrpSelStart = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  _trDrpMarkActive(btn); trDrpUpdateSel(); trDrpRender();
}
function trDrpPresetYesterday(btn) {
  const y = new Date(); y.setDate(y.getDate() - 1);
  trDrpSelStart = trDrpSelEnd = new Date(y.getFullYear(), y.getMonth(), y.getDate());
  _trDrpMarkActive(btn); trDrpUpdateSel(); trDrpRender();
}
function trDrpPresetThisMonth(btn) {
  const t = new Date();
  trDrpSelStart = new Date(t.getFullYear(), t.getMonth(), 1);
  trDrpSelEnd   = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  _trDrpMarkActive(btn); trDrpUpdateSel(); trDrpRender();
}
function trDrpPresetLastMonth(btn) {
  const t = new Date();
  trDrpSelStart = new Date(t.getFullYear(), t.getMonth() - 1, 1);
  trDrpSelEnd   = new Date(t.getFullYear(), t.getMonth(), 0);
  _trDrpMarkActive(btn); trDrpUpdateSel(); trDrpRender();
}
function trDrpUpdateSel() {
  document.getElementById('trDrp-sel-start').textContent = drpFmtDate(trDrpSelStart);
  document.getElementById('trDrp-sel-end').textContent   = drpFmtDate(trDrpSelEnd);
}
function trDrpApply() {
  if (!trDrpSelStart) return;
  const endSel = trDrpSelEnd || trDrpSelStart;
  trFilterStart = trDrpSelStart;
  trFilterEnd   = endSel;
  trDrpLabelText = `${drpFmtDate(trFilterStart)} — ${drpFmtDate(trFilterEnd)}`;
  trDrpClose();
  loadTracking();
}
function trDrpClickDay(y, m, d) {
  const clicked = new Date(y, m, d);
  if (!trDrpSelStart || (trDrpSelStart && trDrpSelEnd)) {
    trDrpSelStart = clicked; trDrpSelEnd = null;
  } else if (clicked < trDrpSelStart) {
    trDrpSelEnd = trDrpSelStart; trDrpSelStart = clicked;
  } else {
    trDrpSelEnd = clicked;
  }
  document.querySelectorAll('#trDrp-dropdown .drp-preset').forEach(b => b.classList.remove('active'));
  trDrpUpdateSel(); trDrpRender();
}
function trDrpRender() {
  drpMakeCalendar('trDrp-cal', trDrpSelStart, trDrpSelEnd, 'trDrpClickDay', 'trDrpNav', trDrpViewYear, trDrpViewMonth);
}
function trDrpNav(dir) {
  trDrpViewMonth += dir;
  if (trDrpViewMonth > 11) { trDrpViewMonth = 0; trDrpViewYear++; }
  if (trDrpViewMonth < 0)  { trDrpViewMonth = 11; trDrpViewYear--; }
  trDrpRender();
}
function drpMakeCalendar(calId, selStart, selEnd, clickFn, navFn, viewYear, viewMonth) {
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const startPad    = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevDays    = new Date(viewYear, viewMonth, 0).getDate();
  const today = new Date();

  let html = `<div class="drp-cal-hdr">
      <button class="drp-nav" onclick="${navFn}(-1)">‹</button>
      <div class="drp-cal-title">${DRP_MONTHS[viewMonth]} ${viewYear}</div>
      <button class="drp-nav" onclick="${navFn}(1)">›</button>
    </div>
    <div class="drp-days-hdr">${DRP_DAYS.map(d => `<span>${d}</span>`).join('')}</div>
    <div class="drp-days">`;

  for (let i = startPad; i > 0; i--) html += `<button class="drp-day other-month">${prevDays - i + 1}</button>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const cur = new Date(viewYear, viewMonth, d);
    const isToday = viewYear === today.getFullYear() && viewMonth === today.getMonth() && d === today.getDate();
    const isStart = selStart && cur.getTime() === new Date(selStart.getFullYear(), selStart.getMonth(), selStart.getDate()).getTime();
    const isEnd   = selEnd   && cur.getTime() === new Date(selEnd.getFullYear(), selEnd.getMonth(), selEnd.getDate()).getTime();
    const inRange = selStart && selEnd && cur > selStart && cur < selEnd;
    let cls = 'drp-day';
    if (isStart && isEnd) cls += ' selected';
    else if (isStart) cls += ' range-start';
    else if (isEnd)   cls += ' range-end';
    else if (inRange) cls += ' in-range';
    if (isToday) cls += ' today';
    html += `<button class="${cls}" onclick="${clickFn}(${viewYear},${viewMonth},${d})">${d}</button>`;
  }

  const total = startPad + daysInMonth;
  const rem = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let d = 1; d <= rem; d++) html += `<button class="drp-day other-month">${d}</button>`;

  html += '</div>';
  document.getElementById(calId).innerHTML = html;
}

async function loadTracking() {
  showLoading();
  try {
    const filters = { dateFrom: trYmd(trFilterStart), dateTo: trYmd(trFilterEnd) };
    if (_user.role !== 'spv') filters.advId = _user.id;
    _trkOrders = await dbGetTrackableOrders(filters);
    renderTrackingPage();
  } catch (e) {
    showError('Gagal memuat data tracking: ' + e.message);
  }
}

function renderTrackingPage() {
  document.getElementById('pageContent').innerHTML = `
    <div class="stat-grid cols-5">
      <div class="stat-card clickable" id="trStatCard-SEMUA" onclick="trSetFilter('SEMUA')">
        <div class="stat-label">Total</div>
        <div class="stat-value" id="trStatTotal">0</div>
        <div class="stat-icon">📦</div>
      </div>
      <div class="stat-card clickable" id="trStatCard-ON_PROSES" onclick="trSetFilter('ON_PROSES_GROUP')">
        <div class="stat-label">On Proses</div>
        <div class="stat-value" id="trStatOnProses" style="color:var(--primary)">0</div>
        <div class="stat-icon">🔄</div>
      </div>
      <div class="stat-card clickable" id="trStatCard-UNDEL" onclick="trSetFilter('BERMASALAH')">
        <div class="stat-label">Bermasalah</div>
        <div class="stat-value" id="trStatUndel" style="color:var(--danger)">0</div>
        <div class="stat-icon">⚠️</div>
      </div>
      <div class="stat-card clickable" id="trStatCard-RETUR" onclick="trSetFilter('RETUR')">
        <div class="stat-label">Retur</div>
        <div class="stat-value" id="trStatRetur" style="color:var(--danger)">0</div>
        <div class="stat-icon">↩️</div>
      </div>
      <div class="stat-card clickable" id="trStatCard-DELIVERY" onclick="trSetFilter('SAMPAI')">
        <div class="stat-label">Terkirim</div>
        <div class="stat-value" id="trStatDelivery" style="color:var(--success)">0</div>
        <div class="stat-icon">✅</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-header-left"><h3>Tracking Resi</h3><div class="card-sub">Monitor status pengiriman semua order</div></div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <div class="drp-wrap">
            <button class="drp-trigger" onclick="trDrpToggle()" id="trDrp-trigger">
              <span>📅</span><span id="trDrp-label">${trDrpLabelText}</span><span style="color:var(--text-3)">▾</span>
            </button>
            <div class="drp-dropdown" id="trDrp-dropdown">
              <div class="drp-presets">
                <button class="drp-preset" onclick="trDrpPreset(1,'Hari Ini',this)">Hari Ini</button>
                <button class="drp-preset" onclick="trDrpPresetYesterday(this)">Kemarin</button>
                <hr style="border:none;border-top:1px solid var(--border);margin:6px 0">
                <button class="drp-preset" onclick="trDrpPreset(7,'7 Hari Terakhir',this)">7 Hari Terakhir</button>
                <button class="drp-preset" onclick="trDrpPreset(14,'14 Hari Terakhir',this)">14 Hari Terakhir</button>
                <button class="drp-preset" onclick="trDrpPreset(30,'30 Hari Terakhir',this)">30 Hari Terakhir</button>
                <button class="drp-preset" onclick="trDrpPreset(90,'90 Hari Terakhir',this)">90 Hari Terakhir</button>
                <hr style="border:none;border-top:1px solid var(--border);margin:6px 0">
                <button class="drp-preset active" onclick="trDrpPresetThisMonth(this)">Bulan Ini</button>
                <button class="drp-preset" onclick="trDrpPresetLastMonth(this)">Bulan Lalu</button>
              </div>
              <div style="display:flex;flex-direction:column;flex:1">
                <div class="drp-cal" id="trDrp-cal"></div>
                <div class="drp-footer">
                  <div class="drp-selected-txt"><span id="trDrp-sel-start">—</span> → <span id="trDrp-sel-end">—</span></div>
                  <div style="display:flex;gap:6px">
                    <button class="drp-cancel" onclick="trDrpClose()">Batal</button>
                    <button class="drp-apply" onclick="trDrpApply()">Terapkan</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" id="trRefreshBtn" onclick="trRefreshAll()">🔄 Refresh Semua</button>
        </div>
      </div>

      <div class="tr-toolbar">
        <div class="tr-tabs" id="trTabs"></div>
        <div class="tr-search-wrap">
          <input type="text" id="trSearch" class="ctrl-input" style="width:100%" placeholder="🔍 Cari resi / produk / toko..." onkeyup="trApplyFilter()">
        </div>
        <div class="tr-count" id="trCount">0 pesanan</div>
      </div>

      <div id="trList"></div>
    </div>
  `;
  renderTrackingTabs();
  trUpdateStats();
  trApplyFilter();
}

function renderTrackingTabs() {
  document.getElementById('trTabs').innerHTML = TR_TABS.map(t =>
    `<div class="tr-tab ${trFilterStage === t.key ? 'active' : ''}" onclick="trSetFilter('${t.key}')">${t.label}</div>`
  ).join('');
  Object.entries(TR_STAT_CARD_FILTER).forEach(([cardKey, filterKey]) => {
    document.getElementById('trStatCard-' + cardKey)?.classList.toggle('active', trFilterStage === filterKey);
  });
}

function trUpdateStats() {
  const counts = { ON_PROSES: 0, UNDEL: 0, RETUR: 0, DELIVERY: 0 };
  _trkOrders.forEach(o => { counts[trCardState(trEffectiveStage(o))]++; });
  document.getElementById('trStatTotal').textContent    = _trkOrders.length;
  document.getElementById('trStatOnProses').textContent = counts.ON_PROSES;
  document.getElementById('trStatUndel').textContent    = counts.UNDEL;
  document.getElementById('trStatRetur').textContent    = counts.RETUR;
  document.getElementById('trStatDelivery').textContent = counts.DELIVERY;
}

function trSetFilter(key) { trFilterStage = key; renderTrackingTabs(); trApplyFilter(); }

function trApplyFilter() {
  const q = (document.getElementById('trSearch').value || '').toLowerCase();
  const list = _trkOrders.filter(o => {
    const stage = trEffectiveStage(o);
    if (trFilterStage === 'ON_PROSES_GROUP') {
      if (!TR_ON_PROSES_STAGES.includes(stage)) return false;
    } else if (trFilterStage !== 'SEMUA' && stage !== trFilterStage) {
      return false;
    }
    if (q && !(String(o.id).toLowerCase().includes(q) || (o.product||'').toLowerCase().includes(q) || (o.store_name||'').toLowerCase().includes(q))) return false;
    return true;
  });
  document.getElementById('trCount').textContent = `${list.length} pesanan`;
  document.getElementById('trList').innerHTML = list.length
    ? list.map(o => trCardHtml(o)).join('')
    : '<div class="tr-card" style="grid-column:1/-1;text-align:center;color:var(--text-3);cursor:default">Tidak ada data.</div>';
}

function trStepperHtml(stage) {
  const meta = TR_STAGE_META[stage] || TR_STAGE_META.BELUM_DICEK;
  const step = meta.step;
  const allDone = stage === 'SAMPAI';
  return `<div class="tr-stepper">${TR_STEP_LABELS.map((label, i) => {
    const idx = i + 1;
    let cls = 'tr-step';
    if (allDone || idx < step) cls += ' tr-step-done';
    else if (idx === step) cls += meta.problem ? ' tr-step-problem' : ' tr-step-active';
    const icon = (allDone || idx < step) ? '✓' : idx;
    return `<div class="${cls}"><div class="tr-step-line"></div><div class="tr-step-circle">${icon}</div><div class="tr-step-label">${label}</div></div>`;
  }).join('')}</div>`;
}

const TR_AVATAR_PALETTE = ['#4361EE', '#7B2FBE', '#06C270', '#FFB703', '#EF233C', '#0EA5E9', '#7C3AED', '#0891B2', '#65A30D', '#C026D3'];
function trAvatarColor(name) {
  const s = name || '?';
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) % 1000000007;
  return TR_AVATAR_PALETTE[Math.abs(hash) % TR_AVATAR_PALETTE.length];
}

function trCardHtml(o) {
  const stage = trEffectiveStage(o);
  const meta  = TR_STAGE_META[stage] || TR_STAGE_META.BELUM_DICEK;
  const hasResi = !String(o.id).startsWith('IMP-');
  const buyerName = o.buyer || 'Pembeli';
  const initial = buyerName.trim().charAt(0).toUpperCase() || '?';

  return `<div class="tr-card" onclick="trOpenDetail('${trOrderKey(o)}')">
    <div class="tr-card-top">
      <div class="tr-card-left">
        <div class="tr-avatar" style="background:${trAvatarColor(buyerName)}">${initial}</div>
        <div style="min-width:0">
          <div class="tr-name">${buyerName}</div>
          <div class="tr-sub">${o.store_name || '-'}</div>
          <div class="tr-meta">
            <span class="badge ${meta.badge}">${meta.label}</span>
            ${badgeMarketplace(o.marketplace)}
            ${o.ekspedisi ? `<span class="badge badge-gray">${o.ekspedisi}</span>` : ''}
          </div>
          <div class="tr-produk" title="${(o.product || '-').replace(/"/g, '&quot;')}">${o.product || '-'} × ${o.qty || 1}</div>
        </div>
      </div>
      <div>
        <div class="tr-price">${fmtFull(o.total || 0)}</div>
        <div class="tr-date">${o.date || '-'}</div>
        ${hasResi ? `<div class="tr-resi">${o.id}</div>` : ''}
      </div>
    </div>
    <div class="tr-divider">${trStepperHtml(stage)}</div>
  </div>`;
}

function trOpenDetail(key) {
  trModalKey = key;
  const o = trFindOrder(key);
  if (!o) return;
  const hasResi = !String(o.id).startsWith('IMP-');
  const stage = trEffectiveStage(o);
  const meta  = TR_STAGE_META[stage] || TR_STAGE_META.BELUM_DICEK;

  document.getElementById('trkModalTitle').textContent = o.product || 'Detail Pengiriman';
  document.getElementById('trkModalSub').textContent = (hasResi ? o.id + ' · ' : '') + (o.ekspedisi || '-');

  const records = o.status_resi_detail?.records || [];
  let historyHtml = '<div style="font-size:.78rem;color:var(--text-3);margin-top:12px">Belum ada history — klik "Cek Ulang".</div>';
  if (records.length) {
    historyHtml = `<div style="margin-top:14px">${records.map((r, i) => `
      <div class="tr-history-item">
        <div class="tr-history-dot" style="background:${i === 0 ? 'var(--primary)' : 'var(--border)'}"></div>
        <div>
          <div style="font-size:.78rem;${i === 0 ? 'font-weight:700' : ''}">${r.description || r.tracking_name || '-'}</div>
          <div style="font-size:.68rem;color:var(--text-3);margin-top:2px">${r.actual_time ? new Date(r.actual_time * 1000).toLocaleString('id-ID') : ''}${r.current_location?.location_name ? ' · ' + r.current_location.location_name : ''}</div>
        </div>
      </div>`).join('')}</div>`;
  }

  const autoTrackable = trIsAutoTrackable(o.ekspedisi);
  const unsupportedNote = (hasResi && o.ekspedisi && !autoTrackable)
    ? `<div style="margin-top:12px;padding:10px 12px;background:var(--input-bg);border-radius:8px;font-size:.75rem;color:var(--text-3)">
         ℹ️ Ekspedisi <strong>${o.ekspedisi}</strong> belum bisa dicek otomatis di sini — cek manual di situs resminya pakai resi <strong>${o.id}</strong>.
       </div>`
    : '';

  document.getElementById('trkModalBody').innerHTML = `
    <div style="margin-top:10px"><span class="badge ${meta.badge}">${meta.label}</span></div>
    ${trStepperHtml(stage)}
    ${unsupportedNote}
    ${historyHtml}
  `;
  document.getElementById('trkModalCheckBtn').style.display = (hasResi && autoTrackable) ? '' : 'none';
  document.getElementById('trkModalOverlay').classList.add('open');
}

function trCloseModal() { document.getElementById('trkModalOverlay').classList.remove('open'); }

async function trManualCheckFromModal() {
  const o = trFindOrder(trModalKey);
  if (!o) return;
  await trCheckOne(o);
  trOpenDetail(trModalKey);
}

async function trCheckOne(o) {
  if (!trIsAutoTrackable(o.ekspedisi)) { showToast('Ekspedisi ini belum didukung cek otomatis', 'info'); return; }
  try {
    const { stage, detail } = await checkResiAuto(o);
    const patch = {
      status_resi: stage,
      status_resi_step: TR_STAGE_META[stage].step,
      status_resi_updated_at: new Date().toISOString(),
      status_resi_detail: detail,
    };
    await dbUpdateTrackingStatus(o._table, o.id, patch);
    Object.assign(o, patch);
    trUpdateStats();
    trApplyFilter();
    showToast('✅ Status diperbarui: ' + TR_STAGE_META[stage].label, 'success');
  } catch (e) {
    showToast('❌ ' + e.message, 'error');
  }
}

async function trRefreshAll() {
  const btn = document.getElementById('trRefreshBtn');
  const targets = _trkOrders.filter(o => trIsAutoTrackable(o.ekspedisi) && !['SAMPAI', 'RETUR'].includes(o.status_resi));
  if (!targets.length) { showToast('Tidak ada resi yang bisa dicek otomatis', 'info'); return; }
  btn.disabled = true;
  btn.textContent = `Mengecek 0/${targets.length}...`;
  let done = 0;
  const BATCH = 5;
  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    await Promise.all(batch.map(async o => {
      try {
        const { stage, detail } = await checkResiAuto(o);
        const patch = {
          status_resi: stage,
          status_resi_step: TR_STAGE_META[stage].step,
          status_resi_updated_at: new Date().toISOString(),
          status_resi_detail: detail,
        };
        await dbUpdateTrackingStatus(o._table, o.id, patch);
        Object.assign(o, patch);
      } catch (e) { /* lanjut ke resi berikutnya walau satu gagal */ }
      done++;
      btn.textContent = `Mengecek ${done}/${targets.length}...`;
    }));
  }
  btn.disabled = false;
  btn.textContent = '🔄 Refresh Semua';
  trUpdateStats();
  trApplyFilter();
  showToast('✅ Selesai cek semua resi SPX', 'success');
}
