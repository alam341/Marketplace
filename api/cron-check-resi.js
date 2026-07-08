// Endpoint buat di-hit cron eksternal (cron-job.org dkk) tiap beberapa jam — Vercel Hobby
// plan cuma dukung cron native 1x/hari, jadi pengecekan berkala pakai cron pihak ketiga.
// Auth via header "Authorization: Bearer <CRON_SECRET>" ATAU query "?secret=<CRON_SECRET>".
//
// PENTING: heuristik di file ini (mapSpxStage/mapPosStage/mapMengantarStage/trCityMatches)
// diporting dari js/tracking.js. Project ini gak ada build step, jadi kalau ubah logic di
// salah satu, WAJIB disinkron manual ke yang satunya.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://exuyyimjaxdkybzpjyrn.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TABLES = ['shopee_orders', 'tiktok_orders', 'lazada_orders'];
const MENGANTAR_COURIER_MAP = {
  JNE: 'JNE', 'J&T': 'JT', SICEPAT: 'SiCepat', ANTERAJA: 'anteraja',
  NINJA: 'Ninja', IDEXPRESS: 'iDexpress', LION: 'lion',
};
const STAGE_STEP = {
  MENUNGGU_RESI: 1, BELUM_DICEK: 1, DIKIRIM: 2, KOTA_TUJUAN: 3, OTW: 4, SAMPAI: 5,
  BERMASALAH: 2, RETUR: 2,
};

// ── Cocokkan kota tujuan pembeli ke lokasi event ───────────────────────────────
function trNormalizeCity(s) {
  return String(s || '').toUpperCase().replace(/^(KOTA|KAB\.?|KABUPATEN)\s+/g, '').replace(/\s+/g, ' ').trim();
}
function trCityMatches(destCity, locationName) {
  if (!destCity || !locationName) return false;
  const dest = trNormalizeCity(destCity);
  if (!dest) return false;
  const firstWord = dest.split(' ')[0];
  return firstWord.length >= 4 && String(locationName).toUpperCase().includes(firstWord);
}

// ── SPX ─────────────────────────────────────────────────────────────────────
const SPX_STAGE_BY_MILESTONE = { 1: 'DIKIRIM', 5: 'KOTA_TUJUAN', 6: 'OTW', 8: 'SAMPAI' };
const TR_STAGE_ORDER = ['DIKIRIM', 'KOTA_TUJUAN', 'OTW', 'SAMPAI'];

function mapSpxStage(apiData, destCity) {
  const info = apiData?.data?.sls_tracking_info || null;
  const records = info?.records || [];
  if (!records.length) return { stage: 'DIKIRIM', detail: info };

  const problemWords   = ['retur', 'return', 'gagal', 'bermasalah', 'batal', 'cancel', 'rts', 'ditolak', 'undelivered'];
  const deliveredWords = ['delivered', 'terkirim', 'diterima', 'selesai', 'complete'];
  const otwWords       = ['out for delivery', 'otw', 'sedang diantar', 'dalam pengiriman', 'kurir sedang', 'menuju alamat'];

  let stage = 'DIKIRIM';
  let problem = false;
  let retur = false; // dikonfirmasi 2026-07-08: milestone_code 10 = "Delivery Unsuccessful" (F671-F999, retur ke penjual)
  const higher = s => { if (TR_STAGE_ORDER.indexOf(s) > TR_STAGE_ORDER.indexOf(stage)) stage = s; };

  records.forEach(r => {
    const text = [r.milestone_name, r.tracking_name, r.description].filter(Boolean).join(' ').toLowerCase();
    if (r.milestone_code === 10) { retur = true; return; }
    if (problemWords.some(w => text.includes(w))) problem = true;
    if (deliveredWords.some(w => text.includes(w))) { higher('SAMPAI'); return; }
    if (otwWords.some(w => text.includes(w))) { higher('OTW'); return; }
    const ms = SPX_STAGE_BY_MILESTONE[r.milestone_code];
    if (ms === 'KOTA_TUJUAN') {
      if (trCityMatches(destCity, r.current_location?.location_name)) higher('KOTA_TUJUAN');
    } else if (ms) {
      higher(ms);
    }
  });

  if (retur) stage = 'RETUR';
  else if (problem) stage = 'BERMASALAH';
  return { stage, detail: info };
}

