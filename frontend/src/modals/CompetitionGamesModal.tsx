import React, { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import SportsIcon from '@mui/icons-material/Sports';
import BaseModal from './BaseModal';
import { EventDetailsModal } from './EventDetailsModal';
import { EventModal } from './EventModal';
import { useCalendarEventDetailsLoader } from '../hooks/useCalendarEventDetails';
import { getEventTypeFlags } from '../hooks/useEventTypeFlags';
import { apiJson, apiRequest } from '../utils/api';
import { buildLeagueCupPayload } from '../utils/buildLeagueCupPayload';
import type { EventData, SelectOption, User } from '../types/event';

interface CompetitionGame {
  id: number;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  isFinished: boolean;
  calendarEventId: number | null;
  date: string | null;
}

export interface CompetitionGamesModalProps {
  open: boolean;
  onClose: () => void;
  competitionId: number | null;
  competitionName: string;
  competitionType: 'cup' | 'league';
  /** Called after any mutation (save/delete) with the new game count so the parent can patch its local state silently. */
  onGamesChanged?: (count: number) => void;
}

export const CompetitionGamesModal: React.FC<CompetitionGamesModalProps> = ({
  open,
  onClose,
  competitionId,
  competitionName,
  competitionType,
  onGamesChanged,
}) => {
  // Keep a ref so loadGames can always call the latest onGamesChanged without
  // being a reactive dependency (avoids infinite loop when parent passes inline arrow).
  const onGamesChangedRef = useRef(onGamesChanged);
  useEffect(() => { onGamesChangedRef.current = onGamesChanged; }, [onGamesChanged]);

  const [games, setGames] = useState<CompetitionGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { selectedEvent, loadingEventId, openEventDetails, closeEventDetails } =
    useCalendarEventDetailsLoader((msg) => setError(msg));

  // ── Inline edit state ──────────────────────────────────────────────────────
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<EventData>({});
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editingCanDelete, setEditingCanDelete] = useState(false);

  // ── Reference data (loaded once lazily) ───────────────────────────────────
  const [eventTypesOpts, setEventTypesOpts] = useState<SelectOption[]>([]);
  const [allTeamsOpts, setAllTeamsOpts] = useState<SelectOption[]>([]);
  const [gameTypesOpts, setGameTypesOpts] = useState<SelectOption[]>([]);
  const [locationsOpts, setLocationsOpts] = useState<SelectOption[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const refDataLoaded = useRef(false);

  const loadRefData = useCallback(async () => {
    if (refDataLoaded.current) return;
    refDataLoaded.current = true;
    try {
      const [etData, teamsData, gtData, locData, usersData] = await Promise.all([
        apiJson<{ entries: { id: number; name: string }[] }>('/api/calendar-event-types').catch(() => ({ entries: [] })),
        apiJson<any>('/api/teams/list?context=match').catch(() => null),
        apiJson<{ entries: { id: number; name: string }[] }>('/api/game-types').catch(() => ({ entries: [] })),
        apiJson<{ locations: { id: number; name: string }[] }>('/api/locations').catch(() => ({ locations: [] })),
        apiJson<{ users: { id: string; fullName: string; context?: string }[] }>('/api/users/contacts').catch(() => ({ users: [] })),
      ]);

      const parseTeamList = (data: any): { id: number; name: string }[] => {
        if (Array.isArray(data) && data.length > 0 && 'teams' in data[0]) return data[0].teams ?? [];
        if (data && typeof data === 'object' && 'teams' in data) return data.teams ?? [];
        return [];
      };

      setEventTypesOpts(
        (etData.entries ?? [])
          .filter((et: any) => et.name !== 'Turnier-Match')
          .map((et: any) => ({ value: et.id.toString(), label: et.name }))
      );
      setAllTeamsOpts(parseTeamList(teamsData).map((t: any) => ({ value: t.id.toString(), label: t.name })));
      setGameTypesOpts(
        (gtData.entries ?? [])
          .filter((gt: any) => gt.name !== 'Turnier-Match')
          .map((gt: any) => ({ value: gt.id.toString(), label: gt.name }))
      );
      setLocationsOpts((locData.locations ?? []).map((l: any) => ({ value: l.id.toString(), label: l.name })));
      setUsers((usersData.users ?? []).map((u: any) => ({ id: u.id, fullName: u.fullName, context: u.context })));
    } catch {
      // non-blocking: ref data failure is tolerable, edit modal will just have fewer options
    }
  }, []);

  const loadGames = useCallback(() => {
    if (competitionId === null) return;
    setLoading(true);
    setError(null);
    const endpoint =
      competitionType === 'cup'
        ? `/api/cups/${competitionId}/games`
        : `/api/leagues/${competitionId}/games`;
    apiJson<{ games: CompetitionGame[] }>(endpoint)
      .then((res) => {
        const newGames = res?.games ?? [];
        setGames(newGames);
        onGamesChangedRef.current?.(newGames.length);
      })
      .catch(() => setError('Fehler beim Laden der Spiele.'))
      .finally(() => setLoading(false));
  }, [competitionId, competitionType]);

  useEffect(() => {
    if (!open || competitionId === null) return;
    loadGames();
  }, [open, loadGames, competitionId]);

  const handleDelete = useCallback(async () => {
    if (!selectedEvent) return;
    if (!window.confirm('Event wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
    try {
      await apiRequest(`/api/calendar/event/${selectedEvent.id}`, {
        method: 'DELETE',
        body: { deletionMode: 'single' },
      });
      closeEventDetails();
      loadGames();
    } catch {
      setError('Fehler beim Löschen des Events.');
    }
  }, [selectedEvent, closeEventDetails, loadGames]);

  const handleEdit = useCallback(async () => {
    if (!selectedEvent) return;
    await loadRefData();
    try {
      const raw = await apiJson<any>(`/api/calendar/event/${selectedEvent.id}`);
      const start: string = raw.start ?? '';
      const end: string = raw.end ?? '';
      const datePart = (dt: string) => dt.slice(0, 10);
      const timePart = (dt: string) => dt.length >= 16 ? dt.slice(11, 16) : '';

      setEditFormData({
        title: raw.title ?? '',
        date: datePart(start),
        time: timePart(start),
        endDate: end ? datePart(end) : '',
        endTime: end ? timePart(end) : '',
        eventType: raw.type?.id?.toString() ?? '',
        locationId: raw.location?.id?.toString() ?? '',
        description: raw.description ?? '',
        homeTeam: raw.game?.homeTeam?.id?.toString() ?? '',
        awayTeam: raw.game?.awayTeam?.id?.toString() ?? '',
        gameType: raw.game?.gameType?.id?.toString() ?? '',
        leagueId: raw.game?.league?.id ? raw.game.league.id.toString() : '',
        cupId: raw.game?.cup?.id ? raw.game.cup.id.toString() : '',
        permissionType: raw.permissionType ?? 'public',
      });
      setEditingEventId(selectedEvent.id);
      setEditingCanDelete(raw.permissions?.canDelete === true);
      closeEventDetails();
      setEditModalOpen(true);
    } catch {
      setError('Fehler beim Laden der Event-Details.');
    }
  }, [selectedEvent, closeEventDetails, loadRefData]);

  const handleEditFormChange = useCallback((field: string, value: any) => {
    setEditFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!editingEventId) return;

    const { isMatchEvent, isTournament } = getEventTypeFlags(
      editFormData.eventType ?? '',
      editFormData.gameType ?? '',
      eventTypesOpts,
      gameTypesOpts,
    );

    const startDateTime = editFormData.time
      ? `${editFormData.date}T${editFormData.time}:00`
      : `${editFormData.date}T00:00:00`;

    let endDateTime: string | undefined;
    if (editFormData.endDate) {
      endDateTime = editFormData.endTime
        ? `${editFormData.endDate}T${editFormData.endTime}:00`
        : `${editFormData.endDate}T23:59:59`;
    }
    if (!endDateTime) endDateTime = startDateTime;

    const payload: any = {
      title: editFormData.title,
      startDate: startDateTime,
      endDate: endDateTime,
      eventTypeId: editFormData.eventType ? parseInt(editFormData.eventType) : undefined,
      description: editFormData.description ?? '',
      locationId: editFormData.locationId ? parseInt(editFormData.locationId) : undefined,
      permissionType: editFormData.permissionType ?? 'public',
      permissionTeams: editFormData.permissionTeams?.map(Number) ?? [],
      permissionClubs: editFormData.permissionClubs?.map(Number) ?? [],
      permissionUsers: editFormData.permissionUsers?.map(Number) ?? [],
    };

    // Always send leagueId/cupId (null = clear) so the backend clears stale values even
    // on tournament events where the isMatchEvent flag may not be set.
    Object.assign(payload, buildLeagueCupPayload(
      editFormData.gameType,
      gameTypesOpts,
      editFormData.leagueId,
      editFormData.cupId,
    ));

    if (isMatchEvent && !isTournament) {
      if (editFormData.homeTeam && editFormData.awayTeam) {
        payload.game = {
          homeTeamId: parseInt(editFormData.homeTeam),
          awayTeamId: parseInt(editFormData.awayTeam),
        };
      }
      if (editFormData.gameType) {
        payload.gameTypeId = parseInt(editFormData.gameType);
      }
    }

    setEditSaving(true);
    try {
      const response = await apiRequest(`/api/calendar/event/${editingEventId}`, {
        method: 'PUT',
        body: payload,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${response.status}`);
      }
      setEditModalOpen(false);
      setEditFormData({});
      setEditingEventId(null);
      loadGames();
    } catch (e: any) {
      setError(e.message ?? 'Fehler beim Speichern.');
    } finally {
      setEditSaving(false);
    }
  }, [editingEventId, editFormData, eventTypesOpts, gameTypesOpts, loadGames]);

  const handleEditDelete = useCallback(async () => {
    if (!editingEventId) return;
    if (!window.confirm('Event wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
    setEditSaving(true);
    try {
      await apiRequest(`/api/calendar/event/${editingEventId}`, {
        method: 'DELETE',
        body: { deletionMode: 'single' },
      });
      setEditModalOpen(false);
      setEditFormData({});
      setEditingEventId(null);
      loadGames();
    } catch {
      setError('Fehler beim Löschen des Events.');
    } finally {
      setEditSaving(false);
    }
  }, [editingEventId, loadGames]);

  // Reset when closing
  useEffect(() => {
    if (!open) {
      setGames([]);
      setError(null);
    }
  }, [open]);

  const formatDate = (date: string | null): string => {
    if (!date) return '–';
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const formatScore = (g: CompetitionGame): string => {
    if (!g.isFinished && g.homeScore === null) return '–';
    return `${g.homeScore ?? '?'} : ${g.awayScore ?? '?'}`;
  };

  return (
    <>
      <BaseModal
        open={open}
        onClose={onClose}
        title={`Spiele – ${competitionName}`}
        maxWidth="sm"
      >
        {loading && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        )}
        {!loading && error && (
          <Typography color="error" px={2} py={2}>
            {error}
          </Typography>
        )}
        {!loading && !error && games.length === 0 && (
          <Box display="flex" flexDirection="column" alignItems="center" py={4} gap={1}>
            <SportsIcon sx={{ fontSize: 48, opacity: 0.3 }} />
            <Typography color="text.secondary">Keine Spiele vorhanden</Typography>
          </Box>
        )}
        {!loading && !error && games.length > 0 && (
          <List disablePadding>
            {games.map((g) => (
              <ListItemButton
                key={g.id}
                disabled={!g.calendarEventId || loadingEventId === g.calendarEventId}
                onClick={() => g.calendarEventId && openEventDetails(g.calendarEventId)}
                divider
                sx={{ gap: 1 }}
              >
                {loadingEventId === g.calendarEventId && (
                  <CircularProgress size={16} sx={{ mr: 1, flexShrink: 0 }} />
                )}
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                      <Typography variant="body2" fontWeight={600}>
                        {g.homeTeamName ?? '?'} vs. {g.awayTeamName ?? '?'}
                      </Typography>
                      {g.isFinished ? (
                        <Chip label={formatScore(g)} size="small" color="default" />
                      ) : (
                        <Chip label="offen" size="small" variant="outlined" />
                      )}
                    </Box>
                  }
                  secondary={formatDate(g.date)}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </BaseModal>

      <EventDetailsModal
        open={!!selectedEvent}
        onClose={closeEventDetails}
        event={selectedEvent}
        onEdit={selectedEvent?.permissions?.canEdit ? handleEdit : undefined}
        onDelete={selectedEvent?.permissions?.canDelete ? handleDelete : undefined}
        onCancelled={() => { closeEventDetails(); loadGames(); }}
        onUpdated={loadGames}
      />

      <EventModal
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditFormData({});
          setEditingEventId(null);
        }}
        onSave={handleEditSave}
        onDelete={editingCanDelete ? handleEditDelete : undefined}
        showDelete={editingCanDelete}
        event={editFormData}
        eventTypes={eventTypesOpts}
        allTeams={allTeamsOpts}
        gameTypes={gameTypesOpts}
        locations={locationsOpts}
        users={users}
        onChange={handleEditFormChange}
        loading={editSaving}
      />
    </>
  );
};

export default CompetitionGamesModal;
