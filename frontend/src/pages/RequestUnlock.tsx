import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  TextField,
  Button,
  Typography,
  Paper,
  Alert,
  Link as MuiLink,
} from '@mui/material';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { apiJson } from '../utils/api';

export default function RequestUnlock() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await apiJson('/api/security/request-unlock', {
        method: 'POST',
        body: { email },
      });
      setSuccess(true);
    } catch {
      setError('Ein Fehler ist aufgetreten. Bitte versuche es später erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
          <LockOpenIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="h5" component="h1" fontWeight={700} align="center">
            Konto entsperren
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
            Gib deine E-Mail-Adresse ein. Falls dein Konto gesperrt ist, senden wir dir einen Entsperr-Link.
          </Typography>
        </Box>

        {success ? (
          <Alert severity="success">
            Falls ein gesperrtes Konto mit dieser E-Mail-Adresse existiert, wurde ein Entsperr-Link gesendet.
            Bitte überprüfe dein Postfach.
          </Alert>
        ) : (
          <>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                label="E-Mail-Adresse"
                type="email"
                fullWidth
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                sx={{ mb: 3 }}
                disabled={isLoading}
                autoComplete="email"
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={isLoading}
                sx={{ py: 1.2, borderRadius: 2, fontWeight: 600, textTransform: 'none', fontSize: '1rem' }}
              >
                {isLoading ? 'Wird gesendet…' : 'Entsperr-Link anfordern'}
              </Button>
            </Box>
          </>
        )}

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <MuiLink
            component="button"
            type="button"
            variant="body2"
            onClick={() => navigate('/')}
            sx={{ cursor: 'pointer' }}
          >
            Zurück zur Startseite
          </MuiLink>
        </Box>
      </Paper>
    </Container>
  );
}
