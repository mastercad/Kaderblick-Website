import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LockIcon from '@mui/icons-material/Lock';
import RestoreIcon from '@mui/icons-material/Restore';
import SaveIcon from '@mui/icons-material/Save';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import { apiJson } from '../../utils/api';
import { GameEventType } from '../../types/gameEventType';

// ── Types ────────────────────────────────────────────────────────────────────

interface XpRule {
  id: number;
  actionType: string;
  label: string;
  category: string;
  description: string | null;
  xpValue: number;
  enabled: boolean;
  isSystem: boolean;
  cooldownMinutes: number;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  updatedAt: string;
}

type Category = 'sport' | 'platform' | 'game_event';

const CATEGORY_META: Record<Category, { label: string; color: string; bgcolor: string; borderColor: string }> = {
  platform:   { label: 'Plattform',    color: '#1565c0', bgcolor: '#e3f2fd', borderColor: '#90caf9' },
  sport:      { label: 'Sport',         color: '#2e7d32', bgcolor: '#e8f5e9', borderColor: '#a5d6a7' },
  game_event: { label: 'Spielereignisse', color: '#6a1b9a', bgcolor: '#f3e5f5', borderColor: '#ce93d8' },
};

const ALL_CATEGORIES: Category[] = ['platform', 'sport', 'game_event'];

function cooldownLabel(minutes: number): string {
  if (minutes === 0)  return 'Einmalig je Event';
  if (minutes === -1) return 'Kein Dedup';
  if (minutes < 60)   return `Cooldown ${minutes} min`;
  return `Cooldown ${minutes / 60} h`;
}

// ── Sub-component: inline edit row ───────────────────────────────────────────

interface RuleRowProps {
  rule: XpRule;
  onSave: (id: number, patch: Partial<XpRule>) => Promise<void>;
  onDelete: (id: number) => void;
  gameEventTypes: GameEventType[];
}

