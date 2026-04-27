export interface GameStatsEntry {
  id: number;
  matchDay: string | null;
  scheduledAt: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number | null;
  awayScore: number | null;
  statsCount: number;
  hasMatchPlan: boolean;
  isInconsistent: boolean;
}

export interface GameStatsSummary {
  total: number;
  withStats: number;
  withoutStats: number;
  noMatchPlan: number;
}

export interface GameStatsPagination {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

/** Welche Spiele angezeigt werden sollen */
export type GameFilter = 'all' | 'withStats' | 'withoutStats' | 'noMatchPlan';

export interface CronJob {
  command: string;
  label: string;
  maxAgeMin: number | null;
  lastRunAt: string | null;
  ageMinutes: number | null;
  status: 'ok' | 'late' | 'error' | 'unknown' | 'running';
  lastError: string | null;
  running: boolean;
  runningPid: number | null;
  runningStartedAt: string | null;
}

export interface Backup {
  filename: string;
  size: number;
  createdAt: string;
}
