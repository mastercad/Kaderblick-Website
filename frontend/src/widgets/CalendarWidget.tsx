import React, { useEffect, useMemo, useState } from 'react';
import { EventDetailsModal } from '../modals/EventDetailsModal';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { Calendar as BigCalendar, dayjsLocalizer, Views } from 'react-big-calendar';
import dayjs from '../utils/dayjsSetup';
import 'react-big-calendar/lib/css/react-big-calendar.css';

dayjs.locale('de');
const localizer = dayjsLocalizer(dayjs);

export type CalendarViewMode = 'day' | 'week' | 'month';

type CalendarEvent = {
  id: number;
  title: string;
  start: string;
  end: string;
  description?: string;
  type?: { name?: string; color?: string };
  location?: { name?: string };
};

export interface CalendarWidgetConfig {
  viewMode?: CalendarViewMode;
  offset?: number; // relative offset (days/weeks/months depending on viewMode)
}

/** Compact date header that keeps the day number small to leave room for events */
const CompactDateHeader: React.FC<{ label: string; date: Date }> = ({ label, date }) => {
  const isToday = moment(date).isSame(moment(), 'day');
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'flex-end',
        px: 0.5,
        py: 0,
        lineHeight: 1,
      }}
    >
      <Box
        component="span"
        sx={{
          fontSize: '0.68rem',
          fontWeight: isToday ? 700 : 400,
          color: isToday ? 'primary.main' : 'text.secondary',
          backgroundColor: isToday ? 'action.selected' : 'transparent',
          borderRadius: '50%',
          width: 20,
          height: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {label}
      </Box>
    </Box>
  );
};

