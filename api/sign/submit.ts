
import { sql } from '@vercel/postgres';
import { put } from '@vercel/blob';
import { VercelRequest, VercelResponse } from '@vercel/node';
// Fix: Import Buffer to ensure it is available in the TypeScript compilation context for Node.js
import { Buffer } from 'buffer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { token, formData, signatureDataUrl } = req.body;

  try {
    // 1. Verify token again
    const { rows } = await sql`SELECT id FROM sign_links WHERE token = ${token} AND status = 'pending'`;
    if (rows.length === 0) return res.status(403).json({ error: 'Invalid or used token' });
    const linkId = rows[0].id;

    // 2. Upload Signature to Vercel Blob
    // signatureDataUrl is "data:image/png;base64,..."
    const base64Data = signatureDataUrl.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    const blob = await put(`signatures/${token}.png`, buffer, {
      access: 'public',
      contentType: 'image/png',
    });

    // 3. Store submission
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await sql`
      INSERT INTO sign_submissions (sign_link_id, payload_json, signature_blob_url, ip, user_agent)
      VALUES (${linkId}, ${JSON.stringify(formData)}, ${blob.url}, ${ip}, ${userAgent})
    `;

    // 4. Mark token as used
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
