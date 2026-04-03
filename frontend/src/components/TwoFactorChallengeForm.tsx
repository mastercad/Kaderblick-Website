import { useState, useRef, useEffect } from 'react';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import InputAdornment from '@mui/material/InputAdornment';
import SecurityIcon from '@mui/icons-material/Security';
import LockIcon from '@mui/icons-material/Lock';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import CircularProgress from '@mui/material/CircularProgress';
import { apiJson } from '../utils/api';
import { useAuth } from '../context/AuthContext';

interface TwoFactorChallengeFormProps {
  pendingToken: string;
  method?: 'totp' | 'email';
  onSuccess?: () => void;
  onBackToLogin?: () => void;
}

export default function TwoFactorChallengeForm({
  pendingToken,
  method = 'totp',
  onSuccess,
  onBackToLogin,
}: TwoFactorChallengeFormProps) {
  const { checkAuthStatus } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [useBackup, setUseBackup] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEmail = method === 'email' && !useBackup;

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [useBackup]);

  // For email method: auto-send the OTP on mount
  useEffect(() => {
    if (method === 'email' && !useBackup) {
      handleSendEmailCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, useBackup]);

  const handleSendEmailCode = async () => {
    setEmailSending(true);
    setError('');
    try {
      await apiJson('/api/2fa/email/send-login-code', {
        method: 'POST',
        body: { pendingToken },
      });
      setEmailSent(true);
    } catch {
      setError('Code konnte nicht gesendet werden. Bitte versuche es erneut.');
    } finally {
      setEmailSending(false);
    }
  };

  const handleResend = () => {
    setEmailSent(false);
    setCode('');
    setError('');
    handleSendEmailCode();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiJson('/api/2fa/verify', {
        method: 'POST',
        body: { pendingToken, code: code.trim() },
      });
      await checkAuthStatus();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.error || 'Ungültiger Code. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const descriptionText = () => {
    if (useBackup) return 'Gib einen deiner Backup-Codes ein, um dich einzuloggen.';
    if (isEmail) return emailSending
      ? 'Code wird gesendet...'
      : emailSent
        ? 'Ein 6-stelliger Code wurde an deine E-Mail-Adresse gesendet.'
        : 'Code wird vorbereitet...';
    return 'Öffne deine Authenticator-App und gib den 6-stelligen Code ein.';
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      {/* Icon + Headline */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box
          sx={{
            width: 56, height: 56, borderRadius: '50%',
            bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {isEmail ? <EmailOutlinedIcon sx={{ color: 'white', fontSize: 30 }} /> : <SecurityIcon sx={{ color: 'white', fontSize: 30 }} />}
        </Box>
        <Typography variant="h6" fontWeight={700} textAlign="center">
          Zwei-Faktor-Bestätigung
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {descriptionText()}
        </Typography>
      </Box>

      {isEmail && emailSending && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {(!isEmail || emailSent) && (
        <TextField
          inputRef={inputRef}
          label={useBackup ? 'Backup-Code (z. B. A1B2-C3D4)' : '6-stelliger Code'}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          size="small"
          fullWidth
          required
          autoComplete="one-time-code"
          inputProps={{
            maxLength: useBackup ? 9 : 6,
            inputMode: useBackup ? 'text' : 'numeric',
            pattern: useBackup ? undefined : '[0-9]*',
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
          helperText={useBackup
            ? 'Format: XXXX-XXXX — jeder Code kann nur einmal verwendet werden.'
            : isEmail ? 'Der Code ist 10 Minuten gültig.' : 'Der Code wechselt alle 30 Sekunden.'}
        />
      )}

      {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

      {(!isEmail || emailSent) && (
        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={loading || code.trim().length === 0}
          sx={{ py: 1.2, borderRadius: 2, fontWeight: 600, textTransform: 'none', fontSize: '1rem' }}
        >
          {loading
            ? <><CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />Prüfe...</>
            : 'Bestätigen & Einloggen'}
        </Button>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5 }}>
        {isEmail ? (
          <Link component="button" type="button" variant="body2"
            onClick={handleResend} disabled={emailSending} sx={{ cursor: 'pointer' }}>
            Code erneut senden
          </Link>
        ) : (
          <Link component="button" type="button" variant="body2"
            onClick={() => { setUseBackup(v => !v); setCode(''); setError(''); }} sx={{ cursor: 'pointer' }}>
            {useBackup ? (method === 'email' ? 'E-Mail-Code verwenden' : 'Authenticator-App verwenden') : 'Backup-Code verwenden'}
          </Link>
        )}
        <Link component="button" type="button" variant="body2" color="text.secondary"
          onClick={onBackToLogin} sx={{ cursor: 'pointer' }}>
          Zurück zum Login
        </Link>
      </Box>
    </Box>
  );
}

