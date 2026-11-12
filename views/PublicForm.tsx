import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileText, FileUp, RefreshCw } from 'lucide-react';
import type { FormAppearance, FormField } from '../types';
import { supabase } from '../lib/supabase';
import { FILE_PREFIX, SUBMISSION_BUCKET, safeHttpsUrl } from '../lib/forms';
import { compressImage } from '../lib/image';
import SignaturePad, { type SignaturePadHandle } from '../components/SignaturePad';
import { Button, Field, inputClass } from '../components/ui';

// Le foto vengono compresse prima dell'invio: si accettano originali grandi, il file caricato resta sotto i 10 MB.
const MAX_PICK = 30 * 1024 * 1024;
const MAX_UPLOAD = 10 * 1024 * 1024;
const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

interface FormInfo {
  production_title: string;
  person_name: string;
  fields: FormField[];
  submitted_at: string | null;
  appearance: FormAppearance | null;
}

/** Modulo compilato da cast e troupe dal link personale, senza account. */
const PublicForm: React.FC<{ token: string }> = ({ token }) => {
  const [info, setInfo] = useState<FormInfo | null>(null);
  const [state, setState] = useState<'loading' | 'invalid' | 'form' | 'already' | 'sending' | 'done'>('loading');
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [signed, setSigned] = useState<Record<string, boolean>>({});
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signatures = useRef<Record<string, SignaturePadHandle | null>>({});

  useEffect(() => {
    if (!supabase) { setState('invalid'); return; }
    supabase.rpc('get_form', { p_token: token }).then(({ data, error: rpcError }) => {
      const row = Array.isArray(data) ? data[0] as FormInfo | undefined : undefined;
      if (rpcError || !row) { setState('invalid'); return; }
      setInfo(row);
      setValues(Object.fromEntries(row.fields.filter(f => f.id === 'nome').map(f => [f.id, row.person_name])));
      setState(row.submitted_at ? 'already' : 'form');
    });
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info || !supabase) return;
    setError(null);

    const missing = info.fields.filter(f => f.required && (
      f.type === 'file' ? !files[f.id] : f.type === 'signature' ? !signed[f.id] : !values[f.id]?.trim()
    ));
    if (missing.length) { setError(`Manca: ${missing.map(f => f.label).join(', ')}.`); return; }
    if (!consent) { setError('Serve il consenso al trattamento dei dati per inviare il modulo.'); return; }

    setState('sending');
    try {
      const data: Record<string, string> = {};
      for (const field of info.fields) {
        if (field.type === 'file' && files[field.id]) {
          const { blob, type, ext } = await compressImage(files[field.id]);
          if (blob.size > MAX_UPLOAD) throw new Error(`“${field.label}” supera i 10 MB anche dopo la compressione: prova con una foto o un PDF più leggero.`);
          const path = `${token}/${field.id}-${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await supabase.storage.from(SUBMISSION_BUCKET).upload(path, blob, { contentType: type });
          if (uploadError) throw new Error(`Caricamento di “${field.label}” non riuscito.`);
          data[field.label] = FILE_PREFIX + path;
        } else if (field.type === 'signature' && signed[field.id]) {
          const blob = await signatures.current[field.id]?.toBlob();
          if (!blob) throw new Error('Non riesco a salvare la firma. Riprova.');
          const path = `${token}/${field.id}-${crypto.randomUUID()}.png`;
          const { error: uploadError } = await supabase.storage.from(SUBMISSION_BUCKET).upload(path, blob, { contentType: 'image/png' });
          if (uploadError) throw new Error('Caricamento della firma non riuscito.');
          data[field.label] = FILE_PREFIX + path;
        } else if (values[field.id]?.trim()) {
          data[field.label] = values[field.id].trim();
        }
      }
      data['Consenso trattamento dati'] = new Date().toISOString();

      const { error: submitError } = await supabase.rpc('submit_form', { p_token: token, p_data: data });
      if (submitError) throw new Error(submitError.message.includes('invalid_token') ? 'Il link è scaduto. Chiedi alla produzione un link nuovo.' : 'Invio non riuscito. Riprova.');
      setState('done');
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invio non riuscito. Riprova.');
      setState('form');
    }
  };

  // Immagini e link scelti dalla produzione: si usano solo se sono indirizzi https.
  const cover = safeHttpsUrl(info?.appearance?.coverUrl);
  const logo = safeHttpsUrl(info?.appearance?.logoUrl);
  const documentUrl = safeHttpsUrl(info?.appearance?.documentUrl);

  const shell = (children: React.ReactNode) => (
    <div className="min-h-dvh bg-paper">
      {cover && <img src={cover} alt="" className="block h-44 w-full object-cover sm:h-60" />}
      <header className="border-b border-line bg-paper-deep px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mx-auto max-w-xl">
          {logo && (
            <img src={logo} alt="" className={`mb-3 h-20 w-20 rounded-full border-4 border-paper-deep bg-card object-cover shadow-[0_2px_10px_rgba(42,37,29,0.18)] ${cover ? '-mt-14' : ''}`} />
          )}
          <p className="font-mono text-[11px] uppercase tracking-widest text-ink-soft">DocuSet · Modulo produzione</p>
          {info && <p className="font-display text-2xl leading-tight">{info.production_title}</p>}
        </div>
      </header>
      <main className="mx-auto max-w-xl px-5 py-8 pb-16">{children}</main>
    </div>
  );

  if (state === 'loading') {
    return shell(<p className="flex items-center gap-2 text-ink-soft"><RefreshCw className="h-4 w-4 animate-spin" /> Apertura del modulo…</p>);
  }
  if (state === 'invalid' || !info) {
    return shell(<>
      <h1 className="font-display text-3xl">Link non valido</h1>
      <p className="mt-3 text-ink-soft">Il link è scaduto o non è corretto. Chiedi all'ufficio di produzione di mandartene uno nuovo.</p>
    </>);
  }
  if (state === 'done') {
    return shell(<div className="animate-enter">
      <CheckCircle2 className="h-10 w-10 text-st-delivered" />
      <h1 className="mt-3 font-display text-3xl">Grazie, {info.person_name.split(' ')[0]}</h1>
      <p className="mt-3 text-ink-soft">Il modulo è arrivato all'ufficio di produzione. Puoi chiudere questa pagina.</p>
    </div>);
  }
  if (state === 'already') {
    return shell(<>
      <h1 className="font-display text-3xl">Modulo già inviato</h1>
      <p className="mt-3 text-ink-soft">
        Hai inviato il modulo il {new Date(info.submitted_at!).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}.
        Se devi correggere qualcosa puoi compilarlo di nuovo: sostituisce l'invio precedente.
      </p>
      <Button className="mt-6" variant="secondary" onClick={() => setState('form')}>Compila di nuovo</Button>
    </>);
  }

  return shell(
    <form onSubmit={submit} noValidate className="animate-enter space-y-6">
      <div>
        <h1 className="font-display text-3xl leading-tight">Ciao {info.person_name.split(' ')[0]}</h1>
        <p className="mt-2 text-ink-soft">Compila i tuoi dati per la produzione. Servono pochi minuti; i campi con * sono obbligatori.</p>
        {documentUrl && (
          <a href={documentUrl} target="_blank" rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 font-medium text-ink underline decoration-manila decoration-2 underline-offset-4 hover:decoration-ink">
            <FileText aria-hidden className="h-4 w-4 shrink-0" />
            {info.appearance?.documentLabel?.trim() || 'Leggi qui il documento'}
          </a>
        )}
      </div>

      {info.fields.map(field => {
        const label = `${field.label}${field.required ? ' *' : ''}`;
        if (field.type === 'signature') {
          return (
            <div key={field.id}>
              <span className="mb-1.5 block text-sm font-medium">{label}</span>
              <SignaturePad ref={el => { signatures.current[field.id] = el; }} label={field.label}
                onChange={ink => setSigned(s => ({ ...s, [field.id]: ink }))} />
            </div>
          );
        }
        if (field.type === 'file') {
          const file = files[field.id];
          return (
            <Field key={field.id} label={label} hint="Foto dal telefono o PDF. Le foto vengono alleggerite prima dell'invio.">
              <span className={`${inputClass} flex cursor-pointer items-center gap-2 ${file ? 'text-ink' : 'text-ink-soft'}`}>
                <FileUp className="h-4 w-4 shrink-0" />
                <span className="truncate">{file ? file.name : 'Scegli o scatta una foto'}</span>
              </span>
              <input type="file" accept={FILE_TYPES.join(',')} className="sr-only"
                onChange={e => {
                  const picked = e.target.files?.[0];
                  if (!picked) return;
                  if (picked.size > MAX_PICK) { setError('Il file è troppo grande: massimo 30 MB.'); return; }
                  if (picked.type && !FILE_TYPES.includes(picked.type)) { setError('Formato non accettato: usa una foto (JPG, PNG) o un PDF.'); return; }
                  setError(null);
                  setFiles(f => ({ ...f, [field.id]: picked }));
                }} />
            </Field>
          );
        }
        const common = {
          value: values[field.id] ?? '',
          onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues(v => ({ ...v, [field.id]: e.target.value })),
          className: inputClass,
          required: field.required,
        };
        return (
          <Field key={field.id} label={label}>
            {field.type === 'textarea'
              ? <textarea rows={3} {...common} />
              : <input type={field.type} {...common}
                  autoComplete={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : field.id === 'nome' ? 'name' : 'off'}
                  autoCapitalize={field.id === 'cf' || field.id === 'iban' ? 'characters' : undefined} />}
          </Field>
        );
      })}

      <label className="flex gap-3 rounded-[3px] border border-line bg-card p-4 text-sm">
        <input type="checkbox" checked={consent} onChange={e => { setConsent(e.target.checked); setError(null); }} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-ink)]" />
        <span>
          Acconsento al trattamento dei miei dati personali da parte della produzione “{info.production_title}”,
          solo per gli adempimenti legati al mio lavoro su questo progetto (Reg. UE 2016/679).
        </span>
      </label>

      {error && <p role="alert" className="rounded-[3px] bg-cue/10 p-3 text-sm text-cue">{error}</p>}

      <Button type="submit" className="w-full" disabled={state === 'sending'}>
        {state === 'sending' ? 'Invio in corso…' : 'Invia il modulo'}
      </Button>
    </form>,
  );
};

export default PublicForm;
