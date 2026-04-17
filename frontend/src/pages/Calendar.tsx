import React, { useState, useMemo } from 'react';
import { Calendar as BigCalendar, momentLocalizer, Views } from 'react-big-calendar';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import moment from 'moment';
import 'moment/locale/de';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import CalendarFab from '../components/CalendarFab';
import { useFabStack } from '../components/FabStackProvider';
import { MobileCalendar } from '../components/MobileCalendar';
import { EventDetailsModal } from '../modals/EventDetailsModal';
import { EventModal } from '../modals/EventModal';
import { DynamicConfirmationModal } from '../modals/DynamicConfirmationModal';
import { TaskDeletionModal } from '../modals/TaskDeletionModal';
import { AlertModal } from '../modals/AlertModal';
import { toEventDetailsCalendarEvent } from '../hooks/useCalendarEventDetails';
import { useCalendarData } from '../hooks/useCalendarData';
import { CalendarErrorBoundary } from './calendar/CalendarErrorBoundary';
import { CalendarHeader } from './calendar/CalendarHeader';
import { CalendarMobileNav } from './calendar/CalendarMobileNav';
import { useCalendarModals } from './calendar/useCalendarModals';
import { useCalendarEventState } from './calendar/useCalendarEventState';
import { useCalendarEventSave } from './calendar/useCalendarEventSave';
import { messages, formats } from './calendar/calendarConfig';

moment.updateLocale('de', { week: { dow: 1 } });

const localizer = momentLocalizer(moment);

type CalendarExportProps = {
  setCalendarFabHandler?: (handler: (() => void) | null) => void;
};

