import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import BaseModal from '../../BaseModal';

interface TwoFactorDisableDialogProps {
  open: boolean;
  code: string;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onCodeChange: (code: string) => void;
  onConfirm: () => void;
}

export function TwoFactorDisableDialog({ open, code, loading, error, onClose, onCodeChange, onConfirm }: TwoFactorDisableDialogProps) {
  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title="2FA deaktivieren"
      maxWidth="xs"
      actions={
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', width: '100%' }}>
          <Button onClick={onClose} variant="outlined">Abbrechen</Button>
          <Button
            onClick={onConfirm}
            variant="contained"
            color="error"
            disabled={loading || code.length !== 6}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {loading ? 'Deaktiviere...' : '2FA deaktivieren'}
          </Button>
        </Box>
      }
    >
      <Stack spacing={2} sx={{ p: { xs: 2, sm: 3 } }}>
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          Wenn du 2FA deaktivierst, ist dein Konto weniger gut geschützt. Bist du sicher?
        </Alert>
        <TextField
          label="Aktueller Authenticator-Code"
          value={code}
          onChange={e => onCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputProps={{ maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*' }}
          autoComplete="one-time-code"
          size="small"
          fullWidth
          helperText="Gib den 6-stelligen Code aus deiner Authenticator-App ein."
        />
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
    </BaseModal>
  );
}
