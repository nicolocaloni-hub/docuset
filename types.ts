
export enum DocStatus {
  NOT_SENT = 'NON INVIATO',
  SENT = 'INVIATO',
  OPENED = 'APERTO',
  SIGNED = 'FIRMATO',
  REVOKED = 'REVOCATO'
}

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
}

export interface Production {
  id: string;
  title: string;
  createdAt: string;
  notes?: string;
  producerPhone?: string;
  formLink?: string; // Link to external form (Fillout, Jotform, etc.)
}

export interface DocumentInstance {
  id: string;
  productionId: string;
  personId: string;
  templateId: string;
  status: DocStatus;
  sentAt?: string;
  openedAt?: string;
  signedAt?: string;
  finalPdfUrl?: string;
  auditJSON?: string;
}

export interface AppNotification {
  id: string;
  productionId: string;
  personId: string;
  documentInstanceId: string;
  type: 'DOCUMENT_SIGNED';
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
}

export interface SubmissionRequest {
  code: string;
  productionId: string;
  label: string;
  createdAt: string;
  usedAt?: string;
}

export interface Submission {
  id: string;
  productionId: string;
  submittedAt: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  notes?: string;
  hasSignature: boolean;
  signatureData?: string; // URL or base64
}

export interface AppState {
  productions: Production[];
  people: Person[];
  templates: Template[];
  instances: DocumentInstance[];
  notifications: AppNotification[];
  submissionRequests?: SubmissionRequest[];
  submissions: Submission[]; // Local storage for imported CSV data
}

export enum DocumentStatus {
  PENDING = 'IN ATTESA',
  SENT = 'INVIATO',
  VIEWED = 'VISUALIZZATO',
  SIGNED = 'FIRMATO',
  EXPIRED = 'SCADUTO'
}

export interface DocumentRecord {
  id: string;
  recipientName: string;
  role: string;
  documentType: string;
  status: DocumentStatus;
}

export interface FormState {
  firstName: string;
  lastName: string;
  birthDate: string;
  taxCode: string;
  role: string;
  idNumber: string;
  signature: string;
}
