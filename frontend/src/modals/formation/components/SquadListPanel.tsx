import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  IconButton,
  Tooltip,
  InputAdornment,
  Chip,
  Paper,
  Tabs,
  Tab,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import EventSeatIcon from '@mui/icons-material/EventSeat';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { getPositionColor } from '../helpers';
import type { Player, PlayerData } from '../types';

interface SquadListPanelProps {
  availablePlayers: Player[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activePlayerIds: Set<number | null | undefined>;
  onAddToField: (player: Player) => void;
  onAddToBench: (player: Player) => void;
  onAddGeneric: () => void;
  onSquadDragStart?: (player: Player) => void;
  onSquadDragEnd?: () => void;
  fieldPlayers: PlayerData[];
  onRemoveFromField: (id: number) => void;
  onSendToBench: (id: number) => void;
  notes: string;
  onNotesChange: (v: string) => void;
}

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

/** Avatar-Kreis für einen Kader-Spieler.
 *  Registriert einen non-passive touchstart-Listener, damit e.preventDefault()
 *  Kontext-Menü und Textauswahl beim LongPress unterdrückt
 *  (React's onTouchStart ist passive und kann das nicht). */
const SquadPlayerAvatar: React.FC<{
  player: Player;
  isActive: boolean;
  onSquadDragStart?: (player: Player) => void;
}> = ({ player, isActive, onSquadDragStart }) => {
  const avatarRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (isActive) return;
    const el = avatarRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchstart', prevent, { passive: false });
    return () => el.removeEventListener('touchstart', prevent);
  }, [isActive]);

  return (
    <Tooltip
      title={buildPlayerTooltip(player.name, player.shirtNumber, player.position ?? undefined, player.alternativePositions)}
      placement="right"
      disableInteractive
    >
      <Box
        ref={avatarRef}
        sx={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          bgcolor: isActive ? 'action.disabled' : getPositionColor(player.position ?? null),
          color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: '0.6rem', letterSpacing: 0.3,
          cursor: isActive ? 'default' : 'grab',
          touchAction: isActive ? 'auto' : 'none',
          userSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
        onTouchStart={isActive ? undefined : () => onSquadDragStart?.(player)}
        onContextMenu={isActive ? undefined : e => e.preventDefault()}
      >
        {player.position ?? '?'}
      </Box>
    </Tooltip>
  );
};

