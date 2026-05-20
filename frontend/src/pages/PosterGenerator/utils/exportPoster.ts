import { htmlToPngBlob } from './svgExport';

export interface ExportOptions {
  filename?: string;
}

/**
 * Exportiert das HTML-Poster als PNG-Download.
 */
export async function exportPosterAsPng(
  element: HTMLElement,
  options: ExportOptions = {},
): Promise<void> {
  const { filename = 'poster.png' } = options;

  const blob = await htmlToPngBlob(element);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Rendert das HTML-Poster als PNG-Blob (für die Web Share API).
 */
export async function posterToBlob(
  element: HTMLElement,
): Promise<Blob> {
  return htmlToPngBlob(element);
}

/**
 * Erstellt einen 1920×1080 (2:1) Blob für X/Twitter-Sharing.
 * Das Poster wird zentriert mit dunklem Hintergrund eingepasst (Letterbox).
 * Für 16:9-Poster (1920×1080) gibt es keine Balken – das Bild füllt die Fläche exakt.
 */
export async function createXOptimizedBlob(originalBlob: Blob): Promise<Blob> {
  const X_WIDTH  = 1920;
  const X_HEIGHT = 1080;

  const objectUrl = URL.createObjectURL(originalBlob);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload  = () => resolve();
    img.onerror = reject;
    img.src     = objectUrl;
  });
  URL.revokeObjectURL(objectUrl);

  const canvas = document.createElement('canvas');
  canvas.width  = X_WIDTH;
  canvas.height = X_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f0f1a';
  ctx.fillRect(0, 0, X_WIDTH, X_HEIGHT);

  const scale = Math.min(X_WIDTH / img.naturalWidth, X_HEIGHT / img.naturalHeight);
  const w = img.naturalWidth  * scale;
  const h = img.naturalHeight * scale;
  const x = (X_WIDTH  - w) / 2;
  const y = (X_HEIGHT - h) / 2;
  ctx.drawImage(img, x, y, w, h);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png',
    ),
  );
}
