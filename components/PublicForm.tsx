
import React, { useState } from 'react';
import { 
  Camera, 
  Upload, 
  CheckCircle, 
  ShieldCheck, 
  Loader2, 
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import SignatureCanvas from './SignatureCanvas';
import { extractDocumentData } from '../services/gemini';
import { FormState } from '../types';

interface PublicFormProps {
  documentType: string;
  recipientName: string;
  onComplete: (data: FormState) => void;
}

const PublicForm: React.FC<PublicFormProps> = ({ documentType, recipientName, onComplete }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    firstName: '',
    lastName: '',
    birthDate: '',
    role: '',
    idNumber: '',
    signature: '',
  });

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
      window.scrollTo(0, 0);
    } else {
      onComplete(form);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 py-4 px-6 sticky top-0 z-10 shadow-sm">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-gray-900">DocuSet</span>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div 
                key={s} 
                className={`h-1.5 w-8 rounded-full transition-all duration-300 ${
                  s <= step ? 'bg-blue-600' : 'bg-gray-200'
                }`} 
              />
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-xl w-full mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-2">
            Passaggio {step} di 3
          </h2>
          <h1 className="text-2xl font-bold text-gray-900">
            {step === 1 && "Verifica Identità"}
            {step === 2 && "Dati Personali"}
            {step === 3 && "Concludi e Firma"}
          </h1>
          <p className="text-gray-500 mt-2">
            {step === 1 && `Ciao ${recipientName}, carica il tuo documento per velocizzare la procedura.`}
            {step === 2 && "Verifica e completa le informazioni per il documento."}
            {step === 3 && `Revisiona e firma il documento: ${documentType}.`}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {step === 1 && (
            <div className="space-y-6">
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
                  className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-2xl p-10 bg-white hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                  ) : (
                    <Upload className="w-12 h-12 text-gray-400 mb-4 group-hover:scale-110 transition-transform" />
                  )}
                  <p className="text-lg font-medium text-gray-900">
                    {loading ? "Analisi documento..." : "Carica Doc d'Identità"}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Carta d'Identità, Passaporto o Patente</p>
                </label>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-4 rounded-lg">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <div className="bg-blue-50 p-4 rounded-xl flex items-start gap-3">
                <div className="bg-white p-1 rounded">
                  <Camera className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-blue-900">Estrazione Dati AI</h4>
                  <p className="text-xs text-blue-700 mt-1">Compileremo automaticamente i passaggi successivi utilizzando la nostra tecnologia AI.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-4 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors underline underline-offset-4"
              >
                Salta e compila manualmente
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Nome</label>
                  <input
                    required
                    type="text"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Cognome</label>
                  <input
                    required
                    type="text"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Data di Nascita</label>
                <input
                  required
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Ruolo / Posizione</label>
                <input
                  required
                  type="text"
                  placeholder="es. Attore, DOP, Runner"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Numero Documento</label>
                <input
                  required
                  type="text"
                  value={form.idNumber}
                  onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Accordo Legale</h4>
                    <p className="text-xs text-gray-500">Confermo che tutti i dettagli forniti sono corretti.</p>
                  </div>
                </div>
                <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg max-h-40 overflow-y-auto mb-6">
                  <p className="mb-2"><strong>{documentType}</strong></p>
                  <p>Firmando questo documento, io, {form.firstName} {form.lastName}, nato/a il {form.birthDate}, 
                  in qualità di {form.role}, concedo a PrismaFilm il diritto di utilizzare la mia immagine e voce per scopi produttivi...</p>
                  <p className="mt-2 text-[10px] text-gray-400">ID Digitale: DOC-{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
                </div>
                
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-2">La tua Firma</label>
                <SignatureCanvas 
                  onSave={(data) => setForm({ ...form, signature: data })}
                  onClear={() => setForm({ ...form, signature: '' })}
                />
              </div>
            </div>
          )}

          <div className="sticky bottom-6 pt-4">
            <button
              type="submit"
              disabled={step === 3 && !form.signature}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 shadow-xl shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center group"
            >
              {step === 3 ? "Completa e Archivia" : "Continua"}
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </form>
      </main>
      
      <footer className="py-8 px-6 text-center text-gray-400 text-xs">
        © 2024 PrismaFilm - Firme Digitali DocuSet
      </footer>
    </div>
  );
};

export default PublicForm;
