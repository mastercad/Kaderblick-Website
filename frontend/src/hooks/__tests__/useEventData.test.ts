import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useTournamentMatches,
  useLeagues,
  useCups,
  useCupRounds,
  useReloadTournamentMatches,
} from '../useEventData';

// ── API mocks ──────────────────────────────────────────────────────────────────
const mockApiRequest = jest.fn();
jest.mock('../../utils/api', () => ({
  apiRequest: (...args: any[]) => mockApiRequest(...args),
}));

const mockFetchLeagues = jest.fn();
jest.mock('../../services/leagues', () => ({
  fetchLeagues: (...args: any[]) => mockFetchLeagues(...args),
}));

const mockFetchCups = jest.fn();
jest.mock('../../services/cups', () => ({
  fetchCups: (...args: any[]) => mockFetchCups(...args),
}));

const mockFetchCupRounds = jest.fn();
jest.mock('../../services/cupRounds', () => ({
  fetchCupRounds: (...args: any[]) => mockFetchCupRounds(...args),
}));

beforeEach(() => jest.clearAllMocks());

// ── useTournamentMatches ──────────────────────────────────────────────────────

describe('useTournamentMatches', () => {
  it('returns empty tournamentMatches initially', () => {
    const { result } = renderHook(() => useTournamentMatches('1', false));
    expect(result.current.tournamentMatches).toEqual([]);
  });

  it('does not fetch when open=false', () => {
    renderHook(() => useTournamentMatches('1', false));
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('does not fetch when tournamentId is undefined', () => {
    renderHook(() => useTournamentMatches(undefined, true));
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('clears matches when open becomes false', async () => {
    const mockRes = { ok: true, json: jest.fn().mockResolvedValue([{ id: 1 }]) };
    mockApiRequest.mockResolvedValue(mockRes);

    const { result, rerender } = renderHook(
      ({ id, open }: { id: string | undefined; open: boolean }) =>
        useTournamentMatches(id, open),
      { initialProps: { id: '5', open: true } },
    );

    await waitFor(() => expect(result.current.tournamentMatches).toHaveLength(1));

    rerender({ id: '5', open: false });
    await waitFor(() => expect(result.current.tournamentMatches).toEqual([]));
  });

  it('fetches matches when tournamentId and open are both set', async () => {
    const matches = [{ id: 1, home: 'A', away: 'B' }];
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(matches),
    });

    const { result } = renderHook(() => useTournamentMatches('42', true));

    await waitFor(() => expect(result.current.tournamentMatches).toEqual(matches));
    expect(mockApiRequest).toHaveBeenCalledWith('/api/tournaments/42/matches');
  });

  it('returns empty array when API response is not ok', async () => {
    mockApiRequest.mockResolvedValue({ ok: false });

    const { result } = renderHook(() => useTournamentMatches('7', true));

    await waitFor(() => expect(result.current.tournamentMatches).toEqual([]));
  });

  it('returns empty array when fetch throws', async () => {
    mockApiRequest.mockRejectedValue(new Error('Network failure'));

    const { result } = renderHook(() => useTournamentMatches('3', true));

    await waitFor(() => expect(result.current.tournamentMatches).toEqual([]));
  });

  it('returns empty array when json() returns null', async () => {
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(null),
    });

    const { result } = renderHook(() => useTournamentMatches('9', true));

    await waitFor(() => expect(result.current.tournamentMatches).toEqual([]));
  });

  it('setTournamentMatches can update matches externally', async () => {
    const { result } = renderHook(() => useTournamentMatches(undefined, false));

    act(() => {
      result.current.setTournamentMatches([{ id: 10 }]);
    });

    expect(result.current.tournamentMatches).toEqual([{ id: 10 }]);
  });
});

// ── useLeagues ────────────────────────────────────────────────────────────────

describe('useLeagues', () => {
  it('returns empty array initially', () => {
    const { result } = renderHook(() => useLeagues(false));
    expect(result.current).toEqual([]);
  });

  it('does not fetch leagues when open=false', () => {
    renderHook(() => useLeagues(false));
    expect(mockFetchLeagues).not.toHaveBeenCalled();
  });

  it('fetches leagues when open=true and maps to SelectOption[]', async () => {
    mockFetchLeagues.mockResolvedValue([
      { id: 1, name: 'Kreisliga A' },
      { id: 2, name: 'Bezirksliga' },
    ]);

    const { result } = renderHook(() => useLeagues(true));

    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(result.current[0]).toEqual({ value: '1', label: 'Kreisliga A' });
    expect(result.current[1]).toEqual({ value: '2', label: 'Bezirksliga' });
  });

  it('respects open becoming true after initial false', async () => {
    mockFetchLeagues.mockResolvedValue([{ id: 5, name: 'Verbandsliga' }]);

    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) => useLeagues(open),
      { initialProps: { open: false } },
    );

    expect(mockFetchLeagues).not.toHaveBeenCalled();

    rerender({ open: true });

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0]).toEqual({ value: '5', label: 'Verbandsliga' });
  });
});

