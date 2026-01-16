import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Loader2, 
  AlertCircle,
  ArrowRight,
  CheckCircle,
  XCircle,
  User,
  MapPin,
  FileText,
  Phone,
  Mail,
  Calendar,
  Type
} from 'lucide-react';
import SignatureCanvas from './SignatureCanvas';

interface ExternalSubmitFormProps {
  code: string;
}

const ExternalSubmitForm: React.FC<ExternalSubmitFormProps> = ({ code }) => {
  const [isValidating, setIsValidating] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [requestInfo, setRequestInfo] = useState<{ label: string; productionTitle: string } | null>(null);

  const [form, setForm] = useState({
    fullName: '',
    birthPlace: '',
    birthDate: '',
    addressStreet: '',
    addressNumber: '',
    addressZip: '',
    addressCity: '',
    addressProvince: '',
    fiscalCode: '',
    idNumber: '',
    idType: 'Carta d’identità',
    idIssueDate: '',
    idExpiryDate: '',
    phone: '',
    email: '',
    signature: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const validateCode = async () => {
      try {
        const res = await fetch(`/api/request/validate?code=${code}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Codice non valido o già utilizzato.");
          return;
        }
        const data = await res.json();
        setRequestInfo(data);
      } catch (err) {
        setError("Errore di connessione al server.");
      } finally {
        setIsValidating(false);
      }
    };
    validateCode();
  }, [code]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!form.fullName.trim()) newErrors.fullName = "Nome obbligatorio";
    if (!form.birthPlace.trim()) newErrors.birthPlace = "Luogo di nascita obbligatorio";
    if (!form.birthDate) newErrors.birthDate = "Data di nascita obbligatoria";
    
    if (!form.addressStreet.trim()) newErrors.addressStreet = "Indirizzo obbligatorio";
    if (!form.addressNumber.trim()) newErrors.addressNumber = "Civico obbligatorio";
    
    if (!/^\d{5}$/.test(form.addressZip)) {
      newErrors.addressZip = "CAP deve essere di 5 cifre";
    }
    
    if (!form.addressCity.trim()) newErrors.addressCity = "Città obbligatoria";
    
    if (!/^[A-Z0-9]{16}$/.test(form.fiscalCode.toUpperCase())) {
      newErrors.fiscalCode = "Codice Fiscale non valido (16 caratteri)";
    }

    if (!form.idNumber.trim()) newErrors.idNumber = "Numero documento obbligatorio";
    
    if (form.idIssueDate && form.idExpiryDate) {
      if (new Date(form.idExpiryDate) <= new Date(form.idIssueDate)) {
        newErrors.idExpiryDate = "La scadenza deve essere successiva al rilascio";
      }
    }

    if (!form.email.includes('@')) newErrors.email = "Email non valida";
    if (!form.phone.trim()) newErrors.phone = "Telefono obbligatorio";
    if (!form.signature) newErrors.signature = "Firma obbligatoria";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      const firstError = Object.keys(errors)[0];
      const el = document.getElementsByName(firstError)[0];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          formData: { ...form, fiscalCode: form.fiscalCode.toUpperCase() },
          signatureDataUrl: form.signature
        })
      });

      if (!res.ok) throw new Error("Invio fallito");
      setIsSuccess(true);
    } catch (err) {
      setError("Errore durante l'invio dei dati.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <h2 className="text-xl font-black uppercase tracking-widest">Validazione...</h2>
      </div>
    );
  }

  if (error || isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="bg-white dark:bg-slate-900 p-12 rounded-[3rem] border border-slate-200 dark:border-white/10 shadow-2xl text-center max-w-md w-full animate-fade-in">
          {isSuccess ? (
            <>
              <CheckCircle className="w-20 h-20 text-emerald-500 mx-auto mb-6" />
              <h2 className="text-3xl font-black mb-4">Grazie!</h2>
              <p className="text-slate-500 font-medium mb-2">Dati inviati con successo alla produzione.</p>
              <p className="text-slate-400 text-sm">Puoi chiudere questa scheda.</p>
            </>
          ) : (
            <>
              <XCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
              <h2 className="text-3xl font-black mb-4">Link non valido</h2>
              <p className="text-slate-500 font-medium mb-8">Il link è scaduto o è già stato utilizzato.</p>
              <button 
                onClick={() => window.location.href = '/'}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20"
              >
                Torna alla Home
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const inputClass = (name: string) => `w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border ${errors[name] ? 'border-red-500' : 'border-slate-200 dark:border-white/10'} rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-medium`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors duration-300">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 py-6 px-6 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-600/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <span className="font-black text-2xl tracking-tight text-slate-900 dark:text-white">DocuSet</span>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-12">
        <div className="mb-12 animate-fade-in text-center sm:text-left">
          <h2 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2">
            PRODUZIONE: {requestInfo?.productionTitle || 'Film Production'}
          </h2>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white leading-tight mb-4">
            {requestInfo?.label || 'Raccolta Dati Personali'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Completa tutti i campi per finalizzare la tua registrazione.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-12 animate-fade-in">
          
          {/* SECTION 1: ANAGRAFICA */}
          <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-white/5 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <User className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Anagrafica</h3>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nome e Cognome</label>
              <input name="fullName" required type="text" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} className={inputClass('fullName')} placeholder="Mario Rossi" />
              {errors.fullName && <p className="text-[10px] text-red-500 font-bold px-1">{errors.fullName}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Luogo di Nascita</label>
                <input name="birthPlace" required type="text" value={form.birthPlace} onChange={e => setForm({...form, birthPlace: e.target.value})} className={inputClass('birthPlace')} placeholder="Roma" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Data di Nascita</label>
                <input name="birthDate" required type="date" value={form.birthDate} onChange={e => setForm({...form, birthDate: e.target.value})} className={inputClass('birthDate')} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Codice Fiscale</label>
              <input name="fiscalCode" required type="text" maxLength={16} value={form.fiscalCode} onChange={e => setForm({...form, fiscalCode: e.target.value.toUpperCase()})} className={`${inputClass('fiscalCode')} font-mono uppercase`} placeholder="RSSMRA80A01H501Z" />
              {errors.fiscalCode && <p className="text-[10px] text-red-500 font-bold px-1">{errors.fiscalCode}</p>}
            </div>
          </section>

          {/* SECTION 2: RESIDENZA */}
          <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-white/5 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <MapPin className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Residenza</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-3 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Via/Piazza</label>
                <input name="addressStreet" required type="text" value={form.addressStreet} onChange={e => setForm({...form, addressStreet: e.target.value})} className={inputClass('addressStreet')} placeholder="Via delle Rose" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">N.</label>
                <input name="addressNumber" required type="text" value={form.addressNumber} onChange={e => setForm({...form, addressNumber: e.target.value})} className={inputClass('addressNumber')} placeholder="10" />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">CAP</label>
                <input name="addressZip" required type="text" maxLength={5} value={form.addressZip} onChange={e => setForm({...form, addressZip: e.target.value.replace(/\D/g, '')})} className={inputClass('addressZip')} placeholder="00100" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Città</label>
                <input name="addressCity" required type="text" value={form.addressCity} onChange={e => setForm({...form, addressCity: e.target.value})} className={inputClass('addressCity')} placeholder="Milano" />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Prov.</label>
                <input name="addressProvince" type="text" maxLength={2} value={form.addressProvince} onChange={e => setForm({...form, addressProvince: e.target.value.toUpperCase()})} className={inputClass('addressProvince')} placeholder="MI" />
              </div>
            </div>
          </section>

          {/* SECTION 3: DOCUMENTO */}
          <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-white/5 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Documento</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tipo Documento</label>
                <select value={form.idType} onChange={e => setForm({...form, idType: e.target.value})} className={inputClass('idType')}>
                  <option>Carta d’identità</option>
                  <option>Patente</option>
                  <option>Passaporto</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Numero Documento</label>
                <input name="idNumber" required type="text" value={form.idNumber} onChange={e => setForm({...form, idNumber: e.target.value})} className={inputClass('idNumber')} placeholder="AB12345CD" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Data Rilascio</label>
                <input name="idIssueDate" required type="date" value={form.idIssueDate} onChange={e => setForm({...form, idIssueDate: e.target.value})} className={inputClass('idIssueDate')} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Data Scadenza</label>
                <input name="idExpiryDate" required type="date" value={form.idExpiryDate} onChange={e => setForm({...form, idExpiryDate: e.target.value})} className={inputClass('idExpiryDate')} />
                {errors.idExpiryDate && <p className="text-[10px] text-red-500 font-bold px-1">{errors.idExpiryDate}</p>}
              </div>
            </div>
          </section>

          {/* SECTION 4: CONTATTI */}
          <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-white/5 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <Phone className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Contatti</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Cellulare</label>
                <input name="phone" required type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className={inputClass('phone')} placeholder="+39 333..." />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email</label>
                <input name="email" required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className={inputClass('email')} placeholder="mario.rossi@email.it" />
              </div>
            </div>
          </section>

          {/* SECTION 5: FIRMA */}
          <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-white/5 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Type className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Firma</h3>
            </div>
            
            <div className={`rounded-[2rem] overflow-hidden border ${errors.signature ? 'border-red-500' : 'border-slate-200 dark:border-white/10'} shadow-lg bg-slate-50 dark:bg-white/5 p-2`}>
              <SignatureCanvas 
                onSave={(data) => setForm({ ...form, signature: data })} 
                onClear={() => setForm({ ...form, signature: '' })} 
              />
            </div>
            {errors.signature && <p className="text-[10px] text-red-500 font-bold px-1 text-center">{errors.signature}</p>}
            <p className="text-[10px] text-slate-400 font-medium px-4 text-center leading-relaxed">
              Dichiarazione: Certifico che i dati inseriti sono veritieri e corretti. La firma autografa apposta ha valore legale.
            </p>
          </section>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 text-white py-6 rounded-[2.5rem] font-black text-xl hover:bg-indigo-700 shadow-2xl shadow-indigo-600/20 disabled:opacity-50 transition-all flex items-center justify-center group"
          >
            {isSubmitting ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <>Invia Modulo <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-2 transition-transform" /></>
            )}
          </button>
        </form>
      </main>
      <footer className="py-12 px-6 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
        Potenziato da DocuSet &bull; 2024
      </footer>
    </div>
  );
};

export default ExternalSubmitForm;