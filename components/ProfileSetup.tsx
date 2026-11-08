import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button, Field, Input } from './ui';

/** Primo accesso: chiede nome e cognome, che compaiono nel pannello di chi gestisce DocuSet. */
const ProfileSetup: React.FC<{ email: string | null; onDone: (name: string) => void }> = ({ email, onDone }) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const fullName = name.trim().replace(/\s+/g, ' ');
    setSaving(true);
    setError(null);
    const { error: saveError } = await supabase.from('profiles').upsert({ full_name: fullName });
    setSaving(false);
    if (saveError) setError('Non riesco a salvare. Riprova tra poco.');
    else onDone(fullName);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <div className="flex gap-2 border-b border-line bg-paper-deep px-6 pt-4" aria-hidden>
        {['bg-manila', 'bg-st-delivered', 'bg-st-solicited'].map(color => <span key={color} className={`h-2 w-14 rounded-t-[3px] ${color}`} />)}
      </div>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">Primo accesso</p>
        <h1 className="font-display text-5xl leading-none">Come ti chiami?</h1>
        <p className="mt-4 text-ink-soft">Ti serve una volta sola{email ? <> per <strong className="text-ink">{email}</strong></> : null}.</p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <Field label="Nome e cognome">
            <Input required minLength={2} maxLength={120} autoComplete="name" autoFocus value={name}
              onChange={e => setName(e.target.value)} placeholder="Mario Rossi" />
          </Field>
          {error && <p role="alert" className="text-sm text-cue">{error}</p>}
          <Button type="submit" className="w-full" disabled={saving || name.trim().length < 2} icon={<ArrowRight className="h-4 w-4" />}>
            {saving ? 'Salvataggio…' : 'Continua'}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default ProfileSetup;
