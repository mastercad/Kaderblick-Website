import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { FaTrashAlt } from 'react-icons/fa';
import { SectionCard } from '../components/SectionCard';
import type { StatusMessage } from '../types';

interface ApiTokenTabProps {
  hasToken: boolean;
  createdAt: string | null | undefined;
  newToken: string | null;
  loading: boolean;
  message: StatusMessage | null;
  copied: boolean;
  onGenerate: () => void;
  onRevoke: () => void;
  onCopy: () => void;
  onDismissMessage: () => void;
}

export function ApiTokenTab({
  hasToken, createdAt, newToken, loading, message, copied,
  onGenerate, onRevoke, onCopy, onDismissMessage,
}: ApiTokenTabProps) {
  return (
    <SectionCard title="Persönlicher API-Token" icon={<VpnKeyIcon fontSize="small" />}>
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Mit einem persönlichen API-Token kannst du dich bei API-Anfragen und Automatisierungen authentifizieren.
          Verwende ihn als <code>Authorization: Bearer &lt;token&gt;</code>-Header.
        </Typography>

        {hasToken && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleOutlineIcon fontSize="small" color="success" />
            <Typography variant="body2">
              Token aktiv
              {createdAt && (
                <Typography component="span" variant="body2" color="text.secondary">
                  {' '}· erstellt am {new Date(createdAt).toLocaleDateString('de-DE', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </Typography>
              )}
            </Typography>
          </Box>
        )}

        {newToken && (
          <Alert severity="warning" icon={<WarningAmberIcon fontSize="inherit" />}
            sx={{ fontFamily: 'monospace', fontSize: '0.78rem', wordBreak: 'break-all', alignItems: 'flex-start' }}>
            <Typography variant="caption" fontWeight={700} display="block" mb={0.5}>
              Token nur einmal sichtbar – jetzt kopieren!
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <code style={{ flex: 1, wordBreak: 'break-all' }}>{newToken}</code>
              <Tooltip title={copied ? 'Kopiert!' : 'In Zwischenablage kopieren'}>
                <IconButton size="small" onClick={onCopy} color={copied ? 'success' : 'default'}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Alert>
        )}

        {message && (
          <Alert severity={message.type} onClose={onDismissMessage}>
            {message.text}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <VpnKeyIcon />}
            onClick={onGenerate}
            disabled={loading}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            {hasToken ? 'Token neu generieren' : 'Token generieren'}
          </Button>
          {hasToken && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<FaTrashAlt />}
              onClick={onRevoke}
              disabled={loading}
              sx={{ textTransform: 'none', borderRadius: 2 }}
            >
              Token widerrufen
            </Button>
          )}
        </Box>
      </Stack>
    </SectionCard>
  );
}
