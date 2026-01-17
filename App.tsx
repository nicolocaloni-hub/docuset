
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
        submissionRequests: Array.isArray(parsed?.submissionRequests) ? parsed.submissionRequests : [],
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

  // Modal State for deletions
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'person' | 'template' | 'production', id: string, name: string } | null>(null);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState('');

  const [newProdData, setNewProdData] = useState({ title: '', notes: '', phone: '' });
  const [newMemberData, setNewMemberData] = useState({ name: '', role: '', department: '', whatsapp: '' });
  const [formLinkInput, setFormLinkInput] = useState('');

  const docxInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data]);
  useEffect(() => { 
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsProdListOpen(false);
        setIsSidebarOpen(false);
        setIsEditingTitle(false);
        setDeleteTarget(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    if (!selectedProdId) return;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/tally/status?pid=${selectedProdId}`);
        if (!res.ok) return;
        const deliveries = await res.json();

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

    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
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

  const finishEditingTitle = () => {
    if (editingTitleValue.trim() && selectedProdId) {
      setData(prev => ({
        ...prev,
        productions: prev.productions.map(p => p.id === selectedProdId ? { ...p, title: editingTitleValue.trim() } : p)
      }));
    }
    setIsEditingTitle(false);
  };

  const handleSendWhatsApp = (p?: Person) => {
    const baseUrl = activeProduction?.formLink;
    if (!baseUrl) {
      alert("Configura il link Tally nelle impostazioni della produzione.");
      setIsSettingsModalOpen(true);
      return;
    }

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

  // Replaced window.confirm with internal state trigger
  const handleDeleteProduction = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const prod = data.productions.find(p => p.id === id);
    if (!prod) return;
    setDeleteTarget({ type: 'production', id, name: prod.title });
  };

  const executeDelete = () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'person') {
      setData(prev => ({
        ...prev,
        people: prev.people.filter(p => p.id !== deleteTarget.id)
      }));
    } else if (deleteTarget.type === 'template') {
      setData(prev => ({
        ...prev,
        templates: prev.templates.filter(t => t.id !== deleteTarget.id)
      }));
    } else if (deleteTarget.type === 'production') {
      const remainingProds = data.productions.filter(p => p.id !== deleteTarget.id);
      setData(prev => ({
        ...prev,
        productions: remainingProds,
        people: prev.people.filter(p => p.productionId !== deleteTarget.id),
        notifications: prev.notifications.filter(n => n.productionId !== deleteTarget.id),
      }));
      if (selectedProdId === deleteTarget.id) {
        setSelectedProdId(remainingProds[0]?.id || null);
      }
    }

    setDeleteTarget(null);
  };

  const handleDocxSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProdId) return;

    if (file.name.toLowerCase().endsWith('.pdf')) {
      alert("PDF import non ancora supportato: carica un DOCX oppure converti il PDF in DOCX.");
      if (docxInputRef.current) docxInputRef.current.value = '';
      return;
    }

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
    if (!newProdData.title.trim()) return;
    const newProd: Production = { id: 'p-' + Date.now(), title: newProdData.title, createdAt: new Date().toISOString() };
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

  const handleDeletePerson = (id: string, e: React.UIEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const p = data.people.find(person => person.id === id);
    if (p) setDeleteTarget({ type: 'person', id, name: p.name });
  };

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const newTemplate: Template = {
        id: 't-' + Date.now(),
        name: file.name.replace('.pdf', ''),
        type: TemplateType.OTHER,
        fileUrl: reader.result as string,
        fileName: file.name,
        fileType: file.type,
        isBlank: true,
        fields: [],
        createdAt: new Date().toISOString()
      };
      setData(prev => ({ ...prev, templates: [...prev.templates, newTemplate] }));
    };
    reader.readAsDataURL(file);
    if (templateInputRef.current) templateInputRef.current.value = '';
  };

  const handleDeleteTemplate = (id: string, e: React.UIEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const t = data.templates.find(template => template.id === id);
    if (t) setDeleteTarget({ type: 'template', id, name: t.name });
  };

  if (publicToken) return <PublicForm hubToken={publicToken} onComplete={() => window.location.href = '/'} />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex overflow-hidden transition-all duration-300 font-sans">
      
      {isSidebarOpen && <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      
      <aside className={`fixed top-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/5 h-screen transition-transform lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex flex-col h-full pt-10">
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20"><FileCheck className="w-6 h-6 text-white" /></div>
            <span className="font-black text-xl tracking-tight text-slate-900 dark:text-white">DocuSet</span>
          </div>

          <div className="mb-8 px-2 relative">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Progetto Attivo</label>
            <button onClick={() => setIsProdListOpen(!isProdListOpen)} className="w-full flex items-center justify-between px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-indigo-700 transition-all">
              <span className="truncate pr-2">{activeProduction?.title || 'Seleziona...'}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            
            {isProdListOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsProdListOpen(false)} />
                <div className="mt-2 relative z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                  {data.productions.map(p => (
                    <div key={p.id} className="group relative">
                      <button 
                        onClick={() => { setSelectedProdId(p.id); setIsProdListOpen(false); }} 
                        className={`w-full px-4 py-3 text-sm text-left hover:bg-slate-50 dark:hover:bg-white/5 border-b last:border-none border-slate-50 dark:border-white/5 pr-10 ${selectedProdId === p.id ? 'text-indigo-600 font-bold' : 'text-slate-700 dark:text-slate-200'}`}
                      >
                        {p.title}
                      </button>
                      <button 
                        type="button" 
                        onClick={(e) => handleDeleteProduction(p.id, e)} 
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4 pointer-events-none" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => { setIsNewProdModalOpen(true); setIsProdListOpen(false); }} className="w-full px-4 py-3 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-left hover:bg-indigo-50 dark:hover:bg-white/10 transition-colors">+ Nuova Produzione</button>
                </div>
              </>
            )}
          </div>
          
          <nav className="flex-1 space-y-1">
            {[
              { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'PEOPLE', label: 'Cast & Crew', icon: Users },
              { id: 'REQUESTS', label: 'In Attesa', icon: Inbox },
              { id: 'TEMPLATES', label: 'Template', icon: FileText },
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
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />} {theme === 'dark' ? 'Tema Chiaro' : 'Tema Scuro'}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-y-auto custom-scrollbar lg:pl-[280px]">
        <header className="h-20 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 px-8 flex items-center justify-between sticky top-0 z-30 transition-all">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden p-2"><Menu className="w-6 h-6" /></button>
            {isEditingTitle ? (
              <input
                autoFocus
                type="text"
                value={editingTitleValue}
                onChange={(e) => setEditingTitleValue(e.target.value)}
                onBlur={finishEditingTitle}
                onKeyDown={(e) => e.key === 'Enter' && finishEditingTitle()}
                className="bg-transparent border-b-2 border-indigo-600 outline-none font-black text-lg py-1 px-2 w-full max-w-md"
              />
            ) : (
              <h1 
                onClick={() => { setIsEditingTitle(true); setEditingTitleValue(activeProduction?.title || ''); }}
                className="font-black text-lg truncate text-slate-900 dark:text-white cursor-pointer hover:text-indigo-600 transition-colors"
                title="Clicca per rinominare"
              >
                {activeProduction?.title || 'Seleziona Progetto'}
              </h1>
            )}
          </div>
        </header>

        <main className="p-8 sm:p-12 max-w-7xl mx-auto w-full">
          
          {activeTab === 'DASHBOARD' && (
            <div className="space-y-8 animate-fade-in text-center sm:text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div onClick={() => setActiveTab('PEOPLE')} className="bg-white p-8 dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 hover:shadow-2xl transition-all cursor-pointer group">
                  <div className="w-14 h-14 bg-indigo-600/10 text-indigo-600 rounded-2xl flex items-center justify-center mb-6"><Users className="w-7 h-7" /></div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cast & Crew</p>
                  <p className="text-4xl font-black mt-1 text-slate-900 dark:text-white">{prodPeople.length}</p>
                </div>
                <div onClick={() => setActiveTab('REQUESTS')} className="bg-white p-8 dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 hover:shadow-2xl transition-all cursor-pointer group relative">
                  <div className="w-14 h-14 bg-amber-600/10 text-amber-600 rounded-2xl flex items-center justify-center mb-6"><Inbox className="w-7 h-7" /></div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">In Attesa</p>
                  <p className="text-4xl font-black mt-1 text-slate-900 dark:text-white">{pendingPeople.length}</p>
                  {pendingPeople.length > 0 && <span className="absolute top-8 right-8 w-3 h-3 bg-amber-500 rounded-full animate-pulse"></span>}
                </div>
                <div onClick={() => setActiveTab('TEMPLATES')} className="bg-white p-8 dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 hover:shadow-2xl transition-all cursor-pointer group">
                  <div className="w-14 h-14 bg-emerald-600/10 text-emerald-600 rounded-2xl flex items-center justify-center mb-6"><FileText className="w-7 h-7" /></div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Template PDF</p>
                  <p className="text-4xl font-black mt-1 text-slate-900 dark:text-white">{prodTemplates.length}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'PEOPLE' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">Cast & Crew</h2>
                  <p className="text-slate-500 text-sm font-medium">Gestisci la troupe del film e raccogli i dati.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={handleSyncTally} disabled={isSyncingTally} className="px-6 py-4 bg-amber-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 shadow-xl shadow-amber-600/20 flex items-center gap-2 transition-all disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${isSyncingTally ? 'animate-spin' : ''}`} /> SINCRONIZZA
                  </button>
                  <button onClick={() => setIsRecipientModalOpen(true)} className="px-6 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 flex items-center gap-2 transition-all">
                    <Send className="w-4 h-4" /> INVIA MODULO
                  </button>
                  <button onClick={() => docxInputRef.current?.click()} className="px-6 py-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-2 transition-all">
                    <FileCode className="w-4 h-4" /> IMPORTA DOCX/PDF
                  </button>
                  <button onClick={() => setIsNewMemberModalOpen(true)} className="px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 flex items-center gap-2 transition-all">
                    <UserPlus className="w-4 h-4" /> Nuovo Membro
                  </button>
                  <input type="file" ref={docxInputRef} accept=".docx,.pdf" onChange={handleDocxSelection} className="hidden" />
                </div>
              </div>

              <div className="space-y-3">
                {prodPeople.map(p => (
                  <div key={p.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex items-center justify-between gap-4 hover:border-indigo-500/30 transition-all">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-black text-sm truncate text-slate-900 dark:text-white">{p.name}</h4>
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded text-[9px] font-black uppercase text-slate-500">{p.role}</span>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{p.whatsapp}</p>
                        {p.deliveredAt ? (
                          <span className="flex items-center gap-1 text-[9px] text-emerald-500 font-black uppercase"><CheckCircle className="w-3 h-3" /> Consegnato</span>
                        ) : (
                          <span className="flex items-center gap-1 text-[9px] text-amber-500 font-black uppercase"><Clock className="w-3 h-3" /> In Attesa</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!p.deliveredAt && (
                        <button type="button" onClick={() => handleSendWhatsApp(p)} className="p-2.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl transition-colors"><Send className="w-5 h-5 pointer-events-none" /></button>
                      )}
                      <button type="button" onClick={(e) => handleDeletePerson(p.id, e)} className="relative z-10 p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors">
                        <Trash2 className="w-5 h-5 pointer-events-none" />
                      </button>
                    </div>
                  </div>
                ))}
                {prodPeople.length === 0 && (
                  <div className="bg-white dark:bg-slate-900 py-16 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-white/5 text-center">
                    <Users className="w-12 h-12 text-slate-200 dark:text-white/10 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium italic">Nessun membro trovato. Aggiungine uno nuovo.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'REQUESTS' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">In Attesa</h2>
                  <p className="text-slate-500 text-sm font-medium">Membri che non hanno ancora completato il form Tally.</p>
                </div>
              </div>

              <div className="space-y-3">
                {pendingPeople.map(p => (
                  <div key={p.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-sm truncate text-slate-900 dark:text-white">{p.name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{p.role}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => handleSendWhatsApp(p)} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2">
                        <Send className="w-3.5 h-3.5 pointer-events-none" /> Sollecita
                      </button>
                    </div>
                  </div>
                ))}
                {pendingPeople.length === 0 && (
                  <div className="bg-white dark:bg-slate-900 py-16 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-white/5 text-center">
                    <CheckCircle className="w-12 h-12 text-emerald-500/20 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium italic">Tutti i membri hanno consegnato il form!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'TEMPLATES' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">Libreria Template</h2>
                  <p className="text-slate-500 text-sm font-medium">Gestisci i modelli di documento PDF per la produzione.</p>
                </div>
                <div className="flex gap-3">
                  <input type="file" ref={templateInputRef} accept=".pdf" onChange={handleTemplateUpload} className="hidden" />
                  <button type="button" onClick={() => templateInputRef.current?.click()} className="px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 flex items-center gap-2 transition-all">
                    <FilePlus className="w-4 h-4 pointer-events-none" /> Importa Template PDF
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {data.templates.map(t => (
                  <div key={t.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex items-center justify-between gap-4 hover:border-indigo-500/30 transition-all">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="p-3 bg-slate-100 dark:bg-white/5 rounded-xl text-slate-400">
                        <FileIcon className="w-5 h-5 pointer-events-none" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-sm truncate text-slate-900 dark:text-white">{t.name}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[9px] font-black uppercase text-indigo-500 tracking-wider">{t.type}</span>
                          <span className="text-[9px] text-slate-400 font-bold">{new Date(t.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <a href={t.fileUrl} target="_blank" rel="noreferrer" className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all">
                        <Eye className="w-5 h-5 pointer-events-none" />
                      </a>
                      <button type="button" onClick={(e) => handleDeleteTemplate(t.id, e)} className="relative z-10 p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all">
                        <Trash2 className="w-5 h-5 pointer-events-none" />
                      </button>
                    </div>
                  </div>
                ))}
                {data.templates.length === 0 && (
                  <div className="bg-white dark:bg-slate-900 py-16 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-white/5 text-center">
                    <FileText className="w-12 h-12 text-slate-200 dark:text-white/10 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium italic">Nessun template in libreria. Carica un file PDF per iniziare.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Internal Confirmation Modal for Deletions */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-white/10 animate-fade-in">
            <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black mb-2 text-center text-slate-900 dark:text-white uppercase tracking-tight">
              Eliminare?
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm text-center mb-8 font-medium">
              Stai per eliminare <strong>{deleteTarget.name}</strong>. Questa azione non può essere annullata.
            </p>
            <div className="flex gap-4">
              <button 
                type="button" 
                onClick={() => setDeleteTarget(null)} 
                className="flex-1 py-4 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest"
              >
                Annulla
              </button>
              <button 
                type="button" 
                onClick={executeDelete} 
                className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-red-600/20"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl border border-white/10">
            <h3 className="text-2xl font-black mb-6 text-slate-900 dark:text-white">Impostazioni Form Tally</h3>
            <p className="text-slate-500 text-sm mb-6 font-medium">Inserisci l'URL del form Tally. Verranno aggiunti automaticamente i parametri pid e mid.</p>
            <div className="space-y-4">
              <input value={formLinkInput} onChange={e => setFormLinkInput(e.target.value)} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 font-bold outline-none text-slate-900 dark:text-white" placeholder="https://tally.so/r/XXXXXX" />
              <div className="flex gap-4">
                <button type="button" onClick={() => setIsSettingsModalOpen(false)} className="flex-1 py-4 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 rounded-2xl font-bold">Annulla</button>
                <button type="button" onClick={handleSaveSettings} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg">Salva</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isRecipientModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl border border-white/10">
            <h3 className="text-2xl font-black mb-6 text-slate-900 dark:text-white">Invia Modulo</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-2">
              {pendingPeople.map(p => (
                <button key={p.id} type="button" onClick={() => handleSendWhatsApp(p)} className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl hover:border-emerald-500 transition-all">
                  <div className="text-left"><p className="font-bold text-slate-900 dark:text-white">{p.name}</p><p className="text-[10px] uppercase text-slate-400 font-black">{p.role}</p></div>
                  <Send className="w-4 h-4 text-emerald-600 pointer-events-none" />
                </button>
              ))}
              {pendingPeople.length === 0 && <p className="text-center py-10 text-slate-400 font-medium italic">Nessun membro in attesa.</p>}
            </div>
            <button type="button" onClick={() => setIsRecipientModalOpen(false)} className="w-full mt-6 py-4 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 rounded-2xl font-bold uppercase text-[10px] tracking-widest font-black">Chiudi</button>
          </div>
        </div>
      )}

      {isNewProdModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl border border-white/10">
            <h3 className="text-2xl font-black mb-8 text-slate-900 dark:text-white">Nuova Produzione</h3>
            <div className="space-y-4">
              <input value={newProdData.title} onChange={e => setNewProdData({...newProdData, title: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 outline-none font-bold text-slate-900 dark:text-white" placeholder="Titolo Progetto" />
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsNewProdModalOpen(false)} className="flex-1 py-4 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest">Annulla</button>
                <button type="button" onClick={handleCreateProduction} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">Crea Progetto</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isNewMemberModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl border border-white/10">
            <h3 className="text-2xl font-black mb-8 text-slate-900 dark:text-white">Aggiungi Membro</h3>
            <div className="space-y-4">
              <input value={newMemberData.name} onChange={e => setNewMemberData({...newMemberData, name: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 outline-none font-bold text-slate-900 dark:text-white" placeholder="Nome Completo" />
              <input value={newMemberData.whatsapp} onChange={e => setNewMemberData({...newMemberData, whatsapp: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 outline-none font-bold text-slate-900 dark:text-white" placeholder="WhatsApp (es: 39333...)" />
              <input value={newMemberData.role} onChange={e => setNewMemberData({...newMemberData, role: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 outline-none font-bold text-slate-900 dark:text-white" placeholder="Ruolo" />
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsNewMemberModalOpen(false)} className="flex-1 py-4 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest">Annulla</button>
                <button type="button" onClick={handleAddMember} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">Aggiungi</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isDocxPreviewModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl border border-white/10">
            <h3 className="text-2xl font-black mb-4 text-slate-900 dark:text-white">Preview DOCX</h3>
            <p className="mb-6 text-sm text-slate-500">Trovati {docxParsedData.members.length} nuovi membri.</p>
            <div className="max-h-60 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-white/10 rounded-2xl p-4 mb-6">
              {docxParsedData.members.map((m, i) => (
                <div key={i} className="py-2 border-b last:border-none border-slate-100 dark:border-white/5 flex justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">{m.name}</span>
                  <span className="uppercase text-slate-400 font-black">{m.role}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setIsDocxPreviewModalOpen(false)} className="flex-1 py-4 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest">Annulla</button>
              <button type="button" onClick={handleConfirmDocxImport} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">Importa Tutti</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
