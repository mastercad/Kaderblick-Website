import { useEffect, useState } from 'react';
import { apiJson } from '../../../utils/api';
import type { Club } from '../../../types/club';
import type { Player } from '../../../types/player';
import type { Coach } from '../../../types/coach';

type UserRelationsResponse = {
  relationType: { identifier: string };
  player?: Player | null;
  coach?: Coach | null;
}[];

function findCurrentClub(assignments: { startDate: string; endDate?: string; club: Club }[]): Club | null {
  const active = assignments.find(a => !a.endDate);
  if (active) return active.club;
  if (!assignments.length) return null;
  return [...assignments].sort((a, b) =>
    new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  )[0].club;
}

export interface UsePosterClubResult {
  club: Club | null;
  loading: boolean;
  error: string | null;
}

/**
 * Resolves the current user's club via their self_player / self_coach
 * UserRelation → PlayerClubAssignment / CoachClubAssignment chain.
 *
 * A user can have multiple assignments; the one without an endDate
 * (or the most recent one) is considered current.
 */
export function usePosterClub(): UsePosterClubResult {
  const [club, setClub]       = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiJson<UserRelationsResponse>('/api/profile/relations')
      .then(relations => {
        if (cancelled) return;

        for (const rel of relations) {
          const identifier = rel.relationType?.identifier;

          if (identifier === 'self_player' && rel.player?.clubAssignments?.length) {
            const found = findCurrentClub(rel.player.clubAssignments);
            if (found) { setClub(found); return; }
          }

          if (identifier === 'self_coach' && rel.coach?.clubAssignments?.length) {
            const found = findCurrentClub(rel.coach.clubAssignments);
            if (found) { setClub(found); return; }
          }
        }
        setClub(null);
      })
      .catch(() => {
        if (!cancelled) setError('Vereinsdaten konnten nicht geladen werden.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  return { club, loading, error };
}
