/**
 * MobileCalendar – a mobile-first calendar view.
 *
 * Replaces react-big-calendar's month view on small screens.
 * Shows a compact month mini-grid (colored dots per event) and,
 * below it, a scrollable event list for the selected day.
 */
import React, { useMemo, useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import TodayIcon from '@mui/icons-material/Today';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import dayjs from '../utils/dayjsSetup';
import { useTheme, alpha } from '@mui/material/styles';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MobileCalendarEvent {
  id: number;
  title: string;
  start: Date | string;
  end: Date | string;
  eventType?: { id?: number; name?: string; color?: string };
  cancelled?: boolean;
  location?: { name?: string };
}

interface MobileCalendarProps {
  /** Controlled month displayed (first day of month is used) */
  date: Date;
  /** Navigate to a new date — called with first day of the target month */
  onNavigate: (date: Date) => void;
  /** All events that may fall in the current month range */
  events: MobileCalendarEvent[];
  /** Called when the user taps an event */
  onEventClick: (event: MobileCalendarEvent) => void;
  /** Called when user taps a day (for creating events) */
  onDateClick?: (date: Date) => void;
  /** Whether new-event creation is allowed (shows + hint on day tap) */
  canCreate?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTimeRange(start: Date, end: Date): string {
  const startStr = dayjs(start).format('HH:mm');
  const endStr = dayjs(end).format('HH:mm');
  const sameDay =
    dayjs(start).format('YYYY-MM-DD') === dayjs(end).format('YYYY-MM-DD');
  if (!sameDay) return `${startStr} (mehrtägig)`;
  if (startStr === '00:00' && endStr === '23:59') return 'Ganztägig';
  return `${startStr} – ${endStr}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

const MAX_DOTS = 4; // dots shown per day before showing "+N"

export const MobileCalendar: React.FC<MobileCalendarProps> = ({
  date,
  onNavigate,
  events,
  onEventClick,
  onDateClick,
  canCreate = false,
}) => {
  const theme = useTheme();
  const today = useMemo(() => new Date(), []);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Month grid construction ───────────────────────────────────────────────
  const monthStart = useMemo(
    () => dayjs(date).startOf('month').toDate(),
    [date],
  );

  // Build the 6×7 (or 5×7) calendar grid
  const weeks = useMemo(() => {
    // Start from Monday before/on the first day of the month
    const gridStart = dayjs(monthStart).startOf('isoWeek').toDate();
    const grid: Date[][] = [];
    let cursor = new Date(gridStart);
    // Always render 6 weeks so the grid height is stable
    for (let w = 0; w < 6; w++) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d++) {
        week.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      grid.push(week);
    }
    return grid;
  }, [monthStart]);

  // Map YYYY-MM-DD → events[] for fast lookup
  const eventsByDay = useMemo(() => {
    const map = new Map<string, MobileCalendarEvent[]>();
    events.forEach(ev => {
      const evStart = new Date(ev.start);
      const evEnd = new Date(ev.end);
      // Multi-day events: add to each day they span (within current month ± grid)
      const cursor = new Date(evStart);
      cursor.setHours(0, 0, 0, 0);
      const endDay = new Date(evEnd);
      endDay.setHours(0, 0, 0, 0);
      while (cursor <= endDay) {
        const key = dayjs(cursor).format('YYYY-MM-DD');
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(ev);
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return map;
  }, [events]);

  // Default selected day: today if in current month, else 1st
  const defaultDay = useMemo(() => {
    const m = dayjs(date);
    if (
      today.getFullYear() === m.year() &&
      today.getMonth() === m.month()
    ) {
      return today;
    }
    return monthStart;
  }, [date, today, monthStart]);

  const [selectedDay, setSelectedDay] = useState<Date>(defaultDay);

  // Update selectedDay when month changes
  useEffect(() => {
    setSelectedDay(defaultDay);
  }, [defaultDay]);

  // Events for the selected day, sorted by start time
  const selectedDayEvents = useMemo(() => {
    const key = dayjs(selectedDay).format('YYYY-MM-DD');
    return (eventsByDay.get(key) ?? []).slice().sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    );
  }, [selectedDay, eventsByDay]);

  // Scroll to list when day with events is selected
  useEffect(() => {
    if (selectedDayEvents.length > 0 && listRef.current) {
      setTimeout(() => {
        listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }, [selectedDayEvents.length]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goBack = () =>
    onNavigate(dayjs(date).subtract(1, 'month').startOf('month').toDate());
  const goForward = () =>
    onNavigate(dayjs(date).add(1, 'month').startOf('month').toDate());
  const goToday = () => {
    onNavigate(dayjs().startOf('month').toDate());
    setSelectedDay(today);
  };

  // ── Colors ────────────────────────────────────────────────────────────────
  const isCurrentMonth = (d: Date) =>
    d.getMonth() === monthStart.getMonth() &&
    d.getFullYear() === monthStart.getFullYear();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* ── Month navigation header ── */}
      <Paper
        elevation={1}
        sx={{
          px: 2,
          pt: 1.5,
          pb: 0.5,
          borderRadius: 2,
          mb: 0.5,
        }}
      >
        {/* Title + arrows */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <IconButton onClick={goBack} size="small">
            <ArrowBackIcon fontSize="small" />
          </IconButton>

          <Typography variant="h6" fontWeight={700}>
            {dayjs(date).format('MMMM YYYY')}
          </Typography>

          <IconButton onClick={goForward} size="small">
            <ArrowForwardIcon fontSize="small" />
          </IconButton>
        </Stack>

        {/* Today button + view row (rendered by Calendar.tsx but hidden here — kept minimal) */}
        <Stack direction="row" spacing={1} justifyContent="center" mb={1}>
          <IconButton size="small" onClick={goToday} title="Heute">
            <TodayIcon fontSize="small" />
          </IconButton>
        </Stack>

        {/* Weekday header row */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            mb: 0.5,
          }}
        >
          {WEEKDAYS.map(d => (
            <Typography
              key={d}
              variant="caption"
              align="center"
              sx={{
                fontWeight: 700,
                color: d === 'Sa' || d === 'So' ? 'text.disabled' : 'text.secondary',
                fontSize: '0.7rem',
                py: 0.25,
              }}
            >
              {d}
            </Typography>
          ))}
        </Box>

        {/* Day grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
          {weeks.flat().map((day, idx) => {
            const key = moment(day).format('YYYY-MM-DD');
            const dayEvents = eventsByDay.get(key) ?? [];
            const isToday = isSameDay(day, today);
            const isSelected = isSameDay(day, selectedDay);
            const inMonth = isCurrentMonth(day);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;

            // Collect unique colors for dots
            const colors: string[] = [];
            dayEvents.forEach(ev => {
              const c = ev.eventType?.color;
              if (c && !colors.includes(c)) colors.push(c);
            });
            const dotColors = colors.slice(0, MAX_DOTS);
            const extraCount =
              dayEvents.length > MAX_DOTS ? dayEvents.length - MAX_DOTS : 0;

            return (
              <Box
                key={idx}
                onClick={() => {
                  setSelectedDay(day);
                  if (dayEvents.length === 0 && canCreate) {
                    onDateClick?.(day);
                  }
                }}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  py: 0.5,
                  cursor: 'pointer',
                  borderRadius: 1.5,
                  transition: 'background-color 0.15s',
                  bgcolor: isSelected
                    ? alpha(theme.palette.primary.main, 0.12)
                    : 'transparent',
                  '&:active': { bgcolor: alpha(theme.palette.primary.main, 0.2) },
                }}
              >
                {/* Day number */}
                <Box
                  sx={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: isToday ? 'primary.main' : 'transparent',
                    border: isSelected && !isToday ? `2px solid ${theme.palette.primary.main}` : 'none',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: isToday || isSelected ? 700 : 400,
                      fontSize: '0.82rem',
                      color: isToday
                        ? '#fff'
                        : !inMonth
                        ? 'text.disabled'
                        : isWeekend
                        ? 'text.secondary'
                        : 'text.primary',
                      lineHeight: 1,
                    }}
                  >
                    {day.getDate()}
                  </Typography>
                </Box>

                {/* Event dots */}
                <Stack direction="row" spacing={0.25} mt={0.35} alignItems="center" sx={{ minHeight: 8 }}>
                  {dotColors.map((color, i) => (
                    <Box
                      key={i}
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: inMonth ? color : alpha(color, 0.35),
                      }}
                    />
                  ))}
                  {extraCount > 0 && (
                    <Typography
                      variant="caption"
                      sx={{ fontSize: '0.6rem', lineHeight: 1, color: 'text.secondary' }}
                    >
                      +{extraCount}
                    </Typography>
                  )}
                </Stack>
              </Box>
            );
          })}
        </Box>
      </Paper>

      {/* ── Selected day event list ── */}
      <Box ref={listRef}>
        {/* Day header */}
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ px: 1, pt: 1.5, pb: 0.75 }}
        >
          <CalendarTodayIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="subtitle2" fontWeight={700}>
            {moment(selectedDay).format('dddd, D. MMMM')}
          </Typography>
          {isSameDay(selectedDay, today) && (
            <Chip
              label="Heute"
              size="small"
              color="primary"
              sx={{ height: 20, fontSize: '0.68rem' }}
            />
          )}
        </Stack>

        <Divider />

        {selectedDayEvents.length === 0 ? (
          <Stack
            alignItems="center"
            spacing={1}
            sx={{ py: 4 }}
            onClick={() => canCreate && onDateClick?.(selectedDay)}
          >
            <EventBusyIcon sx={{ fontSize: 36, color: 'text.disabled' }} />
            <Typography variant="body2" color="text.secondary">
              Keine Termine
            </Typography>
            {canCreate && (
              <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
                Tippen zum Erstellen
              </Typography>
            )}
          </Stack>
        ) : (
          <Stack spacing={0} divider={<Divider />}>
            {selectedDayEvents.map(ev => {
              const startDate = new Date(ev.start);
              const endDate = new Date(ev.end);
              const timeStr = formatTimeRange(startDate, endDate);
              const color = ev.eventType?.color ?? theme.palette.primary.main;

              return (
                <Box
                  key={ev.id}
                  onClick={() => onEventClick(ev)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 1.5,
                    py: 1.25,
                    cursor: 'pointer',
                    transition: 'background-color 0.15s',
                    '&:active': {
                      bgcolor: alpha(theme.palette.action.selected, 0.85),
                    },
                    opacity: ev.cancelled ? 0.6 : 1,
                  }}
                >
                  {/* Color bar */}
                  <Box
                    sx={{
                      width: 4,
                      alignSelf: 'stretch',
                      borderRadius: 2,
                      bgcolor: color,
                      flexShrink: 0,
                      minHeight: 36,
                    }}
                  />

                  {/* Content */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{
                        textDecoration: ev.cancelled ? 'line-through' : 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ev.cancelled && '❌ '}
                      {ev.title}
                    </Typography>

                    <Stack direction="row" spacing={0.75} alignItems="center" mt={0.25}>
                      <AccessTimeIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {timeStr}
                      </Typography>
                      {ev.location?.name && (
                        <>
                          <Typography variant="caption" color="text.disabled">·</Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 120,
                            }}
                          >
                            {ev.location.name}
                          </Typography>
                        </>
                      )}
                    </Stack>
                  </Box>

                  {/* Event type chip */}
                  {ev.eventType?.name && (
                    <Chip
                      label={ev.eventType.name}
                      size="small"
                      sx={{
                        bgcolor: color,
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.65rem',
                        height: 20,
                        flexShrink: 0,
                        textTransform: 'uppercase',
                        letterSpacing: 0.3,
                      }}
                    />
                  )}
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>
    </Box>
  );
};
