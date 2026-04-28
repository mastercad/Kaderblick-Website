import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Alert,
  CircularProgress,
  Collapse,
  Fab,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  SportsSoccer as SoccerIcon,
} from '@mui/icons-material';
import { ToastProvider } from '../context/ToastContext';
import { Video } from '../services/videos';
import { calculateCumulativeOffset } from '../utils/videoTimeline';
import EmptyStateHint from '../components/EmptyStateHint';
import GameMatchPlanCard from '../components/GameMatchPlanCard';

import { GameDetailsProps } from './game-details/types';
import { useGameDetails } from './game-details/useGameDetails';
import ScoreboardHeroCard from './game-details/components/ScoreboardHeroCard';
import DetailSectionHeader from './game-details/components/DetailSectionHeader';
import GameEventsSection from './game-details/components/GameEventsSection';
import VideosSection from './game-details/components/VideosSection';
import TimingSection from './game-details/components/TimingSection';
import GameDetailsModals from './game-details/components/GameDetailsModals';

function GameDetailsInner({ gameId: propGameId, onBack }: GameDetailsProps) {
  const theme = useTheme();

  // Video player ref and play-modal state live here because they need
  // simultaneous access to videoToPlay and hook.videos.
  const videoPlayerRef = useRef<any>(null);
  const [playVideoModalOpen, setPlayVideoModalOpen] = useState(false);
  const [videoToPlay, setVideoToPlay] = useState<Video | null>(null);
  const [videoEventFormOpen, setVideoEventFormOpen] = useState(false);
  const [videoEventInitialMinute, setVideoEventInitialMinute] = useState<number | undefined>(undefined);

  // ── Sticky header state ──────────────────────────────────────────────────
  const [showStickyTeams, setShowStickyTeams] = useState(false);
  const isMobileLandscape = useMediaQuery('(orientation: landscape) and (max-height: 500px)');
  const [activeSection, setActiveSection] = useState<'matchPlan' | 'events' | 'videos' | null>(null);

  // Refs for sticky detection
  const scoreboardRef        = useRef<HTMLDivElement>(null);
  const matchPlanSentinelRef = useRef<HTMLDivElement>(null);
  const eventsSentinelRef    = useRef<HTMLDivElement>(null);
  const videosSentinelRef    = useRef<HTMLDivElement>(null);

  const hook = useGameDetails(propGameId, onBack);

  // ── Sticky header: show compact teams/score when scoreboard scrolls off ──
  useEffect(() => {
    const el = scoreboardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyTeams(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { root: null, threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  // hook.game triggers re-run after data loads so scoreboardRef is populated
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hook.game]);

  // ── Active section tracking via scroll position ──────────────────────────
  useEffect(() => {
    let rafId: number;
    // Threshold: NavAppBar + compact header (~72px)
    const getThreshold = () => {
      const headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--app-header-height') || '56', 10);
      return headerH + 72;
    };

    const handleScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const THRESHOLD = getThreshold();
        const checks: Array<{ el: HTMLDivElement | null; s: 'matchPlan' | 'events' | 'videos' }> = [
          { el: videosSentinelRef.current,    s: 'videos' },
          { el: eventsSentinelRef.current,    s: 'events' },
          { el: matchPlanSentinelRef.current, s: 'matchPlan' },
        ];
        for (const { el, s } of checks) {
          if (el && el.getBoundingClientRect().top <= THRESHOLD) {
            setActiveSection(s);
            return;
          }
        }
        setActiveSection(null);
      });
    };

    document.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    handleScroll();
    return () => {
      document.removeEventListener('scroll', handleScroll, { capture: true });
      cancelAnimationFrame(rafId);
    };
  // hook.game triggers re-run so sentinels are in DOM
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hook.game]);

  // ── Video play handlers ──────────────────────────────────────────────────

  const handleOpenPlayVideo = (video: Video) => {
    setVideoToPlay(video);
    setPlayVideoModalOpen(true);
  };

  const handleClosePlayVideo = () => {
    setPlayVideoModalOpen(false);
    setVideoToPlay(null);
  };

  const handleCreateEventFromVideo = async () => {
    let seconds = 0;
    if (videoPlayerRef.current && typeof videoPlayerRef.current.getCurrentTime === 'function') {
      const sec = await videoPlayerRef.current.getCurrentTime();
      videoPlayerRef.current.pauseVideo?.();
      if (typeof sec === 'number' && !isNaN(sec)) {
        const gameStartOffset = videoToPlay?.gameStart ?? 0;
        const cumulativeOffset = videoToPlay
          ? calculateCumulativeOffset(videoToPlay as any, hook.videos as any)
          : 0;
        seconds = Math.round(sec - gameStartOffset + cumulativeOffset);
      }
    }
    setVideoEventInitialMinute(seconds);
    setVideoEventFormOpen(true);
  };

  const handleCreateEventFromVideoAtPosition = (videoPositionSeconds: number) => {
    const gameStartOffset = videoToPlay?.gameStart ?? 0;
    const cumOffset = videoToPlay
      ? calculateCumulativeOffset(videoToPlay as any, hook.videos as any)
      : 0;
    setVideoEventInitialMinute(Math.round(videoPositionSeconds - gameStartOffset + cumOffset));
    setVideoEventFormOpen(true);
  };

  // ── Loading / error / empty guards ──────────────────────────────────────

  if (hook.loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (hook.error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{hook.error}</Alert>
        <Button variant="contained" onClick={hook.loadGameDetails}>Erneut versuchen</Button>
      </Box>
    );
  }

  if (!hook.game) {
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

  const game = hook.game;

  return (
    <Box sx={{ px: { xs: 1.5, sm: 3 }, py: { xs: 2, sm: 3 }, maxWidth: 960, mx: 'auto' }}>

      {/* ── Compact sticky header (teams + section) ──────────────────────── */}
      <Box
        sx={{
          position: 'fixed',
          top: 'var(--app-header-height)',
          left: 'var(--sidebar-width)',
          right: 0,
          zIndex: 11,
          bgcolor: 'background.paper',
          borderBottom: `1px solid ${theme.palette.divider}`,
          boxShadow: showStickyTeams ? '0 2px 8px rgba(0,0,0,0.10)' : 'none',
          transform: (showStickyTeams && !isMobileLandscape) ? 'translateY(0)' : 'translateY(-150%)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          pointerEvents: (showStickyTeams && !isMobileLandscape) ? 'auto' : 'none',
        }}
      >
        {/* Teams + Score row */}
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 0.75 }}>
          <Typography noWrap sx={{ flex: 1, textAlign: 'right', fontWeight: 700, fontSize: '0.78rem' }}>
            {game.homeTeam.name}
          </Typography>
          <Typography
            sx={{
              mx: 1.5,
              fontWeight: 800,
              fontSize: '1rem',
              fontVariantNumeric: 'tabular-nums',
              minWidth: 44,
              textAlign: 'center',
              letterSpacing: 1,
            }}
          >
            {hook.homeScore} : {hook.awayScore}
          </Typography>
          <Typography noWrap sx={{ flex: 1, fontWeight: 700, fontSize: '0.78rem' }}>
            {game.awayTeam.name}
          </Typography>
        </Box>

        {/* Active section label + action button */}
        {activeSection && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              px: 2,
              py: 0.25,
              minHeight: 32,
              borderTop: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography sx={{ flex: 1, fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary' }}>
              {activeSection === 'matchPlan' && 'Match-Plan'}
              {activeSection === 'events'    && 'Spielereignisse'}
              {activeSection === 'videos'    && 'Videos'}
            </Typography>
            {activeSection === 'events' && hook.canCreateEvents() && (
              <IconButton size="small" onClick={hook.handleProtectedEventAction} sx={{ p: 0.5 }}>
                <AddIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
            {activeSection === 'videos' && hook.canCreateVideos() && (
              <IconButton size="small" onClick={hook.handleProtectedVideoAction} sx={{ p: 0.5 }}>
                <AddIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
          </Box>
        )}
      </Box>

      {/* ── Back Navigation ─────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <IconButton onClick={hook.handleBack} sx={{ mr: 1 }} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
          {game.tournamentId ? 'Zurück zum Turnier' : 'Zurück zur Übersicht'}
        </Typography>
      </Box>

      {/* ── Scoreboard ──────────────────────────────────────────────────── */}
      <Box ref={scoreboardRef}>
        <ScoreboardHeroCard
          game={game}
          homeScore={hook.homeScore}
          awayScore={hook.awayScore}
          isGameRunning={hook.isGameRunning()}
          isFinished={hook.isFinished}
          syncing={hook.syncing}
          finishing={hook.finishing}
          onSyncFussballDe={hook.handleSyncFussballDe}
          onOpenWeatherModal={hook.openWeatherModal}
          onFinishGame={() => hook.setConfirmFinishOpen(true)}
        />
      </Box>

      {/* ── Match Plan ──────────────────────────────────────────────────── */}
      {(game.permissions?.can_manage_match_plan || game.permissions?.can_view_match_plan) && (
        <Box sx={{ mb: 3 }}>          <Box ref={matchPlanSentinelRef} aria-hidden sx={{ height: 0 }} />          <DetailSectionHeader
            icon={<SoccerIcon sx={{ color: 'primary.main', fontSize: 22 }} />}
            label="Match-Plan"
            count={game.matchPlan?.phases?.length ?? 0}
            color={theme.palette.primary.main}
            open={hook.sectionsOpen.matchPlan}
            onToggle={() => hook.toggleSection('matchPlan')}
            testId="match-plan-section-header"
          />
          <Collapse in={hook.sectionsOpen.matchPlan} timeout="auto" unmountOnExit>
            <GameMatchPlanCard
              game={game}
              onUpdated={hook.loadGameDetails}
            />
          </Collapse>
        </Box>
      )}

      {/* ── Game Events ─────────────────────────────────────────────────── */}      <Box ref={eventsSentinelRef} aria-hidden sx={{ height: 0 }} />      <GameEventsSection
        game={game}
        gameEvents={hook.gameEvents}
        gameStartDate={hook.gameStartDate}
        youtubeLinks={hook.youtubeLinks as any}
        mappedCameras={hook.mappedCameras}
        sectionsOpen={hook.sectionsOpen.events}
        canCreateEvents={hook.canCreateEvents()}
        onToggle={() => hook.toggleSection('events')}
        onProtectedEventAction={hook.handleProtectedEventAction}
        onEditEvent={(event) => {
          hook.setEventToEdit(event);
          hook.setEventFormOpen(true);
        }}
        onDeleteEvent={hook.setEventToDelete}
      />

      {/* ── Videos ──────────────────────────────────────────────────────── */}      <Box ref={videosSentinelRef} aria-hidden sx={{ height: 0 }} />      <VideosSection
        videos={hook.videos}
        sectionsOpen={hook.sectionsOpen.videos}
        canCreateVideos={hook.canCreateVideos()}
        hasUser={!!hook.user}
        onToggle={() => hook.toggleSection('videos')}
        onProtectedVideoAction={hook.handleProtectedVideoAction}
        onOpenSegmentModal={() => hook.setVideoSegmentModalOpen(true)}
        onPlayVideo={handleOpenPlayVideo}
        onEditVideo={hook.handleOpenEditVideo}
        onDeleteVideo={hook.setVideoToDelete}
      />

      {/* ── Timing ──────────────────────────────────────────────────────── */}
      {(game.permissions?.can_edit_timing || game.halfDuration != null) && (
        <TimingSection
          game={game}
          sectionsOpen={hook.sectionsOpen.timing}
          halfDuration={hook.halfDuration}
          halftimeBreakDuration={hook.halftimeBreakDuration}
          firstHalfExtraTime={hook.firstHalfExtraTime}
          secondHalfExtraTime={hook.secondHalfExtraTime}
          timingSaving={hook.timingSaving}
          onToggle={() => hook.toggleSection('timing')}
          onHalfDurationChange={hook.setHalfDuration}
          onHalftimeBreakDurationChange={hook.setHalftimeBreakDuration}
          onFirstHalfExtraTimeChange={hook.setFirstHalfExtraTime}
          onSecondHalfExtraTimeChange={hook.setSecondHalfExtraTime}
          onSave={hook.handleSaveTiming}
        />
      )}

      {/* ── Floating Action Button ───────────────────────────────────────── */}
      <Fab
        color="primary"
        aria-label="Ereignis erfassen"
        sx={{ position: 'fixed', bottom: { xs: 136, sm: 88 }, right: { xs: 16, sm: 24 }, zIndex: 10 }}
        onClick={hook.handleProtectedEventAction}
      >
        <AddIcon />
      </Fab>

      {/* ── All Modals ──────────────────────────────────────────────────── */}
      <GameDetailsModals
        game={game}
        gameId={hook.gameId!}
        gameEvents={hook.gameEvents}
        gameStartDate={hook.gameStartDate ?? ''}
        videos={hook.videos}
        videoTypes={hook.videoTypes}
        cameras={hook.cameras}
        youtubeLinks={hook.youtubeLinks}
        videoPlayerRef={videoPlayerRef}
        playVideoModalOpen={playVideoModalOpen}
        videoToPlay={videoToPlay}
        videoEventFormOpen={videoEventFormOpen}
        videoEventInitialMinute={videoEventInitialMinute}
        eventToEdit={hook.eventToEdit}
        canCreateEvents={hook.canCreateEvents()}
        onClosePlayVideo={handleClosePlayVideo}
        onCreateEventFromVideo={handleCreateEventFromVideo}
        onCreateEventFromVideoAtPosition={handleCreateEventFromVideoAtPosition}
        onSetVideoEventFormOpen={setVideoEventFormOpen}
        onSetVideoEventInitialMinute={setVideoEventInitialMinute}
        onSetEventToEdit={hook.setEventToEdit}
        onEventFormSuccess={hook.handleEventFormSuccess}
        videoDialogOpen={hook.videoDialogOpen}
        videoDialogLoading={hook.videoDialogLoading}
        videoToEdit={hook.videoToEdit}
        onCloseVideoDialog={hook.handleCloseVideoDialog}
        onSaveVideo={hook.handleSaveVideo}
        videoToDelete={hook.videoToDelete}
        eventToDelete={hook.eventToDelete}
        onSetVideoToDelete={hook.setVideoToDelete}
        onSetEventToDelete={hook.setEventToDelete}
        onDeleteVideo={hook.handleDeleteVideo}
        onDeleteEvent={hook.handleDeleteEvent}
        confirmFinishOpen={hook.confirmFinishOpen}
        onSetConfirmFinishOpen={hook.setConfirmFinishOpen}
        onFinishGame={hook.handleFinishGame}
        eventFormOpen={hook.eventFormOpen}
        onSetEventFormOpen={hook.setEventFormOpen}
        weatherModalOpen={hook.weatherModalOpen}
        selectedEventId={hook.selectedEventId}
        onSetWeatherModalOpen={hook.setWeatherModalOpen}
        videoSegmentModalOpen={hook.videoSegmentModalOpen}
        onSetVideoSegmentModalOpen={hook.setVideoSegmentModalOpen}
        supporterApplicationOpen={hook.supporterApplicationOpen}
        onSetSupporterApplicationOpen={hook.setSupporterApplicationOpen}
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
