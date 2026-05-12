import React, { useCallback, useEffect, useState } from 'react';
import {
  Autocomplete,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { searchShareableUsers, sharePreset } from './presetApi';
import type { QuickEventPreset, ShareableUser } from './types';

interface SharePresetDialogProps {
  preset: QuickEventPreset | null;
  onClose: () => void;
  onShared: (updated: QuickEventPreset) => void;
}

export function SharePresetDialog({ preset, onClose, onShared }: SharePresetDialogProps) {
  const open = preset !== null;

  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<ShareableUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ShareableUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset state when dialog opens with a new preset
  useEffect(() => {
    if (!open) return;
    setInputValue('');
    setOptions([]);
    setSelected([]);
    setError('');
  }, [open, preset?.id]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchShareableUsers(q);
      setOptions(results);
    } catch {
      setOptions([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounce the search
  useEffect(() => {
    const timer = setTimeout(() => { doSearch(inputValue); }, 300);
    return () => clearTimeout(timer);
  }, [inputValue, doSearch]);

  const handleSave = async () => {
    if (!preset) return;
    setSaving(true);
    setError('');
    try {
      const updated = await sharePreset(preset.id, selected.map((u) => u.id));
      onShared(updated);
      onClose();
    } catch {
      setError('Teilen fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Konfiguration teilen: „{preset?.name}"</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Wähle Trainer, Assistenten oder Supporter aus, mit denen diese Konfiguration geteilt werden soll.
          Bereits geteilte Berechtigungen werden durch diese Auswahl ersetzt.
        </Typography>
        <Autocomplete
          multiple
          options={options}
          getOptionLabel={(o) => o.fullName}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          value={selected}
          onChange={(_, newValue) => setSelected(newValue)}
          inputValue={inputValue}
          onInputChange={(_, newInput) => setInputValue(newInput)}
          loading={searching}
          noOptionsText={inputValue.length < 2 ? 'Mindestens 2 Zeichen eingeben' : 'Keine Ergebnisse'}
          filterOptions={(x) => x}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Benutzer suchen"
              placeholder="Name eingeben…"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {searching && <CircularProgress size={18} />}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Abbrechen</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
        >
          Teilen speichern
        </Button>
      </DialogActions>
    </Dialog>
  );
}
