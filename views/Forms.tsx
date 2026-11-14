import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { FormAppearance, FormField, FormKind, Person, Production, ProductionForm } from '../types';
import { FORM_KINDS, FORM_THEMES, PRESET_FIELDS, personFormKind, productionForm, safeHexColor, safeHttpsUrl, uploadBrandingImage } from '../lib/forms';
import { Button, Field, IconButton, Input, PageHeader } from '../components/ui';
import { ImagePicker, cleanLook } from '../components/modals';

interface Props {
  production: Production;
  people: Person[];
  /** Modulo DocuSet disponibile (Supabase collegato e accesso fatto). */
  formsEnabled: boolean;
  /** Serve per caricare copertina, logo e sfondo nella cartella dell'account. */
  userId: string | null;
  onSave: (kind: FormKind, form: ProductionForm) => void;
}

/** Spazio dedicato ai moduli: quattro moduli, ognuno con le sue domande e il suo aspetto. */
const Forms: React.FC<Props> = ({ production, people, formsEnabled, userId, onSave }) => {
  const [kind, setKind] = useState<FormKind>('troupe');
  const [dirty, setDirty] = useState(false);

  const pick = (next: FormKind) => {
    if (next === kind) return;
    if (dirty && !window.confirm('Hai modifiche non salvate in questo modulo. Vuoi lasciarle?')) return;
    setDirty(false);
    setKind(next);
  };

  return (
    <div>
      <PageHeader title="Moduli" text="Ogni persona riceve il modulo del suo gruppo, con il suo link personale. Il gruppo di una persona lo cambi dalla sua scheda." />
      <div role="tablist" aria-label="Moduli" className="mb-5 flex flex-wrap gap-2">
        {FORM_KINDS.map(k => {
          const count = people.filter(p => personFormKind(p) === k.id).length;
          const selected = k.id === kind;
          return (
            <button key={k.id} type="button" role="tab" aria-selected={selected} onClick={() => pick(k.id)}
              className={`flex min-h-11 items-center gap-2 rounded-[3px] border px-4 text-sm ${selected ? 'border-ink bg-ink text-paper' : 'border-line bg-card text-ink hover:border-ink/50'}`}>
              {k.label}
              <span className={`tabular font-mono text-xs ${selected ? 'text-paper/70' : 'text-ink-soft'}`}>{count}</span>
            </button>
          );
        })}
      </div>
      <FormEditor key={kind} kind={kind} production={production} formsEnabled={formsEnabled} userId={userId}
        onDirty={() => setDirty(true)} onSave={form => { onSave(kind, form); setDirty(false); }} />
    </div>
  );
};

