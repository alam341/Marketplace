// ── Supabase Client ───────────────────────────────────────────────────────────
const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Auth ──────────────────────────────────────────────────────────────────────
async function sbLogin(email, password) {
  const { data, error } = await _sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

async function sbLogout() {
  await _sb.auth.signOut();
  sessionStorage.clear();
  window.location.href = 'index.html';
}

async function sbGetSession() {
  const { data } = await _sb.auth.getSession();
  return data.session;
}

// ── Profiles ──────────────────────────────────────────────────────────────────
async function dbGetProfile(userId) {
  const { data, error } = await _sb.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

async function dbGetAllProfiles() {
  try {
    const raw = sessionStorage.getItem('adv_profiles');
    if (raw) {
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts < _CACHE_TTL) return data;
    }
  } catch {}
  const { data, error } = await _sb.from('profiles').select('*').eq('role', 'adv').order('name');
  if (error) throw error;
  try { sessionStorage.setItem('adv_profiles', JSON.stringify({ data, ts: Date.now() })); } catch {}
  return data;
}

// ── Transactions ──────────────────────────────────────────────────────────────
// RLS otomatis filter: ADV hanya lihat data sendiri, SPV lihat semua
async function dbGetTransactions(filters = {}) {
  let q = _sb.from('transactions')
    .select('*, profiles(id, name, avatar, role)')
    .order('date', { ascending: false });

  if (filters.dateFrom)    q = q.gte('date', filters.dateFrom);
  if (filters.dateTo)      q = q.lte('date', filters.dateTo);
  if (filters.marketplace) q = q.eq('marketplace', filters.marketplace);
  if (filters.status)      q = q.eq('status', filters.status);
  if (filters.advId)       q = q.eq('adv_id', filters.advId);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function dbInsertTransaction(trx) {
  const session = await sbGetSession();
  const { data, error } = await _sb.from('transactions').insert({
    ...trx,
    adv_id: session.user.id,
    id: 'TRX-' + Date.now(),
  }).select().single();
  if (error) throw error;
  return data;
}

async function dbUpdateTransactionStatus(id, status) {
  const { error } = await _sb.from('transactions').update({ status }).eq('id', id);
  if (error) throw error;
}

async function dbBulkInsertMarketplaceOrders(marketplace, rows, storeName = '', batchId = null) {
  const session = await sbGetSession();
  const table = marketplace + '_orders';
  const inserts = rows.map(r => ({
    id:              r.id,
    date:            r.date,
    sku:             r.sku,
    product:         r.product,
    qty:             r.qty,
    unit_price:      r.unit_price,
    total:           r.total,
    status:          r.status,
    store_name:      storeName,
    order_hour:      r.order_hour ?? null,
    upload_batch_id: batchId,
    adv_id:          session.user.id,
  }));
  // Buang duplikat ID dalam batch yang sama (keep last)
  const seen = new Map();
  inserts.forEach(r => seen.set(r.id, r));
  const unique = Array.from(seen.values());

  // Cek ID mana yang sudah ada di DB (milik ADV ini)
  const allIds = unique.map(r => r.id);
  const existingIds = new Set();
  const CHECK_CHUNK = 500;
  for (let i = 0; i < allIds.length; i += CHECK_CHUNK) {
    const chunk = allIds.slice(i, i + CHECK_CHUNK);
    const { data } = await _sb.from(table).select('id').in('id', chunk);
    (data || []).forEach(r => existingIds.add(r.id));
  }

  const newRows = unique.filter(r => !existingIds.has(r.id));
  const skipped = unique.length - newRows.length;

  // Insert dengan ignoreDuplicates — kalau ID sudah ada, lewati saja (DO NOTHING)
  const CHUNK = 500;
  for (let i = 0; i < newRows.length; i += CHUNK) {
    const chunk = newRows.slice(i, i + CHUNK);
    const { error } = await _sb.from(table).upsert(chunk, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw error;
  }

  clearOrdersCache();
  return { saved: newRows.length, skipped };
}

async function dbGetUploadBatches() {
  const { data, error } = await _sb.from('upload_batches')
    .select('*, profiles(id, name, avatar)')
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function dbDeleteUploadBatch(batchId, marketplace) {
  const { error: e1 } = await _sb.from(marketplace + '_orders').delete().eq('upload_batch_id', batchId);
  if (e1) throw e1;
  const { error: e2 } = await _sb.from('upload_batches').delete().eq('id', batchId);
  if (e2) throw e2;
}

// ── sessionStorage Cache ──────────────────────────────────────────────────────
const _CACHE_TTL = 5 * 60 * 1000; // 5 menit

function _cacheKey(filters) {
  return 'mp_orders_' + JSON.stringify(filters);
}
function _getCache(filters) {
  try {
    const raw = sessionStorage.getItem(_cacheKey(filters));
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > _CACHE_TTL) { sessionStorage.removeItem(_cacheKey(filters)); return null; }
    return data;
  } catch { return null; }
}
function _setCache(filters, data) {
  try {
    sessionStorage.setItem(_cacheKey(filters), JSON.stringify({ data, ts: Date.now() }));
  } catch {} // abaikan kalau storage penuh
}
function clearOrdersCache() {
  Object.keys(sessionStorage)
    .filter(k => k.startsWith('mp_orders_'))
    .forEach(k => sessionStorage.removeItem(k));
}

async function _fetchAllRows(table, filters) {
  const COLS = 'id, date, sku, product, qty, total, status, store_name, order_hour, upload_batch_id, adv_id, profiles(id, name, avatar)';
  const PAGE = 1000;
  let from = 0, all = [];
  while (true) {
    let q = _sb.from(table)
      .select(COLS)
      .order('date', { ascending: false })
      .range(from, from + PAGE - 1);
    if (filters.dateFrom) q = q.gte('date', filters.dateFrom);
    if (filters.dateTo)   q = q.lte('date', filters.dateTo);
    if (filters.status)   q = q.eq('status', filters.status);
    if (filters.advId)    q = q.eq('adv_id', filters.advId);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function dbGetAllMarketplaceOrders(filters = {}) {
  const cached = _getCache(filters);
  if (cached) return cached;

  const tables = ['shopee', 'tiktok', 'lazada'];
  const results = await Promise.all(
    tables.map(mp =>
      _fetchAllRows(mp + '_orders', filters)
        .then(rows => rows.map(r => ({ ...r, marketplace: mp })))
    )
  );

  let all = results.flat();
  if (filters.marketplace) all = all.filter(r => r.marketplace === filters.marketplace);
  else all.sort((a, b) => new Date(b.date) - new Date(a.date));

  _setCache(filters, all);
  return all;
}

// ── Rekap by Upload Date ──────────────────────────────────────────────────────
async function dbGetOrdersByBatchIds(marketplace, batchIds) {
  if (!batchIds.length) return [];
  const table = marketplace + '_orders';
  const PAGE = 1000;
  let from = 0, all = [];
  while (true) {
    let q = _sb.from(table)
      .select('*, profiles(id, name, avatar, role)')
      .in('upload_batch_id', batchIds)
      .range(from, from + PAGE - 1);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all.map(r => ({ ...r, marketplace }));
}

async function dbGetRekapByUploadDate(uploadDate, advId = null) {
  // uploadDate format: 'YYYY-MM-DD'
  const dateStart = uploadDate + 'T00:00:00';
  const dateEnd   = uploadDate + 'T23:59:59';

  let q = _sb.from('upload_batches')
    .select('id, marketplace, store_name, adv_id, uploaded_at')
    .gte('uploaded_at', dateStart)
    .lte('uploaded_at', dateEnd);
  if (advId) q = q.eq('adv_id', advId);

  const { data: batches, error } = await q;
  if (error) throw error;
  if (!batches || batches.length === 0) return [];

  // Group batch IDs by marketplace
  const byMp = {};
  batches.forEach(b => {
    if (!byMp[b.marketplace]) byMp[b.marketplace] = [];
    byMp[b.marketplace].push(b.id);
  });

  const results = await Promise.all(
    Object.entries(byMp).map(([mp, ids]) => dbGetOrdersByBatchIds(mp, ids))
  );
  return results.flat();
}

// ── Profile Update ────────────────────────────────────────────────────────────
async function dbUpdateProfile(updates) {
  const session = await sbGetSession();
  const { error } = await _sb.from('profiles').update(updates).eq('id', session.user.id);
  if (error) throw error;
}

async function dbUploadAvatar(file) {
  const session = await sbGetSession();
  const ext = file.name.split('.').pop();
  const path = `${session.user.id}/avatar.${ext}`;
  const { error } = await _sb.storage.from('avatars').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = _sb.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl + '?t=' + Date.now();
}

// ── Products ──────────────────────────────────────────────────────────────────
async function dbGetProducts(filters = {}) {
  let q = _sb.from('products')
    .select('*, profiles(id, name, avatar)')
    .order('name');

  if (filters.category) q = q.eq('category', filters.category);
  if (filters.advId)    q = q.eq('adv_id', filters.advId);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function dbUpsertProduct(product) {
  const session = await sbGetSession();
  const { data, error } = await _sb.from('products').upsert({
    ...product,
    adv_id: session.user.id,
  }).select().single();
  if (error) throw error;
  return data;
}

// ── Revenue Aggregation (dihitung dari transactions) ──────────────────────────
function calcMonthlyRevenue(transactions) {
  // Returns: { '2026-04': { shopee:0, lazada:0, tiktok:0, total:0 }, ... }
  const cancelKeywords = ['batal', 'cancel', 'cancelled', 'canceled'];
  const result = {};
  transactions
    .filter(t => !cancelKeywords.some(k => String(t.status || '').toLowerCase().includes(k)))
    .forEach(t => {
      const month = String(t.date).substring(0, 7);
      if (!result[month]) result[month] = { shopee: 0, lazada: 0, tiktok: 0, total: 0 };
      const val = t.total || 0;
      if (result[month][t.marketplace] !== undefined) result[month][t.marketplace] += val;
      result[month].total += val;
    });
  return result;
}

function calcStats(transactions) {
  const cancelKeywords = ['batal', 'cancel', 'cancelled', 'canceled'];
  const isCancelled = t => cancelKeywords.some(k => String(t.status || '').toLowerCase().includes(k));
  const valid = transactions.filter(t => !isCancelled(t));
  return {
    totalOmset:  valid.reduce((s, t) => s + (t.total || 0), 0),
    totalOrders: valid.length,
    totalQty:    valid.reduce((s, t) => s + (t.qty || 0), 0),
    cancelled:   transactions.filter(t => isCancelled(t)).length,
  };
}

// ── Real-time subscription ─────────────────────────────────────────────────────
function subscribeTransactions(callback) {
  return _sb
    .channel('transactions-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, callback)
    .subscribe();
}
