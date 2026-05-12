import React from 'react';
import { Box, Typography } from '@mui/material';
import { MatchPlanPlayer } from '../../../types/games';
import { QuickEventPlayerCircle } from './QuickEventPlayerCircle';

interface QuickEventPlayerStepProps {
  players: MatchPlanPlayer[];
  title: string;
  onSelectPlayer: (player: MatchPlanPlayer) => void;
  onSkip?: () => void;
  skipLabel?: string;
}

/**
 * Zeigt ein Grid aus Spielerkreisen.
 * Wird für „Spieler wählen" (normales Event) und für Wechsel-Teilschritte genutzt.
 */
export const QuickEventPlayerStep: React.FC<QuickEventPlayerStepProps> = ({
  players,
  title,
  onSelectPlayer,
  onSkip,
  skipLabel = 'Ohne Spieler',
}) => {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: '1.05rem',
          fontWeight: 800,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#fff',
          mb: 2.5,
          lineHeight: 1.2,
        }}
      >
        {title}
      </Typography>

      {players.length === 0 ? (
        <Typography
          sx={{
            textAlign: 'center',
            py: 4,
            fontSize: '0.82rem',
            color: 'rgba(255,255,255,0.2)',
            letterSpacing: '0.05em',
          }}
        >
          Keine Spieler verfügbar
        </Typography>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            justifyContent: 'center',
            mb: 2,
          }}
        >
          {players.map((p) => (
            <QuickEventPlayerCircle key={p.id} player={p} onClick={onSelectPlayer} />
          ))}
        </Box>
      )}

      {onSkip && (
        <Box
          onClick={onSkip}
          sx={{
            mt: 2,
            textAlign: 'center',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.22)',
            fontSize: '0.72rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            py: 0.5,
            transition: 'color 0.15s',
            '&:hover': { color: 'rgba(255,255,255,0.5)' },
          }}
        >
          {skipLabel}
        </Box>
      )}
    </Box>
  );
};
