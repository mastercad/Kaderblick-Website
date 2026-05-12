import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QuickEventEventStep } from '../QuickEventEventStep';
import type { QuickEventButton } from '../../types';
import type { GameEventType } from '../../../../types/games';

// Mock QuickEventRadialMenu to simplify interaction testing
let capturedRadialProps: any = null;
jest.mock('../QuickEventRadialMenu', () => ({
  QuickEventRadialMenu: (props: any) => {
    capturedRadialProps = props;
    if (!props.open || !props.anchorRect || props.items.length === 0) return null;
    return (
      <div data-testid="radial-menu">
        {props.items.map((item: any) => (
          <button
            key={item.eventTypeCode}
            data-testid={`radial-item-${item.eventTypeCode}`}
            onClick={() => props.onSelect(item)}
          >
            {item.label}
          </button>
        ))}
        <button data-testid="radial-close" onClick={props.onClose}>Schließen</button>
      </div>
    );
  },
}));

const buttons: QuickEventButton[] = [
  { eventTypeCode: 'goal', label: 'Tor', radialItems: [
    { eventTypeCode: 'header_goal', label: 'Kopfballtor' },
    { eventTypeCode: 'penalty_goal', label: 'Elfmeter' },
  ]},
  { eventTypeCode: 'corner', label: 'Ecke' },
];

const gameEventTypes: GameEventType[] = [];

beforeEach(() => {
  capturedRadialProps = null;
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('QuickEventEventStep', () => {
  it('renders all buttons', () => {
    render(<QuickEventEventStep buttons={buttons} gameEventTypes={gameEventTypes} onSelect={jest.fn()} />);
    expect(screen.getByText('Tor')).toBeInTheDocument();
    expect(screen.getByText('Ecke')).toBeInTheDocument();
  });

  it('calls onSelect with eventTypeCode on short press (corner, no radialItems)', () => {
    const onSelect = jest.fn();
    render(<QuickEventEventStep buttons={buttons} gameEventTypes={gameEventTypes} onSelect={onSelect} />);

    const corner = screen.getByText('Ecke').closest('[onpointerdown]') 
      ?? screen.getByText('Ecke').parentElement!;

    fireEvent.pointerDown(corner);
    // Advance less than 500ms — no long press
    act(() => { jest.advanceTimersByTime(100); });
    fireEvent.pointerUp(corner);

    expect(onSelect).toHaveBeenCalledWith('corner');
  });

  it('does not open radial menu on short press', () => {
    render(<QuickEventEventStep buttons={buttons} gameEventTypes={gameEventTypes} onSelect={jest.fn()} />);

    const torEl = screen.getByText('Tor').closest('[onpointerdown]')
      ?? screen.getByText('Tor').parentElement!;

    fireEvent.pointerDown(torEl);
    act(() => { jest.advanceTimersByTime(100); });
    fireEvent.pointerUp(torEl);

    expect(screen.queryByTestId('radial-menu')).not.toBeInTheDocument();
  });

  it('opens radial menu on long press (500ms) for button with radialItems', () => {
    render(<QuickEventEventStep buttons={buttons} gameEventTypes={gameEventTypes} onSelect={jest.fn()} />);

    const torEl = screen.getByText('Tor').closest('[onpointerdown]')
      ?? screen.getByText('Tor').parentElement!;

    fireEvent.pointerDown(torEl, {
      currentTarget: torEl,
      getBoundingClientRect: () => ({ left: 100, top: 100, width: 60, height: 60, right: 160, bottom: 160 }),
    });
    act(() => { jest.advanceTimersByTime(500); });

    expect(screen.getByTestId('radial-menu')).toBeInTheDocument();
  });

  it('calls onSelect with radial item code when radial item is clicked', () => {
    const onSelect = jest.fn();
    render(<QuickEventEventStep buttons={buttons} gameEventTypes={gameEventTypes} onSelect={onSelect} />);

    const torEl = screen.getByText('Tor').closest('[onpointerdown]')
      ?? screen.getByText('Tor').parentElement!;

    fireEvent.pointerDown(torEl);
    act(() => { jest.advanceTimersByTime(500); });

    fireEvent.click(screen.getByTestId('radial-item-header_goal'));
    expect(onSelect).toHaveBeenCalledWith('header_goal');
  });

  it('does not call onSelect with main code after long press', () => {
    const onSelect = jest.fn();
    render(<QuickEventEventStep buttons={buttons} gameEventTypes={gameEventTypes} onSelect={onSelect} />);

    const torEl = screen.getByText('Tor').closest('[onpointerdown]')
      ?? screen.getByText('Tor').parentElement!;

    fireEvent.pointerDown(torEl);
    act(() => { jest.advanceTimersByTime(500); });
    fireEvent.pointerUp(torEl);

    // Only the long press happened — onSelect should NOT be called for 'goal'
    expect(onSelect).not.toHaveBeenCalledWith('goal');
  });

  it('cancels long press when pointer leaves', () => {
    const onSelect = jest.fn();
    render(<QuickEventEventStep buttons={buttons} gameEventTypes={gameEventTypes} onSelect={onSelect} />);

    const torEl = screen.getByText('Tor').closest('[onpointerdown]')
      ?? screen.getByText('Tor').parentElement!;

    fireEvent.pointerDown(torEl);
    act(() => { jest.advanceTimersByTime(200); });
    fireEvent.pointerLeave(torEl);
    // Wait for full 500ms — radial should NOT open since leave was fired
    act(() => { jest.advanceTimersByTime(400); });

    expect(screen.queryByTestId('radial-menu')).not.toBeInTheDocument();
  });
});
