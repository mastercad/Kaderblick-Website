import React, { useEffect, useState, useCallback, useRef } from 'react';
import SchoolIcon from '@mui/icons-material/School';
import FilterListIcon from '@mui/icons-material/FilterList';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import { Typography, FormControl, InputLabel, Select, MenuItem, Chip, Stack, IconButton, Tooltip } from '@mui/material';
import { apiJson, apiRequest } from '../utils/api';
import { AdminPageLayout, AdminEmptyState, AdminTable, AdminActions, AdminSnackbar, AdminTableColumn } from '../components/AdminPageLayout';
import CoachDetailsModal from '../modals/CoachDetailsModal';
import CoachDeleteConfirmationModal from '../modals/CoachDeleteConfirmationModal';
import CoachEditModal from '../modals/CoachEditModal';
import { Coach } from '../types/coach';
import { CoachClubAssignment } from '../types/coachClubAssignment';
import { CoachTeamAssignment } from '../types/coachTeamAssignment';
import { CoachLicenseAssignment } from '../types/coachLicenseAssignment';
import { CoachNationalityAssignment } from '../types/coachNationalityAssignment';
import { Team } from '../types/team';

const ALL_TEAMS = '__all__';

interface PaginatedCoachesResponse {
  coaches: Coach[];
  total: number;
  page: number;
  limit: number;
}

