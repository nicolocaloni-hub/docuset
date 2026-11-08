import React, { useMemo, useState } from 'react';
import { CheckCheck, FileText, ListOrdered, Search, Send, Trash2, UserPlus } from 'lucide-react';
import { type DeliveryStatus, type Person, deliveryStatus } from '../types';
import { Board, Button, EmptyState, IconButton, PageHeader, STATUS_META, StatusChip, Strip, inputClass } from '../components/ui';

type Filter = 'all' | DeliveryStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tutti' },
  { id: 'todo', label: 'Da inviare' },
  { id: 'sent', label: 'Inviati' },
  { id: 'solicited', label: 'Sollecitati' },
  { id: 'delivered', label: 'Consegnati' },
];

interface Props {
  mode: 'all' | 'pending';
  people: Person[];
  onEdit: (person: Person) => void;
  onAdd: () => void;
  onDelete: (person: Person) => void;
  onWhatsApp: (person: Person) => void;
  onImportDocument: () => void;
  importing: boolean;
  /** Avvia l'invio in sequenza alle persone indicate. */
  onSendAll: (people: Person[]) => void;
}

const PeopleList: React.FC<Props> = ({ mode, people, onEdit, onAdd, onDelete, onWhatsApp, onImportDocument, importing, onSendAll }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [department, setDepartment] = useState('');

  const scoped = useMemo(() => (mode === 'pending' ? people.filter(p => !p.deliveredAt) : people), [mode, people]);
  const departments = useMemo(() => [...new Set(scoped.map(p => p.department).filter(Boolean))].sort(), [scoped]);
  const counts = useMemo(() => {
    const result: Record<Filter, number> = { all: scoped.length, todo: 0, sent: 0, solicited: 0, delivered: 0 };
    scoped.forEach(p => { result[deliveryStatus(p)] += 1; });
    return result;
  }, [scoped]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter(p =>
      (filter === 'all' || deliveryStatus(p) === filter) &&
      (!department || p.department === department) &&
      (!q || `${p.name} ${p.role} ${p.department} ${p.whatsapp}`.toLowerCase().includes(q)),
    );
  }, [scoped, query, filter, department]);

  const filters = mode === 'pending' ? FILTERS.filter(f => f.id !== 'delivered') : FILTERS;
  // Rispetta ricerca e filtri: si può mandare a un solo reparto. In "Cast & Crew" vanno solo i "da inviare".
  const batch = visible.filter(p => p.whatsapp && (mode === 'pending' ? !p.deliveredAt : deliveryStatus(p) === 'todo'));
  const batchButton = batch.length > 1 && (
    <Button variant="secondary" className="flex-1 whitespace-nowrap sm:flex-none" onClick={() => onSendAll(batch)} icon={<ListOrdered className="h-4 w-4" />}>
      {mode === 'pending' ? `Sollecita tutti (${batch.length})` : `Invia a tutti (${batch.length})`}
    </Button>
  );

  return (
    <section className="animate-enter">
      {mode === 'all' ? (
        <PageHeader
          title="Cast & Crew"
          text="Le persone della produzione e a che punto sono con i documenti."
          actions={<>
            {batchButton}
            <Button variant="secondary" className="flex-1 whitespace-nowrap sm:flex-none" onClick={onImportDocument} disabled={importing} icon={<FileText className="h-4 w-4" />}>
              {importing ? 'Lettura…' : 'Importa lista'}
            </Button>
            {/* Su telefono c'è il pulsante + fisso in basso. */}
            <Button className="max-lg:hidden" onClick={onAdd} icon={<UserPlus className="h-4 w-4" />}>Aggiungi</Button>
          </>}
        />
      ) : (
        <PageHeader title="In attesa" text="Chi non ha ancora compilato il modulo. Sollecita su WhatsApp con un tocco." actions={batchButton || undefined} />
      )}

      {scoped.length > 0 && (
        <div className="mb-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cerca nome, ruolo, reparto, telefono"
                aria-label="Cerca persone" className={`${inputClass} pl-9`} />
            </div>
            {departments.length > 1 && (
              <select value={department} onChange={e => setDepartment(e.target.value)} aria-label="Filtra per reparto" className={`${inputClass} sm:w-48`}>
                <option value="">Tutti i reparti</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
          </div>
          <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="group" aria-label="Filtra per stato">
            {filters.map(f => (
              <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}
                className={`flex min-h-9 shrink-0 items-center gap-2 rounded-[3px] border px-3 text-sm transition-colors ${filter === f.id ? 'border-ink bg-ink text-paper' : 'border-line bg-card text-ink hover:border-ink/40'}`}>
                {f.id !== 'all' && <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${STATUS_META[f.id].band}`} />}
                {f.label}
                <span className="tabular font-mono text-xs opacity-70">{f.id === 'all' ? scoped.length : counts[f.id]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {scoped.length === 0 ? (
        mode === 'pending'
          ? <EmptyState title="Tutto consegnato" text="Nessuno è in attesa: tutte le persone hanno compilato il modulo." />
          : <EmptyState title="Nessuna persona" text="Importa la lista troupe da un file Word o PDF, oppure aggiungi le persone una alla volta."
              action={<Button onClick={onImportDocument} icon={<FileText className="h-4 w-4" />}>Importa lista</Button>} />
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-soft">Nessun risultato con questi filtri.</p>
      ) : (
        <Board>
          {visible.map(p => {
            const status = deliveryStatus(p);
            const solicit = status === 'sent' || status === 'solicited';
            return (
              <Strip key={p.id} band={STATUS_META[status].band} onClick={() => onEdit(p)}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="truncate text-sm text-ink-soft">
                    {[p.role, p.department].filter(Boolean).join(' · ')}
                    {p.whatsapp && <span className="ml-2 hidden font-mono text-xs sm:inline">{p.whatsapp}</span>}
                  </p>
                </div>
                <StatusChip status={status} />
                <div className="flex items-center" onClick={e => e.stopPropagation()}>
                  {status === 'delivered' && mode === 'all' && <span aria-hidden className="w-11" />}
                  {status !== 'delivered' && (
                    mode === 'pending'
                      ? <Button variant="secondary" className="ml-1 min-h-10 px-3" onClick={() => onWhatsApp(p)} aria-label={`${solicit ? 'Sollecita' : 'Invia a'} ${p.name}`} icon={solicit ? <CheckCheck className="h-4 w-4" /> : <Send className="h-4 w-4" />}>
                          <span className="hidden sm:inline">{solicit ? 'Sollecita' : 'Invia'}</span>
                        </Button>
                      : <IconButton label={solicit ? `Sollecita ${p.name} su WhatsApp` : `Invia il modulo a ${p.name}`} tone="go" onClick={() => onWhatsApp(p)}>
                          {solicit ? <CheckCheck className="h-5 w-5" /> : <Send className="h-5 w-5" />}
                        </IconButton>
                  )}
                  {mode === 'all' && (
                    <IconButton label={`Elimina ${p.name}`} tone="danger" onClick={() => onDelete(p)}>
                      <Trash2 className="h-5 w-5" />
                    </IconButton>
                  )}
                </div>
              </Strip>
            );
          })}
        </Board>
      )}
    </section>
  );
};

export default PeopleList;
