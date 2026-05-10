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
