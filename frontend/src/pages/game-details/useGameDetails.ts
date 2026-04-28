import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  fetchGameDetails,
  fetchGameEvents,
  deleteGameEvent,
  syncFussballDe,
  finishGame,
  updateGameTiming,
} from '../../services/games';
import { fetchVideos, saveVideo, deleteVideo, Video, Camera } from '../../services/videos';
import { getApiErrorMessage } from '../../utils/api';
import { Game, GameEvent } from '../../types/games';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DetailSectionKey } from './types';

export function useGameDetails(propGameId?: number, onBack?: () => void) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();

  const gameId = params.id ? parseInt(params.id, 10) : propGameId;

  // Core game state
  const [game, setGame] = useState<Game | null>(null);
  const [gameStartDate, setGameStartDate] = useState<string | null>(null);
  const [gameEvents, setGameEvents] = useState<GameEvent[]>([]);
  const [homeScore, setHomeScore] = useState<number | null>(null);
  const [awayScore, setAwayScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);

  // Event state
  const [eventToDelete, setEventToDelete] = useState<GameEvent | null>(null);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<GameEvent | null>(null);

  // Video state
  const [videos, setVideos] = useState<Video[]>([]);
  const [videoTypes, setVideoTypes] = useState<any[]>([]);
  const [youtubeLinks, setYoutubeLinks] = useState<any[]>([]);
  const [cameras, setCameras] = useState<any[]>([]);
  const [eventVideos, setEventVideos] = useState<Record<number, Video[]>>({});
  const [mappedCameras, setMappedCameras] = useState<Record<number, string>>({});
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [videoDialogLoading, setVideoDialogLoading] = useState(false);
  const [videoToEdit, setVideoToEdit] = useState<Video | null>(null);
  const [videoToDelete, setVideoToDelete] = useState<Video | null>(null);
  const [videoDeleteLoading, setVideoDeleteLoading] = useState(false);
  const [videoSegmentModalOpen, setVideoSegmentModalOpen] = useState(false);

  // Modal state
  const [weatherModalOpen, setWeatherModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [supporterApplicationOpen, setSupporterApplicationOpen] = useState(false);

  // Timing state
  const [halfDuration, setHalfDuration] = useState<number>(45);
  const [halftimeBreakDuration, setHalftimeBreakDuration] = useState<number>(15);
  const [firstHalfExtraTime, setFirstHalfExtraTime] = useState<string>('');
  const [secondHalfExtraTime, setSecondHalfExtraTime] = useState<string>('');
  const [timingSaving, setTimingSaving] = useState(false);

  // Section open/close state
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

  const loadGameEvents = async () => {
    if (!gameId) return;
    try {
      const events = await fetchGameEvents(gameId);
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

  const loadVideos = async () => {
    if (!gameId) return;
    try {
      const res = await fetchVideos(gameId);
      setVideos(res.videos);
      setYoutubeLinks(res.youtubeLinks);
      setVideoTypes(res.videoTypes);

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

      const newMappedCameras: Record<number, string> = {};
      if (res.cameras) {
        res.cameras.forEach((camera: Camera) => {
          if (camera.id) {
            newMappedCameras[camera.id] = camera.name;
          }
        });
      }

      setCameras(res.cameras);
      setMappedCameras(newMappedCameras);
      setEventVideos(mapping);
    } catch {
      // Videos optional — Fehler ignorieren
    }
  };

  // ── Event handlers ──────────────────────────────────────────

  const handleDeleteEvent = async () => {
    if (!eventToDelete || !gameId) return;
    try {
      await deleteGameEvent(gameId, eventToDelete.id);
      setEventToDelete(null);
      const result = await fetchGameDetails(gameId);
      setGame(result.game);
      setGameEvents(result.gameEvents);
      setHomeScore(result.homeScore);
      setAwayScore(result.awayScore);
      setGameStartDate(result.game?.calendarEvent?.startDate ?? null);
      await loadVideos();
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    }
  };

  const handleEventFormSuccess = async () => {
    setEventFormOpen(false);
    setEventToEdit(null);
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
    await loadVideos();
  };

  const handleEventUpdated = async () => {
    await loadGameEvents();
  };

  // ── Video handlers ──────────────────────────────────────────

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
      await loadGameEvents();
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
      await loadGameEvents();
    } catch (e: any) {
      showToast(getApiErrorMessage(e), 'error');
    } finally {
      setVideoDeleteLoading(false);
    }
  };

  // ── Game actions ────────────────────────────────────────────

  const handleSyncFussballDe = async () => {
    if (!game?.fussballDeUrl || !gameId) return;
    try {
      setSyncing(true);
      await syncFussballDe(gameId);
      await loadGameDetails();
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    } finally {
      setSyncing(false);
    }
  };

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

  // ── Navigation & permissions ────────────────────────────────

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (game?.tournamentId) {
      navigate(`/tournaments/${game.tournamentId}`);
    } else {
      navigate('/games');
    }
  };

  const isGameRunning = () => {
    if (!game?.calendarEvent?.startDate || !game?.calendarEvent?.endDate) return false;
    const now = new Date();
    const start = new Date(game.calendarEvent.startDate);
    const end = new Date(game.calendarEvent.endDate);
    return now >= start && now <= end;
  };

  const canCreateEvents = () => game?.permissions?.can_create_game_events ?? false;
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

  const openWeatherModal = (eventId: number | null) => {
    setSelectedEventId(eventId);
    setWeatherModalOpen(true);
  };

  const toggleSection = (section: DetailSectionKey) => {
    setSectionsOpen((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return {
    // Auth
    user,
    // IDs
    gameId,
    // Core data
    game,
    gameStartDate,
    gameEvents,
    homeScore,
    awayScore,
    loading,
    error,
    isFinished,
    syncing,
    finishing,
    // Event state
    eventToDelete,
    setEventToDelete,
    eventFormOpen,
    setEventFormOpen,
    eventToEdit,
    setEventToEdit,
    // Video state
    videos,
    videoTypes,
    youtubeLinks,
    cameras,
    eventVideos,
    mappedCameras,
    videoDialogOpen,
    videoDialogLoading,
    videoToEdit,
    videoToDelete,
    setVideoToDelete,
    videoDeleteLoading,
    videoSegmentModalOpen,
    setVideoSegmentModalOpen,
    // Modal state
    weatherModalOpen,
    setWeatherModalOpen,
    selectedEventId,
    confirmFinishOpen,
    setConfirmFinishOpen,
    supporterApplicationOpen,
    setSupporterApplicationOpen,
    // Timing state
    halfDuration,
    setHalfDuration,
    halftimeBreakDuration,
    setHalftimeBreakDuration,
    firstHalfExtraTime,
    setFirstHalfExtraTime,
    secondHalfExtraTime,
    setSecondHalfExtraTime,
    timingSaving,
    // Section state
    sectionsOpen,
    // Handlers
    loadGameDetails,
    handleBack,
    handleDeleteEvent,
    handleEventFormSuccess,
    handleEventUpdated,
    handleOpenAddVideo,
    handleOpenEditVideo,
    handleCloseVideoDialog,
    handleSaveVideo,
    handleDeleteVideo,
    handleSyncFussballDe,
    handleFinishGame,
    handleSaveTiming,
    handleProtectedEventAction,
    handleProtectedVideoAction,
    openWeatherModal,
    toggleSection,
    isGameRunning,
    canCreateEvents,
    canCreateVideos,
  };
}
