import type { Template } from '../types';
import { fillPdfTemplateAutomatically, getPdfFormDataValue, getPdfSignatureSource } from './pdfTemplateFilling';

const fetchSignature = async (source: string) => {
  try {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.arrayBuffer();
  } catch {
    throw new Error('Non riesco a scaricare la firma indicata nel CSV. Verifica che il collegamento Tally sia ancora valido.');
  }
};

/** Template con campi posizionati a mano: scrive testo e firma nelle coordinate salvate. */
const fillMappedFields = async (template: Template, pdfBytes: ArrayBuffer, formData: Record<string, unknown>, signature?: ArrayBuffer) => {
  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  let signatureImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  if (signature) {
    signatureImage = await pdfDoc.embedPng(signature).catch(() => pdfDoc.embedJpg(signature));
  }

  for (const field of template.fields) {
    const page = pages[field.page || 0];
    if (!page) continue;
    const { width, height } = page.getSize();
    const x = field.xPct !== undefined ? field.xPct * width : field.x;
    const y = field.yPct !== undefined ? (1 - field.yPct) * height : height - field.y;

    if (field.type === 'signature' && signatureImage) {
      const w = field.wPct !== undefined ? field.wPct * width : (field.width || 150);
      const h = field.hPct !== undefined ? field.hPct * height : (field.height || 50);
      page.drawImage(signatureImage, { x, y: y - h, width: w, height: h });
    } else if (field.type !== 'signature') {
      const text = getPdfFormDataValue(formData, field.label) || getPdfFormDataValue(formData, field.id);
      if (text) page.drawText(text, { x, y, size: field.fontSize || 12 });
    }
  }
  return pdfDoc.save();
};

/** PDF del template compilato con le risposte Tally di una persona. */
export const buildPersonPdf = async (template: Template, pdfBytes: ArrayBuffer, formData: Record<string, unknown>) => {
  const source = getPdfSignatureSource(formData);
  // Come prima: con campi mappati una firma irraggiungibile non blocca il PDF.
  const signature = source
    ? await fetchSignature(source).catch(error => { if (template.fields.length > 0) return undefined; throw error; })
    : undefined;
  if (template.fields.length > 0) return fillMappedFields(template, pdfBytes, formData, signature);
  return (await fillPdfTemplateAutomatically(pdfBytes, formData, signature)).pdfBytes;
};
