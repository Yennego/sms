import { ExcuseDocument } from '@/types/daily-attendance';

export const EXCUSE_DOCUMENT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
const ALLOWED_TYPES = EXCUSE_DOCUMENT_ACCEPT.split(',');
const MAX_BYTES = 5 * 1024 * 1024;

/** Read a picked file as the base64 payload the API expects. Throws a readable Error. */
export function fileToExcuseDocument(file: File): Promise<ExcuseDocument> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return Promise.reject(new Error('Choose a photo (JPEG, PNG, WebP) or a PDF'));
  }
  if (file.size > MAX_BYTES) {
    return Promise.reject(new Error('The file is larger than 5 MB'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The file could not be read'));
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve({
        filename: file.name,
        content_type: file.type,
        data_base64: result.slice(result.indexOf(',') + 1), // strip "data:...;base64,"
      });
    };
    reader.readAsDataURL(file);
  });
}

/** Open a downloaded document in a new tab (falls back to a download if pop-ups are blocked). */
export function openExcuseDocument(doc: ExcuseDocument): void {
  const bytes = Uint8Array.from(atob(doc.data_base64), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: doc.content_type }));
  const tab = window.open(url, '_blank');
  if (!tab) {
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.filename;
    link.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
