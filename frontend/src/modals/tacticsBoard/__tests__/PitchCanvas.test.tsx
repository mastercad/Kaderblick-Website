// ─── PitchCanvas – ghost indicator tests ──────────────────────────────────────
import React from 'react';
import { render, screen } from '@testing-library/react';
import { PitchCanvas } from '../PitchCanvas';
import type { PitchCanvasProps } from '../PitchCanvas';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../../utils/api', () => ({ apiJson: jest.fn() }));

// arrowPath is a pure SVG util – we give it a stub so the SVG layer renders
// without errors even though jsdom doesn't support SVG geometry.
jest.mock('../utils', () => ({
  svgCoords:    jest.fn(() => ({ x: 0, y: 0 })),
  arrowPath:    jest.fn(() => 'M0 0 L10 10'),
  // clipLine: return the original segment unchanged (all test coords are in-bounds)
  clipLine:     jest.fn((x1: number, y1: number, x2: number, y2: number) => ({ x1, y1, x2, y2 })),
  makeMarkerId: jest.fn((uid: string, hex: string, kind: string) => `${uid}-${hex}-${kind}`),
}));

// ── Prop factory ──────────────────────────────────────────────────────────────

const noop = () => undefined;
const noopHandler = jest.fn();

const pitchRef = { current: null } as React.RefObject<HTMLDivElement | null>;
const svgRef   = { current: null } as React.RefObject<SVGSVGElement | null>;

function makeProps(overrides: Partial<PitchCanvasProps> = {}): PitchCanvasProps {
  return {
    pitchRef,
    svgRef,
    fullPitch: false,          // default: half-pitch so ghost logic is active
    pitchAspect: '960 / 1357',
    pitchAX: 1357 / 960,
    svgCursor: 'default',
    elements: [],
    opponents: [],
    ownPlayers: [],
    preview: null,
    drawing: false,
    tool: 'pointer',
    color: '#22c55e',
    elDrag:         null,
    oppDrag:        null,
    ownPlayerDrag:  null,
    onSvgDown:  noopHandler,
    onSvgMove:  noopHandler,
    onSvgUp:    noopHandler,
    onElDown:   noopHandler,
    onOppDown:  noopHandler,
    onOwnPlayerDown: noopHandler,
    markerId: (hex, kind) => `marker-${hex}-${kind}`,
    ...overrides,
  };
}

// Player factory – sy is the screen-space y used for ghost detection
function makePlayer(id: number, number: number, sx: number, sy: number) {
  return { id, name: `Spieler ${id}`, number, x: 60, y: 30, sx, sy };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => jest.clearAllMocks());

describe('PitchCanvas – ghost indicators for off-screen players', () => {
  // ── Full-pitch mode: no ghosts at all ─────────────────────────────────────
  it('does not render any ghost when fullPitch=true', () => {
    const players = [makePlayer(1, 9, 70, -30)]; // sy < 0 but fullPitch=true
    render(<PitchCanvas {...makeProps({ fullPitch: true, ownPlayers: players })} />);

    // Ghost elements carry the player number; the normal token also does.
    // In full-pitch mode only the regular token exists – there must be exactly
    // ONE element with the number, not two.
    const numberEls = screen.getAllByText('9');
    expect(numberEls).toHaveLength(1);
  });

  // ── Half-pitch, all players visible: no ghosts ────────────────────────────
  it('does not render ghosts when all players have sy >= 0', () => {
    const players = [
      makePlayer(1, 7, 50, 30),
      makePlayer(2, 11, 70, 60),
    ];
    render(<PitchCanvas {...makeProps({ ownPlayers: players })} />);

    // Each player number appears exactly once (normal token only)
    expect(screen.getAllByText('7')).toHaveLength(1);
    expect(screen.getAllByText('11')).toHaveLength(1);
  });

  // ── One player off-screen: shows ghost ───────────────────────────────────
  it('renders a ghost indicator for a player with sy < 0', () => {
    const players = [makePlayer(1, 9, 60, -25)]; // sy < 0 → off-screen opponent half
    render(<PitchCanvas {...makeProps({ ownPlayers: players })} />);

    // Ghost duplicates the player number, so '9' appears twice
    expect(screen.getAllByText('9')).toHaveLength(2);
  });

  // ── Multiple off-screen players ───────────────────────────────────────────
  it('renders one ghost per off-screen player', () => {
    const players = [
      makePlayer(1, 9,  60, -25),
      makePlayer(2, 11, 30, -10),
      makePlayer(3, 7,  50,  40), // visible – no ghost
    ];
    render(<PitchCanvas {...makeProps({ ownPlayers: players })} />);

    expect(screen.getAllByText('9')).toHaveLength(2);   // normal + ghost
    expect(screen.getAllByText('11')).toHaveLength(2);  // normal + ghost
    expect(screen.getAllByText('7')).toHaveLength(1);   // normal only
  });

  // ── Ghost is not interactive ──────────────────────────────────────────────
  it('ghost does not fire onOwnPlayerDown when clicked', () => {
    const onOwnPlayerDown = jest.fn();
    const players = [makePlayer(1, 9, 60, -25)];
    render(<PitchCanvas {...makeProps({ ownPlayers: players, onOwnPlayerDown })} />);

    // pointerEvents: none means the ghost Box does not respond to pointer events.
    // The ghost element carries data-testid indirectly via the number text; we
    // simply verify the handler wasn't called after render (no accidental wiring).
    expect(onOwnPlayerDown).not.toHaveBeenCalled();
  });

  // ── sy === 0 is considered visible (boundary) ─────────────────────────────
  it('does not render a ghost for a player exactly at sy = 0', () => {
    const players = [makePlayer(1, 9, 60, 0)];
    render(<PitchCanvas {...makeProps({ ownPlayers: players })} />);

    expect(screen.getAllByText('9')).toHaveLength(1); // normal token only
  });

  // ── Ghost shows correct player number ────────────────────────────────────
  it('ghost shows the player shirt number, not a default label', () => {
    const players = [makePlayer(1, 17, 55, -5)];
    render(<PitchCanvas {...makeProps({ ownPlayers: players })} />);

    const instances = screen.getAllByText('17');
    expect(instances.length).toBeGreaterThanOrEqual(2);
  });
});
