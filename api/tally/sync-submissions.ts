import { sql } from '@vercel/postgres';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();

  const { formId, people } = req.body;
  const apiKey = process.env.TALLY_API_KEY;

  if (!formId) return res.status(400).json({ error: 'Missing formId' });
  if (!apiKey) return res.status(500).json({ error: 'Tally API Key not configured on server' });

  try {
    // 1. Fetch submissions from Tally
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

    // 2. Match submissions with active production members
    for (const sub of submissions) {
      const fields = sub.fields || [];
      
      // Extract fields (adjust these based on actual Tally field types/names)
      // Tally fields usually have a 'key' or 'label' and 'value'
      let nome = '';
      let cf = '';
      let dataNascita = '';
      let signatureUrl = '';
      let personId = ''; // if passed as hidden field

      for (const field of fields) {
        const label = (field.label || '').toLowerCase();
        const key = (field.key || '').toLowerCase();
        
        if (key === 'personid' || label.includes('personid') || key === 'mid' || label === 'mid') personId = field.value;
        else if (label.includes('nome') || label.includes('name')) nome = field.value;
        else if (label.includes('codice fiscale') || label.includes('cf')) cf = field.value;
        else if (label.includes('data di nascita') || label.includes('birth')) dataNascita = field.value;
        else if (field.type === 'SIGNATURE' || label.includes('firma') || label.includes('signature')) {
          // Tally signature fields usually contain a URL to the signature image
          signatureUrl = Array.isArray(field.value) ? field.value[0]?.url : field.value;
        }
      }

      let signatureBase64 = '';

      // Match with person
      let matchedPerson = null;
      if (personId) {
        matchedPerson = people.find((p: any) => p.id === personId);
      } else if (nome) {
        matchedPerson = people.find((p: any) => p.name.toLowerCase() === nome.toLowerCase());
      }

      if (matchedPerson) {
        const formData = { nome, cf, dataNascita };
        
        // Fetch signature image to base64
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

        // 3. Save to database (using sign_submissions as requested)
        // We might not have a sign_link_id, so we just store it with a null or dummy if allowed,
        // or we can just create a generic record. We'll try to insert it.
        try {
          // Assuming we can insert without sign_link_id or we just store the payload
          await sql`
            INSERT INTO sign_submissions (payload_json, signature_blob_url, ip, user_agent)
            VALUES (${JSON.stringify(formData)}, ${signatureUrl}, 'tally-sync', 'tally-api')
          `;
        } catch (dbErr) {
          console.error('DB Insert Error (might be missing columns/constraints):', dbErr);
          // Continue even if DB insert fails, to not break the sync
        }

        matchedSubmissions.push({
          personId: matchedPerson.id,
          formData,
          signatureUrl: signatureBase64 || signatureUrl, // Use base64 if available
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