const SquadListPanel: React.FC<SquadListPanelProps> = ({
  availablePlayers,
  searchQuery,
  onSearchChange,
  activePlayerIds,
  onAddToField,
  onAddToBench,
  onAddGeneric,
  onSquadDragStart,
  onSquadDragEnd,
  fieldPlayers,
  onRemoveFromField,
  onSendToBench,
  notes,
  onNotesChange,
}) => {
  const [mobileTab, setMobileTab] = React.useState(0);

  const filtered = availablePlayers.filter(player =>
    (player.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(player.shirtNumber ?? '').includes(searchQuery),
  );

  const deployedPlayersCount = availablePlayers.filter(player => activePlayerIds.has(player.id)).length;
  const remainingPlayersCount = Math.max(0, availablePlayers.length - deployedPlayersCount);

  const handleDragStart = (event: React.DragEvent, player: Player) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/squad-player-id', String(player.id));

    const size = 44;
    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.cssText = `width:${size}px;height:${size}px;position:fixed;top:-${size * 4}px;left:-${size * 4}px;pointer-events:none;`;
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      const radius = size / 2;
      ctx.beginPath();
      ctx.arc(radius, radius, radius - 1, 0, Math.PI * 2);
      ctx.fillStyle = getPositionColor(player.position ?? null);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(player.shirtNumber != null ? String(player.shirtNumber) : '?', radius, radius);
    }

    event.dataTransfer.setDragImage(canvas, size / 2, size / 2);
    setTimeout(() => document.body.removeChild(canvas), 0);
    onSquadDragStart?.(player);
  };

  const squadSection = (
    <>
      <Box sx={{ mb: 1.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
          <Typography variant="subtitle2" fontWeight={800}>Kader</Typography>
          <Chip
            size="small"
            label={`${remainingPlayersCount} offen`}
            color={remainingPlayersCount > 0 ? 'primary' : 'default'}
            variant="outlined"
          />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
          Spieler antippen oder ziehen. Bereits eingesetzte Spieler sind markiert und nicht erneut auswählbar.
        </Typography>
      </Box>

      <TextField
        size="small"
        placeholder="Spieler suchen…"
        value={searchQuery}
        onChange={event => onSearchChange(event.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 1.25 }}
      />

      <List dense disablePadding>
        {filtered.map(player => {
          const isActive = activePlayerIds.has(player.id);

          return (
            <ListItem
              key={player.id}
              disablePadding
              draggable={!isActive}
              onDragStart={isActive ? undefined : event => handleDragStart(event, player)}
              onDragEnd={() => onSquadDragEnd?.()}
              sx={{ py: 0.2 }}
            >
              <Box
                display="flex"
                alignItems="center"
                gap={1}
                sx={{
                  width: '100%',
                  px: 0.75,
                  py: 0.5,
                  borderRadius: 2,
                  opacity: isActive ? 0.55 : 1,
                  bgcolor: isActive ? 'action.selected' : 'transparent',
                  cursor: isActive ? 'default' : 'grab',
                  '&:hover': isActive ? {} : { bgcolor: 'action.hover' },
                }}
              >
                {/* Avatar – drag handle for touch (touchAction:none only here) */}
                <SquadPlayerAvatar
                  player={player}
                  isActive={isActive}
                  onSquadDragStart={onSquadDragStart}
                />

                {/* Name + meta */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {player.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                    {[player.shirtNumber != null ? `#${player.shirtNumber}` : null, player.alternativePositions?.join(', ')].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>

                {/* Actions */}
                {isActive ? (
                  <CheckCircleOutlineIcon fontSize="small" sx={{ color: 'success.main', flexShrink: 0 }} />
                ) : (
                  <Box display="flex" flexShrink={0}>
                    <Tooltip title="Auf Spielfeld setzen">
                      <IconButton size="small" onClick={() => onAddToField(player)}>
                        <SportsSoccerIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Auf Bank setzen">
                      <IconButton size="small" onClick={() => onAddToBench(player)}>
                        <EventSeatIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Box>
            </ListItem>
          );
        })}

        {filtered.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 0.5, display: 'block', py: 1 }}>
            {searchQuery ? 'Kein Spieler passt zur Suche.' : 'Wähle ein Team, um Spieler zu sehen.'}
          </Typography>
        )}
      </List>

      <Button
        size="small"
        variant="text"
        startIcon={<AddIcon />}
        onClick={onAddGeneric}
        sx={{ alignSelf: 'flex-start', fontSize: '0.75rem', mt: 0.75 }}
      >
        Platzhalter hinzufügen
      </Button>
    </>
  );

  const lineupSection = fieldPlayers.length > 0 ? (
    <>
      <Box sx={{ mb: 1.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
          <Typography variant="subtitle2" fontWeight={800}>Startelf</Typography>
          <Chip size="small" label={`${fieldPlayers.length} gesetzt`} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
          Hier siehst du die aktuelle Belegung des Spielfelds und kannst Spieler direkt auf die Bank schicken oder entfernen.
        </Typography>
      </Box>

      <List dense disablePadding>
        {fieldPlayers.map(player => (
          <ListItem key={player.id} disablePadding sx={{ py: 0.2 }}>
            <Box
              display="flex"
              alignItems="center"
              gap={1}
              sx={{
                width: '100%',
                px: 0.75,
                py: 0.5,
                borderRadius: 2,
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Box sx={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                bgcolor: getPositionColor(player.position ?? null),
                color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '0.6rem',
              }}>
                {player.position ?? '?'}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>{player.name}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                  {[player.number != null ? `#${player.number}` : null, player.alternativePositions?.join(', ')].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
              <Tooltip title="Auf die Bank setzen">
                <IconButton size="small" onClick={() => onSendToBench(player.id)}>
                  <EventSeatIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <IconButton size="small" onClick={() => onRemoveFromField(player.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </ListItem>
        ))}
      </List>
    </>
  ) : (
    <>
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.5 }}>
        Startelf
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Noch keine Spieler auf dem Feld. Ziehe Spieler aus dem Kader auf das Spielfeld oder nutze die Buttons neben dem Namen.
      </Typography>
    </>
  );

  const notesSection = (
    <>
      <Box sx={{ mb: 1.25 }}>
        <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.5 }}>
          Taktische Notizen
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
          Kurz notieren, was für das Spiel wichtig ist: Pressinghöhe, Standards, Wechselidee oder besondere Matchups.
        </Typography>
      </Box>
      <TextField
        multiline
        rows={5}
        size="small"
        fullWidth
        placeholder="z.B. Hoch pressen, Umschalten über rechts, Gegner hat schwache linke Seite…"
        value={notes}
        onChange={event => onNotesChange(event.target.value)}
      />
    </>
  );

  return (
    <Box
      flex={1}
      minWidth={200}
      display="flex"
      flexDirection="column"
      gap={1.25}
      sx={{
        width: '100%',
        maxHeight: { xs: 'none', md: 680 },
        overflowY: { xs: 'visible', md: 'auto' },
        pr: { xs: 0, md: 0.5 },
      }}
    >
      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', display: { xs: 'block', md: 'none' } }}>
        <Tabs
          value={mobileTab}
          onChange={(_, value) => setMobileTab(value)}
          variant="fullWidth"
          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Tab label={`Kader ${remainingPlayersCount > 0 ? `(${remainingPlayersCount})` : ''}`.trim()} />
          <Tab label={`Startelf (${fieldPlayers.length})`} />
          <Tab label="Notizen" />
        </Tabs>
        <Box sx={{ p: 1.25 }}>
          {mobileTab === 0 && squadSection}
          {mobileTab === 1 && lineupSection}
          {mobileTab === 2 && notesSection}
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 3, display: { xs: 'none', md: 'block' } }}>
        {squadSection}
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 3, display: { xs: 'none', md: 'block' } }}>
        {lineupSection}
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 3, display: { xs: 'none', md: 'block' } }}>
        {notesSection}
      </Paper>
    </Box>
  );
};

export default SquadListPanel;