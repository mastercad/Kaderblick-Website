import { renderHook, waitFor } from '@testing-library/react';
import { useTeamList } from '../useTeamList';

// ─── API mock ─────────────────────────────────────────────────────────────────

const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: unknown[]) => mockApiJson(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEAMS = [
  { id: 1, name: 'A-Team', assigned: true },
  { id: 2, name: 'B-Team', assigned: false },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockApiJson.mockResolvedValue({ teams: TEAMS });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useTeamList', () => {
  it('starts in loading state', () => {
    const { result } = renderHook(() => useTeamList());
    expect(result.current.loading).toBe(true);
  });

  it('starts with empty teams array', () => {
    const { result } = renderHook(() => useTeamList());
    expect(result.current.teams).toEqual([]);
  });

  it('starts with null error', () => {
    const { result } = renderHook(() => useTeamList());
    expect(result.current.error).toBeNull();
  });

  it('sets teams from successful response', async () => {
    const { result } = renderHook(() => useTeamList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.teams).toEqual(TEAMS);
  });

  it('sets loading to false after success', async () => {
    const { result } = renderHook(() => useTeamList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loading).toBe(false);
  });

  it('leaves error null on success', async () => {
    const { result } = renderHook(() => useTeamList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
  });

  it('fetches from /api/teams/list when no context given', async () => {
    renderHook(() => useTeamList());
    await waitFor(() => expect(mockApiJson).toHaveBeenCalled());
    expect(mockApiJson).toHaveBeenCalledWith('/api/teams/list');
  });

  it('includes context as query param when provided', async () => {
    renderHook(() => useTeamList('match'));
    await waitFor(() => expect(mockApiJson).toHaveBeenCalled());
    expect(mockApiJson).toHaveBeenCalledWith('/api/teams/list?context=match');
  });

  it('encodes context value in the URL', async () => {
    renderHook(() => useTeamList('my context'));
    await waitFor(() => expect(mockApiJson).toHaveBeenCalled());
    expect(mockApiJson).toHaveBeenCalledWith('/api/teams/list?context=my%20context');
  });

  it('sets error message on fetch failure', async () => {
    mockApiJson.mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useTeamList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Teams konnten nicht geladen werden.');
  });

  it('sets teams to empty array on fetch failure', async () => {
    mockApiJson.mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useTeamList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.teams).toEqual([]);
  });

  it('sets loading to false on fetch failure', async () => {
    mockApiJson.mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useTeamList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loading).toBe(false);
  });

  it('sets teams to empty array when response.teams is not an array', async () => {
    mockApiJson.mockResolvedValue({ teams: null });
    const { result } = renderHook(() => useTeamList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.teams).toEqual([]);
  });

  it('sets teams to empty array when response.teams is a string', async () => {
    mockApiJson.mockResolvedValue({ teams: 'invalid' });
    const { result } = renderHook(() => useTeamList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.teams).toEqual([]);
  });

  it('does not update state after component is unmounted', async () => {
    let resolveApiCall!: (value: { teams: typeof TEAMS }) => void;
    mockApiJson.mockReturnValue(
      new Promise<{ teams: typeof TEAMS }>(resolve => { resolveApiCall = resolve; }),
    );

    const { result, unmount } = renderHook(() => useTeamList());
    unmount();
    resolveApiCall({ teams: TEAMS });

    // Wait a tick so the promise resolution can propagate
    await new Promise(r => setTimeout(r, 0));

    // State should not have been updated (still initial values after unmount)
    expect(result.current.teams).toEqual([]);
  });

  it('refetches when context changes', async () => {
    mockApiJson.mockResolvedValue({ teams: TEAMS });
    const { rerender } = renderHook(({ ctx }: { ctx?: string }) => useTeamList(ctx), {
      initialProps: { ctx: undefined as string | undefined },
    });
    await waitFor(() => expect(mockApiJson).toHaveBeenCalledTimes(1));

    rerender({ ctx: 'match' });
    await waitFor(() => expect(mockApiJson).toHaveBeenCalledTimes(2));
    expect(mockApiJson).toHaveBeenLastCalledWith('/api/teams/list?context=match');
  });
});
