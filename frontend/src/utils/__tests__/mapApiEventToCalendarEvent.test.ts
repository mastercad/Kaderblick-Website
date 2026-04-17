import {
  mapApiEventToCalendarEvent,
  fulfillPendingTournamentMatches,
} from '../mapApiEventToCalendarEvent';
import type { Team } from '../../types/calendar';

// ─── Helpers ────────────────────────────────────────────────────────────────

const teams: Team[] = [
  { id: 1, name: 'FC Alpha' } as Team,
  { id: 2, name: 'FC Beta' } as Team,
  { id: 3, name: 'SC Gamma' } as Team,
];

function baseEv(overrides: Record<string, unknown> = {}): any {
  return {
    id: 10,
    title: 'Training',
    start: '2026-04-17T10:00:00',
    end: '2026-04-17T11:30:00',
    description: 'Normales Training',
    type: { id: 1, name: 'Training', color: '#0f0' },
    location: { name: 'Sportplatz', city: 'Berlin' },
    permissions: { canEdit: true },
    cancelled: false,
    ...overrides,
  };
}

// ─── fulfillPendingTournamentMatches ─────────────────────────────────────────

describe('fulfillPendingTournamentMatches', () => {
  it('fills homeTeamName and awayTeamName when both teams are found', () => {
    const match = { homeTeamId: 1, awayTeamId: 2 };
    const result = fulfillPendingTournamentMatches([match], teams);

    expect(result).toHaveLength(1);
    expect(result[0].homeTeamName).toBe('FC Alpha');
    expect(result[0].awayTeamName).toBe('FC Beta');
  });

  it('resolves team ids given as strings', () => {
    const match = { homeTeamId: '1', awayTeamId: '3' };
    const result = fulfillPendingTournamentMatches([match], teams);

    expect(result).toHaveLength(1);
    expect(result[0].homeTeamName).toBe('FC Alpha');
    expect(result[0].awayTeamName).toBe('SC Gamma');
  });

  it('resolves team ids given as numbers', () => {
    const match = { homeTeamId: 2, awayTeamId: 3 };
    const result = fulfillPendingTournamentMatches([match], teams);

    expect(result).toHaveLength(1);
    expect(result[0].homeTeamName).toBe('FC Beta');
    expect(result[0].awayTeamName).toBe('SC Gamma');
  });

  it('skips a match when homeTeam is not found', () => {
    const match = { homeTeamId: 99, awayTeamId: 2 };
    const result = fulfillPendingTournamentMatches([match], teams);

    expect(result).toHaveLength(0);
  });

  it('skips a match when awayTeam is not found', () => {
    const match = { homeTeamId: 1, awayTeamId: 99 };
    const result = fulfillPendingTournamentMatches([match], teams);

    expect(result).toHaveLength(0);
  });

  it('skips a match when both teams are not found', () => {
    const match = { homeTeamId: 99, awayTeamId: 100 };
    const result = fulfillPendingTournamentMatches([match], teams);

    expect(result).toHaveLength(0);
  });

  it('returns empty array when matches array is empty', () => {
    expect(fulfillPendingTournamentMatches([], teams)).toEqual([]);
  });

  it('returns empty array when teams array is empty and matches exist', () => {
    const match = { homeTeamId: 1, awayTeamId: 2 };
    expect(fulfillPendingTournamentMatches([match], [])).toEqual([]);
  });

  it('mutates the match object in place', () => {
    const match: any = { homeTeamId: 1, awayTeamId: 2, extraField: 'keep' };
    const result = fulfillPendingTournamentMatches([match], teams);

    // returned item is the same reference
    expect(result[0]).toBe(match);
    expect(result[0].extraField).toBe('keep');
  });

  it('processes multiple matches and keeps only resolvable ones', () => {
    const matches = [
      { homeTeamId: 1, awayTeamId: 2 },
      { homeTeamId: 99, awayTeamId: 2 }, // skipped – homeTeam missing
      { homeTeamId: 2, awayTeamId: 3 },
    ];
    const result = fulfillPendingTournamentMatches(matches, teams);

    expect(result).toHaveLength(2);
    expect(result[0].homeTeamName).toBe('FC Alpha');
    expect(result[1].homeTeamName).toBe('FC Beta');
  });
});

// ─── mapApiEventToCalendarEvent — basic fields ───────────────────────────────

