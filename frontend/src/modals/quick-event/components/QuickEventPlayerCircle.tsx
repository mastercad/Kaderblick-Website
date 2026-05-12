import React from 'react';
import { Box, Typography } from '@mui/material';
import { MatchPlanPlayer } from '../../../types/games';
import { getZoneColor, getPositionColor } from '../../formation/helpers';

interface QuickEventPlayerCircleProps {
  player: MatchPlanPlayer;
  size?: number;
  onClick: (player: MatchPlanPlayer) => void;
}

/**
 * Gefüllter Kreis mit Trikotnummer und positionsbezogener Farbe.
 * Farbe kommt aus getZoneColor (y-Koordinate) oder getPositionColor (Position-Code).
 */
export const QuickEventPlayerCircle: React.FC<QuickEventPlayerCircleProps> = ({
  player,
  size = 56,
  onClick,
}) => {
  const color =
    typeof player.y === 'number'
      ? getZoneColor(player.y)
      : getPositionColor(player.position);

  return (
    <Box
      onPointerUp={(e) => {
        // onPointerUp statt onClick verhindert, dass der synthetische Browser-Click-Event
        // (der ~100ms nach einem Touch-Tap generiert wird) den Spieler trifft, während
        // React bereits die Ansicht gewechselt hat (Synthetic-Click-Bug).
        e.stopPropagation();
        onClick(player);
      }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.6,
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'transform 0.12s',
        '&:active': { transform: 'scale(0.88)' },
        '&:hover > .circle': {
          border: '2px solid rgba(255,255,255,0.55)',
          boxShadow: `0 0 12px ${color}88`,
        },
      }}
    >
      <Box
        className="circle"
        sx={{
          width: size,
          height: size,
          borderRadius: '50%',
          bgcolor: color,
          border: '2px solid rgba(255,255,255,0.15)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: `0 2px 8px rgba(0,0,0,0.6)`,
          transition: 'border 0.12s, box-shadow 0.12s',
        }}
      >
        <Typography
          sx={{
            fontWeight: 800,
            color: '#fff',
            fontSize: size * 0.3,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}
        >
          {player.number ?? '?'}
        </Typography>
      </Box>
      {player.name && (
        <Typography
          sx={{
            fontSize: '0.6rem',
            color: 'rgba(255,255,255,0.5)',
            textAlign: 'center',
            maxWidth: size + 8,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1,
          }}
        >
          {player.name.split(' ').pop()}
        </Typography>
      )}
    </Box>
  );
};
