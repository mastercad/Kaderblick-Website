import { useCallback, useState } from 'react';
import type { CalendarEvent as EventDetailsCalendarEvent } from '../modals/EventDetailsModal/types';
import { apiJson } from '../utils/api';

type RawCalendarEvent = {
  id?: number;
  title?: string;
  start?: Date | string;
  startDate?: Date | string;
  end?: Date | string;
  endDate?: Date | string;
  description?: string;
  type?: EventDetailsCalendarEvent['type'];
  eventType?: EventDetailsCalendarEvent['type'];
  location?: EventDetailsCalendarEvent['location'];
  game?: EventDetailsCalendarEvent['game'];
  task?: EventDetailsCalendarEvent['task'];
  weatherData?: EventDetailsCalendarEvent['weatherData'];
  permissions?: EventDetailsCalendarEvent['permissions'];
  cancelled?: boolean;
  cancelReason?: string;
  cancelledBy?: string;
};

export function toEventDetailsCalendarEvent(
  event: RawCalendarEvent | null | undefined,
  fallbackId?: number,
): EventDetailsCalendarEvent | null {
  if (!event) {
    return null;
  }

  return {
    id: event.id ?? fallbackId ?? 0,
    title: event.title || 'Termin',
    start: event.start || event.startDate || '',
    end: event.end || event.endDate || event.start || event.startDate || '',
    description: event.description || '',
    type: event.type || event.eventType || undefined,
    location: event.location || undefined,
    game: event.game || undefined,
    task: event.task || undefined,
    weatherData: event.weatherData || undefined,
    permissions: event.permissions || undefined,
    cancelled: event.cancelled || false,
    cancelReason: event.cancelReason || undefined,
    cancelledBy: event.cancelledBy || undefined,
  };
}

export async function fetchCalendarEventDetails(eventId: number): Promise<EventDetailsCalendarEvent> {
  const eventDetails = await apiJson<RawCalendarEvent>(`/api/calendar/event/${eventId}`);
  return toEventDetailsCalendarEvent(eventDetails, eventId) as EventDetailsCalendarEvent;
}

export function useCalendarEventDetailsLoader(onError?: (message: string) => void) {
  const [selectedEvent, setSelectedEvent] = useState<EventDetailsCalendarEvent | null>(null);
  const [loadingEventId, setLoadingEventId] = useState<number | null>(null);

  const openEventDetails = useCallback(async (eventId: number) => {
    setLoadingEventId(eventId);

    try {
      const eventDetails = await fetchCalendarEventDetails(eventId);
      setSelectedEvent(eventDetails);
    } catch (error: any) {
      onError?.(error?.message || 'Die Event-Details konnten nicht geladen werden.');
    } finally {
      setLoadingEventId(null);
    }
  }, [onError]);

  const closeEventDetails = useCallback(() => {
    setSelectedEvent(null);
  }, []);

  return {
    selectedEvent,
    loadingEventId,
    openEventDetails,
    closeEventDetails,
    setSelectedEvent,
  };
}