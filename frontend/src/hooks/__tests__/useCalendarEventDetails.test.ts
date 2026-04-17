import { renderHook, act } from '@testing-library/react';
import {
  toEventDetailsCalendarEvent,
  fetchCalendarEventDetails,
  useCalendarEventDetailsLoader,
} from '../useCalendarEventDetails';

// ─── Mock apiJson ──────────────────────────────────────────────────────────

jest.mock('../../utils/api', () => ({
  apiJson: jest.fn(),
}));

import { apiJson } from '../../utils/api';
const mockApiJson = apiJson as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── toEventDetailsCalendarEvent — null / undefined guard ────────────────────

describe('toEventDetailsCalendarEvent — null/undefined guard', () => {
  it('returns null when called with null', () => {
    expect(toEventDetailsCalendarEvent(null)).toBeNull();
  });

  it('returns null when called with undefined', () => {
    expect(toEventDetailsCalendarEvent(undefined)).toBeNull();
  });
});

// ─── toEventDetailsCalendarEvent — id resolution ─────────────────────────────

describe('toEventDetailsCalendarEvent — id resolution', () => {
  it('uses event.id when present', () => {
    const result = toEventDetailsCalendarEvent({ id: 42 });
    expect(result!.id).toBe(42);
  });

  it('uses fallbackId when event.id is absent', () => {
    const result = toEventDetailsCalendarEvent({}, 99);
    expect(result!.id).toBe(99);
  });

  it('uses 0 when neither event.id nor fallbackId is given', () => {
    const result = toEventDetailsCalendarEvent({});
    expect(result!.id).toBe(0);
  });
});

// ─── toEventDetailsCalendarEvent — title ─────────────────────────────────────

describe('toEventDetailsCalendarEvent — title', () => {
  it('uses event.title when present', () => {
    const result = toEventDetailsCalendarEvent({ title: 'Cup-Spiel' });
    expect(result!.title).toBe('Cup-Spiel');
  });

  it('defaults to "Termin" when title is missing', () => {
    const result = toEventDetailsCalendarEvent({});
    expect(result!.title).toBe('Termin');
  });

  it('defaults to "Termin" when title is an empty string', () => {
    const result = toEventDetailsCalendarEvent({ title: '' });
    expect(result!.title).toBe('Termin');
  });
});

// ─── toEventDetailsCalendarEvent — start / end fallbacks ─────────────────────

describe('toEventDetailsCalendarEvent — start/end', () => {
  it('uses event.start when present', () => {
    const result = toEventDetailsCalendarEvent({ start: '2026-05-01T10:00:00' });
    expect(result!.start).toBe('2026-05-01T10:00:00');
  });

  it('falls back to startDate when start is missing', () => {
    const result = toEventDetailsCalendarEvent({ startDate: '2026-05-02T10:00:00' });
    expect(result!.start).toBe('2026-05-02T10:00:00');
  });

  it('uses empty string when neither start nor startDate', () => {
    const result = toEventDetailsCalendarEvent({});
    expect(result!.start).toBe('');
  });

  it('uses event.end when present', () => {
    const result = toEventDetailsCalendarEvent({
      start: '2026-05-01T10:00:00',
      end: '2026-05-01T11:30:00',
    });
    expect(result!.end).toBe('2026-05-01T11:30:00');
  });

  it('falls back to endDate when end is missing', () => {
    const result = toEventDetailsCalendarEvent({
      start: '2026-05-01T10:00:00',
      endDate: '2026-05-01T12:00:00',
    });
    expect(result!.end).toBe('2026-05-01T12:00:00');
  });

  it('falls back to start when end and endDate are missing', () => {
    const result = toEventDetailsCalendarEvent({ start: '2026-05-01T10:00:00' });
    expect(result!.end).toBe('2026-05-01T10:00:00');
  });

  it('falls back to startDate when end, endDate, and start are all missing', () => {
    const result = toEventDetailsCalendarEvent({ startDate: '2026-05-01T10:00:00' });
    expect(result!.end).toBe('2026-05-01T10:00:00');
  });

  it('uses empty string when no temporal field is present', () => {
    const result = toEventDetailsCalendarEvent({});
    expect(result!.end).toBe('');
  });
});

