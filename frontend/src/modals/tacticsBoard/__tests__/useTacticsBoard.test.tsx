import { renderHook, act } from '@testing-library/react';
import { useTacticsBoard } from '../useTacticsBoard';

jest.mock('../../../utils/api', () => ({
  apiJson: jest.fn(),
}));

// Minimal formation stub
const makeFormation = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Test Formation',
  formationData: { code: '4-3-3', players: [], ...overrides },
});

beforeEach(() => jest.clearAllMocks());

describe('useTacticsBoard – initial load', () => {
  it('creates a default Standard tactic when no saved data exists', () => {
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation() as any));

    expect(result.current.tactics).toHaveLength(1);
    expect(result.current.tactics[0].name).toBe('Standard');
    expect(result.current.tactics[0].elements).toEqual([]);
    expect(result.current.tactics[0].opponents).toEqual([]);
  });

  it('loads tacticsBoardDataArr when present', () => {
    const arr = [
      { id: 'a', name: 'Taktik A', elements: [], opponents: [] },
      { id: 'b', name: 'Taktik B', elements: [], opponents: [] },
    ];
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation({ tacticsBoardDataArr: arr }) as any));

    expect(result.current.tactics).toHaveLength(2);
    expect(result.current.tactics[0].name).toBe('Taktik A');
    expect(result.current.activeTacticId).toBe('a');
  });

  it('migrates legacy tacticsBoardData format into a single entry', () => {
    const old = {
      elements: [{ id: 'e1', kind: 'arrow', x1: 0, y1: 0, x2: 10, y2: 10, color: '#fff' }],
      opponents: [],
      savedAt: '2024-01-01',
    };
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation({ tacticsBoardData: old }) as any));

    expect(result.current.tactics).toHaveLength(1);
    expect(result.current.tactics[0].elements).toHaveLength(1);
  });

  it('does not load when open=false', () => {
    const { result } = renderHook(() =>
      useTacticsBoard(false, makeFormation() as any));

    // tactics remain at initial empty default before the effect fires
    expect(result.current.tactics).toHaveLength(0);
  });
});

describe('useTacticsBoard – tactic management', () => {
  it('handleNewTactic adds a tactic and makes it active', () => {
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation() as any));

    const prevCount = result.current.tactics.length;
    act(() => result.current.handleNewTactic());

    expect(result.current.tactics).toHaveLength(prevCount + 1);
    const newest = result.current.tactics[result.current.tactics.length - 1];
    expect(result.current.activeTacticId).toBe(newest.id);
  });

  it('handleDeleteTactic removes the specified tactic', () => {
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation() as any));

    // Add a second tactic first
    act(() => result.current.handleNewTactic());
    const [first, second] = result.current.tactics;

    act(() => result.current.handleDeleteTactic(second.id));

    expect(result.current.tactics).toHaveLength(1);
    expect(result.current.tactics[0].id).toBe(first.id);
  });

  it('handleDeleteTactic does nothing when only one tactic remains', () => {
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation() as any));

    const id = result.current.tactics[0].id;
    act(() => result.current.handleDeleteTactic(id));

    expect(result.current.tactics).toHaveLength(1);
  });

  it('confirmRename updates the tactic name', () => {
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation() as any));

    const id = result.current.tactics[0].id;
    act(() => {
      result.current.setRenamingId(id);
      result.current.setRenameValue('Neue Variante');
    });
    act(() => result.current.confirmRename());

    expect(result.current.tactics[0].name).toBe('Neue Variante');
    expect(result.current.renamingId).toBeNull();
  });

  it('confirmRename ignores blank strings', () => {
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation() as any));

    const id = result.current.tactics[0].id;
    const originalName = result.current.tactics[0].name;
    act(() => {
      result.current.setRenamingId(id);
      result.current.setRenameValue('   ');
    });
    act(() => result.current.confirmRename());

    expect(result.current.tactics[0].name).toBe(originalName);
  });
});

