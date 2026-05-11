import { renderHook, waitFor } from '@testing-library/react';
import { usePosterGames } from '../usePosterGames';
import * as gamesService from '../../../../services/games';
import type { Game, GameWithScore } from '../../../../types/games';

jest.mock('../../../../services/games');
const mockFetch = gamesService.fetchGamesOverview as jest.Mock;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockGame: Game = {
  id: 1,
  kickoffTime: '2025-10-01T15:00:00Z',
  homeTeam: { id: 10, name: 'FC Home', shortName: 'FCH', logo: null },
  awayTeam: { id: 11, name: 'FC Away', shortName: 'FCA', logo: null },
  location: null,
  season: 2025,
  matchday: 1,
} as unknown as Game;

const mockFinished: GameWithScore = {
  game: { ...mockGame, id: 2 },
  homeScore: 2,
  awayScore: 1,
};

const makeOverview = (upcoming = [mockGame], finished = [mockFinished]) => ({
  running_games:    [],
  upcoming_games:   upcoming,
  finished_games:   finished,
  tournaments:      [],
  userTeamIds:      [10],
  availableTeams:   [],
  availableSeasons: [2025],
  selectedSeason:   2025,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('usePosterGames', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns loading=true initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePosterGames());
    expect(result.current.loading).toBe(true);
  });

  it('populates upcomingGames and finishedGames on success', async () => {
    mockFetch.mockResolvedValue(makeOverview());
    const { result } = renderHook(() => usePosterGames());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.upcomingGames).toHaveLength(1);
    expect(result.current.finishedGames).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('handles empty game arrays gracefully', async () => {
    mockFetch.mockResolvedValue(makeOverview([], []));
    const { result } = renderHook(() => usePosterGames());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.upcomingGames).toEqual([]);
    expect(result.current.finishedGames).toEqual([]);
  });

  it('sets error on API failure', async () => {
    mockFetch.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => usePosterGames());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.upcomingGames).toEqual([]);
  });

  it('calls fetchGamesOverview with no arguments', async () => {
    mockFetch.mockResolvedValue(makeOverview());
    renderHook(() => usePosterGames());
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledWith();
  });
});
