import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import CancelIcon from '@mui/icons-material/EventBusy';
import RestoreIcon from '@mui/icons-material/EventAvailable';
import GroupIcon from '@mui/icons-material/Group';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

import BaseModal from '../BaseModal';
import WeatherModal from '../WeatherModal';
import TeamRideDetailsModal from '../TeamRideDetailsModal';
import Location from '../../components/Location';
import TourTooltip from '../../components/TourTooltip';

// Sub-modules
import { useEventParticipation } from './hooks/useEventParticipation';
import { useEventActions } from './hooks/useEventActions';
import { useTeamRideStatus } from './hooks/useTeamRideStatus';

import { CancelledBanner } from './components/CancelledBanner';
import { EventInfoCard } from './components/EventInfoCard';
import { EventGameMatchup } from './components/EventGameMatchup';
import { EventDescription } from './components/EventDescription';
import { ParticipationButtons } from './components/ParticipationButtons';
import { ParticipationStatusBadge } from './components/ParticipationStatusBadge';
import { ParticipationList } from './components/ParticipationList';
import { PlayerOverviewModal } from './components/PlayerOverviewModal';
import { NoteDialog } from './dialogs/NoteDialog';
import { CancelDialog } from './dialogs/CancelDialog';

import type { EventDetailsModalProps } from './types';

export type { EventDetailsModalProps } from './types';

const tourSteps = [
  {
    target: 'event-details',
    content: 'Hier findest du alle wichtigen Infos zum Event. Schau dich ruhig um!',
  },
  {
    target: 'event-action-button',
    content:
      'Hier kannst du dich zum Event anmelden oder abmelden. Nach dem Klick öffnet sich ein Fenster, wo du optional eine Nachricht hinterlassen kannst.',
  },
  {
    target: 'participations-list',
    content: 'In der Teilnehmerliste siehst du, wer sich sonst noch angemeldet hat.',
  },
  {
    target: 'weather-information',
    content:
      'Hier findest du Informationen zum voraussichtlichen Wetter. Wetterinformationen werden nur über die Zeit des Events angezeigt.',
  },
  {
    target: 'teamride-information',
    content:
      'Hier findest du Informationen zu Fahrgemeinschaften, kannst eine Fahrgemeinschaft anbieten bzw. einen Platz buchen.',
  },
];

