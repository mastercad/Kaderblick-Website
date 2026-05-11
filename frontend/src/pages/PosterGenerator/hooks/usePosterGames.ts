import { useEffect, useState } from 'react';
import { fetchGamesOverview } from '../../../services/games';
import type { Game, GameWithScore } from '../../../types/games';

export interface PosterGamesData {
  upcomingGames: Game[];
  finishedGames: GameWithScore[];
  loading: boolean;
  error: string | null;
}

/**
 * Loads upcoming and finished games for the poster generator.
 * Uses the global games overview endpoint (no team filter — shows all user-accessible games).
 */
export function usePosterGames(): PosterGamesData {
  const [upcomingGames, setUpcomingGames] = useState<Game[]>([]);
  const [finishedGames, setFinishedGames] = useState<GameWithScore[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchGamesOverview()
      .then(data => {
        if (cancelled) return;
        setUpcomingGames(data.upcoming_games ?? []);
        setFinishedGames(data.finished_games ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('Spiele konnten nicht geladen werden.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  return { upcomingGames, finishedGames, loading, error };
}
