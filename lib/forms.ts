import type { FormAppearance, FormField, Person, Production } from '../types';
import { compressImage } from './image';
import { supabase } from './supabase';

export const SUBMISSION_BUCKET = 'submissions';
/** Valore salvato nelle risposte per un file caricato: `docuset-file:<token>/<nome>`. */
export const FILE_PREFIX = 'docuset-file:';
const LINK_DAYS = 90;

/** Campi proposti; la produzione sceglie quali usare. Le etichette coincidono con i campi riconosciuti nei PDF. */
export const PRESET_FIELDS: FormField[] = [
  { id: 'nome', label: 'Nome e cognome', type: 'text', required: true },
  { id: 'nascita-data', label: 'Data di nascita', type: 'date', required: true },
  { id: 'nascita-luogo', label: 'Luogo di nascita', type: 'text', required: true },
  { id: 'cf', label: 'Codice fiscale', type: 'text', required: true },
  { id: 'indirizzo', label: 'Indirizzo di residenza', type: 'text', required: true },
  { id: 'email', label: 'Email', type: 'email', required: true },
  { id: 'telefono', label: 'Telefono', type: 'tel', required: false },
  { id: 'iban', label: 'IBAN', type: 'text', required: false },
  { id: 'documento', label: "Documento d'identità (foto o PDF)", type: 'file', required: true },
  { id: 'firma', label: 'Firma', type: 'signature', required: true },
];

export const productionFields = (production: Production): FormField[] =>
  production.formFields?.length ? production.formFields : PRESET_FIELDS;

export const formUrl = (token: string, origin = window.location.origin) => `${origin}/m/${token}`;

const requireClient = () => {
  if (!supabase) throw new Error('Il modulo DocuSet richiede Supabase collegato.');
  return supabase;
};

