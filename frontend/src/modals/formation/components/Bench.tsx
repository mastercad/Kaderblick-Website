import React from 'react';
import { Box, Typography, IconButton, Tooltip, Paper, Chip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import { getPositionColor } from '../helpers';
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
      <Box component="div" sx={{ fontSize: '0.7rem', opacity: 0.65, mt: 0.5 }}>⚽ Auf Feld · Ziehen: gezielt platzieren</Box>
    </Box>
  );
};

/** Avatar-Kreis für einen Bankspieler.
 *  Registriert einen non-passive touchstart-Listener, damit e.preventDefault()
 *  Kontext-Menü und Textauswahl beim LongPress unterdrückt
 *  (React's onTouchStart ist passive und kann das nicht). */
const BenchPlayerAvatar: React.FC<{
  player: PlayerData;
  onMouseDown: (id: number, e: React.MouseEvent) => void;
  onTouchStart: (id: number, e: React.TouchEvent) => void;
}> = ({ player, onMouseDown, onTouchStart }) => {
  const avatarRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = avatarRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchstart', prevent, { passive: false });
    return () => el.removeEventListener('touchstart', prevent);
  }, []);

  return (
    <Tooltip title="Ziehen zum gezielten Platzieren" placement="left" disableInteractive>
      <Box
        ref={avatarRef}
        sx={{
          width: 32, height: 32, flexShrink: 0,
          borderRadius: '50%',
          bgcolor: getPositionColor(player.position),
          color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13,
          cursor: 'grab',
          touchAction: 'none',
          WebkitTouchCallout: 'none',
          '&:active': { cursor: 'grabbing' },
        }}
        onMouseDown={e => onMouseDown(player.id, e)}
        onTouchStart={e => onTouchStart(player.id, e)}
        onContextMenu={e => e.preventDefault()}
      >
        {player.number}
      </Box>
    </Tooltip>
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
          ⚽-Button setzt auf Feld · Avatar ziehen für gezieltes Platzieren.
        </Typography>
      </Box>
      <Chip size="small" label={`${benchPlayers.length} bereit`} />
    </Box>

    <Box display="flex" flexDirection="column" gap={0.5}>
      {benchPlayers.map(player => (
        <Tooltip key={player.id} title={buildBenchTooltip(player)} placement="top">
          <Box
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.25,
              bgcolor: 'background.default',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              px: 1.25,
              py: 0.75,
              userSelect: 'none',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            {/* Avatar – einziger Drag-Handle (touch + mouse) */}
            <BenchPlayerAvatar
              player={player}
              onMouseDown={onMouseDown}
              onTouchStart={onTouchStart}
            />

            {/* Name */}
            <Typography variant="body2" fontWeight={600} sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {player.name}
            </Typography>

            {/* Auf Feld */}
            <Tooltip title="Auf Spielfeld setzen">
              <IconButton
                size="small"
                sx={{ p: 0.5, flexShrink: 0 }}
                onClick={() => onSendToField(player.id)}
                aria-label={`${player.name} aufs Feld`}
              >
                <SportsSoccerIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>

            {/* Entfernen */}
            <IconButton
              size="small"
              sx={{ p: 0.5, flexShrink: 0 }}
              onClick={() => onRemove(player.id)}
              aria-label={`${player.name} von der Bank entfernen`}
            >
              <DeleteIcon sx={{ fontSize: 16 }} />
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
