import type { FormField, Person, Production } from '../types';
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

export const usesDocusetForm = (production: Production, formsEnabled: boolean) =>
  formsEnabled && production.formMode !== 'tally';

export const formUrl = (token: string, origin = window.location.origin) => `${origin}/m/${token}`;

const requireClient = () => {
  if (!supabase) throw new Error('Il modulo DocuSet richiede Supabase collegato.');
  return supabase;
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