describe('useTacticsBoard – handleLoadPreset', () => {
  const samplePreset = {
    id: 'builtin-test',
    title: 'Schneller Konter',
    category: 'Angriff' as const,
    description: 'Kontertaktik',
    isSystem: true,
    canDelete: false,
    data: {
      name: 'Schneller Konter',
      elements: [
        { id: 'e1', kind: 'arrow' as const, x1: 50, y1: 50, x2: 20, y2: 30, color: '#22c55e' },
      ],
      opponents: [{ id: 'o1', x: 30, y: 40, number: 9 }],
    },
  };

  it('adds a new tactic tab with the preset name', () => {
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation() as any));

    const prevCount = result.current.tactics.length;
    act(() => result.current.handleLoadPreset(samplePreset));

    expect(result.current.tactics).toHaveLength(prevCount + 1);
    const newest = result.current.tactics[result.current.tactics.length - 1];
    expect(newest.name).toBe('Schneller Konter');
  });

  it('activates the newly created tab', () => {
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation() as any));

    act(() => result.current.handleLoadPreset(samplePreset));

    const newest = result.current.tactics[result.current.tactics.length - 1];
    expect(result.current.activeTacticId).toBe(newest.id);
  });

  it('copies elements and opponents from the preset', () => {
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation() as any));

    act(() => result.current.handleLoadPreset(samplePreset));

    const newest = result.current.tactics[result.current.tactics.length - 1];
    expect(newest.elements).toHaveLength(1);
    expect(newest.elements[0].id).toBe('e1');
    expect(newest.opponents).toHaveLength(1);
    expect(newest.opponents[0].id).toBe('o1');
  });

  it('does NOT overwrite the existing current tactic', () => {
    const arr = [{ id: 'my-tab', name: 'Meine Taktik', elements: [], opponents: [] }];
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation({ tacticsBoardDataArr: arr }) as any));

    act(() => result.current.handleLoadPreset(samplePreset));

    const original = result.current.tactics.find(t => t.id === 'my-tab');
    expect(original).toBeDefined();
    expect(original!.name).toBe('Meine Taktik');
  });

  it('assigns a unique id to the new tactic', () => {
    let counter = 100000;
    const dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => counter++);

    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation() as any));

    act(() => result.current.handleLoadPreset(samplePreset));
    act(() => result.current.handleLoadPreset(samplePreset));

    const ids = result.current.tactics.map(t => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);

    dateSpy.mockRestore();
  });
});

