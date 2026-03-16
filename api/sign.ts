import { sql } from '@vercel/postgres';
import { put } from '@vercel/blob';
import { Buffer } from 'buffer';

export default async function handler(req: any, res: any) {
  const { action } = req.query;

  if (req.method === 'GET' && action === 'validate') {
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

  if (req.method === 'POST' && action === 'submit') {
    const { token, formData, signatureDataUrl } = req.body;

    try {
      const { rows } = await sql`SELECT id FROM sign_links WHERE token = ${token} AND status = 'pending'`;
      if (rows.length === 0) return res.status(403).json({ error: 'Invalid or used token' });
      const linkId = rows[0].id;

      const base64Data = signatureDataUrl.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      const blob = await put(`signatures/${token}.png`, buffer, {
        access: 'public',
        contentType: 'image/png',
      });

      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      await sql`
        INSERT INTO sign_submissions (sign_link_id, payload_json, signature_blob_url, ip, user_agent)
        VALUES (${linkId}, ${JSON.stringify(formData)}, ${blob.url}, ${ip}, ${userAgent})
      `;

      await sql`
        UPDATE sign_links 
        SET status = 'used', used_at = CURRENT_TIMESTAMP 
        WHERE id = ${linkId}
      `;

      return res.status(200).json({ success: true, url: blob.url });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Submission failed' });
    }
  }

  return res.status(404).json({ error: 'Not found' });
}
