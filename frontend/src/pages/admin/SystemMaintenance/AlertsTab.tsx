import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, CircularProgress, Alert, Chip, Card, CardActionArea,
  CardContent, Tabs, Tab, Badge, Stack, IconButton, Tooltip, Snackbar,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BugReportIcon from '@mui/icons-material/BugReport';
import LockIcon from '@mui/icons-material/Lock';
import SecurityIcon from '@mui/icons-material/Security';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import StorageIcon from '@mui/icons-material/Storage';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import ReplayIcon from '@mui/icons-material/Replay';
import BarChartIcon from '@mui/icons-material/BarChart';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../../../utils/api';

/* ─── Types ──────────────────────────────────────────── */

interface SystemAlertItem {
  id: number;
  category: string;
  categoryLabel: string;
  categoryIcon: string;
  categoryColor: string;
  fingerprint: string;
  message: string;
  requestUri: string | null;
  httpMethod: string | null;
  clientIp: string | null;
  exceptionClass: string | null;
  occurrenceCount: number;
  firstOccurrenceAt: string;
  lastOccurrenceAt: string;
  isResolved: boolean;
  resolvedAt: string | null;
  resolvedNote: string | null;
}

interface AlertsResponse {
  open: SystemAlertItem[];
  resolved: SystemAlertItem[];
  stats: { total: number; byCategory: Record<string, number> };
}

/* ─── Helpers ─────────────────────────────────────────── */

function CategoryIcon({ category }: { category: string }) {
  switch (category) {
    case 'server_error':       return <BugReportIcon fontSize="small" />;
    case 'login_failure':      return <LockIcon fontSize="small" />;
    case 'brute_force':        return <SecurityIcon fontSize="small" />;
    case 'suspicious_request': return <WarningAmberIcon fontSize="small" />;
    case 'queue_failure':      return <ErrorOutlineIcon fontSize="small" />;
    case 'disk_space':         return <StorageIcon fontSize="small" />;
    case 'cron_failure':       return <ScheduleIcon fontSize="small" />;
    default:                   return <WarningAmberIcon fontSize="small" />;
  }
}

function categoryChipColor(category: string): 'error' | 'warning' | 'secondary' | 'primary' | 'default' {
  switch (category) {
    case 'server_error':       return 'error';
    case 'login_failure':      return 'warning';
    case 'brute_force':        return 'secondary';
    case 'suspicious_request': return 'error';
    case 'queue_failure':      return 'primary';
    case 'disk_space':         return 'warning';
    case 'cron_failure':       return 'secondary';
    default:                   return 'default';
  }
}

