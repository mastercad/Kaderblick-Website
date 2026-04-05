import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlaceIcon from '@mui/icons-material/Place';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventIcon from '@mui/icons-material/Event';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PeopleIcon from '@mui/icons-material/People';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import GroupIcon from '@mui/icons-material/Group';
import { apiJson } from '../utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParticipationSummary {
  [statusName: string]: number;
}

interface ParticipantEntry {
  userId: number;
  name: string;
  status: string;
  statusId: number;
  statusCode?: string;
  statusColor?: string;
}

interface RideEntry {
  id: number;
  driverId: number;
  driver: string;
  seats: number;
  note: string | null;
  availableSeats: number;
  isMyRide: boolean;
  passengers: { id: number; name: string }[];
}

interface TaskEntry {
  assignmentId: number;
  taskId: number;
  title: string;
  status: string;
  isDone: boolean;
  assignedTo?: string;
  assignedUserId?: number;
}

interface NotificationEntry {
  id: number;
  type: string;
  title: string;
  message: string | null;
  createdAt: string;
}

interface SquadPlayer {
  playerId: number;
  name: string;
  positionShort: string;
  userId: number | null;
  statusId: number | null;
  statusName: string | null;
  statusCode: string;
  statusColor: string | null;
  alternativePositions?: string[];
}

interface MatchPlanSlot {
  slot: string | null;
  playerName: string | null;
  playerId: number | null;
  userId: number | null;
  statusId: number | null;
  statusName: string | null;
  statusCode: string;
  statusColor: string | null;
  isConfirmed: boolean;
  suggestions: Array<{
    playerId: number;
    name: string;
    positionShort: string;
    isMainPosition: boolean;
  }>;
}

interface SquadTeam {
  teamId: number;
  teamName: string;
  attending: number;
  total: number;
  trafficLight: 'green' | 'yellow' | 'red';
  completionPercent: number;
  hasMatchPlan: boolean;
  startingXI: MatchPlanSlot[] | null;
  bench: MatchPlanSlot[] | null;
  unplanned: SquadPlayer[] | null;
  playersByPosition: Record<string, SquadPlayer[]> | null;
}

interface MatchdayData {
  event: {
    id: number;
    title: string;
    start: string;
    end?: string;
    description?: string;
    location?: { id?: number; name?: string; address?: string; city?: string };
    game?: {
      homeTeam?: { id: number; name: string };
      awayTeam?: { id: number; name: string };
    };
    cancelled?: boolean;
    cancelReason?: string;
    cancelledBy?: string;
    meetingPoint?: string;
    meetingTime?: string;
    weatherData?: { weatherCode?: number };
  };
  role: 'admin' | 'coach' | 'player';
  myParticipation: { id: number; status: string; statusId: number } | null;
  participationSummary: ParticipationSummary;
  participants: ParticipantEntry[];
  rides: RideEntry[];
  myRide: { type: 'driver' | 'passenger'; rideId: number } | null;
  myTasks: TaskEntry[];
  allTasks: TaskEntry[];
  unreadNotifications: NotificationEntry[];
  lastViewedAt: string | null;
  completeness: { participation: boolean; task: boolean };
  attendingPlayers: string[];
  squadReadiness: SquadTeam[] | null;
}

