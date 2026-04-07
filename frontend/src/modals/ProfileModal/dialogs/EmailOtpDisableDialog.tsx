import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import BaseModal from '../../BaseModal';

interface EmailOtpDisableDialogProps {
  open: boolean;
  code: string;
  loading: boolean;
  error: string | null;
  codeSent: boolean;
  onClose: () => void;
  onCodeChange: (code: string) => void;
  onSendCode: () => void;
  onConfirm: () => void;
}

export function EmailOtpDisableDialog({
  open, code, loading, error, codeSent,
  onClose, onCodeChange, onSendCode, onConfirm,
}: EmailOtpDisableDialogProps) {
  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title="E-Mail-Code 2FA deaktivieren"
      maxWidth="xs"
      actions={
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', width: '100%' }}>
          <Button onClick={onClose} variant="outlined">Abbrechen</Button>
          {!codeSent ? (
            <Button onClick={onSendCode} variant="contained" startIcon={<EmailOutlinedIcon />}>
              Code senden
            </Button>
          ) : (
            <Button
              onClick={onConfirm}
              variant="contained"
              color="error"
              disabled={loading || code.length !== 6}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {loading ? 'Deaktiviere...' : '2FA deaktivieren'}
            </Button>
          )}
        </Box>
      }
    >
      <Stack spacing={2} sx={{ p: { xs: 2, sm: 3 } }}>
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          Wenn du 2FA deaktivierst, ist dein Konto weniger gut geschützt. Wir senden dir einen Bestätigungscode per E-Mail.
        </Alert>
        {codeSent && (
          <TextField
            label="Code aus deiner E-Mail"
            value={code}
            onChange={e => onCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputProps={{ maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*' }}
            autoComplete="one-time-code"
            size="small"
            fullWidth
            helperText="Gib den 6-stelligen Code aus deiner E-Mail ein."
          />
        )}
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
    </BaseModal>
  );
}
