import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  TextField,
  Typography,
} from '@mui/material';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { apiJson } from '../../utils/api';

export default function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [honeypotEmail, setHoneypotEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Honeypot: Bots füllen das versteckte "email"-Feld aus
    if (honeypotEmail) {
      setSuccess(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiJson('/api/contact', {
        method: 'POST',
        body: { name, reachEmail: email, message },
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Senden. Bitte versuch es erneut.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Box className="public-home-contact-success">
        <CheckCircleOutlineRoundedIcon className="public-home-contact-success-icon" />
        <Typography component="h3" className="public-home-contact-success-title">
          Nachricht gesendet!
        </Typography>
        <Typography className="public-home-contact-success-text">
          Ich melde mich zeitnah bei dir.
        </Typography>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit} className="public-home-contact-form">
      {/* Honeypot-Falle für Bots: visuell versteckt, aber kein type="hidden" */}
      <Box
        aria-hidden="true"
        sx={{
          position: 'absolute',
          left: '-9999px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          opacity: 0,
        }}
      >
        <input
          type="text"
          name="email"
          id="email"
          value={honeypotEmail}
          onChange={e => setHoneypotEmail(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </Box>
      <TextField
        label="Name"
        value={name}
        onChange={e => setName(e.target.value)}
        required
        fullWidth
        size="small"
      />
      <TextField
        label="E-Mail"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        fullWidth
        size="small"
        slotProps={{ htmlInput: { name: 'contact_address', autoComplete: 'email' } }}
      />
      <TextField
        label="Nachricht"
        value={message}
        onChange={e => setMessage(e.target.value)}
        required
        fullWidth
        multiline
        minRows={4}
        size="small"
      />
      {error && <Alert severity="error">{error}</Alert>}
      <Button
        type="submit"
        variant="contained"
        disabled={loading}
        endIcon={loading ? <CircularProgress size={18} color="inherit" /> : <ArrowForwardRoundedIcon />}
        className="public-home-primary-button"
      >
        {loading ? 'Wird gesendet…' : 'Nachricht senden'}
      </Button>
    </Box>
  );
}
