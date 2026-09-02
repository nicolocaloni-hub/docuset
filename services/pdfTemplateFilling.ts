import { extractCsvFileUrl, normalizeCsvHeader } from './tallyCsv';

export interface PdfTemplateTextItem {
  text: string;
  x: number;
  top: number;
  width: number;
  height: number;
}

export interface PdfTemplatePage {
  width: number;
  height: number;
  items: PdfTemplateTextItem[];
}

export interface PdfTemplatePlacement {
  page: number;
  fieldId: string;
  label: string;
  value: string;
  x: number;
  top: number;
  fontSize: number;
  type: 'text' | 'signature';
}

export interface FilledPdfResult {
  pdfBytes: Uint8Array;
  filledLabels: string[];
  signaturePlaced: boolean;
}

interface DataField {
  id: string;
  label: string;
  value: string;
  aliases: string[];
  kind: 'text' | 'date';
}

interface TextLine {
  top: number;
  height: number;
  items: PdfTemplateTextItem[];
  words: LineWord[];
}

interface LineWord {
  normalized: string;
  item: PdfTemplateTextItem;
  rawEnd: number;
}

interface CanonicalField {
  id: string;
  label: string;
  kind: DataField['kind'];
  aliases: string[];
}

const CM_HALF_IN_POINTS = 14.1732;
const LINE_TOLERANCE = 3;
const MIN_FONT_SIZE = 7.5;
const PAGE_MARGIN = 24;

const CANONICAL_FIELDS: CanonicalField[] = [
  {
    id: 'fullName',
    label: 'Nome e Cognome',
    kind: 'text',
    aliases: ['nome e cognome', 'nome completo', 'nominativo', 'nome', 'full name', 'name and surname'],
  },
  {
    id: 'birthPlace',
    label: 'Luogo di nascita',
    kind: 'text',
    aliases: ['luogo di nascita', 'luogo nascita', 'birth place', 'place of birth'],
  },
  {
    id: 'birthDate',
    label: 'Data di nascita',
    kind: 'date',
    aliases: ['data di nascita', 'data nascita', 'datanascita', 'birth date', 'date of birth'],
  },
  {
    id: 'taxCode',
    label: 'Codice Fiscale',
    kind: 'text',
    aliases: ['codice fiscale', 'codicefiscale', 'c f', 'cf', 'tax code'],
  },
  {
    id: 'phone',
    label: 'Telefono',
    kind: 'text',
    aliases: ['numero di telefono', 'telefono', 'cellulare', 'cell', 'tel', 'phone number', 'phone', 'whatsapp'],
  },
  {
    id: 'email',
    label: 'Email',
    kind: 'text',
    aliases: ['indirizzo email', 'posta elettronica', 'email', 'e mail'],
  },
  {
    id: 'address',
    label: 'Indirizzo',
    kind: 'text',
    aliases: ['indirizzo di residenza', 'residenza', 'indirizzo', 'address'],
  },
  {
    id: 'role',
    label: 'Ruolo',
    kind: 'text',
    aliases: ['ruolo', 'mansione', 'qualifica', 'role'],
  },
];

const SIGNATURE_ALIASES = [
  'firma partecipante leggibile',
  'firma del partecipante',
  'firma partecipante',
  'firma qui',
  'la tua firma',
  'firma',
  'signature',
];

const normalizeAlias = (value: string) => normalizeCsvHeader(value);
const compact = (value: string) => normalizeAlias(value).replace(/\s/g, '');
const toUint8Array = (source: ArrayBuffer | Uint8Array) => Uint8Array.from(
  source instanceof Uint8Array ? source : new Uint8Array(source)
);

const uniqueAliases = (values: string[]) => [...new Set(values.map(normalizeAlias).filter(Boolean))]
  .sort((a, b) => b.length - a.length);

const isSignatureField = (key: string, value: string) => {
  const normalizedKey = normalizeAlias(key);
  return normalizedKey.includes('firma')
    || normalizedKey.includes('signature')
    || value.includes('storage.tally.so');
};

const matchesAlias = (left: string, right: string) => {
  const normalizedLeft = normalizeAlias(left);
  const normalizedRight = normalizeAlias(right);
  if (!normalizedLeft || !normalizedRight) return false;
  const leftPhrase = ` ${normalizedLeft} `;
  const rightPhrase = ` ${normalizedRight} `;
  return normalizedLeft === normalizedRight
    || compact(normalizedLeft) === compact(normalizedRight)
    || (normalizedRight.length > 3 && leftPhrase.includes(rightPhrase));
};

