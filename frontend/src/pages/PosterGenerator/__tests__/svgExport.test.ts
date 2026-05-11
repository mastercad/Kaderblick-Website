/**
 * Tests für utils/svgExport.ts (html2canvas-Pipeline)
 *
 * Deckt ab:
 * - htmlToPngBlob: Erfolgsfall → Blob mit type image/png
 * - htmlToPngBlob: toBlob → null wirft Fehler
 * - htmlToPngBlob: data:-URI-Passthrough (kein fetch)
 * - htmlToPngBlob: Cross-Origin-URL wird zu relativem Pfad umgeschrieben
 * - htmlToPngBlob: Inlinen von CSS background-image
 * - htmlToPngBlob: Klon wird nach dem Rendern aus dem DOM entfernt (cleanup)
 * - htmlToPngBlob: Klon-Wrapper hat position:absolute und top:0 (kein position:fixed)
 *   → verhindert dass html2canvas die untere Poster-Hälfte abschneidet
 * - htmlToPngBlob: html2canvas wird mit width/height des Originals aufgerufen
 */

import html2canvas from 'html2canvas';
import { htmlToPngBlob } from '../utils/svgExport';

jest.mock('html2canvas');

const mockHtml2canvas = html2canvas as jest.MockedFunction<typeof html2canvas>;

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function makeHtmlElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.width = '1080px';
  el.style.height = '1080px';
  return el;
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

let mockFetch: jest.Mock;

