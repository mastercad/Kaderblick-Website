import { act, renderHook } from '@testing-library/react';
import { useFormationEditor } from '../useFormationEditor';

const mockShowToast = jest.fn();
const mockUseFormationData = jest.fn();
const mockUseFieldDrag = jest.fn();
const mockUseSquadDrop = jest.fn();
const mockUsePlayerActions = jest.fn();
const mockUseFormationSave = jest.fn();

jest.mock('../../../context/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock('../useFormationData', () => ({
  useFormationData: (...args: any[]) => mockUseFormationData(...args),
}));

jest.mock('../useFieldDrag', () => ({
  useFieldDrag: (...args: any[]) => mockUseFieldDrag(...args),
}));

jest.mock('../useSquadDrop', () => ({
  useSquadDrop: (...args: any[]) => mockUseSquadDrop(...args),
}));

jest.mock('../usePlayerActions', () => ({
  usePlayerActions: (...args: any[]) => mockUsePlayerActions(...args),
}));

jest.mock('../useFormationSave', () => ({
  useFormationSave: (...args: any[]) => mockUseFormationSave(...args),
}));

const baseDataState = {
  formation: null,
  currentTemplateCode: '4-4-2',
  players: [],
  benchPlayers: [],
  availablePlayers: [],
  teams: [{ id: 1, name: 'Team A' }],
  name: 'Formation',
  notes: '',
  selectedTeam: 1,
  loading: false,
  error: null,
  searchQuery: '',
  showTemplatePicker: false,
  nextPlayerNumber: 12,
  setName: jest.fn(),
  setNotes: jest.fn(),
  setSelectedTeam: jest.fn(),
  setSearchQuery: jest.fn(),
  setShowTemplatePicker: jest.fn(),
  setCurrentTemplateCode: jest.fn(),
  setPlayers: jest.fn(),
  setBenchPlayers: jest.fn(),
  setNextPlayerNumber: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();

  mockUseFormationData.mockReturnValue(baseDataState);
  mockUseFieldDrag.mockReturnValue({
    draggedPlayerId: null,
    startDragFromField: jest.fn(),
    startDragFromBench: jest.fn(),
    handlePitchMouseMove: jest.fn(),
    handlePitchMouseUp: jest.fn(),
    handlePitchTouchMove: jest.fn(),
    handlePitchTouchEnd: jest.fn(),
  });
  mockUseSquadDrop.mockReturnValue({
    squadDragPlayer: null,
    highlightedTokenId: null,
    handleSquadDragStart: jest.fn(),
    handleSquadDragEnd: jest.fn(),
    handlePitchDragOver: jest.fn(),
    handlePitchDrop: jest.fn(),
  });
  mockUsePlayerActions.mockReturnValue({
    hasPlaceholders: false,
    placeholderCount: 0,
    applyTemplate: jest.fn(),
    fillWithTeamPlayers: jest.fn(),
    addPlayerToFormation: jest.fn(),
    addGenericPlayer: jest.fn(),
    removePlayer: jest.fn(),
    removeBenchPlayer: jest.fn(),
    sendToBench: jest.fn(),
    sendToField: jest.fn(),
  });
  mockUseFormationSave.mockReturnValue({
    handleSave: jest.fn(),
  });
});

describe('useFormationEditor', () => {
  it('loads the auto-snap preference from sessionStorage', () => {
    window.sessionStorage.setItem('formation-editor:auto-snap', '1');

    const { result } = renderHook(() => useFormationEditor(true, null, jest.fn()));

    expect(result.current.autoSnapEnabled).toBe(true);
  });

  it('persists auto-snap changes into sessionStorage', () => {
    const { result } = renderHook(() => useFormationEditor(true, null, jest.fn()));

    act(() => {
      result.current.setAutoSnapEnabled(true);
    });

    expect(window.sessionStorage.getItem('formation-editor:auto-snap')).toBe('1');
  });

  it('tracks dirty state once the editor is ready and data changes', () => {
    const state = { ...baseDataState };
    mockUseFormationData.mockImplementation(() => state);

    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) => useFormationEditor(open, null, jest.fn()),
      { initialProps: { open: true } },
    );

    expect(result.current.isDirty).toBe(false);

    state.name = 'Neue Formation';
    rerender({ open: true });

    expect(result.current.isDirty).toBe(true);
  });

  it('resets isDirty and undoRedo when open changes to false', () => {
    const state = { ...baseDataState, name: 'Formation' };
    mockUseFormationData.mockImplementation(() => state);

    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) => useFormationEditor(open, null, jest.fn()),
      { initialProps: { open: true } },
    );

    // Make dirty
    state.name = 'Andere Formation';
    rerender({ open: true });
    expect(result.current.isDirty).toBe(true);

    // Close modal
    rerender({ open: false });
    expect(result.current.isDirty).toBe(false);
  });

  it('adds beforeunload listener when open && isDirty', () => {
    const addSpy = jest.spyOn(window, 'addEventListener');
    const removeSpy = jest.spyOn(window, 'removeEventListener');

    const state = { ...baseDataState };
    mockUseFormationData.mockImplementation(() => state);

    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) => useFormationEditor(open, null, jest.fn()),
      { initialProps: { open: true } },
    );

    // Make dirty
    state.name = 'Changed Name';
    rerender({ open: true });
    expect(result.current.isDirty).toBe(true);

    const beforeUnloadCalls = addSpy.mock.calls.filter(c => (c[0] as string) === 'beforeunload');
    expect(beforeUnloadCalls.length).toBeGreaterThan(0);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('readyForDirtyTracking when new formation (no formationId) and teams exist', () => {
    const state = { ...baseDataState, loading: false, teams: [{ id: 1, name: 'Team A' }], selectedTeam: '' as any };
    mockUseFormationData.mockImplementation(() => state);

    const { result } = renderHook(() => useFormationEditor(true, null, jest.fn()));
    // Should be ready → isDirty is false (initial state captured)
    expect(result.current.isDirty).toBe(false);
  });

  it('readyForDirtyTracking when formationId is set and formation is loaded', () => {
    const formation = { id: 5, name: 'Test', players: [], benchPlayers: [] } as any;
    const state = { ...baseDataState, loading: false, formation };
    mockUseFormationData.mockImplementation(() => state);

    const { result } = renderHook(() => useFormationEditor(true, 5, jest.fn()));
    expect(result.current.isDirty).toBe(false);
  });

  it('canUndo and canRedo are initially false', () => {
    const { result } = renderHook(() => useFormationEditor(true, null, jest.fn()));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});