function CalendarInner() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [view, setView] = useState(isMobile ? Views.DAY : Views.MONTH);
  const [date, setDate] = useState(new Date());

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

  const fabStack = useFabStack();
  const modals = useCalendarModals();
  const eventState = useCalendarEventState({ eventTypes, gameTypes, teams, events });

  const eventTypesOptions = useMemo(
    () => eventTypes.entries.map(et => ({ value: et.id.toString(), label: et.name })),
    [eventTypes.entries],
  );
  const tournamentTeams = useMemo(
    () => teams.map(t => ({ value: t.id.toString(), label: t.name })),
    [teams],
  );
  const allTeamsOptions = useMemo(
    () => allTeams.map(t => ({ value: t.id.toString(), label: t.name })),
    [allTeams],
  );
  const teamDefaultsMap = useMemo(
    () =>
      Object.fromEntries(
        allTeams.map(t => [
          t.id.toString(),
          {
            defaultHalfDuration: t.defaultHalfDuration ?? null,
            defaultHalftimeBreakDuration: t.defaultHalftimeBreakDuration ?? null,
          },
        ]),
      ),
    [allTeams],
  );
  const gameTypesOptions = useMemo(
    () => gameTypes.entries.map(gt => ({ value: gt.id.toString(), label: gt.name })),
    [gameTypes.entries],
  );
  const locationsOptions = useMemo(
    () => locations.map(l => ({ value: l.id.toString(), label: l.name })),
    [locations],
  );

  const { eventSaving, handleSaveEvent, handleDeleteEvent, handleDeleteSelectedEvent, performDeleteEvent } =
    useCalendarEventSave({
      eventFormData: eventState.eventFormData,
      editingEventId: eventState.editingEventId,
      selectedEvent: eventState.selectedEvent,
      editingEventPermissions: eventState.editingEventPermissions,
      eventTypesOptions,
      gameTypesOptions,
      tournamentTeams,
      refreshEvents,
      doCloseEventModal: eventState.doCloseEventModal,
      setSelectedEvent: eventState.setSelectedEvent,
      setTaskDeletionModal: modals.setTaskDeletionModal,
      showAlert: modals.showAlert,
      showConfirm: modals.showConfirm,
    });

  const availableViews = isMobile
    ? ['month', 'day', 'agenda']
    : ['month', 'week', 'day', 'agenda'];

  const navigateToToday = () => setDate(new Date());
  const navigateBack = () => {
    const d = moment(date);
    if (view === Views.MONTH || view === 'month') d.subtract(1, 'month');
    else if (view === Views.WEEK || view === 'week') d.subtract(1, 'week');
    else d.subtract(1, 'day');
    setDate(d.toDate());
  };
  const navigateForward = () => {
    const d = moment(date);
    if (view === Views.MONTH || view === 'month') d.add(1, 'month');
    else if (view === Views.WEEK || view === 'week') d.add(1, 'week');
    else d.add(1, 'day');
    setDate(d.toDate());
  };
  const getViewLabel = (v: string): string => {
    const map: Record<string, string> = { month: 'Monat', week: 'Woche', day: 'Tag', agenda: 'Liste' };
    return map[v] ?? v;
  };

  // Register/unregister FAB when create permission changes
  React.useEffect(() => {
    if (!eventTypes.createAndEditAllowed) {
      fabStack?.removeFab('calendar-fab');
      return;
    }
    fabStack?.addFab(<CalendarFab onClick={eventState.handleAddEvent} />, 'calendar-fab');
    return () => { fabStack?.removeFab('calendar-fab'); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventTypes.createAndEditAllowed]);

  const eventStyleGetter = (event: any) => {
    const backgroundColor = event.isExternal
      ? event.externalCalendarColor || '#607d8b'
      : event.eventType?.color || theme.palette.primary.main;
    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: event.cancelled ? 0.45 : event.isExternal ? 0.75 : 0.9,
        color: 'white',
        border: event.cancelled
          ? '2px dashed rgba(255,255,255,0.5)'
          : event.isExternal
          ? '1px dashed rgba(255,255,255,0.6)'
          : '0px',
        display: 'block',
        fontWeight: 'bold',
        fontSize: isMobile ? '0.75rem' : '0.875rem',
        cursor: event.isExternal ? 'default' : 'pointer',
      },
    };
  };

  const calendarStyle = useMemo(
    () => ({
      height: isMobile ? 'calc(100dvh - 200px)' : 'calc(100dvh - 200px)',
      minHeight: isMobile ? '400px' : '500px',
      backgroundColor: theme.palette.background.paper,
      '& .rbc-calendar': {
        fontFamily: theme.typography.fontFamily,
        fontSize: isMobile ? '0.75rem' : '0.875rem',
      },
      '& .rbc-header': {
        backgroundColor:
          theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[100],
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
        backgroundColor:
          theme.palette.mode === 'dark'
            ? theme.palette.primary.dark + '20'
            : theme.palette.primary.light + '20',
      },
      '& .rbc-off-range-bg': {
        backgroundColor:
          theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50],
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
        '& .rbc-btn-group': { display: isMobile ? 'none' : 'flex' },
        '& button': {
          color: theme.palette.text.primary,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          fontSize: isMobile ? '0.75rem' : '0.875rem',
          padding: isMobile ? theme.spacing(0.5) : theme.spacing(1),
          '&:hover': { backgroundColor: theme.palette.action.hover },
          '&.rbc-active': {
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
          },
        },
        '& .rbc-toolbar-label': {
          color: theme.palette.text.primary,
          fontWeight: theme.typography.fontWeightMedium,
          fontSize: isMobile ? '0.9rem' : '1rem',
          textAlign: 'center',
          margin: isMobile ? theme.spacing(1, 0) : 0,
        },
      },
      ...(isMobile && {
        '& .rbc-date-cell': { padding: '2px', fontSize: '0.7rem' },
        '& .rbc-header': { minHeight: '32px' },
        '& .rbc-month-row': { minHeight: '60px' },
        '& .rbc-agenda-view': {
          fontSize: '0.8rem',
          '& table': { fontSize: '0.8rem' },
          '& .rbc-agenda-time-cell': { width: '80px' },
        },
      }),
    }),
    [theme, isMobile],
  );

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><Typography>Lade Termine...</Typography></Box>;
  if (error) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><Typography color="error">{error}</Typography></Box>;

  return (
    <>
      <Box sx={{ width: '100%', height: '100%', p: 3 }}>
        <Box sx={{ p: { xs: 1, sm: 2 } }}>
          <CalendarHeader
            isMobile={isMobile}
            eventTypeEntries={eventTypes.entries}
            createAndEditAllowed={eventTypes.createAndEditAllowed}
            activeEventTypeIds={activeEventTypeIds}
            onToggleEventType={toggleEventType}
            onAddEvent={eventState.handleAddEvent}
          />

          {/* Mobile: horizontally scrollable filter chips */}
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
                    backgroundColor: activeEventTypeIds.has(et.id) ? et.color || '#1976d2' : 'transparent',
                    color: activeEventTypeIds.has(et.id) ? '#ffffff' : et.color || '#1976d2',
                    borderColor: et.color || '#1976d2',
                    fontWeight: 'bold',
                    '&:active': { transform: 'scale(0.95)' },
                  }}
                />
              ))}
            </Box>
          )}

          {/* Mobile navigation — only for Day/Agenda; Month has its own built-in nav */}
          {isMobile && view !== 'month' && (
            <CalendarMobileNav
              view={view}
              date={date}
              availableViews={availableViews}
              onNavigateBack={navigateBack}
              onNavigateForward={navigateForward}
              onNavigateToToday={navigateToToday}
              onViewChange={v => setView(v as any)}
              getViewLabel={getViewLabel}
            />
          )}

          {/* Mobile Month view: compact mini-grid with event list */}
          {isMobile && view === 'month' && (
            <Box sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                <ButtonGroup variant="outlined" size="small">
                  {availableViews.map(v => (
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
                onEventClick={eventState.handleEventClick}
                onDateClick={(d) => eventState.handleDateClick({ start: d })}
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
            onSelectEvent={eventState.handleEventClick}
            onSelectSlot={eventState.handleDateClick}
            selectable={true}
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
                      return isSameDay
                        ? `${start.format('HH:mm')} – ${end.format('HH:mm')}`
                        : `${start.format('HH:mm')} (mehrtägig)`;
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
                        fontWeight: '600',
                      }}>
                        [{event.eventType?.name}]
                      </span>
                    )}
                  </span>
                )) as any,
              } as any,
            }}
          />
        </Box>
      </Box>

      <EventDetailsModal
        open={!!eventState.selectedEvent}
        onClose={() => { eventState.setSelectedEvent(null); eventState.setInitialOpenRides(false); }}
        event={toEventDetailsCalendarEvent(eventState.selectedEvent)}
        onUpdated={refreshEvents}
        onEdit={
          eventState.selectedEvent?.permissions?.canEdit
            ? () => eventState.selectedEvent && eventState.handleEditEvent(eventState.selectedEvent)
            : undefined
        }
        showEdit={eventState.selectedEvent?.permissions?.canEdit === true}
        onDelete={
          eventState.selectedEvent?.permissions?.canDelete ? handleDeleteSelectedEvent : undefined
        }
        onCancelled={() => { eventState.setSelectedEvent(null); refreshEvents(); }}
        initialOpenRides={eventState.initialOpenRides}
      />

      <EventModal
        open={eventState.eventModalOpen}
        onClose={eventState.handleEventModalCloseRequest}
        onSave={handleSaveEvent}
        onDelete={
          eventState.editingEventId && eventState.editingEventPermissions?.canDelete
            ? handleDeleteEvent
            : undefined
        }
        showDelete={
          !!eventState.editingEventId &&
          eventState.editingEventPermissions?.canDelete === true
        }
        event={eventState.eventFormData as any}
        eventTypes={eventTypesOptions}
        teams={tournamentTeams}
        allTeams={allTeamsOptions}
        gameTypes={gameTypesOptions}
        locations={locationsOptions}
        users={users}
        onChange={eventState.handleFormChange}
        loading={eventSaving}
        teamDefaultsMap={teamDefaultsMap}
      />

      <AlertModal
        open={modals.alertModal.open}
        onClose={() => modals.setAlertModal({ ...modals.alertModal, open: false })}
        title={modals.alertModal.title}
        message={modals.alertModal.message}
        severity={modals.alertModal.severity}
      />

      <DynamicConfirmationModal
        open={eventState.discardDraftOpen}
        onClose={() => eventState.setDiscardDraftOpen(false)}
        onConfirm={() => { eventState.setDiscardDraftOpen(false); eventState.doCloseEventModal(); }}
        title="Änderungen verwerfen?"
        message="Du hast ungespeicherte Änderungen. Möchtest du den Wizard wirklich schließen und alle Eingaben verlieren?"
        confirmText="Verwerfen"
        cancelText="Weiter bearbeiten"
        confirmColor="error"
      />

      <DynamicConfirmationModal
        open={modals.confirmModal.open}
        onClose={() => modals.setConfirmModal({ ...modals.confirmModal, open: false })}
        onConfirm={() => {
          modals.confirmModal.onConfirm();
          modals.setConfirmModal({ ...modals.confirmModal, open: false });
        }}
        title={modals.confirmModal.title}
        message={modals.confirmModal.message}
        confirmText="Löschen"
        cancelText="Abbrechen"
        confirmColor="error"
        loading={eventSaving}
      />

      <TaskDeletionModal
        open={modals.taskDeletionModal.open}
        onClose={() => modals.setTaskDeletionModal({ open: false })}
        title={modals.taskDeletionModal.mode === 'training' ? 'Training löschen' : 'Task löschen'}
        message={
          modals.taskDeletionModal.mode === 'training'
            ? 'Welche Termine möchten Sie löschen?'
            : 'Möchten Sie nur dieses Event oder die gesamte Task-Serie löschen?'
        }
        singleLabel={
          modals.taskDeletionModal.mode === 'training' ? 'Nur diesen Termin' : 'Nur dieses Event'
        }
        fromHereLabel={
          modals.taskDeletionModal.mode === 'training' ? 'Diesen und alle folgenden' : undefined
        }
        seriesLabel="Gesamte Serie"
        onDeleteSingle={() => {
          const { eventId } = modals.taskDeletionModal;
          modals.setTaskDeletionModal({ open: false });
          performDeleteEvent('single', eventId);
        }}
        onDeleteFromHere={
          modals.taskDeletionModal.mode === 'training'
            ? () => {
                const { eventId } = modals.taskDeletionModal;
                modals.setTaskDeletionModal({ open: false });
                performDeleteEvent('from_here', eventId);
              }
            : undefined
        }
        onDeleteSeries={() => {
          const { eventId } = modals.taskDeletionModal;
          modals.setTaskDeletionModal({ open: false });
          performDeleteEvent('series', eventId);
        }}
        loading={eventSaving}
      />
    </>
  );
}

export default function Calendar({ setCalendarFabHandler: _setCalendarFabHandler }: CalendarExportProps) {
  return (
    <CalendarErrorBoundary>
      <CalendarInner />
    </CalendarErrorBoundary>
  );
}