beforeEach(() => {
  mockFetch = jest.fn();
  global.fetch = mockFetch;

  // FileReader mock: blob → data:image/png;base64,AAAA
  (global as any).FileReader = class {
    result: string | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readAsDataURL(blob: Blob) {
      this.result = `data:${blob.type};base64,AAAA`;
      setTimeout(() => this.onload?.(), 0);
    }
  };

  // html2canvas gibt einen Canvas zurück der per toBlob ein PNG liefert
  const mockCanvas = document.createElement('canvas');
  jest.spyOn(mockCanvas, 'toBlob').mockImplementation((cb, type) => {
    cb(new Blob(['PNG'], { type: type ?? 'image/png' }));
  });
  mockHtml2canvas.mockResolvedValue(mockCanvas);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('htmlToPngBlob', () => {

  it('returns a Blob with type image/png on success', async () => {
    const el = makeHtmlElement();
    document.body.appendChild(el);
    const blob = await htmlToPngBlob(el);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
    document.body.removeChild(el);
  });

  it('rejects when html2canvas toBlob produces null', async () => {
    const mockCanvas = document.createElement('canvas');
    jest.spyOn(mockCanvas, 'toBlob').mockImplementation((cb) => { cb(null); });
    mockHtml2canvas.mockResolvedValue(mockCanvas);

    const el = makeHtmlElement();
    document.body.appendChild(el);
    await expect(htmlToPngBlob(el)).rejects.toThrow('html2canvas toBlob lieferte null');
    document.body.removeChild(el);
  });

  it('passes data: URIs through without fetching', async () => {
    const el = makeHtmlElement();
    const img = document.createElement('img');
    img.src = 'data:image/png;base64,EXISTING==';
    el.appendChild(img);
    document.body.appendChild(el);

    await htmlToPngBlob(el);

    // fetch darf für data:-URIs nicht aufgerufen werden
    expect(mockFetch).not.toHaveBeenCalledWith(expect.stringContaining('data:'));
    document.body.removeChild(el);
  });

  it('rewrites absolute cross-origin URLs to relative paths', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['img'], { type: 'image/png' })),
    });

    const el = makeHtmlElement();
    const img = document.createElement('img');
    // Eine externe URL die nicht mit window.location.origin übereinstimmt
    img.src = 'http://other-server.example.com/uploads/photo.jpg';
    el.appendChild(img);
    document.body.appendChild(el);

    await htmlToPngBlob(el);

    // fetch muss mit dem relativen Pfad aufgerufen worden sein
    expect(mockFetch).toHaveBeenCalledWith('/uploads/photo.jpg');
    document.body.removeChild(el);
  });

  it('inlines CSS background-image URL as data URI', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['bg'], { type: 'image/jpeg' })),
    });

    const el = makeHtmlElement();
    const bgDiv = document.createElement('div');
    bgDiv.style.backgroundImage = "url('/uploads/background.jpg')";
    el.appendChild(bgDiv);
    document.body.appendChild(el);

    await htmlToPngBlob(el);

    // Das background-image des Klons sollte nach dem Preprocessing eine data:-URI enthalten
    // (wir prüfen dass fetch mit dem relativen Pfad aufgerufen wurde)
    expect(mockFetch).toHaveBeenCalledWith('/uploads/background.jpg');
    document.body.removeChild(el);
  });

  it('does not fetch CSS background gradients', async () => {
    const el = makeHtmlElement();
    const gradDiv = document.createElement('div');
    gradDiv.style.backgroundImage = 'linear-gradient(90deg, #fff 0%, #000 100%)';
    el.appendChild(gradDiv);
    document.body.appendChild(el);

    await htmlToPngBlob(el);

    // fetch darf für Gradienten nicht aufgerufen werden
    expect(mockFetch).not.toHaveBeenCalled();
    document.body.removeChild(el);
  });

  it('removes the cloned element from document.body after rendering', async () => {
    const el = makeHtmlElement();
    document.body.appendChild(el);
    const childCountBefore = document.body.children.length;

    await htmlToPngBlob(el);

    // Nach dem Rendern darf kein zusätzlicher Klon mehr im body hängen
    expect(document.body.children.length).toBe(childCountBefore);
    document.body.removeChild(el);
  });

  it('calls html2canvas with scale:1 and backgroundColor:null', async () => {
    const el = makeHtmlElement();
    document.body.appendChild(el);

    await htmlToPngBlob(el);

    expect(mockHtml2canvas).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ scale: 1, backgroundColor: null }),
    );
    document.body.removeChild(el);
  });

  it('places clone in a wrapper with position:absolute (not fixed) to avoid bottom-clipping', async () => {
    const appendedChildren: HTMLElement[] = [];
    const origAppend = document.body.appendChild.bind(document.body);
    jest.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLElement) appendedChildren.push(node);
      return origAppend(node);
    });

    const el = makeHtmlElement();
    document.body.appendChild(el);
    await htmlToPngBlob(el);

    // Der Wrapper (nicht das geklonte Element selbst) wird an body gehängt
    const wrapper = appendedChildren.find(
      n => n !== el && n.style.position === 'absolute',
    );
    expect(wrapper).toBeDefined();
    expect(wrapper!.style.position).toBe('absolute');
    expect(wrapper!.style.top).toBe('0px');
    // Kein position:fixed (das würde html2canvas BoundingRect-Berechnungen fehlleiten)
    expect(wrapper!.style.position).not.toBe('fixed');

    document.body.removeChild(el);
  });

  it('does not clip bottom: html2canvas width/height match the original element dimensions', async () => {
    const el = makeHtmlElement();
    // offsetWidth/Height sind in jsdom 0, daher style-Werte direkt setzen
    Object.defineProperty(el, 'offsetWidth',  { get: () => 1080, configurable: true });
    Object.defineProperty(el, 'offsetHeight', { get: () => 1920, configurable: true });
    document.body.appendChild(el);

    await htmlToPngBlob(el);

    expect(mockHtml2canvas).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ width: 1080, height: 1920 }),
    );
    document.body.removeChild(el);
  });

  it('also removes wrapper on error (finally cleanup)', async () => {
    mockHtml2canvas.mockRejectedValue(new Error('canvas error'));

    const el = makeHtmlElement();
    document.body.appendChild(el);
    const childCountBefore = document.body.children.length;

    await expect(htmlToPngBlob(el)).rejects.toThrow('canvas error');

    expect(document.body.children.length).toBe(childCountBefore);
    document.body.removeChild(el);
  });
});
