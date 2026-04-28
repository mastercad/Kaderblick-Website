import React from 'react';
import { Box, Button } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import VideoModal from '../../../modals/VideoModal';
import VideoPlayModal from '../../../modals/VideoPlayModal';
import { VideoSegmentModal } from '../../../modals/VideoSegmentModal';
import { ConfirmationModal } from '../../../modals/ConfirmationModal';
import { GameEventModal } from '../../../modals/GameEventModal';
import WeatherModal from '../../../modals/WeatherModal';
import { SupporterApplicationModal } from '../../../modals/SupporterApplicationModal';
import { Game, GameEvent } from '../../../types/games';
import { Video } from '../../../services/videos';

interface GameDetailsModalsProps {
  game: Game;
  gameId: number;
  gameEvents: GameEvent[];
  gameStartDate: string;
  videos: Video[];
  videoTypes: any[];
  cameras: any[];
  youtubeLinks: any[];

  // Video play modal
  videoPlayerRef: React.RefObject<any>;
  playVideoModalOpen: boolean;
  videoToPlay: Video | null;
  videoEventFormOpen: boolean;
  videoEventInitialMinute: number | undefined;
  eventToEdit: GameEvent | null;
  canCreateEvents: boolean;
  onClosePlayVideo: () => void;
  onCreateEventFromVideo: () => void;
  onCreateEventFromVideoAtPosition: (seconds: number) => void;
  onSetVideoEventFormOpen: (open: boolean) => void;
  onSetVideoEventInitialMinute: (minute: number | undefined) => void;
  onSetEventToEdit: (event: GameEvent | null) => void;
  onEventFormSuccess: () => void;

  // Video CRUD modal
  videoDialogOpen: boolean;
  videoDialogLoading: boolean;
  videoToEdit: Video | null;
  onCloseVideoDialog: () => void;
  onSaveVideo: (data: any) => void;

  // Delete confirmations
  videoToDelete: Video | null;
  eventToDelete: GameEvent | null;
  onSetVideoToDelete: (video: Video | null) => void;
  onSetEventToDelete: (event: GameEvent | null) => void;
  onDeleteVideo: () => void;
  onDeleteEvent: () => void;

  // Finish game confirmation
  confirmFinishOpen: boolean;
  onSetConfirmFinishOpen: (open: boolean) => void;
  onFinishGame: () => void;

  // Event modal (FAB / external)
  eventFormOpen: boolean;
  onSetEventFormOpen: (open: boolean) => void;

  // Weather modal
  weatherModalOpen: boolean;
  selectedEventId: number | null;
  onSetWeatherModalOpen: (open: boolean) => void;

  // Segment modal
  videoSegmentModalOpen: boolean;
  onSetVideoSegmentModalOpen: (open: boolean) => void;

  // Supporter application modal
  supporterApplicationOpen: boolean;
  onSetSupporterApplicationOpen: (open: boolean) => void;
}

