// ── Tracking Resi ─────────────────────────────────────────────────────────────
// Sumber cek status pengiriman per ekspedisi:
// - SPX (Shopee Xpress)  -> api/spx-tracking.js (proxy ke spx.co.id, publik tanpa API key)
// - Kurir lain (JNE, J&T, POS, dst) -> belum didukung, tampil badge "Cek Manual"

const STATUS_RESI_STAGES = [
  { key: 'MENUNGGU_RESI', label: 'Menunggu Resi',      badge: 'badge-gray'    },
  { key: 'DIKIRIM',        label: 'Diproses/Dikirim',   badge: 'badge-primary' },
  { key: 'KOTA_TUJUAN',    label: 'Dalam Perjalanan',   badge: 'badge-primary' },
  { key: 'OTW',            label: 'Dalam Pengiriman',   badge: 'badge-warning' },
  { key: 'SAMPAI',         label: 'Terkirim',           badge: 'badge-success' },
];
const STATUS_RESI_BERMASALAH = { key: 'BERMASALAH', label: 'Bermasalah/Retur', badge: 'badge-danger' };

// Dikonfirmasi dari resi asli tgl 2026-07-08: milestone_code 1 = "Preparing to ship"
// (Manifested/Kurir ditugaskan), milestone_code 5 = "In transit" (pickup s/d hub transit).
// Kode buat "Dalam Pengiriman"/"Terkirim"/"Bermasalah" BELUM ada contoh nyata — kalau hasil
// cek meleset di status itu, minta resi asli buat kalibrasi ulang lalu tambah di sini.
const SPX_STEP_BY_MILESTONE = { 1: 1, 5: 2 };

function statusResiInfo(key) {
  return STATUS_RESI_STAGES.find(s => s.key === key) || STATUS_RESI_BERMASALAH;
}

function mapSpxStage(apiData) {
  const records = apiData?.data?.sls_tracking_info?.records || [];
  if (!records.length) return { status: 'DIKIRIM', step: 1, detail: records };

  const problemWords   = ['retur', 'return', 'gagal', 'bermasalah', 'batal', 'cancel', 'rts', 'ditolak', 'undelivered'];
  const deliveredWords = ['delivered', 'terkirim', 'diterima', 'selesai', 'complete'];
  const otwWords       = ['out for delivery', 'otw', 'sedang diantar', 'dalam pengiriman', 'kurir sedang', 'menuju alamat'];

  let step = 1;
  let problem = false;

  records.forEach(r => {
    const text = [r.milestone_name, r.tracking_name, r.description].filter(Boolean).join(' ').toLowerCase();
    if (problemWords.some(w => text.includes(w))) problem = true;
    if (deliveredWords.some(w => text.includes(w))) step = Math.max(step, 4);
    else if (otwWords.some(w => text.includes(w))) step = Math.max(step, 3);
    else if (SPX_STEP_BY_MILESTONE[r.milestone_code] != null) step = Math.max(step, SPX_STEP_BY_MILESTONE[r.milestone_code]);
  });

  if (problem) return { status: 'BERMASALAH', step, detail: records };
  return { status: STATUS_RESI_STAGES[step].key, step, detail: records };
}

async function checkSpxResi(resi) {
  const r = await fetch(`/api/spx-tracking?resi=${encodeURIComponent(resi)}`);
  const data = await r.json();
  if (data.retcode !== 0) throw new Error(data.message || 'Resi tidak ditemukan');
  return mapSpxStage(data);
}

// ── Page state ──────────────────────────────────────────────────────────────
let _trkOrders = [];
let _trkFilterEkspedisi = '';
let _trkFilterStatus = '';

async function loadTracking() {
  showLoading();
  try {
    const filters = {};
    if (_user.role !== 'spv') filters.advId = _user.id;
    _trkOrders = await dbGetTrackableOrders(filters);
    renderTracking();
  } catch (e) {
    showError('Gagal memuat data tracking: ' + e.message);
  }
}

function _trkFiltered() {
  return _trkOrders.filter(o => {
    if (_trkFilterEkspedisi && (o.ekspedisi || '') !== _trkFilterEkspedisi) return false;
    if (_trkFilterStatus && (o.status_resi || 'MENUNGGU_RESI') !== _trkFilterStatus) return false;
    return true;
  });
}

function trkSetFilter(kind, value) {
  if (kind === 'ekspedisi') _trkFilterEkspedisi = value;
  if (kind === 'status') _trkFilterStatus = value;
  renderTracking();
}

