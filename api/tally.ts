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
    if (!apiKey) return res.status(500).json({ error: "Chiave API di Tally mancante. Devi configurare la variabile di ambiente TALLY_API_KEY nei settings dell'applicazione." });

    try {
      let allSubmissions: any[] = [];
      let nextCursor = null;
      let hasMore = true;

      // Fetch all pages of submissions
      while (hasMore) {
        const url = new URL(`https://api.tally.so/forms/${formId}/submissions`);
        url.searchParams.append('limit', '100');
        if (nextCursor) {
          url.searchParams.append('after', nextCursor);
        }

        const response = await fetch(url.toString(), {
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
        allSubmissions = [...allSubmissions, ...submissions];

        if (data.meta && data.meta.nextCursor) {
          nextCursor = data.meta.nextCursor;
        } else {
          hasMore = false;
        }
      }

      const processedSubmissions = await Promise.all(allSubmissions.map(async (sub: any) => {
        const fields = sub.fields || [];
        
        let nome = '';
        let cf = '';
        let dataNascita = '';
        let signatureUrl = '';
        let personId = '';
        
        const fullFormData: Record<string, any> = {};

        for (const field of fields) {
          const label = (field.label || '').toLowerCase();
          const key = (field.key || '').toLowerCase();
          const val = field.value;
          
          if (field.label) {
            fullFormData[field.label] = val;
          }
          
          if (key === 'personid' || label.includes('personid') || key === 'mid' || label === 'mid') personId = val;
          else if (label.includes('nome') || label.includes('name')) nome = val;
          else if (label.includes('codice fiscale') || label.includes('cf')) cf = val;
          else if (label.includes('data di nascita') || label.includes('birth')) dataNascita = val;
          else if (field.type === 'SIGNATURE' || label.includes('firma') || label.includes('signature')) {
            signatureUrl = Array.isArray(val) ? val[0]?.url : val;
            fullFormData[field.label || 'Firma'] = signatureUrl;
          }
        }

        // Fallback for name if not found by specific label
        if (!nome) {
          nome = fullFormData['Nome e Cognome'] || fullFormData['nome e cognome'] || fullFormData['Nome'] || fullFormData['nome'] || '';
        }

        let signatureBase64 = '';

        let matchedPerson = null;
        if (personId) {
          matchedPerson = people.find((p: any) => p.id === personId);
        } else if (nome) {
          matchedPerson = people.find((p: any) => p.name.toLowerCase() === nome.toLowerCase());
        }

        const formData = { nome, cf, dataNascita, ...fullFormData };
        
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

        return {
          matchedPerson,
          formData,
          signatureUrl: signatureBase64 || signatureUrl,
          submittedAt: sub.createdAt
        };
      }));

      const matchedSubmissions = processedSubmissions.filter(s => s.matchedPerson).map(s => ({
        personId: s.matchedPerson.id,
        formData: s.formData,
        signatureUrl: s.signatureUrl,
        submittedAt: s.submittedAt
      }));

      const unmatchedSubmissions = processedSubmissions.filter(s => !s.matchedPerson).map(s => ({
        formData: s.formData,
        signatureUrl: s.signatureUrl,
        submittedAt: s.submittedAt
      }));

      return res.status(200).json({ matchedSubmissions, unmatchedSubmissions });
    } catch (error: any) {
      console.error('Tally Sync Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(404).json({ error: 'Not found' });
}
