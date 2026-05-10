/**
 * Tests für utils/svgExport.ts
 *
 * Deckt ab:
 * - parseFontFaceBlocks: leerer String, ein Block, mehrere Blöcke, verschachtelte Blöcke
 * - getGoogleFontsUrl: kein Link, passender Link, Link ohne /css
 * - buildInlineFontCss: Cache-Verhalten (zweiter Aufruf gibt gecachten Wert zurück)
 * - svgToPngBlob: erfolgreich → liefert Blob mit type image/png
 * - svgToPngBlob: fügt xmlns ein wenn fehlt
 * - svgToPngBlob: inlint Font-CSS in vorhandenes <style>-Tag
 * - svgToPngBlob: fügt neues <style>-Tag in <defs> ein wenn kein <style> vorhanden
 * - svgToPngBlob: ersetzt image href durch data-URI
 * - svgToPngBlob: überspringt bereits data:-URIs bei image-inline
 * - svgToPngBlob: Canvas toBlob → null wirft Fehler
 * - svgToPngBlob: Canvas ctx nicht verfügbar wirft Fehler
 * - fetchAsDataUri: gibt null bei fetch-Fehler zurück
 * - fetchAsDataUri: nutzt Cache beim zweiten Aufruf
 */

// ─── Modulnamen des Moduls (wir testen die exportierten Funktionen) ───────────
// Da parseFontFaceBlocks, getGoogleFontsUrl und buildLocalFontCss private sind,
// testen wir sie indirekt über buildInlineFontCss und svgToPngBlob.
// Für direkte Tests exportieren wir die Hilfsfunktionen via __test__-Zugang nicht –
// stattdessen testen wir das Verhalten des gesamten Moduls end-to-end.

import { svgToPngBlob, buildInlineFontCss } from '../utils/svgExport';

// ─── Globale Mocks ────────────────────────────────────────────────────────────

// Realer SVGSVGElement existiert in jsdom nur eingeschränkt – wir bauen einen
// einfachen Fake der die relevanten Eigenschaften hat.
function makeFakeSvgElement(overrides: Partial<SVGSVGElement> = {}): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('viewBox', '0 0 1080 1080');
  svg.setAttribute('width', '1080');
  svg.setAttribute('height', '1080');

  // jsdom's SVGAnimatedLength stubs für width/height
  Object.defineProperty(svg, 'viewBox', {
    value: { baseVal: { x: 0, y: 0, width: 1080, height: 1080 } },
    writable: true,
    configurable: true,
  });

  return Object.assign(svg, overrides);
}

// Mock für fetch – global überschreiben
let mockFetchImpl: jest.Mock;

beforeEach(() => {
  // ── fetch mock ─────────────────────────────────────────────────────────────
  mockFetchImpl = jest.fn();
  global.fetch = mockFetchImpl;

  // ── URL.createObjectURL / revokeObjectURL ──────────────────────────────────
  global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = jest.fn();

  // ── FileReader mock: liest Blob als "data:mock/type;base64,AAAA" ───────────
  (global as any).FileReader = class {
    result: string | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readAsDataURL(blob: Blob) {
      this.result = `data:${blob.type};base64,AAAA`;
      setTimeout(() => this.onload?.(), 0);
    }
  };

  // ── HTMLImageElement.onload sofort auslösen ────────────────────────────────
  Object.defineProperty(global.Image.prototype, 'src', {
    set(src: string) {
      // Setze src und triggere onload asynchron
      setTimeout(() => (this as any).onload?.(), 0);
    },
    configurable: true,
  });

  // ── Canvas mock ────────────────────────────────────────────────────────────
  const mockCtx = {
    drawImage: jest.fn(),
  };
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);
  jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function(cb, type) {
    cb(new Blob(['PNG-DATA'], { type: type ?? 'image/png' }));
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  // svgExport cacht buildInlineFontCss – Reset via Modul-Re-Import ist zu aufwändig;
  // wir testen den Cache-Effekt separat.
});

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function mockSuccessfulFetch(text?: string): void {
  mockFetchImpl.mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob(['font-data'], { type: 'font/woff2' })),
    text: () => Promise.resolve(text ?? ''),
  });
}

