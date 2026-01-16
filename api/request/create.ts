import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { productionId, productionTitle, label } = req.body;
  const webappUrl = process.env.GS_WEBAPP_URL;
  const secret = process.env.GS_SECRET;

  if (!webappUrl) return res.status(500).json({ error: 'Backend config missing' });

  try {
    const response = await fetch(webappUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        secret,
        payload: {
          productionId,
          productionTitle,
          label,
          code: crypto.randomUUID()
        }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');

    return res.status(200).json(data);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}