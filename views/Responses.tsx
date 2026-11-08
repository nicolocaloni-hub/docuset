import React, { useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet } from 'lucide-react';
import type { Person } from '../types';
import { extractCsvFileUrl } from '../services/tallyCsv';
import { Board, Button, EmptyState, IconButton, PageHeader, Strip } from '../components/ui';

// Campi tecnici o duplicati che non servono nella scheda.
const HIDDEN_FIELDS = new Set(['nome e cognome', 'pid', 'mid', 'data emissione', 'data di emissione', 'scadenza', 'datanascita', 'luogonascita', 'cf']);

const parseFields = (person: Person): Record<string, unknown> | null => {
  if (!person.fieldsJSON) return null;
  try { return JSON.parse(person.fieldsJSON); } catch { return null; }
};

const formatDate = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
};

interface Props {
  people: Person[];
  onImportCsv: () => void;
  importing: boolean;
  onGeneratePdf: (person: Person) => void;
}

const Responses: React.FC<Props> = ({ people, onImportCsv, importing, onGeneratePdf }) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <section className="animate-enter">
      <PageHeader
        title="Risposte"
        text="Chi ha compilato il modulo Tally. Apri una riga per vedere i dati, oppure genera il PDF compilato."
        actions={<Button variant="secondary" onClick={onImportCsv} disabled={importing} icon={<FileSpreadsheet className="h-4 w-4" />}>
          {importing ? 'Lettura…' : 'Importa CSV Tally'}
        </Button>}
      />

      {people.length === 0 ? (
        <EmptyState title="Ancora nessuna risposta" text="Scarica il CSV dalla sezione Submissions di Tally e importalo qui: ogni risposta viene collegata alla persona giusta." />
      ) : (
        <Board>
          {people.map(p => {
            const fields = parseFields(p);
            const isOpen = expanded === p.id;
            return (
              <div key={p.id}>
                <Strip band="bg-strip-green" onClick={() => setExpanded(isOpen ? null : p.id)}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="truncate text-sm text-ink-soft">{p.role}</p>
                  </div>
                  <span className="tabular hidden font-mono text-xs text-ink-soft sm:inline">{formatDate(p.deliveredAt)}</span>
                  <div onClick={e => e.stopPropagation()}>
                    <IconButton label={`Genera il PDF compilato per ${p.name}`} onClick={() => onGeneratePdf(p)}>
                      <Download className="h-5 w-5" />
                    </IconButton>
                  </div>
                  <ChevronDown aria-hidden className={`h-5 w-5 text-ink-soft transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </Strip>

                {isOpen && (
                  <div className="animate-enter bg-paper px-4 py-4 sm:px-6">
                    {!fields ? (
                      <p className="text-sm text-ink-soft">Nessun dato importato per questa persona.</p>
                    ) : (
                      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(fields).map(([key, value]) => {
                          const text = String(value ?? '');
                          if (!text || HIDDEN_FIELDS.has(key.toLowerCase().trim())) return null;
                          const fileUrl = extractCsvFileUrl(text);
                          const isSignature = /firma|signature/i.test(key) || text.includes('storage.tally.so');
                          return (
                            <div key={key} className="min-w-0 border-l-2 border-ink/15 pl-3">
                              <dt className="text-xs text-ink-soft">{key}</dt>
                              <dd className="mt-0.5 break-words text-sm">
                                {isSignature && fileUrl
                                  ? <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
                                      <Download className="h-3.5 w-3.5" /> Apri la firma
                                    </a>
                                  : text}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </Board>
      )}
    </section>
  );
};

export default Responses;
