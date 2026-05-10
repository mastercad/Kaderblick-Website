import { renderHook, waitFor } from '@testing-library/react';
import { usePosterEvents } from '../usePosterEvents';
import * as api from '../../../../utils/api';
import type { CalendarEvent } from '../../../../types/calendar';

jest.mock('../../../../utils/api');
const mockApiJson = api.apiJson as jest.Mock;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockEvent: CalendarEvent = {
  id: 1,
  title: 'Jahreshauptversammlung',
  start: '2025-11-01T18:00:00Z',
  end:   '2025-11-01T20:00:00Z',
  eventType: { id: 3, name: 'Event' },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('usePosterEvents', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns loading=true initially', () => {
    mockApiJson.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePosterEvents());
    expect(result.current.loading).toBe(true);
    expect(result.current.events).toEqual([]);
  });

  it('populates events on success', async () => {
    mockApiJson.mockResolvedValue([mockEvent]);
    const { result } = renderHook(() => usePosterEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].id).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it('handles empty array gracefully', async () => {
    mockApiJson.mockResolvedValue([]);
    const { result } = renderHook(() => usePosterEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toEqual([]);
  });

  it('handles null response gracefully', async () => {
    mockApiJson.mockResolvedValue(null);
    const { result } = renderHook(() => usePosterEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toEqual([]);
  });

  it('sets error on API failure', async () => {
    mockApiJson.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => usePosterEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.events).toEqual([]);
  });

  it('passes a date-range query string to the API', async () => {
    mockApiJson.mockResolvedValue([]);
    renderHook(() => usePosterEvents());
    await waitFor(() => expect(mockApiJson).toHaveBeenCalledTimes(1));
    const url: string = mockApiJson.mock.calls[0][0];
    expect(url).toMatch('/api/calendar/events?start=');
    expect(url).toMatch('end=');
  });
});