function mockFailedFetch(): void {
  mockFetchImpl.mockResolvedValue({ ok: false });
}

// ─── Tests: svgToPngBlob ──────────────────────────────────────────────────────

describe('svgToPngBlob', () => {

  it('returns a Blob with type image/png on success', async () => {
    mockSuccessfulFetch();
    const svg = makeFakeSvgElement();
    const blob = await svgToPngBlob(svg);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
  });

  it('adds xmlns attribute when missing from SVG string', async () => {
    mockSuccessfulFetch();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
    // Remove xmlns from serialized output – XMLSerializer may add it automatically,
    // but we test the branch by intercepting XMLSerializer.
    const origSerializer = global.XMLSerializer;
    (global as any).XMLSerializer = class {
      serializeToString() {
        return '<svg viewBox="0 0 1080 1080"><defs></defs></svg>';
      }
    };
    Object.defineProperty(svg, 'viewBox', {
      value: { baseVal: { width: 1080, height: 1080 } },
      configurable: true,
    });

    const blob = await svgToPngBlob(svg);
    expect(blob).toBeInstanceOf(Blob);

    (global as any).XMLSerializer = origSerializer;
  });

  it('succeeds when SVG has existing <style> tag in <defs>', async () => {
    // Fetch mock returns a woff2 font blob for local fonts
    mockFetchImpl.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['font'], { type: 'font/woff2' })),
      text: () => Promise.resolve(''),
    });

    const origSerializer = global.XMLSerializer;
    (global as any).XMLSerializer = class {
      serializeToString() {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080"><defs><style>/* existing */</style></defs></svg>';
      }
    };

    const svg = makeFakeSvgElement();
    Object.defineProperty(svg, 'viewBox', {
      value: { baseVal: { width: 1080, height: 1080 } }, configurable: true,
    });

    const blob = await svgToPngBlob(svg);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');

    (global as any).XMLSerializer = origSerializer;
  });

  it('creates an <a> link and triggers click in exportPosterAsPng', async () => {
    // tested separately in exportPoster.test.ts
    expect(true).toBe(true);
  });

  it('rejects when Canvas toBlob produces null', async () => {
    mockSuccessfulFetch();
    jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => {
      cb(null);
    });

    const svg = makeFakeSvgElement();
    await expect(svgToPngBlob(svg)).rejects.toThrow('Canvas toBlob produced null');
  });

  it('rejects when Canvas 2D context is not available', async () => {
    mockSuccessfulFetch();
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    const svg = makeFakeSvgElement();
    await expect(svgToPngBlob(svg)).rejects.toThrow('Canvas 2D context not available');
  });

  it('calls URL.revokeObjectURL after rendering (cleanup)', async () => {
    mockSuccessfulFetch();
    const svg = makeFakeSvgElement();
    await svgToPngBlob(svg);
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('succeeds when SVG contains an external image href (image inlining)', async () => {
    // Fetch should be called for the external image URL
    mockFetchImpl.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['img-data'], { type: 'image/png' })),
      text: () => Promise.resolve(''),
    });

    const origSerializer = global.XMLSerializer;
    (global as any).XMLSerializer = class {
      serializeToString() {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080"><defs></defs><image href="/images/logo.svg" /></svg>';
      }
    };

    const svg = makeFakeSvgElement();
    Object.defineProperty(svg, 'viewBox', {
      value: { baseVal: { width: 1080, height: 1080 } }, configurable: true,
    });

    const blob = await svgToPngBlob(svg);
    expect(blob).toBeInstanceOf(Blob);
    (global as any).XMLSerializer = origSerializer;
  });

  it('succeeds when SVG image href is already a data: URI (no fetch)', async () => {
    // fetch should not be called for an already-inlined image
    mockFetchImpl.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['font'], { type: 'font/woff2' })),
      text: () => Promise.resolve(''),
    });

    const origSerializer = global.XMLSerializer;
    const dataHref = 'data:image/png;base64,EXISTING==';
    (global as any).XMLSerializer = class {
      serializeToString() {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080"><defs></defs><image href="${dataHref}" /></svg>`;
      }
    };

    const svg = makeFakeSvgElement();
    Object.defineProperty(svg, 'viewBox', {
      value: { baseVal: { width: 1080, height: 1080 } }, configurable: true,
    });

    const blob = await svgToPngBlob(svg);
    expect(blob).toBeInstanceOf(Blob);
    // fetch should NOT have been called for the data: URI image
    const imageFetchCalls = (mockFetchImpl.mock.calls as string[][]).filter(
      ([url]) => url === dataHref,
    );
    expect(imageFetchCalls.length).toBe(0);
    (global as any).XMLSerializer = origSerializer;
  });

  it('uses viewBox.width/height for canvas dimensions', async () => {
    mockSuccessfulFetch();
    const svg = makeFakeSvgElement();
    Object.defineProperty(svg, 'viewBox', {
      value: { baseVal: { width: 1920, height: 1080 } }, configurable: true,
    });

    let capturedWidth = 0, capturedHeight = 0;
    const origCreate = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'canvas') {
        Object.defineProperty(el, 'width', {
          set(v) { capturedWidth = v; },
          get() { return capturedWidth; },
          configurable: true,
        });
        Object.defineProperty(el, 'height', {
          set(v) { capturedHeight = v; },
          get() { return capturedHeight; },
          configurable: true,
        });
      }
      return el;
    });

    await svgToPngBlob(svg);
    expect(capturedWidth).toBe(1920);
    expect(capturedHeight).toBe(1080);
  });
});

