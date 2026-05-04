import React, { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import EventIcon from '@mui/icons-material/Event';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import EditIcon from '@mui/icons-material/Edit';
import { useTheme } from '@mui/material/styles';
import { apiJson } from '../utils/api';
import type { ParticipationStatus } from '../types/participation';
import { ParticipationButtons } from '../components/ParticipationButtons';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UpcomingEvent {
  id: number;
  title: string;
  start: string;
  cancelled: boolean;
  game: object | null;
  type?: { name: string; color?: string } | null;
  permissions: { canParticipate: boolean };
  participation_status: {
    id: number;
    name: string;
    code?: string;
    color?: string;
    icon?: string;
  } | null;
}

interface RowState {
  participation: { id: number; name: string; code?: string; color?: string; icon?: string } | null;
  saving: boolean;
  expanded: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CODE_ICON: Record<string, React.ReactNode> = {
  accepted:  <CheckIcon sx={{ fontSize: 16 }} />,
  confirmed: <CheckIcon sx={{ fontSize: 16 }} />,
  declined:  <CloseIcon sx={{ fontSize: 16 }} />,
  maybe:     <HelpOutlineIcon sx={{ fontSize: 16 }} />,
  unsicher:  <HelpOutlineIcon sx={{ fontSize: 16 }} />,
};

function EventTypeIcon({ event }: { event: UpcomingEvent }) {
  if (event.game) return <SportsSoccerIcon sx={{ fontSize: 18 }} />;
  const name = event.type?.name?.toLowerCase() ?? '';
  if (name.includes('training')) return <FitnessCenterIcon sx={{ fontSize: 18 }} />;
  return <EventIcon sx={{ fontSize: 18 }} />;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── EventRow ────────────────────────────────────────────────────────────────

interface EventRowProps {
  event: UpcomingEvent;
  row: RowState;
  statuses: ParticipationStatus[];
  onRespond: (eventId: number, statusId: number) => void;
  onToggleExpand: (eventId: number) => void;
}

const EventRow: React.FC<EventRowProps> = ({ event, row, statuses, onRespond, onToggleExpand }) => {
  const theme = useTheme();
  const typeColor = event.type?.color ?? theme.palette.primary.main;
  if (!row) return null;
  const isPending = !row.participation;
  const showButtons = isPending || row.expanded;

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        py: 1.5,
        opacity: row.saving ? 0.55 : 1,
        transition: 'opacity 0.18s',
      }}
    >
      {/* Colored left strip */}
      <Box
        sx={{
          width: 4,
          borderRadius: 2,
          bgcolor: typeColor,
          flexShrink: 0,
          alignSelf: 'stretch',
          minHeight: 40,
        }}
      />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Title row */}
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.25 }}>
          <Box sx={{ color: typeColor, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <EventTypeIcon event={event} />
          </Box>
          <Typography
            variant="body2"
            fontWeight={700}
            noWrap
            sx={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}
          >
            {event.title}
          </Typography>
          {/* Edit-Button wenn schon geantwortet */}
          {!isPending && !row.expanded && (
            <IconButton
              size="small"
              onClick={() => onToggleExpand(event.id)}
              aria-label="Antwort ändern"
              sx={{ p: 0.5, flexShrink: 0 }}
            >
              <EditIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            </IconButton>
          )}
        </Stack>

        {/* Date */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mb: showButtons ? 1 : 0 }}
        >
          {formatDate(event.start)}
        </Typography>

        {/* Current status chip (wenn geantwortet und nicht expanded) */}
        {!isPending && !row.expanded && (
          <Chip
            size="small"
            label={row.participation!.name}
            icon={
              <Box sx={{ display: 'flex', alignItems: 'center', pl: 0.5 }}>
                {CODE_ICON[row.participation!.code ?? ''] ?? <CheckIcon sx={{ fontSize: 16 }} />}
              </Box>
            }
            sx={{
              height: 24,
              fontSize: 12,
              fontWeight: 600,
              border: '1px solid',
              borderColor: row.participation!.color ?? typeColor,
              color: row.participation!.color ?? typeColor,
              bgcolor: row.participation!.color
                ? `${row.participation!.color}18`
                : `${typeColor}18`,
              '& .MuiChip-icon': { color: 'inherit', ml: 0.5, mr: -0.25 },
            }}
          />
        )}

        {/* Action buttons (wenn pending oder expanded zum Ändern) */}
        {showButtons && (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
            <ParticipationButtons
              statuses={statuses}
              currentParticipation={
                row.participation
                  ? { statusId: row.participation.id, statusName: row.participation.name, color: row.participation.color, icon: row.participation.icon }
                  : null
              }
              saving={row.saving}
              onStatusClick={(statusId) => onRespond(event.id, statusId)}
            />
            {/* Cancel-Edit-Button wenn expanded (schon beantwortet) */}
            {!isPending && row.expanded && (
              <IconButton
                size="small"
                onClick={() => onToggleExpand(event.id)}
                aria-label="Abbrechen"
                sx={{ p: 0.5, color: 'text.secondary' }}
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            )}
          </Stack>
        )}
      </Box>
    </Box>
  );
};

