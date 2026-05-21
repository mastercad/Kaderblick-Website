import { apiJson } from '../utils/api';

export interface UnknownGameEventTeam {
  id: number;
  name: string;
}

export interface UnknownGameEventGame {
  id: number;
  homeTeam: string | null;
  awayTeam: string | null;
  date: string | null;
}

export interface UnknownGameEvent {
  id: number;
  eventType: string | null;
  eventTypeCode: string | null;
  minute: number | null;
  timestamp: string;
  description: string | null;
  team: UnknownGameEventTeam;
  game: UnknownGameEventGame;
}

export interface PlayerOption {
  id: number;
  fullName: string;
}

export async function fetchUnknownGameEvents(): Promise<UnknownGameEvent[]> {
  return apiJson<UnknownGameEvent[]>('/api/admin/unknown-game-events');
}

export async function fetchPlayersForEvent(eventId: number): Promise<PlayerOption[]> {
  return apiJson<PlayerOption[]>(`/api/admin/unknown-game-events/${eventId}/players`);
}

export async function assignPlayerToEvent(eventId: number, playerId: number): Promise<UnknownGameEvent> {
  return apiJson<UnknownGameEvent>(`/api/admin/unknown-game-events/${eventId}/assign`, {
    method: 'PATCH',
    body: { playerId },
  });
}
