import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Divider,
  Paper,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import SecurityIcon from '@mui/icons-material/Security';
import { apiJson } from '../../utils/api';

const REGISTRATION_CONTEXT_KEY = 'registration_context_enabled';
const TWO_FA_REQUIRED_KEY = '2fa_required';

interface Settings {
  [key: string]: { value: string; updatedAt: string };
}

export default function SystemSettings() {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    apiJson<{ settings: Settings }>('/api/superadmin/system-settings')
      .then((data) => {
        setSettings(data.settings ?? {});
        setLoading(false);
      })
      .catch(() => {
        setError('Einstellungen konnten nicht geladen werden.');
        setLoading(false);
      });
  }, []);

  const handleToggle = async (key: string, currentValue: string) => {
    const newValue = currentValue === 'true' ? 'false' : 'true';
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await apiJson(`/api/superadmin/system-settings/${key}`, {
        method: 'PATCH',
        body: { value: newValue },
      });

      setSettings((prev) => ({
        ...prev,
        [key]: { value: newValue, updatedAt: new Date().toISOString() },
      }));
      setSuccessMsg('Einstellung gespeichert.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError('Einstellung konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const getBool = (key: string): boolean => {
    const val = settings[key]?.value;
    return val === 'true' || val === '1';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={8}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box maxWidth={700} mx="auto" mt={4} px={2}>
      <Box display="flex" alignItems="center" gap={1.5} mb={3}>
        <SettingsIcon color="action" fontSize="large" />
        <Typography variant="h5" fontWeight={600}>
          System-Einstellungen
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}

      <Paper variant="outlined">
        <CardContent>
          <Typography variant="overline" color="text.secondary">
            Registrierung
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={getBool(REGISTRATION_CONTEXT_KEY)}
                  disabled={saving}
                  onChange={() =>
                    handleToggle(
                      REGISTRATION_CONTEXT_KEY,
                      settings[REGISTRATION_CONTEXT_KEY]?.value ?? 'true'
                    )
                  }
                />
              }
              label={
                <Box>
                  <Typography fontWeight={500}>
                    Verknüpfungsanfrage-Dialog aktiv
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Wenn aktiv, sehen neue Benutzer nach dem ersten Login einen Dialog, in dem sie
                    sich einem Spieler oder Trainer zuordnen. Wenn deaktiviert, erhalten Admins
                    nur eine Benachrichtigung und verknüpfen Benutzer manuell.
                  </Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start', mt: 1 }}
            />

            {settings[REGISTRATION_CONTEXT_KEY]?.updatedAt && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', ml: '52px' }}>
                Zuletzt geändert:{' '}
                {new Date(settings[REGISTRATION_CONTEXT_KEY].updatedAt).toLocaleString('de-DE')}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Paper>

      {/* ── 2FA Enforcement ─────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ mt: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <SecurityIcon color="action" fontSize="small" />
            <Typography variant="overline" color="text.secondary">
              Sicherheit
            </Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />

          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={getBool(TWO_FA_REQUIRED_KEY)}
                  disabled={saving}
                  onChange={() =>
                    handleToggle(
                      TWO_FA_REQUIRED_KEY,
                      settings[TWO_FA_REQUIRED_KEY]?.value ?? 'false'
                    )
                  }
                />
              }
              label={
                <Box>
                  <Typography fontWeight={500}>
                    Zwei-Faktor-Authentifizierung verpflichtend
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Wenn aktiv, werden alle Benutzer die noch keine 2FA aktiviert haben mit einem
                    Hinweis-Banner darauf aufmerksam gemacht. Benutzer mit aktivierter 2FA sind
                    davon nicht betroffen. Dies deaktiviert keinen bestehenden Zugang – es ist
                    eine Erinnerung mit Verlinkung zu den Einstellungen.
                  </Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start', mt: 1 }}
            />

            {settings[TWO_FA_REQUIRED_KEY]?.updatedAt && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', ml: '52px' }}>
                Zuletzt geändert:{' '}
                {new Date(settings[TWO_FA_REQUIRED_KEY].updatedAt).toLocaleString('de-DE')}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Paper>
    </Box>
  );
}
