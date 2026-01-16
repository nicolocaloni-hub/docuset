
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
  RefreshCw, CheckCheck, UserPlus, Link
} from 'lucide-react';
import { 
  DocStatus, TemplateType, AppState, Production, Person, Template, 
  DocumentInstance, AppNotification, FieldMapping, FormState
} from './types';
import SignatureCanvasComponent from './components/SignatureCanvas';
import PublicForm from './components/PublicForm';
import { createClient } from '@supabase/supabase-js';

// PDF-LIB Global (imported in index.html)
declare const PDFLib: any;

const STORAGE_KEY = 'setdocs_app_data_v4';
const THEME_KEY = 'setdocs_theme';

// Configurazione Supabase per Vite - Fixed to use process.env to avoid ImportMeta errors
// Use process.env for environment variables to match the project's standard and fix ImportMeta error
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const SignatureCanvas = ({ onSave, onClear }: { onSave: (data: string) => void; onClear: () => void }) => (
  <SignatureCanvasComponent onSave={onSave} onClear={onClear} />
);

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
  notifications: []
};

const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return (saved as any) || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });

  const [data, setData] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return INITIAL_DATA;
    try {
      return JSON.parse(saved);
    } catch (e) {
      return INITIAL_DATA;
    }
  });

  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'PRODUCTIONS' | 'PEOPLE' | 'TEMPLATES' | 'ARCHIVE' | 'PENDING'>('DASHBOARD');
  const [selectedProdId, setSelectedProdId] = useState<string | null>(() => {
    return data.productions.length > 0 ? data.productions[0].id : null;
  });
  
  // Modal States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isBulkSendOpen, setIsBulkSendOpen] = useState(false);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isNewProdModalOpen, setIsNewProdModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isProdDropdownOpen, setIsProdDropdownOpen] = useState(false);
  const [isNewMemberModalOpen, setIsNewMemberModalOpen] = useState(false);

  const [newProdData, setNewProdData] = useState({ title: '', notes: '', phone: '' });
  const [renameValue, setRenameValue] = useState('');
  const [renamePhone, setRenamePhone] = useState('');
  const [newMemberData, setNewMemberData] = useState({ name: '', role: '', department: '', whatsapp: '' });

  const [templateToDeleteId, setTemplateToDeleteId] = useState<string | null>(null);
  const [templateToMapId, setTemplateToMapId] = useState<string | null>(null);
  const [personToDeleteId, setPersonToDeleteId] = useState<string | null>(null);

  // Routing per Public View
  const queryParams = new URLSearchParams(window.location.search);
  const publicToken = queryParams.get('t');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // --- REALTIME SUBSCRIPTION ---
  useEffect(() => {
    if (!supabase || !selectedProdId) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'signing_invites',
          filter: `production_id=eq.${selectedProdId}`
        },
        (payload) => {
          if (payload.new.status === 'SIGNED') {
            handleSigningNotification(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedProdId]);

  const handleSigningNotification = (invite: any) => {
    const newNotif: AppNotification = {
      id: 'notif-' + Date.now(),
      productionId: invite.production_id,
      personId: invite.person_id,
      documentInstanceId: invite.instance_id,
      type: 'DOCUMENT_SIGNED',
      title: 'Nuovo Documento Firmato',
      message: `${invite.payload.personName} ha firmato il documento.`,
      createdAt: new Date().toISOString(),
      readAt: null
    };

    setData(prev => ({
      ...prev,
      notifications: [newNotif, ...prev.notifications],
      instances: prev.instances.map(inst => 
        inst.id === invite.instance_id ? { ...inst, status: DocStatus.SIGNED, signedAt: new Date().toISOString() } : inst
      )
    }));
  };

  const activeProduction = useMemo(() => data.productions.find(p => p.id === selectedProdId), [selectedProdId, data.productions]);
  const prodPeople = useMemo(() => data.people.filter(p => p.productionId === selectedProdId), [selectedProdId, data.people]);
  const prodInstances = useMemo(() => data.instances.filter(i => i.productionId === selectedProdId), [selectedProdId, data.instances]);
  const unreadCount = useMemo(() => data.notifications.filter(n => !n.readAt).length, [data.notifications]);

  // --- ACTIONS ---
  const handleCreateProduction = () => {
    if (!newProdData.title.trim()) return;
    const newProd: Production = {
      id: 'p-' + Date.now(),
      title: newProdData.title,
      notes: newProdData.notes,
      producerPhone: newProdData.phone,
      createdAt: new Date().toISOString()
    };
    setData(prev => ({ ...prev, productions: [...prev.productions, newProd] }));
    setSelectedProdId(newProd.id);
    setIsNewProdModalOpen(false);
    setNewProdData({ title: '', notes: '', phone: '' });
  };

  const handleUpdateProduction = () => {
    if (!renameValue.trim() || !selectedProdId) return;
    setData(prev => ({
      ...prev,
      productions: prev.productions.map(p => 
        p.id === selectedProdId ? { ...p, title: renameValue, producerPhone: renamePhone } : p
      )
    }));
    setIsRenameModalOpen(false);
  };

  const handleAddMember = () => {
    if (!newMemberData.name.trim() || !newMemberData.whatsapp.trim() || !selectedProdId) return;
    const newPerson: Person = {
      id: 'per-' + Date.now(),
      productionId: selectedProdId,
      name: newMemberData.name,
      role: newMemberData.role || 'Crew',
      department: newMemberData.department || 'General',
      whatsapp: newMemberData.whatsapp,
      hubToken: crypto.randomUUID()
    };
    setData(prev => ({ ...prev, people: [...prev.people, newPerson] }));
    setIsNewMemberModalOpen(false);
    setNewMemberData({ name: '', role: '', department: '', whatsapp: '' });
  };

  const addInstance = (personId: string, templateId: string) => {
    if (!selectedProdId) return;
    const newInst: DocumentInstance = {
      id: 'inst-' + Date.now(),
      productionId: selectedProdId,
      personId,
      templateId,
      status: DocStatus.NOT_SENT,
    };
    setData(prev => ({ ...prev, instances: [...prev.instances, newInst] }));
  };

  const deleteInstance = (id: string) => {
    setData(prev => ({ ...prev, instances: prev.instances.filter(i => i.id !== id) }));
  };

  const getPublicLink = (token: string) => {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?t=${token}`;
  };

  const confirmDeleteTemplate = () => {
    if (!templateToDeleteId) return;
    setData(prev => ({ ...prev, templates: prev.templates.filter(t => t.id !== templateToDeleteId) }));
    setTemplateToDeleteId(null);
  };

  const confirmDeletePerson = () => {
    if (!personToDeleteId) return;
    setData(prev => ({ 
      ...prev, 
      people: prev.people.filter(p => p.id !== personToDeleteId),
      instances: prev.instances.filter(i => i.personId !== personToDeleteId)
    }));
    setPersonToDeleteId(null);
  };

  const Header = () => (
    <header className="h-20 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 transition-all">
      <div className="flex items-center gap-4">
        <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-500 dark:text-slate-400">
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => { 
            setRenameValue(activeProduction?.title || ''); 
            setRenamePhone(activeProduction?.producerPhone || ''); 
            setIsRenameModalOpen(true); 
          }}>
            <h1 className="text-sm sm:text-lg font-bold text-slate-900 dark:text-white truncate max-w-[150px] sm:max-w-none">
              {activeProduction?.title || 'Seleziona Progetto'}
            </h1>
            <Edit2 className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <span className="text-slate-500 text-xs sm:text-sm capitalize font-medium">{activeTab.toLowerCase().replace('_', ' ')}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {!supabase && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-100">
            <AlertCircle className="w-3.5 h-3.5" />
            Configurazione Errata (VITE_SUPABASE_...)
          </div>
        )}
        <button 
          onClick={() => setIsNotificationsOpen(true)}
          className="p-2.5 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 rounded-xl relative hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
        >
          <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'animate-[wiggle_1s_ease-in-out_infinite]' : ''}`} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-slate-950 shadow-lg">
              {unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );

  const Sidebar = () => (
    <>
      <div className={`fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden transition-opacity ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsSidebarOpen(false)} />
      <aside className={`fixed top-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/5 h-screen transition-transform lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-10">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-600/20">
              <FileCheck className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">DocuSet</span>
          </div>

          <div className="mb-6 px-2">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 px-1">Produzione</label>
            <div className="relative">
              <button 
                onClick={() => setIsProdDropdownOpen(!isProdDropdownOpen)}
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-200 text-sm font-semibold py-2.5 px-4 rounded-xl flex items-center justify-between hover:border-slate-300 transition-all shadow-sm"
              >
                <span className="truncate">{activeProduction?.title || 'Scegli...'}</span>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isProdDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isProdDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-[2rem] shadow-2xl z-50 overflow-hidden max-h-64 overflow-y-auto custom-scrollbar border border-slate-100 dark:border-white/5">
                  {data.productions.map(p => (
                    <button 
                      key={p.id}
                      onClick={() => { setSelectedProdId(p.id); setIsProdDropdownOpen(false); }}
                      className={`w-full text-left px-5 py-4 text-sm flex items-center justify-between transition-colors ${selectedProdId === p.id ? 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 font-semibold'}`}
                    >
                      <span className="truncate">{p.title}</span>
                      {selectedProdId === p.id && <Check className="w-3 h-3" />}
                    </button>
                  ))}
                  <button 
                    onClick={() => { setIsNewProdModalOpen(true); setIsProdDropdownOpen(false); }}
                    className="w-full text-left px-5 py-4 text-sm font-bold text-indigo-600 dark:text-indigo-400 border-t border-slate-100 dark:border-white/10 hover:bg-indigo-600/5 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Nuova produzione
                  </button>
                </div>
              )}
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar -mx-2 px-2">
            {[
              { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'PEOPLE', label: 'Cast & Crew', icon: Users },
              { id: 'TEMPLATES', label: 'Libreria Template', icon: FileText },
              { id: 'ARCHIVE', label: 'Archivio (Firmati)', icon: Archive },
              { id: 'PENDING', label: 'In Attesa', icon: Clock },
              { id: 'PRODUCTIONS', label: 'Tutti i Progetti', icon: Clapperboard },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id as any); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === item.id ? 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="pt-6 border-t border-slate-100 dark:border-white/5 space-y-3">
             <div className="px-4 py-2 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tema</span>
                <button 
                  onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                  className={`w-11 h-6 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
             </div>
             <button className="w-full flex items-center gap-3 px-4 py-3 text-red-500 dark:text-red-400/70 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-400/5 rounded-xl transition-all">
                <LogOut className="w-5 h-5" />
                Esci
             </button>
          </div>
        </div>
      </aside>
    </>
  );

  const NotificationsPanel = () => (
    <>
      <div className={`fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] z-[60] transition-opacity ${isNotificationsOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsNotificationsOpen(false)} />
      <div className={`fixed top-0 right-0 z-[70] w-full max-w-sm bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/5 h-screen transition-transform duration-300 ${isNotificationsOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full'}`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
             <h3 className="text-xl font-black text-slate-900 dark:text-white">Notifiche</h3>
             <button onClick={() => setIsNotificationsOpen(false)} className="p-2 bg-slate-100 dark:bg-white/5 rounded-xl text-slate-500 hover:text-red-500 transition-all"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
             {data.notifications.length === 0 ? (
               <div className="py-20 text-center text-slate-400 font-medium italic">Nessun aggiornamento.</div>
             ) : (
               data.notifications.map(n => (
                 <div key={n.id} onClick={() => { setActiveTab('ARCHIVE'); setIsNotificationsOpen(false); }} className={`p-4 rounded-[1.5rem] border transition-all cursor-pointer ${n.readAt ? 'bg-slate-50 dark:bg-white/[0.02] border-slate-100 dark:border-white/5' : 'bg-indigo-600/5 border-indigo-500/20 shadow-sm'}`}>
                    <div className="flex gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 flex-shrink-0"><CheckCircle className="w-6 h-6" /></div>
                       <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-slate-900 dark:text-white truncate">{n.title}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 font-medium">{n.message}</p>
                          <p className="text-[9px] text-slate-400 font-black uppercase mt-2">{new Date(n.createdAt).toLocaleTimeString()}</p>
                       </div>
                    </div>
                 </div>
               ))
             )}
          </div>
        </div>
      </div>
    </>
  );

  const DashboardContent = () => (
    <div className="space-y-8 animate-fade-in w-full">
       <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { label: 'Totale Crew', value: prodPeople.length, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10', tab: 'PEOPLE' },
            { label: 'Firmati', value: prodInstances.filter(i => i.status === DocStatus.SIGNED).length, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', tab: 'ARCHIVE' },
            { label: 'In Attesa', value: prodInstances.filter(i => i.status !== DocStatus.SIGNED).length, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', tab: 'PENDING' },
          ].map((s, i) => (
            <div key={i} onClick={() => setActiveTab(s.tab as any)} className="bg-white p-8 dark:bg-white/5 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 hover:border-indigo-500/30 cursor-pointer group">
               <div className={`${s.bg} w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${s.color} transition-transform group-hover:scale-110 shadow-sm`}>
                  <s.icon className="w-7 h-7" />
               </div>
               <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.15em]">{s.label}</p>
               <p className="text-4xl font-black text-slate-900 dark:text-white mt-2 leading-none">{s.value}</p>
            </div>
          ))}
       </div>

       <div className="bg-white dark:bg-white/5 rounded-[2.5rem] border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm">
          <div className="p-8 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
             <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-sm">Attività Recenti</h3>
             <button onClick={() => setActiveTab('PEOPLE')} className="text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest hover:underline decoration-2 underline-offset-4">Vedi Tutti</button>
          </div>
          <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-white/[0.02] text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-widest border-b border-slate-100 dark:border-white/10">
                   <tr>
                      <th className="px-8 py-5">Destinatario</th>
                      <th className="px-8 py-5 text-center">Stato</th>
                      <th className="px-8 py-5 text-right">Azioni</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                   {prodInstances.slice().reverse().slice(0, 5).map(inst => {
                     const p = data.people.find(x => x.id === inst.personId);
                     const t = data.templates.find(x => x.id === inst.templateId);
                     return (
                       <tr key={inst.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-all group">
                          <td className="px-8 py-6">
                             <p className="font-black text-slate-800 dark:text-slate-200 text-sm group-hover:text-indigo-600 transition-colors">{p?.name}</p>
                             <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide mt-1">{t?.name}</p>
                          </td>
                          <td className="px-8 py-6 text-center">
                             <span className={`inline-block px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${inst.status === DocStatus.SIGNED ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600 shadow-sm shadow-amber-500/10'}`}>{inst.status}</span>
                          </td>
                          <td className="px-8 py-6 text-right">
                             <button onClick={() => { if(p) window.open(`https://wa.me/${p.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Ciao ${p.name}, hai novità per il documento? ${getPublicLink(p.hubToken)}`)}`, '_blank') }} className="p-3 text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-xl transition-all"><MessageSquare className="w-5 h-5" /></button>
                          </td>
                       </tr>
                     );
                   })}
                </tbody>
             </table>
          </div>
       </div>
    </div>
  );

  const PeopleContent = () => (
    <div className="space-y-8 animate-fade-in w-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between w-full">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight">Cast & Crew</h2>
          <p className="text-slate-500 text-sm mt-1 font-medium">Gestisci i membri della produzione e i loro documenti.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:gap-3">
          <button onClick={() => setIsImportModalOpen(true)} className="px-4 py-3 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
            <FileUp className="w-4 h-4" /> Importa
          </button>
          <button onClick={() => setIsBulkSendOpen(true)} className="px-4 py-3 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
            <Send className="w-4 h-4" /> Invia Richieste
          </button>
          <button onClick={() => setIsNewMemberModalOpen(true)} className="col-span-2 sm:col-span-1 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2">
            <UserPlus className="w-4 h-4" /> Nuovo Membro
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-white/[0.02] text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-widest border-b border-slate-100 dark:border-white/10">
              <tr>
                <th className="px-8 py-5">Soggetto</th>
                <th className="px-8 py-5">Ruolo / Reparto</th>
                <th className="px-8 py-5">Documenti</th>
                <th className="px-8 py-5 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {prodPeople.map(p => {
                const personInstances = prodInstances.filter(i => i.personId === p.id);
                return (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-all group">
                    <td className="px-8 py-6">
                      <p className="font-black text-slate-800 dark:text-slate-200 text-sm">{p.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-1">{p.whatsapp}</p>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm font-bold text-slate-600 dark:text-slate-400">{p.role}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">{p.department}</p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {personInstances.map(inst => {
                          const t = data.templates.find(x => x.id === inst.templateId);
                          return (
                            <div key={inst.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full group/doc">
                              <span className={`w-1.5 h-1.5 rounded-full ${inst.status === DocStatus.SIGNED ? 'bg-green-500' : 'bg-amber-500'}`} />
                              <span className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 truncate max-w-[80px]">{t?.name || 'Doc'}</span>
                              <button onClick={() => deleteInstance(inst.id)} className="text-slate-300 hover:text-red-500 transition-colors ml-1"><X className="w-2.5 h-2.5" /></button>
                            </div>
                          );
                        })}
                      </div>
                      <div className="relative group/assign inline-block">
                        <button className="flex items-center gap-1 text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.15em] hover:text-indigo-800 transition-colors">
                          <Plus className="w-3 h-3" /> Assegna Documento
                        </button>
                        <div className="absolute left-0 mt-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl hidden group-hover/assign:block z-50 overflow-hidden animate-fade-in py-2">
                          <div className="px-4 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-white/10 mb-1">Seleziona Template</div>
                          <div className="max-h-48 overflow-y-auto custom-scrollbar">
                            {data.templates.map(t => (
                              <button 
                                key={t.id} 
                                onClick={() => addInstance(p.id, t.id)}
                                className="w-full text-left px-4 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors truncate flex items-center gap-2"
                              >
                                <FileText className="w-3.5 h-3.5 opacity-50" /> {t.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => window.open(`https://wa.me/${p.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Ciao ${p.name}, ti ho inviato i documenti da firmare per ${activeProduction?.title}. Puoi accedere qui: ${getPublicLink(p.hubToken)}`)}`, '_blank')}
                          className="p-2.5 text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-xl transition-all"
                          title="Invia link via WhatsApp"
                        >
                          <MessageSquare className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => { navigator.clipboard.writeText(getPublicLink(p.hubToken)); alert('Link copiato negli appunti!'); }}
                          className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all"
                          title="Copia link hub"
                        >
                          <Link className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setPersonToDeleteId(p.id)}
                          className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                          title="Rimuovi membro"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const TemplateContent = () => (
    <div className="space-y-8 animate-fade-in w-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between w-full">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight">Libreria Template</h2>
          <p className="text-slate-500 text-sm mt-1 font-medium">Gestisci i modelli di documento per la tua produzione.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-white/[0.02] text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-widest border-b border-slate-100 dark:border-white/10">
              <tr>
                <th className="px-8 py-5">Nome Template</th>
                <th className="px-8 py-5">Tipo</th>
                <th className="px-8 py-5">Data Creazione</th>
                <th className="px-8 py-5 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {data.templates.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-600/10 p-2.5 rounded-xl text-indigo-600">
                        <FileText className="w-5 h-5" />
                      </div>
                      <p className="font-black text-slate-800 dark:text-slate-200 text-sm">{t.name}</p>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{t.type}</span>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(t.createdAt).toLocaleDateString()}</span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button 
                      onClick={() => setTemplateToDeleteId(t.id)}
                      className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const BulkSendModal = () => {
    const [index, setIndex] = useState(0);
    const [showSkipConfirm, setShowSkipConfirm] = useState(false);

    useEffect(() => {
      if (isBulkSendOpen) {
        setIndex(0);
        setShowSkipConfirm(false);
      }
    }, [isBulkSendOpen]);

    if (!isBulkSendOpen) return null;
    
    const people = prodPeople;
    if (people.length === 0) return null;

    const currentPerson = people[index];
    const isLast = index === people.length - 1;

    const handleOpenWA = async () => {
      const link = getPublicLink(currentPerson.hubToken);
      const message = `Ciao ${currentPerson.name}, ti ho inviato i documenti da firmare per ${activeProduction?.title}. Puoi accedere qui: ${link}`;
      
      if (supabase) {
        const instancesToSign = prodInstances.filter(i => i.personId === currentPerson.id && i.status !== DocStatus.SIGNED);
        const firstInstanceId = instancesToSign[0]?.id || 'bulk';
        
        await supabase.from('signing_invites').upsert({
          token: currentPerson.hubToken,
          production_id: selectedProdId,
          person_id: currentPerson.id,
          instance_id: firstInstanceId,
          status: 'SENT',
          payload: {
            personName: currentPerson.name,
            productionTitle: activeProduction?.title,
            templateName: 'Documenti Produzione'
          }
        });
      }

      window.open(`https://wa.me/${currentPerson.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const handleMarkActioned = () => {
      const now = new Date().toISOString();
      setData(prev => ({
        ...prev,
        instances: prev.instances.map(inst => 
          (inst.personId === currentPerson.id && inst.productionId === selectedProdId && inst.status === DocStatus.NOT_SENT)
            ? { ...inst, status: DocStatus.SENT, sentAt: now }
            : inst
        )
      }));
    };

    const handleNext = (force: boolean = false) => {
      const personInstances = prodInstances.filter(i => i.personId === currentPerson.id && i.productionId === selectedProdId);
      const targetInstances = personInstances.filter(i => i.status === DocStatus.NOT_SENT);
      const isAlreadyActioned = targetInstances.length === 0;

      if (!isAlreadyActioned && !showSkipConfirm && !force) {
        setShowSkipConfirm(true);
        return;
      }
      
      setShowSkipConfirm(false);
      if (isLast) {
        setIsBulkSendOpen(false);
        setTimeout(() => alert('Workflow completato'), 300);
      } else {
        setIndex(prev => prev + 1);
      }
    };

    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
        <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3.5rem] p-10 sm:p-12 border border-slate-200 dark:border-white/10 shadow-2xl relative">
          <button onClick={() => setIsBulkSendOpen(false)} className="absolute top-8 right-8 p-2 bg-slate-100 dark:bg-white/5 rounded-2xl text-slate-500 hover:text-red-500 transition-all"><X className="w-6 h-6" /></button>
          
          <div className="mb-8">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">Invia Richieste</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Stai gestendo {people.length} persone.</p>
          </div>

          <div className="space-y-8">
            <div className="text-center">
               <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] mb-4">DESTINATARIO {index + 1} DI {people.length}</p>
               <div className="bg-slate-50 dark:bg-white/5 p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/10 shadow-inner">
                  <p className="text-xl font-black text-slate-900 dark:text-white truncate">{currentPerson.name}</p>
                  <p className="text-sm font-bold text-slate-400 mt-1">{currentPerson.whatsapp}</p>
               </div>
            </div>

            <div className="space-y-4">
              <button 
                onClick={handleOpenWA}
                className="w-full py-5 bg-green-500 text-white rounded-[2rem] font-black text-lg hover:bg-green-600 shadow-xl shadow-green-500/20 transition-all flex items-center justify-center gap-3"
              >
                <MessageSquare className="w-6 h-6" /> Apri WhatsApp
              </button>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={handleMarkActioned}
                  className={`py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200`}
                >
                  <Clock className="w-4 h-4" /> Segna come Inviato
                </button>
                <button 
                  onClick={() => handleNext()}
                  className="py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                >
                  {isLast ? 'Fine' : 'Avanti →'}
                </button>
              </div>
            </div>
          </div>

          {showSkipConfirm && (
            <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 rounded-[3.5rem] flex flex-col items-center justify-center p-10 text-center z-10 animate-fade-in">
              <AlertCircle className="w-16 h-16 text-amber-500 mb-6" />
              <h4 className="text-xl font-black text-slate-900 dark:text-white mb-2">Non hai segnato come inviato</h4>
              <p className="text-slate-500 text-sm mb-8 font-medium">Vuoi proseguire senza segnare come inviato?</p>
              <div className="flex gap-4 w-full">
                <button onClick={() => setShowSkipConfirm(false)} className="flex-1 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 rounded-2xl font-bold">Resta</button>
                <button onClick={() => handleNext(true)} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold">Prosegui</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (publicToken) return <PublicForm hubToken={publicToken} onComplete={() => window.location.href = window.location.pathname} />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex overflow-hidden transition-all duration-300">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-y-auto custom-scrollbar lg:pl-[280px] w-full">
        <Header />
        <main className="p-6 sm:p-12 pb-32 max-w-7xl mx-auto w-full">
          {activeTab === 'DASHBOARD' && <DashboardContent />}
          {activeTab === 'PEOPLE' && <PeopleContent />}
          {activeTab === 'TEMPLATES' && <TemplateContent />}
          {activeTab === 'ARCHIVE' && <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest">Sezione Archivio in Arrivo</div>}
          {activeTab === 'PENDING' && <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest">Sezione In Attesa in Arrivo</div>}
          {activeTab === 'PRODUCTIONS' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black">Le Tue Produzioni</h2>
                <button onClick={() => setIsNewProdModalOpen(true)} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold flex items-center gap-2 shadow-lg"><Plus className="w-5 h-5" /> Nuovo Progetto</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.productions.map(p => (
                  <div key={p.id} onClick={() => setSelectedProdId(p.id)} className={`p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 cursor-pointer transition-all ${selectedProdId === p.id ? 'border-indigo-600 shadow-xl' : 'border-slate-100 dark:border-white/5 hover:border-slate-200'}`}>
                    <Clapperboard className={`w-10 h-10 mb-6 ${selectedProdId === p.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <h3 className="text-xl font-black mb-2">{p.title}</h3>
                    <p className="text-sm text-slate-500 font-medium">{p.notes || 'Nessuna nota.'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
      
      <NotificationsPanel />
      <BulkSendModal />

      {/* --- MODAL RENDERING --- */}

      {isNewMemberModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] border border-slate-200 dark:border-white/10 shadow-2xl p-10">
            <h3 className="text-2xl font-black mb-8">Nuovo Membro Crew</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nome Completo</label>
                <input required value={newMemberData.name} onChange={e => setNewMemberData({...newMemberData, name: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="es. Mario Rossi" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Ruolo</label>
                  <input value={newMemberData.role} onChange={e => setNewMemberData({...newMemberData, role: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="es. DOP" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Reparto</label>
                  <input value={newMemberData.department} onChange={e => setNewMemberData({...newMemberData, department: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="es. Camera" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">WhatsApp (Obbligatorio)</label>
                <input required value={newMemberData.whatsapp} onChange={e => setNewMemberData({...newMemberData, whatsapp: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="39..." />
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsNewMemberModalOpen(false)} className="flex-1 py-4 bg-slate-100 dark:bg-white/5 rounded-2xl font-bold">Annulla</button>
                <button onClick={handleAddMember} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg">Crea Membro</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isRenameModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] border border-slate-200 dark:border-white/10 shadow-2xl p-10">
            <h3 className="text-2xl font-black mb-8">Rinomina Produzione</h3>
            <div className="space-y-4">
              <input value={renameValue} onChange={e => setRenameValue(e.target.value)} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="Titolo Produzione" />
              <input value={renamePhone} onChange={e => setRenamePhone(e.target.value)} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="Telefono Produzione" />
              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsRenameModalOpen(false)} className="flex-1 py-4 bg-slate-100 dark:bg-white/5 rounded-2xl font-bold">Annulla</button>
                <button onClick={handleUpdateProduction} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold">Salva Modifiche</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isImportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] border border-slate-200 dark:border-white/10 shadow-2xl p-10">
            <h3 className="text-2xl font-black mb-4">Importa Crew</h3>
            <p className="text-slate-500 mb-6 text-sm">Incolla una lista separata da virgola (Nome, Ruolo, WhatsApp) o un elenco di nomi.</p>
            <textarea 
              id="import-area"
              className="w-full h-64 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[2rem] p-6 outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
              placeholder="Mario Rossi, DOP, 39333...&#10;Anna Neri, Runner, 39344..."
            />
            <div className="flex gap-4 pt-4">
              <button onClick={() => setIsImportModalOpen(false)} className="flex-1 py-4 bg-slate-100 dark:bg-white/5 rounded-2xl font-bold">Annulla</button>
              <button onClick={() => {
                const text = (document.getElementById('import-area') as HTMLTextAreaElement).value;
                const lines = text.split('\n').filter(l => l.trim());
                const newPeople: Person[] = lines.map(l => {
                  const parts = l.split(',').map(s => s.trim());
                  return {
                    id: 'per-' + Math.random().toString(36).substr(2, 9),
                    productionId: selectedProdId!,
                    name: parts[0] || 'Nuovo Membro',
                    role: parts[1] || 'Crew',
                    department: 'General',
                    whatsapp: parts[2] || '393330000000',
                    hubToken: crypto.randomUUID()
                  };
                });
                setData(prev => ({ ...prev, people: [...prev.people, ...newPeople] }));
                setIsImportModalOpen(false);
              }} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold">Importa</button>
            </div>
          </div>
        </div>
      )}

      {templateToDeleteId && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[3rem] p-10 text-center border border-slate-200 dark:border-white/10 shadow-2xl">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h3 className="text-xl font-black mb-4">Elimina Template?</h3>
            <p className="text-slate-500 mb-8 text-sm font-medium">Questa azione è irreversibile. Tutte le assegnazioni correnti verranno rimosse.</p>
            <div className="flex gap-4">
              <button onClick={() => setTemplateToDeleteId(null)} className="flex-1 py-4 bg-slate-100 dark:bg-white/5 rounded-2xl font-bold">Annulla</button>
              <button onClick={confirmDeleteTemplate} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold">Elimina</button>
            </div>
          </div>
        </div>
      )}

      {personToDeleteId && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[3rem] p-10 text-center border border-slate-200 dark:border-white/10 shadow-2xl">
            <UserMinus className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h3 className="text-xl font-black mb-4">Rimuovi Membro?</h3>
            <p className="text-slate-500 mb-8 text-sm font-medium">Vuoi rimuovere permanentemente questo membro dalla produzione?</p>
            <div className="flex gap-4">
              <button onClick={() => setPersonToDeleteId(null)} className="flex-1 py-4 bg-slate-100 dark:bg-white/5 rounded-2xl font-bold">Annulla</button>
              <button onClick={confirmDeletePerson} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold">Rimuovi</button>
            </div>
          </div>
        </div>
      )}

      {isNewProdModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] border border-slate-200 dark:border-white/10 shadow-2xl p-10">
            <h3 className="text-2xl font-black mb-8">Nuovo Progetto</h3>
            <div className="space-y-4">
              <input value={newProdData.title} onChange={e => setNewProdData({...newProdData, title: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="Titolo Produzione" />
              <input value={newProdData.phone} onChange={e => setNewProdData({...newProdData, phone: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="WhatsApp Produzione" />
              <textarea value={newProdData.notes} onChange={e => setNewProdData({...newProdData, notes: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[2rem] px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500 h-32 resize-none" placeholder="Note facoltative..." />
              <button onClick={handleCreateProduction} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg">Crea Produzione</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
