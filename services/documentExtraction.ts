export interface ImportedCrewMember {
  name: string;
  role: string;
  phone: string;
  department?: string;
}

interface PositionedText {
  text: string;
  x: number;
  top: number;
  width: number;
  height: number;
}

interface PositionedPage {
  width: number;
  height: number;
  items: PositionedText[];
}

interface TextLine {
  top: number;
  height: number;
  items: PositionedText[];
}

interface ColumnLayout {
  nameMin: number;
  roleMin: number;
  phoneMin: number;
  phoneMax: number;
  departmentMin?: number;
}

interface DetectedHeader {
  line: TextLine;
  layout: ColumnLayout;
}

const LINE_TOLERANCE = 2.5;
const WRAPPED_LINE_GAP = 17;
const MIN_PHONE_DIGITS = 8;

let pdfJsPromise: Promise<any> | null = null;

const normalizeHeader = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Za-z0-9]+/g, ' ')
  .trim()
  .toUpperCase();

const collapseWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const isRoleHeader = (value: string) => {
  const normalized = normalizeHeader(value);
  return normalized === 'RUOLO' || normalized === 'MANSIONE' || normalized === 'QUALIFICA' || normalized === 'POSIZIONE';
};

const isPhoneHeader = (value: string) => {
  const normalized = normalizeHeader(value);
  return normalized === 'NUMERO'
    || normalized === 'TELEFONO'
    || normalized === 'CELLULARE'
    || normalized === 'CELL'
    || normalized === 'TEL'
    || normalized === 'WHATSAPP'
    || normalized === 'CONTATTO'
    || normalized.includes('NUMERO TELEFONO');
};

const isNameHeader = (value: string) => {
  const normalized = normalizeHeader(value);
  return normalized === 'NOME'
    || normalized === 'NOMINATIVO'
    || normalized === 'PERSONA'
    || normalized === 'NOME COGNOME'
    || normalized === 'COGNOME NOME';
};

const isIgnoredName = (value: string) => {
  const normalized = normalizeHeader(value);
  return !normalized
    || normalized === 'DA CONFERMARE'
    || isNameHeader(normalized)
    || isRoleHeader(normalized)
    || isPhoneHeader(normalized);
};

const digitsOnly = (value: string) => value.replace(/\D/g, '');

const looksLikePhone = (value: string) => {
  const digits = digitsOnly(value);
  return digits.length >= MIN_PHONE_DIGITS && digits.length <= 15;
};

const cleanFieldLines = (lines: string[]) => {
  let result = '';
  for (const rawLine of lines) {
    const line = collapseWhitespace(rawLine);
    if (!line) continue;

    const previousToken = result.split(/\s+/).at(-1) || '';
    const isShortWrappedSuffix = line.length <= 3 && previousToken.includes('/');
    result = result
      ? `${result}${isShortWrappedSuffix ? '' : ' '}${line}`
      : line;
  }
  return collapseWhitespace(result);
};

const groupIntoLines = (items: PositionedText[]): TextLine[] => {
  const lines: TextLine[] = [];
  const sorted = [...items]
    .filter(item => collapseWhitespace(item.text))
    .sort((a, b) => a.top - b.top || a.x - b.x);

  for (const item of sorted) {
    const line = lines.find(candidate => Math.abs(candidate.top - item.top) <= LINE_TOLERANCE);
    if (line) {
      line.items.push(item);
      line.items.sort((a, b) => a.x - b.x);
      line.height = Math.max(line.height, item.height);
    } else {
      lines.push({ top: item.top, height: item.height, items: [item] });
    }
  }

  return lines.sort((a, b) => a.top - b.top);
};

const detectHeader = (line: TextLine): DetectedHeader | null => {
  const orderedItems = [...line.items].sort((a, b) => a.x - b.x);
  const roleItem = orderedItems.find(item => isRoleHeader(item.text));
  const phoneItem = orderedItems.find(item => isPhoneHeader(item.text));
  if (!roleItem || !phoneItem || roleItem.x >= phoneItem.x) return null;

  const explicitNameItem = orderedItems.find(item => isNameHeader(item.text) && item.x < roleItem.x);
  const nameItem = explicitNameItem
    || [...orderedItems].reverse().find(item => item.x < roleItem.x);
  if (!nameItem) return null;

  const itemBeforeName = [...orderedItems].reverse().find(item => item.x < nameItem.x);
  const itemAfterPhone = orderedItems.find(item => item.x > phoneItem.x);

  return {
    line,
    layout: {
      nameMin: itemBeforeName ? (itemBeforeName.x + nameItem.x) / 2 : Number.NEGATIVE_INFINITY,
      roleMin: (nameItem.x + roleItem.x) / 2,
      phoneMin: (roleItem.x + phoneItem.x) / 2,
      phoneMax: itemAfterPhone ? (phoneItem.x + itemAfterPhone.x) / 2 : Number.POSITIVE_INFINITY,
      departmentMin: itemBeforeName ? Number.NEGATIVE_INFINITY : undefined,
    },
  };
};

