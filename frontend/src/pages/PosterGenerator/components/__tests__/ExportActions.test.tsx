import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { ExportActions } from '../ExportActions';

// ─── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../utils/exportPoster', () => ({
  posterToBlob: jest.fn(),
}));

jest.mock('../../../../services/posterTemplateService', () => ({
  uploadPosterShare: jest.fn(),
}));

import { posterToBlob } from '../../utils/exportPoster';
import { uploadPosterShare } from '../../../../services/posterTemplateService';

const mockBlob   = posterToBlob   as jest.Mock;
const mockUpload = uploadPosterShare as jest.Mock;

const SHARE_URL = 'https://example.com/uploads/poster-share/share_test.png';
const fakeBlob  = new Blob(['x'], { type: 'image/png' });

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
  mockUpload.mockResolvedValue(SHARE_URL);

  // Desktop defaults
  Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true, writable: true });
  Object.defineProperty(navigator, 'share',          { value: undefined, configurable: true });
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
    expect(mockUpload).not.toHaveBeenCalled();
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
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('shows success notice after copy', async () => {
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-copy-btn'));
    await waitFor(() => expect(screen.getByTestId('export-notice')).toBeInTheDocument());
  });
});

// ─── Desktop: primary share ───────────────────────────────────────────────────

describe('handleMainShare – desktop, no native share', () => {
  it('uploads blob and copies share URL to clipboard', async () => {
    const writeTextSpy = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { write: jest.fn(), writeText: writeTextSpy },
      configurable: true,
    });

    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-share-btn'));

    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith(fakeBlob, 'poster.png'));
    expect(writeTextSpy).toHaveBeenCalledWith(SHARE_URL);
  });

  it('shows link-copied notice', async () => {
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-share-btn'));
    await waitFor(() => expect(screen.getByTestId('export-notice')).toBeInTheDocument());
  });
});

describe('handleMainShare – desktop, canNativeShare', () => {
  it('calls navigator.share with URL (not files)', async () => {
    const shareSpy = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareSpy, configurable: true });

    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-share-btn'));

    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    const arg = shareSpy.mock.calls[0][0] as ShareData;
    expect(arg.url).toBe(SHARE_URL);
    expect(arg.files).toBeUndefined();
  });

  it('does not show notice when AbortError thrown', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    Object.defineProperty(navigator, 'share', { value: jest.fn().mockRejectedValue(abort), configurable: true });

    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-share-btn'));
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByTestId('export-notice')).not.toBeInTheDocument();
  });
});

// ─── Desktop: platform share ──────────────────────────────────────────────────

describe('handlePlatformShare – desktop', () => {
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => openSpy.mockRestore());

  it('WhatsApp: opens wa.me with share URL as text param', async () => {
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('platform-btn-whatsapp'));
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());

    const expected = `https://wa.me/?text=${encodeURIComponent(SHARE_URL)}`;
    expect(openSpy).toHaveBeenCalledWith(expected, '_blank', 'noopener,noreferrer');
  });

  it('Facebook: opens Facebook sharer with share URL', async () => {
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('platform-btn-facebook'));
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());

    const expected = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_URL)}`;
    expect(openSpy).toHaveBeenCalledWith(expected, '_blank', 'noopener,noreferrer');
  });

  it('X/Twitter: opens tweet intent with share URL and text', async () => {
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('platform-btn-twitter'));
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());

    const expected = `https://twitter.com/intent/tweet?url=${encodeURIComponent(SHARE_URL)}&text=${encodeURIComponent('Schaut mal unser Poster an!')}`;
    expect(openSpy).toHaveBeenCalledWith(expected, '_blank', 'noopener,noreferrer');
  });

  it('Instagram: downloads blob and opens instagram.com (no URL share API)', async () => {
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('platform-btn-instagram'));
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());

    expect(clickSpy).toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
    clickSpy.mockRestore();
  });

  it('shows notice after platform share', async () => {
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('platform-btn-whatsapp'));
    await waitFor(() => expect(screen.getByTestId('export-notice')).toBeInTheDocument());
  });
});

// ─── Mobile: primary share ────────────────────────────────────────────────────

describe('handleMainShare – mobile', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 2, configurable: true, writable: true });
    Object.defineProperty(navigator, 'share', { value: jest.fn().mockResolvedValue(undefined), configurable: true });
  });

  it('shares a File via navigator.share (not a URL)', async () => {
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-share-btn'));
    await waitFor(() => expect(navigator.share).toHaveBeenCalled());

    const arg = (navigator.share as jest.Mock).mock.calls[0][0] as ShareData;
    expect(arg.files?.[0]).toBeInstanceOf(File);
    expect(arg.url).toBeUndefined();
  });

  it('does not upload to server', async () => {
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-share-btn'));
    await waitFor(() => expect(navigator.share).toHaveBeenCalled());
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('does not show notice when AbortError thrown', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    Object.defineProperty(navigator, 'share', { value: jest.fn().mockRejectedValue(abort), configurable: true });

    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-share-btn'));
    await waitFor(() => expect(mockBlob).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByTestId('export-notice')).not.toBeInTheDocument();
  });

  it('downloads as fallback when share throws non-abort error', async () => {
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const shareError = new Error('Share not supported');
    Object.defineProperty(navigator, 'share', { value: jest.fn().mockRejectedValue(shareError), configurable: true });

    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-share-btn'));
    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
    expect(mockUpload).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});

// ─── Mobile: platform share ───────────────────────────────────────────────────

describe('handlePlatformShare – mobile', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 2, configurable: true, writable: true });
    Object.defineProperty(navigator, 'share', { value: jest.fn().mockResolvedValue(undefined), configurable: true });
  });

  it.each(['whatsapp', 'facebook', 'twitter', 'instagram'])(
    '%s: shares File via navigator.share without uploading',
    async (platform) => {
      wrap(<ExportActions posterRef={posterRef} />);
      fireEvent.click(screen.getByTestId(`platform-btn-${platform}`));
      await waitFor(() => expect(navigator.share).toHaveBeenCalled());

      const arg = (navigator.share as jest.Mock).mock.calls[0][0] as ShareData;
      expect(arg.files?.[0]).toBeInstanceOf(File);
      expect(mockUpload).not.toHaveBeenCalled();
    },
  );
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('error handling', () => {
  it('shows error snackbar when posterToBlob fails', async () => {
    mockBlob.mockRejectedValue(new Error('canvas error'));
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-download-btn'));
    await waitFor(() => expect(screen.getByTestId('export-error')).toBeInTheDocument());
  });

  it('shows error snackbar when uploadPosterShare fails', async () => {
    mockUpload.mockRejectedValue(new Error('network error'));
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

  it('shows "Poster wird hochgeladen…" on primary button during upload phase', async () => {
    let resolveUpload!: (url: string) => void;
    mockUpload.mockReturnValue(new Promise<string>(r => { resolveUpload = r; }));

    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-share-btn'));

    // renderBlob resolves immediately (mockBlob.mockResolvedValue), upload is pending
    await waitFor(() =>
      expect(screen.getByTestId('export-share-btn')).toHaveTextContent('Poster wird hochgeladen'),
    );

    resolveUpload(SHARE_URL);
    await waitFor(() =>
      expect(screen.getByTestId('export-share-btn')).toHaveTextContent('Auf Sozialen Medien teilen'),
    );
  });
});

