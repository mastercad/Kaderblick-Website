import { buildCalendarEventPayload } from '../buildCalendarEventPayload';
import type { EventFormData } from '../../types/calendar';

// Mock buildLeagueCupPayload so we get a predictable value for leagueId/cupId
jest.mock('../buildLeagueCupPayload', () => ({
  buildLeagueCupPayload: jest.fn(() => ({ leagueId: null, cupId: null })),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function baseFormData(overrides: Partial<EventFormData> = {}): EventFormData {
  return {
    title: 'Test Event',
    date: '2025-06-15',
    time: '10:00',
    description: 'A description',
    eventType: '3',
    permissionType: 'public',
    permissionTeams: [],
    permissionClubs: [],
    permissionUsers: [],
    ...overrides,
  };
}

const noFlags = { isMatchEvent: false, isTournament: false, isTask: false, isTraining: false };
const gameTypesOptions = [{ value: '2', label: 'Ligaspiel' }, { value: '5', label: 'Turnier' }];
const tournamentTeams: { value: string; label: string }[] = [
  { value: '10', label: 'FC Alpha' },
  { value: '20', label: 'FC Beta' },
];

// ─── Base payload ────────────────────────────────────────────────────────────

describe('buildCalendarEventPayload — base fields', () => {
  it('includes title, description, permissionType', () => {
    const result = buildCalendarEventPayload(baseFormData(), noFlags, null, gameTypesOptions, tournamentTeams);
    expect(result.title).toBe('Test Event');
    expect(result.description).toBe('A description');
    expect(result.permissionType).toBe('public');
  });

  it('parses eventTypeId as integer', () => {
    const result = buildCalendarEventPayload(baseFormData({ eventType: '7' }), noFlags, null, gameTypesOptions, tournamentTeams);
    expect(result.eventTypeId).toBe(7);
  });

  it('sets eventTypeId to undefined when no eventType given', () => {
    const result = buildCalendarEventPayload(baseFormData({ eventType: undefined }), noFlags, null, gameTypesOptions, tournamentTeams);
    expect(result.eventTypeId).toBeUndefined();
  });

  it('parses locationId as integer when provided', () => {
    const result = buildCalendarEventPayload(baseFormData({ locationId: '42' }), noFlags, null, gameTypesOptions, tournamentTeams);
    expect(result.locationId).toBe(42);
  });

  it('sets locationId to undefined when not provided', () => {
    const result = buildCalendarEventPayload(baseFormData(), noFlags, null, gameTypesOptions, tournamentTeams);
    expect(result.locationId).toBeUndefined();
  });

  it('maps permissionUsers / Teams / Clubs to int arrays', () => {
    const form = baseFormData({
      permissionTeams: ['1', '2'],
      permissionClubs: ['3'],
      permissionUsers: ['4', '5'],
    });
    const result = buildCalendarEventPayload(form, noFlags, null, gameTypesOptions, tournamentTeams);
    expect(result.permissionTeams).toEqual([1, 2]);
    expect(result.permissionClubs).toEqual([3]);
    expect(result.permissionUsers).toEqual([4, 5]);
  });

  it('defaults description to empty string when undefined', () => {
    const result = buildCalendarEventPayload(baseFormData({ description: undefined }), noFlags, null, gameTypesOptions, tournamentTeams);
    expect(result.description).toBe('');
  });

  it('defaults permissionType to "public" when undefined', () => {
    const result = buildCalendarEventPayload(baseFormData({ permissionType: undefined }), noFlags, null, gameTypesOptions, tournamentTeams);
    expect(result.permissionType).toBe('public');
  });

  it('falls back to empty arrays when permissionTeams/Clubs/Users are undefined', () => {
    // covers the `|| []` branch of the optional chaining on lines 62-64
    const form = baseFormData({ permissionTeams: undefined, permissionClubs: undefined, permissionUsers: undefined });
    const result = buildCalendarEventPayload(form, noFlags, null, gameTypesOptions, tournamentTeams);
    expect(result.permissionTeams).toEqual([]);
    expect(result.permissionClubs).toEqual([]);
    expect(result.permissionUsers).toEqual([]);
  });
});

// ─── DateTime assembly ───────────────────────────────────────────────────────

describe('buildCalendarEventPayload — DateTime assembly', () => {
  it('assembles startDate from date + time', () => {
    const result = buildCalendarEventPayload(
      baseFormData({ date: '2025-06-15', time: '14:30' }),
      noFlags,
      null,
      gameTypesOptions,
      tournamentTeams,
    );
    expect(result.startDate).toBe('2025-06-15T14:30:00');
  });

  it('startDate defaults to T00:00:00 when time is absent', () => {
    const result = buildCalendarEventPayload(
      baseFormData({ date: '2025-06-15', time: undefined }),
      noFlags,
      null,
      gameTypesOptions,
      tournamentTeams,
    );
    expect(result.startDate).toBe('2025-06-15T00:00:00');
  });

  it('assembles endDate from endDate + endTime when provided', () => {
    const result = buildCalendarEventPayload(
      baseFormData({ endDate: '2025-06-15', endTime: '16:00' }),
      noFlags,
      null,
      gameTypesOptions,
      tournamentTeams,
    );
    expect(result.endDate).toBe('2025-06-15T16:00:00');
  });

  it('endDate defaults to T23:59:59 when endDate is set but endTime absent', () => {
    const result = buildCalendarEventPayload(
      baseFormData({ endDate: '2025-06-15', endTime: undefined }),
      noFlags,
      null,
      gameTypesOptions,
      tournamentTeams,
    );
    expect(result.endDate).toBe('2025-06-15T23:59:59');
  });

  it('endDate equals startDate when no endDate nor special rule applies', () => {
    const form = baseFormData({ endDate: undefined, endTime: undefined });
    const result = buildCalendarEventPayload(form, noFlags, null, gameTypesOptions, tournamentTeams);
    expect(result.endDate).toBe(result.startDate);
  });

  it('auto-computes endDate for match event without explicit endDate (45+15+45=105 min default)', () => {
    const form = baseFormData({ date: '2025-06-15', time: '10:00', endDate: undefined });
    const flags = { isMatchEvent: true, isTournament: false, isTask: false, isTraining: false };
    const result = buildCalendarEventPayload(form, flags, null, gameTypesOptions, tournamentTeams);
    // 10:00 + 105 min = 11:45
    expect(result.endDate).toContain('T11:45:00');
  });

  it('auto-computes endDate for match event with custom half duration', () => {
    const form = baseFormData({
      date: '2025-06-15',
      time: '09:00',
      endDate: undefined,
      gameHalfDuration: 30,
      gameHalftimeBreakDuration: 10,
    });
    const flags = { isMatchEvent: true, isTournament: false, isTask: false, isTraining: false };
    const result = buildCalendarEventPayload(form, flags, null, gameTypesOptions, tournamentTeams);
    // 09:00 + (2*30+10) = 09:00 + 70 min = 10:10
    expect(result.endDate).toContain('T10:10:00');
  });
});

// ─── Match event ─────────────────────────────────────────────────────────────

describe('buildCalendarEventPayload — isMatchEvent', () => {
  const flags = { isMatchEvent: true, isTournament: false, isTask: false, isTraining: false };

  it('adds payload.game when homeTeam and awayTeam are set', () => {
    const form = baseFormData({ homeTeam: '1', awayTeam: '2' });
    const result = buildCalendarEventPayload(form, flags, null, gameTypesOptions, tournamentTeams);
    expect(result.game).toBeDefined();
    expect(result.game.homeTeamId).toBe(1);
    expect(result.game.awayTeamId).toBe(2);
  });

  it('does NOT add payload.game when isTournament is true', () => {
    const form = baseFormData({ homeTeam: '1', awayTeam: '2' });
    const tournFlags = { isMatchEvent: true, isTournament: true, isTask: false, isTraining: false };
    const result = buildCalendarEventPayload(form, tournFlags, null, gameTypesOptions, tournamentTeams);
    expect(result.game).toBeUndefined();
  });

  it('does NOT add payload.game when homeTeam is missing', () => {
    const form = baseFormData({ homeTeam: undefined, awayTeam: '2' });
    const result = buildCalendarEventPayload(form, flags, null, gameTypesOptions, tournamentTeams);
    expect(result.game).toBeUndefined();
  });

  it('includes optional game timing fields when provided', () => {
    const form = baseFormData({
      homeTeam: '3',
      awayTeam: '4',
      gameHalfDuration: 45,
      gameHalftimeBreakDuration: 15,
      gameFirstHalfExtraTime: 2,
      gameSecondHalfExtraTime: 3,
    });
    const result = buildCalendarEventPayload(form, flags, null, gameTypesOptions, tournamentTeams);
    expect(result.game.halfDuration).toBe(45);
    expect(result.game.halftimeBreakDuration).toBe(15);
    expect(result.game.firstHalfExtraTime).toBe(2);
    expect(result.game.secondHalfExtraTime).toBe(3);
  });

  it('adds gameTypeId when gameType is set', () => {
    const form = baseFormData({ homeTeam: '1', awayTeam: '2', gameType: '5' });
    const result = buildCalendarEventPayload(form, flags, null, gameTypesOptions, tournamentTeams);
    expect(result.gameTypeId).toBe(5);
  });

  it('does not add gameTypeId when gameType is absent', () => {
    const form = baseFormData({ homeTeam: '1', awayTeam: '2', gameType: undefined });
    const result = buildCalendarEventPayload(form, flags, null, gameTypesOptions, tournamentTeams);
    expect(result.gameTypeId).toBeUndefined();
  });
});

// ─── Tournament ───────────────────────────────────────────────────────────────

describe('buildCalendarEventPayload — isTournament', () => {
  const flags = { isMatchEvent: true, isTournament: true, isTask: false, isTraining: false };

  it('adds tournament fields', () => {
    const form = baseFormData({
      tournamentType: 'indoor_hall',
      tournamentRoundDuration: 10,
      tournamentBreakTime: 2,
      tournamentGameMode: 'round_robin',
      tournamentNumberOfGroups: 2,
      pendingTournamentMatches: [
        { homeTeamId: '10', awayTeamId: '20' },
        { homeTeamId: '20', awayTeamId: '10' },
      ],
    });
    const result = buildCalendarEventPayload(form, flags, null, gameTypesOptions, tournamentTeams);
    expect(result.tournamentType).toBe('indoor_hall');
    expect(result.tournamentRoundDuration).toBe(10);
    expect(result.tournamentBreakTime).toBe(2);
    expect(result.tournamentGameMode).toBe('round_robin');
    expect(result.tournamentNumberOfGroups).toBe(2);
    expect(result.pendingTournamentMatches).toHaveLength(2);
  });

  it('extracts team ids from pendingTournamentMatches', () => {
    const form = baseFormData({
      pendingTournamentMatches: [
        { homeTeamId: '10', awayTeamId: '20' },
      ],
    });
    const result = buildCalendarEventPayload(form, flags, null, gameTypesOptions, tournamentTeams);
    expect(result.teams).toContain('10');
    expect(result.teams).toContain('20');
  });

  it('defaults to indoor_hall when tournamentType is absent', () => {
    const form = baseFormData({ pendingTournamentMatches: [] });
    const result = buildCalendarEventPayload(form, flags, null, gameTypesOptions, tournamentTeams);
    expect(result.tournamentType).toBe('indoor_hall');
  });

  it('defaults tournamentRoundDuration to 10', () => {
    const form = baseFormData({ pendingTournamentMatches: [] });
    const result = buildCalendarEventPayload(form, flags, null, gameTypesOptions, tournamentTeams);
    expect(result.tournamentRoundDuration).toBe(10);
  });

  it('defaults tournamentBreakTime to 2', () => {
    const form = baseFormData({ pendingTournamentMatches: [] });
    const result = buildCalendarEventPayload(form, flags, null, gameTypesOptions, tournamentTeams);
    expect(result.tournamentBreakTime).toBe(2);
  });

  it('skips null homeTeamId/awayTeamId when building team set from matches', () => {
    // covers the `if (m.homeTeamId)` / `if (m.awayTeamId)` false branches (lines 102-103)
    const form = baseFormData({
      pendingTournamentMatches: [
        { homeTeamId: null, awayTeamId: null },
        { homeTeamId: '10', awayTeamId: null },
      ],
    });
    const result = buildCalendarEventPayload(form, flags, null, gameTypesOptions, tournamentTeams);
    // only '10' was truthy
    expect(result.teams).toEqual(['10']);
  });
});

// ─── Task ─────────────────────────────────────────────────────────────────────

describe('buildCalendarEventPayload — isTask', () => {
  const flags = { isMatchEvent: false, isTournament: false, isTask: true, isTraining: false };

  it('adds task object', () => {
    const form = baseFormData({ taskIsRecurring: false });
    const result = buildCalendarEventPayload(form, flags, null, gameTypesOptions, tournamentTeams);
    expect(result.task).toBeDefined();
  });

  it('task.isRecurring is false by default', () => {
    const form = baseFormData({});
    const result = buildCalendarEventPayload(form, flags, null, gameTypesOptions, tournamentTeams);
    expect(result.task.isRecurring).toBe(false);
  });

  it('populates recurrenceRule for recurring task with default classic mode', () => {
    const form = baseFormData({
      taskIsRecurring: true,
      taskRecurrenceMode: 'classic',
      taskFreq: 'WEEKLY',
      taskInterval: 1,
    });
    const result = buildCalendarEventPayload(form, flags, null, gameTypesOptions, tournamentTeams);
    const rule = JSON.parse(result.task.recurrenceRule);
    expect(rule.freq).toBe('WEEKLY');
    expect(rule.interval).toBe(1);
    expect(rule.byday).toEqual(['MO']);
  });

  it('sets byday for WEEKLY recurrence', () => {
    const form = baseFormData({
      taskIsRecurring: true,
      taskRecurrenceMode: 'classic',
      taskFreq: 'WEEKLY',
      taskByDay: 'WE',
    });
    const result = buildCalendarEventPayload(form, flags, null, gameTypesOptions, tournamentTeams);
    const rule = JSON.parse(result.task.recurrenceRule);
    expect(rule.byday).toEqual(['WE']);
  });

  it('sets bymonthday for MONTHLY recurrence', () => {
    const form = baseFormData({
      taskIsRecurring: true,
      taskRecurrenceMode: 'classic',
      taskFreq: 'MONTHLY',
      taskByMonthDay: 15,
    });
    const result = buildCalendarEventPayload(form, flags, null, gameTypesOptions, tournamentTeams);
    const rule = JSON.parse(result.task.recurrenceRule);
    expect(rule.bymonthday).toBe(15);
  });

  it('maps rotationUsers to int array', () => {
    const form = baseFormData({ taskRotationUsers: ['7', '8'] });
    const result = buildCalendarEventPayload(form, flags, null, gameTypesOptions, tournamentTeams);
    expect(result.task.rotationUsers).toEqual([7, 8]);
  });

  it('defaults taskFreq to WEEKLY and taskInterval to 1 when not provided in classic mode', () => {
    // covers the `|| 'WEEKLY'` and `|| 1` fallback branches on line 128
    const form = baseFormData({
      taskIsRecurring: true,
      taskRecurrenceMode: 'classic',
      taskFreq: undefined,
      taskInterval: undefined,
    });
    const result = buildCalendarEventPayload(form, flags, null, gameTypesOptions, tournamentTeams);
    const rule = JSON.parse(result.task.recurrenceRule);
    expect(rule.freq).toBe('WEEKLY');
    expect(rule.interval).toBe(1);
  });

  it('defaults bymonthday to 1 when taskFreq is MONTHLY but taskByMonthDay is not provided', () => {
    // covers the `|| 1` fallback branch on line 130
    const form = baseFormData({
      taskIsRecurring: true,
      taskRecurrenceMode: 'classic',
      taskFreq: 'MONTHLY',
      taskByMonthDay: undefined,
    });
    const result = buildCalendarEventPayload(form, flags, null, gameTypesOptions, tournamentTeams);
    const rule = JSON.parse(result.task.recurrenceRule);
    expect(rule.bymonthday).toBe(1);
  });
});

// ─── Training ─────────────────────────────────────────────────────────────────

describe('buildCalendarEventPayload — isTraining', () => {
  const flags = { isMatchEvent: false, isTournament: false, isTask: false, isTraining: true };

  it('sets permissionType to "team" when trainingTeamId is present', () => {
    const form = baseFormData({ trainingTeamId: '5' });
    const result = buildCalendarEventPayload(form, flags, null, gameTypesOptions, tournamentTeams);
    expect(result.permissionType).toBe('team');
    expect(result.permissionTeams).toEqual([5]);
  });

  it('does not override permissionType when trainingTeamId is absent', () => {
    const form = baseFormData({ trainingTeamId: undefined, permissionType: 'public' });
    const result = buildCalendarEventPayload(form, flags, null, gameTypesOptions, tournamentTeams);
    expect(result.permissionType).toBe('public');
  });

  it('sets trainingWeekdays when editingEventId and recurring', () => {
    const form = baseFormData({
      trainingTeamId: '5',
      trainingRecurring: true,
      trainingWeekdays: [1, 3],
      trainingEndDate: '2025-12-31',
    });
    const result = buildCalendarEventPayload(form, flags, 42, gameTypesOptions, tournamentTeams);
    expect(result.trainingWeekdays).toEqual([1, 3]);
    expect(result.trainingSeriesEndDate).toBe('2025-12-31');
  });

  it('sets trainingWeekdays to null when not recurring (editingEventId)', () => {
    const form = baseFormData({
      trainingTeamId: '5',
      trainingRecurring: false,
    });
    const result = buildCalendarEventPayload(form, flags, 10, gameTypesOptions, tournamentTeams);
    expect(result.trainingWeekdays).toBeNull();
    expect(result.trainingSeriesId).toBeNull();
  });

  it('sets trainingEditScope when editingEventId and trainingSeriesId present', () => {
    const form = baseFormData({
      trainingTeamId: '5',
      trainingSeriesId: 'abc',
      trainingEditScope: 'from_here',
    });
    const result = buildCalendarEventPayload(form, flags, 10, gameTypesOptions, tournamentTeams);
    expect(result.trainingEditScope).toBe('from_here');
  });

  it('sets trainingEditUntilDate when trainingEditScopeUntilDate is set', () => {
    const form = baseFormData({
      trainingTeamId: '5',
      trainingSeriesId: 'abc',
      trainingEditScope: 'same_weekday_from_here',
      trainingEditScopeUntilDate: '2025-09-01',
    });
    const result = buildCalendarEventPayload(form, flags, 10, gameTypesOptions, tournamentTeams);
    expect(result.trainingEditUntilDate).toBe('2025-09-01');
  });

  it('defaults trainingWeekdays to [] when trainingRecurring=true but weekdays are null', () => {
    // covers the `?? []` fallback branch on line 144
    const form = baseFormData({
      trainingRecurring: true,
      trainingWeekdays: undefined,
      trainingEndDate: '2025-12-31',
    });
    const result = buildCalendarEventPayload(form, flags, 42, gameTypesOptions, tournamentTeams);
    expect(result.trainingWeekdays).toEqual([]);
  });

  it('sets trainingSeriesEndDate to null when trainingEndDate is absent', () => {
    // covers the `|| null` fallback branch on line 147
    const form = baseFormData({
      trainingRecurring: true,
      trainingWeekdays: [1, 3],
      trainingEndDate: undefined,
    });
    const result = buildCalendarEventPayload(form, flags, 42, gameTypesOptions, tournamentTeams);
    expect(result.trainingSeriesEndDate).toBeNull();
  });

  it('defaults trainingEditScope to "single" when trainingSeriesId is set but scope is absent', () => {
    // covers the `|| 'single'` fallback branch on line 156
    const form = baseFormData({
      trainingSeriesId: 'abc',
      trainingEditScope: undefined,
    });
    const result = buildCalendarEventPayload(form, flags, 10, gameTypesOptions, tournamentTeams);
    expect(result.trainingEditScope).toBe('single');
  });
});

// ─── Meeting fields ───────────────────────────────────────────────────────────

describe('buildCalendarEventPayload — meeting fields', () => {
  it('sends meetingPoint value when defined', () => {
    const form = baseFormData({ meetingPoint: 'Parkplatz Nord' });
    const result = buildCalendarEventPayload(form, noFlags, null, gameTypesOptions, tournamentTeams);
    expect(result.meetingPoint).toBe('Parkplatz Nord');
  });

  it('sends meetingPoint as null when undefined (nullish coalescing)', () => {
    const form = baseFormData({ meetingPoint: undefined });
    const result = buildCalendarEventPayload(form, noFlags, null, gameTypesOptions, tournamentTeams);
    expect(result.meetingPoint).toBeNull();
  });

  it('sends meetingPoint as null when explicitly null', () => {
    const form = baseFormData({ meetingPoint: null as any });
    const result = buildCalendarEventPayload(form, noFlags, null, gameTypesOptions, tournamentTeams);
    expect(result.meetingPoint).toBeNull();
  });

  it('sends meetingPoint as empty string when value is empty string', () => {
    // '' ?? null → '' (empty string is not nullish)
    const form = baseFormData({ meetingPoint: '' });
    const result = buildCalendarEventPayload(form, noFlags, null, gameTypesOptions, tournamentTeams);
    expect(result.meetingPoint).toBe('');
  });

  it('sends meetingTime value when truthy', () => {
    const form = baseFormData({ meetingTime: '14:30' });
    const result = buildCalendarEventPayload(form, noFlags, null, gameTypesOptions, tournamentTeams);
    expect(result.meetingTime).toBe('14:30');
  });

  it('sends meetingTime as null when absent (falsy → null)', () => {
    const form = baseFormData({ meetingTime: undefined });
    const result = buildCalendarEventPayload(form, noFlags, null, gameTypesOptions, tournamentTeams);
    expect(result.meetingTime).toBeNull();
  });

  it('sends meetingTime as null when empty string (falsy → null)', () => {
    const form = baseFormData({ meetingTime: '' });
    const result = buildCalendarEventPayload(form, noFlags, null, gameTypesOptions, tournamentTeams);
    expect(result.meetingTime).toBeNull();
  });

  it('parses meetingLocationId as integer when present', () => {
    const form = baseFormData({ meetingLocationId: '5' });
    const result = buildCalendarEventPayload(form, noFlags, null, gameTypesOptions, tournamentTeams);
    expect(result.meetingLocationId).toBe(5);
  });

  it('sends meetingLocationId as null when absent', () => {
    const form = baseFormData({ meetingLocationId: undefined });
    const result = buildCalendarEventPayload(form, noFlags, null, gameTypesOptions, tournamentTeams);
    expect(result.meetingLocationId).toBeNull();
  });

  it('sends meetingLocationId as null for empty string', () => {
    const form = baseFormData({ meetingLocationId: '' });
    const result = buildCalendarEventPayload(form, noFlags, null, gameTypesOptions, tournamentTeams);
    expect(result.meetingLocationId).toBeNull();
  });
});
