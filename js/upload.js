// ── Upload Modal ───────────────────────────────────────────────────────────────
let _uploadStep = 1;
let _uploadedWb = null;
let _detectedMarketplace = null;
let _parsedRows = [];
let _storeName = '';

// ── Marketplace Config ─────────────────────────────────────────────────────────
const MP_CONFIG = {
  shopee: {
    label: 'Shopee',
    detect: h => h.some(x => x.includes('no. pesanan') || x.includes('sku induk') || x.includes('nama produk')),
    transposed: false,
    map: {
      id:         h => _findCol(h, ['no. resi', 'nomor resi', 'resi', 'nomor lacak']),
      date:       h => _findCol(h, ['waktu pesanan dibuat']),
      sku:        h => _findCol(h, ['nomor referensi sku']),
      product:    h => _findCol(h, ['nama produk']),
      qty:        h => _findCol(h, ['jumlah']),
      unit_price: h => _findCol(h, ['harga awal']),
      discount:   h => _findCol(h, ['diskon dari penjual', 'diskon penjual']),
      total:      h => null, // dihitung: (unit_price * qty) - discount
      status:     h => _findCol(h, ['status pesanan']),
    },
  },
  tiktok: {
    label: 'TikTok Shop',
    detect: h => h.some(x => x.includes('order id') || x.includes('seller sku') || x.includes('order status')),
    transposed: false,
    map: {
      id:         h => _findCol(h, ['tracking id']),
      date:       h => _findCol(h, ['created time']),
      sku:        h => _findCol(h, ['seller sku']),
      product:    h => _findCol(h, ['product name']),
      qty:        h => _findCol(h, ['quantity']),
      unit_price: h => _findCol(h, ['sku unit original price']),
      discount:   h => _findCol(h, ['sku seller discount', 'seller discount']),
      total:      h => null, // dihitung: (unit_price * qty) - discount
      status:     h => _findCol(h, ['order status']),
    },
  },
  lazada: {
    label: 'Lazada',
    detect: h => h.some(x => x.includes('ordernumber') || x.includes('sellersku') || x.includes('itemname')),
    transposed: false,
    map: {
      id:         h => _findCol(h, ['trackingcode']),
      date:       h => _findCol(h, ['createtime']),
      sku:        h => _findCol(h, ['sellersku']),
      product:    h => _findCol(h, ['itemname']),
      qty:        h => null, // 1 per row
      unit_price: h => _findCol(h, ['unitprice']),
      total:      h => null, // dihitung: qty * unit_price
      status:     h => _findCol(h, ['status']),
    },
  },
};

function _findCol(headers, keywords) {
  return headers.find(h => keywords.some(k => h.toLowerCase().replace(/\s+/g,'').includes(k.replace(/\s+/g,'')))) || null;
}

function _detectMarketplace(headers) {
  const h = headers.map(x => String(x || '').toLowerCase());
  for (const [mp, cfg] of Object.entries(MP_CONFIG)) {
    if (cfg.detect(h)) return mp;
  }
  return null;
}

// ── Normalize status ──────────────────────────────────────────────────────────
function _normalizeStatus(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (!s) return 'diproses';

  // Dibatalkan
  if (s.includes('batal') || s.includes('cancel') || s.includes('failed') ||
      s.includes('gagal') || s.includes('return') || s.includes('refund')) {
    return 'dibatalkan';
  }
  // Selesai
  if (s.includes('selesai') || s.includes('delivered') || s.includes('completed') ||
      s.includes('sukses') || s.includes('success') || s.includes('finish')) {
    return 'selesai';
  }
  // Diproses (default)
  return 'diproses';
}

// ── Parse price string → integer ──────────────────────────────────────────────
function _parsePrice(val) {
  if (!val && val !== 0) return 0;
  // Kalau sudah angka murni (dari Excel cell numeric)
  if (typeof val === 'number') return Math.round(val);

  let s = String(val).replace(/[^0-9.,]/g, '');
  if (!s) return 0;

  // Format Indonesia: titik = ribuan, koma = desimal → "250.000" atau "1.250.000,50"
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  // Format koma = desimal tanpa ribuan → "250,50"
  else if (/^\d+,\d{1,2}$/.test(s)) {
    s = s.replace(',', '.');
  }
  // Format standar, buang koma
  else {
    s = s.replace(',', '');
  }

  return Math.round(parseFloat(s) || 0);
}

function _parseQty(val) {
  return parseInt(String(val || '1').replace(/[^0-9]/g, '')) || 1;
}

