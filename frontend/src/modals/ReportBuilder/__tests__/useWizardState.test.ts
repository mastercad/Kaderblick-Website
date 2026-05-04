/**
 * Tests für useWizardState
 *
 * Abgedeckt:
 *  – hasContextStep: false für team/team_comparison wenn nur 1 Team; true für player/player_comparison immer
 *  – handleSelectSubject → autoAdvance → Schritt 1 (mit Context-Step) oder Schritt 2 (ohne)
 *  – handleSelectSubject setzt topic/team/player zurück
 *  – handleSelectTopic → autoAdvance → Schritt 3
 *  – handleSelectTimeRange + autoAdvance → goToConfirm → Schritt 4
 *  – goToConfirm: setzt reportName, ruft setCurrentReport auf, geht zu Schritt 4
 *  – handleBack bei step=0 → ruft onBack auf
 *  – handleBack bei step=2 (kein Context-Step) → springt zu Schritt 0
 *  – handleBack bei step=3 → geht zu Schritt 2
 *  – handleSave: Abbruch wenn Pflichtfelder fehlen
 *  – handleSave: ruft onSave und onClose auf; managing saving-State
 *  – handleSave: saving=false auch bei onSave-Fehler
 *  – initialConfig: ruft onOpenBuilder auf wenn Konfiguration unlesbar
 *  – initialConfig: stellt subject/topic/timeRange aus gültiger Konfiguration wieder her
 *  – Debounced Player-Suche: kein Aufruf bei < 2 Zeichen
 *  – Debounced Player-Suche: searchReportPlayers nach 300ms
 *  – Debounced Player-Suche: Abbruch bei raschem Input-Wechsel
 */

import { renderHook, act } from '@testing-library/react';
import { useWizardState } from '../useWizardState';
import type { ReportConfig } from '../types';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockSearch = jest.fn();
const mockFetchById = jest.fn();

jest.mock('../../../services/reports', () => ({
  searchReportPlayers: (...args: any[]) => mockSearch(...args),
  fetchPlayerById: (...args: any[]) => mockFetchById(...args),
}));

jest.mock('@mui/material/styles', () => ({
  useTheme: () => ({
    breakpoints: { down: () => '@media (max-width: 600px)' },
  }),
}));

