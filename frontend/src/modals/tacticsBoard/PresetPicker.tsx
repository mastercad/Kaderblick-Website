/**
 * PresetPicker
 *
 * A compact popover that lets coaches browse, load, save and delete
 * tactic presets.  Opened via the "Vorlagen" button in TacticsToolbar.
 *
 * UX principles:
 *  - Loading a preset always creates a NEW tactic tab (never overwrites work)
 *  - Category chips filter the list instantly
 *  - The inline save-form expands at the bottom (no second modal)
 *  - Keyboard-friendly (Escape closes)
 */
import React, { useState, useCallback } from 'react';
import {
  Popover,
  Box,
  Typography,
  Chip,
  Button,
  IconButton,
  Divider,
  CircularProgress,
  Alert,
  TextField,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import BookmarksOutlinedIcon from '@mui/icons-material/BookmarksOutlined';
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import CheckIcon from '@mui/icons-material/Check';

import type { TacticPreset, PresetCategory } from './types';
import { PRESET_CATEGORIES } from './types';
import { usePresets, type SavePresetArgs } from './usePresets';

// ---------------------------------------------------------------------------
// Category chip colors
// ---------------------------------------------------------------------------
const CATEGORY_COLOR: Record<string, string> = {
  Pressing:    '#ef4444',
  Angriff:     '#22c55e',
  Standards:   '#f97316',
  Spielaufbau: '#3b82f6',
  Defensive:   '#a855f7',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface PresetRowProps {
  preset: TacticPreset;
  onLoad: (preset: TacticPreset) => void;
  onDelete?: (id: number) => void;
}

function PresetRow({ preset, onLoad, onDelete }: PresetRowProps) {
  const [justLoaded, setJustLoaded] = useState(false);

  const handleLoad = useCallback(() => {
    onLoad(preset);
    setJustLoaded(true);
    setTimeout(() => setJustLoaded(false), 1500);
  }, [onLoad, preset]);

  const categoryColor = CATEGORY_COLOR[preset.category] ?? '#888';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        px: 1.5,
        py: 1,
        borderRadius: 1,
        '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
        transition: 'background 0.15s',
      }}
    >
      {/* Category dot */}
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: categoryColor,
          mt: '6px',
          flexShrink: 0,
        }}
      />

      {/* Text */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{ color: '#e5e7eb', fontWeight: 500, lineHeight: 1.3 }}
          noWrap
        >
          {preset.title}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: '#9ca3af', lineHeight: 1.3, display: 'block' }}
        >
          {preset.description.length > 70
            ? preset.description.slice(0, 70) + '…'
            : preset.description}
        </Typography>
        {!preset.isSystem && preset.createdBy && (
          <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '0.65rem' }}>
            von {preset.createdBy}{preset.clubId ? ' · Team' : ''}
          </Typography>
        )}
      </Box>

      {/* Actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, ml: 0.5 }}>
        {preset.canDelete && onDelete && (
          <Tooltip title="Vorlage löschen" placement="top">
            <IconButton
              size="small"
              onClick={() => onDelete(preset.id as number)}
              sx={{ color: '#6b7280', '&:hover': { color: '#ef4444' }, p: 0.25 }}
            >
              <DeleteOutlinedIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}

        <Button
          size="small"
          variant={justLoaded ? 'contained' : 'outlined'}
          color={justLoaded ? 'success' : 'primary'}
          startIcon={justLoaded ? <CheckIcon sx={{ fontSize: 12 }} /> : undefined}
          onClick={handleLoad}
          sx={{
            fontSize: '0.7rem',
            py: 0.25,
            px: 1,
            minWidth: 0,
            borderRadius: 1,
            textTransform: 'none',
            borderColor: '#374151',
            color: justLoaded ? undefined : '#9ca3af',
            '&:hover': { borderColor: '#22c55e', color: '#22c55e' },
          }}
        >
          {justLoaded ? 'Geladen' : 'Laden'}
        </Button>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Save form
// ---------------------------------------------------------------------------

interface SaveFormProps {
  onSave: (args: SavePresetArgs) => Promise<void>;
  onCancel: () => void;
}

function SaveForm({ onSave, onCancel }: SaveFormProps) {
  const [title, setTitle]           = useState('');
  const [category, setCategory]     = useState<PresetCategory>('Pressing');
  const [description, setDescription] = useState('');
  const [shareWithClub, setShareWithClub] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    setErr(null);
    try {
      await onSave({ title: title.trim(), category, description: description.trim(), shareWithClub, data: {} as SavePresetArgs['data'] });
    } catch {
      setErr('Speichern fehlgeschlagen. Bitte erneut versuchen.');
      setSaving(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ px: 1.5, py: 1 }}>
      <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Aktuelle Taktik speichern
      </Typography>
      {err && <Alert severity="error" sx={{ mt: 0.5, py: 0, fontSize: '0.75rem' }}>{err}</Alert>}
      <TextField
        fullWidth
        size="small"
        label="Name der Vorlage"
        value={title}
        onChange={e => setTitle(e.target.value)}
        required
        autoFocus
        sx={{
          mt: 1,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#374151' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#4b5563' },
          '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3b82f6' },
        }}
        slotProps={{
          input: { sx: { fontSize: '0.8rem', color: '#e5e7eb' } },
          inputLabel: { sx: { fontSize: '0.8rem', color: '#9ca3af' } }
        }} />
      <TextField
        select
        fullWidth
        size="small"
        label="Kategorie"
        value={category}
        onChange={e => setCategory(e.target.value as PresetCategory)}
        sx={{
          mt: 1,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#374151' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#4b5563' },
          '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3b82f6' },
          '& .MuiSvgIcon-root': { color: '#9ca3af' },
        }}
        slotProps={{
          input: { sx: { fontSize: '0.8rem', color: '#e5e7eb' } },
          select: { MenuProps: { slotProps: { paper: { sx: { bgcolor: '#1f2937', color: '#e5e7eb' } } } } },
          inputLabel: { sx: { fontSize: '0.8rem', color: '#9ca3af' } }
        }}>
        {PRESET_CATEGORIES.map(cat => (
          <MenuItem key={cat} value={cat} sx={{ fontSize: '0.8rem', color: '#e5e7eb', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' }, '&.Mui-selected': { bgcolor: 'rgba(59,130,246,0.2)' }, '&.Mui-selected:hover': { bgcolor: 'rgba(59,130,246,0.3)' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: CATEGORY_COLOR[cat] ?? '#888' }} />
              {cat}
            </Box>
          </MenuItem>
        ))}
      </TextField>
      <TextField
        fullWidth
        size="small"
        label="Kurzbeschreibung (optional)"
        value={description}
        onChange={e => setDescription(e.target.value)}
        multiline
        maxRows={2}
        sx={{
          mt: 1,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#374151' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#4b5563' },
          '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3b82f6' },
        }}
        slotProps={{
          input: { sx: { fontSize: '0.8rem', color: '#e5e7eb' } },
          inputLabel: { sx: { fontSize: '0.8rem', color: '#9ca3af' } }
        }} />
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={shareWithClub}
            onChange={e => setShareWithClub(e.target.checked)}
            sx={{ py: 0.25 }}
          />
        }
        label={
          <Typography variant="caption" sx={{ color: '#9ca3af' }}>
            Mit meinem Team teilen
          </Typography>
        }
        sx={{ mt: 0.5 }}
      />
      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
        <Button
          type="button"
          size="small"
          variant="text"
          onClick={onCancel}
          sx={{ flex: 1, fontSize: '0.75rem', color: '#6b7280', textTransform: 'none' }}
        >
          Abbrechen
        </Button>
        <Button
          type="submit"
          size="small"
          variant="contained"
          disabled={saving || !title.trim()}
          startIcon={saving ? <CircularProgress size={12} /> : undefined}
          sx={{ flex: 2, fontSize: '0.75rem', textTransform: 'none', bgcolor: '#1d4ed8', '&:hover': { bgcolor: '#1e40af' } }}
        >
          {saving ? 'Speichern…' : 'Speichern'}
        </Button>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface PresetPickerProps {
  anchorEl: Element | null;
  onClose: () => void;
  /**
   * Called when the user clicks "Laden".
   * The preset data needs to be turned into a new TacticEntry tab.
   */
  onLoadPreset: (preset: TacticPreset) => void;
  /**
   * The currently active tactic's data, passed to save action.
   * When undefined the save form is hidden.
   */
  currentTacticData?: TacticPreset['data'];
}

