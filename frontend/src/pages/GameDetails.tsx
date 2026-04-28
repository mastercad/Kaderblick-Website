import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  Alert,
  CircularProgress,
  IconButton,
  Fab,
  Icon,
  Link,
  Stack,
  Divider,
  alpha,
  useTheme,
  TextField,
  Collapse,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  LocalHospital as LocalHospitalIcon,
  SportsSoccer as SoccerIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  VideoLibrary as VideoIcon,
  CalendarToday as CalendarIcon,
  Sync as SyncIcon,
  LocationOn as LocationIcon,
  ContentCut as ContentCutIcon,
  PlayArrow as LiveIcon,
  AccessTime as TimeIcon,
  CheckCircle as CheckCircleIcon,
  SportsScore as SportsScoreIcon,
  Timer as TimerIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { 
  fetchGameDetails, 
  fetchGameEvents,
  deleteGameEvent, 
  syncFussballDe,
  finishGame,
  updateGameTiming,
} from '../services/games';
import { fetchVideos, saveVideo, deleteVideo, Video, YoutubeLink, Camera } from '../services/videos';
import { getApiErrorMessage } from '../utils/api';
import VideoModal from '../modals/VideoModal';
import VideoPlayModal from '../modals/VideoPlayModal';
import { VideoSegmentModal } from '../modals/VideoSegmentModal';
import { Game, GameEvent } from '../types/games';
import { useAuth } from '../context/AuthContext';
import { ToastProvider, useToast } from '../context/ToastContext';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { GameEventModal } from '../modals/GameEventModal';
import Location from '../components/Location';
import { getGameEventIconByCode } from '../constants/gameEventIcons';
import YouTubeIcon from '@mui/icons-material/YouTube';
import WeatherModal from '../modals/WeatherModal';
import { WeatherDisplay } from '../components/WeatherIcons';
import { formatEventTime, formatDateTime } from '../utils/formatter';
import EmptyStateHint from '../components/EmptyStateHint';
import { UserAvatar } from '../components/UserAvatar';
import { getAvatarFrameUrl } from '../utils/avatarFrame';
import { calculateCumulativeOffset } from '../utils/videoTimeline';
import { SupporterApplicationModal } from '../modals/SupporterApplicationModal';
import GameMatchPlanCard from '../components/GameMatchPlanCard';

/** Helper: format date to "Sa, 15. Mär 2025" style */
const formatDateNice = (dateString: string) => {
  const date = new Date(dateString);
  const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  return `${days[date.getDay()]}, ${date.getDate()}. ${months[date.getMonth()]} ${date.getFullYear()}`;
};

const formatTimeNice = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

/** Format video length seconds to mm:ss */
const formatVideoLength = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

interface GameDetailsProps {
  gameId?: number;
  onBack?: () => void;
}

type DetailSectionKey = 'matchPlan' | 'events' | 'videos' | 'timing';

interface DetailSectionHeaderProps {
  icon: React.ReactNode;
  label: string;
  count?: React.ReactNode;
  color: string;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  testId?: string;
}

const DetailSectionHeader = ({
  icon,
  label,
  count,
  color,
  open,
  onToggle,
  action,
  testId,
}: DetailSectionHeaderProps) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      mb: 1.25,
      mt: 1,
      p: 0.75,
      borderRadius: 2,
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
      '&:hover': {
        bgcolor: alpha(color, 0.06),
      },
    }}
    onClick={onToggle}
    data-testid={testId}
  >
    <Box
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
      {count !== undefined && count !== null && (
        <Chip
          label={count}
          size="small"
          sx={{
            bgcolor: alpha(color, 0.12),
            color,
            fontWeight: 700,
            fontSize: '0.75rem',
            height: 22,
            minWidth: 22,
          }}
        />
      )}
    </Box>
    {action && (
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        onClick={(event) => event.stopPropagation()}
      >
        {action}
      </Box>
    )}
    <IconButton
      size="small"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      aria-label={`${label} ${open ? 'zuklappen' : 'aufklappen'}`}
    >
      {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
    </IconButton>
  </Box>
);

