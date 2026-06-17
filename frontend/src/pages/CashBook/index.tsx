import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import SettingsIcon from '@mui/icons-material/Settings';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PaymentIcon from '@mui/icons-material/Payment';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { AdminPageLayout } from '../../components/AdminPageLayout';
import { apiJson, getApiErrorMessage } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

// ── Typen ────────────────────────────────────────────────────────────────────

interface CashBookSummary {
  id: number;
  name: string;
  type: 'team' | 'club';
  entityName: string;
  teamId: number | null;
  clubId: number | null;
  openingBalance: number;
  balance: number;
  incomeTotal: number;
  expenseTotal: number;
}

interface CashBookEntry {
  id: number;
  amount: number;
  type: 'income' | 'expense';
  category: string | null;
  description: string;
  entryDate: string;
  createdByUser: { fullName: string } | null;
  balance: number;
}

interface CashBookDetail {
  cashBook: { id: number; name: string; type: string };
  entries: CashBookEntry[];
  balance: number;
  incomeTotal: number;
  expenseTotal: number;
}

interface EntryForm {
  amount: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  entryDate: string;
}

const INCOME_CATEGORIES = [
  'Mitgliedsbeiträge', 'Sponsoring', 'Spenden', 'Veranstaltungseinnahmen',
  'Strafen', 'Deckel-Zahlungen', 'Sonstiges',
];

const EXPENSE_CATEGORIES = [
  'Spielbetrieb', 'Ausrüstung / Material', 'Hallenmiete / Platzmiete',
  'Reisekosten', 'Verbandsgebühren', 'Versicherungen', 'Verwaltung', 'Sonstiges',
];

const today = () => new Date().toISOString().split('T')[0];
const emptyForm = (): EntryForm => ({ amount: '', type: 'expense', category: '', description: '', entryDate: today() });

