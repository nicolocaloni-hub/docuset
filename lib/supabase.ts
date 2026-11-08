import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** `null` quando le variabili non sono impostate: l'app resta in modalità locale. */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

export const TEMPLATE_BUCKET = 'templates';
