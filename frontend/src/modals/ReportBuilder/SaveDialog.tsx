import React, { useEffect, useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';

interface SaveDialogProps {
  open: boolean;
  /** Pre-filled name suggestion (template title or existing report name) */
  defaultName: string;
  /** Pre-filled description suggestion */
  defaultDescription?: string;
  saving: boolean;
  onSave: (name: string, description: string) => void;
  onCancel: () => void;
}

/**
 * Small confirmation dialog that asks for name + description right before saving.
 * This keeps the configuration view clean while still allowing the user to name the report.
 */
export const SaveDialog: React.FC<SaveDialogProps> = ({
  open,
  defaultName,
  defaultDescription = '',
  saving,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription);

  // Sync when defaultName changes (e.g. user picks different template)
  useEffect(() => {
    if (open) {
      setName(defaultName);
      setDescription(defaultDescription);
    }
  }, [open, defaultName, defaultDescription]);

  const canConfirm = name.trim().length > 0 && !saving;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canConfirm) {
      onSave(name.trim(), description.trim());
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="xs"
      fullWidth
      disableEscapeKeyDown={saving}
    >
      <DialogTitle>Auswertung speichern</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
        <TextField
          autoFocus
          fullWidth
          label="Name *"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          helperText={!name.trim() ? 'Pflichtfeld' : undefined}
          error={!name.trim()}
          inputProps={{ maxLength: 120 }}
        />
        <TextField
          fullWidth
          label="Beschreibung (optional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          multiline
          rows={2}
          placeholder="Kurze Notiz zum Zweck dieser Auswertung"
          inputProps={{ maxLength: 500 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={saving} variant="outlined" color="secondary">
          Zurück
        </Button>
        <Button
          onClick={() => onSave(name.trim(), description.trim())}
          disabled={!canConfirm}
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Speichern
        </Button>
      </DialogActions>
    </Dialog>
  );
};