export const EventDetailsModal: React.FC<EventDetailsModalProps> = ({
  open,
  onClose,
  event,
  onEdit,
  onDelete,
  onCancelled,
  onUpdated,
  initialOpenRides = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // ── Participation ──────────────────────────────────────────────────────────
  const {
    participationStatuses,
    currentParticipation,
    participations,
    loading,
    saving,
    submitParticipation,
  } = useEventParticipation(event?.id, open, event?.permissions?.canParticipate);

  // Note dialog state
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<number | null>(null);
  const [dialogNote, setDialogNote] = useState('');

  const handleStatusClick = (statusId: number) => {
    setPendingStatusId(statusId);
    setDialogNote(currentParticipation?.note ?? '');
    setNoteDialogOpen(true);
  };

  const handleParticipationSubmit = async () => {
    if (!pendingStatusId) return;
    setNoteDialogOpen(false);
    await submitParticipation(pendingStatusId, dialogNote);
    onUpdated?.();
  };

  // ── Event actions (cancel / reactivate) ───────────────────────────────────
  const { cancelling, reactivating, cancelEvent, reactivateEvent } = useEventActions(
    event?.id,
    onCancelled,
    onClose,
  );

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // ── Team ride status ───────────────────────────────────────────────────────
  const teamRideStatus = useTeamRideStatus(event?.id, open, event?.permissions?.canViewRides);

  // ── Weather / Rides modals ─────────────────────────────────────────────────
  const [weatherModalOpen, setWeatherModalOpen] = useState(false);
  const [teamRideModalOpen, setTeamRideModalOpen] = useState(false);

  // ── Player overview ────────────────────────────────────────────────────────
  const [playerOverviewOpen, setPlayerOverviewOpen] = useState(false);

  // Auto-open rides when requested
  useEffect(() => {
    if (initialOpenRides && open && event?.id && event?.permissions?.canViewRides) {
      setTeamRideModalOpen(true);
    }
  }, [initialOpenRides, open, event?.id, event?.permissions?.canViewRides]);

  // Reset local state when modal closes
  useEffect(() => {
    if (!open) {
      setCancelDialogOpen(false);
      setCancelReason('');
    }
  }, [open]);

  if (!event) return null;

  // ── Date/time helpers ──────────────────────────────────────────────────────
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  const isSameDay = startDate.toDateString() === endDate.toDateString();

  const dateStr = startDate.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const startTimeStr = startDate.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTimeStr = endDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const endDateStr = !isSameDay
    ? endDate.toLocaleDateString('de-DE', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';

  const typeColor = event.type?.color || theme.palette.primary.main;

  // ── Pending status (for NoteDialog) ───────────────────────────────────────
  const pendingStatus = participationStatuses.find(s => s.id === pendingStatusId);

  return (
    <>
      {/* ──────────────────────────── Main Modal ──────────────────────────── */}
      <BaseModal
        open={open}
        onClose={onClose}
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', minWidth: 0 }}>
            {event.type?.name && (
              <Chip
                label={event.type.name}
                size="small"
                sx={{
                  bgcolor: typeColor,
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  letterSpacing: 0.5,
                  height: 24,
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}
              />
            )}
            <Typography
              variant="h6"
              component="span"
              sx={{
                fontWeight: 700,
                lineHeight: 1.25,
                textDecoration: event.cancelled ? 'line-through' : 'none',
                opacity: event.cancelled ? 0.6 : 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {event.title}
            </Typography>
          </Box>
        }
        maxWidth="sm"
        actions={
          <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', gap: 1 }}>
            {/* Löschen – ganz links, visuell isoliert */}
            {event.permissions?.canDelete && onDelete && (
              <Tooltip title="Termin löschen" arrow>
                <IconButton
                  onClick={onDelete}
                  color="error"
                  size="small"
                  sx={{ border: '1px solid', borderColor: 'error.main', borderRadius: 2, mr: 0.5 }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            {/* Sekundäre Aktionen */}
            <Stack direction="row" spacing={0.75} alignItems="center">
              {event.permissions?.canEdit && onEdit && (
                <Button
                  onClick={onEdit}
                  variant="outlined"
                  size="small"
                  startIcon={<EditIcon />}
                  sx={{ borderRadius: 2 }}
                >
                  Bearbeiten
                </Button>
              )}
              {event.permissions?.canCancel && !event.cancelled && (
                <Button
                  onClick={() => setCancelDialogOpen(true)}
                  color="warning"
                  variant="outlined"
                  size="small"
                  startIcon={<CancelIcon />}
                  sx={{ borderRadius: 2 }}
                >
                  Absagen
                </Button>
              )}
              {event.permissions?.canCancel && event.cancelled && (
                <Button
                  onClick={reactivateEvent}
                  color="success"
                  variant="outlined"
                  size="small"
                  startIcon={<RestoreIcon />}
                  disabled={reactivating}
                  sx={{ borderRadius: 2 }}
                >
                  {reactivating ? 'Wird reaktiviert…' : 'Reaktivieren'}
                </Button>
              )}
            </Stack>

            {/* Flexibler Abstand */}
            <Box sx={{ flex: 1 }} />

            {/* Schließen – rechts/primär */}
            <Button
              onClick={onClose}
              variant="contained"
              size={isMobile ? 'small' : 'medium'}
              sx={{ borderRadius: 2 }}
            >
              Schließen
            </Button>
          </Box>
        }
      >
        {/* Cancelled Banner */}
        {event.cancelled && (
          <CancelledBanner
            cancelReason={event.cancelReason}
            cancelledBy={event.cancelledBy}
            canCancel={event.permissions?.canCancel}
            reactivating={reactivating}
            onReactivate={reactivateEvent}
          />
        )}

        <Box id="event-details" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Date / Time / Weather / Rides */}
          <EventInfoCard
            dateStr={dateStr}
            startTimeStr={startTimeStr}
            endTimeStr={endTimeStr}
            isSameDay={isSameDay}
            endDateStr={endDateStr}
            weatherCode={event.weatherData?.weatherCode}
            canViewRides={event.permissions?.canViewRides}
            teamRideStatus={teamRideStatus}
            onWeatherClick={() => setWeatherModalOpen(true)}
            onRidesClick={() => setTeamRideModalOpen(true)}
          />

          {/* Location */}
          {event.location?.name && (
            <Box sx={{ px: 0.5 }}>
              <Location
                id={0}
                name={event.location.name}
                latitude={event.location.latitude}
                longitude={event.location.longitude}
                address={
                  `${event.location.city || ''}, ${event.location.address || ''}`.trim()
                }
              />
            </Box>
          )}

          {/* Meeting Point */}
          {(event.meetingPoint || event.meetingLocation) && (
            <Box sx={{ px: 0.5 }}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <AccessTimeIcon sx={{ fontSize: 18, color: 'text.secondary', mt: 0.25, flexShrink: 0 }} />
                <Box>
                  {event.meetingTime && (
                    <Typography variant="body2" fontWeight={600} gutterBottom={false}>
                      Treffpunkt {event.meetingTime} Uhr
                    </Typography>
                  )}
                  {event.meetingLocation ? (
                    <Location
                      id={event.meetingLocation.id}
                      name={event.meetingLocation.name}
                      latitude={event.meetingLocation.latitude}
                      longitude={event.meetingLocation.longitude}
                      address={
                        [event.meetingLocation.city, event.meetingLocation.address]
                          .filter(Boolean)
                          .join(', ')
                      }
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {event.meetingPoint}
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Box>
          )}

          {/* Game Matchup */}
          {event.game && (
            <EventGameMatchup game={event.game} typeColor={typeColor} />
          )}

          {/* Description */}
          {event.description && (
            <EventDescription description={event.description} />
          )}

          {/* ── Participation Section ── */}
          {event.permissions?.canParticipate && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                <GroupIcon sx={{ fontSize: 22, color: typeColor }} />
                <Typography variant="subtitle1" fontWeight={700}>
                  Teilnahme
                </Typography>
              </Stack>

              {loading ? (
                <Box display="flex" justifyContent="center" py={3}>
                  <CircularProgress size={32} />
                </Box>
              ) : (
                <>
                  {!event.cancelled && (
                    <>
                      {/* Current status badge */}
                      {currentParticipation && (
                        <ParticipationStatusBadge
                          participation={currentParticipation}
                          saving={saving}
                          onEditNote={() =>
                            handleStatusClick(currentParticipation.statusId)
                          }
                        />
                      )}

                      {/* Status buttons */}
                      <ParticipationButtons
                        statuses={participationStatuses}
                        currentParticipation={currentParticipation}
                        saving={saving}
                        onStatusClick={handleStatusClick}
                      />
                    </>
                  )}

                  {/* Participant list + overview button */}
                  <ParticipationList
                    participations={participations}
                    onOpenOverview={() => setPlayerOverviewOpen(true)}
                  />
                </>
              )}
            </Paper>
          )}
        </Box>
      </BaseModal>

      {/* ──────────────────────── Supporting Modals ─────────────────────── */}
      <WeatherModal
        open={weatherModalOpen}
        onClose={() => setWeatherModalOpen(false)}
        eventId={event.id}
      />

      <TeamRideDetailsModal
        open={teamRideModalOpen}
        onClose={() => setTeamRideModalOpen(false)}
        eventId={event.id}
        cancelled={event.cancelled}
        onUpdated={onUpdated}
      />

      <PlayerOverviewModal
        open={playerOverviewOpen}
        onClose={() => setPlayerOverviewOpen(false)}
        eventId={event.id}
        eventTitle={event.title}
      />

      <TourTooltip steps={tourSteps} />

      {/* ──────────────────────────── Dialogs ──────────────────────────── */}
      <NoteDialog
        open={noteDialogOpen}
        onClose={() => setNoteDialogOpen(false)}
        onConfirm={handleParticipationSubmit}
        pendingStatus={pendingStatus}
        note={dialogNote}
        onNoteChange={setDialogNote}
      />

      <CancelDialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        onConfirm={async () => {
          const ok = await cancelEvent(cancelReason);
          if (ok) setCancelReason('');
        }}
        reason={cancelReason}
        onReasonChange={setCancelReason}
        cancelling={cancelling}
      />
    </>
  );
};
