import { renderHook, act } from '@testing-library/react';
import { useEventWizard } from '../useEventWizard';

// Mock useEventTypeFlags so we can control flags without depending on SelectOption data
jest.mock('../useEventTypeFlags', () => ({
  useEventTypeFlags: (_eventType: string, _gameType: string) => ({
    isMatchEvent:         _eventType === 'spiel',
    isTournament:         _eventType === 'turnier',
    isTournamentEventType:_eventType === 'turnier',
    isTask:               _eventType === 'aufgabe',
    isTraining:           _eventType === 'training',
    // '__none__' is a sentinel that makes all flags false (covers else branch at line 96)
    isGenericEvent:       !['spiel', 'turnier', 'aufgabe', 'training', '__none__'].includes(_eventType),
  }),
}));

const baseEvent = {
  title: 'Test Event',
  eventType: 'training',
  date: '2026-03-12',
};

const makeParams = (overrides: Record<string, any> = {}) => ({
  open: true,
  event: { ...baseEvent, ...overrides },
  eventTypes: [{ value: 'training', label: 'Training' }],
  gameTypes:  [],
  onChange: jest.fn(),
  onSave:   jest.fn(),
  onClose:  jest.fn(),
});

describe('useEventWizard', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Step list ─────────────────────────────────────────────────────────────

  it('starts on step 0', () => {
    const { result } = renderHook(() => useEventWizard(makeParams()));
    expect(result.current.currentStep).toBe(0);
  });

  it('training event has 3 steps: Basisdaten, Training, Beschreibung', () => {
    const { result } = renderHook(() =>
      useEventWizard(makeParams({ eventType: 'training' })),
    );
    expect(result.current.steps.map(s => s.key)).toEqual(['base', 'details', 'description']);
    expect(result.current.steps[1].label).toBe('Training');
  });

  it('aufgabe event has 3 steps: Basisdaten, Aufgabe, Beschreibung', () => {
    const { result } = renderHook(() =>
      useEventWizard(makeParams({ eventType: 'aufgabe' })),
    );
    expect(result.current.steps.map(s => s.key)).toEqual(['base', 'details', 'description']);
    expect(result.current.steps[1].label).toBe('Aufgabe');
  });

  it('spiel event has 4 steps: Basisdaten, Spieldetails, Spielzeiten, Beschreibung', () => {
    const { result } = renderHook(() =>
      useEventWizard(makeParams({ eventType: 'spiel' })),
    );
    expect(result.current.steps.map(s => s.key)).toEqual(['base', 'details', 'timing', 'description']);
    expect(result.current.steps[1].label).toBe('Spieldetails');
    expect(result.current.steps[2].label).toBe('Spielzeiten');
  });

  it('turnier event has 4 steps incl. Begegnungen but not Spielzeiten', () => {
    const { result } = renderHook(() =>
      useEventWizard(makeParams({ eventType: 'turnier' })),
    );
    expect(result.current.steps.map(s => s.key)).toEqual(['base', 'details', 'matches', 'description']);
  });

  // ── Navigation ────────────────────────────────────────────────────────────

  it('handleNext advances to next step when valid', () => {
    const { result } = renderHook(() => useEventWizard(makeParams()));
    act(() => { result.current.handleNext(); });
    expect(result.current.currentStep).toBe(1);
  });

  it('handleBack does not go below 0', () => {
    const { result } = renderHook(() => useEventWizard(makeParams()));
    act(() => { result.current.handleBack(); });
    expect(result.current.currentStep).toBe(0);
  });

  it('handleBack decrements step', () => {
    const { result } = renderHook(() => useEventWizard(makeParams()));
    act(() => { result.current.handleNext(); });
    act(() => { result.current.handleBack(); });
    expect(result.current.currentStep).toBe(0);
  });

  it('isLastStep is true on final step', () => {
    const { result } = renderHook(() => useEventWizard(makeParams()));
    // Navigate to last step (index 2 for training)
    act(() => { result.current.handleNext(); }); // 0 → 1
    act(() => { result.current.handleNext(); }); // 1 → 2
    expect(result.current.isLastStep).toBe(true);
  });

  // ── Validation – base step ─────────────────────────────────────────────────

  it('handleNext sets stepError when title is missing on step 0', () => {
    const params = makeParams({ title: '', eventType: 'training', date: '2026-03-12' });
    const { result } = renderHook(() => useEventWizard(params));
    act(() => { result.current.handleNext(); });
    expect(result.current.stepError).toBeTruthy();
    expect(result.current.currentStep).toBe(0);
  });

  it('handleNext sets stepError when date is missing on step 0', () => {
    const params = makeParams({ title: 'T', eventType: 'training', date: '' });
    const { result } = renderHook(() => useEventWizard(params));
    act(() => { result.current.handleNext(); });
    expect(result.current.stepError).toBeTruthy();
  });

  it('handleBack clears stepError', () => {
    const params = makeParams({ title: '' });
    const { result } = renderHook(() => useEventWizard(params));
    act(() => { result.current.handleNext(); }); // triggers error
    act(() => { result.current.handleBack(); });  // should clear
    expect(result.current.stepError).toBeNull();
  });

  // ── Validation – task details step ───────────────────────────────────────

  it('handleNext sets error when task has no rotation users', () => {
    const params = makeParams({ eventType: 'aufgabe', taskRotationUsers: [], taskRotationCount: 1 });
    const { result } = renderHook(() => useEventWizard(params));
    // advance to details step (step 1)
    act(() => { result.current.handleNext(); }); // base → details
    act(() => { result.current.handleNext(); }); // attempt details → description
    expect(result.current.stepError).toBeTruthy();
    expect(result.current.currentStep).toBe(1);
  });

  // ── Reset on open ─────────────────────────────────────────────────────────

  it('resets currentStep to 0 when open changes to true', () => {
    const params = makeParams();
    const { result, rerender } = renderHook(
      ({ p }: { p: ReturnType<typeof makeParams> }) => useEventWizard(p),
      { initialProps: { p: { ...params, open: false } } },
    );
    // manually advance
    act(() => { result.current.handleNext(); });
    // re-open
    rerender({ p: { ...params, open: true } });
    expect(result.current.currentStep).toBe(0);
  });

  // ── handleSave ────────────────────────────────────────────────────────────

  it('handleSave calls onSave with event data when validation passes', () => {
    const onSave = jest.fn();
    const params = { ...makeParams(), onSave };
    const { result } = renderHook(() => useEventWizard(params));
    // Navigate to last step
    act(() => { result.current.handleNext(); });
    act(() => { result.current.handleNext(); });
    act(() => { result.current.handleSave(); });
    expect(onSave).toHaveBeenCalledWith(params.event);
  });

  // ── handleClose ───────────────────────────────────────────────────────────

  it('handleClose calls onClose', () => {
    const onClose = jest.fn();
    const { result } = renderHook(() => useEventWizard({ ...makeParams(), onClose }));
    act(() => { result.current.handleClose(); });
    expect(onClose).toHaveBeenCalled();
  });

  // ── Auto-fill gameType for tournament ─────────────────────────────────────

  it('auto-fills gameType when tournament has no gameType and matching entry exists', () => {
    const onChange = jest.fn();
    renderHook(() => useEventWizard({
      ...makeParams({ eventType: 'turnier', gameType: '' }),
      onChange,
      gameTypes: [{ value: 'gt-turnier', label: 'Turnier Hauptrunde' }],
    }));
    expect(onChange).toHaveBeenCalledWith('gameType', 'gt-turnier');
  });

  it('does not auto-fill gameType when gameType is already set', () => {
    const onChange = jest.fn();
    renderHook(() => useEventWizard({
      ...makeParams({ eventType: 'turnier', gameType: 'existing-gt' }),
      onChange,
      gameTypes: [{ value: 'gt-turnier', label: 'Turnier Hauptrunde' }],
    }));
    expect(onChange).not.toHaveBeenCalledWith('gameType', expect.anything());
  });

  it('does not auto-fill gameType when no matching gameType label found', () => {
    const onChange = jest.fn();
    renderHook(() => useEventWizard({
      ...makeParams({ eventType: 'turnier', gameType: '' }),
      onChange,
      gameTypes: [{ value: 'gt-liga', label: 'Liga' }],
    }));
    expect(onChange).not.toHaveBeenCalledWith('gameType', expect.anything());
  });

  // ── genericEvent step (STEP_PERMISSIONS) ─────────────────────────────────

  it('generic event type includes STEP_PERMISSIONS step', () => {
    const { result } = renderHook(() =>
      useEventWizard(makeParams({ eventType: 'sonstiges' })),
    );
    expect(result.current.steps.map(s => s.key)).toContain('permissions');
    expect(result.current.steps.find(s => s.key === 'permissions')?.label).toBe('Berechtigungen');
  });

  it('generic event does NOT include STEP_DETAILS', () => {
    const { result } = renderHook(() =>
      useEventWizard(makeParams({ eventType: 'sonstiges' })),
    );
    expect(result.current.steps.map(s => s.key)).not.toContain('details');
  });

  // ── Training series scope step ─────────────────────────────────────────────

  it('training event with trainingSeriesId includes STEP_TRAINING_SCOPE', () => {
    const { result } = renderHook(() =>
      useEventWizard(makeParams({ eventType: 'training', trainingSeriesId: 'series-1' })),
    );
    expect(result.current.steps.map(s => s.key)).toContain('training_scope');
    expect(result.current.steps.find(s => s.key === 'training_scope')?.label).toBe('Gültigkeit');
  });

  it('training event without trainingSeriesId does NOT include STEP_TRAINING_SCOPE', () => {
    const { result } = renderHook(() =>
      useEventWizard(makeParams({ eventType: 'training' })),
    );
    expect(result.current.steps.map(s => s.key)).not.toContain('training_scope');
  });

  // ── Step clamp when step list shrinks ─────────────────────────────────────

  it('clamps currentStep when event type changes to one with fewer steps', () => {
    const spParams = makeParams({
      eventType: 'spiel',
      homeTeam: 'team1',
      awayTeam: 'team2',
      locationId: 'loc1',
    });
    const { result, rerender } = renderHook(
      ({ p }: { p: ReturnType<typeof makeParams> }) => useEventWizard(p),
      { initialProps: { p: spParams } },
    );

    // Navigate to last step of spiel: [base(0), details(1), timing(2), description(3)]
    act(() => result.current.handleNext()); // 0 → 1
    act(() => result.current.handleNext()); // 1 → 2 (details validation passes)
    act(() => result.current.handleNext()); // 2 → 3 (timing has no validation)
    expect(result.current.currentStep).toBe(3);

    // Switch to training: [base(0), details(1), description(2)] → 3 steps
    act(() => { rerender({ p: makeParams({ eventType: 'training' }) }); });

    // currentStep must be clamped to steps.length - 1 = 2
    expect(result.current.currentStep).toBe(2);
  });

  // ── STEP_DETAILS match validation ─────────────────────────────────────────

  it('sets error on STEP_DETAILS when homeTeam is missing (spiel event)', () => {
    const params = makeParams({
      eventType: 'spiel',
      homeTeam: '',
      awayTeam: 'team2',
      locationId: 'loc1',
    });
    const { result } = renderHook(() => useEventWizard(params));

    act(() => result.current.handleNext()); // base → 1 (title not required for spiel)
    act(() => result.current.handleNext()); // details → blocked

    expect(result.current.stepError).toBeTruthy();
    expect(result.current.currentStep).toBe(1);
  });

  it('sets error on STEP_DETAILS when awayTeam is missing (spiel event)', () => {
    const params = makeParams({
      eventType: 'spiel',
      homeTeam: 'team1',
      awayTeam: '',
      locationId: 'loc1',
    });
    const { result } = renderHook(() => useEventWizard(params));

    act(() => result.current.handleNext()); // base → 1
    act(() => result.current.handleNext()); // details → blocked

    expect(result.current.stepError).toBeTruthy();
    expect(result.current.currentStep).toBe(1);
  });

  it('sets error on STEP_DETAILS when locationId is missing (spiel event)', () => {
    const params = makeParams({
      eventType: 'spiel',
      homeTeam: 'team1',
      awayTeam: 'team2',
      locationId: '',
    });
    const { result } = renderHook(() => useEventWizard(params));

    act(() => result.current.handleNext()); // base → 1
    act(() => result.current.handleNext()); // details → blocked

    expect(result.current.stepError).toBeTruthy();
    expect(result.current.currentStep).toBe(1);
  });

  // ── STEP_PERMISSIONS validation ────────────────────────────────────────────

  it('sets error on STEP_PERMISSIONS when permissionType is missing', () => {
    const params = makeParams({
      eventType: 'sonstiges',
      permissionType: '',
    });
    const { result } = renderHook(() => useEventWizard(params));

    // Steps for generic: [base(0), permissions(1), description(2)]
    act(() => result.current.handleNext()); // base → 1 (passes: title, eventType, date valid)
    act(() => result.current.handleNext()); // permissions → blocked

    expect(result.current.stepError).toBeTruthy();
    expect(result.current.currentStep).toBe(1);
  });

  it('advances from STEP_PERMISSIONS when permissionType is set', () => {
    const params = makeParams({
      eventType: 'sonstiges',
      permissionType: 'public',
    });
    const { result } = renderHook(() => useEventWizard(params));

    act(() => result.current.handleNext()); // base → 1
    act(() => result.current.handleNext()); // permissions → 2 (passes)

    expect(result.current.stepError).toBeNull();
    expect(result.current.currentStep).toBe(2);
  });

  it('covers else branch (line 96): unknown event type with all flags false has Details step', () => {
    // '__none__' makes all flags false (isGenericEvent excluded in mock)
    const { result } = renderHook(() =>
      useEventWizard(makeParams({ eventType: '__none__' })),
    );
    expect(result.current.steps.map(s => s.key)).toEqual(['base', 'details', 'description']);
    expect(result.current.steps[1].label).toBe('Details');
  });

  it('covers line 137 false branch: valid task advances from STEP_DETAILS without error', () => {
    // A task with valid rotation passes task validation (firstTaskError is falsy)
    const params = makeParams({
      eventType: 'aufgabe',
      taskRotationUsers: ['user1'],
      taskRotationCount: 1,
      taskIsRecurring: false,
    });
    const { result } = renderHook(() => useEventWizard(params));
    act(() => { result.current.handleNext(); }); // base → details
    act(() => { result.current.handleNext(); }); // details → description (no error)
    expect(result.current.stepError).toBeNull();
    expect(result.current.currentStep).toBe(2);
  });

  it('covers line 166 false branch: handleSave returns early when validation fails', () => {
    // No title → validateCurrentStep returns false on STEP_BASE
    const onSave = jest.fn();
    const params = { ...makeParams({ title: '', eventType: 'training', date: '' }), onSave };
    const { result } = renderHook(() => useEventWizard(params));
    act(() => { result.current.handleSave(); });
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.stepError).toBeTruthy();
  });
});
