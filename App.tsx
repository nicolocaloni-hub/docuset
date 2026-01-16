
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileCheck, LayoutDashboard, Clapperboard, Users, FileText, Settings, 
  Plus, Search, MoreVertical, Send, MessageSquare, Download, Trash2, 
  CheckCircle, Clock, AlertCircle, ChevronRight, Filter, 
  ChevronDown, X, Check, LogOut, Bell, Menu, Loader, ShieldCheck, 
  ArrowRight, Archive, Inbox, ChevronUp, BellOff, Eye, Search as SearchIcon,
  FileIcon, FileUp, Info, Moon, Sun, Copy, ClipboardCheck, Phone, Layout,
  Share2, ArrowLeft, ExternalLink, Edit2, AlertTriangle, FileSpreadsheet,
  MousePointer2, History, Shield, FileQuestion, Mail, StickyNote, UserMinus,
  RefreshCw, CheckCheck, UserPlus, Link, FilePlus, Database, HardDrive, 
  Activity, Terminal, RotateCcw, QrCode, Upload, FileCode
} from 'lucide-react';
import { 
  DocStatus, TemplateType, AppState, Production, Person, Template, 
  DocumentInstance, AppNotification, FieldMapping, FormState, Submission, SubmissionRequest
} from './types';
import SignatureCanvasComponent from './components/SignatureCanvas';
import PublicForm from './components/PublicForm';
import ExternalSubmitForm from './components/ExternalSubmitForm';
// @ts-ignore
import mammoth from 'mammoth';

declare const PDFLib: any;

const STORAGE_KEY = 'setdocs_app_data_v4';
const THEME_KEY = 'setdocs_theme';

const INITIAL_DATA: AppState = {
  productions: [
    { id: 'p1', title: 'Il Grande Set', notes: 'Cortometraggio d\'esordio', createdAt: new Date().toISOString(), producerPhone: '393330000000' }
  ],
  people: [
    { id: 'per1', productionId: 'p1', name: 'Marco Gialli', role: 'DOP', department: 'Camera', whatsapp: '393330000000', hubToken: crypto.randomUUID() }
  ],
  templates: [
    { 
      id: 't1', name: 'Liberatoria Cast', type: TemplateType.RELEASE, 
      isBlank: true, createdAt: '2024-05-01', fileUrl: 'https://pdf-lib.js.org/assets/with_update_sections.pdf', fileName: 'liberatoria.pdf', fileType: 'application/pdf',
      fields: [
        { id: 'name', label: 'Nome e Cognome', type: 'text', x: 0, y: 0, xPct: 0.16, yPct: 0.12, page: 0, fontSize: 12 },
        { id: 'date', label: 'Data', type: 'text', x: 0, y: 0, xPct: 0.16, yPct: 0.15, page: 0, fontSize: 10 },
        { id: 'sig', label: 'Firma', type: 'signature', x: 0, y: 0, xPct: 0.16, yPct: 0.6, page: 0, wPct: 0.2, hPct: 0.05 }
      ]
    }
  ],
  instances: [],
  notifications: [],
  submissionRequests: [],
  submissions: []
};

