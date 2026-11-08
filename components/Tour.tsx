import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { Button } from './ui';

export const TOUR_DONE_KEY = 'docuset_tour_done';

interface Step {
  /** Valore di `data-tour` dell'elemento da evidenziare; senza, la scheda sta al centro. */
  target?: string;
  title: string;
  text: string;
}

const STEPS: Step[] = [
  { title: 'Benvenuto in DocuSet', text: 'In un minuto vediamo come raccogliere i documenti di cast e troupe. Puoi saltare la guida quando vuoi e riaprirla dalle Impostazioni.' },
  { target: 'production', title: 'Le tue produzioni', text: 'Ogni produzione ha le sue persone, i suoi moduli e le sue risposte. Da qui passi dall\'una all\'altra o ne crei una nuova.' },
  { target: 'nav-PEOPLE', title: 'Cast & Crew', text: 'Aggiungi le persone una alla volta oppure importa la lista troupe da un file Word o PDF: nomi, ruoli e telefoni vengono letti da soli.' },
  { target: 'settings', title: 'Il modulo', text: 'Nelle Impostazioni scegli cosa chiedere (dati, documento, firma) e il testo dei messaggi WhatsApp.' },
  { target: 'nav-PEOPLE', title: 'Mandare il modulo', text: 'Ogni persona riceve su WhatsApp il suo link personale e compila dal telefono, senza account. Con "Invia a tutti" mandi il modulo a tutta la troupe di fila.' },
  { target: 'nav-REQUESTS', title: 'In attesa', text: 'Qui trovi chi non ha ancora compilato. Un tocco per sollecitare, oppure "Sollecita tutti".' },
  { target: 'nav-SIGNED', title: 'Risposte', text: 'I moduli compilati arrivano da soli: vedi dati, documento e firma, e generi il PDF compilato.' },
  { target: 'nav-TEMPLATES', title: 'Template', text: 'Carica contratti e liberatorie in PDF: DocuSet li compila con i dati e la firma di ogni persona.' },
  { title: 'Tutto pronto', text: 'Parti dalla lista troupe. Se ti serve, la guida è sempre in Impostazioni → "Rivedi la guida".' },
];

/** Primo elemento visibile con quel `data-tour` (sidebar su desktop, barra in basso su telefono). */
const findTarget = (name?: string) => {
  if (!name) return null;
  return [...document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)].find(el => el.offsetParent !== null) ?? null;
};

const PAD = 6;

/** Guida a passi con evidenziazione dell'elemento; si chiude con Salta, Esc o alla fine. */
const Tour: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  const finish = useCallback(() => {
    try { localStorage.setItem(TOUR_DONE_KEY, '1'); } catch { /* resta solo per questa sessione */ }
    onClose();
  }, [onClose]);

  const measure = useCallback(() => {
    const el = findTarget(step.target);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step.target]);

  useLayoutEffect(() => { measure(); }, [measure]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [measure]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, STEPS.length - 1));
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  // La scheda va sotto l'elemento, o sopra se l'elemento è nella metà bassa dello schermo.
  const cardStyle: React.CSSProperties = (() => {
    // Centro con i margini e non con transform, che l'animazione d'ingresso sovrascrive.
    if (!rect) return { inset: 0, margin: 'auto', height: 'fit-content' };
    const width = Math.min(340, window.innerWidth - 24);
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 12);
    return rect.top > window.innerHeight / 2
      ? { left, width, bottom: window.innerHeight - rect.top + PAD + 10 }
      : { left, width, top: rect.bottom + PAD + 10 };
  })();

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect ? (
        <div aria-hidden className="pointer-events-none fixed rounded-[4px] ring-2 ring-manila transition-all duration-300 ease-[var(--ease-out-strong)]"
          style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: '0 0 0 9999px rgba(42,37,29,0.55)' }} />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-ink/55" />
      )}

      <div key={index} className="animate-enter fixed w-[min(340px,calc(100vw-24px))] rounded-[4px] bg-card p-5 shadow-[0_16px_48px_rgba(42,37,29,0.3)]" style={cardStyle}>
        <div className="flex items-start justify-between gap-3">
          <p className="tabular font-mono text-[11px] uppercase tracking-widest text-ink-soft">{index + 1} di {STEPS.length}</p>
          <button type="button" onClick={finish} aria-label="Chiudi la guida" className="-mr-2 -mt-2 inline-flex h-9 w-9 items-center justify-center text-ink-soft hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 id="tour-title" className="mt-1 font-display text-2xl leading-tight">{step.title}</h2>
        <p className="mt-2 text-sm text-ink-soft">{step.text}</p>
        <div className="mt-3 flex gap-1" aria-hidden>
          {STEPS.map((_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i <= index ? 'bg-manila' : 'bg-line'}`} />)}
        </div>
        <div className="mt-4 flex items-center gap-2">
          {index === 0
            ? <Button variant="ghost" className="-ml-2" onClick={finish}>Salta la guida</Button>
            : <Button variant="ghost" className="-ml-2" onClick={() => setIndex(i => i - 1)} icon={<ArrowLeft className="h-4 w-4" />}>Indietro</Button>}
          <Button className="ml-auto" onClick={() => (last ? finish() : setIndex(i => i + 1))} icon={last ? undefined : <ArrowRight className="h-4 w-4" />}>
            {last ? 'Inizia' : 'Avanti'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Tour;
