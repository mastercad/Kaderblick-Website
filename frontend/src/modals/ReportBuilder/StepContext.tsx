import React, { Dispatch, SetStateAction, useState } from 'react';
import {
  Autocomplete,
  Box,
  Chip,
  CircularProgress,
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
  // Only the teams linked to the current user
  linkedTeams: { id: number; name: string }[];
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
  linkedTeams,
}) => {
  const [teamCompInput, setTeamCompInput] = useState('');
  const [teamInput, setTeamInput] = useState('');
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
          getOptionLabel={(o) => {
            const suffix = o.type === 'coach' ? ' (Trainer)' : '';
            return o.teamName ? `${o.fullName}${suffix} · ${o.teamName}` : `${o.fullName}${suffix}`;
          }}
          isOptionEqualToValue={(a, b) => a.id === b.id && a.type === b.type}
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
    const teamOptions = teamInput === ''
      ? linkedTeams
      : teams.filter(t => t.name.toLowerCase().includes(teamInput.toLowerCase()));
    return (
      <Box>
        <Typography variant="h6" sx={{ fontSize: { xs: '1.05rem', sm: '1.25rem' }, mb: 0.5 }}>
          Welche Mannschaft?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Wähle die Mannschaft, für die du die Auswertung erstellen möchtest.
        </Typography>
        <Autocomplete
          options={teamOptions}
          getOptionLabel={(o) => o.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          value={selectedTeam}
          inputValue={teamInput}
          onInputChange={(_, v) => setTeamInput(v)}
          onChange={(_, v) => setSelectedTeam(v)}
          filterOptions={(x) => x}
          noOptionsText={teamInput === '' ? 'Keine verknüpften Mannschaften' : 'Keine Mannschaft gefunden'}
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
    const selectedTeamObjects = teams.filter(t => selectedComparisonTeams.includes(t.id));
    const teamCompOptions = teamCompInput === ''
      ? linkedTeams.filter(t => !selectedComparisonTeams.includes(t.id))
      : teams.filter(t => !selectedComparisonTeams.includes(t.id) && t.name.toLowerCase().includes(teamCompInput.toLowerCase()));
    return (
      <Box>
        <Typography variant="h6" sx={{ fontSize: { xs: '1.05rem', sm: '1.25rem' }, mb: 0.5 }}>
          Welche Mannschaften vergleichen?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Tippe einen Namen ein und füge Mannschaften zur Vergleichsliste hinzu.
        </Typography>
        <Autocomplete
          options={teamCompOptions}
          getOptionLabel={(o) => o.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          value={null}
          inputValue={teamCompInput}
          onInputChange={(_, v) => setTeamCompInput(v)}
          onChange={(_, v) => {
            if (v) setSelectedComparisonTeams(prev => [...prev, v.id]);
            setTeamCompInput('');
          }}
          filterOptions={(x) => x}
          noOptionsText={teamCompInput === '' ? 'Keine verknüpften Mannschaften' : 'Keine Mannschaft gefunden'}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Mannschaft hinzufügen"
              placeholder="Name eintippen…"
              size="small"
              autoFocus
            />
          )}
        />
        {selectedTeamObjects.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.5 }}>
            {selectedTeamObjects.map(t => (
              <Chip
                key={t.id}
                label={t.name}
                onDelete={() => setSelectedComparisonTeams(prev => prev.filter(id => id !== t.id))}
                size="small"
                color="primary"
                variant="outlined"
              />
            ))}
          </Box>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
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
        getOptionLabel={(o) => {
          const suffix = o.type === 'coach' ? ' (Trainer)' : '';
          return o.teamName ? `${o.fullName}${suffix} · ${o.teamName}` : `${o.fullName}${suffix}`;
        }}
        isOptionEqualToValue={(a, b) => a.id === b.id && a.type === b.type}
        value={null}
        inputValue={playerSearchInput}
        loading={playerSearchLoading}
        onInputChange={(_, value) => setPlayerSearchInput(value)}
        onChange={(_, v) => {
          if (v && !selectedComparisonPlayers.some(p => p.id === v.id && p.type === v.type)) {
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
              key={`${p.type ?? 'player'}-${p.id}`}
              label={p.teamName ? `${p.fullName}${p.type === 'coach' ? ' (Trainer)' : ''} · ${p.teamName}` : `${p.fullName}${p.type === 'coach' ? ' (Trainer)' : ''}`}
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
