import { renderHook } from '@testing-library/react';
import { useActiveSquad } from '../useActiveSquad';
import type { Game, MatchPlanPlayer } from '../../../types/games';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makePlayer(id: number, extra: Partial<MatchPlanPlayer> = {}): MatchPlanPlayer {
  return {
    id,
    playerId: id,
    firstName: 'Vorname',
    lastName: `Spieler${id}`,
    shirtNumber: id,
    position: 'M',
    x: 0.5,
    y: 0.5,
    ...extra,
  } as MatchPlanPlayer;
}

function makeGame(phases: any[]): Game {
  return {
    id: 1,
    matchPlan: { phases },
  } as unknown as Game;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useActiveSquad', () => {
  describe('null / missing game', () => {
    it('returns empty arrays and hasMatchPlan=false when game is null', () => {
      const { result } = renderHook(() => useActiveSquad(null));
      expect(result.current.onField).toEqual([]);
      expect(result.current.bench).toEqual([]);
      expect(result.current.hasMatchPlan).toBe(false);
    });

    it('returns hasMatchPlan=false when game has no matchPlan', () => {
      const game = { id: 1 } as unknown as Game;
      const { result } = renderHook(() => useActiveSquad(game));
      expect(result.current.hasMatchPlan).toBe(false);
    });

    it('returns hasMatchPlan=false when phases array is empty', () => {
      const { result } = renderHook(() => useActiveSquad(makeGame([])));
      expect(result.current.hasMatchPlan).toBe(false);
    });

    it('returns hasMatchPlan=false when no start phase exists', () => {
      const game = makeGame([
        { id: 'sub1', sourceType: 'substitution', substitution: { playerOutId: 1, playerInId: 2 }, players: [] },
      ]);
      const { result } = renderHook(() => useActiveSquad(game));
      expect(result.current.hasMatchPlan).toBe(false);
      expect(result.current.onField).toEqual([]);
      expect(result.current.bench).toEqual([]);
    });
  });

  describe('start phase only', () => {
    it('returns start players as onField', () => {
      const p1 = makePlayer(1);
      const p2 = makePlayer(2);
      const game = makeGame([
        { id: 'start', sourceType: 'start', players: [p1, p2], bench: [] },
      ]);
      const { result } = renderHook(() => useActiveSquad(game));
      expect(result.current.hasMatchPlan).toBe(true);
      expect(result.current.onField).toHaveLength(2);
      expect(result.current.onField).toContainEqual(p1);
      expect(result.current.onField).toContainEqual(p2);
    });

    it('returns bench players from start phase', () => {
      const p1 = makePlayer(1);
      const b1 = makePlayer(10);
      const game = makeGame([
        { id: 'start', sourceType: 'start', players: [p1], bench: [b1] },
      ]);
      const { result } = renderHook(() => useActiveSquad(game));
      expect(result.current.bench).toContainEqual(b1);
    });

    it('returns empty bench when start phase has no bench', () => {
      const p1 = makePlayer(1);
      const game = makeGame([
        { id: 'start', sourceType: 'start', players: [p1] },
      ]);
      const { result } = renderHook(() => useActiveSquad(game));
      expect(result.current.bench).toEqual([]);
    });
  });

  describe('substitution phases', () => {
    it('moves playerOut to bench and playerIn to onField', () => {
      const p1 = makePlayer(1);
      const bench1 = makePlayer(11);
      const game = makeGame([
        { id: 'start', sourceType: 'start', players: [p1], bench: [bench1] },
        {
          id: 'sub1',
          sourceType: 'substitution',
          substitution: { playerOutId: 1, playerInId: 11 },
          players: [],
        },
      ]);
      const { result } = renderHook(() => useActiveSquad(game));
      // p1 should no longer be onField
      expect(result.current.onField.map((p) => p.playerId)).not.toContain(1);
      // bench1 should now be onField
      expect(result.current.onField.map((p) => p.playerId)).toContain(11);
      // p1 should now be on bench
      expect(result.current.bench.map((p) => p.playerId)).toContain(1);
      // bench1 should no longer be on bench
      expect(result.current.bench.map((p) => p.playerId)).not.toContain(11);
    });

    it('ignores substitution when playerOutId is null', () => {
      const p1 = makePlayer(1);
      const bench1 = makePlayer(11);
      const game = makeGame([
        { id: 'start', sourceType: 'start', players: [p1], bench: [bench1] },
        {
          id: 'sub1',
          sourceType: 'substitution',
          substitution: { playerOutId: null, playerInId: 11 },
          players: [],
        },
      ]);
      const { result } = renderHook(() => useActiveSquad(game));
      // No change expected
      expect(result.current.onField.map((p) => p.playerId)).toContain(1);
      expect(result.current.bench.map((p) => p.playerId)).toContain(11);
    });

    it('ignores substitution when playerInId is null', () => {
      const p1 = makePlayer(1);
      const bench1 = makePlayer(11);
      const game = makeGame([
        { id: 'start', sourceType: 'start', players: [p1], bench: [bench1] },
        {
          id: 'sub1',
          sourceType: 'substitution',
          substitution: { playerOutId: 1, playerInId: null },
          players: [],
        },
      ]);
      const { result } = renderHook(() => useActiveSquad(game));
      expect(result.current.onField.map((p) => p.playerId)).toContain(1);
    });

    it('ignores phase without substitution data', () => {
      const p1 = makePlayer(1);
      const game = makeGame([
        { id: 'start', sourceType: 'start', players: [p1], bench: [] },
        { id: 'sub1', sourceType: 'substitution', players: [] }, // no substitution key
      ]);
      const { result } = renderHook(() => useActiveSquad(game));
      expect(result.current.onField.map((p) => p.playerId)).toContain(1);
    });

    it('applies multiple substitutions in order', () => {
      const p1 = makePlayer(1);
      const p2 = makePlayer(2);
      const bench1 = makePlayer(11);
      const bench2 = makePlayer(12);
      const game = makeGame([
        { id: 'start', sourceType: 'start', players: [p1, p2], bench: [bench1, bench2] },
        {
          id: 'sub1',
          sourceType: 'substitution',
          substitution: { playerOutId: 1, playerInId: 11 },
          players: [],
        },
        {
          id: 'sub2',
          sourceType: 'substitution',
          substitution: { playerOutId: 2, playerInId: 12 },
          players: [],
        },
      ]);
      const { result } = renderHook(() => useActiveSquad(game));
      const onFieldIds = result.current.onField.map((p) => p.playerId);
      expect(onFieldIds).toContain(11);
      expect(onFieldIds).toContain(12);
      expect(onFieldIds).not.toContain(1);
      expect(onFieldIds).not.toContain(2);
    });
  });
});
