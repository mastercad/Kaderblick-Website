import React, { useState, useEffect } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import AddTeamRideModal from './AddTeamRideModal';
import { apiJson } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import BaseModal from './BaseModal';

interface TeamRide {
  id: number;
  driverId: number;
  driver: string;
  seats: number;
  availableSeats: number;
  passengers: Array<{ id: number; name: string }>;
  note?: string;
}

interface TeamRideDetailsModalProps {
  open: boolean;
  onClose: () => void;
  eventId: number | null;
  cancelled?: boolean;
  onUpdated?: () => void;
}

const TeamRideDetailsModal: React.FC<TeamRideDetailsModalProps> = ({ open, onClose, eventId, cancelled = false, onUpdated }) => {
  const { user } = useAuth();
  const [rides, setRides] = useState<TeamRide[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookingRideId, setBookingRideId] = useState<number | null>(null);
  const [cancellingRideId, setCancellingRideId] = useState<number | null>(null);
  const [deletingRideId, setDeletingRideId] = useState<number | null>(null);
  const [removingPassenger, setRemovingPassenger] = useState<{ rideId: number; userId: number } | null>(null);
  const [addTeamRideModalOpen, setAddTeamRideModalOpen] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const refreshRides = () => {
    if (!eventId) return;
    setLoading(true);
    apiJson(`/api/teamrides/event/${eventId}`)
      .then(data => setRides(data.rides || []))
      .catch(() => setRides([]))
      .finally(() => setLoading(false));
  };

  const notifyUpdated = () => {
    onUpdated?.();
  };

  useEffect(() => {
    if (!eventId || !open) return;
    refreshRides();
  }, [eventId, open]);

  const handleBookSeat = (rideId: number) => {
    setBookingError(null);
    setBookingRideId(rideId);
    apiJson(`/api/teamrides/book/${rideId}`, { method: 'POST' })
      .then(response => {
        if (response.error) {
          setBookingError(response.error);
          return;
        }
        refreshRides();
        notifyUpdated();
      })
      .catch(() => setBookingError('Unbekannter Fehler beim Buchen.'))
      .finally(() => setBookingRideId(null));
  };

  const handleCancelBooking = (rideId: number) => {
    setBookingError(null);
    setCancellingRideId(rideId);
    apiJson(`/api/teamrides/cancel-booking/${rideId}`, { method: 'DELETE' })
      .then(response => {
        if (response.error) {
          setBookingError(response.error);
          return;
        }
        refreshRides();
        notifyUpdated();
      })
      .catch(() => setBookingError('Unbekannter Fehler beim Stornieren.'))
      .finally(() => setCancellingRideId(null));
  };

  const handleRemovePassenger = (rideId: number, userId: number) => {
    setBookingError(null);
    setRemovingPassenger({ rideId, userId });
    apiJson(`/api/teamrides/remove-passenger/${rideId}/${userId}`, { method: 'DELETE' })
      .then(response => {
        if (response.error) {
          setBookingError(response.error);
          return;
        }
        refreshRides();
        notifyUpdated();
      })
      .catch(() => setBookingError('Unbekannter Fehler beim Entfernen.'))
      .finally(() => setRemovingPassenger(null));
  };

  const handleDeleteRide = (rideId: number) => {
    setBookingError(null);
    setDeletingRideId(rideId);
    apiJson(`/api/teamrides/delete/${rideId}`, { method: 'DELETE' })
      .then(response => {
        if (response.error) {
          setBookingError(response.error);
          return;
        }
        refreshRides();
        notifyUpdated();
      })
      .catch(() => setBookingError('Unbekannter Fehler beim Zurückziehen.'))
      .finally(() => setDeletingRideId(null));
  };

  const isUserPassenger = (ride: TeamRide) => {
    return ride.passengers.some(p => p.id === user?.id);
  };

  const isUserDriver = (ride: TeamRide) => {
    return ride.driverId === user?.id;
  };

  return (
    <>
      <BaseModal
        open={open}
        onClose={onClose}
        title="Mitfahrgelegenheiten"
        maxWidth="sm"
        actions={
          <>
            <Button onClick={onClose} color="primary" variant="contained">
              Schließen
            </Button>
            {!cancelled && (
              <Button onClick={() => setAddTeamRideModalOpen(true)} color="secondary" variant="outlined">
                Mitfahrgelegenheit anbieten
              </Button>
            )}
          </>
        }
      >
        {bookingError && (
          <Alert severity="error" sx={{ mb: 2 }}>{bookingError}</Alert>
        )}
        {loading ? (
          <Box display="flex" justifyContent="center" my={2}><CircularProgress /></Box>
        ) : (
          <>
            {rides.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Keine Mitfahrgelegenheiten gefunden.</Typography>
            ) : (
              <Stack spacing={2}>
                {rides.map(ride => (
                  <Box key={ride.id} border={1} borderRadius={2} p={2} borderColor="divider">
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle2">Fahrer: {ride.driver}</Typography>
                      {!cancelled && isUserDriver(ride) && (
                        <Tooltip title="Mitfahrgelegenheit zurückziehen">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteRide(ride.id)}
                            disabled={deletingRideId === ride.id}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                    <Typography variant="body2">
                      Plätze: {ride.seats} | Frei: {ride.availableSeats} | Belegt: {ride.seats - ride.availableSeats}
                    </Typography>
                    {ride.note && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Notiz: {ride.note}</Typography>}

                    {ride.passengers.length > 0 && (
                      <Box mt={1}>
                        <Typography variant="body2" fontWeight="bold" gutterBottom>Mitfahrer:</Typography>
                        <Stack spacing={0.5}>
                          {ride.passengers.map(p => (
                            <Box key={p.id} display="flex" alignItems="center" justifyContent="space-between">
                              <Chip label={p.name} size="small" variant="outlined" />
                              {/* Passenger can cancel their own booking */}
                              {!cancelled && p.id === user?.id && (
                                <Tooltip title="Eigene Buchung stornieren">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleCancelBooking(ride.id)}
                                    disabled={cancellingRideId === ride.id}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {/* Driver can remove any passenger */}
                              {!cancelled && isUserDriver(ride) && p.id !== user?.id && (
                                <Tooltip title={`${p.name} entfernen`}>
                                  <IconButton
                                    size="small"
                                    color="warning"
                                    onClick={() => handleRemovePassenger(ride.id, p.id)}
                                    disabled={removingPassenger?.rideId === ride.id && removingPassenger?.userId === p.id}
                                  >
                                    <PersonRemoveIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    )}

                    {ride.passengers.length === 0 && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Noch keine Mitfahrer.</Typography>
                    )}

                    {/* Show book button only if user is not already a passenger and not the driver */}
                    {!cancelled && !isUserPassenger(ride) && !isUserDriver(ride) && (
                      <Button
                        variant="contained"
                        color="primary"
                        disabled={ride.availableSeats === 0 || bookingRideId === ride.id}
                        onClick={() => handleBookSeat(ride.id)}
                        sx={{ mt: 1 }}
                      >
                        {bookingRideId === ride.id ? 'Buchen...' : 'Platz buchen'}
                      </Button>
                    )}

                    {/* Show cancel button for own booking (alternative to inline icon) */}
                    {!cancelled && isUserPassenger(ride) && (
                      <Button
                        variant="outlined"
                        color="error"
                        disabled={cancellingRideId === ride.id}
                        onClick={() => handleCancelBooking(ride.id)}
                        sx={{ mt: 1 }}
                      >
                        {cancellingRideId === ride.id ? 'Stornieren...' : 'Buchung stornieren'}
                      </Button>
                    )}
                  </Box>
                ))}
              </Stack>
            )}
          </>
        )}
      </BaseModal>

      <AddTeamRideModal open={addTeamRideModalOpen} onClose={() => setAddTeamRideModalOpen(false)} eventId={eventId} onAdded={() => { refreshRides(); notifyUpdated(); }} />
    </>
  );
};

export default TeamRideDetailsModal;
