import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import Tooltip from '@mui/material/Tooltip';
import { TournamentGameMode, TournamentType } from '../types/tournament';
import { generateTournamentMatches, calculateTournamentDuration } from '../utils/tournamentGenerator';

interface TournamentGeneratorConfig {
  gameMode: TournamentGameMode;
  tournamentType: TournamentType;
  roundDuration: number;
  breakTime: number;
  numberOfGroups: number;
}

interface TournamentMatchGeneratorDialogProps {
  open: boolean;
  onClose: () => void;
  teams: { value: string; label: string }[];
  tournament?: TournamentType | null;
  matchTeams?: string[];
  initialMatches?: any[];
  startDate?: string;
  startTime?: string;
  onGenerate: (matches: any[], config: TournamentGeneratorConfig) => void;
  // Initial values from EventModal
  initialGameMode?: TournamentGameMode;
  initialTournamentType?: TournamentType;
  initialRoundDuration?: number;
  initialBreakTime?: number;
  initialNumberOfGroups?: number;
}

const TournamentMatchGeneratorDialog: React.FC<TournamentMatchGeneratorDialogProps> = ({
  open,
  onClose,
  teams,
  matchTeams = [],
  tournament,
  initialMatches = [],
  startDate = '',
  startTime = '09:00',
  onGenerate,
  initialGameMode = 'round_robin',
  initialTournamentType = 'indoor_hall',
  initialRoundDuration = 10,
  initialBreakTime = 2,
  initialNumberOfGroups = 2,
}) => {
  const [selectedTeams, setSelectedTeams] = useState<{ value: string; label: string }[]>([]);
  const [gameMode, setGameMode] = useState<TournamentGameMode>(initialGameMode);
  const [tournamentType, setTournamentType] = useState<TournamentType>(initialTournamentType);
  const [roundDuration, setRoundDuration] = useState<number>(initialRoundDuration);
  const [breakTime, setBreakTime] = useState<number>(initialBreakTime);
  const [numberOfGroups, setNumberOfGroups] = useState<number>(initialNumberOfGroups);
  const [previewMatches, setPreviewMatches] = useState<any[]>([]);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  // Track whether initial matches have been loaded to prevent auto-regeneration
  const [matchesInitialized, setMatchesInitialized] = useState(false);

  // Update state when dialog opens or initial props change
  useEffect(() => {
    if (open) {
      setGameMode(initialGameMode);
      setTournamentType(initialTournamentType);
      setRoundDuration(initialRoundDuration);
      setBreakTime(initialBreakTime);
      setNumberOfGroups(initialNumberOfGroups);
      // Reset initialization flag when dialog reopens
      setMatchesInitialized(false);
    }
  }, [open, initialGameMode, initialTournamentType, initialRoundDuration, initialBreakTime, initialNumberOfGroups]);

  console.debug("MATCH TEAMS: ", matchTeams);
  console.debug("TOURNAMENT: ", tournament);
  console.debug("TEAMS: ", teams);

  // Initialize selected teams from matchTeams prop
  useEffect(() => {
    if (selectedTeams.length === 0 && matchTeams.length > 0) {
      const resolved: { value: string; label: string }[] = [];
      for (const matchTeam of matchTeams) {
        const team = teams.find(t => String(t.value) === String(matchTeam));
        if (team) {
          resolved.push(team);
        }
      }
      setSelectedTeams(resolved);
    }
  }, [matchTeams, teams]);

  // Load initial matches when dialog opens (without regenerating)
  useEffect(() => {
    if (matchesInitialized) return;

    if (initialMatches.length > 0) {
      const loaded: any[] = [];
      for (const match of initialMatches) {
        const homeTeam = teams.find(team => String(team.value) === String(match.homeTeamId));
        const awayTeam = teams.find(team => String(team.value) === String(match.awayTeamId));
        loaded.push({
          ...match,
          homeTeamName: homeTeam?.label || match.homeTeamName || '',
          awayTeamName: awayTeam?.label || match.awayTeamName || '',
        });
      }
      setPreviewMatches(loaded);
      setTotalDuration(calculateTournamentDuration(loaded.length, roundDuration, breakTime));
      setMatchesInitialized(true);
      console.debug("LOADED INITIAL MATCHES (no regeneration): ", loaded);
    } else if (selectedTeams.length >= 2) {
      // No initial matches exist - auto-generate only on first open
      triggerGeneration();
      setMatchesInitialized(true);
    }
  }, [initialMatches, selectedTeams, teams, matchesInitialized]);

  // Explicit generation function - called by refresh button or first-time generation
  const triggerGeneration = () => {
    if (selectedTeams.length < 2) {
      setPreviewMatches([]);
      setTotalDuration(0);
      return;
    }

    const validStartTime = startTime || '09:00';
    const startDateTime = `${startDate || new Date().toISOString().split('T')[0]}T${validStartTime}:00`;

    const matches = generateTournamentMatches({
      teams: selectedTeams,
      gameMode,
      tournamentType,
      roundDuration,
      breakTime,
      startTime: startDateTime,
      numberOfGroups: gameMode === 'groups_with_finals' ? numberOfGroups : undefined,
    });

    console.debug("GENERATED MATCHES: ", matches);
    setPreviewMatches(matches);
    setTotalDuration(calculateTournamentDuration(matches.length, roundDuration, breakTime));
  };

  const handleGenerate = () => {
    if (previewMatches.length === 0) {
      alert('Bitte wählen Sie mindestens 2 Teams aus.');
      return;
    }

    onGenerate(previewMatches, {
      gameMode,
      tournamentType,
      roundDuration,
      breakTime,
      numberOfGroups,
    });
    onClose();
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return '--:--';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '--:--';
      return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '--:--';
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins} min`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Turnier-Matches automatisch generieren
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          {/* Team Selection */}
          <Autocomplete
            multiple
            options={teams}
            getOptionLabel={(option) => option.label}
            value={selectedTeams}
            onChange={(_, newValue) => setSelectedTeams(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Teams auswählen *"
                placeholder="Teams hinzufügen..."
                helperText={`${selectedTeams.length} Team(s) ausgewählt`}
              />
            )}
          />

          {/* Tournament Type Selection */}
          <FormControl fullWidth>
            <InputLabel>Turniertyp *</InputLabel>
            <Select
              value={tournamentType}
              label="Turniertyp *"
              onChange={(e) => setTournamentType(e.target.value as TournamentType)}
            >
              <MenuItem value="indoor_hall">
                Hallenturnier (1 Spielfeld, sequenziell)
              </MenuItem>
              <MenuItem value="normal">
                Normal (mehrere Felder parallel)
              </MenuItem>
            </Select>
          </FormControl>

          {/* Game Mode Selection */}
          <FormControl fullWidth>
            <InputLabel>Spielmodus *</InputLabel>
            <Select
              value={gameMode}
              label="Spielmodus *"
              onChange={(e) => setGameMode(e.target.value as TournamentGameMode)}
            >
              <MenuItem value="round_robin">
                Jeder gegen Jeden (Round-Robin)
              </MenuItem>
              <MenuItem value="groups_with_finals">
                Gruppenphase mit Finale
              </MenuItem>
            </Select>
          </FormControl>

          {/* Groups Configuration (only for groups mode) */}
          {gameMode === 'groups_with_finals' && (
            <TextField
              label="Anzahl Gruppen"
              type="number"
              value={numberOfGroups}
              onChange={(e) => setNumberOfGroups(Math.max(2, parseInt(e.target.value) || 2))}
              helperText="Empfohlen: 2 Gruppen für optimales Finale"
              fullWidth
              slotProps={{
                htmlInput: { min: 2, max: 4 }
              }}
            />
          )}

          {/* Match Duration */}
          <TextField
            label="Spieldauer pro Runde (Minuten) *"
            type="number"
            value={roundDuration}
            onChange={(e) => setRoundDuration(Math.max(1, parseInt(e.target.value) || 10))}
            helperText="Standard: 10 Minuten, üblich sind auch 12 oder 15 Minuten"
            fullWidth
            slotProps={{
              htmlInput: { min: 1, max: 120 }
            }}
          />

          {/* Break Time */}
          <TextField
            label="Pausenzeit zwischen Spielen (Minuten)"
            type="number"
            value={breakTime}
            onChange={(e) => setBreakTime(Math.max(0, parseInt(e.target.value) || 2))}
            helperText="Zeit für Teamwechsel und Aufstellung (Standard: 2 Minuten)"
            fullWidth
            slotProps={{
              htmlInput: { min: 0, max: 30 }
            }}
          />

          <Divider sx={{ my: 2 }} />

          {/* Preview Section */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
              Vorschau ({previewMatches.length} Spiele)
            </Typography>
            <Tooltip title="Matches neu generieren (vorhandene werden überschrieben)">
              <span>
                <IconButton
                  color="primary"
                  onClick={triggerGeneration}
                  disabled={selectedTeams.length < 2}
                  size="small"
                >
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          {selectedTeams.length < 2 ? (
            <Typography
              sx={{
                color: "text.secondary",
                fontStyle: 'italic'
              }}>
              Wählen Sie mindestens 2 Teams aus, um eine Vorschau zu sehen.
            </Typography>
          ) : (
            <>
              <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
                <Typography variant="body2" sx={{
                  color: "text.secondary"
                }}>
                  <strong>Gesamtdauer:</strong> {formatDuration(totalDuration)}
                </Typography>
                <Typography variant="body2" sx={{
                  color: "text.secondary"
                }}>
                  <strong>Anzahl Spiele:</strong> {previewMatches.length}
                </Typography>
              </Box>

              <Box
                sx={{
                  maxHeight: '400px',
                  overflowY: 'auto',
                  border: '1px solid #e0e0e0',
                  borderRadius: 1,
                  p: 2,
                }}
              >
                {previewMatches.map((match, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      py: 1,
                      borderBottom: index < previewMatches.length - 1 ? '1px solid #f0f0f0' : 'none',
                    }}
                  >
                    <Typography variant="body2" sx={{ minWidth: '60px', color: 'text.secondary' }}>
                      {formatTime(match.scheduledAt)}
                    </Typography>
                    <Typography variant="body2" sx={{ minWidth: '120px', fontWeight: 'bold' }}>
                      {match.stage
                        ? match.stage + (match.group && !match.stage.includes('Gr.') ? ` (Gr. ${match.group})` : '')
                        : `Runde ${match.round}${match.group ? ` (Gr. ${match.group})` : ''}`}
                    </Typography>
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {match.homeTeamName} <strong>vs</strong> {match.awayTeamName}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">
          Abbrechen
        </Button>
        <Button
          onClick={handleGenerate}
          color="primary"
          variant="contained"
          disabled={previewMatches.length === 0}
        >
          Matches generieren ({previewMatches.length})
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TournamentMatchGeneratorDialog;