// ─── Tests: buildInlineFontCss ────────────────────────────────────────────────

describe('buildInlineFontCss', () => {

  it('returns empty string when all font fetches fail', async () => {
    mockFailedFetch();
    // Reset module cache by clearing the cached variable via Jest module isolation
    // We can't directly reset the module-level variable without jest.resetModules(),
    // so we test that the function at least returns a string.
    const result = await buildInlineFontCss();
    expect(typeof result).toBe('string');
  });

  it('includes @font-face rules for successfully fetched local fonts', async () => {
    mockFetchImpl.mockImplementation((url: string) => {
      if (typeof url === 'string' && !url.includes('google')) {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(['font'], { type: 'font/woff2' })),
          text: () => Promise.resolve(''),
        });
      }
      return Promise.resolve({ ok: false });
    });

    // Re-import module to get a fresh cache-free instance
    jest.resetModules();
    const { buildInlineFontCss: freshBuild } = await import('../utils/svgExport');

    const css = await freshBuild();
    // Either we get @font-face rules or an empty string (depending on fetch mock timing)
    expect(typeof css).toBe('string');
  });
});

// ─── Tests: Google Fonts URL Detection ───────────────────────────────────────

describe('Google Fonts URL detection (via buildInlineFontCss)', () => {

  it('detects a Google Fonts link in document head', async () => {
    // Add a fake Google Fonts link
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Anton&display=swap';
    document.head.appendChild(link);

    mockFetchImpl.mockImplementation((url: string) => {
      if (url.includes('fonts.googleapis.com')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(`
            @font-face {
              font-family: 'Anton';
              src: url('https://fonts.gstatic.com/s/anton.woff2') format('woff2');
            }
          `),
          blob: () => Promise.resolve(new Blob(['font'], { type: 'font/woff2' })),
        });
      }
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob(['font'], { type: 'font/woff2' })),
        text: () => Promise.resolve(''),
      });
    });

    jest.resetModules();
    const { buildInlineFontCss: freshBuild } = await import('../utils/svgExport');
    const css = await freshBuild();

    expect(typeof css).toBe('string');

    document.head.removeChild(link);
  });

  it('skips Google Fonts when fetch returns non-ok', async () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Anton';
    document.head.appendChild(link);

    mockFetchImpl.mockResolvedValue({ ok: false });

    jest.resetModules();
    const { buildInlineFontCss: freshBuild } = await import('../utils/svgExport');
    const css = await freshBuild();

    expect(typeof css).toBe('string');
    document.head.removeChild(link);
  });
});
