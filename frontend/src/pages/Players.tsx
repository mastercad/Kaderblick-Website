import React, { useEffect, useState, useCallback, useRef } from 'react';
import PersonIcon from '@mui/icons-material/Person';
import FilterListIcon from '@mui/icons-material/FilterList';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import { SharePosterButton } from './PosterGenerator/components/SharePosterButton';
import { Typography, FormControl, InputLabel, Select, MenuItem, Chip, Stack, IconButton, Tooltip } from '@mui/material';
import { apiJson, apiRequest } from '../utils/api';
import { AdminPageLayout, AdminEmptyState, AdminTable, AdminActions, AdminSnackbar, AdminTableColumn } from '../components/AdminPageLayout';
import PlayerDetailsModal from '../modals/PlayerDetailsModal';
import PlayerDeleteConfirmationModal from '../modals/PlayerDeleteConfirmationModal';
import PlayerEditModal from '../modals/PlayerEditModal';
import { Player } from '../types/player';
import { PlayerClubAssignment } from '../types/playerClubAssignment';
import { PlayerTeamAssignment } from '../types/playerTeamAssignment';
import { PlayerNationalityAssignment } from '../types/playerNationalityAssignment';
import { Team } from '../types/team';

const ALL_TEAMS = '__all__';

interface PaginatedPlayersResponse {
  players: Player[];
  total: number;
  page: number;
  limit: number;
  availableSeasons?: number[];
  selectedSeason?: number;
}

