import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { ExportActions } from '../ExportActions';

// ─── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../utils/exportPoster', () => ({
  posterToBlob: jest.fn(),
  createXOptimizedBlob: jest.fn(),
}));

jest.mock('../../../../services/posterTemplateService', () => ({
  uploadPosterShare: jest.fn(),
}));

import { posterToBlob, createXOptimizedBlob } from '../../utils/exportPoster';
import { uploadPosterShare } from '../../../../services/posterTemplateService';

const mockBlob       = posterToBlob        as jest.Mock;
const mockCreateXBlob = createXOptimizedBlob as jest.Mock;
const mockUpload     = uploadPosterShare    as jest.Mock;
// Direktbild-URL wie sie vom Server zurückkommt
const UPLOAD_URL     = 'https://example.com/uploads/poster-share/share_test.png';
// OG-Landing-Page-URL (kein .png, wird im Frontend berechnet)
const SHARE_PAGE_URL = 'https://example.com/poster-share/share_test';
const fakeBlob = new Blob(['x'], { type: 'image/png' });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const theme     = createTheme();
const el        = document.createElement('div');
const posterRef = { current: el } as React.RefObject<HTMLDivElement | null>;

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

// ─── Global Setup ─────────────────────────────────────────────────────────────

// JSDOM does not implement ClipboardItem — polyfill it so clipboard.write() is reachable in tests.
if (typeof (globalThis as Record<string, unknown>)['ClipboardItem'] === 'undefined') {
  (globalThis as Record<string, unknown>)['ClipboardItem'] = class ClipboardItem {
    readonly types: string[];
    constructor(private data: Record<string, Blob | PromiseLike<Blob>>) {
      this.types = Object.keys(data);
    }
    async getType(type: string): Promise<Blob> {
      return this.data[type] as Blob;
    }
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockBlob.mockResolvedValue(fakeBlob);
  mockCreateXBlob.mockResolvedValue(fakeBlob);
  mockUpload.mockResolvedValue(UPLOAD_URL);

  Object.defineProperty(navigator, 'share',    { value: undefined, configurable: true });
  Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  Object.defineProperty(navigator, 'clipboard', {
    value: { write: jest.fn().mockResolvedValue(undefined), writeText: jest.fn().mockResolvedValue(undefined) },
    configurable: true,
  });

  URL.createObjectURL = jest.fn(() => 'blob:mock');
  URL.revokeObjectURL = jest.fn();
});

// ─── Render ───────────────────────────────────────────────────────────────────

describe('render', () => {
  it('renders primary share button', () => {
    wrap(<ExportActions posterRef={posterRef} />);
    expect(screen.getByTestId('export-share-btn')).toBeInTheDocument();
  });

  it.each(['whatsapp', 'instagram', 'facebook', 'twitter'])('renders %s button', (id) => {
    wrap(<ExportActions posterRef={posterRef} />);
    expect(screen.getByTestId(`platform-btn-${id}`)).toBeInTheDocument();
  });

  it('renders copy and download buttons', () => {
    wrap(<ExportActions posterRef={posterRef} />);
    expect(screen.getByTestId('export-copy-btn')).toBeInTheDocument();
    expect(screen.getByTestId('export-download-btn')).toBeInTheDocument();
  });
});

// ─── Download ────────────────────────────────────────────────────────────────

