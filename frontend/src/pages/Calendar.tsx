import CalendarFab from '../components/CalendarFab';
import { useFabStack } from '../components/FabStackProvider';
import { MobileCalendar } from '../components/MobileCalendar';
// ErrorBoundary für bessere Fehlerdiagnose
import React from 'react';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EventDetailsModal } from '../modals/EventDetailsModal';
import { EventModal } from '../modals/EventModal';
import { getEventTypeFlags } from '../hooks/useEventTypeFlags';
import { fetchCalendarEventDetails, toEventDetailsCalendarEvent } from '../hooks/useCalendarEventDetails';
import { DynamicConfirmationModal } from '../modals/DynamicConfirmationModal';
import { TaskDeletionModal } from '../modals/TaskDeletionModal';
import { AlertModal } from '../modals/AlertModal';
import { Calendar as BigCalendar, momentLocalizer, Views } from 'react-big-calendar';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import TodayIcon from '@mui/icons-material/Today';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { apiRequest, getApiErrorMessage } from '../utils/api';
import moment from 'moment';
import AddIcon from '@mui/icons-material/Add';
import 'moment/locale/de';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { CalendarEvent, EventFormData } from '../types/calendar';
import { useCalendarData } from '../hooks/useCalendarData';
import { fulfillPendingTournamentMatches } from '../utils/mapApiEventToCalendarEvent';
import { buildCalendarEventPayload } from '../utils/buildCalendarEventPayload';

moment.updateLocale('de', {
  week: {
    dow: 1
  }
});

const localizer = momentLocalizer(moment);

const messages = {
  allDay: 'Ganztägig',
  previous: 'Zurück',
  next: 'Weiter',
  today: 'Heute',
  month: 'Monat',
  week: 'Woche',
  day: 'Tag',
  agenda: 'Agenda',
  date: 'Datum',
  time: 'Zeit',
  event: 'Ereignis',
  noEventsInRange: 'Keine Termine vorhanden. Klicken Sie auf einen Tag, um einen neuen Termin zu erstellen.',
  showMore: (total: number) => `+ ${total} weitere`
};

const formats = {
  agendaDateFormat: 'DD.MM.YYYY',
  agendaTimeFormat: 'HH:mm',
  agendaTimeRangeFormat: ({ start, end }: { start: Date, end: Date }) => {
    return `${moment(start).format('HH:mm')} – ${moment(end).format('HH:mm')}`;
  },
  monthHeaderFormat: 'MMMM YYYY',
  dayHeaderFormat: 'dddd, DD.MM.YYYY',
  dayRangeHeaderFormat: ({ start, end }: { start: Date, end: Date }) => {
    return `${moment(start).format('DD.MM.YYYY')} – ${moment(end).format('DD.MM.YYYY')}`;
  }
};

class CalendarErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error('Calendar.tsx ErrorBoundary:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', padding: 32 }}>
          <h2>Fehler in Calendar.tsx</h2>
          <pre>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

type CalendarProps = {
  setCalendarFabHandler?: (handler: (() => void) | null) => void;
};

