import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useAuth } from '../../../context/AuthContext';
import { getApiErrorMessage } from '../../../utils/api';
import type { QuickEventButton } from '../../../modals/quick-event/types';
import {
  activatePreset,
  copyPreset,
  createPreset,
  deactivatePreset,
  deletePreset,
  fetchPresets,
  sharePreset,
  updatePreset,
} from './presetApi';
import { PresetEditDialog } from './PresetEditDialog';
import { PresetList } from './PresetList';
import { SharePresetDialog } from './SharePresetDialog';
import type { QuickEventPreset } from './types';

function usePresets() {
  const [presets, setPresets] = useState<QuickEventPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPresets();
      setPresets(data);
      setError('');
    } catch (e) {
      setError(getApiErrorMessage(e, 'Konfigurationen konnten nicht geladen werden.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { presets, setPresets, loading, error, reload: load };
}

export default function QuickEventPresets() {
  const { user, isSuperAdmin } = useAuth();
  const rolesArray = Object.values(user?.roles ?? {});
  const isAllowed =
    isSuperAdmin ||
    rolesArray.includes('ROLE_SUPPORTER') ||
    (user?.isCoach === true);

  const { presets, setPresets, loading, error, reload } = usePresets();
  const [editTarget, setEditTarget] = useState<QuickEventPreset | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<QuickEventPreset | null>(null);
  const [removeShareTarget, setRemoveShareTarget] = useState<QuickEventPreset | null>(null);
  const [shareTarget, setShareTarget] = useState<QuickEventPreset | null>(null);
  const [actionError, setActionError]   = useState('');

  const currentUserId = user?.id ?? -1;

  // Split presets into own and shared-with-me
  const ownPresets = presets.filter((p) => p.ownerId === currentUserId);
  const sharedPresets = presets.filter(
    (p) => p.ownerId !== currentUserId && p.sharedWithUserIds.includes(currentUserId),
  );

  if (!isAllowed) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Alert severity="error">Zugriff verweigert.</Alert>
      </Container>
    );
  }

  const handleSave = async (name: string, buttons: QuickEventButton[]) => {
    const config = { buttons };
    if (editTarget) {
      const updated = await updatePreset(editTarget.id, name, config);
      setPresets((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } else {
      const created = await createPreset(name, config);
      setPresets((prev) => [...prev, created]);
    }
  };

  const handleActivate = async (preset: QuickEventPreset) => {
    try {
      const updated = await activatePreset(preset.id);
      setPresets((prev) =>
        prev.map((p) => ({ ...p, isActive: p.id === updated.id })),
      );
      setActionError('');
    } catch {
      setActionError('Aktivieren fehlgeschlagen.');
    }
  };

  const handleDeactivate = async (preset: QuickEventPreset) => {
    try {
      const updated = await deactivatePreset(preset.id);
      setPresets((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setActionError('');
    } catch {
      setActionError('Deaktivieren fehlgeschlagen.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deletePreset(deleteTarget.id);
      setPresets((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
      setActionError('');
    } catch {
      setActionError('Löschen fehlgeschlagen.');
      setDeleteTarget(null);
    }
  };

  /** Copy a preset and add it to the list */
  const handleCopy = async (preset: QuickEventPreset) => {
    try {
      const copied = await copyPreset(preset.id);
      setPresets((prev) => [...prev, copied]);
      setActionError('');
    } catch {
      setActionError('Kopieren fehlgeschlagen.');
    }
  };

  /**
   * For shared presets: "editing" means copy-first, then open editor on the copy.
   * For own presets: open editor directly.
   */
  const handleEdit = async (preset: QuickEventPreset) => {
    const isOwn = preset.ownerId === currentUserId;
    if (isOwn) {
      setEditTarget(preset);
      return;
    }
    // Auto-copy shared preset, then open editor
    try {
      const copied = await copyPreset(preset.id);
      setPresets((prev) => [...prev, copied]);
      setEditTarget(copied);
    } catch {
      setActionError('Kopieren vor dem Bearbeiten fehlgeschlagen.');
    }
  };

  /** Remove current user from the sharedWith of a preset */
  const handleRemoveShare = async () => {
    if (!removeShareTarget) return;
    try {
      const updated = await sharePreset(
        removeShareTarget.id,
        removeShareTarget.sharedWithUserIds.filter((id) => id !== currentUserId),
      );
      setPresets((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setRemoveShareTarget(null);
      setActionError('');
    } catch {
      setActionError('Freigabe entfernen fehlgeschlagen.');
      setRemoveShareTarget(null);
    }
  };

  /** Called when SharePresetDialog saved successfully */
  const handleShared = (updated: QuickEventPreset) => {
    setPresets((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Quick-Event-Konfigurationen
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setEditTarget(null)}
        >
          Neue Konfiguration
        </Button>
      </Box>

      {(error || actionError) && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => { reload(); setActionError(''); }}>
          {error || actionError}
        </Alert>
      )}

      <PresetList
        ownPresets={ownPresets}
        sharedPresets={sharedPresets}
        loading={loading}
        onAdd={() => setEditTarget(null)}
        onEdit={handleEdit}
        onDelete={(p) => setDeleteTarget(p)}
        onActivate={handleActivate}
        onDeactivate={handleDeactivate}
        onShare={(p) => setShareTarget(p)}
        onCopy={handleCopy}
        onRemoveShare={(p) => setRemoveShareTarget(p)}
      />

      <PresetEditDialog
        open={editTarget !== undefined}
        preset={editTarget ?? null}
        onSave={handleSave}
        onClose={() => setEditTarget(undefined)}
      />

      <SharePresetDialog
        preset={shareTarget}
        onClose={() => setShareTarget(null)}
        onShared={handleShared}
      />

      {/* Delete own preset dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Konfiguration löschen</DialogTitle>
        <DialogContent>
          <Typography>
            „{deleteTarget?.name}" wirklich löschen?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Abbrechen</Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm}>
            Löschen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remove share dialog */}
      <Dialog open={!!removeShareTarget} onClose={() => setRemoveShareTarget(null)}>
        <DialogTitle>Freigabe entfernen</DialogTitle>
        <DialogContent>
          <Typography>
            „{removeShareTarget?.name}" aus deinen geteilten Konfigurationen entfernen?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveShareTarget(null)}>Abbrechen</Button>
          <Button color="error" variant="contained" onClick={handleRemoveShare}>
            Entfernen
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