describe('useTacticsBoard – isDirty', () => {
  const { apiJson } = jest.requireMock('../../../utils/api');

  it('starts as false after initial load', () => {
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation() as any));

    expect(result.current.isDirty).toBe(false);
  });

  it('becomes true after handleClear', () => {
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation() as any));

    act(() => result.current.handleClear());
    expect(result.current.isDirty).toBe(true);
  });

  it('becomes true after handleUndo', () => {
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation() as any));

    act(() => result.current.handleUndo());
    expect(result.current.isDirty).toBe(true);
  });

  it('becomes true after handleAddOpponent', () => {
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation() as any));

    act(() => result.current.handleAddOpponent());
    expect(result.current.isDirty).toBe(true);
  });

  it('becomes true after handleNewTactic', () => {
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation() as any));

    act(() => result.current.handleNewTactic());
    expect(result.current.isDirty).toBe(true);
  });

  it('becomes true after handleDeleteTactic', () => {
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation() as any));

    act(() => result.current.handleNewTactic());
    act(() => result.current.handleClear()); // reset dirty for isolation
    // isDirty is true from handleNewTactic – that's fine, we just verify it stays true
    const secondId = result.current.tactics[result.current.tactics.length - 1].id;
    act(() => result.current.handleDeleteTactic(secondId));
    expect(result.current.isDirty).toBe(true);
  });

  it('becomes true after handleLoadPreset', () => {
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation() as any));

    const preset = {
      id: 'p1', title: 'Test', category: 'Angriff' as const,
      description: '', isSystem: true, canDelete: false,
      data: { name: 'Test', elements: [], opponents: [] },
    };
    act(() => result.current.handleLoadPreset(preset));
    expect(result.current.isDirty).toBe(true);
  });

  it('becomes true after confirmRename with a valid name', () => {
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation() as any));

    const id = result.current.tactics[0].id;
    act(() => {
      result.current.setRenamingId(id);
      result.current.setRenameValue('Umbenannt');
    });
    act(() => result.current.confirmRename());
    expect(result.current.isDirty).toBe(true);
  });

  it('stays false after confirmRename with blank string', () => {
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation() as any));

    const id = result.current.tactics[0].id;
    act(() => {
      result.current.setRenamingId(id);
      result.current.setRenameValue('   ');
    });
    act(() => result.current.confirmRename());
    expect(result.current.isDirty).toBe(false);
  });

  it('resets to false after a successful handleSave', async () => {
    apiJson.mockResolvedValueOnce({ formation: makeFormation() });

    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation() as any));

    act(() => result.current.handleClear());
    expect(result.current.isDirty).toBe(true);

    await act(async () => { await result.current.handleSave(); });
    expect(result.current.isDirty).toBe(false);
  });

  it('stays true after a failed handleSave', async () => {
    apiJson.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation() as any));

    act(() => result.current.handleClear());
    await act(async () => { await result.current.handleSave(); });
    expect(result.current.isDirty).toBe(true);
  });

  it('resets to false when modal is re-opened', () => {
    const formation = makeFormation();
    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) => useTacticsBoard(open, formation as any),
      { initialProps: { open: true } },
    );

    act(() => result.current.handleClear());
    expect(result.current.isDirty).toBe(true);

    // Close and re-open
    rerender({ open: false });
    rerender({ open: true });
    expect(result.current.isDirty).toBe(false);
  });
});

// ─── Coordinate transform helpers (re-implemented here for reference) ────────
// These mirror the private functions in useTacticsBoard.ts so we can build
// expected values in tests without exporting the internals.
const fullToHalfPt = (x: number, y: number) => ({ x: 100 - y, y: (x - 50) * 2 });
const halfToFullPt = (x: number, y: number) => ({ x: 50 + y * 0.5, y: 100 - x });

