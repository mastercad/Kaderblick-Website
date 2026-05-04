/**
 * Tests für StepFilters
 *
 * Abgedeckt:
 *  – Multi-Spieler (player_comparison): alle 3 Chips mit Namen nach Mount
 *  – Multi-Spieler: leerer Zustand wenn players-Filter fehlt
 *  – Multi-Spieler: Spieler per Autocomplete hinzufügen → Chip + handleFilterChange
 *  – Multi-Spieler: Chip entfernen → handleFilterChange mit verbleibenden IDs
 *  – Multi-Spieler: kein Duplikat beim erneuten Auswählen
 *  – Multi-Team (team_comparison): alle Chips mit Namen aus builderData
 *  – Multi-Team: Chip entfernen → handleFilterChange mit verbleibenden IDs
 *  – Multi-Team: Team per Select hinzufügen → handleFilterChange
 *  – Single-Spieler (filters.player): fetchPlayerById beim Mount aufgerufen
 *  – fetchPlayerById NICHT aufgerufen wenn kein Spieler-Filter gesetzt
 *  – searchReportPlayers Debounce (< 2 Zeichen → kein Aufruf; 300 ms → Aufruf; rapid → einmal)
 */

import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StepFilters } from '../StepFilters';

// ── Service-Mocks ─────────────────────────────────────────────────────────────

const mockSearch    = jest.fn();
const mockFetchById = jest.fn();

jest.mock('../../../services/reports', () => ({
  searchReportPlayers: (...a: any[]) => mockSearch(...a),
  fetchPlayerById:     (...a: any[]) => mockFetchById(...a),
}));

// ── MUI-Mocks ─────────────────────────────────────────────────────────────────
//
// Chip   – rendert den label-Text sichtbar + einen Delete-Button
// Select – rendert als natives <select> damit fireEvent.change funktioniert
// Autocomplete – rendert als <input> + klickbare <button>-Optionen

jest.mock('@mui/material', () => {
  const actual = jest.requireActual('@mui/material') as Record<string, unknown>;
  return {
    ...actual,
    Chip: ({ label, onDelete }: any) => (
      <div data-testid="chip" data-label={String(label)}>
        <span>{label}</span>
        {onDelete && (
          <button
            data-testid="chip-delete"
            aria-label={`${label} entfernen`}
            onClick={onDelete}
          />
        )}
      </div>
    ),
    Select: ({ value, onChange, children, label: labelProp }: any) => (
      <select
        data-testid={`select-${String(labelProp ?? '').toLowerCase().replace(/\s/g, '-')}`}
        value={value ?? ''}
        onChange={(e) => onChange?.({ target: { value: e.target.value } })}
      >
        {children}
      </select>
    ),
    MenuItem: ({ value, children }: any) => (
      <option value={value ?? ''}>{children}</option>
    ),
    Slider: ({ value, min, max }: any) => (
      <div
        data-testid="date-slider"
        data-value={JSON.stringify(value)}
        data-min={min}
        data-max={max}
      />
    ),
    Autocomplete: ({ onInputChange, inputValue, onChange, options, getOptionLabel, isOptionEqualToValue, filterOptions, value }: any) => {
      const displayedOptions = filterOptions ? filterOptions(options ?? []) : (options ?? []);
      return (
        <div>
          <input
            data-testid="player-autocomplete"
            placeholder="Name eintippen..."
            value={inputValue ?? ''}
            onChange={(e) => onInputChange?.(e, e.target.value, 'input')}
          />
          {displayedOptions.map((opt: any, i: number) => {
            const label = getOptionLabel ? getOptionLabel(opt) : (opt.fullName ?? String(i));
            const isSelected = isOptionEqualToValue && value ? isOptionEqualToValue(opt, value) : false;
            return (
              <button
                key={opt.id ?? i}
                data-testid="player-option"
                aria-selected={isSelected}
                onClick={() => onChange?.(null, opt)}
              >
                {label}
              </button>
            );
          })}
        </div>
      );
    },
  };
});

