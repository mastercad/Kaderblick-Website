import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Container,
  CircularProgress,
  Typography,
  Paper,
  Alert,
  Button,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { apiJson } from '../utils/api';

export default function UnlockAccount() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Kein gültiger Entsperr-Link. Bitte fordere einen neuen an.');
      return;
    }

    apiJson(`/api/security/unlock-account?token=${encodeURIComponent(token)}`)
      .then((res: any) => {
        setMessage(res?.message ?? 'Dein Konto wurde erfolgreich entsperrt.');
        setStatus('success');
      })
      .catch((err: any) => {
        setMessage(
          err?.error ??
          'Ungültiger oder abgelaufener Link. Bitte fordere einen neuen Entsperr-Link an.',
        );
        setStatus('error');
      });
  }, [token]);

  return (
    <Container maxWidth="sm" sx={{ mt: 8, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
        {status === 'loading' && (
          <>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography>Konto wird entsperrt…</Typography>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircleOutlineIcon sx={{ fontSize: 56, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Konto entsperrt
            </Typography>
            <Alert severity="success" sx={{ mb: 3, textAlign: 'left' }}>{message}</Alert>
            <Button
              variant="contained"
              onClick={() => navigate('/')}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
            >
              Zum Login
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <ErrorOutlineIcon sx={{ fontSize: 56, color: 'error.main', mb: 2 }} />
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Fehler beim Entsperren
            </Typography>
            <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>{message}</Alert>
            <Button
              variant="outlined"
              onClick={() => navigate('/request-unlock')}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
            >
              Neuen Entsperr-Link anfordern
            </Button>
          </>
        )}
      </Paper>
    </Container>
  );
}
