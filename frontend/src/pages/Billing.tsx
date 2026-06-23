import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, FormControlLabel, Grid, Link, Stack, Typography } from '@mui/material';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { apiJson, getApiErrorMessage } from '../utils/api';

type TeamBilling = { id: number; name: string; status: string; access: boolean; reason?: string | null; trialEndsAt?: string | null; paidThrough?: string | null; missedBillingCycles?: number; payer?: string };
type Payment = { id: number; status: string; amount: number; currency: string; invoiceUrl?: string | null; invoicePdfUrl?: string | null; paidAt?: string | null; createdAt: string };
type Subscription = { id: number; status: string; teams: { id: number; name: string }[]; unitAmount: number; currency: string; currentPeriodEnd?: string | null; missedBillingCycles: number; payments: Payment[] };
type Overview = { stripeConfigured: boolean; unitAmount: number; currency: string; teams: TeamBilling[]; subscriptions: Subscription[] };

const labels: Record<string, string> = { trial: 'Kostenlose Testphase', active: 'Bezahlt & aktiv', pending: 'Aktivierung läuft', past_due: 'Zahlung offen', paused: 'Kostenlos pausiert', canceled: 'Gekündigt', blocked: 'Zugriff gesperrt', unpaid: 'Noch nicht abonniert' };
const colors: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = { trial: 'info', active: 'success', pending: 'warning', past_due: 'warning', paused: 'info', canceled: 'default', blocked: 'error', unpaid: 'default' };
const money = (amount: number, currency = 'EUR') => new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amount / 100);
const date = (value?: string | null) => value ? new Intl.DateTimeFormat('de-DE').format(new Date(value)) : '–';

