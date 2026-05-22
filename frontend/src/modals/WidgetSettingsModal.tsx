import React, { useState } from 'react';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import BaseModal from './BaseModal';
import type { CalendarViewMode } from '../widgets/CalendarWidget';

export interface WidgetSettingsModalProps {
  open: boolean;
  currentWidth: number | string;
  widgetType?: string;
  widgetConfig?: any;
  onClose: () => void;
  onSave: (width: number | string, config?: any) => void;
}

const GRID_OPTIONS = [
  { value: 3, label: 'Schmal (25%)' },
  { value: 4, label: 'Normal (33%)' },
  { value: 6, label: 'Halbe Breite (50%)' },
  { value: 8, label: 'Groß (66%)' },
  { value: 12, label: 'Volle Breite (100%)' },
];

const VIEW_MODE_OPTIONS: { value: CalendarViewMode; label: string; offsetLabel: string }[] = [
  { value: 'day', label: 'Tag', offsetLabel: 'Tage' },
  { value: 'week', label: 'Woche', offsetLabel: 'Wochen' },
  { value: 'month', label: 'Monat', offsetLabel: 'Monate' },
];

export const WidgetSettingsModal: React.FC<WidgetSettingsModalProps> = ({
  open, currentWidth, widgetType, widgetConfig, onClose, onSave,
}) => {
  const [width, setWidth] = useState<number>(typeof currentWidth === 'number' ? currentWidth : 6);

  // Calendar-specific config
  const [viewMode, setViewMode] = useState<CalendarViewMode>(widgetConfig?.viewMode || 'month');
  const [offset, setOffset] = useState<number>(widgetConfig?.offset ?? 0);

  React.useEffect(() => {
    setWidth(typeof currentWidth === 'number' ? currentWidth : 6);
    setViewMode(widgetConfig?.viewMode || 'month');
    setOffset(widgetConfig?.offset ?? 0);
  }, [currentWidth, widgetConfig, open]);

  const handleSave = () => {
    if (widgetType === 'calendar') {
      onSave(width, { ...widgetConfig, viewMode, offset });
    } else {
      onSave(width, widgetConfig);
    }
  };

  const selectedViewMode = VIEW_MODE_OPTIONS.find(v => v.value === viewMode);
  const offsetUnitLabel = selectedViewMode?.offsetLabel || 'Einheiten';

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title="Widget-Einstellungen"
      maxWidth="xs"
      actions={
        <>
          <Button onClick={onClose} variant="outlined" color="secondary">
            Abbrechen
          </Button>
          <Button onClick={handleSave} variant="contained" color="primary">
            Speichern
          </Button>
        </>
      }
    >
      <FormControl fullWidth sx={{ mt: 2 }}>
        <InputLabel id="widget-width-label">Breite</InputLabel>
        <Select
          labelId="widget-width-label"
          value={width}
          label="Breite"
          onChange={e => setWidth(Number(e.target.value))}
        >
          {GRID_OPTIONS.map(opt => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
      {widgetType === 'calendar' && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Kalender-Ansicht
          </Typography>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="calendar-view-mode-label">Ansichtsmodus</InputLabel>
            <Select
              labelId="calendar-view-mode-label"
              value={viewMode}
              label="Ansichtsmodus"
              onChange={e => setViewMode(e.target.value as CalendarViewMode)}
            >
              {VIEW_MODE_OPTIONS.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label={`Offset (${offsetUnitLabel} relativ zu heute)`}
            type="number"
            value={offset}
            onChange={e => setOffset(parseInt(e.target.value, 10) || 0)}
            helperText={
              <Box component="span">
                {offset === 0
                  ? `Zeigt den aktuellen ${selectedViewMode?.label || 'Zeitraum'}`
                  : offset > 0
                    ? `Zeigt ${offset} ${offsetUnitLabel} in der Zukunft`
                    : `Zeigt ${Math.abs(offset)} ${offsetUnitLabel} in der Vergangenheit`}
              </Box>
            }
            slotProps={{
              htmlInput: { min: -52, max: 52 }
            }}
          />
        </>
      )}
    </BaseModal>
  );
};
