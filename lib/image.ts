/** Lato lungo massimo: un documento resta leggibile e la foto scende sotto 1 MB. */
const MAX_SIDE = 2000;
const QUALITY = 0.82;

/**
 * Ridimensiona e ricomprime in JPEG le foto scattate col telefono.
 * PDF e immagini che il browser non sa leggere (es. HEIC fuori da Safari)
 * tornano invariati, come anche il caso raro in cui la versione compressa pesa di più.
 */
export const compressImage = async (file: File): Promise<{ blob: Blob; type: string; ext: string }> => {
  const original = { blob: file as Blob, type: file.type, ext: file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin' };
  if (!file.type.startsWith('image/')) return original;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    // Fondo bianco: le PNG trasparenti in JPEG altrimenti diventano nere.
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob || blob.size >= file.size) return original;
    return { blob, type: 'image/jpeg', ext: 'jpg' };
  } catch {
    return original;
  }
};
