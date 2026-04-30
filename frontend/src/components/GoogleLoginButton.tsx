import Button from '@mui/material/Button';
import { BACKEND_URL } from '../../config';
import { apiJson } from '../utils/api';
import { SvgIcon } from '@mui/material';
import { useAuth } from '../context/AuthContext';

// Mehrfarbiges Google-G-Logo (offizielles Branding)
const GoogleColorfulIcon = () => (
    <SvgIcon viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        <path fill="none" d="M0 0h48v48H0z"/>
    </SvgIcon>
);

export default function GoogleLoginButton() {
    const { checkAuthStatus } = useAuth();
    const handleGoogleLogin = () => {
        const googleAuthUrl = `${BACKEND_URL}/connect/google`;

        // Mobile browsers open window.open() as a new tab and can't close it via JS.
        // Use redirect flow instead: navigate current tab to OAuth, then backend redirects back.
        const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
            (navigator.maxTouchPoints > 1 && window.screen.width < 1024);

        if (isMobile) {
            window.location.href = googleAuthUrl;
            return;
        }

        const width = 500, height = 600;
        const left = (screen.width/2)-(width/2);
        const top = (screen.height/2)-(height/2);
        const popup = window.open(
            googleAuthUrl, 
            'GoogleLogin', 
            `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`
        );
        
        if (!popup) {
            console.error('Popup konnte nicht geöffnet werden');
            return;
        }

        // Message Listener für die Auth-Response
        const handleMessage = (event: MessageEvent) => {
            // Sicherheitscheck: Nur Messages vom Backend akzeptieren.
            // Das Backend (BACKEND_URL) hat eine andere Origin als das Frontend,
            // daher kann nicht window.location.origin verwendet werden.
            const backendOrigin = new URL(BACKEND_URL).origin;
            if (event.origin !== backendOrigin) {
                return;
            }

            // Prüfe ob es eine Google Auth Message ist
            if (event.data && typeof event.data === 'object' && event.data.source === 'google-auth') {
                // Cleanup
                window.removeEventListener('message', handleMessage);
                clearInterval(pollTimer);
                
                // Schließe Popup falls noch offen
                try {
                    if (popup && !popup.closed) {
                        popup.close();
                    }
                } catch (e) {
                }

                // Auth-State per React-State-Update aktualisieren (kein Hardreload).
                // AuthModal hat loginWithGoogle() bereits aufgerufen, aber checkAuthStatus
                // stellt sicher, dass der State auch ohne AuthModal korrekt ist.
                checkAuthStatus();
            }
        };

        window.addEventListener('message', handleMessage);
        
        // Fallback: Polling als Backup falls postMessage nicht funktioniert
        const pollTimer = setInterval(() => {
            try {
                if (popup.closed) {
                    clearInterval(pollTimer);
                    window.removeEventListener('message', handleMessage);
                    
                    // Popup manuell geschlossen: Auth-State per API aktualisieren
                    apiJson('/api/about-me')
                        .then(() => {
                            checkAuthStatus();
                        })
                        .catch(() => {
                        });
                }
            } catch (e) {
                // Popup-Zugriff fehlgeschlagen (kann in PWAs passieren)
            }
        }, 500);
        
        // Cleanup nach 5 Minuten (Timeout)
        setTimeout(() => {
            clearInterval(pollTimer);
            window.removeEventListener('message', handleMessage);
        }, 300000);
    };

    return (
        <Button
            variant="outlined"
            startIcon={<GoogleColorfulIcon />}
            onClick={handleGoogleLogin}
            fullWidth
            sx={{
                backgroundColor: '#fff',
                color: '#3c4043',
                borderColor: '#dadce0',
                textTransform: 'none',
                fontWeight: 500,
                fontSize: 16,
                boxShadow: 'none',
                mt: 1,
                transition: 'all 0.2s ease-in-out',
                '& .MuiSvgIcon-root': {
                    filter: 'grayscale(100%) brightness(0.7)',
                    transition: 'all 0.2s ease-in-out',
                },
                '&&:hover': {
                    backgroundColor: '#f8f9fa',
                    borderColor: '#dadce0',
                    boxShadow: '0 1px 3px 1px rgba(60,64,67,0.15)',
                },
                '&&:hover .MuiSvgIcon-root': {
                    filter: 'grayscale(0%) brightness(1)',
                },
            }}
        >
            Mit Google anmelden
        </Button>
    );
}
