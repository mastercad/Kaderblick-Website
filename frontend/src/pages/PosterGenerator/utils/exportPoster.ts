import html2canvas from 'html2canvas';

export interface ExportOptions {
  filename?: string;
}

/**
 * Exportiert das übergebene DOM-Element als PNG-Download.
 * Das Element muss bereits gerendert und sichtbar (oder im Layout vorhanden) sein.
 * scale: 1 – das Element hat bereits native Auflösung (z. B. 1080×1080).
 */
export async function exportPosterAsPng(
  element: HTMLElement,
  options: ExportOptions = {},
): Promise<void> {
  const { filename = 'poster.png' } = options;

  const canvas = await html2canvas(element, {
    scale: 1,
    useCORS: true,
    allowTaint: false,
    backgroundColor: null,
  });

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

/**
 * Rendert das DOM-Element als PNG-Blob (für die Web Share API).
 */
export async function posterToBlob(
  element: HTMLElement,
): Promise<Blob> {
  const canvas = await html2canvas(element, {
    scale: 1,
    useCORS: true,
    allowTaint: false,
    backgroundColor: null,
  });

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob produced null'));
    }, 'image/png');
  });
}
