import { useState, useEffect, useMemo } from 'react';
import moment from 'moment';
import {
  CalendarEvent,
  CalendarEventType,
  GameType,
  Location,
  LocationsApiResponse,
  Team,
  TeamsApiResponse,
} from '../types/calendar';
import { apiJson } from '../utils/api';
import { mapApiEventToCalendarEvent } from '../utils/mapApiEventToCalendarEvent';

type UserEntry = {
  id: string | number;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  context?: string;
};

/**
 * Loads and manages all calendar data: event types, teams, locations, users,
 * events for the current view, external calendar events, and filter state.
 *
 * @param date  Currently displayed date (controls events-by-view refetch)
 * @param view  Currently displayed view (controls events-by-view refetch)
 */
export function useCalendarData(date: Date, view: string) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [externalEvents, setExternalEvents] = useState<CalendarEvent[]>([]);

  const [eventTypes, setEventTypes] = useState<{ createAndEditAllowed: boolean; entries: CalendarEventType[] }>({
    createAndEditAllowed: false,
    entries: [],
  });
  const [teams, setTeams] = useState<Team[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [gameTypes, setGameTypes] = useState<{ createAndEditAllowed: boolean; entries: GameType[] }>({
    createAndEditAllowed: false,
    entries: [],
  });
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [activeEventTypeIds, setActiveEventTypeIds] = useState<Set<number>>(new Set());

  // ─── Initial load: event types, teams, game types, locations, users ───────

  useEffect(() => {
    Promise.all([
      apiJson<{ createAndEditAllowed: boolean; entries: CalendarEventType[] }>('/api/calendar-event-types')
        .catch(() => ({ createAndEditAllowed: false, entries: [] })),
      apiJson<TeamsApiResponse[]>('/api/teams/list').catch(() => []),
      apiJson<TeamsApiResponse[]>('/api/teams/list?context=match').catch(() => []),
      apiJson<{ createAndEditAllowed: boolean; entries: GameType[] }>('/api/game-types')
        .catch(() => ({ createAndEditAllowed: false, entries: [] })),
      apiJson<LocationsApiResponse>('/api/locations')
        .catch(() => ({ locations: [], permissions: { canCreate: false, canEdit: false, canView: false, canDelete: false } })),
      apiJson<{ users: { id: string; fullName: string; context?: string }[] }>('/api/users/contacts')
        .catch(() => ({ users: [] })),
    ]).then(([eventTypesData, teamsData, allTeamsData, gameTypesData, locationsData, usersData]) => {
      if ('error' in eventTypesData) {
        setEventTypes({ createAndEditAllowed: false, entries: [] });
      } else {
        setEventTypes({
          ...eventTypesData,
          entries: (eventTypesData.entries || []).filter(et => et.name !== 'Turnier-Match'),
        });
      }

      const parseTeams = (data: any): Team[] => {
        if (Array.isArray(data)) {
          if (data.length > 0 && 'teams' in data[0]) return (data[0] as any).teams || [];
          return [];
        } else if (data && typeof data === 'object' && 'teams' in data) {
          return (data as any).teams || [];
        }
        return [];
      };
      setTeams(parseTeams(teamsData));
      setAllTeams(parseTeams(allTeamsData));

      if ('error' in gameTypesData) {
        setGameTypes({ createAndEditAllowed: false, entries: [] });
      } else {
        setGameTypes({
          ...gameTypesData,
          entries: (gameTypesData.entries || []).filter(gt => gt.name !== 'Turnier-Match'),
        });
      }

      if ('error' in locationsData) {
        setLocations([]);
      } else {
        setLocations(locationsData.locations || []);
      }

      if ('error' in usersData || !usersData.users) {
        setUsers([]);
      } else {
        setUsers(usersData.users || []);
      }
    }).catch(console.error);
  }, []);

  // Initialise active event-type filter once event types are loaded
  useEffect(() => {
    if (eventTypes.entries.length > 0) {
      setActiveEventTypeIds(new Set(eventTypes.entries.map(et => et.id)));
    }
  }, [eventTypes.entries]);

  // ─── Events for the current date/view ─────────────────────────────────────

  useEffect(() => {
    const viewType = view === 'month' ? 'month' : view === 'week' ? 'week' : 'day';
    const start = moment(date).startOf(viewType as any).toISOString();
    const end = moment(date).endOf(viewType as any).toISOString();

    setLoading(true);
    setError(null);

    apiJson(`/api/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
      .then((data: any) => {
        // Collect unique tournament team IDs across all events in the view
        const allTournamentTeamIds = [...new Set<any>(
          (data || [])
            .flatMap((ev: any) => ev.tournament?.matches || [])
            .flatMap((m: any) => [m.homeTeamId, m.awayTeamId].filter(Boolean)),
        )];

        setEvents((data || []).map((ev: any) =>
          mapApiEventToCalendarEvent(ev, teams, allTournamentTeamIds),
        ));
        setLoading(false);
      })
      .catch((e: any) => {
        setError(e.message);
        setLoading(false);
      });
  }, [date, view]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── External calendar events (iCal imports) ──────────────────────────────

  useEffect(() => {
    apiJson('/api/profile/calendar/external/events/all')
      .then((data: any) => {
        if (!Array.isArray(data)) return;
        const mapped: CalendarEvent[] = data.map((ev: any, idx: number) => ({
          id: -(idx + 1), // negative IDs to avoid conflicts with real events
          title: ev.title || 'Externer Termin',
          start: new Date(ev.start),
          end: new Date(ev.end),
          description: ev.description || '',
          isExternal: true,
          externalCalendarId: ev.calendarId,
          externalCalendarName: ev.calendarName,
          externalCalendarColor: ev.calendarColor,
        }));
        setExternalEvents(mapped);
      })
      .catch(() => {
        // Fehler beim Laden externer Kalender → still ignorieren
      });
  }, []);

  // ─── Derived state ─────────────────────────────────────────────────────────

  const filteredEvents = useMemo(() => {
    const platformEvents = events.filter(event => {
      if (!event.eventType?.id) return true;
      return activeEventTypeIds.has(event.eventType.id);
    });
    return [...platformEvents, ...externalEvents];
  }, [events, activeEventTypeIds, externalEvents]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const toggleEventType = (eventTypeId: number) => {
    setActiveEventTypeIds(prev => {
      const next = new Set(prev);
      if (next.has(eventTypeId)) {
        next.delete(eventTypeId);
      } else {
        next.add(eventTypeId);
      }
      return next;
    });
  };

  const refreshEvents = async () => {
    const viewType = view === 'month' ? 'month' : view === 'week' ? 'week' : 'day';
    const start = moment(date).startOf(viewType as any).toISOString();
    const end = moment(date).endOf(viewType as any).toISOString();

    const updatedEvents = await apiJson<CalendarEvent[] | { error: string }>(
      `/api/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    );

    if (Array.isArray(updatedEvents)) {
      setEvents(updatedEvents.map((ev: any) => mapApiEventToCalendarEvent(ev, teams)));
    }
  };

  return {
    events,
    loading,
    error,
    externalEvents,
    eventTypes,
    teams,
    allTeams,
    gameTypes,
    locations,
    users,
    activeEventTypeIds,
    filteredEvents,
    toggleEventType,
    refreshEvents,
  };
}
