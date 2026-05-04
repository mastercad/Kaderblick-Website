import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Select,
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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import StyleIcon from '@mui/icons-material/Style';
import { apiJson, getApiErrorMessage } from '../../utils/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface CardRule {
  id: number;
  competitionType: string;
  competitionId: number | null;
  personType: string;
  yellowWarningThreshold: number;
  yellowSuspensionThreshold: number;
  suspensionGames: number;
  redCardSuspensionGames: number;
  yellowRedCardSuspensionGames: number;
  resetAfterSuspension: boolean;
  validFrom: string | null;
  validUntil: string | null;
}

type RuleForm = Omit<CardRule, 'id'>;

// ── Konfiguration ─────────────────────────────────────────────────────────────

const COMPETITION_TYPES = [
  { value: 'league',     label: 'Liga' },
  { value: 'cup',        label: 'Pokal' },
  { value: 'tournament', label: 'Turnier' },
  { value: 'friendly',   label: 'Freundschaftsspiel' },
];

const PERSON_TYPES = [
  { value: 'all',    label: 'Alle (Spieler & Trainer)' },
  { value: 'player', label: 'Nur Spieler' },
  { value: 'coach',  label: 'Nur Trainer' },
];

const TYPE_COLORS: Record<string, { color: string; bgcolor: string }> = {
  league:     { color: '#1565c0', bgcolor: '#e3f2fd' },
  cup:        { color: '#6a1b9a', bgcolor: '#f3e5f5' },
  tournament: { color: '#e65100', bgcolor: '#fff3e0' },
  friendly:   { color: '#2e7d32', bgcolor: '#e8f5e9' },
};

const PERSON_COLORS: Record<string, { color: string; bgcolor: string }> = {
  player: { color: '#1565c0', bgcolor: '#e3f2fd' },
  coach:  { color: '#bf360c', bgcolor: '#fbe9e7' },
  all:    { color: '#4a148c', bgcolor: '#f3e5f5' },
};

function typeLabel(type: string): string {
  return COMPETITION_TYPES.find(t => t.value === type)?.label ?? type;
}

function personLabel(type: string): string {
  return PERSON_TYPES.find(t => t.value === type)?.label ?? type;
}

