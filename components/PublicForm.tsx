
import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  CheckCircle, 
  ShieldCheck, 
  Loader2, 
  AlertCircle,
  ArrowRight,
  ChevronLeft
} from 'lucide-react';
import SignatureCanvas from './SignatureCanvas';
import { extractDocumentData } from '../services/gemini';
import { FormState, DocStatus } from '../types';
import { createClient } from '@supabase/supabase-js';

// Environment variables for Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

// Safely initialize Supabase client
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

interface PublicFormProps {
  hubToken: string;
  onComplete: (data: any) => void;
}

const PublicForm: React.FC<PublicFormProps> = ({ hubToken, onComplete }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const [sessionData, setSessionData] = useState<{
    person_name: string;
    template_name: string;
    production_id: string;
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
    const validateAndFetch = async () => {
      if (!supabase) {
        setValidationError("Errore di configurazione server.");
        setIsValidating(false);
        return;
      }

      try {
        const { data: request, error: fetchError } = await supabase
          .from('sign_requests')
          .select('*')
          .eq('token', hubToken)
          .single();

        if (fetchError || !request) {
          setValidationError("Link non valido o scaduto.");
        } else if (request.status === 'Signed') {
          setValidationError("Documento già firmato.");
        } else if (request.expires_at && new Date(request.expires_at) < new Date()) {
          setValidationError("Link scaduto.");
        } else {
          setSessionData({
            person_name: request.person_name,
            template_name: request.template_name || 'Documenti di Produzione',
            production_id: request.production_id
          });
          
          setForm(prev => ({
            ...prev,
            firstName: request.person_name.split(' ')[0] || '',
            lastName: request.person_name.split(' ').slice(1).join(' ') || '',
          }));

          // Mark as opened
          if (request.status === 'Sent') {
            await supabase
              .from('sign_requests')
              .update({ 
                status: 'Opened', 
                opened_at: new Date().toISOString() 
              })
              .eq('token', hubToken);
          }
        }
      } catch (err) {
        console.error("Token validation error:", err);
        setValidationError("Errore di connessione.");
      } finally {
        setIsValidating(false);
      }
    };

    if (hubToken) {
      validateAndFetch();
    }
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
      setError("Impossibile estrarre i dati dal documento. Compila manualmente.");
      setLoading(false);
    }
  };

  const saveToSupabase = async (finalForm: FormState) => {
    if (!supabase) return;
    
    try {
      // Update the sign_request with form data and status
      await supabase
        .from('sign_requests')
        .update({
          status: 'Signed',
          signed_at: new Date().toISOString(),
          form_data: finalForm
        })
        .eq('token', hubToken);
    } catch (err) {
      console.error("Supabase submission failed", err);
      throw err;
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
        await saveToSupabase(form);
        onComplete(form);
      } catch (err) {
        setError("Errore durante l'invio. Riprova.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (validationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-200 dark:border-white/10 shadow-2xl text-center max-w-sm">
           <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
           <h2 className="text-2xl font-black mb-2">{validationError}</h2>
           <p className="text-slate-500 font-medium">Contatta la produzione per ricevere un nuovo link di firma.</p>
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
            {step === 1 && `Ciao ${sessionData?.person_name}, carica il tuo documento per compilare i campi in un istante.`}
            {step === 2 && "Verifica che le informazioni siano corrette prima di procedere."}
            {step === 3 && `Stai firmando digitalmente: ${sessionData?.template_name}.`}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div className="relative group">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="doc-upload"
                />
                <label
                  htmlFor="doc-upload"
                  className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-white/10 rounded-[2.5rem] p-12 bg-white dark:bg-white/5 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/5 transition-all cursor-pointer shadow-sm group"
                >
                  {loading ? (
                    <Loader2 className="w-14 h-14 text-indigo-600 animate-spin mb-6" />
                  ) : (
                    <div className="w-14 h-14 bg-slate-100 dark:bg-white/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Upload className="w-7 h-7 text-slate-400 group-hover:text-indigo-600" />
                    </div>
                  )}
                  <p className="text-xl font-black text-slate-900 dark:text-white">
                    {loading ? "Analisi in corso..." : "Carica Documento"}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">Carta d'Identità o Passaporto</p>
                </label>
              </div>

              {error && (
                <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/10 p-5 rounded-2xl border border-amber-100 dark:border-amber-400/20 shadow-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm font-bold">{error}</p>
                </div>
              )}

              <div className="bg-indigo-50 dark:bg-indigo-500/10 p-5 rounded-2xl flex items-start gap-4 border border-indigo-100 dark:border-indigo-500/20">
                <div className="bg-white dark:bg-indigo-600 p-1.5 rounded-lg shadow-sm">
                  <Camera className="w-4 h-4 text-indigo-600 dark:text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">DocuScan AI</h4>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1 font-medium leading-relaxed">Compileremo i dati legali estraendoli direttamente dalla foto del tuo documento.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-4 text-sm font-black text-slate-400 hover:text-indigo-600 transition-colors underline underline-offset-8 decoration-slate-200 hover:decoration-indigo-200"
              >
                Salta e compila manualmente
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-white/5 space-y-6 animate-fade-in">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Nome</label>
                  <input
                    required
                    type="text"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-medium shadow-inner"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Cognome</label>
                  <input
                    required
                    type="text"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-medium shadow-inner"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Data di Nascita</label>
                  <input
                    required
                    type="date"
                    value={form.birthDate}
                    onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-medium shadow-inner"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Codice Fiscale</label>
                  <input
                    required
                    type="text"
                    placeholder="RSSMRC..."
                    value={form.taxCode}
                    onChange={(e) => setForm({ ...form, taxCode: e.target.value.toUpperCase() })}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-mono font-bold shadow-inner"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Ruolo / Posizione</label>
                <input
                  required
                  type="text"
                  placeholder="es. Attore, DOP, Runner"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-medium shadow-inner"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Numero Documento</label>
                <input
                  required
                  type="text"
                  placeholder="CA123456"
                  value={form.idNumber}
                  onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
                  className="w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-medium shadow-inner"
                />
              </div>
              
              <button type="button" onClick={() => setStep(1)} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors">
                <ChevronLeft className="w-3 h-3" /> Torna al caricamento
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-4 mb-6">
                  <div className="bg-green-100 dark:bg-green-500/20 p-3 rounded-2xl shadow-sm">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-sm">Validazione Legale</h4>
                    <p className="text-xs text-slate-500 font-medium">I dati forniti verranno inseriti nel documento finale.</p>
                  </div>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.03] p-6 rounded-2xl max-h-40 overflow-y-auto mb-8 font-medium leading-relaxed shadow-inner custom-scrollbar">
                  <p className="mb-3 font-black text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-2">{sessionData?.template_name}</p>
                  <p>Firmando questo documento, io sottoscritto <b>{form.firstName} {form.lastName}</b>, nato il {form.birthDate}, 
                  con codice fiscale <b>{form.taxCode}</b>, in qualità di <b>{form.role}</b>, attesto la veridicità dei dati forniti e presto il mio consenso secondo quanto previsto dall'accordo quadro...</p>
                </div>
                
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-3 px-1">La tua Firma Autografa</label>
                <div className="rounded-[2rem] overflow-hidden border border-slate-200 dark:border-white/10 shadow-lg">
                  <SignatureCanvas 
                    onSave={(data) => setForm({ ...form, signature: data })}
                    onClear={() => setForm({ ...form, signature: '' })}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="sticky bottom-6 pt-4">
            <button
              type="submit"
              disabled={isSubmitting || (step === 3 && !form.signature)}
              className="w-full bg-indigo-600 text-white py-5 rounded-[2rem] font-black text-lg hover:bg-indigo-700 shadow-2xl shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center group"
            >
              {isSubmitting ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  {step === 3 ? "Concludi e Archivia" : "Prosegui"}
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </form>
      </main>
      
      <footer className="py-8 px-6 text-center text-slate-400 dark:text-slate-600 text-[10px] font-black uppercase tracking-[0.2em]">
        © 2024 DocuSet - Crittografia End-to-End
      </footer>
    </div>
  );
};

export default PublicForm;
