import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { LineChart } from '@mui/x-charts';
import {
  fetchActivityTrend,
  fetchUserActivity,
  type ActivityStats,
  type ActivityTrendData,
  type SortDir,
  type SortKey,
  type TrendRange,
  type UserActivityEntry,
} from '../../services/adminActivity';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(minutesAgo: number | null): string {
  if (minutesAgo === null) return '–';
  if (minutesAgo < 1) return 'gerade eben';
  if (minutesAgo < 60) return `vor ${minutesAgo} Min.`;
  const hours = Math.floor(minutesAgo / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'vor 1 Tag';
  if (days < 30) return `vor ${days} Tagen`;
  const months = Math.floor(days / 30);
  if (months === 1) return 'vor 1 Monat';
  if (months < 12) return `vor ${months} Monaten`;
  const years = Math.floor(months / 12);
  return years === 1 ? 'vor 1 Jahr' : `vor ${years} Jahren`;
}

function formatAbsolute(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function roleLabel(role: string): string {
  switch (role) {
    case 'ROLE_SUPERADMIN': return 'Superadmin';
    case 'ROLE_ADMIN': return 'Admin';
    case 'ROLE_USER': return 'User';
    default: return role.replace('ROLE_', '');
  }
}

type StatusCategory = 'today' | 'week' | 'old' | 'never';

function getStatus(minutesAgo: number | null): StatusCategory {
  if (minutesAgo === null) return 'never';
  if (minutesAgo < 60 * 24) return 'today';
  if (minutesAgo < 60 * 24 * 7) return 'week';
  return 'old';
}

/** Format raw bucket key from API into a human-readable x-axis label */
function formatBucketLabel(raw: string, range: TrendRange): string {
  if (range === 'today') {
    // '2026-03-12 14:00:00' → '14:00'
    return raw.slice(11, 16);
  }
  if (range === '1y') {
    // '2026-03-01' → 'Mär. 26'
    const d = new Date(raw);
    return d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
  }
  // '2026-03-12' → '12.03.'
  const parts = raw.split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.`;
  return raw;
}

const TREND_RANGES: { value: TrendRange; label: string }[] = [
  { value: 'today', label: 'Heute' },
  { value: 'week',  label: '7 Tage' },
  { value: 'month', label: '30 Tage' },
  { value: '3m',    label: '3 Monate' },
  { value: '6m',    label: '6 Monate' },
  { value: '1y',    label: '1 Jahr' },
];

// ── Stats card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  color: string;
}

function StatCard({ label, value, color }: StatCardProps) {
  return (
    <Paper elevation={0} sx={{ flex: '1 1 140px', minWidth: 120, p: 2, textAlign: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
      <Typography variant="h4" sx={{ color, fontWeight: 700 }}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Paper>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50];
const DEFAULT_LIMIT = 25;

export default function ActivityOverview() {
  // ── User table state ──────────────────────────────────────────────────────
  const [users, setUsers]       = useState<UserActivityEntry[]>([]);
  const [stats, setStats]       = useState<ActivityStats | null>(null);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(0); // MUI is 0-indexed, API is 1-indexed
  const [limit, setLimit]       = useState(DEFAULT_LIMIT);
  const [search, setSearch]     = useState('');
  const [sort, setSort]         = useState<SortKey>('last_activity_at');
  const [dir, setDir]           = useState<SortDir>('desc');
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError]     = useState<string | null>(null);

  // ── Trend chart state ─────────────────────────────────────────────────────
  const [trendRange, setTrendRange]   = useState<TrendRange>('month');
  const [trendData, setTrendData]     = useState<ActivityTrendData | null>(null);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError]   = useState<string | null>(null);

  // ── Debounced search ──────────────────────────────────────────────────────
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setPage(0);
      setDebouncedSearch(value);
    }, 350);
  };

  // ── Fetch user list ───────────────────────────────────────────────────────
  const loadUsers = useCallback(() => {
    setListLoading(true);
    setListError(null);
    fetchUserActivity({
      page: page + 1,
      limit,
      search: debouncedSearch || undefined,
      sort,
      dir,
    })
      .then(data => {
        setUsers(data.users);
        setStats(data.stats);
        setTotal(data.pagination.total);
      })
      .catch(() => setListError('Fehler beim Laden der Aktivitätsdaten.'))
      .finally(() => setListLoading(false));
  }, [page, limit, debouncedSearch, sort, dir]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // ── Fetch trend ───────────────────────────────────────────────────────────
  useEffect(() => {
    setTrendLoading(true);
    setTrendError(null);
    fetchActivityTrend(trendRange)
      .then(setTrendData)
      .catch(() => setTrendError('Fehler beim Laden der Trenddaten.'))
      .finally(() => setTrendLoading(false));
  }, [trendRange]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleSort(key: SortKey) {
    if (sort === key) {
      setDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(key);
      setDir('asc');
    }
    setPage(0);
  }

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartLabels = (trendData?.data ?? []).map(d => formatBucketLabel(d.label, trendRange));
  const chartCounts = (trendData?.data ?? []).map(d => d.count);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <ShowChartIcon sx={{ fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h5" fontWeight={700}>Nutzeraktivität</Typography>
      </Box>

      {/* Stats */}
      {stats && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <StatCard label="Gesamt"         value={stats.totalCount}       color="text.primary" />
          <StatCard label="Heute aktiv"    value={stats.activeToday}      color="success.main" />
          <StatCard label="Letzte 7 Tage"  value={stats.activeLast7Days}  color="warning.main" />
          <StatCard label="Nie aktiv"      value={stats.neverActive}      color="text.disabled" />
        </Box>
      )}

      {/* Trend chart */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Aktivitätstrend
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={trendRange}
            onChange={(_, v) => v && setTrendRange(v as TrendRange)}
          >
            {TREND_RANGES.map(r => (
              <ToggleButton key={r.value} value={r.value}>{r.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        {trendLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        )}
        {trendError && <Alert severity="error" sx={{ mt: 1 }}>{trendError}</Alert>}

        {!trendLoading && !trendError && chartLabels.length === 0 && (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            Keine Aktivitätsdaten für diesen Zeitraum.
          </Typography>
        )}

        {!trendLoading && !trendError && chartLabels.length > 0 && (
          <LineChart
            xAxis={[{
              scaleType: 'point',
              data: chartLabels,
              tickLabelStyle: { fontSize: 11 },
            }]}
            series={[{
              data: chartCounts,
              label: 'Aktive Nutzer',
              color: '#1976d2',
              area: true,
              showMark: chartCounts.length <= 60,
            }]}
            height={240}
            margin={{ top: 24, bottom: 40, left: 48, right: 16 }}
            sx={{
              '.MuiAreaElement-root': { fillOpacity: 0.15 },
            }}
          />
        )}
      </Paper>

      {/* Search */}
      <TextField
        size="small"
        placeholder="Name oder E-Mail suchen…"
        value={search}
        onChange={e => handleSearchChange(e.target.value)}
        sx={{ mb: 2, width: { xs: '100%', sm: 320 } }}
      />

      {listError && <Alert severity="error" sx={{ mb: 2 }}>{listError}</Alert>}

      {/* Table */}
      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'action.hover' } }}>
              <TableCell>
                <TableSortLabel active={sort === 'full_name'} direction={sort === 'full_name' ? dir : 'asc'} onClick={() => handleSort('full_name')}>
                  Name
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sort === 'email'} direction={sort === 'email' ? dir : 'asc'} onClick={() => handleSort('email')}>
                  E-Mail
                </TableSortLabel>
              </TableCell>
              <TableCell>Rollen</TableCell>
              <TableCell>
                <TableSortLabel active={sort === 'last_activity_at'} direction={sort === 'last_activity_at' ? dir : 'asc'} onClick={() => handleSort('last_activity_at')}>
                  Letzte Aktivität
                </TableSortLabel>
              </TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {listLoading && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}

            {!listLoading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Keine Benutzer gefunden.
                </TableCell>
              </TableRow>
            )}

            {!listLoading && users.map(user => {
              const status = getStatus(user.minutesAgo);
              return (
                <TableRow key={user.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>{user.fullName}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>{user.email}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {user.roles
                        .filter(r => r !== 'ROLE_USER' || user.roles.length === 1)
                        .map(r => (
                          <Chip
                            key={r}
                            label={roleLabel(r)}
                            size="small"
                            color={r === 'ROLE_SUPERADMIN' ? 'error' : r === 'ROLE_ADMIN' ? 'warning' : 'default'}
                            variant="outlined"
                          />
                        ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {user.lastActivityAt ? (
                      <Tooltip title={formatAbsolute(user.lastActivityAt)} placement="top">
                        <Typography variant="body2">{formatRelative(user.minutesAgo)}</Typography>
                      </Tooltip>
                    ) : (
                      <Typography variant="body2" color="text.disabled">–</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {status === 'today' && <Chip icon={<CheckCircleIcon />}  label="Heute aktiv"   size="small" color="success" variant="outlined" />}
                    {status === 'week'  && <Chip icon={<WarningAmberIcon />} label="Diese Woche"   size="small" color="warning" variant="outlined" />}
                    {status === 'old'   && <Chip                             label="Länger inaktiv" size="small" color="error"  variant="outlined" />}
                    {status === 'never' && <Chip icon={<HelpOutlineIcon />}  label="Nie aktiv"     size="small" variant="outlined" sx={{ color: 'text.disabled', borderColor: 'text.disabled' }} />}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={limit}
          rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={e => { setLimit(parseInt(e.target.value, 10)); setPage(0); }}
          labelRowsPerPage="Zeilen:"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} von ${count}`}
        />
      </TableContainer>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Aktivität wird beim Laden von API-Seiten erfasst (max. alle 5 Minuten aktualisiert).
      </Typography>

    </Box>
  );
}
