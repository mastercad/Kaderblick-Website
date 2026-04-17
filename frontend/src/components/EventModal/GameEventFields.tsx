import React from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import ListSubheader from '@mui/material/ListSubheader';
import TextField from '@mui/material/TextField';
import { EventData, SelectOption } from '../../types/event';

interface GameEventFieldsProps {
  formData: EventData;
  teams: SelectOption[];
  gameTypes: SelectOption[];
  leagues: SelectOption[];
  cups: SelectOption[];
  cupRounds: string[];
  isTournament: boolean;
  isTournamentEventType: boolean;
  isLiga: boolean;
  isPokal: boolean;
  isKnockout: boolean;
  handleChange: (field: string, value: any) => void;
}

// ── Game-type grouping ────────────────────────────────────────────────────────
// Maps each known game-type name (lowercase) to a group label.
// Types in the "System" group (Turnier-Match, Trainingseinheit) are hidden from manual selection.
const GAME_TYPE_GROUPS: Record<string, string> = {
  'ligaspiel':              'Liga',
  'nachholspiel':           'Liga',
  'pokalspiel':             'Pokal',
  'freundschaftsspiel':     'Test / Freundschaft',
  'testspiel':              'Test / Freundschaft',
  'turnierspiel':           'Turnier',
  'hallenturnier':          'Turnier',
  'pokalturnier':           'Turnier',
  'saisonturnier':          'Turnier',
  'internationales spiel':  'Sonstiges',
  'supercup':               'Sonstiges',
  'playoff-spiel':          'Sonstiges',
  'internes spiel':         'Sonstiges',
  'qualifikationsspiel':    'Sonstiges',
  'vorrundenspiel':         'Sonstiges',
};

const GROUP_ORDER = ['Liga', 'Pokal', 'Test / Freundschaft', 'Turnier', 'Sonstiges'];

function buildGroupedOptions(gameTypes: SelectOption[]): Array<{ group: string; options: SelectOption[] }> {
  const grouped: Record<string, SelectOption[]> = {};
  const ungrouped: SelectOption[] = [];

  for (const opt of gameTypes) {
    const group = GAME_TYPE_GROUPS[opt.label.toLowerCase()];
    if (!group) {
      ungrouped.push(opt);
      continue;
    }
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(opt);
  }

  const result: Array<{ group: string; options: SelectOption[] }> = [];
  for (const g of GROUP_ORDER) {
    if (grouped[g]?.length) result.push({ group: g, options: grouped[g] });
  }
  if (ungrouped.length) result.push({ group: 'Weitere', options: ungrouped });
  return result;
}

/**
 * Form fields specific to game events:
 * - Home/Away Teams (hidden for tournament games)
 * - Game Type (grouped by category)
 * - League / Cup (conditional on game type)
 * - Round / Runde (optional, for knockout-style game types)
 */
const GameEventFieldsComponent: React.FC<GameEventFieldsProps> = ({
  formData,
  teams,
  gameTypes,
  leagues,
  cups,
  cupRounds,
  isTournament,
  isTournamentEventType,
  isLiga,
  isPokal,
  isKnockout,
  handleChange,
}) => {
  const groupedGameTypes = React.useMemo(() => buildGroupedOptions(gameTypes), [gameTypes]);

  return (
    <>
      {/* For tournament games, teams are selected from tournament-match; hide manual home/away selection */}
      {!isTournament && (
        <>
          <FormControl fullWidth margin="normal" required>
            <InputLabel id="home-team-label">Heim-Team *</InputLabel>
            <Select
              labelId="home-team-label"
              value={formData.homeTeam || ''}
              label="Heim-Team *"
              onChange={e => handleChange('homeTeam', e.target.value as string)}
            >
              <MenuItem value=""><em>Bitte wählen...</em></MenuItem>
              {teams.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControl fullWidth margin="normal" required>
            <InputLabel id="away-team-label">Auswärts-Team *</InputLabel>
            <Select
              labelId="away-team-label"
              value={formData.awayTeam || ''}
              label="Auswärts-Team *"
              onChange={e => handleChange('awayTeam', e.target.value as string)}
            >
              <MenuItem value=""><em>Bitte wählen...</em></MenuItem>
              {teams.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </>
      )}
      
      {/* Hide game type dropdown when CalendarEventType is "Turnier" — it's redundant */}
      {gameTypes.length > 0 && !isTournamentEventType && (
        <FormControl fullWidth margin="normal">
          <InputLabel id="game-type-label">Spiel-Typ</InputLabel>
          <Select
            labelId="game-type-label"
            value={formData.gameType || ''}
            label="Spiel-Typ"
            onChange={e => handleChange('gameType', e.target.value as string)}
          >
            <MenuItem value=""><em>Bitte wählen...</em></MenuItem>
            {groupedGameTypes.map(({ group, options }) => [
              <ListSubheader key={`hdr-${group}`}>{group}</ListSubheader>,
              ...options.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              )),
            ])}
          </Select>
        </FormControl>
      )}
      
      {isLiga && leagues.length > 0 && !isTournament && (
        <FormControl fullWidth margin="normal">
          <InputLabel id="league-label">Liga</InputLabel>
          <Select
            labelId="league-label"
            value={formData.leagueId || ''}
            label="Liga"
            onChange={e => handleChange('leagueId', e.target.value as string)}
          >
            <MenuItem value=""><em>Bitte wählen...</em></MenuItem>
            {leagues.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {isPokal && cups.length > 0 && !isTournament && (
        <FormControl fullWidth margin="normal">
          <InputLabel id="cup-label">Pokal</InputLabel>
          <Select
            labelId="cup-label"
            value={formData.cupId || ''}
            label="Pokal"
            onChange={e => handleChange('cupId', e.target.value as string)}
          >
            <MenuItem value=""><em>Bitte wählen...</em></MenuItem>
            {cups.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {isKnockout && !isTournament && (
          <Autocomplete
            freeSolo
            options={cupRounds}
            value={formData.gameRound ?? null}
            onChange={(_, newValue) =>
              handleChange('gameRound', typeof newValue === 'string' ? newValue : '')
            }
            onInputChange={(_, newInputValue, reason) => {
              if (reason === 'input') handleChange('gameRound', newInputValue);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Runde (optional)"
                placeholder="Runde frei eingeben oder aus Rundennamen wählen"
                margin="normal"
                fullWidth
              />
            )}
          />
      )}
    </>
  );
};

export const GameEventFields = React.memo(GameEventFieldsComponent);