function CalendarInner({ setCalendarFabHandler }: CalendarProps) {
  // Handler für globalen FabStack setzen/entfernen
  const fabStack = useFabStack();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [view, setView] = useState(isMobile ? Views.DAY : Views.MONTH);
  const [date, setDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [initialOpenRides, setInitialOpenRides] = useState(false);
  const {
    events,
    loading,
    error,
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
  } = useCalendarData(date, view);
  
  // Event Modal State
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventFormData, setEventFormData] = useState<EventFormData>({
    title: '',
    date: '',
    time: '',
    eventType: '',
    locationId: '',
    description: '',
    leagueId: '',
    permissionType: 'public',
    taskOffset: 0
  });
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [editingEventPermissions, setEditingEventPermissions] = useState<{ canEdit?: boolean; canDelete?: boolean } | null>(null);
  const [eventSaving, setEventSaving] = useState(false);
  
  // CalendarFab nur anzeigen wenn der Benutzer Events erstellen darf
  React.useEffect(() => {
    if (!eventTypes.createAndEditAllowed) {
      fabStack?.removeFab('calendar-fab');
      return;
    }
    fabStack?.addFab(<CalendarFab onClick={handleAddEvent} />, 'calendar-fab');
    return () => {
      fabStack?.removeFab('calendar-fab');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventTypes.createAndEditAllowed]);

  // Deep-link: open event details (and optionally rides) from URL params
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkEventId = searchParams.get('eventId');
  const deepLinkOpenRides = searchParams.get('openRides') === '1';

  useEffect(() => {
    if (!deepLinkEventId) return;
    const eventId = parseInt(deepLinkEventId, 10);
    if (isNaN(eventId)) return;

    // Try to find in already-loaded events first
    const found = events.find(e => e.id === eventId);
    if (found) {
      setSelectedEvent(found);
      setInitialOpenRides(deepLinkOpenRides);
      // Clear params so we don't re-trigger
      setSearchParams({}, { replace: true });
      return;
    }

    // Fetch event details if not in current view
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
          } as CalendarEvent;
          setSelectedEvent(calEvent);
          setInitialOpenRides(deepLinkOpenRides);
        }
      })
      .catch(() => {})
      .finally(() => {
        setSearchParams({}, { replace: true });
      });
  }, [deepLinkEventId, events]);

  // Modal States
  const [alertModal, setAlertModal] = useState<{
    open: boolean;
    title?: string;
    message: string;
    severity: 'error' | 'warning' | 'info' | 'success';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const [taskDeletionModal, setTaskDeletionModal] = useState<{
    open: boolean;
    mode?: 'task' | 'training';
    eventId?: number;
  }>({
    open: false
  });

  // Mobile views should be limited but include month for better UX
  const availableViews = isMobile ? ['month', 'day', 'agenda'] : ['month', 'week', 'day', 'agenda'];

  // Helper-Funktionen für Modals
  const showAlert = (message: string, severity: 'error' | 'warning' | 'info' | 'success' = 'info', title?: string) => {
    setAlertModal({
      open: true,
      message,
      severity,
      title
    });
  };

  const showConfirm = (message: string, onConfirm: () => void, title: string = 'Bestätigung') => {
    setConfirmModal({
      open: true,
      title,
      message,
      onConfirm
    });
  };

  // Event-Handler für das Erstellen neuer Events
  const handleDateClick = (slotInfo: any) => {
    if (!eventTypes.createAndEditAllowed) return;
    const clickedDate = moment(slotInfo.start).format('YYYY-MM-DD');
    setEventFormData({
      title: '',
      date: clickedDate,
      time: '',
      eventType: '',
      locationId: '',
      description: '',
      permissionType: 'public',
      taskOffset: 0
    });
    setEditingEventId(null);
    setEditingEventPermissions(null);
    setEventModalOpen(true);
  };

  // Event-Handler für das Bearbeiten existierender Events
  const handleEventClick = (info: any) => {
    // Externe Events sind schreibgeschützt – kein EventDetailsModal öffnen
    if (info?.isExternal) {
      return;
    }
    setSelectedEvent(info);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    const startDate = moment(event.start);
    const endDate = event.end ? moment(event.end) : null;

    console.debug("Calendar HANDLE EDIT EVENT:", event);

    // Determine gameType: if event type IS "Turnier" but no game entity exists,
    // auto-fill with the "Turnier" gameType for consistent rendering
    let resolvedGameType = (event.game && 'gameType' in event.game && (event.game as any).gameType?.id?.toString())
      || event.gameType?.id?.toString()
      || '';

    if (!resolvedGameType) {
      const eventTypeName = event.eventType?.name?.toLowerCase() || '';
      if (eventTypeName.includes('turnier')) {
        const turnierGT = gameTypes.entries.find(gt => gt.name.toLowerCase().includes('turnier'));
        if (turnierGT) {
          resolvedGameType = turnierGT.id.toString();
        }
      }
    }

    const trainingDuration = endDate && endDate.isAfter(startDate)
      ? endDate.diff(startDate, 'minutes')
      : (event as any).trainingDuration || 90;

    // Store original series params so TrainingEventFields can compute an accurate date-set diff
    const trainingOriginalDate = (event.trainingSeriesId && event.trainingWeekdays?.length)
      ? startDate.format('YYYY-MM-DD') : undefined;
    const trainingOriginalEndDate = (event.trainingSeriesId && event.trainingWeekdays?.length)
      ? (event.trainingSeriesEndDate || '') : undefined;
    const trainingOriginalWeekdays = (event.trainingSeriesId && event.trainingWeekdays?.length)
      ? [...event.trainingWeekdays] : undefined;
    // Content key: used at save-time to detect whether content (vs structure) changed
    const trainingOriginalContentKey = event.trainingSeriesId
      ? [event.title, event.location?.id ?? '', startDate.format('HH:mm'), event.trainingTeamId ?? ''].join('|')
      : undefined;

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
      leagueId: event.game && (event.game as any).league?.id ? (event.game as any).league.id.toString() : '',
      cupId: event.game && (event.game as any).cup?.id ? (event.game as any).cup.id.toString() : '',
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
      tournamentId: event.tournament?.id?.toString() || (event as any).tournamentId?.toString() || '',
      tournamentType: event.tournament?.settings?.tournamentType || undefined,
      tournamentRoundDuration: event.tournament?.settings?.roundDuration || 10,
      tournamentBreakTime: event.tournament?.settings?.breakTime || 2,
      tournamentGameMode: event.tournament?.settings?.gameMode || 'round_robin',
      tournamentNumberOfGroups: event.tournament?.settings?.numberOfGroups || 2,
      tournament: event.tournament,
      teamIds: event.teamIds,
      pendingTournamentMatches: event.tournament?.matches ? (console.debug("EDIT: ", event.tournament?.matches), fulfillPendingTournamentMatches(event.tournament?.matches, teams)) : [],
      task: event.task ? {
        id: event.task.id,
        isRecurring: event.task.isRecurring,
        recurrenceMode: event.task.recurrenceMode,
        recurrenceRule: event.task.recurrenceRule,
        rotationUsers: event.task.rotationUsers,
        rotationCount: event.task.rotationCount,
        offset: event.task.offset,
      } : undefined
    });
    setEditingEventId(event.id);
    setEditingEventPermissions(event.permissions ?? null);
    setSelectedEvent(null);
    setEventModalOpen(true);
  };

  // Formular-Änderungen verwalten
  const handleFormChange = useCallback((field: string, value: string | number | boolean | string[]) => {
    setEventFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Event speichern
  const handleSaveEvent = async () => {
    // Basis-Validierung
    if (!eventFormData.title?.trim()) {
      showAlert('Bitte geben Sie einen Titel ein.', 'warning', 'Titel fehlt');
      return;
    }
    
    if (!eventFormData.date) {
      showAlert('Bitte wählen Sie ein Datum aus.', 'warning', 'Datum fehlt');
      return;
    }
    
    if (!eventFormData.eventType) {
      showAlert('Bitte wählen Sie einen Event-Typ aus.', 'warning', 'Event-Typ fehlt');
      return;
    }

    // Event type flags — single source of truth
    const { isMatchEvent, isTournament, isTask, isTraining } = getEventTypeFlags(
      eventFormData.eventType, eventFormData.gameType, eventTypesOptions, gameTypesOptions,
    );
    
    // Validation for recurring training
    if (isTraining && eventFormData.trainingRecurring) {
      if (!eventFormData.trainingWeekdays || eventFormData.trainingWeekdays.length === 0) {
        showAlert('Bitte mindestens einen Wochentag für das Training auswählen.', 'warning', 'Wochentage fehlen');
        return;
      }
      if (!eventFormData.trainingEndDate) {
        showAlert('Bitte ein Enddatum für die Trainingsserie angeben.', 'warning', 'Enddatum fehlt');
        return;
      }
    }

    if (isMatchEvent && !isTournament) {
      if (!eventFormData.homeTeam) {
        showAlert('Bitte wählen Sie ein Heim-Team aus.', 'warning', 'Heim-Team fehlt');
        return;
      }
      if (!eventFormData.awayTeam) {
        showAlert('Bitte wählen Sie ein Auswärts-Team aus.', 'warning', 'Auswärts-Team fehlt');
        return;
      }
      if (eventFormData.homeTeam === eventFormData.awayTeam) {
        showAlert('Heim-Team und Auswärts-Team können nicht identisch sein.', 'warning', 'Ungültige Team-Auswahl');
        return;
      }
    }

    setEventSaving(true);

    try {
      // Recurring Training: use dedicated bulk endpoint
      if (isTraining && eventFormData.trainingRecurring && !editingEventId) {
        const seriesPayload = {
          title: eventFormData.title,
          startDate: eventFormData.date,
          seriesEndDate: eventFormData.trainingEndDate,
          weekdays: eventFormData.trainingWeekdays,
          time: eventFormData.time || null,
          endTime: eventFormData.endTime || null,
          duration: eventFormData.trainingDuration || 90,
          eventTypeId: eventFormData.eventType ? parseInt(eventFormData.eventType) : undefined,
          teamId: eventFormData.trainingTeamId ? parseInt(eventFormData.trainingTeamId) : undefined,
          locationId: eventFormData.locationId ? parseInt(eventFormData.locationId) : undefined,
          description: eventFormData.description || '',
        };

        const response = await apiRequest('/api/calendar/training-series', {
          method: 'POST',
          body: seriesPayload,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Unbekannter Fehler' }));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
        }

        const result = await response.json();
        await refreshEvents();
        setEventModalOpen(false);
        setEventFormData({
          title: '',
          date: '',
          time: '',
          eventType: '',
          locationId: '',
          description: '',
          permissionType: 'public',
          taskOffset: 0,
        });
        showAlert(`${result.createdCount} Trainings wurden erfolgreich erstellt!`, 'success', 'Trainingsserie erstellt');
        setEventSaving(false);
        return;
      }

      const payload = buildCalendarEventPayload(
        eventFormData,
        { isMatchEvent, isTournament, isTask, isTraining },
        editingEventId,
        gameTypesOptions,
        tournamentTeams,
      );

      const url = editingEventId ? `/api/calendar/event/${editingEventId}` : '/api/calendar/event';
      const method = editingEventId ? 'PUT' : 'POST';

      const response = await apiRequest(url, {
        method: method as any,
        body: payload
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }));
        console.error(response);
        console.error(errorData);
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
      }

      await refreshEvents();

      setEventModalOpen(false);
      setEventFormData({
        title: '',
        date: '',
        time: '',
        eventType: '',
        locationId: '',
        description: '',
        permissionType: 'public',
        taskOffset: 0
      });

      showAlert('Event wurde erfolgreich gespeichert!', 'success', 'Erfolgreich gespeichert');
      
    } catch (error: any) {
      console.error('Error saving event:', error);
      showAlert(getApiErrorMessage(error), 'error', 'Speichern fehlgeschlagen');
    } finally {
      setEventSaving(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!editingEventId) return;

    const isTaskEvent = eventFormData.task && Object.keys(eventFormData.task).length > 0;
    const isTrainingSeries = (eventFormData.trainingWeekdays?.length ?? 0) > 0 || !!eventFormData.trainingSeriesId;

    if (isTaskEvent) {
      setTaskDeletionModal({ open: true, eventId: editingEventId });
    } else if (isTrainingSeries) {
      setTaskDeletionModal({ open: true, mode: 'training', eventId: editingEventId });
    } else {
      showConfirm(
        'Möchten Sie dieses Event wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
        async () => {
          await performDeleteEvent('single');
        },
        'Event löschen'
      );
    }
  };

  const handleDeleteSelectedEvent = async () => {
    if (!selectedEvent) return;

    const isTaskEvent = selectedEvent.task && Object.keys(selectedEvent.task).length > 0;
    const isTrainingSeries = !!selectedEvent.trainingSeriesId;

    if (isTaskEvent) {
      setTaskDeletionModal({ open: true, eventId: selectedEvent.id });
    } else if (isTrainingSeries) {
      setTaskDeletionModal({ open: true, mode: 'training', eventId: selectedEvent.id });
    } else {
      showConfirm(
        'Möchten Sie dieses Event wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
        async () => {
          await performDeleteEvent('single', selectedEvent.id);
        },
        'Event löschen'
      );
    }
  };

  const performDeleteEvent = async (deletionMode: 'single' | 'from_here' | 'series', eventId?: number) => {
    const id = eventId ?? editingEventId;
    if (!id) return;
    
    setEventSaving(true);
    try {
      const response = await apiRequest(`/api/calendar/event/${id}`, {
        method: 'DELETE',
        body: {deletionMode: deletionMode}
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }));
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
      }

      // Events neu laden
      await refreshEvents();

      setEventModalOpen(false);
      setSelectedEvent(null);
      setTaskDeletionModal({ open: false });
      setEventFormData({
        title: '',
        date: '',
        time: '',
        eventType: '',
        locationId: '',
        description: '',
        permissionType: 'public',
        taskOffset: 0
      });

      showAlert('Event wurde erfolgreich gelöscht!', 'success', 'Erfolgreich gelöscht');
      
    } catch (error: any) {
      console.error('Error deleting event:', error);
      showAlert(getApiErrorMessage(error), 'error', 'Löschen fehlgeschlagen');
    } finally {
      setEventSaving(false);
    }
  }

  // Floating Action Button für neues Event
  const handleAddEvent = () => {
    const today = moment().format('YYYY-MM-DD');
    setEventFormData({
      title: '',
      date: today,
      time: '',
      eventType: '',
      locationId: '',
      description: '',
      taskOffset: 0
    });
    setEditingEventId(null);
    setEditingEventPermissions(null);
    setEventModalOpen(true);
  };

  // Custom Event-Styling basierend auf dem Event-Type
  const eventStyleGetter = (event: any) => {
    // Externe Events: Farbe des externen Kalenders verwenden
    let backgroundColor = event.isExternal
      ? (event.externalCalendarColor || '#607d8b')
      : (event.eventType?.color || theme.palette.primary.main);
    
    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: event.cancelled ? 0.45 : (event.isExternal ? 0.75 : 0.9),
        color: 'white',
        border: event.cancelled ? '2px dashed rgba(255,255,255,0.5)' : (event.isExternal ? '1px dashed rgba(255,255,255,0.6)' : '0px'),
        display: 'block',
        fontWeight: 'bold',
        fontSize: isMobile ? '0.75rem' : '0.875rem',
        cursor: event.isExternal ? 'default' : 'pointer',
      }
    };
  };

  const calendarStyle = useMemo(() => ({
    height: isMobile ? 'calc(100dvh - 200px)' : 'calc(100dvh - 200px)',
    minHeight: isMobile ? '400px' : '500px',
    backgroundColor: theme.palette.background.paper,
    '& .rbc-calendar': {
      fontFamily: theme.typography.fontFamily,
      fontSize: isMobile ? '0.75rem' : '0.875rem',
    },
    '& .rbc-header': {
      backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[100],
      color: theme.palette.text.primary,
      borderColor: theme.palette.divider,
      padding: isMobile ? theme.spacing(0.5) : theme.spacing(1),
      fontSize: isMobile ? '0.75rem' : '0.875rem',
    },
    '& .rbc-month-view, & .rbc-time-view': {
      border: `1px solid ${theme.palette.divider}`,
    },
    '& .rbc-day-bg': {
      backgroundColor: theme.palette.background.default,
      minHeight: isMobile ? '60px' : '80px',
    },
    '& .rbc-today': {
      backgroundColor: theme.palette.mode === 'dark' 
        ? theme.palette.primary.dark + '20' 
        : theme.palette.primary.light + '20',
    },
    '& .rbc-off-range-bg': {
      backgroundColor: theme.palette.mode === 'dark' 
        ? theme.palette.grey[900] 
        : theme.palette.grey[50],
    },
    '& .rbc-event': {
      fontSize: isMobile ? '0.65rem' : '0.75rem',
      padding: isMobile ? '1px 2px' : '2px 4px',
      lineHeight: isMobile ? 1.2 : 1.4,
    },
    '& .rbc-toolbar': {
      marginBottom: theme.spacing(2),
      flexDirection: isMobile ? 'column' : 'row',
      gap: isMobile ? theme.spacing(1) : 0,
      '& .rbc-btn-group': {
        display: isMobile ? 'none' : 'flex', // Hide default buttons on mobile
      },
      '& button': {
        color: theme.palette.text.primary,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        fontSize: isMobile ? '0.75rem' : '0.875rem',
        padding: isMobile ? theme.spacing(0.5) : theme.spacing(1),
        '&:hover': {
          backgroundColor: theme.palette.action.hover,
        },
        '&.rbc-active': {
          backgroundColor: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
        }
      },
      '& .rbc-toolbar-label': {
        color: theme.palette.text.primary,
        fontWeight: theme.typography.fontWeightMedium,
        fontSize: isMobile ? '0.9rem' : '1rem',
        textAlign: 'center',
        margin: isMobile ? theme.spacing(1, 0) : 0,
      }
    },
    // Mobile-specific overrides
    ...(isMobile && {
      '& .rbc-date-cell': {
        padding: '2px',
        fontSize: '0.7rem',
      },
      '& .rbc-header': {
        minHeight: '32px',
      },
      '& .rbc-month-row': {
        minHeight: '60px',
      },
      '& .rbc-agenda-view': {
        fontSize: '0.8rem',
        '& table': {
          fontSize: '0.8rem',
        },
        '& .rbc-agenda-time-cell': {
          width: '80px',
        },
      },
    }),
  }), [theme, isMobile]);

  // Custom navigation handlers for mobile
  const navigateToToday = () => setDate(new Date());
  const navigateBack = () => {
    const newDate = moment(date);
    if (view === Views.MONTH || view === 'month') {
      newDate.subtract(1, 'month');
    } else if (view === Views.WEEK || view === 'week') {
      newDate.subtract(1, 'week');
    } else {
      newDate.subtract(1, 'day');
    }
    setDate(newDate.toDate());
  };
  const navigateForward = () => {
    const newDate = moment(date);
    if (view === Views.MONTH || view === 'month') {
      newDate.add(1, 'month');
    } else if (view === Views.WEEK || view === 'week') {
      newDate.add(1, 'week');
    } else {
      newDate.add(1, 'day');
    }
    setDate(newDate.toDate());
  };

  const getViewLabel = (view: string) => {
    switch(view) {
      case 'month': return 'Monat';
      case 'week': return 'Woche';
      case 'day': return 'Tag';
      case 'agenda': return 'Liste';
      default: return view;
    }
  };

  // Memoize mapped props to prevent unnecessary re-renders of EventModal
  // MUST be before early returns (loading/error) - React Hooks rules!
  const eventTypesOptions = useMemo(
    () => eventTypes.entries.map(et => ({ value: et.id.toString(), label: et.name })),
    [eventTypes.entries]
  );
  
  const tournamentTeams = useMemo(
    () => teams.map(team => ({ value: team.id.toString(), label: team.name })),
    [teams]
  );

  const allTeamsOptions = useMemo(
    () => allTeams.map(team => ({ value: team.id.toString(), label: team.name })),
    [allTeams]
  );

  const teamDefaultsMap = useMemo(
    () => Object.fromEntries(
      allTeams.map(t => [t.id.toString(), {
        defaultHalfDuration: t.defaultHalfDuration ?? null,
        defaultHalftimeBreakDuration: t.defaultHalftimeBreakDuration ?? null,
      }])
    ),
    [allTeams]
  );
  
  const gameTypesOptions = useMemo(
    () => gameTypes.entries.map(gt => ({ value: gt.id.toString(), label: gt.name })),
    [gameTypes.entries]
  );
  
  const locationsOptions = useMemo(
    () => locations.map(l => ({ value: l.id.toString(), label: l.name })),
    [locations]
  );

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><Typography>Lade Termine...</Typography></Box>;
  if (error) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><Typography color="error">{error}</Typography></Box>;

  return (
    <>
      <Box sx={{ width: '100%', height: '100%', p: 3 }}>
        <Box sx={{ p: { xs: 1, sm: 2 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: { xs: 0, sm: 2 } }}>
            <Typography variant={isMobile ? "h5" : "h4"} component="h1">
              Kalender
            </Typography>

            {/* Desktop: Chips + Button in Titelzeile */}
            {!isMobile && (
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {eventTypes.entries.map(et => (
                    <Chip
                      key={et.id}
                      label={et.name}
                      onClick={() => toggleEventType(et.id)}
                      variant={activeEventTypeIds.has(et.id) ? 'filled' : 'outlined'}
                      sx={{
                        backgroundColor: activeEventTypeIds.has(et.id) ? (et.color || '#1976d2') : 'transparent',
                        color: activeEventTypeIds.has(et.id) ? '#ffffff' : (et.color || '#1976d2'),
                        borderColor: et.color || '#1976d2',
                        fontWeight: 'bold',
                        '&:hover': {
                          backgroundColor: activeEventTypeIds.has(et.id)
                            ? (et.color || '#1976d2')
                            : `${et.color || '#1976d2'}20`,
                          transform: 'scale(1.05)',
                        },
                        '&:active': { transform: 'scale(0.95)' },
                      }}
                    />
                  ))}
                </Stack>
                {eventTypes.createAndEditAllowed && (
                  <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddEvent}>
                    Neues Event
                  </Button>
                )}
              </Box>
            )}

            {/* Mobile: nur Add-Button in Titelzeile */}
            {isMobile && eventTypes.createAndEditAllowed && (
              <IconButton
                onClick={handleAddEvent}
                color="primary"
                sx={{ bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' }, borderRadius: 2 }}
                size="small"
              >
                <AddIcon />
              </IconButton>
            )}
          </Box>

          {/* Mobile: horizontal scrollbare Filter-Chips */}
          {isMobile && eventTypes.entries.length > 0 && (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'nowrap',
                overflowX: 'auto',
                gap: 1,
                py: 1,
                mb: 1,
                mx: -1,
                px: 1,
                // Scrollbar ausblenden (aber scrollbar bleiben)
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
                '-ms-overflow-style': 'none',
              }}
            >
              {eventTypes.entries.map(et => (
                <Chip
                  key={et.id}
                  label={et.name}
                  onClick={() => toggleEventType(et.id)}
                  variant={activeEventTypeIds.has(et.id) ? 'filled' : 'outlined'}
                  size="small"
                  sx={{
                    flexShrink: 0,
                    backgroundColor: activeEventTypeIds.has(et.id) ? (et.color || '#1976d2') : 'transparent',
                    color: activeEventTypeIds.has(et.id) ? '#ffffff' : (et.color || '#1976d2'),
                    borderColor: et.color || '#1976d2',
                    fontWeight: 'bold',
                    '&:active': { transform: 'scale(0.95)' },
                  }}
                />
              ))}
            </Box>
          )}
          
          {/* Mobile Navigation — only shown for Day/Agenda view; Month view has its own built-in nav */}
          {isMobile && view !== 'month' && (
            <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <IconButton onClick={navigateBack} size="small">
                <ArrowBackIcon />
              </IconButton>
              
              <Typography variant="h6" component="div" sx={{ textAlign: 'center', flex: 1 }}>
                {moment(date).format(view === 'day' ? 'ddd, D. MMM YYYY' : 'MMMM YYYY')}
              </Typography>
              
              <IconButton onClick={navigateForward} size="small">
                <ArrowForwardIcon />
              </IconButton>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
              <IconButton onClick={navigateToToday} size="small" title="Heute">
                <TodayIcon />
              </IconButton>
              
              <ButtonGroup variant="outlined" size="small">
                {availableViews.map((v) => (
                  <Button
                    key={v}
                    variant={view === v ? 'contained' : 'outlined'}
                    onClick={() => setView(v as any)}
                    size="small"
                  >
                    {getViewLabel(v)}
                  </Button>
                ))}
              </ButtonGroup>
            </Box>
          </Paper>
          )}

          {/* Mobile Month view: compact mini-grid with event list */}
          {isMobile && view === 'month' && (
            <Box sx={{ mb: 1 }}>
              {/* View switcher for mobile month view */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                <ButtonGroup variant="outlined" size="small">
                  {availableViews.map((v) => (
                    <Button
                      key={v}
                      variant={view === v ? 'contained' : 'outlined'}
                      onClick={() => setView(v as any)}
                      size="small"
                    >
                      {getViewLabel(v)}
                    </Button>
                  ))}
                </ButtonGroup>
              </Box>
              <MobileCalendar
                date={date}
                onNavigate={setDate}
                events={filteredEvents}
                onEventClick={handleEventClick}
                onDateClick={(d) => {
                  if (!eventTypes.createAndEditAllowed) return;
                  const clickedDate = moment(d).format('YYYY-MM-DD');
                  setEventFormData({
                    title: '',
                    date: clickedDate,
                    time: '',
                    eventType: '',
                    locationId: '',
                    description: '',
                    permissionType: 'public',
                    taskOffset: 0,
                  });
                  setEditingEventId(null);
                  setEditingEventPermissions(null);
                  setEventModalOpen(true);
                }}
                canCreate={eventTypes.createAndEditAllowed}
              />
            </Box>
          )}
        </Box>
        
        <Box sx={isMobile && view === 'month' ? { display: 'none' } : calendarStyle}>
          <BigCalendar
            localizer={localizer}
            events={filteredEvents}
            startAccessor="start"
            endAccessor="end"
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            eventPropGetter={eventStyleGetter}
            messages={messages}
            formats={formats}
            culture="de-DE"
            style={{ height: '100%' }}
            views={availableViews}
            step={30}
            showMultiDayTimes
            defaultDate={new Date()}
            scrollToTime={(() => { const t = new Date(); t.setMinutes(t.getMinutes() - 30); return t; })()}
            onSelectEvent={handleEventClick}
            onSelectSlot={handleDateClick}
            selectable={true}
            // Custom toolbar for desktop, hidden for mobile
            components={{
              toolbar: isMobile ? (() => null) as any : undefined,
              event: (({ event }: { event: any }) => (
                <span style={{ display: 'block', lineHeight: 1.3 }}>
                  <span style={{
                    fontWeight: 'bold',
                    textDecoration: event.cancelled ? 'line-through' : undefined,
                    opacity: event.cancelled ? 0.7 : 1,
                  }}>
                    {event.cancelled && '❌ '}
                    {event.title}
                  </span>
                  {event.location?.name && (
                    <span style={{
                      display: 'block',
                      fontSize: '0.7em',
                      opacity: 0.85,
                      fontWeight: 'normal',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      📍 {event.location.name}
                    </span>
                  )}
                </span>
              )) as any,
              agenda: {
                date: (({ label }: { label: string }) => (
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    {moment(label).format('dddd, DD.MM.YYYY')}
                  </span>
                )) as any,
                time: (({ event }: { event: any }) => (
                  <span style={{ fontSize: '13px' }}>
                    {(() => {
                      const start = moment(event.start);
                      const end = moment(event.end);
                      const isSameDay = start.format('YYYY-MM-DD') === end.format('YYYY-MM-DD');
                      
                      if (isSameDay) {
                        return `${start.format('HH:mm')} – ${end.format('HH:mm')}`;
                      } else {
                        return `${start.format('HH:mm')} (mehrtägig)`;
                      }
                    })()}
                  </span>
                )) as any,
                event: (({ event }: { event: any }) => (
                  <span style={{ 
                    fontWeight: '500',
                    textDecoration: event.cancelled ? 'line-through' : undefined,
                    opacity: event.cancelled ? 0.6 : 1,
                  }}>
                    {event.cancelled && '❌ '}
                    {event.title}
                    {event.location?.name && (
                      <span style={{ marginLeft: '6px', fontSize: '12px', opacity: 0.8 }}>
                        📍 {event.location.name}
                      </span>
                    )}
                    {event.eventType?.name && (
                      <span style={{ 
                        marginLeft: '8px', 
                        fontSize: '12px', 
                        color: event.eventType?.color || '#666',
                        fontWeight: '600'
                      }}>
                        [{event.eventType?.name}]
                      </span>
                    )}
                  </span>
                )) as any
              } as any
            }}
          />
        </Box>
      </Box>

      {/* Event Details Modal */}
      <EventDetailsModal 
        open={!!selectedEvent} 
        onClose={() => { setSelectedEvent(null); setInitialOpenRides(false); }} 
        event={toEventDetailsCalendarEvent(selectedEvent)}
        onUpdated={refreshEvents}
        onEdit={selectedEvent?.permissions?.canEdit ? () => selectedEvent && handleEditEvent(selectedEvent) : undefined}
        showEdit={selectedEvent?.permissions?.canEdit === true}
        onDelete={selectedEvent?.permissions?.canDelete ? handleDeleteSelectedEvent : undefined}
        onCancelled={() => {
          setSelectedEvent(null);
          refreshEvents();
        }}
        initialOpenRides={initialOpenRides}
      />

      {/* Event Create/Edit Modal */}
      <EventModal
        open={eventModalOpen}
        onClose={() => {
          setEventModalOpen(false);
          setEventFormData({
            title: '',
            date: '',
            time: '',
            eventType: '',
            locationId: '',
            description: '',
            permissionType: 'public',
            taskOffset: 0
          });
        }}
        onSave={handleSaveEvent}
        onDelete={editingEventId && editingEventPermissions?.canDelete ? handleDeleteEvent : undefined}
        showDelete={!!editingEventId && editingEventPermissions?.canDelete === true}
        event={eventFormData as any}
        eventTypes={eventTypesOptions}
        teams={tournamentTeams}
        allTeams={allTeamsOptions}
        gameTypes={gameTypesOptions}
        locations={locationsOptions}
        users={users}
        onChange={handleFormChange}
        loading={eventSaving}
        teamDefaultsMap={teamDefaultsMap}
      />

      {/* Alert Modal */}
      <AlertModal
        open={alertModal.open}
        onClose={() => setAlertModal({ ...alertModal, open: false })}
        title={alertModal.title}
        message={alertModal.message}
        severity={alertModal.severity}
      />

      {/* Confirmation Modal */}
      <DynamicConfirmationModal
        open={confirmModal.open}
        onClose={() => setConfirmModal({ ...confirmModal, open: false })}
        onConfirm={() => {
          confirmModal.onConfirm();
          setConfirmModal({ ...confirmModal, open: false });
        }}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Löschen"
        cancelText="Abbrechen"
        confirmColor="error"
        loading={eventSaving}
      />

      {/* Task / Training Deletion Modal */}
      <TaskDeletionModal
        open={taskDeletionModal.open}
        onClose={() => setTaskDeletionModal({ open: false })}
        title={taskDeletionModal.mode === 'training' ? 'Training löschen' : 'Task löschen'}
        message={
          taskDeletionModal.mode === 'training'
            ? 'Welche Termine möchten Sie löschen?'
            : 'Möchten Sie nur dieses Event oder die gesamte Task-Serie löschen?'
        }
        singleLabel={taskDeletionModal.mode === 'training' ? 'Nur diesen Termin' : 'Nur dieses Event'}
        fromHereLabel={taskDeletionModal.mode === 'training' ? 'Diesen und alle folgenden' : undefined}
        seriesLabel="Gesamte Serie"
        onDeleteSingle={() => {
          const { eventId } = taskDeletionModal;
          setTaskDeletionModal({ open: false });
          performDeleteEvent('single', eventId);
        }}
        onDeleteFromHere={
          taskDeletionModal.mode === 'training'
            ? () => {
                const { eventId } = taskDeletionModal;
                setTaskDeletionModal({ open: false });
                performDeleteEvent('from_here', eventId);
              }
            : undefined
        }
        onDeleteSeries={() => {
          const { eventId } = taskDeletionModal;
          setTaskDeletionModal({ open: false });
          performDeleteEvent('series', eventId);
        }}
        loading={eventSaving}
      />
    </>
  );
}

type CalendarExportProps = {
  setCalendarFabHandler?: (handler: (() => void) | null) => void;
};

export default function Calendar({ setCalendarFabHandler }: CalendarExportProps) {
  return (
    <CalendarErrorBoundary>
      <CalendarInner setCalendarFabHandler={setCalendarFabHandler} />
    </CalendarErrorBoundary>
  );
}
