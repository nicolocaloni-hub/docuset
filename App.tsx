
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileCheck, LayoutDashboard, Clapperboard, Users, FileText, Settings, 
  Plus, Search, MoreVertical, Send, MessageSquare, Download, Trash2, 
  CheckCircle, Clock, AlertCircle, ChevronRight, Filter, 
  ChevronDown, X, Check, LogOut, Bell, Menu, Loader, ShieldCheck, 
  ArrowRight, Archive, Inbox, ChevronUp, BellOff, Eye, Search as SearchIcon,
  FileIcon, FileUp, Info, Moon, Sun, Copy, ClipboardCheck, Phone, Layout,
  Share2, ArrowLeft, ExternalLink, Edit2, AlertTriangle, FileSpreadsheet,
  MousePointer2, History, Shield, FileQuestion, Mail, StickyNote, UserMinus
} from 'lucide-react';
import { 
  DocStatus, TemplateType, AppState, Production, Person, Template, 
  DocumentInstance, AppNotification, FieldMapping, FormState
} from './types';
import SignatureCanvasComponent from './components/SignatureCanvas';
import PublicForm from './components/PublicForm';

// PDF-LIB Global (imported in index.html)
declare const PDFLib: any;

const STORAGE_KEY = 'setdocs_app_data_v4';
const THEME_KEY = 'setdocs_theme';

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
    const existingPdfBytes = await fetch(template.fileUrl).then(res => res.arrayBuffer());
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
      
      // Calculate coordinates from percentages
      let x, y, width, height;
      
      if (field.xPct !== undefined && field.yPct !== undefined) {
        x = field.xPct * pageWidth;
        y = (1 - field.yPct) * pageHeight;
      } else {
        // Fallback to legacy pixels (assuming a standard preview width like 595)
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
        const value = formData[field.id] || '';
        const size = field.fontSize || 10;
        page.drawText(value, {
          x: x,
          y: y - (size / 2), // Vertical alignment adjustment
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
  const [newProdData, setNewProdData] = useState({ title: '', notes: '', phone: '' });
  const [renameValue, setRenameValue] = useState('');
  const [renamePhone, setRenamePhone] = useState('');

  // Delete State
  const [templateToDeleteId, setTemplateToDeleteId] = useState<string | null>(null);
  const [templateToMapId, setTemplateToMapId] = useState<string | null>(null);
  const [personToDeleteId, setPersonToDeleteId] = useState<string | null>(null);

  // Router-like state for public views
  const [publicHubToken, setPublicHubToken] = useState<string | null>(null);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/sign/')) {
        const parts = hash.split('/');
        setPublicHubToken(parts[2] || null);
        setActiveDocId(parts[4] || null);
      } else {
        setPublicHubToken(null);
        setActiveDocId(null);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const activeProduction = useMemo(() => data.productions.find(p => p.id === selectedProdId), [selectedProdId, data.productions]);
  const prodPeople = useMemo(() => data.people.filter(p => p.productionId === selectedProdId), [selectedProdId, data.people]);
  const prodInstances = useMemo(() => data.instances.filter(i => i.productionId === selectedProdId), [selectedProdId, data.instances]);
  const unreadCount = useMemo(() => data.notifications.filter(n => !n.readAt).length, [data.notifications]);

  // Bulk Reminder Recipient logic
  const reminderRecipients = useMemo(() => {
    return prodPeople.filter(p => {
      const instances = data.instances.filter(i => i.personId === p.id && i.productionId === selectedProdId);
      return p.whatsapp && instances.some(i => i.status === DocStatus.SENT);
    });
  }, [prodPeople, data.instances, selectedProdId]);

  // Actions
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

  const getPublicLink = (person: Person) => `${window.location.origin}${window.location.pathname}#/sign/${person.hubToken}`;

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

  // --- PUBLIC SIGNING HUB ---
  const SigningHub = () => {
    const person = useMemo(() => data.people.find(p => p.hubToken === publicHubToken), [publicHubToken, data.people]);
    
    if (!person) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 max-w-sm text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900">Accesso Negato</h2>
            <p className="text-slate-500 mt-2 text-sm">Il link di firma non è valido o è scaduto. Contatta la produzione per un nuovo invito.</p>
          </div>
        </div>
      );
    }

    const production = data.productions.find(p => p.id === person.productionId);
    
    // Find first available instance to sign for this person in this production
    const instance = data.instances.find(i => 
      i.personId === person.id && 
      i.productionId === person.productionId && 
      i.status !== DocStatus.SIGNED &&
      (!activeDocId || i.id === activeDocId)
    );

    if (!instance) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 max-w-md text-center">
            <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-slate-900">Ottimo lavoro!</h2>
            <p className="text-slate-500 mt-3">Hai completato tutti i documenti per <b>{production?.title}</b>. Riceverai una copia firmata non appena la produzione l'avrà archiviata.</p>
          </div>
        </div>
      );
    }

    const template = data.templates.find(t => t.id === instance.templateId);

    const handleComplete = async (formData: FormState) => {
      if (!template) return;
      
      try {
        // Map form data to template fields
        // INITIAL_DATA fields are 'name', 'date', 'sig'
        const mappedData: Record<string, string> = {
          name: `${formData.firstName} ${formData.lastName}`,
          date: new Date().toLocaleDateString(),
          role: formData.role,
          idNumber: formData.idNumber,
          birthDate: formData.birthDate
        };

        const { url, hash } = await generateSignedPdf(template, mappedData, formData.signature);
        
        const now = new Date().toISOString();
        const audit = {
          signedAt: now,
          typedName: `${formData.firstName} ${formData.lastName}`,
          userAgent: navigator.userAgent,
          pdfHash: hash,
          ip: 'protected'
        };

        setData(prev => {
          const newNotif: AppNotification = {
            id: 'n-' + Date.now(),
            productionId: person.productionId,
            personId: person.id,
            documentInstanceId: instance.id,
            type: 'DOCUMENT_SIGNED',
            title: 'Documento Firmato',
            message: `${person.name} ha firmato "${template.name}"`,
            createdAt: now,
            readAt: null
          };

          return {
            ...prev,
            instances: prev.instances.map(i => i.id === instance.id ? {
              ...i,
              status: DocStatus.SIGNED,
              signedAt: now,
              finalPdfUrl: url,
              auditJSON: JSON.stringify(audit)
            } : i),
            notifications: [newNotif, ...prev.notifications]
          };
        });
      } catch (err) {
        console.error("Signing Error:", err);
        alert("Si è verificato un errore durante la firma. Riprova.");
      }
    };

    return (
      <PublicForm 
        documentType={template?.name || 'Documento'} 
        recipientName={person.name} 
        onComplete={handleComplete} 
      />
    );
  };

  // --- MODALS & TOOLS ---

  const ImportCastModal = () => {
    const [csvText, setCsvText] = useState('');
    const [preview, setPreview] = useState<any[]>([]);

    const parse = () => {
      const rows = csvText.split('\n').filter(r => r.trim()).map(r => r.split(/[,\t]/));
      if (rows.length < 2) return;
      const headers = rows[0].map(h => h.trim().toLowerCase());
      const dataRows = rows.slice(1).map(row => {
        const obj: any = {};
        row.forEach((cell, i) => {
          const h = headers[i];
          if (h === 'nome' || h === 'fullname' || h === 'name') obj.name = cell.trim();
          if (h === 'ruolo' || h === 'role') obj.role = cell.trim();
          if (h === 'reparto' || h === 'dept' || h === 'department') obj.department = cell.trim();
          if (h === 'whatsapp' || h === 'phone') obj.whatsapp = cell.trim().replace(/\s+/g, '');
        });
        return obj;
      });
      setPreview(dataRows);
    };

    const handleImport = () => {
      if (!selectedProdId || preview.length === 0) return;
      const newPeople = preview.map(p => ({
        id: 'per-' + Date.now() + Math.random(),
        productionId: selectedProdId!,
        name: p.name || 'Senza Nome',
        role: p.role || 'Crew',
        department: p.department || 'Generale',
        whatsapp: p.whatsapp || '',
        hubToken: 'hub-' + Math.random().toString(36).substr(2, 9)
      }));
      setData(prev => ({ ...prev, people: [...prev.people, ...newPeople] }));
      setIsImportModalOpen(false);
      setCsvText('');
      setPreview([]);
    };

    if (!isImportModalOpen) return null;

    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl p-8 max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">Importa Cast & Crew</h3>
            <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400"><X className="w-6 h-6" /></button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar">
            <p className="text-sm text-slate-500">Incolla i dati da Excel/Sheets o un CSV (Nome, Ruolo, Reparto, WhatsApp).</p>
            <textarea 
              value={csvText} 
              onChange={e => setCsvText(e.target.value)} 
              onBlur={parse}
              placeholder="Nome, Ruolo, Reparto, WhatsApp"
              className="w-full h-40 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            {preview.length > 0 && (
              <div className="border border-slate-100 dark:border-white/5 rounded-2xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-white/5">
                    <tr><th className="px-3 py-2">Nome</th><th className="px-3 py-2">Ruolo</th><th className="px-3 py-2">WhatsApp</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {preview.slice(0, 5).map((p, i) => (
                      <tr key={i}><td className="px-3 py-2">{p.name}</td><td className="px-3 py-2">{p.role}</td><td className="px-3 py-2">{p.whatsapp}</td></tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 5 && <p className="p-2 text-[10px] text-center text-slate-400 font-bold">E altri {preview.length - 5} records...</p>}
              </div>
            )}
          </div>
          <button onClick={handleImport} disabled={preview.length === 0} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all mt-6 disabled:opacity-50">Importa {preview.length} persone</button>
        </div>
      </div>
    );
  };

  const PdfMapperTool = () => {
    const template = data.templates.find(t => t.id === templateToMapId);
    const [activeFieldId, setActiveFieldId] = useState<'name' | 'date' | 'sig'>('name');
    const containerRef = useRef<HTMLDivElement>(null);

    const handleClick = (e: React.MouseEvent) => {
      if (!containerRef.current || !template) return;
      const rect = containerRef.current.getBoundingClientRect();
      const xPct = (e.clientX - rect.left) / rect.width;
      const yPct = (e.clientY - rect.top) / rect.height;
      
      const newFields = template.fields.map(f => {
        if (f.id === activeFieldId) {
          // Set both legacy pixels (for visual UI here) and new percentages
          return { 
            ...f, 
            x: Math.round(xPct * rect.width), 
            y: Math.round(yPct * rect.height), 
            xPct: Number(xPct.toFixed(4)), 
            yPct: Number(yPct.toFixed(4)), 
            page: 0,
            wPct: f.id === 'sig' ? 0.2 : undefined,
            hPct: f.id === 'sig' ? 0.05 : undefined
          };
        }
        return f;
      });

      setData(prev => ({
        ...prev,
        templates: prev.templates.map(t => t.id === template.id ? { ...t, fields: newFields } : t)
      }));
    };

    if (!templateToMapId || !template) return null;

    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl">
        <div className="bg-white dark:bg-slate-900 w-full h-full max-w-5xl rounded-[3rem] border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col shadow-2xl animate-fade-in">
          <div className="p-6 border-b border-slate-100 dark:border-white/10 flex justify-between items-center bg-white dark:bg-slate-900 z-10">
            <div>
              <h3 className="font-black text-slate-900 dark:text-white">Mapping Campi PDF</h3>
              <p className="text-xs text-slate-500">I campi vengono salvati in percentuale per massima compatibilità.</p>
            </div>
            <button onClick={() => setTemplateToMapId(null)} className="p-2 bg-slate-100 dark:bg-white/5 rounded-xl text-slate-500 hover:text-red-500 transition-all"><X className="w-6 h-6" /></button>
          </div>
          
          <div className="flex-1 flex overflow-hidden">
            <div className="w-64 border-r border-slate-100 dark:border-white/5 p-6 space-y-2 bg-slate-50/50 dark:bg-slate-950/30">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Seleziona Campo</p>
              {[
                { id: 'name', label: 'Nome Completo', icon: Users },
                { id: 'date', label: 'Data Firma', icon: Clock },
                { id: 'sig', label: 'Posizione Firma', icon: MousePointer2 },
              ].map(f => (
                <button 
                  key={f.id} 
                  onClick={() => setActiveFieldId(f.id as any)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all ${activeFieldId === f.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:border-indigo-500 border border-transparent'}`}
                >
                  <f.icon className="w-4 h-4" />
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex-1 bg-slate-200 dark:bg-slate-950 overflow-auto p-12 flex justify-center custom-scrollbar relative">
              <div 
                ref={containerRef}
                onClick={handleClick}
                className="relative bg-white shadow-2xl cursor-crosshair h-fit w-full max-w-[600px] aspect-[1/1.414]"
              >
                <iframe src={template.fileUrl} className="w-full h-full pointer-events-none absolute inset-0 opacity-50" />
                {template.fields.map(f => (f.xPct !== undefined || f.x > 0) && (
                  <div 
                    key={f.id} 
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded text-[8px] font-black uppercase border-2 flex items-center gap-1 shadow-lg pointer-events-none transition-all ${activeFieldId === f.id ? 'bg-indigo-600 text-white border-white scale-110 z-20' : 'bg-white text-indigo-600 border-indigo-600 z-10'}`}
                    style={{ 
                      left: f.xPct !== undefined ? `${f.xPct * 100}%` : `${f.x}px`, 
                      top: f.yPct !== undefined ? `${f.yPct * 100}%` : `${f.y}px` 
                    }}
                  >
                    {f.id === 'sig' ? <MousePointer2 className="w-2 h-2" /> : f.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-6 border-t border-slate-100 dark:border-white/10 bg-white dark:bg-slate-900 flex justify-end">
             <button onClick={() => setTemplateToMapId(null)} className="px-10 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-600/20 active:scale-95 transition-all">Salva Mappatura</button>
          </div>
        </div>
      </div>
    );
  };

  const ReminderPreviewModal = () => {
    if (!isReminderPreviewOpen) return null;

    return (
      <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
        <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col max-h-[85vh]">
          <div className="p-8 border-b border-slate-100 dark:border-white/10 flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Sollecitare firme?</h3>
              <p className="text-slate-500 text-sm mt-1">Destinatari: <b>{reminderRecipients.length}</b></p>
            </div>
            <button onClick={() => setIsReminderPreviewOpen(false)} className="text-slate-400 p-2"><X className="w-6 h-6" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-4">
             <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Anteprima Messaggio</p>
                <div className="text-xs text-slate-600 dark:text-slate-400 italic">
                   "Ciao {reminderRecipients[0]?.name || '...'}, piccolo promemoria: ti chiedo di completare i documenti per {activeProduction?.title} qui: {window.location.origin}/#/sign/..."
                </div>
             </div>

             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Lista Destinatari</p>
             <div className="space-y-2">
                {reminderRecipients.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-xl shadow-sm">
                     <span className="text-sm font-bold text-slate-900 dark:text-white">{p.name}</span>
                     <span className="text-xs text-slate-500">{p.whatsapp}</span>
                  </div>
                ))}
             </div>
          </div>

          <div className="p-8 border-t border-slate-100 dark:border-white/10 flex gap-4">
            <button onClick={() => setIsReminderPreviewOpen(false)} className="flex-1 py-4 bg-slate-100 dark:bg-white/5 text-slate-500 font-black rounded-2xl">Annulla</button>
            <button 
              onClick={() => { setIsReminderPreviewOpen(false); setIsReminderOpen(true); }} 
              className="flex-[2] py-4 bg-amber-500 text-white font-black rounded-2xl shadow-xl shadow-amber-500/20 hover:bg-amber-600 transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-5 h-5" />
              Avvia invio guidato
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --- PRODUCER COMPONENTS ---

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
          onClick={() => setIsNotificationsOpen(true)}
          className="p-2.5 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 rounded-xl relative hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
        >
          <Bell className="w-5 h-5" />
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
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
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
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden max-h-64 overflow-y-auto custom-scrollbar">
                  {data.productions.map(p => (
                    <button 
                      key={p.id}
                      onClick={() => { setSelectedProdId(p.id); setIsProdDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between transition-colors ${selectedProdId === p.id ? 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                    >
                      <span className="truncate font-semibold">{p.title}</span>
                      {selectedProdId === p.id && <Check className="w-3 h-3" />}
                    </button>
                  ))}
                  <button 
                    onClick={() => { setIsNewProdModalOpen(true); setIsProdDropdownOpen(false); }}
                    className="w-full text-left px-4 py-3 text-sm font-bold text-indigo-600 dark:text-indigo-400 border-t border-slate-100 dark:border-white/10 hover:bg-indigo-600/5 transition-colors flex items-center gap-2"
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
      <div className={`fixed top-0 right-0 z-[70] w-full max-sm bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/5 h-screen transition-transform duration-300 ${isNotificationsOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full'}`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
             <h3 className="text-xl font-black text-slate-900 dark:text-white">Notifiche</h3>
             <button onClick={() => setIsNotificationsOpen(false)} className="p-2 bg-slate-100 dark:bg-white/5 rounded-xl text-slate-500"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4">
             {data.notifications.length === 0 ? (
               <div className="py-20 text-center text-slate-400">Nessun aggiornamento.</div>
             ) : (
               data.notifications.map(n => (
                 <div key={n.id} onClick={() => { markNotifRead(n.id); setActiveTab('ARCHIVE'); setIsNotificationsOpen(false); }} className={`p-4 rounded-2xl border transition-all cursor-pointer ${n.readAt ? 'bg-slate-50 dark:bg-white/[0.02] border-slate-100 dark:border-white/5 opacity-60' : 'bg-indigo-600/5 border-indigo-500/20 ring-1 ring-indigo-500/10 shadow-sm'}`}>
                    <div className="flex gap-3">
                       <div className="w-10 h-10 rounded-xl bg-indigo-600/10 flex items-center justify-center text-indigo-600"><CheckCircle className="w-5 h-5" /></div>
                       <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{n.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
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
    <div className="space-y-8 animate-fade-in">
       <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { label: 'Totale Crew', value: prodPeople.length, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10', tab: 'PEOPLE' },
            { label: 'Firmati', value: prodInstances.filter(i => i.status === DocStatus.SIGNED).length, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', tab: 'ARCHIVE' },
            { label: 'In Attesa', value: prodInstances.filter(i => i.status !== DocStatus.SIGNED).length, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', tab: 'PENDING' },
          ].map((s, i) => (
            <div key={i} onClick={() => setActiveTab(s.tab as any)} className="bg-white p-6 dark:bg-white/5 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm transition-all hover:shadow-md hover:border-indigo-500/30 cursor-pointer group">
               <div className={`${s.bg} w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${s.color} transition-transform group-hover:scale-110`}>
                  <s.icon className="w-6 h-6" />
               </div>
               <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{s.label}</p>
               <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">{s.value}</p>
            </div>
          ))}
       </div>

       <div className="bg-white dark:bg-white/5 rounded-3xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
             <h3 className="font-bold text-slate-900 dark:text-white">Attività Recenti</h3>
             <button onClick={() => setActiveTab('PEOPLE')} className="text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:underline">Vedi Tutti</button>
          </div>
          <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-white/[0.02] text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-widest border-b border-slate-100 dark:border-white/10">
                   <tr>
                      <th className="px-6 py-4">Destinatario</th>
                      <th className="px-6 py-4">Stato</th>
                      <th className="px-6 py-4 text-right">Azioni</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                   {prodInstances.slice().reverse().slice(0, 5).map(inst => {
                     const p = data.people.find(x => x.id === inst.personId);
                     const t = data.templates.find(x => x.id === inst.templateId);
                     return (
                       <tr key={inst.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-all">
                          <td className="px-6 py-4">
                             <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{p?.name}</p>
                             <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">{t?.name}</p>
                          </td>
                          <td className="px-6 py-4">
                             <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${inst.status === DocStatus.SIGNED ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'}`}>{inst.status}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <button onClick={() => { if(p) window.open(`https://wa.me/${p.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Ciao ${p.name}, hai novità per il documento? ${getPublicLink(p)}`)}`, '_blank') }} className="p-2 text-slate-400 hover:text-green-500 transition-colors"><MessageSquare className="w-4 h-4" /></button>
                          </td>
                       </tr>
                     );
                   })}
                   {prodInstances.length === 0 && (
                     <tr><td colSpan={3} className="py-20 text-center text-slate-400 text-sm italic">Nessun documento assegnato.</td></tr>
                   )}
                </tbody>
             </table>
          </div>
       </div>
    </div>
  );

  const BulkSendModal = ({ type = 'INIT' }: { type?: 'INIT' | 'REMIND' }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});

    const recipients = useMemo(() => {
      if (type === 'REMIND') return reminderRecipients;
      return prodPeople.map(p => {
        const pending = data.instances.filter(i => i.personId === p.id && i.productionId === selectedProdId && i.status === DocStatus.NOT_SENT);
        return { ...p, pendingCount: pending.length };
      }).filter(p => p.pendingCount > 0);
    }, [prodPeople, data.instances, selectedProdId, type, reminderRecipients]);

    const getMessage = (p: any) => {
      const intro = type === 'REMIND' ? `Ciao ${p.name}, piccolo promemoria:` : `Ciao ${p.name},`;
      return `${intro} per la produzione "${activeProduction?.title}" abbiamo dei documenti da firmare digitalmente. Puoi firmarli tutti comodamente qui:\n\n${getPublicLink(p)}\n\nGrazie!`;
    };

    const currentRecipient = recipients[currentIndex];
    const isOpen = type === 'INIT' ? isBulkSendOpen : isReminderOpen;
    const closer = () => type === 'INIT' ? setIsBulkSendOpen(false) : setIsReminderOpen(false);

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
        <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
          <div className="p-8 border-b border-slate-100 dark:border-white/10 flex justify-between items-start">
            <div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">{type === 'REMIND' ? 'Invia Solleciti' : 'Invia Richieste'}</h3>
              <p className="text-slate-500 text-sm mt-1">Stai gestendo {recipients.length} persone.</p>
            </div>
            <button onClick={closer} className="text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white p-2 bg-slate-100 dark:bg-white/5 rounded-xl transition-all"><X className="w-6 h-6" /></button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
            {recipients.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold text-slate-900 dark:text-white">Nessuna azione necessaria</h4>
                <p className="text-slate-500 text-sm mt-2">Non ci sono destinatari idonei per questa azione.</p>
              </div>
            ) : (
              currentRecipient && (
                <div className="space-y-8 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Destinatario {currentIndex + 1} di {recipients.length}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-100 dark:border-white/5">
                    <h4 className="text-xl font-black text-slate-900 dark:text-white">{currentRecipient.name}</h4>
                    <p className="text-sm font-medium text-slate-500">{currentRecipient.whatsapp}</p>
                  </div>
                  <div className="flex flex-col gap-4">
                    <button 
                      onClick={() => window.open(`https://wa.me/${currentRecipient.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(getMessage(currentRecipient))}`, '_blank')}
                      className="w-full py-4 bg-green-600 text-white font-black rounded-2xl shadow-xl shadow-green-500/20 hover:bg-green-700 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                    >
                      <MessageSquare className="w-6 h-6" />
                      Apri WhatsApp
                    </button>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => {
                          setData(prev => ({
                            ...prev,
                            instances: prev.instances.map(i => i.personId === currentRecipient.id && i.status === DocStatus.NOT_SENT ? { ...i, status: DocStatus.SENT, sentAt: new Date().toISOString() } : i)
                          }));
                          if (currentIndex < recipients.length - 1) setCurrentIndex(v => v + 1);
                          else closer();
                        }}
                        className="flex-1 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-5 h-5" />
                        Segna come Inviato
                      </button>
                      <button 
                        disabled={currentIndex === recipients.length - 1}
                        onClick={() => setCurrentIndex(prev => prev + 1)}
                        className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 group"
                      >
                        Avanti
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    );
  };

  const TemplateContent = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [previewId, setPreviewId] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      const reader = new FileReader();
      reader.onload = () => {
        const newTemp: Template = {
          id: 't-' + Date.now(),
          name: file.name.split('.')[0],
          type: TemplateType.OTHER,
          fileUrl: reader.result as string,
          fileName: file.name,
          fileType: file.type,
          isBlank: true,
          fields: [
            { id: 'name', label: 'Nome Completo', type: 'text', x: 0, y: 0, xPct: 0.1, yPct: 0.1, page: 0 },
            { id: 'date', label: 'Data Firma', type: 'text', x: 0, y: 0, xPct: 0.1, yPct: 0.15, page: 0 },
            { id: 'sig', label: 'Firma', type: 'signature', x: 0, y: 0, xPct: 0.1, yPct: 0.5, page: 0, wPct: 0.2, hPct: 0.05 },
          ],
          createdAt: new Date().toISOString()
        };
        setData(prev => ({ ...prev, templates: [...prev.templates, newTemp] }));
        setUploading(false);
      };
      reader.readAsDataURL(file);
    };

    const activePreview = data.templates.find(t => t.id === previewId);

    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between w-full">
          <div className="w-full">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight">Libreria Template</h2>
            <p className="text-slate-500 dark:text-slate-500 text-sm mt-1">Modelli globali pronti per la firma.</p>
          </div>
          <button onClick={() => fileInputRef.current?.click()} className="w-full sm:w-auto px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 text-sm sm:text-base">
            {uploading ? <Loader className="animate-spin" /> : <Plus className="w-5 h-5" />} Nuovo Template
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.docx" onChange={handleUpload} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.templates.map(t => {
            const isDocx = t.fileName.toLowerCase().endsWith('.docx');
            return (
              <div key={t.id} className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-all group relative">
                 <div className="w-12 h-12 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-105 transition-transform">
                   {isDocx ? <FileText className="w-6 h-6 text-slate-400" /> : <FileText className="w-6 h-6" />}
                 </div>
                 <h4 className="font-bold text-slate-900 dark:text-white truncate">{t.name}</h4>
                 <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">{t.type} • {isDocx ? 'DOCX' : 'PDF'}</p>
                 
                 {isDocx && (
                   <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-xl">
                      <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-[9px] text-amber-700 dark:text-amber-500 leading-tight">Solo PDF supporta firma online. Converti e ricarica per abilitarla.</p>
                   </div>
                 )}

                 <div className="mt-8 flex gap-2">
                    <button onClick={() => setPreviewId(t.id)} className="flex-1 py-3 bg-slate-100 dark:bg-white/5 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-indigo-600 hover:text-white transition-all text-xs">Apri</button>
                    {!isDocx && <button onClick={() => setTemplateToMapId(t.id)} className="p-3 bg-indigo-600/10 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all" title="Mappa Campi"><MousePointer2 className="w-4 h-4" /></button>}
                    <button onClick={() => setTemplateToDeleteId(t.id)} className="p-3 bg-red-500/10 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all"><Trash2 className="w-4 h-4" /></button>
                 </div>
              </div>
            );
          })}
        </div>

        {previewId && activePreview && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl">
             <div className="bg-white dark:bg-slate-900 w-full h-full max-w-5xl rounded-[3rem] border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col shadow-2xl">
                <div className="p-6 border-b border-slate-100 dark:border-white/10 flex justify-between items-center">
                   <h3 className="font-bold text-slate-900 dark:text-white truncate pr-4">{activePreview.name}</h3>
                   <button onClick={() => setPreviewId(null)} className="p-2 text-slate-500 hover:text-slate-900"><X className="w-6 h-6" /></button>
                </div>
                <div className="flex-1 overflow-hidden">
                   {activePreview.fileName.toLowerCase().endsWith('.docx') ? (
                     <div className="h-full flex flex-col items-center justify-center text-center p-12">
                        <FileText className="w-20 h-20 text-slate-200 mb-4" />
                        <h4 className="text-xl font-bold mb-2">Documento DOCX</h4>
                        <p className="text-slate-500 max-w-md mx-auto mb-8">L'anteprima nel browser e la firma online non sono disponibili per file Word. Scarica il file per visualizzarlo o caricalo in formato PDF.</p>
                        <a href={activePreview.fileUrl} download={activePreview.fileName} className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl flex items-center gap-2">
                          <Download className="w-5 h-5" /> Scarica DOCX
                        </a>
                     </div>
                   ) : (
                     <iframe src={activePreview.fileUrl} className="w-full h-full border-none" />
                   )}
                </div>
             </div>
          </div>
        )}
      </div>
    );
  };

  const PeopleContent = () => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const [newPerson, setNewPerson] = useState({ 
      name: '', 
      role: '', 
      dept: '', 
      whatsapp: '', 
      email: '', 
      notes: '' 
    });
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const validate = () => {
      const errors: Record<string, string> = {};
      if (!newPerson.name.trim()) errors.name = "Nome e Cognome obbligatori";
      if (!newPerson.whatsapp.trim()) errors.whatsapp = "Numero WhatsApp obbligatorio";
      setFormErrors(errors);
      return Object.keys(errors).length === 0;
    };

    const handleAddPerson = () => {
      if (!validate() || !selectedProdId) return;
      
      // Normalize WhatsApp: only digits and optional leading +
      const normalizedWhatsapp = newPerson.whatsapp.replace(/[^\d+]/g, '');

      const person: Person = {
        id: 'per-' + Date.now() + Math.random().toString(36).substr(2, 4),
        productionId: selectedProdId,
        name: newPerson.name.trim(),
        role: newPerson.role.trim() || 'Crew',
        department: newPerson.dept.trim() || 'Generale',
        whatsapp: normalizedWhatsapp,
        email: newPerson.email.trim(),
        notes: newPerson.notes.trim(),
        hubToken: 'hub-' + Math.random().toString(36).substr(2, 9)
      };

      setData(prev => ({ ...prev, people: [...prev.people, person] }));
      setNewPerson({ name: '', role: '', dept: '', whatsapp: '', email: '', notes: '' });
      setFormErrors({});
      setIsAddModalOpen(false);
    };

    return (
      <div className="space-y-8 animate-fade-in w-full">
        {/* Header Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between w-full">
           <div className="w-full">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight">Cast & Crew</h2>
              <p className="text-slate-500 text-sm mt-1">Gestisci i membri del progetto corrente.</p>
           </div>
           <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:gap-3">
              <button onClick={() => setIsImportModalOpen(true)} className="col-span-2 sm:col-span-1 px-4 py-3 bg-slate-100 dark:bg-white/5 rounded-2xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2 text-sm sm:text-base">
                <FileSpreadsheet className="w-5 h-5 flex-shrink-0" /> Importa
              </button>
              <button onClick={() => setIsBulkSendOpen(true)} className="col-span-1 px-4 py-3 bg-green-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-green-600/20 hover:bg-green-700 transition-all active:scale-95 text-sm sm:text-base">
                <Send className="w-5 h-5 flex-shrink-0" /> Invia richieste
              </button>
              <button onClick={() => setIsAddModalOpen(true)} className="col-span-1 px-4 py-3 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 text-sm sm:text-base">
                <Plus className="w-5 h-5 flex-shrink-0" /> Nuovo Membro
              </button>
           </div>
        </div>

        {/* Mobile View (Card List) */}
        <div className="sm:hidden space-y-4">
          {prodPeople.map(p => {
            const instances = prodInstances.filter(i => i.personId === p.id);
            const hasSentButNotSigned = instances.some(i => i.status === DocStatus.SENT);
            return (
              <div key={p.id} className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-[2rem] shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <p className="font-black text-slate-900 dark:text-white text-base truncate">{p.name}</p>
                    <p className="text-xs text-slate-500 font-medium">{p.whatsapp}</p>
                  </div>
                  <button onClick={() => setPersonToDeleteId(p.id)} className="p-2 text-red-500 bg-red-500/10 rounded-xl">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-slate-100 dark:bg-white/10 rounded text-[10px] font-black text-slate-500 uppercase">{p.role}</span>
                  <span className="px-2 py-1 bg-indigo-600/10 rounded text-[10px] font-black text-indigo-600 uppercase">{p.department}</span>
                </div>

                <div className="pt-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Documenti</p>
                  <div className="flex flex-wrap gap-1.5">
                    {instances.map(i => {
                      const t = data.templates.find(temp => temp.id === i.templateId);
                      const isDocx = t?.fileName.toLowerCase().endsWith('.docx');
                      return (
                        <div key={i.id} className={`group relative px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border flex items-center gap-1.5 ${i.status === DocStatus.SIGNED ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-slate-100 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10'}`}>
                          {t?.name} {isDocx && <FileQuestion className="w-3 h-3 text-amber-500" />}
                          <button onClick={() => deleteInstance(i.id)} className="text-red-500 ml-1">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                    <button onClick={() => setAssigningId(p.id)} className="p-1.5 text-indigo-600 dark:text-indigo-400 border border-dashed border-indigo-600/30 rounded-lg">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  {hasSentButNotSigned && (
                    <button onClick={() => window.open(`https://wa.me/${p.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Ehi ${p.name}, piccolo promemoria: ti chiedo di completare i documenti qui: ${getPublicLink(p)}`)}`, '_blank')} className="flex-1 py-3 bg-amber-500/10 text-amber-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4" /> Sollecita
                    </button>
                  )}
                  <button onClick={() => window.open(`https://wa.me/${p.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Ciao ${p.name}, ecco il link per firmare i documenti: ${getPublicLink(p)}`)}`, '_blank')} className="flex-1 py-3 bg-green-500/10 text-green-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                    <Share2 className="w-4 h-4" /> Invia Link
                  </button>
                </div>
              </div>
            );
          })}
          {prodPeople.length === 0 && (
            <div className="text-center py-10 bg-white dark:bg-white/5 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">
              <p className="text-slate-400 text-sm italic">Nessun membro trovato.</p>
            </div>
          )}
        </div>

        {/* Desktop View (Table) */}
        <div className="hidden sm:block bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2.5rem] overflow-hidden shadow-sm">
           <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left min-w-[750px]">
                 <thead className="bg-slate-50 dark:bg-white/[0.02] text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-widest border-b border-slate-100 dark:border-white/10">
                    <tr>
                       <th className="px-6 py-4">Nome</th>
                       <th className="px-6 py-4">Ruolo / Reparto</th>
                       <th className="px-6 py-4">Documenti</th>
                       <th className="px-6 py-4 text-right">Azioni</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {prodPeople.map(p => {
                      const instances = prodInstances.filter(i => i.personId === p.id);
                      const hasSentButNotSigned = instances.some(i => i.status === DocStatus.SENT);
                      return (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-all">
                           <td className="px-6 py-4">
                              <p className="font-bold text-slate-900 dark:text-white text-sm">{p.name}</p>
                              <p className="text-xs text-slate-500 font-medium">{p.whatsapp}</p>
                           </td>
                           <td className="px-6 py-4">
                              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{p.role}</p>
                              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{p.department}</p>
                           </td>
                           <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1.5 max-w-xs">
                                 {instances.map(i => {
                                   const t = data.templates.find(temp => temp.id === i.templateId);
                                   const isDocx = t?.fileName.toLowerCase().endsWith('.docx');
                                   return (
                                     <div key={i.id} className={`group relative px-2 py-0.5 rounded text-[9px] font-black uppercase border flex items-center gap-1 ${i.status === DocStatus.SIGNED ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-slate-100 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10'}`}>
                                        {t?.name} {isDocx && <FileQuestion className="w-2.5 h-2.5 text-amber-500" />}
                                        <button onClick={() => deleteInstance(i.id)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity"><X className="w-3 h-3" /></button>
                                     </div>
                                   );
                                 })}
                                 <button onClick={() => setAssigningId(p.id)} className="p-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600/10 rounded transition-all"><Plus className="w-3.5 h-3.5" /></button>
                              </div>
                           </td>
                           <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {hasSentButNotSigned && (
                                  <button onClick={() => window.open(`https://wa.me/${p.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Ehi ${p.name}, piccolo promemoria: ti chiedo di completare i documenti qui: ${getPublicLink(p)}`)}`, '_blank')} className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl hover:bg-amber-500 hover:text-white transition-all shadow-sm" title="Sollecita"><Clock className="w-4 h-4" /></button>
                                )}
                                <button onClick={() => window.open(`https://wa.me/${p.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Ciao ${p.name}, ecco il link per firmare i documenti: ${getPublicLink(p)}`)}`, '_blank')} className="p-2.5 bg-green-500/10 text-green-600 rounded-xl hover:bg-green-500 hover:text-white transition-all shadow-sm" title="Invia Link"><Share2 className="w-4 h-4" /></button>
                                <button onClick={() => setPersonToDeleteId(p.id)} className="p-2.5 bg-red-500/10 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm" title="Elimina membro"><Trash2 className="w-4 h-4" /></button>
                              </div>
                           </td>
                        </tr>
                      );
                    })}
                    {prodPeople.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-20 text-center text-slate-400 text-sm italic">Nessun membro trovato. Inizia aggiungendo il primo!</td>
                      </tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>

        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl p-6 sm:p-10 transition-all max-h-[95vh] flex flex-col overflow-hidden">
              <div className="flex justify-between items-center mb-6 sm:mb-8">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Nuovo Membro</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block px-1">Nome e Cognome *</label>
                    <div className="relative">
                      <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        required
                        value={newPerson.name} 
                        onChange={e => setNewPerson({...newPerson, name: e.target.value})} 
                        type="text" 
                        placeholder="Marco Rossi"
                        className={`w-full bg-slate-50 dark:bg-white/5 border ${formErrors.name ? 'border-red-500' : 'border-slate-200 dark:border-white/10'} rounded-2xl pl-11 pr-4 py-3.5 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-medium transition-all shadow-inner`} 
                      />
                    </div>
                    {formErrors.name && <p className="text-[10px] text-red-500 font-bold px-1">{formErrors.name}</p>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block px-1">WhatsApp *</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        required
                        value={newPerson.whatsapp} 
                        onChange={e => setNewPerson({...newPerson, whatsapp: e.target.value})} 
                        type="text" 
                        placeholder="+39 333 0000000"
                        className={`w-full bg-slate-50 dark:bg-white/5 border ${formErrors.whatsapp ? 'border-red-500' : 'border-slate-200 dark:border-white/10'} rounded-2xl pl-11 pr-4 py-3.5 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-medium transition-all shadow-inner`} 
                      />
                    </div>
                    {formErrors.whatsapp && <p className="text-[10px] text-red-500 font-bold px-1">{formErrors.whatsapp}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block px-1">Email (opzionale)</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        value={newPerson.email} 
                        onChange={e => setNewPerson({...newPerson, email: e.target.value})} 
                        type="email" 
                        placeholder="m.rossi@email.it"
                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl pl-11 pr-4 py-3.5 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-medium transition-all shadow-inner" 
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block px-1">Ruolo</label>
                    <input 
                      value={newPerson.role} 
                      onChange={e => setNewPerson({...newPerson, role: e.target.value})} 
                      type="text" 
                      placeholder="DOP, Attore, Runner..."
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-medium transition-all shadow-inner" 
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block px-1">Reparto</label>
                  <input 
                    value={newPerson.dept} 
                    onChange={e => setNewPerson({...newPerson, dept: e.target.value})} 
                    type="text" 
                    placeholder="Camera, Produzione, Art Department..."
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-medium transition-all shadow-inner" 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block px-1">Note (visibili solo alla produzione)</label>
                  <div className="relative">
                    <StickyNote className="absolute left-4 top-4 w-4 h-4 text-slate-400" />
                    <textarea 
                      value={newPerson.notes} 
                      onChange={e => setNewPerson({...newPerson, notes: e.target.value})} 
                      placeholder="Info aggiuntive, dettagli contrattuali..."
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl pl-11 pr-4 py-4 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-medium h-32 resize-none transition-all shadow-inner" 
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 sm:pt-8 border-t border-slate-100 dark:border-white/5 mt-4 flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-black rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all text-sm sm:text-base order-2 sm:order-1"
                >
                  Annulla
                </button>
                <button 
                  onClick={handleAddPerson}
                  disabled={!newPerson.name.trim() || !newPerson.whatsapp.trim()}
                  className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base order-1 sm:order-2"
                >
                  Crea Membro
                </button>
              </div>
            </div>
          </div>
        )}

        {assigningId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
             <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200 dark:border-white/10 p-8 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-black text-slate-900 dark:text-white">Assegna Documento</h3>
                   <button onClick={() => setAssigningId(null)} className="text-slate-400"><X className="w-6 h-6" /></button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                   {data.templates.map(t => (
                     <button key={t.id} onClick={() => { addInstance(assigningId, t.id); setAssigningId(null); }} className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl hover:border-indigo-500 transition-all text-left group">
                        <span className="font-bold text-sm text-slate-800 dark:text-slate-200 group-hover:text-indigo-600">{t.name}</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-all" />
                     </button>
                   ))}
                </div>
             </div>
          </div>
        )}
      </div>
    );
  };

  const ArchiveContent = () => {
    const signedList = prodInstances.filter(i => i.status === DocStatus.SIGNED);
    const [auditInst, setAuditInst] = useState<DocumentInstance | null>(null);

    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex flex-col gap-1 w-full">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight">Archivio (Firmati)</h2>
            <p className="text-slate-500 text-sm">Sfoglia i documenti completati e certificati.</p>
        </div>
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2.5rem] overflow-hidden shadow-sm">
           <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left min-w-[600px]">
                 <thead className="bg-slate-50 dark:bg-white/[0.02] text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-widest border-b border-slate-100 dark:border-white/10">
                    <tr><th className="px-6 py-4">Destinatario</th><th className="px-6 py-4">Documento</th><th className="px-6 py-4">Data Firma</th><th className="px-6 py-4 text-right">Audit / PDF</th></tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {signedList.map(inst => {
                      const p = data.people.find(x => x.id === inst.personId);
                      const t = data.templates.find(x => x.id === inst.templateId);
                      return (
                        <tr key={inst.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-all">
                           <td className="px-6 py-4 font-bold text-sm">{p?.name}</td>
                           <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{t?.name}</td>
                           <td className="px-6 py-4 text-xs font-bold text-slate-500">{inst.signedAt ? new Date(inst.signedAt).toLocaleDateString() : '-'}</td>
                           <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => setAuditInst(inst)} className="p-2 text-indigo-600 hover:bg-indigo-600/10 rounded-xl transition-all" title="Audit Trail"><History className="w-4 h-4" /></button>
                                {inst.finalPdfUrl && <a href={inst.finalPdfUrl} download={`FIRMATA_${p?.name}_${t?.name}.pdf`} className="p-2 text-indigo-600 hover:bg-indigo-600/10 rounded-xl transition-all"><Download className="w-4 h-4" /></a>}
                              </div>
                           </td>
                        </tr>
                      );
                    })}
                    {signedList.length === 0 && (
                      <tr><td colSpan={4} className="py-20 text-center text-slate-400 text-sm italic">Nessun documento firmato ancora.</td></tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>

        {auditInst && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 border border-slate-200 dark:border-white/10 shadow-2xl">
               <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-black text-slate-900 dark:text-white">Audit Trail</h3>
                 <button onClick={() => setAuditInst(null)} className="text-slate-400"><X className="w-6 h-6" /></button>
               </div>
               <div className="space-y-4">
                 <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                   <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Dati Certificazione</p>
                   {(() => {
                     const audit = auditInst.auditJSON ? JSON.parse(auditInst.auditJSON) : {};
                     return (
                       <div className="space-y-2 font-mono text-[10px] break-all">
                         <p><b>Firmato:</b> {audit.signedAt}</p>
                         <p><b>Nome digitato:</b> {audit.typedName}</p>
                         <p><b>Browser:</b> {audit.userAgent}</p>
                         <p className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5 flex items-center gap-2 text-indigo-600 font-bold">
                           <Shield className="w-3 h-3" />
                           HASH SHA-256:
                         </p>
                         <p className="text-slate-500">{audit.pdfHash}</p>
                       </div>
                     );
                   })()}
                 </div>
               </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const PendingContent = () => {
    const pendingList = prodInstances.filter(i => i.status !== DocStatus.SIGNED);
    
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between w-full">
          <div className="w-full">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight">In Attesa</h2>
            <p className="text-slate-500 text-sm mt-1">Documenti assegnati ma non ancora firmati.</p>
          </div>
          <button 
            disabled={reminderRecipients.length === 0}
            onClick={() => setIsReminderPreviewOpen(true)} 
            className="w-full sm:w-auto px-6 py-4 bg-amber-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 hover:bg-amber-600 transition-all disabled:opacity-50 disabled:grayscale text-sm sm:text-base"
          >
            <Clock className="w-5 h-5" /> 
            Sollecita tutti: {reminderRecipients.length}
          </button>
        </div>
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2.5rem] overflow-hidden shadow-sm">
           <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left min-w-[600px]">
                 <thead className="bg-slate-50 dark:bg-white/[0.02] text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-widest border-b border-slate-100 dark:border-white/10">
                    <tr><th className="px-6 py-4">Destinatario</th><th className="px-6 py-4">Documento</th><th className="px-6 py-4">Stato</th><th className="px-6 py-4 text-right">Azione</th></tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {pendingList.map(inst => {
                      const p = data.people.find(x => x.id === inst.personId);
                      const t = data.templates.find(x => x.id === inst.templateId);
                      return (
                        <tr key={inst.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-all">
                           <td className="px-6 py-4 font-bold text-sm">{p?.name}</td>
                           <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{t?.name}</td>
                           <td className="px-6 py-4"><span className="px-2 py-1 bg-amber-500/10 text-amber-600 rounded text-[9px] font-black uppercase">{inst.status}</span></td>
                           <td className="px-6 py-4 text-right">
                              <button onClick={() => p && window.open(`https://wa.me/${p.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Ehi ${p.name}, piccolo promemoria per ${t?.name}: ${getPublicLink(p)}`)}`, '_blank')} className="p-2 text-green-600 hover:bg-green-500/10 rounded-xl transition-all"><MessageSquare className="w-4 h-4" /></button>
                           </td>
                        </tr>
                      );
                    })}
                    {pendingList.length === 0 && (
                      <tr><td colSpan={4} className="py-20 text-center text-slate-400 text-sm italic">Tutto in regola! Nessun documento in attesa.</td></tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      </div>
    );
  };

  const ProductionsContent = () => (
    <div className="space-y-8 animate-fade-in">
       <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between w-full">
          <div className="w-full">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight">I Miei Progetti</h2>
            <p className="text-slate-500 text-sm mt-1">Gestisci tutte le tue produzioni attive.</p>
          </div>
          <button onClick={() => setIsNewProdModalOpen(true)} className="w-full sm:w-auto px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 text-sm sm:text-base"><Plus className="w-5 h-5" /> Nuovo Progetto</button>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.productions.map(p => (
            <div key={p.id} onClick={() => { setSelectedProdId(p.id); setActiveTab('DASHBOARD'); }} className={`bg-white dark:bg-white/5 p-6 rounded-[2.5rem] border transition-all shadow-sm cursor-pointer group hover:shadow-md ${selectedProdId === p.id ? 'border-indigo-600 shadow-indigo-600/10 ring-1 ring-indigo-500/50' : 'border-slate-200 dark:border-white/10'}`}>
               <div className={`p-3 rounded-2xl mb-4 inline-block ${selectedProdId === p.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 group-hover:bg-indigo-600/10 group-hover:text-indigo-600'}`}>
                  < Clapperboard className="w-6 h-6" />
               </div>
               <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{p.title}</h3>
               <p className="text-xs text-slate-500 font-medium line-clamp-2 mb-4">{p.notes || 'Nessuna descrizione.'}</p>
               <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(p.createdAt).toLocaleDateString()}</span>
                  <ChevronRight className={`w-4 h-4 ${selectedProdId === p.id ? 'text-indigo-600' : 'text-slate-300'}`} />
               </div>
            </div>
          ))}
       </div>
    </div>
  );

  if (publicHubToken) return <SigningHub />;

  const personToDelete = data.people.find(p => p.id === personToDeleteId);
  const personSignedCount = data.instances.filter(i => i.personId === personToDeleteId && i.status === DocStatus.SIGNED).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex overflow-hidden transition-all duration-300">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-y-auto custom-scrollbar lg:pl-[280px] w-full">
        <Header />
        <main className="p-4 sm:p-8 pb-24 max-w-6xl mx-auto w-full">
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
      
      {/* Existing Modals Updated */}
      {isNewProdModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl p-6 sm:p-8 transition-all">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6">Nuovo Progetto</h3>
            <div className="space-y-4">
              <input value={newProdData.title} onChange={e => setNewProdData({...newProdData, title: e.target.value})} type="text" className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none" placeholder="Titolo Film" />
              <input value={newProdData.phone} onChange={e => setNewProdData({...newProdData, phone: e.target.value})} type="text" className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none" placeholder="WhatsApp Produzione (per assistenza)" />
              <textarea value={newProdData.notes} onChange={e => setNewProdData({...newProdData, notes: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none h-24" placeholder="Note..." />
              <button onClick={handleCreateProduction} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-600/20 active:scale-95 transition-all">Crea Produzione</button>
            </div>
          </div>
        </div>
      )}

      {isRenameModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl p-6 sm:p-8">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6">Gestione Progetto</h3>
            <div className="space-y-4">
              <input value={renameValue} onChange={e => setRenameValue(e.target.value)} type="text" className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none" placeholder="Titolo" />
              <input value={renamePhone} onChange={e => setRenamePhone(e.target.value)} type="text" className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none" placeholder="WhatsApp Produzione" />
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => setIsRenameModalOpen(false)} className="flex-1 py-4 bg-slate-100 dark:bg-white/5 text-slate-500 font-black rounded-2xl order-2 sm:order-1">Annulla</button>
                <button onClick={handleUpdateProduction} className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl order-1 sm:order-2">Salva</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {templateToDeleteId && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl p-8 transition-all relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-red-500" />
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-red-500/10 text-red-600 rounded-full flex items-center justify-center mb-6 shadow-lg"><AlertTriangle className="w-10 h-10" /></div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Eliminare template?</h3>
              <p className="text-slate-500 text-sm mb-6">Vuoi eliminare definitivamente <b>{data.templates.find(t => t.id === templateToDeleteId)?.name}</b>? L'azione non è annullabile.</p>
              <div className="flex flex-col sm:flex-row w-full gap-3 sm:gap-4">
                <button onClick={() => setTemplateToDeleteId(null)} className="flex-1 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 font-black rounded-2xl order-2 sm:order-1">Annulla</button>
                <button onClick={confirmDeleteTemplate} className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-600/20 order-1 sm:order-2">Elimina</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {personToDeleteId && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl p-8 transition-all relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-red-500" />
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-red-500/10 text-red-600 rounded-full flex items-center justify-center mb-6 shadow-lg"><UserMinus className="w-10 h-10" /></div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Eliminare membro?</h3>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                Vuoi eliminare <b>{personToDelete?.name}</b> dalla produzione <b>{activeProduction?.title}</b>? 
                Questa azione eliminerà anche i documenti assegnati a questa persona.
              </p>
              
              {personSignedCount > 0 && (
                <div className="w-full p-4 mb-6 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl text-left flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <p className="text-[10px] text-amber-700 dark:text-amber-500 font-bold">
                    ATTENZIONE: Verranno rimossi anche i <b>{personSignedCount} PDF firmati</b> archiviati per questa persona.
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row w-full gap-3 sm:gap-4">
                <button onClick={() => setPersonToDeleteId(null)} className="flex-1 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 font-black rounded-2xl order-2 sm:order-1">Annulla</button>
                <button onClick={confirmDeletePerson} className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-600/20 order-1 sm:order-2">Elimina</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