jest.mock('@mui/material', () => ({
  useMediaQuery: () => false,
}));

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeTeams(count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Team${i + 1}` }));
}

const AVAILABLE_DATES = [
  '2024-08-10', '2024-09-07', '2024-10-05', '2024-11-02',
  '2024-12-07', '2025-01-11', '2025-02-08', '2025-03-08',
  '2025-04-05', '2025-05-03',
];

function makeState(teamCount = 2) {
  return {
    builderData: {
      teams: makeTeams(teamCount),
      availableDates: AVAILABLE_DATES,
      minDate: AVAILABLE_DATES[0],
      maxDate: AVAILABLE_DATES[AVAILABLE_DATES.length - 1],
      fields: [],
      eventTypes: [],
      surfaceTypes: [],
      gameTypes: [],
      presets: [],
    },
    setCurrentReport: jest.fn(),
    currentReport: {
      id: 1,
      name: 'Test Report',
      description: '',
      isTemplate: false,
      config: { diagramType: 'bar', xField: 'team', yField: 'goals', filters: {}, metrics: [], showLegend: true, showLabels: false },
    },
  };
}

// makeInput is defined at the bottom of the file (overloaded version that also accepts initialConfig)

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.useFakeTimers();
  mockSearch.mockReset();
  mockFetchById.mockReset();
  mockFetchById.mockResolvedValue(null);
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
// hasContextStep
// ─────────────────────────────────────────────────────────────────────────────

describe('hasContextStep', () => {
  it('returns false for "team" when only 1 team available', () => {
    const { result } = renderHook(() => useWizardState(makeInput({}, makeState(1))));
    expect(result.current.hasContextStep('team')).toBe(false);
  });

  it('returns true for "team" when >1 teams available', () => {
    const { result } = renderHook(() => useWizardState(makeInput({}, makeState(2))));
    expect(result.current.hasContextStep('team')).toBe(true);
  });

  it('returns false for "team_comparison" when only 1 team', () => {
    const { result } = renderHook(() => useWizardState(makeInput({}, makeState(1))));
    expect(result.current.hasContextStep('team_comparison')).toBe(false);
  });

  it('returns true for "team_comparison" when >1 teams', () => {
    const { result } = renderHook(() => useWizardState(makeInput({}, makeState(3))));
    expect(result.current.hasContextStep('team_comparison')).toBe(true);
  });

  it('always returns true for "player"', () => {
    const { result } = renderHook(() => useWizardState(makeInput({}, makeState(1))));
    expect(result.current.hasContextStep('player')).toBe(true);
  });

  it('always returns true for "player_comparison"', () => {
    const { result } = renderHook(() => useWizardState(makeInput({}, makeState(1))));
    expect(result.current.hasContextStep('player_comparison')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleSelectSubject + autoAdvance
// ─────────────────────────────────────────────────────────────────────────────

describe('handleSelectSubject + autoAdvance', () => {
  it('advances to step 1 after delay when subject has context step (player, 2 teams)', () => {
    const { result } = renderHook(() => useWizardState(makeInput({}, makeState(2))));

    act(() => { result.current.handleSelectSubject('player'); });
    expect(result.current.step).toBe(0); // not yet advanced

    act(() => { jest.advanceTimersByTime(420); });
    expect(result.current.step).toBe(1);
  });

  it('advances to step 2 skipping context step when team with only 1 team', () => {
    const { result } = renderHook(() => useWizardState(makeInput({}, makeState(1))));

    act(() => { result.current.handleSelectSubject('team'); });
    act(() => { jest.advanceTimersByTime(420); });

    expect(result.current.step).toBe(2);
  });

  it('advances to step 1 when team with >1 teams (has context step)', () => {
    const { result } = renderHook(() => useWizardState(makeInput({}, makeState(2))));

    act(() => { result.current.handleSelectSubject('team'); });
    act(() => { jest.advanceTimersByTime(420); });

    expect(result.current.step).toBe(1);
  });

  it('resets topic when new subject selected', () => {
    const { result } = renderHook(() => useWizardState(makeInput()));

    act(() => { result.current.handleSelectSubject('team'); });
    act(() => { jest.advanceTimersByTime(420); });
    act(() => { result.current.handleSelectTopic('goals'); });
    act(() => { jest.advanceTimersByTime(420); });

    // Select a different subject — topic should reset
    act(() => { result.current.handleSelectSubject('player'); });
    expect(result.current.topic).toBeNull();
  });

  it('does not advance if timer is still pending (before delay)', () => {
    const { result } = renderHook(() => useWizardState(makeInput()));

    act(() => { result.current.handleSelectSubject('player'); });
    act(() => { jest.advanceTimersByTime(100); }); // only partial time

    expect(result.current.step).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleSelectTopic + autoAdvance
// ─────────────────────────────────────────────────────────────────────────────

describe('handleSelectTopic + autoAdvance', () => {
  it('advances from step 2 to step 3 after delay', () => {
    const { result } = renderHook(() => useWizardState(makeInput({}, makeState(1))));

    // Navigate to step 2 (team with 1 team skips context step)
    act(() => { result.current.handleSelectSubject('team'); });
    act(() => { jest.advanceTimersByTime(420); });
    expect(result.current.step).toBe(2);

    act(() => { result.current.handleSelectTopic('goals'); });
    act(() => { jest.advanceTimersByTime(420); });

    expect(result.current.step).toBe(3);
  });

  it('sets topic state when handleSelectTopic called', () => {
    const { result } = renderHook(() => useWizardState(makeInput({}, makeState(1))));

    act(() => { result.current.handleSelectSubject('team'); });
    act(() => { jest.advanceTimersByTime(420); });
    act(() => { result.current.handleSelectTopic('assists'); });

    expect(result.current.topic).toBe('assists');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleSelectTimeRange → goToConfirm → step 4
// ─────────────────────────────────────────────────────────────────────────────

describe('handleSelectTimeRange → goToConfirm', () => {
  function navigateToStep3(result: any) {
    // team with 1 team: skips context → goes to step 2 directly
    act(() => { result.current.handleSelectSubject('team'); });
    act(() => { jest.advanceTimersByTime(420); });
    act(() => { result.current.handleSelectTopic('goals'); });
    act(() => { jest.advanceTimersByTime(420); });
    expect(result.current.step).toBe(3);
  }

  it('advances to step 4 (confirm) after delay when subject+topic set', () => {
    const { result } = renderHook(() => useWizardState(makeInput({}, makeState(1))));
    navigateToStep3(result);

    act(() => { result.current.handleSelectTimeRange('season'); });
    act(() => { jest.advanceTimersByTime(420); });

    expect(result.current.step).toBe(4);
  });

  it('does nothing extra if subject or topic not set', () => {
    const { result } = renderHook(() => useWizardState(makeInput()));

    // Select timeRange without subject/topic being set
    act(() => { result.current.handleSelectTimeRange('season'); });
    act(() => { jest.advanceTimersByTime(420); });

    expect(result.current.step).toBe(0); // stays at 0
  });

  it('goToConfirm calls setCurrentReport with built config', () => {
    const state = makeState(1);
    const { result } = renderHook(() => useWizardState(makeInput({}, state)));
    navigateToStep3(result);

    act(() => { result.current.handleSelectTimeRange('season'); });
    act(() => { jest.advanceTimersByTime(420); });

    expect(state.setCurrentReport).toHaveBeenCalledTimes(1);
    const updater = state.setCurrentReport.mock.calls[0][0];
    // updater is a function prev => ({...prev, name, config})
    const prev = { name: 'Old', description: 'X', config: {} };
    const next = updater(prev);
    expect(next.description).toBe('X'); // spread of prev
    expect(typeof next.name).toBe('string');
    expect(next.config).toBeDefined();
    expect(next.config.diagramType).toBeDefined();
  });

  it('goToConfirm sets reportName', () => {
    const { result } = renderHook(() => useWizardState(makeInput({}, makeState(1))));
    navigateToStep3(result);

    act(() => { result.current.handleSelectTimeRange('all'); });
    act(() => { jest.advanceTimersByTime(420); });

    expect(result.current.reportName).toMatch(/\S/); // non-empty
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleBack
// ─────────────────────────────────────────────────────────────────────────────

describe('handleBack', () => {
  it('calls onBack when at step 0', () => {
    const onBack = jest.fn();
    const { result } = renderHook(() => useWizardState(makeInput({ onBack })));

    act(() => { result.current.handleBack(); });

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(result.current.step).toBe(0);
  });

  it('jumps from step 2 to step 0 when subject has no context step', () => {
    const { result } = renderHook(() => useWizardState(makeInput({}, makeState(1))));

    // team with 1 team → no context step → goes to step 2
    act(() => { result.current.handleSelectSubject('team'); });
    act(() => { jest.advanceTimersByTime(420); });
    expect(result.current.step).toBe(2);

    act(() => { result.current.handleBack(); });
    expect(result.current.step).toBe(0);
  });

  it('decrements step normally from step 3 to step 2', () => {
    const { result } = renderHook(() => useWizardState(makeInput({}, makeState(1))));

    act(() => { result.current.handleSelectSubject('team'); });
    act(() => { jest.advanceTimersByTime(420); });
    act(() => { result.current.handleSelectTopic('goals'); });
    act(() => { jest.advanceTimersByTime(420); });
    expect(result.current.step).toBe(3);

    act(() => { result.current.handleBack(); });
    expect(result.current.step).toBe(2);
  });

  it('goes from step 1 to step 0 via normal decrement', () => {
    const { result } = renderHook(() => useWizardState(makeInput({}, makeState(2))));

    act(() => { result.current.handleSelectSubject('player'); });
    act(() => { jest.advanceTimersByTime(420); });
    expect(result.current.step).toBe(1);

    act(() => { result.current.handleBack(); });
    expect(result.current.step).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleSave
// ─────────────────────────────────────────────────────────────────────────────

describe('handleSave', () => {
  function navigateToConfirm(result: any) {
    act(() => { result.current.handleSelectSubject('team'); });
    act(() => { jest.advanceTimersByTime(420); });
    act(() => { result.current.handleSelectTopic('goals'); });
    act(() => { jest.advanceTimersByTime(420); });
    act(() => { result.current.handleSelectTimeRange('season'); });
    act(() => { jest.advanceTimersByTime(420); });
    expect(result.current.step).toBe(4);
  }

  it('does nothing (no onSave call) when reportName is empty', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useWizardState(makeInput({ onSave }, makeState(1))));
    navigateToConfirm(result);

    // Clear the reportName so save is blocked
    act(() => { result.current.setReportName(''); });
    await act(async () => { await result.current.handleSave(); });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('does nothing when subject is missing', async () => {
    const onSave = jest.fn();
    const { result } = renderHook(() => useWizardState(makeInput({ onSave })));
    // subject is null by default
    act(() => { result.current.setReportName('Test Name'); });
    await act(async () => { await result.current.handleSave(); });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onSave with name/description/config then onClose', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const { result } = renderHook(() =>
      useWizardState(makeInput({ onSave, onClose }, makeState(1))),
    );
    navigateToConfirm(result);
    expect(result.current.reportName).toMatch(/\S/);

    await act(async () => { await result.current.handleSave(); });

    expect(onSave).toHaveBeenCalledTimes(1);
    const arg = onSave.mock.calls[0][0];
    expect(arg.name).toBeTruthy();
    expect(arg.description).toBe('');
    expect(arg.config).toBeDefined();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sets saving=true during save and false after', async () => {
    let resolveOnSave!: () => void;
    const onSave = jest.fn().mockReturnValue(
      new Promise<void>(resolve => { resolveOnSave = resolve; }),
    );
    const { result } = renderHook(() =>
      useWizardState(makeInput({ onSave }, makeState(1))),
    );
    navigateToConfirm(result);

    act(() => { result.current.handleSave(); });
    expect(result.current.saving).toBe(true);

    await act(async () => { resolveOnSave(); });
    expect(result.current.saving).toBe(false);
  });

  it('sets saving=false even when onSave rejects', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('server error'));
    const { result } = renderHook(() =>
      useWizardState(makeInput({ onSave }, makeState(1))),
    );
    navigateToConfirm(result);

    await act(async () => {
      await result.current.handleSave().catch(() => {/* expected rejection */});
    });

    expect(result.current.saving).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// initialConfig pre-fill
// ─────────────────────────────────────────────────────────────────────────────

describe('initialConfig pre-fill', () => {
  it('calls onOpenBuilder when config cannot be reversed (unsupported diagramType)', async () => {
    const onOpenBuilder = jest.fn();
    // scatter chart with no recognizable xField → reverseMapWizardConfig returns null
    const badConfig: Partial<ReportConfig> = {
      diagramType: 'scatter',
      xField: 'eventDate',
      yField: 'goals',
      filters: {},
    };

    renderHook(() =>
      useWizardState(makeInput({ onOpenBuilder }, makeState(2), { initialConfig: badConfig as ReportConfig })),
    );

    await act(async () => {});

    expect(onOpenBuilder).toHaveBeenCalledTimes(1);
  });

  it('restores subject/topic/timeRange from a valid wizard config', async () => {
    const validConfig: Partial<ReportConfig> = {
      diagramType: 'bar',
      xField: 'player',
      yField: 'goals',
      filters: { player: '42' },
    };
    mockFetchById.mockResolvedValue({ id: 42, fullName: 'Test Player' });

    const { result } = renderHook(() =>
      useWizardState(makeInput({}, makeState(2), { initialConfig: validConfig as ReportConfig })),
    );

    await act(async () => {});

    expect(result.current.subject).toBe('player');
    expect(result.current.topic).toBe('goals');
    expect(result.current.step).toBe(4);
  });

  it('restores team+timeRange from a team/goals/season config', async () => {
    const validConfig: Partial<ReportConfig> = {
      diagramType: 'bar',
      xField: 'team',
      yField: 'goals',
      filters: { team: '1', dateFrom: '2024-07-01' },
    };

    const { result } = renderHook(() =>
      useWizardState(makeInput({}, makeState(2), { initialConfig: validConfig as ReportConfig })),
    );

    await act(async () => {});

    expect(result.current.subject).toBe('team');
    expect(result.current.topic).toBe('goals');
    expect(result.current.timeRange).toBe('season');
    expect(result.current.step).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Debounced player search
// ─────────────────────────────────────────────────────────────────────────────

describe('debounced player search', () => {
  it('does not call searchReportPlayers when input < 2 chars', async () => {
    const { result } = renderHook(() => useWizardState(makeInput()));

    act(() => { result.current.setPlayerSearchInput('A'); });
    act(() => { jest.advanceTimersByTime(500); });

    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('calls searchReportPlayers after 300ms with input >= 2 chars', async () => {
    mockSearch.mockResolvedValue([{ id: 1, fullName: 'Anna Beispiel' }]);
    const { result } = renderHook(() => useWizardState(makeInput()));

    act(() => { result.current.setPlayerSearchInput('An'); });
    act(() => { jest.advanceTimersByTime(300); });

    expect(mockSearch).toHaveBeenCalledWith('An');
  });

  it('cancels previous timer on rapid input change', async () => {
    mockSearch.mockResolvedValue([]);
    const { result } = renderHook(() => useWizardState(makeInput()));

    act(() => { result.current.setPlayerSearchInput('AB'); });
    act(() => { jest.advanceTimersByTime(100); }); // midway
    act(() => { result.current.setPlayerSearchInput('ABC'); }); // new input, cancels previous
    act(() => { jest.advanceTimersByTime(300); }); // wait for new timer

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith('ABC');
  });

  it('clears playerSearchOptions when input becomes < 2 chars', () => {
    mockSearch.mockResolvedValue([{ id: 1, fullName: 'Test' }]);
    const { result } = renderHook(() => useWizardState(makeInput()));

    act(() => { result.current.setPlayerSearchInput(''); });

    expect(result.current.playerSearchOptions).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Additional coverage: uncovered branches
// ─────────────────────────────────────────────────────────────────────────────

describe('hasContextStep – unbekanntes Subject (fallthrough)', () => {
  it('returns false for unknown subject value', () => {
    const { result } = renderHook(() => useWizardState(makeInput()));
    // Cast an invalid subject to trigger the `return false` fallthrough
    expect(result.current.hasContextStep('unknown_subject' as any)).toBe(false);
  });
});

describe('initialConfig – Comparison-IDs werden wiederhergestellt', () => {
  it('stellt comparisonTeamIds aus Konfiguration wieder her', async () => {
    const config: Partial<ReportConfig> = {
      diagramType: 'bar',
      xField: 'team',
      yField: 'goals',
      filters: { teams: '1,2' },
    };

    const { result } = renderHook(() =>
      useWizardState(makeInput({}, makeState(3), { initialConfig: config as ReportConfig })),
    );
    await act(async () => {});

    expect(result.current.selectedComparisonTeams).toEqual([1, 2]);
  });

  it('stellt selectedPlayer aus Konfiguration wieder her (fetchPlayerById aufgerufen)', async () => {
    const player = { id: 7, fullName: 'Max Muster' };
    mockFetchById.mockResolvedValue(player);

    const config: Partial<ReportConfig> = {
      diagramType: 'bar',
      xField: 'player',
      yField: 'goals',
      filters: { player: '7' },
    };

    const { result } = renderHook(() =>
      useWizardState(makeInput({}, makeState(2), { initialConfig: config as ReportConfig })),
    );
    await act(async () => {});

    expect(mockFetchById).toHaveBeenCalledWith(7);
    expect(result.current.selectedPlayer).toEqual(player);
  });

  it('stellt comparisonPlayers aus Konfiguration wieder her', async () => {
    const p1 = { id: 10, fullName: 'Spieler A' };
    const p2 = { id: 11, fullName: 'Spieler B' };
    mockFetchById.mockImplementation((id: number) => Promise.resolve(id === 10 ? p1 : p2));

    const config: Partial<ReportConfig> = {
      diagramType: 'bar',
      xField: 'player',
      yField: 'goals',
      filters: { players: '10,11' },
    };

    const { result } = renderHook(() =>
      useWizardState(makeInput({}, makeState(2), { initialConfig: config as ReportConfig })),
    );
    await act(async () => {});

    expect(result.current.selectedComparisonPlayers).toHaveLength(2);
  });
});

describe('goToConfirm – contextLabel aus selectedTeam', () => {
  it('nutzt Team-Namen als contextLabel wenn subject=team und Team ausgewählt', async () => {
    const state = makeState(2);
    const { result } = renderHook(() => useWizardState(makeInput({}, state)));

    // Select team (with 2 teams, has context step → step 1)
    act(() => { result.current.handleSelectSubject('team'); });
    act(() => { jest.advanceTimersByTime(420); });
    // Set a selected team
    act(() => { result.current.setSelectedTeam({ id: 1, name: 'U17' }); });
    // Advance through topic and time range
    act(() => { result.current.handleSelectTopic('goals'); });
    act(() => { jest.advanceTimersByTime(420); });
    act(() => { result.current.handleSelectTimeRange('season'); });
    act(() => { jest.advanceTimersByTime(420); });

    // The reportName should contain the team name as context label
    expect(result.current.reportName).toContain('U17');
  });
});

describe('Player-Suche – .finally() Callback', () => {
  it('setzt playerSearchLoading nach erfolgter Suche auf false', async () => {
    mockSearch.mockResolvedValue([{ id: 1, fullName: 'Test Player' }]);
    const { result } = renderHook(() => useWizardState(makeInput()));

    act(() => { result.current.setPlayerSearchInput('Te'); });
    // Advance timer to trigger search
    act(() => { jest.advanceTimersByTime(300); });
    // Resolve pending promises
    await act(async () => {});

    expect(result.current.playerSearchLoading).toBe(false);
    expect(result.current.playerSearchOptions).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// initialConfig – edit round-trip: zurück navigieren → Änderung → setCurrentReport
// ─────────────────────────────────────────────────────────────────────────────

describe('initialConfig – Edit-Modus: Änderung triggert setCurrentReport für Preview', () => {
  it('ruft setCurrentReport nach Schritt-4-Init auf wenn zurück + timeRange geändert (1 Team)', async () => {
    const state = makeState(1); // 1 Team → kein Context-Step
    const validConfig: ReportConfig = {
      diagramType: 'bar',
      xField: 'team',
      yField: 'goals',
      filters: { team: '1', dateFrom: `${new Date().getFullYear() - (new Date().getMonth() >= 7 ? 0 : 1)}-08-01` },
      metrics: [],
      showLegend: false,
      showLabels: false,
    };
    const { result } = renderHook(() =>
      useWizardState(makeInput({}, state, { initialConfig: validConfig })),
    );

    // Initialisierung abwarten
    await act(async () => {});

    // Nach Initialisierung vom initialConfig muss step=4 gesetzt sein
    expect(result.current.step).toBe(4);
    expect(result.current.subject).toBe('team');
    expect(result.current.topic).toBe('goals');

    // Zurück zu Schritt 3 (Zeitraum-Auswahl)
    act(() => { result.current.handleBack(); });
    expect(result.current.step).toBe(3);

    // Zeitraum wechseln → autoAdvance → goToConfirm → setCurrentReport
    act(() => { result.current.handleSelectTimeRange('last10'); });
    act(() => { jest.advanceTimersByTime(500); });

    // setCurrentReport MUSS aufgerufen worden sein → Preview-Trigger
    expect(state.setCurrentReport).toHaveBeenCalled();
    expect(result.current.step).toBe(4);
  });

  it('ruft setCurrentReport nach Schritt-4-Init auf wenn zurück bis Thema + Thema geändert', async () => {
    const state = makeState(1);
    const validConfig: ReportConfig = {
      diagramType: 'bar',
      xField: 'team',
      yField: 'goals',
      filters: { team: '1' },
      metrics: [],
      showLegend: false,
      showLabels: false,
    };
    const { result } = renderHook(() =>
      useWizardState(makeInput({}, state, { initialConfig: validConfig })),
    );
    await act(async () => {});
    expect(result.current.step).toBe(4);

    // Zurück bis Thema (step 3 → 2)
    act(() => { result.current.handleBack(); });  // step 4 → 3
    act(() => { result.current.handleBack(); });  // step 3 → 2
    expect(result.current.step).toBe(2);

    // Neues Thema auswählen → autoAdvance → step 3
    act(() => { result.current.handleSelectTopic('assists'); });
    act(() => { jest.advanceTimersByTime(500); });
    expect(result.current.step).toBe(3);

    // Zeitraum bestätigen → goToConfirm → setCurrentReport
    act(() => {
      if (result.current.subject && result.current.topic && result.current.timeRange) {
        result.current.goToConfirm(result.current.subject, result.current.topic, result.current.timeRange);
      }
    });

    expect(state.setCurrentReport).toHaveBeenCalled();
    expect(result.current.step).toBe(4);
  });

  it('ruft setCurrentReport auf wenn "Weiter →"-Button auf Schritt-3 genutzt wird (goToConfirm direkt)', async () => {
    const state = makeState(2); // 2 Teams → mit Context-Step
    const validConfig: ReportConfig = {
      diagramType: 'bar',
      xField: 'team',
      yField: 'goals',
      filters: { team: '1' },
      metrics: [],
      showLegend: false,
      showLabels: false,
    };
    const { result } = renderHook(() =>
      useWizardState(makeInput({}, state, { initialConfig: validConfig })),
    );
    await act(async () => {});
    expect(result.current.step).toBe(4);

    // Zurück zu Schritt 3
    act(() => { result.current.handleBack(); });
    expect(result.current.step).toBe(3);

    // "Weiter →"-Button ruft goToConfirm direkt auf (kein autoAdvance)
    act(() => {
      if (result.current.subject && result.current.topic && result.current.timeRange) {
        result.current.goToConfirm(result.current.subject, result.current.topic, result.current.timeRange);
      }
    });

    expect(state.setCurrentReport).toHaveBeenCalled();
    expect(result.current.step).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// makeInput helper overload accepting initialConfig
// ─────────────────────────────────────────────────────────────────────────────

function makeInput(
  overrides?: Record<string, any>,
  stateArg?: ReturnType<typeof makeState>,
  extraOverrides?: Record<string, any>,
): any {
  return {
    state: (stateArg ?? makeState()) as any,
    onSave: jest.fn().mockResolvedValue(undefined),
    onClose: jest.fn(),
    onOpenBuilder: jest.fn(),
    onBack: jest.fn(),
    ...(overrides ?? {}),
    ...(extraOverrides ?? {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fix-Regression: async player-fetch vor step-4 + Filterdaten-Erhalt
//
// Abgedeckt:
//  – isInitializing bleibt true bis der player-fetch aufgelöst ist (Fix 1)
//  – step 4 wird erst gesetzt nachdem selectedPlayer verfügbar ist
//  – zurück + Zeitraum-Änderung: setCurrentReport enthält filters.player (kein Race)
//  – zurück + Zeitraum-Änderung: setCurrentReport enthält filters.players für comparison
// ─────────────────────────────────────────────────────────────────────────────

describe('initialConfig – async player-fetch muss vor step-4 abgeschlossen sein', () => {
  const PLAYER_CONFIG: ReportConfig = {
    diagramType: 'bar',
    xField: 'player',
    yField: 'goals',
    filters: { player: '42' },
    metrics: [],
    showLegend: false,
    showLabels: false,
  };

  it('hält isInitializing=true und step=0 bis playerFetch aufgelöst ist', async () => {
    let resolvePlayer!: (v: { id: number; fullName: string }) => void;
    mockFetchById.mockReturnValue(
      new Promise<{ id: number; fullName: string }>(res => { resolvePlayer = res; }),
    );

    const { result } = renderHook(() =>
      useWizardState(makeInput({}, makeState(1), { initialConfig: PLAYER_CONFIG })),
    );

    // Synchrone Effekte abwarten – Promise noch NICHT aufgelöst
    act(() => {});
    expect(result.current.isInitializing).toBe(true);
    expect(result.current.step).toBe(0);

    // Player-Fetch auflösen → jetzt sollte step=4 gesetzt sein
    await act(async () => { resolvePlayer({ id: 42, fullName: 'Test Player' }); });

    expect(result.current.isInitializing).toBe(false);
    expect(result.current.step).toBe(4);
    expect(result.current.selectedPlayer).toEqual({ id: 42, fullName: 'Test Player' });
  });

  it('step 4 wird gesetzt sobald kein player-Fetch nötig ist (kein player-Filter)', async () => {
    const noPlayerConfig: ReportConfig = {
      diagramType: 'bar',
      xField: 'team',
      yField: 'goals',
      filters: { team: '1' },
      metrics: [],
      showLegend: false,
      showLabels: false,
    };

    const { result } = renderHook(() =>
      useWizardState(makeInput({}, makeState(2), { initialConfig: noPlayerConfig })),
    );

    // Ohne async Player-Fetch muss step=4 synchron gesetzt werden
    act(() => {});
    expect(result.current.step).toBe(4);
    expect(result.current.isInitializing).toBe(false);
    expect(mockFetchById).not.toHaveBeenCalled();
  });

  it('zurück + Zeitraum-Änderung: setCurrentReport enthält filters.player (kein Datenverlust)', async () => {
    mockFetchById.mockResolvedValue({ id: 42, fullName: 'Test Player' });

    const state = makeState(1);
    const { result } = renderHook(() =>
      useWizardState(makeInput({}, state, { initialConfig: PLAYER_CONFIG })),
    );

    // Auf vollständige Initialisierung (inkl. async Fetch) warten
    await act(async () => {});
    expect(result.current.step).toBe(4);
    expect(result.current.selectedPlayer).toEqual({ id: 42, fullName: 'Test Player' });

    // Zurück zu Schritt 3 (Zeitraum-Auswahl)
    act(() => { result.current.handleBack(); });
    expect(result.current.step).toBe(3);

    // Zeitraum neu wählen → autoAdvance → goToConfirm
    act(() => { result.current.handleSelectTimeRange('all'); });
    act(() => { jest.advanceTimersByTime(500); });

    expect(result.current.step).toBe(4);
    expect(state.setCurrentReport).toHaveBeenCalled();

    // letzter setCurrentReport-Aufruf muss filters.player beibehalten
    const lastUpdater =
      state.setCurrentReport.mock.calls[state.setCurrentReport.mock.calls.length - 1][0] as
      (prev: ReturnType<typeof makeState>['currentReport']) => ReturnType<typeof makeState>['currentReport'];
    const next = lastUpdater(state.currentReport);
    expect((next.config.filters as Record<string, string>).player).toBe('42');
  });

  it('zurück + Zeitraum-Änderung: setCurrentReport enthält filters.players für comparison', async () => {
    const p1 = { id: 10, fullName: 'Spieler A' };
    const p2 = { id: 11, fullName: 'Spieler B' };
    mockFetchById.mockImplementation((id: number) =>
      Promise.resolve(id === 10 ? p1 : p2),
    );

    const compConfig: ReportConfig = {
      diagramType: 'bar',
      xField: 'player',
      yField: 'goals',
      filters: { players: '10,11' },
      metrics: [],
      showLegend: false,
      showLabels: false,
    };

    const state = makeState(1);
    const { result } = renderHook(() =>
      useWizardState(makeInput({}, state, { initialConfig: compConfig })),
    );

    await act(async () => {});
    expect(result.current.step).toBe(4);
    expect(result.current.selectedComparisonPlayers).toHaveLength(2);

    // Zurück + Zeitraum neu setzen → goToConfirm
    act(() => { result.current.handleBack(); });
    act(() => { result.current.handleSelectTimeRange('season'); });
    act(() => { jest.advanceTimersByTime(500); });

    expect(result.current.step).toBe(4);
    expect(state.setCurrentReport).toHaveBeenCalled();

    const lastUpdater =
      state.setCurrentReport.mock.calls[state.setCurrentReport.mock.calls.length - 1][0] as
      (prev: ReturnType<typeof makeState>['currentReport']) => ReturnType<typeof makeState>['currentReport'];
    const next = lastUpdater(state.currentReport);
    expect((next.config.filters as Record<string, string>).players).toBe('10,11');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fix-Regression: handleSave muss state.currentReport.config (inkl. hideEmpty /
// horizontalBar / diagramType-Override) benutzen, NICHT buildConfig() neu aufrufen.
//
// Abgedeckt:
//  – handleSave übergibt state.currentReport.config unverändert an onSave
//  – hideEmpty=true im currentReport.config landet in onSave-Argument
//  – horizontalBar=true im currentReport.config landet in onSave-Argument
//  – diagramType-Override im currentReport.config bleibt erhalten
//  – handleSave überschreibt nur name (auf reportName); alle anderen Felder von
//    state.currentReport bleiben erhalten (description, id, isTemplate …)
// ─────────────────────────────────────────────────────────────────────────────

describe('handleSave – verwendet state.currentReport statt buildConfig()', () => {
  /** Bringt den Hook auf Step 4 (Confirm) mit 1 Team (kein Context-Step). */
  function navigateToConfirm(result: any) {
    act(() => { result.current.handleSelectSubject('team'); });
    act(() => { jest.advanceTimersByTime(420); });
    act(() => { result.current.handleSelectTopic('goals'); });
    act(() => { jest.advanceTimersByTime(420); });
    act(() => { result.current.handleSelectTimeRange('season'); });
    act(() => { jest.advanceTimersByTime(420); });
    expect(result.current.step).toBe(4);
  }

  it('gibt state.currentReport.config unverändert an onSave weiter', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const state = makeState(1);
    // Simuliere, dass der Nutzer auf Step 4 hideEmpty aktiviert hat:
    state.currentReport.config = {
      ...state.currentReport.config,
      hideEmpty: true,
      horizontalBar: true,
      diagramType: 'bar',
    } as any;

    const { result } = renderHook(() =>
      useWizardState(makeInput({ onSave }, state)),
    );
    navigateToConfirm(result);

    // Direkt nach goToConfirm wird currentReport durch setCurrentReport überschrieben.
    // Wir simulieren, dass der Nutzer anschliessend hideEmpty/horizontalBar in
    // state.currentReport gesetzt hat (wie GuidedWizard's confirm-step es tut).
    state.currentReport.config = {
      ...state.currentReport.config,
      hideEmpty: true,
      horizontalBar: true,
    } as any;

    await act(async () => { await result.current.handleSave(); });

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect((saved.config as any).hideEmpty).toBe(true);
    expect((saved.config as any).horizontalBar).toBe(true);
  });

  it('hideEmpty=true in currentReport.config landet in gespeichertem Report', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const state = makeState(1);

    const { result } = renderHook(() =>
      useWizardState(makeInput({ onSave }, state)),
    );
    navigateToConfirm(result);

    // goToConfirm schreibt fresh config → anschliessend Nutzer-Override
    state.currentReport.config = {
      ...state.currentReport.config,
      hideEmpty: true,
    } as any;

    await act(async () => { await result.current.handleSave(); });

    const saved = onSave.mock.calls[0][0];
    expect((saved.config as any).hideEmpty).toBe(true);
  });

  it('hideEmpty=false (explizit) in currentReport.config landet in gespeichertem Report', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const state = makeState(1);

    const { result } = renderHook(() =>
      useWizardState(makeInput({ onSave }, state)),
    );
    navigateToConfirm(result);

    state.currentReport.config = {
      ...state.currentReport.config,
      hideEmpty: false,
    } as any;

    await act(async () => { await result.current.handleSave(); });

    const saved = onSave.mock.calls[0][0];
    expect((saved.config as any).hideEmpty).toBe(false);
  });

  it('horizontalBar=true in currentReport.config landet in gespeichertem Report', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const state = makeState(1);

    const { result } = renderHook(() =>
      useWizardState(makeInput({ onSave }, state)),
    );
    navigateToConfirm(result);

    state.currentReport.config = {
      ...state.currentReport.config,
      horizontalBar: true,
    } as any;

    await act(async () => { await result.current.handleSave(); });

    const saved = onSave.mock.calls[0][0];
    expect((saved.config as any).horizontalBar).toBe(true);
  });

  it('diagramType-Override in currentReport.config wird nicht von buildConfig() überschrieben', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const state = makeState(1);

    const { result } = renderHook(() =>
      useWizardState(makeInput({ onSave }, state)),
    );
    navigateToConfirm(result);

    // Nutzer wechselt auf Schritt 4 von doughnut zu line
    state.currentReport.config = {
      ...state.currentReport.config,
      diagramType: 'line',
    } as any;

    await act(async () => { await result.current.handleSave(); });

    const saved = onSave.mock.calls[0][0];
    expect(saved.config.diagramType).toBe('line');
  });

  it('handleSave benutzt reportName aus Hook, nicht aus currentReport.name', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const state = makeState(1);
    state.currentReport.name = 'Alter Name';

    const { result } = renderHook(() =>
      useWizardState(makeInput({ onSave }, state)),
    );
    navigateToConfirm(result);

    act(() => { result.current.setReportName('Neuer Name'); });
    await act(async () => { await result.current.handleSave(); });

    const saved = onSave.mock.calls[0][0];
    expect(saved.name).toBe('Neuer Name');
  });

  it('buildConfig() wird bei handleSave NICHT mehr separat aufgerufen (kein frischer config-Build)', async () => {
    // Verifikation: wenn hideEmpty=true in currentReport.config steht, muss es im
    // gespeicherten Objekt ankommen – buildConfig() würde es nie setzen und der Wert
    // wäre undefined/fehlen.
    const onSave = jest.fn().mockResolvedValue(undefined);
    const state = makeState(1);

    const { result } = renderHook(() =>
      useWizardState(makeInput({ onSave }, state)),
    );
    navigateToConfirm(result);

    state.currentReport.config = {
      ...state.currentReport.config,
      hideEmpty: true,
      horizontalBar: true,
    } as any;

    await act(async () => { await result.current.handleSave(); });

    const saved = onSave.mock.calls[0][0];
    // Wenn buildConfig() aufgerufen würde, wären beide Felder undefined
    expect((saved.config as any).hideEmpty).not.toBeUndefined();
    expect((saved.config as any).horizontalBar).not.toBeUndefined();
  });
});

