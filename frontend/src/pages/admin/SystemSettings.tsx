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
  RadioGroup,
  Radio,
  Slider,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import SecurityIcon from '@mui/icons-material/Security';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import { apiJson } from '../../utils/api';

const REGISTRATION_CONTEXT_KEY = 'registration_context_enabled';
const TWO_FA_REQUIRED_KEY = '2fa_required';
const PUSH_NOTIFICATIONS_MODE_KEY = 'push_notifications_mode';
const MATCHDAY_LOOKAHEAD_DAYS_KEY = 'matchday_lookahead_days';

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

  const getString = (key: string, defaultValue = ''): string =>
    settings[key]?.value ?? defaultValue;

  const getInt = (key: string, defaultValue: number): number => {
    const val = parseInt(settings[key]?.value ?? '', 10);
    return isNaN(val) ? defaultValue : val;
  };

  const handleSelect = async (key: string, value: string) => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await apiJson(`/api/superadmin/system-settings/${key}`, {
        method: 'PATCH',
        body: { value },
      });

      setSettings((prev) => ({
        ...prev,
        [key]: { value, updatedAt: new Date().toISOString() },
      }));
      setSuccessMsg('Einstellung gespeichert.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError('Einstellung konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          mt: 8
        }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        maxWidth: 700,
        mx: "auto",
        mt: 4,
        px: 2
      }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          mb: 3
        }}>
        <SettingsIcon color="action" fontSize="large" />
        <Typography variant="h5" sx={{
          fontWeight: 600
        }}>
          System-Einstellungen
        </Typography>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}
      <Paper variant="outlined">
        <CardContent>
          <Typography variant="overline" sx={{
            color: "text.secondary"
          }}>
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
                  <Typography sx={{
                    fontWeight: 500
                  }}>
                    Verknüpfungsanfrage-Dialog aktiv
                  </Typography>
                  <Typography variant="body2" sx={{
                    color: "text.secondary"
                  }}>
                    Wenn aktiv, sehen neue Benutzer nach dem ersten Login einen Dialog, in dem sie
                    sich einem Spieler oder Trainer zuordnen. Wenn deaktiviert, erhalten Admins
                    nur eine Benachrichtigung und verknüpfen Benutzer manuell.
                  </Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start', mt: 1 }}
            />

            {settings[REGISTRATION_CONTEXT_KEY]?.updatedAt && (
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  mt: 0.5,
                  display: 'block',
                  ml: '52px'
                }}>
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
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: 1
            }}>
            <SecurityIcon color="action" fontSize="small" />
            <Typography variant="overline" sx={{
              color: "text.secondary"
            }}>
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
                  <Typography sx={{
                    fontWeight: 500
                  }}>
                    Zwei-Faktor-Authentifizierung verpflichtend
                  </Typography>
                  <Typography variant="body2" sx={{
                    color: "text.secondary"
                  }}>
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
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  mt: 0.5,
                  display: 'block',
                  ml: '52px'
                }}>
                Zuletzt geändert:{' '}
                {new Date(settings[TWO_FA_REQUIRED_KEY].updatedAt).toLocaleString('de-DE')}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Paper>
      {/* ── Push-Benachrichtigungen ──────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ mt: 3 }}>
        <CardContent>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: 1
            }}>
            <NotificationsIcon color="action" fontSize="small" />
            <Typography variant="overline" sx={{
              color: "text.secondary"
            }}>
              Push-Benachrichtigungen
            </Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />

          <Box>
            <Typography
              sx={{
                fontWeight: 500,
                mb: 0.5
              }}>
              Benachrichtigungs-Modus
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                mb: 1.5
              }}>
              Legt fest, welche Benutzer Push-Benachrichtigungen bei Änderungen an Events erhalten.
              Im Wartungsmodus werden nur SuperAdmins benachrichtigt.
            </Typography>

            <RadioGroup
              value={getString(PUSH_NOTIFICATIONS_MODE_KEY, 'all')}
              onChange={(e) => handleSelect(PUSH_NOTIFICATIONS_MODE_KEY, e.target.value)}
            >
              <FormControlLabel
                value="all"
                control={<Radio disabled={saving} />}
                label={
                  <Box>
                    <Typography sx={{
                      fontWeight: 500
                    }}>Alle Benutzer</Typography>
                    <Typography variant="body2" sx={{
                      color: "text.secondary"
                    }}>
                      Push-Benachrichtigungen an alle betroffenen Benutzer senden (Standard).
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start', mb: 1 }}
              />
              <FormControlLabel
                value="only_me"
                control={<Radio disabled={saving} />}
                label={
                  <Box>
                    <Typography sx={{
                      fontWeight: 500
                    }}>Nur an mich (Wartungsmodus)</Typography>
                    <Typography variant="body2" sx={{
                      color: "text.secondary"
                    }}>
                      Nur SuperAdmins erhalten Push-Benachrichtigungen – nützlich bei Wartungsarbeiten.
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start', mb: 1 }}
              />
              <FormControlLabel
                value="disabled"
                control={<Radio disabled={saving} />}
                label={
                  <Box>
                    <Typography sx={{
                      fontWeight: 500
                    }}>Deaktiviert</Typography>
                    <Typography variant="body2" sx={{
                      color: "text.secondary"
                    }}>
                      Keine Push-Benachrichtigungen werden gesendet.
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start' }}
              />
            </RadioGroup>

            {settings[PUSH_NOTIFICATIONS_MODE_KEY]?.updatedAt && (
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  mt: 1,
                  display: 'block'
                }}>
                Zuletzt geändert:{' '}
                {new Date(settings[PUSH_NOTIFICATIONS_MODE_KEY].updatedAt).toLocaleString('de-DE')}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Paper>
      {/* ── Mein Spieltag ───────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ mt: 3 }}>
        <CardContent>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: 1
            }}>
            <SportsSoccerIcon color="action" fontSize="small" />
            <Typography variant="overline" sx={{
              color: "text.secondary"
            }}>
              Mein Spieltag
            </Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />

          <Box>
            <Typography
              sx={{
                fontWeight: 500,
                mb: 0.5
              }}>
              Vorausschau-Zeitraum für anstehende Spiele
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                mb: 2
              }}>
              Legt fest, wie viele Tage im Voraus Spiele in "Mein Spieltag" als Tabs angezeigt werden.
              Bei einem Wert von 7 sieht ein Spieler alle Spiele der nächsten Woche.
            </Typography>

            <Box sx={{ px: 1 }}>
              <Slider
                value={getInt(MATCHDAY_LOOKAHEAD_DAYS_KEY, 7)}
                min={1}
                max={30}
                step={1}
                marks={[
                  { value: 1, label: '1 Tag' },
                  { value: 7, label: '7 Tage' },
                  { value: 14, label: '14 Tage' },
                  { value: 30, label: '30 Tage' },
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${v} ${v === 1 ? 'Tag' : 'Tage'}`}
                disabled={saving}
                onChangeCommitted={(_, value) =>
                  handleSelect(MATCHDAY_LOOKAHEAD_DAYS_KEY, String(value))
                }
                sx={{ maxWidth: 480 }}
              />
            </Box>

            {settings[MATCHDAY_LOOKAHEAD_DAYS_KEY]?.updatedAt && (
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  mt: 1,
                  display: 'block'
                }}>
                Zuletzt geändert:{' '}
                {new Date(settings[MATCHDAY_LOOKAHEAD_DAYS_KEY].updatedAt).toLocaleString('de-DE')}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Paper>
    </Box>
  );
}
