export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { tracking_number, courier } = req.query;
  if (!tracking_number || !courier) return res.status(400).json({ error: 'Parameter tracking_number dan courier wajib diisi' });

  try {
    const url = `https://app.mengantar.com/api/order/getPublic?tracking_number=${encodeURIComponent(tracking_number)}&courier=${encodeURIComponent(courier)}`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.mengantar.com/',
        'Origin': 'https://www.mengantar.com',
      },
    });
    const data = await r.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(200).json({ success: false, message: e.message || 'Gagal menghubungi layanan tracking' });
  }
}