function renderTracking() {
  const rows = _trkFiltered();
  const counts = { MENUNGGU_RESI: 0, DIKIRIM: 0, KOTA_TUJUAN: 0, OTW: 0, SAMPAI: 0, BERMASALAH: 0 };
  _trkOrders.forEach(o => { const k = o.status_resi || 'MENUNGGU_RESI'; if (counts[k] != null) counts[k]++; });

  const ekspedisiList = [...new Set(_trkOrders.map(o => o.ekspedisi).filter(Boolean))].sort();

  document.getElementById('pageContent').innerHTML = `
    <div class="stat-grid">
      ${[
        { k: 'MENUNGGU_RESI', label: 'Menunggu Resi', icon: '⏳' },
        { k: 'DIKIRIM',       label: 'Diproses/Dikirim', icon: '📦' },
        { k: 'KOTA_TUJUAN',   label: 'Dalam Perjalanan', icon: '🚚' },
        { k: 'OTW',           label: 'Dalam Pengiriman', icon: '🛵' },
        { k: 'SAMPAI',        label: 'Terkirim', icon: '✅' },
        { k: 'BERMASALAH',    label: 'Bermasalah', icon: '⚠️' },
      ].map(s => `
        <div class="stat-card" style="cursor:pointer" onclick="trkSetFilter('status','${_trkFilterStatus===s.k?'':s.k}')">
          <div class="stat-label">${s.label}</div>
          <div class="stat-value">${counts[s.k] || 0}</div>
          <div class="stat-icon">${s.icon}</div>
        </div>
      `).join('')}
    </div>

    <div class="card" style="margin-top:18px">
      <div class="card-header">
        <div class="card-header-left">
          <h3>Tracking Resi</h3>
          <div class="card-sub">${rows.length} order · SPX dicek otomatis lewat API, kurir lain cek manual</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <select class="date-input" onchange="trkSetFilter('ekspedisi', this.value)">
            <option value="">Semua Ekspedisi</option>
            ${ekspedisiList.map(e => `<option value="${e}" ${_trkFilterEkspedisi===e?'selected':''}>${e}</option>`).join('')}
          </select>
          <button class="btn btn-primary btn-sm" onclick="trkCheckAll()">🔄 Cek Semua (SPX)</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Resi</th><th>Ekspedisi</th><th>Produk</th><th>Marketplace</th><th>Tanggal</th><th>Status Resi</th><th>Update Terakhir</th><th></th>
          </tr></thead>
          <tbody id="trkTbody">
            ${rows.map(o => trkRowHtml(o)).join('')}
            ${!rows.length ? `<tr><td colspan="8" class="empty"><div class="icon">📭</div>Belum ada order dengan resi</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function trkRowHtml(o) {
  const info = statusResiInfo(o.status_resi || 'MENUNGGU_RESI');
  const updated = o.status_resi_updated_at
    ? new Date(o.status_resi_updated_at).toLocaleString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })
    : '-';
  const isSpx = (o.ekspedisi || '') === 'SPX';
  return `<tr id="trk-row-${o._table}-${_trkCssId(o.id)}">
    <td style="font-family:monospace;font-size:.75rem">${o.id}</td>
    <td>${o.ekspedisi ? `<span class="badge badge-gray">${o.ekspedisi}</span>` : '<span style="color:var(--text-3)">-</span>'}</td>
    <td><div style="font-weight:600;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.product||'-'}</div></td>
    <td>${badgeMarketplace(o.marketplace)}</td>
    <td style="color:var(--text-3);font-size:.82rem">${o.date}</td>
    <td><span class="badge ${info.badge}">${info.label}</span></td>
    <td style="color:var(--text-3);font-size:.78rem">${updated}</td>
    <td>${isSpx
      ? `<button class="btn btn-outline btn-sm" onclick="trkCheckOne('${o._table}','${o.id}','${o.ekspedisi}')">Cek Ulang</button>`
      : `<span style="font-size:.72rem;color:var(--text-3)">Cek manual</span>`}</td>
  </tr>`;
}

function _trkCssId(id) { return String(id).replace(/[^a-zA-Z0-9]/g, ''); }

async function trkCheckOne(table, resi, ekspedisi) {
  const rowEl = document.getElementById(`trk-row-${table}-${_trkCssId(resi)}`);
  if (rowEl) rowEl.style.opacity = '.5';
  try {
    if (ekspedisi !== 'SPX') { showToast('Ekspedisi ini belum didukung cek otomatis', 'info'); return; }
    const { status, step, detail } = await checkSpxResi(resi);
    const patch = {
      status_resi: status,
      status_resi_step: step,
      status_resi_updated_at: new Date().toISOString(),
      status_resi_detail: detail,
    };
    await dbUpdateTrackingStatus(table, resi, patch);
    const o = _trkOrders.find(x => x._table === table && x.id === resi);
    if (o) Object.assign(o, patch);
    renderTracking();
    showToast('✅ Status diperbarui: ' + statusResiInfo(status).label, 'success');
  } catch (e) {
    showToast('❌ ' + e.message, 'error');
  } finally {
    if (rowEl) rowEl.style.opacity = '1';
  }
}

async function trkCheckAll() {
  const targets = _trkFiltered().filter(o => o.ekspedisi === 'SPX');
  if (!targets.length) { showToast('Tidak ada resi SPX untuk dicek', 'info'); return; }
  showToast(`Mengecek ${targets.length} resi SPX...`, 'info');
  for (const o of targets) {
    try {
      const { status, step, detail } = await checkSpxResi(o.id);
      const patch = {
        status_resi: status,
        status_resi_step: step,
        status_resi_updated_at: new Date().toISOString(),
        status_resi_detail: detail,
      };
      await dbUpdateTrackingStatus(o._table, o.id, patch);
      Object.assign(o, patch);
    } catch (e) { /* lanjut ke resi berikutnya walau satu gagal */ }
    await new Promise(res => setTimeout(res, 250)); // hindari flood ke SPX
  }
  renderTracking();
  showToast('✅ Selesai cek semua resi SPX', 'success');
}
