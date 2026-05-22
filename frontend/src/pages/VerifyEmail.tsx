import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { apiJson } from '../utils/api';

export default function VerifyEmail() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Kein Verifizierungstoken gefunden.');
        return;
      }

      try {
        const response = await apiJson(`/api/verify-email/${token}`, {
          method: 'GET'
        });

        if (response && 'error' in response) {
          setStatus('error');
          setMessage(response.error);
        } else if (response && 'message' in response) {
          setStatus('success');
          setMessage(response.message);
          // Registration context dialog is triggered server-side via needsRegistrationContext flag on /api/about-me
        } else {
          setStatus('error');
          setMessage('Ein unerwarteter Fehler ist aufgetreten.');
        }
      } catch (err) {
        setStatus('error');
        setMessage('Die E-Mail-Verifizierung ist fehlgeschlagen. Bitte versuche es später erneut.');
      }
    };

    verifyEmail();
  }, [token]);

  const handleGoToLogin = () => {
    navigate('/');
    // Trigger AuthModal opening
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-auth-modal'));
    }, 100);
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center' }}>
          {status === 'loading' && (
            <>
              <CircularProgress size={60} sx={{ mb: 3 }} />
              <Typography variant="h5" gutterBottom>
                E-Mail wird verifiziert...
              </Typography>
              <Typography variant="body1" sx={{
                color: "text.secondary"
              }}>
                Bitte warten Sie einen Moment.
              </Typography>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircleIcon 
                sx={{ fontSize: 80, color: 'success.main', mb: 2 }} 
              />
              <Typography variant="h5" gutterBottom sx={{
                color: "success.main"
              }}>
                Erfolgreich verifiziert!
              </Typography>
              <Alert severity="success" sx={{ mt: 2, mb: 2, textAlign: 'left' }}>
                {message}
              </Alert>
              <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
                <strong>Tipp:</strong> Nach dem Login kannst du direkt angeben, ob du Spieler oder Trainer im Verein bist.
              </Alert>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleGoToLogin}
                size="large"
              >
                Zum Login
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <ErrorIcon 
                sx={{ fontSize: 80, color: 'error.main', mb: 2 }} 
              />
              <Typography variant="h5" gutterBottom sx={{
                color: "error.main"
              }}>
                Verifizierung fehlgeschlagen
              </Typography>
              <Alert severity="error" sx={{ mt: 2, mb: 3, textAlign: 'left' }}>
                {message}
              </Alert>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button 
                  variant="outlined" 
                  color="primary" 
                  onClick={() => navigate('/')}
                >
                  Zur Startseite
                </Button>
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={handleGoToLogin}
                >
                  Zum Login
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Paper>
    </Container>
  );
}
