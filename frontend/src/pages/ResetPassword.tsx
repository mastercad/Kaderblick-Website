import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Container, 
  TextField, 
  Button, 
  Typography, 
  Paper,
  Alert,
  InputAdornment,
  IconButton
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { apiJson } from '../utils/api';

export default function ResetPassword() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('Kein Token vorhanden');
        setIsValidating(false);
        return;
      }

      try {
        const result = await apiJson(`/api/validate-reset-token/${token}`);
        
        if (result && typeof result === 'object' && 'valid' in result && result.valid) {
          setTokenValid(true);
        } else {
          setError('Dieser Link ist ungültig oder abgelaufen.');
        }
      } catch (err) {
        setError('Fehler bei der Validierung des Tokens.');
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validierung
    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await apiJson('/api/reset-password', {
        method: 'POST',
        body: { 
          token,
          password 
        }
      });

      if (result && typeof result === 'object' && 'error' in result) {
        setError(result.error as string);
      } else {
        setSuccess(true);
        // Nach 3 Sekunden zum Login weiterleiten
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (err) {
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography align="center">Token wird überprüft...</Typography>
        </Paper>
      </Container>
    );
  }

  if (!tokenValid && !isValidating) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center" color="error">
            Ungültiger Link
          </Typography>
          
          <Alert severity="error" sx={{ mb: 3 }}>
            {error || 'Dieser Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen Link an.'}
          </Alert>

          <Button
            variant="contained"
            fullWidth
            onClick={() => navigate('/forgot-password')}
          >
            Neuen Link anfordern
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Neues Passwort setzen
        </Typography>
        
        <Typography
          variant="body1"
          align="center"
          sx={{
            color: "text.secondary",
            mb: 3
          }}>
          Bitte geben Sie Ihr neues Passwort ein.
        </Typography>

        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Ihr Passwort wurde erfolgreich zurückgesetzt! Sie werden in Kürze zum Login weitergeleitet...
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {!success && (
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="Neues Passwort"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{ mb: 2 }}
              disabled={isLoading}
              helperText="Mindestens 8 Zeichen"
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }
              }}
            />

            <TextField
              label="Passwort bestätigen"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              sx={{ mb: 3 }}
              disabled={isLoading}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={isLoading}
            >
              {isLoading ? 'Wird gespeichert...' : 'Passwort zurücksetzen'}
            </Button>
          </Box>
        )}
      </Paper>
    </Container>
  );
}
