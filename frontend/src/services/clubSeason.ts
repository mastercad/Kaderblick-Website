import { apiJson } from '../utils/api';
import { ClubSeasonOverview } from '../types/clubSeason';

export async function fetchClubSeasonOverview(
  season?: number,
  clubId?: number,
): Promise<ClubSeasonOverview> {
  const params = new URLSearchParams();
  if (season !== undefined) params.set('season', String(season));
  if (clubId !== undefined) params.set('clubId', String(clubId));
  const qs = params.toString() ? `?${params.toString()}` : '';

  return apiJson<ClubSeasonOverview>(`/api/club/season-overview${qs}`);
}
