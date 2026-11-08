import { supabase, TEMPLATE_BUCKET } from './supabase';

const REMOTE_PREFIX = 'sb:';

const readAsDataUrl = (file: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

/** Salva il PDF e restituisce il valore da mettere in `Template.fileUrl`. */
export const storeTemplateFile = async (file: Blob, templateId: string, userId: string | null) => {
  if (!supabase || !userId) return readAsDataUrl(file);
  const path = `${userId}/${templateId}.pdf`;
  const { error } = await supabase.storage
    .from(TEMPLATE_BUCKET)
    .upload(path, file, { contentType: 'application/pdf', upsert: true });
  if (error) throw new Error(`Caricamento del PDF non riuscito: ${error.message}`);
  return REMOTE_PREFIX + path;
};

/** URL apribile per il template: per i file privati è un link firmato valido 5 minuti. */
export const templateFileUrl = async (fileUrl: string) => {
  if (!fileUrl.startsWith(REMOTE_PREFIX)) return fileUrl;
  if (!supabase) throw new Error('Questo template è salvato online: accedi per aprirlo.');
  const { data, error } = await supabase.storage
    .from(TEMPLATE_BUCKET)
    .createSignedUrl(fileUrl.slice(REMOTE_PREFIX.length), 300);
  if (error || !data) throw new Error('Non riesco ad aprire il template PDF.');
  return data.signedUrl;
};

export const fetchTemplateBytes = async (fileUrl: string) => {
  const response = await fetch(await templateFileUrl(fileUrl));
  if (!response.ok) throw new Error('Non riesco ad aprire il template PDF selezionato.');
  return response.arrayBuffer();
};

export const deleteTemplateFile = async (fileUrl: string) => {
  if (!supabase || !fileUrl.startsWith(REMOTE_PREFIX)) return;
  await supabase.storage.from(TEMPLATE_BUCKET).remove([fileUrl.slice(REMOTE_PREFIX.length)]);
};

export const isLocalTemplateFile = (fileUrl: string) => fileUrl.startsWith('data:');