const canonicalForKey = (key: string) => CANONICAL_FIELDS.find(field =>
  field.aliases.some(alias => matchesAlias(key, alias))
);

const toDisplayValue = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

export const formatPdfFieldValue = (value: string, kind: DataField['kind'] = 'text') => {
  const trimmed = value.trim();
  if (kind !== 'date') return trimmed;

  const isoDate = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;

  const englishDate = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (englishDate) {
    const first = Number(englishDate[1]);
    const second = Number(englishDate[2]);
    if (first > 12 && second <= 12) return trimmed;
  }

  return trimmed;
};

export const getPdfFormDataValue = (formData: Record<string, unknown>, label: string): string => {
  const canonical = canonicalForKey(label);
  const aliases = uniqueAliases([label, ...(canonical?.aliases || [])]);

  for (const [key, rawValue] of Object.entries(formData)) {
    const value = toDisplayValue(rawValue);
    if (!value || isSignatureField(key, value)) continue;
    if (aliases.some(alias => matchesAlias(key, alias))) {
      return formatPdfFieldValue(value, canonical?.kind || 'text');
    }
  }

  return '';
};

export const getPdfSignatureSource = (formData: Record<string, unknown>): string => {
  for (const [key, rawValue] of Object.entries(formData)) {
    const value = toDisplayValue(rawValue);
    if (!value || !isSignatureField(key, value)) continue;
    const source = extractCsvFileUrl(value);
    if (source) return source;
  }
  return '';
};

const buildDataFields = (formData: Record<string, unknown>): DataField[] => {
  const canonicalValues = new Map<string, { value: string; sourceKey: string }>();
  const genericFields: DataField[] = [];

  for (const [key, rawValue] of Object.entries(formData)) {
    const value = toDisplayValue(rawValue);
    if (!value || isSignatureField(key, value)) continue;

    const canonical = canonicalForKey(key);
    if (canonical) {
      if (!canonicalValues.has(canonical.id)) canonicalValues.set(canonical.id, { value, sourceKey: key });
      continue;
    }

    const normalizedKey = normalizeAlias(key);
    if (!normalizedKey || normalizedKey.length < 2) continue;
    genericFields.push({
      id: `custom:${normalizedKey}`,
      label: key,
      value,
      aliases: [normalizedKey],
      kind: /(^|\s)data($|\s)|date/.test(normalizedKey) ? 'date' : 'text',
    });
  }

  const knownFields = CANONICAL_FIELDS.flatMap(field => {
    const matched = canonicalValues.get(field.id);
    if (!matched) return [];
    return [{
      id: field.id,
      label: field.label,
      value: matched.value,
      aliases: uniqueAliases([matched.sourceKey, ...field.aliases]),
      kind: field.kind,
    } satisfies DataField];
  });

  return [...knownFields, ...genericFields];
};

const buildWords = (item: PdfTemplateTextItem): LineWord[] => {
  const words: LineWord[] = [];
  const matcher = /[\p{L}\p{N}]+/gu;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(item.text)) !== null) {
    const normalized = normalizeAlias(match[0]);
    if (normalized) words.push({ normalized, item, rawEnd: match.index + match[0].length });
  }

  return words;
};

const groupIntoLines = (items: PdfTemplateTextItem[]): TextLine[] => {
  const lines: TextLine[] = [];
  const ordered = [...items]
    .filter(item => item.text.trim())
    .sort((a, b) => a.top - b.top || a.x - b.x);

  for (const item of ordered) {
    const line = lines.find(candidate => Math.abs(candidate.top - item.top) <= LINE_TOLERANCE);
    if (line) {
      line.items.push(item);
      line.items.sort((a, b) => a.x - b.x);
      line.height = Math.max(line.height, item.height);
      line.words = line.items.flatMap(buildWords);
    } else {
      lines.push({ top: item.top, height: item.height, items: [item], words: buildWords(item) });
    }
  }

  return lines;
};

const findWordSequence = (line: TextLine, alias: string) => {
  const aliasWords = normalizeAlias(alias).split(' ').filter(Boolean);
  if (aliasWords.length === 0 || aliasWords.length > line.words.length) return null;

  for (let start = 0; start <= line.words.length - aliasWords.length; start += 1) {
    const matches = aliasWords.every((word, offset) => line.words[start + offset].normalized === word);
    if (matches) return { start, end: start + aliasWords.length - 1 };
  }

  return null;
};