// Ambil angka dari nama SKU, misal "Prima 4" → 4, "Prima" → 1
function _skuMultiplier(sku) {
  const match = String(sku || '').match(/(\d+)/g);
  if (!match) return 1;
  // Ambil angka pertama yang ditemukan di SKU
  return parseInt(match[0]) || 1;
}

function _parseDate(raw) {
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (!isNaN(raw) && raw > 1000) {
    return new Date((parseFloat(raw) - 25569) * 86400 * 1000).toISOString().slice(0, 10);
  }
  const cleaned = String(raw).replace(/\//g, '-').replace(/\./g, '-').split(' ')[0];
  const d = new Date(cleaned);
  return isNaN(d) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

// Ambil jam (0-23) dari nilai datetime raw Excel
function _parseHour(raw) {
  if (!raw && raw !== 0) return null;
  // Excel serial number dengan fraksi waktu (misal 46012.625 = jam 15:00)
  if (typeof raw === 'number' && raw > 1) {
    const fraction = raw - Math.floor(raw);
    return Math.floor(fraction * 24);
  }
  // String datetime: "2026-04-23 14:30:00" atau "2026-04-23T14:30"
  const match = String(raw).match(/[T\s](\d{1,2}):/);
  return match ? parseInt(match[1]) : null;
}

// ── Read sheet — handle normal & transposed ────────────────────────────────────
function _readSheet(ws, isTransposed) {
  if (!isTransposed) {
    const headers = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })[0]?.map(String) || [];
    const rows    = XLSX.utils.sheet_to_json(ws, { defval: '' });
    return { headers, rows };
  }

  // TikTok: transposed — column A = field names, columns B,C,D = records
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const headers = raw.map(r => String(r[0] || ''));
  const numRecords = Math.max(...raw.map(r => r.length)) - 1;
  const rows = [];
  for (let col = 1; col <= numRecords; col++) {
    const obj = {};
    raw.forEach((r, i) => { obj[headers[i]] = r[col] ?? ''; });
    rows.push(obj);
  }
  return { headers, rows };
}

// ── Parse rows per marketplace ─────────────────────────────────────────────────
function _parseRows(rows, mp, mapping) {
  const cfg = MP_CONFIG[mp];
  return rows
    .map((row, i) => {
      const get = col => col ? (row[col] ?? '') : '';
      const status     = _normalizeStatus(get(mapping.status));
      const skuRaw     = String(get(mapping.sku) || '').trim();
      const multiplier = _skuMultiplier(skuRaw);
      const qtyRaw     = mapping.qty ? _parseQty(get(mapping.qty)) : 1;
      const qty        = qtyRaw * multiplier;
      const unit_price = _parsePrice(get(mapping.unit_price));
      const discount   = mapping.discount ? _parsePrice(get(mapping.discount)) : 0;
      const total      = Math.max(0, (unit_price * qtyRaw) - discount);
      const rawDate    = get(mapping.date);
      const order_hour = _parseHour(rawDate);
      return {
        id:         String(get(mapping.id) || ('IMP-' + mp + '-' + i)).trim(),
        date:       _parseDate(rawDate),
        sku:        skuRaw,
        product:    String(get(mapping.product) || '').trim(),
        qty,
        unit_price,
        total,
        status,
        order_hour,
        marketplace: mp,
      };
    })
    .filter(r => r.id && r.id.trim());
}

// ── Modal ──────────────────────────────────────────────────────────────────────
function openUploadModal() {
  _uploadStep = 1;
  _uploadedWb = null;
  _detectedMarketplace = null;
  _parsedRows = [];
  _storeName = '';
  _renderUploadModal();
  document.getElementById('uploadModalOverlay').classList.add('open');
}

function closeUploadModal() {
  document.getElementById('uploadModalOverlay').classList.remove('open');
}

