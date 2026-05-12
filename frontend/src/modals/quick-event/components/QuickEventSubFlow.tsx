import React from 'react';
import { MatchPlanPlayer } from '../../../types/games';
import { QuickEventPlayerStep } from './QuickEventPlayerStep';

interface QuickEventSubFlowProps {
  onField: MatchPlanPlayer[];
  bench: MatchPlanPlayer[];
  /** Wer geht raus — wird im Panel-Header angezeigt (lifted state). */
  playerOut: MatchPlanPlayer | null;
  onSelectPlayerOut: (player: MatchPlanPlayer) => void;
  onComplete: (playerOutId: number, playerInId: number) => void;
  onCancel: () => void;
}

/**
 * Zwei-Schritt-Ablauf für Auswechslungen:
 *  1. Wer kommt raus? (aus onField wählen)
 *  2. Wer kommt rein? (aus bench wählen)
 * Der "playerOut"-State lebt im übergeordneten Panel (lifted state),
 * damit er beim Scrollen immer im Header sichtbar bleibt und zuverlässig
 * zurückgesetzt wird.
 */
export const QuickEventSubFlow: React.FC<QuickEventSubFlowProps> = ({
  onField,
  bench,
  playerOut,
  onSelectPlayerOut,
  onComplete,
  onCancel,
}) => {
  if (!playerOut) {
    return (
      <QuickEventPlayerStep
        players={onField}
        title="Wer kommt raus?"
        onSelectPlayer={onSelectPlayerOut}
        onSkip={onCancel}
        skipLabel="Abbrechen"
      />
    );
  }

  const handlePlayerIn = (playerIn: MatchPlanPlayer) => {
    const outId = playerOut.playerId ?? playerOut.id;
    const inId = playerIn.playerId ?? playerIn.id;
    onComplete(outId, inId);
  };

  return (
    <QuickEventPlayerStep
      players={bench}
      title="Wer kommt rein?"
      onSelectPlayer={handlePlayerIn}
      onSkip={onCancel}
      skipLabel="Abbrechen"
    />
  );
};
