import { apiJson, apiBlob } from '../utils/api';
import { Game, GameEvent, GameEventType, MatchPlan, Player, SubstitutionReason, GameWithScore, TournamentOverview, TournamentDetail } from '../types/games';

export interface GamesOverviewData {
  running_games: Game[];
  upcoming_games: Game[];
  finished_games: GameWithScore[];
  tournaments: TournamentOverview[];
  userTeamIds: number[];
  userDefaultTeamId?: number;
  noTeamAssignment?: boolean;
  availableTeams: { id: number; name: string }[];
  availableSeasons: number[];
  selectedSeason: number;
}

// Spiele-Übersicht laden
export async function fetchGamesOverview(teamId?: number | 'all', season?: number): Promise<GamesOverviewData> {
  const params = new URLSearchParams();
  if (teamId !== undefined) params.set('teamId', String(teamId));
  if (season !== undefined) params.set('season', String(season));
  const qs = params.toString() ? `?${params.toString()}` : '';

  return apiJson<GamesOverviewData>(`/api/games/overview${qs}`);
}

// Einzelnes Spiel mit Details laden
export async function fetchGameDetails(gameId: number): Promise<{
  game: Game;
  gameEvents: GameEvent[];
  homeScore: number | null;
  awayScore: number | null;
}> {
  return apiJson(`/api/games/${gameId}/details`);
}

// Game Events für ein Spiel laden
export async function fetchGameEvents(gameId: number): Promise<GameEvent[]> {
  return apiJson<GameEvent[]>(`/api/game/${gameId}/events`);
}

// Event Types laden
export async function fetchGameEventTypes(): Promise<any> {
  return apiJson<any>('/api/game-event-types');
}

// Spieler für Teams laden
export async function fetchPlayersForTeams(teamIds: number[]): Promise<Player[]> {
  const teamParams = teamIds.map(id => `teams[]=${id}`).join('&');
  return apiJson<Player[]>(`/api/players/active?${teamParams}`);
}

// Substitution Reasons laden
export async function fetchSubstitutionReasons(): Promise<SubstitutionReason[]> {
  return apiJson<SubstitutionReason[]>('/api/substitution-reasons');
}

// Squad (bestätigter Kader) für ein Spiel laden
export interface SquadPlayer {
  id: number;
  fullName: string;
  shirtNumber: number | null;
  teamId: number;
}

export interface GameSquadData {
  squad: SquadPlayer[];
  /** Alle aktiven Spieler der beteiligten Teams (unabhängig von Zusagen) */
  allPlayers: SquadPlayer[];
  /** true wenn überhaupt Teilnahme-Daten für den CalendarEvent existieren */
  hasParticipationData: boolean;
}

export async function fetchGameSquad(gameId: number): Promise<GameSquadData> {
  return apiJson<GameSquadData>(`/api/games/${gameId}/squad`);
}

// Turnier-Details laden
export async function fetchTournamentDetails(tournamentId: number): Promise<TournamentDetail> {
  return apiJson<TournamentDetail>(`/api/tournaments/${tournamentId}`);
}

// Neues Game Event erstellen
export async function createGameEvent(gameId: number, eventData: {
  eventType: number;
  player?: number;
  relatedPlayer?: number;
  minute: string;
  description?: string;
  reason?: number;
}): Promise<{ success: boolean }> {
  return apiJson(`/api/game/${gameId}/event`, {
    method: 'POST',
    body: eventData
  });
}

// Game Event aktualisieren
export async function updateGameEvent(gameId: number, eventId: number, eventData: {
  eventType?: number;
  player?: number;
  relatedPlayer?: number;
  minute?: string;
  description?: string;
  reason?: number;
}): Promise<{ success: boolean }> {
  return apiJson(`/api/game/${gameId}/event/${eventId}`, {
    method: 'PUT',
    body: eventData
  });
}

// Game Event löschen
export async function deleteGameEvent(gameId: number, eventId: number): Promise<{ success: boolean }> {
  return apiJson(`/api/game/${gameId}/event/${eventId}`, {
    method: 'DELETE'
  });
}

// Fussball.de Sync
export async function syncFussballDe(gameId: number): Promise<{ success: boolean }> {
  return apiJson(`/api/game/${gameId}/sync-fussballde`, {
    method: 'POST'
  });
}

// Spiel als beendet markieren (löst ggf. Turnier-Weiterleitung aus)
export async function finishGame(gameId: number): Promise<{
  success: boolean;
  isFinished: boolean;
  advanced: {
    nextMatchId: number;
    round: number;
    slot: number;
    homeTeam: string | null;
    awayTeam: string | null;
    gameCreated: boolean;
  } | null;
}> {
  return apiJson(`/api/games/${gameId}/finish`, {
    method: 'POST'
  });
}

// Zeitangaben für ein Spiel aktualisieren
export interface GameTimingData {
  halfDuration?: number;
  halftimeBreakDuration?: number;
  firstHalfExtraTime?: number | null;
  secondHalfExtraTime?: number | null;
}

export async function updateGameTiming(gameId: number, data: GameTimingData): Promise<{
  success: boolean;
  halfDuration: number;
  halftimeBreakDuration: number;
  firstHalfExtraTime: number | null;
  secondHalfExtraTime: number | null;
}> {
  return apiJson(`/api/games/${gameId}/timing`, {
    method: 'PATCH',
    body: data,
  });
}

export async function saveGameMatchPlan(gameId: number, matchPlan: MatchPlan): Promise<{
  success: boolean;
  matchPlan: MatchPlan;
}> {
  return apiJson(`/api/games/${gameId}/match-plan`, {
    method: 'PATCH',
    body: matchPlan,
  });
}

export async function confirmGameMatchPlanSubstitution(gameId: number, phaseId: string): Promise<{
  success: boolean;
  eventId: number | null;
  matchPlan: MatchPlan;
}> {
  return apiJson(`/api/games/${gameId}/match-plan/confirm-substitution`, {
    method: 'POST',
    body: { phaseId },
  });
}

export async function fetchGameSchedulePdf(teamId: number, season: number): Promise<Blob> {
  return apiBlob(`/api/games/schedule/pdf?teamId=${teamId}&season=${season}`);
}
