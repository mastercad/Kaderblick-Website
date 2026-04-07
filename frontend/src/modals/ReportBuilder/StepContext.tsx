import React, { Dispatch, SetStateAction } from 'react';
import {
  Autocomplete,
  Box,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  FormGroup,
  TextField,
  Typography,
} from '@mui/material';
import type { PlayerOption, Subject } from './wizardTypes';

export interface StepContextProps {
  subject: Subject;
  // Single player
  selectedPlayer: PlayerOption | null;
  setSelectedPlayer: (p: PlayerOption | null) => void;
  // Single team
  selectedTeam: { id: number; name: string } | null;
  setSelectedTeam: (t: { id: number; name: string } | null) => void;
  // Team comparison
  selectedComparisonTeams: number[];
  setSelectedComparisonTeams: Dispatch<SetStateAction<number[]>>;
  // Player comparison
  selectedComparisonPlayers: PlayerOption[];
  setSelectedComparisonPlayers: Dispatch<SetStateAction<PlayerOption[]>>;
  // Player search (shared between player and player_comparison)
  playerSearchInput: string;
  setPlayerSearchInput: (v: string) => void;
  playerSearchOptions: PlayerOption[];
  playerSearchLoading: boolean;
  // Teams list (for team / team_comparison selectors)
  teams: { id: number; name: string }[];
}

/** Step 1 content: context selection. Renders one of four sub-variants depending on subject. */
export const StepContext: React.FC<StepContextProps> = ({
  subject,
  selectedPlayer, setSelectedPlayer,
  selectedTeam, setSelectedTeam,
  selectedComparisonTeams, setSelectedComparisonTeams,
  selectedComparisonPlayers, setSelectedComparisonPlayers,
  playerSearchInput, setPlayerSearchInput,
  playerSearchOptions, playerSearchLoading,
  teams,
}) => {
  // ── Single player ──────────────────────────────────────────────────────────
  if (subject === 'player') {
    return (
      <Box>
        <Typography variant="h6" sx={{ fontSize: { xs: '1.05rem', sm: '1.25rem' }, mb: 0.5 }}>
          Welcher Spieler?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Suche und wähle den Spieler aus, über den du eine Auswertung erstellen möchtest.
        </Typography>
        <Autocomplete
          options={playerSearchOptions}
          getOptionLabel={(o) => o.teamName ? `${o.fullName} · ${o.teamName}` : o.fullName}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          value={selectedPlayer}
          inputValue={playerSearchInput}
          loading={playerSearchLoading}
          onInputChange={(_, value) => setPlayerSearchInput(value)}
          onChange={(_, v) => setSelectedPlayer(v)}
          filterOptions={(x) => x}
          noOptionsText={playerSearchInput.length < 2 ? 'Mind. 2 Zeichen eingeben' : 'Kein Spieler gefunden'}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Spieler suchen"
              placeholder="Name eintippen…"
              size="small"
              autoFocus
              slotProps={{
                input: {
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {playerSearchLoading ? <CircularProgress color="inherit" size={16} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                },
              }}
            />
          )}
        />
      </Box>
    );
  }

  // ── Single team ────────────────────────────────────────────────────────────
  if (subject === 'team') {
    return (
      <Box>
        <Typography variant="h6" sx={{ fontSize: { xs: '1.05rem', sm: '1.25rem' }, mb: 0.5 }}>
          Welche Mannschaft?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Wähle die Mannschaft, für die du die Auswertung erstellen möchtest.
        </Typography>
        <Autocomplete
          options={teams}
          getOptionLabel={(o) => o.name}
          value={selectedTeam}
          onChange={(_, v) => setSelectedTeam(v)}
          noOptionsText="Keine Mannschaften gefunden"
          renderInput={(params) => (
            <TextField
              {...params}
              label="Mannschaft auswählen"
              placeholder="Name eingeben…"
              size="small"
              autoFocus
            />
          )}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Optional — ohne Auswahl werden alle Mannschaftsdaten zusammengefasst.
        </Typography>
      </Box>
    );
  }

  // ── Team comparison ────────────────────────────────────────────────────────
  if (subject === 'team_comparison') {
    return (
      <Box>
        <Typography variant="h6" sx={{ fontSize: { xs: '1.05rem', sm: '1.25rem' }, mb: 0.5 }}>
          Welche Mannschaften vergleichen?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Wähle die Mannschaften aus, die du vergleichen möchtest. Ohne Auswahl werden alle verfügbaren Mannschaften verglichen.
        </Typography>
        <FormGroup>
          {teams.map(team => (
            <FormControlLabel
              key={team.id}
              control={
                <Checkbox
                  checked={selectedComparisonTeams.includes(team.id)}
                  onChange={(e) => {
                    setSelectedComparisonTeams(prev =>
                      e.target.checked ? [...prev, team.id] : prev.filter(id => id !== team.id)
                    );
                  }}
                  size="small"
                />
              }
              label={team.name}
            />
          ))}
        </FormGroup>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Optional — ohne Auswahl werden alle Mannschaften im Vergleich angezeigt.
        </Typography>
      </Box>
    );
  }

  // ── Player comparison ──────────────────────────────────────────────────────
  return (
    <Box>
      <Typography variant="h6" sx={{ fontSize: { xs: '1.05rem', sm: '1.25rem' }, mb: 0.5 }}>
        Welche Spieler vergleichen?
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Tippe einen Namen ein und füge Spieler zur Vergleichsliste hinzu.
      </Typography>
      <Autocomplete
        options={playerSearchOptions}
        getOptionLabel={(o) => o.teamName ? `${o.fullName} · ${o.teamName}` : o.fullName}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        value={null}
        inputValue={playerSearchInput}
        loading={playerSearchLoading}
        onInputChange={(_, value) => setPlayerSearchInput(value)}
        onChange={(_, v) => {
          if (v && !selectedComparisonPlayers.some(p => p.id === v.id)) {
            setSelectedComparisonPlayers(prev => [...prev, v]);
          }
          // Clearing the input triggers the debounce effect which will clear options
          setPlayerSearchInput('');
        }}
        filterOptions={(x) => x}
        noOptionsText={playerSearchInput.length < 2 ? 'Mind. 2 Zeichen eingeben' : 'Kein Spieler gefunden'}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Spieler hinzufügen"
            placeholder="Name eintippen…"
            size="small"
            autoFocus
            slotProps={{
              input: {
                ...params.InputProps,
                endAdornment: (
                  <>
                    {playerSearchLoading ? <CircularProgress color="inherit" size={16} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              },
            }}
          />
        )}
      />
      {selectedComparisonPlayers.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.5 }}>
          {selectedComparisonPlayers.map(p => (
            <Chip
              key={p.id}
              label={p.teamName ? `${p.fullName} · ${p.teamName}` : p.fullName}
              onDelete={() => setSelectedComparisonPlayers(prev => prev.filter(x => x.id !== p.id))}
              size="small"
              color="primary"
              variant="outlined"
            />
          ))}
        </Box>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
        Optional — ohne Auswahl werden alle Spieler verglichen.
      </Typography>
    </Box>
  );
};
