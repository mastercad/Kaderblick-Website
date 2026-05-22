import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Switch from '@mui/material/Switch';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { alpha, useTheme as useMuiTheme } from '@mui/material/styles';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import AddIcon from '@mui/icons-material/Add';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import EditIcon from '@mui/icons-material/Edit';
import { apiJson } from '../utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarTokenStatus {
  hasToken: boolean;
  createdAt: string | null;
  feeds: {
    personal: string;
    club: string;
    platform: string;
  } | null;
}

interface ExternalCalendar {
  id: number;
  name: string;
  color: string;
  url: string;
  isEnabled: boolean;
  lastFetchedAt: string | null;
  createdAt: string;
}

// ─── Helper sub-components ────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  const muiTheme = useMuiTheme();
  return (
    <Box sx={{
      border: '1px solid', borderColor: 'divider', borderRadius: 2,
      mb: 2, overflow: 'hidden',
    }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        px: 2, py: 1.25,
        bgcolor: alpha(muiTheme.palette.primary.main, 0.06),
        borderBottom: '1px solid', borderColor: 'divider',
      }}>
        {icon && <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>}
        <Typography variant="subtitle2" sx={{
          fontWeight: 700
        }}>{title}</Typography>
      </Box>
      <Box sx={{ px: 2, py: 2 }}>{children}</Box>
    </Box>
  );
}

