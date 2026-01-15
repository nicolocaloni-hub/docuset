
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
const REMOTE_VAULT_KEY = 'setdocs_remote_vault';

// Safely initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const SignatureCanvas = ({ onSave, onClear }: { onSave: (data: string) => void; onClear: () => void }) => (
  <SignatureCanvasComponent onSave={onSave} onClear={onClear} />
);

// --- UTILS ---
const computeFileHash = async (base64Data: string): Promise<string> => {
  const binaryString = atob(base64Data.split(',')[1] || base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// --- PDF GENERATION ENGINE ---
const generateSignedPdf = async (template: Template, formData: Record<string, string>, signatureBase64: string): Promise<{url: string, hash: string}> => {
  try {
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    
    // Load existing template
    const response = await fetch(template.fileUrl);
    const existingPdfBytes = await response.arrayBuffer();
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();

    // Embed Signature
    const signatureImage = await pdfDoc.embedPng(signatureBase64);

    for (const field of template.fields) {
      const pageIndex = field.page || 0;
      const page = pages[pageIndex];
      if (!page) continue;

      const { width: pageWidth, height: pageHeight } = page.getSize();
      
      let x, y;
      if (field.xPct !== undefined && field.yPct !== undefined) {
        x = field.xPct * pageWidth;
        y = (1 - field.yPct) * pageHeight;
      } else {
        x = (field.x / 595) * pageWidth;
        y = pageHeight - (field.y / 842) * pageHeight;
      }

      if (field.type === 'signature') {
        const sigWidth = field.wPct !== undefined ? field.wPct * pageWidth : (field.width || 120);
        const sigHeight = field.hPct !== undefined ? field.hPct * pageHeight : (field.height || 40);
        
        page.drawImage(signatureImage, {
          x: x - (sigWidth / 2),
          y: y - (sigHeight / 2),
          width: sigWidth,
          height: sigHeight,
        });
      } else {
        let value = '';
        if (field.id === 'name') value = formData.name || '';
        else if (field.id === 'date') value = formData.date || '';
        else value = formData[field.id] || '';

        const size = field.fontSize || 10;
        page.drawText(value, {
          x: x,
          y: y - (size / 2),
          size: size,
          font: font,
          color: rgb(0.1, 0.1, 0.2),
        });
      }
    }

    const pdfBytes = await pdfDoc.save();
    const base64: string = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(new Blob([pdfBytes], { type: 'application/pdf' }));
    });
    
    const hash = await computeFileHash(base64);
    return { url: base64, hash };
  } catch (error) {
    console.error("PDF Error:", error);
    throw error;
  }
};