// ── useCups ───────────────────────────────────────────────────────────────────

describe('useCups', () => {
  it('returns empty array initially', () => {
    const { result } = renderHook(() => useCups(false));
    expect(result.current).toEqual([]);
  });

  it('does not fetch cups when open=false', () => {
    renderHook(() => useCups(false));
    expect(mockFetchCups).not.toHaveBeenCalled();
  });

  it('fetches cups when open=true and maps to SelectOption[]', async () => {
    mockFetchCups.mockResolvedValue([
      { id: 10, name: 'DFB-Pokal' },
      { id: 11, name: 'Landespokal' },
    ]);

    const { result } = renderHook(() => useCups(true));

    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(result.current[0]).toEqual({ value: '10', label: 'DFB-Pokal' });
    expect(result.current[1]).toEqual({ value: '11', label: 'Landespokal' });
  });
});

// ── useCupRounds ──────────────────────────────────────────────────────────────

describe('useCupRounds', () => {
  it('returns empty array initially', () => {
    const { result } = renderHook(() => useCupRounds(false));
    expect(result.current).toEqual([]);
  });

  it('does not fetch cup rounds when open=false', () => {
    renderHook(() => useCupRounds(false));
    expect(mockFetchCupRounds).not.toHaveBeenCalled();
  });

  it('fetches cup round names when open=true', async () => {
    mockFetchCupRounds.mockResolvedValue([
      { id: 1, name: 'Viertelfinale' },
      { id: 2, name: 'Halbfinale' },
      { id: 3, name: 'Finale' },
    ]);

    const { result } = renderHook(() => useCupRounds(true));

    await waitFor(() => expect(result.current).toHaveLength(3));
    expect(result.current).toEqual(['Viertelfinale', 'Halbfinale', 'Finale']);
  });

  it('returns only names (not full objects)', async () => {
    mockFetchCupRounds.mockResolvedValue([{ id: 99, name: 'Gruppenphase' }]);

    const { result } = renderHook(() => useCupRounds(true));

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0]).toBe('Gruppenphase');
  });
});

// ── useReloadTournamentMatches ────────────────────────────────────────────────

describe('useReloadTournamentMatches', () => {
  it('returns a reload function', () => {
    const { result } = renderHook(() => useReloadTournamentMatches());
    expect(typeof result.current).toBe('function');
  });

  it('does nothing when tournamentId is undefined', async () => {
    const { result } = renderHook(() => useReloadTournamentMatches());
    const setMatches = jest.fn();

    await act(async () => {
      await result.current(undefined, setMatches);
    });

    expect(mockApiRequest).not.toHaveBeenCalled();
    expect(setMatches).not.toHaveBeenCalled();
  });

  it('fetches and updates matches when tournamentId is provided', async () => {
    const matches = [{ id: 1 }, { id: 2 }];
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(matches),
    });

    const { result } = renderHook(() => useReloadTournamentMatches());
    const setMatches = jest.fn();

    await act(async () => {
      await result.current('88', setMatches);
    });

    expect(mockApiRequest).toHaveBeenCalledWith('/api/tournaments/88/matches');
    expect(setMatches).toHaveBeenCalledWith(matches);
  });

  it('does not call setMatches when res.ok is false', async () => {
    mockApiRequest.mockResolvedValue({ ok: false });

    const { result } = renderHook(() => useReloadTournamentMatches());
    const setMatches = jest.fn();

    await act(async () => {
      await result.current('55', setMatches);
    });

    expect(setMatches).not.toHaveBeenCalled();
  });

  it('silently ignores errors during reload', async () => {
    mockApiRequest.mockRejectedValue(new Error('timeout'));

    const { result } = renderHook(() => useReloadTournamentMatches());
    const setMatches = jest.fn();

    await act(async () => {
      await result.current('12', setMatches);
    });

    expect(setMatches).not.toHaveBeenCalled();
  });

  it('sets empty array when json() returns null', async () => {
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(null),
    });

    const { result } = renderHook(() => useReloadTournamentMatches());
    const setMatches = jest.fn();

    await act(async () => {
      await result.current('3', setMatches);
    });

    expect(setMatches).toHaveBeenCalledWith([]);
  });
});
