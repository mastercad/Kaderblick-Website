import { useState, useEffect } from 'react';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import InputAdornment from '@mui/material/InputAdornment';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useAuth } from '../context/AuthContext';
import GoogleLoginButton from './GoogleLoginButton';
import { useNavigate } from 'react-router-dom';
import TwoFactorChallengeForm from './TwoFactorChallengeForm';
import { apiJson } from '../utils/api';

interface LoginFormProps {
  onSuccess?: () => void;
  onClose?: () => void;
}

export default function LoginForm({ onSuccess, onClose }: LoginFormProps) {
  const { checkAuthStatus, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [twoFactorMethod, setTwoFactorMethod] = useState<'totp' | 'email'>('totp');

  useEffect(() => {
    if (user && onSuccess) {
      onSuccess();
    }
  }, [user, onSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const result = await apiJson('/api/login', {
        method: 'POST',
        body: { email, password },
      }) as any;

      if (result?.twoFactorRequired && result?.pendingToken) {
        // Show 2FA challenge screen
        setPendingToken(result.pendingToken);
        setTwoFactorMethod(result.method ?? 'totp');
        return;
      }

      if (result?.error) {
        if (result.error === 'Invalid credentials') {
          setError('Ungültige Zugangsdaten');
        } else {
          setError('Login fehlgeschlagen');
        }
        return;
      }

      await checkAuthStatus();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      if (err && typeof err === 'object' && 'error' in err && err.error === 'Invalid credentials') {
        setError('Ungültige Zugangsdaten');
      } else if (err?.status === 429) {
        setError('Zu viele Fehlversuche. Bitte versuche es in 10 Minuten erneut.');
      } else if (err?.status === 403) {
        setError('locked');
      } else {
        setError('Login fehlgeschlagen');
      }
    }
  };

  // ── 2FA challenge screen ──────────────────────────────────────────────
  if (pendingToken) {
    return (
      <TwoFactorChallengeForm
        pendingToken={pendingToken}
        method={twoFactorMethod}
        onSuccess={onSuccess}
        onBackToLogin={() => { setPendingToken(null); setPassword(''); }}
      />
    );
  }

  return (
    <Box component="form"
      sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}
      onSubmit={handleSubmit}
    >
      <GoogleLoginButton />
      <Divider sx={{ my: 1 }}>
        <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.8rem', px: 1 }}>oder</Box>
      </Divider>
      <TextField
        label="E-Mail-Adresse"
        type="email"
        variant="outlined"
        size="small"
        fullWidth
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
        InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlinedIcon fontSize="small" color="action" /></InputAdornment> }}
      />
      <TextField
        label="Passwort"
        type="password"
        variant="outlined"
        size="small"
        fullWidth
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
        InputProps={{ startAdornment: <InputAdornment position="start"><LockOutlinedIcon fontSize="small" color="action" /></InputAdornment> }}
      />
      {error && (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {error === 'locked' ? (
            <>
              Dein Konto wurde gesperrt.{' '}
              <Link
                component="button"
                type="button"
                variant="body2"
                onClick={(e) => {
                  e.preventDefault();
                  if (onClose) onClose();
                  navigate('/request-unlock');
                }}
                sx={{ cursor: 'pointer', verticalAlign: 'baseline' }}
              >
                Konto entsperren anfordern
              </Link>
            </>
          ) : error}
        </Alert>
      )}
      <Box sx={{ textAlign: 'right', mt: -1 }}>
        <Link
          component="button"
          type="button"
          variant="body2"
          onClick={(e) => {
            e.preventDefault();
            if (onClose) onClose();
            navigate('/forgot-password');
          }}
          sx={{ cursor: 'pointer' }}
        >
          Passwort vergessen?
        </Link>
      </Box>
      <Button
        type="submit"
        variant="contained"
        fullWidth
        sx={{ py: 1.2, borderRadius: 2, fontWeight: 600, textTransform: 'none', fontSize: '1rem' }}
      >
        Einloggen
      </Button>
    </Box>
  );
}
