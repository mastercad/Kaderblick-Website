import React from 'react';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Autocomplete from '@mui/material/Autocomplete';
import { EventData, SelectOption } from '../../types/event';

interface EventBaseFormProps {
  formData: EventData;
  eventTypes: SelectOption[];
  locations: SelectOption[];
  handleChange: (field: string, value: any) => void;
  titleRequired?: boolean;
}

/**
 * Base form fields for all event types:
 * - Title
 * - Date/Time
 * - End Date/Time
 * - Event Type
 */
const EventBaseFormComponent: React.FC<EventBaseFormProps> = ({
  formData,
  eventTypes,
  locations,
  handleChange,
  titleRequired = true,
}) => {
  return (
    <>
      <TextField
        label={titleRequired ? 'Titel *' : 'Titel (optional)'}
        value={formData.title || ''}
        onChange={e => handleChange('title', e.target.value)}
        fullWidth
        margin="normal"
        required={titleRequired}
      />
      
      <TextField
        label="Datum *"
        type="date"
        value={formData.date || ''}
        onChange={e => handleChange('date', e.target.value)}
        fullWidth
        margin="normal"
        required
        InputLabelProps={{ shrink: true }}
      />
      
      <TextField
        label="Uhrzeit"
        type="time"
        value={formData.time || ''}
        onChange={e => handleChange('time', e.target.value)}
        fullWidth
        margin="normal"
        InputLabelProps={{ shrink: true }}
      />
      
      <TextField
        label="End-Datum"
        type="date"
        value={formData.endDate || ''}
        onChange={e => handleChange('endDate', e.target.value)}
        fullWidth
        margin="normal"
        InputLabelProps={{ shrink: true }}
      />
      
      <TextField
        label="End-Uhrzeit"
        type="time"
        value={formData.endTime || ''}
        onChange={e => handleChange('endTime', e.target.value)}
        fullWidth
        margin="normal"
        InputLabelProps={{ shrink: true }}
      />
      
      <FormControl fullWidth margin="normal" required>
        <InputLabel id="event-type-label">Event-Typ *</InputLabel>
        <Select
          labelId="event-type-label"
          value={formData.eventType || ''}
          label="Event-Typ *"
          onChange={e => handleChange('eventType', e.target.value as string)}
        >
          <MenuItem value=""><em>Bitte wählen...</em></MenuItem>
          {eventTypes.map(opt => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </>
  );
};

export const EventBaseForm = React.memo(EventBaseFormComponent);
