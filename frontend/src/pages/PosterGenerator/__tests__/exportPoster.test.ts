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
 * - createXOptimizedBlob: erzeugt 1920×1080 Canvas, zeichnet Bild letterboxed, gibt Blob zurück
 */

jest.mock('../utils/svgExport', () => ({
  htmlToPngBlob: jest.fn(),
}));

import { posterToBlob, exportPosterAsPng, createXOptimizedBlob } from '../utils/exportPoster';
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

// ─── createXOptimizedBlob ─────────────────────────────────────────────────────

describe('createXOptimizedBlob', () => {
  const X_WIDTH  = 1920;
  const X_HEIGHT = 1080;

  const fakeOutputBlob = new Blob(['output-png'], { type: 'image/png' });

  let mockCtx: { fillStyle: string; fillRect: jest.Mock; drawImage: jest.Mock };
  let mockToBlob: jest.Mock;
  // The canvas el created by createElement('canvas') — mutations from the SUT are visible here.
  let capturedCanvas: { width: number; height: number };

  /**
   * Installs a FakeImage constructor that triggers onload/onerror SYNCHRONOUSLY
   * when `src` is set. Synchronous triggering is required because the global
   * beforeEach activates jest.useFakeTimers(), which would swallow setTimeout callbacks.
   *
   * This is safe: in createXOptimizedBlob, img.onload is assigned BEFORE img.src,
   * so the handler is in place when the setter fires.
   */
  function setupImageMock(naturalWidth: number, naturalHeight: number, fail = false) {
    class FakeImage {
      naturalWidth  = naturalWidth;
      naturalHeight = naturalHeight;
      onload:  (() => void)               | null = null;
      onerror: ((e: ErrorEvent) => void)  | null = null;
      private _src = '';
      get src() { return this._src; }
      set src(v: string) {
        this._src = v;
        if (fail) {
          this.onerror?.(new ErrorEvent('error'));
        } else {
          this.onload?.();
        }
      }
    }
    jest.spyOn(global, 'Image').mockImplementation(
      () => new FakeImage() as unknown as HTMLImageElement,
    );
  }

  beforeEach(() => {
    mockCtx = { fillStyle: '', fillRect: jest.fn(), drawImage: jest.fn() };
    mockToBlob = jest.fn((cb: BlobCallback) => cb(fakeOutputBlob));

    const origCreate = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag: string, ...rest) => {
      if (tag === 'canvas') {
        const el = {
          width: 0,
          height: 0,
          getContext: jest.fn().mockReturnValue(mockCtx),
          toBlob: mockToBlob,
        };
        capturedCanvas = el;
        return el as unknown as HTMLCanvasElement;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return origCreate(tag, ...rest as any[]);
    });

    global.URL.createObjectURL = jest.fn(() => 'blob:x-preview-mock');
    global.URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('setzt Canvas-Dimensionen auf 1920×1080', async () => {
    setupImageMock(1080, 1080);
    await createXOptimizedBlob(new Blob(['x'], { type: 'image/png' }));
    expect(capturedCanvas.width).toBe(X_WIDTH);
    expect(capturedCanvas.height).toBe(X_HEIGHT);
  });

  it('füllt Hintergrund vor dem Zeichnen des Bildes', async () => {
    setupImageMock(1080, 1080);
    await createXOptimizedBlob(new Blob(['x'], { type: 'image/png' }));
    expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, X_WIDTH, X_HEIGHT);
    // fillRect muss VOR drawImage aufgerufen worden sein
    const fillOrder = mockCtx.fillRect.mock.invocationCallOrder[0];
    const drawOrder = mockCtx.drawImage.mock.invocationCallOrder[0];
    expect(fillOrder).toBeLessThan(drawOrder);
  });

  it('1:1 (1080×1080): Bild zentriert, horizontale Letterbox-Balken', async () => {
    setupImageMock(1080, 1080);
    await createXOptimizedBlob(new Blob(['x'], { type: 'image/png' }));
    // scale = min(1920/1080, 1080/1080) = 1.0 → w=1080, h=1080, x=420, y=0
    const [, x, y, w, h] = mockCtx.drawImage.mock.calls[0] as number[];
    expect(x).toBeCloseTo(420);
    expect(y).toBeCloseTo(0);
    expect(w).toBeCloseTo(1080);
    expect(h).toBeCloseTo(1080);
  });

  it('16:9 (1920×1080): kein Letterbox, Bild füllt Canvas vollständig', async () => {
    setupImageMock(1920, 1080);
    await createXOptimizedBlob(new Blob(['x'], { type: 'image/png' }));
    // scale = 1.0 → w=1920, h=1080, x=0, y=0
    const [, x, y, w, h] = mockCtx.drawImage.mock.calls[0] as number[];
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
    expect(w).toBeCloseTo(1920);
    expect(h).toBeCloseTo(1080);
  });

  it('9:16 (1080×1920): Bild zentriert, breite horizontale Balken', async () => {
    setupImageMock(1080, 1920);
    await createXOptimizedBlob(new Blob(['x'], { type: 'image/png' }));
    // scale = min(1920/1080, 1080/1920) = 0.5625 → w=607.5, h=1080, x=656.25, y=0
    const [, x, y, w, h] = mockCtx.drawImage.mock.calls[0] as number[];
    expect(x).toBeCloseTo(656.25);
    expect(y).toBeCloseTo(0);
    expect(w).toBeCloseTo(607.5);
    expect(h).toBeCloseTo(1080);
  });

  it('gibt den Blob von canvas.toBlob zurück', async () => {
    setupImageMock(1080, 1080);
    const result = await createXOptimizedBlob(new Blob(['x'], { type: 'image/png' }));
    expect(result).toBe(fakeOutputBlob);
  });

  it('gibt Eingabe-Blob an URL.createObjectURL weiter', async () => {
    setupImageMock(1080, 1080);
    const input = new Blob(['x'], { type: 'image/png' });
    await createXOptimizedBlob(input);
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(input);
  });

  it('ruft URL.revokeObjectURL nach dem Laden auf', async () => {
    setupImageMock(1080, 1080);
    await createXOptimizedBlob(new Blob(['x'], { type: 'image/png' }));
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:x-preview-mock');
  });

  it('lehnt ab wenn canvas.toBlob null zurückgibt', async () => {
    setupImageMock(1080, 1080);
    mockToBlob.mockImplementation((cb: BlobCallback) => cb(null));
    await expect(
      createXOptimizedBlob(new Blob(['x'], { type: 'image/png' })),
    ).rejects.toThrow('toBlob failed');
  });

  it('lehnt ab wenn das Bild nicht geladen werden kann', async () => {
    setupImageMock(0, 0, true); // fail = true → onerror wird getriggert
    await expect(
      createXOptimizedBlob(new Blob(['x'], { type: 'image/png' })),
    ).rejects.toBeInstanceOf(ErrorEvent);
  });
});
