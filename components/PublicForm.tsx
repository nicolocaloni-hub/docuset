
import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  CheckCircle, 
  ShieldCheck, 
  Loader2, 
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  LayoutDashboard
} from 'lucide-react';
import SignatureCanvas from './SignatureCanvas';
import { extractDocumentData } from '../services/gemini';
import { FormState, DocStatus } from '../types';

interface PublicFormProps {
  hubToken: string;
  onComplete: () => void;
}

const PublicForm: React.FC<PublicFormProps> = ({ hubToken, onComplete }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const [inviteData, setInviteData] = useState<{
    personName: string;
    productionTitle: string;
    templateName: string;
    status: string;
  } | null>(null);

  const [form, setForm] = useState<FormState>({
    firstName: '',
    lastName: '',
    birthDate: '',
    taxCode: '',
    role: '',
    idNumber: '',
    signature: '',
  });

  useEffect(() => {
    const validateToken = async () => {
      try {
        const res = await fetch(`/api/sign?action=validate&token=${hubToken}`);
        if (!res.ok) {
          const err = await res.json();
          setValidationError(err.error || "Link non valido.");
          return;
        }
        
        const data = await res.json();
        setInviteData({
          personName: data.payload_json.personName || "Utente",
          productionTitle: data.payload_json.productionTitle || "Produzione",
          templateName: data.payload_json.templateName || "Documento",
          status: data.status
        });
        
        setForm(prev => ({
          ...prev,
          firstName: (data.payload_json.personName || '').split(' ')[0] || '',
          lastName: (data.payload_json.personName || '').split(' ').slice(1).join(' ') || ''
        }));
      } catch (err) {
        console.error(err);
        setValidationError("Errore di connessione.");
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [hubToken]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const result = await extractDocumentData(base64, file.type);
        
        setForm(prev => ({
          ...prev,
          firstName: result.firstName || prev.firstName,
          lastName: result.lastName || prev.lastName,
          birthDate: result.birthDate || prev.birthDate,
          role: result.role || prev.role,
        }));
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("Impossibile estrarre i dati. Compila manualmente.");
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
      window.scrollTo(0, 0);
    } else {
      setIsSubmitting(true);
      try {
        const res = await fetch('/api/sign?action=submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: hubToken,
            formData: form,
            signatureDataUrl: form.signature
          })
        });

        if (!res.ok) throw new Error();
        onComplete();
      } catch (err) {
        setError("Errore durante l'invio. Riprova.");
        setIsSubmitting(false);
      }
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Validazione Link...</p>
      </div>
    );
  }

  if (validationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-200 dark:border-white/10 shadow-2xl text-center max-w-sm">
           <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
           <h2 className="text-2xl font-black mb-2">{validationError}</h2>
           <p className="text-slate-500 font-medium mb-8">Se ritieni sia un errore, contatta la produzione cinematografica.</p>
           <button 
             onClick={() => window.location.href = '/'}
             className="w-full py-4 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-slate-200 transition-all"
           >
             <LayoutDashboard className="w-4 h-4" /> Vai alla Home
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors duration-300">
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 py-4 px-6 sticky top-0 z-10 shadow-sm">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-600/20">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">DocuSet</span>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div 
                key={s} 
                className={`h-1.5 w-8 rounded-full transition-all duration-500 ${
                  s <= step ? 'bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]' : 'bg-slate-200 dark:bg-white/10'
                }`} 
              />
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-xl w-full mx-auto px-6 py-8">
        <div className="mb-8 animate-fade-in">
          <h2 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] mb-2">
            Passaggio {step} di 3
          </h2>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">
            {step === 1 && "Verifica Identità"}
            {step === 2 && "Dati Personali"}
            {step === 3 && "Concludi e Firma"}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
            {step === 1 && `Ciao ${inviteData?.personName}, carica il tuo documento per compilare i campi istantaneamente.`}
            {step === 2 && "Controlla che le informazioni caricate siano corrette."}
            {step === 3 && `Stai firmando digitalmente: ${inviteData?.templateName}.`}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div className="relative group">
                <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" id="doc-upload" />
                <label htmlFor="doc-upload" className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-white/10 rounded-[2.5rem] p-12 bg-white dark:bg-white/5 hover:border-indigo-500 transition-all cursor-pointer shadow-sm group">
                  {loading ? <Loader2 className="w-14 h-14 text-indigo-600 animate-spin mb-6" /> : (
                    <div className="w-14 h-14 bg-slate-100 dark:bg-white/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Upload className="w-7 h-7 text-slate-400 group-hover:text-indigo-600" />
                    </div>
                  )}
                  <p className="text-xl font-black text-slate-900 dark:text-white">{loading ? "Analisi AI..." : "Carica Documento"}</p>
                </label>
              </div>
              <button type="button" onClick={() => setStep(2)} className="w-full py-4 text-sm font-black text-slate-400 hover:text-indigo-600 transition-colors underline underline-offset-8">Salta e compila a mano</button>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-white/5 space-y-6 animate-fade-in">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Nome</label>
                  <input required type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Cognome</label>
                  <input required type="text" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-medium" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Codice Fiscale</label>
                <input required type="text" value={form.taxCode} onChange={(e) => setForm({ ...form, taxCode: e.target.value.toUpperCase() })} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-mono font-bold" />
              </div>
              <button type="button" onClick={() => setStep(1)} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-indigo-600"><ChevronLeft className="w-3 h-3" /> Torna al caricamento</button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-4 mb-6">
                  <div className="bg-green-100 dark:bg-green-500/20 p-3 rounded-2xl shadow-sm"><CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" /></div>
                  <div>
                    <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-sm">Validazione Legale</h4>
                    <p className="text-xs text-slate-500 font-medium">I dati verranno inseriti nel documento finale.</p>
                  </div>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.03] p-6 rounded-2xl max-h-40 overflow-y-auto mb-8 font-medium shadow-inner custom-scrollbar">
                  <p className="mb-3 font-black text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-2">{inviteData?.templateName}</p>
                  <p>Firmando questo documento, io sottoscritto <b>{form.firstName} {form.lastName}</b>, attesto la veridicità dei dati forniti per la produzione <b>{inviteData?.productionTitle}</b>.</p>
                </div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-3 px-1">Firma Autografa</label>
                <div className="rounded-[2rem] overflow-hidden border border-slate-200 dark:border-white/10 shadow-lg">
                  <SignatureCanvas onSave={(data) => setForm({ ...form, signature: data })} onClear={() => setForm({ ...form, signature: '' })} />
                </div>
              </div>
            </div>
          )}

          <div className="sticky bottom-6 pt-4">
            <button
              type="submit"
              disabled={isSubmitting || (step === 3 && !form.signature)}
              className="w-full bg-indigo-600 text-white py-5 rounded-[2rem] font-black text-lg hover:bg-indigo-700 shadow-2xl disabled:opacity-50 transition-all flex items-center justify-center group"
            >
              {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                <>{step === 3 ? "Firma e Invia" : "Prosegui"}<ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" /></>
              )}
            </button>
          </div>
        </form>
      </main>
      <footer className="py-8 px-6 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">© 2024 DocuSet</footer>
    </div>
  );
};

export default PublicForm;
