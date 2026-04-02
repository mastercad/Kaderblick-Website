/**
 * Tests für useFieldDrag
 *
 * Prüft Pointer/Touch-Drag für Feld-Tokens und Verschiebung Bank→Feld.
 */
import { renderHook, act } from '@testing-library/react';
import { useRef, useState } from 'react';
import { useFieldDrag } from '../useFieldDrag';
import type { PlayerData } from '../types';

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

const fieldPlayer = (id: number, x = 50, y = 50): PlayerData => ({
  id, x, y, number: id, name: `Spieler ${id}`, playerId: id, isRealPlayer: true,
});

/**
 * Mock-Element: getBoundingClientRect gibt immer { left:0, top:0, width:100, height:100 }
 * zurück → getRelativePosition(clientX, clientY) = { x: clientX, y: clientY }
 */
const mockPitchEl = {
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
} as unknown as HTMLDivElement;

const setup = (initialPlayers: PlayerData[], initialBench: PlayerData[] = []) => {
  return renderHook(() => {
    const [players,    setPlayers]    = useState<PlayerData[]>(initialPlayers);
    const [bench,      setBench]      = useState<PlayerData[]>(initialBench);
    const pitchRef  = useRef<HTMLDivElement>(mockPitchEl);
    // Empty tokenRefs map – finalizeDrop falls back to dragPosRef (correct fallback path)
    const tokenRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    const drag = useFieldDrag({ players, setPlayers, benchPlayers: bench, setBenchPlayers: setBench, pitchRef, tokenRefs });
    return { players, bench, ...drag };
  });
};

const mouseEvent = (clientX: number, clientY: number) =>
  ({ clientX, clientY, stopPropagation: jest.fn(), preventDefault: jest.fn() } as unknown as React.MouseEvent);

const touchEvent = (clientX: number, clientY: number) =>
  ({
    touches: [{ clientX, clientY }],
    stopPropagation: jest.fn(),
    preventDefault: jest.fn(),
  } as unknown as React.TouchEvent);

// ─── Initialer State ──────────────────────────────────────────────────────────

describe('useFieldDrag – initialer State', () => {
  it('draggedPlayerId startet als null', () => {
    const { result } = setup([]);
    expect(result.current.draggedPlayerId).toBeNull();
  });
});

// ─── startDragFromField ───────────────────────────────────────────────────────

describe('startDragFromField', () => {
  it('setzt draggedPlayerId auf die gegebene ID', () => {
    const { result } = setup([fieldPlayer(1)]);
    act(() => { result.current.startDragFromField(1, mouseEvent(10, 10)); });
    expect(result.current.draggedPlayerId).toBe(1);
  });

  it('behält die Ursprungskoordinaten wenn vor dem ersten Move bereits losgelassen wird', () => {
    const { result } = setup([fieldPlayer(1, 32, 44)]);

    act(() => { result.current.startDragFromField(1, mouseEvent(10, 10)); });
    act(() => { result.current.handlePitchMouseUp(); });

    const player = result.current.players.find(p => p.id === 1);
    expect(player?.x).toBeCloseTo(32, 0);
    expect(player?.y).toBeCloseTo(44, 0);
  });
});

// ─── handlePitchMouseMove ─────────────────────────────────────────────────────

