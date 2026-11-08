import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { CheckCircle2, FileText, Inbox, LayoutGrid, Plus, RefreshCw, Settings, Users } from 'lucide-react';
import { type AppState, type Person, type Template, TemplateType } from './types';
import { supabase } from './lib/supabase';
import { type SyncStatus, useAppData } from './lib/useAppData';
import { deleteTemplateFile, fetchTemplateBytes, storeTemplateFile, templateFileUrl } from './lib/templateFiles';
import { applySubmissions, deleteFormData, ensureFormLink, fetchFormState, formUrl, isSubmissionFile, submissionFileUrl } from './lib/forms';
import { extractCrewMembersFromFile, normalizePhone } from './services/documentExtraction';
import { buildMessage, whatsappUrl } from './services/whatsapp';
import { buildPersonPdf } from './services/personPdf';
import { Button, ToastProvider, useToast } from './components/ui';
import { ConfirmModal, GeneratePdfModal, ImportReviewModal, PersonModal, ProductionModal, SettingsModal, type PersonDraft } from './components/modals';
import Login from './components/Login';
import SequenceBar, { type SendQueue } from './components/SequenceBar';
import Tour, { TOUR_DONE_KEY } from './components/Tour';
import InstallPrompt from './components/InstallPrompt';
import PublicForm from './views/PublicForm';
import Dashboard from './views/Dashboard';
import PeopleList from './views/PeopleList';
import Responses from './views/Responses';
import Templates from './views/Templates';

type Tab = 'DASHBOARD' | 'PEOPLE' | 'REQUESTS' | 'SIGNED' | 'TEMPLATES';

const NAV: { id: Tab; label: string; short: string; icon: typeof Users }[] = [
  { id: 'DASHBOARD', label: 'Situazione', short: 'Situazione', icon: LayoutGrid },
  { id: 'PEOPLE', label: 'Cast & Crew', short: 'Persone', icon: Users },
  { id: 'REQUESTS', label: 'In attesa', short: 'In attesa', icon: Inbox },
  { id: 'SIGNED', label: 'Risposte', short: 'Risposte', icon: CheckCircle2 },
  { id: 'TEMPLATES', label: 'Template', short: 'Template', icon: FileText },
];

const ACTIVE_PRODUCTION_KEY = 'docuset_active_production';

const SYNC_LABEL: Record<SyncStatus, string> = {
  loading: 'Caricamento…', local: 'Salvato in questo browser', saving: 'Salvataggio…',
  saved: 'Salvato online', error: 'Errore di salvataggio', conflict: 'Modificato altrove',
};

type Dialog =
  | { kind: 'person'; person?: Person }
  | { kind: 'production' }
  | { kind: 'settings' }
  | { kind: 'import'; members: Person[] }
  | { kind: 'pdf'; person: Person }
  | { kind: 'delete-person'; person: Person }
  | { kind: 'delete-template'; template: Template }
  | { kind: 'delete-production' }
  | null;

