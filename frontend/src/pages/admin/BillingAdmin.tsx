import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, FormControl,
  Grid, InputLabel, MenuItem, Paper, Select, Stack, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TablePagination, TableRow, TableSortLabel,
  Tabs, TextField, Typography,
} from '@mui/material';
import { apiJson, getApiErrorMessage } from '../../utils/api';

type Option = { id: number; name: string };
type BillingStatus = 'active' | 'past_due' | 'blocked' | 'trial' | 'unpaid' | 'pending' | 'paused' | 'canceled';
type Team = Option & {
  clubs: Option[];
  status: BillingStatus;
  access: boolean;
  payer?: string | null;
  paidThrough?: string | null;
  trialEndsAt?: string | null;
  reason?: string | null;
  missedBillingCycles?: number;
};
type Exemption = {
  id: number;
  scope: 'platform' | 'club' | 'team';
  club?: Option | null;
  team?: Option | null;
  startsAt?: string | null;
  endsAt?: string | null;
  endedAt?: string | null;
  reason: string;
  active: boolean;
};
type Subscription = {
  id: number;
  payer: { name: string; email: string };
  teams: Option[];
  status: BillingStatus;
  amount: number;
  currency: string;
  periodEnd?: string | null;
  missedBillingCycles: number;
};
type Data = { teams: Team[]; clubs: Option[]; exemptions: Exemption[]; subscriptions: Subscription[] };
type SortKey = 'name' | 'club' | 'status' | 'payer' | 'paidThrough';

const statusMeta: Record<BillingStatus, { label: string; color: 'success' | 'warning' | 'error' | 'info' | 'default' }> = {
  active: { label: 'Bezahlt', color: 'success' },
  past_due: { label: 'Zahlung offen', color: 'warning' },
  blocked: { label: 'Gesperrt', color: 'error' },
  trial: { label: 'Testphase', color: 'info' },
  unpaid: { label: 'Ohne Abo', color: 'default' },
  pending: { label: 'Abschluss läuft', color: 'warning' },
  paused: { label: 'Pausiert', color: 'info' },
  canceled: { label: 'Gekündigt', color: 'default' },
};

const money = (amount: number, currency = 'EUR') => new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amount / 100);
const date = (value?: string | null) => value ? new Intl.DateTimeFormat('de-DE').format(new Date(value)) : '–';
const clubNames = (team: Team) => team.clubs.map(club => club.name).join(', ') || 'Ohne Verein';

function StatusChip({ status }: { status: BillingStatus }) {
  const meta = statusMeta[status] ?? { label: status, color: 'default' as const };
  return <Chip size="small" color={meta.color} label={meta.label} />;
}

function SummaryCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return <Card variant="outlined"><CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography variant="h5" sx={{ color, fontWeight: 700 }}>{value}</Typography>
  </CardContent></Card>;
}

