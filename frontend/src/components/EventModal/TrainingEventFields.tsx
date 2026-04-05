import React, { useMemo, useCallback } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  Chip,
  TextField,
  Alert,
  Stack,
} from '@mui/material';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import RepeatIcon from '@mui/icons-material/Repeat';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TimerIcon from '@mui/icons-material/Timer';
import { EventData, SelectOption } from '../../types/event';

interface TrainingEventFieldsProps {
  formData: EventData;
  teams: SelectOption[];
  handleChange: (field: string, value: any) => void;
}

const WEEKDAYS = [
  { value: 1, label: 'Mo' },
  { value: 2, label: 'Di' },
  { value: 3, label: 'Mi' },
  { value: 4, label: 'Do' },
  { value: 5, label: 'Fr' },
  { value: 6, label: 'Sa' },
  { value: 0, label: 'So' },
];

/**
 * Returns a Set of date strings (YYYY-MM-DD) for all matching weekdays
 * between startDate and endDate (both inclusive).
 */
function getOccurrenceDateSet(startDate: string, endDate: string, weekdays: number[]): Set<string> {
  const result = new Set<string>();
  if (!startDate || !endDate || weekdays.length === 0) return result;
  const end = new Date(endDate);
  const cursor = new Date(startDate);
  if (end < cursor) return result;
  while (cursor <= end) {
    if (weekdays.includes(cursor.getDay())) {
      result.add(cursor.toISOString().slice(0, 10));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

/**
 * Calculates number of occurrences for a recurring weekly schedule.
 */
function countOccurrences(
  startDate: string,
  endDate: string,
  weekdays: number[],
): number {
  if (!startDate || !endDate || weekdays.length === 0) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) return 0;

  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    if (weekdays.includes(cursor.getDay())) {
      count++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

const DURATION_PRESETS = [60, 75, 90, 105, 120];

/**
 * Computes end time string (HH:mm) from a start time + duration in minutes.
 */
function computeEndTime(startTime: string, durationMinutes: number): string {
  if (!startTime) return '';
  const [h, m] = startTime.split(':').map(Number);
  const totalMins = h * 60 + m + durationMinutes;
  const endH = Math.floor(totalMins / 60) % 24;
  const endM = totalMins % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

const TrainingEventFieldsComponent: React.FC<TrainingEventFieldsProps> = ({
  formData,
  teams,
  handleChange,
}) => {
  const selectedWeekdays = formData.trainingWeekdays || [];
  const isRecurring = formData.trainingRecurring || false;
  const trainingDuration = formData.trainingDuration || 90;

  const toggleWeekday = (day: number) => {
    const current = [...selectedWeekdays];
    const idx = current.indexOf(day);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(day);
    }
    handleChange('trainingWeekdays', current);
  };

  // Auto-compute endTime when time or duration changes
  const handleTimeChange = useCallback((newTime: string) => {
    handleChange('time', newTime);
    if (newTime) {
      handleChange('endTime', computeEndTime(newTime, trainingDuration));
    }
  }, [handleChange, trainingDuration]);

  const handleDurationChange = useCallback((newDuration: number) => {
    handleChange('trainingDuration', newDuration);
    if (formData.time) {
      handleChange('endTime', computeEndTime(formData.time, newDuration));
    }
  }, [handleChange, formData.time]);

  const occurrenceCount = useMemo(() => {
    if (!isRecurring) return 0;
    return countOccurrences(
      formData.date || '',
      formData.trainingEndDate || '',
      selectedWeekdays,
    );
  }, [isRecurring, formData.date, formData.trainingEndDate, selectedWeekdays]);

  const seriesDiff = useMemo(() => {
    const { trainingSeriesId, trainingOriginalDate, trainingOriginalEndDate, trainingOriginalWeekdays } = formData;
    if (!trainingSeriesId || !trainingOriginalDate || !trainingOriginalEndDate || !trainingOriginalWeekdays) {
      return null;
    }
    const originalSet = getOccurrenceDateSet(trainingOriginalDate, trainingOriginalEndDate, trainingOriginalWeekdays);
    const newSet = getOccurrenceDateSet(formData.date || '', formData.trainingEndDate || '', selectedWeekdays);
    const added   = [...newSet].filter(d => !originalSet.has(d)).length;
    const removed = [...originalSet].filter(d => !newSet.has(d)).length;
    if (added === 0 && removed === 0) return null;
    return { added, removed, total: newSet.size };
  }, [
    formData.trainingSeriesId,
    formData.trainingOriginalDate,
    formData.trainingOriginalEndDate,
    formData.trainingOriginalWeekdays,
    formData.date,
    formData.trainingEndDate,
    selectedWeekdays,
  ]);

  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <FitnessCenterIcon color="success" fontSize="small" />
        <Typography variant="subtitle2" color="success.main" fontWeight="bold">
          Training
        </Typography>
      </Box>

      <FormControl fullWidth margin="normal" size="small">
        <InputLabel id="training-team-label">Team *</InputLabel>
        <Select
          labelId="training-team-label"
          value={formData.trainingTeamId || ''}
          label="Team *"
          onChange={e => handleChange('trainingTeamId', e.target.value as string)}
        >
          <MenuItem value=""><em>Bitte wählen...</em></MenuItem>
          {teams.map(t => (
            <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Time + Duration */}
      <Box sx={{
        p: 2, mt: 1, mb: 1,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.default',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
          <AccessTimeIcon fontSize="small" color="action" />
          <Typography variant="body2" fontWeight="medium">Uhrzeit &amp; Dauer</Typography>
        </Box>

        <Stack direction="row" spacing={2}>
          <TextField
            label="Beginn"
            type="time"
            value={formData.time || ''}
            onChange={e => handleTimeChange(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{ flex: 1 }}
          />
          <TextField
            label="Ende"
            type="time"
            value={formData.endTime || ''}
            size="small"
            InputLabelProps={{ shrink: true }}
            InputProps={{ readOnly: true }}
            sx={{ flex: 1, '& input': { color: 'text.secondary' } }}
          />
        </Stack>

        <Box sx={{ mt: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <TimerIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">Dauer (Minuten)</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {DURATION_PRESETS.map(d => (
              <Chip
                key={d}
                label={`${d} min`}
                color={trainingDuration === d ? 'success' : 'default'}
                variant={trainingDuration === d ? 'filled' : 'outlined'}
                onClick={() => handleDurationChange(d)}
                size="small"
                sx={{ fontWeight: 'bold' }}
              />
            ))}
            <TextField
              type="number"
              value={trainingDuration}
              onChange={e => {
                const v = parseInt(e.target.value, 10);
                if (v > 0 && v <= 480) handleDurationChange(v);
              }}
              size="small"
              inputProps={{ min: 15, max: 480, step: 5 }}
              sx={{ width: 80 }}
            />
          </Box>
        </Box>
      </Box>

      <FormControlLabel
        control={
          <Switch
            checked={isRecurring}
            onChange={e => handleChange('trainingRecurring', e.target.checked)}
            color="success"
          />
        }
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <RepeatIcon fontSize="small" />
            <span>Wiederkehrendes Training</span>
          </Box>
        }
        sx={{ mt: 1, mb: 1 }}
      />

      {isRecurring && (
        <Box sx={{
          p: 2,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'success.light',
          backgroundColor: 'success.50',
          bgcolor: 'rgba(46, 125, 50, 0.04)',
        }}>
          <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 'medium' }}>
            Wochentage auswählen:
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
            {WEEKDAYS.map(wd => (
              <Chip
                key={wd.value}
                label={wd.label}
                color={selectedWeekdays.includes(wd.value) ? 'success' : 'default'}
                variant={selectedWeekdays.includes(wd.value) ? 'filled' : 'outlined'}
                onClick={() => toggleWeekday(wd.value)}
                sx={{ fontWeight: 'bold', minWidth: 44 }}
              />
            ))}
          </Box>

          <TextField
            label="Serie bis (letztes Datum)"
            type="date"
            value={formData.trainingEndDate || ''}
            onChange={e => handleChange('trainingEndDate', e.target.value)}
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
            inputProps={{
              min: formData.date || undefined,
            }}
          />

          {occurrenceCount > 0 && !formData.trainingSeriesId && (
            // Create mode: show how many events will be created
            <Alert severity="info" sx={{ mt: 2 }} icon={<RepeatIcon />}>
              <strong>{occurrenceCount} Trainings</strong> werden erstellt
              {formData.date && formData.trainingEndDate && (
                <> ({formData.date} bis {formData.trainingEndDate})</>
              )}
            </Alert>
          )}

          {seriesDiff && (
            // Edit mode: show exact added + removed counts independently
            <Alert
              severity={seriesDiff.removed > 0 && seriesDiff.added === 0 ? 'warning' : 'info'}
              sx={{ mt: 2 }}
              icon={<RepeatIcon />}
            >
              {seriesDiff.added > 0 && (
                <><strong>+{seriesDiff.added} neue Trainings</strong> werden hinzugefügt</>
              )}
              {seriesDiff.added > 0 && seriesDiff.removed > 0 && <br />}
              {seriesDiff.removed > 0 && (
                <><strong>−{seriesDiff.removed} Trainings</strong> werden entfernt</>
              )}
              <> (insgesamt dann: {seriesDiff.total})</>
            </Alert>
          )}

          {isRecurring && selectedWeekdays.length === 0 && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              Bitte mindestens einen Wochentag auswählen.
            </Alert>
          )}
        </Box>
      )}
    </Box>
  );
};

export const TrainingEventFields = React.memo(TrainingEventFieldsComponent);
