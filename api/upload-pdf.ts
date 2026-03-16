import { put } from '@vercel/blob';
import { Buffer } from 'buffer';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();

  const { base64Pdf, filename } = req.body;

  if (!base64Pdf) return res.status(400).json({ error: 'Missing base64Pdf' });

  try {
    const base64Data = base64Pdf.split(',')[1] || base64Pdf;
    const buffer = Buffer.from(base64Data, 'base64');
    
    const blob = await put(`signed-documents/${filename || 'document.pdf'}`, buffer, {
      access: 'public',
      contentType: 'application/pdf',
    });

    return res.status(200).json({ url: blob.url });
  } catch (error: any) {
    console.error('PDF Upload Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
