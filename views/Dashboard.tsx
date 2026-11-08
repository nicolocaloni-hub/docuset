import React, { useMemo } from 'react';
import { ArrowRight, CheckCheck, FileText, Link2, UserPlus } from 'lucide-react';
import { type DeliveryStatus, type Person, type Production, deliveryStatus } from '../types';
import { Board, Button, EmptyState, PageHeader, STATUS_META, StatusChip, Strip } from '../components/ui';

const ORDER: DeliveryStatus[] = ['delivered', 'solicited', 'sent', 'todo'];

const daysSince = (iso?: string) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null);
const sinceLabel = (iso?: string) => {
  const days = daysSince(iso);
  return days === null ? '' : days === 0 ? 'oggi' : days === 1 ? 'ieri' : `${days} giorni fa`;
};

interface Props {
  production: Production;
  people: Person[];
  templatesCount: number;
  onOpenPeople: () => void;
  onOpenPending: () => void;
  onOpenTemplates: () => void;
  onOpenSettings: () => void;
  onImportDocument: () => void;
  onAdd: () => void;
  onSolicit: (person: Person) => void;
}

const Dashboard: React.FC<Props> = ({
  production, people, templatesCount, onOpenPeople, onOpenPending, onOpenTemplates, onOpenSettings, onImportDocument, onAdd, onSolicit,
}) => {
  const counts = useMemo(() => {
    const result: Record<DeliveryStatus, number> = { delivered: 0, solicited: 0, sent: 0, todo: 0 };
    people.forEach(p => { result[deliveryStatus(p)] += 1; });
    return result;
  }, [people]);

  // Chi ha ricevuto il link da più tempo senza rispondere va sollecitato per primo.
  const toChase = useMemo(() => people
    .filter(p => !p.deliveredAt && p.sentAt)
    .sort((a, b) => (a.solicitedAt || a.sentAt || '').localeCompare(b.solicitedAt || b.sentAt || ''))
    .slice(0, 6), [people]);

  const total = people.length;
  const percent = total ? Math.round((counts.delivered / total) * 100) : 0;

  return (
    <section className="animate-enter">
      <PageHeader title="Situazione" text={`Lo stato dei documenti per ${production.title}.`} />

      {!production.formLink && (
        <div className="mb-6 flex flex-col gap-3 bg-strip-yellow p-4 sm:flex-row sm:items-center">
          <Link2 className="h-5 w-5 shrink-0" />
          <p className="flex-1 text-sm">Manca il link del modulo Tally: senza, i messaggi WhatsApp non possono partire.</p>
          <Button onClick={onOpenSettings}>Imposta il link</Button>
        </div>
      )}

      {total === 0 ? (
        <EmptyState
          title="Produzione vuota"
          text="Parti dalla lista troupe: DocuSet legge nomi, ruoli e telefoni da un file Word o PDF."
          action={<div className="flex flex-wrap justify-center gap-2">
            <Button onClick={onImportDocument} icon={<FileText className="h-4 w-4" />}>Importa lista</Button>
            <Button variant="secondary" onClick={onAdd} icon={<UserPlus className="h-4 w-4" />}>Aggiungi a mano</Button>
          </div>}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <div className="bg-strip-white p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-ink-soft">Moduli consegnati</p>
                <p className="tabular font-display text-6xl font-extrabold leading-none">
                  {counts.delivered}<span className="text-ink-soft">/{total}</span>
                </p>
              </div>
              <p className="tabular font-mono text-sm text-ink-soft">{percent}%</p>
            </div>

            <div className="mt-5 flex h-4 gap-px bg-paper-deep" role="img"
              aria-label={ORDER.map(s => `${STATUS_META[s].label}: ${counts[s]}`).join(', ')}>
              {ORDER.filter(s => counts[s] > 0).map(s => (
                <span key={s} className={STATUS_META[s].band} style={{ width: `${(counts[s] / total) * 100}%` }} />
              ))}
            </div>

            <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
              {ORDER.map(s => (
                <li key={s} className="flex items-center gap-2 text-sm">
                  <span aria-hidden className={`h-3 w-3 shrink-0 ${STATUS_META[s].band}`} />
                  <span className="text-ink-soft">{STATUS_META[s].label}</span>
                  <span className="tabular ml-auto font-mono">{counts[s]}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-wrap gap-2 border-t border-ink/10 pt-4">
              <Button variant="secondary" onClick={onOpenPeople} icon={<ArrowRight className="h-4 w-4" />}>Cast & Crew</Button>
              <Button variant="ghost" onClick={onOpenTemplates}>{templatesCount} template</Button>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-display text-2xl font-bold">Da sollecitare</h2>
              {counts.sent + counts.solicited > toChase.length && (
                <button type="button" onClick={onOpenPending} className="text-sm underline underline-offset-4">Vedi tutti</button>
              )}
            </div>
            {toChase.length === 0 ? (
              <p className="bg-strip-white p-4 text-sm text-ink-soft">
                {counts.todo > 0 ? `${counts.todo} persone non hanno ancora ricevuto il modulo.` : 'Nessuno da sollecitare.'}
              </p>
            ) : (
              <Board>
                {toChase.map(p => (
                  <Strip key={p.id} band={STATUS_META[deliveryStatus(p)].band}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-xs text-ink-soft">
                        {p.solicitedAt ? `sollecitato ${sinceLabel(p.solicitedAt)}` : `inviato ${sinceLabel(p.sentAt)}`}
                      </p>
                    </div>
                    <StatusChip status={deliveryStatus(p)} />
                    <Button variant="secondary" className="min-h-10 px-3" onClick={() => onSolicit(p)} aria-label={`Sollecita ${p.name}`} icon={<CheckCheck className="h-4 w-4" />} />
                  </Strip>
                ))}
              </Board>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default Dashboard;
