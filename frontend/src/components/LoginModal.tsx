import { useState } from 'react';
import Modal from '@mui/material/Modal';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useAuth } from '../context/AuthContext';

const style = {
  position: 'absolute' as const,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
};

interface AuthData {
  success: boolean;
  isNewUser?: boolean;
  user?: any;
  error?: string;
  message?: string;
}

export default function LoginModal() {
  const { loginWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = () => {
    setIsLoading(true);
    
    // Google OAuth Popup öffnen
    const popup = window.open(
      '/api/oauth/google',
      'googleAuth',
      'width=500,height=600,scrollbars=yes,resizable=yes'
    );

    // Message Listener für Popup-Kommunikation
    const messageListener = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data.type === 'GOOGLE_AUTH_RESULT') {
        window.removeEventListener('message', messageListener);
        setIsLoading(false);
        
        if (popup) {
          popup.close();
        }

        try {
          const authData = event.data as AuthData;
          loginWithGoogle(authData);
        } catch (error) {
          console.error('Login failed:', error);
        }
      }
    };

    window.addEventListener('message', messageListener);

    // Fallback falls Popup geschlossen wird
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', messageListener);
        setIsLoading(false);
      }
    }, 1000);
  };

  return (
    <Modal open={true}>
      <Box sx={style}>
        <Typography id="modal-modal-title" variant="h6" component="h2">
          Anmeldung erforderlich
        </Typography>
        <Typography id="modal-modal-description" sx={{ mt: 2 }}>
          Bitte melden Sie sich an, um fortzufahren.
        </Typography>
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="contained"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            fullWidth
          >
            {isLoading ? 'Anmelden...' : 'Mit Google anmelden'}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}
