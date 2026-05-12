import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QuickEventPlayerCircle } from '../QuickEventPlayerCircle';
import type { MatchPlanPlayer } from '../../../../types/games';

// Mock formation helpers — we don't want to test color logic here
jest.mock('../../../formation/helpers', () => ({
  getZoneColor: () => '#4ade80',
  getPositionColor: () => '#60a5fa',
}));

function makePlayer(overrides: Partial<MatchPlanPlayer> = {}): MatchPlanPlayer {
  return {
    id: 1,
    playerId: 1,
    firstName: 'Max',
    lastName: 'Mustermann',
    name: 'Max Mustermann',
    number: 10,
    position: 'M',
    x: 0.5,
    y: 0.3,
    shirtNumber: 10,
    ...overrides,
  } as MatchPlanPlayer;
}

describe('QuickEventPlayerCircle', () => {
  it('renders player number', () => {
    render(<QuickEventPlayerCircle player={makePlayer({ number: 7 })} onClick={jest.fn()} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('renders "?" when player has no number', () => {
    render(
      <QuickEventPlayerCircle player={makePlayer({ number: undefined as any })} onClick={jest.fn()} />
    );
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('calls onClick with the player on pointerUp', () => {
    const onClick = jest.fn();
    const player = makePlayer();
    render(<QuickEventPlayerCircle player={player} onClick={onClick} />);
    // The outer Box is the target of pointerUp
    const circles = document.querySelectorAll('[style]');
    // fire pointerUp on the first box element
    fireEvent.pointerUp(screen.getByText(String(player.number ?? '?')).closest('div')!.parentElement!);
    expect(onClick).toHaveBeenCalledWith(player);
  });

  it('does not call onClick if not interacted with', () => {
    const onClick = jest.fn();
    render(<QuickEventPlayerCircle player={makePlayer()} onClick={jest.fn()} />);
    expect(onClick).not.toHaveBeenCalled();
  });
});
