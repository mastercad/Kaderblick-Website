import React, { useEffect, useRef, useState } from "react";
import { apiBlob } from '../utils/api';
import { apiJson } from '../utils/api';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Snackbar,
  Switch,
  TextField,
  FormControlLabel,
  useTheme,
  useMediaQuery,
  Stack,
  Chip,
  Tooltip,
  Avatar,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import GroupsIcon from '@mui/icons-material/Groups';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CloseIcon from '@mui/icons-material/Close';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import SearchIcon from '@mui/icons-material/Search';
import EmptyStateHint from '../components/EmptyStateHint';

interface Player {
  id: number;
  name: string;
  shorts_size: string | null;
  shirt_size: string | null;
  shoe_size: string | null;
  socks_size: string | null;
  jacket_size: string | null;
}

interface Coach {
  id: number;
  name: string;
  shorts_size: string | null;
  shirt_size: string | null;
  shoe_size: string | null;
  socks_size: string | null;
  jacket_size: string | null;
}

interface Supporter {
  id: number;
  name: string;
  shorts_size: string | null;
  shirt_size: string | null;
  shoe_size: string | null;
  socks_size: string | null;
  jacket_size: string | null;
}

type Candidate = (Player & { role: 'player' }) | (Coach & { role: 'coach' }) | (Supporter & { role: 'supporter' });

type OrderItemKey = 'shirt_size' | 'shorts_size' | 'jacket_size' | 'socks_size' | 'shoe_size';
type OrderSelection = Record<string, OrderItemKey[]>;

const ORDER_ITEMS: Array<{ key: OrderItemKey; label: string; shortLabel: string }> = [
  { key: 'shirt_size', label: 'Trikot', shortLabel: 'Trikots' },
  { key: 'shorts_size', label: 'Hose', shortLabel: 'Hosen' },
  { key: 'jacket_size', label: 'Trainingsjacke', shortLabel: 'Jacken' },
  { key: 'socks_size', label: 'Stutzen', shortLabel: 'Stutzen' },
  { key: 'shoe_size', label: 'Schuhe', shortLabel: 'Schuhe' },
];

const memberKey = (member: Candidate) => `${member.role}:${member.id}`;
const hasSize = (member: Candidate, key: OrderItemKey) => Boolean(member[key] && member[key] !== '0');

interface Team {
  team_id: number;
  team_name: string;
  players: Player[];
  coaches: Coach[];
  supporters: Supporter[];
}

interface SizeSummary {
  [size: string]: number;
}

const aggregateTeamSizes = (members: Array<Player | Coach | Supporter>, key: keyof Player): SizeSummary =>
  members.reduce((acc: SizeSummary, p) => {
    const val = p[key];
    if (val && val !== '0') acc[val as string] = (acc[val as string] || 0) + 1;
    return acc;
  }, {});

const getMissingFields = (p: Player | Coach | Supporter): string[] => {
  const missing: string[] = [];
  if (!p.shorts_size || p.shorts_size === '0') missing.push('Hose');
  if (!p.shirt_size  || p.shirt_size  === '0') missing.push('Trikot');
  if (!p.shoe_size   || p.shoe_size   === '0') missing.push('Schuhgröße');
  if (!p.socks_size  || p.socks_size  === '0') missing.push('Stutzen');
  if (!p.jacket_size || p.jacket_size === '0') missing.push('Trainingsjacke');
  return missing;
};