const Coaches = () => {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>(ALL_TEAMS);
  const [coachId, setCoachId] = useState<number | null>(null);
  const [coachDetailsModalOpen, setCoachDetailsModalOpen] = useState(false);
  const [coachEditModalOpen, setCoachEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteCoach, setDeleteCoach] = useState<Coach | null>(null);
  const [snackbar, setSnackbar] = useState<AdminSnackbar>({ open: false, message: '', severity: 'success' });
  const [watchedCoachIds, setWatchedCoachIds] = useState<Set<number>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
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

  // Load watchlist once to show active watch state per coach
  useEffect(() => {
    apiJson<{ watchlist: { type: string; coach?: { id: number } }[] }>('/api/watchlist')
      .then(res => {
        const ids = (res?.watchlist ?? [])
          .filter(e => e.type === 'coach' && e.coach?.id)
          .map(e => e.coach!.id);
        setWatchedCoachIds(new Set(ids));
      })
      .catch(() => {});
  }, []);

  const handleToggleWatch = async (coach: Coach) => {
    const isWatched = watchedCoachIds.has(coach.id);
    try {
      if (isWatched) {
        const res = await apiJson<{ watchlist: { id: number; type: string; coach?: { id: number } }[] }>('/api/watchlist');
        const entry = (res?.watchlist ?? []).find(e => e.type === 'coach' && e.coach?.id === coach.id);
        if (entry) {
          await apiRequest(`/api/watchlist/${entry.id}`, { method: 'DELETE' });
        }
        setWatchedCoachIds(prev => { const next = new Set(prev); next.delete(coach.id); return next; });
        setSnackbar({ open: true, message: 'Aus Beobachtungsliste entfernt.', severity: 'info' });
      } else {
        await apiRequest('/api/watchlist', { method: 'POST', body: { type: 'coach', targetId: coach.id } });
        setWatchedCoachIds(prev => new Set([...prev, coach.id]));
        setSnackbar({ open: true, message: 'Zur Beobachtungsliste hinzugefügt.', severity: 'success' });
      }
    } catch {
      setSnackbar({ open: true, message: 'Fehler beim Aktualisieren der Beobachtungsliste.', severity: 'error' });
    }
  };

  // Fetch paginated coaches whenever page, rowsPerPage, search, or teamId changes
  const loadCoaches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page + 1),
        limit: String(rowsPerPage),
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (selectedTeamId !== ALL_TEAMS) params.set('teamId', selectedTeamId);

      const res = await apiJson<PaginatedCoachesResponse>(`/api/coaches?${params}`);
      setCoaches(res?.coaches || []);
      setTotalCount(res?.total || 0);
    } catch {
      setError('Fehler beim Laden der Trainer.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, debouncedSearch, selectedTeamId]);

  useEffect(() => { loadCoaches(); }, [loadCoaches]);

  // Reset page when team filter changes
  useEffect(() => { setPage(0); }, [selectedTeamId]);

  const handleDelete = async (id: number) => {
    try {
      await apiJson(`/api/coaches/${id}`, { method: 'DELETE' });
      setDeleteModalOpen(false);
      setSnackbar({ open: true, message: 'Trainer gelöscht', severity: 'success' });
      loadCoaches();
    } catch {
      setSnackbar({ open: true, message: 'Fehler beim Löschen des Trainers.', severity: 'error' });
    }
  };

  const columns: AdminTableColumn<Coach>[] = [
    { header: 'Name', render: c => `${c.firstName || ''} ${c.lastName || ''}`.trim() },
    { header: 'Verein', render: c => c.clubAssignments?.map((a: CoachClubAssignment) => a.club.name).join(', ') || '' },
    { header: 'Teams', render: c => c.teamAssignments?.length > 0
      ? c.teamAssignments.map((a: CoachTeamAssignment) => (
          <Typography key={a.id} variant="body2" component="div" sx={{ lineHeight: 1.5 }}>
            {a.team.name}{a.team.type?.name ? ` (${a.team.type.name})` : ''}
          </Typography>
        ))
      : ''
    },
    { header: 'Lizenzen', render: c => c.licenseAssignments?.map((a: CoachLicenseAssignment) => a.license.name).join(', ') || '' },
    { header: 'Nationalitäten', render: c => c.nationalityAssignments?.map((a: CoachNationalityAssignment) => a.nationality.name).join(', ') || '' },
  ];

  const teamFilter = teams.length > 1 ? (
    <Stack direction="row" spacing={2} sx={{
      alignItems: "center"
    }}>
      <FilterListIcon color="action" fontSize="small" />
      <FormControl size="small" sx={{ minWidth: 250 }}>
        <InputLabel id="coach-team-filter-label">Team filtern</InputLabel>
        <Select
          labelId="coach-team-filter-label"
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
        <Chip label={`${totalCount} Trainer`} size="small" color="primary" variant="outlined" />
      )}
    </Stack>
  ) : teams.length === 1 ? (
    <Stack direction="row" spacing={1} sx={{
      alignItems: "center"
    }}>
      <FilterListIcon color="action" fontSize="small" />
      <Chip label={teams[0].name} size="small" color="primary" />
      <Chip label={`${totalCount} Trainer`} size="small" color="primary" variant="outlined" />
    </Stack>
  ) : null;

  return (
    <AdminPageLayout
      icon={<SchoolIcon />}
      title="Trainer"
      itemCount={totalCount}
      loading={loading}
      error={error}
      createLabel="Neuer Trainer"
      onCreate={() => { setCoachId(null); setCoachEditModalOpen(true); }}
      search={search}
      onSearchChange={handleSearchChange}
      searchPlaceholder="Trainer suchen..."
      snackbar={snackbar}
      onSnackbarClose={() => setSnackbar(s => ({ ...s, open: false }))}
      filterControls={teamFilter}
    >
      {coaches.length === 0 && !loading ? (
        <AdminEmptyState icon={<SchoolIcon />} title="Keine Trainer vorhanden" createLabel="Neuer Trainer" onCreate={() => { setCoachId(null); setCoachEditModalOpen(true); }} />
      ) : (
        <AdminTable columns={columns} data={coaches} getKey={c => c.id}
          serverPagination={{
            page,
            rowsPerPage,
            totalCount,
            onPageChange: setPage,
            onRowsPerPageChange: setRowsPerPage,
          }}
          onRowClick={c => { setCoachId(c.id); setCoachDetailsModalOpen(true); }}
          renderActions={c => (
            <Stack direction="row" spacing={0} sx={{
              alignItems: "center"
            }}>
              <Tooltip title={watchedCoachIds.has(c.id) ? 'Beobachtung beenden' : 'Beobachten'}>
                <IconButton
                  size="small"
                  onClick={e => { e.stopPropagation(); handleToggleWatch(c); }}
                  color={watchedCoachIds.has(c.id) ? 'primary' : 'default'}
                >
                  {watchedCoachIds.has(c.id) ? <BookmarkIcon fontSize="small" /> : <BookmarkBorderIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              <AdminActions
                onDetails={() => { setCoachId(c.id); setCoachDetailsModalOpen(true); }}
                onEdit={c.permissions?.canEdit ? () => { setCoachId(c.id); setCoachEditModalOpen(true); } : undefined}
                onDelete={c.permissions?.canDelete ? () => { setDeleteCoach(c); setDeleteModalOpen(true); } : undefined}
              />
            </Stack>
          )}
        />
      )}
      <CoachDetailsModal open={coachDetailsModalOpen} loadCoaches={() => loadCoaches()} coachId={coachId} onClose={() => setCoachDetailsModalOpen(false)} />
      <CoachEditModal openCoachEditModal={coachEditModalOpen} coachId={coachId} onCoachEditModalClose={() => setCoachEditModalOpen(false)} onCoachSaved={() => { setCoachEditModalOpen(false); loadCoaches(); }} />
      <CoachDeleteConfirmationModal open={deleteModalOpen} coachName={deleteCoach ? `${deleteCoach.firstName} ${deleteCoach.lastName}` : ''} onClose={() => setDeleteModalOpen(false)} onConfirm={async () => handleDelete(deleteCoach!.id)} />
    </AdminPageLayout>
  );
};

export default Coaches;
