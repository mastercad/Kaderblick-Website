import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';

export type TrainingEditScope = 'single' | 'from_here' | 'same_weekday' | 'same_weekday_from_here' | 'series';

interface TrainingEditScopeModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (scope: TrainingEditScope, untilDate?: string) => void;
  loading?: boolean;
  weekdayLabel?: string; // z.B. "Dienstag"
  /** True when weekdays or series end-date were changed (structural change) */
  hasStructureChanges?: boolean;
  /** True when title / location / time / team were changed (content change) */
  hasContentChanges?: boolean;
}

export const TrainingEditScopeModal: React.FC<TrainingEditScopeModalProps> = ({
  open,
  onClose,
  onConfirm,
  loading = false,
  weekdayLabel,
  hasStructureChanges = false,
  hasContentChanges = false,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedScope, setSelectedScope] = useState<TrainingEditScope>('single');
  const [untilMode, setUntilMode] = useState<'series_end' | 'date'>('series_end');
  const [untilDate, setUntilDate] = useState('');

  // Reset wizard state whenever the dialog closes.
  useEffect(() => {
    if (!open) {
      setStep(1);
      setSelectedScope('single');
      setUntilMode('series_end');
      setUntilDate('');
    }
  }, [open]);

  const handleClose = () => {
    onClose();
  };

  const handleScopeSelect = (scope: TrainingEditScope) => {
    if (scope === 'single') {
      onConfirm('single', undefined);
      return;
    }
    setSelectedScope(scope);
    setStep(2);
  };

  const handleConfirm = () => {
    const ud = untilMode === 'date' && untilDate ? untilDate : undefined;
    onConfirm(selectedScope, ud);
  };

  // ── Structure-change mode: weekdays or series end-date were changed.
  // Scope must be 'series' — no scope question, just a clear confirmation notice.
  if (hasStructureChanges) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>Training bearbeiten</DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Alert severity="info" sx={{ mt: 1 }}>
            {hasContentChanges
              ? 'Wochentage oder Zeitraum wurden geändert – alle Änderungen werden auf die gesamte Trainingsserie angewendet.'
              : 'Wochentage oder Zeitraum wurden geändert – diese Änderungen gelten für die gesamte Trainingsserie.'}
          </Alert>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 2, py: 1 }}>
          <Button onClick={handleClose} disabled={loading} color="inherit">
            Abbrechen
          </Button>
          <Button
            onClick={() => onConfirm('series', undefined)}
            disabled={loading}
            color="primary"
            variant="contained"
          >
            Speichern
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  // ── Content-only mode: original scope-selection wizard (unchanged) ──────────

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>Training bearbeiten</DialogTitle>

      {/* ── Step 1: Which events? ───────────────────────────────────────── */}
      {step === 1 && (
        <>
          <DialogContent sx={{ pt: 0, pb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Diese Änderung gilt für …
            </Typography>
          </DialogContent>
          <Divider />
          <Stack sx={{ p: 1 }} spacing={0.5}>
            <Button
              onClick={() => handleScopeSelect('single')}
              variant="text"
              color="inherit"
              disabled={loading}
              fullWidth
              sx={{ justifyContent: 'flex-start', px: 2, py: 1 }}
            >
              Nur dieses Training
            </Button>
            {weekdayLabel && (
              <Button
                onClick={() => handleScopeSelect('same_weekday_from_here')}
                variant="text"
                color="warning"
                disabled={loading}
                fullWidth
                sx={{ justifyContent: 'flex-start', px: 2, py: 1 }}
              >
                Alle {weekdayLabel}-Trainings ab diesem
              </Button>
            )}
            <Button
              onClick={() => handleScopeSelect('from_here')}
              variant="text"
              color="warning"
              disabled={loading}
              fullWidth
              sx={{ justifyContent: 'flex-start', px: 2, py: 1 }}
            >
              Dieses und alle folgenden Trainings
            </Button>
            {weekdayLabel && (
              <Button
                onClick={() => handleScopeSelect('same_weekday')}
                variant="text"
                color="warning"
                disabled={loading}
                fullWidth
                sx={{ justifyContent: 'flex-start', px: 2, py: 1 }}
              >
                Alle {weekdayLabel}-Trainings dieser Serie
              </Button>
            )}
            <Button
              onClick={() => handleScopeSelect('series')}
              variant="text"
              color="error"
              disabled={loading}
              fullWidth
              sx={{ justifyContent: 'flex-start', px: 2, py: 1 }}
            >
              Die gesamte Trainingsserie
            </Button>
          </Stack>
          <Divider />
          <DialogActions sx={{ px: 2, py: 1 }}>
            <Button onClick={handleClose} disabled={loading} color="inherit">
              Abbrechen
            </Button>
          </DialogActions>
        </>
      )}

      {/* ── Step 2: Until when? ─────────────────────────────────────────── */}
      {step === 2 && (
        <>
          <DialogContent sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Bis wann soll die Änderung gelten?
            </Typography>
            <RadioGroup
              value={untilMode}
              onChange={(e) => setUntilMode(e.target.value as 'series_end' | 'date')}
            >
              <FormControlLabel
                value="series_end"
                control={<Radio disabled={loading} />}
                label="Bis Ende der Serie"
              />
              <FormControlLabel
                value="date"
                control={<Radio disabled={loading} />}
                label="Bis einschließlich:"
              />
            </RadioGroup>
            {untilMode === 'date' && (
              <TextField
                type="date"
                value={untilDate}
                onChange={(e) => setUntilDate(e.target.value)}
                disabled={loading}
                size="small"
                fullWidth
                sx={{ mt: 1 }}
                inputProps={{ 'aria-label': 'Enddatum' }}
              />
            )}
          </DialogContent>
          <Divider />
          <DialogActions sx={{ px: 2, py: 1 }}>
            <Button onClick={() => setStep(1)} disabled={loading} color="inherit">
              Zurück
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading || (untilMode === 'date' && !untilDate)}
              color="primary"
              variant="contained"
            >
              Speichern
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};