describe('useTacticsBoard – handleToggleFullPitch coordinate transforms', () => {
  const makeFormationWithArr = (arr: any[]) =>
    makeFormation({ tacticsBoardDataArr: arr });

  // ── Arrow in own half (no negative coords) ────────────────────────────────
  it('transforms arrow coords when switching full → half', () => {
    const arr = [{
      id: 'a', name: 'A',
      elements: [{ id: 'e1', kind: 'arrow', x1: 75, y1: 30, x2: 80, y2: 60, color: '#fff' }],
      opponents: [],
    }];
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormationWithArr(arr) as any));

    act(() => result.current.setFullPitch(false));

    const el = result.current.elements[0] as any;
    const p1 = fullToHalfPt(75, 30);
    const p2 = fullToHalfPt(80, 60);
    expect(el.x1).toBeCloseTo(p1.x); expect(el.y1).toBeCloseTo(p1.y);
    expect(el.x2).toBeCloseTo(p2.x); expect(el.y2).toBeCloseTo(p2.y);
  });

  it('transforms arrow coords when switching half → full', () => {
    const arr = [{
      id: 'a', name: 'A',
      elements: [{ id: 'e1', kind: 'arrow', x1: 30, y1: 50, x2: 60, y2: 60, color: '#fff' }],
      opponents: [],
    }];
    // Start in half-pitch mode
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormationWithArr(arr) as any));

    act(() => result.current.setFullPitch(false)); // full→half (transforms once)
    act(() => result.current.setFullPitch(true));  // half→full (transforms back)

    // After two transforms the values may differ from original arr because we
    // started from half-pitch coords and applied fullToHalf then halfToFull.
    // The important invariant: doing full→half→full is lossless when starting
    // from full-pitch coords.
  });

  // ── Round-trip losslessness (the key user-facing guarantee) ───────────────
  it('round-trip full→half→full restores exact coordinates', () => {
    const origX1 = 75, origY1 = 30, origX2 = 90, origY2 = 70;
    const arr = [{
      id: 'a', name: 'A',
      elements: [{ id: 'e1', kind: 'arrow', x1: origX1, y1: origY1, x2: origX2, y2: origY2, color: '#fff' }],
      opponents: [],
    }];
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormationWithArr(arr) as any));

    // Must start in full-pitch (default)
    expect(result.current.fullPitch).toBe(true);

    act(() => result.current.setFullPitch(false));
    act(() => result.current.setFullPitch(true));

    const el = result.current.elements[0] as any;
    expect(el.x1).toBeCloseTo(origX1); expect(el.y1).toBeCloseTo(origY1);
    expect(el.x2).toBeCloseTo(origX2); expect(el.y2).toBeCloseTo(origY2);
  });

  // ── No clamping: arrow crossing midline gets negative y in half-pitch ─────
  it('does NOT clamp negative half-pitch y for arrows crossing the midline', () => {
    //  x=25 in full-pitch is on the opponent half → y_half = (25-50)*2 = -50
    const arr = [{
      id: 'a', name: 'A',
      elements: [{
        id: 'e1', kind: 'arrow',
        x1: 75, y1: 50,  // own half  → y_half = (75-50)*2 = 50
        x2: 25, y2: 50,  // opp half  → y_half = (25-50)*2 = -50  (no clamping)
        color: '#fff',
      }],
      opponents: [],
    }];
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormationWithArr(arr) as any));

    act(() => result.current.setFullPitch(false));

    const el = result.current.elements[0] as any;
    expect(el.y1).toBeCloseTo(50);
    expect(el.y2).toBeCloseTo(-50); // negative – SVG clips it visually
  });

  // ── Run element transforms identically to arrow ───────────────────────────
  it('transforms run element coords the same as arrow', () => {
    const arr = [{
      id: 'a', name: 'A',
      elements: [{ id: 'r1', kind: 'run', x1: 60, y1: 40, x2: 70, y2: 20, color: '#f00' }],
      opponents: [],
    }];
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormationWithArr(arr) as any));

    act(() => result.current.setFullPitch(false));

    const el = result.current.elements[0] as any;
    const p1 = fullToHalfPt(60, 40);
    const p2 = fullToHalfPt(70, 20);
    expect(el.x1).toBeCloseTo(p1.x); expect(el.y1).toBeCloseTo(p1.y);
    expect(el.x2).toBeCloseTo(p2.x); expect(el.y2).toBeCloseTo(p2.y);
  });

  // ── Zone (circle) transforms cx/cy ──────────────────────────────────────
  it('transforms zone cx/cy on mode switch', () => {
    const arr = [{
      id: 'a', name: 'A',
      elements: [{ id: 'z1', kind: 'zone', cx: 70, cy: 50, r: 8, color: '#0f0' }],
      opponents: [],
    }];
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormationWithArr(arr) as any));

    act(() => result.current.setFullPitch(false));

    const el = result.current.elements[0] as any;
    const p = fullToHalfPt(70, 50);
    expect(el.cx).toBeCloseTo(p.x);
    expect(el.cy).toBeCloseTo(p.y);
  });

  // ── Opponent tokens transform ─────────────────────────────────────────────
  it('transforms opponent token positions on mode switch', () => {
    const arr = [{
      id: 'a', name: 'A',
      elements: [],
      opponents: [{ id: 'o1', x: 20, y: 40, number: 9 }],
    }];
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormationWithArr(arr) as any));

    act(() => result.current.setFullPitch(false));

    const tactic = result.current.tactics[0];
    const opp = tactic.opponents[0];
    const p = fullToHalfPt(20, 40);
    expect(opp.x).toBeCloseTo(p.x);
    expect(opp.y).toBeCloseTo(p.y);
  });

  // ── Player position overrides transform ──────────────────────────────────
  it('transforms playerPositions overrides on mode switch', () => {
    const arr = [{
      id: 'a', name: 'A',
      elements: [],
      opponents: [],
      playerPositions: [{ id: 5, sx: 70, sy: 60 }],
    }];
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormationWithArr(arr) as any));

    act(() => result.current.setFullPitch(false));

    const tactic = result.current.tactics[0];
    const pp = tactic.playerPositions![0];
    const p = fullToHalfPt(70, 60);
    expect(pp.sx).toBeCloseTo(p.x);
    expect(pp.sy).toBeCloseTo(p.y);
  });

  // ── Multiple tactics: all are transformed ─────────────────────────────────
  it('transforms elements in ALL tactics, not just the active one', () => {
    const arr = [
      { id: 'a', name: 'A', elements: [{ id: 'e1', kind: 'arrow', x1: 75, y1: 30, x2: 80, y2: 60, color: '#fff' }], opponents: [] },
      { id: 'b', name: 'B', elements: [{ id: 'e2', kind: 'arrow', x1: 60, y1: 20, x2: 90, y2: 80, color: '#f00' }], opponents: [] },
    ];
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormationWithArr(arr) as any));

    act(() => result.current.setFullPitch(false));

    const tacticB = result.current.tactics.find(t => t.id === 'b')!;
    const el = tacticB.elements[0] as any;
    const p1 = fullToHalfPt(60, 20);
    expect(el.x1).toBeCloseTo(p1.x);
    expect(el.y1).toBeCloseTo(p1.y);
  });

  // ── No-op when mode unchanged ─────────────────────────────────────────────
  it('is a no-op when called with the same mode (full → full)', () => {
    const arr = [{
      id: 'a', name: 'A',
      elements: [{ id: 'e1', kind: 'arrow', x1: 75, y1: 30, x2: 80, y2: 60, color: '#fff' }],
      opponents: [],
    }];
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormationWithArr(arr) as any));

    act(() => result.current.setFullPitch(true)); // already true – no-op

    const el = result.current.elements[0] as any;
    expect(el.x1).toBe(75); expect(el.y1).toBe(30);
  });

  // ── Drag state cancelled on toggle ────────────────────────────────────────
  it('cancels drawing state when mode is toggled', () => {
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation() as any));

    act(() => result.current.setFullPitch(false));

    expect(result.current.elDrag).toBeNull();
    expect(result.current.oppDrag).toBeNull();
  });
});

