import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicLiveTicker from '../PublicLiveTicker';
import { fetchPublicLiveTicker } from '../../services/publicLiveTicker';
import { ApiError } from '../../utils/api';

jest.mock('../../services/publicLiveTicker', () => ({
  fetchPublicLiveTicker: jest.fn(),
}));

const mockFetch = fetchPublicLiveTicker as jest.MockedFunction<typeof fetchPublicLiveTicker>;

const data = {
  game: {
    homeTeam: { name: 'FC Heim' },
    awayTeam: { name: 'SV Gast' },
    homeScore: 2,
    awayScore: 1,
    status: 'live' as const,
    startsAt: '2026-06-22T14:00:00+02:00',
    endsAt: '2026-06-22T16:00:00+02:00',
    isFinished: false,
  },
  events: [{
    id: 7,
    minute: 37,
    timestamp: '2026-06-22T14:37:00+02:00',
    type: { name: 'Tor', code: 'goal', color: '#287a45' },
    team: { side: 'home' as const, name: 'FC Heim' },
    description: 'Schöner Angriff über rechts',
  }],
  updatedAt: '2026-06-22T14:38:00+02:00',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/live/test-token']}>
      <Routes><Route path="/live/:token" element={<PublicLiveTicker />} /></Routes>
    </MemoryRouter>,
  );
}

describe('PublicLiveTicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('zeigt Spielstand und den neuesten Ticker-Eintrag ohne Personenfelder', async () => {
    mockFetch.mockResolvedValue(data);
    renderPage();

    expect((await screen.findAllByText('FC Heim')).length).toBeGreaterThan(0);
    expect(screen.getByText('2 : 1')).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByText("37'")).toBeInTheDocument();
    expect(screen.getByText('Schöner Angriff über rechts')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Kaderblick Logo' })).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith('test-token');
  });

  it('zeigt für einen deaktivierten Ticker einen gebrandeten Abschlusszustand', async () => {
    mockFetch.mockRejectedValue(new ApiError('Der Eintrag wurde nicht gefunden.', 404));
    renderPage();

    await waitFor(() => expect(screen.getByText('Die öffentliche Übertragung ist beendet')).toBeInTheDocument());
    expect(screen.getByText('Liveticker nicht aktiv')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Kaderblick Logo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /zur kaderblick-startseite/i })).toHaveAttribute('href', '/');
    expect(screen.queryByText('Der Eintrag wurde nicht gefunden.')).not.toBeInTheDocument();
  });

  it('unterscheidet einen Verbindungsfehler von einem deaktivierten Ticker', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    renderPage();

    await waitFor(() => expect(screen.getByText('Der Liveticker ist gerade nicht erreichbar')).toBeInTheDocument());
    expect(screen.getByText('Verbindung unterbrochen')).toBeInTheDocument();
  });
});
