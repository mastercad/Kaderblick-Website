import React from 'react';
import { Box, Typography, IconButton, Tooltip, Paper, Chip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { getPositionColor, truncateName } from '../helpers';
import type { PlayerData } from '../types';

interface BenchProps {
  benchPlayers: PlayerData[];
  onSendToField: (id: number) => void;
  onRemove: (id: number) => void;
  onMouseDown: (id: number, e: React.MouseEvent) => void;
  onTouchStart: (id: number, e: React.TouchEvent) => void;
}

/** Rich tooltip für Bank-Chips: Name, Rückennummer, Positionen. */
const buildBenchTooltip = (player: PlayerData): React.ReactNode => {
  const posLine = [
    player.position ? 'Pos: ' + player.position : '',
    player.alternativePositions?.length ? 'Alt: ' + player.alternativePositions.join(', ') : '',
  ].filter(Boolean).join(' · ');

  return (
    <Box component="div">
      <Box component="div" sx={{ fontWeight: 700 }}>{player.name + ' #' + String(player.number)}</Box>
      {posLine && (
        <Box component="div" sx={{ fontSize: '0.72rem', opacity: 0.9, mt: 0.25 }}>{posLine}</Box>
      )}
      <Box component="div" sx={{ fontSize: '0.7rem', opacity: 0.65, mt: 0.5 }}>Klicken → aufs Feld</Box>
    </Box>
  );
};

/**
 * Ersatzbank: shows substitute players as compact chips.
 * Clicking a chip moves the player back onto the pitch.
 * Drag also supported to pull directly onto the pitch.
 */
const Bench: React.FC<BenchProps> = ({
  benchPlayers,
  onSendToField,
  onRemove,
  onMouseDown,
  onTouchStart,
}) => (
  <Paper
    variant="outlined"
    sx={{
      mt: 1,
      p: { xs: 1.25, sm: 1.5 },
      borderRadius: 3,
      minHeight: 88,
      borderStyle: 'dashed',
    }}
  >
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
        gap: 0.75,
        mb: 1,
      }}
    >
      <Box>
        <Typography variant="subtitle2" fontWeight={800}>
          Ersatzbank
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Antippen setzt einen Spieler zurück aufs Feld, Ziehen erlaubt gezieltes Platzieren.
        </Typography>
      </Box>
      <Chip size="small" label={`${benchPlayers.length} bereit`} />
    </Box>

    <Box display="flex" flexWrap="wrap" gap={0.75}>
      {benchPlayers.map(player => (
        <Tooltip key={player.id} title={buildBenchTooltip(player)} placement="top">
          <Box
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              bgcolor: 'background.default',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              px: 1,
              py: 0.75,
              cursor: 'grab',
              touchAction: 'none',
              userSelect: 'none',
              minHeight: 42,
              '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
            }}
            onClick={() => onSendToField(player.id)}
            onMouseDown={e => onMouseDown(player.id, e)}
            onTouchStart={e => onTouchStart(player.id, e)}
          >
            {/* Mini shirt number */}
            <Box sx={{
              width: 28, height: 28,
              borderRadius: '50%',
              bgcolor: getPositionColor(player.position),
              color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 12, flexShrink: 0,
            }}>
              {player.number}
            </Box>

            <Typography variant="caption" fontWeight={600} sx={{
              maxWidth: { xs: 92, sm: 72 }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {truncateName(player.name, 10)}
            </Typography>

            <IconButton
              size="small"
              sx={{ p: 0.25 }}
              onClick={e => { e.stopPropagation(); onRemove(player.id); }}
              aria-label={`${player.name} von der Bank entfernen`}
            >
              <DeleteIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        </Tooltip>
      ))}

      {benchPlayers.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
          Noch keine Bankspieler. Schicke Spieler per Drag oder über den Bank-Button hierhin.
        </Typography>
      )}
    </Box>
  </Paper>
);

export default Bench;
