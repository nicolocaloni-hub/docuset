export interface TallyCsvSubmission {
  submittedAt: string;
  name: string;
  role: string;
  phone: string;
  personId: string;
  productionId: string;
  formData: Record<string, string>;
}

export interface TallyCsvParseResult {
  submissions: TallyCsvSubmission[];
  headers: string[];
  skippedRows: number;
  delimiter: ',' | ';' | '\t';
}

type CsvDelimiter = TallyCsvParseResult['delimiter'];

const NAME_ALIASES = [
  'nome e cognome', 'nome completo', 'nominativo', 'full name', 'name and surname',
  'first and last name', 'nombre y apellido'
];
const FIRST_NAME_ALIASES = ['nome', 'name', 'first name', 'firstname', 'given name'];
const LAST_NAME_ALIASES = ['cognome', 'last name', 'lastname', 'surname', 'family name'];
const ROLE_ALIASES = ['ruolo', 'role', 'mansione', 'qualifica', 'job title', 'posizione'];
const PHONE_ALIASES = ['telefono', 'cellulare', 'numero di telefono', 'phone', 'phone number', 'mobile', 'whatsapp'];
const BIRTH_DATE_ALIASES = ['data di nascita', 'data nascita', 'birth date', 'date of birth', 'birthday'];
const BIRTH_PLACE_ALIASES = ['luogo di nascita', 'luogo nascita', 'birth place', 'place of birth'];
const TAX_CODE_ALIASES = ['codice fiscale', 'codicefiscale', 'tax code', 'cf'];
const SUBMITTED_AT_ALIASES = ['submitted at', 'submission date', 'data invio', 'data di invio', 'inviato il', 'created at'];
const PERSON_ID_ALIASES = ['mid', 'person id', 'personid', 'member id', 'memberid', 'id membro'];
const PRODUCTION_ID_ALIASES = ['pid', 'production id', 'productionid', 'id produzione'];
const SYSTEM_HEADERS = new Set([
  'submission id', 'respondent id', 'submitted at', 'submission date', 'data invio',
  'data di invio', 'inviato il', 'created at', 'updated at', 'status', 'submission url',
  'submission pdf', 'submission preview', 'response id', 'respondent email'
]);

export function normalizeCsvHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDelimitedText(text: string, delimiter: CsvDelimiter): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some(value => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some(value => value.trim() !== '')) rows.push(row);
  return rows;
}

function detectDelimiter(text: string): CsvDelimiter {
  const candidates: CsvDelimiter[] = [',', ';', '\t'];
  let best: { delimiter: CsvDelimiter; score: number } = { delimiter: ',', score: -1 };

  for (const delimiter of candidates) {
    const rows = parseDelimitedText(text, delimiter).slice(0, 12);
    const widths = rows.map(row => row.length).filter(width => width > 1);
    if (widths.length === 0) continue;

    const frequency = new Map<number, number>();
    widths.forEach(width => frequency.set(width, (frequency.get(width) || 0) + 1));
    const [commonWidth, commonCount] = [...frequency.entries()].sort((a, b) => b[1] - a[1])[0];
    const score = commonWidth * 10 + commonCount * 100 - (widths.length - commonCount) * 25;
    if (score > best.score) best = { delimiter, score };
  }

  return best.delimiter;
}

function findValue(record: Map<string, string>, aliases: string[]): string {
  for (const alias of aliases) {
    const value = record.get(normalizeCsvHeader(alias));
    if (value?.trim()) return value.trim();
  }
  return '';
}

function isSignatureHeader(normalizedHeader: string): boolean {
  return normalizedHeader.includes('firma') || normalizedHeader.includes('signature');
}

