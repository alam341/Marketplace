export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { resi } = req.query;
  if (!resi) return res.status(400).json({ error: 'Parameter resi wajib diisi' });

  try {
    const body = new URLSearchParams({ kode_booking: resi }).toString();
    const r = await fetch('https://www.bosampuh.id/api_home/lacak_kiriman', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://www.bosampuh.id/',
        'Origin': 'https://www.bosampuh.id',
      },
      body,
    });
    const raw = await r.text();
    let data;
    try {
      data = typeof raw === 'string' && raw.startsWith('"') ? JSON.parse(JSON.parse(raw)) : JSON.parse(raw);
    } catch {
      return res.status(200).json({ error: 'Resi tidak ditemukan' });
    }
    res.status(200).json(data);
  } catch (e) {
    res.status(200).json({ error: e.message || 'Gagal menghubungi layanan tracking POS' });
  }
}