function _renderUploadModal() {
  let content = '';

  if (_uploadStep === 1) {
    const mpInfo = _detectedMarketplace
      ? `<div style="background:rgba(6,194,112,.1);border-radius:8px;padding:10px 14px;margin-top:12px;display:flex;gap:10px;align-items:center">
           <span style="font-size:1.2rem">✅</span>
           <div><div style="font-weight:700;font-size:.85rem">Terdeteksi: ${MP_CONFIG[_detectedMarketplace].label}</div>
           <div style="font-size:.75rem;color:var(--text-3)">${_parsedRows.length} baris data siap diimport</div></div>
         </div>
         <div style="margin-top:12px">
           <label style="font-size:.82rem;font-weight:700;color:var(--text-2);display:block;margin-bottom:6px">Nama Toko *</label>
           <input type="text" id="storeNameInput" placeholder="Contoh: Adsy Official, Toko Herbal 2..."
             style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:.875rem;box-sizing:border-box"
             value="${_storeName || ''}">
           <div style="font-size:.72rem;color:var(--text-3);margin-top:4px">Untuk membedakan performa antar toko</div>
         </div>`
      : '';

    content = `
      <div class="upload-steps">
        <span class="step-pill active">1 Upload</span>
        <span class="step-arrow">›</span>
        <span class="step-pill">2 Preview</span>
      </div>
      <p style="font-size:.85rem;color:var(--text-2);margin-bottom:14px">
        Upload file Excel dari <strong>Shopee</strong>, <strong>TikTok Shop</strong>, atau <strong>Lazada</strong>.
        Marketplace akan terdeteksi otomatis.
      </p>
      <div class="drop-zone-modal" id="uploadDropZone" onclick="document.getElementById('uploadFileInput').click()">
        <div class="dz-icon">📁</div>
        <p><strong>Klik atau drag & drop</strong> file Excel di sini</p>
        <div class="dz-hint">.xlsx / .xls • Maks 20MB</div>
      </div>
      <input type="file" id="uploadFileInput" accept=".xlsx,.xls" style="display:none" onchange="_handleUploadFile(this.files[0])">
      <div id="uploadFileInfo">${mpInfo}</div>
      <div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn-outline btn-sm" onclick="closeUploadModal()">Batal</button>
        <button class="btn btn-primary btn-sm" id="btnNextStep" onclick="_goToPreview()" ${!_detectedMarketplace ? 'disabled' : ''}>Preview →</button>
      </div>
    `;
  } else if (_uploadStep === 2) {
    const preview = _parsedRows.slice(0, 5);
    const mp = _detectedMarketplace;
    content = `
      <div class="upload-steps">
        <span class="step-pill done">✓ Upload</span>
        <span class="step-arrow">›</span>
        <span class="step-pill active">2 Preview</span>
      </div>
      <div style="background:rgba(67,97,238,.07);border-radius:10px;padding:12px 16px;margin-bottom:14px;font-size:.85rem">
        <strong>${MP_CONFIG[mp].label}</strong> · <strong>${_parsedRows.length}</strong> baris · Preview 5 pertama:
      </div>
      <div class="table-wrap preview-table">
        <table>
          <thead><tr><th>No. Order</th><th>Tanggal</th><th>SKU</th><th>Produk</th><th>Qty</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>
            ${preview.map(r => `<tr>
              <td style="font-size:.72rem;font-family:monospace">${r.id}</td>
              <td>${r.date}</td>
              <td style="font-size:.72rem">${r.sku||'-'}</td>
              <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.product||'-'}</td>
              <td>${r.qty}</td>
              <td style="color:var(--primary);font-weight:700">${fmtFull(r.total)}</td>
              <td><span style="font-size:.72rem">${r.status}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn-outline btn-sm" onclick="_goToStep1()">← Kembali</button>
        <button class="btn btn-success btn-sm" id="btnApply" onclick="_applyData()">✅ Simpan ke Database</button>
      </div>
    `;
  }

  document.getElementById('uploadModalBody').innerHTML = content;

  if (_uploadStep === 1) {
    const dz = document.getElementById('uploadDropZone');
    if (dz) {
      dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
      dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag-over'); _handleUploadFile(e.dataTransfer.files[0]); });
    }
  }
}

function _handleUploadFile(file) {
  if (!file) return;
  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    document.getElementById('uploadFileInfo').innerHTML = `<span style="color:var(--danger)">❌ File harus .xlsx atau .xls</span>`;
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      _uploadedWb = XLSX.read(e.target.result, { type: 'binary' });
      const wsName = _uploadedWb.SheetNames[0];
      const ws     = _uploadedWb.Sheets[wsName];

      // Try detect marketplace from horizontal headers first
      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      let headerRow = rawRows[0]?.map(String) || [];
      let mp = _detectMarketplace(headerRow);
      let isTransposed = false;

      // If not detected, try transposed (TikTok)
      if (!mp) {
        const colA = rawRows.map(r => String(r[0] || ''));
        mp = _detectMarketplace(colA);
        if (mp) isTransposed = true;
      }

      if (!mp) {
        document.getElementById('uploadFileInfo').innerHTML =
          `<span style="color:var(--danger)">❌ Marketplace tidak dikenali. Pastikan file dari Shopee, TikTok, atau Lazada.</span>`;
        document.getElementById('btnNextStep')?.setAttribute('disabled', true);
        return;
      }

      const cfg = MP_CONFIG[mp];
      const { headers, rows } = _readSheet(ws, isTransposed);
      const mapping = {};
      for (const [field, fn] of Object.entries(cfg.map)) {
        mapping[field] = fn(headers);
      }

      _detectedMarketplace = mp;
      _parsedRows = _parseRows(rows, mp, mapping);
      _renderUploadModal();
    } catch(err) {
      document.getElementById('uploadFileInfo').innerHTML =
        `<span style="color:var(--danger)">❌ Gagal membaca file: ${err.message}</span>`;
    }
  };
  reader.readAsBinaryString(file);
}

function _goToStep1()  { _uploadStep = 1; _renderUploadModal(); }
function _goToPreview() {
  _storeName = document.getElementById('storeNameInput')?.value.trim() || '';
  if (!_storeName) {
    document.getElementById('storeNameInput').style.borderColor = 'var(--danger)';
    document.getElementById('storeNameInput').focus();
    return;
  }
  _uploadStep = 2; _renderUploadModal();
}

async function _applyData() {
  const btn = document.getElementById('btnApply');
  if (btn) { btn.textContent = 'Menyimpan...'; btn.disabled = true; }

  try {
    const session = await sbGetSession();
    const batchId = 'BATCH-' + _detectedMarketplace.toUpperCase() + '-' + Date.now();

    // Simpan record batch dulu (record_count sementara, akan diupdate setelah dedup)
    const { error: bErr } = await _sb.from('upload_batches').insert({
      id:           batchId,
      marketplace:  _detectedMarketplace,
      store_name:   _storeName,
      adv_id:       session.user.id,
      record_count: _parsedRows.length,
    });
    if (bErr) throw bErr;

    let result;
    try {
      result = await dbBulkInsertMarketplaceOrders(_detectedMarketplace, _parsedRows, _storeName, batchId);
    } catch(e) {
      // Gagal simpan order — hapus batch record supaya tidak ada ghost entry
      await _sb.from('upload_batches').delete().eq('id', batchId);
      throw e;
    }

    const { saved, skipped } = result;

    if (saved === 0) {
      // Semua sudah ada, hapus batch kosong
      await _sb.from('upload_batches').delete().eq('id', batchId);
      closeUploadModal();
      showToast(`ℹ️ Semua ${skipped} data sudah ada, tidak ada yang ditambahkan.`, 'info');
      return;
    }

    await _sb.from('upload_batches').update({ record_count: saved }).eq('id', batchId);
    closeUploadModal();

    const mp = MP_CONFIG[_detectedMarketplace].label;
    let msg = `✅ ${saved} data ${mp} berhasil disimpan!`;
    if (skipped > 0) msg += ` (${skipped} dilewati, sudah ada)`;
    showToast(msg, 'success');
    if (typeof refreshPage === 'function') await refreshPage();
  } catch(e) {
    showToast('❌ Gagal simpan: ' + (e.message || e), 'error');
    if (btn) { btn.textContent = '✅ Simpan ke Database'; btn.disabled = false; }
  }
}

function showToast(msg, type = 'success') {
  const colors = { success: '#06C270', error: '#EF233C', info: '#4361EE' };
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;background:${colors[type]||colors.info};
    color:white;padding:12px 20px;border-radius:12px;font-weight:700;font-size:.875rem;
    box-shadow:0 4px 20px rgba(0,0,0,.2);transition:opacity .3s;`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3500);
}

