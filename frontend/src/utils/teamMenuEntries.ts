// ─── Shared team-dropdown utilities ───────────────────────────────────────────
// Used by TeamSelect, Formations.tsx and any other place that renders a
// "Meine Teams / Weitere Teams" grouped team dropdown.

export interface TeamMenuItem {
  id: number;
  name: string;
  /** True when the authenticated user is directly assigned to this team. */
  assigned?: boolean;
}

export type TeamMenuEntry =
  | { type: 'header'; key: string; label: string }
  | { type: 'item'; team: TeamMenuItem; dimmed: boolean };

/**
 * Builds the grouped menu-entry list for a team dropdown.
 *
 * Rules:
 * - If BOTH "my" teams (assigned === true) and "other" teams (assigned falsy)
 *   exist, group headers ("Meine Teams" / "Weitere Teams") are inserted and
 *   other-team items are visually dimmed.
 * - If only one group exists the list is rendered flat without any headers.
 */
export function buildTeamMenuEntries(teams: TeamMenuItem[]): TeamMenuEntry[] {
  const myTeams = teams.filter(t => t.assigned);
  const otherTeams = teams.filter(t => !t.assigned);
  const grouped = myTeams.length > 0 && otherTeams.length > 0;
  const entries: TeamMenuEntry[] = [];

  if (grouped) entries.push({ type: 'header', key: 'grp-my', label: 'Meine Teams' });
  myTeams.forEach(t => entries.push({ type: 'item', team: t, dimmed: false }));
  if (grouped) entries.push({ type: 'header', key: 'grp-other', label: 'Weitere Teams' });
  otherTeams.forEach(t => entries.push({ type: 'item', team: t, dimmed: grouped }));

  return entries;
}
