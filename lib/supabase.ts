import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// `import.meta.env` esiste solo con Vite; nei test Node è undefined.
const env: Partial<ImportMetaEnv> = import.meta.env ?? {};
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

/** `null` quando le variabili non sono impostate: l'app resta in modalità locale. */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

export const TEMPLATE_BUCKET = 'templates';
