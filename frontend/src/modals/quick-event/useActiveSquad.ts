import { useMemo } from 'react';
import { Game, MatchPlanPlayer } from '../../types/games';

export interface ActiveSquad {
  /** Spieler, die aktuell auf dem Feld stehen (aus MatchPlan abgeleitet). */
  onField: MatchPlanPlayer[];
  /** Spieler auf der Bank (Startbank minus rausgewechselte + rausgegangene). */
  bench: MatchPlanPlayer[];
  /** true, wenn ein MatchPlan mit mindestens einer Startphase vorliegt. */
  hasMatchPlan: boolean;
}

/**
 * Leitet die aktuelle Feldaufstellung und Bank aus game.matchPlan.phases ab.
 * Wechsel werden auf Basis der sourceType='substitution'-Phasen verarbeitet.
 */
export function useActiveSquad(game: Game | null): ActiveSquad {
  return useMemo(() => {
    const phases = game?.matchPlan?.phases;
    if (!phases?.length) {
      return { onField: [], bench: [], hasMatchPlan: false };
    }

    const startPhase = phases.find((p) => p.sourceType === 'start');
    if (!startPhase) {
      return { onField: [], bench: [], hasMatchPlan: false };
    }

    const playerKey = (p: MatchPlanPlayer) => String(p.playerId ?? p.id);

    const onFieldMap = new Map<string, MatchPlanPlayer>();
    for (const p of startPhase.players) {
      onFieldMap.set(playerKey(p), p);
    }

    const benchMap = new Map<string, MatchPlanPlayer>();
    for (const p of startPhase.bench ?? []) {
      benchMap.set(playerKey(p), p);
    }

    // Wechsel aus allen Folge-Phasen anwenden
    for (const phase of phases) {
      if (phase.sourceType !== 'substitution' || !phase.substitution) continue;

      const { playerOutId, playerInId } = phase.substitution;
      if (playerOutId == null || playerInId == null) continue;

      const outKey = String(playerOutId);
      const inKey = String(playerInId);

      const outPlayer = onFieldMap.get(outKey);
      const inPlayer = benchMap.get(inKey);

      if (outPlayer) {
        onFieldMap.delete(outKey);
        benchMap.set(outKey, outPlayer);
      }
      if (inPlayer) {
        benchMap.delete(inKey);
        onFieldMap.set(inKey, inPlayer);
      }
    }

    return {
      onField: [...onFieldMap.values()],
      bench: [...benchMap.values()],
      hasMatchPlan: true,
    };
  }, [game?.matchPlan]);
}
