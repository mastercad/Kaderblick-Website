/**
 * Tests für useUndoRedo
 *
 * Prüft push, undo, redo, reset und canUndo/canRedo Flags.
 */
import { act, renderHook } from '@testing-library/react';
import { useUndoRedo } from '../useUndoRedo';
import type { PlayerData } from '../types';

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

const p = (id: number, x = 50, y = 50): PlayerData => ({
  id, x, y, number: id, name: `Spieler ${id}`, playerId: id, isRealPlayer: true,
});

function setup() {
  return renderHook(() => useUndoRedo());
}

// ─── Initialer State ──────────────────────────────────────────────────────────

describe('useUndoRedo – initialer State', () => {
  it('canUndo ist initial false', () => {
    const { result } = setup();
    expect(result.current.canUndo).toBe(false);
  });

  it('canRedo ist initial false', () => {
    const { result } = setup();
    expect(result.current.canRedo).toBe(false);
  });
});

// ─── push ─────────────────────────────────────────────────────────────────────

describe('push', () => {
  it('setzt canUndo auf true nach erstem push', () => {
    const { result } = setup();
    act(() => { result.current.push([p(1)], []); });
    expect(result.current.canUndo).toBe(true);
  });

  it('löscht die Redo-History beim push', () => {
    const { result } = setup();
    const setPlayers = jest.fn();
    const setBench = jest.fn();

    // push → undo (erzeugt Redo) → push (löscht Redo)
    act(() => { result.current.push([p(1)], []); });
    act(() => { result.current.undo([p(1)], [], setPlayers, setBench); });
    expect(result.current.canRedo).toBe(true);

    act(() => { result.current.push([p(2)], []); });
    expect(result.current.canRedo).toBe(false);
  });

  it('begrenzt History auf 50 Einträge', () => {
    const { result } = setup();
    const setPlayers = jest.fn();
    const setBench = jest.fn();

    // 55 pushes
    for (let i = 0; i < 55; i++) {
      act(() => { result.current.push([p(i)], []); });
    }

    // canUndo sollte noch true sein
    expect(result.current.canUndo).toBe(true);

    // 50 mal undo – danach muss canUndo false sein
    for (let i = 0; i < 50; i++) {
      act(() => { result.current.undo([p(99)], [], setPlayers, setBench); });
    }
    expect(result.current.canUndo).toBe(false);
  });
});

// ─── undo ─────────────────────────────────────────────────────────────────────

describe('undo', () => {
  it('tut nichts wenn History leer ist', () => {
    const { result } = setup();
    const setPlayers = jest.fn();
    const setBench = jest.fn();

    act(() => { result.current.undo([p(1)], [], setPlayers, setBench); });

    expect(setPlayers).not.toHaveBeenCalled();
    expect(setBench).not.toHaveBeenCalled();
  });

  it('stellt den vorherigen Zustand wieder her', () => {
    const { result } = setup();
    const setPlayers = jest.fn();
    const setBench = jest.fn();

    const before = [p(1, 10, 10)];
    act(() => { result.current.push(before, []); });

    // aktueller State ist jetzt p(2)
    act(() => { result.current.undo([p(2, 20, 20)], [], setPlayers, setBench); });

    expect(setPlayers).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 1, x: 10, y: 10 })])
    );
    expect(setBench).toHaveBeenCalledWith([]);
  });

  it('setzt canRedo auf true nach undo', () => {
    const { result } = setup();
    const setPlayers = jest.fn();
    const setBench = jest.fn();

    act(() => { result.current.push([p(1)], []); });
    act(() => { result.current.undo([p(1)], [], setPlayers, setBench); });

    expect(result.current.canRedo).toBe(true);
  });

  it('setzt canUndo auf false wenn History nach undo leer ist', () => {
    const { result } = setup();
    const setPlayers = jest.fn();
    const setBench = jest.fn();

    act(() => { result.current.push([p(1)], []); });
    act(() => { result.current.undo([p(1)], [], setPlayers, setBench); });

    expect(result.current.canUndo).toBe(false);
  });

  it('canUndo bleibt true wenn noch weitere Einträge in der History sind', () => {
    const { result } = setup();
    const setPlayers = jest.fn();
    const setBench = jest.fn();

    act(() => { result.current.push([p(1)], []); });
    act(() => { result.current.push([p(2)], []); });
    act(() => { result.current.undo([p(2)], [], setPlayers, setBench); });

    expect(result.current.canUndo).toBe(true);
  });

  it('klont die Spieler-Arrays (kein shared reference)', () => {
    const { result } = setup();
    const setPlayers = jest.fn();
    const setBench = jest.fn();

    const original = [p(1)];
    act(() => { result.current.push(original, []); });

    act(() => { result.current.undo([p(2)], [], setPlayers, setBench); });

    const restored = setPlayers.mock.calls[0][0] as PlayerData[];
    // Sollte nicht dasselbe Array-Objekt sein
    expect(restored).not.toBe(original);
    expect(restored[0]).not.toBe(original[0]);
  });

  it('klont alternativePositions korrekt', () => {
    const { result } = setup();
    const setPlayers = jest.fn();
    const setBench = jest.fn();

    const playerWithPositions: PlayerData = {
      ...p(1), alternativePositions: ['ST', 'LW'],
    };
    act(() => { result.current.push([playerWithPositions], []); });
    act(() => { result.current.undo([p(2)], [], setPlayers, setBench); });

    const restored = setPlayers.mock.calls[0][0] as PlayerData[];
    expect(restored[0].alternativePositions).toEqual(['ST', 'LW']);
    expect(restored[0].alternativePositions).not.toBe(playerWithPositions.alternativePositions);
  });
});