function personLabelShort(type: string): string {
  return type === 'player' ? 'Spieler' : type === 'coach' ? 'Trainer' : 'Alle';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '–';
  try {
    return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

const todayDate = new Date();
todayDate.setHours(0, 0, 0, 0);

/** Regel ist gerade in Kraft: validFrom vergangen/null UND validUntil zukünftig/null */
function isCurrentlyActive(rule: CardRule): boolean {
  if (rule.validFrom && new Date(rule.validFrom) > todayDate) return false;
  if (rule.validUntil && new Date(rule.validUntil) < todayDate) return false;
  return true;
}

/** Regel tritt erst noch in Kraft: validFrom in der Zukunft */
function isFuture(rule: CardRule): boolean {
  if (!rule.validFrom) return false;
  return new Date(rule.validFrom) > todayDate;
}

/** Regel ist abgelaufen: validUntil in der Vergangenheit */
function isHistoric(rule: CardRule): boolean {
  if (!rule.validUntil) return false;
  return new Date(rule.validUntil) < todayDate;
}

const EMPTY_FORM: RuleForm = {
  competitionType: 'league',
  competitionId: null,
  personType: 'all',
  yellowWarningThreshold: 4,
  yellowSuspensionThreshold: 5,
  suspensionGames: 1,
  redCardSuspensionGames: 1,
  yellowRedCardSuspensionGames: 1,
  resetAfterSuspension: true,
  validFrom: null,
  validUntil: null,
};

// ── Dialog ────────────────────────────────────────────────────────────────────

interface RuleDialogProps {
  open: boolean;
  initial: RuleForm;
  title: string;
  onClose: () => void;
  onSave: (form: RuleForm) => Promise<void>;
}

function RuleDialog({ open, initial, title, onClose, onSave }: RuleDialogProps) {
  const [form, setForm] = useState<RuleForm>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setForm(initial); setError(null); }
  }, [open, initial]);

  const set = (field: keyof RuleForm, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const thresholdError =
    form.yellowWarningThreshold > form.yellowSuspensionThreshold && form.yellowSuspensionThreshold > 0
      ? 'Warnschwelle darf nicht größer sein als Sperrschwelle'
      : null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
        {error && <Alert severity="error">{error}</Alert>}

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom>Wettbewerbstyp *</Typography>
            <Select value={form.competitionType} onChange={e => set('competitionType', e.target.value)}
              size="small" fullWidth>
              {COMPETITION_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </Select>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom>Gilt für *</Typography>
            <Select value={form.personType} onChange={e => set('personType', e.target.value)}
              size="small" fullWidth>
              {PERSON_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </Select>
          </Box>
        </Box>

        <TextField
          label="Wettbewerbs-ID (leer = alle dieses Typs)"
          type="number" size="small"
          value={form.competitionId ?? ''}
          onChange={e => set('competitionId', e.target.value === '' ? null : Number(e.target.value))}
          helperText="Leer = generische Regel für alle Ligen/Pokale/… dieses Typs"
        />

        <Divider><Typography variant="caption">Gelbe Karten</Typography></Divider>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
          <TextField
            label="Warnung ab (Gelb)" type="number" size="small" inputProps={{ min: 0, max: 99 }}
            value={form.yellowWarningThreshold}
            onChange={e => set('yellowWarningThreshold', Number(e.target.value))}
          />
          <TextField
            label="Sperre ab (Gelb)" type="number" size="small" inputProps={{ min: 0, max: 99 }}
            value={form.yellowSuspensionThreshold}
            onChange={e => set('yellowSuspensionThreshold', Number(e.target.value))}
          />
          <TextField
            label="Spiele gesperrt" type="number" size="small" inputProps={{ min: 1, max: 99 }}
            value={form.suspensionGames}
            onChange={e => set('suspensionGames', Number(e.target.value))}
          />
        </Box>

        {thresholdError && <Alert severity="warning">{thresholdError}</Alert>}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Switch checked={form.resetAfterSuspension}
            onChange={e => set('resetAfterSuspension', e.target.checked)} />
          <Typography variant="body2">Gelb-Zähler nach Sperre zurücksetzen</Typography>
        </Box>

        <Divider><Typography variant="caption">Rote Karten</Typography></Divider>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <TextField
            label="Spiele gesperrt – Rote Karte 🟥"
            type="number" size="small" inputProps={{ min: 0, max: 99 }}
            value={form.redCardSuspensionGames}
            onChange={e => set('redCardSuspensionGames', Number(e.target.value))}
          />
          <TextField
            label="Spiele gesperrt – Gelb-Rot 🟨🟥"
            type="number" size="small" inputProps={{ min: 0, max: 99 }}
            value={form.yellowRedCardSuspensionGames}
            onChange={e => set('yellowRedCardSuspensionGames', Number(e.target.value))}
          />
        </Box>

        <Divider><Typography variant="caption">Gültigkeitszeitraum</Typography></Divider>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <TextField
            label="Gültig ab" type="date" size="small" InputLabelProps={{ shrink: true }}
            value={form.validFrom ?? ''}
            onChange={e => set('validFrom', e.target.value || null)}
          />
          <TextField
            label="Gültig bis" type="date" size="small" InputLabelProps={{ shrink: true }}
            value={form.validUntil ?? ''}
            onChange={e => set('validUntil', e.target.value || null)}
          />
        </Box>
        <Typography variant="caption" color="text.secondary">
          Leer = kein Start- bzw. Enddatum. Regeln mit abgelaufenem Enddatum erscheinen automatisch
          im Tab „Historische Regeln".
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Abbrechen</Button>
        <Button variant="contained" onClick={handleSave}
          disabled={saving || !!thresholdError}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}>
          Speichern
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Tabelle ───────────────────────────────────────────────────────────────────

interface RuleTableProps {
  rules: CardRule[];
  onEdit: (rule: CardRule) => void;
  onDelete: (rule: CardRule) => void;
}

function RuleTable({ rules, onEdit, onDelete }: RuleTableProps) {
  if (rules.length === 0) {
    return (
      <Box sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>
        <Typography>Keine Einträge vorhanden.</Typography>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Wettbewerb</TableCell>
            <TableCell>ID</TableCell>
            <TableCell>Gilt für</TableCell>
            <TableCell align="center">⚠️ Gelb</TableCell>
            <TableCell align="center">🟨 Sperre ab</TableCell>
            <TableCell align="center">Spiele (Gelb)</TableCell>
            <TableCell align="center">🟥 Spiele</TableCell>
            <TableCell align="center">🟨🟥 Spiele</TableCell>
            <TableCell align="center">Reset</TableCell>
            <TableCell>Gültig ab</TableCell>
            <TableCell>Gültig bis</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {rules.map(rule => {
            const tc = TYPE_COLORS[rule.competitionType] ?? { color: '#333', bgcolor: '#f5f5f5' };
            const pc = PERSON_COLORS[rule.personType] ?? { color: '#333', bgcolor: '#f5f5f5' };
            return (
              <TableRow key={rule.id} hover>
                <TableCell>
                  <Chip label={typeLabel(rule.competitionType)} size="small"
                    sx={{ color: tc.color, bgcolor: tc.bgcolor, fontWeight: 600 }} />
                </TableCell>
                <TableCell>
                  {rule.competitionId !== null
                    ? <Typography variant="body2">#{rule.competitionId}</Typography>
                    : <Typography variant="body2" color="text.secondary" fontStyle="italic">alle</Typography>}
                </TableCell>
                <TableCell>
                  <Chip label={personLabelShort(rule.personType)} size="small"
                    sx={{ color: pc.color, bgcolor: pc.bgcolor }} />
                </TableCell>
                <TableCell align="center">
                  {rule.yellowWarningThreshold > 0 ? `${rule.yellowWarningThreshold}.` : '–'}
                </TableCell>
                <TableCell align="center">
                  {rule.yellowSuspensionThreshold > 0 ? `${rule.yellowSuspensionThreshold}.` : '–'}
                </TableCell>
                <TableCell align="center">{rule.suspensionGames}</TableCell>
                <TableCell align="center">{rule.redCardSuspensionGames}</TableCell>
                <TableCell align="center">{rule.yellowRedCardSuspensionGames}</TableCell>
                <TableCell align="center">
                  <Tooltip title={rule.resetAfterSuspension ? 'Zähler wird zurückgesetzt' : 'Zähler läuft weiter'}>
                    <span>{rule.resetAfterSuspension ? '✓' : '✗'}</span>
                  </Tooltip>
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(rule.validFrom)}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(rule.validUntil)}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Tooltip title="Bearbeiten">
                    <IconButton size="small" onClick={() => onEdit(rule)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Löschen">
                    <IconButton size="small" color="error" onClick={() => onDelete(rule)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ── Hauptseite ────────────────────────────────────────────────────────────────

export default function CardRules() {
  const [rules, setRules] = useState<CardRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CardRule | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CardRule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<CardRule[]>('/api/admin/card-rules');
      setRules(data);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const currentRules  = useMemo(() => rules.filter(isCurrentlyActive), [rules]);
  const futureRules   = useMemo(() => rules.filter(isFuture),          [rules]);
  const historicRules = useMemo(() => rules.filter(isHistoric),        [rules]);

  const handleCreate = async (form: RuleForm) => {
    await apiJson('/api/admin/card-rules', { method: 'POST', body: form });
    await load();
  };

  const handleUpdate = async (form: RuleForm) => {
    if (!editingRule) return;
    await apiJson(`/api/admin/card-rules/${editingRule.id}`, { method: 'PATCH', body: form });
    await load();
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await apiJson(`/api/admin/card-rules/${deleteConfirm.id}`, { method: 'DELETE' });
      setDeleteConfirm(null);
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  const openCreate = () => { setEditingRule(null); setDialogOpen(true); };
  const openEdit = (rule: CardRule) => { setEditingRule(rule); setDialogOpen(true); };

  const initialForm: RuleForm = editingRule
    ? {
        competitionType: editingRule.competitionType,
        competitionId: editingRule.competitionId,
        personType: editingRule.personType,
        yellowWarningThreshold: editingRule.yellowWarningThreshold,
        yellowSuspensionThreshold: editingRule.yellowSuspensionThreshold,
        suspensionGames: editingRule.suspensionGames,
        redCardSuspensionGames: editingRule.redCardSuspensionGames,
        yellowRedCardSuspensionGames: editingRule.yellowRedCardSuspensionGames,
        resetAfterSuspension: editingRule.resetAfterSuspension,
        validFrom: editingRule.validFrom,
        validUntil: editingRule.validUntil,
      }
    : EMPTY_FORM;

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, md: 3 }, py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <StyleIcon color="primary" />
          <Typography variant="h5" fontWeight={600}>Karten-Sperr-Regeln</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Neue Regel
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Legt fest, ab wie vielen Gelben Karten ein Spieler oder Trainer verwarnt/gesperrt wird,
        sowie wie viele Spiele bei Roter oder Gelb-Roter Karte gesperrt werden — je Wettbewerbstyp.
        Abgelaufene Regeln sind im Tab „Historisch" archiviert.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper variant="outlined">
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={`Aktuelle Regeln (${currentRules.length})`} />
          <Tab label={`Zukünftige Regeln (${futureRules.length})`} />
          <Tab label={`Historische Regeln (${historicRules.length})`} />
        </Tabs>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : tab === 0 ? (
          <RuleTable rules={currentRules} onEdit={openEdit} onDelete={r => setDeleteConfirm(r)} />
        ) : tab === 1 ? (
          <>
            <Box sx={{ px: 2, py: 1.5, bgcolor: 'info.50', borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                Diese Regeln treten erst in Kraft, wenn ihr „Gültig ab"-Datum erreicht ist.
                Sie überschreiben dann die aktuellen Regeln für denselben Wettbewerbstyp.
              </Typography>
            </Box>
            <RuleTable rules={futureRules} onEdit={openEdit} onDelete={r => setDeleteConfirm(r)} />
          </>
        ) : (
          <>
            <Box sx={{ px: 2, py: 1.5, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                Abgelaufene Regelversionen (Gültig-bis in der Vergangenheit). Zur Nachvollziehbarkeit
                archiviert — können bearbeitet oder reaktiviert werden.
              </Typography>
            </Box>
            <RuleTable rules={historicRules} onEdit={openEdit} onDelete={r => setDeleteConfirm(r)} />
          </>
        )}
      </Paper>

      <RuleDialog
        open={dialogOpen}
        initial={initialForm}
        title={editingRule ? 'Regel bearbeiten' : 'Neue Regel anlegen'}
        onClose={() => setDialogOpen(false)}
        onSave={editingRule ? handleUpdate : handleCreate}
      />

      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Regel löschen?</DialogTitle>
        <DialogContent>
          <Typography>
            Die Regel für <strong>{typeLabel(deleteConfirm?.competitionType ?? '')}</strong>
            {deleteConfirm?.competitionId !== null && deleteConfirm?.competitionId !== undefined
              ? ` (ID ${deleteConfirm.competitionId})`
              : ' (alle Wettbewerbe)'}
            {' '}({personLabel(deleteConfirm?.personType ?? 'all')}) wird unwiderruflich gelöscht.
          </Typography>
          {deleteConfirm && isHistoric(deleteConfirm) && (
            <Alert severity="info" sx={{ mt: 1 }}>
              Dies ist eine historische Regel — sie ist bereits inaktiv.
            </Alert>
          )}
          {deleteConfirm && isFuture(deleteConfirm) && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              Diese Regel ist noch nicht in Kraft getreten (Gültig ab: {formatDate(deleteConfirm.validFrom)}).
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)} disabled={deleting}>Abbrechen</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : undefined}>
            Löschen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