/** Sortiert Größen: XS/S/M/L/XL/XXL-aware, numerisch, sonst alphabetisch */
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const sortSizes = (entries: [string, number][]): [string, number][] =>
  [...entries].sort(([a], [b]) => {
    const ai = SIZE_ORDER.indexOf(a.toUpperCase());
    const bi = SIZE_ORDER.indexOf(b.toUpperCase());
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    const na = parseFloat(a);
    const nb = parseFloat(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

// Farbpalette für Größen-Chips
const SIZE_CHIP_COLORS: Record<string, { bg: string; color: string }> = {
  XS:   { bg: '#e8f5e9', color: '#2e7d32' },
  S:    { bg: '#e3f2fd', color: '#1565c0' },
  M:    { bg: '#fff8e1', color: '#f57f17' },
  L:    { bg: '#fce4ec', color: '#c62828' },
  XL:   { bg: '#f3e5f5', color: '#6a1b9a' },
  XXL:  { bg: '#e0f2f1', color: '#00695c' },
  XXXL: { bg: '#efebe9', color: '#4e342e' },
};
const getChipStyle = (size: string, isDark: boolean) => {
  const preset = SIZE_CHIP_COLORS[size.toUpperCase()];
  if (preset) {
    return isDark
      ? { bgcolor: alpha(preset.color, 0.2), color: preset.color }
      : { bgcolor: preset.bg, color: preset.color };
  }
  return isDark
    ? { bgcolor: alpha('#90a4ae', 0.2), color: '#b0bec5' }
    : { bgcolor: '#eceff1', color: '#455a64' };
};

// ─── SizeChip ───────────────────────────────────────────────────────────────

const SizeChip: React.FC<{ size: string | null }> = ({ size }) => {
  const theme = useTheme();
  if (!size || size === '0') {
    return (
      <Tooltip title="Keine Angabe">
        <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic', userSelect: 'none' }}>–</Typography>
      </Tooltip>
    );
  }
  const style = getChipStyle(size, theme.palette.mode === 'dark');
  return (
    <Chip
      label={size}
      size="small"
      sx={{
        fontWeight: 700,
        fontSize: '0.72rem',
        letterSpacing: '0.03em',
        height: 24,
        borderRadius: '6px',
        bgcolor: style.bgcolor,
        color: style.color,
        border: 'none',
      }}
    />
  );
};

// ─── SizeSummarySection ─────────────────────────────────────────────────────

const SizeSummarySection: React.FC<{
  title: string;
  icon: React.ReactNode;
  summary: SizeSummary;
  accentColor: string;
  missingCount: number;
}> = ({ title, icon, summary, accentColor, missingCount }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const sorted = sortSizes(Object.entries(summary));

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 160,
        p: 2,
        borderRadius: 2,
        bgcolor: isDark ? alpha(accentColor, 0.08) : alpha(accentColor, 0.06),
        border: `1px solid ${alpha(accentColor, isDark ? 0.25 : 0.18)}`,
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: "center",
          mb: 1.5
        }}>
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: alpha(accentColor, isDark ? 0.22 : 0.15),
            color: accentColor,
          }}
        >
          {icon}
        </Avatar>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 700,
            color: accentColor
          }}>
          {title}
        </Typography>
      </Stack>
      {sorted.length === 0 ? (
        <Typography variant="caption" sx={{
          color: "text.disabled"
        }}>Keine Daten</Typography>
      ) : (
        <Stack
          direction="row"
          sx={{
            flexWrap: "wrap",
            gap: 0.75
          }}>
          {sorted.map(([size, count]) => {
            const style = getChipStyle(size, isDark);
            return (
              <Chip
                key={size}
                label={`${size} × ${count}`}
                size="small"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.72rem',
                  height: 26,
                  borderRadius: '8px',
                  bgcolor: style.bgcolor,
                  color: style.color,
                  border: 'none',
                }}
              />
            );
          })}
        </Stack>
      )}
      {missingCount > 0 && (
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            alignItems: "center",
            mt: 1.5
          }}>
          <WarningAmberIcon sx={{ fontSize: 14, color: 'warning.main' }} />
          <Typography variant="caption" sx={{
            color: "warning.main"
          }}>
            {missingCount} ohne Angabe
          </Typography>
        </Stack>
      )}
    </Box>
  );
};

// ─── ReminderDialog ────────────────────────────────────────────────────────

interface ReminderDialogProps {
  open: boolean;
  candidates: Candidate[];
  sending: boolean;
  onClose: () => void;
  onConfirm: (excludedIds: number[], createTask: boolean, taskDueDate: string) => void;
}