// ─── toEventDetailsCalendarEvent — description ───────────────────────────────

describe('toEventDetailsCalendarEvent — description', () => {
  it('uses event.description when present', () => {
    const result = toEventDetailsCalendarEvent({ description: 'Pflichtspiel' });
    expect(result!.description).toBe('Pflichtspiel');
  });

  it('defaults to empty string when description is missing', () => {
    const result = toEventDetailsCalendarEvent({});
    expect(result!.description).toBe('');
  });
});

// ─── toEventDetailsCalendarEvent — type / eventType ─────────────────────────

describe('toEventDetailsCalendarEvent — type/eventType', () => {
  const typeObj = { id: 1, name: 'Training', color: '#0f0' };
  const eventTypeObj = { id: 2, name: 'Spiel', color: '#f00' };

  it('uses event.type when present', () => {
    const result = toEventDetailsCalendarEvent({ type: typeObj });
    expect(result!.type).toEqual(typeObj);
  });

  it('falls back to event.eventType when type is missing', () => {
    const result = toEventDetailsCalendarEvent({ eventType: eventTypeObj });
    expect(result!.type).toEqual(eventTypeObj);
  });

  it('sets type to undefined when both are missing', () => {
    const result = toEventDetailsCalendarEvent({});
    expect(result!.type).toBeUndefined();
  });
});

// ─── toEventDetailsCalendarEvent — optional objects ──────────────────────────

describe('toEventDetailsCalendarEvent — optional objects', () => {
  it('maps location when present', () => {
    const location = { name: 'Stadion' };
    const result = toEventDetailsCalendarEvent({ location });
    expect(result!.location).toEqual(location);
  });

  it('sets location to undefined when missing', () => {
    const result = toEventDetailsCalendarEvent({});
    expect(result!.location).toBeUndefined();
  });

  it('maps game when present', () => {
    const game = { homeTeam: { name: 'FC' } };
    const result = toEventDetailsCalendarEvent({ game } as any);
    expect(result!.game).toEqual(game);
  });

  it('sets game to undefined when missing', () => {
    const result = toEventDetailsCalendarEvent({});
    expect(result!.game).toBeUndefined();
  });

  it('maps task when present', () => {
    const task = { id: 3, title: 'Setup' };
    const result = toEventDetailsCalendarEvent({ task } as any);
    expect(result!.task).toEqual(task);
  });

  it('sets task to undefined when missing', () => {
    const result = toEventDetailsCalendarEvent({});
    expect(result!.task).toBeUndefined();
  });

  it('maps weatherData when present', () => {
    const weatherData = { weatherCode: 61 };
    const result = toEventDetailsCalendarEvent({ weatherData } as any);
    expect(result!.weatherData).toEqual(weatherData);
  });

  it('sets weatherData to undefined when missing', () => {
    const result = toEventDetailsCalendarEvent({});
    expect(result!.weatherData).toBeUndefined();
  });

  it('maps permissions when present', () => {
    const permissions = { canEdit: true };
    const result = toEventDetailsCalendarEvent({ permissions } as any);
    expect(result!.permissions).toEqual(permissions);
  });

  it('sets permissions to undefined when missing', () => {
    const result = toEventDetailsCalendarEvent({});
    expect(result!.permissions).toBeUndefined();
  });
});

// ─── toEventDetailsCalendarEvent — cancellation ──────────────────────────────

