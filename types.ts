
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
  x: number; // Legacy pixel x
  y: number; // Legacy pixel y
  xPct?: number; // Percentage x (0..1)
  yPct?: number; // Percentage y (0..1)
  page: number;
  fontSize?: number;
  width?: number; // Legacy pixel width
  height?: number; // Legacy pixel height
  wPct?: number; // Percentage width
  hPct?: number; // Percentage height
}

export interface Template {
  id: string;
  name: string;
  type: TemplateType;
  fileUrl: string; // Original blank PDF Base64
  fileName: string;
  fileType: string;
  isBlank: boolean;
  fields: FieldMapping[]; // This is used as the fieldPlacementMap
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
  hubToken: string; // The secret token for the signing hub
  fieldsJSON?: string;
}

export interface Production {
  id: string;
  title: string;
  createdAt: string;
  notes?: string;
  producerPhone?: string; // For "Contact Production" link
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
  finalPdfUrl?: string; // Generated signed PDF Base64
  auditJSON?: string; // Traceability data
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

export interface AppState {
  productions: Production[];
  people: Person[];
  templates: Template[];
  instances: DocumentInstance[];
  notifications: AppNotification[];
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
  taxCode: string; // Added Codice Fiscale
  role: string;
  idNumber: string;
  signature: string;
}
