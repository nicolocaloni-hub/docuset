import React, { useState } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button, Field, Input } from './ui';

/** Accesso senza password: Supabase manda un link alla mail. */
// Sull'app installata (iPhone) il link si apre in Safari, che ha un accesso separato: serve il codice.
const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setState('sending');
    setError(null);
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (authError) {
      setError(authError.message);
      setState('idle');
    } else {
      setState('sent');
    }
  };

  // Codice nella stessa email del link: serve sull'app installata, che su iPhone non condivide l'accesso con Safari.
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setVerifying(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    if (verifyError) setError('Codice non valido o scaduto. Controlla l\'ultima email ricevuta.');
    setVerifying(false);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <div className="flex gap-2 border-b border-line bg-paper-deep px-6 pt-4" aria-hidden>
        {['bg-manila', 'bg-st-delivered', 'bg-st-solicited'].map(color => <span key={color} className={`h-2 w-14 rounded-t-[3px] ${color}`} />)}
      </div>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">SmartSet</p>
        <h1 className="font-display text-6xl leading-none">DocuSet</h1>
        <p className="mt-4 text-ink-soft">Documenti di cast e troupe, in un posto solo. Accedi con la tua email: ti mandiamo un link.</p>

        {state === 'sent' ? (
          <div className="mt-8 space-y-4">
            <div className="flex gap-3 rounded-[3px] bg-card p-4">
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-manila-ink" />
              <p className="text-sm">Email inviata a <strong>{email}</strong>. {standalone() ? 'Scrivi qui il codice che trovi nel messaggio.' : 'Apri il link da questo dispositivo.'}</p>
            </div>
            {standalone() ? <form onSubmit={verify} className="space-y-3">
              <Field label="Codice dall'email">
                <Input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={10} value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" className="font-mono tracking-[0.3em]" />
              </Field>
              {error && <p role="alert" className="text-sm text-cue">{error}</p>}
              <Button type="submit" className="w-full" disabled={code.length < 6 || verifying}>{verifying ? 'Verifica…' : 'Entra con il codice'}</Button>
              <button type="button" onClick={() => { setState('idle'); setCode(''); setError(null); }} className="w-full text-sm text-ink-soft underline-offset-4 hover:underline">
                Usa un'altra email
              </button>
            </form> : (
              <button type="button" onClick={() => { setState('idle'); setError(null); }} className="w-full text-sm text-ink-soft underline-offset-4 hover:underline">
                Usa un'altra email
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Email">
              <Input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@produzione.it" />
            </Field>
            {error && <p role="alert" className="text-sm text-cue">{error}</p>}
            <Button type="submit" className="w-full" disabled={state === 'sending'} icon={<ArrowRight className="h-4 w-4" />}>
              {state === 'sending' ? 'Invio in corso…' : 'Mandami il link'}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
};

export default Login;
