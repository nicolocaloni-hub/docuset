
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  // 1. VERIFICA DEL WEBHOOK (GET)
  if (req.method === 'GET') {
    if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    } else {
      return res.status(403).json({ error: 'Token non valido' });
    }
  }

  // 2. RICEZIONE MESSAGGI/STATI (POST)
  if (req.method === 'POST') {
    const body = req.body;

    // Logica di base per gestire gli stati (sent, delivered, read)
    // In un'app reale, qui aggiorneresti il DB (es. Supabase/Postgres) usando il messageId
    // o il numero di telefono per trovare la Person corrispondente.
    
    if (body.object) {
      if (
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0].value.statuses
      ) {
        const status = body.entry[0].changes[0].value.statuses[0];
        console.log(`WhatsApp Status Update: ${status.status} for message ${status.id}`);
        // TODO: Aggiornare lo stato nel DB (es. update people set status = 'delivered' where wa_message_id = ...)
      }
    }

    return res.status(200).send('EVENT_RECEIVED');
  }

  return res.status(405).end();
}
