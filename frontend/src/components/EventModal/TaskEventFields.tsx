import React from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import { EventData, User } from '../../types/event';
import { getUserLabel } from '../../utils/eventHelpers';

interface TaskEventFieldsProps {
  formData: EventData;
  users: User[];
  handleChange: (field: string, value: any) => void;
}

/**
 * Form fields specific to task events:
 * - User rotation selection
 * - Rotation count
 * - Recurring settings
 */
const TaskEventFieldsComponent: React.FC<TaskEventFieldsProps> = ({
  formData,
  users,
  handleChange,
}) => {
  return (
    <>
      <Autocomplete
        multiple
        options={users}
        getOptionLabel={getUserLabel}
        value={users.filter(u => (formData.taskRotationUsers || []).includes(u.id.toString()))}
        onChange={(_, val) => handleChange('taskRotationUsers', val.map(v => v.id.toString()))}
        renderOption={({ key, ...props }, option) => (
          <Box key={key} component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box>
              <Typography variant="body2">
                {option.fullName || `${option.firstName} ${option.lastName}`}
              </Typography>
              {option.context && (
                <Typography variant="caption" color="text.secondary">{option.context}</Typography>
              )}
            </Box>
          </Box>
        )}
        renderInput={params => <TextField {...params} label="Benutzer-Rotation" margin="normal" />}
        sx={{ mt: 2, mb: 2 }}
      />
      
      {users.length === 0 && (
        <div style={{ color: 'orange', margin: '8px 0 16px 0' }}>
          Keine Benutzer zur Auswahl vorhanden.
        </div>
      )}
      
      <TextField
        label="Personen pro Aufgabe gleichzeitig"
        type="number"
        value={formData.taskRotationCount || 1}
        onChange={e => handleChange('taskRotationCount', parseInt(e.target.value) || 1)}
        fullWidth
        margin="normal"
        inputProps={{ min: 1, max: users.length || 99 }}
      />
      
      <FormControlLabel
        control={
          <Checkbox
            checked={formData.taskIsRecurring || false}
            onChange={e => handleChange('taskIsRecurring', e.target.checked)}
          />
        }
        label="Wiederkehrend"
      />
      
      {formData.taskIsRecurring && (
        <>
          <TextField
            select
            label="Wiederkehr-Modus"
            value={formData.taskRecurrenceMode || 'classic'}
            onChange={e => handleChange('taskRecurrenceMode', e.target.value)}
            fullWidth
            margin="normal"
            SelectProps={{ native: true }}
          >
            <option value="classic">Regelmäßig (z.B. wöchentlich)</option>
            <option value="per_match">Pro Spiel (laut Spielplan)</option>
          </TextField>
          
          {(formData.taskRecurrenceMode === 'classic' || !formData.taskRecurrenceMode) && (
            <>
              <TextField
                select
                label="Frequenz"
                value={formData.taskFreq || 'WEEKLY'}
                onChange={e => handleChange('taskFreq', e.target.value)}
                fullWidth
                margin="normal"
                SelectProps={{ native: true }}
              >
                <option value="DAILY">Täglich</option>
                <option value="WEEKLY">Wöchentlich</option>
                <option value="MONTHLY">Monatlich</option>
              </TextField>
              
              <TextField
                label="Intervall (z.B. alle 2 Wochen)"
                type="number"
                value={formData.taskInterval || 1}
                onChange={e => handleChange('taskInterval', parseInt(e.target.value) || 1)}
                fullWidth
                margin="normal"
                inputProps={{ min: 1 }}
              />
              
              {((formData.taskFreq || 'WEEKLY') === 'WEEKLY' ||
                ((formData.taskFreq || 'WEEKLY') === 'DAILY' && (formData.taskInterval || 1) > 7)) && (
                <TextField
                  select
                  label="Wochentag"
                  value={formData.taskByDay || 'MO'}
                  onChange={e => handleChange('taskByDay', e.target.value)}
                  fullWidth
                  margin="normal"
                  SelectProps={{ native: true }}
                >
                  <option value="MO">Montag</option>
                  <option value="TU">Dienstag</option>
                  <option value="WE">Mittwoch</option>
                  <option value="TH">Donnerstag</option>
                  <option value="FR">Freitag</option>
                  <option value="SA">Samstag</option>
                  <option value="SU">Sonntag</option>
                </TextField>
              )}
              
              {(formData.taskFreq || 'WEEKLY') === 'MONTHLY' && (
                <TextField
                  label="Tag des Monats"
                  type="number"
                  value={formData.taskByMonthDay || 1}
                  onChange={e => handleChange('taskByMonthDay', parseInt(e.target.value) || 1)}
                  fullWidth
                  margin="normal"
                  inputProps={{ min: 1, max: 31 }}
                />
              )}
            </>
          )}
          
          {formData.taskRecurrenceMode === 'per_match' && (
            <>
              <p>Die Aufgabe wird automatisch jedem Spiel zugeordnet.</p>
              <TextField
                label="Beginn der Aufgabe, relativ zum Spieltag (z.B. 1 = am Spieltag, 2 = einen Tag nach dem Spieltag, negativ = vor dem Spieltag)"
                type="number"
                value={formData.taskOffset || 0}
                onChange={e => handleChange('taskOffset', parseInt(e.target.value) || 0)}
                fullWidth
                margin="normal"
                inputProps={{ min: -365, max: 365 }}
              />
            </>
          )}
        </>
      )}
    </>
  );
};

export const TaskEventFields = React.memo(TaskEventFieldsComponent);
