import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Collapse,
  useTheme,
} from '@mui/material';
import { Timer as TimerIcon, Save as SaveIcon } from '@mui/icons-material';
import { Game } from '../../../types/games';
import DetailSectionHeader from './DetailSectionHeader';

interface TimingSectionProps {
  game: Game;
  sectionsOpen: boolean;
  halfDuration: number;
  halftimeBreakDuration: number;
  firstHalfExtraTime: string;
  secondHalfExtraTime: string;
  timingSaving: boolean;
  onToggle: () => void;
  onHalfDurationChange: (value: number) => void;
  onHalftimeBreakDurationChange: (value: number) => void;
  onFirstHalfExtraTimeChange: (value: string) => void;
  onSecondHalfExtraTimeChange: (value: string) => void;
  onSave: () => void;
}

const TimingSection = ({
  game,
  sectionsOpen,
  halfDuration,
  halftimeBreakDuration,
  firstHalfExtraTime,
  secondHalfExtraTime,
  timingSaving,
  onToggle,
  onHalfDurationChange,
  onHalftimeBreakDurationChange,
  onFirstHalfExtraTimeChange,
  onSecondHalfExtraTimeChange,
  onSave,
}: TimingSectionProps) => {
  const theme = useTheme();

  return (
    <Box sx={{ mb: 3 }}>
      <DetailSectionHeader
        icon={<TimerIcon sx={{ color: 'primary.main', fontSize: 22 }} />}
        label="Spielzeiten"
        count={`${game.halfDuration ?? 45} min`}
        color={theme.palette.primary.main}
        open={sectionsOpen}
        onToggle={onToggle}
        testId="timing-section-header"
      />
      <Collapse in={sectionsOpen} timeout="auto" unmountOnExit>
        <Card sx={{ overflow: 'hidden' }}>
          <CardContent sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 2.5 } }}>
            {game.permissions?.can_edit_timing ? (
              <Box
                component="form"
                onSubmit={(e) => { e.preventDefault(); onSave(); }}
                data-testid="timing-edit-form"
              >
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr 1fr' },
                  gap: 2,
                  mb: 2,
                }}>
                  <TextField
                    label="Halbzeitdauer (Min)"
                    type="number"
                    value={halfDuration}
                    onChange={(e) => onHalfDurationChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    inputProps={{ min: 1, max: 90, 'data-testid': 'input-halfDuration' }}
                    size="small"
                    fullWidth
                    helperText="z.B. 45 (Erwachsene)"
                  />
                  <TextField
                    label="Halbzeitpause (Min)"
                    type="number"
                    value={halftimeBreakDuration}
                    onChange={(e) => onHalftimeBreakDurationChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    inputProps={{ min: 0, max: 60, 'data-testid': 'input-halftimeBreakDuration' }}
                    size="small"
                    fullWidth
                    helperText="z.B. 15"
                  />
                  <TextField
                    label="Nachspielzeit HZ1 (Min)"
                    type="number"
                    value={firstHalfExtraTime}
                    onChange={(e) => onFirstHalfExtraTimeChange(e.target.value)}
                    inputProps={{ min: 0, max: 30, 'data-testid': 'input-firstHalfExtraTime' }}
                    size="small"
                    fullWidth
                    helperText="leer = nicht erfasst"
                  />
                  <TextField
                    label="Nachspielzeit HZ2 (Min)"
                    type="number"
                    value={secondHalfExtraTime}
                    onChange={(e) => onSecondHalfExtraTimeChange(e.target.value)}
                    inputProps={{ min: 0, max: 30, 'data-testid': 'input-secondHalfExtraTime' }}
                    size="small"
                    fullWidth
                    helperText="leer = nicht erfasst"
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<SaveIcon />}
                    size="small"
                    disabled={timingSaving}
                    data-testid="btn-save-timing"
                  >
                    {timingSaving ? 'Speichern…' : 'Speichern'}
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Halbzeitdauer</Typography>
                  <Typography variant="body2" fontWeight={600}>{game.halfDuration ?? 45} min</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Halbzeitpause</Typography>
                  <Typography variant="body2" fontWeight={600}>{game.halftimeBreakDuration ?? 15} min</Typography>
                </Box>
                {game.firstHalfExtraTime != null && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Nachspielzeit HZ1</Typography>
                    <Typography variant="body2" fontWeight={600}>{game.firstHalfExtraTime} min</Typography>
                  </Box>
                )}
                {game.secondHalfExtraTime != null && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Nachspielzeit HZ2</Typography>
                    <Typography variant="body2" fontWeight={600}>{game.secondHalfExtraTime} min</Typography>
                  </Box>
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      </Collapse>
    </Box>
  );
};

export default TimingSection;
