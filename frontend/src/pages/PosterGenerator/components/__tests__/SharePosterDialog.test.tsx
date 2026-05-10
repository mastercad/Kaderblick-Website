import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
});
