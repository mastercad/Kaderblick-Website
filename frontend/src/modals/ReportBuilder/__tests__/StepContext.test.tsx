/**
 * Tests für StepContext
 *
 * Geprüft werden:
 *  – subject='player':            Sucheingabe und Überschrift sichtbar
 *  – subject='team':              leer → linkedTeams; Tippen → alle Teams gefiltert; setSelectedTeam; Optional-Hinweis
 *  – subject='team_comparison':   Autocomplete + Chip-Muster (KEIN Checkbox-Muster)
 *  – subject='player_comparison': Chip-Muster; Spieler hinzufügen/entfernen; Trainer-Suffix
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StepContext } from '../StepContext';
import type { StepContextProps } from '../StepContext';

// ── Autocomplete-Mock ─────────────────────────────────────────────────────────
//
// Ruft renderInput auf um inline-Callbacks abzudecken.
// Rendert Optionen als anklickbare divs und Chips via gemocktem Chip.

jest.mock('@mui/material', () => {
  const actual = jest.requireActual('@mui/material') as Record<string, unknown>;
  return {
    ...actual,
    Autocomplete: ({
      renderInput,
      onChange,
      onInputChange,
      options = [],
      inputValue,
      getOptionLabel,
      isOptionEqualToValue,
      filterOptions,
      value,
      noOptionsText,
    }: any) => {
      const inputNode = renderInput({
        InputProps: { endAdornment: null },
        inputProps: {
          'data-testid': 'autocomplete-input',
          value: inputValue ?? '',
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => onInputChange?.(null, e.target.value),
        },
        id: 'mock-autocomplete',
        fullWidth: true,
        InputLabelProps: {},
        size: 'small' as const,
        disabled: false,
        error: false,
        helperText: undefined,
      });
      const filteredOptions = filterOptions ? filterOptions(options) : options;
      return (
        <div>
          {inputNode}
          {filteredOptions.length === 0 && noOptionsText
            ? <div data-testid="no-options">{noOptionsText}</div>
            : filteredOptions.map((opt: any, i: number) => {
              const label = getOptionLabel ? getOptionLabel(opt) : (opt.name ?? opt.fullName ?? '');
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
        {onDelete && (
          <button aria-label={`Remove ${label}`} onClick={onDelete} type="button" />
        )}
      </span>
    ),
  };
});

// ── Test-Daten ────────────────────────────────────────────────────────────────

const TEAMS = [
  { id: 1, name: 'U17' },
  { id: 2, name: 'U19' },
  { id: 3, name: 'Herren' },
];

const LINKED_TEAMS = [
  { id: 1, name: 'U17' },
  { id: 2, name: 'U19' },
];

const PLAYERS = [
  { id: 10, fullName: 'Max Müller', firstName: 'Max', lastName: 'Müller', teamName: 'U17' },
  { id: 11, fullName: 'Anna Schmidt', firstName: 'Anna', lastName: 'Schmidt', teamName: 'U19' },
];

const COACH_PLAYER = {
  id: 99, fullName: 'Trainer Boss', firstName: 'Trainer', lastName: 'Boss', teamName: 'Herren', type: 'coach' as const,
};

// ── Props-Fabrik ──────────────────────────────────────────────────────────────

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
    linkedTeams: LINKED_TEAMS,
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

  it('rendert das Autocomplete-Eingabefeld', () => {
    render(<StepContext {...makeProps('player')} />);
    expect(screen.getByTestId('autocomplete-input')).toBeInTheDocument();
  });

  it('zeigt CircularProgress wenn playerSearchLoading=true', () => {
    render(<StepContext {...makeProps('player', { playerSearchLoading: true })} />);
    expect(document.querySelector('svg circle')).toBeTruthy();
  });

  it('zeigt keine CircularProgress wenn playerSearchLoading=false', () => {
    render(<StepContext {...makeProps('player', { playerSearchLoading: false })} />);
    // kein SVG circle für Spinner wenn nicht loading
    const circles = Array.from(document.querySelectorAll('svg circle'));
    // MUI Chip und andere SVG-Elemente können existieren; wir prüfen dass CircularProgress SVG nicht zu sehen ist
    // einfachste Methode: kein Loading-Spinner ohne loading=true
    expect(circles).toHaveLength(0);
  });

  it('ruft setSelectedPlayer auf wenn Spieler aus der Liste ausgewählt wird', () => {
    const setSelectedPlayer = jest.fn();
    render(<StepContext {...makeProps('player', { playerSearchOptions: PLAYERS, setSelectedPlayer })} />);
    fireEvent.click(screen.getByTestId('option-0'));
    expect(setSelectedPlayer).toHaveBeenCalledWith(PLAYERS[0]);
  });

  it('markiert bereits ausgewählten Spieler als aktiv (isOptionEqualToValue)', () => {
    render(<StepContext {...makeProps('player', {
      playerSearchOptions: PLAYERS,
      selectedPlayer: PLAYERS[0],
    })} />);
    expect(screen.getByTestId('option-0')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('option-1')).toHaveAttribute('aria-selected', 'false');
  });

  it('zeigt Coach-Option mit "(Trainer)" im Label', () => {
    render(<StepContext {...makeProps('player', {
      playerSearchOptions: [COACH_PLAYER],
    })} />);
    expect(screen.getByTestId('option-0')).toHaveTextContent('(Trainer)');
  });

  it('zeigt Spieler-Option OHNE "(Trainer)" im Label', () => {
    render(<StepContext {...makeProps('player', {
      playerSearchOptions: [PLAYERS[0]],
    })} />);
    expect(screen.getByTestId('option-0')).not.toHaveTextContent('(Trainer)');
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

  it('rendert das Autocomplete-Eingabefeld', () => {
    render(<StepContext {...makeProps('team')} />);
    expect(screen.getByTestId('autocomplete-input')).toBeInTheDocument();
  });

  it('zeigt den "Optional"-Hinweis', () => {
    render(<StepContext {...makeProps('team')} />);
    expect(screen.getByText(/Optional/i)).toBeInTheDocument();
  });

  it('zeigt bei leerem Input nur linkedTeams als Optionen (nicht alle)', () => {
    // TEAMS hat 3, LINKED_TEAMS hat 2 → nur 2 sollen erscheinen
    render(<StepContext {...makeProps('team')} />);
    expect(screen.getAllByTestId(/^option-/).length).toBe(LINKED_TEAMS.length);
    expect(screen.getByTestId('option-0')).toHaveTextContent('U17');
    expect(screen.getByTestId('option-1')).toHaveTextContent('U19');
    expect(screen.queryByText('Herren')).not.toBeInTheDocument();
  });

  it('zeigt noOptionsText "Keine verknüpften Mannschaften" wenn leer und linkedTeams=[]]', () => {
    render(<StepContext {...makeProps('team', { linkedTeams: [] })} />);
    expect(screen.getByTestId('no-options')).toHaveTextContent('Keine verknüpften Mannschaften');
  });

  it('ruft setSelectedTeam auf wenn ein Team ausgewählt wird', () => {
    const setSelectedTeam = jest.fn();
    render(<StepContext {...makeProps('team', { setSelectedTeam })} />);
    fireEvent.click(screen.getByTestId('option-0'));
    expect(setSelectedTeam).toHaveBeenCalledWith(LINKED_TEAMS[0]);
  });

  it('markiert bereits ausgewähltes Team als aktiv (isOptionEqualToValue)', () => {
    render(<StepContext {...makeProps('team', { selectedTeam: LINKED_TEAMS[0] })} />);
    expect(screen.getByTestId('option-0')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('option-1')).toHaveAttribute('aria-selected', 'false');
  });
});

// =============================================================================
//  subject='team_comparison' — Mannschaftsvergleich (Chip-Muster, KEINE Checkboxen)
// =============================================================================

describe('StepContext – subject=team_comparison', () => {
  it('zeigt die Überschrift "Welche Mannschaften vergleichen?"', () => {
    render(<StepContext {...makeProps('team_comparison')} />);
    expect(screen.getByText('Welche Mannschaften vergleichen?')).toBeInTheDocument();
  });

  it('rendert das Autocomplete-Eingabefeld (kein Checkbox-Muster)', () => {
    render(<StepContext {...makeProps('team_comparison')} />);
    expect(screen.getByTestId('autocomplete-input')).toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('zeigt bei leerem Input nur linkedTeams die noch nicht ausgewählt sind', () => {
    render(<StepContext {...makeProps('team_comparison', {
      linkedTeams: LINKED_TEAMS,
      selectedComparisonTeams: [1],
    })} />);
    // linkedTeams: U17 (id=1) und U19 (id=2) → U17 bereits ausgewählt → nur U19
    expect(screen.getAllByTestId(/^option-/).length).toBe(1);
    expect(screen.getByTestId('option-0')).toHaveTextContent('U19');
  });

  it('zeigt noOptionsText "Keine verknüpften Mannschaften" wenn leer und nichts verknüpft', () => {
    render(<StepContext {...makeProps('team_comparison', { linkedTeams: [] })} />);
    expect(screen.getByTestId('no-options')).toHaveTextContent('Keine verknüpften Mannschaften');
  });

  it('zeigt bereits ausgewählte Mannschaften als Chips', () => {
    render(<StepContext {...makeProps('team_comparison', {
      selectedComparisonTeams: [1, 2],
      teams: TEAMS,
    })} />);
    const chips = screen.getAllByTestId('chip');
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveTextContent('U17');
    expect(chips[1]).toHaveTextContent('U19');
  });

  it('ruft setSelectedComparisonTeams auf wenn Team aus Dropdown ausgewählt wird', () => {
    const setSelectedComparisonTeams = jest.fn();
    render(<StepContext {...makeProps('team_comparison', {
      linkedTeams: LINKED_TEAMS,
      setSelectedComparisonTeams,
    })} />);
    fireEvent.click(screen.getByTestId('option-0'));
    expect(setSelectedComparisonTeams).toHaveBeenCalledTimes(1);
  });

  it('ruft setSelectedComparisonTeams auf wenn Chip-Lösch-Button gedrückt wird', () => {
    const setSelectedComparisonTeams = jest.fn();
    render(<StepContext {...makeProps('team_comparison', {
      selectedComparisonTeams: [1],
      setSelectedComparisonTeams,
      teams: TEAMS,
    })} />);
    fireEvent.click(screen.getByRole('button', { name: /Remove U17/i }));
    expect(setSelectedComparisonTeams).toHaveBeenCalledTimes(1);
  });

  it('zeigt keinen Chip-Container wenn keine Teams ausgewählt', () => {
    render(<StepContext {...makeProps('team_comparison', { selectedComparisonTeams: [] })} />);
    expect(screen.queryAllByTestId('chip')).toHaveLength(0);
  });

  it('zeigt den "Optional"-Hinweis', () => {
    render(<StepContext {...makeProps('team_comparison')} />);
    expect(screen.getByText(/Optional/i)).toBeInTheDocument();
  });
});

// =============================================================================
//  subject='player_comparison' — Spielervergleich (Chip-Muster)
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

  it('zeigt CircularProgress wenn playerSearchLoading=true', () => {
    render(<StepContext {...makeProps('player_comparison', { playerSearchLoading: true })} />);
    expect(document.querySelector('svg circle')).toBeTruthy();
  });

  it('zeigt ausgewählte Spieler als Chips', () => {
    render(<StepContext {...makeProps('player_comparison', {
      selectedComparisonPlayers: PLAYERS,
    })} />);
    const chips = screen.getAllByTestId('chip');
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveTextContent('Max Müller');
    expect(chips[1]).toHaveTextContent('Anna Schmidt');
  });

  it('zeigt Coach-Chip mit "(Trainer)"-Label', () => {
    render(<StepContext {...makeProps('player_comparison', {
      selectedComparisonPlayers: [COACH_PLAYER],
    })} />);
    const chip = screen.getByTestId('chip');
    expect(chip).toHaveTextContent('(Trainer)');
  });

  it('ruft setSelectedComparisonPlayers auf wenn Chip-Lösch-Button gedrückt wird', () => {
    const setSelectedComparisonPlayers = jest.fn();
    render(<StepContext {...makeProps('player_comparison', {
      selectedComparisonPlayers: [PLAYERS[0]],
      setSelectedComparisonPlayers,
    })} />);
    fireEvent.click(screen.getByRole('button', { name: /Remove Max Müller/i }));
    expect(setSelectedComparisonPlayers).toHaveBeenCalledTimes(1);
  });

  it('ruft setSelectedComparisonPlayers auf wenn Spieler aus Dropdown ausgewählt wird', () => {
    const setSelectedComparisonPlayers = jest.fn();
    render(<StepContext {...makeProps('player_comparison', {
      playerSearchOptions: PLAYERS,
      setSelectedComparisonPlayers,
    })} />);
    fireEvent.click(screen.getByTestId('option-0'));
    expect(setSelectedComparisonPlayers).toHaveBeenCalledTimes(1);
  });

  it('ruft setPlayerSearchInput auf wenn Spieler hinzugefügt wird (Input leeren)', () => {
    const setPlayerSearchInput = jest.fn();
    render(<StepContext {...makeProps('player_comparison', {
      playerSearchOptions: PLAYERS,
      setPlayerSearchInput,
    })} />);
    fireEvent.click(screen.getByTestId('option-0'));
    // Nach Auswahl wird setPlayerSearchInput('') aufgerufen
    expect(setPlayerSearchInput).toHaveBeenCalledWith('');
  });

  it('fügt denselben Spieler nicht doppelt hinzu', () => {
    const setSelectedComparisonPlayers = jest.fn();
    render(<StepContext {...makeProps('player_comparison', {
      playerSearchOptions: [PLAYERS[0]],
      selectedComparisonPlayers: [PLAYERS[0]], // bereits drin
      setSelectedComparisonPlayers,
    })} />);
    fireEvent.click(screen.getByTestId('option-0'));
    // setSelectedComparisonPlayers wird nicht aufgerufen da Spieler bereits enthalten
    expect(setSelectedComparisonPlayers).not.toHaveBeenCalled();
  });

  it('zeigt keinen Chip-Container wenn keine Spieler ausgewählt', () => {
    render(<StepContext {...makeProps('player_comparison', { selectedComparisonPlayers: [] })} />);
    expect(screen.queryAllByTestId('chip')).toHaveLength(0);
  });

  it('zeigt den "Optional"-Hinweis', () => {
    render(<StepContext {...makeProps('player_comparison')} />);
    expect(screen.getByText(/Optional/i)).toBeInTheDocument();
  });

  it('zeigt Coach-Option im Dropdown mit "(Trainer)"-Suffix', () => {
    render(<StepContext {...makeProps('player_comparison', {
      playerSearchOptions: [COACH_PLAYER],
    })} />);
    expect(screen.getByTestId('option-0')).toHaveTextContent('(Trainer)');
  });
});

// =============================================================================
//  Fehlende Branches – subject='player'
// =============================================================================

describe('StepContext – player: fehlende Branches', () => {
  it('ruft setPlayerSearchInput auf wenn Text ins Suchfeld eingegeben wird', () => {
    const setPlayerSearchInput = jest.fn();
    render(<StepContext {...makeProps('player', { setPlayerSearchInput })} />);
    fireEvent.change(screen.getByTestId('autocomplete-input'), { target: { value: 'Max' } });
    expect(setPlayerSearchInput).toHaveBeenCalledWith('Max');
  });

  it('zeigt "Kein Spieler gefunden" wenn playerSearchInput.length >= 2 und keine Ergebnisse', () => {
    render(<StepContext {...makeProps('player', { playerSearchInput: 'xx', playerSearchOptions: [] })} />);
    expect(screen.getByTestId('no-options')).toHaveTextContent('Kein Spieler gefunden');
  });

  it('zeigt Spieler ohne teamName nur mit fullName im Label (kein ·)', () => {
    const playerNoTeam = { id: 20, fullName: 'Ohne Team', firstName: 'Ohne', lastName: 'Team', teamName: null as any };
    render(<StepContext {...makeProps('player', { playerSearchOptions: [playerNoTeam] })} />);
    expect(screen.getByTestId('option-0')).toHaveTextContent('Ohne Team');
    expect(screen.getByTestId('option-0')).not.toHaveTextContent('·');
  });

  it('zeigt Coach ohne teamName nur mit fullName und (Trainer) im Label (kein ·)', () => {
    const coachNoTeam = { id: 98, fullName: 'Kein Team Trainer', firstName: 'Kein', lastName: 'Trainer', teamName: null as any, type: 'coach' as const };
    render(<StepContext {...makeProps('player', { playerSearchOptions: [coachNoTeam] })} />);
    expect(screen.getByTestId('option-0')).toHaveTextContent('Kein Team Trainer (Trainer)');
    expect(screen.getByTestId('option-0')).not.toHaveTextContent('·');
  });
});

// =============================================================================
//  Fehlende Branches – subject='team'
// =============================================================================

describe('StepContext – team: fehlende Branches', () => {
  it('filtert Teams anhand von Texteingabe (teamInput !== "")', () => {
    render(<StepContext {...makeProps('team')} />);
    fireEvent.change(screen.getByTestId('autocomplete-input'), { target: { value: 'Her' } });
    expect(screen.getAllByTestId(/^option-/).length).toBe(1);
    expect(screen.getByTestId('option-0')).toHaveTextContent('Herren');
  });

  it('zeigt "Keine Mannschaft gefunden" wenn Texteingabe keinen Treffer ergibt', () => {
    render(<StepContext {...makeProps('team')} />);
    fireEvent.change(screen.getByTestId('autocomplete-input'), { target: { value: 'xyz' } });
    expect(screen.getByTestId('no-options')).toHaveTextContent('Keine Mannschaft gefunden');
  });

  it('ruft setTeamInput (onInputChange) auf bei Texteingabe', () => {
    // Nach Eingabe wechseln die Optionen von linkedTeams auf gefilterte teams
    render(<StepContext {...makeProps('team')} />);
    // Vorher: 2 linkedTeams
    expect(screen.getAllByTestId(/^option-/).length).toBe(2);
    fireEvent.change(screen.getByTestId('autocomplete-input'), { target: { value: 'U17' } });
    // Jetzt: filter über TEAMS → nur U17
    expect(screen.getAllByTestId(/^option-/).length).toBe(1);
  });
});

// =============================================================================
//  Fehlende Branches – subject='team_comparison'
// =============================================================================

describe('StepContext – team_comparison: fehlende Branches', () => {
  it('filtert Teams anhand von Texteingabe (teamCompInput !== "")', () => {
    render(<StepContext {...makeProps('team_comparison')} />);
    fireEvent.change(screen.getByTestId('autocomplete-input'), { target: { value: 'Her' } });
    expect(screen.getAllByTestId(/^option-/).length).toBe(1);
    expect(screen.getByTestId('option-0')).toHaveTextContent('Herren');
  });

  it('zeigt "Keine Mannschaft gefunden" wenn Texteingabe keinen Treffer ergibt', () => {
    render(<StepContext {...makeProps('team_comparison')} />);
    fireEvent.change(screen.getByTestId('autocomplete-input'), { target: { value: 'xyz' } });
    expect(screen.getByTestId('no-options')).toHaveTextContent('Keine Mannschaft gefunden');
  });

  it('führt innere Updater-Funktion beim Chip-Entfernen aus', () => {
    let teams = [1, 2];
    const setSelectedComparisonTeams = jest.fn((updater: any) => {
      if (typeof updater === 'function') teams = updater(teams);
    });
    render(<StepContext {...makeProps('team_comparison', {
      selectedComparisonTeams: [1, 2],
      setSelectedComparisonTeams,
      teams: TEAMS,
    })} />);
    fireEvent.click(screen.getByRole('button', { name: /Remove U17/i }));
    expect(teams).toEqual([2]);
  });

  it('führt innere Updater-Funktion beim Hinzufügen einer Mannschaft aus', () => {
    let teams: number[] = [1];
    const setSelectedComparisonTeams = jest.fn((updater: any) => {
      if (typeof updater === 'function') teams = updater(teams);
    });
    render(<StepContext {...makeProps('team_comparison', {
      linkedTeams: LINKED_TEAMS,
      selectedComparisonTeams: [1],
      setSelectedComparisonTeams,
    })} />);
    // Option-0 is U19 (U17 already selected)
    fireEvent.click(screen.getByTestId('option-0'));
    expect(teams).toContain(2);
  });
});

// =============================================================================
//  Fehlende Branches – subject='player_comparison'
// =============================================================================

describe('StepContext – player_comparison: fehlende Branches', () => {
  it('ruft setPlayerSearchInput auf wenn Text ins Suchfeld eingegeben wird', () => {
    const setPlayerSearchInput = jest.fn();
    render(<StepContext {...makeProps('player_comparison', { setPlayerSearchInput })} />);
    fireEvent.change(screen.getByTestId('autocomplete-input'), { target: { value: 'Max' } });
    expect(setPlayerSearchInput).toHaveBeenCalledWith('Max');
  });

  it('zeigt Chip ohne teamName nur mit fullName (kein ·)', () => {
    const playerNoTeam = { id: 20, fullName: 'Ohne Team', firstName: 'Ohne', lastName: 'Team', teamName: null as any };
    render(<StepContext {...makeProps('player_comparison', {
      selectedComparisonPlayers: [playerNoTeam],
    })} />);
    const chip = screen.getByTestId('chip');
    expect(chip).toHaveTextContent('Ohne Team');
    expect(chip).not.toHaveTextContent('·');
  });

  it('führt innere Updater-Funktion beim Chip-Entfernen aus', () => {
    let players = [...PLAYERS];
    const setSelectedComparisonPlayers = jest.fn((updater: any) => {
      if (typeof updater === 'function') players = updater(players);
    });
    render(<StepContext {...makeProps('player_comparison', {
      selectedComparisonPlayers: [...PLAYERS],
      setSelectedComparisonPlayers,
    })} />);
    fireEvent.click(screen.getByRole('button', { name: /Remove Max Müller/i }));
    expect(players).toHaveLength(1);
    expect(players[0].id).toBe(11);
  });

  it('führt innere Updater-Funktion beim Hinzufügen eines Spielers aus', () => {
    let players: any[] = [];
    const setSelectedComparisonPlayers = jest.fn((updater: any) => {
      if (typeof updater === 'function') players = updater(players);
    });
    const setPlayerSearchInput = jest.fn();
    render(<StepContext {...makeProps('player_comparison', {
      playerSearchOptions: [PLAYERS[0]],
      setSelectedComparisonPlayers,
      setPlayerSearchInput,
    })} />);
    fireEvent.click(screen.getByTestId('option-0'));
    expect(players).toContainEqual(PLAYERS[0]);
  });
});


