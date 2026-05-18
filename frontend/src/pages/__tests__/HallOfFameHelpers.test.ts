/**
 * Unit tests for the pure helper functions exported from HallOfFame.
 *
 * Covers:
 * - groupTitles(): groups by competition, assigns correct frameBase, sorts groups and entries
 * - sortTitles(): orders by scope priority then rank (gold → silver → bronze)
 * - scopeLabel(): returns the most specific label (cup > league > team > fallback)
 * - scopeGroup(): returns numeric bucket for platform / league+cup / team
 */

import { groupTitles, sortTitles, scopeLabel, scopeGroup, TitleEntry, TitleGroup } from '../HallOfFame';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<TitleEntry> = {}): TitleEntry {
  return {
    id: 1,
    titleCategory: 'top_scorer',
    titleScope: 'league',
    titleRank: 'gold',
    value: 10,
    season: '2024/2025',
    playerFirstName: 'Max',
    playerLastName: 'Muster',
    userId: 1,
    avatarFilename: null,
    teamName: null,
    leagueName: 'Kreisliga A',
    cupName: null,
    titleObj: { hasTitle: true, avatarFrame: 'league_top_scorer_gold' },
    ...overrides,
  };
}

// ─── scopeGroup ───────────────────────────────────────────────────────────────

describe('scopeGroup', () => {
  it('returns 0 for platform scope', () => {
    expect(scopeGroup(makeEntry({ titleScope: 'platform', leagueName: null }))).toBe(0);
  });

  it('returns 1 for league scope (leagueName set)', () => {
    expect(scopeGroup(makeEntry({ titleScope: 'league', leagueName: 'Kreisliga A' }))).toBe(1);
  });

  it('returns 1 for cup scope (cupName set)', () => {
    expect(scopeGroup(makeEntry({ titleScope: 'cup', cupName: 'Kreispokal', leagueName: null }))).toBe(1);
  });

  it('returns 2 for team scope with no league or cup name', () => {
    expect(scopeGroup(makeEntry({ titleScope: 'team', leagueName: null, cupName: null, teamName: 'FC Muster' }))).toBe(2);
  });
});

// ─── scopeLabel ───────────────────────────────────────────────────────────────

describe('scopeLabel', () => {
  it('returns cupName when cupName is set', () => {
    expect(scopeLabel(makeEntry({ cupName: 'Kreispokal', leagueName: 'Liga', teamName: 'Team' }))).toBe('Kreispokal');
  });

  it('returns leagueName when only leagueName is set', () => {
    expect(scopeLabel(makeEntry({ cupName: null, leagueName: 'Kreisliga A', teamName: 'Team' }))).toBe('Kreisliga A');
  });

  it('returns teamName when only teamName is set', () => {
    expect(scopeLabel(makeEntry({ cupName: null, leagueName: null, teamName: 'FC Muster' }))).toBe('FC Muster');
  });

  it('returns "Plattform" for platform scope with no names', () => {
    expect(scopeLabel(makeEntry({ titleScope: 'platform', cupName: null, leagueName: null, teamName: null }))).toBe('Plattform');
  });

  it('returns "Team" for other scopes with no names', () => {
    expect(scopeLabel(makeEntry({ titleScope: 'team', cupName: null, leagueName: null, teamName: null }))).toBe('Team');
  });
});

// ─── sortTitles ───────────────────────────────────────────────────────────────

describe('sortTitles', () => {
  it('sorts gold before silver before bronze within the same scope', () => {
    const entries = [
      makeEntry({ id: 3, titleRank: 'bronze', leagueName: 'Kreisliga A' }),
      makeEntry({ id: 1, titleRank: 'gold', leagueName: 'Kreisliga A' }),
      makeEntry({ id: 2, titleRank: 'silver', leagueName: 'Kreisliga A' }),
    ];
    const sorted = sortTitles(entries);
    expect(sorted.map(e => e.titleRank)).toEqual(['gold', 'silver', 'bronze']);
  });

  it('sorts platform entries before league entries', () => {
    const entries = [
      makeEntry({ id: 2, titleScope: 'league', leagueName: 'Kreisliga A' }),
      makeEntry({ id: 1, titleScope: 'platform', leagueName: null }),
    ];
    const sorted = sortTitles(entries);
    expect(sorted[0].titleScope).toBe('platform');
    expect(sorted[1].titleScope).toBe('league');
  });

  it('sorts league entries before team entries', () => {
    const entries = [
      makeEntry({ id: 2, titleScope: 'team', leagueName: null, teamName: 'FC Muster' }),
      makeEntry({ id: 1, titleScope: 'league', leagueName: 'Kreisliga A' }),
    ];
    const sorted = sortTitles(entries);
    expect(sorted[0].titleScope).toBe('league');
    expect(sorted[1].titleScope).toBe('team');
  });

  it('does not mutate the original array', () => {
    const entries = [
      makeEntry({ id: 2, titleRank: 'bronze' }),
      makeEntry({ id: 1, titleRank: 'gold' }),
    ];
    const original = [...entries];
    sortTitles(entries);
    expect(entries[0].id).toBe(original[0].id);
  });
});