function RuleRow({ rule, onSave, onDelete, gameEventTypes }: RuleRowProps) {
  const [expanded, setExpanded]   = useState(false);
  const [editing, setEditing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [draft, setDraft]         = useState<XpRule>(rule);

  // Reset draft when rule prop changes (e.g. after save)
  useEffect(() => { setDraft(rule); }, [rule]);

  const isGameEventType = rule.actionType.startsWith('game_event_type_');
  const linkedCode      = isGameEventType ? rule.actionType.replace('game_event_type_', '') : null;
  const linkedType      = linkedCode ? gameEventTypes.find(t => t.code === linkedCode) : null;

  const handleToggleEnabled = async () => {
    setSaving(true);
    await onSave(rule.id, { enabled: !rule.enabled });
    setSaving(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(rule.id, {
      label:           draft.label,
      description:     draft.description,
      xpValue:         draft.xpValue,
      category:        draft.category,
      cooldownMinutes: draft.cooldownMinutes,
      dailyLimit:      draft.dailyLimit,
      monthlyLimit:    draft.monthlyLimit,
    });
    setSaving(false);
    setEditing(false);
  };

  const meta = CATEGORY_META[draft.category as Category] ?? CATEGORY_META.platform;

  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 1.5,
        borderLeft: `4px solid ${meta.borderColor}`,
        opacity: rule.enabled ? 1 : 0.55,
        transition: 'opacity 0.2s',
        '&:hover': { boxShadow: 2 },
      }}
    >
      {/* ── Top row ───────────────────────────────────────────────────────── */}
      <Box
        display="flex"
        alignItems="center"
        px={2}
        py={1.2}
        gap={1}
        sx={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => !editing && setExpanded(e => !e)}
      >
        {/* toggle */}
        <Tooltip title={rule.enabled ? 'Aktion deaktivieren' : 'Aktion aktivieren'}>
          <span onClick={e => e.stopPropagation()}>
            <Switch
              size="small"
              checked={rule.enabled}
              onChange={handleToggleEnabled}
              disabled={saving}
            />
          </span>
        </Tooltip>

        {/* label */}
        <Box flex={1} minWidth={0}>
          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <Typography fontWeight={600} noWrap sx={{ maxWidth: 260 }}>
              {rule.label}
            </Typography>
            <Chip
              label={rule.actionType}
              size="small"
              sx={{ fontFamily: 'monospace', fontSize: 11 }}
            />
            {linkedType && (
              <Chip
                icon={<SportsSoccerIcon sx={{ fontSize: 14 }} />}
                label={linkedType.name}
                size="small"
                sx={{
                  bgcolor: linkedType.color ?? '#eee',
                  color: '#fff',
                  fontSize: 11,
                }}
              />
            )}
            {rule.isSystem && (
              <Chip
                icon={<LockIcon sx={{ fontSize: 12 }} />}
                label="System"
                size="small"
                color="default"
                sx={{ fontSize: 10 }}
              />
            )}
          </Box>
          {rule.description && !expanded && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {rule.description}
            </Typography>
          )}
        </Box>

        {/* XP badge */}
        <Box
          sx={{
            minWidth: 56,
            textAlign: 'center',
            bgcolor: meta.bgcolor,
            border: `1px solid ${meta.borderColor}`,
            borderRadius: 1.5,
            px: 1,
            py: 0.3,
          }}
        >
          <Typography fontWeight={700} color={meta.color} fontSize={18} lineHeight={1.1}>
            {rule.xpValue}
          </Typography>
          <Typography fontSize={10} color={meta.color} lineHeight={1}>XP</Typography>
        </Box>

        {/* limits summary */}
        <Box textAlign="right" minWidth={90} display={{ xs: 'none', sm: 'block' }}>
          <Typography variant="caption" color="text.secondary">
            {cooldownLabel(rule.cooldownMinutes)}
          </Typography>
          {rule.dailyLimit !== null && (
            <Typography variant="caption" color="text.secondary" display="block">
              Max. {rule.dailyLimit}×/Tag
            </Typography>
          )}
          {rule.monthlyLimit !== null && (
            <Typography variant="caption" color="text.secondary" display="block">
              Max. {rule.monthlyLimit}×/Monat
            </Typography>
          )}
        </Box>

        {/* actions */}
        <Box display="flex" alignItems="center" onClick={e => e.stopPropagation()}>
          <Tooltip title="Bearbeiten">
            <IconButton
              size="small"
              onClick={() => { setEditing(e => !e); setExpanded(true); }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {!rule.isSystem && (
            <Tooltip title="Löschen">
              <IconButton size="small" color="error" onClick={() => onDelete(rule.id)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <IconButton size="small" onClick={() => setExpanded(e => !e)}>
            <ExpandMoreIcon
              fontSize="small"
              sx={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}
            />
          </IconButton>
        </Box>
      </Box>

      {/* ── Expanded detail / edit form ───────────────────────────────────── */}
      <Collapse in={expanded}>
        <Divider />
        <Box px={2} py={2}>
          {!editing ? (
            // ── Read view
            <Grid container spacing={2}>
              {rule.description && (
                <Grid size={{ xs: 12 }}>
                  <Typography variant="body2" color="text.secondary">{rule.description}</Typography>
                </Grid>
              )}
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary">Kategorie</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {CATEGORY_META[rule.category as Category]?.label ?? rule.category}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary">Cooldown</Typography>
                <Typography variant="body2">{cooldownLabel(rule.cooldownMinutes)}</Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary">Tages-Limit</Typography>
                <Typography variant="body2">{rule.dailyLimit ?? '–'}</Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary">Monats-Limit</Typography>
                <Typography variant="body2">{rule.monthlyLimit ?? '–'}</Typography>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant="caption" color="text.secondary">
                  Zuletzt geändert: {new Date(rule.updatedAt).toLocaleString('de-DE')}
                </Typography>
              </Grid>
            </Grid>
          ) : (
            // ── Edit form
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Bezeichnung"
                  value={draft.label}
                  onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
                  fullWidth size="small"
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  label="XP-Wert"
                  type="number"
                  value={draft.xpValue}
                  onChange={e => setDraft(d => ({ ...d, xpValue: parseInt(e.target.value) || 0 }))}
                  fullWidth size="small"
                  InputProps={{ endAdornment: <InputAdornment position="end">XP</InputAdornment> }}
                  inputProps={{ min: 0 }}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  label="Kategorie"
                  select
                  SelectProps={{ native: true }}
                  value={draft.category}
                  onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}
                  fullWidth size="small"
                >
                  {ALL_CATEGORIES.map(c => (
                    <option key={c} value={c}>{CATEGORY_META[c].label}</option>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Beschreibung (optional)"
                  value={draft.description ?? ''}
                  onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                  fullWidth size="small" multiline rows={2}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Divider>
                  <Typography variant="caption" color="text.secondary">
                    Anti-Missbrauch / Limits
                  </Typography>
                </Divider>
              </Grid>

              <Grid size={{ xs: 6, sm: 4 }}>
                <TextField
                  label="Cooldown (Minuten)"
                  type="number"
                  value={draft.cooldownMinutes}
                  onChange={e => setDraft(d => ({ ...d, cooldownMinutes: parseInt(e.target.value) ?? 0 }))}
                  fullWidth size="small"
                  helperText="0 = einmalig je Event · -1 = kein Dedup · >0 = N Minuten"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="0 = strenge Dedup per (User+EventID). -1 = kein Dedup, nur Limits greifen. >0 = Cooldown in Minuten, bevor derselbe Event erneut XP gibt.">
                          <InfoOutlinedIcon fontSize="small" color="action" />
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 4 }}>
                <TextField
                  label="Tages-Limit"
                  type="number"
                  value={draft.dailyLimit ?? ''}
                  onChange={e => setDraft(d => ({
                    ...d,
                    dailyLimit: e.target.value !== '' ? parseInt(e.target.value) : null,
                  }))}
                  fullWidth size="small"
                  helperText="Leer = unbegrenzt"
                  inputProps={{ min: 1 }}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 4 }}>
                <TextField
                  label="Monats-Limit"
                  type="number"
                  value={draft.monthlyLimit ?? ''}
                  onChange={e => setDraft(d => ({
                    ...d,
                    monthlyLimit: e.target.value !== '' ? parseInt(e.target.value) : null,
                  }))}
                  fullWidth size="small"
                  helperText="Leer = unbegrenzt"
                  inputProps={{ min: 1 }}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Box display="flex" gap={1} justifyContent="flex-end">
                  <Button size="small" onClick={() => { setEditing(false); setDraft(rule); }}>
                    Abbrechen
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                    onClick={handleSave}
                    disabled={saving}
                  >
                    Speichern
                  </Button>
                </Box>
              </Grid>
            </Grid>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}

// ── GameEventTypeRow ──────────────────────────────────────────────────────────

interface GameEventTypeRowProps {
  type: GameEventType;
  rule: XpRule | undefined;
  fallbackXp: number;
  onSave: (id: number, patch: Partial<XpRule>) => Promise<void>;
  onCreate: (data: Partial<XpRule>) => Promise<void>;
  onDelete: (id: number) => void;
}

function GameEventTypeRow({ type, rule, fallbackXp, onSave, onCreate, onDelete }: GameEventTypeRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [editXp, setEditXp]     = useState(rule?.xpValue ?? fallbackXp);

  useEffect(() => { setEditXp(rule?.xpValue ?? fallbackXp); }, [rule, fallbackXp]);

  const hasCustomRule = !!rule;
  const xpValue       = rule?.xpValue ?? fallbackXp;
  const meta          = CATEGORY_META['game_event'];
  const accentColor   = type.color ?? meta.borderColor;

  const handleSave = async () => {
    setSaving(true);
    if (rule) {
      await onSave(rule.id, { xpValue: editXp });
    } else {
      await onCreate({
        actionType:      `game_event_type_${type.code}`,
        label:           type.name,
        category:        'game_event',
        xpValue:         editXp,
        cooldownMinutes: 0,
      });
    }
    setSaving(false);
    setEditing(false);
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 1.5,
        borderLeft: `4px solid ${accentColor}`,
        opacity: rule?.enabled === false ? 0.55 : 1,
        transition: 'opacity 0.2s',
        '&:hover': { boxShadow: 2 },
      }}
    >
      {/* ── Top row ─────────────────────────────────────────────────────── */}
      <Box
        display="flex" alignItems="center" px={2} py={1.2} gap={1}
        sx={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => !editing && setExpanded(e => !e)}
      >
        {/* Label + chips */}
        <Box flex={1} minWidth={0}>
          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <Typography fontWeight={600} noWrap sx={{ maxWidth: 260 }}>{type.name}</Typography>
            {!hasCustomRule && (
              <Chip
                label={`Standard: ${fallbackXp} XP`}
                size="small"
                sx={{ bgcolor: 'grey.100', color: 'text.secondary', fontSize: 10 }}
              />
            )}
          </Box>
        </Box>

        {/* XP badge */}
        <Box sx={{
          minWidth: 56, textAlign: 'center',
          bgcolor: hasCustomRule ? meta.bgcolor : 'grey.100',
          border: `1px solid ${hasCustomRule ? meta.borderColor : '#ddd'}`,
          borderRadius: 1.5, px: 1, py: 0.3,
        }}>
          <Typography fontWeight={700} color={hasCustomRule ? meta.color : 'text.disabled'} fontSize={18} lineHeight={1.1}>
            {xpValue}
          </Typography>
          <Typography fontSize={10} color={hasCustomRule ? meta.color : 'text.disabled'} lineHeight={1}>XP</Typography>
        </Box>

        {/* Actions */}
        <Box display="flex" alignItems="center" onClick={e => e.stopPropagation()}>
          <Tooltip title={hasCustomRule ? 'XP-Wert ändern' : 'Eigenen XP-Wert für diesen Typ festlegen'}>
            <IconButton size="small" onClick={() => { setEditing(e => !e); setExpanded(true); }}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {hasCustomRule && (
            <Tooltip title="Eigene Regel löschen (Fallback gilt wieder)">
              <IconButton size="small" color="error" onClick={() => onDelete(rule!.id)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <IconButton size="small" onClick={() => setExpanded(e => !e)}>
            <ExpandMoreIcon
              fontSize="small"
              sx={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}
            />
          </IconButton>
        </Box>
      </Box>

      {/* ── Expanded detail / edit ───────────────────────────────────────── */}
      <Collapse in={expanded}>
        <Divider />
        <Box px={2} py={2}>
          {!editing ? (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary">XP-Quelle</Typography>
                <Typography variant="body2">
                  {hasCustomRule ? 'Eigener Wert' : `Standard-Wert: ${fallbackXp} XP (aus Regel „Spielereignis hinterlegt")`}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary">Interner Typ-Code</Typography>
                <Typography variant="body2" fontFamily="monospace" fontSize={12}>{`game_event_type_${type.code}`}</Typography>
              </Grid>
              {rule && (
                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" color="text.secondary">
                    Zuletzt geändert: {new Date(rule.updatedAt).toLocaleString('de-DE')}
                  </Typography>
                </Grid>
              )}
            </Grid>
          ) : (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="XP-Wert"
                  type="number"
                  value={editXp}
                  onChange={e => setEditXp(parseInt(e.target.value) || 0)}
                  fullWidth size="small" autoFocus
                  InputProps={{ endAdornment: <InputAdornment position="end">XP</InputAdornment> }}
                  inputProps={{ min: 0 }}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Box display="flex" gap={1} justifyContent="flex-end">
                  <Button size="small" onClick={() => { setEditing(false); setEditXp(rule?.xpValue ?? fallbackXp); }}>
                    Abbrechen
                  </Button>
                  <Button
                    size="small" variant="contained"
                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                    onClick={handleSave}
                    disabled={saving}
                  >
                    Speichern
                  </Button>
                </Box>
              </Grid>
            </Grid>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}

// ── GameEventTypeSection ──────────────────────────────────────────────────────

interface GameEventTypeSectionProps {
  gameEventTypes: GameEventType[];
  rulesMap: Map<string, XpRule>;
  fallbackXp: number;
  onSave: (id: number, patch: Partial<XpRule>) => Promise<void>;
  onCreate: (data: Partial<XpRule>) => Promise<void>;
  onDelete: (id: number) => void;
}

function GameEventTypeSection({ gameEventTypes, rulesMap, fallbackXp, onSave, onCreate, onDelete }: GameEventTypeSectionProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() =>
    gameEventTypes.filter(t =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.code.toLowerCase().includes(search.toLowerCase())
    ),
  [gameEventTypes, search]);

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }} icon={<InfoOutlinedIcon />}>
        Klicke auf den <strong>Stift-Button</strong> neben einem Ereignistyp, um einen eigenen XP-Wert festzulegen.
        Ohne eigenen Wert erhalten alle Typen automatisch <strong>{fallbackXp} XP</strong> (Standard-Wert).
      </Alert>
      <TextField
        placeholder="Typ oder Code suchen…"
        size="small" fullWidth
        value={search}
        onChange={e => setSearch(e.target.value)}
        sx={{ mb: 2 }}
      />
      {filtered.map(type => (
        <GameEventTypeRow
          key={type.code}
          type={type}
          rule={rulesMap.get(type.code)}
          fallbackXp={fallbackXp}
          onSave={onSave}
          onCreate={onCreate}
          onDelete={onDelete}
        />
      ))}
      {filtered.length === 0 && (
        <Typography color="text.secondary" textAlign="center" mt={4}>Keine Treffer.</Typography>
      )}
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function XpConfig() {
  const [rules, setRules]                 = useState<XpRule[]>([]);
  const [gameEventTypes, setGameEventTypes] = useState<GameEventType[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [success, setSuccess]             = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetting, setResetting]         = useState(false);
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all');
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccess(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, typesRes] = await Promise.all([
        apiJson<{ rules: XpRule[] }>('/api/superadmin/xp-rules'),
        apiJson<{ gameEventTypes: GameEventType[] }>('/api/game-event-types'),
      ]);
      setRules(rulesRes.rules ?? []);
      setGameEventTypes(typesRes.gameEventTypes ?? []);
    } catch {
      setError('Daten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (id: number, patch: Partial<XpRule>) => {
    const updated = await apiJson<{ rule: XpRule }>(`/api/superadmin/xp-rules/${id}`, {
      method: 'PATCH',
      body: patch,
    });
    setRules(rs => rs.map(r => r.id === id ? updated.rule : r));
    showSuccess('Regel gespeichert.');
  };

  const handleCreate = async (data: Partial<XpRule>) => {
    const created = await apiJson<{ rule: XpRule }>('/api/superadmin/xp-rules', {
      method: 'POST',
      body: data,
    });
    setRules(rs => [...rs, created.rule].sort((a, b) =>
      a.category.localeCompare(b.category) || a.label.localeCompare(b.label)
    ));
    showSuccess('Neue Regel angelegt.');
  };

  const handleDelete = async (id: number) => {
    await apiJson(`/api/superadmin/xp-rules/${id}`, { method: 'DELETE' });
    setRules(rs => rs.filter(r => r.id !== id));
    showSuccess('Regel gelöscht.');
  };

  const handleResetDefaults = async () => {
    setResetting(true);
    try {
      const res = await apiJson<{ reset: number }>('/api/superadmin/xp-rules/seed-defaults', { method: 'POST' });
      await load();
      showSuccess(`${res.reset} Standard-Regeln zurückgesetzt.`);
    } catch {
      setError('Reset fehlgeschlagen.');
    } finally {
      setResetting(false);
      setResetConfirmOpen(false);
    }
  };

  // game_event_type_* rules belong to the 'game_event' tab; all other rules go to their category tab
  const filteredRules = useMemo(() => {
    const nonTypeRules = rules.filter(r => !r.actionType.startsWith('game_event_type_'));
    if (filterCategory === 'all') return nonTypeRules;
    if (filterCategory === 'game_event') return []; // handled by GameEventTypeSection
    return nonTypeRules.filter(r => r.category === filterCategory);
  }, [rules, filterCategory]);

  const fallbackXp = useMemo(
    () => rules.find(r => r.actionType === 'game_event')?.xpValue ?? 15,
    [rules]
  );

  // map game_event_type_{code} → XpRule for GameEventTypeSection
  const gameEventRulesMap = useMemo(() => {
    const m = new Map<string, XpRule>();
    for (const r of rules) {
      if (r.actionType.startsWith('game_event_type_')) {
        m.set(r.actionType.replace('game_event_type_', ''), r);
      }
    }
    return m;
  }, [rules]);

  // group by category
  const grouped = useMemo((): [Category, XpRule[]][] => {
    const map = new Map<Category, XpRule[]>();
    for (const cat of ALL_CATEGORIES) map.set(cat, []);
    for (const rule of filteredRules) {
      const cat = (rule.category as Category) in CATEGORY_META ? rule.category as Category : 'platform';
      map.get(cat)!.push(rule);
    }
    return Array.from(map.entries()).filter(([, rs]) => rs.length > 0);
  }, [filteredRules]);

  const totalXpEnabled = useMemo(
    () => rules.filter(r => r.enabled).reduce((sum, r) => sum + r.xpValue, 0),
    [rules]
  );

  if (loading) {
    return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;
  }

  return (
    <Box maxWidth={900} mx="auto" mt={4} px={2} pb={6}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Box display="flex" alignItems="center" gap={1.5} mb={1}>
        <EmojiEventsIcon color="warning" fontSize="large" />
        <Box flex={1}>
          <Typography variant="h5" fontWeight={700}>XP-Konfiguration</Typography>
          <Typography variant="body2" color="text.secondary">
            Verwalte alle XP-Regeln: Werte, Limits und Spielereignis-Typen — ohne Code-Änderungen.
          </Typography>
        </Box>
        <Chip
          label={`${rules.filter(r => r.enabled).length} aktiv  ·  Σ ${totalXpEnabled} XP`}
          color="warning"
          variant="outlined"
        />
      </Box>

      {/* ── Alerts ─────────────────────────────────────────────────────── */}
      {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <Box display="flex" gap={1} mb={3} flexWrap="wrap" alignItems="center">
        <Box display="flex" gap={0.5} flexWrap="wrap" flex={1}>
          <Chip
            label="Alle"
            variant={filterCategory === 'all' ? 'filled' : 'outlined'}
            onClick={() => setFilterCategory('all')}
            color={filterCategory === 'all' ? 'primary' : 'default'}
          />
          {ALL_CATEGORIES.map(cat => (
            <Chip
              key={cat}
              label={CATEGORY_META[cat].label}
              variant={filterCategory === cat ? 'filled' : 'outlined'}
              onClick={() => setFilterCategory(cat)}
              sx={filterCategory === cat
                ? { bgcolor: CATEGORY_META[cat].bgcolor, color: CATEGORY_META[cat].color, fontWeight: 600, border: `1px solid ${CATEGORY_META[cat].borderColor}` }
                : {}}
            />
          ))}
        </Box>
        <Tooltip title="Systemregeln auf Standardwerte zurücksetzen">
          <Button
            variant="outlined"
            size="small"
            startIcon={<RestoreIcon />}
            color="warning"
            onClick={() => setResetConfirmOpen(true)}
          >
            Defaults
          </Button>
        </Tooltip>

      </Box>

      {/* ── Rules grouped by category ──────────────────────────────────── */}
      {filterCategory !== 'game_event' && grouped.map(([cat, catRules]) => (
        <Box key={cat} mb={4}>
          <Box display="flex" alignItems="center" gap={1} mb={1.5}>
            <Chip
              label={CATEGORY_META[cat].label}
              sx={{
                bgcolor: CATEGORY_META[cat].bgcolor,
                color: CATEGORY_META[cat].color,
                fontWeight: 700,
                border: `1px solid ${CATEGORY_META[cat].borderColor}`,
              }}
            />
            <Typography variant="caption" color="text.secondary">{catRules.length} Regeln</Typography>
          </Box>
          {catRules.map(rule => (
            <RuleRow
              key={rule.id}
              rule={rule}
              onSave={handleSave}
              onDelete={handleDelete}
              gameEventTypes={gameEventTypes}
            />
          ))}
        </Box>
      ))}

      {filterCategory !== 'game_event' && filteredRules.length === 0 && (
        <Typography color="text.secondary" textAlign="center" mt={4}>
          Keine Regeln in dieser Kategorie.
        </Typography>
      )}

      {/* ── Spielereignistypen ────────────────────────────────────────── */}
      {(filterCategory === 'game_event' || filterCategory === 'all') && (
        <Box mb={4}>
          {filterCategory === 'all' && (
            <Box display="flex" alignItems="center" gap={1} mb={1.5}>
              <Chip
                label={CATEGORY_META['game_event'].label}
                sx={{
                  bgcolor: CATEGORY_META['game_event'].bgcolor,
                  color: CATEGORY_META['game_event'].color,
                  fontWeight: 700,
                  border: `1px solid ${CATEGORY_META['game_event'].borderColor}`,
                }}
              />
              <Typography variant="caption" color="text.secondary">{gameEventTypes.length} Typen</Typography>
            </Box>
          )}
          <GameEventTypeSection
            gameEventTypes={gameEventTypes}
            rulesMap={gameEventRulesMap}
            fallbackXp={fallbackXp}
            onSave={handleSave}
            onCreate={handleCreate}
            onDelete={handleDelete}
          />
        </Box>
      )}

      {/* ── Reset confirm dialog ───────────────────────────────────────── */}
      <Dialog open={resetConfirmOpen} onClose={() => setResetConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Standardwerte zurücksetzen?</DialogTitle>
        <DialogContent>
          <Typography>
            Alle <strong>Systemregeln</strong> (XP-Werte, Limits, Cooldowns) werden auf die
            hinterlegten Standardwerte zurückgesetzt. Eigene Regeln bleiben erhalten.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetConfirmOpen(false)}>Abbrechen</Button>
          <Button
            variant="contained"
            color="warning"
            startIcon={resetting ? <CircularProgress size={16} color="inherit" /> : <RestoreIcon />}
            onClick={handleResetDefaults}
            disabled={resetting}
          >
            Zurücksetzen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