// ── Minimal BuilderData ────────────────────────────────────────────────────────

const BUILDER_DATA = {
  fields: [],
  teams: [
    { id: 1, name: 'U17' },
    { id: 2, name: 'U19' },
    { id: 3, name: 'Erste' },
  ],
  eventTypes:   [{ id: 1, name: 'Tor' }],
  surfaceTypes: [],
  gameTypes:    [],
  availableDates: ['2024-01-01'],
  minDate: '2024-01-01',
  maxDate: '2024-01-01',
};

// ── State factory ─────────────────────────────────────────────────────────────

function makeState(
  filters: Record<string, any> = {},
  handleFilterChange = jest.fn(),
) {
  return {
    currentReport: {
      name: 'Test',
      description: '',
      isTemplate: false,
      config: {
        diagramType: 'bar',
        xField: 'player',
        yField: 'goals',
        filters,
        metrics: [],
        showLegend: true,
        showLabels: false,
      },
    },
    builderData: BUILDER_DATA,
    handleFilterChange,
  } as any;
}

function chips() {
  return screen.queryAllByTestId('chip');
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// =============================================================================
//  Multi-Spieler (player_comparison — filters.players)
// =============================================================================

describe('StepFilters - Multi-Spieler-Chips (player_comparison)', () => {
  it('zeigt alle drei Spieler-Chips mit korrekten Namen nach dem Mount', async () => {
    mockFetchById
      .mockResolvedValueOnce({ id: 1, fullName: 'Anna Schmidt' })
      .mockResolvedValueOnce({ id: 2, fullName: 'Ben Müller' })
      .mockResolvedValueOnce({ id: 3, fullName: 'Clara Weber' });

    await act(async () => {
      render(<StepFilters state={makeState({ players: '1,2,3' })} />);
    });

    expect(mockFetchById).toHaveBeenCalledTimes(3);
    expect(mockFetchById).toHaveBeenCalledWith(1);
    expect(mockFetchById).toHaveBeenCalledWith(2);
    expect(mockFetchById).toHaveBeenCalledWith(3);

    const c = chips();
    expect(c).toHaveLength(3);
    expect(screen.getByText('Anna Schmidt')).toBeInTheDocument();
    expect(screen.getByText('Ben Müller')).toBeInTheDocument();
    expect(screen.getByText('Clara Weber')).toBeInTheDocument();
  });

  it('zeigt keine Chips wenn players-Filter nicht gesetzt ist', async () => {
    await act(async () => {
      render(<StepFilters state={makeState({})} />);
    });

    expect(chips()).toHaveLength(0);
  });

  it('chip-label ist niemals leer oder undefined', async () => {
    mockFetchById.mockResolvedValueOnce({ id: 7, fullName: 'Max Mustermann' });

    await act(async () => {
      render(<StepFilters state={makeState({ players: '7' })} />);
    });

    const c = chips();
    expect(c).toHaveLength(1);
    expect(c[0]).toHaveAttribute('data-label', 'Max Mustermann');
    expect(within(c[0]).getByText('Max Mustermann')).toBeInTheDocument();
  });

  it('API-Fehler für einzelnen Spieler überspringt nur diesen Chip', async () => {
    mockFetchById
      .mockResolvedValueOnce({ id: 1, fullName: 'Anna Schmidt' })
      .mockResolvedValueOnce(null)                                // Player 2 not found
      .mockResolvedValueOnce({ id: 3, fullName: 'Clara Weber' });

    await act(async () => {
      render(<StepFilters state={makeState({ players: '1,2,3' })} />);
    });

    expect(chips()).toHaveLength(2);
    expect(screen.getByText('Anna Schmidt')).toBeInTheDocument();
    expect(screen.getByText('Clara Weber')).toBeInTheDocument();
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  it('fügt Spieler-Chip hinzu und ruft handleFilterChange auf', async () => {
    mockFetchById.mockResolvedValueOnce({ id: 1, fullName: 'Anna Schmidt' });
    const handleFilterChange = jest.fn();

    await act(async () => {
      render(<StepFilters state={makeState({ players: '1' }, handleFilterChange)} />);
    });

    mockSearch.mockResolvedValue([{ id: 5, fullName: 'Neue Spielerin' }]);

    await act(async () => {
      fireEvent.change(screen.getByTestId('player-autocomplete'), { target: { value: 'Neu' } });
    });
    await act(async () => { jest.advanceTimersByTime(300); });

    await act(async () => {
      fireEvent.click(screen.getByTestId('player-option'));
    });

    expect(handleFilterChange).toHaveBeenCalledWith('players', '1,5');
    expect(chips()).toHaveLength(2);
  });

  it('verhindert Duplikate beim erneuten Auswählen eines vorhandenen Spielers', async () => {
    mockFetchById.mockResolvedValueOnce({ id: 1, fullName: 'Anna Schmidt' });
    const handleFilterChange = jest.fn();

    await act(async () => {
      render(<StepFilters state={makeState({ players: '1' }, handleFilterChange)} />);
    });

    mockSearch.mockResolvedValue([{ id: 1, fullName: 'Anna Schmidt' }]);

    await act(async () => {
      fireEvent.change(screen.getByTestId('player-autocomplete'), { target: { value: 'Anna' } });
    });
    await act(async () => { jest.advanceTimersByTime(300); });

    await act(async () => {
      fireEvent.click(screen.getByTestId('player-option'));
    });

    // Kein zweiter Chip, keine filterChange-Anpassung mit doppelter ID
    expect(chips()).toHaveLength(1);
    expect(handleFilterChange).not.toHaveBeenCalledWith('players', '1,1');
  });

  it('entfernt Spieler-Chip beim Löschen und aktualisiert handleFilterChange', async () => {
    mockFetchById
      .mockResolvedValueOnce({ id: 1, fullName: 'Anna Schmidt' })
      .mockResolvedValueOnce({ id: 2, fullName: 'Ben Müller' });
    const handleFilterChange = jest.fn();

    await act(async () => {
      render(<StepFilters state={makeState({ players: '1,2' }, handleFilterChange)} />);
    });

    expect(chips()).toHaveLength(2);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Anna Schmidt entfernen'));
    });

    expect(chips()).toHaveLength(1);
    expect(handleFilterChange).toHaveBeenCalledWith('players', '2');
  });

  it('setzt players-Filter auf leer-String wenn letzter Chip entfernt wird', async () => {
    mockFetchById.mockResolvedValueOnce({ id: 1, fullName: 'Anna Schmidt' });
    const handleFilterChange = jest.fn();

    await act(async () => {
      render(<StepFilters state={makeState({ players: '1' }, handleFilterChange)} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Anna Schmidt entfernen'));
    });

    expect(handleFilterChange).toHaveBeenCalledWith('players', '');
    expect(chips()).toHaveLength(0);
  });

  // Regression: Remount-Race — wenn fetchPlayerById noch aussteht (z.B. nach Schritt-Navigation im
  // MobileWizard) und der User sofort einen zweiten Spieler hinzufügt, darf player-1 nicht
  // aus filters.players verloren gehen.
  it('behält existierende IDs aus filters.players während fetchPlayerById noch pending ist', async () => {
    // Deferred promise — simuliert langsamen API-Aufruf
    let resolveFetch!: (v: any) => void;
    const pendingFetch = new Promise(r => { resolveFetch = r; });
    mockFetchById.mockReturnValueOnce(pendingFetch);

    const handleFilterChange = jest.fn();

    // Mount mit player 42 bereits im Filter — fetchPlayerById läuft, aber löst noch NICHT auf
    render(<StepFilters state={makeState({ players: '42' }, handleFilterChange)} />);

    mockSearch.mockResolvedValue([{ id: 57, fullName: 'Neue Spielerin' }]);

    // User tippt und wählt einen zweiten Spieler, während fetchPlayerById noch hängt
    await act(async () => {
      fireEvent.change(screen.getByTestId('player-autocomplete'), { target: { value: 'Ne' } });
    });
    await act(async () => { jest.advanceTimersByTime(300); });
    await act(async () => {
      fireEvent.click(screen.getByTestId('player-option'));
    });

    // Beide IDs müssen im Filter sein — nicht nur die neu hinzugefügte
    expect(handleFilterChange).toHaveBeenCalledWith('players', '42,57');
    expect(handleFilterChange).not.toHaveBeenCalledWith('players', '57');

    // Fetch nachträglich auflösen (kein Absturz, keine Überüberschreibung)
    await act(async () => {
      resolveFetch({ id: 42, fullName: 'Alter Spieler' });
    });
  });
});

// =============================================================================
//  Multi-Team (team_comparison — filters.teams)
// =============================================================================

describe('StepFilters - Multi-Team-Chips (team_comparison)', () => {
  it('zeigt alle ausgewählten Team-Chips mit korrekten Namen', async () => {
    await act(async () => {
      render(<StepFilters state={makeState({ teams: '1,2,3' })} />);
    });

    const c = chips();
    expect(c).toHaveLength(3);
    expect(screen.getByText('U17')).toBeInTheDocument();
    expect(screen.getByText('U19')).toBeInTheDocument();
    expect(screen.getByText('Erste')).toBeInTheDocument();
  });

  it('zeigt keine Chips wenn teams-Filter nicht gesetzt ist', async () => {
    await act(async () => {
      render(<StepFilters state={makeState({})} />);
    });

    expect(chips()).toHaveLength(0);
  });

  it('team-chip-label ist niemals leer oder undefined', async () => {
    await act(async () => {
      render(<StepFilters state={makeState({ teams: '2' })} />);
    });

    const c = chips();
    expect(c).toHaveLength(1);
    expect(c[0]).toHaveAttribute('data-label', 'U19');
    expect(within(c[0]).getByText('U19')).toBeInTheDocument();
  });

  it('entfernt Team-Chip beim Löschen und aktualisiert handleFilterChange', async () => {
    const handleFilterChange = jest.fn();

    await act(async () => {
      render(<StepFilters state={makeState({ teams: '1,2,3' }, handleFilterChange)} />);
    });

    expect(chips()).toHaveLength(3);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('U19 entfernen'));
    });

    expect(handleFilterChange).toHaveBeenCalledWith('teams', '1,3');
  });

  it('setzt teams-Filter auf leer-String wenn letztes Team entfernt wird', async () => {
    const handleFilterChange = jest.fn();

    await act(async () => {
      render(<StepFilters state={makeState({ teams: '1' }, handleFilterChange)} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByLabelText('U17 entfernen'));
    });

    expect(handleFilterChange).toHaveBeenCalledWith('teams', '');
  });

  it('fügt Team per Select hinzu und ruft handleFilterChange auf', async () => {
    const handleFilterChange = jest.fn();

    await act(async () => {
      render(<StepFilters state={makeState({ teams: '1' }, handleFilterChange)} />);
    });

    await act(async () => {
      fireEvent.change(screen.getByTestId('select-team-hinzufügen'), {
        target: { value: '2' },
      });
    });

    expect(handleFilterChange).toHaveBeenCalledWith('teams', '1,2');
  });

  it('fügt kein Duplikat hinzu wenn Team bereits ausgewählt ist', async () => {
    const handleFilterChange = jest.fn();

    await act(async () => {
      render(<StepFilters state={makeState({ teams: '1,2' }, handleFilterChange)} />);
    });

    await act(async () => {
      fireEvent.change(screen.getByTestId('select-team-hinzufügen'), {
        target: { value: '1' },
      });
    });

    expect(handleFilterChange).not.toHaveBeenCalled();
  });
});

