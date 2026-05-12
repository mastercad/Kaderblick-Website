/**
 * Tests for useHasTemplates.
 *
 * The module has a module-level cache (`cache` / `inflight`) that persists across tests.
 * To ensure isolation we use different `PosterType` values per test group,
 * and use `jest.resetModules()` + `jest.isolateModules()` where fresh-state is needed.
 */

import { renderHook, act, waitFor } from '@testing-library/react';

// ── Mock service ───────────────────────────────────────────────────────────────

const mockFetchPosterTemplates = jest.fn();

jest.mock('../../../../services/posterTemplateService', () => ({
  fetchPosterTemplates: (...args: any[]) => mockFetchPosterTemplates(...args),
}));

// Import after mock registration
import { useHasTemplates } from '../useHasTemplates';
import type { PosterType } from '../../types/posterTemplate';

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useHasTemplates', () => {
  beforeEach(() => {
    mockFetchPosterTemplates.mockReset();
  });

  it('starts with loading=true and hasTemplates=false on first call', async () => {
    // Use a unique type not used by any other test to avoid cache hits
    const type: PosterType = 'player_highlight';
    mockFetchPosterTemplates.mockResolvedValue([{ id: 1 }]);

    const { result } = renderHook(() => useHasTemplates(type));
    // Initial state before promise resolves
    expect(result.current.loading).toBe(true);
    expect(result.current.hasTemplates).toBe(false);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasTemplates).toBe(true);
  });

  it('returns hasTemplates=false when API returns empty array', async () => {
    const type: PosterType = 'universal';
    mockFetchPosterTemplates.mockResolvedValue([]);

    const { result } = renderHook(() => useHasTemplates(type));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasTemplates).toBe(false);
  });

  it('returns hasTemplates=false and loading=false when API throws', async () => {
    const type: PosterType = 'event_announcement';
    mockFetchPosterTemplates.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useHasTemplates(type));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasTemplates).toBe(false);
  });

  it('returns cached result immediately on second mount (same posterType)', async () => {
    const type: PosterType = 'game_announcement';
    mockFetchPosterTemplates.mockResolvedValue([{ id: 1 }]);

    // First mount — populates cache
    const { result: r1, unmount } = renderHook(() => useHasTemplates(type));
    await waitFor(() => expect(r1.current.loading).toBe(false));
    unmount();

    // Second mount — cache should already have the value
    const { result: r2 } = renderHook(() => useHasTemplates(type));
    // loading should be false immediately (cache hit)
    expect(r2.current.loading).toBe(false);
    expect(r2.current.hasTemplates).toBe(true);

    // fetchPosterTemplates should only have been called ONCE (not twice)
    expect(mockFetchPosterTemplates).toHaveBeenCalledTimes(1);
  });

  it('shares a single inflight request when mounted concurrently', async () => {
    const type: PosterType = 'game_result';
    let resolve!: (val: any) => void;
    const promise = new Promise((res) => { resolve = res; });
    mockFetchPosterTemplates.mockReturnValue(promise);

    const { result: r1 } = renderHook(() => useHasTemplates(type));
    const { result: r2 } = renderHook(() => useHasTemplates(type));

    act(() => { resolve([{ id: 99 }]); });

    await waitFor(() => expect(r1.current.loading).toBe(false));
    await waitFor(() => expect(r2.current.loading).toBe(false));

    // Despite two hook instances, only ONE API call should have been made
    expect(mockFetchPosterTemplates).toHaveBeenCalledTimes(1);
    expect(r1.current.hasTemplates).toBe(true);
    expect(r2.current.hasTemplates).toBe(true);
  });
});
