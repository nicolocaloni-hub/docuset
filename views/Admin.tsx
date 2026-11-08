import React, { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Board, Button, EmptyState, Input, Modal, Strip } from '../components/ui';

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  productions: number;
  people: number;
  forms_sent: number;
  forms_received: number;
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const csvCell = (value: string | number | null) => `"${String(value ?? '').replace(/"/g, '""')}"`;

/** CSV con separatore ";" e BOM, così Excel in italiano lo apre già in colonne. */
export const usersCsv = (users: AdminUser[]) => {
  const head = ['Nome', 'Email', 'Registrato', 'Ultimo accesso', 'Produzioni', 'Persone', 'Moduli inviati', 'Moduli ricevuti'];
  const rows = users.map(u => [u.full_name, u.email, u.created_at.slice(0, 10), u.last_sign_in_at?.slice(0, 10) ?? '',
    u.productions, u.people, u.forms_sent, u.forms_received]);
  return '﻿' + [head, ...rows].map(r => r.map(csvCell).join(';')).join('\r\n');
};

/** Pannello per chi gestisce DocuSet: tutti gli account registrati e quanto usano l'app. */
const AdminPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = async () => {
    if (!supabase) return;
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('admin_users');
    if (rpcError) setError('Non riesco a caricare gli utenti.');
    else setUsers(data as AdminUser[]);
  };

  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users ?? []).filter(u => !q || u.email.toLowerCase().includes(q) || (u.full_name ?? '').toLowerCase().includes(q));
  }, [users, query]);

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([usersCsv(shown)], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `docuset-utenti-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal title="Utenti DocuSet" onClose={onClose} wide
      footer={<>
        <Button variant="ghost" onClick={load} icon={<RefreshCw className="h-4 w-4" />}>Aggiorna</Button>
        <Button onClick={exportCsv} disabled={!shown.length} icon={<Download className="h-4 w-4" />}>Esporta CSV</Button>
      </>}>
      {error ? (
        <p role="alert" className="text-sm text-cue">{error}</p>
      ) : !users ? (
        <p className="flex items-center gap-2 text-sm text-ink-soft"><RefreshCw className="h-4 w-4 animate-spin" /> Caricamento…</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="tabular font-mono text-xs uppercase tracking-widest text-ink-soft">{users.length} registrati</p>
            <Input type="search" aria-label="Cerca utente" placeholder="Cerca nome o email" value={query} onChange={e => setQuery(e.target.value)} className="sm:ml-auto sm:max-w-60" />
          </div>
          {shown.length === 0 ? (
            <EmptyState title="Nessun utente" text={users.length ? 'Nessun risultato per questa ricerca.' : 'Ancora nessuno si è registrato.'} />
          ) : (
            <Board>
              {shown.map(u => (
                <Strip key={u.id} band={u.last_sign_in_at ? 'bg-st-delivered' : 'bg-st-todo'}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{u.full_name ?? <span className="text-ink-soft">Nome non inserito</span>}</p>
                    <p className="truncate text-sm text-ink-soft">{u.email}</p>
                    <p className="mt-1 text-xs text-ink-soft">Dal {date(u.created_at)} · ultimo accesso {date(u.last_sign_in_at)}</p>
                  </div>
                  <dl className="tabular grid shrink-0 grid-cols-2 gap-x-3 font-mono text-xs text-ink-soft sm:grid-cols-4">
                    <div><dt className="sr-only">Produzioni</dt><dd title="Produzioni">{u.productions} prod.</dd></div>
                    <div><dt className="sr-only">Persone</dt><dd title="Persone">{u.people} pers.</dd></div>
                    <div><dt className="sr-only">Moduli inviati</dt><dd title="Moduli inviati">{u.forms_sent} inv.</dd></div>
                    <div><dt className="sr-only">Moduli ricevuti</dt><dd title="Moduli ricevuti">{u.forms_received} ric.</dd></div>
                  </dl>
                </Strip>
              ))}
            </Board>
          )}
        </div>
      )}
    </Modal>
  );
};

export default AdminPanel;
