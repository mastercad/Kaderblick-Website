/**
 * Tests für utils/exportPoster.ts
 *
 * Deckt ab:
 * - posterToBlob: delegiert an htmlToPngBlob, liefert den Blob zurück
 * - exportPosterAsPng: erstellt <a>-Link, setzt download + href, ruft click()
 * - exportPosterAsPng: verwendet Standard-Dateinamen 'poster.png' wenn kein filename angegeben
 * - exportPosterAsPng: verwendet übergebenen Dateinamen
 * - exportPosterAsPng: ruft URL.revokeObjectURL nach dem Click auf (via setTimeout)
 * - exportPosterAsPng: wirft bei fehlerhafter Blob-Erstellung (htmlToPngBlob rejection)
 */

jest.mock('../utils/svgExport', () => ({
  htmlToPngBlob: jest.fn(),
}));

import { posterToBlob, exportPosterAsPng } from '../utils/exportPoster';
import { htmlToPngBlob } from '../utils/svgExport';

const mockHtmlToPngBlob = htmlToPngBlob as jest.MockedFunction<typeof htmlToPngBlob>;

// ─── Fake HTMLDivElement ──────────────────────────────────────────────────────

function makeHtmlElement(): HTMLDivElement {
  return document.createElement('div');
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  global.URL.createObjectURL = jest.fn(() => 'blob:mock-export-url');
  global.URL.revokeObjectURL = jest.fn();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

// ─── posterToBlob ─────────────────────────────────────────────────────────────

describe('posterToBlob', () => {

  it('returns the blob from htmlToPngBlob', async () => {
    const fakeBlob = new Blob(['PNG'], { type: 'image/png' });
    mockHtmlToPngBlob.mockResolvedValue(fakeBlob);

    const el = makeHtmlElement();
    const result = await posterToBlob(el);

    expect(mockHtmlToPngBlob).toHaveBeenCalledWith(el);
    expect(result).toBe(fakeBlob);
  });

  it('propagates rejection from htmlToPngBlob', async () => {
    mockHtmlToPngBlob.mockRejectedValue(new Error('Render failed'));

    const el = makeHtmlElement();
    await expect(posterToBlob(el)).rejects.toThrow('Render failed');
  });
});

// ─── exportPosterAsPng ────────────────────────────────────────────────────────

describe('exportPosterAsPng', () => {

  it('creates a download link with default filename poster.png', async () => {
    const fakeBlob = new Blob(['PNG'], { type: 'image/png' });
    mockHtmlToPngBlob.mockResolvedValue(fakeBlob);

    const linkClickSpy = jest.fn();
    const fakeLink = { download: '', href: '', click: linkClickSpy } as unknown as HTMLAnchorElement;
    jest.spyOn(document, 'createElement').mockReturnValue(fakeLink);

    const el = makeHtmlElement();
    await exportPosterAsPng(el);

    expect(fakeLink.download).toBe('poster.png');
    expect(fakeLink.href).toBe('blob:mock-export-url');
    expect(linkClickSpy).toHaveBeenCalledTimes(1);
  });

  it('uses provided filename option', async () => {
    const fakeBlob = new Blob(['PNG'], { type: 'image/png' });
    mockHtmlToPngBlob.mockResolvedValue(fakeBlob);

    const fakeLink = { download: '', href: '', click: jest.fn() } as unknown as HTMLAnchorElement;
    jest.spyOn(document, 'createElement').mockReturnValue(fakeLink);

    const el = makeHtmlElement();
    await exportPosterAsPng(el, { filename: 'mein-poster.png' });

    expect(fakeLink.download).toBe('mein-poster.png');
  });

  it('calls URL.createObjectURL with the blob returned by htmlToPngBlob', async () => {
    const fakeBlob = new Blob(['PNG'], { type: 'image/png' });
    mockHtmlToPngBlob.mockResolvedValue(fakeBlob);

    const fakeLink = { download: '', href: '', click: jest.fn() } as unknown as HTMLAnchorElement;
    jest.spyOn(document, 'createElement').mockReturnValue(fakeLink);

    const el = makeHtmlElement();
    await exportPosterAsPng(el);

    expect(global.URL.createObjectURL).toHaveBeenCalledWith(fakeBlob);
  });

  it('schedules URL.revokeObjectURL via setTimeout after click', async () => {
    const fakeBlob = new Blob(['PNG'], { type: 'image/png' });
    mockHtmlToPngBlob.mockResolvedValue(fakeBlob);

    const fakeLink = { download: '', href: '', click: jest.fn() } as unknown as HTMLAnchorElement;
    jest.spyOn(document, 'createElement').mockReturnValue(fakeLink);

    const el = makeHtmlElement();
    await exportPosterAsPng(el);

    expect(global.URL.revokeObjectURL).not.toHaveBeenCalled();
    jest.runAllTimers();
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-export-url');
  });

  it('propagates rejection from htmlToPngBlob', async () => {
    mockHtmlToPngBlob.mockRejectedValue(new Error('Export failed'));

    const el = makeHtmlElement();
    await expect(exportPosterAsPng(el)).rejects.toThrow('Export failed');
  });
});
