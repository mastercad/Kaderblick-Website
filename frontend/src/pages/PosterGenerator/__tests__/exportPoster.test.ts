/**
 * Tests für utils/exportPoster.ts
 *
 * Deckt ab:
 * - posterToBlob: delegiert an svgToPngBlob, liefert den Blob zurück
 * - exportPosterAsPng: erstellt <a>-Link, setzt download + href, ruft click()
 * - exportPosterAsPng: verwendet Standard-Dateinamen 'poster.png' wenn kein filename angegeben
 * - exportPosterAsPng: verwendet übergebenen Dateinamen
 * - exportPosterAsPng: ruft URL.revokeObjectURL nach dem Click auf (via setTimeout)
 * - exportPosterAsPng: wirft bei fehlerhafter Blob-Erstellung (svgToPngBlob rejection)
 */

jest.mock('../utils/svgExport', () => ({
  svgToPngBlob: jest.fn(),
}));

import { posterToBlob, exportPosterAsPng } from '../utils/exportPoster';
import { svgToPngBlob } from '../utils/svgExport';

const mockSvgToPngBlob = svgToPngBlob as jest.MockedFunction<typeof svgToPngBlob>;

// ─── Fake SVGSVGElement ───────────────────────────────────────────────────────

function makeSvgElement(): SVGSVGElement {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
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

  it('returns the blob from svgToPngBlob', async () => {
    const fakeBlob = new Blob(['PNG'], { type: 'image/png' });
    mockSvgToPngBlob.mockResolvedValue(fakeBlob);

    const svg = makeSvgElement();
    const result = await posterToBlob(svg);

    expect(mockSvgToPngBlob).toHaveBeenCalledWith(svg);
    expect(result).toBe(fakeBlob);
  });

  it('propagates rejection from svgToPngBlob', async () => {
    mockSvgToPngBlob.mockRejectedValue(new Error('SVG render failed'));

    const svg = makeSvgElement();
    await expect(posterToBlob(svg)).rejects.toThrow('SVG render failed');
  });
});

// ─── exportPosterAsPng ────────────────────────────────────────────────────────

describe('exportPosterAsPng', () => {

  it('creates a download link with default filename poster.png', async () => {
    const fakeBlob = new Blob(['PNG'], { type: 'image/png' });
    mockSvgToPngBlob.mockResolvedValue(fakeBlob);

    const linkClickSpy = jest.fn();
    const fakeLink = { download: '', href: '', click: linkClickSpy } as unknown as HTMLAnchorElement;
    jest.spyOn(document, 'createElement').mockReturnValue(fakeLink);

    const svg = makeSvgElement();
    await exportPosterAsPng(svg);

    expect(fakeLink.download).toBe('poster.png');
    expect(fakeLink.href).toBe('blob:mock-export-url');
    expect(linkClickSpy).toHaveBeenCalledTimes(1);
  });

  it('uses provided filename option', async () => {
    const fakeBlob = new Blob(['PNG'], { type: 'image/png' });
    mockSvgToPngBlob.mockResolvedValue(fakeBlob);

    const fakeLink = { download: '', href: '', click: jest.fn() } as unknown as HTMLAnchorElement;
    jest.spyOn(document, 'createElement').mockReturnValue(fakeLink);

    const svg = makeSvgElement();
    await exportPosterAsPng(svg, { filename: 'mein-poster.png' });

    expect(fakeLink.download).toBe('mein-poster.png');
  });

  it('calls URL.createObjectURL with the blob returned by svgToPngBlob', async () => {
    const fakeBlob = new Blob(['PNG'], { type: 'image/png' });
    mockSvgToPngBlob.mockResolvedValue(fakeBlob);

    const fakeLink = { download: '', href: '', click: jest.fn() } as unknown as HTMLAnchorElement;
    jest.spyOn(document, 'createElement').mockReturnValue(fakeLink);

    const svg = makeSvgElement();
    await exportPosterAsPng(svg);

    expect(global.URL.createObjectURL).toHaveBeenCalledWith(fakeBlob);
  });

  it('schedules URL.revokeObjectURL via setTimeout after click', async () => {
    const fakeBlob = new Blob(['PNG'], { type: 'image/png' });
    mockSvgToPngBlob.mockResolvedValue(fakeBlob);

    const fakeLink = { download: '', href: '', click: jest.fn() } as unknown as HTMLAnchorElement;
    jest.spyOn(document, 'createElement').mockReturnValue(fakeLink);

    const svg = makeSvgElement();
    await exportPosterAsPng(svg);

    expect(global.URL.revokeObjectURL).not.toHaveBeenCalled();
    jest.runAllTimers();
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-export-url');
  });

  it('propagates rejection from svgToPngBlob', async () => {
    mockSvgToPngBlob.mockRejectedValue(new Error('Export failed'));

    const svg = makeSvgElement();
    await expect(exportPosterAsPng(svg)).rejects.toThrow('Export failed');
  });
});
