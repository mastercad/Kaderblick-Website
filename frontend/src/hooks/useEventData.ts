import { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { fetchLeagues } from '../services/leagues';
import { fetchCups } from '../services/cups';
import { fetchCupRounds } from '../services/cupRounds';
import { SelectOption } from '../types/event';

/**
 * Hook to manage tournament matches loading and state
 */
export const useTournamentMatches = (tournamentId: string | undefined, open: boolean) => {
  const [tournamentMatches, setTournamentMatches] = useState<Array<any>>([]);

  useEffect(() => {
    if (!tournamentId || !open) {
      setTournamentMatches([]);
      return;
    }

    (async () => {
      try {
        const res = await apiRequest(`/api/tournaments/${tournamentId}/matches`);
        if (!res.ok) return setTournamentMatches([]);
        const data = await res.json();
        setTournamentMatches(data || []);
      } catch (e) {
        setTournamentMatches([]);
      }
    })();
  }, [tournamentId, open]);

  return { tournamentMatches, setTournamentMatches };
};

/**
 * Hook to manage leagues loading
 */
export const useLeagues = (open: boolean) => {
  const [leagues, setLeagues] = useState<SelectOption[]>([]);

  useEffect(() => {
    if (open) {
      fetchLeagues().then(leagues => {
        setLeagues(leagues.map(league => ({ value: String(league.id), label: league.name })));
      });
    }
  }, [open]);

  return leagues;
};

/**
 * Hook to manage cups loading
 */
export const useCups = (open: boolean) => {
  const [cups, setCups] = useState<SelectOption[]>([]);

  useEffect(() => {
    if (open) {
      fetchCups().then(cups => {
        setCups(cups.map(cup => ({ value: String(cup.id), label: cup.name })));
      });
    }
  }, [open]);

  return cups;
};

/**
 * Hook to load global cup round names
 */
export const useCupRounds = (open: boolean): string[] => {
  const [rounds, setRounds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      fetchCupRounds().then(r => setRounds(r.map(x => x.name)));
    }
  }, [open]);

  return rounds;
};

/**
 * Hook to reload tournament matches from server
 */
export const useReloadTournamentMatches = () => {
  const reloadMatches = async (tournamentId: string | undefined, setMatches: (matches: any[]) => void) => {
    if (!tournamentId) return;
    
    try {
      const res = await apiRequest(`/api/tournaments/${tournamentId}/matches`);
      if (res.ok) {
        const data = await res.json();
        setMatches(data || []);
      }
    } catch (e) {
      // ignore
    }
  };

  return reloadMatches;
};
