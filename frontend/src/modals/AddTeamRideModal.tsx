import React, { useState } from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import { apiJson } from '../utils/api';
import BaseModal from './BaseModal';

interface AddTeamRideModalProps {
  open: boolean;
  onClose: () => void;
  eventId: number | null;
  onAdded?: () => void;
}

const AddTeamRideModal: React.FC<AddTeamRideModalProps> = ({ open, onClose, eventId, onAdded }) => {
  const [seats, setSeats] = useState(1);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAddRide = () => {
    if (!eventId || seats < 1) return;
    setSaving(true);
    apiJson(`/api/teamrides/add`, {
      method: 'POST',
      body: { event_id: eventId, seats, note },
    })
      .then(() => {
        if (onAdded) onAdded();
        onClose();
      })
      .finally(() => setSaving(false));
  };

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title="Mitfahrgelegenheit anbieten"
      maxWidth="xs"
      actions={
        <>
          <Button onClick={onClose} color="secondary" variant="outlined" disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={handleAddRide} color="primary" variant="contained" disabled={saving || seats < 1}>
            {saving ? 'Wird angeboten...' : 'Anbieten'}
          </Button>
        </>
      }
    >
      <Box
        sx={{
          mb: 2,
          mt: 1
        }}>
        <TextField
          label="Anzahl Plätze"
          type="number"
          value={seats}
          onChange={e => setSeats(Number(e.target.value))}
          fullWidth
          disabled={saving}
          slotProps={{
            htmlInput: { min: 1 }
          }}
        />
      </Box>
      <Box sx={{
        mb: 2
      }}>
        <TextField
          label="Notiz (optional)"
          value={note}
          onChange={e => setNote(e.target.value)}
          fullWidth
          multiline
          minRows={1}
          maxRows={3}
          disabled={saving}
        />
      </Box>
    </BaseModal>
  );
};

export default AddTeamRideModal;
