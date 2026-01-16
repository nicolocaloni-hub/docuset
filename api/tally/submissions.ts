
export default async function handler(req: any, res: any) {
  const { formId } = req.query;
  const apiKey = process.env.TALLY_API_KEY;

  if (!formId) return res.status(400).json({ error: 'Missing formId' });
  if (!apiKey) return res.status(500).json({ error: 'Tally API Key not configured on server' });

  try {
    // Documentazione Tally API: https://tally.so/help/api
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
    
    // Tally ritorna un array di sottomissioni. 
    // Ogni sottomissione contiene i campi e gli hidden fields (pid, mid).
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Tally Sync Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