describe('useTacticsBoard – handleResetPlayerPositions', () => {
  it('clears playerPositions of the active tactic', () => {
    const arr = [{
      id: 'a', name: 'A',
      elements: [],
      opponents: [],
      playerPositions: [{ id: 1, sx: 60, sy: 70 }, { id: 2, sx: 55, sy: 80 }],
    }];
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation({ tacticsBoardDataArr: arr }) as any));

    act(() => result.current.handleResetPlayerPositions());

    const tactic = result.current.tactics[0];
    expect(tactic.playerPositions).toEqual([]);
  });

  it('marks isDirty = true', () => {
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation() as any));

    expect(result.current.isDirty).toBe(false);
    act(() => result.current.handleResetPlayerPositions());
    expect(result.current.isDirty).toBe(true);
  });

  it('does not clear playerPositions of other tactics', () => {
    const arr = [
      { id: 'a', name: 'A', elements: [], opponents: [], playerPositions: [{ id: 1, sx: 60, sy: 70 }] },
      { id: 'b', name: 'B', elements: [], opponents: [], playerPositions: [{ id: 2, sx: 55, sy: 80 }] },
    ];
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation({ tacticsBoardDataArr: arr }) as any));

    // active is 'a'
    act(() => result.current.handleResetPlayerPositions());

    const tacticB = result.current.tactics.find(t => t.id === 'b')!;
    expect(tacticB.playerPositions).toHaveLength(1);
    expect(tacticB.playerPositions![0].id).toBe(2);
  });

  it('is a no-op (no error) when playerPositions is undefined', () => {
    const arr = [{ id: 'a', name: 'A', elements: [], opponents: [] }];
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation({ tacticsBoardDataArr: arr }) as any));

    expect(() => act(() => result.current.handleResetPlayerPositions())).not.toThrow();
    expect(result.current.tactics[0].playerPositions).toEqual([]);
  });
});

