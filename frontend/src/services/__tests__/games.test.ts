import {
  fetchGameSquad,
  fetchGamesOverview,
  fetchGameSchedulePdf,
  fetchGameDetails,
  fetchGameEvents,
  fetchGameEventTypes,
  fetchPlayersForTeams,
  fetchSubstitutionReasons,
  fetchTournamentDetails,
  createGameEvent,
  updateGameEvent,
  deleteGameEvent,
  syncFussballDe,
  finishGame,
  updateGameTiming,
  saveGameMatchPlan,
  confirmGameMatchPlanSubstitution,
  type SquadPlayer,
  type GameSquadData,
} from '../games';

const mockApiJson = jest.fn();
const mockApiBlob = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
  apiBlob: (...args: any[]) => mockApiBlob(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

// ── fetchGameSquad ──────────────────────────────────────────────────────────

describe('fetchGameSquad', () => {
  it('calls the correct endpoint with the given gameId', async () => {
    mockApiJson.mockResolvedValue({ squad: [], allPlayers: [], hasParticipationData: false });

    await fetchGameSquad(42);

    expect(mockApiJson).toHaveBeenCalledWith('/api/games/42/squad');
  });

  it('returns the full response object including squad and hasParticipationData', async () => {
    const fixture: GameSquadData = {
      squad: [
        { id: 1, fullName: 'Max Mustermann', shirtNumber: 7, teamId: 10 },
        { id: 2, fullName: 'Erika Muster', shirtNumber: null, teamId: 10 },
      ],
      allPlayers: [
        { id: 1, fullName: 'Max Mustermann', shirtNumber: 7, teamId: 10 },
        { id: 2, fullName: 'Erika Muster', shirtNumber: null, teamId: 10 },
        { id: 3, fullName: 'Karl Kühn', shirtNumber: 11, teamId: 10 },
      ],
      hasParticipationData: true,
    };
    mockApiJson.mockResolvedValue(fixture);

    const result = await fetchGameSquad(5);

    expect(result).toEqual(fixture);
    expect(result.squad).toHaveLength(2);
    expect(result.hasParticipationData).toBe(true);
  });

  it('returns empty squad and hasParticipationData: false when no participations exist', async () => {
    const fixture: GameSquadData = { squad: [], allPlayers: [], hasParticipationData: false };
    mockApiJson.mockResolvedValue(fixture);

    const result = await fetchGameSquad(99);

    expect(result.squad).toEqual([]);
    expect(result.hasParticipationData).toBe(false);
  });

  it('returns empty squad and hasParticipationData: true when participations exist but nobody attending', async () => {
    const fixture: GameSquadData = { squad: [], allPlayers: [], hasParticipationData: true };
    mockApiJson.mockResolvedValue(fixture);

    const result = await fetchGameSquad(7);

    expect(result.squad).toEqual([]);
    expect(result.hasParticipationData).toBe(true);
  });

  it('propagates errors thrown by apiJson', async () => {
    mockApiJson.mockRejectedValue(new Error('Network error'));

    await expect(fetchGameSquad(1)).rejects.toThrow('Network error');
  });

  it('correctly types SquadPlayer fields', async () => {
    const player: SquadPlayer = {
      id: 3,
      fullName: 'Hans Müller',
      shirtNumber: 10,
      teamId: 2,
    };
    mockApiJson.mockResolvedValue({ squad: [player], allPlayers: [player], hasParticipationData: true });

    const result = await fetchGameSquad(3);
    const first = result.squad[0];

    expect(first.id).toBe(3);
    expect(first.fullName).toBe('Hans Müller');
    expect(first.shirtNumber).toBe(10);
    expect(first.teamId).toBe(2);
  });
});

// ── fetchGamesOverview ──────────────────────────────────────────────────────

describe('fetchGamesOverview', () => {
  const mockData = {
    running_games: [],
    upcoming_games: [],
    finished_games: [],
    tournaments: [],
    userTeamIds: [],
    availableTeams: [],
    availableSeasons: [2025],
    selectedSeason: 2025,
  };

  beforeEach(() => {
    mockApiJson.mockResolvedValue(mockData);
  });

  it('calls /api/games/overview with no query string when no args given', async () => {
    await fetchGamesOverview();
    expect(mockApiJson).toHaveBeenCalledWith('/api/games/overview');
  });

  it('appends teamId when a numeric teamId is given', async () => {
    await fetchGamesOverview(5);
    expect(mockApiJson).toHaveBeenCalledWith('/api/games/overview?teamId=5');
  });

  it('appends teamId=all when "all" is passed', async () => {
    await fetchGamesOverview('all');
    expect(mockApiJson).toHaveBeenCalledWith('/api/games/overview?teamId=all');
  });

  it('appends season when only season is given', async () => {
    await fetchGamesOverview(undefined, 2025);
    expect(mockApiJson).toHaveBeenCalledWith('/api/games/overview?season=2025');
  });

  it('appends both teamId and season when both are given', async () => {
    await fetchGamesOverview(5, 2025);
    expect(mockApiJson).toHaveBeenCalledWith('/api/games/overview?teamId=5&season=2025');
  });

  it('returns the full overview data object', async () => {
    const result = await fetchGamesOverview();
    expect(result).toEqual(mockData);
  });

  it('propagates errors from apiJson', async () => {
    mockApiJson.mockRejectedValue(new Error('Network error'));
    await expect(fetchGamesOverview()).rejects.toThrow('Network error');
  });
});

// ── fetchGameSchedulePdf ────────────────────────────────────────────────────

describe('fetchGameSchedulePdf', () => {
  it('calls apiBlob with the correct URL containing teamId and season', async () => {
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    mockApiBlob.mockResolvedValue(blob);

    await fetchGameSchedulePdf(10, 2025);

    expect(mockApiBlob).toHaveBeenCalledWith('/api/games/schedule/pdf?teamId=10&season=2025');
  });

  it('returns the Blob from apiBlob', async () => {
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    mockApiBlob.mockResolvedValue(blob);

    const result = await fetchGameSchedulePdf(3, 2024);

    expect(result).toBe(blob);
  });

  it('propagates errors from apiBlob', async () => {
    mockApiBlob.mockRejectedValue(new Error('PDF generation failed'));

    await expect(fetchGameSchedulePdf(1, 2025)).rejects.toThrow('PDF generation failed');
  });
});

// ── fetchGameDetails ────────────────────────────────────────────────────────

describe('fetchGameDetails', () => {
  it('calls the correct endpoint with the given gameId', async () => {
    mockApiJson.mockResolvedValue({ game: { id: 5 }, gameEvents: [], homeScore: null, awayScore: null });
    await fetchGameDetails(5);
    expect(mockApiJson).toHaveBeenCalledWith('/api/games/5/details');
  });

  it('returns the full game details response', async () => {
    const fixture = { game: { id: 7 }, gameEvents: [{ id: 1 }], homeScore: 2, awayScore: 1 };
    mockApiJson.mockResolvedValue(fixture);
    const result = await fetchGameDetails(7);
    expect(result).toEqual(fixture);
  });

  it('propagates errors from apiJson', async () => {
    mockApiJson.mockRejectedValue(new Error('Not found'));
    await expect(fetchGameDetails(99)).rejects.toThrow('Not found');
  });
});

// ── fetchGameEvents ─────────────────────────────────────────────────────────

describe('fetchGameEvents', () => {
  it('calls the correct endpoint', async () => {
    mockApiJson.mockResolvedValue([]);
    await fetchGameEvents(13);
    expect(mockApiJson).toHaveBeenCalledWith('/api/game/13/events');
  });

  it('returns an array of game events', async () => {
    const events = [{ id: 1, minute: '10', eventTypeId: 2 }];
    mockApiJson.mockResolvedValue(events);
    const result = await fetchGameEvents(3);
    expect(result).toEqual(events);
  });

  it('propagates errors from apiJson', async () => {
    mockApiJson.mockRejectedValue(new Error('Server error'));
    await expect(fetchGameEvents(1)).rejects.toThrow('Server error');
  });
});

// ── fetchGameEventTypes ─────────────────────────────────────────────────────

describe('fetchGameEventTypes', () => {
  it('calls /api/game-event-types', async () => {
    mockApiJson.mockResolvedValue([]);
    await fetchGameEventTypes();
    expect(mockApiJson).toHaveBeenCalledWith('/api/game-event-types');
  });

  it('returns event types data', async () => {
    const types = [{ id: 1, name: 'Goal' }];
    mockApiJson.mockResolvedValue(types);
    const result = await fetchGameEventTypes();
    expect(result).toEqual(types);
  });
});

// ── fetchPlayersForTeams ────────────────────────────────────────────────────

describe('fetchPlayersForTeams', () => {
  it('builds and calls the correct URL for a single team', async () => {
    mockApiJson.mockResolvedValue([]);
    await fetchPlayersForTeams([42]);
    expect(mockApiJson).toHaveBeenCalledWith('/api/players/active?teams[]=42');
  });

  it('builds the correct URL for multiple teams', async () => {
    mockApiJson.mockResolvedValue([]);
    await fetchPlayersForTeams([1, 2, 3]);
    expect(mockApiJson).toHaveBeenCalledWith('/api/players/active?teams[]=1&teams[]=2&teams[]=3');
  });

  it('returns an array of players', async () => {
    const players = [{ id: 1, name: 'Player A' }];
    mockApiJson.mockResolvedValue(players);
    const result = await fetchPlayersForTeams([10]);
    expect(result).toEqual(players);
  });

  it('propagates errors from apiJson', async () => {
    mockApiJson.mockRejectedValue(new Error('Not found'));
    await expect(fetchPlayersForTeams([5])).rejects.toThrow('Not found');
  });
});

// ── fetchSubstitutionReasons ────────────────────────────────────────────────

describe('fetchSubstitutionReasons', () => {
  it('calls /api/substitution-reasons', async () => {
    mockApiJson.mockResolvedValue([]);
    await fetchSubstitutionReasons();
    expect(mockApiJson).toHaveBeenCalledWith('/api/substitution-reasons');
  });

  it('returns substitution reasons', async () => {
    const reasons = [{ id: 1, label: 'Injury' }];
    mockApiJson.mockResolvedValue(reasons);
    const result = await fetchSubstitutionReasons();
    expect(result).toEqual(reasons);
  });
});

// ── fetchTournamentDetails ──────────────────────────────────────────────────

describe('fetchTournamentDetails', () => {
  it('calls the correct endpoint with tournamentId', async () => {
    mockApiJson.mockResolvedValue({ id: 10, name: 'Cup 2025' });
    await fetchTournamentDetails(10);
    expect(mockApiJson).toHaveBeenCalledWith('/api/tournaments/10');
  });

  it('returns tournament details', async () => {
    const data = { id: 5, name: 'League A' };
    mockApiJson.mockResolvedValue(data);
    const result = await fetchTournamentDetails(5);
    expect(result).toEqual(data);
  });

  it('propagates errors from apiJson', async () => {
    mockApiJson.mockRejectedValue(new Error('Not found'));
    await expect(fetchTournamentDetails(999)).rejects.toThrow('Not found');
  });
});

// ── createGameEvent ─────────────────────────────────────────────────────────

describe('createGameEvent', () => {
  const eventData = { eventType: 1, player: 7, minute: '25', description: 'Goal' };

  it('calls POST /api/game/{gameId}/event with the event data', async () => {
    mockApiJson.mockResolvedValue({ success: true });
    await createGameEvent(5, eventData);
    expect(mockApiJson).toHaveBeenCalledWith('/api/game/5/event', {
      method: 'POST',
      body: eventData,
    });
  });

  it('returns success response', async () => {
    mockApiJson.mockResolvedValue({ success: true });
    const result = await createGameEvent(5, eventData);
    expect(result).toEqual({ success: true });
  });

  it('propagates errors from apiJson', async () => {
    mockApiJson.mockRejectedValue(new Error('Forbidden'));
    await expect(createGameEvent(5, eventData)).rejects.toThrow('Forbidden');
  });
});

// ── updateGameEvent ─────────────────────────────────────────────────────────

describe('updateGameEvent', () => {
  const eventUpdate = { minute: '35', description: 'Assist' };

  it('calls PUT /api/game/{gameId}/event/{eventId} with update data', async () => {
    mockApiJson.mockResolvedValue({ success: true });
    await updateGameEvent(3, 12, eventUpdate);
    expect(mockApiJson).toHaveBeenCalledWith('/api/game/3/event/12', {
      method: 'PUT',
      body: eventUpdate,
    });
  });

  it('returns the success response', async () => {
    mockApiJson.mockResolvedValue({ success: true });
    const result = await updateGameEvent(3, 12, eventUpdate);
    expect(result).toEqual({ success: true });
  });
});

// ── deleteGameEvent ─────────────────────────────────────────────────────────

describe('deleteGameEvent', () => {
  it('calls DELETE /api/game/{gameId}/event/{eventId}', async () => {
    mockApiJson.mockResolvedValue({ success: true });
    await deleteGameEvent(8, 15);
    expect(mockApiJson).toHaveBeenCalledWith('/api/game/8/event/15', { method: 'DELETE' });
  });

  it('returns success response', async () => {
    mockApiJson.mockResolvedValue({ success: true });
    const result = await deleteGameEvent(8, 15);
    expect(result).toEqual({ success: true });
  });

  it('propagates errors from apiJson', async () => {
    mockApiJson.mockRejectedValue(new Error('Not found'));
    await expect(deleteGameEvent(1, 1)).rejects.toThrow('Not found');
  });
});

// ── syncFussballDe ──────────────────────────────────────────────────────────

describe('syncFussballDe', () => {
  it('calls POST /api/game/{gameId}/sync-fussballde', async () => {
    mockApiJson.mockResolvedValue({ success: true });
    await syncFussballDe(11);
    expect(mockApiJson).toHaveBeenCalledWith('/api/game/11/sync-fussballde', { method: 'POST' });
  });

  it('returns success response', async () => {
    mockApiJson.mockResolvedValue({ success: true });
    const result = await syncFussballDe(11);
    expect(result).toEqual({ success: true });
  });

  it('propagates errors from apiJson', async () => {
    mockApiJson.mockRejectedValue(new Error('Sync failed'));
    await expect(syncFussballDe(1)).rejects.toThrow('Sync failed');
  });
});

// ── finishGame ──────────────────────────────────────────────────────────────

describe('finishGame', () => {
  it('calls POST /api/games/{gameId}/finish', async () => {
    mockApiJson.mockResolvedValue({ success: true, isFinished: true, advanced: null });
    await finishGame(4);
    expect(mockApiJson).toHaveBeenCalledWith('/api/games/4/finish', { method: 'POST' });
  });

  it('returns the finish response with advanced info', async () => {
    const response = {
      success: true,
      isFinished: true,
      advanced: { nextMatchId: 99, round: 2, slot: 0, homeTeam: null, awayTeam: null, gameCreated: true },
    };
    mockApiJson.mockResolvedValue(response);
    const result = await finishGame(4);
    expect(result).toEqual(response);
  });

  it('propagates errors from apiJson', async () => {
    mockApiJson.mockRejectedValue(new Error('Server error'));
    await expect(finishGame(99)).rejects.toThrow('Server error');
  });
});

// ── updateGameTiming ────────────────────────────────────────────────────────

describe('updateGameTiming', () => {
  const timingData = { halfDuration: 45, halftimeBreakDuration: 15 };

  it('calls PATCH /api/games/{gameId}/timing with the timing data', async () => {
    mockApiJson.mockResolvedValue({ success: true, halfDuration: 45, halftimeBreakDuration: 15, firstHalfExtraTime: null, secondHalfExtraTime: null });
    await updateGameTiming(6, timingData);
    expect(mockApiJson).toHaveBeenCalledWith('/api/games/6/timing', {
      method: 'PATCH',
      body: timingData,
    });
  });

  it('returns the timing response', async () => {
    const response = { success: true, halfDuration: 45, halftimeBreakDuration: 15, firstHalfExtraTime: null, secondHalfExtraTime: null };
    mockApiJson.mockResolvedValue(response);
    const result = await updateGameTiming(6, timingData);
    expect(result).toEqual(response);
  });

  it('propagates errors from apiJson', async () => {
    mockApiJson.mockRejectedValue(new Error('Not found'));
    await expect(updateGameTiming(1, {})).rejects.toThrow('Not found');
  });
});

// ── saveGameMatchPlan ───────────────────────────────────────────────────────

describe('saveGameMatchPlan', () => {
  const matchPlan = { phases: [] } as any;

  it('calls PATCH /api/games/{gameId}/match-plan with the match plan', async () => {
    mockApiJson.mockResolvedValue({ success: true, matchPlan });
    await saveGameMatchPlan(9, matchPlan);
    expect(mockApiJson).toHaveBeenCalledWith('/api/games/9/match-plan', {
      method: 'PATCH',
      body: matchPlan,
    });
  });

  it('returns the saved match plan response', async () => {
    const response = { success: true, matchPlan };
    mockApiJson.mockResolvedValue(response);
    const result = await saveGameMatchPlan(9, matchPlan);
    expect(result).toEqual(response);
  });

  it('propagates errors from apiJson', async () => {
    mockApiJson.mockRejectedValue(new Error('Forbidden'));
    await expect(saveGameMatchPlan(1, matchPlan)).rejects.toThrow('Forbidden');
  });
});

// ── confirmGameMatchPlanSubstitution ────────────────────────────────────────

describe('confirmGameMatchPlanSubstitution', () => {
  const phaseId = 'phase-abc-123';

  it('calls POST /api/games/{gameId}/match-plan/confirm-substitution with phaseId', async () => {
    mockApiJson.mockResolvedValue({ success: true, eventId: 42, matchPlan: { phases: [] } });
    await confirmGameMatchPlanSubstitution(7, phaseId);
    expect(mockApiJson).toHaveBeenCalledWith('/api/games/7/match-plan/confirm-substitution', {
      method: 'POST',
      body: { phaseId },
    });
  });

  it('returns the confirmation response', async () => {
    const response = { success: true, eventId: null, matchPlan: { phases: [] } };
    mockApiJson.mockResolvedValue(response);
    const result = await confirmGameMatchPlanSubstitution(7, phaseId);
    expect(result).toEqual(response);
  });

  it('propagates errors from apiJson', async () => {
    mockApiJson.mockRejectedValue(new Error('Conflict'));
    await expect(confirmGameMatchPlanSubstitution(1, phaseId)).rejects.toThrow('Conflict');
  });
});