describe('toEventDetailsCalendarEvent — cancellation', () => {
  it('maps cancelled: true', () => {
    const result = toEventDetailsCalendarEvent({ cancelled: true });
    expect(result!.cancelled).toBe(true);
  });

  it('defaults cancelled to false when missing', () => {
    const result = toEventDetailsCalendarEvent({});
    expect(result!.cancelled).toBe(false);
  });

  it('maps cancelReason when present', () => {
    const result = toEventDetailsCalendarEvent({ cancelReason: 'Regen' });
    expect(result!.cancelReason).toBe('Regen');
  });

  it('sets cancelReason to undefined when missing', () => {
    const result = toEventDetailsCalendarEvent({});
    expect(result!.cancelReason).toBeUndefined();
  });

  it('maps cancelledBy when present', () => {
    const result = toEventDetailsCalendarEvent({ cancelledBy: 'Max' });
    expect(result!.cancelledBy).toBe('Max');
  });

  it('sets cancelledBy to undefined when missing', () => {
    const result = toEventDetailsCalendarEvent({});
    expect(result!.cancelledBy).toBeUndefined();
  });
});

// ─── toEventDetailsCalendarEvent — meeting fields ────────────────────────────

describe('toEventDetailsCalendarEvent — meeting fields', () => {
  it('maps meetingPoint when present', () => {
    const result = toEventDetailsCalendarEvent({ meetingPoint: 'Parkplatz Nord' });
    expect(result!.meetingPoint).toBe('Parkplatz Nord');
  });

  it('sets meetingPoint to undefined when null', () => {
    const result = toEventDetailsCalendarEvent({ meetingPoint: null });
    expect(result!.meetingPoint).toBeUndefined();
  });

  it('sets meetingPoint to undefined when missing', () => {
    const result = toEventDetailsCalendarEvent({});
    expect(result!.meetingPoint).toBeUndefined();
  });

  it('maps meetingTime when present', () => {
    const result = toEventDetailsCalendarEvent({ meetingTime: '14:30' });
    expect(result!.meetingTime).toBe('14:30');
  });

  it('sets meetingTime to undefined when null', () => {
    const result = toEventDetailsCalendarEvent({ meetingTime: null });
    expect(result!.meetingTime).toBeUndefined();
  });

  it('sets meetingTime to undefined when missing', () => {
    const result = toEventDetailsCalendarEvent({});
    expect(result!.meetingTime).toBeUndefined();
  });

  it('maps meetingLocation when present', () => {
    const meetingLocation = { id: 5, name: 'Sportzentrum', latitude: 48.1, longitude: 11.6 };
    const result = toEventDetailsCalendarEvent({ meetingLocation } as any);
    expect(result!.meetingLocation).toEqual(meetingLocation);
  });

  it('sets meetingLocation to undefined when missing', () => {
    const result = toEventDetailsCalendarEvent({});
    expect(result!.meetingLocation).toBeUndefined();
  });

  it('sets meetingLocation to undefined when null', () => {
    const result = toEventDetailsCalendarEvent({ meetingLocation: null } as any);
    expect(result!.meetingLocation).toBeUndefined();
  });
});

// ─── fetchCalendarEventDetails ───────────────────────────────────────────────

describe('fetchCalendarEventDetails', () => {
  it('calls apiJson with the correct URL', async () => {
    mockApiJson.mockResolvedValue({ id: 7, title: 'Test', start: '', end: '' });

    await fetchCalendarEventDetails(7);

    expect(mockApiJson).toHaveBeenCalledWith('/api/calendar/event/7');
  });

  it('maps the API response via toEventDetailsCalendarEvent', async () => {
    mockApiJson.mockResolvedValue({
      id: 7,
      title: 'Abendtraining',
      start: '2026-05-01T18:00:00',
      end: '2026-05-01T19:30:00',
    });

    const result = await fetchCalendarEventDetails(7);

    expect(result.id).toBe(7);
    expect(result.title).toBe('Abendtraining');
  });

  it('uses eventId as fallbackId when API response has no id', async () => {
    mockApiJson.mockResolvedValue({ title: 'Ohne ID', start: '', end: '' });

    const result = await fetchCalendarEventDetails(42);

    expect(result.id).toBe(42);
  });

  it('propagates errors from apiJson', async () => {
    mockApiJson.mockRejectedValue(new Error('Network error'));

    await expect(fetchCalendarEventDetails(1)).rejects.toThrow('Network error');
  });
});

