import React from 'react';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { EventData, SelectOption } from '../../types/event';

interface TournamentConfigProps {
  formData: EventData;
  isExistingTournament: boolean;
  onChange: (field: string, value: any) => void;
}

/**
 * Tournament configuration section with:
 * - Tournament type (hall/normal)
 * - Round duration
 * - Break time
 * - Game mode
 * - Number of groups (if applicable)
 */
export const TournamentConfig: React.FC<TournamentConfigProps> = ({
  formData,
  isExistingTournament,
  onChange,
}) => {
  // Don't show config for existing tournaments
  if (isExistingTournament) {
    return null;
  }

  return (
    <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
      <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Turnier-Konfiguration</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <FormControl size="small" style={{ width: 200 }}>
          <InputLabel>Turniertyp</InputLabel>
          <Select
            value={formData.tournamentType || 'indoor_hall'}
            label="Turniertyp"
            onChange={e => onChange('tournamentType', e.target.value)}
          >
            <MenuItem value="indoor_hall">Hallenturnier (1 Feld)</MenuItem>
            <MenuItem value="normal">Normal (mehrere Felder)</MenuItem>
          </Select>
        </FormControl>
        
        <TextField
          label="Spieldauer (Min.)"
          type="number"
          value={formData.tournamentRoundDuration || 10}
          onChange={e => onChange('tournamentRoundDuration', parseInt(e.target.value) || 10)}
          size="small"
          style={{ width: 140 }}
          slotProps={{
            htmlInput: { min: 1, max: 120 }
          }}
        />
        
        <TextField
          label="Pausenzeit (Min.)"
          type="number"
          value={formData.tournamentBreakTime || 2}
          onChange={e => onChange('tournamentBreakTime', parseInt(e.target.value) || 2)}
          size="small"
          style={{ width: 140 }}
          slotProps={{
            htmlInput: { min: 0, max: 30 }
          }}
        />
        
        <FormControl size="small" style={{ width: 200 }}>
          <InputLabel>Spielmodus</InputLabel>
          <Select
            value={formData.tournamentGameMode || 'round_robin'}
            label="Spielmodus"
            onChange={e => onChange('tournamentGameMode', e.target.value)}
          >
            <MenuItem value="round_robin">Jeder gegen Jeden</MenuItem>
            <MenuItem value="groups_with_finals">Gruppen + Finale</MenuItem>
          </Select>
        </FormControl>
        
        {formData.tournamentGameMode === 'groups_with_finals' && (
          <TextField
            label="Anzahl Gruppen"
            type="number"
            value={formData.tournamentNumberOfGroups || 2}
            onChange={e => onChange('tournamentNumberOfGroups', parseInt(e.target.value) || 2)}
            size="small"
            style={{ width: 140 }}
            slotProps={{
              htmlInput: { min: 2, max: 4 }
            }}
          />
        )}
      </div>
    </div>
  );
};

interface TournamentMatchesManagementProps {
  tournamentMatches: any[];
  onImportOpen: () => void;
  onManualOpen: () => void;
  onGeneratorOpen: () => void;
  onGeneratePlan?: () => void;
  onClearMatches: () => void;
  showOldGeneration: boolean;
}

/**
 * Tournament matches management toolbar with action buttons
 */
export const TournamentMatchesManagement: React.FC<TournamentMatchesManagementProps> = ({
  tournamentMatches,
  onImportOpen,
  onManualOpen,
  onGeneratorOpen,
  onGeneratePlan,
  onClearMatches,
  showOldGeneration,
}) => {
  return (
    <div>
      <div style={{ color: '#666', marginBottom: 6 }}>
        {tournamentMatches && tournamentMatches.length > 0
          ? 'Vorhandene Begegnungen und Teams:'
          : 'Für dieses Turnier sind noch keine Begegnungen vorhanden.'}
      </div>
      
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button
          size="small"
          variant="outlined"
          color="primary"
          onClick={onGeneratorOpen}
        >
          Automatisch generieren
        </Button>
        
        <Button size="small" variant="outlined" onClick={onManualOpen}>
          Manuell anlegen
        </Button>
        
        <Button size="small" variant="outlined" onClick={onImportOpen}>
          Import (CSV/JSON)
        </Button>
        
        {showOldGeneration && onGeneratePlan && (
          <Button
            size="small"
            variant="outlined"
            onClick={onGeneratePlan}
          >
            Alte Generierung
          </Button>
        )}
        
        <Button size="small" variant="outlined" onClick={onClearMatches}>
          Liste leeren
        </Button>
      </div>
    </div>
  );
};

interface TournamentSelectionProps {
  formData: EventData;
  tournaments: SelectOption[];
  tournamentMatches: any[];
  onChange: (field: string, value: any) => void;
  onTournamentMatchChange: (matchId: string) => void;
}

/**
 * Tournament and tournament match selection dropdowns
 */
export const TournamentSelection: React.FC<TournamentSelectionProps> = ({
  formData,
  tournaments,
  tournamentMatches,
  onChange,
  onTournamentMatchChange,
}) => {
  return (
    <>
      {tournaments.length > 0 && (
        <FormControl fullWidth margin="normal">
          <InputLabel id="tournament-label">Turnier (optional)</InputLabel>
          <Select
            labelId="tournament-label"
            value={formData.tournamentId || ''}
            label="Turnier (optional)"
            onChange={e => onChange('tournamentId', e.target.value as string)}
          >
            <MenuItem value=""><em>Keines</em></MenuItem>
            {tournaments.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {formData.tournamentId && (
        <FormControl fullWidth margin="normal">
          <InputLabel id="tournament-match-label">Turnier-Begegnung (optional)</InputLabel>
          <Select
            labelId="tournament-match-label"
            value={formData.tournamentMatchId || ''}
            label="Turnier-Begegnung (optional)"
            onChange={e => onTournamentMatchChange(e.target.value as string)}
          >
            <MenuItem value=""><em>Keine</em></MenuItem>
            {tournamentMatches.map((m: any) => {
              let label = '';
              if (m.stage) {
                label = `${m.stage} - ${m.homeTeamName || 'TBD'} vs ${m.awayTeamName || 'TBD'}`;
              } else {
                label = `Runde ${m.round || '?'}${m.group ? ` (Gr. ${m.group})` : ''} - ${m.homeTeamName || 'TBD'} vs ${m.awayTeamName || 'TBD'}`;
              }
              return (
                <MenuItem key={m.id} value={m.id}>{label}</MenuItem>
              );
            })}
          </Select>
        </FormControl>
      )}
    </>
  );
};
