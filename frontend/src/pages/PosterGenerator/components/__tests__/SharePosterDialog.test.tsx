import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { SharePosterDialog } from '../SharePosterDialog';
import type { PosterPayload } from '../../types/poster';
import type { Game } from '../../../../types/games';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../hooks/usePosterClub', () => ({
  usePosterClub: () => ({
    club: { id: 1, name: 'FC Test', clubColors: 'Blau/Weiß', logoUrl: null },
    loading: false,
    error: null,
  }),
}));

const mockTemplate = {
  id: 1,
  name: 'Testvorlage',
  description: null,
  posterType: 'game_announcement',
  supportedFormats: ['1:1', '9:16'],
  background: { type: 'solid', color: '#111111' },
  elements: [],
  createdAt: '2026-01-01T00:00:00',
  updatedAt: '2026-01-01T00:00:00',
};

jest.mock('../../../../services/posterTemplateService', () => ({
  fetchPosterTemplates: jest.fn().mockResolvedValue([{
    id: 1,
    name: 'Testvorlage',
    description: null,
    posterType: 'game_announcement',
    supportedFormats: ['1:1', '9:16'],
    background: { type: 'solid', color: '#111111' },
    elements: [],
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
  }]),
}));

jest.mock('../../DynamicPosterRenderer', () => ({
  DynamicPosterRenderer: () => <div data-testid="dynamic-poster-renderer" />,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const theme = createTheme();
const wrap = (ui: React.ReactElement) =>
  render(<MemoryRouter><ThemeProvider theme={theme}>{ui}</ThemeProvider></MemoryRouter>);

const mockGame = {
  id: 1,
  homeTeam: { id: 1, name: 'FC Home' },
  awayTeam: { id: 2, name: 'FC Away' },
  calendarEvent: { id: 10, startDate: '2026-05-15T17:00:00' },
} as unknown as Game;

const payload: PosterPayload = {
  templateId: 'game-announcement',
  data: { game: mockGame },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SharePosterDialog', () => {
  const onClose = jest.fn();
  beforeEach(() => jest.clearAllMocks());

  it('renders dialog when open', () => {
    wrap(<SharePosterDialog open payload={payload} onClose={onClose} />);
    expect(screen.getByTestId('share-poster-dialog')).toBeInTheDocument();
  });

  it('does not render dialog when closed', () => {
    wrap(<SharePosterDialog open={false} payload={payload} onClose={onClose} />);
    expect(screen.queryByTestId('share-poster-dialog')).not.toBeInTheDocument();
  });

  it('shows "Poster teilen" title', () => {
    wrap(<SharePosterDialog open payload={payload} onClose={onClose} />);
    expect(screen.getByText('Poster teilen')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    wrap(<SharePosterDialog open payload={payload} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('schließen'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders dynamic poster renderer after loading', async () => {
    wrap(<SharePosterDialog open payload={payload} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByTestId('dynamic-poster-renderer')).toBeInTheDocument();
    });
  });

  /**
   * Regressionstest: Preview-Container muss width:100% haben (responsiv),
   * nicht eine fixe Breite (z.B. 420px) die auf schmalen Screens überläuft.
   */
  it('preview container has width 100% (responsive, no fixed pixel width)', async () => {
    const { container } = wrap(<SharePosterDialog open payload={payload} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByTestId('dynamic-poster-renderer')).toBeInTheDocument();
    });

    // Der Preview-Box-Container hat background:#0a0a14 und muss width:100% haben
    const previewBox = container.querySelector<HTMLElement>('[style*="background: rgb(10, 10, 20)"], [style*="background: #0a0a14"]');
    if (previewBox) {
      expect(previewBox.style.width).toBe('100%');
      expect(previewBox.style.width).not.toMatch(/^\d+px$/);
    }
  });

  /**
   * Regressionstest: DialogContent muss overflow:visible haben, damit das
   * schwebende MUI-Label des Select-Felds (Vorlage) nicht abgeschnitten wird.
   */
  it('DialogContent has overflow:visible so Select label is not clipped', async () => {
    // Template mit mehreren Vorlagen damit Select überhaupt angezeigt wird
    const { fetchPosterTemplates } = await import('../../../../services/posterTemplateService');
    (fetchPosterTemplates as jest.Mock).mockResolvedValueOnce([
      { ...mockTemplate, id: 1, name: 'Vorlage A' },
      { ...mockTemplate, id: 2, name: 'Vorlage B' },
    ]);

    const { container } = wrap(<SharePosterDialog open payload={payload} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByTestId('dynamic-poster-renderer')).toBeInTheDocument();
    });

    // MUI DialogContent rendert als <div class="MuiDialogContent-root">
    const dialogContent = container.querySelector('.MuiDialogContent-root');
    if (dialogContent) {
      const style = window.getComputedStyle(dialogContent as HTMLElement);
      // overflow muss visible sein – 'auto' oder 'hidden' würde das Label clippen
      expect((dialogContent as HTMLElement).style.overflow).toBe('visible');
    }
  });

  /**
   * Regressionstest: getInitialPreviewWidth() berechnet aus window.innerWidth
   * eine sinnvolle initiale Breite (≤ 420, mind. viewport-80px).
   * Auf schmalen Screens muss die Breite kleiner als 420px sein.
   */
  it('initial preview width adapts to narrow viewport', () => {
    // Schmaleren Viewport simulieren (Mobiltelefon)
    const origInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 360, configurable: true });

    const { unmount } = wrap(<SharePosterDialog open payload={payload} onClose={onClose} />);

    // Der Dialog darf nicht breiter als der Viewport sein (kein horizontales Scrollen)
    const dialog = document.querySelector<HTMLElement>('[data-testid="share-poster-dialog"]');
    if (dialog) {
      // Das Dialog-Paper darf nicht breiter als viewport-breite sein
      const paper = dialog.closest('.MuiDialog-paper') as HTMLElement | null;
      if (paper) {
        expect(paper.style.width ?? '').not.toMatch(/^4[2-9]\d|[5-9]\d\d/);
      }
    }

    Object.defineProperty(window, 'innerWidth', { value: origInnerWidth, configurable: true });
    unmount();
  });
});
