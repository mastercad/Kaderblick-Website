/**
 * Tests for the suspended-status filter used in EventDetailsModal.
 *
 * The filter (mirrored from EventDetailsModal/index.tsx):
 *   participationStatuses.filter(
 *     s => s.code !== 'suspended' || !!event?.game || !!event?.tournamentId,
 *   )
 *
 * Rules:
 * - Event has a game object (event.game set)          → 'suspended' IS shown
 * - Event has a tournamentId                          → 'suspended' IS shown
 * - All other events (training, meetings, …)          → 'suspended' is hidden
 * - Statuses without code 'suspended' are always kept
 */

interface MinimalStatus {
  id: number;
  code?: string;
}

interface MinimalEvent {
  game?: object | null;
  tournamentId?: number;
}

/** Mirrors the filter from EventDetailsModal/index.tsx */
function filterStatuses(statuses: MinimalStatus[], event: MinimalEvent | null): MinimalStatus[] {
  return statuses.filter(
    s => s.code !== 'suspended' || !!event?.game || !!event?.tournamentId,
  );
}

const SUSPENDED: MinimalStatus = { id: 99, code: 'suspended' };
const ACCEPTED: MinimalStatus  = { id: 1,  code: 'accepted' };
const DECLINED: MinimalStatus  = { id: 2,  code: 'declined' };
const ALL_STATUSES = [ACCEPTED, DECLINED, SUSPENDED];

// ─── Game events ─────────────────────────────────────────────────────────────

describe('EventDetailsModal suspended filter – game events', () => {
  const gameEvent: MinimalEvent = { game: { homeTeam: { name: 'A' }, awayTeam: { name: 'B' } } };

  it('includes the suspended status for game events', () => {
    const result = filterStatuses(ALL_STATUSES, gameEvent);
    expect(result.some(s => s.code === 'suspended')).toBe(true);
  });

  it('returns all 3 statuses for a game event', () => {
    expect(filterStatuses(ALL_STATUSES, gameEvent)).toHaveLength(3);
  });

  it('keeps other statuses for game events', () => {
    const result = filterStatuses(ALL_STATUSES, gameEvent);
    expect(result.some(s => s.code === 'accepted')).toBe(true);
    expect(result.some(s => s.code === 'declined')).toBe(true);
  });
});

// ─── Tournament events ────────────────────────────────────────────────────────

describe('EventDetailsModal suspended filter – tournament events', () => {
  const tournamentEvent: MinimalEvent = { tournamentId: 7 };

  it('includes the suspended status when tournamentId is set', () => {
    const result = filterStatuses(ALL_STATUSES, tournamentEvent);
    expect(result.some(s => s.code === 'suspended')).toBe(true);
  });

  it('returns all 3 statuses for a tournament event', () => {
    expect(filterStatuses(ALL_STATUSES, tournamentEvent)).toHaveLength(3);
  });

  it('handles an event that is both game and tournament', () => {
    const both: MinimalEvent = { game: { id: 1 }, tournamentId: 3 };
    const result = filterStatuses(ALL_STATUSES, both);
    expect(result.some(s => s.code === 'suspended')).toBe(true);
    expect(result).toHaveLength(3);
  });
});

// ─── Non-game / non-tournament events ────────────────────────────────────────

describe('EventDetailsModal suspended filter – other events', () => {
  it('removes the suspended status for a training event (no game, no tournamentId)', () => {
    const event: MinimalEvent = {};
    const result = filterStatuses(ALL_STATUSES, event);
    expect(result.some(s => s.code === 'suspended')).toBe(false);
    expect(result).toHaveLength(2);
  });

  it('removes the suspended status when game is null', () => {
    const event: MinimalEvent = { game: null };
    const result = filterStatuses(ALL_STATUSES, event);
    expect(result.some(s => s.code === 'suspended')).toBe(false);
  });

  it('removes the suspended status when tournamentId is 0 (falsy)', () => {
    const event: MinimalEvent = { tournamentId: 0 };
    const result = filterStatuses(ALL_STATUSES, event);
    expect(result.some(s => s.code === 'suspended')).toBe(false);
  });

  it('removes the suspended status when event is null', () => {
    const result = filterStatuses(ALL_STATUSES, null);
    expect(result.some(s => s.code === 'suspended')).toBe(false);
    expect(result).toHaveLength(2);
  });

  it('keeps all other statuses when suspended is filtered out', () => {
    const result = filterStatuses(ALL_STATUSES, {});
    expect(result.some(s => s.code === 'accepted')).toBe(true);
    expect(result.some(s => s.code === 'declined')).toBe(true);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('EventDetailsModal suspended filter – edge cases', () => {
  it('passes through statuses without a code', () => {
    const noCode: MinimalStatus[] = [{ id: 5 }, { id: 6 }];
    expect(filterStatuses(noCode, {})).toHaveLength(2);
  });

  it('works correctly when no suspended status is in the list', () => {
    const noSuspended = [ACCEPTED, DECLINED];
    expect(filterStatuses(noSuspended, {})).toHaveLength(2);
  });

  it('works with an empty statuses array', () => {
    expect(filterStatuses([], { game: { id: 1 } })).toHaveLength(0);
  });
});

export {};
