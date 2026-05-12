import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QuickEventSubFlow } from '../QuickEventSubFlow';
import type { MatchPlanPlayer } from '../../../../types/games';

// Mock QuickEventPlayerCircle used inside QuickEventPlayerStep
jest.mock('../QuickEventPlayerCircle', () => ({
  QuickEventPlayerCircle: ({ player, onClick }: { player: MatchPlanPlayer; onClick: (p: MatchPlanPlayer) => void }) => (
    <button
      data-testid={`player-${player.id}`}
      onClick={() => onClick(player)}
    >
      {player.name}
    </button>
  ),
}));

function makePlayer(id: number, name: string): MatchPlanPlayer {
  return {
    id,
    playerId: id,
    name,
    number: id,
    position: 'M',
    x: 0.5,
    y: 0.5,
  } as MatchPlanPlayer;
}

const onField = [makePlayer(1, 'Müller'), makePlayer(2, 'Schmidt')];
const bench = [makePlayer(11, 'Wolf'), makePlayer(12, 'Bauer')];

describe('QuickEventSubFlow', () => {
  describe('Step 1: playerOut is null', () => {
    it('shows "Wer kommt raus?" title', () => {
      render(
        <QuickEventSubFlow
          onField={onField}
          bench={bench}
          playerOut={null}
          onSelectPlayerOut={jest.fn()}
          onComplete={jest.fn()}
          onCancel={jest.fn()}
        />
      );
      expect(screen.getByText('Wer kommt raus?')).toBeInTheDocument();
    });

    it('shows onField players', () => {
      render(
        <QuickEventSubFlow
          onField={onField}
          bench={bench}
          playerOut={null}
          onSelectPlayerOut={jest.fn()}
          onComplete={jest.fn()}
          onCancel={jest.fn()}
        />
      );
      expect(screen.getByTestId('player-1')).toBeInTheDocument();
      expect(screen.getByTestId('player-2')).toBeInTheDocument();
    });

    it('calls onSelectPlayerOut when a player is clicked', () => {
      const onSelectPlayerOut = jest.fn();
      render(
        <QuickEventSubFlow
          onField={onField}
          bench={bench}
          playerOut={null}
          onSelectPlayerOut={onSelectPlayerOut}
          onComplete={jest.fn()}
          onCancel={jest.fn()}
        />
      );
      fireEvent.click(screen.getByTestId('player-1'));
      expect(onSelectPlayerOut).toHaveBeenCalledWith(onField[0]);
    });

    it('calls onCancel when "Abbrechen" is clicked', () => {
      const onCancel = jest.fn();
      render(
        <QuickEventSubFlow
          onField={onField}
          bench={bench}
          playerOut={null}
          onSelectPlayerOut={jest.fn()}
          onComplete={jest.fn()}
          onCancel={onCancel}
        />
      );
      fireEvent.click(screen.getByText('Abbrechen'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Step 2: playerOut is set', () => {
    const playerOut = makePlayer(1, 'Müller');

    it('shows "Wer kommt rein?" title', () => {
      render(
        <QuickEventSubFlow
          onField={onField}
          bench={bench}
          playerOut={playerOut}
          onSelectPlayerOut={jest.fn()}
          onComplete={jest.fn()}
          onCancel={jest.fn()}
        />
      );
      expect(screen.getByText('Wer kommt rein?')).toBeInTheDocument();
    });

    it('shows bench players', () => {
      render(
        <QuickEventSubFlow
          onField={onField}
          bench={bench}
          playerOut={playerOut}
          onSelectPlayerOut={jest.fn()}
          onComplete={jest.fn()}
          onCancel={jest.fn()}
        />
      );
      expect(screen.getByTestId('player-11')).toBeInTheDocument();
      expect(screen.getByTestId('player-12')).toBeInTheDocument();
    });

    it('calls onComplete with playerOut.playerId and playerIn.playerId', () => {
      const onComplete = jest.fn();
      render(
        <QuickEventSubFlow
          onField={onField}
          bench={bench}
          playerOut={playerOut}
          onSelectPlayerOut={jest.fn()}
          onComplete={onComplete}
          onCancel={jest.fn()}
        />
      );
      fireEvent.click(screen.getByTestId('player-11'));
      expect(onComplete).toHaveBeenCalledWith(1, 11); // playerOut.playerId=1, playerIn.playerId=11
    });

    it('calls onCancel when "Abbrechen" is clicked in step 2', () => {
      const onCancel = jest.fn();
      render(
        <QuickEventSubFlow
          onField={onField}
          bench={bench}
          playerOut={playerOut}
          onSelectPlayerOut={jest.fn()}
          onComplete={jest.fn()}
          onCancel={onCancel}
        />
      );
      fireEvent.click(screen.getByText('Abbrechen'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });
});
