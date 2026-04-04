import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  alpha,
  useTheme,
  Select,
  MenuItem,
  ListSubheader,
  FormControl,
  InputLabel,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  SportsSoccer as SoccerIcon,
  PlayArrow as LiveIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CompletedIcon,
  EmojiEvents as TournamentIcon,
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { fetchGamesOverview, GamesOverviewData } from '../services/games';
import { Game, GameWithScore, TournamentOverview } from '../types/games';
import { useAuth } from '../context/AuthContext';
import Location from '../components/Location';
import { WeatherDisplay } from '../components/WeatherIcons';
import WeatherModal from '../modals/WeatherModal';
import { formatDateTime, formatTime } from '../utils/formatter';

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

export default function Games() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const [data, setData] = useState<GamesOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weatherModalOpen, setWeatherModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | 'all'>('all');
  const [noTeamAssignment, setNoTeamAssignment] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState({
    running: true,
    upcoming: true,
    finished: true,
  });
  const [selectedSeason, setSelectedSeason] = useState<number>(() => {
    const today = new Date();
    return today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  });

  const openWeatherModal = (eventId: number | null) => {
    setSelectedEventId(eventId);
    setWeatherModalOpen(true);
  };

  useEffect(() => {
    loadGamesOverview();
  }, []);

  const loadGamesOverview = async (teamId?: number | 'all', season?: number) => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchGamesOverview(teamId, season ?? selectedSeason);
      if ('error' in result) {
        throw new Error(String(result.error));
      }
      const overviewData = result as GamesOverviewData;
      setData(overviewData);
      if (teamId === undefined) {
        setNoTeamAssignment(overviewData.noTeamAssignment ?? false);
        if (overviewData.userDefaultTeamId) {
          setSelectedTeamId(overviewData.userDefaultTeamId);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Spiele');
    } finally {
      setLoading(false);
    }
  };

  const handleGameClick = (gameId: number) => {
    navigate(`/games/${gameId}`);
  };

  const handleTournamentClick = (tournamentId: number) => {
    navigate(`/tournaments/${tournamentId}`);
  };

  const toggleSection = (section: 'running' | 'upcoming' | 'finished') => {
    setSectionsOpen((prev) => ({ ...prev, [section]: !prev[section] }));
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
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button variant="contained" onClick={() => loadGamesOverview()}>Erneut versuchen</Button>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Alert severity="info">Keine Daten verfügbar</Alert>
      </Box>
    );
  }

  // ─── Game Card Component ──────────────────────────────────────
  const GameCard = ({ game, isRunning = false, score }: {
    game: Game;
    isRunning?: boolean;
    score?: { homeScore: number | null; awayScore: number | null };
  }) => {
    const hasScore = score && score.homeScore !== null && score.awayScore !== null;

    return (
      <Card
        sx={{
          overflow: 'hidden',
          border: isRunning ? `2px solid ${theme.palette.success.main}` : '1px solid',
          borderColor: isRunning ? 'success.main' : 'divider',
          transition: 'box-shadow 0.2s, transform 0.15s',
          '&:hover': {
            boxShadow: theme.shadows[6],
            transform: 'translateY(-2px)',
          },
        }}
      >
        {/* Live-Banner */}
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
              Live
            </Typography>
            <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
          </Box>
        )}

        <CardActionArea onClick={() => handleGameClick(game.id)}>
          {/* Scoreboard Area */}
          <Box sx={{ px: { xs: 1.5, sm: 2.5 }, pt: { xs: 1.5, sm: 2 }, pb: 1 }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: { xs: 1, sm: 2 },
              minHeight: { xs: 48, sm: 56 },
            }}>
              {/* Home Team */}
              <Typography
                sx={{
                  flex: 1,
                  textAlign: 'right',
                  fontWeight: 700,
                  fontSize: { xs: '0.85rem', sm: '0.95rem' },
                  lineHeight: 1.3,
                  wordBreak: 'break-word',
                }}
              >
                {game.homeTeam.name}
              </Typography>

              {/* Score / VS */}
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: { xs: 64, sm: 80 },
                flexShrink: 0,
              }}>
                {hasScore ? (
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    bgcolor: isRunning ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.text.primary, 0.06),
                    borderRadius: 2,
                    px: 1.5,
                    py: 0.5,
                  }}>
                    <Typography sx={{
                      fontWeight: 800,
                      fontSize: { xs: '1.2rem', sm: '1.5rem' },
                      lineHeight: 1,
                      color: isRunning ? 'success.main' : 'text.primary',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {score!.homeScore}
                    </Typography>
                    <Typography sx={{
                      fontWeight: 400,
                      fontSize: { xs: '0.9rem', sm: '1.1rem' },
                      color: 'text.secondary',
                      mx: 0.25,
                    }}>
                      :
                    </Typography>
                    <Typography sx={{
                      fontWeight: 800,
                      fontSize: { xs: '1.2rem', sm: '1.5rem' },
                      lineHeight: 1,
                      color: isRunning ? 'success.main' : 'text.primary',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {score!.awayScore}
                    </Typography>
                  </Box>
                ) : (
                  <Typography sx={{
                    fontWeight: 600,
                    fontSize: { xs: '0.75rem', sm: '0.8rem' },
                    color: 'text.disabled',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}>
                    vs
                  </Typography>
                )}
              </Box>

              {/* Away Team */}
              <Typography
                sx={{
                  flex: 1,
                  textAlign: 'left',
                  fontWeight: 700,
                  fontSize: { xs: '0.85rem', sm: '0.95rem' },
                  lineHeight: 1.3,
                  wordBreak: 'break-word',
                }}
              >
                {game.awayTeam.name}
              </Typography>
            </Box>
          </Box>

          {/* Meta Info Bar */}
          <Box sx={{
            px: { xs: 1.5, sm: 2.5 },
            pb: { xs: 1.5, sm: 2 },
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: { xs: 0.75, sm: 1 },
            borderTop: '1px solid',
            borderColor: 'divider',
            pt: 1,
          }}>
            {/* Date & Time */}
            {game.calendarEvent?.startDate && (
              <Chip
                icon={<CalendarIcon sx={{ fontSize: '0.9rem !important' }} />}
                label={`${formatDateShort(game.calendarEvent.startDate)}, ${formatTimeShort(game.calendarEvent.startDate)}${game.calendarEvent?.endDate ? ` - ${formatTimeShort(game.calendarEvent.endDate)}` : ''}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.75rem', height: 28, '& .MuiChip-icon': { ml: 0.5 } }}
              />
            )}

            {/* Location */}
            {game.location && (
              <Box
                onClick={e => e.stopPropagation()}
                sx={{ display: 'inline-flex', '& a': { fontSize: '0.75rem' }, '& svg': { fontSize: '0.9rem !important' } }}
              >
                <Location
                  id={game.location.id}
                  name={game.location.name}
                  address={game.location.address}
                  longitude={game.location.longitude}
                  latitude={game.location.latitude}
                />
              </Box>
            )}

            {/* Weather */}
            <Box
              onClick={e => {
                e.stopPropagation();
                e.preventDefault();
                openWeatherModal(game.calendarEvent ? game.calendarEvent.id : null);
              }}
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
                code={Array.isArray(game.weatherData?.weatherCode) ? game.weatherData.weatherCode[0] : undefined}
                theme={'light'}
                size={26}
              />
            </Box>
          </Box>
        </CardActionArea>

        {/* Live Action Button */}
        {isRunning && (
          <Box sx={{ px: { xs: 1.5, sm: 2.5 }, pb: { xs: 1.5, sm: 2 } }}>
            <Button
              variant="contained"
              color="success"
              size="small"
              fullWidth
              startIcon={<SoccerIcon />}
              onClick={() => window.open(`/game/${game.id}/events`, '_blank')}
              sx={{ fontWeight: 600 }}
            >
              Spielereignis erfassen
            </Button>
          </Box>
        )}
      </Card>
    );
  };

  // ─── Tournament Card Component ────────────────────────────────
  const TournamentCard = ({ tournament, isRunning = false }: {
    tournament: TournamentOverview;
    isRunning?: boolean;
  }) => (
    <Card
      sx={{
        overflow: 'hidden',
        border: isRunning ? `2px solid ${theme.palette.success.main}` : '1px solid',
        borderColor: isRunning ? 'success.main' : 'divider',
        transition: 'box-shadow 0.2s, transform 0.15s',
        '&:hover': {
          boxShadow: theme.shadows[6],
          transform: 'translateY(-2px)',
        },
      }}
    >
      {/* Live-Banner */}
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
            Live
          </Typography>
        </Box>
      )}

      <CardActionArea onClick={() => handleTournamentClick(tournament.id)}>
        {/* Tournament Header */}
        <Box sx={{ px: { xs: 1.5, sm: 2.5 }, pt: { xs: 1.5, sm: 2 }, pb: 1 }}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 0.5,
          }}>
            <TournamentIcon sx={{ color: 'warning.main', fontSize: { xs: 22, sm: 26 } }} />
            <Typography sx={{
              fontWeight: 700,
              fontSize: { xs: '0.95rem', sm: '1.05rem' },
              lineHeight: 1.3,
              flex: 1,
              wordBreak: 'break-word',
            }}>
              {tournament.name}
            </Typography>
          </Box>

          {/* Match Count Badge */}
          {tournament.matchCount > 0 && (
            <Chip
              label={`${tournament.matchCount} Spiele`}
              size="small"
              sx={{
                mt: 0.5,
                bgcolor: alpha(theme.palette.warning.main, 0.1),
                color: 'warning.dark',
                fontWeight: 600,
                fontSize: '0.72rem',
                height: 24,
              }}
            />
          )}
        </Box>

        {/* Meta Info Bar */}
        <Box sx={{
          px: { xs: 1.5, sm: 2.5 },
          pb: { xs: 1.5, sm: 2 },
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: { xs: 0.75, sm: 1 },
          borderTop: '1px solid',
          borderColor: 'divider',
          pt: 1,
        }}>
          {/* Date & Time */}
          {tournament.calendarEvent?.startDate && (
            <Chip
              icon={<CalendarIcon sx={{ fontSize: '0.9rem !important' }} />}
              label={`${formatDateShort(tournament.calendarEvent.startDate)}, ${formatTimeShort(tournament.calendarEvent.startDate)}${tournament.calendarEvent?.endDate ? ` - ${formatTimeShort(tournament.calendarEvent.endDate)}` : ''}`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.75rem', height: 28, '& .MuiChip-icon': { ml: 0.5 } }}
            />
          )}

          {/* Location */}
          {tournament.location && (
            <Box
              onClick={e => e.stopPropagation()}
              sx={{ display: 'inline-flex', '& a': { fontSize: '0.75rem' }, '& svg': { fontSize: '0.9rem !important' } }}
            >
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
              onClick={e => {
                e.stopPropagation();
                e.preventDefault();
                openWeatherModal(tournament.calendarEvent!.id);
              }}
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
                size={26}
              />
            </Box>
          )}
        </Box>
      </CardActionArea>
    </Card>
  );

  // ─── Section Header Component ─────────────────────────────────
  const SectionHeader = ({ icon, label, count, color, open, onToggle }: {
    icon: React.ReactNode;
    label: string;
    count: number;
    color: string;
    open: boolean;
    onToggle: () => void;
  }) => (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      mb: 2,
      mt: 1,
      p: 0.75,
      borderRadius: 2,
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
      '&:hover': {
        bgcolor: alpha(color, 0.06),
      },
    }}>
      <Box
        onClick={onToggle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flex: 1,
          minWidth: 0,
        }}
      >
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
      <IconButton size="small" onClick={onToggle} aria-label={`${label} ${open ? 'zuklappen' : 'aufklappen'}`}>
        {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </IconButton>
    </Box>
  );

  // ─── Team dropdown data (comes from backend, independent of game filter) ─
  const availableTeams = data.availableTeams || [];
  const myTeams = availableTeams
    .filter(t => (data.userTeamIds || []).includes(t.id))
    .map(t => [t.id, t.name] as [number, string]);
  const otherTeams = availableTeams
    .filter(t => !(data.userTeamIds || []).includes(t.id))
    .map(t => [t.id, t.name] as [number, string]);
  const showTeamFilter = availableTeams.length > 1;

  // ─── Data grouping ────────────────────────────────────────────
  const runningTournaments = (data.tournaments || []).filter(t => t.status === 'running');
  const upcomingTournaments = (data.tournaments || []).filter(t => t.status === 'upcoming');
  const finishedTournaments = (data.tournaments || []).filter(t => t.status === 'finished');
  const hasTournaments = (data.tournaments || []).length > 0;

  const runningCount = data.running_games.length + runningTournaments.length;
  const upcomingCount = data.upcoming_games.length + upcomingTournaments.length;
  const finishedCount = data.finished_games.length + finishedTournaments.length;

  const hasAny = runningCount > 0 || upcomingCount > 0 || finishedCount > 0;

  return (
    <Box sx={{ px: { xs: 1.5, sm: 3 }, py: { xs: 2, sm: 3 }, maxWidth: 960, mx: 'auto' }}>
      {/* Page Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <SoccerIcon sx={{ fontSize: { xs: 28, sm: 32 }, color: 'primary.main' }} />
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, fontSize: { xs: '1.4rem', sm: '1.8rem' } }}>
          Spiele & Turniere
        </Typography>
      </Box>

      {/* Season + Team Filter */}
      <Box
        sx={{
          position: 'sticky',
          top: { xs: 56, md: 64 },
          zIndex: 10,
          bgcolor: 'background.default',
          pt: 1.5,
          pb: 1.5,
          mb: 1.5,
          mx: { xs: -1.5, sm: -3 },
          px: { xs: 1.5, sm: 3 },
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 1.5, sm: 2 }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            {/* Season selector – always visible */}
            <FormControl size="small" sx={{ width: { xs: '100%', sm: 220 } }}>
              <InputLabel id="season-filter-label">Saison</InputLabel>
              <Select
                labelId="season-filter-label"
                label="Saison"
                value={selectedSeason}
                onChange={e => {
                  const v = e.target.value as number;
                  setSelectedSeason(v);
                  loadGamesOverview(selectedTeamId === 'all' ? undefined : selectedTeamId, v);
                }}
              >
                {(data?.availableSeasons ?? [selectedSeason]).map(y => (
                  <MenuItem key={y} value={y}>{y}/{String(y + 1).slice(2)}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Team filter – only for admins / coaches with multiple teams */}
            {showTeamFilter && (
              <FormControl size="small" sx={{ width: { xs: '100%', sm: 320 } }}>
                <InputLabel id="team-filter-label">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <FilterIcon sx={{ fontSize: 16 }} />
                    Team filtern
                  </Box>
                </InputLabel>
                <Select
                  labelId="team-filter-label"
                  label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><FilterIcon sx={{ fontSize: 16 }} />Team filtern</Box>}
                  value={selectedTeamId}
                  onChange={e => {
                    const v = e.target.value as number | 'all';
                    setSelectedTeamId(v);
                    loadGamesOverview(v, selectedSeason);
                  }}
                >
                  <MenuItem value="all">Alle Teams</MenuItem>

                  {myTeams.length > 0 && [
                    <ListSubheader key="my-header" sx={{ fontWeight: 700, lineHeight: '32px', fontSize: '0.75rem', color: 'primary.main' }}>
                      Meine Teams
                    </ListSubheader>,
                    ...myTeams.map(([id, name]) => (
                      <MenuItem key={`my-${id}`} value={id}>{name}</MenuItem>
                    )),
                  ]}

                  {otherTeams.length > 0 && [
                    <ListSubheader key="other-header" sx={{ fontWeight: 700, lineHeight: '32px', fontSize: '0.75rem', color: 'text.secondary' }}>
                      Weitere Teams
                    </ListSubheader>,
                    ...otherTeams.map(([id, name]) => (
                      <MenuItem key={`other-${id}`} value={id}>{name}</MenuItem>
                    )),
                  ]}
                </Select>
              </FormControl>
            )}
          </Stack>
      </Box>

      {/* ── Running ── */}
      {runningCount > 0 && (
        <Box sx={{ mb: 4 }}>
          <SectionHeader
            icon={<LiveIcon sx={{ color: 'success.main', fontSize: 22 }} />}
            label="Laufende Spiele"
            count={runningCount}
            color={theme.palette.success.main}
            open={sectionsOpen.running}
            onToggle={() => toggleSection('running')}
          />
          <Collapse in={sectionsOpen.running} timeout="auto" unmountOnExit>
            <Stack spacing={2}>
              {data.running_games.map(game => (
                <GameCard key={`running-game-${game.id}`} game={game} isRunning />
              ))}
              {runningTournaments.map(t => (
                <TournamentCard key={`running-tournament-${t.id}`} tournament={t} isRunning />
              ))}
            </Stack>
          </Collapse>
        </Box>
      )}

      {/* ── Upcoming ── */}
      {upcomingCount > 0 && (
        <Box sx={{ mb: 4 }}>
          <SectionHeader
            icon={<ScheduleIcon sx={{ color: 'primary.main', fontSize: 22 }} />}
            label="Anstehende Spiele"
            count={upcomingCount}
            color={theme.palette.primary.main}
            open={sectionsOpen.upcoming}
            onToggle={() => toggleSection('upcoming')}
          />
          <Collapse in={sectionsOpen.upcoming} timeout="auto" unmountOnExit>
            <Stack spacing={2}>
              {data.upcoming_games.map(game => (
                <GameCard key={`upcoming-game-${game.id}`} game={game} />
              ))}
              {upcomingTournaments.map(t => (
                <TournamentCard key={`upcoming-tournament-${t.id}`} tournament={t} />
              ))}
            </Stack>
          </Collapse>
        </Box>
      )}

      {/* ── Finished ── */}
      {finishedCount > 0 && (
        <Box sx={{ mb: 4 }}>
          <SectionHeader
            icon={<CompletedIcon sx={{ color: 'text.secondary', fontSize: 22 }} />}
            label="Abgeschlossene Spiele"
            count={finishedCount}
            color={theme.palette.text.secondary}
            open={sectionsOpen.finished}
            onToggle={() => toggleSection('finished')}
          />
          <Collapse in={sectionsOpen.finished} timeout="auto" unmountOnExit>
            <Stack spacing={2}>
              {data.finished_games.map(gameData => (
                <GameCard
                  key={`finished-game-${gameData.game.id}`}
                  game={gameData.game}
                  score={{ homeScore: gameData.homeScore, awayScore: gameData.awayScore }}
                />
              ))}
              {finishedTournaments.map(t => (
                <TournamentCard key={`finished-tournament-${t.id}`} tournament={t} />
              ))}
            </Stack>
          </Collapse>
        </Box>
      )}

      {/* Empty State */}
      {!hasAny && (
        noTeamAssignment && selectedTeamId === 'all'
          ? (
            <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
              <FilterIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Kein Team ausgewählt
              </Typography>
              <Typography variant="body2" color="text.disabled">
                Du bist keinem Team zugeordnet. Wähle über den Filter oben ein Team aus, um dessen Spiele zu sehen.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
              <SoccerIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Keine Spiele oder Turniere
              </Typography>
              <Typography variant="body2" color="text.disabled">
                Für dieses Team sind aktuell keine Spiele oder Turniere vorhanden.
              </Typography>
            </Box>
          )
      )}

      <WeatherModal
        open={weatherModalOpen}
        onClose={() => setWeatherModalOpen(false)}
        eventId={selectedEventId}
      />
    </Box>
  );
}