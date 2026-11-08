import React, { useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, Paperclip, RefreshCw } from 'lucide-react';
import type { Person } from '../types';
import { extractCsvFileUrl } from '../services/tallyCsv';
import { isSubmissionFile } from '../lib/forms';
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
  /** Apre un file caricato dal modulo DocuSet (link firmato). */
  onOpenFile: (value: string) => void;
  /** Presente solo con il modulo DocuSet attivo. */
  onRefresh?: () => void;
  refreshing?: boolean;
}

const Responses: React.FC<Props> = ({ people, onImportCsv, importing, onGeneratePdf, onOpenFile, onRefresh, refreshing }) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <section className="animate-enter">
      <PageHeader
        title="Risposte"
        text={onRefresh
          ? 'Chi ha compilato il modulo. Le risposte arrivano da sole; apri una riga per vedere dati e allegati.'
          : 'Chi ha compilato il modulo Tally. Apri una riga per vedere i dati, oppure genera il PDF compilato.'}
        actions={<>
          {onRefresh && (
            <Button variant="secondary" onClick={onRefresh} disabled={refreshing} icon={<RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />}>
              Aggiorna
            </Button>
          )}
          <Button variant={onRefresh ? 'ghost' : 'secondary'} onClick={onImportCsv} disabled={importing} icon={<FileSpreadsheet className="h-4 w-4" />}>
            {importing ? 'Lettura…' : 'Importa CSV Tally'}
          </Button>
        </>}
      />

      {people.length === 0 ? (
        <EmptyState title="Ancora nessuna risposta" text={onRefresh
          ? 'Manda il modulo da Cast & Crew: quando una persona lo compila, la risposta compare qui da sola.'
          : 'Scarica il CSV dalla sezione Submissions di Tally e importalo qui: ogni risposta viene collegata alla persona giusta.'} />
      ) : (
        <Board>
          {people.map(p => {
            const fields = parseFields(p);
            const isOpen = expanded === p.id;
            return (
              <div key={p.id}>
                <Strip band="bg-st-delivered" onClick={() => setExpanded(isOpen ? null : p.id)}>
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
                  <div className="animate-enter -mt-1 rounded-b-[3px] border-t border-dashed border-line bg-card px-4 py-4 sm:px-6">
                    {!fields ? (
                      <p className="text-sm text-ink-soft">Nessun dato importato per questa persona.</p>
                    ) : (
                      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(fields).map(([key, value]) => {
                          const text = String(value ?? '');
                          if (!text || HIDDEN_FIELDS.has(key.toLowerCase().trim())) return null;
                          if (isSubmissionFile(text)) {
                            return (
                              <div key={key} className="min-w-0 border-l-2 border-manila/50 pl-3">
                                <dt className="text-xs text-ink-soft">{key}</dt>
                                <dd className="mt-0.5 text-sm">
                                  <button type="button" onClick={() => onOpenFile(text)} className="inline-flex items-center gap-1 underline underline-offset-4">
                                    <Paperclip className="h-3.5 w-3.5" /> {/firma|signature/i.test(key) ? 'Apri la firma' : 'Apri il file'}
                                  </button>
                                </dd>
                              </div>
                            );
                          }
                          const fileUrl = extractCsvFileUrl(text);
                          const isSignature = /firma|signature/i.test(key) || text.includes('storage.tally.so');
                          return (
                            <div key={key} className="min-w-0 border-l-2 border-manila/50 pl-3">
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