function categoryLabel(cat: string): string {
  switch (cat) {
    case 'server_error':       return 'Server-Fehler';
    case 'login_failure':      return 'Login-Fehler';
    case 'suspicious_request': return 'Scan/Hack-Versuch';
    case 'queue_failure':      return 'Queue-Fehler';
    case 'disk_space':         return 'Festplatten-Warnung';
    case 'cron_failure':       return 'Cron-Ausfall';
    case 'brute_force':        return 'Brute Force';
    default:                   return cat;
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/* ─── Alert Card ──────────────────────────────────────── */

function AlertCard({ item, onResolve, onReopen }: {
  item: SystemAlertItem;
  onResolve: (id: number) => void;
  onReopen:  (id: number) => void;
}) {
  const navigate = useNavigate();

  return (
    <Card
      variant="outlined"
      sx={{
        borderLeft: '4px solid',
        borderLeftColor: item.isResolved ? 'success.main' : (
          item.category === 'server_error'        ? 'error.main' :
          item.category === 'brute_force'         ? 'secondary.main' :
          item.category === 'suspicious_request'  ? 'error.main' :
          item.category === 'queue_failure'       ? 'primary.main' :
          item.category === 'disk_space'          ? 'warning.main' :
          item.category === 'cron_failure'        ? 'secondary.main' :
          'warning.main'
        ),
        opacity: item.isResolved ? 0.75 : 1,
        mb: 1.5,
      }}
    >
      <CardActionArea component="div" onClick={() => navigate(`/admin/system-alerts/${item.id}`)}>
        <CardContent sx={{ pb: '8px !important' }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, flex: 1 }}>
              <Chip
                icon={<CategoryIcon category={item.category} />}
                label={item.categoryLabel}
                color={categoryChipColor(item.category)}
                size="small"
                sx={{ flexShrink: 0 }}
              />
              {item.occurrenceCount > 1 && (
                <Chip
                  label={`×${item.occurrenceCount}`}
                  size="small"
                  variant="outlined"
                  color="error"
                  sx={{ flexShrink: 0 }}
                />
              )}
              <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>
                {item.message}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>
              {item.isResolved ? (
                <Tooltip title="Wieder öffnen">
                  <IconButton size="small" color="warning" onClick={() => onReopen(item.id)}>
                    <ReplayIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : (
                <Tooltip title="Als erledigt markieren">
                  <IconButton size="small" color="success" onClick={() => onResolve(item.id)}>
                    <CheckCircleIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Stack>

          <Stack direction="row" spacing={2} sx={{ mt: 0.75, flexWrap: 'wrap', rowGap: 0.5 }}>
            {item.clientIp && (
              <Typography variant="caption" color="text.secondary">IP: {item.clientIp}</Typography>
            )}
            {item.requestUri && (
              <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 280 }}>
                {item.httpMethod} {item.requestUri}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto !important' }}>
              zuletzt: {fmtDate(item.lastOccurrenceAt)}
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

/* ─── AlertsTab ───────────────────────────────────────── */

interface AlertsTabProps {
  onCountChange?: (openCount: number) => void;
}

export default function AlertsTab({ onCountChange }: AlertsTabProps) {
  const navigate = useNavigate();
  const theme = useTheme();
  const dialogFullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [data, setData]       = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [tab, setTab]         = useState(0);
  const [snack, setSnack]     = useState<string | null>(null);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());

  const [resolveId, setResolveId]     = useState<number | null>(null);
  const [resolveNote, setResolveNote] = useState('');

  const toggleCategory = (cat: string) => {
    setHiddenCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<AlertsResponse>('/api/superadmin/system-alerts');
      setData(res);
      onCountChange?.(res.open.length);
    } catch {
      setError('Fehler beim Laden der System-Alerts.');
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => { load(); }, [load]);

  const handleResolve = (id: number) => {
    setResolveId(id);
    setResolveNote('');
  };

  const confirmResolve = async () => {
    if (resolveId === null) return;
    try {
      await apiJson(`/api/superadmin/system-alerts/${resolveId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ note: resolveNote || null }),
      });
      setSnack('Alert als erledigt markiert.');
      setResolveId(null);
      load();
    } catch {
      setSnack('Fehler beim Aktualisieren.');
    }
  };

  const handleReopen = async (id: number) => {
    try {
      await apiJson(`/api/superadmin/system-alerts/${id}/reopen`, { method: 'POST' });
      setSnack('Alert wieder geöffnet.');
      load();
    } catch {
      setSnack('Fehler beim Aktualisieren.');
    }
  };

  if (loading) return <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>;
  if (error)   return <Alert severity="error">{error}</Alert>;
  if (!data)   return null;

  const statusTabs = [
    { label: 'Offen',    items: data.open,     badge: data.open.length,     color: 'error'   as const },
    { label: 'Erledigt', items: data.resolved, badge: data.resolved.length, color: 'success' as const },
  ];

  const currentItems = statusTabs[tab]?.items ?? [];
  const filteredItems = currentItems.filter(item => !hiddenCategories.has(item.category));

  return (
    <Box>
      {/* Toolbar: filter chips + Trend-Analyse */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
        {data.stats.total > 0 ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
            <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Filter:</Typography>
            {Object.entries(data.stats.byCategory).map(([cat, cnt]) => {
              const hidden = hiddenCategories.has(cat);
              return (
                <Chip
                  key={cat}
                  icon={<CategoryIcon category={cat} />}
                  label={`${cnt} ${categoryLabel(cat)}`}
                  color={hidden ? 'default' : categoryChipColor(cat)}
                  variant={hidden ? 'outlined' : 'filled'}
                  size="small"
                  onClick={() => toggleCategory(cat)}
                  sx={{ cursor: 'pointer', opacity: hidden ? 0.45 : 1, textDecoration: hidden ? 'line-through' : 'none' }}
                />
              );
            })}
            {hiddenCategories.size > 0 && (
              <Chip
                label="Alle zeigen"
                size="small"
                variant="outlined"
                onClick={() => setHiddenCategories(new Set())}
                sx={{ cursor: 'pointer' }}
              />
            )}
          </Stack>
        ) : (
          <Box />
        )}
        <Button
          variant="outlined"
          size="small"
          startIcon={<BarChartIcon />}
          onClick={() => navigate('/admin/system-alerts/stats')}
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Trend-Analyse</Box>
        </Button>
      </Stack>

      {data.stats.total === 0 && (
        <Alert severity="success" sx={{ mb: 2 }}>Keine offenen Alerts – alles grün! 🎉</Alert>
      )}

      {/* Offen / Erledigt */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        {statusTabs.map((t, i) => (
          <Tab
            key={i}
            label={
              t.badge > 0
                ? <Badge badgeContent={t.badge} color={t.color}
                    sx={{ '& .MuiBadge-badge': { position: 'relative', top: -1, ml: 0.5, transform: 'none', transformOrigin: 'unset' } }}>
                    {t.label}
                  </Badge>
                : t.label
            }
          />
        ))}
      </Tabs>

      {filteredItems.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" mt={4}>
          {currentItems.length === 0
            ? 'Keine Einträge in dieser Kategorie.'
            : 'Alle Typen ausgeblendet – Filter anpassen, um Alerts zu sehen.'}
        </Typography>
      ) : (
        filteredItems.map(item => (
          <AlertCard
            key={item.id}
            item={item}
            onResolve={handleResolve}
            onReopen={handleReopen}
          />
        ))
      )}

      {/* Resolve-Dialog */}
      <Dialog open={resolveId !== null} onClose={() => setResolveId(null)} maxWidth="sm" fullWidth fullScreen={dialogFullScreen}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
          Alert als erledigt markieren
          <IconButton size="small" onClick={() => setResolveId(null)} edge="end" aria-label="Schließen">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
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
          <Button onClick={() => setResolveId(null)}>Abbrechen</Button>
          <Button variant="contained" color="success" onClick={confirmResolve} startIcon={<CheckCircleIcon />}>
            Als erledigt markieren
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack !== null}
        autoHideDuration={3000}
        onClose={() => setSnack(null)}
        message={snack}
      />
    </Box>
  );
}