// ─── useCalendarEventDetailsLoader ───────────────────────────────────────────

describe('useCalendarEventDetailsLoader', () => {
  it('starts with selectedEvent null and loadingEventId null', () => {
    const { result } = renderHook(() => useCalendarEventDetailsLoader());

    expect(result.current.selectedEvent).toBeNull();
    expect(result.current.loadingEventId).toBeNull();
  });

  it('sets loadingEventId during fetch and clears it on success', async () => {
    mockApiJson.mockResolvedValue({ id: 5, title: 'Training', start: '', end: '' });

    const { result } = renderHook(() => useCalendarEventDetailsLoader());

    await act(async () => {
      result.current.openEventDetails(5);
    });

    expect(result.current.loadingEventId).toBeNull();
    expect(result.current.selectedEvent).not.toBeNull();
    expect(result.current.selectedEvent!.id).toBe(5);
  });

  it('sets selectedEvent on successful load', async () => {
    mockApiJson.mockResolvedValue({
      id: 10,
      title: 'Pokalspiel',
      start: '2026-06-01T15:00:00',
      end: '2026-06-01T17:00:00',
    });

    const { result } = renderHook(() => useCalendarEventDetailsLoader());

    await act(async () => {
      await result.current.openEventDetails(10);
    });

    expect(result.current.selectedEvent!.title).toBe('Pokalspiel');
  });

  it('calls onError callback and clears loadingEventId on failure', async () => {
    mockApiJson.mockRejectedValue(new Error('Server error'));
    const onError = jest.fn();

    const { result } = renderHook(() => useCalendarEventDetailsLoader(onError));

    await act(async () => {
      await result.current.openEventDetails(3);
    });

    expect(onError).toHaveBeenCalledWith('Server error');
    expect(result.current.loadingEventId).toBeNull();
    expect(result.current.selectedEvent).toBeNull();
  });

  it('calls onError with fallback message when error has no message', async () => {
    mockApiJson.mockRejectedValue({});
    const onError = jest.fn();

    const { result } = renderHook(() => useCalendarEventDetailsLoader(onError));

    await act(async () => {
      await result.current.openEventDetails(3);
    });

    expect(onError).toHaveBeenCalledWith('Die Event-Details konnten nicht geladen werden.');
  });

  it('does not throw when onError is not provided and fetch fails', async () => {
    mockApiJson.mockRejectedValue(new Error('Oops'));

    const { result } = renderHook(() => useCalendarEventDetailsLoader());

    await expect(
      act(async () => {
        await result.current.openEventDetails(1);
      }),
    ).resolves.not.toThrow();
  });

  it('closeEventDetails resets selectedEvent to null', async () => {
    mockApiJson.mockResolvedValue({ id: 6, title: 'T', start: '', end: '' });

    const { result } = renderHook(() => useCalendarEventDetailsLoader());

    await act(async () => {
      await result.current.openEventDetails(6);
    });

    expect(result.current.selectedEvent).not.toBeNull();

    act(() => {
      result.current.closeEventDetails();
    });

    expect(result.current.selectedEvent).toBeNull();
  });

  it('setSelectedEvent allows direct manipulation of selectedEvent', () => {
    const { result } = renderHook(() => useCalendarEventDetailsLoader());

    act(() => {
      result.current.setSelectedEvent({
        id: 99,
        title: 'Direct',
        start: '',
        end: '',
      });
    });

    expect(result.current.selectedEvent!.id).toBe(99);
    expect(result.current.selectedEvent!.title).toBe('Direct');
  });
});