function injectUploadModal() {
  if (document.getElementById('uploadModalOverlay')) return;
  const el = document.createElement('div');
  el.id = 'uploadModalOverlay';
  el.className = 'modal-overlay';
  el.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>📥 Import Data Excel</h3>
        <button class="modal-close" onclick="closeUploadModal()">✕</button>
      </div>
      <div class="modal-body" id="uploadModalBody"></div>
    </div>
  `;
  el.addEventListener('click', e => { if (e.target === el) closeUploadModal(); });
  document.body.appendChild(el);
}

document.addEventListener('DOMContentLoaded', () => { injectUploadModal(); injectManageModal(); });

// ── Manage Uploads Modal ───────────────────────────────────────────────────────
function injectManageModal() {
  if (document.getElementById('manageModalOverlay')) return;
  const el = document.createElement('div');
  el.id = 'manageModalOverlay';
  el.className = 'modal-overlay';
  el.innerHTML = `
    <div class="modal" style="max-width:640px">
      <div class="modal-header">
        <h3>🗂️ Kelola Upload</h3>
        <button class="modal-close" onclick="closeManageModal()">✕</button>
      </div>
      <div class="modal-body" id="manageModalBody">
        <div class="page-loading"><div class="spinner"></div></div>
      </div>
    </div>
  `;
  el.addEventListener('click', e => { if (e.target === el) closeManageModal(); });
  document.body.appendChild(el);
}

function openManageModal() {
  document.getElementById('manageModalOverlay').classList.add('open');
  _loadManageBatches();
}

function closeManageModal() {
  document.getElementById('manageModalOverlay').classList.remove('open');
}

async function _loadManageBatches() {
  const body = document.getElementById('manageModalBody');
  body.innerHTML = `<div class="page-loading"><div class="spinner"></div><div>Memuat data...</div></div>`;
  try {
    const batches = await dbGetUploadBatches();
    if (!batches.length) {
      body.innerHTML = `<div class="page-loading"><div style="font-size:2rem">📭</div><div>Belum ada data upload</div></div>`;
      return;
    }

    const mpColor = { shopee:'#EE4D2D', tiktok:'#888', lazada:'#0F146D' };
    body.innerHTML = `
      <p style="font-size:.82rem;color:var(--text-3);margin-bottom:12px">Klik Hapus untuk menghapus semua data dalam satu file upload.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Marketplace</th><th>Toko</th><th>Upload Oleh</th><th>Tanggal Upload</th><th>Jumlah Data</th><th></th></tr></thead>
          <tbody>
            ${batches.map(b => {
              const p = b.profiles || {};
              const d = new Date(b.uploaded_at);
              const tgl = d.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
              const jam = d.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
              return `<tr>
                <td><span class="badge" style="background:${mpColor[b.marketplace]||'#888'}20;color:${mpColor[b.marketplace]||'#888'};font-weight:700;font-size:.75rem;padding:3px 8px;border-radius:6px">${b.marketplace.toUpperCase()}</span></td>
                <td style="font-weight:600">${b.store_name||'-'}</td>
                <td style="font-size:.8rem;color:var(--text-3)">${p.name?.split(' ')[0]||'-'}</td>
                <td style="font-size:.78rem;color:var(--text-3)">${tgl}<br>${jam}</td>
                <td style="font-weight:700;text-align:center">${b.record_count}</td>
                <td><button class="btn btn-sm" style="background:#FEE2E2;color:#EF233C;border:none;cursor:pointer;border-radius:8px;padding:5px 12px;font-weight:700;font-size:.78rem"
                  onclick="_confirmDeleteBatch('${b.id}','${b.marketplace}','${b.store_name||''}',${b.record_count})">Hapus</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch(e) {
    body.innerHTML = `<div style="color:var(--danger);padding:20px">Gagal memuat: ${e.message}</div>`;
  }
}

function _confirmDeleteBatch(batchId, marketplace, storeName, count) {
  const body = document.getElementById('manageModalBody');
  body.innerHTML = `
    <div style="text-align:center;padding:24px 0">
      <div style="font-size:2.5rem;margin-bottom:12px">⚠️</div>
      <div style="font-weight:800;font-size:1rem;margin-bottom:8px">Hapus upload ini?</div>
      <div style="color:var(--text-3);font-size:.85rem;margin-bottom:4px">
        <strong>${marketplace.toUpperCase()}</strong> · ${storeName || '-'}
      </div>
      <div style="color:var(--danger);font-weight:700;font-size:.9rem;margin-bottom:24px">${count} data akan dihapus permanen</div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button class="btn btn-outline btn-sm" onclick="_loadManageBatches()">Batal</button>
        <button class="btn btn-sm" style="background:#EF233C;color:white;border:none;cursor:pointer;border-radius:10px;padding:8px 20px;font-weight:700"
          id="btnConfirmDelete" onclick="_doDeleteBatch('${batchId}','${marketplace}')">Ya, Hapus Semua</button>
      </div>
    </div>
  `;
}

async function _doDeleteBatch(batchId, marketplace) {
  const btn = document.getElementById('btnConfirmDelete');
  if (btn) { btn.textContent = 'Menghapus...'; btn.disabled = true; }
  try {
    await dbDeleteUploadBatch(batchId, marketplace);
    showToast('✅ Data berhasil dihapus', 'success');
    await _loadManageBatches();
    if (typeof refreshPage === 'function') await refreshPage();
  } catch(e) {
    showToast('❌ Gagal hapus: ' + e.message, 'error');
    await _loadManageBatches();
  }
}
