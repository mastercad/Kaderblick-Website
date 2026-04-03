import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, TextField, Typography } from '@mui/material';
import BaseModal from './BaseModal';
import { apiJson, getApiErrorMessage } from '../utils/api';

interface SupporterRequestResponse {
  request: {
    id: number;
    status: 'pending' | 'approved' | 'rejected';
    note?: string | null;
    createdAt: string;
    processedAt?: string | null;
  } | null;
  hasSupporterRole?: boolean;
}

interface SupporterApplicationModalProps {
  open: boolean;
  onClose: () => void;
}

export const SupporterApplicationModal: React.FC<SupporterApplicationModalProps> = ({ open, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<SupporterRequestResponse['request']>(null);
  const [hasSupporterRole, setHasSupporterRole] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setLoading(true);
    setError(null);
    setSubmitted(false);

    apiJson<SupporterRequestResponse>('/api/supporter-request/mine')
      .then((data) => {
        setRequest(data.request ?? null);
        setHasSupporterRole(Boolean(data.hasSupporterRole));
      })
      .catch((err) => {
        setError(getApiErrorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [open]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await apiJson<SupporterRequestResponse>('/api/supporter-request', {
        method: 'POST',
        body: {
          note: note.trim() || null,
        },
      });

      setRequest(response.request ?? null);
      setSubmitted(true);
      setNote('');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const actions = (
    <>
      <Button onClick={onClose} variant="outlined" color="secondary">
        Schließen
      </Button>
      {!request && !hasSupporterRole && (
        <Button onClick={handleSubmit} variant="contained" disabled={submitting || loading}>
          {submitting ? 'Wird gesendet...' : 'Als Supporter bewerben'}
        </Button>
      )}
    </>
  );

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title="Supporter-Rechte anfragen"
      maxWidth="sm"
      actions={actions}
    >
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gap: 2 }}>
          {hasSupporterRole ? (
            <Alert severity="warning">
              Du hast bereits Supporter-Rechte, bist aber kein Mitglied dieses Teams. Events und Videos können nur von Mitgliedern des zugehörigen Teams verwaltet werden.
            </Alert>
          ) : (
            <Alert severity="info">
              Wenn du Supporter bist, kannst du auf der Spielseite Events und Videos verwalten. Die Freigabe erfolgt durch einen Administrator.
            </Alert>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          {!hasSupporterRole && request && (
            <Alert severity="warning">
              Du hast bereits eine offene Supporter-Anfrage vom {request.createdAt}. Sobald sie bearbeitet wurde, erhältst du eine Benachrichtigung.
            </Alert>
          )}

          {!hasSupporterRole && !request && submitted && (
            <Alert severity="success">
              Deine Supporter-Anfrage wurde eingereicht. Du erhältst eine Benachrichtigung, sobald sie genehmigt oder abgelehnt wurde.
            </Alert>
          )}

          {!hasSupporterRole && !request && (
            <>
              <Typography variant="body2" color="text.secondary">
                Optional kannst du kurz ergänzen, warum du Supporter-Rechte benötigst.
              </Typography>
              <TextField
                label="Anmerkung"
                multiline
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Zum Beispiel: Ich unterstütze regelmäßig bei Spielorganisation und Videoerfassung."
                fullWidth
              />
            </>
          )}
        </Box>
      )}
    </BaseModal>
  );
};

export default SupporterApplicationModal;