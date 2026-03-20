import React from 'react';
import {
  Box, Typography, TextField, Button, Divider,
  List, ListItem, ListItemText, IconButton, Tooltip,
  InputAdornment, Chip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import type { Player, PlayerData } from '../types';

interface SquadListProps {
  // Kader (all available players for the team)
  availablePlayers: Player[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activePlayerIds: Set<number | null | undefined>;
  onAddToField: (player: Player) => void;
  onAddToBench: (player: Player) => void;
  onAddGeneric: () => void;
  /** Called when the user starts dragging a player from the squad list */
  onSquadDragStart?: (player: Player) => void;
  /** Called when the drag ends (drop or cancel) */
  onSquadDragEnd?: () => void;

  // Startelf (players currently on the pitch)
  fieldPlayers: PlayerData[];
  onRemoveFromField: (id: number) => void;
  onSendToBench: (id: number) => void;

  // Taktische Notizen
  notes: string;
  onNotesChange: (v: string) => void;
}

/** Baut den Tooltip-Inhalt: Name + Rückennummer + Positionen. */
const buildPlayerTooltip = (
  name: string,
  number: number | string | null | undefined,
  position?: string,
  alternativePositions?: string[],
): React.ReactNode => {
  const posLine = [
    position ? 'Pos: ' + position : '',
    alternativePositions?.length ? 'Alt: ' + alternativePositions.join(', ') : '',
  ].filter(Boolean).join(' · ');
  const numStr = number != null ? ' #' + String(number) : '';
  const label = name + numStr;
  return (
    <Box component="div">
      <Box component="div" sx={{ fontWeight: 700 }}>{label}</Box>
      {posLine && (
        <Box component="div" sx={{ fontSize: '0.72rem', opacity: 0.9, mt: 0.25 }}>
          {posLine}
        </Box>
      )}
    </Box>
  );
};

/**
 * Right-hand panel of the formation editor.
 * Sections: Kader (squad list), Startelf (lineup), Taktische Notizen.
 */
const SquadList: React.FC<SquadListProps> = ({
  availablePlayers, searchQuery, onSearchChange, activePlayerIds,
  onAddToField, onAddToBench, onAddGeneric,
  onSquadDragStart, onSquadDragEnd,
  fieldPlayers, onRemoveFromField, onSendToBench,
  notes, onNotesChange,
}) => {
  const filtered = availablePlayers.filter(p =>
    (p.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(p.shirtNumber ?? '').includes(searchQuery),
  );

  return (
    <Box
      flex={1}
      minWidth={200}
      display="flex"
      flexDirection="column"
      gap={1}
      sx={{ maxHeight: { xs: 320, md: 580 }, overflowY: 'auto', pr: 0.5 }}
    >
      {/* ── Kader ─────────────────────────────────────────────────────────────── */}
      <Typography variant="subtitle2" fontWeight={700}>Kader</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mt: -0.5, lineHeight: 1.3 }}>
        Spieler auf das Feld ziehen, oder&nbsp;
        <Box component="span" fontWeight={600} color="primary.main">»Feld« / »Bank«</Box> klicken.
      </Typography>

      <TextField
        size="small"
        placeholder="Spieler suchen…"
        value={searchQuery}
        onChange={e => onSearchChange(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      <List dense disablePadding>
        {filtered.map(player => {
          const isActive = activePlayerIds.has(player.id);
          return (
            <ListItem
              key={player.id}
              disablePadding
              draggable={!isActive}
              onDragStart={isActive ? undefined : e => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/squad-player-id', String(player.id));

                // Custom drag ghost via canvas – exakt gleiche Größe wie PlayerToken (44 px).
                // Canvas muss im DOM sein, damit setDragImage funktioniert → off-screen positionieren.
                const size = 44;
                const dpr  = window.devicePixelRatio || 1;
                const canvas = document.createElement('canvas');
                canvas.width  = size * dpr;
                canvas.height = size * dpr;
                canvas.style.cssText = `width:${size}px;height:${size}px;position:fixed;top:-${size * 4}px;left:-${size * 4}px;pointer-events:none;`;
                document.body.appendChild(canvas);
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.scale(dpr, dpr);
                  const r = size / 2;
                  ctx.beginPath();
                  ctx.arc(r, r, r - 1, 0, Math.PI * 2);
                  ctx.fillStyle = '#1d4ed8';
                  ctx.fill();
                  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
                  ctx.lineWidth = 2;
                  ctx.stroke();
                  ctx.fillStyle = '#ffffff';
                  ctx.font = `800 15px sans-serif`;
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText(player.shirtNumber != null ? String(player.shirtNumber) : '?', r, r);
                }
                e.dataTransfer.setDragImage(canvas, size / 2, size / 2);
                setTimeout(() => document.body.removeChild(canvas), 0);

                onSquadDragStart?.(player);
              }}
              onDragEnd={() => onSquadDragEnd?.()}
              sx={{
                opacity: isActive ? 0.4 : 1,
                py: 0.2,
                cursor: isActive ? 'default' : 'grab',
                borderRadius: 1,
                '&:hover': isActive ? {} : { bgcolor: 'action.hover' },
                '&:active': isActive ? {} : { cursor: 'grabbing' },
              }}
            >
              <Tooltip
                title={buildPlayerTooltip(player.name, player.shirtNumber, player.position ?? undefined, player.alternativePositions)}
                placement="right"
                disableInteractive
              >
                <Box display="flex" alignItems="center" width="100%" gap={0.5}>
                <DragIndicatorIcon
                  fontSize="small"
                  sx={{ color: isActive ? 'transparent' : 'text.disabled', flexShrink: 0, fontSize: '1rem' }}
                />
                {player.position && (
                  <Chip
                    label={player.position}
                    size="small"
                    sx={{
                      height: 18, fontSize: '0.58rem', fontWeight: 700,
                      minWidth: 28, px: 0.25,
                      bgcolor: 'primary.main', color: 'white', flexShrink: 0,
                    }}
                  />
                )}
                <ListItemText
                  primary={player.name}
                  secondary={[
                    player.shirtNumber != null ? `#${player.shirtNumber}` : null,
                    player.alternativePositions?.length ? `Alt: ${player.alternativePositions.join(', ')}` : null,
                  ].filter(Boolean).join(' · ') || undefined}
                  primaryTypographyProps={{ variant: 'body2' }}
                  sx={{ flex: 1, minWidth: 0, mr: 0 }}
                />
                <Box display="flex" gap={0.5} flexShrink={0}>
                  <Button
                    size="small" variant="outlined"
                    sx={{ minWidth: 44, fontSize: '0.7rem', px: 0.75 }}
                    onClick={() => onAddToField(player)}
                    disabled={isActive}
                  >
                    Feld
                  </Button>
                  <Button
                    size="small" variant="outlined" color="secondary"
                    sx={{ minWidth: 44, fontSize: '0.7rem', px: 0.75 }}
                    onClick={() => onAddToBench(player)}
                    disabled={isActive}
                  >
                    Bank
                  </Button>
                </Box>
              </Box>
              </Tooltip>
            </ListItem>
          );
        })}
        {filtered.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ px: 1, display: 'block', py: 0.5 }}>
            {searchQuery ? 'Kein Ergebnis' : 'Wähle ein Team, um Spieler zu sehen'}
          </Typography>
        )}
      </List>

      <Button
        size="small" variant="text" startIcon={<AddIcon />}
        onClick={onAddGeneric}
        sx={{ alignSelf: 'flex-start', fontSize: '0.75rem' }}
      >
        Platzhalter hinzufügen
      </Button>

      <Divider />

      {/* ── Startelf ──────────────────────────────────────────────────────────── */}
      {fieldPlayers.length > 0 && (
        <>
          <Typography variant="subtitle2" fontWeight={700}>
            Startelf ({fieldPlayers.length})
          </Typography>
          <List dense disablePadding>
            {fieldPlayers.map(player => (
              <ListItem
                key={player.id}
                disablePadding
                sx={{ py: 0.2 }}
              >
                <Tooltip
                  title={buildPlayerTooltip(player.name, player.number, player.position, player.alternativePositions)}
                  placement="right"
                  disableInteractive
                >
                <Box display="flex" alignItems="center" width="100%" gap={1}>
                  <ListItemText
                    primary={player.name}
                    secondary={[
                      `#${player.number}`,
                      player.position ?? null,
                      player.alternativePositions?.length ? `Alt: ${player.alternativePositions.join(', ')}` : null,
                    ].filter(Boolean).join(' · ')}
                    primaryTypographyProps={{ variant: 'body2' }}
                    sx={{ flex: 1, minWidth: 0, mr: 0 }}
                  />
                  <Box display="flex" gap={0.25} flexShrink={0}>
                    <Tooltip title="Auf die Bank setzen">
                      <Button
                        size="small"
                        sx={{ minWidth: 40, fontSize: '0.65rem', px: 0.5 }}
                        onClick={() => onSendToBench(player.id)}
                      >
                        Bank
                      </Button>
                    </Tooltip>
                    <IconButton size="small" onClick={() => onRemoveFromField(player.id)} sx={{ p: 0.25 }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
                </Tooltip>
              </ListItem>
            ))}
          </List>
          <Divider />
        </>
      )}

      {/* ── Taktische Notizen ─────────────────────────────────────────────────── */}
      <Typography variant="subtitle2" fontWeight={700}>Taktische Notizen</Typography>
      <TextField
        multiline rows={4} size="small" fullWidth
        placeholder="z.B. Hoch pressen, Umschalten über rechts, Gegner hat schwache linke Seite…"
        value={notes}
        onChange={e => onNotesChange(e.target.value)}
      />
    </Box>
  );
};

export default SquadList;
