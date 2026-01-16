
export default async function handler(req: any, res: any) {
  const { pid } = req.query;
  const webappUrl = process.env.GS_WEBAPP_URL;
  const secret = process.env.GS_SECRET;

  if (!pid) return res.status(400).json({ error: 'Missing pid' });
  if (!webappUrl) return res.status(500).json({ error: 'GS_WEBAPP_URL not configured' });

  try {
    const response = await fetch(webappUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'tally_status',
        secret,
        payload: { pid }
      })
    });

    if (!response.ok) throw new Error('Failed to fetch from Google Sheets');
    
    const data = await response.json();
    // data dovrebbe essere una lista di { mid, deliveredAt }
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Status Fetch Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
