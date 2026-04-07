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
