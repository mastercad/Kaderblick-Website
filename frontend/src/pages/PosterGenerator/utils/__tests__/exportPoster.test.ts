import { exportPosterAsPng, posterToBlob } from '../exportPoster';

// ─── Mock html2canvas ─────────────────────────────────────────────────────────

const mockDataUrl = 'data:image/png;base64,ABC123';
const mockBlob = new Blob(['fake'], { type: 'image/png' });

const mockCanvas = {
  toDataURL: jest.fn(() => mockDataUrl),
  toBlob: jest.fn((cb: (b: Blob | null) => void) => cb(mockBlob)),
};

jest.mock('html2canvas', () => jest.fn(() => Promise.resolve(mockCanvas)));
import html2canvas from 'html2canvas';
const mockHtml2canvas = html2canvas as jest.Mock;

// ─── Mock DOM link click ──────────────────────────────────────────────────────

let createdLink: { download: string; href: string; click: jest.Mock } | null = null;

beforeEach(() => {
  jest.clearAllMocks();
  mockHtml2canvas.mockResolvedValue(mockCanvas);

  createdLink = { download: '', href: '', click: jest.fn() };
  jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'a') return createdLink as unknown as HTMLElement;
    return document.createElement(tag);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── exportPosterAsPng ────────────────────────────────────────────────────────

describe('exportPosterAsPng', () => {
  const el = document.createElement('div');

  it('calls html2canvas with scale=2 by default', async () => {
    await exportPosterAsPng(el);
    expect(mockHtml2canvas).toHaveBeenCalledWith(el, expect.objectContaining({ scale: 2 }));
  });

  it('uses custom scale when provided', async () => {
    await exportPosterAsPng(el, { scale: 3 });
    expect(mockHtml2canvas).toHaveBeenCalledWith(el, expect.objectContaining({ scale: 3 }));
  });

  it('sets default filename "poster.png" on the link', async () => {
    await exportPosterAsPng(el);
    expect(createdLink!.download).toBe('poster.png');
  });

  it('uses provided filename', async () => {
    await exportPosterAsPng(el, { filename: 'spiel-ergebnis.png' });
    expect(createdLink!.download).toBe('spiel-ergebnis.png');
  });

  it('sets link href to data URL and clicks it', async () => {
    await exportPosterAsPng(el);
    expect(createdLink!.href).toBe(mockDataUrl);
    expect(createdLink!.click).toHaveBeenCalledTimes(1);
  });
});

// ─── posterToBlob ─────────────────────────────────────────────────────────────

describe('posterToBlob', () => {
  const el = document.createElement('div');

  it('returns a Blob', async () => {
    const result = await posterToBlob(el);
    expect(result).toBeInstanceOf(Blob);
  });

  it('rejects when canvas.toBlob returns null', async () => {
    mockCanvas.toBlob.mockImplementationOnce((cb: (b: Blob | null) => void) => cb(null));
    await expect(posterToBlob(el)).rejects.toThrow('Canvas toBlob produced null');
  });

  it('calls html2canvas with provided scale', async () => {
    await posterToBlob(el, 4);
    expect(mockHtml2canvas).toHaveBeenCalledWith(el, expect.objectContaining({ scale: 4 }));
  });
});