const Players = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>(ALL_TEAMS);
  const [selectedSeason, setSelectedSeason] = useState<number>(() => {
    const today = new Date();
    return today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  });
  const [availableSeasons, setAvailableSeasons] = useState<number[]>(() => {
    const today = new Date();
    const defaultY = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
    return Array.from({ length: defaultY - 2020 }, (_, i) => 2021 + i);
  });
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [playerDetailsModalOpen, setPlayerDetailsModalOpen] = useState(false);
  const [playerEditModalOpen, setPlayerEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePlayer, setDeletePlayer] = useState<Player | null>(null);
  const [snackbar, setSnackbar] = useState<AdminSnackbar>({ open: false, message: '', severity: 'success' });
  const [watchedPlayerIds, setWatchedPlayerIds] = useState<Set<number>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0); // reset to first page on new search
    }, 350);
  }, []);

  // Load teams once (for filter dropdown)
  useEffect(() => {
    apiJson<{ teams: Team[] }>('/api/teams/list').then(res => {
      const loadedTeams = res?.teams || [];
      setTeams(loadedTeams);
      if (loadedTeams.length === 1) {
        setSelectedTeamId(String(loadedTeams[0].id));
      }
    }).catch(() => {});
  }, []);

  // Load watchlist once so we can show active watch state per player
  useEffect(() => {
    apiJson<{ watchlist: { type: string; player?: { id: number } }[] }>('/api/watchlist')
      .then(res => {
        const ids = (res?.watchlist ?? [])
          .filter(e => e.type === 'player' && e.player?.id)
          .map(e => e.player!.id);
        setWatchedPlayerIds(new Set(ids));
      })
      .catch(() => {});
  }, []);

  const handleToggleWatch = async (player: Player) => {
    const isWatched = watchedPlayerIds.has(player.id);
    try {
      if (isWatched) {
        // We need the watchlist entry id — simpler to just reload after removal
        const res = await apiJson<{ watchlist: { id: number; type: string; player?: { id: number } }[] }>('/api/watchlist');
        const entry = (res?.watchlist ?? []).find(e => e.type === 'player' && e.player?.id === player.id);
        if (entry) {
          await apiRequest(`/api/watchlist/${entry.id}`, { method: 'DELETE' });
        }
        setWatchedPlayerIds(prev => { const next = new Set(prev); next.delete(player.id); return next; });
        setSnackbar({ open: true, message: 'Aus Beobachtungsliste entfernt.', severity: 'info' });
      } else {
        await apiRequest('/api/watchlist', { method: 'POST', body: { type: 'player', targetId: player.id } });
        setWatchedPlayerIds(prev => new Set([...prev, player.id]));
        setSnackbar({ open: true, message: 'Zur Beobachtungsliste hinzugefügt.', severity: 'success' });
      }
    } catch {
      setSnackbar({ open: true, message: 'Fehler beim Aktualisieren der Beobachtungsliste.', severity: 'error' });
    }
  };

  // Fetch paginated players whenever page, rowsPerPage, search, or teamId changes
  const loadPlayers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page + 1), // backend is 1-based
        limit: String(rowsPerPage),
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (selectedTeamId !== ALL_TEAMS) params.set('teamId', selectedTeamId);
      params.set('season', String(selectedSeason));

      const res = await apiJson<PaginatedPlayersResponse>(`/api/players?${params}`);
      setPlayers(res?.players || []);
      setTotalCount(res?.total || 0);
      if (res?.availableSeasons?.length) setAvailableSeasons(res.availableSeasons);
    } catch {
      setError('Fehler beim Laden der Spieler.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, debouncedSearch, selectedTeamId, selectedSeason]);

  useEffect(() => { loadPlayers(); }, [loadPlayers]);

  // Reset page when team or season filter changes
  useEffect(() => { setPage(0); }, [selectedTeamId]);
  useEffect(() => { setPage(0); }, [selectedSeason]);

  const handleDelete = async (id: number) => {
    try {
      await apiJson(`/api/players/${id}`, { method: 'DELETE' });
      setDeleteModalOpen(false);
      setSnackbar({ open: true, message: 'Spieler gelöscht', severity: 'success' });
      loadPlayers(); // reload current page
    } catch {
      setSnackbar({ open: true, message: 'Fehler beim Löschen des Spielers.', severity: 'error' });
    }
  };

  const columns: AdminTableColumn<Player>[] = [
    { header: 'Name', render: p => `${p.firstName || ''} ${p.lastName || ''}`.trim() },
    { header: 'Verein', render: p => p.clubAssignments?.map((a: PlayerClubAssignment) => a.club.name).join(', ') || '' },
    { header: 'Teams', render: p => {
        // Bei aktivem Team-Filter: nur das gefilterte Team anzeigen.
        // Sonst: alle Assignments zeigen, die vom Backend für die gewählte Saison zurückkamen
        // (Backend liefert bereits nur saisongefilterte Assignments im Nicht-searchAll-Modus).
        const assignments: PlayerTeamAssignment[] = selectedTeamId !== ALL_TEAMS
          ? (p.teamAssignments || []).filter((a: PlayerTeamAssignment) => String(a.team?.id) === selectedTeamId)
          : (p.teamAssignments || []);
        return assignments.length > 0
          ? assignments.map((a: PlayerTeamAssignment) => (
              <Typography key={a.id} variant="body2" component="div" sx={{ lineHeight: 1.5 }}>
                {a.team.name} ({a.shirtNumber}) - {a.team.ageGroup?.name || ''}
                {a.type?.name ? ` (${a.type.name})` : ''}
              </Typography>
            ))
          : '';
      }
    },
    { header: 'Nationalitäten', render: p => p.nationalityAssignments?.map((a: PlayerNationalityAssignment) => a.nationality.name).join(', ') || '' },
  ];

  const filterControls = (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      spacing={{ xs: 1.5, sm: 2 }}
    >
      {/* Season selector */}
      <FormControl size="small" sx={{ width: { xs: '100%', sm: 200 } }}>
        <InputLabel id="players-season-label">Saison</InputLabel>
        <Select
          labelId="players-season-label"
          label="Saison"
          value={selectedSeason}
          onChange={e => { setSelectedSeason(e.target.value as number); setPage(0); }}
        >
          {availableSeasons.map(y => (
            <MenuItem key={y} value={y}>{y}/{String(y + 1).slice(2)}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Team selector */}
      {teams.length > 1 && (
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} spacing={{ xs: 1, sm: 2 }}>
          <FilterListIcon color="action" fontSize="small" sx={{ display: { xs: 'none', sm: 'block' } }} />
          <FormControl size="small" sx={{ width: { xs: '100%', sm: 250 } }}>
            <InputLabel id="team-filter-label">Team filtern</InputLabel>
            <Select
              labelId="team-filter-label"
              value={selectedTeamId}
              label="Team filtern"
              onChange={e => setSelectedTeamId(e.target.value)}
            >
              <MenuItem value={ALL_TEAMS}>Alle Teams</MenuItem>
              {teams.map(t => (
                <MenuItem key={t.id} value={String(t.id)}>{t.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedTeamId !== ALL_TEAMS && (
            <Chip label={`${totalCount} Spieler`} size="small" color="primary" variant="outlined" />
          )}
        </Stack>
      )}
      {teams.length === 1 && (
        <Stack direction="row" alignItems="center" spacing={1}>
          <FilterListIcon color="action" fontSize="small" />
          <Chip label={teams[0].name} size="small" color="primary" />
          <Chip label={`${totalCount} Spieler`} size="small" color="primary" variant="outlined" />
        </Stack>
      )}
    </Stack>
  );

  return (
    <AdminPageLayout
      icon={<PersonIcon />}
      title="Spieler"
      itemCount={totalCount}
      loading={loading}
      error={error}
      createLabel="Neuer Spieler"
      onCreate={() => { setPlayerId(null); setPlayerEditModalOpen(true); }}
      search={search}
      onSearchChange={handleSearchChange}
      searchPlaceholder="Spieler suchen..."
      snackbar={snackbar}
      onSnackbarClose={() => setSnackbar(s => ({ ...s, open: false }))}
      filterControls={filterControls}
    >
      {players.length === 0 && !loading ? (
        <AdminEmptyState icon={<PersonIcon />} title="Keine Spieler vorhanden" createLabel="Neuer Spieler" onCreate={() => { setPlayerId(null); setPlayerEditModalOpen(true); }} />
      ) : (
        <AdminTable columns={columns} data={players} getKey={p => p.id}
          serverPagination={{
            page,
            rowsPerPage,
            totalCount,
            onPageChange: setPage,
            onRowsPerPageChange: setRowsPerPage,
          }}
          onRowClick={p => { setPlayerId(p.id); setPlayerDetailsModalOpen(true); }}
          renderActions={p => (
            <Stack direction="row" alignItems="center" spacing={0}>
              <SharePosterButton
                payload={{ templateId: 'player-highlight', data: { player: p } }}
                label="Spieler-Highlight teilen"
              />
              <Tooltip title={watchedPlayerIds.has(p.id) ? 'Beobachtung beenden' : 'Beobachten'}>
                <IconButton
                  size="small"
                  onClick={e => { e.stopPropagation(); handleToggleWatch(p); }}
                  color={watchedPlayerIds.has(p.id) ? 'primary' : 'default'}
                >
                  {watchedPlayerIds.has(p.id) ? <BookmarkIcon fontSize="small" /> : <BookmarkBorderIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              <AdminActions
                onDetails={() => { setPlayerId(p.id); setPlayerDetailsModalOpen(true); }}
                onEdit={p.permissions?.canEdit ? () => { setPlayerId(p.id); setPlayerEditModalOpen(true); } : undefined}
                onDelete={p.permissions?.canDelete ? () => { setDeletePlayer(p); setDeleteModalOpen(true); } : undefined}
              />
            </Stack>
          )}
        />
      )}

      <PlayerDetailsModal open={playerDetailsModalOpen} loadPlayeres={() => loadPlayers()} playerId={playerId} onClose={() => setPlayerDetailsModalOpen(false)} />
      <PlayerEditModal openPlayerEditModal={playerEditModalOpen} playerId={playerId} onPlayerEditModalClose={() => setPlayerEditModalOpen(false)} onPlayerSaved={() => { setPlayerEditModalOpen(false); loadPlayers(); }} />
      <PlayerDeleteConfirmationModal open={deleteModalOpen} playerName={deletePlayer ? `${deletePlayer.firstName} ${deletePlayer.lastName}` : ''} onClose={() => setDeleteModalOpen(false)} onConfirm={async () => handleDelete(deletePlayer!.id)} />
    </AdminPageLayout>
  );
};

export default Players;
