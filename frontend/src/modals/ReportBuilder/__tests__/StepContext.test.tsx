/**
 * Tests für StepContext
 *
 * Geprüft werden:
 *  – subject='player': Sucheingabe und Überschrift sichtbar
 *  – subject='team': Team-Auswahl-Autocomplete mit Mannschafts-Überschrift
 *  – subject='team_comparison': Checkboxen für Mannschaftsauswahl
 *  – subject='player_comparison': Mehrspielerliste mit Eingabefeld
 *  – Interaktion: Team-Checkbox toggle ändert selectedComparisonTeams
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StepContext } from '../StepContext';
import type { StepContextProps } from '../StepContext';

// ── Autocomplete-Mock: ruft renderInput auf um Callbacks abzudecken ───────────

jest.mock('@mui/material', () => {
  const actual = jest.requireActual('@mui/material') as Record<string, unknown>;
  return {
    ...actual,
    Autocomplete: ({ renderInput, onChange, options = [], inputValue, getOptionLabel, isOptionEqualToValue, filterOptions, value }: any) => {
      // Rufe renderInput auf, damit inline-callbacks abgedeckt werden
      const inputNode = renderInput({
        InputProps: { endAdornment: null },
        inputProps: { 'data-testid': 'autocomplete-input', value: inputValue ?? '' },
        id: 'mock-autocomplete',
        fullWidth: true,
        InputLabelProps: {},
        size: 'small' as const,
        disabled: false,
        error: false,
        helperText: undefined,
      });
      // Call Autocomplete callbacks to cover their inline function bodies
      const filteredOptions = filterOptions ? filterOptions(options) : options;
      return (
        <div>
          {inputNode}
          {/* Fake option list for testing selections */}
          {filteredOptions.map((opt: any, i: number) => {
            const label = getOptionLabel ? getOptionLabel(opt) : (opt.name ?? opt.fullName);
            const isSelected = isOptionEqualToValue && value ? isOptionEqualToValue(opt, value) : false;
            return (
              <div
                key={opt.id ?? i}
                data-testid={`option-${i}`}
                aria-selected={isSelected}
                onClick={() => onChange?.(null, opt)}
              >
                {label}
              </div>
            );
          })}
        </div>
      );
    },
    Chip: ({ label, onDelete }: any) => (
      <span data-testid="chip">
        {label}
        {onDelete && <button aria-label={`Remove ${label}`} onClick={onDelete} type="button" />}
      </span>
    ),
  };
});

// ── Props-Fabrik ──────────────────────────────────────────────────────────────

const TEAMS = [
  { id: 1, name: 'U17' },
  { id: 2, name: 'U19' },
  { id: 3, name: 'Herren' },
];

const PLAYERS = [
  { id: 10, fullName: 'Max Müller', firstName: 'Max', lastName: 'Müller', teamName: 'U17' },
  { id: 11, fullName: 'Anna Schmidt', firstName: 'Anna', lastName: 'Schmidt', teamName: 'U19' },
];

function makeProps(
  subject: StepContextProps['subject'],
  overrides: Partial<StepContextProps> = {},
): StepContextProps {
  return {
    subject,
    selectedPlayer: null,
    setSelectedPlayer: jest.fn(),
    selectedTeam: null,
    setSelectedTeam: jest.fn(),
    selectedComparisonTeams: [],
    setSelectedComparisonTeams: jest.fn(),
    selectedComparisonPlayers: [],
    setSelectedComparisonPlayers: jest.fn(),
    playerSearchInput: '',
    setPlayerSearchInput: jest.fn(),
    playerSearchOptions: [],
    playerSearchLoading: false,
    teams: TEAMS,
    ...overrides,
  };
}

// =============================================================================
//  subject='player' — Einzelspieler
// =============================================================================

describe('StepContext – subject=player', () => {
  it('zeigt die Überschrift "Welcher Spieler?"', () => {
    render(<StepContext {...makeProps('player')} />);
    expect(screen.getByText('Welcher Spieler?')).toBeInTheDocument();
  });

  it('rendert das Autocomplete-Eingabefeld für die Spielersuche', () => {
    render(<StepContext {...makeProps('player')} />);
    expect(screen.getByTestId('autocomplete-input')).toBeInTheDocument();
  });

  it('zeigt CircularProgress wenn playerSearchLoading=true', () => {
    render(<StepContext {...makeProps('player', { playerSearchLoading: true })} />);
    // CircularProgress rendert als SVG mit aria-label oder role
    expect(document.querySelector('svg circle')).toBeTruthy();
  });

  it('ruft setSelectedPlayer auf wenn ein Spieler aus der Liste ausgewählt wird', () => {
    const setSelectedPlayer = jest.fn();
    render(<StepContext {...makeProps('player', { playerSearchOptions: PLAYERS, setSelectedPlayer })} />);
    fireEvent.click(screen.getByTestId('option-0'));
    expect(setSelectedPlayer).toHaveBeenCalledWith(PLAYERS[0]);
  });

  it('markiert einen bereits ausgewählten Spieler als aktiv (isOptionEqualToValue)', () => {
    // Mit selectedPlayer gesetzt werden getOptionLabel + isOptionEqualToValue aufgerufen
    render(<StepContext {...makeProps('player', {
      playerSearchOptions: PLAYERS,
      selectedPlayer: PLAYERS[0],
    })} />);
    // option-0 ist der ausgewählte Spieler → aria-selected="true"
    expect(screen.getByTestId('option-0')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('option-1')).toHaveAttribute('aria-selected', 'false');
  });
});

