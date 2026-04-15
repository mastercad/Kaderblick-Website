export type ClubSummary = {
  id: number;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
};

export type TeamSeasonStats = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

export type NextGame = {
  id: number;
  date: string;
  homeTeam: { id: number; name: string } | null;
  awayTeam: { id: number; name: string } | null;
  location: string | null;
};

/** W = win, D = draw, L = loss */
export type FormResult = 'W' | 'D' | 'L';

export type TeamSeasonData = {
  id: number;
  name: string;
  ageGroup: { id: number; name: string } | null;
  league: { id: number; name: string } | null;
  stats: TeamSeasonStats;
  form: FormResult[];
  nextGame: NextGame | null;
};

export type TopScorer = {
  playerId: number;
  firstName: string;
  lastName: string;
  goals: number;
  teamId: number;
  teamName: string;
};

export type ClubSeasonOverview = {
  club: ClubSummary | null;
  season: string;
  seasonYear: number;
  availableSeasons: number[];
  teams: TeamSeasonData[];
  topScorers: TopScorer[];
};