describe('handlePitchMouseMove', () => {
  it('bewegt den gezogenen Feldspieler auf die neue Position', () => {
    // Position wird erst beim finalizeDrop (mouseUp) in den State geschrieben;
    // während des Drags wird nur der DOM via rAF aktualisiert.
    const { result } = setup([fieldPlayer(1, 10, 10)]);

    act(() => { result.current.startDragFromField(1, mouseEvent(10, 10)); });
    act(() => { result.current.handlePitchMouseMove(mouseEvent(40, 60)); });
    act(() => { result.current.handlePitchMouseUp(); }); // committet dragPosRef → State

    const moved = result.current.players.find(p => p.id === 1);
    expect(moved?.x).toBeCloseTo(40, 0);
    expect(moved?.y).toBeCloseTo(60, 0);
  });

  it('behält den Greifpunkt relativ zum Token bei', () => {
    const { result } = setup([fieldPlayer(1, 10, 20)]);

    act(() => { result.current.startDragFromField(1, mouseEvent(14, 27)); });
    act(() => { result.current.handlePitchMouseMove(mouseEvent(40, 55)); });
    act(() => { result.current.handlePitchMouseUp(); });

    const moved = result.current.players.find(p => p.id === 1);
    expect(moved?.x).toBeCloseTo(36, 0);
    expect(moved?.y).toBeCloseTo(48, 0);
  });

  it('tut nichts wenn kein Spieler gezogen wird', () => {
    const { result } = setup([fieldPlayer(1, 10, 10)]);
    act(() => { result.current.handlePitchMouseMove(mouseEvent(80, 80)); });
    expect(result.current.players[0].x).toBe(10); // unverändert
  });

});

// ─── handlePitchMouseUp / finalizeDrop ───────────────────────────────────────

describe('handlePitchMouseUp', () => {
  it('beendet den Drag (draggedPlayerId → null)', () => {
    const { result } = setup([fieldPlayer(1)]);
    act(() => { result.current.startDragFromField(1, mouseEvent(0, 0)); });
    act(() => { result.current.handlePitchMouseUp(); });
    expect(result.current.draggedPlayerId).toBeNull();
  });

  it('(kein Swap) Spieler bleibt an abgelegter Position wenn kein anderer in der Nähe', () => {
    // Player 1 bei (10,20), Player 2 bei (60,70)
    // Player 1 wird auf (30,30) gezogen – weit weg von Player 2 → kein Swap
    const { result } = setup([fieldPlayer(1, 10, 20), fieldPlayer(2, 60, 70)]);

    act(() => { result.current.startDragFromField(1, mouseEvent(10, 20)); });
    act(() => { result.current.handlePitchMouseMove(mouseEvent(30, 30)); });
    act(() => { result.current.handlePitchMouseUp(); });

    const p1 = result.current.players.find(p => p.id === 1);
    const p2 = result.current.players.find(p => p.id === 2);
    expect(p1?.x).toBeCloseTo(30, 0);
    expect(p1?.y).toBeCloseTo(30, 0);
    expect(p2?.x).toBeCloseTo(60, 0);
    expect(p2?.y).toBeCloseTo(70, 0);
  });

  it('tauscht zwei Feld-Tokens wenn der gezogene auf dem anderen abgelegt wird', () => {
    // Player 1 startet bei (10,20), Player 2 bei (60,70)
    // Player 1 wird auf (62,68) gezogen, Abstand zu Player 2 ≈ 2.8 < 9 → Swap
    const { result } = setup([fieldPlayer(1, 10, 20), fieldPlayer(2, 60, 70)]);

    act(() => { result.current.startDragFromField(1, mouseEvent(10, 20)); });
    act(() => { result.current.handlePitchMouseMove(mouseEvent(62, 68)); });
    act(() => { result.current.handlePitchMouseUp(); });

    const p1 = result.current.players.find(p => p.id === 1);
    const p2 = result.current.players.find(p => p.id === 2);
    // Player 1 → an Player-2-Startpos
    expect(p1?.x).toBeCloseTo(60, 0);
    expect(p1?.y).toBeCloseTo(70, 0);
    // Player 2 → an Player-1-Startpos
    expect(p2?.x).toBeCloseTo(10, 0);
    expect(p2?.y).toBeCloseTo(20, 0);
  });

  it('tauscht via Touch-Drag ebenfalls', () => {
    const { result } = setup([fieldPlayer(1, 10, 20), fieldPlayer(2, 60, 70)]);

    act(() => { result.current.startDragFromField(1, touchEvent(10, 20)); });
    act(() => { result.current.handlePitchTouchMove(touchEvent(61, 71)); });
    act(() => { result.current.handlePitchTouchEnd(); });

    const p1 = result.current.players.find(p => p.id === 1);
    const p2 = result.current.players.find(p => p.id === 2);
    expect(p1?.x).toBeCloseTo(60, 0);
    expect(p1?.y).toBeCloseTo(70, 0);
    expect(p2?.x).toBeCloseTo(10, 0);
    expect(p2?.y).toBeCloseTo(20, 0);
  });

  it('findet bei mehreren Tokens den nächstgelegenen Swap-Partner', () => {
    // Player 1 bei (10,10), Player 2 bei (80,80), Player 3 bei (13,10)
    // → Player 1 wird in Richtung Player 3 gezogen, nicht zu Player 2
    const { result } = setup([
      fieldPlayer(1, 10, 10),
      fieldPlayer(2, 80, 80),
      fieldPlayer(3, 13, 10),
    ]);

    act(() => { result.current.startDragFromField(1, mouseEvent(10, 10)); });
    act(() => { result.current.handlePitchMouseMove(mouseEvent(13, 10)); });
    act(() => { result.current.handlePitchMouseUp(); });

    const p1 = result.current.players.find(p => p.id === 1);
    const p2 = result.current.players.find(p => p.id === 2);
    const p3 = result.current.players.find(p => p.id === 3);
    // Swap mit Player 3 (nächster)
    expect(p1?.x).toBeCloseTo(13, 0);
    expect(p3?.x).toBeCloseTo(10, 0);
    // Player 2 unberührt
    expect(p2?.x).toBeCloseTo(80, 0);
  });
});