// =============================================================================
//  subject='team' — Einzelmannschaft
// =============================================================================

describe('StepContext – subject=team', () => {
  it('zeigt die Überschrift "Welche Mannschaft?"', () => {
    render(<StepContext {...makeProps('team')} />);
    expect(screen.getByText('Welche Mannschaft?')).toBeInTheDocument();
  });

  it('rendert das Autocomplete für Mannschaftsauswahl', () => {
    render(<StepContext {...makeProps('team')} />);
    expect(screen.getByTestId('autocomplete-input')).toBeInTheDocument();
  });

  it('zeigt "Optional" -Hinweis', () => {
    render(<StepContext {...makeProps('team')} />);
    expect(screen.getByText(/Optional/i)).toBeInTheDocument();
  });

  it('ruft setSelectedTeam auf wenn ein Team aus der Liste ausgewählt wird', () => {
    const setSelectedTeam = jest.fn();
    render(<StepContext {...makeProps('team', { teams: TEAMS, setSelectedTeam })} />);
    fireEvent.click(screen.getByTestId('option-0'));
    expect(setSelectedTeam).toHaveBeenCalledWith(TEAMS[0]);
  });
});

// =============================================================================
//  subject='team_comparison' — Mannschaftsvergleich
// =============================================================================

describe('StepContext – subject=team_comparison', () => {
  it('zeigt die Überschrift "Welche Mannschaften vergleichen?"', () => {
    render(<StepContext {...makeProps('team_comparison')} />);
    expect(screen.getByText('Welche Mannschaften vergleichen?')).toBeInTheDocument();
  });

  it('zeigt eine Checkbox pro Team', () => {
    render(<StepContext {...makeProps('team_comparison')} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(TEAMS.length);
  });

  it('zeigt Team-Namen als Checkbox-Labels', () => {
    render(<StepContext {...makeProps('team_comparison')} />);
    expect(screen.getByText('U17')).toBeInTheDocument();
    expect(screen.getByText('U19')).toBeInTheDocument();
    expect(screen.getByText('Herren')).toBeInTheDocument();
  });

  it('markiert ausgewählte Teams als checked', () => {
    render(<StepContext {...makeProps('team_comparison', { selectedComparisonTeams: [1, 3] })} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();   // U17 (id=1)
    expect(checkboxes[1]).not.toBeChecked(); // U19 (id=2)
    expect(checkboxes[2]).toBeChecked();   // Herren (id=3)
  });

  it('ruft setSelectedComparisonTeams auf wenn eine Checkbox aktiviert wird', () => {
    const setSelectedComparisonTeams = jest.fn();
    render(<StepContext {...makeProps('team_comparison', { setSelectedComparisonTeams })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // U17 auswählen
    expect(setSelectedComparisonTeams).toHaveBeenCalledTimes(1);
  });

  it('ruft setSelectedComparisonTeams auf wenn eine Checkbox deaktiviert wird', () => {
    const setSelectedComparisonTeams = jest.fn();
    // U17 already selected
    render(<StepContext {...makeProps('team_comparison', {
      selectedComparisonTeams: [1],
      setSelectedComparisonTeams,
    })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // U17 deselektieren
    expect(setSelectedComparisonTeams).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
//  subject='player_comparison' — Spielervergleich
// =============================================================================

describe('StepContext – subject=player_comparison', () => {
  it('zeigt die Überschrift "Welche Spieler vergleichen?"', () => {
    render(<StepContext {...makeProps('player_comparison')} />);
    expect(screen.getByText('Welche Spieler vergleichen?')).toBeInTheDocument();
  });

  it('rendert das Autocomplete-Eingabefeld', () => {
    render(<StepContext {...makeProps('player_comparison')} />);
    expect(screen.getByTestId('autocomplete-input')).toBeInTheDocument();
  });

  it('zeigt ausgewählte Spieler als Chips', () => {
    render(<StepContext {...makeProps('player_comparison', {
      selectedComparisonPlayers: PLAYERS,
    })} />);
    const chips = screen.getAllByTestId('chip');
    expect(chips).toHaveLength(PLAYERS.length);
    expect(chips[0]).toHaveTextContent('Max Müller');
  });

  it('ruft setSelectedComparisonPlayers auf wenn Chip entfernt wird', () => {
    const setSelectedComparisonPlayers = jest.fn();
    render(<StepContext {...makeProps('player_comparison', {
      selectedComparisonPlayers: [PLAYERS[0]],
      setSelectedComparisonPlayers,
    })} />);
    fireEvent.click(screen.getByRole('button', { name: /Remove Max Müller/i }));
    expect(setSelectedComparisonPlayers).toHaveBeenCalledTimes(1);
  });

  it('ruft setSelectedComparisonPlayers auf wenn Spieler aus der Liste ausgewählt wird', () => {
    const setSelectedComparisonPlayers = jest.fn();
    render(<StepContext {...makeProps('player_comparison', {
      playerSearchOptions: PLAYERS,
      setSelectedComparisonPlayers,
    })} />);
    // Mock's option-0 click triggers onChange with player
    fireEvent.click(screen.getByTestId('option-0'));
    expect(setSelectedComparisonPlayers).toHaveBeenCalledTimes(1);
  });

  it('zeigt CircularProgress wenn playerSearchLoading=true', () => {
    render(<StepContext {...makeProps('player_comparison', { playerSearchLoading: true })} />);
    expect(document.querySelector('svg circle')).toBeTruthy();
  });
});