const ReminderDialog: React.FC<ReminderDialogProps> = ({ open, candidates, sending, onClose, onConfirm }) => {
  const [excluded, setExcluded] = React.useState<Set<number>>(new Set());
  const [createTask, setCreateTask] = React.useState(false);
  const [taskDueDate, setTaskDueDate] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });

  React.useEffect(() => {
    if (open) {
      // Supporters standardmäßig ausgeschlossen
      setExcluded(new Set(candidates.filter(c => c.role === 'supporter').map(c => c.id)));
      setCreateTask(false);
      const d = new Date();
      d.setDate(d.getDate() + 7);
      setTaskDueDate(d.toISOString().slice(0, 10));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (id: number) =>
    setExcluded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const notifyCount = candidates.length - excluded.size;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, pr: 6 }}>
        Erinnerung senden
        <IconButton
          aria-label="Schließen"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8, color: 'text.secondary' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            mb: 2
          }}>
          Die folgenden {candidates.length} Mitglieder haben unvollständige Ausrüstungsangaben.
          Entferne das Häkchen, um einzelne Personen von der Benachrichtigung auszuschließen.
        </Typography>
        <List dense disablePadding>
          {candidates.map(player => {
            const isExcluded = excluded.has(player.id);
            const missing = getMissingFields(player);
            return (
              <ListItem key={player.id} disablePadding>
                <ListItemButton
                  onClick={() => toggle(player.id)}
                  sx={{ borderRadius: 1, opacity: isExcluded ? 0.45 : 1 }}
                >
                  <Checkbox
                    checked={!isExcluded}
                    tabIndex={-1}
                    disableRipple
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={0.75} sx={{
                        alignItems: "center"
                      }}>
                        <Typography variant="body2" sx={{
                          fontWeight: 600
                        }}>
                          {player.name}
                        </Typography>
                        {player.role === 'coach' && (
                          <Chip label="Trainer" size="small" variant="outlined" color="secondary"
                            sx={{ fontSize: '0.63rem', height: 17, '& .MuiChip-label': { px: 0.75 } }}
                          />
                        )}
                        {player.role === 'supporter' && (
                          <Chip label="Supporter" size="small" variant="outlined" color="warning"
                            sx={{ fontSize: '0.63rem', height: 17, '& .MuiChip-label': { px: 0.75 } }}
                          />
                        )}
                      </Stack>
                    }
                    secondary={
                      <Typography variant="caption" color={isExcluded ? 'text.disabled' : 'warning.main'}>
                        Fehlt: {missing.join(', ')}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
        <Divider sx={{ my: 2 }} />
        <FormControlLabel
          control={<Switch checked={createTask} onChange={e => setCreateTask(e.target.checked)} size="small" />}
          label={<Typography variant="body2">Aufgabe im Kalender anlegen</Typography>}
        />
        {createTask && (
          <TextField
            label="Fälligkeitsdatum"
            type="date"
            value={taskDueDate}
            onChange={e => setTaskDueDate(e.target.value)}
            size="small"
            fullWidth
            sx={{ mt: 1.5 }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">Abbrechen</Button>
        <Button
          variant="contained"
          startIcon={sending
            ? <CircularProgress size={16} color="inherit" />
            : <NotificationsActiveIcon />}
          disabled={sending || notifyCount === 0}
          onClick={() => onConfirm([...excluded], createTask, taskDueDate)}
        >
          {notifyCount} Mitglieder benachrichtigen
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── OrderDialog ────────────────────────────────────────────────────────────

interface OrderDialogProps {
  open: boolean;
  team: Team | null;
  downloading: boolean;
  onClose: () => void;
  onExport: (selection: OrderSelection) => void;
}

const OrderDialog: React.FC<OrderDialogProps> = ({ open, team, downloading, onClose, onExport }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [selection, setSelection] = useState<OrderSelection>({});
  const [search, setSearch] = useState('');

  const members: Candidate[] = team ? [
    ...team.players.map(member => ({ ...member, role: 'player' as const })),
    ...team.coaches.map(member => ({ ...member, role: 'coach' as const })),
    ...team.supporters.map(member => ({ ...member, role: 'supporter' as const })),
  ] : [];

  useEffect(() => {
    if (open) {
      setSelection({});
      setSearch('');
    }
  }, [open, team?.team_id]);

  const selectedItemCount = Object.values(selection).reduce((sum, items) => sum + items.length, 0);
  const selectedPersonCount = Object.values(selection).filter(items => items.length > 0).length;
  const filteredMembers = members.filter(member => member.name.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()));

  const setMemberItems = (member: Candidate, items: OrderItemKey[]) => {
    setSelection(previous => {
      const next = { ...previous };
      if (items.length > 0) next[memberKey(member)] = items;
      else delete next[memberKey(member)];
      return next;
    });
  };

  const toggleItem = (member: Candidate, item: OrderItemKey) => {
    const current = selection[memberKey(member)] ?? [];
    setMemberItems(member, current.includes(item) ? current.filter(key => key !== item) : [...current, item]);
  };

  const selectForEveryone = (item?: OrderItemKey) => {
    const next: OrderSelection = {};
    members.forEach(member => {
      const available = ORDER_ITEMS
        .filter(product => (!item || product.key === item) && hasSize(member, product.key))
        .map(product => product.key);
      if (available.length > 0) next[memberKey(member)] = available;
    });
    setSelection(next);
  };

  const roleLabel = (role: Candidate['role']) => role === 'player' ? 'Spieler' : role === 'coach' ? 'Trainer' : 'Staff / Supporter';

  return (
    <Dialog open={open} onClose={downloading ? undefined : onClose} fullScreen={isMobile} fullWidth maxWidth="md">
      <DialogTitle sx={{ px: { xs: 2, sm: 3 }, py: 2, pr: 7 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Bestellung zusammenstellen</Typography>
        <Typography variant="body2" color="text.secondary">{team?.team_name} · Wähle nur, was wirklich gebraucht wird.</Typography>
        <IconButton aria-label="Schließen" onClick={onClose} disabled={downloading} sx={{ position: 'absolute', right: 8, top: 10 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ px: { xs: 1.5, sm: 3 }, py: 2, bgcolor: 'background.default' }}>
        <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Schnellauswahl</Typography>
          <Stack direction="row" useFlexGap sx={{ gap: 1, flexWrap: 'wrap' }}>
            <Button size="small" variant="contained" onClick={() => selectForEveryone()} sx={{ textTransform: 'none' }}>
              Alles fürs Team
            </Button>
            {ORDER_ITEMS.map(item => (
              <Button key={item.key} size="small" variant="outlined" onClick={() => selectForEveryone(item.key)} sx={{ textTransform: 'none' }}>
                Nur {item.shortLabel}
              </Button>
            ))}
            <Button size="small" color="inherit" onClick={() => setSelection({})} disabled={selectedItemCount === 0} sx={{ textTransform: 'none' }}>
              Auswahl leeren
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Artikel ohne hinterlegte Größe werden ausgelassen.
          </Typography>
        </Paper>

        <TextField
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Name suchen …"
          size="small"
          fullWidth
          sx={{ mb: 2, bgcolor: 'background.paper' }}
          slotProps={{ input: { startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
        />

        <Stack spacing={1.25}>
          {filteredMembers.map(member => {
            const key = memberKey(member);
            const selected = selection[key] ?? [];
            const availableItems = ORDER_ITEMS.filter(item => hasSize(member, item.key)).map(item => item.key);
            const allSelected = availableItems.length > 0 && availableItems.every(item => selected.includes(item));
            return (
              <Paper key={key} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', borderColor: selected.length ? 'primary.main' : 'divider' }}>
                <ListItemButton
                  onClick={() => setMemberItems(member, allSelected ? [] : availableItems)}
                  disabled={availableItems.length === 0}
                  sx={{ py: 1.25, px: 1.5 }}
                >
                  <Checkbox checked={allSelected} indeterminate={selected.length > 0 && !allSelected} tabIndex={-1} disableRipple />
                  <ListItemText
                    primary={<Typography variant="body2" sx={{ fontWeight: 700 }}>{member.name}</Typography>}
                    secondary={`${roleLabel(member.role)} · ${selected.length} von ${availableItems.length} ausgewählt`}
                  />
                </ListItemButton>
                <Divider />
                <Box sx={{ p: 1, display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(5, 1fr)' }, gap: 0.75 }}>
                  {ORDER_ITEMS.map(item => {
                    const available = hasSize(member, item.key);
                    return (
                      <Button
                        key={item.key}
                        variant={selected.includes(item.key) ? 'contained' : 'outlined'}
                        color={available ? 'primary' : 'inherit'}
                        disabled={!available}
                        onClick={() => toggleItem(member, item.key)}
                        aria-pressed={selected.includes(item.key)}
                        sx={{ minHeight: 54, px: 0.75, textTransform: 'none', display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}
                      >
                        <span>{item.label}</span>
                        <strong>{available ? member[item.key] : 'Größe fehlt'}</strong>
                      </Button>
                    );
                  })}
                </Box>
              </Paper>
            );
          })}
          {filteredMembers.length === 0 && <Alert severity="info">Keine Person mit diesem Namen gefunden.</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 1.5, gap: 1, justifyContent: 'space-between', boxShadow: '0 -4px 14px rgba(0,0,0,0.08)' }}>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>{selectedItemCount} Artikel</Typography>
          <Typography variant="caption" color="text.secondary">für {selectedPersonCount} Personen</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={downloading ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfIcon />}
          disabled={downloading || selectedItemCount === 0}
          onClick={() => onExport(selection)}
          sx={{ minHeight: 44, textTransform: 'none', fontWeight: 700 }}
        >
          {downloading ? 'PDF wird erstellt …' : 'Bestell-PDF erstellen'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Hauptkomponente ────────────────────────────────────────────────────────

const SizeGuide: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [reminderSending, setReminderSending] = useState(false);
  const [reminderSnackbar, setReminderSnackbar] = useState<{ open: boolean; success: boolean; message: string }>({ open: false, success: true, message: '' });
  const [reminderDialog, setReminderDialog] = useState<{
    open: boolean;
    teamId: number | null;
    candidates: Candidate[];
  }>({ open: false, teamId: null, candidates: [] });

  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const openReminderDialog = (team: Team) => {
    const candidates: Candidate[] = [
      ...team.players
        .filter(p => getMissingFields(p).length > 0)
        .map(p => ({ ...p, role: 'player' as const })),
      ...team.coaches
        .filter(c => getMissingFields(c).length > 0)
        .map(c => ({ ...c, role: 'coach' as const })),
      ...team.supporters
        .filter(s => getMissingFields(s).length > 0)
        .map(s => ({ ...s, role: 'supporter' as const })),
    ];
    setReminderDialog({ open: true, teamId: team.team_id, candidates });
  };

  const handleConfirmReminder = async (excludedIds: number[], createTask: boolean, taskDueDate: string) => {
    const { teamId } = reminderDialog;
    if (!teamId) return;
    setReminderDialog(d => ({ ...d, open: false }));
    setReminderSending(true);
    try {
      const result = await apiJson<{ notified: number; skipped: number }>(
        `/api/teams/${teamId}/size-guide-remind`,
        {
          method: 'POST',
          body: { exclude: excludedIds, createTask, taskDueDate },
          headers: { 'Content-Type': 'application/json' },
        }
      );
      setReminderSnackbar({
        open: true,
        success: true,
        message: result.notified > 0
          ? `${result.notified} Spieler wurden per Push-Benachrichtigung erinnert.`
          : 'Alle Spieler haben bereits vollständige Angaben.',
      });
    } catch {
      setReminderSnackbar({ open: true, success: false, message: 'Erinnerung konnte nicht gesendet werden.' });
    } finally {
      setReminderSending(false);
    }
  };

  const handleDownloadPdf = async (teamId: number, selection: OrderSelection) => {
    setPdfDownloading(true);
    try {
      const orders = Object.entries(selection)
        .filter(([, items]) => items.length > 0)
        .map(([key, items]) => {
          const [role, memberId] = key.split(':');
          return { role, memberId: Number(memberId), items };
        });
      const blob = await apiBlob(`/api/teams/${teamId}/size-guide-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { orders },
      });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setOrderDialogOpen(false);
      // Revoke after a short delay to allow the new tab to load the blob
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      console.error('PDF-Öffnen fehlgeschlagen', e);
      setReminderSnackbar({ open: true, success: false, message: 'Die Bestell-PDF konnte nicht erstellt werden.' });
    } finally {
      setPdfDownloading(false);
    }
  };

  useEffect(() => {
    apiJson("/api/teams/size-guide-overview")
      .then((data: Team[]) => {
        setTeams(data);
        if (data.length > 0) {
          setSelectedTeamId(data[0].team_id);
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const selectedTeam = teams.find(t => t.team_id === selectedTeamId) ?? null;

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 200,
          gap: 2
        }}>
        <CircularProgress size={40} />
        <Typography variant="body2" sx={{
          color: "text.secondary"
        }}>Größendaten werden geladen …</Typography>
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  }

  return (
    <Box sx={{ width: '100%', px: { xs: 1.5, md: 4 }, py: { xs: 2, md: 4 }, maxWidth: 1100, mx: 'auto' }}>
      {/* ── Seitenkopf ─────────────────────────────────────────── */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: "space-between",
          mb: 4
        }}>
        <Stack direction="row" spacing={2} sx={{
          alignItems: "center"
        }}>
          <Avatar
            sx={{
              width: 52,
              height: 52,
              bgcolor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.12),
              color: 'primary.main',
            }}
          >
            <CheckroomIcon sx={{ fontSize: 28 }} />
          </Avatar>
          <Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                lineHeight: 1.2
              }}>
              Kleidergrößen
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                mt: 0.25
              }}>
              Ausrüstungsgrößen von Spielern, Trainern und Staff
            </Typography>
          </Box>
        </Stack>

        {/* Team-Auswahl */}
        {teams.length > 0 && (
          <FormControl
            size="small"
            sx={{ minWidth: 220, width: { xs: '100%', sm: 'auto' } }}
          >
            <InputLabel id="size-guide-team-label">Team</InputLabel>
            <Select
              labelId="size-guide-team-label"
              label="Team"
              value={selectedTeamId}
              onChange={e => setSelectedTeamId(e.target.value as number)}
              sx={{
                borderRadius: 2,
                bgcolor: isDark
                  ? alpha(theme.palette.primary.main, 0.08)
                  : alpha(theme.palette.primary.main, 0.04),
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: alpha(theme.palette.primary.main, isDark ? 0.3 : 0.2),
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.primary.main,
                },
              }}
            >
              {teams.map(t => (
                <MenuItem key={t.team_id} value={t.team_id}>
                  <Stack direction="row" spacing={1} sx={{
                    alignItems: "center"
                  }}>
                    <GroupsIcon sx={{ fontSize: 16, color: 'primary.main', opacity: 0.7 }} />
                    <span>{t.team_name}</span>
                    <Chip
                      label={t.players.length + t.coaches.length + t.supporters.length}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main',
                        ml: 0.5,
                      }}
                    />
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Stack>
      {teams.length === 0 && (
        <EmptyStateHint
          icon={<CheckroomIcon />}
          title="Keine Teamdaten verfügbar"
          description="Du bist keinem Team als Trainer zugeordnet."
          compact
        />
      )}
      {/* ── Ausgewähltes Team ──────────────────────────────────── */}
      {selectedTeam !== null && (() => {
        const team = selectedTeam;
        const allMembers = [...team.players, ...team.coaches, ...team.supporters];
        const shortsSummary = aggregateTeamSizes(allMembers, 'shorts_size');
        const shirtSummary  = aggregateTeamSizes(allMembers, 'shirt_size');
        const shoeSummary   = aggregateTeamSizes(allMembers, 'shoe_size');
        const socksSummary  = aggregateTeamSizes(allMembers, 'socks_size');
        const jacketSummary = aggregateTeamSizes(allMembers, 'jacket_size');

        const missingShorts  = allMembers.filter(p => !p.shorts_size  || p.shorts_size  === '0').length;
        const missingShirts  = allMembers.filter(p => !p.shirt_size   || p.shirt_size   === '0').length;
        const missingShoes   = allMembers.filter(p => !p.shoe_size    || p.shoe_size    === '0').length;
        const missingSocks   = allMembers.filter(p => !p.socks_size   || p.socks_size   === '0').length;
        const missingJackets = allMembers.filter(p => !p.jacket_size  || p.jacket_size  === '0').length;
        const incompleteCount = allMembers.filter(p =>
          !p.shorts_size || p.shorts_size === '0' ||
          !p.shirt_size  || p.shirt_size  === '0' ||
          !p.shoe_size   || p.shoe_size   === '0' ||
          !p.socks_size  || p.socks_size  === '0' ||
          !p.jacket_size || p.jacket_size === '0'
        ).length;

        return (
          <>
            <Paper
              key={team.team_id}
              elevation={isDark ? 2 : 3}
              sx={{
                borderRadius: 3,
                overflow: 'clip',
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              {/* Team-Header + Spalten-Header (gemeinsam sticky) */}
              <Box sx={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <Box
                sx={{
                  px: { xs: 2, md: 3 },
                  py: 2,
                  background: isDark
                    ? `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.35)} 0%, ${alpha(theme.palette.primary.main, 0.15)} 100%), ${theme.palette.background.paper}`
                    : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.10)} 0%, ${alpha(theme.palette.primary.light, 0.06)} 100%), ${theme.palette.background.paper}`,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: 1.5,
                }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  sx={{
                    alignItems: "center",
                    flex: 1,
                    width: "100%"
                  }}>
                  <Avatar
                    sx={{
                      width: 36,
                      height: 36,
                      bgcolor: alpha(theme.palette.primary.main, 0.2),
                      color: 'primary.main',
                    }}
                  >
                    <GroupsIcon sx={{ fontSize: 20 }} />
                  </Avatar>
                  <Box sx={{
                    flex: 1
                  }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 700,
                        fontSize: "1rem",
                        lineHeight: 1.2
                      }}>
                      {team.team_name}
                    </Typography>
                    <Typography variant="caption" sx={{
                      color: "text.secondary"
                    }}>
                      {team.players.length} Spieler
                      {team.coaches.length > 0 && ` · ${team.coaches.length} Trainer`}
                      {team.supporters.length > 0 && ` · ${team.supporters.length} Supporter`}
                    </Typography>
                  </Box>
                </Stack>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    alignItems: "center",
                    width: { xs: '100%', sm: 'auto' }
                  }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={reminderSending ? <CircularProgress size={14} color="inherit" /> : <NotificationsActiveIcon />}
                    disabled={reminderSending || incompleteCount === 0}
                    onClick={() => openReminderDialog(team)}
                    sx={{
                      borderRadius: 2,
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      textTransform: 'none',
                      flex: { xs: 1, sm: 'initial' },
                    }}
                  >
                    {reminderSending ? 'Wird gesendet…' : `Erinnerung senden${incompleteCount > 0 ? ` (${incompleteCount})` : ''}`}
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddShoppingCartIcon />}
                    disabled={pdfDownloading}
                    onClick={() => setOrderDialogOpen(true)}
                    sx={{
                      borderRadius: 2,
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      textTransform: 'none',
                      bgcolor: 'primary.main',
                      flex: { xs: 1, sm: 'initial' },
                      '&:hover': { bgcolor: 'primary.dark' },
                    }}
                  >
                    Bestellung erstellen
                  </Button>
                </Stack>
              </Box>
              {/* Spalten-Header – scrollt per JS-Sync horizontal mit dem Body */}
              <Box
                ref={headerScrollRef}
                sx={{
                  overflowX: 'hidden',
                  bgcolor: isDark
                    ? alpha(theme.palette.background.default, 0.6)
                    : alpha(theme.palette.grey[100], 0.8),
                }}
              >
                <Table size="small" sx={{ minWidth: 530, tableLayout: 'fixed' }}>
                  <colgroup>
                    <col />
                    <col style={{ width: 70 }} />
                    <col style={{ width: 70 }} />
                    <col style={{ width: 70 }} />
                    <col style={{ width: 70 }} />
                    <col style={{ width: 70 }} />
                  </colgroup>
                  <TableHead>
                    <TableRow>
                      {[
                        { label: 'Person', icon: null, align: 'left' as const },
                        { label: 'Hose', icon: <CheckroomIcon sx={{ fontSize: 14 }} />, align: 'center' as const },
                        { label: 'Trikot', icon: <CheckroomIcon sx={{ fontSize: 14 }} />, align: 'center' as const },
                        { label: 'Jacke', icon: <CheckroomIcon sx={{ fontSize: 14 }} />, align: 'center' as const },
                        { label: 'Schuh', icon: <DirectionsRunIcon sx={{ fontSize: 14 }} />, align: 'center' as const },
                        { label: 'Stutzen', icon: <DirectionsRunIcon sx={{ fontSize: 14 }} />, align: 'center' as const },
                      ].map((col) => (
                        <TableCell
                          key={col.label}
                          align={col.align}
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            color: 'text.secondary',
                            py: 1.25,
                            px: { xs: 1, md: 2 },
                            borderBottom: `2px solid ${theme.palette.divider}`,
                            whiteSpace: 'nowrap',
                            bgcolor: isDark
                              ? alpha(theme.palette.background.default, 0.95)
                              : alpha(theme.palette.grey[100], 0.97),
                          }}
                        >
                          <Stack
                            direction="row"
                            spacing={0.5}
                            sx={{
                              alignItems: "center",
                              justifyContent: col.align === 'center' ? 'center' : 'flex-start'
                            }}>
                            {col.icon}
                            <span>{col.label}</span>
                          </Stack>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                </Table>
              </Box>
              </Box> {/* end sticky wrapper */}

              {/* Tabelle – nur Body, scrollt horizontal */}
              <Box
                ref={bodyScrollRef}
                sx={{ overflowX: 'auto' }}
                onScroll={(e) => {
                  if (headerScrollRef.current) {
                    headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
                  }
                }}
              >
                <Table size="small" sx={{ minWidth: 530, tableLayout: 'fixed' }}>
                  <colgroup>
                    <col />
                    <col style={{ width: 70 }} />
                    <col style={{ width: 70 }} />
                    <col style={{ width: 70 }} />
                    <col style={{ width: 70 }} />
                    <col style={{ width: 70 }} />
                  </colgroup>
                  <TableBody>
                    {team.players.map((player, idx) => (
                      <TableRow
                        key={`p-${player.id}`}
                        sx={{
                          bgcolor: idx % 2 === 0
                            ? 'transparent'
                            : isDark
                              ? alpha(theme.palette.action.hover, 0.4)
                              : alpha(theme.palette.grey[50], 0.7),
                          '&:last-child td': { border: 0 },
                          '&:hover': {
                            bgcolor: alpha(theme.palette.primary.main, isDark ? 0.08 : 0.04),
                            transition: 'background-color 0.15s',
                          },
                        }}
                      >
                        <TableCell sx={{ py: 1, px: { xs: 1, md: 2 }, fontWeight: 500, fontSize: '0.875rem' }}>
                          <Stack direction="row" spacing={1.25} sx={{
                            alignItems: "center"
                          }}>
                            <Avatar
                              sx={{
                                width: 28,
                                height: 28,
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                bgcolor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.12),
                                color: 'primary.main',
                              }}
                            >
                              {player.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </Avatar>
                            <Typography variant="body2" noWrap sx={{
                              fontWeight: 500
                            }}>
                              {player.name}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1, px: { xs: 1, md: 2 } }}>
                          <SizeChip size={player.shorts_size} />
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1, px: { xs: 1, md: 2 } }}>
                          <SizeChip size={player.shirt_size} />
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1, px: { xs: 1, md: 2 } }}>
                          <SizeChip size={player.jacket_size} />
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1, px: { xs: 1, md: 2 } }}>
                          <SizeChip size={player.shoe_size} />
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1, px: { xs: 1, md: 2 } }}>
                          <SizeChip size={player.socks_size} />
                        </TableCell>
                      </TableRow>
                    ))}
                    {team.coaches.length > 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          sx={{
                            py: 0.75,
                            px: { xs: 1, md: 2 },
                            bgcolor: isDark
                              ? alpha(theme.palette.secondary.main, 0.07)
                              : alpha(theme.palette.secondary.main, 0.04),
                            borderBottom: `1px solid ${alpha(theme.palette.secondary.main, 0.15)}`,
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.07em',
                              color: 'secondary.main'
                            }}>
                            Trainer
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {team.coaches.map((coach) => (
                      <TableRow
                        key={`c-${coach.id}`}
                        sx={{
                          '&:last-child td': { border: 0 },
                          '&:hover': {
                            bgcolor: alpha(theme.palette.secondary.main, isDark ? 0.08 : 0.04),
                            transition: 'background-color 0.15s',
                          },
                        }}
                      >
                        <TableCell sx={{ py: 1, px: { xs: 1, md: 2 }, fontWeight: 500, fontSize: '0.875rem' }}>
                          <Stack direction="row" spacing={1.25} sx={{
                            alignItems: "center"
                          }}>
                            <Avatar
                              sx={{
                                width: 28,
                                height: 28,
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                bgcolor: alpha(theme.palette.secondary.main, isDark ? 0.25 : 0.15),
                                color: 'secondary.main',
                              }}
                            >
                              {coach.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </Avatar>
                            <Typography variant="body2" noWrap sx={{
                              fontWeight: 500
                            }}>
                              {coach.name}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1, px: { xs: 1, md: 2 } }}>
                          <SizeChip size={coach.shorts_size} />
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1, px: { xs: 1, md: 2 } }}>
                          <SizeChip size={coach.shirt_size} />
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1, px: { xs: 1, md: 2 } }}>
                          <SizeChip size={coach.jacket_size} />
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1, px: { xs: 1, md: 2 } }}>
                          <SizeChip size={coach.shoe_size} />
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1, px: { xs: 1, md: 2 } }}>
                          <SizeChip size={coach.socks_size} />
                        </TableCell>
                      </TableRow>
                    ))}
                    {team.supporters.length > 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          sx={{
                            py: 0.75,
                            px: { xs: 1, md: 2 },
                            bgcolor: isDark
                              ? alpha(theme.palette.warning.main, 0.07)
                              : alpha(theme.palette.warning.main, 0.04),
                            borderBottom: `1px solid ${alpha(theme.palette.warning.main, 0.15)}`,
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.07em',
                              color: 'warning.main'
                            }}>
                            Supporter
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {team.supporters.map((supporter) => (
                      <TableRow
                        key={`s-${supporter.id}`}
                        sx={{
                          '&:last-child td': { border: 0 },
                          '&:hover': {
                            bgcolor: alpha(theme.palette.warning.main, isDark ? 0.08 : 0.04),
                            transition: 'background-color 0.15s',
                          },
                        }}
                      >
                        <TableCell sx={{ py: 1, px: { xs: 1, md: 2 }, fontWeight: 500, fontSize: '0.875rem' }}>
                          <Stack direction="row" spacing={1.25} sx={{
                            alignItems: "center"
                          }}>
                            <Avatar
                              sx={{
                                width: 28,
                                height: 28,
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                bgcolor: alpha(theme.palette.warning.main, isDark ? 0.25 : 0.15),
                                color: 'warning.main',
                              }}
                            >
                              {supporter.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </Avatar>
                            <Typography variant="body2" noWrap sx={{
                              fontWeight: 500
                            }}>
                              {supporter.name}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1, px: { xs: 1, md: 2 } }}>
                          <SizeChip size={supporter.shorts_size} />
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1, px: { xs: 1, md: 2 } }}>
                          <SizeChip size={supporter.shirt_size} />
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1, px: { xs: 1, md: 2 } }}>
                          <SizeChip size={supporter.jacket_size} />
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1, px: { xs: 1, md: 2 } }}>
                          <SizeChip size={supporter.shoe_size} />
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1, px: { xs: 1, md: 2 } }}>
                          <SizeChip size={supporter.socks_size} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Paper>
            <Paper
              elevation={isDark ? 1 : 2}
              sx={{
                mt: 3,
                borderRadius: 3,
                overflow: 'clip',
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              {/* Größenverteilung */}
              <Box sx={{ px: { xs: 2, md: 3 }, py: 2.5 }}>
                <Divider sx={{ mb: 2 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      px: 1,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em'
                    }}>
                    Größenverteilung
                  </Typography>
                </Divider>
                <Stack direction={isMobile ? 'column' : 'row'} spacing={1.5} useFlexGap sx={{
                  flexWrap: "wrap"
                }}>
                  <SizeSummarySection
                    title="Hosen"
                    icon={<CheckroomIcon sx={{ fontSize: 16 }} />}
                    summary={shortsSummary}
                    accentColor={theme.palette.primary.main}
                    missingCount={missingShorts}
                  />
                  <SizeSummarySection
                    title="Trikots"
                    icon={<CheckroomIcon sx={{ fontSize: 16 }} />}
                    summary={shirtSummary}
                    accentColor={theme.palette.secondary.main}
                    missingCount={missingShirts}
                  />
                  <SizeSummarySection
                    title="Trainingsjacken"
                    icon={<CheckroomIcon sx={{ fontSize: 16 }} />}
                    summary={jacketSummary}
                    accentColor={theme.palette.warning.main}
                    missingCount={missingJackets}
                  />
                  <SizeSummarySection
                    title="Schuhe"
                    icon={<DirectionsRunIcon sx={{ fontSize: 16 }} />}
                    summary={shoeSummary}
                    accentColor={theme.palette.info.main}
                    missingCount={missingShoes}
                  />
                  <SizeSummarySection
                    title="Stutzen"
                    icon={<DirectionsRunIcon sx={{ fontSize: 16 }} />}
                    summary={socksSummary}
                    accentColor={theme.palette.success.main}
                    missingCount={missingSocks}
                  />
                </Stack>
              </Box>
            </Paper>
          </>
        );
      })()}
      {/* Erinnerung: Bestätigungsdialog */}
      <ReminderDialog
        open={reminderDialog.open}
        candidates={reminderDialog.candidates}
        sending={reminderSending}
        onClose={() => setReminderDialog(d => ({ ...d, open: false }))}
        onConfirm={handleConfirmReminder}
      />
      <OrderDialog
        open={orderDialogOpen}
        team={selectedTeam}
        downloading={pdfDownloading}
        onClose={() => setOrderDialogOpen(false)}
        onExport={selection => selectedTeam && handleDownloadPdf(selectedTeam.team_id, selection)}
      />
      <Snackbar
        open={reminderSnackbar.open}
        autoHideDuration={5000}
        onClose={() => setReminderSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={reminderSnackbar.success ? 'success' : 'error'}
          onClose={() => setReminderSnackbar(s => ({ ...s, open: false }))}
          sx={{ width: '100%' }}
        >
          {reminderSnackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SizeGuide;
