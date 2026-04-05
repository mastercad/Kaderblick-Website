import { EventFormData } from '../types/calendar';
import { buildLeagueCupPayload } from './buildLeagueCupPayload';

type EventFlags = {
  isMatchEvent: boolean;
  isTournament: boolean;
  isTask: boolean;
  isTraining: boolean;
};

type SelectOption = { value: string; label: string };

/**
 * Assembles the full API request payload for creating or updating a calendar event.
 * Does not handle the training-series bulk-create case (that path returns early in handleSaveEvent).
 */
export function buildCalendarEventPayload(
  eventFormData: EventFormData,
  flags: EventFlags,
  editingEventId: number | null,
  gameTypesOptions: SelectOption[],
  tournamentTeams: SelectOption[],
): any {
  const { isMatchEvent, isTournament, isTask, isTraining } = flags;

  // ─── DateTime assembly ────────────────────────────────────────────────────

  const startDateTime = eventFormData.time
    ? `${eventFormData.date}T${eventFormData.time}:00`
    : `${eventFormData.date}T00:00:00`;

  let endDateTime: string | undefined;
  if (eventFormData.endDate) {
    endDateTime = eventFormData.endTime
      ? `${eventFormData.endDate}T${eventFormData.endTime}:00`
      : `${eventFormData.endDate}T23:59:59`;
  }

  // For Spiel events without explicit end time: auto-compute from timing fields
  if (!endDateTime && isMatchEvent && !isTournament) {
    const halfDur  = typeof eventFormData.gameHalfDuration === 'number' ? eventFormData.gameHalfDuration : 45;
    const breakDur = typeof eventFormData.gameHalftimeBreakDuration === 'number' ? eventFormData.gameHalftimeBreakDuration : 15;
    const totalMins = 2 * halfDur + breakDur;
    const startDate = new Date(startDateTime);
    startDate.setMinutes(startDate.getMinutes() + totalMins);
    const pad = (n: number) => String(n).padStart(2, '0');
    endDateTime = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}T${pad(startDate.getHours())}:${pad(startDate.getMinutes())}:00`;
  }

  if (!endDateTime) endDateTime = startDateTime;

  // ─── Base payload ─────────────────────────────────────────────────────────

  const payload: any = {
    title: eventFormData.title,
    startDate: startDateTime,
    endDate: endDateTime,
    eventTypeId: eventFormData.eventType ? parseInt(eventFormData.eventType) : undefined,
    description: eventFormData.description || '',
    locationId: eventFormData.locationId ? parseInt(eventFormData.locationId) : undefined,
    permissionType: eventFormData.permissionType || 'public',
    permissionTeams: eventFormData.permissionTeams?.map(id => parseInt(id)) || [],
    permissionClubs: eventFormData.permissionClubs?.map(id => parseInt(id)) || [],
    permissionUsers: eventFormData.permissionUsers?.map(id => parseInt(id)) || [],
  };

  // Always send leagueId/cupId (null = clear) so the backend clears stale values.
  Object.assign(payload, buildLeagueCupPayload(
    eventFormData.gameType,
    gameTypesOptions,
    eventFormData.leagueId,
    eventFormData.cupId,
  ));

  // ─── Match event ──────────────────────────────────────────────────────────

  if (isMatchEvent) {
    if (!isTournament && eventFormData.homeTeam && eventFormData.awayTeam) {
      payload.game = {
        homeTeamId: parseInt(eventFormData.homeTeam),
        awayTeamId: parseInt(eventFormData.awayTeam),
        halfDuration: typeof eventFormData.gameHalfDuration === 'number' ? eventFormData.gameHalfDuration : undefined,
        halftimeBreakDuration: typeof eventFormData.gameHalftimeBreakDuration === 'number' ? eventFormData.gameHalftimeBreakDuration : undefined,
        firstHalfExtraTime: eventFormData.gameFirstHalfExtraTime ?? undefined,
        secondHalfExtraTime: eventFormData.gameSecondHalfExtraTime ?? undefined,
      };
    }
    if (eventFormData.gameType) {
      payload.gameTypeId = parseInt(eventFormData.gameType);
    }
  }

  // ─── Tournament ───────────────────────────────────────────────────────────

  if (isTournament) {
    const teamIds = new Set<string>();
    (eventFormData.pendingTournamentMatches || []).forEach((m: any) => {
      if (m.homeTeamId) teamIds.add(String(m.homeTeamId));
      if (m.awayTeamId) teamIds.add(String(m.awayTeamId));
    });
    const selectedTeams = tournamentTeams.filter(t => teamIds.has(t.value));
    payload.tournamentType = eventFormData.tournamentType || 'indoor_hall';
    payload.tournamentRoundDuration = eventFormData.tournamentRoundDuration || 10;
    payload.tournamentBreakTime = eventFormData.tournamentBreakTime || 2;
    payload.tournamentGameMode = eventFormData.tournamentGameMode || 'round_robin';
    payload.tournamentNumberOfGroups = eventFormData.tournamentNumberOfGroups || 2;
    payload.pendingTournamentMatches = eventFormData.pendingTournamentMatches;
    payload.teams = selectedTeams.map(t => t.value);
  }

  // ─── Task ─────────────────────────────────────────────────────────────────

  if (isTask) {
    var taskRecurrenceRule = JSON.stringify({ freq: eventFormData.taskFreq, interval: eventFormData.taskInterval, byday: eventFormData.taskByDay, bymonthday: eventFormData.taskByMonthDay });
    payload.task = {
      isRecurring: eventFormData.taskIsRecurring || false,
      recurrenceMode: eventFormData.taskRecurrenceMode || 'classic',
      rotationUsers: eventFormData.taskRotationUsers?.map(id => parseInt(id)) || [],
      rotationCount: eventFormData.taskRotationCount || 1,
      recurrenceRule: taskRecurrenceRule,
      offset: eventFormData.taskOffset || 0,
    };
    if (eventFormData.taskIsRecurring && eventFormData.taskRecurrenceMode === 'classic') {
      const rule: any = { freq: eventFormData.taskFreq || 'WEEKLY', interval: eventFormData.taskInterval || 1 };
      if (eventFormData.taskFreq === 'WEEKLY') rule.byday = [eventFormData.taskByDay || 'MO'];
      if (eventFormData.taskFreq === 'MONTHLY') rule.bymonthday = eventFormData.taskByMonthDay || 1;
      payload.task.recurrenceRule = JSON.stringify(rule);
    }
  }

  // ─── Training (single) ────────────────────────────────────────────────────

  if (isTraining && eventFormData.trainingTeamId) {
    payload.permissionType = 'team';
    payload.permissionTeams = [parseInt(eventFormData.trainingTeamId)];
  }

  if (isTraining && editingEventId) {
    payload.trainingWeekdays = eventFormData.trainingRecurring
      ? (eventFormData.trainingWeekdays ?? [])
      : null;
    payload.trainingSeriesEndDate = eventFormData.trainingRecurring
      ? (eventFormData.trainingEndDate || null)
      : null;
    if (!eventFormData.trainingRecurring) {
      payload.trainingSeriesId = null;
    }
  }

  // Training series edit scope (injected last so it's available after URL decision)
  if (isTraining && editingEventId && eventFormData.trainingSeriesId) {
    payload.trainingEditScope = eventFormData.trainingEditScope || 'single';
    if (eventFormData.trainingEditScopeUntilDate) {
      payload.trainingEditUntilDate = eventFormData.trainingEditScopeUntilDate;
    }
  }

  return payload;
}