/** CSS overrides to make events visible in compact dashboard calendar */
const calendarOverrideSx = {
  width: '100%',
  // General compact sizing
  '& .rbc-month-view': {
    border: 'none',
  },
  '& .rbc-header': {
    fontSize: '0.7rem',
    padding: '2px 4px',
    fontWeight: 600,
    borderBottom: '1px solid',
    borderColor: 'divider',
  },
  // Reduce date cell padding, let events take the space
  '& .rbc-date-cell': {
    padding: '0',
    textAlign: 'right' as const,
    fontSize: '0.68rem',
  },
  '& .rbc-date-cell > a': {
    fontSize: '0.68rem',
  },
  // Row content: give events more vertical room
  '& .rbc-month-row': {
    minHeight: 48,
    overflow: 'visible',
  },
  '& .rbc-row-content': {
    zIndex: 1,
  },
  // Event styling: visible, taller, readable
  '& .rbc-event': {
    padding: '1px 4px',
    fontSize: '0.7rem',
    lineHeight: 1.3,
    borderRadius: '3px',
    minHeight: 16,
    marginBottom: '1px',
  },
  '& .rbc-event-content': {
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  // "show more" link styling
  '& .rbc-show-more': {
    fontSize: '0.65rem',
    fontWeight: 600,
    color: 'primary.main',
    marginTop: 0,
  },
  // Today highlight
  '& .rbc-today': {
    backgroundColor: 'action.hover',
  },
  // Toolbar compact
  '& .rbc-toolbar': {
    marginBottom: '4px',
    flexWrap: 'wrap' as const,
    gap: '4px',
    fontSize: '0.8rem',
  },
  '& .rbc-toolbar button': {
    fontSize: '0.75rem',
    padding: '2px 8px',
  },
  '& .rbc-toolbar .rbc-toolbar-label': {
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  // Week/Day view: tighter time slots
  '& .rbc-time-view': {
    border: 'none',
  },
  '& .rbc-time-slot': {
    minHeight: 20,
  },
  '& .rbc-time-header-content': {
    fontSize: '0.75rem',
  },
  '& .rbc-label': {
    fontSize: '0.7rem',
    padding: '0 4px',
  },
  '& .rbc-day-slot .rbc-event': {
    fontSize: '0.72rem',
    borderRadius: '3px',
  },
  // Day view: event list style
  '& .rbc-agenda-view': {
    fontSize: '0.8rem',
  },
  '& .rbc-agenda-table td, & .rbc-agenda-table th': {
    fontSize: '0.78rem',
    padding: '4px 8px',
  },
};

/** Compute the initial calendar date based on viewMode and offset */
function computeInitialDate(viewMode: CalendarViewMode, offset: number): Date {
  const base = moment();
  switch (viewMode) {
    case 'day':
      return base.add(offset, 'days').toDate();
    case 'week':
      return base.add(offset, 'weeks').toDate();
    case 'month':
    default:
      return base.add(offset, 'months').toDate();
  }
}

function viewModeToRbcView(viewMode: CalendarViewMode) {
  switch (viewMode) {
    case 'day': return Views.DAY;
    case 'week': return Views.WEEK;
    case 'month':
    default: return Views.MONTH;
  }
}

/** Compute calendar height based on view mode for best readability */
function computeCalendarHeight(viewMode: CalendarViewMode): number {
  switch (viewMode) {
    case 'day': return 450;
    case 'week': return 420;
    case 'month':
    default: return 380;
  }
}

export const CalendarWidget: React.FC<{ config?: CalendarWidgetConfig; widgetId?: string }> = ({ config, widgetId }) => {
  const { getRefreshTrigger } = useWidgetRefresh();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const viewMode: CalendarViewMode = config?.viewMode || 'month';
  const offset: number = config?.offset ?? 0;

  const initialDate = useMemo(() => computeInitialDate(viewMode, offset), [viewMode, offset]);
  const initialView = useMemo(() => viewModeToRbcView(viewMode), [viewMode]);

  const [view, setView] = useState(initialView);
  const [date, setDate] = useState(initialDate);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Reset view/date when config changes
  useEffect(() => {
    setView(viewModeToRbcView(viewMode));
    setDate(computeInitialDate(viewMode, offset));
  }, [viewMode, offset]);

  const refreshTrigger = widgetId ? getRefreshTrigger(widgetId) : 0;

  useEffect(() => {
    // Zeitraum je nach View bestimmen
    let unitOfTime: moment.unitOfTime.StartOf;
    if (view === Views.MONTH || view === 'month') unitOfTime = 'month';
    else if (view === Views.WEEK || view === 'week') unitOfTime = 'week';
    else if (view === Views.DAY || view === 'day') unitOfTime = 'day';
    else unitOfTime = 'month';

    const start = moment(date).startOf(unitOfTime).toISOString();
    const end = moment(date).endOf(unitOfTime).toISOString();
    setLoading(true);
    setError(null);
    apiJson(`/api/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
      .then((data) => {
        setEvents(data.map((ev: any) => ({
          ...ev,
          start: new Date(ev.start),
          end: new Date(ev.end)
        })));
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [date, view, refreshTrigger]);

  const eventStyleGetter = (event: CalendarEvent) => {
    const backgroundColor = event.type?.color || '#1976d2';
    return {
      style: {
        backgroundColor,
        borderRadius: '3px',
        opacity: 0.9,
        color: 'white',
        border: 'none',
        display: 'block',
        fontSize: '0.72rem',
        lineHeight: 1.3,
        padding: '1px 4px',
      }
    };
  };

  const calendarComponents = useMemo(() => ({
    month: {
      dateHeader: CompactDateHeader,
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any, []);

  // Compute scrollToTime: jump to the nearest current/upcoming event or current time
  const scrollToTime = useMemo(() => {
    const now = new Date();
    if (view !== Views.DAY && view !== 'day' && view !== Views.WEEK && view !== 'week') {
      return now;
    }
    if (events.length === 0) {
      // No events – scroll to current time (minus 30 min buffer so it's visible)
      const t = new Date(now);
      t.setMinutes(Math.max(0, t.getMinutes() - 30));
      return t;
    }

    // Find the earliest event that hasn't ended yet
    const upcoming = events
      .filter(ev => new Date(ev.end) >= now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    if (upcoming.length > 0) {
      // Scroll 30 min before that event starts so it's clearly visible
      const target = new Date(upcoming[0].start);
      target.setMinutes(Math.max(0, target.getMinutes() - 30));
      return target;
    }

    // All events have passed – scroll to the last event
    const sorted = [...events].sort(
      (a, b) => new Date(b.start).getTime() - new Date(a.start).getTime()
    );
    const target = new Date(sorted[0].start);
    target.setMinutes(Math.max(0, target.getMinutes() - 30));
    return target;
  }, [events, view]);

  // Build subtitle showing the configured mode
  const modeLabel = viewMode === 'day'
    ? (offset === 0 ? 'Heute' : offset > 0 ? `+${offset} Tag${offset !== 1 ? 'e' : ''}` : `${offset} Tag${Math.abs(offset) !== 1 ? 'e' : ''}`)
    : viewMode === 'week'
      ? (offset === 0 ? 'Diese Woche' : offset > 0 ? `+${offset} Woche${offset !== 1 ? 'n' : ''}` : `${offset} Woche${Math.abs(offset) !== 1 ? 'n' : ''}`)
      : (offset === 0 ? 'Dieser Monat' : offset > 0 ? `+${offset} Monat${offset !== 1 ? 'e' : ''}` : `${offset} Monat${Math.abs(offset) !== 1 ? 'e' : ''}`);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} /></Box>;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <>
      <Box sx={calendarOverrideSx}>
        {offset !== 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
            <Chip label={modeLabel} size="small" variant="outlined" color="primary" sx={{ fontSize: '0.7rem' }} />
          </Box>
        )}
        <BigCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          titleAccessor="title"
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          eventPropGetter={eventStyleGetter}
          components={calendarComponents}
          messages={{
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
            noEventsInRange: 'Keine Termine in diesem Zeitraum.',
            showMore: (total: number) => `+ ${total} weitere`
          }}
          culture="de"
          style={{ height: computeCalendarHeight(viewMode) }}
          views={['month', 'week', 'day', 'agenda']}
          step={30}
          showMultiDayTimes
          popup
          scrollToTime={scrollToTime}
          onSelectEvent={ev => setSelectedEvent(ev)}
        />
      </Box>
      <EventDetailsModal open={!!selectedEvent} onClose={() => setSelectedEvent(null)} event={selectedEvent} />
    </>
  );
};