const lineText = (line: TextLine) => line.items.map(item => item.text).join(' ').trim();

const isLabelLike = (line: TextLine, matchStart: number, matchEnd: number, alias: string) => {
  const rawText = lineText(line);
  const normalizedLength = line.words.map(word => word.normalized).join(' ').length;
  const aliasLength = normalizeAlias(alias).length;
  const hasLabelMarker = /[:*]|_{2,}|\.{3,}/.test(rawText);
  const startsNearBeginning = matchStart <= 2;
  const endsNearEnd = line.words.length - matchEnd - 1 <= 3;
  const isShortLabel = normalizedLength <= Math.max(aliasLength + 18, 34);
  const tinyAliasIsExplicit = aliasLength > 3 || hasLabelMarker || normalizedLength <= aliasLength + 2;

  return tinyAliasIsExplicit && (hasLabelMarker || (startsNearBeginning && endsNearEnd && isShortLabel));
};

const anchorEndX = (line: TextLine, terminalWord: LineWord) => {
  const item = terminalWord.item;
  let rawEnd = terminalWord.rawEnd;
  const remainder = item.text.slice(rawEnd);
  const colonOffset = remainder.search(/:/);
  if (colonOffset >= 0 && colonOffset <= 28) rawEnd += colonOffset + 1;
  else {
    const punctuation = remainder.match(/^[\s*.)\]-]+/);
    if (punctuation) rawEnd += punctuation[0].length;
  }

  const proportion = item.text.length > 0 ? Math.min(1, rawEnd / item.text.length) : 1;
  const fallbackWidth = Math.max(item.text.length * Math.max(item.height, 10) * 0.48, 1);
  return item.x + Math.max(item.width || fallbackWidth, 1) * proportion;
};

const bestLineMatch = (line: TextLine, aliases: string[]) => {
  for (const alias of uniqueAliases(aliases)) {
    const match = findWordSequence(line, alias);
    if (!match || !isLabelLike(line, match.start, match.end, alias)) continue;
    return {
      alias,
      endX: anchorEndX(line, line.words[match.end]),
    };
  }
  return null;
};

export const detectPdfTemplatePlacements = (
  pages: PdfTemplatePage[],
  formData: Record<string, unknown>,
  hasSignature: boolean,
): PdfTemplatePlacement[] => {
  const fields = buildDataFields(formData);
  const placements: PdfTemplatePlacement[] = [];

  pages.forEach((page, pageIndex) => {
    const lines = groupIntoLines(page.items);
    for (const line of lines) {
      for (const field of fields) {
        const match = bestLineMatch(line, field.aliases);
        if (!match) continue;
        placements.push({
          page: pageIndex,
          fieldId: field.id,
          label: field.label,
          value: formatPdfFieldValue(field.value, field.kind),
          x: match.endX + CM_HALF_IN_POINTS,
          top: line.top,
          fontSize: Math.max(MIN_FONT_SIZE, Math.min(12, line.height || 10)),
          type: 'text',
        });
      }

      if (hasSignature) {
        const signatureMatch = bestLineMatch(line, SIGNATURE_ALIASES);
        if (signatureMatch) {
          placements.push({
            page: pageIndex,
            fieldId: 'signature',
            label: 'Firma',
            value: '',
            x: signatureMatch.endX + CM_HALF_IN_POINTS,
            top: line.top + Math.max(5, line.height * 0.35),
            fontSize: 0,
            type: 'signature',
          });
        }
      }
    }
  });

  return placements;
};

let pdfJsPromise: Promise<any> | null = null;

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

export const extractPdfTemplatePages = async (source: ArrayBuffer | Uint8Array): Promise<PdfTemplatePage[]> => {
  const pdfJs = await loadPdfJs();
  const bytes = toUint8Array(source);
  const pdf = await pdfJs.getDocument({ data: bytes.slice() }).promise;
  const pages: PdfTemplatePage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const items: PdfTemplateTextItem[] = textContent.items.flatMap((item: any) => {
      if (typeof item.str !== 'string' || !item.str.trim()) return [];
      return [{
        text: item.str,
        x: item.transform[4],
        top: viewport.height - item.transform[5],
        width: item.width || 0,
        height: item.height || Math.abs(item.transform[3]) || 10,
      }];
    });
    pages.push({ width: viewport.width, height: viewport.height, items });
  }

  return pages;
};

