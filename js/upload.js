// ── Upload Modal ──────────────────────────────────────────────────────────────
let _uploadStep = 1;
let _uploadedWb = null;
let _uploadedHeaders = [];

function openUploadModal() {
  _uploadStep = 1;
  _uploadedWb = null;
  _uploadedHeaders = [];
  _renderUploadModal();
  document.getElementById('uploadModalOverlay').classList.add('open');
}

function closeUploadModal() {
  document.getElementById('uploadModalOverlay').classList.remove('open');
}

function _renderUploadModal() {
  let content = '';
  if (_uploadStep === 1) {
    content = `
      <div class="upload-steps">
        <span class="step-pill active">1 Upload</span>
        <span class="step-arrow">›</span>
        <span class="step-pill">2 Mapping</span>
        <span class="step-arrow">›</span>
        <span class="step-pill">3 Konfirmasi</span>
      </div>
      <p style="font-size:.85rem;color:var(--text-2);margin-bottom:14px">
        Upload file Excel laporan closing dari Shopee, Lazada, atau TikTok Shop.
        File harus memiliki kolom tanggal, SKU, jumlah, dan total harga.
      </p>
      <div class="drop-zone-modal" id="uploadDropZone" onclick="document.getElementById('uploadFileInput').click()">
        <div class="dz-icon">📁</div>
        <p><strong>Klik atau drag & drop</strong> file Excel di sini</p>
        <div class="dz-hint">.xlsx / .xls • Maks 20MB</div>
      </div>
      <input type="file" id="uploadFileInput" accept=".xlsx,.xls" style="display:none" onchange="_handleUploadFile(this.files[0])">
      <div id="uploadFileInfo" style="margin-top:12px"></div>
      <div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn-outline btn-sm" onclick="closeUploadModal()">Batal</button>
        <button class="btn btn-primary btn-sm" id="btnNextStep" onclick="_goToStep2()" disabled>Lanjut →</button>
      </div>
    `;
  } else if (_uploadStep === 2) {
    const opts = ['-- Pilih kolom --', ..._uploadedHeaders];
    const makeOpt = (headers, keywords) => {
      const found = headers.find(h => keywords.some(k => h.toLowerCase().includes(k))) || '';
      return opts.map(o => `<option value="${o}" ${o===found?'selected':''}>${o}</option>`).join('');
    };
    content = `
      <div class="upload-steps">
        <span class="step-pill done">✓ Upload</span>
        <span class="step-arrow">›</span>
        <span class="step-pill active">2 Mapping</span>
        <span class="step-arrow">›</span>
        <span class="step-pill">3 Konfirmasi</span>
      </div>
      <p style="font-size:.85rem;color:var(--text-2);margin-bottom:14px">
        Pilih kolom yang sesuai dari file Excel Anda:
      </p>
      <div class="mapping-row">
        <div>
          <label>📅 Tanggal / Order Date</label>
          <select id="mapDate">${makeOpt(_uploadedHeaders,['tanggal','date','tgl','waktu','time','order'])}</select>
        </div>
        <div>
          <label>🏷️ SKU / Kode Produk *</label>
          <select id="mapSku">${makeOpt(_uploadedHeaders,['sku','kode','product id','item id','code','produk'])}</select>
        </div>
        <div>
          <label>📦 Nama Produk</label>
          <select id="mapName">${makeOpt(_uploadedHeaders,['nama','name','produk','product','item','deskripsi'])}</select>
        </div>
        <div>
          <label>🛒 Marketplace</label>
          <select id="mapMarketplace">${makeOpt(_uploadedHeaders,['marketplace','platform','channel','toko','store'])}</select>
        </div>
        <div>
          <label>📊 Qty / Jumlah *</label>
          <select id="mapQty">${makeOpt(_uploadedHeaders,['qty','jumlah','kuantitas','quantity','terjual','sold','unit'])}</select>
        </div>
        <div>
          <label>💰 Total Harga / Omset *</label>
          <select id="mapOmset">${makeOpt(_uploadedHeaders,['omset','total','harga','price','revenue','amount','pendapatan','settlement'])}</select>
        </div>
      </div>
      <div style="margin-top:6px;font-size:.75rem;color:var(--text-3)">* wajib diisi</div>
      <div id="mappingError" style="display:none;margin-top:10px;padding:8px 12px;background:rgba(239,35,60,.1);color:var(--danger);border-radius:8px;font-size:.82rem"></div>
      <div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn-outline btn-sm" onclick="_goToStep1()">← Kembali</button>
        <button class="btn btn-primary btn-sm" onclick="_goToStep3()">Preview →</button>
      </div>
    `;
  } else if (_uploadStep === 3) {
    content = `
      <div class="upload-steps">
        <span class="step-pill done">✓ Upload</span>
        <span class="step-arrow">›</span>
        <span class="step-pill done">✓ Mapping</span>
        <span class="step-arrow">›</span>
        <span class="step-pill active">3 Konfirmasi</span>
      </div>
      <div id="previewContent"></div>
      <div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn-outline btn-sm" onclick="_goToStep2()">← Kembali</button>
        <button class="btn btn-success btn-sm" onclick="_applyData()">✅ Terapkan Data</button>
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

  if (_uploadStep === 3) _renderPreview();
}

function _handleUploadFile(file) {
  if (!file) return;
  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    document.getElementById('uploadFileInfo').innerHTML = `<span style="color:var(--danger)">❌ File harus berformat .xlsx atau .xls</span>`;
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      _uploadedWb = XLSX.read(e.target.result, { type: 'binary' });
      const ws = _uploadedWb.Sheets[_uploadedWb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      // Find header row
      for (let i = 0; i < Math.min(6, rows.length); i++) {
        const cols = rows[i].map(String).filter(v => v.trim());
        if (cols.length >= 3) { _uploadedHeaders = cols; break; }
      }
      const rowCount = XLSX.utils.sheet_to_json(ws).length;
      document.getElementById('uploadFileInfo').innerHTML = `
        <div style="background:rgba(6,194,112,.1);border-radius:8px;padding:10px 14px;display:flex;gap:10px;align-items:center">
          <span style="font-size:1.3rem">✅</span>
          <div>
            <div style="font-weight:700;font-size:.85rem">${file.name}</div>
            <div style="font-size:.75rem;color:var(--text-3)">${rowCount} baris data • ${_uploadedHeaders.length} kolom</div>
          </div>
        </div>
      `;
      document.getElementById('btnNextStep').removeAttribute('disabled');
    } catch(err) {
      document.getElementById('uploadFileInfo').innerHTML = `<span style="color:var(--danger)">❌ Gagal membaca file: ${err.message}</span>`;
    }
  };
  reader.readAsBinaryString(file);
}

function _goToStep1() { _uploadStep = 1; _renderUploadModal(); }
function _goToStep2() { _uploadStep = 2; _renderUploadModal(); }

function _goToStep3() {
  const sku   = document.getElementById('mapSku').value;
  const qty   = document.getElementById('mapQty').value;
  const omset = document.getElementById('mapOmset').value;
  const errEl = document.getElementById('mappingError');

  if (!sku || sku === '-- Pilih kolom --' || !qty || qty === '-- Pilih kolom --' ||
      !omset || omset === '-- Pilih kolom --') {
    errEl.style.display = 'block';
    errEl.textContent = '❌ Kolom SKU, Qty, dan Total Harga wajib dipilih.';
    return;
  }

  window._mapping = {
    date: document.getElementById('mapDate').value,
    sku, name: document.getElementById('mapName').value,
    marketplace: document.getElementById('mapMarketplace').value,
    qty, omset,
  };

  _uploadStep = 3;
  _renderUploadModal();
}

function _renderPreview() {
  const m  = window._mapping;
  const ws = _uploadedWb.Sheets[_uploadedWb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const parsed = _parseRows(rows, m).slice(0, 5);

  const totalRows = _parseRows(rows, m).length;

  document.getElementById('previewContent').innerHTML = `
    <div style="background:rgba(67,97,238,.07);border-radius:10px;padding:12px 16px;margin-bottom:14px;font-size:.85rem">
      <strong>${totalRows}</strong> baris berhasil diparsing. Ini preview 5 baris pertama:
    </div>
    <div class="table-wrap preview-table">
      <table>
        <thead><tr>
          <th>Tanggal</th><th>SKU</th><th>Nama</th><th>Marketplace</th><th>Qty</th><th>Omset</th>
        </tr></thead>
        <tbody>
          ${parsed.map(r => `
            <tr>
              <td>${r.date}</td>
              <td style="font-family:monospace;font-size:.76rem">${r.sku}</td>
              <td>${r.product}</td>
              <td>${badgeMarketplace(r.marketplace)}</td>
              <td><strong>${r.qty}</strong></td>
              <td style="color:var(--primary);font-weight:700">${fmtFull(r.qty*r.price)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div style="margin-top:10px;font-size:.78rem;color:var(--text-3)">
      Data yang diimport akan menggantikan data demo di semua halaman untuk sesi ini.
    </div>
  `;
}

function _parseRows(rows, m) {
  return rows
    .map(row => {
      const sku       = String(row[m.sku]||'').trim();
      const product   = m.name && m.name !== '-- Pilih kolom --' ? String(row[m.name]||'').trim() : '';
      const qty       = parseFloat(String(row[m.qty]||'').replace(/[^0-9.]/g,'')) || 0;
      const price     = parseFloat(String(row[m.omset]||'').replace(/[^0-9.]/g,'')) || 0;
      const dateRaw   = m.date && m.date !== '-- Pilih kolom --' ? String(row[m.date]||'').trim() : '';
      const date      = _parseDate(dateRaw);
      let mp = 'lainnya';
      if (m.marketplace && m.marketplace !== '-- Pilih kolom --') {
        const mpRaw = String(row[m.marketplace]||'').toLowerCase();
        if (mpRaw.includes('shopee')) mp = 'shopee';
        else if (mpRaw.includes('lazada')) mp = 'lazada';
        else if (mpRaw.includes('tiktok') || mpRaw.includes('tik')) mp = 'tiktok';
        else if (mpRaw) mp = mpRaw;
      }
      return { sku, product, qty, price, date, marketplace: mp, status: 'selesai', adv: getCurrentUser()?.id || 'adv1' };
    })
    .filter(r => r.sku && r.qty > 0);
}

function _parseDate(raw) {
  if (!raw) return new Date().toISOString().slice(0,10);
  // Excel serial number
  if (!isNaN(raw) && raw > 1000) {
    const d = new Date((parseFloat(raw) - 25569) * 86400 * 1000);
    return d.toISOString().slice(0,10);
  }
  // Try ISO or common formats
  const cleaned = String(raw).replace(/\//g,'-').replace(/\./g,'-');
  const d = new Date(cleaned);
  if (!isNaN(d)) return d.toISOString().slice(0,10);
  return new Date().toISOString().slice(0,10);
}

async function _applyData() {
  const m  = window._mapping;
  const ws = _uploadedWb.Sheets[_uploadedWb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const parsed = _parseRows(rows, m);

  if (!parsed.length) { showToast('Tidak ada data yang valid untuk diimport.', 'error'); return; }

  const btn = document.querySelector('#uploadModalBody .btn-success');
  if (btn) { btn.textContent = 'Menyimpan...'; btn.disabled = true; }

  try {
    // Coba simpan ke Supabase
    await dbBulkInsertTransactions(parsed);
    closeUploadModal();
    showToast(`✅ ${parsed.length} transaksi berhasil disimpan ke database!`, 'success');
    if (typeof refreshPage === 'function') await refreshPage();
  } catch(e) {
    // Fallback ke session jika Supabase belum dikonfigurasi
    parsed.forEach((r, i) => { r.id = 'IMP-' + String(i+1).padStart(4,'0'); });
    sessionStorage.setItem('importedTrx', JSON.stringify(parsed));
    closeUploadModal();
    showToast(`⚠️ ${parsed.length} data tersimpan sementara (Supabase belum dikonfigurasi).`, 'info');
    if (typeof refreshPage === 'function') refreshPage();
  }
}

function showToast(msg, type = 'success') {
  const colors = { success: 'rgba(6,194,112,1)', error: 'rgba(239,35,60,1)' };
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;background:${colors[type]};
    color:white;padding:12px 20px;border-radius:12px;font-weight:700;font-size:.875rem;
    box-shadow:0 4px 20px rgba(0,0,0,.2);transition:all .3s;`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

// ── Load imported data on page load ───────────────────────────────────────────
function loadImportedData() {
  const raw = sessionStorage.getItem('importedTrx');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      parsed.forEach((r, i) => { if (!r.id) r.id = 'IMP-' + String(i+1).padStart(4,'0'); });
      window.TRANSACTIONS = parsed;
      window.DATA_IMPORTED = true;
    } catch(e) {}
  }
}

// ── Modal HTML (injected into body) ───────────────────────────────────────────
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

document.addEventListener('DOMContentLoaded', () => {
  injectUploadModal();
  loadImportedData();
});
