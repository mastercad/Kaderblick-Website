import { useState } from 'react';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import { apiJson, ApiError } from '../utils/api';

interface RegisterFormProps {
  onSwitchToLogin?: () => void;
}

export default function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== passwordConfirm) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiJson('/api/register', {
        method: 'POST',
        body: { fullName, email, password }
      });

      if (response && 'error' in response) {
        setError(response.error);
      } else {
        setSuccess(true);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Registrierung fehlgeschlagen. Bitte versuche es später erneut.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textAlign: 'center' }}>
        <MarkEmailReadOutlinedIcon sx={{ fontSize: 64, color: 'success.main' }} />
        <Typography variant="h6" sx={{
          fontWeight: 600
        }}>
          Fast geschafft!
        </Typography>
        <Typography sx={{
          color: "text.secondary"
        }}>
          Wir haben dir eine Bestätigungs-E-Mail an <strong>{email}</strong> gesendet.
          Bitte klicke auf den Link in der E-Mail, um deinen Account zu aktivieren.
        </Typography>
        {onSwitchToLogin && (
          <Button variant="outlined" size="small" onClick={onSwitchToLogin} sx={{ mt: 1 }}>
            Zum Login
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Box component="form"
      sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}
      onSubmit={handleSubmit}
    >
      {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
      <TextField
        label="Vollständiger Name"
        variant="outlined"
        size="small"
        fullWidth
        value={fullName}
        onChange={e => setFullName(e.target.value)}
        required
        autoComplete="name"
        slotProps={{
          input: { startAdornment: <InputAdornment position="start"><PersonOutlineIcon fontSize="small" color="action" /></InputAdornment> }
        }}
      />
      <TextField
        label="E-Mail-Adresse"
        type="email"
        variant="outlined"
        size="small"
        fullWidth
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        autoComplete="email"
        slotProps={{
          input: { startAdornment: <InputAdornment position="start"><EmailOutlinedIcon fontSize="small" color="action" /></InputAdornment> }
        }}
      />
      <TextField
        label="Passwort"
        type="password"
        variant="outlined"
        size="small"
        fullWidth
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
        autoComplete="new-password"
        helperText="Mindestens 8 Zeichen"
        slotProps={{
          input: { startAdornment: <InputAdornment position="start"><LockOutlinedIcon fontSize="small" color="action" /></InputAdornment> }
        }}
      />
      <TextField
        label="Passwort bestätigen"
        type="password"
        variant="outlined"
        size="small"
        fullWidth
        value={passwordConfirm}
        onChange={e => setPasswordConfirm(e.target.value)}
        required
        autoComplete="new-password"
        error={passwordConfirm.length > 0 && password !== passwordConfirm}
        helperText={passwordConfirm.length > 0 && password !== passwordConfirm ? 'Passwörter stimmen nicht überein' : ''}
        slotProps={{
          input: { startAdornment: <InputAdornment position="start"><CheckCircleOutlineIcon fontSize="small" color={passwordConfirm.length > 0 && password === passwordConfirm ? 'success' : 'action'} /></InputAdornment> }
        }}
      />
      <Button
        type="submit"
        variant="contained"
        fullWidth
        disabled={loading}
        sx={{ mt: 1, py: 1.2, borderRadius: 2, fontWeight: 600, textTransform: 'none', fontSize: '1rem' }}
      >
        {loading ? 'Wird registriert…' : 'Konto erstellen'}
      </Button>
    </Box>
  );
}