const lineText = (line: TextLine) => collapseWhitespace(line.items.map(item => item.text).join(' '));

const linesInColumn = (
  items: PositionedText[],
  minX: number,
  maxX: number,
  startTop: number,
  endTop: number,
) => groupIntoLines(items.filter(item => (
  item.x >= minX
  && item.x < maxX
  && item.top >= startTop
  && item.top < endTop
)));

const collectAnchoredCell = (lines: TextLine[], anchorTop: number, windowStart: number, windowEnd: number) => {
  const candidates = lines.filter(line => line.top >= windowStart && line.top < windowEnd);
  if (candidates.length === 0) return '';

  let startIndex = 0;
  let smallestDistance = Number.POSITIVE_INFINITY;
  candidates.forEach((line, index) => {
    const distance = Math.abs(line.top - anchorTop);
    if (distance < smallestDistance) {
      startIndex = index;
      smallestDistance = distance;
    }
  });

  if (smallestDistance > WRAPPED_LINE_GAP) return '';

  const selected = [lineText(candidates[startIndex])];
  let previousTop = candidates[startIndex].top;
  for (let index = startIndex + 1; index < candidates.length; index += 1) {
    const line = candidates[index];
    if (line.top - previousTop > WRAPPED_LINE_GAP) break;
    selected.push(lineText(line));
    previousTop = line.top;
  }

  return cleanFieldLines(selected);
};

const extractSegment = (
  page: PositionedPage,
  layout: ColumnLayout,
  startTop: number,
  endTop: number,
): ImportedCrewMember[] => {
  const phoneLines = linesInColumn(page.items, layout.phoneMin, layout.phoneMax, startTop, endTop)
    .filter(line => digitsOnly(lineText(line)).length >= 4);

  const anchors: Array<{ top: number; phone: string }> = [];
  for (let index = 0; index < phoneLines.length; index += 1) {
    const firstLine = phoneLines[index];
    const parts = [lineText(firstLine)];
    let phoneDigits = digitsOnly(parts[0]);

    while (
      phoneDigits.length < MIN_PHONE_DIGITS
      && index + 1 < phoneLines.length
      && phoneLines[index + 1].top - phoneLines[index].top <= WRAPPED_LINE_GAP
    ) {
      index += 1;
      parts.push(lineText(phoneLines[index]));
      phoneDigits = digitsOnly(parts.join(' '));
    }

    const phone = collapseWhitespace(parts.join(' '));
    if (looksLikePhone(phone)) anchors.push({ top: firstLine.top, phone });
  }

  const nameLines = linesInColumn(page.items, layout.nameMin, layout.roleMin, startTop, endTop);
  const roleLines = linesInColumn(page.items, layout.roleMin, layout.phoneMin, startTop, endTop);

  return anchors.flatMap((anchor, index) => {
    const previousAnchor = anchors[index - 1];
    const nextAnchor = anchors[index + 1];
    const windowStart = previousAnchor ? (previousAnchor.top + anchor.top) / 2 : startTop;
    const windowEnd = nextAnchor ? (anchor.top + nextAnchor.top) / 2 : endTop;
    const name = collectAnchoredCell(nameLines, anchor.top, windowStart - LINE_TOLERANCE, windowEnd + LINE_TOLERANCE);
    if (!name || isIgnoredName(name) || /\d/.test(name)) return [];

    return [{
      name,
      role: collectAnchoredCell(roleLines, anchor.top, windowStart - LINE_TOLERANCE, windowEnd + LINE_TOLERANCE) || 'Crew',
      phone: anchor.phone,
    }];
  });
};

export const parsePositionedPdfPages = (pages: PositionedPage[]): ImportedCrewMember[] => {
  const members: ImportedCrewMember[] = [];
  let activeLayout: ColumnLayout | null = null;

  for (const page of pages) {
    const lines = groupIntoLines(page.items);
    const headers = lines
      .map(detectHeader)
      .filter((header): header is DetectedHeader => Boolean(header));

    let segmentStart = 0;
    for (const header of headers) {
      if (activeLayout && header.line.top > segmentStart) {
        members.push(...extractSegment(page, activeLayout, segmentStart, header.line.top - LINE_TOLERANCE));
      }
      activeLayout = header.layout;
      segmentStart = header.line.top + header.line.height + LINE_TOLERANCE;
    }

    if (activeLayout) {
      members.push(...extractSegment(page, activeLayout, segmentStart, page.height + 1));
    }
  }

  return members;
};

