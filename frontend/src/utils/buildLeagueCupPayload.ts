import type { SelectOption } from '../types/event';

/**
 * Builds the `leagueId` / `cupId` slice of a calendar-event save payload.
 *
 * Rules:
 *  - leagueId is set only when the selected game-type label contains "liga"
 *    AND a leagueId string is provided; otherwise it is `null` (explicit clear).
 *  - cupId follows the same pattern with "pokal".
 * Sending `null` (not `undefined`) ensures the JSON key is present so the
 * backend's `array_key_exists` check can clear a previously saved value.
 */
export function buildLeagueCupPayload(
  gameType: string | undefined,
  gameTypes: SelectOption[],
  leagueId: string | undefined,
  cupId: string | undefined,
): { leagueId: number | null; cupId: number | null } {
  const label = gameTypes.find((gt) => gt.value === gameType)?.label?.toLowerCase() ?? '';
  return {
    leagueId: label.includes('liga') && leagueId ? parseInt(leagueId, 10) : null,
    cupId:    label.includes('pokal') && cupId    ? parseInt(cupId,    10) : null,
  };
}