function formatEur(val: number): string {
  return val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// ── Deckel / Katalog Typen ───────────────────────────────────────────────────

interface OverviewEntry {
  id: number;
  catalogItem: { name: string; price: number; category: string | null } | null;
  customName: string | null;
  effectiveName: string;
  quantity: number;
  priceAtBooking: number;
  entryDate: string;
  note: string | null;
  penaltyType: { id: number; name: string; isPositive: boolean } | null;
  isPenalty: boolean;
}

interface OverviewPayment {
  id: number;
  amount: number;
  note: string | null;
  paymentDate: string;
}

interface OverviewRow {
  userId: number;
  fullName: string;
  teamId: number | null;
  clubId: number | null;
  entityName: string;
  totalConsumed: number;
  totalPaid: number;
  saldo: number;
  entries: OverviewEntry[];
  payments: OverviewPayment[];
}

interface MgmtCatalogItem {
  id: number;
  name: string;
  price: number;
  category: string | null;
  active: boolean;
  team: { id: number; name: string } | null;
  club: { id: number; name: string } | null;
}

interface MgmtResponse {
  catalog: MgmtCatalogItem[];
  teams: Array<{ id: number; name: string }>;
  clubs: Array<{ id: number; name: string }>;
}

interface CatalogForm {
  name: string;
  price: string;
  category: string;
  active: boolean;
  teamId: number | '';
  clubId: number | '';
}

interface PaymentForm {
  amount: string;
  note: string;
  paymentDate: string;
}

const emptyCatalogForm = (): CatalogForm => ({ name: '', price: '', category: '', active: true, teamId: '', clubId: '' });
const emptyPaymentForm = (): PaymentForm => ({ amount: '', note: '', paymentDate: today() });

const TAB_CATEGORIES = ['Getränke', 'Essen', 'Sonstiges'];

// ── Hauptseite ───────────────────────────────────────────────────────────────

const CashBook: React.FC = () => {
  const theme = useTheme();
  const toast = useToast();

  const [books, setBooks] = useState<CashBookSummary[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [activeBookIdx, setActiveBookIdx] = useState(0);

  const [detail, setDetail] = useState<CashBookDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [yearFilter, setYearFilter] = useState<number | 'all'>('all');
  const [visibleCount, setVisibleCount] = useState(50);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<CashBookEntry | null>(null);
  const [form, setForm] = useState<EntryForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteEntry, setDeleteEntry] = useState<CashBookEntry | null>(null);

  // ── Haupt-Tab (Buchungen / Deckel / Katalog) ───────────────────────────────
  const [mainTab, setMainTab] = useState(0);

  // Deckel-Übersicht
  const [deckelData, setDeckelData] = useState<OverviewRow[] | null>(null);
  const [loadingDeckel, setLoadingDeckel] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [paymentDialog, setPaymentDialog] = useState<OverviewRow | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(emptyPaymentForm());
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentDeleteId, setPaymentDeleteId] = useState<number | null>(null);

  // Katalog-Verwaltung
  const [mgmtData, setMgmtData] = useState<MgmtResponse | null>(null);
  const [loadingMgmt, setLoadingMgmt] = useState(false);
  const [catalogDialog, setCatalogDialog] = useState<'create' | 'edit' | null>(null);
  const [catalogEditId, setCatalogEditId] = useState<number | null>(null);
  const [catalogForm, setCatalogForm] = useState<CatalogForm>(emptyCatalogForm());
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogDeleteId, setCatalogDeleteId] = useState<number | null>(null);

  // Kassenbuch-Einstellungen (Name + Eröffnungssaldo)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsName, setSettingsName] = useState('');
  const [settingsOpeningBalance, setSettingsOpeningBalance] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  // ── Laden ─────────────────────────────────────────────────────────────────

  const loadBooks = useCallback(() => {
    setLoadingBooks(true);
    apiJson('/api/cash-books')
      .then((d: any) => setBooks(Array.isArray(d) ? d : []))
      .catch((e: any) => toast.showToast(getApiErrorMessage(e) || 'Fehler beim Laden', 'error'))
      .finally(() => setLoadingBooks(false));
  }, []);

  const loadDetail = useCallback((bookId: number) => {
    setLoadingDetail(true);
    setDetail(null);
    apiJson(`/api/cash-books/${bookId}/entries`)
      .then((d: any) => setDetail(d))
      .catch((e: any) => toast.showToast(getApiErrorMessage(e) || 'Fehler beim Laden', 'error'))
      .finally(() => setLoadingDetail(false));
  }, []);

  const loadDeckel = useCallback(() => {
    setLoadingDeckel(true);
    const book = books[activeBookIdx];
    const params = new URLSearchParams();
    if (book?.teamId) params.set('teamId', String(book.teamId));
    else if (book?.clubId) params.set('clubId', String(book.clubId));
    apiJson(`/api/tab/overview${params.toString() ? '?' + params.toString() : ''}`)
      .then((d: any) => setDeckelData(Array.isArray(d) ? d : []))
      .catch((e: any) => toast.showToast(getApiErrorMessage(e) || 'Fehler beim Laden', 'error'))
      .finally(() => setLoadingDeckel(false));
  }, [books, activeBookIdx]);

  const loadMgmt = useCallback(() => {
    setLoadingMgmt(true);
    apiJson('/api/tab/management')
      .then((d: any) => setMgmtData(d))
      .catch((e: any) => toast.showToast(getApiErrorMessage(e) || 'Fehler beim Laden', 'error'))
      .finally(() => setLoadingMgmt(false));
  }, []);

  useEffect(() => { loadBooks(); }, [loadBooks]);

  useEffect(() => {
    if (books.length > 0) loadDetail(books[activeBookIdx]?.id);
    setDeckelData(null);
  }, [books, activeBookIdx]);

  useEffect(() => {
    if (mainTab === 1 && deckelData === null) loadDeckel();
    if (mainTab === 2 && mgmtData === null) loadMgmt();
  }, [mainTab]);

  // ── Gefilterte Einträge ────────────────────────────────────────────────────

  const filteredEntries = React.useMemo(() => {
    const entries = (detail?.entries ?? []).filter(e =>
      yearFilter === 'all' || new Date(e.entryDate).getFullYear() === yearFilter
    );
    if (yearFilter === 'all') return entries;

    // Recalculate running balance for filtered entries (oldest-to-newest accumulation)
    const reversed = [...entries].reverse();
    let runningBalance = 0;
    const balanceMap = new Map<number, number>();
    for (const e of reversed) {
      runningBalance += e.type === 'income' ? e.amount : -e.amount;
      balanceMap.set(e.id, Math.round(runningBalance * 100) / 100);
    }
    return entries.map(e => ({ ...e, balance: balanceMap.get(e.id) ?? e.balance }));
  }, [detail?.entries, yearFilter]);

  const filteredTotals = React.useMemo(() => {
    let incomeTotal = 0;
    let expenseTotal = 0;
    for (const e of filteredEntries) {
      if (e.type === 'income') incomeTotal += e.amount;
      else expenseTotal += e.amount;
    }
    return {
      balance: Math.round((incomeTotal - expenseTotal) * 100) / 100,
      incomeTotal: Math.round(incomeTotal * 100) / 100,
      expenseTotal: Math.round(expenseTotal * 100) / 100,
    };
  }, [filteredEntries]);

  const availableYears = Array.from(new Set(
    (detail?.entries ?? []).map(e => new Date(e.entryDate).getFullYear())
  )).sort((a, b) => b - a);

  // ── Dialog ────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditEntry(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (entry: CashBookEntry) => {
    setEditEntry(entry);
    setForm({
      amount: String(entry.amount),
      type: entry.type,
      category: entry.category ?? '',
      description: entry.description,
      entryDate: entry.entryDate,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const bookId = books[activeBookIdx]?.id;
    if (!bookId) return;
    const parsed = parseFloat(form.amount.replace(',', '.'));
    if (!parsed || parsed <= 0) {
      toast.showToast('Bitte einen gültigen Betrag eingeben.', 'error');
      return;
    }
    setSaving(true);
    try {
      const body = { amount: parsed, type: form.type, category: form.category || null, description: form.description, entryDate: form.entryDate };
      if (editEntry) {
        await apiJson(`/api/cash-books/${bookId}/entries/${editEntry.id}`, { method: 'PUT', body });
        toast.showToast('Buchung aktualisiert', 'success');
      } else {
        await apiJson(`/api/cash-books/${bookId}/entries`, { method: 'POST', body });
        toast.showToast('Buchung hinzugefügt', 'success');
      }
      setDialogOpen(false);
      loadDetail(bookId);
      loadBooks();
    } catch (e: any) {
      toast.showToast(getApiErrorMessage(e) || 'Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const bookId = books[activeBookIdx]?.id;
    if (!bookId || !deleteEntry) return;
    try {
      await apiJson(`/api/cash-books/${bookId}/entries/${deleteEntry.id}`, { method: 'DELETE' });
      toast.showToast('Buchung gelöscht', 'success');
      setDeleteEntry(null);
      loadDetail(bookId);
      loadBooks();
    } catch (e: any) {
      toast.showToast(getApiErrorMessage(e) || 'Fehler beim Löschen', 'error');
    }
  };

  // ── Deckel: Zahlung buchen ────────────────────────────────────────────────

  const handlePaymentSave = async () => {
    if (!paymentDialog) return;
    const amount = parseFloat(paymentForm.amount.replace(',', '.'));
    if (!amount || amount <= 0) { toast.showToast('Bitte gültigen Betrag eingeben.', 'error'); return; }
    setPaymentSaving(true);
    try {
      await apiJson('/api/tab/payments', {
        method: 'POST',
        body: {
          userId: paymentDialog.userId,
          amount,
          note: paymentForm.note || undefined,
          paymentDate: paymentForm.paymentDate,
          teamId: paymentDialog.teamId ?? undefined,
          clubId: paymentDialog.clubId ?? undefined,
        },
      });
      toast.showToast('Zahlung gespeichert', 'success');
      setPaymentDialog(null);
      loadDeckel();
    } catch (e: any) {
      toast.showToast(getApiErrorMessage(e) || 'Fehler beim Speichern', 'error');
    } finally {
      setPaymentSaving(false);
    }
  };

  const handlePaymentDelete = async () => {
    if (!paymentDeleteId) return;
    try {
      await apiJson(`/api/tab/payments/${paymentDeleteId}`, { method: 'DELETE' });
      toast.showToast('Zahlung gelöscht', 'success');
      setPaymentDeleteId(null);
      loadDeckel();
    } catch (e: any) {
      toast.showToast(getApiErrorMessage(e) || 'Fehler beim Löschen', 'error');
    }
  };

  // ── Katalog CRUD ──────────────────────────────────────────────────────────

  const openCatalogCreate = () => {
    setCatalogDialog('create');
    setCatalogEditId(null);
    setCatalogForm(emptyCatalogForm());
  };

  const openCatalogEdit = (item: MgmtCatalogItem) => {
    setCatalogDialog('edit');
    setCatalogEditId(item.id);
    setCatalogForm({ name: item.name, price: String(item.price), category: item.category ?? '', active: item.active, teamId: item.team?.id ?? '', clubId: item.club?.id ?? '' });
  };

  const handleCatalogSave = async () => {
    const price = parseFloat(catalogForm.price.replace(',', '.'));
    if (!catalogForm.name.trim()) { toast.showToast('Bitte einen Namen eingeben.', 'error'); return; }
    if (isNaN(price) || price < 0) { toast.showToast('Bitte gültigen Preis eingeben.', 'error'); return; }
    setCatalogSaving(true);
    try {
      const body = {
        name: catalogForm.name.trim(),
        price,
        category: catalogForm.category || undefined,
        active: catalogForm.active,
        teamId: catalogForm.teamId || undefined,
        clubId: catalogForm.clubId || undefined,
      };
      if (catalogDialog === 'create') {
        await apiJson('/api/tab/catalog', { method: 'POST', body });
        toast.showToast('Artikel erstellt', 'success');
      } else {
        await apiJson(`/api/tab/catalog/${catalogEditId}`, { method: 'PUT', body });
        toast.showToast('Artikel aktualisiert', 'success');
      }
      setCatalogDialog(null);
      loadMgmt();
    } catch (e: any) {
      toast.showToast(getApiErrorMessage(e) || 'Fehler beim Speichern', 'error');
    } finally {
      setCatalogSaving(false);
    }
  };

  const handleCatalogDelete = async () => {
    if (!catalogDeleteId) return;
    try {
      await apiJson(`/api/tab/catalog/${catalogDeleteId}`, { method: 'DELETE' });
      toast.showToast('Artikel gelöscht', 'success');
      setCatalogDeleteId(null);
      loadMgmt();
    } catch (e: any) {
      toast.showToast(getApiErrorMessage(e) || 'Fehler beim Löschen', 'error');
    }
  };

  // ── Kassenbuch-Einstellungen ──────────────────────────────────────────────

  const openSettings = () => {
    const book = books[activeBookIdx];
    if (!book) return;
    setSettingsName(book.name);
    setSettingsOpeningBalance(String(book.openingBalance ?? 0));
    setSettingsOpen(true);
  };

  const handleSettingsSave = async () => {
    const book = books[activeBookIdx];
    if (!book) return;
    setSettingsSaving(true);
    try {
      const ob = parseFloat(settingsOpeningBalance.replace(',', '.'));
      await apiJson(`/api/cash-books/${book.id}`, {
        method: 'PUT',
        body: { name: settingsName.trim(), openingBalance: isNaN(ob) ? 0 : ob },
      });
      toast.showToast('Einstellungen gespeichert', 'success');
      setSettingsOpen(false);
      loadBooks();
    } catch (e: any) {
      toast.showToast(getApiErrorMessage(e) || 'Fehler beim Speichern', 'error');
    } finally {
      setSettingsSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const currentBook = books[activeBookIdx];

  const categoryOptions = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <AdminPageLayout
      icon={<AccountBalanceWalletIcon />}
      title="Kassenbuch"
      loading={loadingBooks}
      maxWidth={1200}
      filterControls={
        books.length > 1 ? (
          <Tabs value={activeBookIdx} onChange={(_, v) => setActiveBookIdx(v)} variant="scrollable" scrollButtons="auto">
            {books.map((b, i) => (
              <Tab key={b.id} label={
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  <span>{b.entityName}</span>
                  <Chip label={b.type === 'team' ? 'Team' : 'Verein'} size="small"
                    sx={{ fontSize: '0.65rem', height: 18, bgcolor: b.type === 'team' ? 'primary.100' : 'secondary.100' }} />
                </Stack>
              } />
            ))}
          </Tabs>
        ) : null
      }
    >
      {loadingBooks ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : books.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 3 }}>
          Du hast keinen Zugriff auf ein Kassenbuch. Kassenbücher werden automatisch angelegt, sobald du als Kassenwart eines Teams oder Vereins eingetragen bist.
        </Alert>
      ) : (
        <>
          {/* ── Kennzahlen ── */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
            <Paper variant="outlined" sx={{ flex: 1, p: 2, borderRadius: 3, borderColor: (yearFilter === 'all' ? (detail?.balance ?? 0) : filteredTotals.balance) >= 0 ? 'success.light' : 'error.light' }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <AccountBalanceWalletIcon sx={{ color: (yearFilter === 'all' ? (detail?.balance ?? 0) : filteredTotals.balance) >= 0 ? 'success.main' : 'error.main', fontSize: 32 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {yearFilter === 'all' ? 'Kassenstand' : `Kassenstand ${yearFilter}`}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: (yearFilter === 'all' ? (detail?.balance ?? 0) : filteredTotals.balance) >= 0 ? 'success.main' : 'error.main' }}>
                    {loadingDetail ? '…' : formatEur(yearFilter === 'all' ? (detail?.balance ?? 0) : filteredTotals.balance)}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ flex: 1, p: 2, borderRadius: 3, borderColor: 'success.light' }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <TrendingUpIcon sx={{ color: 'success.main', fontSize: 32 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {yearFilter === 'all' ? 'Einnahmen gesamt' : `Einnahmen ${yearFilter}`}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>
                    {loadingDetail ? '…' : formatEur(yearFilter === 'all' ? (detail?.incomeTotal ?? 0) : filteredTotals.incomeTotal)}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ flex: 1, p: 2, borderRadius: 3, borderColor: 'error.light' }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <TrendingDownIcon sx={{ color: 'error.main', fontSize: 32 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {yearFilter === 'all' ? 'Ausgaben gesamt' : `Ausgaben ${yearFilter}`}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main' }}>
                    {loadingDetail ? '…' : formatEur(yearFilter === 'all' ? (detail?.expenseTotal ?? 0) : filteredTotals.expenseTotal)}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Stack>

          {/* ── Haupt-Tabs ── */}
          <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Buchungen" icon={<AccountBalanceWalletIcon fontSize="small" />} iconPosition="start" />
            <Tab label="Deckel-Übersicht" icon={<LocalBarIcon fontSize="small" />} iconPosition="start" />
            <Tab label="Katalog" icon={<MenuBookIcon fontSize="small" />} iconPosition="start" />
          </Tabs>

          {/* ── Tab: Buchungen ── */}
          {mainTab === 0 && <>

          {/* ── Toolbar ── */}
          <Stack direction="row" spacing={1.5} sx={{ mb: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Jahr</InputLabel>
              <Select label="Jahr" value={yearFilter} onChange={e => setYearFilter(e.target.value as any)}>
                <MenuItem value="all">Alle</MenuItem>
                {availableYears.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
              </Select>
            </FormControl>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="CSV-Export">
              <IconButton onClick={() => { const book = books[activeBookIdx]; if (book) window.location.href = `/api/cash-books/${book.id}/export`; }}><DownloadIcon /></IconButton>
            </Tooltip>
            <Tooltip title="Kassenbuch-Einstellungen">
              <IconButton onClick={openSettings}><SettingsIcon /></IconButton>
            </Tooltip>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Buchung hinzufügen
            </Button>
          </Stack>

          {/* ── Tabelle ── */}
          {loadingDetail ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : filteredEntries.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 3 }}>
              Noch keine Buchungen vorhanden. Füge den ersten Eintrag hinzu.
            </Alert>
          ) : (<>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Datum</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Beschreibung</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Kategorie</TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: 'right', color: 'success.main' }}>Einnahmen</TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: 'right', color: 'error.main' }}>Ausgaben</TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Kontostand</TableCell>
                    <TableCell sx={{ width: 80 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEntries.slice(0, visibleCount).map((entry, i) => (
                    <TableRow key={entry.id} hover
                      sx={{ '&:last-child td': { borderBottom: 0 }, bgcolor: i === 0 ? (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)') : undefined }}>
                      <TableCell>
                        <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                          {new Date(entry.entryDate).toLocaleDateString('de-DE')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{entry.description}</Typography>
                        {entry.createdByUser && (
                          <Typography variant="caption" color="text.disabled">{entry.createdByUser.fullName}</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.category && <Chip label={entry.category} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />}
                      </TableCell>
                      <TableCell align="right">
                        {entry.type === 'income' && (
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>
                            +{formatEur(entry.amount)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {entry.type === 'expense' && (
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main' }}>
                            -{formatEur(entry.amount)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 600, color: entry.balance >= 0 ? 'success.main' : 'error.main' }}>
                          {formatEur(entry.balance)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                          <Tooltip title="Bearbeiten">
                            <IconButton size="small" onClick={() => openEdit(entry)}><EditIcon fontSize="small" /></IconButton>
                          </Tooltip>
                          <Tooltip title="Löschen">
                            <IconButton size="small" color="error" onClick={() => setDeleteEntry(entry)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Summenzeile */}
                  <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'grey.100' }}>
                    <TableCell colSpan={3}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Summe ({filteredEntries.length} Buchungen)
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main' }}>
                        +{formatEur(filteredTotals.incomeTotal)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'error.main' }}>
                        -{formatEur(filteredTotals.expenseTotal)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 700, color: filteredTotals.balance >= 0 ? 'success.main' : 'error.main' }}>
                        {formatEur(filteredTotals.balance)}
                      </Typography>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
            {filteredEntries.length > visibleCount && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Button onClick={() => setVisibleCount(c => c + 50)}>
                  Weitere {Math.min(50, filteredEntries.length - visibleCount)} Buchungen anzeigen
                </Button>
              </Box>
            )}
          </>)}
          </>}

          {/* ── Tab: Deckel-Übersicht ── */}
          {mainTab === 1 && <>
            {loadingDeckel ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
            ) : (deckelData?.length ?? 0) === 0 ? (
              <Alert severity="info" sx={{ borderRadius: 3 }}>Noch keine Deckel-Einträge vorhanden.</Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'grey.50' }}>
                      <TableCell sx={{ fontWeight: 700, width: 32 }} />
                      <TableCell sx={{ fontWeight: 700 }}>Benutzer</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Kontext</TableCell>
                      <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Verbraucht</TableCell>
                      <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Bezahlt</TableCell>
                      <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Saldo</TableCell>
                      <TableCell sx={{ width: 80 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {deckelData?.map(row => {
                      const key = `${row.userId}_${row.teamId}_${row.clubId}`;
                      const isExpanded = expandedUser === key;
                      return (
                        <React.Fragment key={key}>
                          <TableRow hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                            <TableCell>
                              <IconButton size="small" onClick={() => setExpandedUser(isExpanded ? null : key)}>
                                {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                              </IconButton>
                            </TableCell>
                            <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{row.fullName}</Typography></TableCell>
                            <TableCell>
                              {row.entityName && <Chip label={row.entityName} size="small" />}
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ color: 'error.main' }}>{formatEur(row.totalConsumed)}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ color: 'success.main' }}>{formatEur(row.totalPaid)}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontWeight: 700, color: row.saldo >= 0 ? 'success.main' : 'error.main' }}>
                                {formatEur(row.saldo)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Tooltip title="Zahlung buchen">
                                <IconButton size="small" color="success" onClick={() => { setPaymentDialog(row); setPaymentForm(emptyPaymentForm()); }}>
                                  <PaymentIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell colSpan={7} sx={{ p: 0, border: 0 }}>
                              <Collapse in={isExpanded}>
                                <Box sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'grey.50' }}>
                                  <Typography variant="caption" sx={{ fontWeight: 700, mb: 1, display: 'block' }}>Buchungen</Typography>
                                  {row.entries.length === 0 ? (
                                    <Typography variant="caption" color="text.disabled">Keine Buchungen</Typography>
                                  ) : (
                                    <Stack spacing={0.5}>
                                      {row.entries.map(e => (
                                        <Stack key={e.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                          <Typography variant="caption" sx={{ minWidth: 80 }}>{new Date(e.entryDate).toLocaleDateString('de-DE')}</Typography>
                                          <Typography variant="caption">{e.effectiveName}</Typography>
                                          {e.isPenalty && <Chip label={e.penaltyType?.isPositive ? 'Belohnung' : 'Strafe'} size="small" color={e.penaltyType?.isPositive ? 'success' : 'error'} variant="outlined" sx={{ fontSize: '0.55rem', height: 14 }} />}
                                          <Typography variant="caption" color="text.secondary">{e.quantity}×</Typography>
                                          <Typography variant="caption" sx={{ color: (e.priceAtBooking * e.quantity) < 0 ? 'success.main' : 'error.main', ml: 'auto' }}>{(e.priceAtBooking * e.quantity) < 0 ? '+' : '-'}{formatEur(Math.abs(e.priceAtBooking * e.quantity))}</Typography>
                                        </Stack>
                                      ))}
                                    </Stack>
                                  )}
                                  {row.payments.length > 0 && (
                                    <>
                                      <Divider sx={{ my: 1 }} />
                                      <Typography variant="caption" sx={{ fontWeight: 700, mb: 1, display: 'block' }}>Zahlungen</Typography>
                                      <Stack spacing={0.5}>
                                        {row.payments.map(p => (
                                          <Stack key={p.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                            <Typography variant="caption" sx={{ minWidth: 80 }}>{new Date(p.paymentDate).toLocaleDateString('de-DE')}</Typography>
                                            <Typography variant="caption">{p.note ?? 'Zahlung'}</Typography>
                                            <Typography variant="caption" sx={{ color: 'success.main', ml: 'auto' }}>+{formatEur(p.amount)}</Typography>
                                            <Tooltip title="Zahlung löschen">
                                              <IconButton size="small" color="error" onClick={() => setPaymentDeleteId(p.id)}>
                                                <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                                              </IconButton>
                                            </Tooltip>
                                          </Stack>
                                        ))}
                                      </Stack>
                                    </>
                                  )}
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>}

          {/* ── Tab: Katalog ── */}
          {mainTab === 2 && <>
            <Stack direction="row" sx={{ alignItems: 'center', mb: 2 }}>
              <Box sx={{ flex: 1 }} />
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCatalogCreate}>Artikel hinzufügen</Button>
            </Stack>
            {loadingMgmt ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
            ) : (mgmtData?.catalog.length ?? 0) === 0 ? (
              <Alert severity="info" sx={{ borderRadius: 3 }}>Noch keine Artikel im Katalog.</Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'grey.50' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Artikel</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Kategorie</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Team / Verein</TableCell>
                      <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Preis</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      <TableCell sx={{ width: 80 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {mgmtData?.catalog.map(item => (
                      <TableRow key={item.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                        <TableCell><Typography variant="body2">{item.name}</Typography></TableCell>
                        <TableCell>{item.category && <Chip label={item.category} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />}</TableCell>
                        <TableCell>
                          {item.team && <Chip label={item.team.name} size="small" />}
                          {item.club && <Chip label={item.club.name} size="small" />}
                        </TableCell>
                        <TableCell align="right"><Typography variant="body2" sx={{ fontWeight: 600 }}>{formatEur(item.price)}</Typography></TableCell>
                        <TableCell>
                          <Chip label={item.active ? 'Aktiv' : 'Inaktiv'} size="small"
                            color={item.active ? 'success' : 'default'} />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                            <Tooltip title="Bearbeiten">
                              <IconButton size="small" onClick={() => openCatalogEdit(item)}><EditIcon fontSize="small" /></IconButton>
                            </Tooltip>
                            <Tooltip title="Löschen">
                              <IconButton size="small" color="error" onClick={() => setCatalogDeleteId(item.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>}

        </>
      )}

      {/* ── Buchungs-Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editEntry ? 'Buchung bearbeiten' : 'Neue Buchung'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction="row" spacing={1}>
              <Button fullWidth variant={form.type === 'income' ? 'contained' : 'outlined'} color="success"
                onClick={() => setForm(f => ({ ...f, type: 'income', category: '' }))}>
                Einnahme
              </Button>
              <Button fullWidth variant={form.type === 'expense' ? 'contained' : 'outlined'} color="error"
                onClick={() => setForm(f => ({ ...f, type: 'expense', category: '' }))}>
                Ausgabe
              </Button>
            </Stack>
            <Divider />
            <TextField label="Betrag (€)" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              fullWidth slotProps={{ htmlInput: { inputMode: 'decimal' } }} placeholder="0,00" />
            <TextField type="date" label="Datum" value={form.entryDate}
              onChange={e => setForm(f => ({ ...f, entryDate: e.target.value }))}
              fullWidth slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Beschreibung" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              fullWidth multiline rows={2} placeholder="Wofür ist diese Buchung?" />
            <TextField select label="Kategorie (optional)" value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))} fullWidth>
              <MenuItem value="">Keine</MenuItem>
              {categoryOptions.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Abbrechen</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving || !form.amount || !form.description || !form.entryDate}>
            {saving ? <CircularProgress size={18} /> : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Löschen-Dialog (Buchung) ── */}
      <Dialog open={!!deleteEntry} onClose={() => setDeleteEntry(null)} maxWidth="xs">
        <DialogTitle>Buchung löschen?</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{deleteEntry?.description}</strong> ({deleteEntry ? formatEur(deleteEntry.amount) : ''}) wird unwiderruflich gelöscht.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteEntry(null)}>Abbrechen</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Löschen</Button>
        </DialogActions>
      </Dialog>

      {/* ── Zahlung-Dialog ── */}
      <Dialog open={!!paymentDialog} onClose={() => setPaymentDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Zahlung buchen — {paymentDialog?.fullName}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <TextField label="Betrag (€)" value={paymentForm.amount}
                onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                fullWidth slotProps={{ htmlInput: { inputMode: 'decimal' } }} placeholder="0,00" />
              {paymentDialog && paymentDialog.saldo < 0 && (
                <Tooltip title="Offenen Betrag übernehmen">
                  <Button size="small" variant="outlined" sx={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
                    onClick={() => setPaymentForm(f => ({ ...f, amount: String(Math.abs(paymentDialog.saldo)).replace('.', ',') }))}>
                    {formatEur(Math.abs(paymentDialog.saldo))}
                  </Button>
                </Tooltip>
              )}
            </Stack>
            <TextField type="date" label="Datum" value={paymentForm.paymentDate}
              onChange={e => setPaymentForm(f => ({ ...f, paymentDate: e.target.value }))}
              fullWidth slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Notiz (optional)" value={paymentForm.note}
              onChange={e => setPaymentForm(f => ({ ...f, note: e.target.value }))} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialog(null)}>Abbrechen</Button>
          <Button onClick={handlePaymentSave} variant="contained" disabled={paymentSaving || !paymentForm.amount}>
            {paymentSaving ? <CircularProgress size={18} /> : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Zahlung löschen ── */}
      <Dialog open={!!paymentDeleteId} onClose={() => setPaymentDeleteId(null)} maxWidth="xs">
        <DialogTitle>Zahlung löschen?</DialogTitle>
        <DialogContent><Typography>Diese Zahlung wird unwiderruflich gelöscht.</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDeleteId(null)}>Abbrechen</Button>
          <Button onClick={handlePaymentDelete} color="error" variant="contained">Löschen</Button>
        </DialogActions>
      </Dialog>

      {/* ── Katalog-Dialog ── */}
      <Dialog open={!!catalogDialog} onClose={() => setCatalogDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{catalogDialog === 'create' ? 'Artikel hinzufügen' : 'Artikel bearbeiten'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Name" value={catalogForm.name}
              onChange={e => setCatalogForm(f => ({ ...f, name: e.target.value }))} fullWidth required />
            <TextField label="Preis (€)" value={catalogForm.price}
              onChange={e => setCatalogForm(f => ({ ...f, price: e.target.value }))}
              fullWidth slotProps={{ htmlInput: { inputMode: 'decimal' } }} placeholder="0,00" />
            <TextField select label="Kategorie (optional)" value={catalogForm.category}
              onChange={e => setCatalogForm(f => ({ ...f, category: e.target.value }))} fullWidth>
              <MenuItem value="">Keine</MenuItem>
              {TAB_CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            {(mgmtData?.teams.length ?? 0) > 0 && (
              <TextField select label="Team (optional)" value={catalogForm.teamId}
                onChange={e => setCatalogForm(f => ({ ...f, teamId: e.target.value === '' ? '' : Number(e.target.value) }))} fullWidth>
                <MenuItem value="">Kein Team</MenuItem>
                {mgmtData?.teams.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </TextField>
            )}
            {(mgmtData?.clubs.length ?? 0) > 0 && (
              <TextField select label="Verein (optional)" value={catalogForm.clubId}
                onChange={e => setCatalogForm(f => ({ ...f, clubId: e.target.value === '' ? '' : Number(e.target.value) }))} fullWidth>
                <MenuItem value="">Kein Verein</MenuItem>
                {mgmtData?.clubs.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
            )}
            <FormControlLabel
              control={<Switch checked={catalogForm.active} onChange={e => setCatalogForm(f => ({ ...f, active: e.target.checked }))} />}
              label="Aktiv (für Nutzer buchbar)"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCatalogDialog(null)}>Abbrechen</Button>
          <Button onClick={handleCatalogSave} variant="contained" disabled={catalogSaving || !catalogForm.name || !catalogForm.price}>
            {catalogSaving ? <CircularProgress size={18} /> : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Katalog-Artikel löschen ── */}
      <Dialog open={!!catalogDeleteId} onClose={() => setCatalogDeleteId(null)} maxWidth="xs">
        <DialogTitle>Artikel löschen?</DialogTitle>
        <DialogContent><Typography>Dieser Artikel wird gelöscht. Wenn bereits Buchungen existieren, ist dies nicht möglich.</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setCatalogDeleteId(null)}>Abbrechen</Button>
          <Button onClick={handleCatalogDelete} color="error" variant="contained">Löschen</Button>
        </DialogActions>
      </Dialog>

      {/* ── Kassenbuch-Einstellungen Dialog ── */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Kassenbuch-Einstellungen</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Kassenbuch-Name" value={settingsName}
              onChange={e => setSettingsName(e.target.value)} fullWidth />
            <TextField label="Eröffnungssaldo (€)" value={settingsOpeningBalance}
              onChange={e => setSettingsOpeningBalance(e.target.value)}
              fullWidth slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              helperText="Übertrag aus dem Vorjahr oder Anfangsbestand. Kann auch negativ sein." placeholder="0,00" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Abbrechen</Button>
          <Button onClick={handleSettingsSave} variant="contained" disabled={settingsSaving}>
            {settingsSaving ? <CircularProgress size={18} /> : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>
    </AdminPageLayout>
  );
};

export default CashBook;