export default function Billing() {
  const [data, setData] = useState<Overview | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => apiJson<Overview>('/api/billing/overview').then(setData).catch(e => setError(getApiErrorMessage(e)));
  useEffect(() => { void load(); }, []);
  const selectable = useMemo(() => data?.teams.filter(team => team.status === 'unpaid') ?? [], [data]);
  const pendingTeams = useMemo(() => data?.teams.filter(team => team.status === 'pending') ?? [], [data]);
  const trialTeams = useMemo(() => data?.teams.filter(team => team.status === 'trial' || team.status === 'paused') ?? [], [data]);
  const total = (data?.unitAmount ?? 1000) * selected.length;

  const checkout = async () => {
    setBusy(true); setError('');
    try { const result = await apiJson<{ url: string }>('/api/billing/checkout', { method: 'POST', body: { teamIds: selected } }); window.location.assign(result.url); }
    catch (e) { setError(getApiErrorMessage(e)); setBusy(false); }
  };
  const restartCheckout = async () => {
    setBusy(true); setError('');
    try { const result = await apiJson<{ url: string }>('/api/billing/checkout/restart', { method: 'POST', body: { teamIds: pendingTeams.map(team => team.id) } }); window.location.assign(result.url); }
    catch (e) { setError(getApiErrorMessage(e)); setBusy(false); }
  };
  const portal = async (id: number) => {
    setBusy(true); setError('');
    try { const result = await apiJson<{ url: string }>(`/api/billing/subscriptions/${id}/portal`, { method: 'POST' }); window.location.assign(result.url); }
    catch (e) { setError(getApiErrorMessage(e)); setBusy(false); }
  };

  if (!data && !error) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;
  return <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 2, md: 4 } }}>
    <Typography variant="h4" gutterBottom>Abrechnung & Abo</Typography>
    <Typography color="text.secondary" sx={{ mb: 3 }}>10 € pro Team und Monat. Der erste Zeitraum beginnt direkt mit erfolgreichem Abschluss.</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {!data?.stripeConfigured && <Alert severity="info" sx={{ mb: 3 }}><strong>Abos sind zurzeit noch nicht verfügbar.</strong> Du musst nichts tun und kannst Kaderblick während der Testphase kostenlos nutzen. Bevor Kosten entstehen können, wirst du rechtzeitig informiert.</Alert>}

    <Grid container spacing={2} sx={{ mb: 3 }}>
      {data?.teams.map(team => <Grid key={team.id} size={{ xs: 12, md: 6 }}><Card variant="outlined"><CardContent>
        <Stack direction="row" sx={{ gap: 1, justifyContent: 'space-between', alignItems: 'center' }}><Typography variant="h6">{team.name}</Typography><Chip size="small" color={colors[team.status] ?? 'default'} label={labels[team.status] ?? team.status} /></Stack>
        {team.reason && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{team.reason}</Typography>}
        {team.paidThrough && <Typography variant="body2" sx={{ mt: 1 }}>Bezahlt bis {date(team.paidThrough)}</Typography>}
        {team.trialEndsAt && <Typography variant="body2" sx={{ mt: 1 }}>Kostenlos bis {date(team.trialEndsAt)}</Typography>}
      </CardContent></Card></Grid>)}
    </Grid>

    <Card sx={{ mb: 3, border: '1px solid', borderColor: 'primary.main' }}><CardContent>
      <Typography variant="h6" gutterBottom>Abo abschließen</Typography>
      {selectable.length > 0 ? <>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Wähle die Teams aus, für die du die monatliche Zahlung übernehmen möchtest.</Typography>
        <Stack>{selectable.map(team => <FormControlLabel key={team.id} control={<Checkbox checked={selected.includes(team.id)} onChange={(_, checked) => setSelected(v => checked ? [...v, team.id] : v.filter(id => id !== team.id))} />} label={`${team.name} – ${money(data?.unitAmount ?? 1000)} monatlich`} />)}</Stack>
        <Button variant="contained" startIcon={<CreditCardIcon />} disabled={!selected.length || busy || !data?.stripeConfigured} onClick={checkout}>{busy ? 'Bitte warten …' : `Zahlungsart wählen – ${money(total)} / Monat`}</Button>
        {!data?.stripeConfigured && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Sobald Abos verfügbar sind, kannst du hier deine gewünschte Zahlungsart auswählen.</Typography>}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>Mögliche Zahlungsarten sind PayPal, SEPA-Lastschrift, Karte, Apple Pay und Google Pay.</Typography>
      </> : pendingTeams.length > 0 ? <Alert severity="warning">
        <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
          <span>Der Zahlungsabschluss für {pendingTeams.map(team => team.name).join(', ')} wurde nicht abgeschlossen.</span>
          <Button variant="contained" color="warning" disabled={busy || !data?.stripeConfigured} onClick={restartCheckout}>{busy ? 'Bitte warten …' : 'Zahlungsabschluss neu starten'}</Button>
        </Stack>
      </Alert> : trialTeams.length > 0 ? <Alert severity="info">
        Für {trialTeams.map(team => team.name).join(', ')} gilt aktuell eine kostenlose Testphase. Deshalb ist kein Abo erforderlich und es wird bewusst kein Zahlungsabschluss angeboten. Sobald die Testphase endet, erscheint hier die Team-Auswahl mit dem Button „Zahlungsart wählen“.
      </Alert> : data?.subscriptions.length ? <Alert severity="success">Alle von dir verwalteten Teams sind bereits einem Abonnement zugeordnet. Zahlungsart, Rechnungen und Kündigung findest du weiter unten.</Alert> : data?.teams.length ? <Alert severity="info">Für die angezeigten Teams kann derzeit kein neues Abonnement abgeschlossen werden.</Alert> : <Alert severity="warning">Für dein Konto sind keine abrechenbaren Teams verfügbar.</Alert>}
    </CardContent></Card>

    {data?.subscriptions.map(subscription => <Card key={subscription.id} sx={{ mb: 2 }}><CardContent>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2, justifyContent: 'space-between' }}>
        <Box><Typography variant="h6">{subscription.teams.map(t => t.name).join(', ')}</Typography><Typography color="text.secondary">{money(subscription.unitAmount * subscription.teams.length, subscription.currency)} monatlich · nächste Periode bis {date(subscription.currentPeriodEnd)}</Typography></Box>
        <Button variant="outlined" disabled={busy || subscription.status === 'pending'} onClick={() => portal(subscription.id)}>Abo & Zahlungsart verwalten</Button>
      </Stack>
      {subscription.payments.length > 0 && <Box sx={{ mt: 2 }}><Typography variant="subtitle2" gutterBottom>Rechnungen</Typography><Stack spacing={1}>{subscription.payments.map(payment => <Stack key={payment.id} direction="row" sx={{ gap: 1, alignItems: 'center' }}><ReceiptLongIcon fontSize="small" /><Typography variant="body2">{date(payment.paidAt ?? payment.createdAt)} · {money(payment.amount, payment.currency)}</Typography>{(payment.invoicePdfUrl || payment.invoiceUrl) && <Link href={payment.invoicePdfUrl || payment.invoiceUrl || '#'} target="_blank" rel="noreferrer">Rechnung öffnen</Link>}</Stack>)}</Stack></Box>}
    </CardContent></Card>)}
  </Box>;
}
