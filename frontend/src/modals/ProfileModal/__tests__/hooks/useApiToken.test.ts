import { renderHook, act } from '@testing-library/react';
import { useApiToken } from '../../hooks/useApiToken';
import { apiJson } from '../../../../utils/api';

jest.mock('../../../../utils/api', () => ({ apiJson: jest.fn() }));
const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;

// Mock clipboard
const writeText = jest.fn().mockResolvedValue(undefined);
Object.assign(navigator, { clipboard: { writeText } });

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('useApiToken', () => {
  describe('initial state', () => {
    it('starts with null status, not loading, no token, no message', () => {
      const { result } = renderHook(() => useApiToken());
      expect(result.current.status).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.newToken).toBeNull();
      expect(result.current.message).toBeNull();
      expect(result.current.copied).toBe(false);
    });
  });

  describe('load()', () => {
    it('sets status from API', async () => {
      mockApiJson.mockResolvedValue({ hasToken: true, createdAt: '2024-01-01' });
      const { result } = renderHook(() => useApiToken());

      await act(async () => { await result.current.load(); });

      expect(result.current.status).toEqual({ hasToken: true, createdAt: '2024-01-01' });
    });

    it('sets status to null on API error', async () => {
      mockApiJson.mockRejectedValue(new Error('unauthorized'));
      const { result } = renderHook(() => useApiToken());

      await act(async () => { await result.current.load(); });

      expect(result.current.status).toBeNull();
    });
  });

  describe('generate()', () => {
    it('stores the new token and sets success message', async () => {
      mockApiJson.mockResolvedValue({ token: 'abc123', createdAt: '2024-06-01' });
      const { result } = renderHook(() => useApiToken());

      await act(async () => { await result.current.generate(); });

      expect(result.current.newToken).toBe('abc123');
      expect(result.current.status).toEqual({ hasToken: true, createdAt: '2024-06-01' });
      expect(result.current.message?.type).toBe('success');
      expect(result.current.loading).toBe(false);
    });

    it('sets error message on failure', async () => {
      mockApiJson.mockRejectedValue(new Error('server error'));
      const { result } = renderHook(() => useApiToken());

      await act(async () => { await result.current.generate(); });

      expect(result.current.newToken).toBeNull();
      expect(result.current.message?.type).toBe('error');
    });
  });

  describe('revoke()', () => {
    it('clears status and sets success message', async () => {
      // first set a token
      mockApiJson
        .mockResolvedValueOnce({ token: 'abc123', createdAt: '2024-06-01' }) // generate
        .mockResolvedValue(undefined); // revoke (DELETE returns nothing)
      const { result } = renderHook(() => useApiToken());
      await act(async () => { await result.current.generate(); });

      await act(async () => { await result.current.revoke(); });

      expect(result.current.status).toEqual({ hasToken: false, createdAt: null });
      expect(result.current.message?.type).toBe('success');
    });

    it('sets error message on failure', async () => {
      mockApiJson.mockRejectedValue(new Error('server error'));
      const { result } = renderHook(() => useApiToken());

      await act(async () => { await result.current.revoke(); });

      expect(result.current.message?.type).toBe('error');
    });
  });

  describe('copyToken()', () => {
    it('copies token to clipboard and sets copied=true temporarily', async () => {
      mockApiJson.mockResolvedValue({ token: 'mytoken', createdAt: null });
      const { result } = renderHook(() => useApiToken());
      await act(async () => { await result.current.generate(); });

      await act(async () => { await result.current.copyToken(); });

      expect(writeText).toHaveBeenCalledWith('mytoken');
      expect(result.current.copied).toBe(true);

      act(() => { jest.advanceTimersByTime(2000); });
      expect(result.current.copied).toBe(false);
    });

    it('does nothing when newToken is null', async () => {
      const { result } = renderHook(() => useApiToken());
      await act(async () => { await result.current.copyToken(); });
      expect(writeText).not.toHaveBeenCalled();
    });
  });

  describe('setMessage()', () => {
    it('allows the caller to clear the message', async () => {
      mockApiJson.mockRejectedValue(new Error('fail'));
      const { result } = renderHook(() => useApiToken());
      await act(async () => { await result.current.generate(); });

      expect(result.current.message).not.toBeNull();
      act(() => { result.current.setMessage(null); });
      expect(result.current.message).toBeNull();
    });
  });
});
