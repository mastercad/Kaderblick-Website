import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardActionArea,
  Chip,
  Button,
  Alert,
  CircularProgress,
  Stack,
  IconButton,
  Switch,
  FormControlLabel,
  alpha,
  useTheme,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  EmojiEvents as TournamentIcon,
  SportsSoccer as SoccerIcon,
  PlayArrow as LiveIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CompletedIcon,
  CalendarToday as CalendarIcon,
  Groups as TeamsIcon,
  Settings as SettingsIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { fetchTournamentDetails } from '../services/games';
import { TournamentDetail, TournamentMatchOverview } from '../types/games';
import { useAuth } from '../context/AuthContext';
import Location from '../components/Location';
import { WeatherDisplay } from '../components/WeatherIcons';
import WeatherModal from '../modals/WeatherModal';
import { GamesOverviewData, fetchGamesOverview } from '../services/games';
import { apiRequest } from '../utils/api';
import EmptyStateHint from '../components/EmptyStateHint';

/** Helper: format date string to "Sa, 15. Mär" style */
const formatDateShort = (dateString: string) => {
  const date = new Date(dateString);
  const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  return `${days[date.getDay()]}, ${date.getDate()}. ${months[date.getMonth()]}`;
};

const formatTimeShort = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

export default function TournamentDetails() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const tournamentId = params.id ? parseInt(params.id, 10) : undefined;

  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weatherModalOpen, setWeatherModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [userTeamIds, setUserTeamIds] = useState<number[]>([]);

  const openWeatherModal = (eventId: number | null) => {
    setSelectedEventId(eventId);
    setWeatherModalOpen(true);
  };

  useEffect(() => {
    if (tournamentId) {
      loadTournament();
      loadUserTeamIds();
    }
  }, [tournamentId]);

  const loadTournament = async () => {
    if (!tournamentId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await fetchTournamentDetails(tournamentId);
      if ('error' in result) {
        throw new Error(String((result as any).error));
      }
      setTournament(result as TournamentDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden des Turniers');
    } finally {
      setLoading(false);
    }
  };

  const loadUserTeamIds = async () => {
    try {
      const overview = await fetchGamesOverview();
      if (!('error' in overview)) {
        setUserTeamIds((overview as GamesOverviewData).userTeamIds || []);
      }
    } catch {
      // ignore - userTeamIds just won't be available for filtering
    }
  };

  const handleGameClick = (gameId: number) => {
    navigate(`/games/${gameId}`);
  };

  const handleBack = () => {
    navigate('/games');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ px: { xs: 1.5, sm: 3 }, py: { xs: 2, sm: 3 }, maxWidth: 960, mx: 'auto' }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button variant="contained" onClick={loadTournament}>Erneut versuchen</Button>
      </Box>
    );
  }

  if (!tournament) {
    return (
      <Box sx={{ px: { xs: 1.5, sm: 3 }, py: { xs: 2, sm: 3 }, maxWidth: 960, mx: 'auto' }}>
        <EmptyStateHint
          icon={<TournamentIcon />}
          title="Turnier nicht gefunden"
          description="Das gesuchte Turnier konnte nicht gefunden werden."
        />
      </Box>
    );
  }

  const allMatches = tournament.matches || [];
  const isRunning = tournament.status === 'running';

  // Filter matches by user's teams
  const userMatches = userTeamIds.length > 0
    ? allMatches.filter(m =>
        (m.homeTeam && userTeamIds.includes(m.homeTeam.id)) ||
        (m.awayTeam && userTeamIds.includes(m.awayTeam.id))
      )
    : allMatches;

  const displayedMatches = showAllMatches ? allMatches : userMatches;
  const hasUserFilter = userTeamIds.length > 0 && userMatches.length < allMatches.length;

  // Group matches by stage
  const matchesByStage = displayedMatches.reduce<Record<string, TournamentMatchOverview[]>>((acc, match) => {
    const stage = match.stage || 'Sonstige';
    if (!acc[stage]) acc[stage] = [];
    acc[stage].push(match);
    return acc;
  }, {});

  // ─── Section Header Component ─────────────────────────────────
  const SectionHeader = ({ icon, label, count, color }: {
    icon: React.ReactNode;
    label: string;
    count: number;
    color: string;
  }) => (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      mb: 2,
      mt: 1,
    }}>
      {icon}
      <Typography variant="h6" sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.15rem' } }}>
        {label}
      </Typography>
      <Chip
        label={count}
        size="small"
        sx={{
          bgcolor: alpha(color, 0.12),
          color: color,
          fontWeight: 700,
          fontSize: '0.75rem',
          height: 22,
          minWidth: 22,
        }}
      />
    </Box>
  );

  // ─── Match Card Component ─────────────────────────────────────
  const MatchCard = ({ match }: { match: TournamentMatchOverview }) => {
    const hasScore = match.homeScore !== null && match.awayScore !== null;
    const isMatchRunning = match.status === 'running';
    const isMatchFinished = match.status === 'finished';
    const isClickable = !!match.gameId;

    const cardContent = (
      <>
        {/* Live banner for running matches */}
        {isMatchRunning && (
          <Box sx={{
            bgcolor: 'success.main',
            color: 'success.contrastText',
            px: 2,
            py: 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}>
            <LiveIcon sx={{ fontSize: 16, animation: 'pulse 1.5s infinite' }} />
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontSize: '0.7rem' }}>
              Live
            </Typography>
            <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
          </Box>
        )}

        {/* Scoreboard Area */}
        <Box sx={{ px: { xs: 1.5, sm: 2.5 }, pt: { xs: 1.5, sm: 2 }, pb: 1 }}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: { xs: 1, sm: 2 },
            minHeight: { xs: 44, sm: 52 },
          }}>
            {/* Home Team */}
            <Typography sx={{
              flex: 1,
              textAlign: 'right',
              fontWeight: 700,
              fontSize: { xs: '0.82rem', sm: '0.92rem' },
              lineHeight: 1.3,
              wordBreak: 'break-word',
              color: !match.homeTeam ? 'text.disabled' : 'text.primary',
            }}>
              {match.homeTeam?.name || 'TBD'}
            </Typography>

            {/* Score / VS */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: { xs: 60, sm: 76 },
              flexShrink: 0,
            }}>
              {hasScore ? (
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  bgcolor: isMatchRunning
                    ? alpha(theme.palette.success.main, 0.1)
                    : alpha(theme.palette.text.primary, 0.06),
                  borderRadius: 2,
                  px: 1.5,
                  py: 0.5,
                }}>
                  <Typography sx={{
                    fontWeight: 800,
                    fontSize: { xs: '1.1rem', sm: '1.3rem' },
                    lineHeight: 1,
                    color: isMatchRunning ? 'success.main' : 'text.primary',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {match.homeScore}
                  </Typography>
                  <Typography sx={{
                    fontWeight: 400,
                    fontSize: { xs: '0.85rem', sm: '1rem' },
                    color: 'text.secondary',
                    mx: 0.25,
                  }}>
                    :
                  </Typography>
                  <Typography sx={{
                    fontWeight: 800,
                    fontSize: { xs: '1.1rem', sm: '1.3rem' },
                    lineHeight: 1,
                    color: isMatchRunning ? 'success.main' : 'text.primary',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {match.awayScore}
                  </Typography>
                </Box>
              ) : (
                <Typography sx={{
                  fontWeight: 600,
                  fontSize: { xs: '0.72rem', sm: '0.78rem' },
                  color: 'text.disabled',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}>
                  vs
                </Typography>
              )}
            </Box>

            {/* Away Team */}
            <Typography sx={{
              flex: 1,
              textAlign: 'left',
              fontWeight: 700,
              fontSize: { xs: '0.82rem', sm: '0.92rem' },
              lineHeight: 1.3,
              wordBreak: 'break-word',
              color: !match.awayTeam ? 'text.disabled' : 'text.primary',
            }}>
              {match.awayTeam?.name || 'TBD'}
            </Typography>
          </Box>
        </Box>

        {/* Meta Info Bar */}
        <Box sx={{
          px: { xs: 1.5, sm: 2.5 },
          pb: { xs: 1.25, sm: 1.5 },
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: { xs: 0.5, sm: 0.75 },
          borderTop: '1px solid',
          borderColor: 'divider',
          pt: 1,
        }}>
          {/* Scheduled time */}
          {match.scheduledAt && (
            <Chip
              icon={<CalendarIcon sx={{ fontSize: '0.85rem !important' }} />}
              label={`${formatDateShort(match.scheduledAt)}, ${formatTimeShort(match.scheduledAt)}`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.72rem', height: 26, '& .MuiChip-icon': { ml: 0.5 } }}
            />
          )}

          {/* Round & Slot */}
          {match.round !== null && (
            <Chip
              label={`Runde ${match.round}${match.slot !== null ? ` · Spiel ${match.slot}` : ''}`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.72rem', height: 26 }}
            />
          )}

          {/* Finished badge */}
          {isMatchFinished && !isMatchRunning && (
            <Chip
              icon={<CompletedIcon sx={{ fontSize: '0.85rem !important' }} />}
              label="Beendet"
              size="small"
              sx={{
                fontSize: '0.72rem',
                height: 26,
                bgcolor: alpha(theme.palette.text.secondary, 0.08),
                color: 'text.secondary',
                '& .MuiChip-icon': { color: 'text.secondary' },
              }}
            />
          )}

          {/* Match location (if different from tournament) */}
          {match.location && (
            <Box
              onClick={e => e.stopPropagation()}
              sx={{ display: 'inline-flex', '& a': { fontSize: '0.72rem' }, '& svg': { fontSize: '0.85rem !important' } }}
            >
              <Location
                id={match.location.id}
                name={match.location.name}
                address={match.location.address}
                longitude={match.location.longitude}
                latitude={match.location.latitude}
              />
            </Box>
          )}
        </Box>
      </>
    );

    return (
      <Card
        sx={{
          overflow: 'hidden',
          border: isMatchRunning ? `2px solid ${theme.palette.success.main}` : '1px solid',
          borderColor: isMatchRunning ? 'success.main' : 'divider',
          transition: 'box-shadow 0.2s, transform 0.15s',
          opacity: !isClickable ? 0.7 : 1,
          '&:hover': isClickable ? {
            boxShadow: theme.shadows[6],
            transform: 'translateY(-2px)',
          } : {},
        }}
      >
        {isClickable ? (
          <CardActionArea onClick={() => handleGameClick(match.gameId!)}>
            {cardContent}
          </CardActionArea>
        ) : (
          cardContent
        )}
      </Card>
    );
  };

  // Check if we have settings to display
  const hasSettings = tournament.settings && (
    tournament.settings.roundDuration ||
    tournament.settings.gameMode ||
    tournament.settings.tournamentType ||
    tournament.settings.numberOfGroups
  );

  return (
    <Box sx={{ px: { xs: 1.5, sm: 3 }, py: { xs: 2, sm: 3 }, maxWidth: 960, mx: 'auto' }}>

      {/* ── Back Navigation ── */}
      <Box
        onClick={handleBack}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          mb: 2,
          cursor: 'pointer',
          color: 'text.secondary',
          '&:hover': { color: 'primary.main' },
          transition: 'color 0.15s',
        }}
      >
        <ArrowBackIcon sx={{ fontSize: 18 }} />
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          Zurück zur Übersicht
        </Typography>
      </Box>

      {/* ── Hero Card: Tournament Header ── */}
      <Card sx={{
        overflow: 'hidden',
        mb: 3,
        border: isRunning ? `2px solid ${theme.palette.success.main}` : '1px solid',
        borderColor: isRunning ? 'success.main' : 'divider',
      }}>
        {/* Live Banner */}
        {isRunning && (
          <Box sx={{
            bgcolor: 'success.main',
            color: 'success.contrastText',
            px: 2,
            py: 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}>
            <LiveIcon sx={{ fontSize: 16, animation: 'pulse 1.5s infinite' }} />
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontSize: '0.7rem' }}>
              Turnier läuft
            </Typography>
            <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
          </Box>
        )}

        {/* Tournament Name & Trophy */}
        <Box sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 2.5 }, pb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <TournamentIcon sx={{ color: 'warning.main', fontSize: { xs: 32, sm: 40 } }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5" component="h1" sx={{
                fontWeight: 700,
                fontSize: { xs: '1.2rem', sm: '1.5rem' },
                lineHeight: 1.3,
              }}>
                {tournament.name}
              </Typography>
              {tournament.type && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, fontSize: '0.82rem' }}>
                  {tournament.type}
                </Typography>
              )}
            </Box>
          </Box>

          {/* Status Badge */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {tournament.status === 'upcoming' && (
              <Chip
                icon={<ScheduleIcon sx={{ fontSize: '0.9rem !important' }} />}
                label="Anstehend"
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  height: 26,
                  '& .MuiChip-icon': { color: 'primary.main' },
                }}
              />
            )}
            {tournament.status === 'finished' && (
              <Chip
                icon={<CompletedIcon sx={{ fontSize: '0.9rem !important' }} />}
                label="Abgeschlossen"
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.text.secondary, 0.1),
                  color: 'text.secondary',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  height: 26,
                  '& .MuiChip-icon': { color: 'text.secondary' },
                }}
              />
            )}
          </Box>
        </Box>

        {/* Meta Info Bar */}
        <Box sx={{
          px: { xs: 2, sm: 3 },
          pb: { xs: 2, sm: 2.5 },
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: { xs: 0.75, sm: 1 },
          borderTop: '1px solid',
          borderColor: 'divider',
          pt: 1.5,
        }}>
          {/* Date & Time */}
          {tournament.calendarEvent?.startDate && (
            <Chip
              icon={<CalendarIcon sx={{ fontSize: '0.9rem !important' }} />}
              label={`${formatDateShort(tournament.calendarEvent.startDate)}, ${formatTimeShort(tournament.calendarEvent.startDate)}${tournament.calendarEvent.endDate ? ` – ${formatTimeShort(tournament.calendarEvent.endDate)}` : ''}`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.75rem', height: 28, '& .MuiChip-icon': { ml: 0.5 } }}
            />
          )}

          {/* Match count */}
          <Chip
            icon={<SoccerIcon sx={{ fontSize: '0.9rem !important' }} />}
            label={`${allMatches.length} Spiele`}
            size="small"
            sx={{
              bgcolor: alpha(theme.palette.warning.main, 0.1),
              color: 'warning.dark',
              fontWeight: 600,
              fontSize: '0.75rem',
              height: 28,
              '& .MuiChip-icon': { color: 'warning.dark' },
            }}
          />

          {/* Team count */}
          {tournament.teams.length > 0 && (
            <Chip
              icon={<TeamsIcon sx={{ fontSize: '0.9rem !important' }} />}
              label={`${tournament.teams.length} Teams`}
              size="small"
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                color: 'primary.dark',
                fontWeight: 600,
                fontSize: '0.75rem',
                height: 28,
                '& .MuiChip-icon': { color: 'primary.dark' },
              }}
            />
          )}

          {/* Location */}
          {tournament.location && (
            <Box sx={{ display: 'inline-flex', '& a': { fontSize: '0.75rem' }, '& svg': { fontSize: '0.9rem !important' } }}>
              <Location
                id={tournament.location.id}
                name={tournament.location.name}
                address={tournament.location.address}
                longitude={tournament.location.longitude}
                latitude={tournament.location.latitude}
              />
            </Box>
          )}

          {/* Weather */}
          {tournament.calendarEvent && (
            <Box
              onClick={() => openWeatherModal(tournament.calendarEvent!.id)}
              sx={{
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                ml: 'auto',
                '&:hover': { opacity: 0.7 },
              }}
              title="Wetterdetails anzeigen"
            >
              <WeatherDisplay
                code={Array.isArray(tournament.calendarEvent.weatherData?.weatherCode) ? tournament.calendarEvent.weatherData.weatherCode[0] : undefined}
                theme={'light'}
                size={28}
              />
            </Box>
          )}
        </Box>

        {/* Settings row */}
        {hasSettings && (
          <Box sx={{
            px: { xs: 2, sm: 3 },
            pb: { xs: 1.5, sm: 2 },
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 0.75,
            borderTop: '1px solid',
            borderColor: 'divider',
            pt: 1.25,
          }}>
            <SettingsIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
            {tournament.settings?.roundDuration && (
              <Chip
                label={`${tournament.settings.roundDuration} Min. / Halbzeit`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.72rem', height: 24, borderColor: alpha(theme.palette.text.secondary, 0.2) }}
              />
            )}
            {tournament.settings?.gameMode && (
              <Chip
                label={tournament.settings.gameMode}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.72rem', height: 24, borderColor: alpha(theme.palette.text.secondary, 0.2) }}
              />
            )}
            {tournament.settings?.tournamentType && (
              <Chip
                label={tournament.settings.tournamentType}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.72rem', height: 24, borderColor: alpha(theme.palette.text.secondary, 0.2) }}
              />
            )}
            {tournament.settings?.numberOfGroups && (
              <Chip
                label={`${tournament.settings.numberOfGroups} Gruppen`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.72rem', height: 24, borderColor: alpha(theme.palette.text.secondary, 0.2) }}
              />
            )}
          </Box>
        )}

        {/* PDF Download Action */}
        <Box sx={{
          px: { xs: 2, sm: 3 },
          pb: { xs: 2, sm: 2.5 },
          pt: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <Button
            variant="outlined"
            startIcon={<PdfIcon />}
            onClick={async () => {
              try {
                const response = await apiRequest(`/api/tournaments/${tournament.id}/pdf`);
                if (!response.ok) throw new Error('PDF konnte nicht geladen werden');
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                window.open(url, '_blank');
              } catch (err) {
                console.error('PDF error:', err);
              }
            }}
            size="small"
            sx={{
              fontWeight: 600,
              fontSize: '0.82rem',
              borderColor: alpha(theme.palette.primary.main, 0.4),
              color: 'primary.main',
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.06),
                borderColor: 'primary.main',
              },
            }}
          >
            Turnierplan als PDF
          </Button>
        </Box>
      </Card>

      {/* ── Teams Section ── */}
      {tournament.teams.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <SectionHeader
            icon={<TeamsIcon sx={{ color: 'primary.main', fontSize: 22 }} />}
            label="Teams"
            count={tournament.teams.length}
            color={theme.palette.primary.main}
          />
          <Card sx={{ border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{
              px: { xs: 2, sm: 3 },
              py: { xs: 1.5, sm: 2 },
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
            }}>
              {tournament.teams.map(team => {
                const isOwnTeam = userTeamIds.includes(team.teamId);
                return (
                  <Chip
                    key={team.id}
                    label={
                      `${team.name}${team.groupKey ? ` · Gruppe ${team.groupKey}` : ''}${team.seed ? ` #${team.seed}` : ''}`
                    }
                    size="small"
                    sx={{
                      fontWeight: isOwnTeam ? 700 : 500,
                      fontSize: '0.78rem',
                      height: 30,
                      bgcolor: isOwnTeam
                        ? alpha(theme.palette.primary.main, 0.12)
                        : alpha(theme.palette.text.primary, 0.04),
                      color: isOwnTeam ? 'primary.main' : 'text.primary',
                      border: isOwnTeam ? `1.5px solid ${alpha(theme.palette.primary.main, 0.4)}` : '1px solid',
                      borderColor: isOwnTeam ? undefined : 'divider',
                    }}
                  />
                );
              })}
            </Box>
          </Card>
        </Box>
      )}

      {/* ── Filter Toggle ── */}
      {hasUserFilter && (
        <Box sx={{
          mb: 2,
          px: 1,
          py: 1,
          borderRadius: 2,
          bgcolor: alpha(theme.palette.primary.main, 0.04),
          display: 'inline-flex',
        }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showAllMatches}
                onChange={() => setShowAllMatches(prev => !prev)}
                color="primary"
              />
            }
            label={
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                Alle Spiele anzeigen ({allMatches.length} statt {userMatches.length})
              </Typography>
            }
            sx={{ m: 0 }}
          />
        </Box>
      )}

      {/* ── Matches by Stage ── */}
      {Object.keys(matchesByStage).length > 0 ? (
        Object.entries(matchesByStage).map(([stage, matches]) => (
          <Box key={stage} sx={{ mb: 3 }}>
            <SectionHeader
              icon={<SoccerIcon sx={{ color: theme.palette.warning.dark, fontSize: 22 }} />}
              label={stage}
              count={matches.length}
              color={theme.palette.warning.dark}
            />
            <Stack spacing={1.5}>
              {matches.map(match => (
                <MatchCard key={match.id} match={match} />
              ))}
            </Stack>
          </Box>
        ))
      ) : (
        <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
          <SoccerIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
            {allMatches.length > 0
              ? 'Keine Spiele für dein Team'
              : 'Noch keine Spiele'}
          </Typography>
          <Typography variant="body2" color="text.disabled">
            {allMatches.length > 0
              ? 'In diesem Turnier gibt es keine Spiele für dein Team.'
              : 'Es wurden noch keine Turnierspiele angelegt.'}
          </Typography>
        </Box>
      )}

      <WeatherModal
        open={weatherModalOpen}
        onClose={() => setWeatherModalOpen(false)}
        eventId={selectedEventId}
      />
    </Box>
  );
}