const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      return (saved as any) || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } catch (e) { return 'dark'; }
  });

  const [data, setData] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return INITIAL_DATA;
      const parsed = JSON.parse(saved);
      return {
        productions: Array.isArray(parsed?.productions) ? parsed.productions : INITIAL_DATA.productions,
        people: Array.isArray(parsed?.people) ? parsed.people : INITIAL_DATA.people,
        templates: Array.isArray(parsed?.templates) ? parsed.templates : INITIAL_DATA.templates,
        instances: Array.isArray(parsed?.instances) ? parsed.instances : INITIAL_DATA.instances,
        notifications: Array.isArray(parsed?.notifications) ? parsed.notifications : INITIAL_DATA.notifications,
        submissions: Array.isArray(parsed?.submissions) ? parsed.submissions : INITIAL_DATA.submissions,
      };
    } catch (e) { return INITIAL_DATA; }
  });

  const path = window.location.pathname;
  const signMatch = path.match(/^\/sign\/([^/]+)$/);
  const publicToken = signMatch ? signMatch[1] : null;

  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'PRODUCTIONS' | 'PEOPLE' | 'TEMPLATES' | 'ARCHIVE' | 'PENDING' | 'REQUESTS'>('DASHBOARD');
  const [selectedProdId, setSelectedProdId] = useState<string | null>(data.productions[0]?.id || null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isNewProdModalOpen, setIsNewProdModalOpen] = useState(false);
  const [isNewMemberModalOpen, setIsNewMemberModalOpen] = useState(false);
  const [isRecipientModalOpen, setIsRecipientModalOpen] = useState(false);
  const [isProdListOpen, setIsProdListOpen] = useState(false);
  const [isDocxPreviewModalOpen, setIsDocxPreviewModalOpen] = useState(false);
  const [docxParsedData, setDocxParsedData] = useState<{ members: any[], duplicates: number }>({ members: [], duplicates: 0 });
  const [isSyncingTally, setIsSyncingTally] = useState(false);

  const [newProdData, setNewProdData] = useState({ title: '', notes: '', phone: '' });
  const [newMemberData, setNewMemberData] = useState({ name: '', role: '', department: '', whatsapp: '' });
  const [formLinkInput, setFormLinkInput] = useState('');

  const docxInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data]);
  useEffect(() => { 
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Polling per lo stato delle sottomissioni Tally ogni 60 secondi
  useEffect(() => {
    if (!selectedProdId) return;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/tally/status?pid=${selectedProdId}`);
        if (!res.ok) return;
        const deliveries = await res.json(); // Array di { mid, deliveredAt }

        if (Array.isArray(deliveries) && deliveries.length > 0) {
          setData(prev => ({
            ...prev,
            people: prev.people.map(p => {
              if (p.productionId === selectedProdId) {
                const delivery = deliveries.find(d => d.mid === p.id);
                if (delivery && !p.deliveredAt) {
                  return { ...p, deliveredAt: delivery.deliveredAt };
                }
              }
              return p;
            })
          }));
        }
      } catch (e) {
        console.error('Polling Tally Status Error:', e);
      }
    };

    fetchStatus(); // Esegui subito al mount o cambio produzione
    const interval = setInterval(fetchStatus, 60000); // 60 secondi
    return () => clearInterval(interval);
  }, [selectedProdId]);

  const activeProduction = useMemo(() => data.productions.find(p => p.id === selectedProdId), [selectedProdId, data.productions]);
  const prodPeople = useMemo(() => data.people.filter(p => p.productionId === selectedProdId && !p.removedAt), [selectedProdId, data.people]);
  const pendingPeople = useMemo(() => prodPeople.filter(p => !p.deliveredAt), [prodPeople]);
  const prodTemplates = useMemo(() => data.templates, [data.templates]);

  useEffect(() => {
    if (activeProduction) setFormLinkInput(activeProduction.formLink || '');
  }, [activeProduction]);

  const handleSaveSettings = () => {
    if (!selectedProdId) return;
    setData(prev => ({
      ...prev,
      productions: prev.productions.map(p => p.id === selectedProdId ? { ...p, formLink: formLinkInput } : p)
    }));
    setIsSettingsModalOpen(false);
  };

  const handleSendWhatsApp = (p?: Person) => {
    const baseUrl = activeProduction?.formLink;
    if (!baseUrl) {
      alert("Configura il link Tally nelle impostazioni della produzione.");
      setIsSettingsModalOpen(true);
      return;
    }

    // Costruisci il link con hidden fields se abbiamo un destinatario specifico
    let finalLink = baseUrl;
    if (p) {
      const separator = baseUrl.includes('?') ? '&' : '?';
      finalLink += `${separator}pid=${selectedProdId}&mid=${p.id}`;
    }

    const message = `Ciao! Compila questi dati per la produzione ${activeProduction?.title}: ${finalLink}`;
    const phone = p ? p.whatsapp.replace(/[^\d+]/g, '') : '';
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    setIsRecipientModalOpen(false);
  };

  const handleSyncTally = async () => {
    if (!selectedProdId) return;
    setIsSyncingTally(true);
    try {
      const res = await fetch(`/api/tally/status?pid=${selectedProdId}`);
      if (!res.ok) throw new Error("Errore durante la sincronizzazione manuale");
      
      const deliveries = await res.json();
      
      setData(prev => ({
        ...prev,
        people: prev.people.map(p => {
          if (p.productionId === selectedProdId) {
            const delivery = deliveries.find((d: any) => d.mid === p.id);
            if (delivery) return { ...p, deliveredAt: delivery.deliveredAt };
          }
          return p;
        })
      }));

      alert(`Sincronizzazione completata.`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSyncingTally(false);
    }
  };

  // Logica DOCX Import
  const handleDocxSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProdId) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const table = doc.querySelector('table');
      if (!table) { alert("Nessuna tabella trovata."); return; }
      const rows = Array.from(table.querySelectorAll('tr'));
      let headerIdx = -1;
      let colMap: Record<string, number> = {};
      for (let i = 0; i < Math.min(rows.length, 5); i++) {
        const cells = Array.from(rows[i].querySelectorAll('td')).map(td => td.textContent?.trim().toUpperCase() || '');
        if (cells.includes('REPARTI') && cells.includes('NOME') && cells.includes('RUOLO')) {
          headerIdx = i;
          cells.forEach((cell, idx) => {
            if (cell.includes('REPARTI')) colMap['REPARTI'] = idx;
            if (cell.includes('NOME')) colMap['NOME'] = idx;
            if (cell.includes('RUOLO')) colMap['RUOLO'] = idx;
            if (cell.includes('NUMERO')) colMap['NUMERO'] = idx;
          });
          break;
        }
      }
      if (headerIdx === -1) { alert("Header non trovato."); return; }
      const members: any[] = [];
      let duplicatesCount = 0;
      let currentDept = 'Generale';
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const cells = Array.from(rows[i].querySelectorAll('td')).map(td => td.textContent?.trim() || '');
        const nome = cells[colMap['NOME']] || '';
        const ruolo = cells[colMap['RUOLO']] || '';
        const numero = cells[colMap['NUMERO']] || '';
        const reparti = cells[colMap['REPARTI']] || '';
        if (reparti && !nome && !ruolo && !numero) { currentDept = reparti; continue; }
        if (!nome) continue;
        const cleanPhone = numero.replace(/[^\d+]/g, '');
        const isDuplicate = data.people.some(p => p.productionId === selectedProdId && !p.removedAt && p.name.toLowerCase() === nome.toLowerCase());
        if (isDuplicate) { duplicatesCount++; continue; }
        members.push({
          id: 'per-' + Math.random().toString(36).substr(2, 9),
          productionId: selectedProdId,
          name: nome,
          role: ruolo,
          department: currentDept,
          whatsapp: cleanPhone,
          hubToken: crypto.randomUUID()
        });
      }
      setDocxParsedData({ members, duplicates: duplicatesCount });
      setIsDocxPreviewModalOpen(true);
    } catch (err) { alert("Errore lettura file."); }
    if (docxInputRef.current) docxInputRef.current.value = '';
  };

  const handleConfirmDocxImport = () => {
    setData(prev => ({ ...prev, people: [...prev.people, ...docxParsedData.members] }));
    setIsDocxPreviewModalOpen(false);
  };

  const handleCreateProduction = () => {
    const newProd: Production = { id: 'p-' + Date.now(), title: newProdData.title, createdAt: new Date().toISOString() };
    setData(prev => ({ ...prev, productions: [...prev.productions, newProd] }));
    setSelectedProdId(newProd.id);
    setIsNewProdModalOpen(false);
  };

  const handleAddMember = () => {
    const newMember: Person = {
      id: 'per-' + Date.now(),
      productionId: selectedProdId!,
      name: newMemberData.name,
      role: newMemberData.role,
      department: newMemberData.department,
      whatsapp: newMemberData.whatsapp,
      hubToken: crypto.randomUUID()
    };
    setData(prev => ({ ...prev, people: [...prev.people, newMember] }));
    setIsNewMemberModalOpen(false);
  };

  const handleDeletePerson = (id: string) => {
    setData(prev => ({ ...prev, people: prev.people.map(p => p.id === id ? { ...p, removedAt: new Date().toISOString() } : p) }));
  };

  if (publicToken) return <PublicForm hubToken={publicToken} onComplete={() => window.location.href = '/'} />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex overflow-hidden transition-all duration-300 font-sans">
      <aside className={`fixed top-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/5 h-screen transition-transform lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex flex-col h-full pt-10">
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20"><FileCheck className="w-6 h-6 text-white" /></div>
            <span className="font-black text-xl tracking-tight">DocuSet</span>
          </div>

          <div className="mb-8 px-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Progetto Attivo</label>
            <button onClick={() => setIsProdListOpen(!isProdListOpen)} className="w-full flex items-center justify-between px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-indigo-700 transition-all">
              <span className="truncate pr-2">{activeProduction?.title || 'Seleziona...'}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {isProdListOpen && (
              <div className="mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                {data.productions.map(p => (
                  <button key={p.id} onClick={() => { setSelectedProdId(p.id); setIsProdListOpen(false); }} className="w-full px-4 py-3 text-sm text-left hover:bg-slate-50 dark:hover:bg-white/5">{p.title}</button>
                ))}
                <button onClick={() => setIsNewProdModalOpen(true)} className="w-full px-4 py-3 text-[10px] font-black text-indigo-600 uppercase tracking-widest">+ Nuova Produzione</button>
              </div>
            )}
          </div>
          
          <nav className="flex-1 space-y-1">
            {[
              { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'PEOPLE', label: 'Cast & Crew', icon: Users },
              { id: 'REQUESTS', label: 'In Attesa', icon: Inbox },
              { id: 'TEMPLATES', label: 'Template', icon: FileText },
            ].map(item => (
              <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === item.id ? 'bg-indigo-600/10 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                <item.icon className="w-5 h-5" /> {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t dark:border-white/5 space-y-2">
            <button onClick={() => setIsSettingsModalOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
              <Settings className="w-5 h-5" /> Impostazioni Form
            </button>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />} {theme === 'dark' ? 'Tema Chiaro' : 'Tema Scuro'}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-y-auto custom-scrollbar lg:pl-[280px]">
        <header className="h-20 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 px-8 flex items-center justify-between sticky top-0 z-30 transition-all">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden p-2"><Menu className="w-6 h-6" /></button>
            <h1 className="font-black text-lg truncate">{activeProduction?.title || 'Seleziona Progetto'}</h1>
          </div>
        </header>

        <main className="p-8 sm:p-12 max-w-7xl mx-auto w-full">
          
          {activeTab === 'DASHBOARD' && (
            <div className="space-y-8 animate-fade-in text-center sm:text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div onClick={() => setActiveTab('PEOPLE')} className="bg-white p-8 dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 hover:shadow-2xl transition-all cursor-pointer group">
                  <div className="w-14 h-14 bg-indigo-600/10 text-indigo-600 rounded-2xl flex items-center justify-center mb-6"><Users className="w-7 h-7" /></div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cast & Crew</p>
                  <p className="text-4xl font-black mt-1">{prodPeople.length}</p>
                </div>
                <div onClick={() => setActiveTab('REQUESTS')} className="bg-white p-8 dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 hover:shadow-2xl transition-all cursor-pointer group relative">
                  <div className="w-14 h-14 bg-amber-600/10 text-amber-600 rounded-2xl flex items-center justify-center mb-6"><Inbox className="w-7 h-7" /></div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">In Attesa</p>
                  <p className="text-4xl font-black mt-1">{pendingPeople.length}</p>
                  {pendingPeople.length > 0 && <span className="absolute top-8 right-8 w-3 h-3 bg-amber-500 rounded-full animate-pulse"></span>}
                </div>
                <div onClick={() => setActiveTab('TEMPLATES')} className="bg-white p-8 dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 hover:shadow-2xl transition-all cursor-pointer group">
                  <div className="w-14 h-14 bg-emerald-600/10 text-emerald-600 rounded-2xl flex items-center justify-center mb-6"><FileText className="w-7 h-7" /></div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Template PDF</p>
                  <p className="text-4xl font-black mt-1">{prodTemplates.length}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'PEOPLE' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h2 className="text-3xl font-black">Cast & Crew</h2>
                  <p className="text-slate-500 text-sm font-medium">Sincronizzazione automatica con Tally.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={handleSyncTally} disabled={isSyncingTally} className="px-6 py-4 bg-amber-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 shadow-xl shadow-amber-600/20 flex items-center gap-2 transition-all disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${isSyncingTally ? 'animate-spin' : ''}`} /> SINCRONIZZA
                  </button>
                  <button onClick={() => setIsRecipientModalOpen(true)} className="px-6 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 flex items-center gap-2 transition-all">
                    <Send className="w-4 h-4" /> INVIA MODULO
                  </button>
                  <button onClick={() => docxInputRef.current?.click()} className="px-6 py-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-2 transition-all">
                    <FileCode className="w-4 h-4" /> IMPORTA DOCX
                  </button>
                  <input type="file" ref={docxInputRef} accept=".docx" onChange={handleDocxSelection} className="hidden" />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 dark:bg-white/[0.02] text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-white/10 text-slate-400">
                    <tr><th className="px-8 py-5">Soggetto</th><th className="px-8 py-5">Ruolo</th><th className="px-8 py-5">Stato</th><th className="px-8 py-5 text-right">Azioni</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {prodPeople.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-all">
                        <td className="px-8 py-6">
                          <p className="font-black text-sm">{p.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{p.whatsapp}</p>
                        </td>
                        <td className="px-8 py-6"><span className="px-3 py-1 bg-slate-100 dark:bg-white/5 rounded-lg text-xs font-bold uppercase">{p.role}</span></td>
                        <td className="px-8 py-6">
                          {p.deliveredAt ? (
                            <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase">
                              <CheckCircle className="w-4 h-4" /> Consegnato
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase">
                              <Clock className="w-4 h-4" /> In Attesa
                            </div>
                          )}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!p.deliveredAt && (
                              <button onClick={() => handleSendWhatsApp(p)} className="p-2.5 text-emerald-500 hover:bg-emerald-500/10 rounded-lg"><Send className="w-5 h-5" /></button>
                            )}
                            <button onClick={() => handleDeletePerson(p.id)} className="p-2.5 text-slate-400 hover:text-red-600 rounded-lg"><Trash2 className="w-5 h-5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'REQUESTS' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h2 className="text-3xl font-black">In Attesa</h2>
                  <p className="text-slate-500 text-sm font-medium">Membri che non hanno ancora completato il form Tally.</p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 dark:bg-white/[0.02] text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-white/10 text-slate-400">
                    <tr><th className="px-8 py-5">Nome</th><th className="px-8 py-5">Ruolo</th><th className="px-8 py-5 text-right">Azioni</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {pendingPeople.length === 0 ? (
                      <tr><td colSpan={3} className="px-8 py-20 text-center text-slate-400 italic">Tutti i membri hanno consegnato il form!</td></tr>
                    ) : (
                      pendingPeople.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-all">
                          <td className="px-8 py-6 font-bold">{p.name}</td>
                          <td className="px-8 py-6 uppercase text-xs font-bold text-slate-500">{p.role}</td>
                          <td className="px-8 py-6 text-right">
                            <button onClick={() => handleSendWhatsApp(p)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-lg">Sollecita</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl border border-white/10">
            <h3 className="text-2xl font-black mb-6">Impostazioni Form Tally</h3>
            <p className="text-slate-500 text-sm mb-6 font-medium">Inserisci l'URL del form Tally. Verranno aggiunti automaticamente i parametri pid e mid.</p>
            <div className="space-y-4">
              <input value={formLinkInput} onChange={e => setFormLinkInput(e.target.value)} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 rounded-2xl px-6 py-4 font-bold outline-none" placeholder="https://tally.so/r/XXXXXX" />
              <div className="flex gap-4">
                <button onClick={() => setIsSettingsModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold">Annulla</button>
                <button onClick={handleSaveSettings} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg">Salva</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isRecipientModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl border border-white/10">
            <h3 className="text-2xl font-black mb-6">Invia Modulo</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              {pendingPeople.map(p => (
                <button key={p.id} onClick={() => handleSendWhatsApp(p)} className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 border border-slate-100 rounded-2xl hover:border-emerald-500 transition-all">
                  <div className="text-left"><p className="font-bold">{p.name}</p><p className="text-[10px] uppercase">{p.role}</p></div>
                  <Send className="w-4 h-4 text-emerald-600" />
                </button>
              ))}
              {pendingPeople.length === 0 && <p className="text-center py-10 text-slate-400">Nessun membro in attesa.</p>}
            </div>
            <button onClick={() => setIsRecipientModalOpen(false)} className="w-full mt-6 py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold">Chiudi</button>
          </div>
        </div>
      )}

      {isDocxPreviewModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl border border-white/10">
            <h3 className="text-2xl font-black mb-4">Preview DOCX</h3>
            <p className="mb-6 text-sm">Trovati {docxParsedData.members.length} nuovi membri.</p>
            <div className="max-h-60 overflow-y-auto custom-scrollbar border rounded-2xl p-4 mb-6">
              {docxParsedData.members.map((m, i) => (
                <div key={i} className="py-2 border-b last:border-none flex justify-between text-xs">
                  <span className="font-bold">{m.name}</span>
                  <span className="uppercase text-slate-400">{m.role}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4">
              <button onClick={() => setIsDocxPreviewModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold">Annulla</button>
              <button onClick={handleConfirmDocxImport} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg">Importa Tutti</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
