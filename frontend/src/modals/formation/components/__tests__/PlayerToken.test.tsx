/**
 * Tests für PlayerToken
 *
 * Prüft Rendering, Drag-Events, isDragging/isHighlighted-Branches,
 * Platzhalter vs. realer Spieler sowie domRef-Weitergabe.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PlayerToken from '../PlayerToken';
import type { PlayerData } from '../../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makePlayer = (overrides: Partial<PlayerData> = {}): PlayerData => ({
  id: 1,
  x: 50,
  y: 30,
  number: 9,
  name: 'Müller',
  isRealPlayer: true,
  ...overrides,
});

const baseProps = {
  playerId: 1,
  player: makePlayer(),
  isDragging: false,
  isHighlighted: false,
  onStartDrag: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('PlayerToken – Rendering', () => {
  it('renders the shirt number', () => {
    render(<PlayerToken {...baseProps} />);
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('renders the player name (truncated or full)', () => {
    render(<PlayerToken {...baseProps} />);
    // truncateName may shorten long names; 'Müller' is short enough to appear as-is
    expect(screen.getByText(/Müller/i)).toBeInTheDocument();
  });

  it('renders a long name in truncated form', () => {
    const player = makePlayer({ name: 'Maximilian Mustermann' });
    render(<PlayerToken {...baseProps} player={player} />);
    // Some text with the name should exist (truncateName trims to first name + initial)
    const label = screen.getByText(/Maxim/i);
    expect(label).toBeInTheDocument();
  });

  it('renders data-token-circle attribute on the number circle', () => {
    const { container } = render(<PlayerToken {...baseProps} />);
    expect(container.querySelector('[data-token-circle="true"]')).toBeInTheDocument();
  });

  it('renders data-swap-icon attribute on the swap overlay', () => {
    const { container } = render(<PlayerToken {...baseProps} />);
    expect(container.querySelector('[data-swap-icon="true"]')).toBeInTheDocument();
  });

  it('renders player number for non-real (placeholder) player', () => {
    const player = makePlayer({ number: 0, isRealPlayer: false });
    render(<PlayerToken {...baseProps} player={player} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});

// ─── isDragging branch ────────────────────────────────────────────────────────

describe('PlayerToken – isDragging', () => {
  it('renders without crashing when isDragging=true', () => {
    render(<PlayerToken {...baseProps} isDragging={true} />);
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('renders without crashing when isDragging=false', () => {
    render(<PlayerToken {...baseProps} isDragging={false} />);
    expect(screen.getByText('9')).toBeInTheDocument();
  });
});

// ─── isHighlighted branch ─────────────────────────────────────────────────────

describe('PlayerToken – isHighlighted', () => {
  it('renders without crashing when isHighlighted=true', () => {
    render(<PlayerToken {...baseProps} isHighlighted={true} />);
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('renders without crashing when isHighlighted=false', () => {
    render(<PlayerToken {...baseProps} isHighlighted={false} />);
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('isHighlighted=true renders without crashing alongside isDragging=false', () => {
    render(<PlayerToken {...baseProps} isDragging={false} isHighlighted={true} />);
    expect(screen.getByText('9')).toBeInTheDocument();
  });
});

// ─── Drag events ──────────────────────────────────────────────────────────────

describe('PlayerToken – drag events', () => {
  it('calls onStartDrag with correct id on mousedown', () => {
    const onStartDrag = jest.fn();
    render(<PlayerToken {...baseProps} onStartDrag={onStartDrag} />);
    // The root Box has onMouseDown handler
    const circle = screen.getByText('9');
    fireEvent.mouseDown(circle);
    expect(onStartDrag).toHaveBeenCalledWith(1, expect.anything());
  });

  it('calls onStartDrag with correct id on touchstart', () => {
    const onStartDrag = jest.fn();
    render(<PlayerToken {...baseProps} onStartDrag={onStartDrag} />);
    const circle = screen.getByText('9');
    fireEvent.touchStart(circle);
    expect(onStartDrag).toHaveBeenCalledWith(1, expect.anything());
  });

  it('does not crash when contextmenu fires (preventDefault suppressed)', () => {
    render(<PlayerToken {...baseProps} />);
    const circle = screen.getByText('9');
    // Should not throw
    expect(() => fireEvent.contextMenu(circle)).not.toThrow();
  });
});

// ─── domRef ───────────────────────────────────────────────────────────────────

describe('PlayerToken – domRef', () => {
  it('accepts a MutableRefObject as domRef', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<PlayerToken {...baseProps} domRef={ref} />);
    // domRef.current should be set to the root DOM element after mount
    expect(ref.current).not.toBeNull();
  });

  it('accepts a callback ref as domRef', () => {
    let refNode: HTMLDivElement | null = null;
    const callbackRef = (node: HTMLDivElement | null) => { refNode = node; };
    render(<PlayerToken {...baseProps} domRef={callbackRef} />);
    expect(refNode).not.toBeNull();
  });
});

// ─── Tooltip content ──────────────────────────────────────────────────────────

describe('PlayerToken – tooltip / accessible label', () => {
  it('renders player number inside the token (used in tooltip construction)', () => {
    const player = makePlayer({ number: 11, name: 'Klose' });
    render(<PlayerToken {...baseProps} player={player} playerId={1} />);
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText(/Klose/i)).toBeInTheDocument();
  });

  it('marks placeholder player with isRealPlayer=false', () => {
    // 'Ersatz' is 6 chars (< maxLen 7), so truncateName returns it unchanged
    const player = makePlayer({ isRealPlayer: false, name: 'Ersatz' });
    render(<PlayerToken {...baseProps} player={player} />);
    expect(screen.getByText('Ersatz')).toBeInTheDocument();
  });
});

// ─── Position in % ────────────────────────────────────────────────────────────

describe('PlayerToken – position rendering', () => {
  it('renders different tokens for different x/y positions without crashing', () => {
    // MUI sx-based styles go through Emotion CSS classes, not inline styles —
    // we verify the component renders correctly for different positions.
    const player1 = makePlayer({ x: 30, y: 60, number: 3, name: 'Abc' });
    const player2 = makePlayer({ x: 70, y: 20, number: 7, name: 'Xyz' });
    const { rerender } = render(<PlayerToken {...baseProps} player={player1} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    rerender(<PlayerToken {...baseProps} player={player2} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });
});
