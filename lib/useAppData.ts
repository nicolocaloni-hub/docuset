import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState } from '../types';
import { supabase } from './supabase';
import { isLocalTemplateFile, storeTemplateFile } from './templateFiles';

export const STORAGE_KEY = 'setdocs_app_data_v4';

export type SyncStatus = 'loading' | 'local' | 'saving' | 'saved' | 'error' | 'conflict';

const emptyState = (): AppState => ({
  productions: [{ id: `p-${Date.now()}`, title: 'Nuova produzione', createdAt: new Date().toISOString() }],
  people: [],
  templates: [],
});

/** Accetta anche i salvataggi delle versioni precedenti, ignorando i campi non più usati. */
export const normalizeState = (raw: unknown): AppState | null => {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<AppState>;
  if (!Array.isArray(value.productions)) return null;
  return {
    productions: value.productions,
    people: Array.isArray(value.people) ? value.people : [],
    // Il vecchio template demo puntava a un PDF esterno: non lo portiamo avanti.
    templates: Array.isArray(value.templates) ? value.templates.filter(t => !t.fileUrl?.startsWith('https://pdf-lib.js.org/')) : [],
  };
};

const readLocal = (): AppState | null => {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
  } catch {
    return null;
  }
};

/** Carica i PDF salvati nel browser nello storage privato prima del primo salvataggio online. */
const uploadLocalTemplates = async (state: AppState, userId: string): Promise<AppState> => {
  const templates = await Promise.all(state.templates.map(async template => {
    if (!isLocalTemplateFile(template.fileUrl)) return template;
    const blob = await (await fetch(template.fileUrl)).blob();
    return { ...template, fileUrl: await storeTemplateFile(blob, template.id, userId) };
  }));
  return { ...state, templates };
};

/**
 * Stato dell'app con salvataggio automatico.
 * - Senza Supabase (o senza utente): localStorage, come prima.
 * - Con Supabase: una riga `app_state` per utente; al primo accesso importa i dati
 *   già presenti nel browser. Un salvataggio parte solo se nessun altro dispositivo
 *   ha scritto nel frattempo, altrimenti lo stato diventa `conflict`.
 */
export const useAppData = (userId: string | null) => {
  const remote = Boolean(supabase && userId);
  const [data, setDataState] = useState<AppState | null>(null);
  const [status, setStatus] = useState<SyncStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const versionRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    dirtyRef.current = false;
    if (!remote || !supabase || !userId) {
      setDataState(readLocal() ?? emptyState());
      setStatus('local');
      return;
    }
    const { data: row, error: loadError } = await supabase
      .from('app_state').select('data, updated_at').eq('owner_id', userId).maybeSingle();
    if (loadError) {
      setError(`Impossibile caricare i dati: ${loadError.message}`);
      setStatus('error');
      return;
    }
    if (row) {
      versionRef.current = row.updated_at;
      setDataState(normalizeState(row.data) ?? emptyState());
      setStatus('saved');
      return;
    }
    try {
      const initial = await uploadLocalTemplates(readLocal() ?? emptyState(), userId);
      const { data: inserted, error: insertError } = await supabase
        .from('app_state').insert({ owner_id: userId, data: initial }).select('updated_at').single();
      if (insertError) throw insertError;
      versionRef.current = inserted.updated_at;
      setDataState(initial);
      setStatus('saved');
    } catch (e) {
      setError(`Prima sincronizzazione non riuscita: ${e instanceof Error ? e.message : String(e)}`);
      setStatus('error');
    }
  }, [remote, userId]);

  useEffect(() => { load(); }, [load]);

  const setData = useCallback((update: AppState | ((prev: AppState) => AppState)) => {
    dirtyRef.current = true;
    setDataState(prev => (prev ? (typeof update === 'function' ? update(prev) : update) : prev));
  }, []);

  useEffect(() => {
    if (!data || !dirtyRef.current) return;
    if (!remote) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        dirtyRef.current = false;
        setError(null);
      } catch {
        setError('Spazio del browser esaurito: le ultime modifiche non sono salvate. Esporta un backup e rimuovi i template più pesanti.');
      }
      return;
    }
    setStatus('saving');
    const timer = setTimeout(async () => {
      if (!supabase || !userId) return;
      const { data: saved, error: saveError } = await supabase
        .from('app_state').update({ data })
        .eq('owner_id', userId).eq('updated_at', versionRef.current)
        .select('updated_at');
      if (saveError) {
        setError(`Salvataggio non riuscito: ${saveError.message}`);
        setStatus('error');
      } else if (!saved?.length) {
        setStatus('conflict');
      } else {
        versionRef.current = saved[0].updated_at;
        dirtyRef.current = false;
        setError(null);
        setStatus('saved');
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [data, remote, userId]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirtyRef.current && remote) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [remote]);

  return { data, setData, status, error, reload: load, remote };
};
