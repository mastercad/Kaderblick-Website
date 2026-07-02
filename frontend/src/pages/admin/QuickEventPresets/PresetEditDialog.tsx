import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import { DEFAULT_QUICK_EVENT_CONFIG } from '../../../modals/quick-event/defaultConfig';
import type { QuickEventButton } from '../../../modals/quick-event/types';
import { WysiwygPanel } from './WysiwygPanel';
import type { QuickEventPreset } from './types';

interface PresetEditDialogProps {
  open: boolean;
  preset: QuickEventPreset | null; // null = create mode
  onSave: (name: string, buttons: QuickEventButton[]) => Promise<void>;
  onClose: () => void;
}

export function PresetEditDialog({ open, preset, onSave, onClose }: PresetEditDialogProps) {
  const [name, setName]       = useState('');
  const [buttons, setButtons] = useState<QuickEventButton[]>([]);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (preset) {
      setName(preset.name);
      setButtons(preset.config.buttons ?? []);
    } else {
      setName('');
      setButtons(DEFAULT_QUICK_EVENT_CONFIG.buttons);
    }
    setError('');
    setErrorDialogOpen(false);
  }, [open, preset]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name darf nicht leer sein.');
      setErrorDialogOpen(true);
      return;
    }
    setSaving(true);
    try {
      await onSave(name.trim(), buttons);
      onClose();
    } catch {
      setError('Speichern fehlgeschlagen. Bitte erneut versuchen.');
      setErrorDialogOpen(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {preset ? 'Konfiguration bearbeiten' : 'Neue Konfiguration'}
        <IconButton onClick={onClose} size="small" aria-label="Schließen">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, overflowX: 'hidden' }}
      >
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          required
          autoFocus
          error={!!error && !name.trim()}
        />

        <WysiwygPanel buttons={buttons} onChange={setButtons} />
      </DialogContent>
      <DialogActions>
        <Box sx={{ flex: 1, pl: 1 }}>
          <Typography variant="caption" sx={{
            color: "text.disabled"
          }}>
            {buttons.length} Button{buttons.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
        <Button onClick={onClose} disabled={saving}>
          Abbrechen
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
        >
          Speichern
        </Button>
      </DialogActions>
    </Dialog>
    <Dialog
      open={errorDialogOpen}
      onClose={() => setErrorDialogOpen(false)}
      maxWidth="xs"
      fullWidth
      aria-labelledby="quick-event-preset-error-title"
    >
      <DialogTitle
        id="quick-event-preset-error-title"
        sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}
      >
        <ErrorOutlineIcon color="error" />
        Konfiguration kann nicht gespeichert werden
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ color: 'text.primary' }}>
          {error}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={() => setErrorDialogOpen(false)} autoFocus>
          OK
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}