const fitText = (
  font: { widthOfTextAtSize: (text: string, size: number) => number },
  value: string,
  preferredSize: number,
  maxWidth: number,
) => {
  let size = preferredSize;
  while (size > MIN_FONT_SIZE && font.widthOfTextAtSize(value, size) > maxWidth) size -= 0.5;
  return size;
};

export const fillPdfTemplateAutomatically = async (
  source: ArrayBuffer | Uint8Array,
  formData: Record<string, unknown>,
  signatureBytes?: ArrayBuffer | Uint8Array,
): Promise<FilledPdfResult> => {
  const sourceBytes = toUint8Array(source);
  const positionedPages = await extractPdfTemplatePages(sourceBytes);
  const { PDFDict, PDFDocument, PDFName, PDFTextField, StandardFonts } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.load(sourceBytes.slice());
  const pdfPages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const hasSignature = Boolean(signatureBytes && (signatureBytes instanceof Uint8Array ? signatureBytes.byteLength : signatureBytes.byteLength));
  const placements = detectPdfTemplatePlacements(positionedPages, formData, hasSignature);
  const filledLabels = new Set<string>();
  let filledAcroFields = 0;

  try {
    const acroForm = pdfDoc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
    if (!acroForm) throw new Error('PDF statico senza AcroForm');
    const form = pdfDoc.getForm();
    const formFields = form.getFields();
    for (const field of formFields) {
      const fieldName = field.getName();
      const value = getPdfFormDataValue(formData, fieldName);
      if (!value || !(field instanceof PDFTextField)) continue;
      try {
        form.getTextField(fieldName).setText(value);
        filledAcroFields += 1;
        filledLabels.add(fieldName);
      } catch {
        // Unsupported AcroForm field types are left untouched.
      }
    }
    if (formFields.length > 0) form.flatten();
    pdfDoc.catalog.delete(PDFName.of('AcroForm'));
  } catch {
    // A static PDF may not contain an AcroForm dictionary.
  }

  let signatureImage: any = null;
  if (hasSignature && signatureBytes) {
    const bytes = toUint8Array(signatureBytes);
    try {
      signatureImage = await pdfDoc.embedPng(bytes);
    } catch {
      try {
        signatureImage = await pdfDoc.embedJpg(bytes);
      } catch {
        throw new Error('La firma nel CSV non è un’immagine PNG o JPG valida.');
      }
    }
  }

  let signaturePlaced = false;
  for (const placement of placements) {
    if (placement.page >= pdfPages.length) continue;
    const page = pdfPages[placement.page];
    const sourcePage = positionedPages[placement.page];
    const { width, height } = page.getSize();
    const xScale = width / sourcePage.width;
    const yScale = height / sourcePage.height;
    let x = placement.x * xScale;
    const baselineY = height - placement.top * yScale;

    if (placement.type === 'signature') {
      if (!signatureImage) continue;
      const naturalRatio = signatureImage.width / signatureImage.height || 3;
      let signatureWidth = Math.min(150, width - x - PAGE_MARGIN);
      if (signatureWidth < 70) {
        x = PAGE_MARGIN;
        signatureWidth = Math.min(150, width - PAGE_MARGIN * 2);
      }
      const signatureHeight = Math.min(52, signatureWidth / naturalRatio);
      page.drawImage(signatureImage, {
        x,
        y: Math.max(PAGE_MARGIN, baselineY - signatureHeight * 0.55),
        width: signatureWidth,
        height: signatureHeight,
      });
      signaturePlaced = true;
      continue;
    }

    if (filledAcroFields > 0) continue;
    let maxWidth = width - x - PAGE_MARGIN;
    if (maxWidth < 70) {
      x = PAGE_MARGIN;
      maxWidth = width - PAGE_MARGIN * 2;
    }
    const size = fitText(font, placement.value, placement.fontSize, maxWidth);
    page.drawText(placement.value, {
      x,
      y: Math.max(PAGE_MARGIN, baselineY),
      size,
      font,
      maxWidth,
    });
    filledLabels.add(placement.label);
  }

  if (filledLabels.size === 0 && !signaturePlaced) {
    throw new Error('Non ho trovato nel PDF etichette compatibili con i dati importati. Verifica che il template contenga testo selezionabile, non soltanto una scansione.');
  }

  return {
    pdfBytes: await pdfDoc.save(),
    filledLabels: [...filledLabels],
    signaturePlaced,
  };
};