const FormEditor: React.FC<{
  kind: FormKind;
  production: Production;
  formsEnabled: boolean;
  userId: string | null;
  onDirty: () => void;
  onSave: (form: ProductionForm) => void;
}> = ({ kind, production, formsEnabled, userId, onDirty, onSave }) => {
  const start = productionForm(production, kind);
  const [fields, setFieldsState] = useState<FormField[]>(start.fields);
  const [look, setLookState] = useState<FormAppearance>(start.appearance);
  const [customLabel, setCustomLabel] = useState('');
  const setFields: typeof setFieldsState = value => { setFieldsState(value); onDirty(); };
  const setLook: typeof setLookState = value => { setLookState(value); onDirty(); };
  const documentUrlInvalid = Boolean(look.documentUrl?.trim()) && !safeHttpsUrl(look.documentUrl);

  // I campi predefiniti restano nel loro ordine; quelli aggiunti a mano vanno in fondo.
  const togglePreset = (preset: FormField, on: boolean) => setFields(list => on
    ? [...PRESET_FIELDS.filter(p => p.id === preset.id || list.some(f => f.id === p.id)).map(p => list.find(f => f.id === p.id) ?? p),
       ...list.filter(f => !PRESET_FIELDS.some(p => p.id === f.id))]
    : list.filter(f => f.id !== preset.id));
  const toggleRequired = (id: string) => setFields(list => list.map(f => (f.id === id ? { ...f, required: !f.required } : f)));
  const addCustom = () => {
    const label = customLabel.trim();
    if (!label) return;
    setFields(list => [...list, { id: `custom-${crypto.randomUUID().slice(0, 8)}`, label, type: 'text', required: false }]);
    setCustomLabel('');
  };

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="font-display text-xl font-bold">Domande</h2>
        {!formsEnabled && (
          <p className="rounded-[3px] bg-paper-deep p-3 text-sm text-ink-soft">Sei in modalità locale: le domande si salvano, ma i link al modulo partono solo dopo l'accesso online.</p>
        )}
        <ul className="divide-y divide-line rounded-[3px] border border-line bg-card">
          {PRESET_FIELDS.map(preset => {
            const current = fields.find(f => f.id === preset.id);
            return (
              <li key={preset.id} className="flex min-h-11 items-center gap-3 px-3">
                <label className="relative flex flex-1 items-center gap-3 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--color-ink)]" checked={Boolean(current)}
                    disabled={preset.id === 'nome'} onChange={e => togglePreset(preset, e.target.checked)} />
                  {preset.label}
                </label>
                {current && preset.id !== 'nome' && (
                  <button type="button" onClick={() => toggleRequired(preset.id)}
                    className={`text-xs ${current.required ? 'text-ink' : 'text-ink-soft'} underline-offset-4 hover:underline`}>
                    {current.required ? 'Obbligatorio' : 'Facoltativo'}
                  </button>
                )}
              </li>
            );
          })}
          {fields.filter(f => !PRESET_FIELDS.some(p => p.id === f.id)).map(field => (
            <li key={field.id} className="flex min-h-11 items-center gap-3 px-3 text-sm">
              <span className="flex-1">{field.label}</span>
              <button type="button" onClick={() => toggleRequired(field.id)}
                className={`text-xs ${field.required ? 'text-ink' : 'text-ink-soft'} underline-offset-4 hover:underline`}>
                {field.required ? 'Obbligatorio' : 'Facoltativo'}
              </button>
              <IconButton label={`Togli ${field.label}`} tone="danger" onClick={() => setFields(list => list.filter(f => f.id !== field.id))}>
                <X className="h-4 w-4" />
              </IconButton>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input value={customLabel} onChange={e => setCustomLabel(e.target.value)} placeholder="Altra domanda, es. Taglia costume"
            aria-label="Nuova domanda" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} />
          <Button variant="secondary" onClick={addCustom} disabled={!customLabel.trim()} icon={<Plus className="h-4 w-4" />}>Aggiungi</Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Aspetto</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <Field label="Testo del link">
            <Input value={look.documentLabel ?? ''} onChange={e => setLook({ ...look, documentLabel: e.target.value })} placeholder="Leggi qui la liberatoria" />
          </Field>
          <Field label="Link al documento da leggere" hint={documentUrlInvalid ? <span className="text-cue">Serve un link che inizia con https://</span> : 'Es. il PDF su Google Drive, condiviso in sola visualizzazione.'}>
            <Input type="url" inputMode="url" value={look.documentUrl ?? ''} onChange={e => setLook({ ...look, documentUrl: e.target.value })} placeholder="https://drive.google.com/…" />
          </Field>
        </div>
        {formsEnabled && userId ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <ImagePicker label="Copertina" hint="Foto in alto, orizzontale" url={look.coverUrl} wide
              onPick={file => uploadBrandingImage(file, userId, production.id, 'cover').then(coverUrl => setLook(l => ({ ...l, coverUrl })))}
              onRemove={() => setLook(l => ({ ...l, coverUrl: undefined }))} />
            <ImagePicker label="Logo" hint="Quadrato, appare nel cerchio" url={look.logoUrl}
              onPick={file => uploadBrandingImage(file, userId, production.id, 'logo').then(logoUrl => setLook(l => ({ ...l, logoUrl })))}
              onRemove={() => setLook(l => ({ ...l, logoUrl: undefined }))} />
            <ImagePicker label="Sfondo" hint="Immagine dietro il modulo" url={look.backgroundUrl} wide
              onPick={file => uploadBrandingImage(file, userId, production.id, 'background').then(backgroundUrl => setLook(l => ({ ...l, backgroundUrl })))}
              onRemove={() => setLook(l => ({ ...l, backgroundUrl: undefined }))} />
          </div>
        ) : (
          <p className="rounded-[3px] bg-paper-deep p-3 text-sm text-ink-soft">Copertina, logo e sfondo si caricano dopo l'accesso online.</p>
        )}
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Colori</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(FORM_THEMES) as Array<keyof typeof FORM_THEMES>).map(id => {
              const selected = (look.theme ?? 'docuset') === id;
              const [paper, ink] = FORM_THEMES[id].swatch;
              return (
                // relative: tiene dentro l'etichetta il pulsante nascosto, altrimenti toccandolo il telefono scorre la pagina fuori schermo.
                <label key={id} className={`relative flex min-h-11 cursor-pointer items-center gap-2 rounded-[3px] border bg-card px-3 text-sm ${selected ? 'border-ink' : 'border-line'}`}>
                  <input type="radio" name={`form-theme-${kind}`} className="sr-only" checked={selected} onChange={() => setLook(l => ({ ...l, theme: id === 'docuset' ? undefined : id }))} />
                  <span aria-hidden className="h-5 w-5 rounded-full border border-line" style={{ background: `linear-gradient(135deg, ${paper} 50%, ${ink} 50%)` }} />
                  {FORM_THEMES[id].label}
                </label>
              );
            })}
            <label className={`relative flex min-h-11 cursor-pointer items-center gap-2 rounded-[3px] border bg-card px-3 text-sm ${look.accentColor ? 'border-ink' : 'border-line'}`}>
              <input type="color" aria-label="Colore di pulsanti e link" value={safeHexColor(look.accentColor) || '#2A251D'}
                onChange={e => setLook(l => ({ ...l, accentColor: e.target.value }))} className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0" />
              Pulsanti e link
            </label>
            {look.accentColor && (
              <Button variant="ghost" onClick={() => setLook(l => ({ ...l, accentColor: undefined }))}>Colore predefinito</Button>
            )}
          </div>
        </fieldset>
      </section>

      <div className="flex justify-end border-t border-line pt-4">
        <Button className="max-sm:w-full" disabled={fields.length === 0 || documentUrlInvalid}
          onClick={() => onSave({ fields, appearance: cleanLook(look) })}>Salva il modulo</Button>
      </div>
    </div>
  );
};

export default Forms;
