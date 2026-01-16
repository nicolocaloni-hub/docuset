
import { sql } from '@vercel/postgres';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token missing' });
  }

  try {
    const { rows } = await sql`
      SELECT * FROM sign_links 
      WHERE token = ${token} 
      LIMIT 1
    `;

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Link non valido' });
    }

    const link = rows[0];
    if (link.status !== 'pending') {
      return res.status(410).json({ error: 'Link già utilizzato o scaduto' });
    }

    return res.status(200).json(link);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error' });
  }
}
