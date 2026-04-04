
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
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
  Activity, Terminal, RotateCcw, QrCode, Upload, FileCode, Zap, Smartphone
} from 'lucide-react';
import { 
  DocStatus, TemplateType, AppState, Production, Person, Template, 
  DocumentInstance, AppNotification, FieldMapping, FormState, Submission, SubmissionRequest
} from './types';
import SignatureCanvasComponent from './components/SignatureCanvas';
import PublicForm from './components/PublicForm';
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

  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'PRODUCTIONS' | 'PEOPLE' | 'TEMPLATES' | 'ARCHIVE' | 'PENDING' | 'REQUESTS' | 'SIGNED'>('DASHBOARD');
  const [selectedProdId, setSelectedProdId] = useState<string | null>(data.productions[0]?.id || null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isNewProdModalOpen, setIsNewProdModalOpen] = useState(false);
  const [isNewMemberModalOpen, setIsNewMemberModalOpen] = useState(false);
  const [isRecipientModalOpen, setIsRecipientModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [isProdListOpen, setIsProdListOpen] = useState(false);
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [isSyncingTally, setIsSyncingTally] = useState(false);
  const [pendingImportMembers, setPendingImportMembers] = useState<Person[] | null>(null);
  const [editingPendingMember, setEditingPendingMember] = useState<Person | null>(null);
  const [expandedSignedPersonId, setExpandedSignedPersonId] = useState<string | null>(null);

  const [isTemplateSelectModalOpen, setIsTemplateSelectModalOpen] = useState(false);
  const [selectedPersonForTemplate, setSelectedPersonForTemplate] = useState<Person | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Modal State for deletions
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'person' | 'template' | 'production', id: string, name: string } | null>(null);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState('');

  const [newProdData, setNewProdData] = useState({ title: '', notes: '', phone: '' });
  const [newMemberData, setNewMemberData] = useState({ name: '', role: '', department: '', whatsapp: '' });
  const [formLinkInput, setFormLinkInput] = useState('');
  const [whatsappMessageInput, setWhatsappMessageInput] = useState('');
  const [whatsappSolicitInput, setWhatsappSolicitInput] = useState('');

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
        const res = await fetch(`/api/tally?action=status&pid=${selectedProdId}`);
        if (!res.ok) return;
        
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('Expected JSON, got:', contentType);
          return;
        }

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
      } catch (e: any) {
        if (e.message === 'Failed to fetch') {
          // Ignore network errors during polling (e.g. server restarting)
          return;
        }
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
  const signedPeople = useMemo(() => prodPeople.filter(p => p.deliveredAt), [prodPeople]);
  const prodTemplates = useMemo(() => data.templates, [data.templates]);

  useEffect(() => {
    if (activeProduction) {
      setFormLinkInput(activeProduction.formLink || '');
      setWhatsappMessageInput(activeProduction.whatsappMessageTemplate || '');
      setWhatsappSolicitInput(activeProduction.whatsappSolicitTemplate || '');
    }
  }, [activeProduction]);

  const handleSaveSettings = () => {
    if (!selectedProdId) return;
    setData(prev => ({
      ...prev,
      productions: prev.productions.map(p => p.id === selectedProdId ? { 
        ...p, 
        formLink: formLinkInput,
        whatsappMessageTemplate: whatsappMessageInput,
        whatsappSolicitTemplate: whatsappSolicitInput
      } : p)
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

  const handleSendWhatsApp = async (p?: Person) => {
    const baseUrl = activeProduction?.formLink;
    if (!baseUrl) {
      alert("Configura il link Tally nelle impostazioni della produzione.");
      setIsSettingsModalOpen(true);
      return;
    }

    let finalLink = baseUrl;
    let personName = '';
    if (p) {
      const separator = baseUrl.includes('?') ? '&' : '?';
      finalLink += `${separator}pid=${selectedProdId}&mid=${p.id}`;
      // Extract first name or use the full name if it's a single word
      personName = p.name.split(' ')[0];
    }

    const greeting = personName ? `Ciao ${personName}!` : 'Ciao!';
    
    let message = '';
    if (activeProduction?.whatsappMessageTemplate) {
      message = activeProduction.whatsappMessageTemplate
        .replace(/{{nome}}/g, personName || '')
        .replace(/{{titolo_produzione}}/g, activeProduction.title || '')
        .replace(/{{link_form}}/g, finalLink);
    } else {
      message = `${greeting} Compila questi dati per la produzione "${activeProduction?.title}":

${finalLink}

I tuoi dati verranno gestiti nella piena sicurezza, sotto la norma vigente di privacy.`;
    }

    const phone = p ? p.whatsapp.replace(/[^\d+]/g, '') : '';
    
    const isAndroid = /Android/i.test(navigator.userAgent);
    let url = '';
    if (isAndroid) {
      url = `intent://send?phone=${phone}&text=${encodeURIComponent(message)}#Intent;package=com.whatsapp;scheme=whatsapp;end;`;
    } else {
      url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    }
    
    window.open(url, '_blank');
    if (p) {
      setData(prev => ({
        ...prev,
        people: prev.people.map(person => 
          person.id === p.id ? { ...person, sentAt: new Date().toISOString() } : person
        )
      }));
    }
  };

  const handleSollecitaWhatsApp = async (p: Person) => {
    const baseUrl = activeProduction?.formLink;
    if (!baseUrl) {
      alert("Configura il link Tally nelle impostazioni della produzione.");
      setIsSettingsModalOpen(true);
      return;
    }

    let finalLink = baseUrl;
    const separator = baseUrl.includes('?') ? '&' : '?';
    finalLink += `${separator}pid=${selectedProdId}&mid=${p.id}`;
    const personName = p.name.split(' ')[0];

    let message = '';
    if (activeProduction?.whatsappSolicitTemplate) {
      message = activeProduction.whatsappSolicitTemplate
        .replace(/{{nome}}/g, personName || '')
        .replace(/{{titolo_produzione}}/g, activeProduction.title || '')
        .replace(/{{link_form}}/g, finalLink);
    } else {
      message = `Ciao ${personName},
${finalLink}
ricordati di firmare i documenti necessari per il set.`;
    }

    const phone = p.whatsapp.replace(/[^\d+]/g, '');
    
    const isAndroid = /Android/i.test(navigator.userAgent);
    let url = '';
    if (isAndroid) {
      url = `intent://send?phone=${phone}&text=${encodeURIComponent(message)}#Intent;package=com.whatsapp;scheme=whatsapp;end;`;
    } else {
      url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    }
    
    window.open(url, '_blank');
    setData(prev => ({
      ...prev,
      people: prev.people.map(person => 
        person.id === p.id ? { ...person, solicitedAt: new Date().toISOString() } : person
      )
    }));
  };

  const generateFilledPdf = async (template: Template, formData: any, signatureUrl: string) => {
    try {
      // Fetch the blank PDF
      const existingPdfBytes = await fetch(template.fileUrl).then(res => res.arrayBuffer());
      const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();

      // Embed signature if available
      let signatureImage: any = null;
      if (signatureUrl) {
        try {
          const sigRes = await fetch(signatureUrl);
          const sigBytes = await sigRes.arrayBuffer();
          try {
            signatureImage = await pdfDoc.embedPng(sigBytes);
          } catch (e) {
            signatureImage = await pdfDoc.embedJpg(sigBytes);
          }
        } catch (e) {
          console.error("Failed to load signature image", e);
        }
      }

      // Draw fields
      for (const field of template.fields) {
        const pageIndex = field.page || 0;
        if (pageIndex >= pages.length) continue;
        const page = pages[pageIndex];
        const { width, height } = page.getSize();

        const x = field.xPct !== undefined ? field.xPct * width : field.x;
        const y = field.yPct !== undefined ? (1 - field.yPct) * height : height - field.y;

        if (field.type === 'signature' && signatureImage) {
          const sigWidth = field.wPct !== undefined ? field.wPct * width : (field.width || 150);
          const sigHeight = field.hPct !== undefined ? field.hPct * height : (field.height || 50);
          page.drawImage(signatureImage, {
            x,
            y: y - sigHeight,
            width: sigWidth,
            height: sigHeight,
          });
        } else if (field.type === 'text' || field.type === 'date') {
          let text = '';
          const labelLower = field.label.toLowerCase();
          if (labelLower.includes('nome') || labelLower.includes('name')) text = formData.nome || '';
          else if (labelLower.includes('codice fiscale') || labelLower.includes('cf')) text = formData.cf || '';
          else if (labelLower.includes('data') || labelLower.includes('date')) text = formData.dataNascita || new Date().toLocaleDateString();
          else text = formData[field.id] || formData[field.label] || '';

          if (text) {
            page.drawText(text, {
              x,
              y,
              size: field.fontSize || 12,
            });
          }
        }
      }

      const pdfBytes = await pdfDoc.saveAsBase64({ dataUri: true });
      return pdfBytes;
    } catch (error) {
      console.error("PDF Generation Error:", error);
      throw error;
    }
  };

  const handleSaveEditedPerson = () => {
    if (!editingPerson) return;
    setData(prev => ({
      ...prev,
      people: prev.people.map(p => p.id === editingPerson.id ? editingPerson : p)
    }));
    setEditingPerson(null);
  };

  const handleSaveEditedPendingMember = () => {
    if (!editingPendingMember || !pendingImportMembers) return;
    setPendingImportMembers(prev => 
      prev ? prev.map(p => p.id === editingPendingMember.id ? editingPendingMember : p) : null
    );
    setEditingPendingMember(null);
  };

  const handleConfirmImport = () => {
    if (!pendingImportMembers) return;
    setData(prev => ({ ...prev, people: [...prev.people, ...pendingImportMembers] }));
    setPendingImportMembers(null);
    alert(`Importazione confermata: ${pendingImportMembers.length} membri aggiunti.`);
  };

  const handleGeneratePdf = async () => {
    if (!selectedPersonForTemplate || !selectedTemplateId) return;
    setIsGeneratingPdf(true);
    try {
      const template = data.templates.find(t => t.id === selectedTemplateId);
      if (!template) throw new Error("Template non trovato");

      // Fetch the PDF template
      const pdfBytes = await fetch(template.fileUrl).then(res => res.arrayBuffer());
      
      // Load the PDFDocument
      const { PDFDocument } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const form = pdfDoc.getForm();

      // Get person data
      let formData: any = null;
      if (selectedPersonForTemplate.fieldsJSON) {
        try {
          formData = JSON.parse(selectedPersonForTemplate.fieldsJSON);
        } catch (e) {}
      } else {
        const personInstances = data.instances.filter(i => i.personId === selectedPersonForTemplate.id && i.status === DocStatus.SIGNED);
        if (personInstances.length > 0 && personInstances[0].auditJSON) {
          try {
            const audit = JSON.parse(personInstances[0].auditJSON);
            formData = audit.formData;
          } catch (e) {}
        }
      }

      if (formData) {
        const fields = form.getFields();
        for (const field of fields) {
          const fieldName = field.getName();
          
          let matchedValue = null;
          for (const [key, value] of Object.entries(formData)) {
            const normalizedKey = key.toLowerCase().trim();
            const normalizedFieldName = fieldName.toLowerCase().trim();
            
            if (
              normalizedFieldName === normalizedKey || 
              (normalizedKey.length > 3 && normalizedFieldName.includes(normalizedKey)) ||
              (normalizedFieldName.length > 3 && normalizedKey.includes(normalizedFieldName))
            ) {
              matchedValue = value;
              break;
            }
          }

          if (matchedValue) {
            try {
              if (field.constructor.name === 'PDFTextField') {
                form.getTextField(fieldName).setText(String(matchedValue));
              }
            } catch (e) {
              console.error(`Errore compilazione campo ${fieldName}:`, e);
            }
          }
        }
      }

      form.flatten();

      // Save the PDF
      const pdfBytesOut = await pdfDoc.save();
      const blob = new Blob([pdfBytesOut as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedPersonForTemplate.name}_${template.name}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      setIsTemplateSelectModalOpen(false);
      setSelectedPersonForTemplate(null);
      setSelectedTemplateId('');
    } catch (error) {
      console.error("Errore generazione PDF:", error);
      alert("Errore durante la generazione del PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSyncTally = async () => {
    if (!selectedProdId || !activeProduction) return;
    
    const formLink = activeProduction.formLink || '';
    const formIdMatch = formLink.match(/tally\.so\/r\/([^?]+)/);
    const formId = formIdMatch ? formIdMatch[1] : null;

    if (!formId) {
      alert("Configura un link Tally valido (es. https://tally.so/r/ID) nelle impostazioni della produzione.");
      setIsSettingsModalOpen(true);
      return;
    }

    setIsSyncingTally(true);
    try {
      const res = await fetch('/api/tally?action=sync-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formId, people: prodPeople })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Errore durante la sincronizzazione con Tally");
      }
      
      const { matchedSubmissions, unmatchedSubmissions } = await res.json();
      
      if ((!matchedSubmissions || matchedSubmissions.length === 0) && (!unmatchedSubmissions || unmatchedSubmissions.length === 0)) {
        alert("Nessuna sottomissione trovata su Tally.");
        setIsSyncingTally(false);
        return;
      }

      let updatedPeople = [...data.people];
      let updatedInstances = [...data.instances];
      let newNotifications = [...data.notifications];

      const submissionsToProcess: { person: Person, sub: any }[] = [];

      // Add matched
      for (const sub of (matchedSubmissions || [])) {
        const person = updatedPeople.find(p => p.id === sub.personId);
        if (person) submissionsToProcess.push({ person, sub });
      }

      const normalizeName = (n: string) => n ? n.toLowerCase().trim().replace(/\s+/g, ' ') : '';

      // Add unmatched (create new people)
      for (const sub of (unmatchedSubmissions || [])) {
        // Try to find by name again just in case
        const nome = sub.formData.nome || sub.formData['Nome e Cognome'] || sub.formData['nome e cognome'] || 'Sconosciuto';
        let person = updatedPeople.find(p => p.productionId === selectedProdId && normalizeName(p.name) === normalizeName(nome));
        
        if (!person) {
          person = {
            id: crypto.randomUUID(),
            productionId: selectedProdId,
            name: nome,
            role: 'Membro Troupe',
            department: 'Generico',
            whatsapp: sub.formData['Telefono'] || sub.formData['Cellulare'] || '',
            deliveredAt: sub.submittedAt,
            hubToken: crypto.randomUUID()
          };
          updatedPeople.push(person);
        }
        submissionsToProcess.push({ person, sub });
      }

      // Process all concurrently
      submissionsToProcess.forEach(({ person, sub }) => {
        if (!person.deliveredAt) {
          person.deliveredAt = sub.submittedAt;
        }
        person.fieldsJSON = JSON.stringify(sub.formData);
        
        // Add a notification if it's new
        if (!data.notifications.some(n => n.personId === person.id && n.type === 'DOCUMENT_SIGNED')) {
          newNotifications.push({
            id: crypto.randomUUID(),
            productionId: selectedProdId,
            personId: person.id,
            documentInstanceId: '',
            type: 'DOCUMENT_SIGNED',
            title: 'Nuovo form compilato',
            message: `${person.name} ha compilato il form su Tally`,
            createdAt: new Date().toISOString(),
            readAt: null
          });
        }
      });

      setData(prev => ({
        ...prev,
        people: updatedPeople,
        instances: updatedInstances,
        notifications: newNotifications
      }));
      
      alert(`Sincronizzazione completata: ${submissionsToProcess.length} sottomissioni elaborate.`);
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

    setIsParsingDoc(true);
    try {
      let parsedMembers: any[] = [];

      if (file.name.toLowerCase().endsWith('.pdf')) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        await new Promise<void>((resolve, reject) => {
          reader.onload = async () => {
            try {
              const base64Data = (reader.result as string).split(',')[1];
              
              const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
              
              const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: [
                  {
                    inlineData: {
                      data: base64Data,
                      mimeType: file.type || 'application/pdf'
                    }
                  },
                  "Estrai la lista della troupe da questo documento. Ritorna un array JSON di oggetti, dove ogni oggetto rappresenta una persona. I campi devono essere: 'name' (stringa, Nome e Cognome), 'role' (stringa, Ruolo), 'phone' (stringa, Numero di telefono, solo cifre e + se presente), 'department' (stringa, Reparto, es. PRODUZIONE, REGIA, FOTOGRAFIA, ecc. Deducilo dalle intestazioni della tabella o dalle sezioni). Ignora le righe vuote o senza il nome della persona."
                ],
                config: {
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        role: { type: Type.STRING },
                        phone: { type: Type.STRING },
                        department: { type: Type.STRING }
                      },
                      required: ["name", "role", "phone", "department"]
                    }
                  }
                }
              });

              const text = response.text;
              if (!text) throw new Error("Nessuna risposta dall'IA");
              
              const data = JSON.parse(text);
              parsedMembers = data || [];
              resolve();
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = (error) => reject(error);
        });
      } else {
        // DOCX parsing via mammoth
        const arrayBuffer = await file.arrayBuffer();
        const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const table = doc.querySelector('table');
        if (!table) throw new Error("Nessuna tabella trovata nel DOCX.");
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
        if (headerIdx === -1) throw new Error("Header non trovato nel DOCX.");
        
        let currentDept = 'Generale';
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const cells = Array.from(rows[i].querySelectorAll('td')).map(td => td.textContent?.trim() || '');
          const nome = cells[colMap['NOME']] || '';
          const ruolo = cells[colMap['RUOLO']] || '';
          const numero = cells[colMap['NUMERO']] || '';
          const reparti = cells[colMap['REPARTI']] || '';
          if (reparti && !nome && !ruolo && !numero) { currentDept = reparti; continue; }
          if (!nome) continue;
          
          parsedMembers.push({
            name: nome,
            role: ruolo,
            department: currentDept,
            phone: numero
          });
        }
      }

      // Process parsed members (both PDF and DOCX)
      const members: any[] = [];
      let duplicatesCount = 0;
      
      for (const p of parsedMembers) {
        if (!p.name) continue;
        const cleanPhone = (p.phone || '').replace(/[^\d+]/g, '');
        const isDuplicate = data.people.some(existing => existing.productionId === selectedProdId && !existing.removedAt && existing.name.toLowerCase() === p.name.toLowerCase());
        
        if (isDuplicate) { 
          duplicatesCount++; 
          continue; 
        }
        
        members.push({
          id: 'per-' + Math.random().toString(36).substr(2, 9),
          productionId: selectedProdId,
          name: p.name,
          role: p.role || 'Crew',
          department: p.department || 'Generale',
          whatsapp: cleanPhone,
          hubToken: crypto.randomUUID()
        });
      }

      if (members.length > 0) {
        setPendingImportMembers(members);
        if (duplicatesCount > 0) {
          alert(`Trovati ${members.length} nuovi membri. ${duplicatesCount} duplicati ignorati.`);
        }
      } else {
        alert(`Nessun nuovo membro trovato.${duplicatesCount > 0 ? ` (${duplicatesCount} duplicati ignorati)` : ''}`);
      }

    } catch (err: any) { 
      alert(err.message || "Errore lettura file."); 
    } finally {
      setIsParsingDoc(false);
      if (docxInputRef.current) docxInputRef.current.value = '';
    }
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
              { id: 'SIGNED', label: 'Risposte', icon: CheckCircle },
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
                <div onClick={() => setActiveTab('SIGNED')} className="bg-white p-8 dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 hover:shadow-2xl transition-all cursor-pointer group">
                  <div className="w-14 h-14 bg-emerald-600/10 text-emerald-600 rounded-2xl flex items-center justify-center mb-6"><CheckCircle className="w-7 h-7" /></div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Risposte</p>
                  <p className="text-4xl font-black mt-1 text-slate-900 dark:text-white">{signedPeople.length}</p>
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
                  <button onClick={() => docxInputRef.current?.click()} disabled={isParsingDoc} className="px-6 py-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-2 transition-all disabled:opacity-50">
                    {isParsingDoc ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileCode className="w-4 h-4" />} IMPORTA DOCX/PDF
                  </button>
                  <button onClick={() => setIsNewMemberModalOpen(true)} className="px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 flex items-center gap-2 transition-all">
                    <UserPlus className="w-4 h-4" /> Nuovo Membro
                  </button>
                  <input type="file" ref={docxInputRef} accept=".docx,.pdf" onChange={handleDocxSelection} className="hidden" />
                </div>
              </div>

              <div className="space-y-3">
                {prodPeople.map(p => (
                  <div key={p.id} onClick={() => setEditingPerson(p)} className="cursor-pointer bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex items-center justify-between gap-4 hover:border-indigo-500/30 transition-all">
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
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleSendWhatsApp(p); }} className="p-2.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl transition-colors">
                          {p.solicitedAt ? <CheckCheck className="w-5 h-5 pointer-events-none" /> : p.sentAt ? <Check className="w-5 h-5 pointer-events-none" /> : <Send className="w-5 h-5 pointer-events-none" />}
                        </button>
                      )}
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleDeletePerson(p.id, e); }} className="relative z-10 p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors">
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
                  <div key={p.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-row items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-sm truncate text-slate-900 dark:text-white">{p.name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{p.role}</p>
                    </div>
                    <div className="flex items-center shrink-0">
                      <button type="button" onClick={() => handleSollecitaWhatsApp(p)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2">
                        {p.solicitedAt ? <CheckCheck className="w-3.5 h-3.5 pointer-events-none" /> : p.sentAt ? <Check className="w-3.5 h-3.5 pointer-events-none" /> : <Send className="w-3.5 h-3.5 pointer-events-none" />} <span className="hidden sm:inline">Sollecita</span>
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

          {activeTab === 'SIGNED' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">Risposte Form</h2>
                  <p className="text-slate-500 text-sm font-medium">Membri che hanno completato il form.</p>
                </div>
                <button onClick={handleSyncTally} disabled={isSyncingTally} className="px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 flex items-center gap-2 transition-all disabled:opacity-50">
                  <RefreshCw className={`w-4 h-4 ${isSyncingTally ? 'animate-spin' : ''}`} /> Sincronizza Tally
                </button>
              </div>

              <div className="space-y-3">
                {signedPeople.map(p => {
                  let formData: any = null;
                  if (p.fieldsJSON) {
                    try {
                      formData = JSON.parse(p.fieldsJSON);
                    } catch (e) {}
                  } else {
                    // Fallback to old auditJSON if it exists
                    const personInstances = data.instances.filter(i => i.personId === p.id && i.status === DocStatus.SIGNED);
                    if (personInstances.length > 0 && personInstances[0].auditJSON) {
                      try {
                        const audit = JSON.parse(personInstances[0].auditJSON);
                        formData = audit.formData;
                      } catch (e) {}
                    }
                  }

                  return (
                    <div key={p.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden transition-all">
                      <div 
                        onClick={() => setExpandedSignedPersonId(expandedSignedPersonId === p.id ? null : p.id)}
                        className="p-4 flex flex-row items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="font-black text-sm truncate text-slate-900 dark:text-white">{p.name}</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{p.role}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPersonForTemplate(p);
                              setIsTemplateSelectModalOpen(true);
                            }}
                            className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all"
                            title="Scarica PDF compilato"
                          >
                            <Download className="w-5 h-5 pointer-events-none" />
                          </button>
                          <div className="p-2 text-slate-400">
                            {expandedSignedPersonId === p.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </div>
                        </div>
                      </div>
                      
                      {expandedSignedPersonId === p.id && formData && (
                        <div className="p-5 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50 animate-fade-in">
                          <h5 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Dati Inseriti</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {Object.entries(formData).map(([key, value]) => {
                              const lowerKey = key.toLowerCase().trim();
                              const strValue = String(value);
                              
                              // Hide unwanted fields
                              if (
                                !value || 
                                lowerKey === 'nome e cognome' || 
                                lowerKey === 'pid' || 
                                lowerKey === 'mid' || 
                                lowerKey === 'data emissione' || 
                                lowerKey === 'data di emissione' || 
                                lowerKey === 'scadenza' ||
                                lowerKey === 'datanascita' ||
                                lowerKey === 'cf'
                              ) return null;

                              // Check if it's a signature/file link
                              const isFirma = lowerKey.includes('firma') || lowerKey.includes('signature') || strValue.includes('storage.tally.so');

                              return (
                                <div key={key} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">{key}</p>
                                  {isFirma ? (
                                    <a 
                                      href={strValue} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      download="firma.jpg"
                                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                                    >
                                      <Download className="w-3.5 h-3.5" /> Scarica Firma
                                    </a>
                                  ) : (
                                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate" title={strValue}>{strValue}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {/* Removed the old hardcoded Firma image block since it's now handled in the loop */}
                        </div>
                      )}
                    </div>
                  );
                })}
                {signedPeople.length === 0 && (
                  <div className="bg-white dark:bg-slate-900 py-16 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-white/5 text-center">
                    <FileCheck className="w-12 h-12 text-slate-200 dark:text-white/10 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium italic">Nessuna risposta al momento.</p>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl border border-white/10 my-8">
            <h3 className="text-2xl font-black mb-6 text-slate-900 dark:text-white">Impostazioni Produzione</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Link Form Tally</label>
                <p className="text-slate-400 text-xs mb-3 font-medium">Inserisci l'URL del form Tally. Verranno aggiunti automaticamente i parametri pid e mid.</p>
                <input value={formLinkInput} onChange={e => setFormLinkInput(e.target.value)} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 font-bold outline-none text-slate-900 dark:text-white" placeholder="https://tally.so/r/XXXXXX" />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Messaggio WhatsApp (Iniziale)</label>
                <p className="text-slate-400 text-xs mb-3 font-medium">Usa le variabili: <code className="bg-slate-100 dark:bg-white/10 px-1 py-0.5 rounded">{"{{nome}}"}</code>, <code className="bg-slate-100 dark:bg-white/10 px-1 py-0.5 rounded">{"{{titolo_produzione}}"}</code>, <code className="bg-slate-100 dark:bg-white/10 px-1 py-0.5 rounded">{"{{link_form}}"}</code></p>
                <textarea 
                  value={whatsappMessageInput} 
                  onChange={e => setWhatsappMessageInput(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 font-medium outline-none text-slate-900 dark:text-white min-h-[120px] resize-y" 
                  placeholder="Ciao {{nome}}! Compila questi dati per la produzione '{{titolo_produzione}}':&#10;&#10;{{link_form}}&#10;&#10;I tuoi dati verranno gestiti nella piena sicurezza."
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Messaggio WhatsApp (Sollecito)</label>
                <textarea 
                  value={whatsappSolicitInput} 
                  onChange={e => setWhatsappSolicitInput(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 font-medium outline-none text-slate-900 dark:text-white min-h-[100px] resize-y" 
                  placeholder="Ciao {{nome}},&#10;{{link_form}}&#10;ricordati di firmare i documenti necessari per il set."
                />
              </div>

              <div className="flex gap-4 pt-2">
                <button type="button" onClick={() => setIsSettingsModalOpen(false)} className="flex-1 py-4 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest">Annulla</button>
                <button type="button" onClick={handleSaveSettings} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">Salva</button>
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
                  {p.sentAt ? <Check className="w-4 h-4 text-emerald-600 pointer-events-none" /> : <Send className="w-4 h-4 text-emerald-600 pointer-events-none" />}
                </button>
              ))}
              {pendingPeople.length === 0 && <p className="text-center py-10 text-slate-400 font-medium italic">Nessun membro in attesa.</p>}
            </div>
            <button type="button" onClick={() => setIsRecipientModalOpen(false)} className="w-full mt-6 py-4 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 rounded-2xl font-bold uppercase text-[10px] tracking-widest font-black">Chiudi</button>
          </div>
        </div>
      )}

      {editingPerson && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl border border-white/10">
            <h3 className="text-2xl font-black mb-8 text-slate-900 dark:text-white">Modifica Membro</h3>
            <div className="space-y-4">
              <input value={editingPerson.name} onChange={e => setEditingPerson({...editingPerson, name: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 outline-none font-bold text-slate-900 dark:text-white" placeholder="Nome e Cognome" />
              <input value={editingPerson.role} onChange={e => setEditingPerson({...editingPerson, role: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 outline-none font-bold text-slate-900 dark:text-white" placeholder="Ruolo" />
              <input value={editingPerson.department} onChange={e => setEditingPerson({...editingPerson, department: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 outline-none font-bold text-slate-900 dark:text-white" placeholder="Reparto" />
              <input value={editingPerson.whatsapp} onChange={e => setEditingPerson({...editingPerson, whatsapp: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 outline-none font-bold text-slate-900 dark:text-white" placeholder="Numero WhatsApp" />
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setEditingPerson(null)} className="flex-1 py-4 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest">Annulla</button>
                <button type="button" onClick={handleSaveEditedPerson} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">Salva</button>
              </div>
            </div>
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

      {pendingImportMembers && !editingPendingMember && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl border border-white/10 max-h-[90vh] flex flex-col">
            <h3 className="text-2xl font-black mb-2 text-slate-900 dark:text-white">Revisione Membri</h3>
            <p className="text-slate-500 text-sm mb-6 font-medium">Controlla i membri estratti. Clicca su un membro per modificarne i dettagli prima di confermare l'importazione.</p>
            
            <div className="space-y-2 overflow-y-auto custom-scrollbar pr-2 flex-1 min-h-0">
              {pendingImportMembers.map(p => (
                <button key={p.id} type="button" onClick={() => setEditingPendingMember(p)} className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl hover:border-indigo-500 transition-all text-left group">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{p.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] uppercase text-slate-400 font-black">{p.role}</span>
                      <span className="text-[10px] text-slate-300 dark:text-slate-600">•</span>
                      <span className="text-[10px] uppercase text-slate-400 font-black">{p.department}</span>
                      {p.whatsapp && (
                        <>
                          <span className="text-[10px] text-slate-300 dark:text-slate-600">•</span>
                          <span className="text-[10px] uppercase text-slate-400 font-black">{p.whatsapp}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Edit2 className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </button>
              ))}
            </div>
            
            <div className="flex gap-4 pt-6 mt-auto">
              <button type="button" onClick={() => setPendingImportMembers(null)} className="flex-1 py-4 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest">Annulla</button>
              <button type="button" onClick={handleConfirmImport} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">Conferma Importazione</button>
            </div>
          </div>
        </div>
      )}

      {editingPendingMember && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl border border-white/10">
            <h3 className="text-2xl font-black mb-8 text-slate-900 dark:text-white">Correggi Membro</h3>
            <div className="space-y-4">
              <input value={editingPendingMember.name} onChange={e => setEditingPendingMember({...editingPendingMember, name: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 outline-none font-bold text-slate-900 dark:text-white" placeholder="Nome e Cognome" />
              <input value={editingPendingMember.role} onChange={e => setEditingPendingMember({...editingPendingMember, role: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 outline-none font-bold text-slate-900 dark:text-white" placeholder="Ruolo" />
              <input value={editingPendingMember.department} onChange={e => setEditingPendingMember({...editingPendingMember, department: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 outline-none font-bold text-slate-900 dark:text-white" placeholder="Reparto" />
              <input value={editingPendingMember.whatsapp} onChange={e => setEditingPendingMember({...editingPendingMember, whatsapp: e.target.value})} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 outline-none font-bold text-slate-900 dark:text-white" placeholder="Numero WhatsApp" />
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setEditingPendingMember(null)} className="flex-1 py-4 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest">Annulla</button>
                <button type="button" onClick={handleSaveEditedPendingMember} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">Salva Modifiche</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isTemplateSelectModalOpen && selectedPersonForTemplate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl border border-white/10">
            <h3 className="text-2xl font-black mb-2 text-slate-900 dark:text-white">Genera PDF</h3>
            <p className="text-slate-500 text-sm mb-6 font-medium">
              Seleziona un template da compilare con i dati di <strong>{selectedPersonForTemplate.name}</strong>.
            </p>
            <div className="space-y-4">
              <select
                value={selectedTemplateId}
                onChange={e => setSelectedTemplateId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 font-bold outline-none text-slate-900 dark:text-white appearance-none"
              >
                <option value="">-- Seleziona un Template --</option>
                {data.templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsTemplateSelectModalOpen(false);
                    setSelectedTemplateId('');
                  }} 
                  className="flex-1 py-4 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest"
                >
                  Annulla
                </button>
                <button 
                  type="button" 
                  onClick={handleGeneratePdf} 
                  disabled={!selectedTemplateId || isGeneratingPdf}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isGeneratingPdf ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Generazione...</>
                  ) : (
                    <><Download className="w-4 h-4" /> Genera e Scarica</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