interface ParticipationStatus {
  id: number;
  name: string;
  color?: string;
  icon?: string;
  sort_order?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function CompletenessBar({ completeness }: { completeness: MatchdayData['completeness'] }) {
  const steps = [
    { label: 'Teilnahme', done: completeness.participation },
    { label: 'Aufgabe', done: completeness.task },
  ];
  const doneCount = steps.filter(s => s.done).length;
  const progress = Math.round((doneCount / steps.length) * 100);

  return (
    <Paper variant="outlined" sx={{ p: 2 }} data-testid="completeness-bar">
      <Typography variant="subtitle2" gutterBottom>
        Vollständigkeit — {doneCount}/{steps.length}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{ height: 8, borderRadius: 4, mb: 1.5 }}
        color={progress === 100 ? 'success' : 'primary'}
      />
      <Stack direction="row" spacing={2} flexWrap="wrap">
        {steps.map(step => (
          <Stack key={step.label} direction="row" alignItems="center" spacing={0.5}>
            {step.done
              ? <CheckCircleIcon fontSize="small" color="success" />
              : <RadioButtonUncheckedIcon fontSize="small" color="disabled" />}
            <Typography variant="caption" color={step.done ? 'text.primary' : 'text.disabled'}>
              {step.label}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

// ─── Squad Readiness (Trainer / Admin) ────────────────────────────────────────

const STATUS_CODE_COLOR: Record<string, string> = {
  attending: '#28a745',
  maybe: '#ffc107',
  not_attending: '#dc3545',
  late: '#fd7e14',
};

const TRAFFIC_LIGHT_CONFIG = {
  green: { color: '#28a745', label: 'Einsatzbereit' },
  yellow: { color: '#ffc107', label: 'Knapp besetzt' },
  red: { color: '#dc3545', label: 'Kritisch' },
};

function SlotStatusIcon({ statusCode, statusName }: { statusCode: string; statusName: string | null }) {
  if (statusCode === 'attending') {
    return <CheckCircleIcon fontSize="small" sx={{ color: '#28a745', flexShrink: 0 }} />;
  }
  if (statusCode === 'none' || statusCode === '') {
    return (
      <Tooltip title="Keine Rückmeldung">
        <RadioButtonUncheckedIcon fontSize="small" sx={{ color: '#bdbdbd', flexShrink: 0 }} />
      </Tooltip>
    );
  }
  const color = STATUS_CODE_COLOR[statusCode] ?? '#9e9e9e';
  return (
    <Tooltip title={statusName ?? statusCode}>
      <Box component="span" sx={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
    </Tooltip>
  );
}

function SquadReadinessCard({ team }: { team: SquadTeam }) {
  const tl = TRAFFIC_LIGHT_CONFIG[team.trafficLight];
  const progressSx = { bgcolor: tl.color };

  return (
    <Box sx={{ mb: 2.5 }}>
      {/* Team header */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }} flexWrap="wrap">
        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: tl.color, flexShrink: 0 }} />
        <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1 }}>
          {team.teamName}
        </Typography>
        <Chip
          label={`${team.attending} / ${team.total} zugesagt`}
          size="small"
          sx={{ bgcolor: tl.color, color: '#fff', fontWeight: 600 }}
        />
      </Stack>

      {/* Progress bar */}
      <Box sx={{ mb: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Kaderbesetzung – {tl.label}
          </Typography>
          <Typography variant="caption" fontWeight={700} sx={{ color: tl.color }}>
            {team.completionPercent}%
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={team.completionPercent}
          sx={{ height: 8, borderRadius: 4, '& .MuiLinearProgress-bar': progressSx }}
        />
      </Box>

      {/* ── Formation-based view (matchPlan exists) ── */}
      {team.hasMatchPlan && team.startingXI && (
        <>
          {/* Startelf */}
          <Typography variant="caption" fontWeight={700} color="text.secondary"
            sx={{ textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.5 }}>
            Startelf ({team.startingXI.filter(s => s.isConfirmed).length} / {team.startingXI.length})
          </Typography>
          <Box sx={{ mb: 1.5 }}>
            {team.startingXI.map((slot, idx) => {
              const isOpen = !slot.playerName;
              return (
                <Box key={idx} sx={{ py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="caption" fontWeight={700}
                      sx={{ minWidth: 30, fontFamily: 'monospace', color: 'text.secondary', flexShrink: 0 }}>
                      {slot.slot ?? '—'}
                    </Typography>
                    <Typography variant="body2" sx={{ flexGrow: 1, color: isOpen ? 'text.disabled' : 'text.primary', fontStyle: isOpen ? 'italic' : 'normal' }}>
                      {isOpen ? 'Nicht besetzt' : slot.playerName}
                    </Typography>
                    {!isOpen && <SlotStatusIcon statusCode={slot.statusCode} statusName={slot.statusName} />}
                  </Stack>
                  {/* Suggestions: for unconfirmed real players OR open slots */}
                  {(!slot.isConfirmed) && slot.suggestions.length > 0 && (
                    <Box sx={{ pl: 5, pt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, alignSelf: 'center' }}>
                        {isOpen ? 'Mögliche Besetzung:' : 'Vorschlag:'}
                      </Typography>
                      {slot.suggestions.map((s, si) => (
                        <Tooltip key={si} title={s.isMainPosition ? 'Hauptposition' : 'Alternativposition (passt auch)'}>
                          <Chip
                            label={s.name}
                            size="small"
                            variant="outlined"
                            sx={{
                              borderColor: s.isMainPosition ? '#28a745' : '#fd7e14',
                              fontStyle: s.isMainPosition ? 'normal' : 'italic',
                              fontSize: '0.7rem',
                            }}
                          />
                        </Tooltip>
                      ))}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>

          {/* Bank */}
          {team.bench && team.bench.length > 0 && (
            <>
              <Typography variant="caption" fontWeight={700} color="text.secondary"
                sx={{ textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.5 }}>
                Bank ({team.bench.filter(s => s.isConfirmed).length} / {team.bench.length})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                {team.bench.map((slot, idx) => {
                  const statusColor = slot.statusColor ?? (STATUS_CODE_COLOR[slot.statusCode] ?? '#9e9e9e');
                  return (
                    <Tooltip key={idx} title={slot.statusName ?? 'Keine Rückmeldung'}>
                      <Chip
                        label={slot.playerName ?? '—'}
                        size="small"
                        variant="outlined"
                        sx={{
                          borderColor: statusColor,
                          bgcolor: slot.isConfirmed ? `${statusColor}1a` : undefined,
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </Box>
            </>
          )}

          {/* Nicht im Plan */}
          {team.unplanned && team.unplanned.length > 0 && (
            <>
              <Typography variant="caption" fontWeight={700} color="text.secondary"
                sx={{ textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.5 }}>
                Nicht im Plan ({team.unplanned.length})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {team.unplanned.map(player => {
                  const statusColor = player.statusColor ?? (STATUS_CODE_COLOR[player.statusCode] ?? '#9e9e9e');
                  const altStr = player.alternativePositions?.length
                    ? ` · auch: ${player.alternativePositions.join(', ')}`
                    : '';
                  return (
                    <Tooltip key={player.playerId}
                      title={`${player.positionShort}${altStr} – ${player.statusName ?? 'Keine Rückmeldung'}`}>
                      <Chip
                        label={player.name}
                        size="small"
                        variant="outlined"
                        sx={{
                          borderColor: statusColor,
                          color: 'text.disabled',
                          bgcolor: player.statusCode === 'attending' ? `${statusColor}1a` : undefined,
                          fontSize: '0.7rem',
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </Box>
            </>
          )}
        </>
      )}

      {/* ── Position-grouped fallback (no matchPlan) ── */}
      {!team.hasMatchPlan && team.playersByPosition && (
        Object.entries(team.playersByPosition).map(([posName, players]) => (
          <Box key={posName} sx={{ mb: 1.5 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary"
              sx={{ textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.5 }}>
              {posName}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {players.map(player => {
                const statusColor = player.statusColor ?? (STATUS_CODE_COLOR[player.statusCode] ?? '#9e9e9e');
                const hasStatus = player.statusCode !== 'none' && player.statusCode !== '';
                const altStr = player.alternativePositions?.length
                  ? ` · auch: ${player.alternativePositions.join(', ')}`
                  : '';
                return (
                  <Tooltip key={player.playerId}
                    title={`${hasStatus ? (player.statusName ?? player.statusCode) : 'Keine Rückmeldung'}${altStr}`}>
                    <Chip
                      label={player.name}
                      size="small"
                      variant="outlined"
                      sx={{
                        borderColor: statusColor,
                        color: 'text.primary',
                        bgcolor: hasStatus ? `${statusColor}1a` : undefined,
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Box>
          </Box>
        ))
      )}
    </Box>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface UpcomingGame { id: number; title: string; start: string; }

export default function Matchday() {
  const { eventId } = useParams<{ eventId?: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<MatchdayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noGames, setNoGames] = useState(false);
  const [lookaheadDays, setLookaheadDays] = useState(7);
  const [participationStatuses, setParticipationStatuses] = useState<ParticipationStatus[]>([]);
  const [savingParticipation, setSavingParticipation] = useState(false);
  const [upcomingGames, setUpcomingGames] = useState<UpcomingGame[]>([]);

  // Touch-swipe refs
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Load upcoming games within configured lookahead window for tab display
  useEffect(() => {
    apiJson<{ events: any[]; lookaheadDays: number }>('/api/calendar/upcoming')
      .then(response => {
        const days = response?.lookaheadDays ?? 7;
        setLookaheadDays(days);
        // Backend already filters by the configured lookahead window
        const games = (response?.events ?? [])
          .filter(e => e.game != null)
          .map(e => ({ id: e.id, title: e.title, start: e.start }));
        setUpcomingGames(games);
        // If no eventId → navigate to first upcoming game
        if (!eventId) {
          if (games.length > 0) {
            navigate(`/mein-spieltag/${games[0].id}`, { replace: true });
          } else {
            setLoading(false);
            setNoGames(true);
          }
        }
      })
      .catch(() => {
        if (!eventId) {
          setLoading(false);
          setError('Spieltag konnte nicht geladen werden.');
        }
      });
  }, []); // run once on mount

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const [matchdayData, statuses] = await Promise.all([
        apiJson<MatchdayData>(`/api/matchday/${eventId}`),
        apiJson<{ statuses: ParticipationStatus[] }>('/api/participation/statuses').catch(() => ({ statuses: [] })),
      ]);
      setData(matchdayData);
      setParticipationStatuses(statuses.statuses);

      // Mark as viewed (fire & forget — no need to await)
      apiJson(`/api/matchday/${eventId}/view`, { method: 'POST' }).catch(() => {});
    } catch {
      setError('Spieltag konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleParticipation = async (statusId: number) => {
    if (!eventId || savingParticipation) return;
    setSavingParticipation(true);
    try {
      await apiJson(`/api/participation/event/${eventId}/respond`, {
        method: 'POST',
        body: { status_id: statusId },
      });
      // Refresh only participation data
      const refreshed = await apiJson<MatchdayData>(`/api/matchday/${eventId}`);
      setData(refreshed);
    } catch {
      // silent — user still sees old state
    } finally {
      setSavingParticipation(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (noGames) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', px: 3, py: 6, textAlign: 'center' }}>
        <SportsSoccerIcon sx={{ fontSize: 72, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Keine Spiele in Sicht
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Für den nächsten Zeitraum von {lookaheadDays} Tagen stehen keine Spiele an.
        </Typography>
        <Button
          variant="outlined"
          component={RouterLink}
          to="/calendar"
        >
          Zum Kalender
        </Button>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box sx={{ px: 3, py: 6, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Spieltag konnte nicht geladen werden.
        </Typography>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          Zurück
        </Button>
      </Box>
    );
  }

  const { event, role, myParticipation, participationSummary, participants, attendingPlayers, rides, myRide, myTasks, allTasks, unreadNotifications, completeness, squadReadiness } = data;
  const isCoachOrAdmin = role === 'coach' || role === 'admin';

  const currentTabIndex = upcomingGames.findIndex(g => String(g.id) === String(eventId));
  const activeTab = currentTabIndex >= 0 ? currentTabIndex : false;

  const navigateToTabIndex = (idx: number) => {
    if (idx >= 0 && idx < upcomingGames.length) {
      navigate(`/mein-spieltag/${upcomingGames[idx].id}`);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (upcomingGames.length <= 1 || currentTabIndex < 0) return;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    // Only act on horizontal swipes (dx dominant, at least 60px)
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx > 0) navigateToTabIndex(currentTabIndex + 1); // swipe left → next
      else navigateToTabIndex(currentTabIndex - 1);        // swipe right → prev
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: { xs: 2, md: 3 } }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Back navigation ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <IconButton onClick={() => navigate(-1)} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="caption" color="text.secondary">
          Mein Spieltag
        </Typography>
      </Box>

      {/* ── Upcoming games tabs (only if multiple in 7-day window) ── */}
      {upcomingGames.length > 1 && (
        <Paper variant="outlined" sx={{ mb: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(_, idx) => navigateToTabIndex(idx)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ minHeight: 44 }}
          >
            {upcomingGames.map(g => (
              <Tab
                key={g.id}
                label={
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.2, fontWeight: 600 }}>
                      {g.title}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontSize: '0.65rem' }}>
                      {new Date(g.start).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                    </Typography>
                  </Box>
                }
                sx={{ minHeight: 44, py: 0.5 }}
              />
            ))}
          </Tabs>
        </Paper>
      )}

      {/* ── Cancelled banner ── */}
      {event.cancelled && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <strong>Abgesagt</strong>
          {event.cancelReason ? ` – ${event.cancelReason}` : ''}
          {event.cancelledBy ? ` (von ${event.cancelledBy})` : ''}
        </Alert>
      )}

      {/* ── Unread notifications for this event ── */}
      {unreadNotifications.length > 0 && (
        <Alert
          severity="info"
          icon={<NotificationsActiveIcon />}
          sx={{ mb: 2 }}
        >
          <Typography variant="subtitle2" gutterBottom>
            {unreadNotifications.length} neue Benachrichtigung{unreadNotifications.length > 1 ? 'en' : ''}
          </Typography>
          {unreadNotifications.map(n => (
            <Typography key={n.id} variant="body2">
              <strong>{n.title}</strong>{n.message ? ` – ${n.message}` : ''}
            </Typography>
          ))}
        </Alert>
      )}

      {/* ── Event header ── */}
      <Paper sx={{ p: 2.5, mb: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <SportsSoccerIcon color="primary" sx={{ mt: 0.25 }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>{event.title}</Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }} flexWrap="wrap">
              <EventIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {formatDateTime(event.start)}
              </Typography>
            </Stack>
            {event.location?.name && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                <PlaceIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {event.location.name}
                  {event.location.address ? `, ${event.location.address}` : ''}
                  {event.location.city ? `, ${event.location.city}` : ''}
                </Typography>
              </Stack>
            )}
            {event.game && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body1" fontWeight={600}>
                  {event.game.homeTeam?.name ?? '–'} vs. {event.game.awayTeam?.name ?? '–'}
                </Typography>
              </Box>
            )}
            {event.description && (
              <Typography variant="body2" sx={{ mt: 1 }} color="text.secondary">
                {event.description}
              </Typography>
            )}
          </Box>
        </Stack>
      </Paper>

      {/* ── Meeting point ── */}
      {(event.meetingPoint || event.meetingTime) && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderColor: 'primary.main' }}>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            Treffpunkt
          </Typography>
          <Stack spacing={0.5}>
            {event.meetingPoint && (
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <PlaceIcon fontSize="small" color="action" sx={{ mt: 0.1 }} />
                <Typography variant="body2">{event.meetingPoint}</Typography>
              </Stack>
            )}
            {event.meetingTime && (
              <Stack direction="row" spacing={1} alignItems="center">
                <AccessTimeIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  Treffzeit: <strong>{formatTime(event.meetingTime)}</strong>
                </Typography>
              </Stack>
            )}
          </Stack>
        </Paper>
      )}

      {/* ── Vollständigkeit ── */}
      <Box sx={{ mb: 2 }}>
        <CompletenessBar completeness={completeness} />
      </Box>

      {/* ── Participation ── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          <PeopleIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
          Teilnahme
        </Typography>

        {/* Status summary chips */}
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1.5 }}>
          {Object.entries(participationSummary).map(([name, count]) => (
            <Chip key={name} label={`${name}: ${count}`} size="small" variant="outlined" />
          ))}
          {Object.keys(participationSummary).length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Noch keine Rückmeldungen
            </Typography>
          )}
        </Stack>

        {/* My participation quick-toggle */}
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
          Meine Rückmeldung:
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {[...participationStatuses]
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map(status => {
              const isActive = myParticipation?.statusId === status.id;
              return (
                <Button
                  key={status.id}
                  variant={isActive ? 'contained' : 'outlined'}
                  size="small"
                  disabled={savingParticipation}
                  onClick={() => handleParticipation(status.id)}
                  sx={{
                    borderRadius: 5,
                    textTransform: 'none',
                    fontWeight: isActive ? 700 : 500,
                    bgcolor: isActive ? (status.color ?? undefined) : undefined,
                    color: isActive ? '#fff' : (status.color ?? undefined),
                    borderColor: status.color ?? undefined,
                    '&:hover': { opacity: 0.85 },
                  }}
                >
                  {status.name}
                </Button>
              );
            })}
        </Stack>

        {/* Full participant list (coaches / admins) */}
        {isCoachOrAdmin && participants.length > 0 && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Alle Rückmeldungen ({participants.length}):
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {participants.map(p => {
                const statusColor = p.statusColor ?? (STATUS_CODE_COLOR[p.statusCode ?? ''] ?? undefined);
                return (
                  <Tooltip key={p.userId} title={p.status}>
                    <Chip
                      label={p.name}
                      size="small"
                      variant="outlined"
                      sx={{
                        borderColor: statusColor,
                        bgcolor: statusColor ? `${statusColor}1a` : undefined,
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Box>
          </>
        )}
      </Paper>

      {/* ── Attending players (player role) ── */}
      {!isCoachOrAdmin && attendingPlayers.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            <GroupIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
            Wer ist dabei? ({attendingPlayers.length})
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {attendingPlayers.map(name => (
              <Chip
                key={name}
                label={name}
                size="small"
                sx={{ bgcolor: '#28a7451a', borderColor: '#28a745', color: 'text.primary' }}
                variant="outlined"
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* ── Squad readiness (coach / admin) ── */}
      {isCoachOrAdmin && squadReadiness && squadReadiness.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            <GroupIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
            Kaderbesetzung
          </Typography>
          {squadReadiness.map(team => (
            <SquadReadinessCard key={team.teamId} team={team} />
          ))}
        </Paper>
      )}

      {/* ── Rides ── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            <DirectionsCarIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
            Fahrgemeinschaften
          </Typography>
          <Button
            size="small"
            component={RouterLink}
            to={`/calendar?eventId=${event.id}&openRides=1`}
            variant="text"
          >
            Verwalten
          </Button>
        </Stack>
        {rides.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Noch keine Fahrgemeinschaften eingetragen.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {rides.map(ride => (
              <Box
                key={ride.id}
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: ride.isMyRide ? 'primary.main' : 'divider',
                  bgcolor: ride.isMyRide ? 'action.selected' : 'background.paper',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {ride.driver}
                      {myRide?.rideId === ride.id && (
                        <Chip
                          label={myRide.type === 'driver' ? 'Fahrer' : 'Mitfahrer'}
                          size="small"
                          color="primary"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Typography>
                    {ride.note && (
                      <Typography variant="caption" color="text.secondary">
                        {ride.note}
                      </Typography>
                    )}
                    {ride.passengers.length > 0 && (
                      <Typography variant="caption" display="block" color="text.secondary">
                        Mitfahrer: {ride.passengers.map(p => p.name).join(', ')}
                      </Typography>
                    )}
                  </Box>
                  <Chip
                    icon={<GroupIcon fontSize="small" />}
                    label={`${ride.availableSeats} frei`}
                    size="small"
                    color={ride.availableSeats === 0 ? 'default' : 'success'}
                    variant="outlined"
                  />
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>

      {/* ── My Tasks ── */}
      {(myTasks.length > 0 || isCoachOrAdmin) && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            <AssignmentIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
            {isCoachOrAdmin ? 'Aufgaben am Spieltag' : 'Meine Aufgaben'}
          </Typography>

          {/* Own tasks */}
          {myTasks.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Keine Aufgaben für dich an diesem Tag.
            </Typography>
          ) : (
            <Stack spacing={0.75} sx={{ mb: isCoachOrAdmin && allTasks.length > 0 ? 1.5 : 0 }}>
              {myTasks.map(t => (
                <Stack key={t.assignmentId} direction="row" spacing={1} alignItems="center">
                  {t.isDone
                    ? <CheckCircleIcon fontSize="small" color="success" />
                    : <RadioButtonUncheckedIcon fontSize="small" color="action" />}
                  <Typography
                    variant="body2"
                    sx={{ textDecoration: t.isDone ? 'line-through' : 'none' }}
                  >
                    {t.title}
                  </Typography>
                  {!t.isDone && (
                    <Chip label={t.status} size="small" variant="outlined" />
                  )}
                </Stack>
              ))}
            </Stack>
          )}

          {/* All tasks for coaches */}
          {isCoachOrAdmin && allTasks.length > 0 && (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
                Alle ({allTasks.length}):
              </Typography>
              <Stack spacing={0.5}>
                {allTasks.map(t => (
                  <Stack key={t.assignmentId} direction="row" spacing={1} alignItems="center">
                    {t.isDone
                      ? <CheckCircleIcon fontSize="small" color="success" />
                      : <RadioButtonUncheckedIcon fontSize="small" color="disabled" />}
                    <Typography variant="body2" color={t.isDone ? 'text.secondary' : 'text.primary'}>
                      {t.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      → {t.assignedTo}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </>
          )}
        </Paper>
      )}
    </Box>
  );
}
