import React, { useMemo } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import { Box, Divider, TextField, Typography } from '@mui/material';
import { getGameEventIconByCode } from '../constants/gameEventIcons';
import { withGroups } from '../utils/eventTypeGroups';

export interface EventTypeOption {
  id: number;
  name: string;
  code?: string;
  /** Nur vorhanden wenn aus GameEventModal (Spielereignis) */
  icon?: string;
  color?: string;
}

interface EventTypeAutocompleteProps {
  options: EventTypeOption[];
  /** Aktuell gewählter Wert als ID-String ('' = kein Wert) */
  value: string;
  onChange: (idString: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  sx?: object;
}

/**
 * Gruppiertes, durchsuchbares Auswahlfeld für Ereignistypen.
 * Wird in GameEventModal und im ReportBuilder-StepFilters verwendet.
 */
export const EventTypeAutocomplete: React.FC<EventTypeAutocompleteProps> = ({
  options,
  value,
  onChange,
  label = 'Ereignistyp',
  placeholder = 'Suchen oder tippen…',
  required = false,
  disabled = false,
  sx,
}) => {
  const grouped = useMemo(() => withGroups(options), [options]);

  const selected = grouped.find(o => o.id === Number(value)) ?? null;

  const showIcon = options.some(o => o.icon != null);

  return (
    <Autocomplete
      options={grouped}
      groupBy={(option) => option.group}
      getOptionLabel={(option) => option.name}
      value={selected}
      onChange={(_, opt) => onChange(opt ? String(opt.id) : '')}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      noOptionsText="Kein Ereignistyp gefunden"
      disabled={disabled}
      sx={sx}
      renderGroup={(params) => (
        <li key={params.key}>
          <Divider />
          <Box
            sx={{
              px: 2,
              py: 0.5,
              bgcolor: 'background.paper',
              position: 'sticky',
              top: -8,
              zIndex: 1,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.primary' }}
            >
              {params.group}
            </Typography>
          </Box>
          <ul style={{ padding: 0 }}>{params.children}</ul>
        </li>
      )}
      renderOption={(props, option) => {
        const { key, ...liProps } = props as React.HTMLAttributes<HTMLLIElement> & { key?: React.Key };
        return (
          <li key={key ?? option.id} {...liProps}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {showIcon && (
                <Box sx={{ color: option.color, display: 'flex', alignItems: 'center', minWidth: 20, flexShrink: 0 }}>
                  {getGameEventIconByCode(option.icon ?? '')}
                </Box>
              )}
              <Typography variant="body2">{option.name}</Typography>
            </Box>
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          required={required}
          sx={selected ? { '& .MuiInputBase-input': { fontWeight: 600, color: 'primary.main' } } : undefined}
        />
      )}
    />
  );
};
