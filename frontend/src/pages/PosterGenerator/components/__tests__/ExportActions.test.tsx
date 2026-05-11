import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { ExportActions } from '../ExportActions';

// ─── Mock export utilities ─────────────────────────────────────────────────────

jest.mock('../../utils/exportPoster', () => ({
  posterToBlob: jest.fn(),
}));

import { posterToBlob } from '../../utils/exportPoster';
const mockBlob = posterToBlob as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const theme     = createTheme();
const el        = document.createElement('div');
const posterRef = { current: el } as React.RefObject<HTMLDivElement | null>;

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const mockObjectUrl = 'blob:mock';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExportActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBlob.mockResolvedValue(new Blob(['x'], { type: 'image/png' }));
    Object.defineProperty(navigator, 'share',    { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
    URL.createObjectURL = jest.fn(() => mockObjectUrl);
    URL.revokeObjectURL = jest.fn();
  });

  // ── Always-present elements ──────────────────────────────────────────────────

  it('renders primary share button', () => {
    wrap(<ExportActions posterRef={posterRef} />);
    expect(screen.getByTestId('export-share-btn')).toBeInTheDocument();
  });

  it('primary share button label is "Auf Sozialen Medien teilen"', () => {
    wrap(<ExportActions posterRef={posterRef} />);
    expect(screen.getByText('Auf Sozialen Medien teilen')).toBeInTheDocument();
  });

  it('renders download button', () => {
    wrap(<ExportActions posterRef={posterRef} />);
    expect(screen.getByTestId('export-download-btn')).toBeInTheDocument();
  });

  it('renders copy button', () => {
    wrap(<ExportActions posterRef={posterRef} />);
    expect(screen.getByTestId('export-copy-btn')).toBeInTheDocument();
  });

  // ── Platform icon buttons ────────────────────────────────────────────────────

  it('renders WhatsApp platform button', () => {
    wrap(<ExportActions posterRef={posterRef} />);
    expect(screen.getByTestId('platform-btn-whatsapp')).toBeInTheDocument();
  });

  it('renders Instagram platform button', () => {
    wrap(<ExportActions posterRef={posterRef} />);
    expect(screen.getByTestId('platform-btn-instagram')).toBeInTheDocument();
  });

  it('renders Facebook platform button', () => {
    wrap(<ExportActions posterRef={posterRef} />);
    expect(screen.getByTestId('platform-btn-facebook')).toBeInTheDocument();
  });

  it('renders Twitter/X platform button', () => {
    wrap(<ExportActions posterRef={posterRef} />);
    expect(screen.getByTestId('platform-btn-twitter')).toBeInTheDocument();
  });

  // ── Download ─────────────────────────────────────────────────────────────────

  it('calls posterToBlob and triggers download on download click', async () => {
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-download-btn'));
    await waitFor(() => expect(mockBlob).toHaveBeenCalledWith(el));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  // ── Primary share: Web Share API available ───────────────────────────────────

  it('calls navigator.share with file when Web Share API is available', async () => {
    const mockShare    = jest.fn().mockResolvedValue(undefined);
    const mockCanShare = jest.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'share',    { value: mockShare,    configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: mockCanShare, configurable: true });
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-share-btn'));
    await waitFor(() => expect(mockShare).toHaveBeenCalled());
    const shareArg = mockShare.mock.calls[0][0];
    expect(shareArg.files).toBeDefined();
    expect(shareArg.files[0]).toBeInstanceOf(File);
  });

  it('does not show error notice when share is aborted', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    Object.defineProperty(navigator, 'share',    { value: jest.fn().mockRejectedValue(abort), configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: jest.fn().mockReturnValue(true),     configurable: true });
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-share-btn'));
    await waitFor(() => expect(mockBlob).toHaveBeenCalled());
    expect(screen.queryByTestId('export-notice')).not.toBeInTheDocument();
  });

  // ── Primary share: no Web Share API (desktop fallback) ───────────────────────

  it('triggers download and shows notice when no Web Share API', async () => {
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('export-share-btn'));
    await waitFor(() => expect(mockBlob).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('export-notice')).toBeInTheDocument());
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  // ── Platform share: desktop fallback ─────────────────────────────────────────

  it('downloads and opens platform when WhatsApp button clicked (no Web Share)', async () => {
    const clickSpy  = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const openSpy   = jest.spyOn(window, 'open').mockImplementation(() => null);
    wrap(<ExportActions posterRef={posterRef} />);
    fireEvent.click(screen.getByTestId('platform-btn-whatsapp'));
    await waitFor(() => expect(mockBlob).toHaveBeenCalled());
    await waitFor(() => expect(openSpy).toHaveBeenCalledWith('https://wa.me/?text=Schaut%20mal%20unser%20Poster%20an!', '_blank', 'noopener,noreferrer'));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
    openSpy.mockRestore();
  });
});
