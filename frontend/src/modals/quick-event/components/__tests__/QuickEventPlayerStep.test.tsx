import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QuickEventPlayerStep } from '../QuickEventPlayerStep';
import type { MatchPlanPlayer } from '../../../../types/games';

// Mock QuickEventPlayerCircle to avoid deep rendering
jest.mock('../QuickEventPlayerCircle', () => ({
  QuickEventPlayerCircle: ({ player, onClick }: { player: MatchPlanPlayer; onClick: (p: MatchPlanPlayer) => void }) => (
    <button
      data-testid={`player-circle-${player.id}`}
      onClick={() => onClick(player)}
    >
      {player.number}
    </button>
  ),
}));

function makePlayer(id: number): MatchPlanPlayer {
  return {
    id,
    playerId: id,
    number: id,
    name: `Spieler ${id}`,
    position: 'M',
    x: 0.5,
    y: 0.5,
  } as MatchPlanPlayer;
}

describe('QuickEventPlayerStep', () => {
  it('renders the title', () => {
    render(
      <QuickEventPlayerStep
        players={[]}
        title="Wer kommt raus?"
        onSelectPlayer={jest.fn()}
      />
    );
    expect(screen.getByText('Wer kommt raus?')).toBeInTheDocument();
  });

  it('shows "Keine Spieler verfügbar" when players is empty', () => {
    render(
      <QuickEventPlayerStep
        players={[]}
        title="Test"
        onSelectPlayer={jest.fn()}
      />
    );
    expect(screen.getByText('Keine Spieler verfügbar')).toBeInTheDocument();
  });

  it('renders a circle for each player', () => {
    const players = [makePlayer(1), makePlayer(2), makePlayer(3)];
    render(
      <QuickEventPlayerStep
        players={players}
        title="Spieler wählen"
        onSelectPlayer={jest.fn()}
      />
    );
    expect(screen.getByTestId('player-circle-1')).toBeInTheDocument();
    expect(screen.getByTestId('player-circle-2')).toBeInTheDocument();
    expect(screen.getByTestId('player-circle-3')).toBeInTheDocument();
  });

  it('calls onSelectPlayer when a player is clicked', () => {
    const onSelectPlayer = jest.fn();
    const players = [makePlayer(5)];
    render(
      <QuickEventPlayerStep
        players={players}
        title="Test"
        onSelectPlayer={onSelectPlayer}
      />
    );
    fireEvent.click(screen.getByTestId('player-circle-5'));
    expect(onSelectPlayer).toHaveBeenCalledWith(players[0]);
  });

  it('does not show skip button when onSkip is not provided', () => {
    render(
      <QuickEventPlayerStep
        players={[]}
        title="Test"
        onSelectPlayer={jest.fn()}
      />
    );
    expect(screen.queryByText('Ohne Spieler')).not.toBeInTheDocument();
  });

  it('shows skip button with default label when onSkip is provided', () => {
    render(
      <QuickEventPlayerStep
        players={[]}
        title="Test"
        onSelectPlayer={jest.fn()}
        onSkip={jest.fn()}
      />
    );
    expect(screen.getByText('Ohne Spieler')).toBeInTheDocument();
  });

  it('shows custom skipLabel when provided', () => {
    render(
      <QuickEventPlayerStep
        players={[]}
        title="Test"
        onSelectPlayer={jest.fn()}
        onSkip={jest.fn()}
        skipLabel="Abbrechen"
      />
    );
    expect(screen.getByText('Abbrechen')).toBeInTheDocument();
  });

  it('calls onSkip when skip element is clicked', () => {
    const onSkip = jest.fn();
    render(
      <QuickEventPlayerStep
        players={[]}
        title="Test"
        onSelectPlayer={jest.fn()}
        onSkip={onSkip}
        skipLabel="Abbrechen"
      />
    );
    fireEvent.click(screen.getByText('Abbrechen'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
