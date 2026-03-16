import { sql } from '@vercel/postgres';
import { Buffer } from 'buffer';

export default async function handler(req: any, res: any) {
  const { action } = req.query;

  if (req.method === 'GET' && action === 'status') {
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
      return res.status(200).json(data);
    } catch (error: any) {
      console.error('Status Fetch Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST' && action === 'sync-submissions') {
    const { formId, people } = req.body;
    const apiKey = process.env.TALLY_API_KEY;

    if (!formId) return res.status(400).json({ error: 'Missing formId' });
    if (!apiKey) return res.status(500).json({ error: 'Tally API Key not configured on server' });

    try {
      const response = await fetch(`https://api.tally.so/forms/${formId}/submissions`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Tally API Error');
      }

      const data = await response.json();
      const submissions = data.data || [];

      const matchedSubmissions = [];

      for (const sub of submissions) {
        const fields = sub.fields || [];
        
        let nome = '';
        let cf = '';
        let dataNascita = '';
        let signatureUrl = '';
        let personId = '';

        for (const field of fields) {
          const label = (field.label || '').toLowerCase();
          const key = (field.key || '').toLowerCase();
          
          if (key === 'personid' || label.includes('personid') || key === 'mid' || label === 'mid') personId = field.value;
          else if (label.includes('nome') || label.includes('name')) nome = field.value;
          else if (label.includes('codice fiscale') || label.includes('cf')) cf = field.value;
          else if (label.includes('data di nascita') || label.includes('birth')) dataNascita = field.value;
          else if (field.type === 'SIGNATURE' || label.includes('firma') || label.includes('signature')) {
            signatureUrl = Array.isArray(field.value) ? field.value[0]?.url : field.value;
          }
        }

        let signatureBase64 = '';

        let matchedPerson = null;
        if (personId) {
          matchedPerson = people.find((p: any) => p.id === personId);
        } else if (nome) {
          matchedPerson = people.find((p: any) => p.name.toLowerCase() === nome.toLowerCase());
        }

        if (matchedPerson) {
          const formData = { nome, cf, dataNascita };
          
          if (signatureUrl) {
            try {
              const sigRes = await fetch(signatureUrl);
              if (sigRes.ok) {
                const sigBuffer = await sigRes.arrayBuffer();
                const base64 = Buffer.from(sigBuffer).toString('base64');
                const contentType = sigRes.headers.get('content-type') || 'image/png';
                signatureBase64 = `data:${contentType};base64,${base64}`;
              }
            } catch (e) {
              console.error('Failed to fetch signature image:', e);
            }
          }

          try {
            await sql`
              INSERT INTO sign_submissions (payload_json, signature_blob_url, ip, user_agent)
              VALUES (${JSON.stringify(formData)}, ${signatureUrl}, 'tally-sync', 'tally-api')
            `;
          } catch (dbErr) {
            console.error('DB Insert Error (might be missing columns/constraints):', dbErr);
          }

          matchedSubmissions.push({
            personId: matchedPerson.id,
            formData,
            signatureUrl: signatureBase64 || signatureUrl,
            submittedAt: sub.createdAt
          });
        }
      }

      return res.status(200).json({ matchedSubmissions });
    } catch (error: any) {
      console.error('Tally Sync Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(404).json({ error: 'Not found' });
}
