export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { resi } = req.query;
  if (!resi) return res.status(400).json({ error: 'Parameter resi wajib diisi' });

  try {
    const url = `https://spx.co.id/shipment/order/open/order/get_order_info?spx_tn=${encodeURIComponent(resi)}&language_code=id`;
    const r = await fetch(url, {
      headers: {
        'accept': 'application/json, text/plain, */*',
        'referer': `https://spx.co.id/track?${encodeURIComponent(resi)}`,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    const data = await r.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(200).json({ retcode: -1, message: e.message || 'Gagal menghubungi SPX' });
  }
}