describe('mapApiEventToCalendarEvent — basic fields', () => {
  it('maps id from ev.id', () => {
    const result = mapApiEventToCalendarEvent(baseEv({ id: 42 }), teams);
    expect(result.id).toBe(42);
  });

  it('defaults id to 0 when ev.id is falsy', () => {
    const result = mapApiEventToCalendarEvent(baseEv({ id: 0 }), teams);
    expect(result.id).toBe(0);
  });

  it('defaults id to 0 when ev.id is missing', () => {
    const ev = baseEv();
    delete ev.id;
    const result = mapApiEventToCalendarEvent(ev, teams);
    expect(result.id).toBe(0);
  });

  it('maps title from ev.title', () => {
    const result = mapApiEventToCalendarEvent(baseEv({ title: 'Cup-Spiel' }), teams);
    expect(result.title).toBe('Cup-Spiel');
  });

  it('defaults title to "Unbenannter Termin" when ev.title is missing', () => {
    const ev = baseEv();
    delete ev.title;
    const result = mapApiEventToCalendarEvent(ev, teams);
    expect(result.title).toBe('Unbenannter Termin');
  });

  it('maps start as a Date object', () => {
    const result = mapApiEventToCalendarEvent(baseEv({ start: '2026-06-01T09:00:00' }), teams);
    expect(result.start).toBeInstanceOf(Date);
    expect((result.start as Date).toISOString()).toContain('2026-06-01');
  });

  it('maps end as a Date object', () => {
    const result = mapApiEventToCalendarEvent(baseEv({ end: '2026-06-01T10:30:00' }), teams);
    expect(result.end).toBeInstanceOf(Date);
    expect((result.end as Date).toISOString()).toContain('2026-06-01');
  });

  it('maps description', () => {
    const result = mapApiEventToCalendarEvent(baseEv({ description: 'Intensivtraining' }), teams);
    expect(result.description).toBe('Intensivtraining');
  });

  it('defaults description to empty string when missing', () => {
    const ev = baseEv();
    delete ev.description;
    const result = mapApiEventToCalendarEvent(ev, teams);
    expect(result.description).toBe('');
  });

  it('maps eventType from ev.type', () => {
    const type = { id: 2, name: 'Spiel', color: '#f00' };
    const result = mapApiEventToCalendarEvent(baseEv({ type }), teams);
    expect(result.eventType).toEqual(type);
  });

  it('defaults eventType to empty object when ev.type is missing', () => {
    const ev = baseEv();
    delete ev.type;
    const result = mapApiEventToCalendarEvent(ev, teams);
    expect(result.eventType).toEqual({});
  });

  it('maps location', () => {
    const location = { name: 'Stadion', city: 'München' };
    const result = mapApiEventToCalendarEvent(baseEv({ location }), teams);
    expect(result.location).toEqual(location);
  });

  it('defaults location to empty object when missing', () => {
    const ev = baseEv();
    delete ev.location;
    const result = mapApiEventToCalendarEvent(ev, teams);
    expect(result.location).toEqual({});
  });

  it('maps game when present', () => {
    const game = { id: 7, homeTeam: { name: 'FC' } };
    const result = mapApiEventToCalendarEvent(baseEv({ game }), teams);
    expect(result.game).toEqual(game);
  });

  it('sets game to undefined when missing', () => {
    const ev = baseEv();
    delete ev.game;
    const result = mapApiEventToCalendarEvent(ev, teams);
    expect(result.game).toBeUndefined();
  });

  it('maps task when present', () => {
    const task = { id: 3, title: 'Tore aufbauen' };
    const result = mapApiEventToCalendarEvent(baseEv({ task }), teams);
    expect(result.task).toEqual(task);
  });

  it('sets task to undefined when missing', () => {
    const ev = baseEv();
    delete ev.task;
    const result = mapApiEventToCalendarEvent(ev, teams);
    expect(result.task).toBeUndefined();
  });

  it('maps weatherData when present', () => {
    const weatherData = { weatherCode: 3 };
    const result = mapApiEventToCalendarEvent(baseEv({ weatherData }), teams);
    expect(result.weatherData).toEqual(weatherData);
  });

  it('sets weatherData to undefined when missing', () => {
    const ev = baseEv();
    delete ev.weatherData;
    const result = mapApiEventToCalendarEvent(ev, teams);
    expect(result.weatherData).toBeUndefined();
  });

  it('maps cancelled as true', () => {
    const result = mapApiEventToCalendarEvent(baseEv({ cancelled: true }), teams);
    expect(result.cancelled).toBe(true);
  });

  it('defaults cancelled to false when missing', () => {
    const ev = baseEv();
    delete ev.cancelled;
    const result = mapApiEventToCalendarEvent(ev, teams);
    expect(result.cancelled).toBe(false);
  });

  it('maps cancelReason when present', () => {
    const result = mapApiEventToCalendarEvent(baseEv({ cancelReason: 'Regen' }), teams);
    expect(result.cancelReason).toBe('Regen');
  });

  it('sets cancelReason to undefined when missing', () => {
    const ev = baseEv();
    delete ev.cancelReason;
    const result = mapApiEventToCalendarEvent(ev, teams);
    expect(result.cancelReason).toBeUndefined();
  });

  it('maps cancelledBy when present', () => {
    const result = mapApiEventToCalendarEvent(baseEv({ cancelledBy: 'Max' }), teams);
    expect(result.cancelledBy).toBe('Max');
  });

  it('sets cancelledBy to undefined when missing', () => {
    const ev = baseEv();
    delete ev.cancelledBy;
    const result = mapApiEventToCalendarEvent(ev, teams);
    expect(result.cancelledBy).toBeUndefined();
  });

  it('maps permissions object', () => {
    const permissions = { canEdit: true, canDelete: false };
    const result = mapApiEventToCalendarEvent(baseEv({ permissions }), teams);
    expect(result.permissions).toEqual(permissions);
  });

  it('defaults permissions to empty object when missing', () => {
    const ev = baseEv();
    delete ev.permissions;
    const result = mapApiEventToCalendarEvent(ev, teams);
    expect(result.permissions).toEqual({});
  });
});

