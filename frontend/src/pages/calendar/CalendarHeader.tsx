import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';

interface EventTypeEntry {
  id: number;
  name: string;
  color?: string;
}

interface Props {
  isMobile: boolean;
  eventTypeEntries: EventTypeEntry[];
  createAndEditAllowed: boolean;
  activeEventTypeIds: Set<number>;
  onToggleEventType: (id: number) => void;
  onAddEvent: () => void;
}

export function CalendarHeader({
  isMobile,
  eventTypeEntries,
  createAndEditAllowed,
  activeEventTypeIds,
  onToggleEventType,
  onAddEvent,
}: Props) {
  return (
    <Box
      sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: { xs: 0, sm: 2 } }}
    >
      <Typography variant={isMobile ? 'h5' : 'h4'} component="h1">
        Kalender
      </Typography>

      {/* Desktop: Chips + Button in title row */}
      {!isMobile && (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {eventTypeEntries.map(et => (
              <Chip
                key={et.id}
                label={et.name}
                onClick={() => onToggleEventType(et.id)}
                variant={activeEventTypeIds.has(et.id) ? 'filled' : 'outlined'}
                sx={{
                  backgroundColor: activeEventTypeIds.has(et.id)
                    ? et.color || '#1976d2'
                    : 'transparent',
                  color: activeEventTypeIds.has(et.id)
                    ? '#ffffff'
                    : et.color || '#1976d2',
                  borderColor: et.color || '#1976d2',
                  fontWeight: 'bold',
                  '&:hover': {
                    backgroundColor: activeEventTypeIds.has(et.id)
                      ? et.color || '#1976d2'
                      : `${et.color || '#1976d2'}20`,
                    transform: 'scale(1.05)',
                  },
                  '&:active': { transform: 'scale(0.95)' },
                }}
              />
            ))}
          </Stack>
          {createAndEditAllowed && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={onAddEvent}>
              Neues Event
            </Button>
          )}
        </Box>
      )}

      {/* Mobile: only Add icon button */}
      {isMobile && createAndEditAllowed && (
        <IconButton
          onClick={onAddEvent}
          color="primary"
          sx={{
            bgcolor: 'primary.main',
            color: '#fff',
            '&:hover': { bgcolor: 'primary.dark' },
            borderRadius: 2,
          }}
          size="small"
        >
          <AddIcon />
        </IconButton>
      )}
    </Box>
  );
}
