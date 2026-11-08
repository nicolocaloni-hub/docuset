import React from 'react';
import { Eye, FilePlus, Trash2 } from 'lucide-react';
import type { Template } from '../types';
import { Board, Button, EmptyState, IconButton, PageHeader, Strip } from '../components/ui';

interface Props {
  templates: Template[];
  uploading: boolean;
  onUpload: () => void;
  onOpen: (template: Template) => void;
  onDelete: (template: Template) => void;
}

const Templates: React.FC<Props> = ({ templates, uploading, onUpload, onOpen, onDelete }) => (
  <section className="animate-enter">
    <PageHeader
      title="Template"
      text="I modelli PDF da compilare con i dati raccolti: contratti, liberatorie, dichiarazioni."
      actions={<Button onClick={onUpload} disabled={uploading} icon={<FilePlus className="h-4 w-4" />}>{uploading ? 'Caricamento…' : 'Carica PDF'}</Button>}
    />
    {templates.length === 0 ? (
      <EmptyState title="Nessun template" text="Carica un PDF: DocuSet riconosce i campi e li compila con le risposte di Tally."
        action={<Button onClick={onUpload} icon={<FilePlus className="h-4 w-4" />}>Carica PDF</Button>} />
    ) : (
      <Board>
        {templates.map(t => (
          <Strip key={t.id} band="bg-strip-blue">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{t.name}</p>
              <p className="text-sm text-ink-soft">
                <span className="font-mono text-xs uppercase">{t.type}</span>
                <span className="ml-2">{new Date(t.createdAt).toLocaleDateString('it-IT')}</span>
              </p>
            </div>
            <IconButton label={`Apri ${t.name}`} onClick={() => onOpen(t)}><Eye className="h-5 w-5" /></IconButton>
            <IconButton label={`Elimina ${t.name}`} tone="danger" onClick={() => onDelete(t)}><Trash2 className="h-5 w-5" /></IconButton>
          </Strip>
        ))}
      </Board>
    )}
  </section>
);

export default Templates;