const INITIAL_DATA: AppState = {
  productions: [
    { id: 'p1', title: 'Il Grande Set', notes: 'Cortometraggio d\'esordio', createdAt: new Date().toISOString(), producerPhone: '393330000000' }
  ],
  people: [
    { id: 'per1', productionId: 'p1', name: 'Marco Gialli', role: 'DOP', department: 'Camera', whatsapp: '393330000000', hubToken: 'hub-marco-123' }
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isBulkSendOpen, setIsBulkSendOpen] = useState(false);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [isReminderPreviewOpen, setIsReminderPreviewOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isNewProdModalOpen, setIsNewProdModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isProdDropdownOpen, setIsProdDropdownOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [newProdData, setNewProdData] = useState({ title: '', notes: '', phone: '' });
  const [renameValue, setRenameValue] = useState('');
  const [renamePhone, setRenamePhone] = useState('');

  const [templateToDeleteId, setTemplateToDeleteId] = useState<string | null>(null);
  const [templateToMapId, setTemplateToMapId] = useState<string | null>(null);
  const [personToDeleteId, setPersonToDeleteId] = useState<string | null>(null);
  
  const [isNewMemberModalOpen, setIsNewMemberModalOpen] = useState(false);
  const [newMemberData, setNewMemberData] = useState({ name: '', role: '', department: '', whatsapp: '' });

  const [publicFormToken, setPublicFormToken] = useState<string | null>(null);

  useEffect(() => {
    const handleRoute = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      
      // Handle both /sign/hub/TOKEN and #/form/TOKEN
      if (path.includes('/sign/hub/')) {
        const parts = path.split('/sign/hub/');
        setPublicFormToken(parts[parts.length - 1] || null);
      } else if (hash.startsWith('#/form/')) {
        setPublicFormToken(hash.split('/')[2] || null);
      } else {
        setPublicFormToken(null);
      }
    };
    handleRoute();
    window.addEventListener('hashchange', handleRoute);
    window.addEventListener('popstate', handleRoute);
    return () => {
      window.removeEventListener('hashchange', handleRoute);
      window.removeEventListener('popstate', handleRoute);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // --- SYNC ENGINE ---
  const syncSubmissions = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    
    try {
      const remoteVault = JSON.parse(localStorage.getItem(REMOTE_VAULT_KEY) || '[]');
      const submittedForms = remoteVault.filter((f: any) => f.status === 'SUBMITTED');

      if (submittedForms.length === 0) {
        setIsSyncing(false);
        return;
      }

      let newData = { ...data };
      let updatedCount = 0;

      for (const submission of submittedForms) {
        const instanceIdx = newData.instances.findIndex(i => i.id === submission.instanceId && i.status !== DocStatus.SIGNED);
        if (instanceIdx === -1) continue;

        const instance = newData.instances[instanceIdx];
        const template = newData.templates.find(t => t.id === instance.templateId);
        const person = newData.people.find(p => p.id === instance.personId);

        if (!template || !person) continue;

        const filledData: Record<string, string> = {
          name: `${submission.formData.firstName} ${submission.formData.lastName}`,
          date: new Date(submission.submittedAt).toLocaleDateString('it-IT'),
          taxCode: submission.formData.taxCode,
          role: submission.formData.role,
          idNumber: submission.formData.idNumber
        };

        const { url, hash } = await generateSignedPdf(template, filledData, submission.formData.signature);
        const audit = {
          submittedAt: submission.submittedAt,
          userAgent: submission.userAgent,
          pdfHash: hash
        };

        newData.instances[instanceIdx] = {
          ...instance,
          status: DocStatus.SIGNED,
          signedAt: submission.submittedAt,
          finalPdfUrl: url,
          auditJSON: JSON.stringify(audit)
        };

        submission.status = 'PROCESSED';
        submission.processedAt = new Date().toISOString();
        updatedCount++;
      }

      if (updatedCount > 0) {
        setData(newData);
        localStorage.setItem(REMOTE_VAULT_KEY, JSON.stringify(remoteVault));
      }
    } catch (e) {
      console.error("Sync Error:", e);
    } finally {
      setTimeout(() => setIsSyncing(false), 800);
    }
  };

  // --- REALTIME NOTIFICATIONS HOOK ---
  useEffect(() => {
    if (!selectedProdId || !supabase) return;

    const channel = supabase
      .channel(`public_forms_${selectedProdId}`)
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'public_forms', filter: `productionId=eq.${selectedProdId}` },
        (payload) => {
          const { status, personName, personId, token, docInstanceId, submittedAt } = payload.new;
          const oldStatus = payload.old.status;

          if (status === 'SUBMITTED' && oldStatus !== 'SUBMITTED') {
            const dedupeKey = `${docInstanceId}_SUBMITTED`;
            const exists = data.notifications.some(n => (n as any).dedupeKey === dedupeKey);
            
            if (!exists) {
              const newNotif: AppNotification = {
                id: 'n-' + Date.now() + Math.random(),
                productionId: selectedProdId,
                personId: personId,
                documentInstanceId: docInstanceId,
                type: 'DOCUMENT_SIGNED',
                title: 'Nuova Firma',
                message: `${personName} ha completato e inviato "${token}"`,
                createdAt: new Date().toISOString(),
                readAt: null
              };
              (newNotif as any).dedupeKey = dedupeKey;

              setData(prev => ({
                ...prev,
                notifications: [newNotif, ...prev.notifications]
              }));
              
              syncSubmissions();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedProdId, data.notifications]);

  const activeProduction = useMemo(() => data.productions.find(p => p.id === selectedProdId), [selectedProdId, data.productions]);
  const prodPeople = useMemo(() => data.people.filter(p => p.productionId === selectedProdId), [selectedProdId, data.people]);
  const prodInstances = useMemo(() => data.instances.filter(i => i.productionId === selectedProdId), [selectedProdId, data.instances]);
  const unreadCount = useMemo(() => data.notifications.filter(n => !n.readAt).length, [data.notifications]);

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
    setActiveTab('DASHBOARD');
  };

  const handleUpdateProduction = () => {
    if (!renameValue.trim() || !selectedProdId) return;
    setData(prev => ({
      ...prev,
      productions: prev.productions.map(p => p.id === selectedProdId ? { ...p, title: renameValue, producerPhone: renamePhone } : p)
    }));
    setIsRenameModalOpen(false);
  };

  const handleAddMember = () => {
    if (!newMemberData.name.trim() || !selectedProdId) return;
    const newPerson: Person = {
      id: 'per-' + Date.now(),
      productionId: selectedProdId,
      name: newMemberData.name,
      role: newMemberData.role || 'Crew',
      department: newMemberData.department || 'General',
      whatsapp: newMemberData.whatsapp || '393330000000',
      hubToken: 'hub-' + Math.random().toString(36).substr(2, 9)
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

  const markNotifRead = (id: string) => {
    setData(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n)
    }));
  };

  const markAllAsRead = () => {
    const now = new Date().toISOString();
    setData(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => ({ ...n, readAt: n.readAt || now }))
    }));
  };

  const getPublicLink = (person: Person) => {
    const origin = window.location.origin;
    const path = window.location.pathname.replace(/\/$/, '');
    return `${origin}${path}/#/form/${person.hubToken}`;
  };

  const confirmDeleteTemplate = () => {
    if (!templateToDeleteId) return;
    setData(prev => ({
      ...prev,
      templates: prev.templates.filter(t => t.id !== templateToDeleteId)
    }));
    setTemplateToDeleteId(null);
  };

  const confirmDeletePerson = () => {
    if (!personToDeleteId || !selectedProdId) return;
    setData(prev => ({
      ...prev,
      people: prev.people.filter(p => p.id !== personToDeleteId),
      instances: prev.instances.filter(i => !(i.personId === personToDeleteId && i.productionId === selectedProdId)),
      notifications: prev.notifications.filter(n => !(n.personId === personToDeleteId && n.productionId === selectedProdId))
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
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => { setRenameValue(activeProduction?.title || ''); setRenamePhone(activeProduction?.producerPhone || ''); setIsRenameModalOpen(true); }}>
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
        <button 
          onClick={syncSubmissions}
          disabled={isSyncing}
          className={`p-2.5 rounded-xl transition-all ${isSyncing ? 'text-indigo-600 animate-spin bg-indigo-50 dark:bg-indigo-500/10' : 'text-slate-400 hover:text-indigo-600'}`}
        >
          <RefreshCw className="w-5 h-5" />
        </button>
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
             <div className="flex items-center gap-3">
               <h3 className="text-xl font-black text-slate-900 dark:text-white">Notifiche</h3>
               {unreadCount > 0 && <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">{unreadCount}</span>}
             </div>
             <div className="flex items-center gap-1">
               {unreadCount > 0 && (
                 <button onClick={markAllAsRead} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Segna tutto come letto">
                   <CheckCheck className="w-5 h-5" />
                 </button>
               )}
               <button onClick={() => setIsNotificationsOpen(false)} className="p-2 bg-slate-100 dark:bg-white/5 rounded-xl text-slate-500 hover:text-red-500 transition-all"><X className="w-5 h-5" /></button>
             </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
             {data.notifications.length === 0 ? (
               <div className="py-20 text-center text-slate-400 font-medium italic">Nessun aggiornamento.</div>
             ) : (
               data.notifications.map(n => (
                 <div key={n.id} onClick={() => { markNotifRead(n.id); setActiveTab('ARCHIVE'); setIsNotificationsOpen(false); }} className={`p-4 rounded-[1.5rem] border transition-all cursor-pointer relative ${n.readAt ? 'bg-slate-50 dark:bg-white/[0.02] border-slate-100 dark:border-white/5 opacity-60' : 'bg-indigo-600/5 border-indigo-500/20 ring-1 ring-indigo-500/10 shadow-sm hover:scale-[1.02]'}`}>
                    {!n.readAt && <span className="absolute top-4 right-4 w-2 h-2 bg-indigo-600 rounded-full shadow-[0_0_8px_rgba(79,70,229,0.5)]" />}
                    <div className="flex gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 flex-shrink-0"><CheckCircle className="w-6 h-6" /></div>
                       <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-slate-900 dark:text-white truncate">{n.title}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 font-medium leading-relaxed">{n.message}</p>
                          <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-2">{new Date(n.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
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
                             <button onClick={() => { if(p) window.open(`https://wa.me/${p.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Ciao ${p.name}, hai novità per il documento? ${getPublicLink(p)}`)}`, '_blank') }} className="p-3 text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-xl transition-all"><MessageSquare className="w-5 h-5" /></button>
                          </td>
                       </tr>
                     );
                   })}
                   {prodInstances.length === 0 && (
                     <tr><td colSpan={3} className="py-24 text-center text-slate-400 text-sm font-medium italic">Nessun documento assegnato a questa produzione.</td></tr>
                   )}
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
          <button onClick={() => setIsImportModalOpen(true)} className="px-4 py-3 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2">
            <FileUp className="w-4 h-4" /> Importa
          </button>
          <button onClick={() => setIsBulkSendOpen(true)} className="px-4 py-3 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2">
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
                          onClick={async () => {
                            if (supabase) {
                              // Track the request in Supabase before opening WA
                              await supabase.from('sign_requests').upsert({
                                token: p.hubToken,
                                production_id: selectedProdId,
                                person_id: p.id,
                                status: DocStatus.SENT,
                                created_at: new Date().toISOString()
                              }, { onConflict: 'token' });
                            }
                            window.open(`https://wa.me/${p.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Ciao ${p.name}, ti ho inviato i documenti da firmare per ${activeProduction?.title}. Puoi accedere qui: ${getPublicLink(p)}`)}`, '_blank');
                          }}
                          className="p-2.5 text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-xl transition-all"
                          title="Invia link via WhatsApp"
                        >
                          <MessageSquare className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => { navigator.clipboard.writeText(getPublicLink(p)); alert('Link copiato negli appunti!'); }}
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
              {prodPeople.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-24 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-white/5 rounded-3xl flex items-center justify-center text-slate-300 mb-4"><Users className="w-8 h-8" /></div>
                      <p className="text-slate-400 text-sm font-medium italic">Nessun membro nella crew.</p>
                      <button onClick={() => setIsNewMemberModalOpen(true)} className="mt-6 text-indigo-600 text-xs font-black uppercase tracking-widest hover:underline decoration-2 underline-offset-4">Aggiungi il primo membro</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const ArchiveContent = () => (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-black text-slate-900 dark:text-white">Archivio Documenti Firmati</h2>
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-white/[0.02] text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-widest border-b border-slate-100 dark:border-white/10">
              <tr>
                <th className="px-8 py-5">Soggetto</th>
                <th className="px-8 py-5">Documento</th>
                <th className="px-8 py-5">Data Firma</th>
                <th className="px-8 py-5 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {prodInstances.filter(i => i.status === DocStatus.SIGNED).map(inst => {
                const p = data.people.find(x => x.id === inst.personId);
                const t = data.templates.find(x => x.id === inst.templateId);
                return (
                  <tr key={inst.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-all">
                    <td className="px-8 py-6 font-bold text-slate-800 dark:text-slate-200">{p?.name}</td>
                    <td className="px-8 py-6 text-sm text-slate-500">{t?.name}</td>
                    <td className="px-8 py-6 text-sm text-slate-500">{inst.signedAt ? new Date(inst.signedAt).toLocaleDateString() : '-'}</td>
                    <td className="px-8 py-6 text-right">
                      <a href={inst.finalPdfUrl} download={`${p?.name}_${t?.name}.pdf`} className="p-2.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all inline-block"><Download className="w-5 h-5" /></a>
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

  const PendingContent = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">In Attesa di Firma</h2>
        <button onClick={() => setIsBulkSendOpen(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all">Sollecito Rapido</button>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-white/[0.02] text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-widest border-b border-slate-100 dark:border-white/10">
              <tr>
                <th className="px-8 py-5">Soggetto</th>
                <th className="px-8 py-5">Documento</th>
                <th className="px-8 py-5">Stato</th>
                <th className="px-8 py-5 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {prodInstances.filter(i => i.status !== DocStatus.SIGNED).map(inst => {
                const p = data.people.find(x => x.id === inst.personId);
                const t = data.templates.find(x => x.id === inst.templateId);
                return (
                  <tr key={inst.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-all">
                    <td className="px-8 py-6 font-bold text-slate-800 dark:text-slate-200">{p?.name}</td>
                    <td className="px-8 py-6 text-sm text-slate-500">{t?.name}</td>
                    <td className="px-8 py-6"><span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-[10px] font-bold">{inst.status}</span></td>
                    <td className="px-8 py-6 text-right">
                       <button onClick={async () => { 
                         if(p) {
                           if (supabase) {
                             await supabase.from('sign_requests').upsert({
                               token: p.hubToken,
                               production_id: selectedProdId,
                               person_id: p.id,
                               status: DocStatus.SENT,
                               created_at: new Date().toISOString()
                             }, { onConflict: 'token' });
                           }
                           window.open(`https://wa.me/${p.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Ciao ${p.name}, ti ricordo di firmare il documento: ${getPublicLink(p)}`)}`, '_blank');
                         }
                       }} className="p-2 text-green-500 hover:text-green-700 transition-all"><Send className="w-5 h-5" /></button>
                       <button onClick={() => deleteInstance(inst.id)} className="p-2 text-slate-400 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
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
    <div className="space-y-8 animate-fade-in">
       <div className="flex justify-between items-center">
         <h2 className="text-2xl font-black text-slate-900 dark:text-white">Libreria Template</h2>
         <label className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all cursor-pointer shadow-lg shadow-indigo-600/20">
           Carica PDF
           <input type="file" className="hidden" accept="application/pdf" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (re) => {
                 const base64 = re.target?.result as string;
                 const newTemp: Template = {
                   id: 't-' + Date.now(),
                   name: file.name.replace('.pdf', ''),
                   type: TemplateType.OTHER,
                   fileUrl: base64,
                   fileName: file.name,
                   fileType: file.type,
                   isBlank: true,
                   fields: [],
                   createdAt: new Date().toISOString()
                 };
                 setData(prev => ({ ...prev, templates: [...prev.templates, newTemp] }));
              };
              reader.readAsDataURL(file);
           }} />
         </label>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {data.templates.map(t => (
           <div key={t.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm flex flex-col group">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600 mb-4"><FileText className="w-6 h-6" /></div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-1">{t.name}</h3>
              <p className="text-xs text-slate-500 mb-6">{t.fields.length} campi mappati</p>
              <div className="flex items-center gap-2 mt-auto">
                 <button onClick={() => setTemplateToMapId(t.id)} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">Mappa Campi</button>
                 <button onClick={() => setTemplateToDeleteId(t.id)} className="p-2 text-slate-300 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
              </div>
           </div>
         ))}
       </div>
    </div>
  );

  const PublicView = () => {
    const person = useMemo(() => data.people.find(p => p.hubToken === publicFormToken), [publicFormToken, data.people]);
    if (!person) return <div className="min-h-screen flex items-center justify-center p-6 text-slate-500 font-bold uppercase">Token non trovato localmente. Verifica la connessione.</div>;
    const instance = data.instances.find(i => i.personId === person.id && i.status !== DocStatus.SIGNED);
    const template = instance ? data.templates.find(t => t.id === instance.templateId) : null;
    
    // Fallback if no instance found but we have a token
    if (!instance || !template) return <div className="min-h-screen flex items-center justify-center p-6 text-green-500 font-bold uppercase">Tutto firmato o sessione non trovata!</div>;
    
    return <PublicForm documentType={template.name} recipientName={person.name} hubToken={person.hubToken} instanceId={instance.id} onComplete={syncSubmissions} />;
  };

  const ProductionsContent = () => (
    <div className="space-y-8 animate-fade-in w-full">
       <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between w-full">
          <div className="w-full">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight">I Miei Progetti</h2>
            <p className="text-slate-500 text-sm mt-1 font-medium">Produzioni cinematografiche attive.</p>
          </div>
          <button onClick={() => setIsNewProdModalOpen(true)} className="w-full sm:w-auto px-8 py-5 bg-indigo-600 text-white rounded-[2rem] font-black flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-95 text-[11px] uppercase tracking-widest"><Plus className="w-6 h-6" /> Nuovo Progetto</button>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {data.productions.map(p => (
            <div key={p.id} onClick={() => { setSelectedProdId(p.id); setActiveTab('DASHBOARD'); }} className={`bg-white dark:bg-slate-900 p-8 rounded-[3rem] border transition-all shadow-sm cursor-pointer group hover:shadow-2xl hover:-translate-y-1 ${selectedProdId === p.id ? 'border-indigo-600 shadow-xl shadow-indigo-600/10 ring-2 ring-indigo-500/30' : 'border-slate-200 dark:border-white/10'}`}>
               <div className={`w-16 h-16 rounded-[1.5rem] mb-6 flex items-center justify-center transition-all shadow-sm ${selectedProdId === p.id ? 'bg-indigo-600 text-white shadow-indigo-600/20' : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
                  < Clapperboard className="w-8 h-8" />
               </div>
               <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">{p.title}</h3>
               <p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-2 mt-2 leading-relaxed">{p.notes || 'Nessuna descrizione.'}</p>
               <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-100 dark:border-white/5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{new Date(p.createdAt).toLocaleDateString('it-IT')}</span>
                  <div className={`p-2 rounded-xl transition-all ${selectedProdId === p.id ? 'bg-indigo-600 text-white' : 'bg-slate-50 dark:bg-white/5 text-slate-300'}`}>
                    <ChevronRight className="w-5 h-5" />
                  </div>
               </div>
            </div>
          ))}
       </div>
    </div>
  );

  const BulkSendModal = ({ type }: { type: 'INIT' | 'REMIND' }) => {
    const isOpen = type === 'INIT' ? isBulkSendOpen : isReminderOpen;
    const setIsOpen = type === 'INIT' ? setIsBulkSendOpen : setIsReminderOpen;
    
    const [index, setIndex] = useState(0);
    const [showSkipConfirm, setShowSkipConfirm] = useState(false);

    useEffect(() => {
      if (isOpen) {
        setIndex(0);
        setShowSkipConfirm(false);
      }
    }, [isOpen]);

    if (!isOpen) return null;
    
    const people = prodPeople;
    if (people.length === 0) {
      return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3.5rem] p-12 border border-slate-200 dark:border-white/10 shadow-2xl relative text-center">
             <button onClick={() => setIsOpen(false)} className="absolute top-8 right-8 p-2 text-slate-500"><X /></button>
             <h3 className="text-2xl font-black mb-4">Nessun destinatario</h3>
             <p className="text-slate-500 mb-8 font-medium">Aggiungi membri alla crew per inviare richieste.</p>
             <button onClick={() => setIsOpen(false)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold">Chiudi</button>
          </div>
        </div>
      );
    }

    const currentPerson = people[index];
    const isLast = index === people.length - 1;
    
    const personInstances = prodInstances.filter(i => i.personId === currentPerson.id && i.productionId === selectedProdId);
    const targetInstances = type === 'INIT' 
      ? personInstances.filter(i => i.status === DocStatus.NOT_SENT)
      : personInstances.filter(i => i.status === DocStatus.SENT);
      
    const isAlreadyActioned = targetInstances.length === 0;

    const handleOpenWA = async () => {
      const link = getPublicLink(currentPerson);
      if (supabase) {
        // Track the request in Supabase
        await supabase.from('sign_requests').upsert({
          token: currentPerson.hubToken,
          production_id: selectedProdId,
          person_id: currentPerson.id,
          status: DocStatus.SENT,
          created_at: new Date().toISOString()
        }, { onConflict: 'token' });
      }
      const message = type === 'INIT' 
        ? `Ciao ${currentPerson.name}, ti ho inviato i documenti da firmare per ${activeProduction?.title}. Puoi accedere qui: ${link}`
        : `Ciao ${currentPerson.name}, ti ricordo di firmare i documenti per ${activeProduction?.title}. Puoi accedere qui: ${link}`;
      
      window.open(`https://wa.me/${currentPerson.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const handleMarkActioned = () => {
      const now = new Date().toISOString();
      setData(prev => ({
        ...prev,
        instances: prev.instances.map(inst => 
          (inst.personId === currentPerson.id && inst.productionId === selectedProdId && (type === 'INIT' ? inst.status === DocStatus.NOT_SENT : inst.status === DocStatus.SENT))
            ? { ...inst, status: DocStatus.SENT, sentAt: now }
            : inst
        )
      }));
    };

    const handleNext = (force: boolean = false) => {
      if (!isAlreadyActioned && !showSkipConfirm && !force) {
        setShowSkipConfirm(true);
        return;
      }
      
      setShowSkipConfirm(false);
      if (isLast) {
        setIsOpen(false);
        setTimeout(() => alert('Workflow completato'), 300);
      } else {
        setIndex(prev => prev + 1);
      }
    };

    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
        <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3.5rem] p-10 sm:p-12 border border-slate-200 dark:border-white/10 shadow-2xl relative">
          <button onClick={() => setIsOpen(false)} className="absolute top-8 right-8 p-2 bg-slate-100 dark:bg-white/5 rounded-2xl text-slate-500 hover:text-red-500 transition-all"><X className="w-6 h-6" /></button>
          
          <div className="mb-8">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">{type === 'INIT' ? 'Invia Richieste' : 'Invia Solleciti'}</h3>
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
                  disabled={isAlreadyActioned}
                  className={`py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isAlreadyActioned ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
                >
                  {isAlreadyActioned ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  {isAlreadyActioned ? 'Inviato' : 'Segna come Inviato'}
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

  const ReminderPreviewModal = () => {
    if (!isReminderPreviewOpen) return null;
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
        <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3.5rem] p-12 border border-slate-200 dark:border-white/10">
          <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-8">Anteprima WhatsApp</h3>
          <div className="bg-slate-50 dark:bg-white/5 p-8 rounded-[2rem] border border-slate-200 dark:border-white/10 mb-10 relative">
             <div className="absolute top-4 left-4 w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
             <p className="text-slate-600 dark:text-slate-300 font-medium italic leading-relaxed">
               "Ciao [Nome], ti ricordiamo di firmare il documento [Documento] per la produzione {activeProduction?.title}. Puoi farlo qui in pochi secondi: [Link]"
             </p>
          </div>
          <button onClick={() => setIsReminderPreviewOpen(false)} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-sm shadow-xl">Ho capito</button>
        </div>
      </div>
    );
  };

  const ImportCastModal = () => {
    const [text, setText] = useState('');
    if (!isImportModalOpen) return null;
    const handleImport = () => {
      const lines = text.split('\n').filter(l => l.trim());
      const newPeople: Person[] = lines.map(line => {
        const parts = line.split(',').map(s => s.trim());
        return {
          id: 'p-' + Date.now() + Math.random(),
          productionId: selectedProdId || '',
          name: parts[0] || 'Nuovo Membro',
          role: parts[1] || 'Troupe',
          department: 'General',
          whatsapp: parts[2] || '393330000000',
          hubToken: 'hub-' + Math.random().toString(36).substr(2, 9)
        };
      });
      setData(prev => ({ ...prev, people: [...prev.people, ...newPeople] }));
      setIsImportModalOpen(false);
      setText('');
    };
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
        <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3.5rem] p-12 border border-slate-200 dark:border-white/10 shadow-2xl">
          <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-4">Importazione Rapida</h3>
          <p className="text-slate-500 mb-8 font-medium">Incolla la lista della crew (Nome, Ruolo, WhatsApp) separati da virgola.</p>
          <textarea 
            value={text} 
            onChange={e => setText(e.target.value)} 
            placeholder="Mario Rossi, DOP, 393330000000&#10;Anna Neri, Runner, 393440000000"
            className="w-full h-64 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2rem] p-8 mb-8 outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm shadow-inner transition-all custom-scrollbar"
          />
          <div className="flex flex-col sm:flex-row gap-4">
            <button onClick={() => setIsImportModalOpen(false)} className="flex-1 py-5 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-black rounded-[2rem] hover:bg-slate-200 transition-all text-sm uppercase tracking-widest order-2 sm:order-1">Annulla</button>
            <button onClick={handleImport} className="flex-1 py-5 bg-indigo-600 text-white font-black rounded-[2rem] shadow-xl hover:bg-indigo-700 transition-all text-sm uppercase tracking-widest order-1 sm:order-2">Importa Crew</button>
          </div>
        </div>
      </div>
    );
  };

  const PdfMapperTool = () => {
    const template = data.templates.find(t => t.id === templateToMapId);
    if (!templateToMapId || !template) return null;
    return (
      <div className="fixed inset-0 z-[300] bg-slate-950/95 backdrop-blur-3xl flex flex-col animate-fade-in">
        <div className="h-24 border-b border-white/10 px-10 flex items-center justify-between">
           <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg"><FileText className="w-6 h-6" /></div>
              <div>
                 <h2 className="text-xl font-black text-white">Editor Campi</h2>
                 <p className="text-white/40 text-xs font-bold uppercase tracking-widest">{template.name}</p>
              </div>
           </div>
           <button onClick={() => setTemplateToMapId(null)} className="w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-red-500/20 text-white hover:text-red-500 rounded-2xl transition-all"><X className="w-6 h-6" /></button>
        </div>
        <div className="flex-1 overflow-auto p-12 flex justify-center custom-scrollbar">
           <div className="relative bg-white shadow-2xl rounded-sm">
              <img src={template.fileUrl} className="max-w-none w-[800px] h-auto" alt="PDF Page" />
              <div className="absolute inset-0 cursor-crosshair" onClick={(e) => {
                 const rect = e.currentTarget.getBoundingClientRect();
                 const xPct = (e.clientX - rect.left) / rect.width;
                 const yPct = (e.clientY - rect.top) / rect.height;
                 const id = prompt('Nome ID Campo (es: name, taxCode, sig)?');
                 if (id) {
                   const newField: FieldMapping = {
                     id, label: id.toUpperCase(), type: id === 'sig' ? 'signature' : 'text', x: 0, y: 0, xPct, yPct, page: 0
                   };
                   setData(prev => ({ ...prev, templates: prev.templates.map(t => t.id === templateToMapId ? { ...t, fields: [...t.fields, newField] } : t) }));
                 }
              }}>
                 {template.fields.map((f, i) => (
                   <div key={i} className={`absolute group border-2 ${f.type === 'signature' ? 'border-indigo-500 bg-indigo-500/20' : 'border-emerald-500 bg-emerald-500/20'} p-1 flex items-center justify-center`} style={{ left: `${(f.xPct || 0) * 100}%`, top: `${(f.yPct || 0) * 100}%`, transform: 'translate(-50%, -50%)', width: f.type === 'signature' ? '120px' : '80px', height: '24px' }}>
                      <span className="text-[8px] font-black uppercase text-slate-900 bg-white px-1 shadow-sm">{f.id}</span>
                      <button onClick={(ev) => { ev.stopPropagation(); setData(prev => ({ ...prev, templates: prev.templates.map(t => t.id === templateToMapId ? { ...t, fields: t.fields.filter((_, idx) => idx !== i) } : t) })); }} className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                   </div>
                 ))}
              </div>
           </div>
        </div>
        <div className="h-20 border-t border-white/10 bg-white/5 px-10 flex items-center justify-center gap-4">
           <Info className="w-5 h-5 text-indigo-400" />
           <p className="text-white/60 text-sm font-medium">Clicca ovunque sul PDF per posizionare un segnaposto. Usa <code className="bg-white/10 px-1.5 py-0.5 rounded text-white font-bold mx-1">sig</code> per il campo firma.</p>
        </div>
      </div>
    );
  };

  if (publicFormToken) return <PublicView />;

  const personToDelete = data.people.find(p => p.id === personToDeleteId);
  const personSignedCount = data.instances.filter(i => i.personId === personToDeleteId && i.status === DocStatus.SIGNED).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex overflow-hidden transition-all duration-300">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-y-auto custom-scrollbar lg:pl-[280px] w-full">
        <Header />
        <main className="p-6 sm:p-12 pb-32 max-w-7xl mx-auto w-full">
          {activeTab === 'DASHBOARD' && <DashboardContent />}
          {activeTab === 'PEOPLE' && <PeopleContent />}
          {activeTab === 'ARCHIVE' && <ArchiveContent />}
          {activeTab === 'PENDING' && <PendingContent />}
          {activeTab === 'TEMPLATES' && <TemplateContent />}
          {activeTab === 'PRODUCTIONS' && <ProductionsContent />}
        </main>
      </div>
      <NotificationsPanel />
      <BulkSendModal type="INIT" />
      <BulkSendModal type="REMIND" />
      <ReminderPreviewModal />
      <ImportCastModal />
      <PdfMapperTool />
      
      {isNewMemberModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] border border-slate-200 dark:border-white/10 shadow-2xl p-10">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-tight mb-8">Aggiungi Membro</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nome Completo</label>
                <input value={newMemberData.name} onChange={e => setNewMemberData({...newMemberData, name: e.target.value})} type="text" className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500 font-bold transition-all shadow-inner" placeholder="es. Mario Rossi" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Ruolo</label>
                  <input value={newMemberData.role} onChange={e => setNewMemberData({...newMemberData, role: e.target.value})} type="text" className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500 font-bold transition-all shadow-inner" placeholder="es. DOP" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Reparto</label>
                  <input value={newMemberData.department} onChange={e => setNewMemberData({...newMemberData, department: e.target.value})} type="text" className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500 font-bold transition-all shadow-inner" placeholder="es. Camera" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">WhatsApp</label>
                <input value={newMemberData.whatsapp} onChange={e => setNewMemberData({...newMemberData, whatsapp: e.target.value})} type="text" className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500 font-bold transition-all shadow-inner" placeholder="393330000000" />
              </div>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button onClick={() => setIsNewMemberModalOpen(false)} className="flex-1 py-5 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-black rounded-[2rem] hover:bg-slate-200 transition-all text-sm uppercase tracking-widest order-2 sm:order-1">Annulla</button>
                <button onClick={handleAddMember} className="flex-1 py-5 bg-indigo-600 text-white font-black rounded-[2rem] shadow-xl hover:bg-indigo-700 transition-all text-sm uppercase tracking-widest order-1 sm:order-2">Aggiungi Membro</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isNewProdModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] border border-slate-200 dark:border-white/10 shadow-2xl p-10 transition-all">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-tight mb-8">Nuovo Progetto</h3>
            <div className="space-y-6">
              <input value={newProdData.title} onChange={e => setNewProdData({...newProdData, title: e.target.value})} type="text" className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500 font-bold transition-all shadow-inner" placeholder="Titolo della Produzione" />
              <input value={newProdData.phone} onChange={e => setNewProdData({...newProdData, phone: e.target.value})} type="text" className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500 font-bold transition-all shadow-inner" placeholder="WhatsApp della Produzione" />
              <textarea value={newProdData.notes} onChange={e => setNewProdData({...newProdData, notes: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2rem] px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500 h-32 resize-none font-medium transition-all shadow-inner custom-scrollbar" placeholder="Note o descrizione del progetto..." />
              <button onClick={handleCreateProduction} className="w-full py-5 bg-indigo-600 text-white font-black rounded-[2rem] shadow-xl shadow-indigo-600/30 active:scale-95 transition-all text-sm uppercase tracking-widest">Crea Produzione</button>
            </div>
          </div>
        </div>
      )}

      {isRenameModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] border border-slate-200 dark:border-white/10 shadow-2xl p-10">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-tight mb-8">Gestione Progetto</h3>
            <div className="space-y-6">
              <input value={renameValue} onChange={e => setRenameValue(e.target.value)} type="text" className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500 font-bold transition-all shadow-inner" placeholder="Titolo" />
              <input value={renamePhone} onChange={e => setRenamePhone(e.target.value)} type="text" className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500 font-bold transition-all shadow-inner" placeholder="WhatsApp Produzione" />
              <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={() => setIsRenameModalOpen(false)} className="flex-1 py-5 bg-slate-100 dark:bg-white/5 text-slate-500 font-black rounded-[2rem] hover:bg-slate-200 transition-all text-sm uppercase tracking-widest order-2 sm:order-1">Annulla</button>
                <button onClick={handleUpdateProduction} className="flex-1 py-5 bg-indigo-600 text-white font-black rounded-[2rem] shadow-xl hover:bg-indigo-700 transition-all text-sm uppercase tracking-widest order-1 sm:order-2">Salva</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {templateToDeleteId && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-md rounded-[3rem] border border-slate-200 dark:border-white/10 shadow-2xl p-10 transition-all relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-3 bg-red-500" />
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-red-500/10 text-red-600 rounded-full flex items-center justify-center mb-8 shadow-sm"><AlertTriangle className="w-12 h-12" /></div>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-tight mb-3">Eliminare template?</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-10 font-medium">Vuoi eliminare definitivamente <b>{data.templates.find(t => t.id === templateToDeleteId)?.name}</b>? Questa operazione è irreversibile.</p>
              <div className="flex flex-col sm:flex-row w-full gap-4">
                <button onClick={() => setTemplateToDeleteId(null)} className="flex-1 py-5 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-black rounded-[2rem] hover:bg-slate-200 transition-all text-sm uppercase tracking-widest order-2 sm:order-1">Annulla</button>
                <button onClick={confirmDeleteTemplate} className="flex-1 py-5 bg-red-600 text-white font-black rounded-[2rem] shadow-xl hover:bg-red-700 transition-all text-sm uppercase tracking-widest order-1 sm:order-2">Elimina</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {personToDeleteId && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] border border-slate-200 dark:border-white/10 shadow-2xl p-10 transition-all relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-3 bg-red-500" />
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-red-500/10 text-red-600 rounded-full flex items-center justify-center mb-8 shadow-sm"><UserMinus className="w-12 h-12" /></div>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-tight mb-3">Eliminare membro?</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 font-medium leading-relaxed">
                Vuoi eliminare <b>{personToDelete?.name}</b> dalla produzione <b>{activeProduction?.title}</b>? 
              </p>
              
              {personSignedCount > 0 && (
                <div className="w-full p-5 mb-10 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-[1.5rem] text-left flex gap-4 shadow-inner">
                  <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <p className="text-[11px] text-amber-700 dark:text-amber-500 font-black leading-relaxed">
                    ATTENZIONE: Saranno eliminati anche i <b>{personSignedCount} PDF firmati</b> già archiviati.
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row w-full gap-4">
                <button onClick={() => setPersonToDeleteId(null)} className="flex-1 py-5 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-black rounded-[2rem] hover:bg-slate-200 transition-all text-sm uppercase tracking-widest order-2 sm:order-1">Annulla</button>
                <button onClick={confirmDeletePerson} className="flex-1 py-5 bg-red-600 text-white font-black rounded-[2rem] shadow-xl hover:bg-red-700 transition-all text-sm uppercase tracking-widest order-1 sm:order-2">Elimina</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
