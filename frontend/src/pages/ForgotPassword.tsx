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
  Link as MuiLink
} from '@mui/material';
import { apiJson } from '../utils/api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setIsLoading(true);

    try {
      const result = await apiJson('/api/forgot-password', {
        method: 'POST',
        body: { email }
      });

      if (result && typeof result === 'object' && 'error' in result) {
        setError(result.error as string);
      } else {
        setSuccess(true);
        setEmail('');
      }
    } catch (err) {
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Passwort vergessen?
        </Typography>
        
        <Typography
          variant="body1"
          align="center"
          sx={{
            color: "text.secondary",
            mb: 3
          }}>
          Geben Sie Ihre E-Mail-Adresse ein und wir senden Ihnen einen Link zum Zurücksetzen Ihres Passworts.
        </Typography>

        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde ein Link zum Zurücksetzen des Passworts gesendet.
            Bitte überprüfen Sie Ihr E-Mail-Postfach.
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            label="E-Mail-Adresse"
            type="email"
            fullWidth
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{ mb: 3 }}
            disabled={isLoading || success}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={isLoading || success}
            sx={{ mb: 2 }}
          >
            {isLoading ? 'Wird gesendet...' : 'Link anfordern'}
          </Button>

          <Box sx={{ textAlign: 'center' }}>
            <MuiLink
              component="button"
              type="button"
              variant="body2"
              onClick={() => navigate('/login')}
              sx={{ cursor: 'pointer' }}
            >
              Zurück zum Login
            </MuiLink>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}
