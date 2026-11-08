import React from 'react';
import { Send, SkipForward, X } from 'lucide-react';
import type { Person } from '../types';
import { Button, IconButton } from './ui';

export interface SendQueue {
  people: Person[];
  index: number;
  /** Link ancora da preparare prima di partire; `null` quando sono pronti. */
  preparing: number | null;
}

/**
 * Barra per mandare il modulo a molte persone di fila. WhatsApp non permette
 * invii automatici: ogni messaggio parte con un tocco, poi la barra passa alla persona successiva.
 */
const SequenceBar: React.FC<{
  queue: SendQueue;
  onSend: (person: Person) => void;
  onSkip: () => void;
  onClose: () => void;
}> = ({ queue, onSend, onSkip, onClose }) => {
  const person = queue.people[queue.index];
  const total = queue.people.length;
  const solicit = Boolean(person?.sentAt);

  return (
    <div className="fixed inset-x-0 bottom-14 z-40 px-3 pb-[env(safe-area-inset-bottom)] lg:bottom-4 lg:left-64 lg:px-10" role="region" aria-label="Invio in sequenza">
      <div className="animate-enter mx-auto flex max-w-3xl items-center gap-3 rounded-[3px] bg-ink p-3 text-paper shadow-[0_8px_28px_rgba(42,37,29,0.35)] sm:p-4">
        <div className="min-w-0 flex-1">
          <p className="tabular truncate font-mono text-[11px] uppercase tracking-wider text-paper/60">
            {queue.preparing !== null ? `${total - queue.preparing} di ${total} · Preparo i link` : `${queue.index + 1} di ${total} · Invio in sequenza`}
          </p>
          <p className="truncate font-medium">{queue.preparing !== null ? 'Un attimo…' : person?.name}</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-paper/15" aria-hidden>
            <div className="h-full bg-manila transition-[width] duration-300" style={{ width: `${(queue.index / total) * 100}%` }} />
          </div>
        </div>
        {queue.preparing === null && person && (
          <>
            <IconButton label="Salta questa persona" className="text-paper/70 hover:bg-paper/10 hover:text-paper" onClick={onSkip}>
              <SkipForward className="h-5 w-5" />
            </IconButton>
            <Button variant="secondary" onClick={() => onSend(person)} icon={<Send className="h-4 w-4" />}>
              {solicit ? 'Sollecita' : 'Invia'}
            </Button>
          </>
        )}
        <IconButton label="Interrompi l'invio in sequenza" className="text-paper/70 hover:bg-paper/10 hover:text-paper" onClick={onClose}>
          <X className="h-5 w-5" />
        </IconButton>
      </div>
    </div>
  );
};

export default SequenceBar;
