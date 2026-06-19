import React, { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Button, Chip, IconButton, Tooltip, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Select, FormControl, InputLabel, Tabs, Tab, Card,
  CardContent, CardActions, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Autocomplete,
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddCircle';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InventoryIcon from '@mui/icons-material/Inventory2';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { apiJson } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import TeamSelect from '../components/TeamSelect';
import type { TeamMenuItem } from '../utils/teamMenuEntries';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamOrClub extends TeamMenuItem {
  assigned?: boolean;
}

interface InventoryItemData {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  totalQuantity: number;
  checkedOutQuantity: number;
  availableQuantity: number;
  unit: string;
  condition: string | null;
  notes: string | null;
  teamId: number | null;
  teamName: string | null;
  clubId: number | null;
  clubName: string | null;
  createdAt: string;
  updatedAt: string | null;
  activeCheckouts: CheckoutData[];
}

interface CheckoutData {
  id: number;
  itemId: number | null;
  itemName: string | null;
  itemUnit: string | null;
  userId: number | null;
  borrowerName: string;
  quantity: number;
  checkedOutAt: string;
  dueDate: string | null;
  returnedAt: string | null;
  isReturned: boolean;
  note: string | null;
  checkedOutByUserId: number | null;
}


const UNITS = ['Stück', 'Paar', 'Set', 'Satz'];
const CONDITIONS = ['', 'gut', 'mittel', 'schlecht'];
const CATEGORIES = [
  'Bälle', 'Trikots', 'Torwart-Ausrüstung', 'Trainingsequipment',
  'Medizin', 'Büro', 'Elektronik', 'Sonstiges',
];

const conditionColor = (c: string | null) => {
  if (c === 'gut') return 'success';
  if (c === 'mittel') return 'warning';
  if (c === 'schlecht') return 'error';
  return 'default';
};

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('de-DE') : '–';

const fmtDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–';

// ── Item form dialog ──────────────────────────────────────────────────────────

interface ItemFormData {
  name: string;
  category: string;
  totalQuantity: number;
  unit: string;
  condition: string;
  description: string;
  notes: string;
}

const defaultItemForm = (): ItemFormData => ({
  name: '', category: '', totalQuantity: 1, unit: 'Stück',
  condition: '', description: '', notes: '',
});

interface ItemDialogProps {
  open: boolean;
  editItem: InventoryItemData | null;
  selectedTeamId: number | '';
  selectedClubId: number | '';
  onClose: () => void;
  onSaved: (item: InventoryItemData) => void;
}

const ItemDialog: React.FC<ItemDialogProps> = ({ open, editItem, selectedTeamId, selectedClubId, onClose, onSaved }) => {
  const [form, setForm] = useState<ItemFormData>(defaultItemForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (editItem) {
        setForm({
          name: editItem.name,
          category: editItem.category ?? '',
          totalQuantity: editItem.totalQuantity,
          unit: editItem.unit,
          condition: editItem.condition ?? '',
          description: editItem.description ?? '',
          notes: editItem.notes ?? '',
        });
      } else {
        setForm(defaultItemForm());
      }
      setError('');
    }
  }, [open, editItem]);

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name ist erforderlich'); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        totalQuantity: Number(form.totalQuantity),
        description: form.description || null,
        category: form.category || null,
        condition: form.condition || null,
        notes: form.notes || null,
      };
      if (!editItem) {
        if (selectedTeamId) payload.teamId = selectedTeamId;
        else if (selectedClubId) payload.clubId = selectedClubId;
      }
      let data: { item: InventoryItemData };
      if (editItem) {
        data = await apiJson<{ item: InventoryItemData }>(`/api/inventory/${editItem.id}`, {
          method: 'PUT', body: payload,
        });
      } else {
        data = await apiJson<{ item: InventoryItemData }>('/api/inventory', {
          method: 'POST', body: payload,
        });
      }
      onSaved(data.item);
    } catch {
      setError('Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      slotProps={{ paper: { component: 'form', onSubmit: (e: React.FormEvent) => { e.preventDefault(); void handleSave(); } } }}
    >
      <DialogTitle>{editItem ? 'Artikel bearbeiten' : 'Neuer Artikel'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
        <TextField
          autoFocus label="Name" fullWidth required
          value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          slotProps={{ htmlInput: { maxLength: 100 } }}
        />
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Autocomplete
            freeSolo options={CATEGORIES} value={form.category}
            onInputChange={(_, v) => setForm(p => ({ ...p, category: v }))}
            sx={{ flex: 1 }}
            renderInput={params => <TextField {...params} label="Kategorie" />}
          />
          <FormControl sx={{ width: 130 }}>
            <InputLabel>Zustand</InputLabel>
            <Select label="Zustand" value={form.condition}
              onChange={e => setForm(p => ({ ...p, condition: e.target.value }))}
            >
              {CONDITIONS.map(c => <MenuItem key={c} value={c}>{c || '–'}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Gesamtmenge" type="number" sx={{ flex: 1 }}
            slotProps={{ htmlInput: { min: 0 } }}
            value={form.totalQuantity}
            onChange={e => setForm(p => ({ ...p, totalQuantity: parseInt(e.target.value) || 0 }))}
          />
          <FormControl sx={{ width: 130 }}>
            <InputLabel>Einheit</InputLabel>
            <Select label="Einheit" value={form.unit}
              onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
            >
              {UNITS.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        <TextField
          label="Beschreibung" multiline rows={2} fullWidth
          value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          slotProps={{ htmlInput: { maxLength: 500 } }}
        />
        <TextField
          label="Notizen" multiline rows={2} fullWidth
          value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
          slotProps={{ htmlInput: { maxLength: 500 } }}
        />
        {error && <Typography color="error" variant="caption">{error}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">Abbrechen</Button>
        <Button type="submit" variant="contained" disabled={saving}>
          {saving ? <CircularProgress size={18} /> : 'Speichern'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── Checkout dialog ────────────────────────────────────────────────────────────

interface CheckoutDialogProps {
  open: boolean;
  item: InventoryItemData | null;
  onClose: () => void;
  onCheckedOut: (checkout: CheckoutData, updatedItem: InventoryItemData) => void;
}

const CheckoutDialog: React.FC<CheckoutDialogProps> = ({ open, item, onClose, onCheckedOut }) => {
  const [borrowerName, setBorrowerName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setBorrowerName(''); setQuantity(1); setDueDate(''); setNote(''); setError('');
    }
  }, [open]);

  const available = item?.availableQuantity ?? 0;

  const handleCheckout = async () => {
    if (!item) return;
    if (!borrowerName.trim()) { setError('Name des Entleihers angeben'); return; }
    if (quantity < 1 || quantity > available) { setError(`Menge muss zwischen 1 und ${available} liegen`); return; }
    setSaving(true);
    try {
      const data = await apiJson<{ checkout: CheckoutData }>(`/api/inventory/${item.id}/checkout`, {
        method: 'POST',
        body: { borrowerName: borrowerName.trim(), quantity, dueDate: dueDate || null, note: note.trim() || null },
      });
      const qs = item.teamId ? `?teamId=${item.teamId}` : item.clubId ? `?clubId=${item.clubId}` : '';
      const refreshed = await apiJson<{ items: InventoryItemData[] }>(`/api/inventory${qs}`);
      const updatedItem = refreshed.items.find(i => i.id === item.id) ?? item;
      onCheckedOut(data.checkout, updatedItem);
    } catch {
      setError('Ausleihe fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      slotProps={{ paper: { component: 'form', onSubmit: (e: React.FormEvent) => { e.preventDefault(); void handleCheckout(); } } }}
    >
      <DialogTitle>Ausleihe – {item?.name}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
        <Typography variant="body2" color="text.secondary">
          Verfügbar: <strong>{available} {item?.unit}</strong>
        </Typography>
        <TextField
          autoFocus label="Entleiher (Name)" fullWidth required
          value={borrowerName} onChange={e => setBorrowerName(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 100 } }}
        />
        <TextField
          label="Menge" type="number" fullWidth
          slotProps={{ htmlInput: { min: 1, max: available } }}
          value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)}
        />
        <TextField
          label="Rückgabedatum (optional)" type="date" fullWidth
          value={dueDate} onChange={e => setDueDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="Notiz" multiline rows={2} fullWidth
          value={note} onChange={e => setNote(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 300 } }}
        />
        {error && <Typography color="error" variant="caption">{error}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">Abbrechen</Button>
        <Button type="submit" variant="contained" disabled={saving || available < 1}>
          {saving ? <CircularProgress size={18} /> : 'Ausleihen'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── Item card ─────────────────────────────────────────────────────────────────

interface ItemCardProps {
  item: InventoryItemData;
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCheckout: () => void;
  onReturn: (checkoutId: number) => void;
}

const ItemCard: React.FC<ItemCardProps> = ({ item, canWrite, onEdit, onDelete, onCheckout, onReturn }) => {
  const availPct = item.totalQuantity > 0 ? (item.availableQuantity / item.totalQuantity) * 100 : 100;
  const isOverdue = item.activeCheckouts.some(c => c.dueDate && new Date(c.dueDate) < new Date());

  return (
    <Card sx={{
      width: { xs: '100%', sm: 320 },
      display: 'flex', flexDirection: 'column',
      borderRadius: 2, boxShadow: 2,
      transition: 'box-shadow 0.2s',
      '&:hover': { boxShadow: 5 },
    }}>
      <CardContent sx={{ flex: 1, pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.25, flex: 1, mr: 1 }}>
            {item.name}
          </Typography>
          {isOverdue && (
            <Tooltip title="Überfällige Rückgabe">
              <WarningAmberIcon color="warning" fontSize="small" />
            </Tooltip>
          )}
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
          {item.category && <Chip label={item.category} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />}
          {item.condition && (
            <Chip label={item.condition} size="small" color={conditionColor(item.condition) as 'success' | 'warning' | 'error' | 'default'} sx={{ fontSize: '0.7rem' }} />
          )}
          {(item.teamName || item.clubName) && (
            <Chip label={item.teamName ?? item.clubName} size="small" variant="outlined" sx={{ fontSize: '0.7rem', color: 'text.secondary' }} />
          )}
        </Box>

        {/* Quantity bar */}
        <Box sx={{ mb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
            <Typography variant="caption" color="text.secondary">
              {item.availableQuantity} / {item.totalQuantity} {item.unit} verfügbar
            </Typography>
            {item.checkedOutQuantity > 0 && (
              <Typography variant="caption" color="warning.main">
                {item.checkedOutQuantity} ausgeliehen
              </Typography>
            )}
          </Box>
          <Box sx={{ height: 6, bgcolor: 'action.hover', borderRadius: 3, overflow: 'hidden' }}>
            <Box sx={{
              height: '100%', borderRadius: 3,
              width: `${availPct}%`,
              bgcolor: availPct > 50 ? 'success.main' : availPct > 20 ? 'warning.main' : 'error.main',
              transition: 'width 0.3s',
            }} />
          </Box>
        </Box>

        {item.description && (
          <Typography variant="caption" color="text.secondary" sx={{
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {item.description}
          </Typography>
        )}

        {/* Active checkouts */}
        {item.activeCheckouts.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>Aktive Ausleihen:</Typography>
            {item.activeCheckouts.map(c => (
              <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.25 }}>
                <Typography variant="caption" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.borrowerName} · {c.quantity} {item.unit}
                  {c.dueDate && (
                    <span style={{ color: new Date(c.dueDate) < new Date() ? '#d32f2f' : undefined }}>
                      {' '}(bis {fmtDate(c.dueDate)})
                    </span>
                  )}
                </Typography>
                {canWrite && (
                  <Tooltip title="Zurückgegeben">
                    <IconButton size="small" color="success" onClick={() => onReturn(c.id)} sx={{ ml: 0.5 }}>
                      <CheckCircleIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
      <CardActions sx={{ pt: 0, pb: 0.75, px: 1, gap: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>
        {canWrite && (
          <Tooltip title="Ausleihen">
            <span>
              <IconButton size="small" color="primary" onClick={onCheckout} disabled={item.availableQuantity < 1}
                sx={{ flex: 1, borderRadius: 1.5, '&:hover': { bgcolor: 'primary.main', color: 'white' } }}>
                <ShoppingBagIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
        {canWrite && (
          <Tooltip title="Bearbeiten">
            <IconButton size="small" color="primary" onClick={onEdit}
              sx={{ flex: 1, borderRadius: 1.5, '&:hover': { bgcolor: 'primary.main', color: 'white' } }}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {canWrite && (
          <Tooltip title="Löschen">
            <IconButton size="small" color="error" onClick={onDelete}
              sx={{ flex: 1, borderRadius: 1.5, '&:hover': { bgcolor: 'error.main', color: 'white' } }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </CardActions>
    </Card>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

const Inventar: React.FC = () => {
  const { isSuperAdmin, isAdmin } = useAuth();

  const [items, setItems] = useState<InventoryItemData[]>([]);
  const [activeCheckouts, setActiveCheckouts] = useState<CheckoutData[]>([]);
  const [teams, setTeams] = useState<TeamOrClub[]>([]);
  const [clubs, setClubs] = useState<TeamOrClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  // canWrite comes from the backend; admins always have write access regardless
  const [canWrite, setCanWrite] = useState(false);
  const effectiveCanWrite = canWrite || isAdmin;
  const [activeTab, setActiveTab] = useState<0 | 1>(0);

  // Team / Club filter
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>('');
  const [selectedClubId, setSelectedClubId] = useState<number | ''>('');

  // Dialogs
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItemData | null>(null);
  const [checkoutDialogItem, setCheckoutDialogItem] = useState<InventoryItemData | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<InventoryItemData | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const loadItems = async (teamId: number | '' = selectedTeamId, clubId: number | '' = selectedClubId) => {
    setLoading(true);
    setApiError(false);
    try {
      const params = teamId ? `?teamId=${teamId}` : clubId ? `?clubId=${clubId}` : '';
      const data = await apiJson<{ items: InventoryItemData[]; canWrite: boolean }>(`/api/inventory${params}`);
      setItems(data.items ?? []);
      setCanWrite(data.canWrite ?? false);
    } catch {
      setItems([]);
      setApiError(true);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveCheckouts = async () => {
    try {
      const data = await apiJson<{ checkouts: CheckoutData[] }>('/api/inventory/checkouts/active');
      setActiveCheckouts(data.checkouts ?? []);
    } catch {
      setActiveCheckouts([]);
    }
  };

  useEffect(() => {
    apiJson<{ teams: TeamOrClub[]; clubs: TeamOrClub[] }>('/api/inventory/teams-and-clubs')
      .then(data => {
        const ts = data.teams ?? [];
        const cs = data.clubs ?? [];
        setTeams(ts);
        setClubs(cs);
        // Auto-select: pick first directly-assigned team, otherwise first team overall
        if (ts.length === 1) {
          setSelectedTeamId(ts[0].id);
          void loadItems(ts[0].id, '');
        } else if (ts.length > 1) {
          const firstAssigned = ts.find(t => t.assigned);
          const defaultTeam = firstAssigned ?? ts[0];
          setSelectedTeamId(defaultTeam.id);
          void loadItems(defaultTeam.id, '');
        } else if (cs.length > 0) {
          setSelectedClubId(cs[0].id);
          void loadItems('', cs[0].id);
        } else {
          void loadItems('', '');
        }
      })
      .catch(() => { void loadItems('', ''); });
    void loadActiveCheckouts();
  }, []);

  const handleTeamChange = (teamId: number) => {
    const id = teamId || '';
    setSelectedTeamId(id);
    setSelectedClubId('');
    void loadItems(id, '');
  };

  const handleClubChange = (clubId: number | '') => {
    setSelectedClubId(clubId);
    setSelectedTeamId('');
    void loadItems('', clubId);
  };

  const handleItemSaved = (item: InventoryItemData) => {
    setItemDialogOpen(false);
    setEditItem(null);
    setItems(prev => {
      const exists = prev.some(i => i.id === item.id);
      return exists ? prev.map(i => i.id === item.id ? item : i) : [item, ...prev];
    });
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleteSaving(true);
    try {
      await apiJson(`/api/inventory/${deleteConfirm.id}`, { method: 'DELETE' });
      setItems(prev => prev.filter(i => i.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch {
      // TODO toast
    } finally {
      setDeleteSaving(false);
    }
  };

  const handleReturn = async (checkoutId: number) => {
    try {
      await apiJson(`/api/inventory/checkout/${checkoutId}/return`, { method: 'POST' });
      await loadItems(selectedTeamId, selectedClubId);
      await loadActiveCheckouts();
    } catch {
      // TODO toast
    }
  };

  const handleCheckedOut = (checkout: CheckoutData, updatedItem: InventoryItemData) => {
    setCheckoutDialogItem(null);
    setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
    setActiveCheckouts(prev => [checkout, ...prev]);
  };

  // Group items by category
  const groupedItems = useMemo(() => {
    const map = new Map<string, InventoryItemData[]>();
    for (const item of items) {
      const key = item.category ?? 'Sonstiges';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'de'));
  }, [items]);

  const showTeamDropdown = teams.length > 1 || (isSuperAdmin && teams.length > 0);
  const showClubDropdown = clubs.length > 1 || (clubs.length === 1 && teams.length > 0);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Inventar</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {activeTab === 0
            ? `${items.length} Artikel${items.length !== 1 ? '' : ''}`
            : `${activeCheckouts.length} aktive Ausleihe${activeCheckouts.length !== 1 ? 'n' : ''}`}
        </Typography>
      </Box>

      {/* Sticky toolbar */}
      <Box sx={{
        position: 'sticky', top: 'var(--app-header-height)', zIndex: 10,
        bgcolor: 'background.default', pt: 1.5, pb: 1.5, mb: 3,
        mx: { xs: -3, sm: -3 }, px: { xs: 3, sm: 3 },
        borderBottom: '1px solid', borderColor: 'divider',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
        flexWrap: 'wrap',
      }}>
        <Box sx={{ display: 'flex', gap: 1.5, flex: 1, flexWrap: 'wrap' }}>
          {showTeamDropdown && (
            <TeamSelect
              teams={teams}
              value={selectedTeamId}
              onChange={handleTeamChange}
              label="Team"
              size="small"
              minWidth={220}
              allTeamsOption={isSuperAdmin ? { value: '', label: 'Alle Teams' } : undefined}
            />
          )}
          {showClubDropdown && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Verein</InputLabel>
              <Select
                label="Verein"
                value={selectedClubId}
                onChange={e => handleClubChange(e.target.value as number | '')}
              >
                {teams.length > 0 && <MenuItem value="">– Alle Vereine –</MenuItem>}
                {clubs.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
          )}
        </Box>
        {effectiveCanWrite && activeTab === 0 && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditItem(null); setItemDialogOpen(true); }}>
            Neuer Artikel
          </Button>
        )}
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v as 0 | 1)}>
          <Tab label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Artikel
              {items.length > 0 && <Chip label={items.length} size="small" sx={{ height: 18, fontSize: '0.7rem' }} />}
            </Box>
          } />
          <Tab label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AssignmentReturnIcon sx={{ fontSize: 16 }} />
              Ausgeliehen
              {activeCheckouts.length > 0 && (
                <Chip label={activeCheckouts.length} size="small" color="warning" sx={{ height: 18, fontSize: '0.7rem' }} />
              )}
            </Box>
          } />
        </Tabs>
      </Box>

      {/* Tab 0: Artikel */}
      {activeTab === 0 && (
        <>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
              <CircularProgress />
            </Box>
          ) : apiError ? (
            <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <WarningAmberIcon sx={{ fontSize: 72, opacity: 0.4, color: 'warning.main' }} />
              <Typography variant="h6" color="text.secondary">Inventar konnte nicht geladen werden</Typography>
              <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', maxWidth: 440 }}>
                Stelle sicher, dass die Datenbank-Migration ausgeführt wurde:
              </Typography>
              <Paper variant="outlined" sx={{ px: 2, py: 1, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.8rem', bgcolor: 'action.hover' }}>
                php bin/console doctrine:migrations:migrate
              </Paper>
              {effectiveCanWrite && (
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditItem(null); setItemDialogOpen(true); }}>
                  Trotzdem Artikel anlegen
                </Button>
              )}
            </Box>
          ) : items.length === 0 ? (
            <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: 'text.secondary' }}>
              <InventoryIcon sx={{ fontSize: 72, opacity: 0.25 }} />
              <Typography variant="h6" color="text.secondary">Noch keine Artikel vorhanden</Typography>
              <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', maxWidth: 400 }}>
                Klicke auf „Neuer Artikel" um einen Ausrüstungsgegenstand zu erfassen.
              </Typography>
              {effectiveCanWrite && (
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditItem(null); setItemDialogOpen(true); }}>
                  Ersten Artikel anlegen
                </Button>
              )}
            </Box>
          ) : (
            <>
              {groupedItems.map(([category, catItems]) => (
                <Box key={category} sx={{ mb: 4 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{category}</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {catItems.map(item => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        canWrite={effectiveCanWrite}
                        onEdit={() => { setEditItem(item); setItemDialogOpen(true); }}
                        onDelete={() => setDeleteConfirm(item)}
                        onCheckout={() => setCheckoutDialogItem(item)}
                        onReturn={handleReturn}
                      />
                    ))}
                  </Box>
                  <Divider sx={{ mt: 3 }} />
                </Box>
              ))}
            </>
          )}
        </>
      )}

      {/* Tab 1: Ausleihungen */}
      {activeTab === 1 && (
        <>
          {activeCheckouts.length === 0 ? (
            <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: 'text.secondary' }}>
              <AssignmentReturnIcon sx={{ fontSize: 72, opacity: 0.25 }} />
              <Typography variant="h6" color="text.secondary">Keine aktiven Ausleihen</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Artikel</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Entleiher</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">Menge</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Ausgeliehen am</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Rückgabe bis</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Notiz</TableCell>
                    {effectiveCanWrite && <TableCell align="center" sx={{ fontWeight: 700 }}>Aktion</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activeCheckouts.map(c => {
                    const overdue = c.dueDate && new Date(c.dueDate) < new Date();
                    return (
                      <TableRow key={c.id} sx={{ bgcolor: overdue ? 'error.50' : undefined }}>
                        <TableCell>{c.itemName ?? '–'}</TableCell>
                        <TableCell>{c.borrowerName}</TableCell>
                        <TableCell align="center">{c.quantity} {c.itemUnit ?? ''}</TableCell>
                        <TableCell>{fmtDateTime(c.checkedOutAt)}</TableCell>
                        <TableCell sx={{ color: overdue ? 'error.main' : undefined }}>
                          {c.dueDate ? fmtDate(c.dueDate) : '–'}
                          {overdue && <WarningAmberIcon sx={{ fontSize: 14, ml: 0.5, verticalAlign: 'middle' }} color="error" />}
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.note ?? '–'}
                        </TableCell>
                        {effectiveCanWrite && (
                          <TableCell align="center">
                            <Tooltip title="Als zurückgegeben markieren">
                              <IconButton size="small" color="success" onClick={() => handleReturn(c.id)}>
                                <CheckCircleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {/* Dialogs */}
      <ItemDialog
        open={itemDialogOpen}
        editItem={editItem}
        selectedTeamId={selectedTeamId}
        selectedClubId={selectedClubId}
        onClose={() => { setItemDialogOpen(false); setEditItem(null); }}
        onSaved={handleItemSaved}
      />

      <CheckoutDialog
        open={Boolean(checkoutDialogItem)}
        item={checkoutDialogItem}
        onClose={() => setCheckoutDialogItem(null)}
        onCheckedOut={handleCheckedOut}
      />

      {/* Delete confirmation */}
      <Dialog open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)} maxWidth="xs">
        <DialogTitle>Artikel löschen?</DialogTitle>
        <DialogContent>
          <Typography>
            Soll <strong>{deleteConfirm?.name}</strong> endgültig gelöscht werden?
            Alle zugehörigen Ausleihdaten werden ebenfalls gelöscht.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Abbrechen</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={deleteSaving}>
            {deleteSaving ? <CircularProgress size={18} /> : 'Löschen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Inventar;