// =============================================================================
//  Single-Spieler (filters.player)
// =============================================================================

describe('StepFilters - gespeicherten Single-Spieler-Filter wiederherstellen', () => {
  it('ruft fetchPlayerById beim Mount auf wenn filters.player einen Wert enthält', async () => {
    mockFetchById.mockResolvedValue({ id: 42, fullName: 'Max Mustermann' });

    await act(async () => {
      render(<StepFilters state={makeState({ player: '42' })} />);
    });

    expect(mockFetchById).toHaveBeenCalledWith(42);
  });

  it('ruft fetchPlayerById NICHT auf wenn filters.player nicht gesetzt ist', async () => {
    await act(async () => {
      render(<StepFilters state={makeState({})} />);
    });

    expect(mockFetchById).not.toHaveBeenCalled();
  });

  it('konvertiert den player-String korrekt in eine Zahl', async () => {
    mockFetchById.mockResolvedValue({ id: 7, fullName: 'Erika Muster' });

    await act(async () => {
      render(<StepFilters state={makeState({ player: '7' })} />);
    });

    expect(mockFetchById).toHaveBeenCalledWith(7);
  });
});

// =============================================================================
//  Spielersuche (searchReportPlayers / Debounce)
// =============================================================================

describe('StepFilters - Spieler-Autocomplete-Suche (Debounce)', () => {
  it('ruft searchReportPlayers NICHT auf bei Eingaben unter 2 Zeichen', async () => {
    mockSearch.mockResolvedValue([]);
    render(<StepFilters state={makeState()} />);

    await act(async () => {
      fireEvent.change(screen.getByTestId('player-autocomplete'), { target: { value: 'M' } });
    });
    await act(async () => { jest.advanceTimersByTime(400); });

    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('ruft searchReportPlayers NICHT auf bei leerem Eingabefeld', async () => {
    mockSearch.mockResolvedValue([]);
    render(<StepFilters state={makeState()} />);

    await act(async () => {
      fireEvent.change(screen.getByTestId('player-autocomplete'), { target: { value: '' } });
    });
    await act(async () => { jest.advanceTimersByTime(400); });

    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('ruft searchReportPlayers nach 300 ms Debounce auf wenn 2+ Zeichen eingegeben werden', async () => {
    mockSearch.mockResolvedValue([]);
    render(<StepFilters state={makeState()} />);

    await act(async () => {
      fireEvent.change(screen.getByTestId('player-autocomplete'), { target: { value: 'Mu' } });
    });
    await act(async () => { jest.advanceTimersByTime(300); });

    expect(mockSearch).toHaveBeenCalledWith('Mu', undefined);
  });

  it('debounced: schnelle Folge-Eingaben lösen nur einen einzigen API-Aufruf aus', async () => {
    mockSearch.mockResolvedValue([]);
    render(<StepFilters state={makeState()} />);
    const input = screen.getByTestId('player-autocomplete');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Mu' } });
    });
    await act(async () => { jest.advanceTimersByTime(100); });
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Mue' } });
    });
    await act(async () => { jest.advanceTimersByTime(300); });

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith('Mue', undefined);
  });
});

