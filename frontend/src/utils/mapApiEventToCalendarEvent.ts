import { CalendarEvent, Team } from '../types/calendar';

/**
 * Fills in team names for pending tournament matches using the known teams list.
 * Returns only matches where both teams could be resolved.
 */
export function fulfillPendingTournamentMatches(matches: any[], teams: Team[]): any[] {
  const pendingTournamentMatches = [];

  for (const match of matches) {
    const homeTeam = teams.find(team => String(team.id) === String(match.homeTeamId));
    const awayTeam = teams.find(team => String(team.id) === String(match.awayTeamId));
    if (homeTeam && awayTeam) {
      match.homeTeamName = homeTeam.name;
      match.awayTeamName = awayTeam.name;
      pendingTournamentMatches.push(match);
    }
  }

  return pendingTournamentMatches;
}

/**
 * Maps a raw API calendar event to the internal CalendarEvent shape.
 *
 * @param ev            Raw event object from the API
 * @param teams         Own-teams list, used to resolve pending tournament match names
 * @param tournamentTeamIds  Pre-computed list of all team IDs from tournament matches across the
 *                      current view (only meaningful for the bulk-load path; omit for refreshEvents)
 */
export function mapApiEventToCalendarEvent(
  ev: any,
  teams: Team[],
  tournamentTeamIds?: any[],
): CalendarEvent {
  const tournamentSettings = ev.tournamentSettings || undefined;
  const teamIds = tournamentTeamIds ?? [];

  return {
    id: ev.id || 0,
    title: ev.title || 'Unbenannter Termin',
    start: new Date(ev.start),
    end: new Date(ev.end),
    description: ev.description || '',
    eventType: ev.type || {},
    location: ev.location || {},
    game: ev.game || undefined,
    task: ev.task || undefined,
    weatherData: ev.weatherData || undefined,
    permissions: ev.permissions || {},
    permissionType: ev.permissionType || undefined,
    trainingTeamId: ev.trainingTeamId || undefined,
    trainingWeekdays: ev.trainingWeekdays || undefined,
    trainingSeriesEndDate: ev.trainingSeriesEndDate || undefined,
    trainingSeriesId: ev.trainingSeriesId || undefined,
    cancelled: ev.cancelled || false,
    cancelReason: ev.cancelReason || undefined,
    cancelledBy: ev.cancelledBy || undefined,
    tournamentId: ev.tournament?.id,
    tournamentType: tournamentSettings?.type,
    tournamentRoundDuration: tournamentSettings?.roundDuration,
    tournamentBreakTime: tournamentSettings?.breakTime,
    tournamentGameMode: tournamentSettings?.gameMode,
    tournamentNumberOfGroups: tournamentSettings?.numberOfGroups,
    tournament: ev.tournament,
    matches: ev.tournament?.matches,
    pendingTournamentMatches: fulfillPendingTournamentMatches(ev.tournament?.matches || [], teams),
    teamIds,
    tournamentTeams: teamIds,
  } as CalendarEvent;
}
