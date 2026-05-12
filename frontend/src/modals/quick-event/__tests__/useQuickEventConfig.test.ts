import { renderHook, act, waitFor } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockFetchQuickEventConfig = jest.fn();
const mockSaveQuickEventConfig = jest.fn();

jest.mock('../api', () => ({
  fetchQuickEventConfig: (...args: any[]) => mockFetchQuickEventConfig(...args),
  saveQuickEventConfig: (...args: any[]) => mockSaveQuickEventConfig(...args),
}));

const DEFAULT_CONFIG = { buttons: [{ eventTypeCode: 'goal', label: 'Tor' }] };

jest.mock('../defaultConfig', () => ({
  DEFAULT_QUICK_EVENT_CONFIG: { buttons: [{ eventTypeCode: 'goal', label: 'Tor' }] },
}));

// ── Import after mocks ─────────────────────────────────────────────────────────

import { useQuickEventConfig } from '../useQuickEventConfig';

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useQuickEventConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: API returns null (no saved config)
    mockFetchQuickEventConfig.mockResolvedValue(null);
    mockSaveQuickEventConfig.mockResolvedValue(undefined);
  });

  it('starts with DEFAULT_QUICK_EVENT_CONFIG', () => {
    mockFetchQuickEventConfig.mockReturnValue(new Promise(() => {})); // Never resolves
    const { result } = renderHook(() => useQuickEventConfig());
    expect(result.current.config).toEqual(DEFAULT_CONFIG);
  });

  it('loading is true initially', () => {
    mockFetchQuickEventConfig.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useQuickEventConfig());
    expect(result.current.loading).toBe(true);
  });

  it('loading becomes false after API call resolves', async () => {
    const { result } = renderHook(() => useQuickEventConfig());
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('sets remote config when API returns a non-null config', async () => {
    const remote = { buttons: [{ eventTypeCode: 'corner', label: 'Ecke' }] };
    mockFetchQuickEventConfig.mockResolvedValue(remote);

    const { result } = renderHook(() => useQuickEventConfig());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.config).toEqual(remote);
  });

  it('keeps DEFAULT config when API returns null', async () => {
    mockFetchQuickEventConfig.mockResolvedValue(null);

    const { result } = renderHook(() => useQuickEventConfig());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.config).toEqual(DEFAULT_CONFIG);
  });

  it('keeps DEFAULT config when API throws an error', async () => {
    mockFetchQuickEventConfig.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useQuickEventConfig());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.config).toEqual(DEFAULT_CONFIG);
  });

  it('loading becomes false even when API throws', async () => {
    mockFetchQuickEventConfig.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useQuickEventConfig());
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  describe('save()', () => {
    it('updates config state immediately', async () => {
      const { result } = renderHook(() => useQuickEventConfig());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const next = { buttons: [{ eventTypeCode: 'foul', label: 'Foul' }] };
      await act(async () => {
        await result.current.save(next);
      });

      expect(result.current.config).toEqual(next);
    });

    it('calls saveQuickEventConfig with the new config', async () => {
      const { result } = renderHook(() => useQuickEventConfig());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const next = { buttons: [{ eventTypeCode: 'assist', label: 'Assist' }] };
      await act(async () => {
        await result.current.save(next);
      });

      expect(mockSaveQuickEventConfig).toHaveBeenCalledWith(next);
    });

    it('calls saveQuickEventConfig exactly once per save call', async () => {
      const { result } = renderHook(() => useQuickEventConfig());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.save(DEFAULT_CONFIG);
      });

      expect(mockSaveQuickEventConfig).toHaveBeenCalledTimes(1);
    });
  });
});