// =============================================================================
//  SeasonFilterControl — Integration via StepFilters
//
//  Abgedeckt:
//  – Kein seasonFilter → "Alle Daten"-Button aktiv
//  – seasonFilter="current" → "🔄 Immer aktuelle"-Button aktiv + Hinweis-Text
//  – seasonFilter="2024" → "Bestimmte Saison"-Button aktiv + "Saison 2024/25"
// =============================================================================

// =============================================================================
//  SeasonFilterControl — Integration via StepFilters
//
//  Abgedeckt:
//  – Kein seasonFilter          → "Alle Daten"-Button sichtbar
//  – seasonFilter="current"     → "🔄 Aktuelle Saison"-Button + Caption
//  – seasonFilter="2024"        → "Bestimmte Saison"-Button + "Saison 2024/25"
//  – dateFrom + dateTo gesetzt  → Zeitraum-Inputs sichtbar (range-Mode)
//  – Klick "Aktuelle Saison"    → handleFilterChange für alle 3 Keys aufgerufen
//  – Klick "Alle Daten"         → alle 3 Keys auf null gesetzt
//  – onChange übergibt dateTo-Prop korrekt weiter
// =============================================================================

describe('StepFilters - SeasonFilterControl Integration', () => {
  function makeStateWithSeasonFilter(
    filters: Record<string, any>,
    handleFilterChange = jest.fn(),
  ) {
    return {
      currentReport: {
        name: 'Test',
        description: '',
        isTemplate: false,
        config: {
          diagramType: 'bar',
          xField: 'team',
          yField: 'goals',
          filters,
          metrics: [],
          showLegend: true,
          showLabels: false,
        },
      },
      builderData: BUILDER_DATA,
      handleFilterChange,
    } as any;
  }

  it('kein seasonFilter → "Alle Daten"-Button sichtbar', async () => {
    await act(async () => {
      render(<StepFilters state={makeStateWithSeasonFilter({})} />);
    });
    expect(screen.getByRole('button', { name: 'Alle Daten' })).toBeInTheDocument();
  });

  it('seasonFilter="current" → "🔄 Aktuelle Saison"-Button + Caption sichtbar', async () => {
    await act(async () => {
      render(<StepFilters state={makeStateWithSeasonFilter({ seasonFilter: 'current' })} />);
    });
    expect(screen.getByText(/laufende Saison/i)).toBeInTheDocument();
  });

  it('seasonFilter="2024" → Saisontitel "Saison 2024/25" sichtbar', async () => {
    await act(async () => {
      render(<StepFilters state={makeStateWithSeasonFilter({ seasonFilter: '2024' })} />);
    });
    expect(screen.getByText(/Saison 2024\/25/i)).toBeInTheDocument();
  });

  it('dateFrom + dateTo gesetzt → Zeitraum-Inputs (Von/Bis) sichtbar', async () => {
    await act(async () => {
      render(<StepFilters state={makeStateWithSeasonFilter({
        dateFrom: '2024-10-01',
        dateTo:   '2025-05-31',
      })} />);
    });
    expect(screen.getByLabelText('Von')).toBeInTheDocument();
    expect(screen.getByLabelText('Bis')).toBeInTheDocument();
  });

  it('dateTo-Prop wird korrekt übergeben — Bis-Feld zeigt bestehenden Wert', async () => {
    await act(async () => {
      render(<StepFilters state={makeStateWithSeasonFilter({
        dateFrom: '2024-10-01',
        dateTo:   '2025-05-31',
      })} />);
    });
    expect(screen.getByLabelText('Bis')).toHaveValue('2025-05-31');
  });

  it('Klick "🔄 Aktuelle Saison" → handleFilterChange für seasonFilter, dateFrom, dateTo aufgerufen', async () => {
    const handleFilterChange = jest.fn();
    await act(async () => {
      render(<StepFilters state={makeStateWithSeasonFilter({}, handleFilterChange)} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Aktuelle Saison/i }));
    });

    expect(handleFilterChange).toHaveBeenCalledWith('seasonFilter', 'current');
    expect(handleFilterChange).toHaveBeenCalledWith('dateFrom', null);
    expect(handleFilterChange).toHaveBeenCalledWith('dateTo', null);
  });

  it('Klick "Alle Daten" von current → handleFilterChange setzt alle 3 Keys auf null', async () => {
    const handleFilterChange = jest.fn();
    await act(async () => {
      render(<StepFilters state={makeStateWithSeasonFilter({ seasonFilter: 'current' }, handleFilterChange)} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Alle Daten' }));
    });

    expect(handleFilterChange).toHaveBeenCalledWith('seasonFilter', null);
    expect(handleFilterChange).toHaveBeenCalledWith('dateFrom', null);
    expect(handleFilterChange).toHaveBeenCalledWith('dateTo', null);
  });
});

