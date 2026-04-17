import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import moment from 'moment';
import { CalendarEvent, EventFormData } from '../../types/calendar';
import { fetchCalendarEventDetails } from '../../hooks/useCalendarEventDetails';
import { fulfillPendingTournamentMatches } from '../../utils/mapApiEventToCalendarEvent';
import { buildTaskEditFormFields } from '../../utils/buildTaskEditFormFields';

interface EventTypesShape {
  createAndEditAllowed: boolean;
  entries: Array<{ id: number; name: string; color?: string }>;
}

interface GameTypesShape {
  entries: Array<{ id: number; name: string }>;
}

interface TeamShape {
  id: number;
  name: string;
}

interface Options {
  eventTypes: EventTypesShape;
  gameTypes: GameTypesShape;
  teams: TeamShape[];
  events: CalendarEvent[];
}

const emptyFormData = (): EventFormData => ({
  title: '',
  date: '',
  time: '',
  eventType: '',
  locationId: '',
  description: '',
  leagueId: '',
  permissionType: 'public',
  taskOffset: 0,
});

export function useCalendarEventState({ eventTypes, gameTypes, teams, events }: Options) {
  const [eventFormData, setEventFormData] = useState<EventFormData>(emptyFormData());
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [editingEventPermissions, setEditingEventPermissions] = useState<{
    canEdit?: boolean;
    canDelete?: boolean;
  } | null>(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [discardDraftOpen, setDiscardDraftOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [initialOpenRides, setInitialOpenRides] = useState(false);

  // Deep-link: open event details (and optionally rides) from URL params
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkEventId = searchParams.get('eventId');
  const deepLinkOpenRides = searchParams.get('openRides') === '1';

  useEffect(() => {
    if (!deepLinkEventId) return;
    const eventId = parseInt(deepLinkEventId, 10);
    if (isNaN(eventId)) return;

    const found = events.find(e => e.id === eventId);
    if (found) {
      setSelectedEvent(found);
      setInitialOpenRides(deepLinkOpenRides);
      setSearchParams({}, { replace: true });
      return;
    }

    fetchCalendarEventDetails(eventId)
      .then((ev) => {
        if (ev) {
          const calEvent: CalendarEvent = {
            id: ev.id || eventId,
            title: ev.title || 'Termin',
            start: new Date(ev.start),
            end: new Date(ev.end),
            description: ev.description || '',
            eventType: ev.type || {},
            location: ev.location || {},
            game: ev.game || undefined,
            task: ev.task || undefined,
            weatherData: ev.weatherData || undefined,
            permissions: ev.permissions || {},
            cancelled: ev.cancelled || false,
            cancelReason: ev.cancelReason || undefined,
            cancelledBy: ev.cancelledBy || undefined,
            meetingPoint: (ev as any).meetingPoint || undefined,
            meetingTime: (ev as any).meetingTime
              ? ((ev as any).meetingTime as string).substring(11, 16)
              : undefined,
          } as CalendarEvent;
          setSelectedEvent(calEvent);
          setInitialOpenRides(deepLinkOpenRides);
        }
      })
      .catch(() => {})
      .finally(() => {
        setSearchParams({}, { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkEventId, events]);

  const handleDateClick = (slotInfo: any) => {
    if (!eventTypes.createAndEditAllowed) return;
    const clickedDate = moment(slotInfo.start).format('YYYY-MM-DD');
    setEventFormData({ ...emptyFormData(), date: clickedDate });
    setEditingEventId(null);
    setEditingEventPermissions(null);
    setIsDirty(false);
    setEventModalOpen(true);
  };

  const handleEventClick = (info: any) => {
    if (info?.isExternal) return;
    setSelectedEvent(info);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    const startDate = moment(event.start);
    const endDate = event.end ? moment(event.end) : null;

    // eslint-disable-next-line no-console
    console.debug('Calendar HANDLE EDIT EVENT:', event);

    let resolvedGameType =
      (event.game && 'gameType' in event.game && (event.game as any).gameType?.id?.toString()) ||
      event.gameType?.id?.toString() ||
      '';

    if (!resolvedGameType) {
      const eventTypeName = event.eventType?.name?.toLowerCase() || '';
      if (eventTypeName.includes('turnier')) {
        const turnierGT = gameTypes.entries.find(gt => gt.name.toLowerCase().includes('turnier'));
        if (turnierGT) resolvedGameType = turnierGT.id.toString();
      }
    }

    const trainingDuration =
      endDate && endDate.isAfter(startDate)
        ? endDate.diff(startDate, 'minutes')
        : (event as any).trainingDuration || 90;

    const trainingOriginalDate =
      event.trainingSeriesId && event.trainingWeekdays?.length
        ? startDate.format('YYYY-MM-DD')
        : undefined;
    const trainingOriginalEndDate =
      event.trainingSeriesId && event.trainingWeekdays?.length
        ? event.trainingSeriesEndDate || ''
        : undefined;
    const trainingOriginalWeekdays =
      event.trainingSeriesId && event.trainingWeekdays?.length
        ? [...event.trainingWeekdays]
        : undefined;
    const trainingOriginalContentKey = event.trainingSeriesId
      ? [event.title, event.location?.id ?? '', startDate.format('HH:mm'), event.trainingTeamId ?? ''].join('|')
      : undefined;

    const pendingMatches = event.tournament?.matches
      // eslint-disable-next-line no-console
      ? (console.debug('EDIT: ', event.tournament?.matches),
        fulfillPendingTournamentMatches(event.tournament.matches, teams))
      : [];

    setEventFormData({
      title: event.title,
      date: startDate.format('YYYY-MM-DD'),
      time: startDate.format('HH:mm'),
      endDate: endDate ? endDate.format('YYYY-MM-DD') : '',
      endTime: endDate ? endDate.format('HH:mm') : '',
      eventType: event.eventType?.id?.toString() || '',
      locationId: event.location?.id?.toString(),
      description: event.description || '',
      homeTeam: event.game?.homeTeam?.id?.toString() || '',
      awayTeam: event.game?.awayTeam?.id?.toString() || '',
      gameType: resolvedGameType,
      leagueId:
        event.game && (event.game as any).league?.id
          ? (event.game as any).league.id.toString()
          : '',
      cupId:
        event.game && (event.game as any).cup?.id
          ? (event.game as any).cup.id.toString()
          : '',
      gameRound: (event.game as any)?.round || undefined,
      permissionType: (event as any).permissionType ?? 'public',
      trainingTeamId: event.trainingTeamId?.toString() || '',
      trainingRecurring: !!(event.trainingWeekdays && event.trainingWeekdays.length > 0),
      trainingWeekdays: event.trainingWeekdays || [],
      trainingEndDate: event.trainingSeriesEndDate || '',
      trainingSeriesId: event.trainingSeriesId || undefined,
      trainingOriginalDate,
      trainingOriginalEndDate,
      trainingOriginalWeekdays,
      trainingOriginalContentKey,
      trainingDuration,
      tournamentId:
        event.tournament?.id?.toString() || (event as any).tournamentId?.toString() || '',
      tournamentType: event.tournament?.settings?.tournamentType || undefined,
      tournamentRoundDuration: event.tournament?.settings?.roundDuration || 10,
      tournamentBreakTime: event.tournament?.settings?.breakTime || 2,
      tournamentGameMode: event.tournament?.settings?.gameMode || 'round_robin',
      tournamentNumberOfGroups: event.tournament?.settings?.numberOfGroups || 2,
      tournament: event.tournament,
      teamIds: event.teamIds,
      pendingTournamentMatches: pendingMatches,
      meetingPoint: event.meetingPoint || '',
      meetingTime: event.meetingTime || '',
      meetingLocationId: event.meetingLocation?.id?.toString() || '',
      ...buildTaskEditFormFields(event.task),
    });
    setEditingEventId(event.id);
    setEditingEventPermissions(event.permissions ?? null);
    setSelectedEvent(null);
    setIsDirty(false);
    setEventModalOpen(true);
  };

  const handleFormChange = useCallback(
    (field: string, value: string | number | boolean | string[]) => {
      setIsDirty(true);
      setEventFormData(prev => ({ ...prev, [field]: value }));
    },
    [],
  );

  const resetEventForm = useCallback(() => {
    setEventFormData(emptyFormData());
    setIsDirty(false);
  }, []);

  const doCloseEventModal = useCallback(() => {
    setEventModalOpen(false);
    resetEventForm();
  }, [resetEventForm]);

  const handleEventModalCloseRequest = useCallback(() => {
    if (isDirty) {
      setDiscardDraftOpen(true);
    } else {
      doCloseEventModal();
    }
  }, [isDirty, doCloseEventModal]);

  const handleAddEvent = () => {
    const today = moment().format('YYYY-MM-DD');
    setEventFormData({ ...emptyFormData(), date: today });
    setEditingEventId(null);
    setEditingEventPermissions(null);
    setEventModalOpen(true);
  };

  return {
    eventFormData,
    editingEventId,
    editingEventPermissions,
    eventModalOpen,
    isDirty,
    discardDraftOpen,
    setDiscardDraftOpen,
    selectedEvent,
    setSelectedEvent,
    initialOpenRides,
    setInitialOpenRides,
    handleDateClick,
    handleEventClick,
    handleEditEvent,
    handleFormChange,
    resetEventForm,
    doCloseEventModal,
    handleEventModalCloseRequest,
    handleAddEvent,
  };
}