async function checkSpxResi(resi, destCity) {
  const r = await fetch(`https://spx.co.id/shipment/order/open/order/get_order_info?spx_tn=${encodeURIComponent(resi)}&language_code=id`, {
    headers: {
      accept: 'application/json, text/plain, */*',
      referer: `https://spx.co.id/track?${encodeURIComponent(resi)}`,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  const data = await r.json();
  if (data.retcode !== 0) throw new Error(data.message || 'Resi tidak ditemukan');
  return mapSpxStage(data, destCity);
}

// ── POS (via bosampuh.id) ──────────────────────────────────────────────────────
// Dikonfirmasi dari resi asli 2026-07-08 (gagal antar & retur):
// - history[].state === "FAILEDTODELIVERED" → percobaan antar gagal, masih bisa dicoba
//   ulang → BERMASALAH.
// - history[].state === "Irregularity" ATAU connote_state akhir "DELIVERED (RETURN
//   DELIVERY)" (BUKAN "DELIVERED" polos!) → paket beneran balik ke pengirim → RETUR.
const POS_TRANSIT_STATES = ['inBag', 'INVEHICLE', 'INLOCATION', 'unBag'];

function mapPosStage(apiData, destCity) {
  const history = apiData?.connote_history || [];
  const state = apiData?.connote_state || '';

  const hasRetur = /return/i.test(state) || history.some(h => h.state === 'Irregularity');
  const hasProblem = history.some(h => h.state === 'FAILEDTODELIVERED');

  let stage;
  if (hasRetur) stage = 'RETUR';
  else if (state === 'DELIVERED') stage = 'SAMPAI';
  else if (hasProblem) stage = 'BERMASALAH';
  else if (state === 'DELIVERYRUNSHEET') stage = 'OTW';
  else if (POS_TRANSIT_STATES.includes(state)) {
    const latestCity = history.length ? history[history.length - 1].city : null;
    stage = trCityMatches(destCity, latestCity) ? 'KOTA_TUJUAN' : 'DIKIRIM';
  } else {
    stage = 'DIKIRIM';
  }

  const records = history.slice().reverse().map(h => ({
    description: h.content2 || h.content,
    tracking_name: h.action,
    actual_time: h.created_at ? Math.floor(new Date(h.created_at.replace(' ', 'T')).getTime() / 1000) : null,
    current_location: { location_name: h.location_name || h.city || '' },
  }));
  return { stage, detail: { records } };
}

async function checkPosResi(resi, destCity) {
  const body = new URLSearchParams({ kode_booking: resi }).toString();
  const r = await fetch('https://www.bosampuh.id/api_home/lacak_kiriman', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36',
      Referer: 'https://www.bosampuh.id/',
      Origin: 'https://www.bosampuh.id',
    },
    body,
  });
  const raw = await r.text();
  const data = typeof raw === 'string' && raw.startsWith('"') ? JSON.parse(JSON.parse(raw)) : JSON.parse(raw);
  if (data.error || !data.connote_code) throw new Error(data.error || 'Resi tidak ditemukan');
  return mapPosStage(data, destCity);
}

// ── Kurir lain via Mengantar ────────────────────────────────────────────────────
const TR_RETUR_PATTERN   = /retur|dikembalikan|\brts\b|\brto\b|return to sender/i;
const TR_PROBLEM_PATTERN = /gagal|kendala|bermasalah|problematic|tidak ditemukan|alamat tidak (lengkap|dikenal)|tidak ada orang|tidak ditempat|tidak dihuni|menunggu konfirmasi|disimpan di gudang|ditolak|pindah alamat|box undel/i;
const TR_OTW_PATTERN     = /sedang diantar|dalam pengantaran|out for delivery|kurir menuju|\botw\b|akan dikirim ke alamat penerima|with delivery courier|delivery courier|diantar ke alamat|on delivery|1st attempt|2nd attempt|percobaan/i;
const TR_KOTA_TUJUAN_PATTERN = /kota tujuan|gudang tujuan|tiba di kota|received at destination|received at warehouse|process and forward|inbound|sti-dest/i;

function mengantarComputeStep(entries) {
  let step = 2;
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

  const records = history.slice().reverse().map(h => ({ description: [h.desc, h.code].filter(Boolean).join(' ') || '-' }));
  return { stage, detail: { records } };
}

async function checkMengantarResi(resi, ekspedisi) {
  const courier = MENGANTAR_COURIER_MAP[ekspedisi];
  if (!courier) throw new Error('Ekspedisi belum didukung');
  const r = await fetch(`https://app.mengantar.com/api/order/getPublic?tracking_number=${encodeURIComponent(resi)}&courier=${encodeURIComponent(courier)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Accept: 'application/json',
      Referer: 'https://www.mengantar.com/',
      Origin: 'https://www.mengantar.com',
    },
  });
  const data = await r.json();
  return mapMengantarStage(data);
}

async function checkResiAuto(row) {
  if (row.ekspedisi === 'SPX') return checkSpxResi(row.id, row.kota_tujuan);
  if (row.ekspedisi === 'POS') return checkPosResi(row.id, row.kota_tujuan);
  if (MENGANTAR_COURIER_MAP[row.ekspedisi]) return checkMengantarResi(row.id, row.ekspedisi);
  throw new Error('Ekspedisi tidak didukung');
}

// ── Notif WA (Fonnte) ────────────────────────────────────────────────────────────
async function sendFonnteWA(target, message) {
  if (!process.env.FONNTE_TOKEN || !target) return;
  const body = new URLSearchParams({ target, message }).toString();
  await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: { Authorization: process.env.FONNTE_TOKEN, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

const PROBLEM_STAGES = ['BERMASALAH', 'RETUR'];

// ── Supabase REST helper ────────────────────────────────────────────────────────
async function sbFetch(path, options = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.method === 'PATCH' ? { Prefer: 'return=minimal' } : {}),
      ...options.headers,
    },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  if (options.method === 'PATCH') return null;
  return r.json();
}

const AUTO_EKSPEDISI_LIST = ['SPX', 'POS', 'JNE', 'J&T', 'SICEPAT', 'ANTERAJA', 'NINJA', 'IDEXPRESS', 'LION'];

export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.query.secret;
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum di-set' });
  }

  const ekspedisiFilter = AUTO_EKSPEDISI_LIST.map(e => encodeURIComponent(e)).join(',');
  let checked = 0, updated = 0, failed = 0, notified = 0;
  const errors = [];

  for (const table of TABLES) {
    let rows;
    try {
      rows = await sbFetch(
        `${table}?select=id,ekspedisi,kota_tujuan,status_resi,product,adv_id,profiles(no_wa,name)&ekspedisi=in.(${ekspedisiFilter})&status_resi=not.in.(SAMPAI,RETUR)&id=not.like.IMP-*`
      );
    } catch (e) {
      errors.push(`${table}: gagal fetch (${e.message})`);
      continue;
    }

    const BATCH = 5; // paralel kecil — hindari flood ke API sumber sekaligus kejar batas waktu function
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      await Promise.all(batch.map(async row => {
        checked++;
        try {
          const { stage, detail } = await checkResiAuto(row);
          await sbFetch(`${table}?id=eq.${encodeURIComponent(row.id)}`, {
            method: 'PATCH',
            body: JSON.stringify({
              status_resi: stage,
              status_resi_step: STAGE_STEP[stage],
              status_resi_updated_at: new Date().toISOString(),
              status_resi_detail: detail,
            }),
          });
          updated++;

          // Notif WA cuma pas TRANSISI baru ke Bermasalah/Retur — bukan re-notif tiap cron
          // kalau statusnya emang udah bermasalah dari run sebelumnya.
          const wasProblem = PROBLEM_STAGES.includes(row.status_resi);
          const isProblem  = PROBLEM_STAGES.includes(stage);
          const noWa = row.profiles?.no_wa;
          if (isProblem && !wasProblem && noWa) {
            const label = stage === 'RETUR' ? 'RETUR' : 'BERMASALAH';
            const msg = `⚠️ Order kamu (resi ${row.id}, produk "${row.product || '-'}") sekarang berstatus *${label}*. Cek detailnya di menu Tracking Resi ya.`;
            try { await sendFonnteWA(noWa, msg); notified++; } catch (e) { /* gak fatal — status_resi tetep keupdate */ }
          }
        } catch (e) {
          failed++;
          errors.push(`${table}/${row.id}: ${e.message}`);
        }
      }));
    }
  }

  res.status(200).json({ checked, updated, failed, notified, errors: errors.slice(0, 20) });
}
