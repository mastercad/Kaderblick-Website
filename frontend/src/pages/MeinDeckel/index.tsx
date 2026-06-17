import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { AdminPageLayout } from '../../components/AdminPageLayout';
import { apiJson, getApiErrorMessage } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

interface CatalogItem {
  id: number;
  name: string;
  price: number;
  category: string | null;
  team: { id: number; name: string } | null;
  club: { id: number; name: string } | null;
}

interface TabEntry {
  id: number;
  catalogItem: {
    name: string;
    price: number;
    category: string | null;
    team: { id: number; name: string } | null;
    club: { id: number; name: string } | null;
  } | null;
  customName: string | null;
  customPrice: number | null;
  effectiveName: string;
  quantity: number;
  priceAtBooking: number;
  entryDate: string;
  note: string | null;
  penaltyType: { id: number; name: string; isPositive: boolean } | null;
  isPenalty: boolean;
}

interface MyEntriesResponse {
  entries: TabEntry[];
  totalConsumed: number;
  totalPaid: number;
  saldo: number;
}

type BookMode = 'catalog' | 'free';

interface BookForm {
  mode: BookMode;
  catalogItemId: number | '';
  customName: string;
  customPrice: string;
  quantity: string;
  note: string;
  entryDate: string;
  contextType: 'team' | 'club' | '';
  contextId: number | '';
}

const today = () => new Date().toISOString().split('T')[0];
const emptyForm = (): BookForm => ({
  mode: 'catalog',
  catalogItemId: '',
  customName: '',
  customPrice: '',
  quantity: '1',
  note: '',
  entryDate: today(),
  contextType: '',
  contextId: '',
});

