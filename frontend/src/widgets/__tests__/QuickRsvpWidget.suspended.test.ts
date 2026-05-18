/**
 * Tests for the suspended-status filter used in QuickRsvpWidget.
 *
 * The filter (mirrored from QuickRsvpWidget.tsx):
 *   statuses.filter(
 *     s => s.code !== 'suspended' || !!event.game || event.type?.name?.toLowerCase().includes('turnier'),
 *   )
 *
 * Rules:
 * - For game events (event.game !== null)        → 'suspended' IS shown
 * - For tournament events (type.name 'turnier')  → 'suspended' IS shown
 * - For all other events (training, meetings …)  → 'suspended' is hidden
 * - Statuses without code 'suspended' are always passed through unchanged
 */

interface MinimalStatus {
  id: number;
  code?: string;
}

interface MinimalEvent {
  game: object | null;
  type?: { name: string } | null;
}

/** Mirrors the filter from QuickRsvpWidget.tsx */
function filterStatuses(statuses: MinimalStatus[], event: MinimalEvent): MinimalStatus[] {
  return statuses.filter(
    s =>
      s.code !== 'suspended' ||
      !!event.game ||
      event.type?.name?.toLowerCase().includes('turnier'),
  );
}

const SUSPENDED: MinimalStatus = { id: 99, code: 'suspended' };
const ACCEPTED: MinimalStatus  = { id: 1,  code: 'accepted' };
const DECLINED: MinimalStatus  = { id: 2,  code: 'declined' };
const ALL_STATUSES = [ACCEPTED, DECLINED, SUSPENDED];

// ─── Game events ─────────────────────────────────────────────────────────────

describe('QuickRsvpWidget suspended filter – game events', () => {
  const gameEvent: MinimalEvent = { game: { id: 1 }, type: { name: 'Spiel' } };

  it('includes the suspended status for game events', () => {
    const result = filterStatuses(ALL_STATUSES, gameEvent);
    expect(result.some(s => s.code === 'suspended')).toBe(true);
  });

  it('keeps other statuses for game events', () => {
    const result = filterStatuses(ALL_STATUSES, gameEvent);
    expect(result.some(s => s.code === 'accepted')).toBe(true);
    expect(result.some(s => s.code === 'declined')).toBe(true);
  });

  it('returns all statuses (length 3) for a game event', () => {
    expect(filterStatuses(ALL_STATUSES, gameEvent)).toHaveLength(3);
  });
});

// ─── Tournament events ────────────────────────────────────────────────────────

describe('QuickRsvpWidget suspended filter – tournament events', () => {
  const tournamentEvent: MinimalEvent = { game: null, type: { name: 'Turnier' } };

  it('includes the suspended status when type name is "Turnier"', () => {
    const result = filterStatuses(ALL_STATUSES, tournamentEvent);
    expect(result.some(s => s.code === 'suspended')).toBe(true);
  });

  it('is case-insensitive ("turnier" lowercase also matches)', () => {
    const event: MinimalEvent = { game: null, type: { name: 'turnier-nachmittag' } };
    const result = filterStatuses(ALL_STATUSES, event);
    expect(result.some(s => s.code === 'suspended')).toBe(true);
  });

  it('returns all statuses (length 3) for a tournament event', () => {
    expect(filterStatuses(ALL_STATUSES, tournamentEvent)).toHaveLength(3);
  });
});

// ─── Non-game / non-tournament events ────────────────────────────────────────

describe('QuickRsvpWidget suspended filter – other events', () => {
  it('removes the suspended status for a training event', () => {
    const event: MinimalEvent = { game: null, type: { name: 'Training' } };
    const result = filterStatuses(ALL_STATUSES, event);
    expect(result.some(s => s.code === 'suspended')).toBe(false);
    expect(result).toHaveLength(2);
  });

  it('removes the suspended status for a club-event (Vereinsfest)', () => {
    const event: MinimalEvent = { game: null, type: { name: 'Vereinsfest' } };
    const result = filterStatuses(ALL_STATUSES, event);
    expect(result.some(s => s.code === 'suspended')).toBe(false);
  });

  it('removes the suspended status when type is null', () => {
    const event: MinimalEvent = { game: null, type: null };
    const result = filterStatuses(ALL_STATUSES, event);
    expect(result.some(s => s.code === 'suspended')).toBe(false);
  });

  it('removes the suspended status when type is undefined', () => {
    const event: MinimalEvent = { game: null };
    const result = filterStatuses(ALL_STATUSES, event);
    expect(result.some(s => s.code === 'suspended')).toBe(false);
  });

  it('keeps all other statuses when suspended is filtered out', () => {
    const event: MinimalEvent = { game: null, type: { name: 'Training' } };
    const result = filterStatuses(ALL_STATUSES, event);
    expect(result.some(s => s.code === 'accepted')).toBe(true);
    expect(result.some(s => s.code === 'declined')).toBe(true);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('QuickRsvpWidget suspended filter – edge cases', () => {
  it('passes through statuses without a code unchanged', () => {
    const noCode: MinimalStatus[] = [{ id: 5 }, { id: 6 }];
    const event: MinimalEvent = { game: null };
    expect(filterStatuses(noCode, event)).toHaveLength(2);
  });

  it('works correctly when no suspended status is in the list', () => {
    const noSuspended = [ACCEPTED, DECLINED];
    const event: MinimalEvent = { game: null, type: { name: 'Training' } };
    expect(filterStatuses(noSuspended, event)).toHaveLength(2);
  });
});

export {};
