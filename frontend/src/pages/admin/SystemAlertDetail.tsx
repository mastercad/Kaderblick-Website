import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, CircularProgress, Alert, Chip, Button, Stack, Divider,
  Paper, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Snackbar,
  Breadcrumbs, Link,
} from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import LockIcon from '@mui/icons-material/Lock';
import SecurityIcon from '@mui/icons-material/Security';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReplayIcon from '@mui/icons-material/Replay';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useNavigate, useParams } from 'react-router-dom';
import { apiJson } from '../../utils/api';

/* ─── Types ──────────────────────────────────────────── */

interface SystemAlertDetail {
  id: number;
  category: string;
  categoryLabel: string;
  categoryColor: string;
  message: string;
  requestUri: string | null;
  httpMethod: string | null;
  clientIp: string | null;
  exceptionClass: string | null;
  stackTrace: string | null;
  context: Record<string, unknown> | null;
  occurrenceCount: number;
  firstOccurrenceAt: string;
  lastOccurrenceAt: string;
  isResolved: boolean;
  resolvedAt: string | null;
  resolvedNote: string | null;
}

/* ─── Helper ──────────────────────────────────────────── */

function CategoryIcon({ category }: { category: string }) {
  switch (category) {
    case 'server_error':  return <BugReportIcon />;
    case 'login_failure': return <LockIcon />;
    case 'brute_force':   return <SecurityIcon />;
    default:              return <WarningAmberIcon />;
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'baseline' }}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 160, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>{value}</Typography>
    </Stack>
  );
}

/* ─── Main Page ───────────────────────────────────────── */

export default function SystemAlertDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [alert, setAlert]   = useState<SystemAlertDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [snack, setSnack]   = useState<string | null>(null);

  // Resolve dialog
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveNote, setResolveNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<SystemAlertDetail>(`/api/superadmin/system-alerts/${id}`);
      setAlert(res);
    } catch {
      setError('Alert nicht gefunden.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleResolve = async () => {
    if (!alert) return;
    try {
      const updated = await apiJson<SystemAlertDetail>(`/api/superadmin/system-alerts/${alert.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ note: resolveNote || null }),
      });
      setAlert(updated);
      setResolveOpen(false);
      setSnack('Als erledigt markiert.');
    } catch {
      setSnack('Fehler beim Aktualisieren.');
    }
  };

  const handleReopen = async () => {
    if (!alert) return;
    try {
      const updated = await apiJson<SystemAlertDetail>(`/api/superadmin/system-alerts/${alert.id}/reopen`, { method: 'POST' });
      setAlert(updated);
      setSnack('Alert wieder geöffnet.');
    } catch {
      setSnack('Fehler beim Aktualisieren.');
    }
  };

  if (loading) return <Box display="flex" justifyContent="center" mt={6}><CircularProgress /></Box>;
  if (error || !alert) return <Alert severity="error" sx={{ m: 2 }}>{error ?? 'Unbekannter Fehler.'}</Alert>;

  const borderColor = alert.category === 'server_error' ? 'error.main' :
    alert.category === 'brute_force' ? 'secondary.main' : 'warning.main';

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 900, mx: 'auto' }}>
      {/* Breadcrumb */}
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 2 }}>
        <Link
          component="button"
          variant="body2"
          onClick={() => navigate('/admin/system-alerts')}
          underline="hover"
          color="inherit"
        >
          System-Alerts
        </Link>
        <Typography variant="body2" color="text.primary">Alert #{alert.id}</Typography>
      </Breadcrumbs>

      {/* Title */}
      <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
        <CategoryIcon category={alert.category} />
        <Typography variant="h5" fontWeight={700}>{alert.categoryLabel}</Typography>
        {alert.isResolved && (
          <Chip label="Erledigt" color="success" size="small" icon={<CheckCircleIcon />} />
        )}
        {alert.occurrenceCount > 1 && (
          <Chip label={`${alert.occurrenceCount}× aufgetreten`} color="error" variant="outlined" size="small" />
        )}
      </Stack>

      {/* Alert message */}
      <Paper
        variant="outlined"
        sx={{ p: 2, mb: 2, borderLeft: '4px solid', borderLeftColor: borderColor, bgcolor: 'background.paper' }}
      >
        <Typography variant="body1" sx={{ fontWeight: 500, wordBreak: 'break-all' }}>{alert.message}</Typography>
      </Paper>

      {/* Metadata */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" fontWeight={700} mb={1}>Metadaten</Typography>
        <Stack spacing={0.75}>
          <MetaRow label="Erste Auslösung" value={fmtDate(alert.firstOccurrenceAt)} />
          <MetaRow label="Letzte Auslösung" value={fmtDate(alert.lastOccurrenceAt)} />
          {alert.clientIp      && <MetaRow label="IP-Adresse"      value={alert.clientIp} />}
          {alert.httpMethod    && alert.requestUri && (
            <MetaRow label="Request" value={`${alert.httpMethod} ${alert.requestUri}`} />
          )}
          {alert.exceptionClass && <MetaRow label="Exception-Typ" value={<code>{alert.exceptionClass}</code>} />}
          {alert.resolvedAt && (
            <>
              <Divider sx={{ my: 0.5 }} />
              <MetaRow label="Erledigt am" value={fmtDate(alert.resolvedAt)} />
              {alert.resolvedNote && <MetaRow label="Erledigungs-Notiz" value={alert.resolvedNote} />}
            </>
          )}
        </Stack>
      </Paper>

      {/* Context JSON */}
      {alert.context && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} mb={1}>Kontext</Typography>
          <Box
            component="pre"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              bgcolor: 'grey.50',
              p: 1.5,
              borderRadius: 1,
              maxHeight: 300,
              overflow: 'auto',
            }}
          >
            {JSON.stringify(alert.context, null, 2)}
          </Box>
        </Paper>
      )}

      {/* Stack trace */}
      {alert.stackTrace && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} mb={1}>Stack Trace</Typography>
          <Box
            component="pre"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.7rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              bgcolor: 'grey.900',
              color: 'grey.100',
              p: 1.5,
              borderRadius: 1,
              maxHeight: 400,
              overflow: 'auto',
            }}
          >
            {alert.stackTrace}
          </Box>
        </Paper>
      )}

      {/* Actions */}
      <Stack direction="row" spacing={1} mt={2}>
        <Button variant="outlined" onClick={() => navigate('/admin/system-alerts')}>
          Zurück
        </Button>
        {alert.isResolved ? (
          <Button variant="outlined" color="warning" startIcon={<ReplayIcon />} onClick={handleReopen}>
            Wieder öffnen
          </Button>
        ) : (
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
            onClick={() => { setResolveNote(''); setResolveOpen(true); }}
          >
            Als erledigt markieren
          </Button>
        )}
      </Stack>

      {/* Resolve dialog */}
      <Dialog open={resolveOpen} onClose={() => setResolveOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Alert als erledigt markieren</DialogTitle>
        <DialogContent>
          <TextField
            label="Notiz (optional)"
            value={resolveNote}
            onChange={e => setResolveNote(e.target.value)}
            fullWidth
            multiline
            rows={3}
            sx={{ mt: 1 }}
            placeholder="z.B. Root Cause, Maßnahmen, ..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolveOpen(false)}>Abbrechen</Button>
          <Button variant="contained" color="success" onClick={handleResolve} startIcon={<CheckCircleIcon />}>
            Bestätigen
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack !== null} autoHideDuration={3000} onClose={() => setSnack(null)} message={snack} />
    </Box>
  );
}