// ─── mapApiEventToCalendarEvent — meeting fields ─────────────────────────────

describe('mapApiEventToCalendarEvent — meeting fields', () => {
  it('maps meetingPoint when present', () => {
    const result = mapApiEventToCalendarEvent(baseEv({ meetingPoint: 'Parkplatz West' }), teams);
    expect(result.meetingPoint).toBe('Parkplatz West');
  });

  it('sets meetingPoint to undefined when missing', () => {
    const ev = baseEv();
    delete ev.meetingPoint;
    const result = mapApiEventToCalendarEvent(ev, teams);
    expect(result.meetingPoint).toBeUndefined();
  });

  it('sets meetingPoint to undefined when null', () => {
    const result = mapApiEventToCalendarEvent(baseEv({ meetingPoint: null }), teams);
    expect(result.meetingPoint).toBeUndefined();
  });

  it('extracts HH:mm substring from full ISO meetingTime', () => {
    const result = mapApiEventToCalendarEvent(
      baseEv({ meetingTime: '2026-04-17T14:30:00' }),
      teams,
    );
    expect(result.meetingTime).toBe('14:30');
  });

  it('correctly extracts "00:00" from midnight ISO meetingTime', () => {
    const result = mapApiEventToCalendarEvent(
      baseEv({ meetingTime: '2026-04-17T00:00:00' }),
      teams,
    );
    expect(result.meetingTime).toBe('00:00');
  });

  it('sets meetingTime to undefined when missing', () => {
    const ev = baseEv();
    delete ev.meetingTime;
    const result = mapApiEventToCalendarEvent(ev, teams);
    expect(result.meetingTime).toBeUndefined();
  });

  it('sets meetingTime to undefined when null', () => {
    const result = mapApiEventToCalendarEvent(baseEv({ meetingTime: null }), teams);
    expect(result.meetingTime).toBeUndefined();
  });

  it('maps meetingLocation when present', () => {
    const meetingLocation = { id: 5, name: 'Sportzentrum', latitude: 48.1, longitude: 11.6 };
    const result = mapApiEventToCalendarEvent(baseEv({ meetingLocation }), teams);
    expect(result.meetingLocation).toEqual(meetingLocation);
  });

  it('sets meetingLocation to undefined when missing', () => {
    const ev = baseEv();
    delete ev.meetingLocation;
    const result = mapApiEventToCalendarEvent(ev, teams);
    expect(result.meetingLocation).toBeUndefined();
  });

  it('sets meetingLocation to undefined when null', () => {
    const result = mapApiEventToCalendarEvent(baseEv({ meetingLocation: null }), teams);
    expect(result.meetingLocation).toBeUndefined();
  });
});

// ─── mapApiEventToCalendarEvent — training fields ────────────────────────────

describe('mapApiEventToCalendarEvent — training fields', () => {
  it('maps trainingTeamId when present', () => {
    const result = mapApiEventToCalendarEvent(baseEv({ trainingTeamId: 7 }), teams);
    expect(result.trainingTeamId).toBe(7);
  });

  it('sets trainingTeamId to undefined when missing', () => {
    const ev = baseEv();
    delete ev.trainingTeamId;
    const result = mapApiEventToCalendarEvent(ev, teams);
    expect(result.trainingTeamId).toBeUndefined();
  });

  it('maps trainingWeekdays when present', () => {
    const weekdays = ['MO', 'WE'];
    const result = mapApiEventToCalendarEvent(baseEv({ trainingWeekdays: weekdays }), teams);
    expect(result.trainingWeekdays).toEqual(weekdays);
  });

  it('maps trainingSeriesEndDate when present', () => {
    const result = mapApiEventToCalendarEvent(
      baseEv({ trainingSeriesEndDate: '2026-12-31' }),
      teams,
    );
    expect(result.trainingSeriesEndDate).toBe('2026-12-31');
  });

  it('maps trainingSeriesId when present', () => {
    const result = mapApiEventToCalendarEvent(baseEv({ trainingSeriesId: 99 }), teams);
    expect(result.trainingSeriesId).toBe(99);
  });
});

