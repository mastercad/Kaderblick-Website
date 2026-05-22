import React, { useEffect } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { EventData } from '../../types/event';

interface GameTimingFieldsProps {
  formData: EventData;
  onChange: (field: string, value: any) => void;
  /** Timing defaults from the selected home team (null = no team default saved) */
  teamDefaultHalfDuration?: number | null;
  teamDefaultHalftimeBreakDuration?: number | null;
}

/**
 * Step content for the STEP_TIMING wizard step.
 * Allows configuring half durations and break times for a Spiel event.
 * Pre-fills from team defaults on mount.
 */
export const GameTimingFields: React.FC<GameTimingFieldsProps> = ({
  formData,
  onChange,
  teamDefaultHalfDuration,
  teamDefaultHalftimeBreakDuration,
}) => {
  const defaultHalf  = teamDefaultHalfDuration        ?? 45;
  const defaultBreak = teamDefaultHalftimeBreakDuration ?? 15;

  // Pre-fill timing fields with team defaults (or 45/15) when the step first loads
  // and the fields have not been explicitly set yet.
  useEffect(() => {
    if (formData.gameHalfDuration === undefined || formData.gameHalfDuration === null) {
      onChange('gameHalfDuration', defaultHalf);
    }
    if (formData.gameHalftimeBreakDuration === undefined || formData.gameHalftimeBreakDuration === null) {
      onChange('gameHalftimeBreakDuration', defaultBreak);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const halfDuration         = formData.gameHalfDuration        ?? defaultHalf;
  const halftimeBreakDuration = formData.gameHalftimeBreakDuration ?? defaultBreak;

  const hasTeamDefault = teamDefaultHalfDuration != null || teamDefaultHalftimeBreakDuration != null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
      <Typography variant="subtitle1" color="primary" sx={{
        fontWeight: 600
      }}>
        Spielzeiten konfigurieren
      </Typography>
      {hasTeamDefault && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <InfoOutlinedIcon fontSize="small" color="info" />
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>
            Team-Standard:
          </Typography>
          {teamDefaultHalfDuration != null && (
            <Chip
              label={`Halbzeit: ${teamDefaultHalfDuration} Min.`}
              size="small"
              color="info"
              variant="outlined"
            />
          )}
          {teamDefaultHalftimeBreakDuration != null && (
            <Chip
              label={`Pause: ${teamDefaultHalftimeBreakDuration} Min.`}
              size="small"
              color="info"
              variant="outlined"
            />
          )}
        </Box>
      )}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Box
          sx={{
            flex: 1,
            minWidth: 180
          }}>
          <TextField
            label="Halbzeit-Dauer (Min.)"
            type="number"
            value={halfDuration}
            onChange={e => onChange('gameHalfDuration', e.target.value === '' ? null : parseInt(e.target.value, 10))}
            fullWidth
            margin="normal"
            helperText={`Standard: ${defaultHalf} Min. pro Halbzeit`}
            slotProps={{
              htmlInput: { min: 1, max: 90, step: 1 }
            }}
          />
        </Box>
        <Box
          sx={{
            flex: 1,
            minWidth: 180
          }}>
          <TextField
            label="Halbzeit-Pause (Min.)"
            type="number"
            value={halftimeBreakDuration}
            onChange={e => onChange('gameHalftimeBreakDuration', e.target.value === '' ? null : parseInt(e.target.value, 10))}
            fullWidth
            margin="normal"
            helperText={`Standard: ${defaultBreak} Min. Pause`}
            slotProps={{
              htmlInput: { min: 0, max: 60, step: 1 }
            }}
          />
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Box
          sx={{
            flex: 1,
            minWidth: 180
          }}>
          <TextField
            label="Nachspielzeit 1. Halbzeit (Min.)"
            type="number"
            value={formData.gameFirstHalfExtraTime ?? ''}
            onChange={e => onChange('gameFirstHalfExtraTime', e.target.value === '' ? null : parseInt(e.target.value, 10))}
            fullWidth
            margin="normal"
            placeholder="Optional"
            slotProps={{
              htmlInput: { min: 0, max: 30, step: 1 }
            }}
          />
        </Box>
        <Box
          sx={{
            flex: 1,
            minWidth: 180
          }}>
          <TextField
            label="Nachspielzeit 2. Halbzeit (Min.)"
            type="number"
            value={formData.gameSecondHalfExtraTime ?? ''}
            onChange={e => onChange('gameSecondHalfExtraTime', e.target.value === '' ? null : parseInt(e.target.value, 10))}
            fullWidth
            margin="normal"
            placeholder="Optional"
            slotProps={{
              htmlInput: { min: 0, max: 30, step: 1 }
            }}
          />
        </Box>
      </Box>
      <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5, mt: 1 }}>
        <Typography variant="body2" sx={{
          color: "text.secondary"
        }}>
          <strong>Voraussichtliche Spieldauer:</strong>{' '}
          {2 * halfDuration + halftimeBreakDuration} Min.
          {' '}({halfDuration} + {halftimeBreakDuration} + {halfDuration} Min.)
        </Typography>
        {!formData.endDate && (
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              mt: 0.5
            }}>
            Ist keine Endzeit angegeben, wird diese automatisch aus der Spieldauer berechnet.
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default GameTimingFields;
