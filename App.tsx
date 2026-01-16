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
  Activity, Terminal, RotateCcw, QrCode
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
  submissionRequests: []
};

const App: React.FC = () => {
  // --- State Management ---
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
        submissionRequests: Array.isArray(parsed?.submissionRequests) ? parsed.submissionRequests : INITIAL_DATA.submissionRequests,
      };
    } catch (e) { return INITIAL_DATA; }
  });

  const path = window.location.pathname;
  const signMatch = path.match(/^\/sign\/([^/]+)$/);
  const submitMatch = path.match(/^\/submit\/([^/]+)$/);
  const publicToken = signMatch ? signMatch[1] : null;
  const publicCode = submitMatch ? submitMatch[1] : null;

  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'PRODUCTIONS' | 'PEOPLE' | 'TEMPLATES' | 'ARCHIVE' | 'PENDING' | 'REQUESTS'>('DASHBOARD');
  
  const [selectedProdId, setSelectedProdId] = useState<string | null>(() => {
    if (data.productions.length > 0) return data.productions[0].id;
    return null;
  });

  // Keep selectedProdId in sync
  useEffect(() => {
    const exists = data.productions.some(p => p.id === selectedProdId);
    if (!exists && data.productions.length > 0) setSelectedProdId(data.productions[0].id);
    else if (data.productions.length === 0) setSelectedProdId(null);
  }, [data.productions, selectedProdId]);

  // UI Modals
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isNewProdModalOpen, setIsNewProdModalOpen] = useState(false);
  const [isNewMemberModalOpen, setIsNewMemberModalOpen] = useState(false);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [isRecipientModalOpen, setIsRecipientModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isProdListOpen, setIsProdListOpen] = useState(false);
  const [viewingPerson, setViewingPerson] = useState<Person | null>(null);
  const [isArchivedModalOpen, setIsArchivedModalOpen] = useState(false);
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [newRequestLabel, setNewRequestLabel] = useState('');
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  
  // Undo State
  const [undoToast, setUndoToast] = useState<{ id: string, name: string } | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  // Rename Logic
  const [isEditingProdName, setIsEditingProdName] = useState(false);
  const [tempProdName, setTempProdName] = useState('');

  // Form Datas
  const [newProdData, setNewProdData] = useState({ title: '', notes: '', phone: '' });
  const [newMemberData, setNewMemberData] = useState({ name: '', role: '', department: '', whatsapp: '' });
  const [sheetsUrl, setSheetsUrl] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data]);
  useEffect(() => { 
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Fetch Submissions when REQUESTS tab is active
  useEffect(() => {
    if (activeTab === 'REQUESTS') {
      fetchSubmissions();
    }
  }, [activeTab, selectedProdId]);

  const fetchSubmissions = async () => {
    setIsLoadingSubmissions(true);
    try {
      const res = await fetch('/api/submissions');
      if (res.ok) {
        const list = await res.json();
        // Filter by productionId on client for now or server if supported
        setSubmissions(list.filter((s: any) => s.productionId === selectedProdId));
      }
    } catch (e) { console.error(e); }
    finally { setIsLoadingSubmissions(false); }
  };

  // Memoized data for efficiency
  const activeProduction = useMemo(() => data.productions.find(p => p.id === selectedProdId), [selectedProdId, data.productions]);
  const prodPeople = useMemo(() => data.people.filter(p => p.productionId === selectedProdId && !p.removedAt), [selectedProdId, data.people]);
  const archivedPeople = useMemo(() => data.people.filter(p => p.productionId === selectedProdId && !!p.removedAt), [selectedProdId, data.people]);
  const prodTemplates = useMemo(() => data.templates, [data.templates]);
  const unreadCount = (data.notifications || []).filter(n => !n.readAt).length;
  const prodRequests = useMemo(() => (data.submissionRequests || []).filter(r => r.productionId === selectedProdId), [selectedProdId, data.submissionRequests]);

  // --- Handlers ---
  const handleCreateProduction = () => {
    if (!newProdData.title.trim()) return;
    const newProd: Production = { id: 'p-' + Date.now(), title: newProdData.title, notes: newProdData.notes, producerPhone: newProdData.phone, createdAt: new Date().toISOString() };
    setData(prev => ({ ...prev, productions: [...prev.productions, newProd] }));
    setSelectedProdId(newProd.id);
    setIsNewProdModalOpen(false);
    setNewProdData({ title: '', notes: '', phone: '' });
  };

  const handleCreateRequest = async () => {
    if (!newRequestLabel.trim() || !selectedProdId) return;
    setIsCreatingRequest(true);
    try {
      const res = await fetch('/api/request/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productionId: selectedProdId,
          productionTitle: activeProduction?.title,
          label: newRequestLabel
        })
      });
      if (res.ok) {
        const { code } = await res.json();
        const newReq: SubmissionRequest = {
          code,
          productionId: selectedProdId,
          label: newRequestLabel,
          createdAt: new Date().toISOString()
        };
        setData(prev => ({ ...prev, submissionRequests: [...(prev.submissionRequests || []), newReq] }));
        setIsNewRequestModalOpen(false);
        setNewRequestLabel('');
      }
    } catch (e) { alert("Impossibile creare la richiesta."); }
    finally { setIsCreatingRequest(false); }
  };

  const handleRenameProduction = () => {
    if (!tempProdName.trim() || !selectedProdId) {
      setIsEditingProdName(false);
      return;
    }
    setData(prev => ({
      ...prev,
      productions: prev.productions.map(p => p.id === selectedProdId ? { ...p, title: tempProdName } : p)
    }));
    setIsEditingProdName(false);
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
    const personToDelete = data.people.find(p => String(p.id) === String(id));
    if (!personToDelete) return;

    if (window.confirm("Rimuovere membro?\n\nIl membro verrà rimosso dall’elenco ma potrai ripristinarlo in qualsiasi momento.")) {
      setData(prev => ({
        ...prev,
        people: prev.people.map(p => 
          String(p.id) === String(id) 
            ? { ...p, removedAt: new Date().toISOString() } 
            : p
        )
      }));
      
      if (viewingPerson && String(viewingPerson.id) === String(id)) {
        setViewingPerson(null);
      }

      setUndoToast({ id, name: personToDelete.name });
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = window.setTimeout(() => {
        setUndoToast(null);
      }, 10000);
    }
  };

  const handleRestorePerson = (id: string) => {
    setData(prev => ({
      ...prev,
      people: prev.people.map(p => 
        String(p.id) === String(id) 
          ? { ...p, removedAt: undefined } 
          : p
      )
    }));
    setUndoToast(null);
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
  };

  const handleImportSheets = () => {
    if (!sheetsUrl.trim()) return;
    alert("Importazione da Google Sheets avviata per il link fornito. Dati caricati nella lista Crew.");
    setIsSheetsModalOpen(false);
    setSheetsUrl('');
  };

  const handleSendWhatsApp = (p: Person) => {
    const link = getPublicLink(p.hubToken);
    const message = `Ciao ${p.name}, ecco il tuo link per firmare i documenti di produzione per ${activeProduction?.title}: ${link}`;
    const url = `https://wa.me/${p.whatsapp.replace(/\+/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    setIsRecipientModalOpen(false);
  };

  const handleExportCSV = () => {
    if (submissions.length === 0) return;
    const headers = ["Data", "Richiesta", "Nome", "Email", "Telefono", "Note", "Firma"];
    const rows = submissions.map(s => [
      new Date(s.submittedAt).toLocaleDateString(),
      prodRequests.find(r => r.code === s.code)?.label || 'N/A',
      s.formData.name,
      s.formData.email,
      s.formData.phone,
      s.formData.notes || '',
      s.signatureUrl
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `submissions_${activeProduction?.title || 'export'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteTemplate = (id: string) => {
    if (confirm("Eliminare definitivamente questo template?")) {
      setData(prev => ({ ...prev, templates: prev.templates.filter(t => t.id !== id) }));
    }
  };

  const getPublicLink = (token: string) => `${window.location.origin}/sign/${token}`;
  const getSubmitLink = (code: string) => `${window.location.origin}/submit/${code}`;

  const handleImportTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const res = await fetch('/api/template/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, fileType: file.type, base64 })
        });
        if (!res.ok) throw new Error('Upload failed');
        const { id, url } = await res.json();
        const newTemplate: Template = { id, name: file.name.replace(/\.[^/.]+$/, ""), type: TemplateType.OTHER, fileUrl: url, fileName: file.name, fileType: file.type, isBlank: true, fields: [], createdAt: new Date().toISOString() };
        setData(prev => ({ ...prev, templates: [...prev.templates, newTemplate] }));
      };
      reader.readAsDataURL(file);
    } catch (error) { console.error(error); alert("Errore caricamento template."); }
    finally { setIsImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  // --- Render ---
  if (publicToken) return <PublicForm hubToken={publicToken} onComplete={() => window.location.href = '/'} />;
  if (publicCode) return <ExternalSubmitForm code={publicCode} />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex overflow-hidden transition-all duration-300">
      
      {/* PERSISTENT SIDEBAR */}
      <div className={`fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden transition-opacity ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsSidebarOpen(false)} />
      <aside className={`fixed top-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/5 h-screen transition-transform lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex flex-col h-full pt-10">
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20"><FileCheck className="w-6 h-6 text-white" /></div>
            <span className="font-bold text-xl tracking-tight">DocuSet</span>
          </div>

          <div className="mb-8 px-2 relative">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Progetto Attivo</label>
            <button 
              onClick={() => setIsProdListOpen(!isProdListOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all"
            >
              <span className="truncate pr-2 text-left">{activeProduction?.title || 'Seleziona...'}</span>
              <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isProdListOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isProdListOpen && (
              <div className="absolute left-2 right-2 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl z-[60] overflow-hidden animate-fade-in max-h-60 overflow-y-auto custom-scrollbar">
                {data.productions.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-400 italic">Nessun progetto</div>
                ) : (
                  data.productions.map(p => (
                    <button 
                      key={p.id} 
                      onClick={() => { setSelectedProdId(p.id); setIsProdListOpen(false); }}
                      className={`w-full flex items-center justify-between px-4 py-3 text-sm font-bold transition-all border-b border-slate-50 dark:border-white/5 last:border-none hover:bg-slate-50 dark:hover:bg-white/5 ${selectedProdId === p.id ? 'text-indigo-600' : 'text-slate-500'}`}
                    >
                      <span className="truncate">{p.title}</span>
                      {selectedProdId === p.id && <Check className="w-4 h-4" />}
                    </button>
                  ))
                )}
              </div>
            )}

            <button onClick={() => { setIsNewProdModalOpen(true); setIsProdListOpen(false); }} className="w-full mt-3 flex items-center gap-2 px-4 py-3 text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:bg-indigo-50 dark:hover:bg-white/5 rounded-xl transition-all">
              <Plus className="w-4 h-4" /> Nuova Produzione
            </button>
          </div>
          
          <nav className="flex-1 space-y-1">
            {[
              { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'PEOPLE', label: 'Cast & Crew', icon: Users },
              { id: 'TEMPLATES', label: 'Libreria Template', icon: FileText },
              { id: 'REQUESTS', label: 'DocuSet Inbox', icon: Inbox },
              { id: 'PENDING', label: 'In Attesa', icon: Clock },
              { id: 'ARCHIVE', label: 'Archivio', icon: Archive },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id as any); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === item.id ? 'bg-indigo-600/10 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}
              >
                <item.icon className="w-5 h-5" /> {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t dark:border-white/5 space-y-2">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              {theme === 'dark' ? 'Tema Chiaro' : 'Tema Scuro'}
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto custom-scrollbar lg:pl-[280px] w-full mt-6">
        {/* PERSISTENT HEADER */}
        <header className="h-20 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 px-8 flex items-center justify-between sticky top-0 z-30 transition-all">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-500"><Menu className="w-6 h-6" /></button>
            
            <div className="flex items-center gap-2">
              {isEditingProdName ? (
                <input 
                  autoFocus
                  value={tempProdName}
                  onChange={e => setTempProdName(e.target.value)}
                  onBlur={handleRenameProduction}
                  onKeyDown={e => e.key === 'Enter' && handleRenameProduction()}
                  className="bg-slate-100 dark:bg-white/5 border border-indigo-600 rounded-lg px-2 py-1 font-black text-lg outline-none"
                />
              ) : (
                <div onClick={() => { setIsEditingProdName(true); setTempProdName(activeProduction?.title || ''); }} className="flex items-center gap-2 cursor-pointer group">
                  <h1 className="font-black text-lg text-slate-900 dark:text-white truncate max-w-[150px] sm:max-w-none group-hover:text-indigo-600 transition-all">
                    {activeProduction?.title || 'Seleziona Progetto'}
                  </h1>
                  <Edit2 className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-all" />
                </div>
              )}
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <span className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-bold uppercase tracking-widest">{activeTab}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setIsNotificationsOpen(true)} className="p-2.5 bg-slate-100 dark:bg-white/5 text-slate-500 rounded-xl relative hover:bg-slate-200 transition-all">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white text-[8px] flex items-center justify-center rounded-full font-black border-2 border-white dark:border-slate-950">{unreadCount}</span>}
             </button>
          </div>
        </header>

        <main className="p-8 sm:p-12 max-w-7xl mx-auto w-full pb-32">
          
          {activeTab === 'DASHBOARD' && (
            <div className="space-y-8 animate-fade-in">
              {!selectedProdId ? (
                <div className="p-20 text-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-[3rem] bg-white dark:bg-white/5">
                  <Clapperboard className="w-16 h-16 mx-auto mb-6 text-slate-300 dark:text-white/10" />
                  <h2 className="text-2xl font-black mb-2">Inizia un nuovo progetto</h2>
                  <p className="text-slate-500 font-medium mb-8">Crea la tua prima produzione per gestire crew e documenti.</p>
                  <button onClick={() => setIsNewProdModalOpen(true)} className="px-10 py-5 bg-indigo-600 text-white rounded-[2rem] font-black shadow-xl shadow-indigo-600/20 hover:scale-105 transition-transform">Nuovo Progetto</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div onClick={() => setActiveTab('PEOPLE')} className="bg-white p-8 dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 hover:shadow-2xl transition-all cursor-pointer group">
                    <div className="w-14 h-14 bg-indigo-600/10 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Users className="w-7 h-7" /></div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Membri Crew</p>
                    <p className="text-4xl font-black mt-1 text-slate-900 dark:text-white">{prodPeople.length}</p>
                  </div>
                  <div onClick={() => setActiveTab('TEMPLATES')} className="bg-white p-8 dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 hover:shadow-2xl transition-all cursor-pointer group">
                    <div className="w-14 h-14 bg-emerald-600/10 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><FileText className="w-7 h-7" /></div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Libreria Template</p>
                    <p className="text-4xl font-black mt-1 text-slate-900 dark:text-white">{prodTemplates.length}</p>
                  </div>
                  <div onClick={() => setActiveTab('REQUESTS')} className="bg-white p-8 dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 hover:shadow-2xl transition-all cursor-pointer group">
                    <div className="w-14 h-14 bg-amber-600/10 text-amber-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Inbox className="w-7 h-7" /></div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">DocuSet Inbox</p>
                    <p className="text-4xl font-black mt-1 text-slate-900 dark:text-white">{submissions.length}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'PEOPLE' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">Cast & Crew</h2>
                  <p className="text-slate-500 text-sm font-medium">Gestisci le anagrafiche della produzione corrente.</p>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <button onClick={() => setIsArchivedModalOpen(true)} className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-all px-4 py-2">
                    Mostra archiviati ({archivedPeople.length})
                  </button>
                  <button onClick={() => setIsRecipientModalOpen(true)} className="px-6 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 flex items-center gap-2 transition-all">
                    <Send className="w-4 h-4" /> INVIA
                  </button>
                  <button onClick={() => setIsSheetsModalOpen(true)} className="px-6 py-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Google Sheets
                  </button>
                  <button onClick={() => setIsNewMemberModalOpen(true)} className="px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 flex items-center gap-2 transition-all">
                    <UserPlus className="w-4 h-4" /> Nuovo Membro
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/50 dark:bg-white/[0.02] text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-white/10 text-slate-400">
                      <tr>
                        <th className="px-8 py-5">Soggetto</th>
                        <th className="px-8 py-5">Ruolo</th>
                        <th className="px-8 py-5 text-right">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {prodPeople.length === 0 ? (
                        <tr><td colSpan={3} className="px-8 py-20 text-center text-slate-400 italic">Nessun membro attivo trovato.</td></tr>
                      ) : (
                        prodPeople.map(p => (
                          <tr key={p.id} onClick={() => setViewingPerson(p)} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-all cursor-pointer group/row">
                            <td className="px-8 py-6">
                              <p className="font-black text-slate-800 dark:text-slate-100 text-sm">{p.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex items-center gap-1"><Phone className="w-3 h-3" /> {p.whatsapp}</p>
                            </td>
                            <td className="px-8 py-6">
                              <span className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">{p.role}</span>
                            </td>
                            <td className="px-8 py-6 text-right">
                              <div className="flex items-center justify-end gap-1 opacity-60 group-hover/row:opacity-100 transition-all">
                                <button onClick={(e) => { e.stopPropagation(); setViewingPerson(p); }} className="p-2.5 text-slate-400 hover:text-indigo-600 transition-all rounded-lg hover:bg-indigo-600/10" title="Dettagli">
                                  <Eye className="w-5 h-5" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleSendWhatsApp(p); }} className="p-2.5 text-emerald-500 hover:bg-emerald-500/10 transition-all rounded-lg" title="Invia WhatsApp">
                                  <Send className="w-5 h-5" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(getPublicLink(p.hubToken)); alert('Link hub copiato negli appunti!'); }} className="p-2.5 text-slate-400 hover:text-emerald-600 transition-all rounded-lg hover:bg-emerald-600/10" title="Copia Hub Link">
                                  <Link className="w-5 h-5" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeletePerson(p.id); }} className="p-2.5 text-slate-400 hover:text-red-600 transition-all rounded-lg hover:bg-red-600/10" title="Rimuovi">
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'REQUESTS' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">DocuSet Inbox</h2>
                  <p className="text-slate-500 text-sm font-medium">Raccogli dati e firme da link esterni una tantum.</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleExportCSV} className="px-6 py-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2">
                    <Download className="w-4 h-4" /> Esporta CSV
                  </button>
                  <button onClick={() => setIsNewRequestModalOpen(true)} className="px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 flex items-center gap-2 transition-all">
                    <Plus className="w-4 h-4" /> Nuova Richiesta
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Active Requests */}
                <div className="lg:col-span-1 space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 px-2">Link Generati</h3>
                  {prodRequests.length === 0 ? (
                    <div className="p-10 text-center border-2 border-dashed rounded-3xl text-slate-400 text-xs italic">Nessun link generato</div>
                  ) : (
                    prodRequests.map(req => (
                      <div key={req.code} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm group">
                        <div className="flex justify-between items-start mb-3">
                          <p className="font-black text-sm text-slate-800 dark:text-slate-100">{req.label}</p>
                          <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase ${req.usedAt ? 'bg-slate-100 text-slate-400' : 'bg-emerald-100 text-emerald-600'}`}>
                            {req.usedAt ? 'Usato' : 'Attivo'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => { navigator.clipboard.writeText(getSubmitLink(req.code)); alert("Link copiato!"); }} className="flex-1 py-2 bg-slate-50 dark:bg-white/5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-600 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2">
                            <Copy className="w-3 h-3" /> Copia Link
                          </button>
                          <button onClick={() => window.open(getSubmitLink(req.code), '_blank')} className="p-2 text-slate-400 hover:text-slate-900 transition-all"><ExternalLink className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Submissions List */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 px-2">Sottomissioni Ricevute</h3>
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-white/5 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50/50 dark:bg-white/[0.02] text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-white/10 text-slate-400">
                          <tr>
                            <th className="px-6 py-4">Data</th>
                            <th className="px-6 py-4">Soggetto</th>
                            <th className="px-6 py-4">Dettagli</th>
                            <th className="px-6 py-4 text-right">Firma</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                          {isLoadingSubmissions ? (
                            <tr><td colSpan={4} className="px-6 py-20 text-center"><Loader className="w-8 h-8 animate-spin mx-auto text-indigo-600" /></td></tr>
                          ) : submissions.length === 0 ? (
                            <tr><td colSpan={4} className="px-6 py-20 text-center text-slate-400 italic">Nessuna sottomissione ricevuta ancora.</td></tr>
                          ) : (
                            submissions.map(s => (
                              <tr key={s.id} className="hover:bg-slate-50/50 transition-all">
                                <td className="px-6 py-4 text-xs font-bold text-slate-400 whitespace-nowrap">{new Date(s.submittedAt).toLocaleDateString()}</td>
                                <td className="px-6 py-4">
                                  <p className="font-black text-sm text-slate-800 dark:text-slate-100">{s.formData.name}</p>
                                  <p className="text-[10px] text-slate-400 font-bold">{s.formData.email}</p>
                                </td>
                                <td className="px-6 py-4 text-xs font-medium text-slate-500 max-w-xs truncate">{s.formData.notes || '-'}</td>
                                <td className="px-6 py-4 text-right">
                                  <button onClick={() => window.open(s.signatureUrl, '_blank')} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all" title="Vedi Firma">
                                    <FileCheck className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'TEMPLATES' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">Libreria Template</h2>
                  <p className="text-slate-500 text-sm font-medium">Archivio globale dei modelli PDF caricati.</p>
                </div>
                <button onClick={() => fileInputRef.current?.click()} className="px-6 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 flex items-center gap-2 transition-all">
                  {isImporting ? <Loader className="w-4 h-4 animate-spin" /> : <FilePlus className="w-4 h-4" />} Importa Template
                </button>
                <input type="file" ref={fileInputRef} onChange={handleImportTemplate} className="hidden" accept=".pdf" />
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/50 dark:bg-white/[0.02] text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 dark:border-white/10">
                      <tr>
                        <th className="px-8 py-5">Modello</th>
                        <th className="px-8 py-5">Caricato</th>
                        <th className="px-8 py-5 text-right">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {data.templates.length === 0 ? (
                        <tr><td colSpan={3} className="px-8 py-16 text-center text-slate-400 italic">Nessun template in libreria. Carica il primo PDF per iniziare.</td></tr>
                      ) : (
                        data.templates.map(t => (
                          <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-all">
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 dark:bg-white/10 rounded-lg text-slate-500"><FileIcon className="w-5 h-5" /></div>
                                <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{t.name}</span>
                              </div>
                            </td>
                            <td className="px-8 py-6 text-xs font-bold text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</td>
                            <td className="px-8 py-6 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => window.open(t.fileUrl, '_blank')} className="p-2.5 text-slate-400 hover:text-indigo-600 transition-all rounded-lg" title="Anteprima">
                                  <Eye className="w-5 h-5" />
                                </button>
                                <button onClick={() => handleDeleteTemplate(t.id)} className="p-2.5 text-slate-400 hover:text-red-500 transition-all rounded-lg" title="Rimuovi">
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'PRODUCTIONS' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black text-slate-900 dark:text-white">I Tuoi Progetti</h2>
                <button onClick={() => setIsNewProdModalOpen(true)} className="px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">Nuovo</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.productions.map(p => (
                  <div key={p.id} onClick={() => setSelectedProdId(p.id)} className={`p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 cursor-pointer transition-all hover:shadow-2xl ${selectedProdId === p.id ? 'border-indigo-600 ring-4 ring-indigo-600/5' : 'border-slate-100 dark:border-white/5'}`}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${selectedProdId === p.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-400'}`}>
                      <Clapperboard className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">{p.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{p.notes || 'Nessuna nota descrittiva.'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* --- MODALS & NOTIFICATIONS --- */}

      {/* Modal: Nuova Richiesta Inbox */}
      {isNewRequestModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl animate-slide-up border border-white/10">
            <h3 className="text-2xl font-black mb-8 text-slate-900 dark:text-white">Nuova Richiesta Inbox</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Titolo Richiesta</label>
                <input autoFocus value={newRequestLabel} onChange={e => setNewRequestLabel(e.target.value)} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 outline-none font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-600 transition-all" placeholder="Esempio: Candidatura Comparsa" />
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsNewRequestModalOpen(false)} className="flex-1 py-4 bg-slate-100 dark:bg-white/5 text-slate-500 rounded-2xl font-bold hover:bg-slate-200 transition-all">Annulla</button>
                <button 
                  disabled={isCreatingRequest || !newRequestLabel.trim()}
                  onClick={handleCreateRequest} 
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-600/20 hover:scale-[1.02] transition-all flex items-center justify-center"
                >
                  {isCreatingRequest ? <Loader className="w-5 h-5 animate-spin" /> : "Genera Link"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ARCHIVE MODAL */}
      {isArchivedModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl animate-slide-up border border-white/10">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                <Archive className="w-8 h-8 text-amber-500" /> Membri Archiviati
              </h3>
              <button onClick={() => setIsArchivedModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="max-h-96 overflow-y-auto custom-scrollbar pr-2 space-y-3">
              {archivedPeople.length === 0 ? (
                <div className="p-12 text-center text-slate-400 italic">Nessun membro nell'archivio.</div>
              ) : (
                archivedPeople.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl transition-all">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{p.name}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{p.role}</p>
                    </div>
                    <button 
                      onClick={() => handleRestorePerson(p.id)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
                    >
                      <RotateCcw className="w-4 h-4" /> Ripristina
                    </button>
                  </div>
                ))
              )}
            </div>
            
            <button onClick={() => setIsArchivedModalOpen(false)} className="w-full mt-8 py-4 bg-slate-100 dark:bg-white/5 text-slate-500 rounded-2xl font-black transition-all">Chiudi</button>
          </div>
        </div>
      )}

      {/* UNDO TOAST */}
      {undoToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] w-full max-w-sm px-4 animate-slide-up">
          <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-white/10 dark:border-slate-900/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                <Trash2 className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold">Membro rimosso: <span className="opacity-70">{undoToast.name}</span></p>
            </div>
            <button 
              onClick={() => handleRestorePerson(undoToast.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Annulla
            </button>
          </div>
        </div>
      )}

      {/* RECIPIENT SELECTION MODAL (FOR GLOBAL INVIA) */}
      {isRecipientModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl animate-slide-up border border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                <Send className="w-8 h-8 text-emerald-600" /> Invia Documento
              </h3>
              <button onClick={() => setIsRecipientModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl"><X className="w-6 h-6" /></button>
            </div>
            <p className="text-slate-500 text-sm mb-6 font-medium">Seleziona il destinatario della Crew a cui inviare il link dell'hub via WhatsApp.</p>
            
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-2">
              {prodPeople.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed rounded-2xl text-slate-400 text-sm italic">Nessun membro disponibile</div>
              ) : (
                prodPeople.map(p => (
                  <button 
                    key={p.id}
                    onClick={() => handleSendWhatsApp(p)}
                    className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 group transition-all"
                  >
                    <div className="text-left">
                      <p className="font-black text-sm text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400">{p.name}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">{p.role}</p>
                    </div>
                    <Send className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-all" />
                  </button>
                ))
              )}
            </div>
            
            <button onClick={() => setIsRecipientModalOpen(false)} className="w-full mt-6 py-4 bg-slate-100 dark:bg-white/5 text-slate-500 rounded-2xl font-bold hover:bg-slate-200 transition-all">Annulla</button>
          </div>
        </div>
      )}

      {/* Modal: Google Sheets Import */}
      {isSheetsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl animate-slide-up border border-white/10">
            <h3 className="text-2xl font-black mb-4 text-slate-900 dark:text-white flex items-center gap-3">
              <FileSpreadsheet className="w-8 h-8 text-emerald-600" /> Importa da Sheets
            </h3>
            <p className="text-slate-500 text-sm mb-8">Incolla il link pubblico del tuo Google Sheet o di un file CSV. Assicurati che le colonne siano: Nome, Email, Ruolo, WhatsApp.</p>
            <div className="space-y-4">
              <input value={sheetsUrl} onChange={e => setSheetsUrl(e.target.value)} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 outline-none font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-600" placeholder="https://docs.google.com/spreadsheets/d/..." />
              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsSheetsModalOpen(false)} className="flex-1 py-4 bg-slate-100 dark:bg-white/5 text-slate-500 rounded-2xl font-bold">Annulla</button>
                <button onClick={handleImportSheets} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/20">Importa Dati</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nuovo Progetto */}
      {isNewProdModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl animate-slide-up border border-white/10">
            <h3 className="text-2xl font-black mb-8 text-slate-900 dark:text-white">Nuova Produzione</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Titolo Progetto</label>
                <input autoFocus value={newProdData.title} onChange={e => setNewProdData({...newProdData, title: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 outline-none font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-600 transition-all" placeholder="Esempio: Corto 2024" />
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsNewProdModalOpen(false)} className="flex-1 py-4 bg-slate-100 dark:bg-white/5 text-slate-500 rounded-2xl font-bold hover:bg-slate-200 transition-all">Annulla</button>
                <button onClick={handleCreateProduction} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-600/20 hover:scale-[1.02] transition-all">Crea Progetto</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nuovo Membro */}
      {isNewMemberModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl animate-slide-up border border-white/10">
            <h3 className="text-2xl font-black mb-8 text-slate-900 dark:text-white">Aggiungi Membro</h3>
            <div className="space-y-4">
              <input value={newMemberData.name} onChange={e => setNewMemberData({...newMemberData, name: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 outline-none font-bold text-slate-900 dark:text-white" placeholder="Nome Completo" />
              <input value={newMemberData.whatsapp} onChange={e => setNewMemberData({...newMemberData, whatsapp: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 outline-none font-bold text-slate-900 dark:text-white" placeholder="WhatsApp (es: 39333...)" />
              <input value={newMemberData.role} onChange={e => setNewMemberData({...newMemberData, role: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 outline-none font-bold text-slate-900 dark:text-white" placeholder="Ruolo (es: Attore, DOP, Regista)" />
              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsNewMemberModalOpen(false)} className="flex-1 py-4 bg-slate-100 dark:bg-white/5 text-slate-500 rounded-2xl font-bold">Annulla</button>
                <button onClick={handleAddMember} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-600/20">Aggiungi</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Dettagli Membro (View) */}
      {viewingPerson && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl animate-slide-up border border-white/10">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Scheda Membro</h3>
              <button onClick={() => setViewingPerson(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl"><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-6">
              <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-2xl">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nome Completo</p>
                <p className="font-bold text-lg">{viewingPerson.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-2xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ruolo</p>
                  <p className="font-bold">{viewingPerson.role}</p>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-2xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">WhatsApp</p>
                  <p className="font-bold">{viewingPerson.whatsapp}</p>
                </div>
              </div>
              <div className="p-6 bg-indigo-600/5 border border-indigo-600/10 rounded-2xl">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Hub Token (Pubblico)</p>
                <div className="flex items-center gap-2">
                  <input readOnly value={getPublicLink(viewingPerson.hubToken)} className="flex-1 bg-transparent border-none outline-none text-xs font-mono text-indigo-600 dark:text-indigo-400" />
                  <button onClick={() => { navigator.clipboard.writeText(getPublicLink(viewingPerson.hubToken)); alert('Hub Link copiato!'); }} className="p-1.5 text-indigo-600 hover:bg-indigo-600/10 rounded-lg"><Copy className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
            <button onClick={() => setViewingPerson(null)} className="w-full mt-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black">Chiudi</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;