export function PresetPicker({ anchorEl, onClose, onLoadPreset, currentTacticData }: PresetPickerProps) {
  const open = Boolean(anchorEl);

  const { byCategory, presets, loading, error, savePreset, deletePreset } = usePresets(open);

  const [activeCategory, setActiveCategory] = useState<string>('Alle');
  const [showSaveForm, setShowSaveForm]     = useState(false);
  const [deleteError, setDeleteError]       = useState<string | null>(null);

  // ── Filter ──────────────────────────────────────────────────────────────
  const categories = Object.keys(byCategory).sort();

  const visiblePresets: TacticPreset[] =
    activeCategory === 'Alle'
      ? presets
      : (byCategory[activeCategory] ?? []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleLoad = useCallback((preset: TacticPreset) => {
    onLoadPreset(preset);
  }, [onLoadPreset]);

  const handleDelete = useCallback(async (id: number) => {
    setDeleteError(null);
    try {
      await deletePreset(id);
    } catch {
      setDeleteError('Löschen fehlgeschlagen.');
    }
  }, [deletePreset]);

  const handleSave = useCallback(async (args: SavePresetArgs) => {
    if (!currentTacticData) return;
    await savePreset({ ...args, data: currentTacticData });
    setShowSaveForm(false);
  }, [savePreset, currentTacticData]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{
        paper: {
          sx: {
            width: 360,
            maxHeight: 520,
            bgcolor: '#111827',
            border: '1px solid #1f2937',
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        }
      }}
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1.5,
          pt: 1.25,
          pb: 0.75,
          borderBottom: '1px solid #1f2937',
          flexShrink: 0,
        }}
      >
        <BookmarksOutlinedIcon sx={{ fontSize: 16, color: '#facc15', mr: 0.75 }} />
        <Typography variant="body2" sx={{ color: '#e5e7eb', fontWeight: 600, flex: 1 }}>
          Taktik-Vorlagen
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: '#6b7280', p: 0.25, '&:hover': { color: '#e5e7eb' } }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
      {/* ── Category chips ────────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 0.5,
          px: 1.5,
          py: 0.75,
          borderBottom: '1px solid #1f2937',
          flexShrink: 0,
        }}
      >
        {['Alle', ...categories].map(cat => (
          <Chip
            key={cat}
            label={cat}
            size="small"
            clickable
            onClick={() => setActiveCategory(cat)}
            sx={{
              fontSize: '0.7rem',
              height: 22,
              borderRadius: 1,
              bgcolor: activeCategory === cat ? (CATEGORY_COLOR[cat] ?? '#4b5563') : 'transparent',
              color: activeCategory === cat ? '#fff' : '#9ca3af',
              border: `1px solid ${activeCategory === cat ? (CATEGORY_COLOR[cat] ?? '#4b5563') : '#374151'}`,
              '&:hover': { bgcolor: activeCategory === cat ? undefined : 'rgba(255,255,255,0.05)' },
            }}
          />
        ))}
      </Box>
      {/* ── Preset list ──────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflowY: 'auto', py: 0.5 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} sx={{ color: '#facc15' }} />
          </Box>
        )}

        {!loading && error && (
          <Alert severity="warning" sx={{ mx: 1.5, my: 1, py: 0.25, fontSize: '0.75rem' }}>
            {error}
          </Alert>
        )}

        {!loading && deleteError && (
          <Alert severity="error" sx={{ mx: 1.5, my: 0.5, py: 0.25, fontSize: '0.75rem' }}>
            {deleteError}
          </Alert>
        )}

        {!loading && visiblePresets.length === 0 && (
          <Typography
            variant="caption"
            sx={{ display: 'block', textAlign: 'center', color: '#6b7280', py: 3 }}
          >
            Keine Vorlagen für diese Kategorie
          </Typography>
        )}

        {!loading && visiblePresets.map((preset, idx) => (
          <React.Fragment key={preset.id}>
            {idx > 0 && <Divider sx={{ borderColor: '#1f2937', mx: 1.5 }} />}
            <PresetRow
              preset={preset}
              onLoad={handleLoad}
              onDelete={preset.canDelete ? handleDelete : undefined}
            />
          </React.Fragment>
        ))}
      </Box>
      {/* ── Save section ─────────────────────────────────────────────── */}
      {currentTacticData !== undefined && (
        <Box sx={{ borderTop: '1px solid #1f2937', flexShrink: 0 }}>
          {showSaveForm ? (
            <SaveForm
              onSave={handleSave}
              onCancel={() => setShowSaveForm(false)}
            />
          ) : (
            <Button
              fullWidth
              size="small"
              startIcon={<AddBoxOutlinedIcon sx={{ fontSize: 15 }} />}
              onClick={() => setShowSaveForm(true)}
              sx={{
                textTransform: 'none',
                color: '#9ca3af',
                fontSize: '0.75rem',
                py: 1,
                borderRadius: 0,
                justifyContent: 'flex-start',
                px: 1.5,
                '&:hover': { color: '#facc15', bgcolor: 'rgba(250,204,21,0.05)' },
              }}
            >
              Aktuelle Taktik als Vorlage speichern
            </Button>
          )}
        </Box>
      )}
    </Popover>
  );
}