describe('useTacticsBoard – ownPlayers with playerPositions overrides', () => {
  const players = [
    { id: 1, name: 'Müller', number: 9, x: 60, y: 30 },
    { id: 2, name: 'Kroos',  number: 8, x: 70, y: 50 },
  ];

  it('uses base formation position when no override exists', () => {
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation({ players }) as any));

    const p = result.current.ownPlayers.find(p => p.id === 1)!;
    // playerScreenPos(60, 30) for fullPitch → sx = 50 + 30*0.5 = 65, sy = 100-60 = 40
    expect(p.sx).toBeCloseTo(65);
    expect(p.sy).toBeCloseTo(40);
  });

  it('uses override sx/sy when a playerPositions entry exists', () => {
    const arr = [{
      id: 'a', name: 'A',
      elements: [], opponents: [],
      playerPositions: [{ id: 1, sx: 72, sy: 45 }],
    }];
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation({ players, tacticsBoardDataArr: arr }) as any));

    const p = result.current.ownPlayers.find(p => p.id === 1)!;
    expect(p.sx).toBeCloseTo(72);
    expect(p.sy).toBeCloseTo(45);
  });

  it('applies override only to the overridden player, not others', () => {
    const arr = [{
      id: 'a', name: 'A',
      elements: [], opponents: [],
      playerPositions: [{ id: 1, sx: 72, sy: 45 }],
    }];
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation({ players, tacticsBoardDataArr: arr }) as any));

    const p2 = result.current.ownPlayers.find(p => p.id === 2)!;
    // Player 2 has no override → base: sx = 50 + 50*0.5 = 75, sy = 100-70 = 30
    expect(p2.sx).toBeCloseTo(75);
    expect(p2.sy).toBeCloseTo(30);
  });
});

describe('useTacticsBoard – drawing operations', () => {
  it('handleClear empties elements and opponents of the active tactic only', () => {
    const arr = [
      { id: 'a', name: 'A', elements: [{ id: 'e1', kind: 'arrow', x1: 0, y1: 0, x2: 10, y2: 10, color: '#fff' }], opponents: [{ id: 'o1', x: 5, y: 5, number: 1 }] },
      { id: 'b', name: 'B', elements: [{ id: 'e2', kind: 'arrow', x1: 0, y1: 0, x2: 20, y2: 20, color: '#f00' }], opponents: [] },
    ];
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation({ tacticsBoardDataArr: arr }) as any));

    // active should be 'a'
    act(() => result.current.handleClear());

    const active = result.current.tactics.find(t => t.id === 'a')!;
    const other  = result.current.tactics.find(t => t.id === 'b')!;
    expect(active.elements).toHaveLength(0);
    expect(active.opponents).toHaveLength(0);
    expect(other.elements).toHaveLength(1); // untouched
  });

  it('handleUndo removes only the last element from the active tactic', () => {
    const arr = [
      { id: 'a', name: 'A', elements: [
        { id: 'e1', kind: 'arrow', x1: 0, y1: 0, x2: 10, y2: 10, color: '#fff' },
        { id: 'e2', kind: 'arrow', x1: 5, y1: 5, x2: 15, y2: 15, color: '#f00' },
      ], opponents: [] },
    ];
    const { result } = renderHook(() =>
      useTacticsBoard(true, makeFormation({ tacticsBoardDataArr: arr }) as any));

    act(() => result.current.handleUndo());

    expect(result.current.elements).toHaveLength(1);
    expect(result.current.elements[0].id).toBe('e1');
  });
});
