// ── Tracking Resi ─────────────────────────────────────────────────────────────
// UI diporting dari pola "Tracking Resi" di AdsyCRM: card grid + tab filter +
// stat card yang bisa diklik buat filter + stepper 5 tahap + modal detail histori.
//
// Sumber cek status pengiriman per ekspedisi:
// - SPX (Shopee Xpress)  -> api/spx-tracking.js (proxy ke spx.co.id, publik tanpa API key)
// - Kurir lain (JNE, J&T, Shopee Hemat, dst) -> belum didukung, tombol "Cek Manual"

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
// (Manifested/Kurir ditugaskan), milestone_code 5 = "In transit" (pickup s/d hub transit).
// Kode buat "OTW"/"Sampai"/"Bermasalah" BELUM ada contoh nyata — kalau hasil cek meleset
// di status itu, minta resi asli buat kalibrasi ulang lalu tambah di sini.
const SPX_STAGE_BY_MILESTONE = { 1: 'DIKIRIM', 5: 'KOTA_TUJUAN' };
const TR_STAGE_ORDER = ['DIKIRIM', 'KOTA_TUJUAN', 'OTW', 'SAMPAI'];

function mapSpxStage(apiData) {
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
    if (deliveredWords.some(w => text.includes(w))) higher('SAMPAI');
    else if (otwWords.some(w => text.includes(w))) higher('OTW');
    else if (SPX_STAGE_BY_MILESTONE[r.milestone_code]) higher(SPX_STAGE_BY_MILESTONE[r.milestone_code]);
  });

  if (problem) stage = 'BERMASALAH';
  return { stage, detail: info };
}

async function checkSpxResi(resi) {
  const r = await fetch(`/api/spx-tracking?resi=${encodeURIComponent(resi)}`);
  const data = await r.json();
  if (data.retcode !== 0) throw new Error(data.message || 'Resi tidak ditemukan');
  return mapSpxStage(data);
}

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

async function loadTracking() {
  showLoading();
  try {
    const filters = {};
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
        <button class="btn btn-primary btn-sm" id="trRefreshBtn" onclick="trRefreshAll()">🔄 Refresh Semua (SPX)</button>
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
          <div class="tr-produk">${o.product || '-'} × ${o.qty || 1}</div>
        </div>
      </div>
      <div>
        <div class="tr-price">${fmtFull(o.total || 0)}</div>
        <div class="tr-date">${o.date || '-'}</div>
        ${hasResi ? `<div class="tr-resi">${o.id}</div>` : ''}
      </div>
    </div>
    ${trStepperHtml(stage)}
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

  document.getElementById('trkModalBody').innerHTML = `
    <div style="margin-top:10px"><span class="badge ${meta.badge}">${meta.label}</span></div>
    ${trStepperHtml(stage)}
    ${historyHtml}
  `;
  document.getElementById('trkModalCheckBtn').style.display = (hasResi && o.ekspedisi === 'SPX') ? '' : 'none';
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
  if (o.ekspedisi !== 'SPX') { showToast('Ekspedisi ini belum didukung cek otomatis', 'info'); return; }
  try {
    const { stage, detail } = await checkSpxResi(o.id);
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
  const targets = _trkOrders.filter(o => o.ekspedisi === 'SPX' && !['SAMPAI', 'RETUR'].includes(o.status_resi));
  if (!targets.length) { showToast('Tidak ada resi SPX untuk dicek', 'info'); return; }
  btn.disabled = true;
  btn.textContent = `Mengecek 0/${targets.length}...`;
  let done = 0;
  const BATCH = 5;
  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    await Promise.all(batch.map(async o => {
      try {
        const { stage, detail } = await checkSpxResi(o.id);
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
  btn.textContent = '🔄 Refresh Semua (SPX)';
  trUpdateStats();
  trApplyFilter();
  showToast('✅ Selesai cek semua resi SPX', 'success');
}
