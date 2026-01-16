
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();

  // Verifica Token di Sicurezza
  const { token } = req.query;
  if (!token || token !== process.env.TALLY_WEBHOOK_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payload = req.body;
  const webappUrl = process.env.GS_WEBAPP_URL;
  const secret = process.env.GS_SECRET;

  if (!webappUrl) return res.status(500).json({ error: 'GS_WEBAPP_URL not configured' });

  try {
    // Estrazione Hidden Fields (pid e mid)
    // Tally invia gli hidden fields nel payload.data.fields o simili
    const fields = payload.data?.fields || [];
    const pidField = fields.find((f: any) => f.key === 'pid' || f.label === 'pid');
    const midField = fields.find((f: any) => f.key === 'mid' || f.label === 'mid');

    const pid = pidField?.value || payload.data?.hiddenFields?.find((h: any) => h.name === 'pid')?.value;
    const mid = midField?.value || payload.data?.hiddenFields?.find((h: any) => h.name === 'mid')?.value;

    if (!pid || !mid) {
      console.warn('Webhook ricevuto senza pid o mid:', { pid, mid });
      return res.status(200).json({ status: 'skipped', reason: 'Missing identifiers' });
    }

    // Salvataggio su Google Sheets tramite Apps Script
    await fetch(webappUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'tally_webhook',
        secret,
        payload: {
          pid,
          mid,
          submittedAt: payload.createdAt || new Date().toISOString(),
          raw: payload
        }
      })
    });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Webhook Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