// ─── redo ─────────────────────────────────────────────────────────────────────

describe('redo', () => {
  it('tut nichts wenn Future leer ist', () => {
    const { result } = setup();
    const setPlayers = jest.fn();
    const setBench = jest.fn();

    act(() => { result.current.redo([p(1)], [], setPlayers, setBench); });

    expect(setPlayers).not.toHaveBeenCalled();
    expect(setBench).not.toHaveBeenCalled();
  });

  it('stellt den Zustand nach undo wieder her', () => {
    const { result } = setup();
    const setPlayers = jest.fn();
    const setBench = jest.fn();

    const stateA = [p(1, 10, 10)];
    const stateB = [p(2, 20, 20)];

    act(() => { result.current.push(stateA, []); });
    // Zuerst undo (von stateB → stateA)
    act(() => { result.current.undo(stateB, [], setPlayers, setBench); });
    setPlayers.mockClear();
    setBench.mockClear();

    // Dann redo (zurück zu stateB)
    act(() => { result.current.redo(stateA, [], setPlayers, setBench); });

    expect(setPlayers).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 2, x: 20, y: 20 })])
    );
  });

  it('setzt canUndo auf true nach redo', () => {
    const { result } = setup();
    const setPlayers = jest.fn();
    const setBench = jest.fn();

    act(() => { result.current.push([p(1)], []); });
    act(() => { result.current.undo([p(1)], [], setPlayers, setBench); });
    act(() => { result.current.redo([p(0)], [], setPlayers, setBench); });

    expect(result.current.canUndo).toBe(true);
  });

  it('setzt canRedo auf false wenn Future nach redo leer ist', () => {
    const { result } = setup();
    const setPlayers = jest.fn();
    const setBench = jest.fn();

    act(() => { result.current.push([p(1)], []); });
    act(() => { result.current.undo([p(1)], [], setPlayers, setBench); });
    act(() => { result.current.redo([p(0)], [], setPlayers, setBench); });

    expect(result.current.canRedo).toBe(false);
  });

  it('canRedo bleibt true wenn noch weitere Einträge in der Future sind', () => {
    const { result } = setup();
    const setPlayers = jest.fn();
    const setBench = jest.fn();

    act(() => { result.current.push([p(1)], []); });
    act(() => { result.current.push([p(2)], []); });
    act(() => { result.current.undo([p(2)], [], setPlayers, setBench); });
    act(() => { result.current.undo([p(1)], [], setPlayers, setBench); });

    // Erste redo
    act(() => { result.current.redo([p(0)], [], setPlayers, setBench); });

    expect(result.current.canRedo).toBe(true);
  });
});

// ─── reset ───────────────────────────────────────────────────────────────────

describe('reset', () => {
  it('setzt canUndo und canRedo auf false', () => {
    const { result } = setup();
    const setPlayers = jest.fn();
    const setBench = jest.fn();

    act(() => { result.current.push([p(1)], []); });
    act(() => { result.current.push([p(2)], []); });
    act(() => { result.current.undo([p(2)], [], setPlayers, setBench); });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);

    act(() => { result.current.reset(); });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('undo tut nichts mehr nach reset', () => {
    const { result } = setup();
    const setPlayers = jest.fn();
    const setBench = jest.fn();

    act(() => { result.current.push([p(1)], []); });
    act(() => { result.current.reset(); });
    act(() => { result.current.undo([p(1)], [], setPlayers, setBench); });

    expect(setPlayers).not.toHaveBeenCalled();
  });

  it('redo tut nichts mehr nach reset', () => {
    const { result } = setup();
    const setPlayers = jest.fn();
    const setBench = jest.fn();

    act(() => { result.current.push([p(1)], []); });
    act(() => { result.current.undo([p(1)], [], setPlayers, setBench); });
    act(() => { result.current.reset(); });
    setPlayers.mockClear();
    act(() => { result.current.redo([p(0)], [], setPlayers, setBench); });

    expect(setPlayers).not.toHaveBeenCalled();
  });
});
