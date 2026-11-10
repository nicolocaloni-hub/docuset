// Cancella un account DocuSet: prima i file (Storage API), poi l'utente (Auth API),
// che porta via a cascata stato, moduli e risposte. La chiama solo il database
// (private.admin_erase_account) con un Bearer che la funzione verifica sul database.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const paths = (value: unknown) => (Array.isArray(value) ? value.filter((p): p is string => typeof p === 'string') : []);

async function removeAll(bucket: string, files: string[]) {
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await admin.storage.from(bucket).remove(files.slice(i, i + 100));
    if (error) throw new Error(`${bucket}: ${error.message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  const { data: ok } = await admin.rpc('account_erasure_check', { p_token: token });
  if (ok !== true) return new Response('unauthorized', { status: 401 });

  const body = await req.json().catch(() => null);
  const userId = body?.user_id;
  if (typeof userId !== 'string' || !UUID.test(userId)) return new Response('bad request', { status: 400 });

  let failure: string | null = null;
  try {
    // Solo file nella cartella dell'utente o dei suoi link: il database li ha scelti, qui si ricontrolla.
    const templates = paths(body.files?.templates).filter((p) => p.startsWith(`${userId}/`));
    await removeAll('templates', templates);
    await removeAll('submissions', paths(body.files?.submissions));
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(`auth: ${error.message}`);
  } catch (e) {
    failure = e instanceof Error ? e.message : String(e);
  }
  await admin.rpc('account_erasure_result', { p_user: userId, p_error: failure });
  return Response.json({ ok: !failure, error: failure }, { status: failure ? 500 : 200 });
});
