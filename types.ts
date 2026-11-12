export enum TemplateType {
  CONTRACT = 'CONTRATTO',
  RELEASE = 'LIBERATORIA',
  CERTIFICATE = 'CERTIFICATO',
  OTHER = 'ALTRO'
}

export interface FieldMapping {
  id: string;
  label: string;
  type: 'text' | 'date' | 'signature';
  x: number;
  y: number;
  xPct?: number;
  yPct?: number;
  page: number;
  fontSize?: number;
  width?: number;
  height?: number;
  wPct?: number;
  hPct?: number;
}

export interface Template {
  id: string;
  name: string;
  type: TemplateType;
  /** data: URL in modalità locale, `sb:<percorso>` quando il file è nello storage privato Supabase. */
  fileUrl: string;
  fileName: string;
  fileType: string;
  isBlank: boolean;
  fields: FieldMapping[];
  createdAt: string;
  notes?: string;
}

export interface Person {
  id: string;
  productionId: string;
  name: string;
  role: string;
  department: string;
  whatsapp: string;
  email?: string;
  notes?: string;
  hubToken: string;
  fieldsJSON?: string;
  removedAt?: string;
  deliveredAt?: string; // Data di consegna del modulo
  sentAt?: string; // Data di invio link WhatsApp
  solicitedAt?: string; // Data di sollecito WhatsApp
}

/** Campo del modulo DocuSet compilato da cast e troupe. */
export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'date' | 'textarea' | 'file' | 'signature';
  required: boolean;
}

/** Come appare il modulo pubblico: documento da leggere, copertina e logo. */
export interface FormAppearance {
  documentLabel?: string;
  documentUrl?: string;
  coverUrl?: string;
  logoUrl?: string;
  /** Colori di base del modulo; senza, quelli di DocuSet. */
  theme?: 'docuset' | 'bianco' | 'scuro';
  /** Colore di pulsanti e link, es. #1F6FEB. */
  accentColor?: string;
  /** Immagine di sfondo a tutta pagina. */
  backgroundUrl?: string;
}

export interface Production {
  id: string;
  title: string;
  createdAt: string;
  formAppearance?: FormAppearance;
  notes?: string;
  producerPhone?: string;
  formFields?: FormField[];
  whatsappMessageTemplate?: string;
  whatsappSolicitTemplate?: string;
}

export interface AppState {
  productions: Production[];
  people: Person[];
  templates: Template[];
}

/** Stato di consegna mostrato nelle strisce: deriva dai timestamp della persona. */
export type DeliveryStatus = 'delivered' | 'solicited' | 'sent' | 'todo';

export const deliveryStatus = (p: Person): DeliveryStatus =>
  p.deliveredAt ? 'delivered' : p.solicitedAt ? 'solicited' : p.sentAt ? 'sent' : 'todo';