// ─── QuickRsvpWidget ─────────────────────────────────────────────────────────

export const QuickRsvpWidget: React.FC = () => {
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [statuses, setStatuses] = useState<ParticipationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowStates, setRowStates] = useState<Record<number, RowState>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [upcomingRes, statusesRes] = await Promise.all([
        apiJson<{ events: UpcomingEvent[] }>('/api/calendar/upcoming'),
        apiJson<{ statuses: ParticipationStatus[] }>('/api/participation/statuses'),
      ]);

      const eligible = (upcomingRes?.events ?? []).filter(
        e => !e.cancelled && e.permissions?.canParticipate,
      );

      setEvents(eligible);
      setStatuses(statusesRes?.statuses ?? []);

      const init: Record<number, RowState> = {};
      for (const e of eligible) {
        init[e.id] = {
          participation: e.participation_status
            ? {
                id: e.participation_status.id,
                name: e.participation_status.name,
                code: e.participation_status.code,
                color: e.participation_status.color,
                icon: e.participation_status.icon,
              }
            : null,
          saving: false,
          expanded: false,
        };
      }
      setRowStates(init);
    } catch {
      // Stille Fehlerbehandlung – Widget verschwindet einfach
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRespond = async (eventId: number, statusId: number) => {
    const status = statuses.find(s => s.id === statusId);
    if (!status) return;

    setRowStates(prev => ({
      ...prev,
      [eventId]: { ...prev[eventId], saving: true },
    }));

    try {
      await apiJson(`/api/participation/event/${eventId}/respond`, {
        method: 'POST',
        body: { status_id: statusId, note: '' },
      });
      setRowStates(prev => ({
        ...prev,
        [eventId]: {
          saving: false,
          expanded: false,
          participation: {
            id: status.id,
            name: status.name,
            code: status.code,
            color: status.color,
            icon: status.icon,
          },
        },
      }));
    } catch {
      setRowStates(prev => ({
        ...prev,
        [eventId]: { ...prev[eventId], saving: false },
      }));
    }
  };

  const handleToggleExpand = (eventId: number) => {
    setRowStates(prev => ({
      ...prev,
      [eventId]: { ...prev[eventId], expanded: !prev[eventId].expanded },
    }));
  };

  if (loading || !events.length) return null;

  // Nur Events ohne Antwort zeigen (pending first), bereits beantwortete ausblenden
  const pendingEvents = events
    .filter(e => !rowStates[e.id]?.participation)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Beantwortete Events die gerade im expanded (Ändern)-Modus sind ebenfalls zeigen
  const expandedAnswered = events.filter(
    e => rowStates[e.id]?.participation && rowStates[e.id]?.expanded,
  );

  const visibleEvents = [
    ...pendingEvents,
    ...expandedAnswered.filter(e => !pendingEvents.find(p => p.id === e.id)),
  ];

  if (!visibleEvents.length) return null;

  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={{ mb: 3, p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ mb: 1, px: 0.5 }}
      >
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{ textTransform: 'uppercase', letterSpacing: 0.8, color: 'text.secondary' }}
        >
          Deine Zusage fehlt noch
        </Typography>
        <Chip
          label={pendingEvents.length}
          size="small"
          color="error"
          sx={{ height: 18, fontSize: 11, fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }}
        />
      </Stack>

      <Stack divider={<Divider />} spacing={0}>
        {visibleEvents.map(event => (
          <EventRow
            key={event.id}
            event={event}
            row={rowStates[event.id]}
            statuses={statuses}
            onRespond={handleRespond}
            onToggleExpand={handleToggleExpand}
          />
        ))}
      </Stack>
    </Paper>
  );
};
