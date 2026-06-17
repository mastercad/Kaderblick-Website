import { useCallback, useEffect, useState, useMemo } from 'react';
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
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import GavelIcon from '@mui/icons-material/Gavel';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlined';
import { AdminPageLayout } from '../../components/AdminPageLayout';
import { apiJson, getApiErrorMessage } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import AssignPenaltyDialog from '../../components/AssignPenaltyDialog';

interface PenaltyType {
  id: number;
  name: string;
  description: string | null;
  amount: number;
  isPositive: boolean;
  active: boolean;
  validFrom: string | null;
  validUntil: string | null;
  isGlobal: boolean;
  teamId: number | null;
  teamName: string | null;
  clubId: number | null;
  clubName: string | null;
}

interface ScopeOption {
  id: number;
  name: string;
}

const formatEur = (v: number) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const emptyForm = {
  name: '',
  description: '',
  amount: '',
  isPositive: false,
  active: true,
  validFrom: '',
  validUntil: '',
  scopeType: 'global' as 'global' | 'team' | 'club',
  scopeId: '' as number | '',
};

export default function Strafenkatalog() {
  const theme = useTheme();
  const toast = useToast();
  const [mainTab, setMainTab] = useState(0);
  const [catalog, setCatalog] = useState<PenaltyType[]>([]);
  const [teams, setTeams] = useState<ScopeOption[]>([]);
  const [clubs, setClubs] = useState<ScopeOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<PenaltyType | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [assignOpen, setAssignOpen] = useState(false);

  interface PenaltyHistoryEntry {
    id: number;
    userName: string;
    userId: number;
    penaltyName: string;
    isPositive: boolean;
    amount: number;
    entryDate: string;
    note: string | null;
    teamName: string | null;
    createdBy: string | null;
    createdAt: string;
  }

  const [history, setHistory] = useState<PenaltyHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const data: any = await apiJson('/api/penalty/history');
      setHistory(data.entries ?? []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const data: any = await apiJson('/api/penalty/catalog');
      setCatalog(data.catalog ?? []);
      setTeams(data.teams ?? []);
      setClubs(data.clubs ?? []);
    } catch (e: any) {
      toast.showToast(getApiErrorMessage(e), 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);
  useEffect(() => { if (mainTab === 1) loadHistory(); }, [mainTab, loadHistory]);

  const openCreate = () => {
    setEditItem(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: PenaltyType) => {
    setEditItem(item);
    setForm({
      name: item.name,
      description: item.description ?? '',
      amount: String(item.amount),
      isPositive: item.isPositive,
      active: item.active,
      validFrom: item.validFrom ?? '',
      validUntil: item.validUntil ?? '',
      scopeType: item.teamId ? 'team' : item.clubId ? 'club' : 'global',
      scopeId: item.teamId ?? item.clubId ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const amount = parseFloat(form.amount);
    if (!form.name.trim() || isNaN(amount) || amount <= 0) {
      toast.showToast('Name und Betrag (> 0) sind erforderlich.', 'error');
      return;
    }
    setSaving(true);
    try {
      const body: any = {
        name: form.name.trim(),
        description: form.description || null,
        amount,
        isPositive: form.isPositive,
        active: form.active,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
      };
      if (form.scopeType === 'team' && form.scopeId) body.teamId = form.scopeId;
      if (form.scopeType === 'club' && form.scopeId) body.clubId = form.scopeId;

      if (editItem) {
        await apiJson(`/api/penalty/catalog/${editItem.id}`, { method: 'PUT', body });
        toast.showToast('Strafentyp aktualisiert.', 'success');
      } else {
        await apiJson('/api/penalty/catalog', { method: 'POST', body });
        toast.showToast('Strafentyp erstellt.', 'success');
      }
      setDialogOpen(false);
      loadCatalog();
    } catch (e: any) {
      toast.showToast(getApiErrorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiJson(`/api/penalty/catalog/${deleteId}`, { method: 'DELETE' });
      toast.showToast('Strafentyp gelöscht.', 'success');
      setDeleteId(null);
      loadCatalog();
    } catch (e: any) {
      toast.showToast(getApiErrorMessage(e), 'error');
      setDeleteId(null);
    }
  };

  const handleToggleActive = async (item: PenaltyType) => {
    try {
      await apiJson(`/api/penalty/catalog/${item.id}`, { method: 'PUT', body: { active: !item.active } });
      loadCatalog();
    } catch (e: any) {
      toast.showToast(getApiErrorMessage(e), 'error');
    }
  };

  const fines = useMemo(() => catalog.filter(c => !c.isPositive), [catalog]);
  const rewards = useMemo(() => catalog.filter(c => c.isPositive), [catalog]);

  return (
    <AdminPageLayout title="Strafenkatalog" icon={<GavelIcon />} loading={loading}>
      <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Katalog" icon={<GavelIcon fontSize="small" />} iconPosition="start" />
        <Tab label="Strafe vergeben" icon={<AddCircleOutlineIcon fontSize="small" />} iconPosition="start" />
      </Tabs>

      {/* ── Tab: Katalog ── */}
      {mainTab === 0 && <>
        <Stack direction="row" spacing={1.5} sx={{ mb: 2, alignItems: 'center' }}>
          <Typography variant="subtitle2" color="text.secondary">
            {fines.length} Strafen · {rewards.length} Belohnungen
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Neuer Typ
          </Button>
        </Stack>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : catalog.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 3 }}>Noch keine Strafentypen vorhanden.</Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'grey.50' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Betrag</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Typ</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Gültigkeit</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Bereich</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Aktiv</TableCell>
                  <TableCell sx={{ width: 80 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {catalog.map(item => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.name}</Typography>
                      {item.description && (
                        <Typography variant="caption" color="text.secondary">{item.description}</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600, color: item.isPositive ? 'success.main' : 'error.main' }}>
                        {item.isPositive ? '+' : '-'}{formatEur(item.amount)} €
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.isPositive ? 'Belohnung' : 'Strafe'}
                        size="small"
                        color={item.isPositive ? 'success' : 'error'}
                        variant="outlined"
                        icon={item.isPositive ? <AddCircleOutlineIcon /> : <RemoveCircleOutlineIcon />}
                      />
                    </TableCell>
                    <TableCell>
                      {item.validFrom || item.validUntil ? (
                        <Typography variant="caption">
                          {item.validFrom ?? '…'} – {item.validUntil ?? '…'}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary">Unbegrenzt</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.isGlobal ? (
                        <Chip label="Global" size="small" variant="outlined" />
                      ) : item.teamName ? (
                        <Chip label={item.teamName} size="small" color="primary" variant="outlined" />
                      ) : item.clubName ? (
                        <Chip label={item.clubName} size="small" color="secondary" variant="outlined" />
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Switch size="small" checked={item.active} onChange={() => handleToggleActive(item)} />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Bearbeiten">
                          <IconButton size="small" onClick={() => openEdit(item)}><EditIcon fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="Löschen">
                          <IconButton size="small" color="error" onClick={() => setDeleteId(item.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
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

      {/* ── Tab: Strafe vergeben ── */}
      {mainTab === 1 && <>
        <Stack direction="row" spacing={1.5} sx={{ mb: 2, alignItems: 'center' }}>
          <Typography variant="subtitle2" color="text.secondary">
            Vergebene Strafen &amp; Belohnungen
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" startIcon={<GavelIcon />} onClick={() => setAssignOpen(true)}>
            Strafe / Belohnung vergeben
          </Button>
        </Stack>

        {loadingHistory ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : history.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 3 }}>Noch keine Strafen oder Belohnungen vergeben.</Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'grey.50' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Datum</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Spieler</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Team</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Strafe / Belohnung</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Betrag</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Vergeben von</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Notiz</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map(h => (
                  <TableRow key={h.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                        {new Date(h.entryDate).toLocaleDateString('de-DE')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{h.userName}</Typography>
                    </TableCell>
                    <TableCell>
                      {h.teamName && <Chip label={h.teamName} size="small" variant="outlined" />}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                        <Typography variant="body2">{h.penaltyName}</Typography>
                        <Chip
                          label={h.isPositive ? 'Belohnung' : 'Strafe'}
                          size="small"
                          color={h.isPositive ? 'success' : 'error'}
                          variant="outlined"
                          sx={{ fontSize: '0.6rem', height: 18 }}
                        />
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600, color: h.isPositive ? 'success.main' : 'error.main' }}>
                        {h.isPositive ? '+' : '-'}{formatEur(Math.abs(h.amount))} €
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">{h.createdBy ?? '–'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">{h.note ?? '–'}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </>}

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editItem ? 'Strafentyp bearbeiten' : 'Neuer Strafentyp'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <TextField label="Name" size="small" fullWidth required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <TextField label="Beschreibung" size="small" fullWidth value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <TextField label="Betrag (€)" size="small" type="number" fullWidth required slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Typ</Typography>
            <ToggleButtonGroup
              exclusive
              value={form.isPositive ? 'reward' : 'fine'}
              onChange={(_, v) => { if (v) setForm(f => ({ ...f, isPositive: v === 'reward' })); }}
              size="small"
              fullWidth
            >
              <ToggleButton value="fine" sx={{ color: 'error.main' }}>
                <RemoveCircleOutlineIcon sx={{ mr: 0.5 }} fontSize="small" /> Strafe
              </ToggleButton>
              <ToggleButton value="reward" sx={{ color: 'success.main' }}>
                <AddCircleOutlineIcon sx={{ mr: 0.5 }} fontSize="small" /> Belohnung
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Stack direction="row" spacing={2}>
            <TextField label="Gültig ab" type="date" size="small" fullWidth slotProps={{ inputLabel: { shrink: true } }} value={form.validFrom} onChange={e => setForm(f => ({ ...f, validFrom: e.target.value }))} />
            <TextField label="Gültig bis" type="date" size="small" fullWidth slotProps={{ inputLabel: { shrink: true } }} value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} />
          </Stack>

          <FormControl fullWidth size="small">
            <InputLabel>Geltungsbereich</InputLabel>
            <Select label="Geltungsbereich" value={form.scopeType} onChange={e => setForm(f => ({ ...f, scopeType: e.target.value as any, scopeId: '' }))}>
              <MenuItem value="global">Global</MenuItem>
              <MenuItem value="team">Team</MenuItem>
              <MenuItem value="club">Verein</MenuItem>
            </Select>
          </FormControl>

          {form.scopeType === 'team' && (
            <FormControl fullWidth size="small">
              <InputLabel>Team</InputLabel>
              <Select label="Team" value={form.scopeId} onChange={e => setForm(f => ({ ...f, scopeId: e.target.value as number }))}>
                {teams.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </Select>
            </FormControl>
          )}

          {form.scopeType === 'club' && (
            <FormControl fullWidth size="small">
              <InputLabel>Verein</InputLabel>
              <Select label="Verein" value={form.scopeId} onChange={e => setForm(f => ({ ...f, scopeId: e.target.value as number }))}>
                {clubs.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
          )}

          <FormControlLabel
            control={<Switch checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />}
            label="Aktiv"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Abbrechen</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : editItem ? 'Speichern' : 'Erstellen'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <Dialog open={deleteId !== null} onClose={() => setDeleteId(null)} maxWidth="xs">
        <DialogTitle>Strafentyp löschen?</DialogTitle>
        <DialogContent>
          <Typography>Dieser Strafentyp wird unwiderruflich gelöscht. Einträge, die diesen Typ verwenden, behalten ihren Namen.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Abbrechen</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Löschen</Button>
        </DialogActions>
      </Dialog>

      {/* ── Assign Dialog ── */}
      <AssignPenaltyDialog open={assignOpen} onClose={() => setAssignOpen(false)} onSuccess={() => { toast.showToast('Strafe/Belohnung wurde vergeben und auf den Deckel gebucht.', 'success'); loadHistory(); }} />
    </AdminPageLayout>
  );
}
