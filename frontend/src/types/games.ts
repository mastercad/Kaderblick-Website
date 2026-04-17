export interface Team {
  id: number;
  name: string;
}

export interface MatchPlanPlayer {
  id: number;
  x: number;
  y: number;
  number: string | number;
  name: string;
  playerId?: number | null;
  isRealPlayer?: boolean;
  position?: string | null;
  alternativePositions?: string[];
}

export interface MatchPlanSubstitution {
  playerOutId: number | null;
  playerOutName?: string;
  playerInId: number | null;
  playerInName?: string;
  reasonId?: number | null;
  note?: string | null;
}

export interface MatchPlanPhase {
  id: string;
  minute: number;
  label: string;
  sourceType: 'start' | 'substitution' | 'shape_change';
  templateCode?: string | null;
  players: MatchPlanPlayer[];
  bench: MatchPlanPlayer[];
  substitution?: MatchPlanSubstitution | null;
  confirmedEventId?: number | null;
  confirmedAt?: string | null;
}

export interface MatchPlan {
  selectedTeamId?: number | null;
  sourceFormationId?: number | null;
  phases: MatchPlanPhase[];
  published?: boolean;
  publishedAt?: string | null;
  updatedAt?: string;
}

export interface Location {
  id: number;
  name: string;
  address?: string;
  longitude?: number;
  latitude?: number;
}

export interface GameType {
  id: number;
  name: string;
  /** Dauer einer Halbzeit in Minuten (z.B. 20, 30, 45). Fehlt → Fallback 45. */
  halfDuration?: number;
}

export interface CalendarEventType {
  id: number;
  name: string;
}

export interface CalendarEvent {
  id: number;
  startDate: string;
  endDate: string;
  calendarEventType: CalendarEventType;
}

import type { League } from './league';

export interface Game {
  id: number;
  homeTeam: Team;
  awayTeam: Team;
  userTeamIds?: number[];
  location?: Location;
  gameType?: GameType;
  league?: League;
  calendarEvent?: CalendarEvent;
  weatherData?: {
    weatherCode?: number[];
    dailyWeatherData?: Record<string, any>;
    hourlyWeatherData?: Record<string, any>;
  };
  fussballDeUrl?: string;
  isFinished?: boolean;
  tournamentId?: number | null;
  /** Dauer einer Halbzeit in Minuten (Default: 45). Überschreibt gameType.halfDuration. */
  halfDuration?: number;
  /** Dauer der Halbzeitpause in Minuten (Default: 15). */
  halftimeBreakDuration?: number;
  /** Nachspielzeit der 1. Halbzeit in Minuten (null = nicht erfasst). */
  firstHalfExtraTime?: number | null;
  /** Nachspielzeit der 2. Halbzeit in Minuten (null = nicht erfasst). */
  secondHalfExtraTime?: number | null;
  matchPlan?: MatchPlan | null;
  /** Rundenbezeichnung für die PDF-Spielplanansicht (z.B. "Halbfinale"). */
  round?: string | null;
  permissions?: {
    can_create_videos?: boolean;
    can_view_videos?: boolean;
    can_edit_videos?: boolean;
    can_delete_videos?: boolean;
    can_create_game_events?: boolean;
    can_view_game_events?: boolean;
    can_edit_game_events?: boolean;
    can_delete_game_events?: boolean;
    can_finish_game?: boolean;
    can_edit_timing?: boolean;
    can_manage_match_plan?: boolean;
    can_publish_match_plan?: boolean;
    can_view_match_plan?: boolean;
  };
}

export interface GameEventType {
  id: number;
  name: string;
  code: string;
  color?: string;
  icon?: string;
}

export interface Player {
  id: number;
  firstName: string;
  lastName: string;
  jerseyNumber?: number;
}

export interface SubstitutionReason {
  id: number;
  name: string;
}

export interface GameEvent {
  id: number;
  game: Game;
  gameEventType: GameEventType;
  player?: Player;
  relatedPlayer?: Player;
  team?: Team;
  timestamp: string;
  description?: string;
  teamId?: number;
  playerId?: number;
  typeId?: number;
  relatedPlayerId?: number;
  minute?: number;
  reason?: string;
  type?: string;
}

export interface GameWithScore {
  game: Game;
  homeScore: number | null;
  awayScore: number | null;
}

export interface TournamentMatchOverview {
  id: number;
  round: number | null;
  slot: number | null;
  stage: string | null;
  status: string;
  scheduledAt: string | null;
  homeTeam: Team | null;
  awayTeam: Team | null;
  homeScore: number | null;
  awayScore: number | null;
  gameId: number | null;
  location?: Location;
}

export interface TournamentOverview {
  id: number;
  name: string;
  type: string;
  status: 'upcoming' | 'running' | 'finished';
  matchCount: number;
  teamIds: number[];
  calendarEvent?: {
    id: number;
    startDate: string;
    endDate: string;
    weatherData?: {
      weatherCode?: number[];
    };
  };
  location?: Location;
}

export interface TournamentTeamInfo {
  id: number;
  teamId: number;
  name: string;
  seed: number | null;
  groupKey: string | null;
}

export interface TournamentDetail {
  id: number;
  name: string;
  type: string;
  status: 'upcoming' | 'running' | 'finished';
  settings?: {
    roundDuration?: number;
    breakTime?: number;
    gameMode?: string;
    tournamentType?: string;
    numberOfGroups?: number;
  };
  calendarEvent?: {
    id: number;
    startDate: string;
    endDate: string;
    weatherData?: {
      weatherCode?: number[];
    };
  };
  location?: Location;
  teams: TournamentTeamInfo[];
  matches: TournamentMatchOverview[];
  createdBy?: number;
}

export interface Video {
  id: number;
  name: string;
  url: string;
  filePath?: string;
  gameStart: number;
  sort: number;
  length: number;
  type?: string;
  camera?: {
    id: number;
    name: string;
  };
}

export interface YoutubeLinks {
  id: number;
  name: string;
  url: string;
  filePath?: string;
  gameStart: number;
  sort: number;
  length: number;
  type?: string;
  camera?: {
    id: number;
    name: string;
  };
}
