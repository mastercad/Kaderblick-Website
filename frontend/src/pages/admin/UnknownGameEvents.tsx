import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import {
  assignPlayerToEvent,
  fetchPlayersForEvent,
  fetchUnknownGameEvents,
  type PlayerOption,
  type UnknownGameEvent,
} from '../../services/unknownGameEvents';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '–';
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ── Sub-component: single row ─────────────────────────────────────────────────

interface EventRowProps {
  event: UnknownGameEvent;
  onAssigned: (eventId: number) => void;
}

function EventRow({ event, onAssigned }: EventRowProps) {
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersLoaded, setPlayersLoaded] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerOption | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlayers = useCallback(async () => {
    if (playersLoaded) return;
    setPlayersLoading(true);
    try {
      const data = await fetchPlayersForEvent(event.id);
      setPlayers(data);
      setPlayersLoaded(true);
    } catch {
      setError('Spieler konnten nicht geladen werden.');
    } finally {
      setPlayersLoading(false);
    }
  }, [event.id, playersLoaded]);

  const handleSave = async () => {
    if (!selectedPlayer) return;
    setSaving(true);
    setError(null);
    try {
      await assignPlayerToEvent(event.id, selectedPlayer.id);
      onAssigned(event.id);
    } catch {
      setError('Zuweisung fehlgeschlagen.');
      setSaving(false);
    }
  };

  const gameLabel = [event.game.homeTeam, event.game.awayTeam].filter(Boolean).join(' – ') || '–';

  return (
    <TableRow>
      <TableCell>{event.eventType ?? '–'}</TableCell>
      <TableCell>{gameLabel}</TableCell>
      <TableCell>{formatDate(event.game.date)}</TableCell>
      <TableCell>{event.minute !== null ? `${event.minute}'` : '–'}</TableCell>
      <TableCell>{event.team.name}</TableCell>
      <TableCell sx={{ minWidth: 240 }}>
        <Autocomplete<PlayerOption>
          options={players}
          getOptionLabel={(o) => o.fullName}
          value={selectedPlayer}
          onChange={(_, val) => setSelectedPlayer(val)}
          onOpen={loadPlayers}
          loading={playersLoading}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          size="small"
          renderInput={(params) => (
            <TextField
              {...params}
              label="Spieler auswählen"
              placeholder="Name eingeben …"
              error={!!error}
              helperText={error ?? undefined}
              slotProps={{
                ...params.slotProps,

                input: {
                  ...params.slotProps.input,
                  endAdornment: (
                    <>
                      {playersLoading ? <CircularProgress color="inherit" size={16} /> : null}
                      {params.slotProps.input.endAdornment}
                    </>
                  ),
                }
              }}
            />
          )}
        />
      </TableCell>
      <TableCell>
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <CheckIcon />}
          disabled={!selectedPlayer || saving}
          onClick={handleSave}
        >
          Zuweisen
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UnknownGameEvents() {
  const [events, setEvents] = useState<UnknownGameEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);

  useEffect(() => {
    fetchUnknownGameEvents()
      .then(setEvents)
      .catch(() => setError('Daten konnten nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, []);

  const handleAssigned = useCallback((eventId: number) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    setSuccessOpen(true);
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Spielereignisse ohne Spielerzuweisung
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: "text.secondary",
          mb: 3
        }}>
        Hier werden Spielereignisse angezeigt, bei denen kein Spieler zugewiesen wurde. Weise jedem
        Ereignis den richtigen Spieler zu, um die Datenqualität sicherzustellen.
      </Typography>
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}
      {!loading && error && (
        <Alert severity="error">{error}</Alert>
      )}
      {!loading && !error && events.length === 0 && (
        <Alert severity="success">
          Alle Spielereignisse haben einen zugewiesenen Spieler. Keine offenen Einträge.
        </Alert>
      )}
      {!loading && !error && events.length > 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ereignistyp</TableCell>
                <TableCell>Spiel</TableCell>
                <TableCell>Datum</TableCell>
                <TableCell>Minute</TableCell>
                <TableCell>Team</TableCell>
                <TableCell>Spieler</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((event) => (
                <EventRow key={event.id} event={event} onAssigned={handleAssigned} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Snackbar
        open={successOpen}
        autoHideDuration={3000}
        onClose={() => setSuccessOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSuccessOpen(false)}>
          Spieler erfolgreich zugewiesen.
        </Alert>
      </Snackbar>
    </Box>
  );
}
