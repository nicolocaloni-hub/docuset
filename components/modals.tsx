import React, { useRef, useState } from 'react';
import { Download, LogOut, Plus, Trash2, Upload, X } from 'lucide-react';
import type { AppState, FormField, Person, Production, Template } from '../types';
import { PRESET_FIELDS, productionFields } from '../lib/forms';
import { DEFAULT_INVITE_TEMPLATE, DEFAULT_SOLICIT_TEMPLATE, TEMPLATE_VARIABLES, missingVariables } from '../services/whatsapp';
import { normalizeState } from '../lib/useAppData';
import { Button, Field, IconButton, Input, Modal, inputClass } from './ui';

/* ---------- Persona: nuova o modifica ---------- */

export type PersonDraft = Pick<Person, 'name' | 'role' | 'department' | 'whatsapp' | 'email' | 'notes'>;

export const PersonModal: React.FC<{
  initial?: Person;
  onSave: (draft: PersonDraft) => void;
  onClose: () => void;
}> = ({ initial, onSave, onClose }) => {
  const [draft, setDraft] = useState<PersonDraft>({
    name: initial?.name ?? '', role: initial?.role ?? '', department: initial?.department ?? '',
    whatsapp: initial?.whatsapp ?? '', email: initial?.email ?? '', notes: initial?.notes ?? '',
  });
  const set = (key: keyof PersonDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft({ ...draft, [key]: e.target.value });
  const submit = (e?: React.FormEvent) => { e?.preventDefault(); if (draft.name.trim()) onSave({ ...draft, name: draft.name.trim() }); };

  return (
    <Modal title={initial ? 'Modifica persona' : 'Nuova persona'} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Annulla</Button><Button onClick={() => submit()} disabled={!draft.name.trim()}>Salva</Button></>}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Nome e cognome"><Input value={draft.name} onChange={set('name')} autoComplete="off" required /></Field></div>
        <Field label="Ruolo"><Input value={draft.role} onChange={set('role')} placeholder="es. Fonico" /></Field>
        <Field label="Reparto"><Input value={draft.department} onChange={set('department')} placeholder="es. Suono" /></Field>
        <Field label="WhatsApp"><Input type="tel" value={draft.whatsapp} onChange={set('whatsapp')} placeholder="+39 333 000 0000" /></Field>
        <Field label="Email"><Input type="email" value={draft.email} onChange={set('email')} /></Field>
        <div className="sm:col-span-2"><Field label="Note">
          <textarea value={draft.notes} onChange={set('notes')} rows={2} className={inputClass} />
        </Field></div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
};

/* ---------- Nuova produzione ---------- */

export const ProductionModal: React.FC<{ onSave: (title: string) => void; onClose: () => void }> = ({ onSave, onClose }) => {
  const [title, setTitle] = useState('');
  const submit = (e?: React.FormEvent) => { e?.preventDefault(); if (title.trim()) onSave(title.trim()); };
  return (
    <Modal title="Nuova produzione" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Annulla</Button><Button onClick={() => submit()} disabled={!title.trim()}>Crea</Button></>}>
      <form onSubmit={submit}><Field label="Titolo"><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="es. Cortometraggio XYZ" /></Field></form>
    </Modal>
  );
};

/* ---------- Impostazioni produzione + backup + account ---------- */

