
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
  Activity, Terminal, RotateCcw, QrCode, Upload
} from 'lucide-react';
import { 
  DocStatus, TemplateType, AppState, Production, Person, Template, 
  DocumentInstance, AppNotification, FieldMapping, FormState, Submission, SubmissionRequest
} from './types';
import SignatureCanvasComponent from './components/SignatureCanvas';
import PublicForm from './components/PublicForm';
import ExternalSubmitForm from './components/ExternalSubmitForm';

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
  const [viewingPerson, setViewingPerson] = useState<Person | null>(null);
  const [isArchivedModalOpen, setIsArchivedModalOpen] = useState(false);

  const [newProdData, setNewProdData] = useState({ title: '', notes: '', phone: '' });
  const [newMemberData, setNewMemberData] = useState({ name: '', role: '', department: '', whatsapp: '' });
  const [formLinkInput, setFormLinkInput] = useState('');

  const csvInputRef = useRef<HTMLInputElement>(null);
  const undoTimerRef = useRef<number | null>(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data]);
  useEffect(() => { 
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const activeProduction = useMemo(() => data.productions.find(p => p.id === selectedProdId), [selectedProdId, data.productions]);
  const prodPeople = useMemo(() => data.people.filter(p => p.productionId === selectedProdId && !p.removedAt), [selectedProdId, data.people]);
  const archivedPeople = useMemo(() => data.people.filter(p => p.productionId === selectedProdId && !!p.removedAt), [selectedProdId, data.people]);
  const prodSubmissions = useMemo(() => data.submissions.filter(s => s.productionId === selectedProdId), [selectedProdId, data.submissions]);
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
    const link = activeProduction?.formLink;
    if (!link) {
      alert("Configura il link del modulo nelle impostazioni della produzione prima di inviare.");
      setIsSettingsModalOpen(true);
      return;
    }
    const message = `Ciao! Compila questi dati per la produzione ${activeProduction.title}: ${link}`;
    const phone = p ? p.whatsapp.replace(/\+/g, '') : '';
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    setIsRecipientModalOpen(false);
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProdId) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      if (lines.length < 2) return;

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const newSubmissions: Submission[] = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const row: any = {};
        headers.forEach((h, idx) => row[h] = values[idx]);

        const findValue = (keys: string[]) => {
          const key = keys.find(k => row[k] !== undefined);
          return key ? row[key] : '';
        };

        const submission: Submission = {
          id: 'sub-' + Date.now() + i,
          productionId: selectedProdId,
          submittedAt: findValue(['created_at', 'timestamp', 'data', 'date']) || new Date().toISOString(),
          name: findValue(['name', 'full_name', 'nome', 'nome e cognome', 'soggetto']),
          role: findValue(['role', 'ruolo', 'type', 'mansione']) || 'Crew',
          email: findValue(['email', 'mail', 'indirizzo email']),
          phone: findValue(['phone', 'telefono', 'whatsapp', 'cellulare']),
          notes: findValue(['notes', 'note', 'messaggio']),
          hasSignature: !!findValue(['signature', 'firma', 'signature_url']),
          signatureData: findValue(['signature', 'firma', 'signature_url', 'signature_data'])
        };

        if (submission.name) newSubmissions.push(submission);
      }

      setData(prev => ({
        ...prev,
        submissions: [...prev.submissions, ...newSubmissions]
      }));
      alert(`Importati ${newSubmissions.length} record.`);
    };
    reader.readAsText(file);
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  // Fix error: Cannot find name 'handleExportCSV'
  const handleExportCSV = () => {
    if (prodSubmissions.length === 0) {
      alert("Nessuna risposta da esportare per questo progetto.");
      return;
    }
    
    const headers = ['Data Invio', 'Nome', 'Ruolo', 'Email', 'Telefono', 'Note', 'Firma'];
    const rows = prodSubmissions.map(s => [
      new Date(s.submittedAt).toLocaleDateString('it-IT'),
      s.name,
      s.role,
      s.email,
      s.phone,
      s.notes || '',
      s.hasSignature ? 'Sì' : 'No'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `export_${activeProduction?.title.replace(/\s+/g, '_') || 'prod'}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateProduction = () => {
    if (!newProdData.title.trim()) return;
    const newProd: Production = { id: 'p-' + Date.now(), title: newProdData.title, notes: newProdData.notes, producerPhone: newProdData.phone, createdAt: new Date().toISOString() };
    setData(prev => ({ ...prev, productions: [...prev.productions, newProd] }));
    setSelectedProdId(newProd.id);
    setIsNewProdModalOpen(false);
    setNewProdData({ title: '', notes: '', phone: '' });
  };

  const handleAddMember = () => {
    if (!newMemberData.name.trim() || !selectedProdId) return;
    const newMember: Person = {
      id: 'per-' + Date.now(),
      productionId: selectedProdId,
      name: newMemberData.name,
      role: newMemberData.role || 'Crew',
      department: newMemberData.department || 'Generale',
      whatsapp: newMemberData.whatsapp,
      hubToken: crypto.randomUUID()
    };
    setData(prev => ({ ...prev, people: [...prev.people, newMember] }));
    setIsNewMemberModalOpen(false);
    setNewMemberData({ name: '', role: '', department: '', whatsapp: '' });
  };

  const handleDeletePerson = (id: string) => {
    if (window.confirm("Rimuovere membro?")) {
      setData(prev => ({
        ...prev,
        people: prev.people.map(p => p.id === id ? { ...p, removedAt: new Date().toISOString() } : p)
      }));
    }
  };

  if (publicToken) return <PublicForm hubToken={publicToken} onComplete={() => window.location.href = '/'} />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex overflow-hidden transition-all duration-300 font-sans">
      
      {/* SIDEBAR */}
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
              <ChevronDown className={`w-4 h-4 transition-transform ${isProdListOpen ? 'rotate-180' : ''}`} />
            </button>
            {isProdListOpen && (
              <div className="mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden animate-fade-in max-h-48 overflow-y-auto custom-scrollbar">
                {data.productions.map(p => (
                  <button key={p.id} onClick={() => { setSelectedProdId(p.id); setIsProdListOpen(false); }} className={`w-full flex items-center justify-between px-4 py-3 text-sm font-bold border-b border-slate-50 dark:border-white/5 last:border-none hover:bg-slate-50 dark:hover:bg-white/5 ${selectedProdId === p.id ? 'text-indigo-600' : 'text-slate-500'}`}>
                    <span className="truncate">{p.title}</span>
                    {selectedProdId === p.id && <Check className="w-4 h-4" />}
                  </button>
                ))}
                <button onClick={() => { setIsNewProdModalOpen(true); setIsProdListOpen(false); }} className="w-full flex items-center gap-2 px-4 py-3 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:bg-indigo-50 dark:hover:bg-white/5 transition-all">
                  <Plus className="w-4 h-4" /> Nuova Produzione
                </button>
              </div>
            )}
          </div>
          
          <nav className="flex-1 space-y-1">
            {[
              { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'PEOPLE', label: 'Cast & Crew', icon: Users },
              { id: 'REQUESTS', label: 'Inbox (Modulo)', icon: Inbox },
              { id: 'TEMPLATES', label: 'Template', icon: FileText },
              { id: 'ARCHIVE', label: 'Archivio', icon: Archive },
            ].map(item => (
              <button key={item.id} onClick={() => { setActiveTab(item.id as any); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === item.id ? 'bg-indigo-600/10 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                <item.icon className="w-5 h-5" /> {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t dark:border-white/5 space-y-2">
            <button onClick={() => setIsSettingsModalOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
              <Settings className="w-5 h-5" /> Impostazioni Form
            </button>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              {theme === 'dark' ? 'Tema Chiaro' : 'Tema Scuro'}
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto custom-scrollbar lg:pl-[280px]">
        <header className="h-20 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 px-8 flex items-center justify-between sticky top-0 z-30 transition-all">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-500"><Menu className="w-6 h-6" /></button>
            <h1 className="font-black text-lg text-slate-900 dark:text-white truncate">{activeProduction?.title || 'Seleziona Progetto'}</h1>
          </div>
        </header>

        <main className="p-8 sm:p-12 max-w-7xl mx-auto w-full">
          
          {activeTab === 'DASHBOARD' && (
            <div className="space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div onClick={() => setActiveTab('PEOPLE')} className="bg-white p-8 dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 hover:shadow-2xl transition-all cursor-pointer group">
                  <div className="w-14 h-14 bg-indigo-600/10 text-indigo-600 rounded-2xl flex items-center justify-center mb-6"><Users className="w-7 h-7" /></div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cast & Crew</p>
                  <p className="text-4xl font-black mt-1">{prodPeople.length}</p>
                </div>
                <div onClick={() => setActiveTab('REQUESTS')} className="bg-white p-8 dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 hover:shadow-2xl transition-all cursor-pointer group relative">
                  <div className="w-14 h-14 bg-amber-600/10 text-amber-600 rounded-2xl flex items-center justify-center mb-6"><Inbox className="w-7 h-7" /></div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Risposte Ricevute</p>
                  <p className="text-4xl font-black mt-1">{prodSubmissions.length}</p>
                  {prodSubmissions.length > 0 && <span className="absolute top-8 right-8 w-3 h-3 bg-amber-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)]"></span>}
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
                  <p className="text-slate-500 text-sm font-medium">Invia il modulo tramite WhatsApp alla tua troupe.</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setIsRecipientModalOpen(true)} className="px-6 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 flex items-center gap-2 transition-all">
                    <Send className="w-4 h-4" /> INVIA MODULO
                  </button>
                  <button onClick={() => setIsNewMemberModalOpen(true)} className="px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 flex items-center gap-2 transition-all">
                    <UserPlus className="w-4 h-4" /> Nuovo Membro
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 dark:bg-white/[0.02] text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-white/10 text-slate-400">
                    <tr><th className="px-8 py-5">Soggetto</th><th className="px-8 py-5">Ruolo</th><th className="px-8 py-5 text-right">Azioni</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {prodPeople.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-all">
                        <td className="px-8 py-6">
                          <p className="font-black text-sm">{p.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{p.whatsapp}</p>
                        </td>
                        <td className="px-8 py-6"><span className="px-3 py-1 bg-slate-100 dark:bg-white/5 rounded-lg text-xs font-bold uppercase">{p.role}</span></td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => handleSendWhatsApp(p)} className="p-2.5 text-emerald-500 hover:bg-emerald-500/10 rounded-lg"><Send className="w-5 h-5" /></button>
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
                  <h2 className="text-3xl font-black">Inbox Modulo</h2>
                  <p className="text-slate-500 text-sm font-medium">Importa i dati esportati dal tuo fornitore di moduli.</p>
                </div>
                <div className="flex gap-3">
                  <input type="file" ref={csvInputRef} accept=".csv" onChange={handleCSVImport} className="hidden" />
                  <button onClick={() => csvInputRef.current?.click()} className="px-6 py-4 bg-amber-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 shadow-xl shadow-amber-600/20 flex items-center gap-2 transition-all">
                    <Upload className="w-4 h-4" /> IMPORTA RISPOSTE (CSV)
                  </button>
                  <button onClick={handleExportCSV} className="px-6 py-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2">
                    <Download className="w-4 h-4" /> Esporta
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 dark:bg-white/[0.02] text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-white/10 text-slate-400">
                    <tr><th className="px-8 py-5">Data</th><th className="px-8 py-5">Nome</th><th className="px-8 py-5">Contatti</th><th className="px-8 py-5 text-right">Firma</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {prodSubmissions.length === 0 ? (
                      <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-400 italic font-medium">Nessuna risposta importata per questa produzione.</td></tr>
                    ) : (
                      prodSubmissions.map(s => (
                        <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-all">
                          <td className="px-8 py-6 text-xs font-bold text-slate-400">{new Date(s.submittedAt).toLocaleDateString()}</td>
                          <td className="px-8 py-6">
                            <p className="font-black text-sm">{s.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{s.role}</p>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-xs font-bold">{s.email}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{s.phone}</p>
                          </td>
                          <td className="px-8 py-6 text-right">
                            {s.hasSignature ? <CheckCircle className="w-5 h-5 text-emerald-500 ml-auto" /> : <X className="w-5 h-5 text-slate-200 dark:text-white/5 ml-auto" />}
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

      {/* MODALS */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl animate-slide-up border border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black">Impostazioni Form</h3>
              <button onClick={() => setIsSettingsModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl"><X className="w-6 h-6" /></button>
            </div>
            <p className="text-slate-500 text-sm mb-6 font-medium">Inserisci il link del modulo (Fillout, Jotform, Tally, etc.) per la produzione corrente.</p>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Link Modulo Firma</label>
                <input value={formLinkInput} onChange={e => setFormLinkInput(e.target.value)} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 outline-none font-bold focus:ring-2 focus:ring-indigo-600 transition-all" placeholder="https://fillout.com/..." />
              </div>
              <button onClick={handleSaveSettings} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all">Salva Configurazione</button>
            </div>
          </div>
        </div>
      )}

      {isRecipientModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl animate-slide-up border border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black">Invia Modulo</h3>
              <button onClick={() => setIsRecipientModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl"><X className="w-6 h-6" /></button>
            </div>
            <p className="text-slate-500 text-sm mb-6 font-medium">Scegli a chi inviare il modulo di raccolta dati via WhatsApp.</p>
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-2">
              <button onClick={() => handleSendWhatsApp()} className="w-full flex items-center justify-between p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all">
                <span className="font-black text-sm uppercase">Invia senza contatto (Copia Link)</span>
                <Link className="w-4 h-4" />
              </button>
              {prodPeople.map(p => (
                <button key={p.id} onClick={() => handleSendWhatsApp(p)} className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl hover:border-emerald-500 group transition-all">
                  <div className="text-left"><p className="font-black text-sm">{p.name}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{p.role}</p></div>
                  <Send className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-all" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reused generic modals from INITIAL_DATA structure */}
      {isNewProdModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl animate-slide-up border border-white/10">
            <h3 className="text-2xl font-black mb-8">Nuova Produzione</h3>
            <div className="space-y-4">
              <input value={newProdData.title} onChange={e => setNewProdData({...newProdData, title: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="Titolo Progetto" />
              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsNewProdModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold">Annulla</button>
                <button onClick={handleCreateProduction} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg">Crea Progetto</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isNewMemberModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl animate-slide-up border border-white/10">
            <h3 className="text-2xl font-black mb-8">Aggiungi Membro</h3>
            <div className="space-y-4">
              <input value={newMemberData.name} onChange={e => setNewMemberData({...newMemberData, name: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="Nome Completo" />
              <input value={newMemberData.whatsapp} onChange={e => setNewMemberData({...newMemberData, whatsapp: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="WhatsApp (es: 39333...)" />
              <input value={newMemberData.role} onChange={e => setNewMemberData({...newMemberData, role: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 rounded-2xl px-6 py-4 outline-none font-bold" placeholder="Ruolo" />
              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsNewMemberModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold">Annulla</button>
                <button onClick={handleAddMember} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg">Aggiungi</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
