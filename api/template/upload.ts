
import { put } from '@vercel/blob';
import { sql } from '@vercel/postgres';
import { Buffer } from 'buffer';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();

  // Note: For larger files, Vercel Blob recommends client-side uploads with tokens
  // For simplicity here, we assume a small base64 payload or multipart handled by Vercel
  const { fileName, fileType, base64 } = req.body;

  try {
    const buffer = Buffer.from(base64, 'base64');
    const blob = await put(`templates/${Date.now()}-${fileName}`, buffer, {
      access: 'public',
      contentType: fileType,
    });

    // Optionally save to Postgres
    const id = 't-' + Date.now();
    await sql`
      INSERT INTO templates (id, name, type, file_url, file_name, file_type)
      VALUES (${id}, ${fileName}, 'ALTRO', ${blob.url}, ${fileName}, ${fileType})
    `;

    return res.status(200).json({ id, url: blob.url });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Upload failed' });
  }
}
