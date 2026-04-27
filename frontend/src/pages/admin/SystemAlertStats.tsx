import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, CircularProgress, Alert, Stack, ToggleButton, ToggleButtonGroup,
  Paper, Chip, Breadcrumbs, Link, Grid,
} from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import BugReportIcon from '@mui/icons-material/BugReport';
import LockIcon from '@mui/icons-material/Lock';
import SecurityIcon from '@mui/icons-material/Security';
import PolicyIcon from '@mui/icons-material/Policy';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import StorageIcon from '@mui/icons-material/Storage';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../../utils/api';

/* ─── Types ──────────────────────────────────────────── */

type Period = '24h' | '7d' | '30d';

interface TimeSeriesPoint {
  bucket: string;
  category: string;
  count: number;
}

interface TrendEntry {
  current: number;
  previous: number;
  direction: 'up' | 'down' | 'neutral';
  changePercent: number;
}

interface StatsResponse {
  period: string;
  bucketSize: 'hour' | 'day';
  timeSeries: TimeSeriesPoint[];
  trends: Record<string, TrendEntry>;
  totals: Record<string, number>;
}

/* ─── Constants ──────────────────────────────────────── */

const CATEGORIES = [
  { key: 'server_error',       label: 'Server-Fehler',          color: '#d32f2f' },
  { key: 'login_failure',      label: 'Login-Fehler',           color: '#ed6c02' },
  { key: 'brute_force',        label: 'Brute Force',            color: '#9c27b0' },
  { key: 'suspicious_request', label: 'Hack-Versuche',          color: '#d84315' },
  { key: 'queue_failure',      label: 'Queue-Fehler',           color: '#1565c0' },
  { key: 'disk_space',         label: 'Festplatten-Warnung',    color: '#f57f17' },
  { key: 'cron_failure',       label: 'Cron-Ausfall',           color: '#6d4c41' },
];

/* ─── Helper ──────────────────────────────────────────── */

function CategoryIcon({ category, fontSize = 'small' }: { category: string; fontSize?: 'small' | 'medium' }) {
  const props = { fontSize } as const;
  switch (category) {
    case 'server_error':       return <BugReportIcon {...props} />;
    case 'login_failure':      return <LockIcon {...props} />;
    case 'brute_force':        return <SecurityIcon {...props} />;
    case 'suspicious_request': return <PolicyIcon {...props} />;
    case 'queue_failure':      return <ErrorOutlineIcon {...props} />;
    case 'disk_space':         return <StorageIcon {...props} />;
    case 'cron_failure':       return <ScheduleIcon {...props} />;
    default:                   return null;
  }
}

function TrendIcon({ direction }: { direction: 'up' | 'down' | 'neutral' }) {
  if (direction === 'up')      return <TrendingUpIcon color="error" />;
  if (direction === 'down')    return <TrendingDownIcon color="success" />;
  return <TrendingFlatIcon color="action" />;
}

/**
 * Füllt Zeitreihen-Lücken auf (Buckets ohne Daten → count 0).
 */
function buildSeriesMap(
  timeSeries: TimeSeriesPoint[],
  allBuckets: string[]
): Record<string, number[]> {
  const map: Record<string, Record<string, number>> = {};

  for (const cat of CATEGORIES) {
    map[cat.key] = {};
    for (const b of allBuckets) {
      map[cat.key][b] = 0;
    }
  }

  for (const point of timeSeries) {
    if (map[point.category]) {
      map[point.category][point.bucket] = (map[point.category][point.bucket] ?? 0) + point.count;
    }
  }

  const result: Record<string, number[]> = {};
  for (const cat of CATEGORIES) {
    result[cat.key] = allBuckets.map(b => map[cat.key][b] ?? 0);
  }

  return result;
}

function formatBucket(bucket: string, bucketSize: 'hour' | 'day'): string {
  if (bucketSize === 'hour') {
    const [, time] = bucket.split(' ');
    return time ? time + ':00' : bucket;
  }
  const parts = bucket.split('-');
  return `${parts[2]}.${parts[1]}`;
}

/* ─── Trend Card ──────────────────────────────────────── */

function TrendCard({ categoryKey, label, color, trend, total }: {
  categoryKey: string;
  label: string;
  color: string;
  trend: TrendEntry | undefined;
  total: number;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, borderTop: `3px solid ${color}` }}
    >
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <CategoryIcon category={categoryKey} />
        <Typography variant="subtitle2" fontWeight={700}>{label}</Typography>
      </Stack>

      <Typography variant="h4" fontWeight={700} sx={{ color, mb: 0.5 }}>
        {total}
      </Typography>
      <Typography variant="caption" color="text.secondary">Total im Zeitraum</Typography>

      {trend && (
        <Stack direction="row" alignItems="center" spacing={0.5} mt={1}>
          <TrendIcon direction={trend.direction} />
          <Typography
            variant="body2"
            color={trend.direction === 'up' ? 'error' : trend.direction === 'down' ? 'success.main' : 'text.secondary'}
            fontWeight={600}
          >
            {trend.direction !== 'neutral'
              ? `${trend.changePercent > 0 ? '+' : ''}${trend.changePercent}% vs. Vorperiode`
              : 'Stabil vs. Vorperiode'}
          </Typography>
        </Stack>
      )}
      {trend && (
        <Typography variant="caption" color="text.secondary">
          Vorperiode: {trend.previous} · Aktuell: {trend.current}
        </Typography>
      )}
    </Paper>
  );
}