export const SettingsModal: React.FC<{
  production: Production;
  data: AppState;
  accountEmail: string | null;
  /** Modulo DocuSet disponibile (Supabase collegato e accesso fatto). */
  formsEnabled: boolean;
  onSave: (patch: Pick<Production, 'title' | 'formLink' | 'formMode' | 'formFields' | 'whatsappMessageTemplate' | 'whatsappSolicitTemplate'>) => void;
  onDeleteProduction: () => void;
  onRestore: (state: AppState) => void;
  onSignOut?: () => void;
  onClose: () => void;
}> = ({ production, data, accountEmail, formsEnabled, onSave, onDeleteProduction, onRestore, onSignOut, onClose }) => {
  const [title, setTitle] = useState(production.title);
  const [mode, setMode] = useState<'docuset' | 'tally'>(formsEnabled && production.formMode !== 'tally' ? 'docuset' : 'tally');
  const [fields, setFields] = useState<FormField[]>(productionFields(production));
  const [customLabel, setCustomLabel] = useState('');
  const [formLink, setFormLink] = useState(production.formLink || '');
  const [invite, setInvite] = useState(production.whatsappMessageTemplate || DEFAULT_INVITE_TEMPLATE);
  const [solicit, setSolicit] = useState(production.whatsappSolicitTemplate || DEFAULT_SOLICIT_TEMPLATE);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const restoreRef = useRef<HTMLInputElement>(null);

  const inviteMissing = missingVariables(invite);
  const solicitMissing = missingVariables(solicit);
  const linkInvalid = formLink.trim() !== '' && !/^https:\/\//.test(formLink.trim());
  const canSave = title.trim() && !inviteMissing.length && !solicitMissing.length && !linkInvalid && (mode === 'tally' || fields.length > 0);

  // I campi predefiniti restano nel loro ordine; quelli aggiunti a mano vanno in fondo.
  const togglePreset = (preset: FormField, on: boolean) => setFields(list => on
    ? [...PRESET_FIELDS.filter(p => p.id === preset.id || list.some(f => f.id === p.id)), ...list.filter(f => !PRESET_FIELDS.some(p => p.id === f.id))]
    : list.filter(f => f.id !== preset.id));
  const toggleRequired = (id: string) => setFields(list => list.map(f => (f.id === id ? { ...f, required: !f.required } : f)));
  const addCustom = () => {
    const label = customLabel.trim();
    if (!label) return;
    setFields(list => [...list, { id: `custom-${crypto.randomUUID().slice(0, 8)}`, label, type: 'text', required: false }]);
    setCustomLabel('');
  };

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `docuset-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const state = normalizeState(JSON.parse(await file.text()));
      if (!state) throw new Error();
      if (window.confirm(`Ripristinare il backup? Sostituisce tutti i dati attuali (${state.productions.length} produzioni, ${state.people.length} persone).`)) {
        onRestore(state);
      }
    } catch {
      setRestoreError('Il file non è un backup DocuSet valido.');
    }
  };

  const variablesHint = (missing: string[]) => missing.length
    ? <span className="text-cue">Mancano: {missing.join(', ')}</span>
    : <>Variabili: {TEMPLATE_VARIABLES.map(v => <code key={v} className="mr-1 bg-paper-deep px-1 font-mono">{v}</code>)}</>;

  return (
    <Modal title="Impostazioni" onClose={onClose} wide
      footer={<><Button variant="ghost" onClick={onClose}>Annulla</Button>
        <Button disabled={!canSave} onClick={() => onSave({ title: title.trim(), formLink: formLink.trim(), formMode: mode, formFields: fields, whatsappMessageTemplate: invite, whatsappSolicitTemplate: solicit })}>Salva</Button></>}>
      <div className="space-y-5">
        <Field label="Titolo della produzione"><Input value={title} onChange={e => setTitle(e.target.value)} /></Field>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Modulo per cast e troupe</legend>
          {formsEnabled ? (
            <div className="grid grid-cols-2 gap-1 rounded-[3px] bg-paper-deep p-1" role="radiogroup">
              {([['docuset', 'Modulo DocuSet'], ['tally', 'Tally']] as const).map(([value, label]) => (
                <button key={value} type="button" role="radio" aria-checked={mode === value} onClick={() => setMode(value)}
                  className={`min-h-10 rounded-[3px] text-sm transition-colors ${mode === value ? 'bg-card font-medium shadow-[0_1px_0_var(--color-line)]' : 'text-ink-soft hover:text-ink'}`}>
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-soft">Il modulo DocuSet (senza Tally, con firma) si attiva collegando Supabase. Intanto puoi usare un modulo Tally.</p>
          )}
        </fieldset>

        {mode === 'docuset' ? (
          <div>
            <p className="mb-2 text-sm text-ink-soft">Ogni persona riceve un link personale. Scegli cosa chiedere:</p>
            <ul className="divide-y divide-line rounded-[3px] border border-line bg-card">
              {PRESET_FIELDS.map(preset => {
                const current = fields.find(f => f.id === preset.id);
                return (
                  <li key={preset.id} className="flex min-h-11 items-center gap-3 px-3">
                    <label className="flex flex-1 items-center gap-3 text-sm">
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
            <div className="mt-2 flex gap-2">
              <Input value={customLabel} onChange={e => setCustomLabel(e.target.value)} placeholder="Altra domanda, es. Taglia costume"
                aria-label="Nuova domanda" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} />
              <Button variant="secondary" onClick={addCustom} disabled={!customLabel.trim()} icon={<Plus className="h-4 w-4" />}>Aggiungi</Button>
            </div>
          </div>
        ) : (
          <Field label="Link del modulo Tally" hint={linkInvalid ? <span className="text-cue">Deve iniziare con https://</span> : 'A ogni persona arriva il link con pid e mid, così la risposta torna a lei.'}>
            <Input value={formLink} onChange={e => setFormLink(e.target.value)} placeholder="https://tally.so/r/XXXXXX" inputMode="url" />
          </Field>
        )}
        <Field label="Messaggio WhatsApp: invio" hint={variablesHint(inviteMissing)}>
          <textarea value={invite} onChange={e => setInvite(e.target.value)} rows={5} className={inputClass} />
        </Field>
        <Field label="Messaggio WhatsApp: sollecito" hint={variablesHint(solicitMissing)}>
          <textarea value={solicit} onChange={e => setSolicit(e.target.value)} rows={4} className={inputClass} />
        </Field>

        <div className="border-t border-ink/10 pt-5">
          <h3 className="font-display text-xl font-bold">Backup</h3>
          <p className="mt-1 text-sm text-ink-soft">Scarica una copia di tutte le produzioni o ripristinane una.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={exportBackup} icon={<Download className="h-4 w-4" />}>Esporta backup</Button>
            <Button variant="secondary" onClick={() => restoreRef.current?.click()} icon={<Upload className="h-4 w-4" />}>Ripristina</Button>
            <input ref={restoreRef} type="file" accept="application/json,.json" hidden onChange={importBackup} />
          </div>
          {restoreError && <p role="alert" className="mt-2 text-sm text-cue">{restoreError}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-5">
          <p className="text-sm text-ink-soft">{accountEmail ? <>Accesso come <strong className="text-ink">{accountEmail}</strong></> : 'Modalità locale: i dati restano in questo browser.'}</p>
          <div className="flex gap-2">
            {onSignOut && <Button variant="ghost" onClick={onSignOut} icon={<LogOut className="h-4 w-4" />}>Esci</Button>}
            <Button variant="ghost" className="text-cue hover:bg-cue/10 hover:text-cue" onClick={onDeleteProduction} icon={<Trash2 className="h-4 w-4" />}>Elimina produzione</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

/* ---------- Revisione della lista importata ---------- */

export const ImportReviewModal: React.FC<{
  members: Person[];
  onConfirm: (members: Person[]) => void;
  onClose: () => void;
}> = ({ members, onConfirm, onClose }) => {
  const [rows, setRows] = useState(members);
  const update = (id: string, key: 'name' | 'role' | 'whatsapp', value: string) =>
    setRows(list => list.map(r => (r.id === id ? { ...r, [key]: value } : r)));
  const valid = rows.filter(r => r.name.trim());

  return (
    <Modal title="Controlla l'importazione" onClose={onClose} wide
      footer={<><Button variant="ghost" onClick={onClose}>Annulla</Button>
        <Button onClick={() => onConfirm(valid)} disabled={!valid.length}>Aggiungi {valid.length} persone</Button></>}>
      <p className="mb-4 text-sm text-ink-soft">Correggi qui nomi, ruoli e numeri prima di aggiungerli. Le righe senza nome vengono saltate.</p>
      <div className="flex flex-col gap-2">
        {rows.map(r => (
          <div key={r.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-[3px] bg-card p-2 shadow-[0_1px_0_var(--color-line)] sm:grid-cols-[2fr_1.5fr_1.5fr_auto]">
            <Input aria-label="Nome" value={r.name} onChange={e => update(r.id, 'name', e.target.value)} />
            <IconButton label={`Togli ${r.name || 'riga'}`} tone="danger" className="sm:order-last" onClick={() => setRows(list => list.filter(x => x.id !== r.id))}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
            <Input aria-label="Ruolo" value={r.role} onChange={e => update(r.id, 'role', e.target.value)} placeholder="Ruolo" />
            <Input aria-label="Telefono" className="font-mono" value={r.whatsapp} onChange={e => update(r.id, 'whatsapp', e.target.value)} placeholder="Telefono" />
          </div>
        ))}
      </div>
    </Modal>
  );
};

/* ---------- Genera PDF ---------- */

export const GeneratePdfModal: React.FC<{
  person: Person;
  templates: Template[];
  busy: boolean;
  onGenerate: (templateId: string) => void;
  onClose: () => void;
}> = ({ person, templates, busy, onGenerate, onClose }) => {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  return (
    <Modal title="Genera PDF" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Annulla</Button>
        <Button onClick={() => onGenerate(templateId)} disabled={!templateId || busy} icon={<Download className="h-4 w-4" />}>{busy ? 'Generazione…' : 'Genera e scarica'}</Button></>}>
      {templates.length === 0
        ? <p className="text-sm text-ink-soft">Carica prima un template PDF nella sezione Template.</p>
        : <Field label={`Template da compilare con i dati di ${person.name}`}>
            <select value={templateId} onChange={e => setTemplateId(e.target.value)} className={inputClass}>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>}
    </Modal>
  );
};

/* ---------- Conferma eliminazione ---------- */

export const ConfirmModal: React.FC<{ title: string; text: React.ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void }> = ({
  title, text, confirmLabel, onConfirm, onClose,
}) => (
  <Modal title={title} onClose={onClose}
    footer={<><Button variant="ghost" onClick={onClose}>Annulla</Button><Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button></>}>
    <p className="text-sm">{text}</p>
  </Modal>
);
