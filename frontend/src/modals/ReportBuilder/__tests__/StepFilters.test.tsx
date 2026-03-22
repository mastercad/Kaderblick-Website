/**
 * Tests für StepFilters (Spieler-Autocomplete)
 *
 * Geprüft werden:
 *  – fetchPlayerById wird beim Mount aufgerufen wenn filters.player gesetzt ist
 *  – fetchPlayerById wird NICHT aufgerufen wenn kein Spieler-Filter gesetzt ist
 *  – searchReportPlayers wird NICHT aufgerufen bei Eingaben unter 2 Zeichen
 *  – searchReportPlayers wird nach 300 ms Debounce aufgerufen
 *  – Schnelle Folge-Eingaben lösen nur einen einzigen API-Aufruf aus
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StepFilters } from '../StepFilters';

// ── Service-Mocks ──────────────────────────────────────────────────────────────

const mockSearch    = jest.fn();
const mockFetchById = jest.fn();

jest.mock('../../../services/reports', () => ({
  searchReportPlayers: (...a: any[]) => mockSearch(...a),
  fetchPlayerById:     (...a: any[]) => mockFetchById(...a),
}));

// ── MUI Autocomplete mock ─────────────────────────────────────────────────────
//
// MUI Autocomplete uses internal event delegation that fireEvent.change does
// not reliably bypass. We replace it with a plain <input> that forwards its
// value directly to onInputChange — identical to what the real Autocomplete
// does when the user types, but without the MUI wrapper complexity.

jest.mock('@mui/material', () => {
  const actual = jest.requireActual('@mui/material') as Record<string, unknown>;
  return {
    ...actual,
    Autocomplete: ({
      onInputChange,
      inputValue,
    }: any) => (
      <input
        data-testid="player-autocomplete"
        placeholder="Name eintippen..."
        value={inputValue ?? ''}
        onChange={(e) => {
          onInputChange?.(e, e.target.value, 'input');
        }}
      />
    ),
  };
});

// ── Minimal BuilderData ────────────────────────────────────────────────────────

const BUILDER_DATA = {
  fields: [],
  teams:        [{ id: 1, name: 'U17' }],
  eventTypes:   [{ id: 1, name: 'Tor' }],
  surfaceTypes: [],
  gameTypes:    [],
  availableDates: ['2024-01-01'],
  minDate: '2024-01-01',
  maxDate: '2024-01-01',
};

// ── State factory ──────────────────────────────────────────────────────────────

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

// ── Setup / Teardown ───────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// =============================================================================
//  Spieler-Filter wiederherstellen (fetchPlayerById)
// =============================================================================

describe('StepFilters - gespeicherten Spieler-Filter wiederherstellen', () => {
  it('ruft fetchPlayerById beim Mount auf wenn filters.player einen Wert enthaelt', async () => {
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

  it('konvertiert den players-String korrekt in eine Zahl', async () => {
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

describe('StepFilters - Spieler-Autocomplete-Suche', () => {
  function getPlayerInput() {
    return screen.getByTestId('player-autocomplete');
  }

  it('ruft searchReportPlayers NICHT auf fuer Eingaben unter 2 Zeichen', async () => {
    mockSearch.mockResolvedValue([]);
    render(<StepFilters state={makeState()} />);

    await act(async () => {
      fireEvent.change(getPlayerInput(), { target: { value: 'M' } });
    });

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('ruft searchReportPlayers NICHT auf bei leerem Eingabefeld', async () => {
    mockSearch.mockResolvedValue([]);
    render(<StepFilters state={makeState()} />);

    await act(async () => {
      fireEvent.change(getPlayerInput(), { target: { value: '' } });
    });

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('ruft searchReportPlayers nach 300 ms Debounce auf wenn 2+ Zeichen eingegeben werden', async () => {
    mockSearch.mockResolvedValue([]);
    render(<StepFilters state={makeState()} />);

    await act(async () => {
      fireEvent.change(getPlayerInput(), { target: { value: 'Mu' } });
    });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(mockSearch).toHaveBeenCalledWith('Mu');
  });

  it('debounced: schnelle Eingaben loesen nur einen einzigen API-Aufruf aus', async () => {
    mockSearch.mockResolvedValue([]);
    render(<StepFilters state={makeState()} />);
    const input = getPlayerInput();

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Mu' } });
    });
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Mue' } });
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith('Mue');
  });
});