// ─── groupTitles ─────────────────────────────────────────────────────────────

describe('groupTitles', () => {
  it('returns an empty array for empty input', () => {
    expect(groupTitles([])).toEqual([]);
  });

  it('groups all platform entries into a single "Plattform" group', () => {
    const entries = [
      makeEntry({ id: 1, titleScope: 'platform', leagueName: null, titleRank: 'gold' }),
      makeEntry({ id: 2, titleScope: 'platform', leagueName: null, titleRank: 'silver' }),
    ];
    const groups = groupTitles(entries);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('platform');
    expect(groups[0].label).toBe('Plattform');
    expect(groups[0].scope).toBe('platform');
    expect(groups[0].entries).toHaveLength(2);
  });

  it('groups league entries by leagueName + season', () => {
    const entries = [
      makeEntry({ id: 1, titleScope: 'league', leagueName: 'Kreisliga A', season: '2024/2025' }),
      makeEntry({ id: 2, titleScope: 'league', leagueName: 'Bezirksliga', season: '2024/2025' }),
      makeEntry({ id: 3, titleScope: 'league', leagueName: 'Kreisliga A', season: '2024/2025' }),
    ];
    const groups = groupTitles(entries);
    expect(groups).toHaveLength(2);
    const kreisliga = groups.find(g => g.label === 'Kreisliga A');
    expect(kreisliga?.entries).toHaveLength(2);
  });

  it('gives league entries frameBase "league"', () => {
    const groups = groupTitles([makeEntry({ titleScope: 'league', leagueName: 'Kreisliga A' })]);
    expect(groups[0].frameBase).toBe('league');
  });

  it('gives cup entries frameBase "league" (cups share the league frame)', () => {
    const groups = groupTitles([
      makeEntry({ id: 1, titleScope: 'cup', cupName: 'Kreispokal', leagueName: null, season: '2024/2025' }),
    ]);
    expect(groups[0].frameBase).toBe('league');
    expect(groups[0].scope).toBe('cup');
  });

  it('gives team entries frameBase "team"', () => {
    const groups = groupTitles([
      makeEntry({ id: 1, titleScope: 'team', leagueName: null, teamName: 'FC Muster' }),
    ]);
    expect(groups[0].frameBase).toBe('team');
  });

  it('gives platform entries frameBase "platform"', () => {
    const groups = groupTitles([
      makeEntry({ id: 1, titleScope: 'platform', leagueName: null }),
    ]);
    expect(groups[0].frameBase).toBe('platform');
  });

  it('keeps different cups as separate groups', () => {
    const entries = [
      makeEntry({ id: 1, titleScope: 'cup', cupName: 'Kreispokal', leagueName: null, season: '2024/2025' }),
      makeEntry({ id: 2, titleScope: 'cup', cupName: 'Landespokal', leagueName: null, season: '2024/2025' }),
    ];
    const groups = groupTitles(entries);
    expect(groups).toHaveLength(2);
  });

  it('sorts groups: platform first, then league/cup, then team', () => {
    const entries = [
      makeEntry({ id: 1, titleScope: 'team', leagueName: null, teamName: 'FC Muster' }),
      makeEntry({ id: 2, titleScope: 'platform', leagueName: null }),
      makeEntry({ id: 3, titleScope: 'league', leagueName: 'Kreisliga A' }),
    ];
    const groups = groupTitles(entries);
    expect(groups[0].scope).toBe('platform');
    expect(groups[1].scope).toBe('league');
    expect(groups[2].scope).toBe('team');
  });

  it('sorts entries within each group gold → silver → bronze', () => {
    const entries = [
      makeEntry({ id: 3, titleRank: 'bronze', leagueName: 'Kreisliga A' }),
      makeEntry({ id: 1, titleRank: 'gold', leagueName: 'Kreisliga A' }),
      makeEntry({ id: 2, titleRank: 'silver', leagueName: 'Kreisliga A' }),
    ];
    const groups = groupTitles(entries);
    expect(groups[0].entries.map(e => e.titleRank)).toEqual(['gold', 'silver', 'bronze']);
  });

  it('sorts groups with the same scope alphabetically by label (de locale)', () => {
    const entries = [
      makeEntry({ id: 1, titleScope: 'league', leagueName: 'Zentralliga' }),
      makeEntry({ id: 2, titleScope: 'league', leagueName: 'Bezirksliga' }),
    ];
    const groups = groupTitles(entries);
    expect(groups[0].label).toBe('Bezirksliga');
    expect(groups[1].label).toBe('Zentralliga');
  });

  it('treats the same league in different seasons as separate groups', () => {
    const entries = [
      makeEntry({ id: 1, titleScope: 'league', leagueName: 'Kreisliga A', season: '2023/2024' }),
      makeEntry({ id: 2, titleScope: 'league', leagueName: 'Kreisliga A', season: '2024/2025' }),
    ];
    const groups = groupTitles(entries);
    expect(groups).toHaveLength(2);
  });
});