export default function BillingAdmin() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BillingStatus>('all');
  const [clubFilter, setClubFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [form, setForm] = useState({ scope: 'team', targetId: '', startsAt: new Date().toISOString().slice(0, 10), endsAt: '', reason: '' });

  const load = () => apiJson<Data>('/api/superadmin/billing').then(setData).catch(e => setError(getApiErrorMessage(e)));
  useEffect(() => { void load(); }, []);

  const summary = useMemo(() => {
    const teams = data?.teams ?? [];
    const paid = teams.filter(team => team.status === 'active').length;
    return {
      total: teams.length,
      paid,
      trial: teams.filter(team => team.status === 'trial' || team.status === 'paused').length,
      overdue: teams.filter(team => team.status === 'past_due' || team.status === 'blocked').length,
      withoutSubscription: teams.filter(team => team.status === 'unpaid').length,
      revenue: paid * 1000,
    };
  }, [data]);

  const filteredTeams = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('de');
    const valueFor = (team: Team, key: SortKey) => {
      if (key === 'club') return clubNames(team);
      if (key === 'payer') return team.payer ?? '';
      if (key === 'paidThrough') return team.paidThrough ?? team.trialEndsAt ?? '';
      return team[key] ?? '';
    };
    return (data?.teams ?? [])
      .filter(team => statusFilter === 'all' || team.status === statusFilter)
      .filter(team => clubFilter === 'all' || team.clubs.some(club => String(club.id) === clubFilter) || (clubFilter === 'none' && team.clubs.length === 0))
      .filter(team => !needle || [team.name, clubNames(team), team.payer ?? '', statusMeta[team.status]?.label ?? team.status].some(value => value.toLocaleLowerCase('de').includes(needle)))
      .sort((left, right) => String(valueFor(left, sortKey)).localeCompare(String(valueFor(right, sortKey)), 'de', { numeric: true }) * (sortDirection === 'asc' ? 1 : -1));
  }, [clubFilter, data, search, sortDirection, sortKey, statusFilter]);

  useEffect(() => { setPage(0); }, [search, statusFilter, clubFilter, rowsPerPage]);

  const changeSort = (key: SortKey) => {
    if (key === sortKey) setSortDirection(value => value === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDirection('asc'); }
  };

  const save = async () => {
    setBusy(true); setError('');
    try {
      await apiJson('/api/superadmin/billing/exemptions', {
        method: 'POST',
        body: {
          scope: form.scope,
          clubId: form.scope === 'club' ? Number(form.targetId) : undefined,
          teamId: form.scope === 'team' ? Number(form.targetId) : undefined,
          startsAt: form.startsAt || undefined,
          endsAt: form.endsAt || undefined,
          reason: form.reason,
        },
      });
      setForm(value => ({ ...value, targetId: '', endsAt: '', reason: '' }));
      await load();
    } catch (e) { setError(getApiErrorMessage(e)); }
    finally { setBusy(false); }
  };

  const deactivate = async (id: number) => {
    setBusy(true); setError('');
    try { await apiJson(`/api/superadmin/billing/exemptions/${id}`, { method: 'DELETE' }); await load(); }
    catch (e) { setError(getApiErrorMessage(e)); }
    finally { setBusy(false); }
  };

  if (!data && !error) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;

  const visibleTeams = filteredTeams.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return <Box sx={{ maxWidth: 1400, mx: 'auto', p: { xs: 2, md: 4 } }}>
    <Typography variant="h4">Plattform-Abrechnung</Typography>
    <Typography color="text.secondary" sx={{ mb: 3 }}>Vereinsübergreifende Zahlungsübersicht für Superadmins</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 6, md: 2 }}><SummaryCard label="Teams gesamt" value={summary.total} /></Grid>
      <Grid size={{ xs: 6, md: 2 }}><SummaryCard label="Bezahlt" value={summary.paid} color="success.main" /></Grid>
      <Grid size={{ xs: 6, md: 2 }}><SummaryCard label="Testphase" value={summary.trial} color="info.main" /></Grid>
      <Grid size={{ xs: 6, md: 2 }}><SummaryCard label="Überfällig/gesperrt" value={summary.overdue} color="error.main" /></Grid>
      <Grid size={{ xs: 6, md: 2 }}><SummaryCard label="Ohne Abo" value={summary.withoutSubscription} /></Grid>
      <Grid size={{ xs: 6, md: 2 }}><SummaryCard label="Monatlich aktiv" value={money(summary.revenue)} color="success.main" /></Grid>
    </Grid>

    <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 3 }}>
      <Tab label="Teams & Zahlungen" />
      <Tab label="Testphasen" />
    </Tabs>

    {tab === 0 && <>
      <Paper variant="outlined" sx={{ mb: 3, p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2 }}>
          <TextField size="small" label="Team, Verein oder Zahler suchen" value={search} onChange={event => setSearch(event.target.value)} sx={{ minWidth: { md: 300 }, flex: 1 }} />
          <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>Status</InputLabel>
            <Select value={statusFilter} label="Status" onChange={event => setStatusFilter(event.target.value as 'all' | BillingStatus)}>
              <MenuItem value="all">Alle Status</MenuItem>
              {Object.entries(statusMeta).map(([status, meta]) => <MenuItem key={status} value={status}>{meta.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 220 }}><InputLabel>Verein</InputLabel>
            <Select value={clubFilter} label="Verein" onChange={event => setClubFilter(String(event.target.value))}>
              <MenuItem value="all">Alle Vereine</MenuItem>
              <MenuItem value="none">Ohne Verein</MenuItem>
              {data?.clubs.map(club => <MenuItem key={club.id} value={String(club.id)}>{club.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>{filteredTeams.length} von {data?.teams.length ?? 0} Teams angezeigt</Typography>
      </Paper>

      <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
        <Table size="small">
          <TableHead><TableRow>
            {([
              ['name', 'Team'], ['club', 'Verein'], ['status', 'Zahlungsstatus'], ['payer', 'Zahler'], ['paidThrough', 'Gültigkeit'],
            ] as [SortKey, string][]).map(([key, label]) => <TableCell key={key}><TableSortLabel active={sortKey === key} direction={sortKey === key ? sortDirection : 'asc'} onClick={() => changeSort(key)}>{label}</TableSortLabel></TableCell>)}
            <TableCell align="right">Monatlich</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {visibleTeams.map(team => <TableRow key={team.id} hover>
              <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{team.name}</Typography></TableCell>
              <TableCell>{clubNames(team)}</TableCell>
              <TableCell><StatusChip status={team.status} />{Boolean(team.missedBillingCycles) && <Typography variant="caption" color="error" sx={{ ml: 1 }}>{team.missedBillingCycles} offen</Typography>}</TableCell>
              <TableCell>{team.status === 'trial' ? <Typography color="info.main">Kostenlos</Typography> : team.payer || '–'}</TableCell>
              <TableCell>
                {team.status === 'trial' || team.status === 'paused'
                  ? <><Typography variant="body2">{team.trialEndsAt ? `Testphase bis ${date(team.trialEndsAt)}` : 'Testphase unbefristet'}</Typography>{team.reason && <Typography variant="caption" color="text.secondary">{team.reason}</Typography>}</>
                  : team.paidThrough ? `Bezahlt bis ${date(team.paidThrough)}` : '–'}
              </TableCell>
              <TableCell align="right">{team.status === 'trial' || team.status === 'paused' ? money(0) : money(1000)}</TableCell>
            </TableRow>)}
            {visibleTeams.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5 }}>Keine Teams entsprechen den Filtern.</TableCell></TableRow>}
          </TableBody>
        </Table>
        <TablePagination component="div" count={filteredTeams.length} page={page} onPageChange={(_, value) => setPage(value)} rowsPerPage={rowsPerPage} onRowsPerPageChange={event => setRowsPerPage(Number(event.target.value))} rowsPerPageOptions={[10, 25, 50, 100]} labelRowsPerPage="Zeilen pro Seite" />
      </TableContainer>

      <Typography variant="h6" gutterBottom>Abonnements nach Zahler</Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small"><TableHead><TableRow><TableCell>Zahler</TableCell><TableCell>Teams</TableCell><TableCell>Status</TableCell><TableCell>Nächster Stichtag</TableCell><TableCell align="right">Monatlich</TableCell></TableRow></TableHead>
          <TableBody>{data?.subscriptions.map(subscription => <TableRow key={subscription.id} hover>
            <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{subscription.payer.name}</Typography><Typography variant="caption" color="text.secondary">{subscription.payer.email}</Typography></TableCell>
            <TableCell>{subscription.teams.map(team => team.name).join(', ') || 'Historisches Abonnement'}</TableCell>
            <TableCell><StatusChip status={subscription.status} />{subscription.missedBillingCycles > 0 && <Typography variant="caption" color="error" sx={{ ml: 1 }}>{subscription.missedBillingCycles} offen</Typography>}</TableCell>
            <TableCell>{date(subscription.periodEnd)}</TableCell><TableCell align="right">{money(subscription.amount, subscription.currency)}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </TableContainer>
    </>}

    {tab === 1 && <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 5 }}><Card><CardContent><Typography variant="h6" gutterBottom>Testphase anlegen</Typography><Stack spacing={2}>
        <FormControl fullWidth><InputLabel>Bereich</InputLabel><Select value={form.scope} label="Bereich" onChange={event => setForm(value => ({ ...value, scope: event.target.value, targetId: '' }))}><MenuItem value="platform">Gesamte Plattform</MenuItem><MenuItem value="club">Verein</MenuItem><MenuItem value="team">Einzelnes Team</MenuItem></Select></FormControl>
        {form.scope !== 'platform' && <FormControl fullWidth><InputLabel>{form.scope === 'club' ? 'Verein' : 'Team'}</InputLabel><Select value={form.targetId} label={form.scope === 'club' ? 'Verein' : 'Team'} onChange={event => setForm(value => ({ ...value, targetId: String(event.target.value) }))}>{(form.scope === 'club' ? data?.clubs : data?.teams)?.map(item => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</Select></FormControl>}
        <TextField type="date" label="Beginn" slotProps={{ inputLabel: { shrink: true } }} value={form.startsAt} onChange={event => setForm(value => ({ ...value, startsAt: event.target.value }))} />
        <TextField type="date" label="Ende (leer = unbefristet)" slotProps={{ inputLabel: { shrink: true } }} value={form.endsAt} onChange={event => setForm(value => ({ ...value, endsAt: event.target.value }))} />
        <TextField multiline minRows={2} label="Begründung" value={form.reason} onChange={event => setForm(value => ({ ...value, reason: event.target.value }))} />
        <Button variant="contained" disabled={busy || !form.reason.trim() || (form.scope !== 'platform' && !form.targetId)} onClick={save}>Testphase aktivieren</Button>
      </Stack></CardContent></Card></Grid>
      <Grid size={{ xs: 12, md: 7 }}><Stack spacing={2}>{data?.exemptions.map(item => <Card key={item.id} variant="outlined"><CardContent><Stack direction="row" sx={{ gap: 2, justifyContent: 'space-between' }}><Box><Typography sx={{ fontWeight: 700 }}>{item.scope === 'platform' ? 'Gesamte Plattform' : item.club?.name || item.team?.name}</Typography><Typography variant="body2">Beginn: {date(item.startsAt)}</Typography><Typography variant="body2">{item.active ? (item.endsAt ? `Geplantes Ende: ${date(item.endsAt)}` : 'Laufzeit: unbefristet') : `Beendet am: ${date(item.endedAt ?? item.endsAt)}`}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{item.reason}</Typography></Box>{item.active ? <Button color="error" disabled={busy} onClick={() => deactivate(item.id)}>Beenden</Button> : <Chip label="Beendet" />}</Stack></CardContent></Card>)}</Stack></Grid>
    </Grid>}
  </Box>;
}
