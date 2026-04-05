import { TournamentGameMode, TournamentType } from './tournament';

export type CalendarEvent = {
  id: number;
  title: string;
  start: Date | string;
  end: Date | string;
  description?: string;
  eventType?: { id: number; name?: string; color?: string };
  location?: { id?: number; name?: string };
  gameType?: { id?: number; name?: string };
  weatherData?: { weatherCode?: number };
  game?: {
    homeTeam?: { id: number; name: string };
    awayTeam?: { id: number; name: string };
  };
  tournamentSettings?: {
    tournamentType?: TournamentType;
    roundDuration?: number;
    breakTime?: number;
    gameMode?: TournamentGameMode;
    numberOfGroups?: number;
  };
  task?: {
    id: number;
    isRecurring: boolean;
    recurrenceMode: string;
    recurrenceRule: string | null;
    rotationUsers: { id: number; fullName: string }[];
    rotationCount: number;
    offset: number;
  };
  tournament?: {
    id?: number;
    matches?: any[];
    teams?: any[];
    settings?: {
      tournamentType?: TournamentType;
      roundDuration?: number;
      breakTime?: number;
      gameMode?: TournamentGameMode;
      numberOfGroups?: number;
    };
  };
  permissionType?: string;
  trainingTeamId?: number;
  trainingWeekdays?: number[];
  trainingSeriesEndDate?: string;
  trainingSeriesId?: string;
  pendingTournamentMatches?: any[];
  teamIds?: any[];
  permissions?: {
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    canCancel?: boolean;
  };
  cancelled?: boolean;
  cancelReason?: string;
  cancelledBy?: string;
  // Externe Kalender-Events (importiert via iCal)
  isExternal?: boolean;
  externalCalendarId?: number;
  externalCalendarName?: string;
  externalCalendarColor?: string;
};

export type CalendarEventType = {
  id: number;
  name: string;
  color: string;
};

export type Team = {
  id: number;
  name: string;
  defaultHalfDuration?: number | null;
  defaultHalftimeBreakDuration?: number | null;
};

export type GameType = {
  id: number;
  name: string;
};

export type Location = {
  id: number;
  name: string;
};

export type LocationsApiResponse = {
  locations: Location[];
  permissions: {
    canCreate: boolean;
    canEdit: boolean;
    canView: boolean;
    canDelete: boolean;
  };
};

export type TeamsApiResponse = {
  teams: Team[];
  permissions: {
    canCreate: boolean;
    canEdit: boolean;
    canView: boolean;
    canDelete: boolean;
  };
};

export type EventFormData = {
  title: string;
  date: string;
  time?: string;
  endDate?: string;
  endTime?: string;
  eventType?: string;
  locationId?: string;
  leagueId?: string;
  cupId?: string;
  description?: string;
  homeTeam?: string;
  awayTeam?: string;
  gameType?: string;
  permissionType?: string;
  permissionTeams?: string[];
  permissionClubs?: string[];
  permissionUsers?: string[];
  // Task-bezogene Felder
  task?: {
    id: number;
    isRecurring: boolean;
    recurrenceMode: string;
    recurrenceRule: string | null;
    rotationUsers: { id: number; fullName: string }[];
    rotationCount: number;
    offset: number;
  };
  taskIsRecurring?: boolean;
  taskRecurrenceMode?: string;
  taskFreq?: string;
  taskInterval?: number;
  taskByDay?: string;
  taskByMonthDay?: number;
  taskRecurrenceRule?: string;
  taskRotationUsers?: string[];
  taskRotationCount?: number;
  taskOffset?: number;
  // Tournament-bezogene Felder
  tournamentId?: string;
  tournamentMatchId?: string;
  pendingTournamentMatches?: any[];
  tournamentRoundDuration?: number;
  tournamentBreakTime?: number;
  tournamentGameMode?: TournamentGameMode;
  tournamentType?: TournamentType;
  tournamentNumberOfGroups?: number;
  tournament?: {
    id?: number;
    matches?: any[];
    teams?: any[];
    settings?: {
      tournamentType?: TournamentType;
      tournamentRoundDuration?: number;
      tournamentBreakTime?: number;
      tournamentNumberOfGroups?: number;
      tournamentGameMode?: TournamentGameMode;
    }
  }
  teamIds?: any[];
  // Training-bezogene Felder
  trainingTeamId?: string;
  trainingRecurring?: boolean;
  trainingWeekdays?: number[];
  trainingEndDate?: string;
  trainingDuration?: number;
  trainingSeriesId?: string;
  // Original series params stored at edit-open time (for diff + change detection)
  trainingOriginalDate?: string;
  trainingOriginalEndDate?: string;
  trainingOriginalWeekdays?: number[];
  trainingOriginalContentKey?: string;
  // Scope selection set on the wizard "Gültigkeit" step (series edits only)
  trainingEditScope?: 'single' | 'from_here' | 'same_weekday' | 'same_weekday_from_here' | 'series';
  trainingEditScopeUntilDate?: string;
  // Game timing fields (only for Spiel events)
  gameHalfDuration?: number;
  gameHalftimeBreakDuration?: number;
  gameFirstHalfExtraTime?: number | null;
  gameSecondHalfExtraTime?: number | null;
};
