import { svgToPngBlob } from './svgExport';

export interface ExportOptions {
  filename?: string;
}

/**
 * Exportiert das SVG-Poster als PNG-Download.
 * Alle Fonts und Bilder werden vor dem Export als Base64 eingebettet.
 */
export async function exportPosterAsPng(
  element: SVGSVGElement,
  options: ExportOptions = {},
): Promise<void> {
  const { filename = 'poster.png' } = options;

  const blob = await svgToPngBlob(element);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Rendert das SVG-Poster als PNG-Blob (für die Web Share API).
 */
export async function posterToBlob(
  element: SVGSVGElement,
): Promise<Blob> {
  return svgToPngBlob(element);
}