/* ─── Main Page ───────────────────────────────────────── */

export default function SystemAlertStats() {
  const navigate  = useNavigate();
  const [period, setPeriod]           = useState<Period>('7d');
  const [data, setData]               = useState<StatsResponse | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (key: string) => {
    setHiddenCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visibleCategories = CATEGORIES.filter(c => !hiddenCategories.has(c.key));

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<StatsResponse>(`/api/superadmin/system-alerts/stats?period=${p}`);
      setData(res);
    } catch {
      setError('Fehler beim Laden der Statistiken.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(period); }, [load, period]);

  // Build chart data
  const allBuckets = data
    ? [...new Set(data.timeSeries.map(p => p.bucket))].sort()
    : [];

  const seriesMap = data ? buildSeriesMap(data.timeSeries, allBuckets) : {};
  const xLabels   = allBuckets.map(b => formatBucket(b, data?.bucketSize ?? 'day'));

  const hasData = allBuckets.length > 0;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 960, mx: 'auto' }}>
      {/* Breadcrumb */}
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 2 }}>
        <Link
          component="button"
          variant="body2"
          onClick={() => navigate('/admin/system-maintenance?tab=alerts')}
          underline="hover"
          color="inherit"
        >
          System-Wartung
        </Link>
        <Typography variant="body2" color="text.primary">Trend-Analyse</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <TrendingUpIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>Trend-Analyse</Typography>
        </Stack>
        <ToggleButtonGroup
          value={period}
          exclusive
          size="small"
          onChange={(_, v) => { if (v) setPeriod(v); }}
        >
          <ToggleButton value="24h">24h</ToggleButton>
          <ToggleButton value="7d">7 Tage</ToggleButton>
          <ToggleButton value="30d">30 Tage</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* Category filter chips */}
      <Stack direction="row" spacing={1} flexWrap="wrap" mb={3} alignItems="center">
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Filter:</Typography>
        {CATEGORIES.map(cat => {
          const hidden = hiddenCategories.has(cat.key);
          return (
            <Chip
              key={cat.key}
              icon={<CategoryIcon category={cat.key} />}
              label={cat.label}
              size="small"
              onClick={() => toggleCategory(cat.key)}
              variant={hidden ? 'outlined' : 'filled'}
              sx={{
                cursor: 'pointer',
                opacity: hidden ? 0.4 : 1,
                textDecoration: hidden ? 'line-through' : 'none',
                bgcolor: hidden ? undefined : cat.color,
                color: hidden ? undefined : '#fff',
                '& .MuiChip-icon': { color: hidden ? undefined : '#fff' },
                '&:hover': { opacity: 0.85 },
              }}
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

      {loading && <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>}
      {error   && <Alert severity="error">{error}</Alert>}

      {!loading && data && (
        <>
          {/* Trend summary cards */}
          <Grid container spacing={2} mb={3}>
            {visibleCategories.map(cat => (
              <Grid size={{ xs: 12, sm: 4 }} key={cat.key}>
                <TrendCard
                  categoryKey={cat.key}
                  label={cat.label}
                  color={cat.color}
                  trend={data.trends[cat.key]}
                  total={data.totals[cat.key] ?? 0}
                />
              </Grid>
            ))}
          </Grid>

          {/* Line chart */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>
              Verlauf
              <Chip
                label={period === '24h' ? 'pro Stunde' : 'pro Tag'}
                size="small"
                variant="outlined"
                sx={{ ml: 1 }}
              />
            </Typography>

            {!hasData ? (
              <Typography color="text.secondary" textAlign="center" py={4}>
                Keine Daten für diesen Zeitraum.
              </Typography>
            ) : (
              <LineChart
                height={320}
                xAxis={[{
                  scaleType: 'point',
                  data: xLabels,
                  tickLabelStyle: { fontSize: 11 },
                }]}
                series={visibleCategories.map(cat => ({
                  id:    cat.key,
                  label: cat.label,
                  data:  seriesMap[cat.key] ?? [],
                  color: cat.color,
                  curve: 'linear',
                  showMark: allBuckets.length <= 14,
                }))}
                sx={{
                  '.MuiLineElement-root': { strokeWidth: 2 },
                  '.MuiMarkElement-root': { scale: '0.8' },
                }}
                slotProps={{
                  legend: {
                    position: { vertical: 'bottom', horizontal: 'center' },
                  },
                }}
                margin={{ bottom: 60 }}
              />
            )}
          </Paper>

          {/* Interpretation hint */}
          <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: 'info.50' }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>So liest du die Trends</Typography>
            <Stack spacing={0.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <TrendingUpIcon color="error" fontSize="small" />
                <Typography variant="body2">Anstieg &gt;10% gegenüber der Vorperiode → aktives Problem, sofortige Aktion empfohlen</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <TrendingFlatIcon color="action" fontSize="small" />
                <Typography variant="body2">Stabil innerhalb ±10% → Grundrauschen / Bot-Aktivität, Beobachten</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <TrendingDownIcon color="success" fontSize="small" />
                <Typography variant="body2">Rückgang &gt;10% → Maßnahmen greifen oder natürliches Abebben</Typography>
              </Stack>
              <Typography variant="body2" mt={0.5} color="text.secondary">
                Tipp: Konstant hohe Login-Fehler bei stabiler Kurve = Bot-Aktivität. Spike bei Server-Fehlern = echter Code-Fehler.
              </Typography>
            </Stack>
          </Paper>
        </>
      )}
    </Box>
  );
}