function GameDetailsInner({ gameId: propGameId, onBack }: GameDetailsProps) {
  // Ref für Video-Player-API
  const videoPlayerRef = useRef<any>(null);
  // State für Video-Event-Modal (im VideoPlayModal!)
  const [videoEventFormOpen, setVideoEventFormOpen] = useState(false);
  const [videoEventInitialMinute, setVideoEventInitialMinute] = useState<number | undefined>(undefined);

  // Handler für Event-Button: Zeit holen, Video pausieren, Event-Form öffnen (im VideoPlayModal)
  const handleCreateEventFromVideo = async () => {
    let seconds: number = 0;
    if (videoPlayerRef.current && typeof videoPlayerRef.current.getCurrentTime === 'function') {
      const sec = await videoPlayerRef.current.getCurrentTime();
      videoPlayerRef.current.pauseVideo?.();
      if (typeof sec === 'number' && !isNaN(sec)) {
        // Videozeit minus gameStart (Offset im Video) + kumulativer Offset = Spielzeit
        const gameStartOffset = videoToPlay?.gameStart ?? 0;
        const cumulativeOffset = videoToPlay ? calculateCumulativeOffset(
          videoToPlay as any,
          videos as any
        ) : 0;
        // sec ist absolute Video-Position, ziehe gameStart ab und addiere kumulative Zeit
        seconds = Math.round(sec - gameStartOffset + cumulativeOffset);
      }
    }
    setVideoEventInitialMinute(seconds);
    setVideoEventFormOpen(true);
  };

  // Handler für Mobile-Steuerung: Video-Position wird direkt übergeben
  const handleCreateEventFromVideoAtPosition = (videoPositionSeconds: number) => {
    const gameStartOffset = videoToPlay?.gameStart ?? 0;
    const cumOffset = videoToPlay ? calculateCumulativeOffset(
      videoToPlay as any,
      videos as any
    ) : 0;
    const gameTimeSeconds = Math.round(videoPositionSeconds - gameStartOffset + cumOffset);
    setVideoEventInitialMinute(gameTimeSeconds);
    setVideoEventFormOpen(true);
  };

    // State für Play-Modal
    const [playVideoModalOpen, setPlayVideoModalOpen] = useState(false);
    const [videoToPlay, setVideoToPlay] = useState<Video | null>(null);

    // Handler für Play-Button
    const handleOpenPlayVideo = (video: Video) => {
      setVideoToPlay(video);
      setPlayVideoModalOpen(true);
    };

    const handleClosePlayVideo = () => {
      setPlayVideoModalOpen(false);
      setVideoToPlay(null);
    };
  const { user } = useAuth();
  const { showToast } = useToast();
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  
  // Use URL param if available, otherwise fall back to prop
  const gameId = params.id ? parseInt(params.id, 10) : propGameId;
  
  const [game, setGame] = useState<Game | null>(null);
  const [gameStartDate, setGameStartDate] = useState<string | null>(null);
  const [gameEvents, setGameEvents] = useState<GameEvent[]>([]);
  const [homeScore, setHomeScore] = useState<number | null>(null);
  const [awayScore, setAwayScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventToDelete, setEventToDelete] = useState<GameEvent | null>(null);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<GameEvent | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [videoTypes, setVideoTypes] = useState<any[]>([]);
  const [youtubeLinks, setYoutubeLinks] = useState<YoutubeLink[]>([]);
  const [cameras, setCameras] = useState<any[]>([]);
  const [eventVideos, setEventVideos] = useState<Record<number, Video[]>>({});
  const [mappedCameras, setMappedCameras] = useState<Record<number, string>>({});
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [videoDialogLoading, setVideoDialogLoading] = useState(false);
  const [videoToEdit, setVideoToEdit] = useState<Video | null>(null);
  const [videoToDelete, setVideoToDelete] = useState<Video | null>(null);
  const [videoDeleteLoading, setVideoDeleteLoading] = useState(false);
  const [weatherModalOpen, setWeatherModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [videoSegmentModalOpen, setVideoSegmentModalOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);
  const [supporterApplicationOpen, setSupporterApplicationOpen] = useState(false);

  // Timing state
  const [halfDuration, setHalfDuration] = useState<number>(45);
  const [halftimeBreakDuration, setHalftimeBreakDuration] = useState<number>(15);
  const [firstHalfExtraTime, setFirstHalfExtraTime] = useState<string>('');
  const [secondHalfExtraTime, setSecondHalfExtraTime] = useState<string>('');
  const [timingSaving, setTimingSaving] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState<Record<DetailSectionKey, boolean>>({
    matchPlan: true,
    events: true,
    videos: true,
    timing: false,
  });

  useEffect(() => {
    if (!gameId) {
      setError('Keine Spiel-ID angegeben');
      setLoading(false);
      return;
    }
    loadGameDetails();
    loadVideos();
  }, [gameId]);

  const loadVideos = async () => {
    if (!gameId) return;
    try {
      const res = await fetchVideos(gameId);
      setVideos(res.videos);
      setYoutubeLinks(res.youtubeLinks);
      setVideoTypes(res.videoTypes);
      // Mapping Event-ID -> Videos
      const mapping: Record<number, Video[]> = {};
      if (res.videos) {
        res.videos.forEach((video: any) => {
          if (Array.isArray(video.eventIds)) {
            video.eventIds.forEach((eventId: number) => {
              if (!mapping[eventId]) mapping[eventId] = [];
              mapping[eventId].push(video);
            });
          }
        });
      }
      const mappedCameras: Record<number, string> = {};
      if (res.cameras) {
        res.cameras.forEach((camera: Camera) => {
          if (camera.id) { 
            mappedCameras[camera.id] = camera.name;
          }
        });
      }

      setCameras(res.cameras);
      setMappedCameras(mappedCameras);
      setEventVideos(mapping);
    } catch (e) {
      // Fehler ignorieren, Videos optional
    }
  };

  // Video Handlers
  const handleOpenAddVideo = () => {
    setVideoToEdit(null);
    setVideoDialogOpen(true);
  };

  const handleOpenEditVideo = (video: Video) => {
    setVideoToEdit(video);
    setVideoDialogOpen(true);
  };

  const handleCloseVideoDialog = () => {
    setVideoDialogOpen(false);
    setVideoToEdit(null);
  };

  const handleSaveVideo = async (data: any) => {
    if (!gameId) return;
    setVideoDialogLoading(true);
    try {
      await saveVideo(gameId, data);
      setVideoDialogOpen(false);
      setVideoToEdit(null);
      await loadVideos();
      await loadGameEvents(); // Reload events so timeline has current data
      showToast('Das Video wurde erfolgreich gespeichert.', 'success');
    } catch (e: any) {
      showToast(getApiErrorMessage(e), 'error');
    } finally {
      setVideoDialogLoading(false);
    }
  };

  const handleDeleteVideo = async () => {
    if (!videoToDelete) return;
    setVideoDeleteLoading(true);
    try {
      await deleteVideo(videoToDelete.id);
      setVideoToDelete(null);
      await loadVideos();
      await loadGameEvents(); // Reload events for consistency
    } catch (e: any) {
      showToast(getApiErrorMessage(e), 'error');
    } finally {
      setVideoDeleteLoading(false);
    }
  };

  const loadGameDetails = async () => {
    if (!gameId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await fetchGameDetails(gameId);
      setGame(result.game);
      setGameEvents(result.gameEvents);
      setHomeScore(result.homeScore);
      setAwayScore(result.awayScore);
      setGameStartDate(result.game?.calendarEvent?.startDate ?? null);
      setIsFinished(result.game?.isFinished ?? false);
      // Initialize timing state from game
      setHalfDuration(result.game?.halfDuration ?? 45);
      setHalftimeBreakDuration(result.game?.halftimeBreakDuration ?? 15);
      setFirstHalfExtraTime(result.game?.firstHalfExtraTime != null ? String(result.game.firstHalfExtraTime) : '');
      setSecondHalfExtraTime(result.game?.secondHalfExtraTime != null ? String(result.game.secondHalfExtraTime) : '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Spieldetails');
    } finally {
      setLoading(false);
    }
  };

  // Nur Events laden (für SPA-Feeling)
  const loadGameEvents = async () => {
    if (!gameId) return;
    try {
      const events = await fetchGameEvents(gameId);
      // Repariere Events: Falls timestamp fehlt, berechne ihn aus minute + gameStartDate
      const repairedEvents = events.map(event => {
        if (!event.timestamp && game?.calendarEvent?.startDate && typeof event.minute === 'number') {
          const gameStart = new Date(game.calendarEvent.startDate);
          const eventTime = new Date(gameStart.getTime() + event.minute * 1000);
          return { ...event, timestamp: eventTime.toISOString() };
        }
        return event;
      });
      setGameEvents(repairedEvents);
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete || !gameId) return;
    
    try {
      await deleteGameEvent(gameId, eventToDelete.id);
      setEventToDelete(null);
      // Reload data without showing loading spinner
      const result = await fetchGameDetails(gameId);
      setGame(result.game);
      setGameEvents(result.gameEvents);
      setHomeScore(result.homeScore);
      setAwayScore(result.awayScore);
      setGameStartDate(result.game?.calendarEvent?.startDate ?? null);
      await loadVideos(); // Reload videos to update event mappings
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    }
  };

  const handleSyncFussballDe = async () => {
    if (!game?.fussballDeUrl || !gameId) return;
    
    try {
      setSyncing(true);
      await syncFussballDe(gameId);
      await loadGameDetails(); // Reload data
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveTiming = async () => {
    if (!gameId) return;
    setTimingSaving(true);
    try {
      await updateGameTiming(gameId, {
        halfDuration,
        halftimeBreakDuration,
        firstHalfExtraTime: firstHalfExtraTime !== '' ? parseInt(firstHalfExtraTime, 10) : null,
        secondHalfExtraTime: secondHalfExtraTime !== '' ? parseInt(secondHalfExtraTime, 10) : null,
      });
      showToast('Spielzeiten wurden gespeichert.', 'success');
      await loadGameDetails();
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    } finally {
      setTimingSaving(false);
    }
  };

  const handleEventFormSuccess = async () => {
    setEventFormOpen(false);
    setEventToEdit(null);
    // Reload data without showing loading spinner
    if (!gameId) return;
    try {
      const result = await fetchGameDetails(gameId);
      setGame(result.game);
      setGameEvents(result.gameEvents);
      setHomeScore(result.homeScore);
      setAwayScore(result.awayScore);
      setGameStartDate(result.game?.calendarEvent?.startDate ?? null);
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    }
    await loadVideos(); // Reload videos to update event mappings
  };

  // Nur für Event-Updates (z.B. Drag&Drop auf Timeline) - weniger störend
  const handleEventUpdated = async () => {
    await loadGameEvents(); // Nur Events neu laden für schnelles Update
  };

  const openWeatherModal = (eventId: number | null) => {
    setSelectedEventId(eventId);
    setWeatherModalOpen(true);
  };

  const toggleSection = (section: DetailSectionKey) => {
    setSectionsOpen((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const isGameRunning = () => {
    if (!game?.calendarEvent?.startDate || !game?.calendarEvent?.endDate) return false;
    const now = new Date();
    const start = new Date(game.calendarEvent.startDate);
    const end = new Date(game.calendarEvent.endDate);
    return now >= start && now <= end;
  };

  const canCreateEvents = () => game?.permissions?.can_create_game_events ?? false;

  const handleFinishGame = async () => {
    if (!gameId) return;
    try {
      setFinishing(true);
      const result = await finishGame(gameId);
      setIsFinished(true);
      setConfirmFinishOpen(false);
      if (result.advanced) {
        const adv = result.advanced;
        const msg = adv.gameCreated
          ? `Gewinner weitergeleitet! Nächstes Match: ${adv.homeTeam ?? 'TBD'} vs ${adv.awayTeam ?? 'TBD'} (Spiel erstellt)`
          : `Gewinner weitergeleitet! Nächstes Match: ${adv.homeTeam ?? 'TBD'} vs ${adv.awayTeam ?? 'TBD'}`;
        showToast(msg, 'success');
      } else {
        showToast('Spiel wurde als beendet markiert.', 'success');
      }
      // Reload game details to get updated state
      await loadGameDetails();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Fehler beim Beenden des Spiels',
        'error'
      );
    } finally {
      setFinishing(false);
    }
  };

  const canCreateVideos = () => game?.permissions?.can_create_videos ?? false;

  const handleProtectedEventAction = () => {
    if (canCreateEvents()) {
      setEventToEdit(null);
      setEventFormOpen(true);
      return;
    }

    setSupporterApplicationOpen(true);
  };

  const handleProtectedVideoAction = () => {
    if (canCreateVideos()) {
      handleOpenAddVideo();
      return;
    }

    setSupporterApplicationOpen(true);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={loadGameDetails}>
          Erneut versuchen
        </Button>
      </Box>
    );
  }

  if (!game) {
    return (
      <Box sx={{ p: 3 }}>
        <EmptyStateHint
          icon={<SoccerIcon />}
          title="Spiel nicht gefunden"
          description="Das gesuchte Spiel konnte nicht gefunden werden."
        />
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 1.5, sm: 3 }, py: { xs: 2, sm: 3 }, maxWidth: 960, mx: 'auto' }}>
      {/* ── Back Navigation ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <IconButton
          onClick={() => {
            if (onBack) {
              onBack();
            } else if (game?.tournamentId) {
              navigate(`/tournaments/${game.tournamentId}`);
            } else {
              navigate('/games');
            }
          }}
          sx={{ mr: 1 }}
          size="small"
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
          {game?.tournamentId ? 'Zurück zum Turnier' : 'Zurück zur Übersicht'}
        </Typography>
      </Box>

      {/* ══════════════════════════════════════════════════
          SCOREBOARD HERO CARD
         ══════════════════════════════════════════════════ */}
      <Card sx={{
        mb: 3,
        overflow: 'hidden',
        border: isGameRunning() ? `2px solid ${theme.palette.success.main}` : '1px solid',
        borderColor: isGameRunning() ? 'success.main' : 'divider',
      }}>
        {/* Live banner */}
        {isGameRunning() && (
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

        <CardContent sx={{ px: { xs: 2, sm: 4 }, py: { xs: 2.5, sm: 3 } }}>
          {/* Scoreboard: Home - Score - Away */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: { xs: 1.5, sm: 3 },
            mb: 2,
          }}>
            {/* Home Team */}
            <Box sx={{ flex: 1, textAlign: 'center' }}>
              <Typography sx={{
                fontWeight: 700,
                fontSize: { xs: '1rem', sm: '1.3rem' },
                lineHeight: 1.3,
                wordBreak: 'break-word',
              }}>
                {game.homeTeam.name}
              </Typography>
            </Box>

            {/* Score */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: { xs: 80, sm: 120 },
              flexShrink: 0,
            }}>
              {homeScore !== null && awayScore !== null ? (
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: { xs: 0.75, sm: 1 },
                  bgcolor: isGameRunning()
                    ? alpha(theme.palette.success.main, 0.1)
                    : alpha(theme.palette.primary.main, 0.06),
                  borderRadius: 2,
                  px: { xs: 1.5, sm: 2.5 },
                  py: { xs: 0.75, sm: 1 },
                }}>
                  <Typography sx={{
                    fontWeight: 800,
                    fontSize: { xs: '1.6rem', sm: '2.2rem' },
                    lineHeight: 1,
                    color: isGameRunning() ? 'success.main' : 'text.primary',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {homeScore}
                  </Typography>
                  <Typography sx={{
                    fontWeight: 300,
                    fontSize: { xs: '1.2rem', sm: '1.6rem' },
                    color: 'text.secondary',
                  }}>
                    :
                  </Typography>
                  <Typography sx={{
                    fontWeight: 800,
                    fontSize: { xs: '1.6rem', sm: '2.2rem' },
                    lineHeight: 1,
                    color: isGameRunning() ? 'success.main' : 'text.primary',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {awayScore}
                  </Typography>
                </Box>
              ) : (
                <Typography sx={{
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  color: 'text.disabled',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}>
                  vs
                </Typography>
              )}
            </Box>

            {/* Away Team */}
            <Box sx={{ flex: 1, textAlign: 'center' }}>
              <Typography sx={{
                fontWeight: 700,
                fontSize: { xs: '1rem', sm: '1.3rem' },
                lineHeight: 1.3,
                wordBreak: 'break-word',
              }}>
                {game.awayTeam.name}
              </Typography>
            </Box>
          </Box>

          {/* Meta Info Bar */}
          <Box sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: { xs: 0.75, sm: 1.5 },
            borderTop: '1px solid',
            borderColor: 'divider',
            pt: 2,
          }}>
            {/* Date */}
            {game.calendarEvent?.startDate && (
              <Chip
                icon={<CalendarIcon sx={{ fontSize: '0.9rem !important' }} />}
                label={`${formatDateNice(game.calendarEvent.startDate)}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.8rem', height: 30, '& .MuiChip-icon': { ml: 0.5 } }}
              />
            )}
            {/* Time */}
            {game.calendarEvent?.startDate && (
              <Chip
                icon={<TimeIcon sx={{ fontSize: '0.9rem !important' }} />}
                label={`${formatTimeNice(game.calendarEvent.startDate)}${game.calendarEvent.endDate ? ` – ${formatTimeNice(game.calendarEvent.endDate)}` : ''} Uhr`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.8rem', height: 30, '& .MuiChip-icon': { ml: 0.5 } }}
              />
            )}
            {/* Location */}
            {game.location && (
              <Box sx={{ display: 'inline-flex', '& a': { fontSize: '0.8rem' }, '& svg': { fontSize: '1rem !important' } }}>
                <Location
                  id={game.location.id}
                  name={game.location.name}
                  latitude={game.location.latitude}
                  longitude={game.location.longitude}
                  address={game.location.address}
                />
              </Box>
            )}
            {/* Weather */}
            <Box
              onClick={() => openWeatherModal(game.calendarEvent?.id ?? null)}
              sx={{
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                '&:hover': { opacity: 0.7 },
              }}
              title="Wetterdetails anzeigen"
            >
              <WeatherDisplay
                code={game.weatherData?.dailyWeatherData?.weathercode?.[0]}
                theme={'light'}
                size={30}
              />
            </Box>
          </Box>

          {/* Fussball.de Sync */}
          {game.fussballDeUrl && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button
                variant="outlined"
                startIcon={<SyncIcon />}
                onClick={handleSyncFussballDe}
                disabled={syncing}
                size="small"
              >
                {syncing ? 'Synchronisiere...' : 'Mit Fussball.de synchronisieren'}
              </Button>
            </Box>
          )}

          {/* Spiel beenden Button */}
          {(game?.permissions?.can_finish_game ?? false) && !isFinished && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button
                variant="contained"
                color="success"
                startIcon={<SportsScoreIcon />}
                onClick={() => setConfirmFinishOpen(true)}
                disabled={finishing}
                size="small"
              >
                {finishing ? 'Wird beendet...' : 'Spiel beenden'}
              </Button>
            </Box>
          )}
          {isFinished && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5, mt: 2 }}>
              <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
              <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 600 }}>
                Spiel beendet
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {(game.permissions?.can_manage_match_plan || game.permissions?.can_view_match_plan) && (
        <Box sx={{ mb: 3 }}>
          <DetailSectionHeader
            icon={<SoccerIcon sx={{ color: 'primary.main', fontSize: 22 }} />}
            label="Match-Plan"
            count={game.matchPlan?.phases?.length ?? 0}
            color={theme.palette.primary.main}
            open={sectionsOpen.matchPlan}
            onToggle={() => toggleSection('matchPlan')}
            testId="match-plan-section-header"
          />
          <Collapse in={sectionsOpen.matchPlan} timeout="auto" unmountOnExit>
            <GameMatchPlanCard
              game={game}
              onUpdated={async () => {
                await loadGameDetails();
              }}
            />
          </Collapse>
        </Box>
      )}

      {/* ══════════════════════════════════════════════════
          GAME EVENTS
         ══════════════════════════════════════════════════ */}
      <Box sx={{ mb: 3 }}>
        <DetailSectionHeader
          icon={<SoccerIcon sx={{ color: 'primary.main', fontSize: 22 }} />}
          label="Spielereignisse"
          count={gameEvents.length}
          color={theme.palette.primary.main}
          open={sectionsOpen.events}
          onToggle={() => toggleSection('events')}
          testId="events-section-header"
          action={(
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />}
              onClick={handleProtectedEventAction}
              sx={{ fontSize: '0.8rem', minWidth: { xs: 32, sm: 'auto' }, px: { xs: 1, sm: 1.5 } }}
              aria-label="Event hinzufügen"
            >
              <AddIcon sx={{ display: { xs: 'inline-flex', sm: 'none' }, fontSize: '1.1rem' }} />
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Event hinzufügen</Box>
            </Button>
          )}
        />
        <Collapse in={sectionsOpen.events} timeout="auto" unmountOnExit>
          <Card className="gameevents-mobile-card" sx={{ overflow: 'hidden' }}>
            <CardContent sx={{ px: { xs: 1.5, sm: 3 }, py: { xs: 1, sm: 2 } }}>
          {gameEvents.length > 0 ? (
            <Stack spacing={0} divider={<Divider sx={{ mx: -1.5 }} />}>
              {gameEvents.map((event) => {
                const videosForEvent = youtubeLinks[event.id] || [];

                const e = event as any;
                let playerDisplay = '';
                let minute = 0;
                let code = '';
                let icon = '';
                let color = '#FFF';

                if (typeof e.player === 'string') {
                  playerDisplay = e.player;
                } else if (e.player && typeof e.player === 'object') {
                  playerDisplay = `${e.player.firstName ?? ''} ${e.player.lastName ?? ''}`.trim();
                }
                if (e.minute) {
                  const totalSeconds = Math.round(e.minute);
                  const mins = Math.floor(totalSeconds / 60);
                  const secs = totalSeconds % 60;
                  minute = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}` as unknown as number;
                } else if (e.timestamp) {
                  minute = formatEventTime(e.timestamp, gameStartDate ?? '') as unknown as number;
                }
                if (e.code) {
                  code = e.code;
                } else if (e.gameEventType?.code) {
                  code = e.gameEventType.code;
                }
                if (e.icon) {
                  icon = e.icon;
                } else if (e.gameEventType?.icon) {
                  icon = e.gameEventType.icon;
                }
                if (e.color) {
                  color = e.color;
                } else if (e.gameEventType?.color) {
                  color = e.gameEventType?.color;
                }

                // Substitution helpers
                const SUBSTITUTION_CODES = ['substitution', 'substitution_out', 'substitution_injury', 'substitution_in'];
                const isSubstitution = SUBSTITUTION_CODES.includes(code);
                // player = OUT for substitution/substitution_out/substitution_injury; player = IN for substitution_in
                const playerOut = code === 'substitution_in' ? e.relatedPlayer : e.player;
                const playerIn  = code === 'substitution_in' ? e.player : e.relatedPlayer;
                const playerOutDisplay = playerOut && typeof playerOut === 'object'
                  ? `${playerOut.firstName ?? ''} ${playerOut.lastName ?? ''}`.trim()
                  : (typeof playerOut === 'string' ? playerOut : '');
                const playerInDisplay  = playerIn  && typeof playerIn  === 'object'
                  ? `${playerIn.firstName  ?? ''} ${playerIn.lastName  ?? ''}`.trim()
                  : (typeof playerIn  === 'string' ? playerIn  : '');

                return (
                  <Box
                    key={e.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: { xs: 1, sm: 2 },
                      py: { xs: 1.25, sm: 1.5 },
                      '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.5) },
                      borderRadius: 1,
                      px: { xs: 0.5, sm: 1 },
                    }}
                  >
                    {/* Event Icon — separate column on desktop (first) */}
                    <Box sx={{
                      display: { xs: 'none', sm: 'flex' },
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: alpha(color || '#999', 0.12),
                      flexShrink: 0,
                      mt: 0.25,
                    }}>
                      <Box sx={{ color: color || 'text.secondary', display: 'flex', alignItems: 'center', fontSize: '1rem' }}>
                        {getGameEventIconByCode(icon)}
                      </Box>
                    </Box>

                    {/* Icon (mobile) + Minute Badge */}
                    <Box sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.5,
                      minWidth: { xs: 44, sm: 56 },
                      flexShrink: 0,
                      pt: 0.25,
                    }}>
                      {/* Event Icon — on top on mobile only */}
                      <Box sx={{
                        display: { xs: 'flex', sm: 'none' },
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        bgcolor: alpha(color || '#999', 0.12),
                      }}>
                        <Box sx={{ color: color || 'text.secondary', display: 'flex', alignItems: 'center', fontSize: '0.9rem' }}>
                          {getGameEventIconByCode(icon)}
                        </Box>
                      </Box>
                      <Chip
                        label={minute ?? ''}
                        size="small"
                        sx={{
                          bgcolor: 'grey.100',
                          color: 'text.primary',
                          fontWeight: 700,
                          fontSize: { xs: '0.72rem', sm: '0.8rem' },
                          height: 26,
                          minWidth: { xs: 44, sm: 56 },
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                    </Box>

                    {/* Content */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      {/* Event type name */}
                      <Typography sx={{
                        fontWeight: 700,
                        fontSize: { xs: '0.88rem', sm: '0.95rem' },
                        lineHeight: 1.3,
                      }}>
                        {e.type ?? e?.gameEventType?.name ?? 'Unbekannt'}
                      </Typography>

                      {/* Player / Substitution display */}
                      {isSubstitution ? (
                        <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {/* Player coming IN */}
                          {(playerIn || playerInDisplay) && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <ArrowUpwardIcon sx={{ fontSize: 15, color: 'success.main', flexShrink: 0 }} />
                              <UserAvatar
                                icon={typeof playerIn === 'object' ? playerIn?.playerAvatarUrl : undefined}
                                name={playerInDisplay || 'Unbekannt'}
                                avatarSize={22}
                                fontSize={11}
                                titleObj={typeof playerIn === 'object' && playerIn?.titleData?.hasTitle ? playerIn.titleData : undefined}
                                level={typeof playerIn === 'object' && typeof playerIn?.level === 'number' ? playerIn.level : undefined}
                              />
                              <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600, ml: 0.25 }}>rein</Typography>
                            </Box>
                          )}
                          {/* Player going OUT */}
                          {(playerOut || playerOutDisplay) && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {code === 'substitution_injury'
                                ? <LocalHospitalIcon sx={{ fontSize: 15, color: 'warning.main', flexShrink: 0 }} />
                                : <ArrowDownwardIcon sx={{ fontSize: 15, color: 'error.main', flexShrink: 0 }} />}
                              <UserAvatar
                                icon={typeof playerOut === 'object' ? playerOut?.playerAvatarUrl : undefined}
                                name={playerOutDisplay || 'Unbekannt'}
                                avatarSize={22}
                                fontSize={11}
                                titleObj={typeof playerOut === 'object' && playerOut?.titleData?.hasTitle ? playerOut.titleData : undefined}
                                level={typeof playerOut === 'object' && typeof playerOut?.level === 'number' ? playerOut.level : undefined}
                              />
                              <Typography variant="caption" sx={{ color: code === 'substitution_injury' ? 'warning.main' : 'error.main', fontWeight: 600, ml: 0.25 }}>
                                {code === 'substitution_injury' ? 'raus (verletzt)' : 'raus'}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                          <UserAvatar
                            icon={e.player?.playerAvatarUrl}
                            name={playerDisplay || 'Unbekannt'}
                            avatarSize={22}
                            fontSize={11}
                            titleObj={e.player?.titleData && e.player?.titleData.hasTitle ? e.player.titleData : undefined}
                            level={typeof e.player?.level === 'number' ? e.player.level : undefined}
                          />
                        </Box>
                      )}

                      {/* Description */}
                      {e.description && (
                        <Typography variant="body2" sx={{
                          color: 'text.secondary',
                          fontStyle: 'italic',
                          mt: 0.5,
                          fontSize: { xs: '0.78rem', sm: '0.85rem' },
                        }}>
                          {e.description}
                        </Typography>
                      )}

                      {/* Video Links */}
                      {Object.keys(videosForEvent).length > 0 && (
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                          {Object.entries(videosForEvent).map((currentVideo) => (
                            <Link
                              key={currentVideo[0]}
                              href={currentVideo[1]}
                              target="_blank"
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.3,
                                fontSize: '0.78rem',
                                textDecoration: 'none',
                                '&:hover': { textDecoration: 'underline' },
                              }}
                            >
                              <YouTubeIcon sx={{ fontSize: 14, color: 'error.main' }} />
                              {mappedCameras[Number(currentVideo[0])]}
                            </Link>
                          ))}
                        </Box>
                      )}
                    </Box>

                    {/* Actions */}
                    {canCreateEvents() && (
                      <Box sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.25,
                        flexShrink: 0,
                        opacity: { xs: 1, sm: 0.4 },
                        transition: 'opacity 0.2s',
                        '.MuiBox-root:hover > &': { opacity: 1 },
                        'div:hover > &': { opacity: 1 },
                      }}>
                        <IconButton
                          size="small"
                          aria-label="Ereignis bearbeiten"
                          onClick={() => {
                            setEventToEdit(event);
                            setEventFormOpen(true);
                          }}
                          sx={{ p: 0.5 }}
                        >
                          <EditIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label="Ereignis löschen"
                          onClick={() => setEventToDelete(event)}
                          sx={{ p: 0.5 }}
                        >
                          <DeleteIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Stack>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <SoccerIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary" variant="body2">
                Keine Ereignisse für dieses Spiel.
              </Typography>
            </Box>
          )}
            </CardContent>
          </Card>
        </Collapse>
      </Box>

      {/* ══════════════════════════════════════════════════
          VIDEOS
         ══════════════════════════════════════════════════ */}
      <Box sx={{ mb: 3 }}>
        <DetailSectionHeader
          icon={<VideoIcon sx={{ color: 'primary.main', fontSize: 22 }} />}
          label="Videos"
          count={videos.length}
          color={theme.palette.primary.main}
          open={sectionsOpen.videos}
          onToggle={() => toggleSection('videos')}
          testId="videos-section-header"
          action={(
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {videos.length > 0 && (
                <Button
                  variant="outlined"
                  startIcon={<ContentCutIcon sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />}
                  size="small"
                  onClick={() => setVideoSegmentModalOpen(true)}
                  sx={{ fontSize: '0.8rem', minWidth: { xs: 32, sm: 'auto' }, px: { xs: 1, sm: 1.5 } }}
                  aria-label="Schnittliste"
                >
                  <ContentCutIcon sx={{ display: { xs: 'inline-flex', sm: 'none' }, fontSize: '1.1rem' }} />
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Schnittliste</Box>
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={<VideoIcon sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />}
                size="small"
                onClick={handleProtectedVideoAction}
                sx={{ fontSize: '0.8rem', minWidth: { xs: 32, sm: 'auto' }, px: { xs: 1, sm: 1.5 } }}
                aria-label="Video hinzufügen"
              >
                <VideoIcon sx={{ display: { xs: 'inline-flex', sm: 'none' }, fontSize: '1.1rem' }} />
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Video hinzufügen</Box>
              </Button>
            </Box>
          )}
        />
        <Collapse in={sectionsOpen.videos} timeout="auto" unmountOnExit>
          <Card className="gamevideos-mobile-card" sx={{ overflow: 'hidden' }}>
            <CardContent sx={{ px: { xs: 1.5, sm: 3 }, py: { xs: 1, sm: 2 } }}>
          {videos.length > 0 ? (
            <Stack spacing={0} divider={<Divider sx={{ mx: -1.5 }} />}>
              {videos.map((video) => (
                <Box
                  key={video.id}
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: { xs: 1, sm: 2 },
                    py: 1.5,
                    px: { xs: 0.5, sm: 1 },
                    alignItems: { xs: 'stretch', sm: 'flex-start' },
                    '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.5) },
                    borderRadius: 1,
                  }}
                >
                  {/* Thumbnail */}
                  {video.youtubeId && (
                    <Box
                      sx={{
                        flexShrink: 0,
                        width: { xs: '100%', sm: 140 },
                        maxWidth: { xs: '100%', sm: 140 },
                        borderRadius: 1.5,
                        overflow: 'hidden',
                        position: 'relative',
                        cursor: 'pointer',
                        aspectRatio: '16/9',
                        '&:hover': { opacity: 0.9 },
                      }}
                      onClick={() => handleOpenPlayVideo(video)}
                    >
                      <img
                        src={`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`}
                        alt={video.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'block',
                          objectFit: 'cover',
                        }}
                      />
                      {/* Play overlay */}
                      <Box sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'rgba(0,0,0,0.25)',
                        transition: 'background-color 0.2s',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.4)' },
                      }}>
                        <YouTubeIcon sx={{ fontSize: { xs: 44, sm: 32 }, color: '#fff', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }} />
                      </Box>
                    </Box>
                  )}

                  {/* Info + Actions row */}
                  <Box sx={{ display: 'flex', flex: 1, minWidth: 0, gap: 1, alignItems: 'flex-start' }}>
                    {/* Info */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: { xs: '0.9rem', sm: '0.95rem' },
                          lineHeight: 1.3,
                          cursor: 'pointer',
                          color: 'primary.main',
                          '&:hover': { textDecoration: 'underline' },
                        }}
                        onClick={() => handleOpenPlayVideo(video)}
                      >
                        {video.name}
                      </Typography>

                      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.75 }}>
                        {video.videoType?.name && (
                          <Chip label={video.videoType.name} size="small" sx={{ height: 22, fontSize: '0.72rem' }} />
                        )}
                        {video.length != null && video.length > 0 && (
                          <Chip label={formatVideoLength(video.length)} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.72rem' }} />
                        )}
                        {video.camera?.name && (
                          <Chip label={video.camera.name} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.72rem' }} />
                        )}
                      </Box>

                      {video.filePath && (
                        <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5, fontSize: '0.75rem' }}>
                          {video.filePath}
                        </Typography>
                      )}
                    </Box>

                    {/* Actions */}
                    {user && (
                      <Box sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.25,
                        flexShrink: 0,
                        opacity: { xs: 1, sm: 0.4 },
                        transition: 'opacity 0.2s',
                        'div:hover > &': { opacity: 1 },
                      }}>
                        <IconButton size="small" onClick={() => handleOpenPlayVideo(video)} sx={{ p: 0.5 }}>
                          <YouTubeIcon sx={{ fontSize: 18, color: 'error.main' }} />
                        </IconButton>
                        {canCreateVideos() && (
                          <>
                            <IconButton size="small" onClick={() => handleOpenEditVideo(video)} sx={{ p: 0.5 }}>
                              <EditIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                            <IconButton size="small" onClick={() => setVideoToDelete(video)} sx={{ p: 0.5 }}>
                              <DeleteIcon sx={{ fontSize: 18, color: 'error.main' }} />
                            </IconButton>
                          </>
                        )}
                      </Box>
                    )}
                  </Box>
                </Box>
              ))}
            </Stack>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <VideoIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary" variant="body2">
                Keine Videos für dieses Spiel.
              </Typography>
            </Box>
          )}
            </CardContent>
          </Card>
        </Collapse>
      </Box>

      {/* ══════════════════════════════════════════════════
          SPIELZEITEN
         ══════════════════════════════════════════════════ */}
      {(game.permissions?.can_edit_timing || game.halfDuration != null) && (
        <Box sx={{ mb: 3 }}>
          <DetailSectionHeader
            icon={<TimerIcon sx={{ color: 'primary.main', fontSize: 22 }} />}
            label="Spielzeiten"
            count={`${game.halfDuration ?? 45} min`}
            color={theme.palette.primary.main}
            open={sectionsOpen.timing}
            onToggle={() => toggleSection('timing')}
            testId="timing-section-header"
          />

          <Collapse in={sectionsOpen.timing} timeout="auto" unmountOnExit>
            <Card sx={{ overflow: 'hidden' }}>
              <CardContent sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 2.5 } }}>
              {game.permissions?.can_edit_timing ? (
                <Box
                  component="form"
                  onSubmit={(e) => { e.preventDefault(); handleSaveTiming(); }}
                  data-testid="timing-edit-form"
                >
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr 1fr' },
                      gap: 2,
                      mb: 2,
                    }}
                  >
                    <TextField
                      label="Halbzeitdauer (Min)"
                      type="number"
                      value={halfDuration}
                      onChange={(e) => setHalfDuration(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      inputProps={{ min: 1, max: 90, 'data-testid': 'input-halfDuration' }}
                      size="small"
                      fullWidth
                      helperText="z.B. 45 (Erwachsene)"
                    />
                    <TextField
                      label="Halbzeitpause (Min)"
                      type="number"
                      value={halftimeBreakDuration}
                      onChange={(e) => setHalftimeBreakDuration(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      inputProps={{ min: 0, max: 60, 'data-testid': 'input-halftimeBreakDuration' }}
                      size="small"
                      fullWidth
                      helperText="z.B. 15"
                    />
                    <TextField
                      label="Nachspielzeit HZ1 (Min)"
                      type="number"
                      value={firstHalfExtraTime}
                      onChange={(e) => setFirstHalfExtraTime(e.target.value)}
                      inputProps={{ min: 0, max: 30, 'data-testid': 'input-firstHalfExtraTime' }}
                      size="small"
                      fullWidth
                      helperText="leer = nicht erfasst"
                    />
                    <TextField
                      label="Nachspielzeit HZ2 (Min)"
                      type="number"
                      value={secondHalfExtraTime}
                      onChange={(e) => setSecondHalfExtraTime(e.target.value)}
                      inputProps={{ min: 0, max: 30, 'data-testid': 'input-secondHalfExtraTime' }}
                      size="small"
                      fullWidth
                      helperText="leer = nicht erfasst"
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<SaveIcon />}
                      size="small"
                      disabled={timingSaving}
                      data-testid="btn-save-timing"
                    >
                      {timingSaving ? 'Speichern…' : 'Speichern'}
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Halbzeitdauer</Typography>
                    <Typography variant="body2" fontWeight={600}>{game.halfDuration ?? 45} min</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Halbzeitpause</Typography>
                    <Typography variant="body2" fontWeight={600}>{game.halftimeBreakDuration ?? 15} min</Typography>
                  </Box>
                  {game.firstHalfExtraTime != null && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Nachspielzeit HZ1</Typography>
                      <Typography variant="body2" fontWeight={600}>{game.firstHalfExtraTime} min</Typography>
                    </Box>
                  )}
                  {game.secondHalfExtraTime != null && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Nachspielzeit HZ2</Typography>
                      <Typography variant="body2" fontWeight={600}>{game.secondHalfExtraTime} min</Typography>
                    </Box>
                  )}
                </Box>
              )}
              </CardContent>
            </Card>
          </Collapse>
        </Box>
      )}

      {/* Video Play Modal */}      <VideoPlayModal
        ref={videoPlayerRef}
        open={playVideoModalOpen}
        onClose={handleClosePlayVideo}
        videoId={videoToPlay?.youtubeId || undefined}
        videoName={videoToPlay?.name}
        videoObj={videoToPlay ? { 
          id: videoToPlay.id,
          youtubeId: videoToPlay.youtubeId || undefined,
          gameStart: videoToPlay.gameStart ?? null, 
          length: videoToPlay.length ?? 0,
          camera: videoToPlay.camera || undefined
        } : { id: 0, youtubeId: undefined, gameStart: null, length: 0 }}
        gameEvents={gameEvents}
        gameStartDate={gameStartDate || ''}
        gameId={gameId}
        onEventUpdated={handleEventUpdated}
        allVideos={videos}
        youtubeLinks={youtubeLinks}
        onCreateEventAtPosition={handleCreateEventFromVideoAtPosition}
        canCreateEvents={canCreateEvents()}
        onRequestSupporterAccess={() => setSupporterApplicationOpen(true)}
      >
        {canCreateEvents() && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateEventFromVideo}
              color="primary"
            >
              Spielereignis anlegen
            </Button>
          </Box>
        )}
        {/* Das Event-Formular wird als Overlay im VideoPlayModal eingeblendet */}
        <GameEventModal
          open={videoEventFormOpen}
          onClose={() => {
            setVideoEventFormOpen(false);
            setVideoEventInitialMinute(undefined);
            setEventToEdit(null);
          }}
          onSuccess={() => {
            setVideoEventFormOpen(false);
            setVideoEventInitialMinute(undefined);
            setEventToEdit(null);
            handleEventFormSuccess();
          }}
          gameId={gameId!}
          game={game}
          existingEvent={eventToEdit}
          initialMinute={videoEventInitialMinute}
        />
      </VideoPlayModal>

      {/* Video Modal (Bearbeiten/Hinzufügen) */}
      <VideoModal
        open={videoDialogOpen}
        onClose={handleCloseVideoDialog}
        onSave={handleSaveVideo}
        videoTypes={videoTypes}
        cameras={cameras}
        initialData={videoToEdit || undefined}
        loading={videoDialogLoading}
      />

      {/* Video Delete Confirmation */}
      <ConfirmationModal
        open={!!videoToDelete}
        onClose={() => setVideoToDelete(null)}
        onConfirm={handleDeleteVideo}
        title="Video löschen"
        message={`Soll das Video "${videoToDelete?.name}" wirklich gelöscht werden?`}
        confirmText="Löschen"
        confirmColor="error"
      />

      {/* Floating Action Button for quick event creation */}
      <Fab
        color="primary"
        aria-label="Ereignis erfassen"
        sx={{
          position: 'fixed',
          bottom: { xs: 136, sm: 88 },
          right: { xs: 16, sm: 24 },
          zIndex: 10,
        }}
        onClick={handleProtectedEventAction}
      >
        <AddIcon />
      </Fab>

      {/* Confirmation Modal for Event Deletion */}
      <ConfirmationModal
        open={!!eventToDelete}
        onClose={() => setEventToDelete(null)}
        onConfirm={handleDeleteEvent}
        title="Ereignis löschen"
        message={`Soll das Ereignis "${eventToDelete?.gameEventType?.name || eventToDelete?.type || 'Unbekannt'}" wirklich gelöscht werden?`}
        confirmText="Löschen"
        confirmColor="error"
      />

      {/* Confirmation Modal for Finishing Game */}
      <ConfirmationModal
        open={confirmFinishOpen}
        onClose={() => setConfirmFinishOpen(false)}
        onConfirm={handleFinishGame}
        title="Spiel beenden"
        message="Soll das Spiel als beendet markiert werden? Falls es ein Turnierspiel ist, wird der Gewinner automatisch in die nächste Runde weitergeleitet."
        confirmText="Spiel beenden"
        confirmColor="success"
      />

      {/* Game Event Modal außerhalb für andere Fälle (z.B. FAB) */}
      <GameEventModal
        open={eventFormOpen}
        onClose={() => {
          setEventFormOpen(false);
          setEventToEdit(null);
        }}
        onSuccess={handleEventFormSuccess}
        gameId={gameId!}
        game={game}
        existingEvent={eventToEdit}
      />

      <WeatherModal
        open={weatherModalOpen}
        onClose={() => setWeatherModalOpen(false)}
        eventId={selectedEventId}
      />

      {/* Video Segment Modal */}
      <VideoSegmentModal
        open={videoSegmentModalOpen}
        onClose={() => setVideoSegmentModalOpen(false)}
        videos={videos}
        gameId={gameId!}
      />

      <SupporterApplicationModal
        open={supporterApplicationOpen}
        onClose={() => setSupporterApplicationOpen(false)}
      />
    </Box>
  );
}

export default function GameDetails(props: GameDetailsProps) {
  return (
    <ToastProvider>
      <GameDetailsInner {...props} />
    </ToastProvider>
  );
}