function FeedUrlRow({ label, url, color }: { label: string; url: string; color?: string }) {
  const [copied, setCopied] = React.useState(false);
  const [webcalCopied, setWebcalCopied] = React.useState(false);

  const handleCopy = async (text: string, setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    await navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const webcalUrl = url.replace(/^https?:\/\//, 'webcal://');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {color && <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />}
        <Typography variant="body2" sx={{
          fontWeight: 600
        }}>{label}</Typography>
      </Box>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.5,
        bgcolor: 'action.hover', borderRadius: 1, px: 1.5, py: 0.75,
      }}>
        <Typography variant="caption" sx={{ flex: 1, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {url}
        </Typography>
        <Tooltip title={copied ? 'Kopiert!' : 'HTTPS-URL kopieren'}>
          <IconButton size="small" onClick={() => handleCopy(url, setCopied)} color={copied ? 'success' : 'default'}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={webcalCopied ? 'Kopiert!' : 'Webcal-URL kopieren (für Apple Calendar / Outlook)'}>
          <IconButton size="small" onClick={() => handleCopy(webcalUrl, setWebcalCopied)} color={webcalCopied ? 'success' : 'default'}>
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Typography
        variant="caption"
        sx={{
          color: "text.secondary",
          pl: 0.5
        }}>
        Webcal: <code style={{ fontSize: '0.7rem' }}>{webcalUrl}</code>
      </Typography>
    </Box>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const CalendarIntegrationsTab: React.FC = () => {
  // ── Token state ──
  const [tokenStatus, setTokenStatus] = React.useState<CalendarTokenStatus | null>(null);
  const [tokenLoading, setTokenLoading] = React.useState(false);
  const [tokenMessage, setTokenMessage] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // ── External calendars state ──
  const [externalCalendars, setExternalCalendars] = React.useState<ExternalCalendar[]>([]);
  const [extLoading, setExtLoading] = React.useState(false);
  const [extMessage, setExtMessage] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // ── Add/Edit dialog ──
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingCal, setEditingCal] = React.useState<ExternalCalendar | null>(null);
  const [formName, setFormName] = React.useState('');
  const [formUrl, setFormUrl] = React.useState('');
  const [formColor, setFormColor] = React.useState('#2196f3');
  const [formSaving, setFormSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadTokenStatus();
    loadExternalCalendars();
  }, []);

  // ── Token ──

  const loadTokenStatus = async () => {
    try {
      const data = await apiJson('/api/profile/calendar/token');
      setTokenStatus(data);
    } catch {
      setTokenStatus(null);
    }
  };

  const handleGenerateToken = async () => {
    setTokenLoading(true);
    setTokenMessage(null);
    try {
      const data = await apiJson('/api/profile/calendar/token', { method: 'POST' });
      setTokenStatus({ hasToken: true, createdAt: data.createdAt, feeds: data.feeds });
      setTokenMessage({ text: 'Feed-Links wurden generiert.', type: 'success' });
    } catch {
      setTokenMessage({ text: 'Fehler beim Generieren des Tokens.', type: 'error' });
    } finally {
      setTokenLoading(false);
    }
  };

  const handleRevokeToken = async () => {
    setTokenLoading(true);
    setTokenMessage(null);
    try {
      await apiJson('/api/profile/calendar/token', { method: 'DELETE' });
      setTokenStatus({ hasToken: false, createdAt: null, feeds: null });
      setTokenMessage({ text: 'Feed-Links wurden widerrufen.', type: 'success' });
    } catch {
      setTokenMessage({ text: 'Fehler beim Widerrufen.', type: 'error' });
    } finally {
      setTokenLoading(false);
    }
  };

  // ── External calendars ──

  const loadExternalCalendars = async () => {
    setExtLoading(true);
    try {
      const data = await apiJson('/api/profile/calendar/external');
      setExternalCalendars(Array.isArray(data) ? data : []);
    } catch {
      setExternalCalendars([]);
    } finally {
      setExtLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditingCal(null);
    setFormName('');
    setFormUrl('');
    setFormColor('#2196f3');
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (cal: ExternalCalendar) => {
    setEditingCal(cal);
    setFormName(cal.name);
    setFormUrl(cal.url);
    setFormColor(cal.color);
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSaveCalendar = async () => {
    setFormError(null);
    if (!formName.trim()) { setFormError('Name ist erforderlich'); return; }
    if (!formUrl.trim()) { setFormError('URL ist erforderlich'); return; }

    setFormSaving(true);
    try {
      if (editingCal) {
        const updated = await apiJson(`/api/profile/calendar/external/${editingCal.id}`, {
          method: 'PUT',
          body: { name: formName, url: formUrl, color: formColor },
        });
        setExternalCalendars(prev => prev.map(c => c.id === editingCal.id ? updated : c));
      } else {
        const created = await apiJson('/api/profile/calendar/external', {
          method: 'POST',
          body: { name: formName, url: formUrl, color: formColor },
        });
        setExternalCalendars(prev => [created, ...prev]);
      }
      setDialogOpen(false);
      setExtMessage({ text: editingCal ? 'Kalender aktualisiert.' : 'Kalender hinzugefügt und wird geladen…', type: 'success' });
      setTimeout(() => setExtMessage(null), 3000);
    } catch (e: any) {
      setFormError(e?.message || 'Fehler beim Speichern');
    } finally {
      setFormSaving(false);
    }
  };

  const handleToggleEnabled = async (cal: ExternalCalendar, enabled: boolean) => {
    try {
      const updated = await apiJson(`/api/profile/calendar/external/${cal.id}`, {
        method: 'PUT',
        body: { isEnabled: enabled },
      });
      setExternalCalendars(prev => prev.map(c => c.id === cal.id ? updated : c));
    } catch {
      setExtMessage({ text: 'Fehler beim Aktualisieren.', type: 'error' });
    }
  };

  const handleDeleteCalendar = async (cal: ExternalCalendar) => {
    try {
      await apiJson(`/api/profile/calendar/external/${cal.id}`, { method: 'DELETE' });
      setExternalCalendars(prev => prev.filter(c => c.id !== cal.id));
      setExtMessage({ text: 'Kalender entfernt.', type: 'success' });
      setTimeout(() => setExtMessage(null), 2500);
    } catch {
      setExtMessage({ text: 'Fehler beim Löschen.', type: 'error' });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ py: 1 }}>
      {/* ── Export: Eigene Kalender in andere Apps einbinden ─────────────── */}
      <SectionCard title="Kalender exportieren" icon={<CalendarMonthIcon fontSize="small" />}>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            mb: 2
          }}>
          Binde deine Kalender in Google Calendar, Apple Calendar, Outlook und
          jede andere App ein, die iCal/Webcal-Abonnements unterstützt.
          Die Links funktionieren dauerhaft und werden automatisch aktualisiert.
        </Typography>

        {tokenMessage && (
          <Alert severity={tokenMessage.type} sx={{ mb: 2, py: 0.5 }}
            onClose={() => setTokenMessage(null)}>
            {tokenMessage.text}
          </Alert>
        )}

        {tokenStatus?.hasToken && tokenStatus.feeds ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <CheckCircleOutlineIcon fontSize="small" color="success" />
              <Typography variant="body2">
                Feed-Links aktiv
                {tokenStatus.createdAt && (
                  <Typography component="span" variant="body2" sx={{
                    color: "text.secondary"
                  }}>
                    {' '}· generiert am{' '}
                    {new Date(tokenStatus.createdAt).toLocaleDateString('de-DE')}
                  </Typography>
                )}
              </Typography>
            </Box>

            <Stack divider={<Divider />}>
              <FeedUrlRow
                label="Mein Kalender (persönlich)"
                url={tokenStatus.feeds.personal}
                color="#1976d2"
              />
              <FeedUrlRow
                label="Vereinskalender"
                url={tokenStatus.feeds.club}
                color="#2e7d32"
              />
              <FeedUrlRow
                label="Plattformkalender (öffentlich)"
                url={tokenStatus.feeds.platform}
                color="#ed6c02"
              />
            </Stack>

            <Alert severity="info" sx={{ mt: 2, fontSize: '0.78rem' }}>
              <strong>Hinweis:</strong> Die URLs enthalten dein persönliches Token.
              Teile sie nicht öffentlich. Wenn du den Zugang widerrufen möchtest,
              klicke auf „Links widerrufen" – bestehende Abonnements werden dann
              sofort ungültig.
            </Alert>

            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={tokenLoading ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon />}
                onClick={handleGenerateToken}
                disabled={tokenLoading}
              >
                Links neu generieren
              </Button>
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<DeleteOutlineIcon />}
                onClick={handleRevokeToken}
                disabled={tokenLoading}
              >
                Links widerrufen
              </Button>
            </Box>
          </>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Chip
              label="Noch keine Feed-Links generiert"
              variant="outlined"
              icon={<VpnKeyIcon />}
              size="small"
            />
            <Button
              variant="contained"
              startIcon={tokenLoading ? <CircularProgress size={16} color="inherit" /> : <VpnKeyIcon />}
              onClick={handleGenerateToken}
              disabled={tokenLoading}
              sx={{ alignSelf: 'flex-start' }}
            >
              Feed-Links generieren
            </Button>
          </Box>
        )}
      </SectionCard>
      {/* ── Import: Externe Kalender einbinden ───────────────────────────── */}
      <SectionCard title="Externe Kalender einbinden" icon={<AddIcon fontSize="small" />}>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            mb: 2
          }}>
          Füge iCal-Feeds aus Google Calendar, Apple Calendar oder anderen
          Quellen hinzu – sie werden im Kalender farblich hervorgehoben angezeigt.
        </Typography>

        {extMessage && (
          <Alert severity={extMessage.type} sx={{ mb: 2, py: 0.5 }}
            onClose={() => setExtMessage(null)}>
            {extMessage.text}
          </Alert>
        )}

        {extLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2.5 }}>
            <CircularProgress size={24} />
          </Box>
        ) : externalCalendars.length > 0 ? (
          <Stack spacing={1} sx={{ mb: 2 }}>
            {externalCalendars.map(cal => (
              <Box
                key={cal.id}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  border: '1px solid', borderColor: 'divider', borderRadius: 2,
                  px: 1.5, py: 1,
                  opacity: cal.isEnabled ? 1 : 0.5, transition: 'opacity 0.2s',
                }}
              >
                <Box sx={{
                  width: 14, height: 14, borderRadius: '50%',
                  bgcolor: cal.color, flexShrink: 0,
                }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{
                    fontWeight: 600
                  }}>{cal.name}</Typography>
                  <Typography
                    variant="caption"
                    noWrap
                    sx={{
                      color: "text.secondary",
                      display: 'block',
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                    {cal.url}
                  </Typography>
                  {cal.lastFetchedAt && (
                    <Typography variant="caption" sx={{
                      color: "text.secondary"
                    }}>
                      Zuletzt geladen: {new Date(cal.lastFetchedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  )}
                </Box>
                <Switch
                  checked={cal.isEnabled}
                  size="small"
                  color="primary"
                  onChange={(_, v) => handleToggleEnabled(cal, v)}
                />
                <Tooltip title="Bearbeiten">
                  <IconButton size="small" onClick={() => openEditDialog(cal)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Entfernen">
                  <IconButton size="small" color="error" onClick={() => handleDeleteCalendar(cal)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Stack>
        ) : (
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              mb: 1.5
            }}>
            Noch keine externen Kalender konfiguriert.
          </Typography>
        )}

        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          size="small"
          onClick={openAddDialog}
        >
          Kalender hinzufügen
        </Button>
      </SectionCard>
      {/* ── Add/Edit Dialog ───────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCal ? 'Kalender bearbeiten' : 'Externen Kalender hinzufügen'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField
              label="Name des Kalenders"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              size="small"
              fullWidth
              placeholder="z. B. Mein Google Calendar"
            />
            <TextField
              label="iCal-URL (https:// oder webcal://)"
              value={formUrl}
              onChange={e => setFormUrl(e.target.value)}
              size="small"
              fullWidth
              placeholder="https://calendar.google.com/calendar/ical/..."
              helperText="Die URL findest du in den Kalendereinstellungen deines Kalender-Anbieters."
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="body2">Farbe:</Typography>
              <input
                type="color"
                value={formColor}
                onChange={e => setFormColor(e.target.value)}
                style={{ width: 40, height: 32, border: 'none', cursor: 'pointer', borderRadius: 4 }}
              />
              <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: formColor }} />
            </Box>

            <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
              <strong>Wo finde ich meine iCal-URL?</strong><br />
              • <strong>Google Calendar:</strong> Kalendereinstellungen → „Öffentliche URL im iCal-Format"<br />
              • <strong>Apple iCloud:</strong> iCloud.com → Kalender → Teilen-Symbol → „Öffentlichen Kalender kopieren"<br />
              • <strong>Outlook:</strong> calendar.live.com → Kalender freigeben → „ICS-Link"
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)} variant="outlined">Abbrechen</Button>
          <Button
            onClick={handleSaveCalendar}
            variant="contained"
            disabled={formSaving}
            startIcon={formSaving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {editingCal ? 'Speichern' : 'Hinzufügen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CalendarIntegrationsTab;