// ─── handlePitchTouchMove ─────────────────────────────────────────────────────

describe('handlePitchTouchMove', () => {
  it('bewegt den Spieler via Touch-Event (Position nach touchEnd)', () => {
    // Wie bei mousemove: State-Update erfolgt erst in finalizeDrop (touchEnd)
    const { result } = setup([fieldPlayer(1, 10, 10)]);
    act(() => { result.current.startDragFromField(1, mouseEvent(10, 10)); });
    act(() => { result.current.handlePitchTouchMove(touchEvent(70, 20)); });
    act(() => { result.current.handlePitchTouchEnd(); }); // committet dragPosRef → State

    const moved = result.current.players.find(p => p.id === 1);
    expect(moved?.x).toBeCloseTo(70, 0);
    expect(moved?.y).toBeCloseTo(20, 0);
  });

  it('verfolgt den Drag auch über globale Window-Events zuverlässig', () => {
    const { result } = setup([fieldPlayer(1, 10, 10)]);

    act(() => { result.current.startDragFromField(1, mouseEvent(10, 10)); });
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 64, clientY: 28 }));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    const moved = result.current.players.find(p => p.id === 1);
    expect(moved?.x).toBeCloseTo(64, 0);
    expect(moved?.y).toBeCloseTo(28, 0);
    expect(result.current.draggedPlayerId).toBeNull();
  });
});

// ─── startDragFromBench ───────────────────────────────────────────────────────

describe('startDragFromBench', () => {
  it('verschiebt Bank-Spieler beim Loslassen aufs Feld', () => {
    const benchPlayer: PlayerData = { id: 5, x: 0, y: 0, number: 7, name: 'Müller', playerId: 7, isRealPlayer: true };
    const { result } = setup([], [benchPlayer]);

    act(() => { result.current.startDragFromBench(5, mouseEvent(0, 0)); });
    act(() => { result.current.handlePitchMouseMove(mouseEvent(30, 30)); });

    // Spieler ist jetzt auf dem Feld
    expect(result.current.players.some(p => p.id === 5)).toBe(true);
    expect(result.current.bench.some(p => p.id === 5)).toBe(false);
    expect(result.current.players.find(p => p.id === 5)?.x).toBeCloseTo(30, 0);
  });
});

// ─── handlePitchTouchEnd ──────────────────────────────────────────────────────

describe('handlePitchTouchEnd', () => {
  it('beendet den Touch-Drag', () => {
    const { result } = setup([fieldPlayer(1)]);
    act(() => { result.current.startDragFromField(1, mouseEvent(0, 0)); });
    act(() => { result.current.handlePitchTouchEnd(); });
    expect(result.current.draggedPlayerId).toBeNull();
  });
});
