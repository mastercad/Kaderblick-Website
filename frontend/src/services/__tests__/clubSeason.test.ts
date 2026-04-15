import { fetchClubSeasonOverview } from '../clubSeason';
import { ClubSeasonOverview } from '../../types/clubSeason';

const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

const mockOverview: ClubSeasonOverview = {
  club: { id: 1, name: 'FC Test', shortName: 'FCT', logoUrl: null },
  season: '2025/2026',
  seasonYear: 2025,
  availableSeasons: [2025, 2024, 2023, 2022, 2021],
  teams: [
    {
      id: 10,
      name: 'Erste Mannschaft',
      ageGroup: { id: 1, name: 'Senioren' },
      league: { id: 2, name: 'Kreisliga A' },
      stats: { played: 5, won: 3, drawn: 1, lost: 1, goalsFor: 9, goalsAgainst: 4, goalDifference: 5, points: 10 },
      form: ['W', 'W', 'D', 'L', 'W'],
      nextGame: null,
    },
  ],
  topScorers: [
    { playerId: 42, firstName: 'Max', lastName: 'Mustermann', goals: 7, teamId: 10, teamName: 'Erste Mannschaft' },
  ],
};

// ── fetchClubSeasonOverview ──────────────────────────────────────────────────

describe('fetchClubSeasonOverview', () => {
  it('calls /api/club/season-overview without params when none given', async () => {
    mockApiJson.mockResolvedValue(mockOverview);

    await fetchClubSeasonOverview();

    expect(mockApiJson).toHaveBeenCalledWith('/api/club/season-overview');
  });

  it('appends season param when provided', async () => {
    mockApiJson.mockResolvedValue(mockOverview);

    await fetchClubSeasonOverview(2024);

    expect(mockApiJson).toHaveBeenCalledWith('/api/club/season-overview?season=2024');
  });

  it('appends clubId param when provided', async () => {
    mockApiJson.mockResolvedValue(mockOverview);

    await fetchClubSeasonOverview(undefined, 5);

    expect(mockApiJson).toHaveBeenCalledWith('/api/club/season-overview?clubId=5');
  });

  it('appends both season and clubId params when provided', async () => {
    mockApiJson.mockResolvedValue(mockOverview);

    await fetchClubSeasonOverview(2023, 7);

    expect(mockApiJson).toHaveBeenCalledWith('/api/club/season-overview?season=2023&clubId=7');
  });

  it('returns the full ClubSeasonOverview object', async () => {
    mockApiJson.mockResolvedValue(mockOverview);

    const result = await fetchClubSeasonOverview(2025);

    expect(result).toEqual(mockOverview);
    expect(result.club?.name).toBe('FC Test');
    expect(result.teams).toHaveLength(1);
    expect(result.topScorers[0].goals).toBe(7);
  });

  it('handles a null club (user not linked to any club)', async () => {
    const emptyResponse: ClubSeasonOverview = {
      club: null,
      season: '2025/2026',
      seasonYear: 2025,
      availableSeasons: [2025, 2024],
      teams: [],
      topScorers: [],
    };
    mockApiJson.mockResolvedValue(emptyResponse);

    const result = await fetchClubSeasonOverview();

    expect(result.club).toBeNull();
    expect(result.teams).toEqual([]);
    expect(result.topScorers).toEqual([]);
  });

  it('propagates errors thrown by apiJson', async () => {
    mockApiJson.mockRejectedValue(new Error('Unauthorized'));

    await expect(fetchClubSeasonOverview()).rejects.toThrow('Unauthorized');
  });

  it('returns expected availableSeasons array', async () => {
    mockApiJson.mockResolvedValue(mockOverview);

    const result = await fetchClubSeasonOverview();

    expect(result.availableSeasons).toEqual([2025, 2024, 2023, 2022, 2021]);
  });

  it('returns form streak as array of W/D/L values', async () => {
    mockApiJson.mockResolvedValue(mockOverview);

    const result = await fetchClubSeasonOverview();
    const form = result.teams[0].form;

    expect(form).toEqual(['W', 'W', 'D', 'L', 'W']);
  });
});