const loadPdfJs = async () => {
  if (!pdfJsPromise) {
    pdfJsPromise = import('pdfjs-dist/legacy/build/pdf.mjs').then(async pdfJs => {
      if (typeof window !== 'undefined' && !pdfJs.GlobalWorkerOptions.workerSrc) {
        const workerModule = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
        pdfJs.GlobalWorkerOptions.workerSrc = workerModule.default;
      }
      return pdfJs;
    });
  }
  return pdfJsPromise;
};

export const extractCrewMembersFromPdf = async (source: ArrayBuffer | Uint8Array) => {
  const pdfJs = await loadPdfJs();
  const data = source instanceof Uint8Array ? source : new Uint8Array(source);
  const pdf = await pdfJs.getDocument({ data }).promise;
  const pages: PositionedPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const items: PositionedText[] = textContent.items.flatMap((item: any) => {
      if (typeof item.str !== 'string' || !collapseWhitespace(item.str)) return [];
      return [{
        text: item.str,
        x: item.transform[4],
        top: viewport.height - item.transform[5],
        width: item.width || 0,
        height: item.height || 0,
      }];
    });

    pages.push({ width: viewport.width, height: viewport.height, items });
  }

  return parsePositionedPdfPages(pages);
};

export const parseCrewTables = (tables: string[][][]): ImportedCrewMember[] => {
  const members: ImportedCrewMember[] = [];

  for (const rows of tables) {
    let nameIndex = -1;
    let roleIndex = -1;
    let phoneIndex = -1;
    let departmentIndex = -1;
    let currentDepartment = 'Generale';

    for (const rawRow of rows) {
      const row = rawRow.map(cell => collapseWhitespace(cell || ''));
      const detectedRoleIndex = row.findIndex(isRoleHeader);
      const detectedPhoneIndex = row.findIndex(isPhoneHeader);
      if (detectedRoleIndex !== -1 && detectedPhoneIndex !== -1) {
        const explicitNameIndex = row.findIndex(isNameHeader);
        nameIndex = explicitNameIndex !== -1
          ? explicitNameIndex
          : row.map((cell, index) => ({ cell, index })).filter(({ cell, index }) => cell && index < detectedRoleIndex).at(-1)?.index ?? -1;
        roleIndex = detectedRoleIndex;
        phoneIndex = detectedPhoneIndex;
        departmentIndex = explicitNameIndex > 0 ? explicitNameIndex - 1 : -1;
        continue;
      }

      if (nameIndex === -1 || roleIndex === -1 || phoneIndex === -1) continue;

      const name = row[nameIndex] || '';
      const role = row[roleIndex] || '';
      const phone = row[phoneIndex] || '';
      const department = departmentIndex >= 0 ? row[departmentIndex] || '' : '';

      if (department && !name && !role && !phone) {
        currentDepartment = department;
        continue;
      }

      if (!name || isIgnoredName(name) || !looksLikePhone(phone)) continue;
      members.push({ name, role: role || 'Crew', phone, department: currentDepartment });
    }
  }

  return members;
};

export const extractCrewMembersFromDocx = async (source: ArrayBuffer) => {
  if (typeof DOMParser === 'undefined') {
    throw new Error('La lettura DOCX richiede il browser.');
  }

  const mammoth = await import('mammoth');
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: source });
  const document = new DOMParser().parseFromString(html, 'text/html');
  const tables = Array.from(document.querySelectorAll('table')).map(table => (
    Array.from(table.querySelectorAll('tr')).map(row => (
      Array.from(row.querySelectorAll('th, td')).map(cell => cell.textContent || '')
    ))
  ));

  return parseCrewTables(tables);
};

export const extractCrewMembersFromFile = async (file: File) => {
  const extension = file.name.toLowerCase().split('.').at(-1);
  if (extension === 'pdf' || file.type === 'application/pdf') {
    return extractCrewMembersFromPdf(await file.arrayBuffer());
  }
  if (extension === 'docx') {
    return extractCrewMembersFromDocx(await file.arrayBuffer());
  }
  throw new Error('Formato non supportato. Carica un file PDF o DOCX.');
};

export const normalizePhone = (phone: string) => {
  const value = collapseWhitespace(phone || '');
  if (!value) return '';

  const digits = digitsOnly(value);
  if (!digits) return '';
  if (value.trim().startsWith('+')) return `+${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('39') && digits.length >= 11) return `+${digits}`;
  return `+39${digits}`;
};

export const splitPersonName = (fullName: string) => {
  const parts = collapseWhitespace(fullName).split(' ').filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
};

