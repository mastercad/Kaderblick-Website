import { apiJson } from '../utils/api';

export interface PublicTickerEvent {
  id: number;
  minute: number | null;
  timestamp: string;
  type: {
    name: string;
    code: string;
    icon?: string | null;
    color?: string | null;
  };
  team: {
    side: 'home' | 'away';
    name: string;
  };
  description?: string | null;
}

export interface PublicLiveTickerData {
  game: {
    homeTeam: { name: string };
    awayTeam: { name: string };
    homeScore: number;
    awayScore: number;
    status: 'scheduled' | 'live' | 'finished';
    startsAt: string | null;
    endsAt: string | null;
    isFinished: boolean;
  };
  events: PublicTickerEvent[];
  updatedAt: string;
}

export function fetchPublicLiveTicker(token: string): Promise<PublicLiveTickerData> {
  return apiJson('/api/public/live-ticker/' + encodeURIComponent(token), { cache: 'no-store' });
}
