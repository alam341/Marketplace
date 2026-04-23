export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { mood, name } = req.body || {};

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 80,
        messages: [{
          role: 'user',
          content: `Kamu adalah asisten motivator tim marketplace. Berikan 1 kalimat motivasi singkat dalam Bahasa Indonesia yang natural dan personal untuk ${name || 'seseorang'} yang hari ini merasa "${mood || 'biasa'}". Maksimal 12 kata. Tulis kalimatnya saja, tanpa tanda petik, tanpa emoji.`
        }]
      })
    });

    const data = await response.json();
    const message = data.content?.[0]?.text?.trim() || 'Semangat berkarya hari ini!';
    res.status(200).json({ message });
  } catch (e) {
    res.status(200).json({ message: 'Semangat berkarya hari ini!' });
  }
}
