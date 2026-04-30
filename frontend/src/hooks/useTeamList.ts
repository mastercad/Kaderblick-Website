import { useEffect, useState } from 'react';
import { apiJson } from '../utils/api';
import type { TeamMenuItem } from '../utils/teamMenuEntries';

interface UseTeamListResult {
  teams: TeamMenuItem[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches the team list from the canonical TeamsController endpoint.
 *
 * @param context  Optional context forwarded as ?context= query param.
 *                 Use 'match' to let coaches / admins see all teams (with
 *                 the `assigned` flag indicating their own teams).
 */
export function useTeamList(context?: string): UseTeamListResult {
  const [teams, setTeams] = useState<TeamMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const url = context ? `/api/teams/list?context=${encodeURIComponent(context)}` : '/api/teams/list';
    apiJson<{ teams: TeamMenuItem[] }>(url)
      .then(res => {
        if (cancelled) return;
        setTeams(Array.isArray(res.teams) ? res.teams : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError('Teams konnten nicht geladen werden.');
        setTeams([]);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [context]);

  return { teams, loading, error };
}
