import { renderHook, act } from '@testing-library/react';
import { useNotifPrefs } from '../../hooks/useNotifPrefs';
import { apiJson } from '../../../../utils/api';

jest.mock('../../../../utils/api', () => ({ apiJson: jest.fn() }));
const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('useNotifPrefs', () => {
  describe('initial state', () => {
    it('starts with empty prefs, no message, not saving', () => {
      const { result } = renderHook(() => useNotifPrefs());
      expect(result.current.prefs).toEqual({});
      expect(result.current.saving).toBe(false);
      expect(result.current.message).toBeNull();
    });

    it('groups contains at least Kommunikation and Mannschaft', () => {
      const { result } = renderHook(() => useNotifPrefs());
      expect(Object.keys(result.current.groups)).toContain('Kommunikation');
      expect(Object.keys(result.current.groups)).toContain('Mannschaft');
    });
  });

  describe('load()', () => {
    it('populates prefs from API response', async () => {
      mockApiJson.mockResolvedValue({ preferences: { message: false } });
      const { result } = renderHook(() => useNotifPrefs());

      await act(async () => { await result.current.load(); });

      expect(result.current.prefs).toEqual({ message: false });
    });

    it('silently ignores API errors (prefs remain empty)', async () => {
      mockApiJson.mockRejectedValue(new Error('network'));
      const { result } = renderHook(() => useNotifPrefs());

      await act(async () => { await result.current.load(); });

      expect(result.current.prefs).toEqual({});
    });
  });

  describe('isEnabled()', () => {
    it('returns the stored value when the key is present', async () => {
      mockApiJson.mockResolvedValue({ preferences: { message: false } });
      const { result } = renderHook(() => useNotifPrefs());
      await act(async () => { await result.current.load(); });

      expect(result.current.isEnabled('message')).toBe(false);
    });

    it('falls back to NOTIFICATION_CATEGORIES defaultEnabled (survey=true)', () => {
      const { result } = renderHook(() => useNotifPrefs());
      // 'survey' defaultEnabled = true
      expect(result.current.isEnabled('survey')).toBe(true);
    });

    it('returns true for unknown keys by default', () => {
      const { result } = renderHook(() => useNotifPrefs());
      expect(result.current.isEnabled('completely_unknown_key')).toBe(true);
    });
  });

  describe('toggle()', () => {
    it('saves preferences via API on success', async () => {
      mockApiJson
        .mockResolvedValueOnce({ preferences: {} }) // load
        .mockResolvedValue({}); // toggle PUT
      const { result } = renderHook(() => useNotifPrefs());
      await act(async () => { await result.current.load(); });

      await act(async () => { await result.current.toggle('news', false); });

      expect(mockApiJson).toHaveBeenCalledWith('/api/push/preferences', expect.objectContaining({ method: 'PUT' }));
      expect(result.current.prefs.news).toBe(false);
      expect(result.current.message?.type).toBe('success');
    });

    it('sets error message when API fails', async () => {
      mockApiJson
        .mockResolvedValueOnce({ preferences: {} })
        .mockRejectedValue(new Error('fail'));
      const { result } = renderHook(() => useNotifPrefs());
      await act(async () => { await result.current.load(); });

      await act(async () => { await result.current.toggle('news', false); });

      expect(result.current.message?.type).toBe('error');
    });

    it('clears the success message after 2500 ms', async () => {
      mockApiJson.mockResolvedValue({});
      const { result } = renderHook(() => useNotifPrefs());

      await act(async () => { await result.current.toggle('news', false); });
      expect(result.current.message?.type).toBe('success');

      act(() => { jest.advanceTimersByTime(2500); });
      expect(result.current.message).toBeNull();
    });
  });
});
