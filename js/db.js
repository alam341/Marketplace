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
  const { data, error } = await _sb.from('profiles').select('*').eq('role', 'adv').order('name');
  if (error) throw error;
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
  // Deduplicate by id — satu order bisa punya banyak SKU (baris),
  // gabungkan qty + total supaya tidak conflict di upsert
  const merged = new Map();
  inserts.forEach(r => {
    if (merged.has(r.id)) {
      const ex = merged.get(r.id);
      ex.qty   += r.qty;
      ex.total += r.total;
    } else {
      merged.set(r.id, { ...r });
    }
  });
  const uniqueInserts = Array.from(merged.values());

  const { data, error } = await _sb.from(table).upsert(uniqueInserts, { onConflict: 'id' }).select();
  if (error) throw error;
  return data;
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

async function dbGetAllMarketplaceOrders(filters = {}) {
  const tables = ['shopee', 'tiktok', 'lazada'];
  const queries = tables.map(mp => {
    let q = _sb.from(mp + '_orders')
      .select('*, profiles(id, name, avatar, role)')
      .order('date', { ascending: false });
    if (filters.dateFrom) q = q.gte('date', filters.dateFrom);
    if (filters.dateTo)   q = q.lte('date', filters.dateTo);
    if (filters.status)   q = q.eq('status', filters.status);
    if (filters.advId)    q = q.eq('adv_id', filters.advId);
    return q.then(({ data }) => (data || []).map(r => ({ ...r, marketplace: mp })));
  });

  const results = await Promise.all(queries);
  const all = results.flat();

  if (filters.marketplace) return all.filter(r => r.marketplace === filters.marketplace);

  return all.sort((a, b) => new Date(b.date) - new Date(a.date));
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