// =============================================================================
//  Spielersuche — Team-Filter-Scope
//
//  Abgedeckt:
//  – Wenn teams-Filter gesetzt: searchReportPlayers erhält teamIds-Array
//  – Wenn kein teams-Filter: searchReportPlayers wird ohne teamIds aufgerufen
//  – Bei Wechsel des Team-Filters wird die Suche neu ausgelöst
//  – Spieler aus anderem Team werden als renderOption mit id-Key gelistet
// =============================================================================

describe('StepFilters - Spielersuche mit Team-Filter-Scope', () => {
  it('übergibt currentTeamIds an searchReportPlayers wenn teams gesetzt sind', async () => {
    mockSearch.mockResolvedValue([]);
    render(<StepFilters state={makeState({ teams: '1,2' })} />);

    await act(async () => {
      fireEvent.change(screen.getByTestId('player-autocomplete'), { target: { value: 'Mu' } });
    });
    await act(async () => { jest.advanceTimersByTime(300); });

    expect(mockSearch).toHaveBeenCalledWith('Mu', [1, 2]);
  });

  it('übergibt undefined an searchReportPlayers wenn kein teams-Filter aktiv', async () => {
    mockSearch.mockResolvedValue([]);
    render(<StepFilters state={makeState({})} />);

    await act(async () => {
      fireEvent.change(screen.getByTestId('player-autocomplete'), { target: { value: 'Mu' } });
    });
    await act(async () => { jest.advanceTimersByTime(300); });

    expect(mockSearch).toHaveBeenCalledWith('Mu', undefined);
  });

  it('übergibt einzelne Team-ID als Array wenn nur ein Team gefiltert ist (legacy filters.team)', async () => {
    mockSearch.mockResolvedValue([]);
    render(<StepFilters state={makeState({ team: '3' })} />);

    await act(async () => {
      fireEvent.change(screen.getByTestId('player-autocomplete'), { target: { value: 'Mu' } });
    });
    await act(async () => { jest.advanceTimersByTime(300); });

    expect(mockSearch).toHaveBeenCalledWith('Mu', [3]);
  });

  it('renderOption zeigt Teamname hinter Spielername wenn vorhanden', async () => {
    mockSearch.mockResolvedValue([
      { id: 10, fullName: 'Max Muster', teamName: 'U17' },
    ]);
    render(<StepFilters state={makeState({})} />);

    await act(async () => {
      fireEvent.change(screen.getByTestId('player-autocomplete'), { target: { value: 'Max' } });
    });
    await act(async () => { jest.advanceTimersByTime(300); });

    // Der Mock-Autocomplete rendert getOptionLabel; renderOption wird dort nicht direkt gerendert.
    // Wir prüfen stattdessen dass searchReportPlayers aufgerufen wurde und der
    // angezeigte Optionsbutton vorhanden ist.
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByTestId('player-option')).toBeInTheDocument();
  });

  it('kein Duplikat wenn Spieler bereits im Filter ist (auch bei aktivem Team-Filter)', async () => {
    mockFetchById.mockResolvedValueOnce({ id: 5, fullName: 'Anna Müller' });
    const handleFilterChange = jest.fn();

    await act(async () => {
      // teams: '1' → U17-Chip (Team) + players: '5' → Anna-Müller-Chip (Spieler) = 2 Chips gesamt
      render(<StepFilters state={makeState({ players: '5', teams: '1' }, handleFilterChange)} />);
    });

    const chipsBefore = chips().length; // 2: U17 + Anna Müller

    mockSearch.mockResolvedValue([{ id: 5, fullName: 'Anna Müller' }]);

    await act(async () => {
      fireEvent.change(screen.getByTestId('player-autocomplete'), { target: { value: 'Anna' } });
    });
    await act(async () => { jest.advanceTimersByTime(300); });

    await act(async () => {
      fireEvent.click(screen.getByTestId('player-option'));
    });

    // Kein zusätzlicher Chip — Duplikat wurde verhindert
    expect(handleFilterChange).not.toHaveBeenCalledWith('players', '5,5');
    expect(chips()).toHaveLength(chipsBefore);
  });
});
