import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { SharePosterButton } from '../SharePosterButton';
import type { PosterPayload } from '../../types/poster';
import type { Game } from '../../../../types/games';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../SharePosterDialog', () => ({
  SharePosterDialog: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="share-dialog"><button onClick={onClose}>Schließen</button></div> : null,
}));

jest.mock('../../hooks/useHasTemplates', () => ({
  useHasTemplates: () => ({ hasTemplates: true, loading: false }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const theme = createTheme();
const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const mockGame = { id: 1, homeTeam: { id: 1, name: 'FC Home' }, awayTeam: { id: 2, name: 'FC Away' } } as unknown as Game;

const payload: PosterPayload = {
  templateId: 'game-announcement',
  data: { game: mockGame },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SharePosterButton', () => {
  it('renders the share icon button', () => {
    wrap(<SharePosterButton payload={payload} />);
    expect(screen.getByTestId('share-poster-btn')).toBeInTheDocument();
  });

  it('does not show dialog initially', () => {
    wrap(<SharePosterButton payload={payload} />);
    expect(screen.queryByTestId('share-dialog')).not.toBeInTheDocument();
  });

  it('opens dialog when button is clicked', () => {
    wrap(<SharePosterButton payload={payload} />);
    fireEvent.click(screen.getByTestId('share-poster-btn'));
    expect(screen.getByTestId('share-dialog')).toBeInTheDocument();
  });

  it('closes dialog when onClose is called', () => {
    wrap(<SharePosterButton payload={payload} />);
    fireEvent.click(screen.getByTestId('share-poster-btn'));
    expect(screen.getByTestId('share-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Schließen'));
    expect(screen.queryByTestId('share-dialog')).not.toBeInTheDocument();
  });

  it('uses custom label as aria-label', () => {
    wrap(<SharePosterButton payload={payload} label="Ergebnis teilen" />);
    expect(screen.getByLabelText('Ergebnis teilen')).toBeInTheDocument();
  });
});