const Workspace: React.FC<{ userId: string | null; email: string | null }> = ({ userId, email }) => {
  const toast = useToast();
  const { data, setData, status, error, reload } = useAppData(userId);
  const [tab, setTab] = useState<Tab>('DASHBOARD');
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try { return localStorage.getItem(ACTIVE_PRODUCTION_KEY); } catch { return null; }
  });
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState({ document: false, template: false, pdf: false });
  const documentInput = useRef<HTMLInputElement>(null);
  const templateInput = useRef<HTMLInputElement>(null);
  const formsEnabled = Boolean(supabase && userId);
  const [formTokens, setFormTokens] = useState<Map<string, string>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [queue, setQueue] = useState<SendQueue | null>(null);
  // La guida parte da sola solo la prima volta; poi si riapre dalle Impostazioni.
  const [tourOpen, setTourOpen] = useState(() => {
    try { return !localStorage.getItem(TOUR_DONE_KEY); } catch { return false; }
  });
  const dataRef = useRef(data);
  dataRef.current = data;

  const production = data?.productions.find(p => p.id === selectedId) ?? data?.productions[0];
  const productionId = production?.id ?? null;
  const people = useMemo(() => (data?.people ?? []).filter(p => p.productionId === productionId && !p.removedAt), [data, productionId]);
  const delivered = useMemo(() => people.filter(p => p.deliveredAt), [people]);
  const pendingCount = people.length - delivered.length;

  useEffect(() => {
    if (!productionId) return;
    try { localStorage.setItem(ACTIVE_PRODUCTION_KEY, productionId); } catch { /* solo comodità */ }
  }, [productionId]);

  useEffect(() => { if (error) toast(error, 'error'); }, [error, toast]);

  const updatePerson = useCallback((id: string, patch: Partial<Person>) => {
    setData(prev => ({ ...prev, people: prev.people.map(p => (p.id === id ? { ...p, ...patch } : p)) }));
  }, [setData]);

  /* ---------- Modulo DocuSet: risposte in arrivo ---------- */

  const refreshForms = useCallback(async (manual = false) => {
    if (!formsEnabled || !dataRef.current) return;
    if (manual) setRefreshing(true);
    try {
      const { tokens, submissions } = await fetchFormState();
      setFormTokens(tokens);
      const { changed } = applySubmissions(dataRef.current.people, submissions);
      if (changed) {
        setData(prev => ({ ...prev, people: applySubmissions(prev.people, submissions).people }));
        toast(changed === 1 ? 'È arrivato un nuovo modulo compilato.' : `Sono arrivati ${changed} nuovi moduli compilati.`);
      } else if (manual) {
        toast('Nessuna risposta nuova.');
      }
    } catch (err) {
      if (manual) toast(`Non riesco a leggere le risposte: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      if (manual) setRefreshing(false);
    }
  }, [formsEnabled, setData, toast]);

  // Controlla le risposte all'apertura, quando si torna sulla scheda e ogni minuto.
  const dataLoaded = Boolean(data);
  useEffect(() => {
    if (!formsEnabled || !dataLoaded) return;
    refreshForms();
    const onFocus = () => { if (document.visibilityState === 'visible') refreshForms(); };
    document.addEventListener('visibilitychange', onFocus);
    const timer = window.setInterval(onFocus, 60_000);
    return () => { document.removeEventListener('visibilitychange', onFocus); window.clearInterval(timer); };
  }, [formsEnabled, dataLoaded, refreshForms]);

  /* ---------- WhatsApp ---------- */

  const sendWhatsApp = async (person: Person) => {
    if (!production) return;
    if (!formsEnabled || !userId) {
      toast('Il modulo funziona solo online: accedi con la tua email per mandare i link.', 'error');
      return;
    }
    const solicit = Boolean(person.sentAt);
    const open = (token: string) => whatsappUrl(person.whatsapp, buildMessage(solicit ? 'solicit' : 'invite', production, person, formUrl(token)), navigator.userAgent);

    const known = formTokens.get(`${production.id}/${person.id}`);
    // Senza token in memoria va creato: apro subito la finestra, dopo un await i browser bloccano i popup.
    const win = known ? null : window.open('', '_blank');
    try {
      const token = known ?? await ensureFormLink(userId, production, person);
      if (known) {
        window.open(open(token), '_blank');
        ensureFormLink(userId, production, person).catch(() => { /* aggiorna solo campi e scadenza */ });
      } else {
        setFormTokens(map => new Map(map).set(`${production.id}/${person.id}`, token));
        if (win) win.location.href = open(token); else window.open(open(token), '_blank');
      }
    } catch (err) {
      win?.close();
      toast(err instanceof Error ? err.message : 'Non riesco a creare il link del modulo.', 'error');
      return;
    }
    updatePerson(person.id, solicit ? { solicitedAt: new Date().toISOString() } : { sentAt: new Date().toISOString() });
  };

  /* ---------- Invio in sequenza ---------- */

  // Crea prima tutti i link mancanti: poi ogni tocco apre WhatsApp subito, senza attese.
  const startQueue = async (list: Person[]) => {
    if (!production || !formsEnabled || !userId) {
      toast('Il modulo funziona solo online: accedi con la tua email per mandare i link.', 'error');
      return;
    }
    const missing = list.filter(p => !formTokens.has(`${production.id}/${p.id}`));
    setQueue({ people: list, index: 0, preparing: missing.length || null });
    try {
      for (let i = 0; i < missing.length; i++) {
        const token = await ensureFormLink(userId, production, missing[i]);
        setFormTokens(map => new Map(map).set(`${production.id}/${missing[i].id}`, token));
        setQueue(q => q && { ...q, preparing: missing.length - i - 1 || null });
      }
    } catch (err) {
      setQueue(null);
      toast(err instanceof Error ? err.message : 'Non riesco a preparare i link.', 'error');
    }
  };

  const advanceQueue = () => {
    if (!queue) return;
    const next = queue.index + 1;
    if (next < queue.people.length) {
      setQueue({ ...queue, index: next });
    } else {
      setQueue(null);
      toast('Invio in sequenza completato.');
    }
  };

  const openSubmissionFile = async (value: string) => {
    const win = window.open('', '_blank');
    try {
      const url = await submissionFileUrl(value);
      if (win) win.location.href = url; else window.open(url, '_blank');
    } catch (err) {
      win?.close();
      toast(err instanceof Error ? err.message : 'Non riesco ad aprire il file.', 'error');
    }
  };

  const removeFormData = (productionIdToClear: string, personIds?: string[]) => {
    if (!formsEnabled) return;
    deleteFormData(productionIdToClear, personIds).catch(() =>
      toast('Le risposte al modulo restano su Supabase: riprova a eliminare più tardi.', 'error'));
  };

  /* ---------- Import lista troupe (DOCX/PDF) ---------- */

  const importDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !productionId || !data) return;
    setBusy(b => ({ ...b, document: true }));
    try {
      const parsed = await extractCrewMembersFromFile(file);
      const known = new Set(people.map(p => p.name.toLowerCase()));
      const members: Person[] = parsed
        .filter(p => p.name && !known.has(p.name.toLowerCase()))
        .map(p => ({
          id: `per-${crypto.randomUUID()}`, productionId, name: p.name, role: p.role || 'Crew',
          department: p.department || 'Generale', whatsapp: normalizePhone(p.phone || ''), hubToken: crypto.randomUUID(),
        }));
      const duplicates = parsed.filter(p => p.name).length - members.length;
      if (members.length) {
        setDialog({ kind: 'import', members });
        if (duplicates) toast(`${duplicates} persone erano già presenti e sono state saltate.`);
      } else {
        toast(duplicates
          ? `Tutte le ${duplicates} persone del file sono già presenti.`
          : 'Nessuna persona trovata: il file deve contenere una tabella con nome, ruolo e telefono.', 'error');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Errore nella lettura del file.', 'error');
    } finally {
      setBusy(b => ({ ...b, document: false }));
    }
  };

  /* ---------- Template ---------- */

  const uploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') { toast('Il template deve essere un PDF.', 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { toast('Il PDF supera i 10 MB.', 'error'); return; }
    setBusy(b => ({ ...b, template: true }));
    try {
      const id = `t-${crypto.randomUUID()}`;
      const fileUrl = await storeTemplateFile(file, id, userId);
      const template: Template = {
        id, name: file.name.replace(/\.pdf$/i, ''), type: TemplateType.OTHER, fileUrl, fileName: file.name,
        fileType: file.type, isBlank: true, fields: [], createdAt: new Date().toISOString(),
      };
      setData(prev => ({ ...prev, templates: [...prev.templates, template] }));
      toast(`Template “${template.name}” caricato.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Caricamento non riuscito.', 'error');
    } finally {
      setBusy(b => ({ ...b, template: false }));
    }
  };

  const openTemplate = async (template: Template) => {
    // Apro la finestra subito: dopo un await i browser bloccano il popup.
    const win = window.open('', '_blank');
    try {
      const url = await templateFileUrl(template.fileUrl);
      if (url.startsWith('data:')) {
        const blobUrl = URL.createObjectURL(await (await fetch(url)).blob());
        if (win) win.location.href = blobUrl; else window.open(blobUrl, '_blank');
      } else if (win) win.location.href = url; else window.open(url, '_blank');
    } catch (err) {
      win?.close();
      toast(err instanceof Error ? err.message : 'Non riesco ad aprire il template.', 'error');
    }
  };

  const generatePdf = async (person: Person, templateId: string) => {
    const template = data?.templates.find(t => t.id === templateId);
    if (!template) return;
    setBusy(b => ({ ...b, pdf: true }));
    try {
      let formData: Record<string, unknown> | null = null;
      try { formData = person.fieldsJSON ? JSON.parse(person.fieldsJSON) : null; } catch { /* dati corrotti */ }
      if (!formData) throw new Error('Questa persona non ha ancora compilato il modulo.');
      // File del modulo DocuSet: la firma diventa un link firmato, gli altri allegati non vanno nel PDF.
      const resolved: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(formData)) {
        if (!isSubmissionFile(value)) resolved[key] = value;
        else if (/firma|signature/i.test(key)) resolved[key] = await submissionFileUrl(value as string);
      }
      const bytes = await buildPersonPdf(template, await fetchTemplateBytes(template.fileUrl), { nome: person.name, ...resolved });
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${person.name}_${template.name}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setDialog(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Errore nella generazione del PDF.', 'error');
    } finally {
      setBusy(b => ({ ...b, pdf: false }));
    }
  };

  /* ---------- CRUD ---------- */

  const savePerson = (draft: PersonDraft, existing?: Person) => {
    const clean = { ...draft, whatsapp: normalizePhone(draft.whatsapp), role: draft.role || 'Crew', department: draft.department || 'Generale' };
    if (existing) updatePerson(existing.id, clean);
    else if (productionId) setData(prev => ({ ...prev, people: [...prev.people, { ...clean, id: `per-${crypto.randomUUID()}`, productionId, hubToken: crypto.randomUUID() }] }));
    setDialog(null);
  };

  const createProduction = (title: string) => {
    const id = `p-${crypto.randomUUID()}`;
    setData(prev => ({ ...prev, productions: [...prev.productions, { id, title, createdAt: new Date().toISOString() }] }));
    setSelectedId(id);
    setTab('DASHBOARD');
    setDialog(null);
  };

  const deleteProduction = () => {
    if (!productionId) return;
    setData(prev => {
      const productions = prev.productions.filter(p => p.id !== productionId);
      return {
        ...prev,
        productions: productions.length ? productions : [{ id: `p-${crypto.randomUUID()}`, title: 'Nuova produzione', createdAt: new Date().toISOString() }],
        people: prev.people.filter(p => p.productionId !== productionId),
      };
    });
    removeFormData(productionId);
    setSelectedId(null);
    setDialog(null);
  };

  const deleteTemplate = async (template: Template) => {
    setData(prev => ({ ...prev, templates: prev.templates.filter(t => t.id !== template.id) }));
    setDialog(null);
    await deleteTemplateFile(template.fileUrl).catch(() => toast('Il file del template resta nello storage: eliminalo da Supabase.', 'error'));
  };

  const restoreBackup = (state: AppState) => {
    setData(state);
    setSelectedId(state.productions[0]?.id ?? null);
    setDialog(null);
    toast('Backup ripristinato.');
  };

  if (!data || !production) {
    return (
      <div className="flex min-h-dvh items-center justify-center gap-3 text-ink-soft">
        {status === 'error'
          ? <><span>{error}</span><Button variant="secondary" onClick={reload}>Riprova</Button></>
          : <><RefreshCw className="h-4 w-4 animate-spin" /> Caricamento…</>}
      </div>
    );
  }

  const productionSwitcher = (className: string) => (
    <select
      aria-label="Produzione attiva"
      data-tour="production"
      value={production.id}
      onChange={e => { if (e.target.value === '__new') setDialog({ kind: 'production' }); else setSelectedId(e.target.value); }}
      className={className}
    >
      {data.productions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
      <option value="__new">+ Nuova produzione</option>
    </select>
  );

  const syncDot = status === 'error' || status === 'conflict' ? 'bg-cue' : status === 'saving' ? 'bg-st-sent' : 'bg-st-delivered';

  return (
    <div className="min-h-dvh lg:pl-64">
      <input ref={documentInput} type="file" accept=".docx,.pdf" hidden onChange={importDocument} />
      <input ref={templateInput} type="file" accept="application/pdf,.pdf" hidden onChange={uploadTemplate} />

      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-paper-deep text-ink lg:flex">
        <div className="px-5 pb-4 pt-6">
          <p className="font-mono text-[11px] uppercase tracking-widest text-ink-soft">SmartSet</p>
          <p className="font-display text-3xl leading-none">DocuSet</p>
        </div>
        <div className="px-3">
          {productionSwitcher('w-full min-h-11 cursor-pointer rounded-[3px] border border-line bg-card px-3 text-sm text-ink outline-none hover:border-ink/40')}
        </div>
        <nav className="mt-6 flex flex-col gap-px px-3" aria-label="Sezioni">
          {NAV.map(item => (
            <button key={item.id} type="button" data-tour={`nav-${item.id}`} onClick={() => setTab(item.id)} aria-current={tab === item.id ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-[3px] px-3 text-left text-sm transition-colors ${tab === item.id ? 'bg-manila text-ink font-medium' : 'text-ink-soft hover:bg-ink/5 hover:text-ink'}`}>
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.id === 'REQUESTS' && pendingCount > 0 && <span className="tabular font-mono text-xs">{pendingCount}</span>}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-line p-3">
          <button type="button" data-tour="settings" onClick={() => setDialog({ kind: 'settings' })}
            className="flex min-h-11 w-full items-center gap-3 rounded-[3px] px-3 text-sm text-ink-soft hover:bg-ink/5 hover:text-ink">
            <Settings className="h-4 w-4" /> Impostazioni
          </button>
          <p className="flex items-center gap-2 px-3 pt-2 text-xs text-ink-soft" role="status">
            <span aria-hidden className={`h-2 w-2 rounded-full ${syncDot}`} /> {SYNC_LABEL[status]}
          </p>
        </div>
      </aside>

      {/* Barra superiore telefono */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-paper-deep px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-ink lg:hidden">
        <p className="font-display text-2xl leading-none">DocuSet</p>
        <span aria-hidden className={`h-2 w-2 rounded-full ${syncDot}`} title={SYNC_LABEL[status]} />
        <div className="ml-auto min-w-0 max-w-[55%]">
          {productionSwitcher('w-full min-h-10 truncate rounded-[3px] border border-line bg-card px-2 text-sm text-ink outline-none')}
        </div>
        <button type="button" aria-label="Impostazioni" data-tour="settings" onClick={() => setDialog({ kind: 'settings' })} className="inline-flex h-10 w-10 items-center justify-center text-ink-soft">
          <Settings className="h-5 w-5" />
        </button>
      </header>

      {status === 'conflict' && (
        <div className="flex flex-wrap items-center gap-3 bg-cue px-4 py-3 text-sm text-card lg:px-10">
          <span className="flex-1">I dati sono stati modificati da un altro dispositivo. Ricarica per vedere la versione aggiornata: le ultime modifiche fatte qui andranno perse.</span>
          <Button variant="secondary" onClick={reload}>Ricarica</Button>
        </div>
      )}

      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
        {tab === 'DASHBOARD' && (
          <Dashboard production={production} people={people} templatesCount={data.templates.length}
            onOpenPeople={() => setTab('PEOPLE')} onOpenPending={() => setTab('REQUESTS')} onOpenTemplates={() => setTab('TEMPLATES')}
            onImportDocument={() => documentInput.current?.click()}
            onAdd={() => setDialog({ kind: 'person' })} onSolicit={sendWhatsApp}
            formReady={formsEnabled} />
        )}
        {(tab === 'PEOPLE' || tab === 'REQUESTS') && (
          <PeopleList key={tab} mode={tab === 'PEOPLE' ? 'all' : 'pending'} people={people}
            onEdit={person => setDialog({ kind: 'person', person })} onAdd={() => setDialog({ kind: 'person' })}
            onDelete={person => setDialog({ kind: 'delete-person', person })} onWhatsApp={sendWhatsApp}
            onImportDocument={() => documentInput.current?.click()}
            importing={busy.document} onSendAll={startQueue} />
        )}
        {tab === 'SIGNED' && (
          <Responses people={delivered}
            onGeneratePdf={person => setDialog({ kind: 'pdf', person })}
            onOpenFile={openSubmissionFile}
            onRefresh={formsEnabled ? () => refreshForms(true) : undefined} refreshing={refreshing} />
        )}
        {tab === 'TEMPLATES' && (
          <Templates templates={data.templates} uploading={busy.template} onUpload={() => templateInput.current?.click()}
            onOpen={openTemplate} onDelete={template => setDialog({ kind: 'delete-template', template })} />
        )}
      </main>

      {/* Navigazione telefono */}
      <nav aria-label="Sezioni" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-ink/10 bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.map(item => (
          <button key={item.id} type="button" data-tour={`nav-${item.id}`} onClick={() => setTab(item.id)} aria-current={tab === item.id ? 'page' : undefined}
            className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${tab === item.id ? 'text-ink' : 'text-ink-soft'}`}>
            {tab === item.id && <span aria-hidden className="absolute inset-x-3 top-0 h-1 bg-manila" />}
            <item.icon className="h-5 w-5" />
            {item.short}
            {item.id === 'REQUESTS' && pendingCount > 0 && (
              <span className="tabular absolute right-[18%] top-1.5 min-w-4 rounded-[3px] bg-st-solicited px-1 font-mono text-[10px] leading-4 text-card">{pendingCount}</span>
            )}
          </button>
        ))}
      </nav>

      {tourOpen && <Tour onClose={() => setTourOpen(false)} />}
      <InstallPrompt hidden={tourOpen || Boolean(queue) || dialog !== null} />

      {queue && (
        <SequenceBar queue={queue}
          onSend={person => { sendWhatsApp(person); advanceQueue(); }}
          onSkip={advanceQueue}
          onClose={() => setQueue(null)} />
      )}

      {tab === 'PEOPLE' && !queue && (
        <button type="button" aria-label="Aggiungi persona" onClick={() => setDialog({ kind: 'person' })}
          className="fixed bottom-20 right-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-[3px] bg-ink text-paper shadow-lg lg:hidden">
          <Plus className="h-6 w-6" />
        </button>
      )}

      {dialog?.kind === 'person' && (
        <PersonModal initial={dialog.person} onClose={() => setDialog(null)} onSave={draft => savePerson(draft, dialog.person)} />
      )}
      {dialog?.kind === 'production' && <ProductionModal onClose={() => setDialog(null)} onSave={createProduction} />}
      {dialog?.kind === 'settings' && (
        <SettingsModal production={production} data={data} accountEmail={email} formsEnabled={formsEnabled}
          onClose={() => setDialog(null)}
          onSave={patch => { setData(prev => ({ ...prev, productions: prev.productions.map(p => (p.id === production.id ? { ...p, ...patch } : p)) })); setDialog(null); toast('Impostazioni salvate.'); }}
          onDeleteProduction={() => setDialog({ kind: 'delete-production' })}
          onRestore={restoreBackup}
          onRestartTour={() => { setDialog(null); setTab('DASHBOARD'); setTourOpen(true); }}
          onSignOut={supabase && userId ? () => { supabase?.auth.signOut(); } : undefined} />
      )}
      {dialog?.kind === 'import' && (
        <ImportReviewModal members={dialog.members} onClose={() => setDialog(null)}
          onConfirm={members => {
            setData(prev => ({ ...prev, people: [...prev.people, ...members.map(m => ({ ...m, name: m.name.trim(), whatsapp: normalizePhone(m.whatsapp) }))] }));
            setDialog(null);
            setTab('PEOPLE');
            toast(`${members.length} persone aggiunte.`);
          }} />
      )}
      {dialog?.kind === 'pdf' && (
        <GeneratePdfModal person={dialog.person} templates={data.templates} busy={busy.pdf}
          onClose={() => setDialog(null)} onGenerate={templateId => generatePdf(dialog.person, templateId)} />
      )}
      {dialog?.kind === 'delete-person' && (
        <ConfirmModal title="Eliminare?" confirmLabel="Elimina" onClose={() => setDialog(null)}
          text={<>Stai per eliminare <strong>{dialog.person.name}</strong> e le sue risposte. Non si può annullare.</>}
          onConfirm={() => {
            setData(prev => ({ ...prev, people: prev.people.filter(p => p.id !== dialog.person.id) }));
            removeFormData(dialog.person.productionId, [dialog.person.id]);
            setDialog(null);
          }} />
      )}
      {dialog?.kind === 'delete-template' && (
        <ConfirmModal title="Eliminare?" confirmLabel="Elimina" onClose={() => setDialog(null)}
          text={<>Stai per eliminare il template <strong>{dialog.template.name}</strong> e il suo PDF. Non si può annullare.</>}
          onConfirm={() => deleteTemplate(dialog.template)} />
      )}
      {dialog?.kind === 'delete-production' && (
        <ConfirmModal title="Eliminare la produzione?" confirmLabel="Elimina produzione" onClose={() => setDialog(null)}
          text={<>Stai per eliminare <strong>{production.title}</strong> con tutte le sue {people.length} persone e risposte. Non si può annullare: se serve, esporta prima un backup dalle impostazioni.</>}
          onConfirm={deleteProduction} />
      )}
    </div>
  );
};

/** Con Supabase configurato serve l'accesso; senza, l'app lavora in locale come prima. */
// Link personale del modulo: /m/<token di 24 caratteri>, aperto senza login.
const formToken = window.location.pathname.match(/^\/m\/([A-Za-z0-9_-]{24})\/?$/)?.[1];

const App: React.FC = () => {
  if (formToken) return <PublicForm token={formToken} />;
  return <AuthenticatedApp />;
};

const AuthenticatedApp: React.FC = () => {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);

  return (
    <ToastProvider>
      {session === undefined ? (
        <div className="flex min-h-dvh items-center justify-center gap-3 text-ink-soft"><RefreshCw className="h-4 w-4 animate-spin" /> Caricamento…</div>
      ) : supabase && !session ? (
        <Login />
      ) : (
        <Workspace key={session?.user.id ?? 'local'} userId={session?.user.id ?? null} email={session?.user.email ?? null} />
      )}
    </ToastProvider>
  );
};

export default App;
