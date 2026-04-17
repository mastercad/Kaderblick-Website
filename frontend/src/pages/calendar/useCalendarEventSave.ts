import { useState } from 'react';
import { apiRequest, getApiErrorMessage } from '../../utils/api';
import { getEventTypeFlags } from '../../hooks/useEventTypeFlags';
import { buildCalendarEventPayload } from '../../utils/buildCalendarEventPayload';
import { CalendarEvent, EventFormData } from '../../types/calendar';
import { TaskDeletionModalState } from './useCalendarModals';

type AlertSeverity = 'error' | 'warning' | 'info' | 'success';

interface SaveOptions {
  eventFormData: EventFormData;
  editingEventId: number | null;
  selectedEvent: CalendarEvent | null;
  editingEventPermissions: { canEdit?: boolean; canDelete?: boolean } | null;
  eventTypesOptions: Array<{ value: string; label: string }>;
  gameTypesOptions: Array<{ value: string; label: string }>;
  tournamentTeams: Array<{ value: string; label: string }>;
  refreshEvents: () => Promise<void>;
  doCloseEventModal: () => void;
  setSelectedEvent: (event: CalendarEvent | null) => void;
  setTaskDeletionModal: (state: TaskDeletionModalState) => void;
  showAlert: (message: string, severity?: AlertSeverity, title?: string) => void;
  showConfirm: (message: string, onConfirm: () => void, title?: string) => void;
}

export function useCalendarEventSave(options: SaveOptions) {
  const [eventSaving, setEventSaving] = useState(false);

  const {
    eventFormData,
    editingEventId,
    selectedEvent,
    eventTypesOptions,
    gameTypesOptions,
    tournamentTeams,
    refreshEvents,
    doCloseEventModal,
    setSelectedEvent,
    setTaskDeletionModal,
    showAlert,
    showConfirm,
  } = options;

  const handleSaveEvent = async () => {
    const { isMatchEvent, isTournament, isTask, isTraining } = getEventTypeFlags(
      eventFormData.eventType,
      eventFormData.gameType,
      eventTypesOptions,
      gameTypesOptions,
    );

    if (isTraining && eventFormData.trainingRecurring) {
      if (!eventFormData.trainingWeekdays || eventFormData.trainingWeekdays.length === 0) {
        showAlert(
          'Bitte mindestens einen Wochentag für das Training auswählen.',
          'warning',
          'Wochentage fehlen',
        );
        return;
      }
      if (!eventFormData.trainingEndDate) {
        showAlert(
          'Bitte ein Enddatum für die Trainingsserie angeben.',
          'warning',
          'Enddatum fehlt',
        );
        return;
      }
    }

    if (isMatchEvent && !isTournament && eventFormData.homeTeam === eventFormData.awayTeam) {
      showAlert(
        'Heim-Team und Auswärts-Team können nicht identisch sein.',
        'warning',
        'Ungültige Team-Auswahl',
      );
      return;
    }

    setEventSaving(true);

    try {
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
        doCloseEventModal();
        showAlert(
          `${result.createdCount} Trainings wurden erfolgreich erstellt!`,
          'success',
          'Trainingsserie erstellt',
        );
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

      const url = editingEventId
        ? `/api/calendar/event/${editingEventId}`
        : '/api/calendar/event';
      const method = editingEventId ? 'PUT' : 'POST';

      const response = await apiRequest(url, { method: method as any, body: payload });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }));
        // eslint-disable-next-line no-console
        console.error(response, errorData);
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
      }

      await refreshEvents();
      doCloseEventModal();
      showAlert('Event wurde erfolgreich gespeichert!', 'success', 'Erfolgreich gespeichert');
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error('Error saving event:', error);
      showAlert(getApiErrorMessage(error), 'error', 'Speichern fehlgeschlagen');
    } finally {
      setEventSaving(false);
    }
  };

  const performDeleteEvent = async (
    deletionMode: 'single' | 'from_here' | 'series',
    eventId?: number,
  ) => {
    const id = eventId ?? editingEventId;
    if (!id) return;

    setEventSaving(true);
    try {
      const response = await apiRequest(`/api/calendar/event/${id}`, {
        method: 'DELETE',
        body: { deletionMode },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }));
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
      }

      await refreshEvents();
      doCloseEventModal();
      setSelectedEvent(null);
      setTaskDeletionModal({ open: false });
      showAlert('Event wurde erfolgreich gelöscht!', 'success', 'Erfolgreich gelöscht');
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error('Error deleting event:', error);
      showAlert(getApiErrorMessage(error), 'error', 'Löschen fehlgeschlagen');
    } finally {
      setEventSaving(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!editingEventId) return;

    const isTaskEvent = eventFormData.task && Object.keys(eventFormData.task).length > 0;
    const isTrainingSeries =
      (eventFormData.trainingWeekdays?.length ?? 0) > 0 || !!eventFormData.trainingSeriesId;

    if (isTaskEvent) {
      setTaskDeletionModal({ open: true, eventId: editingEventId });
    } else if (isTrainingSeries) {
      setTaskDeletionModal({ open: true, mode: 'training', eventId: editingEventId });
    } else {
      showConfirm(
        'Möchten Sie dieses Event wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
        async () => performDeleteEvent('single'),
        'Event löschen',
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
        async () => performDeleteEvent('single', selectedEvent.id),
        'Event löschen',
      );
    }
  };

  return {
    eventSaving,
    handleSaveEvent,
    handleDeleteEvent,
    handleDeleteSelectedEvent,
    performDeleteEvent,
  };
}