export function extractCsvFileUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed)) return trimmed;
  if (/^https?:\/\/\S+$/i.test(trimmed)) return trimmed;

  try {
    const parsed = JSON.parse(trimmed);
    const queue: unknown[] = [parsed];
    while (queue.length > 0) {
      const current = queue.shift();
      if (typeof current === 'string') {
        const url = extractCsvFileUrl(current);
        if (url) return url;
      } else if (Array.isArray(current)) {
        queue.push(...current);
      } else if (current && typeof current === 'object') {
        queue.push(...Object.values(current));
      }
    }
  } catch {
    // The exported cell is usually a plain URL, so non-JSON values are expected.
  }

  const markdownMatch = trimmed.match(/\[[^\]]*\]\((https?:\/\/[^)]+)\)/i);
  if (markdownMatch) return markdownMatch[1];
  const htmlMatch = trimmed.match(/href=["'](https?:\/\/[^"']+)["']/i);
  if (htmlMatch) return htmlMatch[1];
  const urlMatch = trimmed.match(/https?:\/\/[^\s"'<>\]]+/i);
  return urlMatch?.[0] || '';
}

function toSubmittedAt(value: string): string {
  if (!value.trim()) return new Date().toISOString();
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? value.trim() : new Date(timestamp).toISOString();
}

function buildRecord(headers: string[], cells: string[]): Map<string, string> {
  const record = new Map<string, string>();
  headers.forEach((header, index) => {
    const normalized = normalizeCsvHeader(header);
    if (normalized && !record.has(normalized)) record.set(normalized, (cells[index] || '').trim());
  });
  return record;
}

export function parseTallyCsv(text: string): TallyCsvParseResult {
  const sanitized = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(sanitized);
  const rows = parseDelimitedText(sanitized, delimiter);

  if (rows.length === 0) {
    throw new Error('Il file CSV è vuoto.');
  }

  const headers = rows[0].map(header => header.replace(/^\uFEFF/, '').trim());
  if (headers.length < 2) {
    throw new Error('Il CSV non contiene colonne riconoscibili. Scaricalo dalla sezione Submissions di Tally.');
  }

  const normalizedHeaders = headers.map(normalizeCsvHeader);
  const hasNameColumn = normalizedHeaders.some(header =>
    [...NAME_ALIASES, ...FIRST_NAME_ALIASES].map(normalizeCsvHeader).includes(header)
  );
  if (!hasNameColumn) {
    throw new Error('Non trovo una colonna per il nome. Usa “Nome e Cognome” oppure colonne separate “Nome” e “Cognome”.');
  }

  const submissions: TallyCsvSubmission[] = [];
  let skippedRows = 0;

  for (const cells of rows.slice(1)) {
    const record = buildRecord(headers, cells);
    const combinedName = findValue(record, NAME_ALIASES);
    const firstName = findValue(record, FIRST_NAME_ALIASES);
    const lastName = findValue(record, LAST_NAME_ALIASES);
    const name = (combinedName || [firstName, lastName].filter(Boolean).join(' ')).replace(/\s+/g, ' ').trim();

    if (!name) {
      skippedRows += 1;
      continue;
    }

    const birthDate = findValue(record, BIRTH_DATE_ALIASES);
    const birthPlace = findValue(record, BIRTH_PLACE_ALIASES);
    const taxCode = findValue(record, TAX_CODE_ALIASES);
    const formData: Record<string, string> = {
      nome: name,
      ...(taxCode ? { cf: taxCode } : {}),
      ...(birthDate ? { dataNascita: birthDate } : {}),
      ...(birthPlace ? { luogoNascita: birthPlace } : {})
    };

    headers.forEach((header, index) => {
      const normalized = normalizedHeaders[index];
      const rawValue = (cells[index] || '').trim();
      if (!header || !rawValue) return;
      if (SYSTEM_HEADERS.has(normalized)) return;
      if (PERSON_ID_ALIASES.map(normalizeCsvHeader).includes(normalized)) return;
      if (PRODUCTION_ID_ALIASES.map(normalizeCsvHeader).includes(normalized)) return;
      if (NAME_ALIASES.map(normalizeCsvHeader).includes(normalized)) return;
      if (FIRST_NAME_ALIASES.map(normalizeCsvHeader).includes(normalized)) return;
      if (LAST_NAME_ALIASES.map(normalizeCsvHeader).includes(normalized)) return;

      formData[header] = isSignatureHeader(normalized) ? (extractCsvFileUrl(rawValue) || rawValue) : rawValue;
    });

    submissions.push({
      submittedAt: toSubmittedAt(findValue(record, SUBMITTED_AT_ALIASES)),
      name,
      role: findValue(record, ROLE_ALIASES),
      phone: findValue(record, PHONE_ALIASES),
      personId: findValue(record, PERSON_ID_ALIASES),
      productionId: findValue(record, PRODUCTION_ID_ALIASES),
      formData
    });
  }

  if (submissions.length === 0) {
    throw new Error('Il CSV non contiene risposte con un nome valido.');
  }

  return { submissions, headers, skippedRows, delimiter };
}

export async function parseTallyCsvFile(file: File): Promise<TallyCsvParseResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text: string;

  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes);
  }

  return parseTallyCsv(text);
}

function submissionTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function keepLatestTallySubmissions(submissions: TallyCsvSubmission[]): TallyCsvSubmission[] {
  const latestByPerson = new Map<string, TallyCsvSubmission>();

  submissions.forEach((submission, index) => {
    const normalizedName = submission.name.toLowerCase().trim().replace(/\s+/g, ' ');
    const key = submission.personId ? `id:${submission.personId}` : `name:${normalizedName}`;
    const current = latestByPerson.get(key);
    if (!current || submissionTimestamp(submission.submittedAt) > submissionTimestamp(current.submittedAt)) {
      latestByPerson.set(key, submission);
    } else if (submissionTimestamp(submission.submittedAt) === submissionTimestamp(current.submittedAt) && index > 0) {
      latestByPerson.set(key, submission);
    }
  });

  return [...latestByPerson.values()];
}
