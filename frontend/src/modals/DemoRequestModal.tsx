import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  TextField,
  Typography,
} from '@mui/material';
import SportsSoccerOutlinedIcon from '@mui/icons-material/SportsSoccerOutlined';
import { apiJson, getApiErrorMessage } from '../utils/api';
import BaseModal from './BaseModal';

interface DemoRequestModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormState {
  name: string;
  email: string;
  clubName: string;
  league: string;
  ageGroup: string;
  phone: string;
  message: string;
}

const emptyForm: FormState = {
  name: '',
  email: '',
  clubName: '',
  league: '',
  ageGroup: '',
  phone: '',
  message: '',
};

const DemoRequestModal: React.FC<DemoRequestModalProps> = ({ open, onClose }) => {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (submitting) return;
    setForm(emptyForm);
    setSuccess(false);
    setError(null);
    onClose();
  };

  const handleChange = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);

    try {
      await apiJson('/api/demo-request', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          email: form.email.trim(),
          clubName: form.clubName.trim() || undefined,
          league: form.league.trim() || undefined,
          ageGroup: form.ageGroup.trim() || undefined,
          phone: form.phone.trim() || undefined,
          message: form.message.trim() || undefined,
        },
      });
      setSuccess(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = form.name.trim().length > 0 && form.email.trim().length > 0;

  return (
    <BaseModal
      open={open}
      onClose={handleClose}
      title={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SportsSoccerOutlinedIcon sx={{ color: 'primary.main' }} />
          Demo anfragen
        </Box>
      }
      maxWidth="sm"
      disableBackdropClick={submitting}
      actions={
        success ? (
          <Button onClick={handleClose} variant="contained">
            Schließen
          </Button>
        ) : (
          <>
            <Button onClick={handleClose} variant="outlined" color="secondary" disabled={submitting}>
              Abbrechen
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={submitting || !isValid}
            >
              {submitting ? 'Wird gesendet…' : 'Demo anfragen'}
            </Button>
          </>
        )
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
        {success ? (
          <>
            <Alert severity="success" sx={{ borderRadius: 2 }}>
              Deine Demo-Anfrage ist eingegangen! Wir melden uns so schnell wie möglich per E-Mail bei dir.
            </Alert>
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>
              Zur Bestätigung haben wir dir eine E-Mail an <strong>{form.email}</strong> geschickt.
            </Typography>
          </>
        ) : (
          <>
            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>
              Füll das Formular aus und wir melden uns direkt bei dir. Pflichtfelder sind mit * markiert.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Name *"
                value={form.name}
                onChange={handleChange('name')}
                autoFocus
                fullWidth
                slotProps={{ htmlInput: { maxLength: 255 } }}
              />
              <TextField
                label="E-Mail *"
                type="email"
                value={form.email}
                onChange={handleChange('email')}
                fullWidth
                slotProps={{ htmlInput: { maxLength: 255 } }}
              />
              <TextField
                label="Telefon (optional)"
                type="tel"
                value={form.phone}
                onChange={handleChange('phone')}
                fullWidth
                slotProps={{ htmlInput: { maxLength: 50 } }}
              />
            </Box>

            <Divider />

            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                mt: -1
              }}>
              Optionale Angaben – helfen uns, die Demo besser auf euren Verein zuzuschneiden
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Vereinsname"
                value={form.clubName}
                onChange={handleChange('clubName')}
                fullWidth
                slotProps={{ htmlInput: { maxLength: 255 } }}
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Liga"
                  value={form.league}
                  onChange={handleChange('league')}
                  fullWidth
                  slotProps={{ htmlInput: { maxLength: 255 } }}
                />
                <TextField
                  label="Altersgruppe / Team"
                  value={form.ageGroup}
                  onChange={handleChange('ageGroup')}
                  fullWidth
                  slotProps={{ htmlInput: { maxLength: 255 } }}
                />
              </Box>
              <TextField
                label="Nachricht / Kommentar"
                value={form.message}
                onChange={handleChange('message')}
                fullWidth
                multiline
                minRows={3}
                slotProps={{ htmlInput: { maxLength: 2000 } }}
              />
            </Box>
          </>
        )}
      </Box>
    </BaseModal>
  );
};

export default DemoRequestModal;
