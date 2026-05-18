/**
 * Tests for the event-eligibility predicate used in QuickRsvpWidget to decide
 * which events are shown in the dashboard RSVP reminder.
 *
 * The predicate (mirrored from QuickRsvpWidget.tsx):
 *   e => !e.cancelled && e.permissions?.canParticipate
 *        && (!e.game || e.permissions?.isSelfMember)
 *
 * Key rules:
 * - Non-game events (training, meetings, …): shown when canParticipate=true
 * - Game events: shown ONLY when canParticipate=true AND isSelfMember=true
 *   → Parents can RSVP via the calendar but do NOT see the dashboard reminder.
 *   → Players / coaches (self_player / self_coach) see both.
 * - Cancelled events: never shown.
 */

type MinimalEvent = {
  cancelled: boolean;
  game: object | null;
  permissions: { canParticipate: boolean; isSelfMember?: boolean };
};

/** Mirrors the filter from QuickRsvpWidget.tsx */
const isEligibleForDashboard = (e: MinimalEvent): boolean =>
  !e.cancelled &&
  !!e.permissions?.canParticipate &&
  (!e.game || !!e.permissions?.isSelfMember);

// ─── Non-game events (training, meetings, …) ─────────────────────────────────

describe('QuickRsvpWidget dashboard eligibility – non-game events', () => {
  it('includes a training event when canParticipate is true', () => {
    expect(
      isEligibleForDashboard({ cancelled: false, game: null, permissions: { canParticipate: true } }),
    ).toBe(true);
  });

  it('excludes a training event when canParticipate is false', () => {
    expect(
      isEligibleForDashboard({ cancelled: false, game: null, permissions: { canParticipate: false } }),
    ).toBe(false);
  });

  it('excludes a cancelled training event even when canParticipate is true', () => {
    expect(
      isEligibleForDashboard({ cancelled: true, game: null, permissions: { canParticipate: true } }),
    ).toBe(false);
  });

  it('includes a non-game event when isSelfMember is also true (no effect for non-games)', () => {
    expect(
      isEligibleForDashboard({
        cancelled: false,
        game: null,
        permissions: { canParticipate: true, isSelfMember: true },
      }),
    ).toBe(true);
  });
});

// ─── Game events ──────────────────────────────────────────────────────────────

describe('QuickRsvpWidget dashboard eligibility – game events', () => {
  const game = { id: 1 };

  it('includes a game when canParticipate=true AND isSelfMember=true (player / coach)', () => {
    expect(
      isEligibleForDashboard({
        cancelled: false,
        game,
        permissions: { canParticipate: true, isSelfMember: true },
      }),
    ).toBe(true);
  });

  it('excludes a game when canParticipate=true but isSelfMember=false (parent can RSVP but no reminder)', () => {
    // This is the core regression test for the bug fix:
    // Parents now receive canParticipate=true so they can RSVP via the calendar,
    // but isSelfMember=false means they must NOT see the dashboard reminder.
    expect(
      isEligibleForDashboard({
        cancelled: false,
        game,
        permissions: { canParticipate: true, isSelfMember: false },
      }),
    ).toBe(false);
  });

  it('excludes a game when canParticipate=true but isSelfMember is undefined (backward compat)', () => {
    expect(
      isEligibleForDashboard({
        cancelled: false,
        game,
        permissions: { canParticipate: true },
      }),
    ).toBe(false);
  });

  it('excludes a game when canParticipate=false regardless of isSelfMember', () => {
    expect(
      isEligibleForDashboard({
        cancelled: false,
        game,
        permissions: { canParticipate: false, isSelfMember: true },
      }),
    ).toBe(false);
  });

  it('excludes a cancelled game even when canParticipate=true and isSelfMember=true', () => {
    expect(
      isEligibleForDashboard({
        cancelled: true,
        game,
        permissions: { canParticipate: true, isSelfMember: true },
      }),
    ).toBe(false);
  });

  it('excludes a game when both canParticipate=false and isSelfMember=false', () => {
    expect(
      isEligibleForDashboard({
        cancelled: false,
        game,
        permissions: { canParticipate: false, isSelfMember: false },
      }),
    ).toBe(false);
  });
});

// ─── Mixed list filtering ─────────────────────────────────────────────────────

describe('QuickRsvpWidget dashboard eligibility – mixed event list', () => {
  it('correctly filters a realistic list of mixed events', () => {
    const game = { id: 99 };

    const events: MinimalEvent[] = [
      // Training, canParticipate → visible
      { cancelled: false, game: null, permissions: { canParticipate: true } },
      // Training, no permission → hidden
      { cancelled: false, game: null, permissions: { canParticipate: false } },
      // Game, self_player → visible
      { cancelled: false, game, permissions: { canParticipate: true, isSelfMember: true } },
      // Game, parent (isSelfMember=false) → hidden (parent uses calendar, not reminder)
      { cancelled: false, game, permissions: { canParticipate: true, isSelfMember: false } },
      // Game, cancelled → hidden
      { cancelled: true, game, permissions: { canParticipate: true, isSelfMember: true } },
    ];

    const visible = events.filter(isEligibleForDashboard);

    expect(visible).toHaveLength(2);
    // First visible: the training event
    expect(visible[0].game).toBeNull();
    // Second visible: the game event with isSelfMember=true
    expect(visible[1].game).toEqual(game);
    expect(visible[1].permissions.isSelfMember).toBe(true);
  });
});

export {};
