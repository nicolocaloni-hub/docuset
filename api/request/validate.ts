import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code } = req.query;
  const webappUrl = process.env.GS_WEBAPP_URL;
  const secret = process.env.GS_SECRET;

  if (!webappUrl) return res.status(500).json({ error: 'Backend config missing' });

  try {
    const response = await fetch(webappUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'validate',
        secret,
        payload: { code }
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);

    return res.status(200).json(data);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Validation failed' });
  }
}