const GameDetailsModals = ({
  game,
  gameId,
  gameEvents,
  gameStartDate,
  videos,
  videoTypes,
  cameras,
  youtubeLinks,
  videoPlayerRef,
  playVideoModalOpen,
  videoToPlay,
  videoEventFormOpen,
  videoEventInitialMinute,
  eventToEdit,
  canCreateEvents,
  onClosePlayVideo,
  onCreateEventFromVideo,
  onCreateEventFromVideoAtPosition,
  onSetVideoEventFormOpen,
  onSetVideoEventInitialMinute,
  onSetEventToEdit,
  onEventFormSuccess,
  videoDialogOpen,
  videoDialogLoading,
  videoToEdit,
  onCloseVideoDialog,
  onSaveVideo,
  videoToDelete,
  eventToDelete,
  onSetVideoToDelete,
  onSetEventToDelete,
  onDeleteVideo,
  onDeleteEvent,
  confirmFinishOpen,
  onSetConfirmFinishOpen,
  onFinishGame,
  eventFormOpen,
  onSetEventFormOpen,
  weatherModalOpen,
  selectedEventId,
  onSetWeatherModalOpen,
  videoSegmentModalOpen,
  onSetVideoSegmentModalOpen,
  supporterApplicationOpen,
  onSetSupporterApplicationOpen,
}: GameDetailsModalsProps) => {
  return (
    <>
      {/* Video Play Modal */}
      <VideoPlayModal
        ref={videoPlayerRef}
        open={playVideoModalOpen}
        onClose={onClosePlayVideo}
        videoId={videoToPlay?.youtubeId || undefined}
        videoName={videoToPlay?.name}
        videoObj={videoToPlay ? {
          id: videoToPlay.id,
          youtubeId: videoToPlay.youtubeId || undefined,
          gameStart: videoToPlay.gameStart ?? null,
          length: videoToPlay.length ?? 0,
          camera: videoToPlay.camera || undefined,
        } : { id: 0, youtubeId: undefined, gameStart: null, length: 0 }}
        gameEvents={gameEvents}
        gameStartDate={gameStartDate || ''}
        gameId={gameId}
        onEventUpdated={async () => {}}
        allVideos={videos}
        youtubeLinks={youtubeLinks}
        onCreateEventAtPosition={onCreateEventFromVideoAtPosition}
        canCreateEvents={canCreateEvents}
        onRequestSupporterAccess={() => onSetSupporterApplicationOpen(true)}
      >
        {canCreateEvents && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onCreateEventFromVideo}
              color="primary"
            >
              Spielereignis anlegen
            </Button>
          </Box>
        )}
        <GameEventModal
          open={videoEventFormOpen}
          onClose={() => {
            onSetVideoEventFormOpen(false);
            onSetVideoEventInitialMinute(undefined);
            onSetEventToEdit(null);
          }}
          onSuccess={() => {
            onSetVideoEventFormOpen(false);
            onSetVideoEventInitialMinute(undefined);
            onSetEventToEdit(null);
            onEventFormSuccess();
          }}
          gameId={gameId}
          game={game}
          existingEvent={eventToEdit}
          initialMinute={videoEventInitialMinute}
        />
      </VideoPlayModal>

      {/* Video Add/Edit Modal */}
      <VideoModal
        open={videoDialogOpen}
        onClose={onCloseVideoDialog}
        onSave={onSaveVideo}
        videoTypes={videoTypes}
        cameras={cameras}
        initialData={videoToEdit || undefined}
        loading={videoDialogLoading}
      />

      {/* Video Delete Confirmation */}
      <ConfirmationModal
        open={!!videoToDelete}
        onClose={() => onSetVideoToDelete(null)}
        onConfirm={onDeleteVideo}
        title="Video löschen"
        message={`Soll das Video "${videoToDelete?.name}" wirklich gelöscht werden?`}
        confirmText="Löschen"
        confirmColor="error"
      />

      {/* Event Delete Confirmation */}
      <ConfirmationModal
        open={!!eventToDelete}
        onClose={() => onSetEventToDelete(null)}
        onConfirm={onDeleteEvent}
        title="Ereignis löschen"
        message={`Soll das Ereignis "${eventToDelete?.gameEventType?.name || eventToDelete?.type || 'Unbekannt'}" wirklich gelöscht werden?`}
        confirmText="Löschen"
        confirmColor="error"
      />

      {/* Finish Game Confirmation */}
      <ConfirmationModal
        open={confirmFinishOpen}
        onClose={() => onSetConfirmFinishOpen(false)}
        onConfirm={onFinishGame}
        title="Spiel beenden"
        message="Soll das Spiel als beendet markiert werden? Falls es ein Turnierspiel ist, wird der Gewinner automatisch in die nächste Runde weitergeleitet."
        confirmText="Spiel beenden"
        confirmColor="success"
      />

      {/* Game Event Modal (FAB / external, not in video player) */}
      <GameEventModal
        open={eventFormOpen}
        onClose={() => {
          onSetEventFormOpen(false);
          onSetEventToEdit(null);
        }}
        onSuccess={onEventFormSuccess}
        gameId={gameId}
        game={game}
        existingEvent={eventToEdit}
      />

      {/* Weather Modal */}
      <WeatherModal
        open={weatherModalOpen}
        onClose={() => onSetWeatherModalOpen(false)}
        eventId={selectedEventId}
      />

      {/* Video Segment Modal */}
      <VideoSegmentModal
        open={videoSegmentModalOpen}
        onClose={() => onSetVideoSegmentModalOpen(false)}
        videos={videos}
        gameId={gameId}
      />

      {/* Supporter Application Modal */}
      <SupporterApplicationModal
        open={supporterApplicationOpen}
        onClose={() => onSetSupporterApplicationOpen(false)}
      />
    </>
  );
};

export default GameDetailsModals;
