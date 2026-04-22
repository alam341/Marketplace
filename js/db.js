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

async function dbBulkInsertTransactions(rows) {
  const session = await sbGetSession();
  const inserts = rows.map((r, i) => ({ ...r, adv_id: session.user.id, id: 'TRX-' + Date.now() + '-' + i }));
  const { data, error } = await _sb.from('transactions').insert(inserts).select();
  if (error) throw error;
  return data;
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
  // Returns: { '2024-01': { shopee:0, lazada:0, tiktok:0, total:0 }, ... }
  const result = {};
  transactions
    .filter(t => t.status !== 'dibatalkan')
    .forEach(t => {
      const month = String(t.date).substring(0, 7);
      if (!result[month]) result[month] = { shopee: 0, lazada: 0, tiktok: 0, total: 0 };
      const val = (t.qty || 0) * (t.price || 0);
      if (result[month][t.marketplace] !== undefined) result[month][t.marketplace] += val;
      result[month].total += val;
    });
  return result;
}

function calcStats(transactions) {
  const valid = transactions.filter(t => t.status !== 'dibatalkan');
  return {
    totalOmset:  valid.reduce((s, t) => s + t.qty * t.price, 0),
    totalOrders: valid.length,
    totalQty:    valid.reduce((s, t) => s + t.qty, 0),
    cancelled:   transactions.filter(t => t.status === 'dibatalkan').length,
  };
}

// ── Real-time subscription ─────────────────────────────────────────────────────
function subscribeTransactions(callback) {
  return _sb
    .channel('transactions-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, callback)
    .subscribe();
}