function formatEur(val: number): string {
  return val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function contextLabel(item: CatalogItem | NonNullable<TabEntry['catalogItem']>): string {
  if (item.team) return item.team.name;
  if (item.club) return item.club.name;
  return '';
}

const MeinDeckel: React.FC = () => {
  const theme = useTheme();
  const toast = useToast();

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [myData, setMyData] = useState<MyEntriesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<BookForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [editEntry, setEditEntry] = useState<TabEntry | null>(null);
  const [editForm, setEditForm] = useState({ quantity: '1', note: '', entryDate: today() });
  const [editSaving, setEditSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiJson('/api/tab/catalog'),
      apiJson('/api/tab/my-entries'),
    ])
      .then(([cat, mine]: any) => {
        setCatalog(Array.isArray(cat) ? cat : []);
        setMyData(mine);
      })
      .catch((e: any) => toast.showToast(getApiErrorMessage(e) || 'Fehler beim Laden', 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleBook = async () => {
    if (form.mode === 'catalog' && !form.catalogItemId) {
      toast.showToast('Bitte einen Artikel auswählen.', 'error');
      return;
    }
    if (form.mode === 'free') {
      if (!form.customName.trim()) {
        toast.showToast('Bitte eine Bezeichnung eingeben.', 'error');
        return;
      }
      const price = parseFloat(form.customPrice.replace(',', '.'));
      if (isNaN(price) || price < 0) {
        toast.showToast('Bitte einen gültigen Betrag eingeben.', 'error');
        return;
      }
    }
    const qty = parseInt(form.quantity, 10);
    if (!qty || qty < 1) {
      toast.showToast('Bitte eine gültige Menge eingeben.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        quantity: qty,
        note: form.note || undefined,
        entryDate: form.entryDate,
      };
      if (form.mode === 'catalog') {
        payload.catalogItemId = form.catalogItemId;
      } else {
        payload.customName = form.customName.trim();
        payload.customPrice = parseFloat(form.customPrice.replace(',', '.'));
        if (form.contextType === 'team' && form.contextId) {
          payload.teamId = form.contextId;
        } else if (form.contextType === 'club' && form.contextId) {
          payload.clubId = form.contextId;
        }
      }
      await apiJson('/api/tab/book', { method: 'POST', body: payload });
      toast.showToast('Buchung erfolgreich', 'success');
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast.showToast(getApiErrorMessage(e) || 'Fehler beim Buchen', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiJson(`/api/tab/entries/${deleteId}`, { method: 'DELETE' });
      toast.showToast('Buchung gelöscht', 'success');
      setDeleteId(null);
      load();
    } catch (e: any) {
      toast.showToast(getApiErrorMessage(e) || 'Fehler beim Löschen', 'error');
    }
  };

  const openEdit = (entry: TabEntry) => {
    setEditEntry(entry);
    setEditForm({ quantity: String(entry.quantity), note: entry.note ?? '', entryDate: entry.entryDate });
  };

  const handleEditSave = async () => {
    if (!editEntry) return;
    const qty = parseInt(editForm.quantity, 10);
    if (!qty || qty < 1) { toast.showToast('Bitte gültige Menge eingeben.', 'error'); return; }
    setEditSaving(true);
    try {
      await apiJson(`/api/tab/entries/${editEntry.id}`, { method: 'PUT', body: { quantity: qty, note: editForm.note || null, entryDate: editForm.entryDate } });
      toast.showToast('Buchung aktualisiert', 'success');
      setEditEntry(null);
      load();
    } catch (e: any) {
      toast.showToast(getApiErrorMessage(e) || 'Fehler beim Speichern', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const openDialog = (preselect?: CatalogItem) => {
    if (preselect) {
      setForm({ ...emptyForm(), mode: 'catalog', catalogItemId: preselect.id });
    } else {
      setForm(emptyForm());
    }
    setDialogOpen(true);
  };

  const selectedItem = catalog.find(c => c.id === form.catalogItemId);
  const freePrice = parseFloat(form.customPrice.replace(',', '.'));
  const freeTotal = !isNaN(freePrice) && freePrice >= 0 ? freePrice * (parseInt(form.quantity, 10) || 1) : null;
  const saldo = myData?.saldo ?? 0;

  const availableContexts = React.useMemo(() => {
    const contexts: Array<{ type: 'team' | 'club'; id: number; name: string }> = [];
    const seen = new Set<string>();
    for (const item of catalog) {
      if (item.team && !seen.has(`team_${item.team.id}`)) {
        seen.add(`team_${item.team.id}`);
        contexts.push({ type: 'team', id: item.team.id, name: item.team.name });
      }
      if (item.club && !seen.has(`club_${item.club.id}`)) {
        seen.add(`club_${item.club.id}`);
        contexts.push({ type: 'club', id: item.club.id, name: item.club.name });
      }
    }
    return contexts;
  }, [catalog]);

  return (
    <AdminPageLayout
      icon={<LocalBarIcon />}
      title="Mein Deckel"
      loading={loading}
      maxWidth={1000}
    >
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <>
          {/* ── Saldo-Karten ── */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
            <Paper variant="outlined" sx={{ flex: 1, p: 2, borderRadius: 3, borderColor: saldo >= 0 ? 'success.light' : 'error.light' }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <AccountBalanceWalletIcon sx={{ color: saldo >= 0 ? 'success.main' : 'error.main', fontSize: 32 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">Mein Saldo</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: saldo >= 0 ? 'success.main' : 'error.main' }}>
                    {formatEur(saldo)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {saldo < 0 ? 'Du schuldest dem Kassenwart Geld' : saldo === 0 ? 'Alles beglichen' : 'Guthaben vorhanden'}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ flex: 1, p: 2, borderRadius: 3, borderColor: 'error.light' }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <TrendingDownIcon sx={{ color: 'error.main', fontSize: 32 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">Verbraucht</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main' }}>
                    {formatEur(myData?.totalConsumed ?? 0)}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ flex: 1, p: 2, borderRadius: 3, borderColor: 'success.light' }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <TrendingUpIcon sx={{ color: 'success.main', fontSize: 32 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">Bezahlt</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>
                    {formatEur(myData?.totalPaid ?? 0)}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Stack>

          {/* ── Katalog ── */}
          <Stack direction="row" sx={{ alignItems: 'center', mb: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>
              {catalog.length > 0 ? 'Verfügbare Artikel' : 'Buchungen'}
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => openDialog()}>
              Auf Deckel buchen
            </Button>
          </Stack>

          {catalog.length > 0 && (
            <>
              <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
                {catalog.map(item => (
                  <Paper key={item.id} variant="outlined"
                    sx={{ p: 1.5, borderRadius: 2, minWidth: 140, cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }}
                    onClick={() => openDialog(item)}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.category ?? ''}</Typography>
                    <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 700, mt: 0.5 }}>{formatEur(item.price)}</Typography>
                    {contextLabel(item) && (
                      <Chip label={contextLabel(item)} size="small" sx={{ mt: 0.5, fontSize: '0.65rem', height: 18 }} />
                    )}
                  </Paper>
                ))}
              </Box>
              <Divider sx={{ mb: 3 }} />
            </>
          )}

          {/* ── Meine Buchungen ── */}
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>Meine Buchungen</Typography>
          {(myData?.entries.length ?? 0) === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 3 }}>Noch keine Buchungen vorhanden.</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Datum</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Artikel</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Menge</TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Betrag</TableCell>
                    <TableCell sx={{ width: 80 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {myData?.entries.map(entry => (
                    <TableRow key={entry.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell>
                        <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                          {new Date(entry.entryDate).toLocaleDateString('de-DE')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                          <Typography variant="body2">{entry.effectiveName}</Typography>
                          {entry.isPenalty && (
                            <Chip label={entry.penaltyType?.isPositive ? 'Belohnung' : 'Strafe'} size="small"
                              color={entry.penaltyType?.isPositive ? 'success' : 'error'} variant="outlined"
                              sx={{ fontSize: '0.6rem', height: 16 }} />
                          )}
                          {!entry.catalogItem && !entry.isPenalty && (
                            <Chip label="Freitext" size="small" variant="outlined"
                              sx={{ fontSize: '0.6rem', height: 16, color: 'text.disabled', borderColor: 'divider' }} />
                          )}
                        </Stack>
                        {entry.note && <Typography variant="caption" color="text.disabled">{entry.note}</Typography>}
                        {entry.catalogItem && (
                          <Stack direction="row" spacing={0.5} sx={{ mt: 0.25 }}>
                            {entry.catalogItem.category && (
                              <Chip label={entry.catalogItem.category} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 18 }} />
                            )}
                            {contextLabel(entry.catalogItem) && (
                              <Chip label={contextLabel(entry.catalogItem)} size="small" sx={{ fontSize: '0.65rem', height: 18 }} />
                            )}
                          </Stack>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{entry.quantity}×</Typography>
                      </TableCell>
                      <TableCell align="right">
                        {(() => {
                          const lineTotal = entry.priceAtBooking * entry.quantity;
                          const isCredit = lineTotal < 0;
                          return (
                            <Typography variant="body2" sx={{ fontWeight: 600, color: isCredit ? 'success.main' : 'error.main' }}>
                              {isCredit ? '+' : '-'}{formatEur(Math.abs(lineTotal))}
                            </Typography>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Bearbeiten">
                            <IconButton size="small" onClick={() => openEdit(entry)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Löschen">
                            <IconButton size="small" color="error" onClick={() => setDeleteId(entry.id)}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {/* ── Buch-Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Auf Deckel buchen</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {/* Mode-Umschalter */}
            <ToggleButtonGroup
              value={form.mode}
              exclusive
              onChange={(_, v) => { if (v) setForm(f => ({ ...f, mode: v as BookMode, catalogItemId: '', customName: '', customPrice: '' })); }}
              size="small"
              fullWidth
            >
              <ToggleButton value="catalog" disabled={catalog.length === 0}>
                Aus Katalog
              </ToggleButton>
              <ToggleButton value="free">
                Freie Buchung
              </ToggleButton>
            </ToggleButtonGroup>

            {form.mode === 'catalog' ? (
              <>
                {catalog.length === 0 ? (
                  <Alert severity="info">Noch keine Katalog-Artikel vorhanden.</Alert>
                ) : (
                  <TextField select label="Artikel" value={form.catalogItemId}
                    onChange={e => setForm(f => ({ ...f, catalogItemId: Number(e.target.value) }))} fullWidth required>
                    {catalog.map(item => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.name} — {formatEur(item.price)}{contextLabel(item) ? ` (${contextLabel(item)})` : ''}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              </>
            ) : (
              <>
                <TextField label="Bezeichnung" value={form.customName}
                  onChange={e => setForm(f => ({ ...f, customName: e.target.value }))}
                  fullWidth required placeholder="z. B. Bier, Strafe, Sonstiges" />
                <TextField label="Betrag (€)" value={form.customPrice}
                  onChange={e => setForm(f => ({ ...f, customPrice: e.target.value }))}
                  fullWidth placeholder="0,00"
                  slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
                {availableContexts.length > 0 && (
                  <TextField select label="Kontext (Team / Verein)"
                    value={form.contextType && form.contextId ? `${form.contextType}_${form.contextId}` : ''}
                    onChange={e => {
                      const val = e.target.value;
                      if (!val) { setForm(f => ({ ...f, contextType: '', contextId: '' })); return; }
                      const [type, id] = val.split('_');
                      setForm(f => ({ ...f, contextType: type as 'team' | 'club', contextId: Number(id) }));
                    }} fullWidth>
                    <MenuItem value="">Kein Kontext</MenuItem>
                    {availableContexts.map(c => (
                      <MenuItem key={`${c.type}_${c.id}`} value={`${c.type}_${c.id}`}>{c.name}</MenuItem>
                    ))}
                  </TextField>
                )}
              </>
            )}

            <TextField type="number" label="Menge" value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              fullWidth slotProps={{ htmlInput: { min: 1, step: 1 } }} />
            <TextField type="date" label="Datum" value={form.entryDate}
              onChange={e => setForm(f => ({ ...f, entryDate: e.target.value }))}
              fullWidth slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Notiz (optional)" value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))} fullWidth />

            {form.mode === 'catalog' && selectedItem && (
              <Alert severity="info">
                Gesamtbetrag: <strong>{formatEur(selectedItem.price * (parseInt(form.quantity, 10) || 1))}</strong>
              </Alert>
            )}
            {form.mode === 'free' && freeTotal !== null && (
              <Alert severity="info">
                Gesamtbetrag: <strong>{formatEur(freeTotal)}</strong>
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Abbrechen</Button>
          <Button onClick={handleBook} variant="contained"
            disabled={saving || (form.mode === 'catalog' && !form.catalogItemId)}>
            {saving ? <CircularProgress size={18} /> : 'Buchen'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Löschen-Dialog ── */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="xs">
        <DialogTitle>Buchung löschen?</DialogTitle>
        <DialogContent>
          <Typography>Diese Buchung wird unwiderruflich gelöscht.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Abbrechen</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Löschen</Button>
        </DialogActions>
      </Dialog>

      {/* ── Bearbeiten-Dialog ── */}
      <Dialog open={!!editEntry} onClose={() => setEditEntry(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Buchung bearbeiten — {editEntry?.effectiveName}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField type="number" label="Menge" value={editForm.quantity}
              onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))}
              fullWidth slotProps={{ htmlInput: { min: 1, step: 1 } }} />
            <TextField type="date" label="Datum" value={editForm.entryDate}
              onChange={e => setEditForm(f => ({ ...f, entryDate: e.target.value }))}
              fullWidth slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Notiz (optional)" value={editForm.note}
              onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditEntry(null)}>Abbrechen</Button>
          <Button onClick={handleEditSave} variant="contained" disabled={editSaving}>
            {editSaving ? <CircularProgress size={18} /> : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>
    </AdminPageLayout>
  );
};

export default MeinDeckel;
