import React, { useState } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button, Field, Input } from './ui';

/** Accesso senza password: Supabase manda un link alla mail. */
const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

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
          <div className="mt-8 flex gap-3 rounded-[3px] bg-card p-4">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-manila-ink" />
            <p className="text-sm">Link inviato a <strong>{email}</strong>. Aprilo da questo dispositivo per entrare.</p>
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