describe('handleDownload', () => {
  it('renders blob and triggers download without uploading', async () => {
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-download-btn'));
    await waitFor(() => expect(mockBlob).toHaveBeenCalledWith(el));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});

// ─── Copy ─────────────────────────────────────────────────────────────────────

describe('handleCopy', () => {
  it('renders blob and writes to clipboard without uploading', async () => {
    const writeSpy = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { write: writeSpy, writeText: jest.fn() },
      configurable: true,
    });
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-copy-btn'));
    await waitFor(() => expect(writeSpy).toHaveBeenCalled());
  });

  it('shows success notice after copy', async () => {
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-copy-btn'));
    await waitFor(() => expect(screen.getByTestId('export-notice')).toBeInTheDocument());
  });

  it('shows error (no download) when clipboard.write fails', async () => {
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    Object.defineProperty(navigator, 'clipboard', {
      value: { write: jest.fn().mockRejectedValue(new Error('not allowed')), writeText: jest.fn() },
      configurable: true,
    });

    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-copy-btn'));

    await waitFor(() => expect(screen.getByTestId('export-error')).toBeInTheDocument());
    expect(clickSpy).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});

// ─── Share: file sharing supported ───────────────────────────────────────────

function mockFileShare(overrides?: Partial<{ share: jest.Mock; canShare: jest.Mock }>) {
  const shareSpy   = overrides?.share    ?? jest.fn().mockResolvedValue(undefined);
  const canShareSpy = overrides?.canShare ?? jest.fn().mockReturnValue(true);
  Object.defineProperty(navigator, 'share',    { value: shareSpy,    configurable: true });
  Object.defineProperty(navigator, 'canShare', { value: canShareSpy, configurable: true });
  return { shareSpy, canShareSpy };
}

describe('handleMainShare – file sharing supported', () => {
  it('shares a File via navigator.share (not a URL)', async () => {
    const { shareSpy } = mockFileShare();
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-share-btn'));

    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    const arg = shareSpy.mock.calls[0][0] as ShareData;
    expect(arg.files?.[0]).toBeInstanceOf(File);
    expect(arg.url).toBeUndefined();
  });

  it('passes pre-composed text to navigator.share', async () => {
    const { shareSpy } = mockFileShare();
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-share-btn'));

    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    const arg = shareSpy.mock.calls[0][0] as ShareData;
    expect(typeof arg.text).toBe('string');
    expect(arg.text!.length).toBeGreaterThan(0);
  });

  it('does not show error when AbortError thrown', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    mockFileShare({ share: jest.fn().mockRejectedValue(abort) });

    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-share-btn'));
    await waitFor(() => expect(mockBlob).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByTestId('export-error')).not.toBeInTheDocument();
  });

  it('shows error when share throws non-abort error', async () => {
    mockFileShare({ share: jest.fn().mockRejectedValue(new Error('fail')) });

    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-share-btn'));
    await waitFor(() => expect(screen.getByTestId('export-error')).toBeInTheDocument());
  });
});

describe('handleMainShare – fallback: no native file-share support', () => {
  it('shows error when canShare(files)=false (e.g. Linux Chrome)', async () => {
    Object.defineProperty(navigator, 'share',    { value: jest.fn().mockResolvedValue(undefined), configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: jest.fn().mockReturnValue(false),        configurable: true });

    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-share-btn'));

    await waitFor(() => expect(screen.getByTestId('export-error')).toBeInTheDocument());
    expect(mockUpload).not.toHaveBeenCalled();
    expect((navigator.share as jest.Mock).mock.calls).toHaveLength(0);
  });

  it('shows error when navigator.share is unavailable', async () => {
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-share-btn'));

    await waitFor(() => expect(screen.getByTestId('export-error')).toBeInTheDocument());
    expect(mockUpload).not.toHaveBeenCalled();
  });
});

// ─── Share: platform buttons ──────────────────────────────────────────────────

describe('handlePlatformShare – file sharing supported', () => {
  it.each(['whatsapp', 'instagram', 'facebook', 'twitter'])(
    '%s: shares File via navigator.share with pre-composed text',
    async (platformId) => {
      const { shareSpy } = mockFileShare();
      wrap(<ExportActions posterRef={posterRef} />);
      fireEvent.click(screen.getByTestId(`platform-btn-${platformId}`));

      await waitFor(() => expect(shareSpy).toHaveBeenCalled());
      const arg = shareSpy.mock.calls[0][0] as ShareData;
      expect(arg.files?.[0]).toBeInstanceOf(File);
      expect(typeof arg.text).toBe('string');
      expect(arg.url).toBeUndefined();
    },
  );
});

describe('handlePlatformShare – fallback: native file share not available', () => {
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    Object.defineProperty(navigator, 'share',    { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });

  afterEach(() => openSpy.mockRestore());

  it('WhatsApp: lädt Bild hoch und öffnet wa.me mit OG-Seiten-URL', async () => {
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('platform-btn-whatsapp'));
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());

    const expected = `https://wa.me/?text=${encodeURIComponent(SHARE_PAGE_URL)}`;
    expect(openSpy).toHaveBeenCalledWith(expected, '_blank', 'noopener,noreferrer');
  });

  it('Facebook: lädt Bild hoch und öffnet Facebook-Sharer-URL', async () => {
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('platform-btn-facebook'));
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());

    const expected = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_PAGE_URL)}`;
    expect(openSpy).toHaveBeenCalledWith(expected, '_blank', 'noopener,noreferrer');
  });

  it('Twitter: zeigt X-Preview-Dialog (kein sofortiger Upload)', async () => {
    wrap(<ExportActions posterRef={posterRef} format="1:1" />);
    fireEvent.click(screen.getByTestId('platform-btn-twitter'));

    await waitFor(() => expect(screen.getByTestId('x-preview-dialog')).toBeInTheDocument());
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('Twitter: Upload + Tweet-Intent-URL nach Bestätigung im Dialog', async () => {
    wrap(<ExportActions posterRef={posterRef} format="1:1" />);
    fireEvent.click(screen.getByTestId('platform-btn-twitter'));

    await waitFor(() => expect(screen.getByTestId('x-preview-confirm')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('x-preview-confirm'));

    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    const expected = `https://twitter.com/intent/tweet?url=${encodeURIComponent(SHARE_PAGE_URL)}&text=${encodeURIComponent('Schaut mal unser Poster an!')}`;
    expect(openSpy).toHaveBeenCalledWith(expected, '_blank', 'noopener,noreferrer');
  });

  it('Twitter: kein Upload wenn Dialog abgebrochen', async () => {
    wrap(<ExportActions posterRef={posterRef} format="1:1" />);
    fireEvent.click(screen.getByTestId('platform-btn-twitter'));

    await waitFor(() => expect(screen.getByTestId('x-preview-dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    await act(async () => {});
    expect(mockUpload).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('Twitter mit format=16:9: lädt sofort hoch ohne Dialog', async () => {
    wrap(<ExportActions posterRef={posterRef} format="16:9" />);
    fireEvent.click(screen.getByTestId('platform-btn-twitter'));
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());

    const expected = `https://twitter.com/intent/tweet?url=${encodeURIComponent(SHARE_PAGE_URL)}&text=${encodeURIComponent('Schaut mal unser Poster an!')}`;
    expect(openSpy).toHaveBeenCalledWith(expected, '_blank', 'noopener,noreferrer');
    expect(screen.queryByTestId('x-preview-dialog')).not.toBeInTheDocument();
  });

  it('Instagram: lädt Bild hoch und öffnet instagram.com', async () => {
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('platform-btn-instagram'));
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());

    expect(openSpy).toHaveBeenCalledWith('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
  });
});

describe('handlePlatformShare – fallback: navigator.share throws (file not supported)', () => {
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    const shareErr = Object.assign(new Error('file share not supported'), { name: 'NotSupportedError' });
    Object.defineProperty(navigator, 'share',    { value: jest.fn().mockRejectedValue(shareErr), configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: jest.fn().mockReturnValue(false),       configurable: true });
  });

  afterEach(() => openSpy.mockRestore());

  it('WhatsApp: fällt auf Upload-Fallback zurück wenn navigator.share wirft', async () => {
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('platform-btn-whatsapp'));
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());

    const expected = `https://wa.me/?text=${encodeURIComponent(SHARE_PAGE_URL)}`;
    expect(openSpy).toHaveBeenCalledWith(expected, '_blank', 'noopener,noreferrer');
  });

  it('Twitter: fällt auf X-Preview-Dialog zurück wenn navigator.share wirft', async () => {
    wrap(<ExportActions posterRef={posterRef} format="1:1" />);
    fireEvent.click(screen.getByTestId('platform-btn-twitter'));

    await waitFor(() => expect(screen.getByTestId('x-preview-dialog')).toBeInTheDocument());
    expect(mockUpload).not.toHaveBeenCalled();
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('error handling', () => {
  it('shows error snackbar when posterToBlob fails', async () => {
    mockBlob.mockRejectedValue(new Error('canvas error'));
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-download-btn'));
    await waitFor(() => expect(screen.getByTestId('export-error')).toBeInTheDocument());
  });

  it('shows error snackbar when share fails', async () => {
    mockFileShare({ share: jest.fn().mockRejectedValue(new Error('network error')) });
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-share-btn'));
    await waitFor(() => expect(screen.getByTestId('export-error')).toBeInTheDocument());
  });
});

// ─── Loading state ────────────────────────────────────────────────────────────

describe('loading state', () => {
  it('disables all action buttons while loading', async () => {
    let resolveBlob!: (b: Blob) => void;
    mockBlob.mockReturnValue(new Promise<Blob>(r => { resolveBlob = r; }));

    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-download-btn'));

    expect(screen.getByTestId('export-download-btn')).toBeDisabled();
    expect(screen.getByTestId('export-share-btn')).toBeDisabled();

    resolveBlob(fakeBlob);
    await waitFor(() => expect(screen.getByTestId('export-download-btn')).not.toBeDisabled());
  });

  it('shows "Poster wird erstellt…" on primary button while rendering', async () => {
    let resolveBlob!: (b: Blob) => void;
    mockBlob.mockReturnValue(new Promise<Blob>(r => { resolveBlob = r; }));

    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-download-btn'));

    expect(screen.getByTestId('export-share-btn')).toHaveTextContent('Poster wird erstellt');

    resolveBlob(fakeBlob);
    await waitFor(() =>
      expect(screen.getByTestId('export-share-btn')).toHaveTextContent('Auf Sozialen Medien teilen'),
    );
  });

  it('zeigt "Poster wird hochgeladen…" während Upload (Plattform-Button, kein nativer Share)', async () => {
    Object.defineProperty(navigator, 'share',    { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
    jest.spyOn(window, 'open').mockImplementation(() => null);

    let resolveUpload!: (url: string) => void;
    mockUpload.mockReturnValue(new Promise<string>(r => { resolveUpload = r; }));

    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('platform-btn-whatsapp'));

    await waitFor(() =>
      expect(screen.getByTestId('export-share-btn')).toHaveTextContent('Poster wird hochgeladen'),
    );

    resolveUpload(UPLOAD_URL);
    await waitFor(() =>
      expect(screen.getByTestId('export-share-btn')).toHaveTextContent('Auf Sozialen Medien teilen'),
    );
  });
});

