import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import BaseModal from '../../BaseModal';

interface BackupCodesDialogProps {
  open: boolean;
  code: string;
  loading: boolean;
  error: string | null;
  newCodes: string[];
  copied: boolean;
  onClose: () => void;
  onCodeChange: (code: string) => void;
  onRegenerate: () => void;
  onCopy: () => void;
}

export function BackupCodesDialog({
  open, code, loading, error, newCodes, copied,
  onClose, onCodeChange, onRegenerate, onCopy,
}: BackupCodesDialogProps) {
  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title="Backup-Codes"
      maxWidth="xs"
      actions={
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', width: '100%' }}>
          {newCodes.length > 0 ? (
            <>
              <Button onClick={onClose} variant="outlined">Schließen</Button>
              <Button
                onClick={onCopy}
                variant="contained"
                startIcon={<ContentCopyIcon />}
                color={copied ? 'success' : 'primary'}
              >
                {copied ? 'Kopiert!' : 'Alle Codes kopieren'}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={onClose} variant="outlined">Abbrechen</Button>
              <Button
                onClick={onRegenerate}
                variant="contained"
                color="warning"
                disabled={loading || code.length !== 6}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {loading ? 'Generiere...' : 'Neue Codes generieren'}
              </Button>
            </>
          )}
        </Box>
      }
    >
      <Stack spacing={2} sx={{ p: { xs: 2, sm: 3 } }}>
        {newCodes.length === 0 ? (
          <>
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              Alte Backup-Codes werden ungültig. Bitte bestätige mit deinem aktuellen TOTP-Code.
            </Alert>
            <TextField
              label="Aktueller TOTP-Code"
              value={code}
              onChange={e => onCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputProps={{ maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*' }}
              autoComplete="one-time-code"
              size="small"
              fullWidth
              helperText="Gib den 6-stelligen Code aus deiner Authenticator-App ein."
            />
            {error && <Alert severity="error">{error}</Alert>}
          </>
        ) : (
          <>
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              <Typography variant="body2" fontWeight={700}>Diese Codes jetzt sichern!</Typography>
              <Typography variant="caption">
                Sie werden nicht wieder angezeigt. Jeder Code ist einmalig verwendbar.
              </Typography>
            </Alert>
            <Box sx={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1,
              p: 2, bgcolor: 'action.hover', borderRadius: 2,
            }}>
              {newCodes.map((c, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {c}
                  </Typography>
                  <Tooltip title="Kopieren">
                    <IconButton size="small" onClick={() => navigator.clipboard.writeText(c)}>
                      <ContentCopyIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
            </Box>
          </>
        )}
      </Stack>
    </BaseModal>
  );
}