/** Solo link https: un indirizzo scritto a mano non deve poter eseguire codice nel modulo. */
export const safeHttpsUrl = (value?: string) => {
  try {
    const url = new URL((value ?? '').trim());
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
};

const BRANDING_BUCKET = 'branding';

/** Colori di base del modulo pubblico. Sostituiscono i colori dell'app solo dentro il modulo. */
export const FORM_THEMES = {
  docuset: { label: 'DocuSet', colors: {} as Record<string, string>, swatch: ['#F3EEE3', '#2A251D'] },
  bianco: {
    label: 'Bianco',
    colors: { paper: '#FFFFFF', 'paper-deep': '#F4F4F5', card: '#FFFFFF', line: '#E4E4E7', ink: '#18181B', 'ink-soft': '#52525B', manila: '#A1A1AA', 'manila-ink': '#3F3F46' },
    swatch: ['#FFFFFF', '#18181B'],
  },
  scuro: {
    label: 'Scuro',
    colors: { paper: '#141416', 'paper-deep': '#1F1F23', card: '#1B1B1F', line: '#34343A', ink: '#F4F4F5', 'ink-soft': '#A1A1AA', manila: '#71717A', 'manila-ink': '#D4D4D8' },
    swatch: ['#141416', '#F4F4F5'],
  },
} as const;

/** Solo #RRGGBB: il colore finisce in uno stile, niente altro deve passare. */
export const safeHexColor = (value?: string) => (/^#[0-9a-f]{6}$/i.test(value ?? '') ? value! : '');

/** Testo bianco o nero, quello che si legge meglio sopra il colore. */
export const textOnColor = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#18181B' : '#FFFFFF';
};

/** Variabili CSS del tema scelto, da mettere sul contenitore del modulo. */
export const formThemeStyle = (look?: FormAppearance | null): Record<string, string> => {
  const theme = FORM_THEMES[look?.theme ?? 'docuset'] ?? FORM_THEMES.docuset;
  const style: Record<string, string> = {};
  for (const [name, value] of Object.entries(theme.colors)) style[`--color-${name}`] = value;
  const accent = safeHexColor(look?.accentColor);
  if (accent) { style['--form-accent'] = accent; style['--form-accent-text'] = textOnColor(accent); }
  return style;
};

/** Carica copertina, logo o sfondo del modulo (cartella pubblica in lettura) e ne restituisce l'indirizzo. */
export const uploadBrandingImage = async (file: File, userId: string, productionId: string, kind: 'cover' | 'logo' | 'background') => {
  const client = requireClient();
  const { blob, type, ext } = await compressImage(file);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new Error('Usa un’immagine JPG, PNG o WebP.');
  const path = `${userId}/${productionId}-${kind}-${Date.now()}.${ext}`;
  const { error } = await client.storage.from(BRANDING_BUCKET).upload(path, blob, { contentType: type });
  if (error) throw new Error(`Caricamento dell'immagine non riuscito: ${error.message}`);
  return client.storage.from(BRANDING_BUCKET).getPublicUrl(path).data.publicUrl;
};

/** Crea o aggiorna il link personale della persona e ne restituisce il token. */
export const ensureFormLink = async (userId: string, production: Production, person: Person) => {
  const client = requireClient();
  const { data, error } = await client
    .from('form_links')
    .upsert({
      owner_id: userId,
      production_id: production.id,
      person_id: person.id,
      production_title: production.title,
      person_name: person.name,
      fields: productionFields(production),
      expires_at: new Date(Date.now() + LINK_DAYS * 86_400_000).toISOString(),
    }, { onConflict: 'owner_id,production_id,person_id' })
    .select('token')
    .single();
  if (error || !data) throw new Error(`Non riesco a creare il link del modulo: ${error?.message ?? 'risposta vuota'}`);
  return data.token as string;
};

export interface FormSubmission {
  person_id: string;
  production_id: string;
  data: Record<string, unknown>;
  submitted_at: string;
}

export const fetchFormState = async () => {
  const client = requireClient();
  const [links, submissions] = await Promise.all([
    client.from('form_links').select('token, person_id, production_id'),
    client.from('form_submissions').select('person_id, production_id, data, submitted_at'),
  ]);
  if (links.error) throw links.error;
  if (submissions.error) throw submissions.error;
  const tokens = new Map<string, string>(links.data.map(l => [`${l.production_id}/${l.person_id}`, l.token]));
  return { tokens, submissions: submissions.data as FormSubmission[] };
};

/** Segna come consegnate le persone con una risposta nuova. Non modifica l'input. */
export const applySubmissions = (people: Person[], submissions: FormSubmission[]) => {
  const byPerson = new Map(submissions.map(s => [`${s.production_id}/${s.person_id}`, s]));
  let changed = 0;
  const next = people.map(person => {
    const submission = byPerson.get(`${person.productionId}/${person.id}`);
    if (!submission || submission.submitted_at === person.deliveredAt) return person;
    changed += 1;
    return { ...person, deliveredAt: submission.submitted_at, fieldsJSON: JSON.stringify(submission.data) };
  });
  return { people: next, changed };
};

export const isSubmissionFile = (value: unknown): boolean =>
  typeof value === 'string' && value.startsWith(FILE_PREFIX);

/** Link firmato (5 minuti) per aprire un file caricato da una persona. */
export const submissionFileUrl = async (value: string) => {
  const { data, error } = await requireClient().storage
    .from(SUBMISSION_BUCKET)
    .createSignedUrl(value.slice(FILE_PREFIX.length), 300);
  if (error || !data) throw new Error('Non riesco ad aprire il file caricato.');
  return data.signedUrl;
};

/** Carica copertina o logo del modulo e ne restituisce l'indirizzo pubblico. */
export const uploadFormImage = async (userId: string, productionId: string, kind: 'cover' | 'logo', file: File) => {
  const client = requireClient();
  const { blob, type, ext } = await compressImage(file);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new Error('Usa un’immagine JPG, PNG o WebP.');
  if (blob.size > 5 * 1024 * 1024) throw new Error('L’immagine supera i 5 MB anche dopo la compressione.');
  const path = `${userId}/${productionId}/${kind}-${crypto.randomUUID()}.${ext}`;
  const { error } = await client.storage.from(BRANDING_BUCKET).upload(path, blob, { contentType: type });
  if (error) throw new Error('Caricamento dell’immagine non riuscito.');
  return client.storage.from(BRANDING_BUCKET).getPublicUrl(path).data.publicUrl;
};

/** Toglie un'immagine caricata con uploadFormImage; gli indirizzi di altri siti vengono ignorati. */
export const removeFormImage = async (url: string) => {
  const path = url.split(`/object/public/${BRANDING_BUCKET}/`)[1];
  if (path) await requireClient().storage.from(BRANDING_BUCKET).remove([decodeURIComponent(path)]);
};

/** Cancella link, risposte e file delle persone indicate (o dell'intera produzione). */
export const deleteFormData = async (productionId: string, personIds?: string[]) => {
  const client = requireClient();
  let query = client.from('form_links').select('token').eq('production_id', productionId);
  if (personIds) query = query.in('person_id', personIds);
  const { data: links, error } = await query;
  if (error) throw error;
  for (const { token } of links) {
    const { data: files } = await client.storage.from(SUBMISSION_BUCKET).list(token);
    if (files?.length) await client.storage.from(SUBMISSION_BUCKET).remove(files.map(f => `${token}/${f.name}`));
  }
  if (links.length) {
    const { error: deleteError } = await client.from('form_links').delete().in('token', links.map(l => l.token));
    if (deleteError) throw deleteError;
  }
};
