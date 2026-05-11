import { useEffect, useState } from 'react';
import { apiJson } from '../../../utils/api';
import type { CalendarEvent } from '../../../types/calendar';

function buildUpcomingRange(): { start: string; end: string } {
  const start = new Date();
  const end   = new Date();
  end.setDate(end.getDate() + 60);
  return {
    start: start.toISOString(),
    end:   end.toISOString(),
  };
}

export interface PosterEventsData {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
}

/**
 * Loads upcoming calendar events (next 60 days) for the poster generator.
 * Only non-game events are useful here (trainings, custom events, tasks).
 */
export function usePosterEvents(): PosterEventsData {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const { start, end } = buildUpcomingRange();
    const url = `/api/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;

    apiJson<CalendarEvent[]>(url)
      .then(data => {
        if (cancelled) return;
        setEvents(data ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('Events konnten nicht geladen werden.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  return { events, loading, error };
}
