import React, { useEffect } from 'react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { EventData } from '../../types/event';

const WEEKDAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

interface TrainingSeriesScopeStepProps {
  event: EventData;
  handleChange: (field: string, value: any) => void;
  /** When true, only the series end date was changed — hide the "Bis wann" section
   *  (it is circular) and remove the "only this event" option (it would not extend the series). */
  onlyEndDateChanged?: boolean;
}

/**
 * Wizard step rendered when editing a training that belongs to a series.
 * Lets the user choose which events the changes should apply to (scope),
 * and optionally until when.
 */
export const TrainingSeriesScopeStep: React.FC<TrainingSeriesScopeStepProps> = ({ event, handleChange, onlyEndDateChanged = false }) => {
  const scope     = event.trainingEditScope || 'single';
  const untilDate = event.trainingEditScopeUntilDate || '';

  const eventDate     = event.date ? new Date(event.date) : null;
  const weekdayLabel  = eventDate ? WEEKDAY_NAMES[eventDate.getDay()] : null;

  // When only the end date changed, "single" scope makes no sense (no new events would
  // be generated). Auto-switch to "series" so the backend takes the right path.
  useEffect(() => {
    if (onlyEndDateChanged && scope === 'single') {
      handleChange('trainingEditScope', 'series');
    }
  }, [onlyEndDateChanged, scope, handleChange]);

  const showUntilSection = scope !== 'single' && !onlyEndDateChanged;
  const hasUntilDate     = !!untilDate;

  const handleScopeChange = (newScope: string) => {
    handleChange('trainingEditScope', newScope);
    // Clear until-date when switching to 'single' (meaningless there)
    if (newScope === 'single') {
      handleChange('trainingEditScopeUntilDate', '');
    }
  };

  return (
    <Box>
      <FormControl component="fieldset" fullWidth>
        <FormLabel component="legend">
          <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 0.5 }}>
            Diese Änderung gilt für …
          </Typography>
        </FormLabel>
        <RadioGroup
          value={scope}
          onChange={e => handleScopeChange(e.target.value)}
        >
          {!onlyEndDateChanged && (
            <FormControlLabel
              value="single"
              control={<Radio size="small" />}
              label="Nur dieses Training"
            />
          )}
          {weekdayLabel && (
            <FormControlLabel
              value="same_weekday_from_here"
              control={<Radio size="small" />}
              label={`Alle ${weekdayLabel}-Trainings ab diesem`}
            />
          )}
          <FormControlLabel
            value="from_here"
            control={<Radio size="small" />}
            label="Dieses und alle folgenden Trainings"
          />
          {weekdayLabel && (
            <FormControlLabel
              value="same_weekday"
              control={<Radio size="small" />}
              label={`Alle ${weekdayLabel}-Trainings dieser Serie`}
            />
          )}
          <FormControlLabel
            value="series"
            control={<Radio size="small" />}
            label="Die gesamte Trainingsserie"
          />
        </RadioGroup>
      </FormControl>

      {showUntilSection && (
        <>
          <Divider sx={{ my: 2 }} />
          <FormControl component="fieldset" fullWidth>
            <FormLabel component="legend">
              <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 0.5 }}>
                Bis wann gilt die Änderung?
              </Typography>
            </FormLabel>
            <RadioGroup
              value={hasUntilDate ? 'date' : 'series_end'}
              onChange={e => {
                if (e.target.value === 'series_end') {
                  handleChange('trainingEditScopeUntilDate', '');
                } else {
                  // Pre-fill with series end-date as a sensible default
                  handleChange('trainingEditScopeUntilDate', event.trainingEndDate || '');
                }
              }}
            >
              <FormControlLabel
                value="series_end"
                control={<Radio size="small" />}
                label="Bis Ende der Serie"
              />
              <FormControlLabel
                value="date"
                control={<Radio size="small" />}
                label="Bis einschließlich:"
              />
            </RadioGroup>
            {hasUntilDate && (
              <TextField
                type="date"
                value={untilDate}
                onChange={e => handleChange('trainingEditScopeUntilDate', e.target.value)}
                size="small"
                sx={{ mt: 1, maxWidth: 220 }}
                inputProps={{ 'aria-label': 'Enddatum' }}
              />
            )}
          </FormControl>
        </>
      )}
    </Box>
  );
};
