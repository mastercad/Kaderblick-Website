import React, { useEffect, useState, useMemo } from 'react';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import ListAltIcon from '@mui/icons-material/ListAlt';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import { apiJson } from '../utils/api';
import { AdminPageLayout, AdminEmptyState, AdminTable, AdminActions, AdminSnackbar, AdminTableColumn } from '../components/AdminPageLayout';
import CupDeleteConfirmationModal from '../modals/CupDeleteConfirmationModal';
import CupEditModal from '../modals/CupEditModal';
import CupRoundsAdminModal from '../modals/CupRoundsAdminModal';
import CompetitionGamesModal from '../modals/CompetitionGamesModal';
import { Cup } from '../types/cup';

const Cups = () => {
  const [cups, setCups] = useState<Cup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cupId, setCupId] = useState<number | null>(null);
  const [cupEditModalOpen, setCupEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteCup, setDeleteCup] = useState<Cup | null>(null);
  const [gamesModal, setGamesModal] = useState<{ id: number; name: string } | null>(null);
  const [roundsModalOpen, setRoundsModalOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<AdminSnackbar>({ open: false, message: '', severity: 'success' });

  const loadCups = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<{ cups: Cup[] }>('/api/cups');
      setCups(res && Array.isArray(res.cups) ? res.cups : []);
    } catch {
      setError('Fehler beim Laden der Pokale.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCups(); }, []);

  const handleDelete = async (id: number) => {
    try {
      await apiJson(`/api/cups/${id}`, { method: 'DELETE' });
      setCups(prev => prev.filter(c => c.id !== id));
      setDeleteModalOpen(false);
      setSnackbar({ open: true, message: 'Pokal gelöscht', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Fehler beim Löschen des Pokals.', severity: 'error' });
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return cups;
    const q = search.toLowerCase();
    return cups.filter(c => (c.name || '').toLowerCase().includes(q));
  }, [cups, search]);

  const columns: AdminTableColumn<Cup>[] = [
    { header: 'Name', render: c => c.name || '' },
    {
      header: 'Spiele',
      width: 100,
      align: 'center',
      render: c => (
        <Chip
          label={c.gameCount ?? 0}
          size="small"
          color={(c.gameCount ?? 0) > 0 ? 'primary' : 'default'}
          onClick={() => setGamesModal({ id: c.id, name: c.name })}
          clickable
        />
      ),
    },
  ];

  return (
    <AdminPageLayout
      icon={<WorkspacePremiumIcon />}
      title="Pokale"
      itemCount={cups.length}
      loading={loading}
      error={error}
      createLabel="Neuer Pokal"
      onCreate={() => { setCupId(null); setCupEditModalOpen(true); }}
      filterControls={
        <Button
          variant="outlined"
          size="small"
          startIcon={<ListAltIcon />}
          onClick={() => setRoundsModalOpen(true)}
        >
          Rundennamen verwalten
        </Button>
      }
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Pokal suchen..."
      snackbar={snackbar}
      onSnackbarClose={() => setSnackbar(s => ({ ...s, open: false }))}
    >
      {filtered.length === 0 ? (
        <AdminEmptyState icon={<WorkspacePremiumIcon />} title="Keine Pokale vorhanden" createLabel="Neuer Pokal" onCreate={() => { setCupId(null); setCupEditModalOpen(true); }} />
      ) : (
        <AdminTable columns={columns} data={filtered} getKey={c => c.id}
          renderActions={c => (
            <AdminActions
              onEdit={c.permissions?.canEdit ? () => { setCupId(c.id); setCupEditModalOpen(true); } : undefined}
              onDelete={c.permissions?.canDelete ? () => { setDeleteCup(c); setDeleteModalOpen(true); } : undefined}
            />
          )}
        />
      )}

      <CupEditModal openCupEditModal={cupEditModalOpen} cupId={cupId} onCupEditModalClose={() => setCupEditModalOpen(false)} onCupSaved={() => { setCupEditModalOpen(false); loadCups(); }} />
      <CupDeleteConfirmationModal open={deleteModalOpen} cupName={deleteCup?.name} onClose={() => setDeleteModalOpen(false)} onConfirm={async () => handleDelete(deleteCup!.id)} />
      <CupRoundsAdminModal open={roundsModalOpen} onClose={() => setRoundsModalOpen(false)} />
      <CompetitionGamesModal
        open={!!gamesModal}
        onClose={() => setGamesModal(null)}
        competitionId={gamesModal?.id ?? null}
        competitionName={gamesModal?.name ?? ''}
        competitionType="cup"
        onGamesChanged={(count) => setCups(prev => prev.map(c => c.id === gamesModal!.id ? { ...c, gameCount: count } : c))}
      />
    </AdminPageLayout>
  );
};

export default Cups;