// ─── mapApiEventToCalendarEvent — tournament fields ──────────────────────────

describe('mapApiEventToCalendarEvent — tournament fields', () => {
  it('maps tournamentId from ev.tournament.id', () => {
    const tournament = { id: 55, matches: [] };
    const result = mapApiEventToCalendarEvent(baseEv({ tournament }), teams);
    expect(result.tournamentId).toBe(55);
  });

  it('sets tournamentId to undefined when no tournament', () => {
    const ev = baseEv();
    delete ev.tournament;
    const result = mapApiEventToCalendarEvent(ev, teams);
    expect(result.tournamentId).toBeUndefined();
  });

  it('maps matches from ev.tournament.matches', () => {
    const matches = [{ homeTeamId: 1, awayTeamId: 2 }];
    const result = mapApiEventToCalendarEvent(baseEv({ tournament: { id: 1, matches } }), teams);
    expect(result.matches).toEqual(matches);
  });

  it('sets matches to undefined when no tournament', () => {
    const ev = baseEv();
    delete ev.tournament;
    const result = mapApiEventToCalendarEvent(ev, teams);
    expect(result.matches).toBeUndefined();
  });

  it('maps tournamentType from tournamentSettings', () => {
    const result = mapApiEventToCalendarEvent(
      baseEv({ tournamentSettings: { type: 'indoor_hall', roundDuration: 8 } }),
      teams,
    );
    expect(result.tournamentType).toBe('indoor_hall');
  });

  it('maps tournamentRoundDuration from tournamentSettings', () => {
    const result = mapApiEventToCalendarEvent(
      baseEv({ tournamentSettings: { roundDuration: 10, breakTime: 2, gameMode: 'ko', numberOfGroups: 1 } }),
      teams,
    );
    expect(result.tournamentRoundDuration).toBe(10);
    expect(result.tournamentBreakTime).toBe(2);
    expect(result.tournamentGameMode).toBe('ko');
    expect(result.tournamentNumberOfGroups).toBe(1);
  });

  it('sets all tournamentSettings fields to undefined when tournamentSettings is missing', () => {
    const ev = baseEv();
    delete ev.tournamentSettings;
    const result = mapApiEventToCalendarEvent(ev, teams);
    expect(result.tournamentType).toBeUndefined();
    expect(result.tournamentRoundDuration).toBeUndefined();
    expect(result.tournamentBreakTime).toBeUndefined();
    expect(result.tournamentGameMode).toBeUndefined();
    expect(result.tournamentNumberOfGroups).toBeUndefined();
  });

  it('uses provided tournamentTeamIds as teamIds and tournamentTeams', () => {
    const tournamentTeamIds = [{ id: 10 }, { id: 20 }];
    const result = mapApiEventToCalendarEvent(baseEv(), teams, tournamentTeamIds);
    expect(result.teamIds).toEqual(tournamentTeamIds);
    expect(result.tournamentTeams).toEqual(tournamentTeamIds);
  });

  it('defaults teamIds to empty array when tournamentTeamIds is not provided', () => {
    const result = mapApiEventToCalendarEvent(baseEv(), teams);
    expect(result.teamIds).toEqual([]);
    expect(result.tournamentTeams).toEqual([]);
  });

  it('defaults teamIds to empty array when tournamentTeamIds is undefined', () => {
    const result = mapApiEventToCalendarEvent(baseEv(), teams, undefined);
    expect(result.teamIds).toEqual([]);
    expect(result.tournamentTeams).toEqual([]);
  });

  it('calls fulfillPendingTournamentMatches with tournament matches and teams', () => {
    const matches = [
      { homeTeamId: 1, awayTeamId: 2 },
      { homeTeamId: 99, awayTeamId: 2 }, // unresolvable
    ];
    const result = mapApiEventToCalendarEvent(
      baseEv({ tournament: { id: 5, matches } }),
      teams,
    );
    // Only the resolvable match is in pendingTournamentMatches
    expect(result.pendingTournamentMatches).toHaveLength(1);
    expect((result.pendingTournamentMatches as any[])[0].homeTeamName).toBe('FC Alpha');
  });

  it('defaults pendingTournamentMatches to empty array when no tournament', () => {
    const ev = baseEv();
    delete ev.tournament;
    const result = mapApiEventToCalendarEvent(ev, teams);
    expect(result.pendingTournamentMatches).toEqual([]);
  });
});
