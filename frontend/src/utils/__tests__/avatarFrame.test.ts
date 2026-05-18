/**
 * Tests for getAvatarFrameUrl().
 *
 * Covers:
 * - Returns undefined when titleObj is missing or incomplete
 * - Returns the correct SVG URL for league, platform, and team frames
 * - Maps the "cup_" prefix to "league_" (cups share the league frame design)
 */

import { getAvatarFrameUrl } from '../avatarFrame';

describe('getAvatarFrameUrl', () => {
  // ─── undefined / missing cases ─────────────────────────────────────────────

  it('returns undefined when titleObj is undefined', () => {
    expect(getAvatarFrameUrl(undefined)).toBeUndefined();
  });

  it('returns undefined when hasTitle is false', () => {
    expect(getAvatarFrameUrl({ hasTitle: false, avatarFrame: 'league_top_scorer_gold' })).toBeUndefined();
  });

  it('returns undefined when hasTitle is true but avatarFrame is undefined', () => {
    expect(getAvatarFrameUrl({ hasTitle: true, avatarFrame: undefined })).toBeUndefined();
  });

  it('returns undefined when hasTitle is true but avatarFrame is empty string', () => {
    expect(getAvatarFrameUrl({ hasTitle: true, avatarFrame: '' })).toBeUndefined();
  });

  // ─── correct URL construction ──────────────────────────────────────────────

  it('returns the SVG URL for a league frame', () => {
    const url = getAvatarFrameUrl({ hasTitle: true, avatarFrame: 'league_top_scorer_gold' });
    expect(url).toBe('/images/avatar/league_top_scorer_gold.svg');
  });

  it('returns the SVG URL for a platform frame', () => {
    const url = getAvatarFrameUrl({ hasTitle: true, avatarFrame: 'platform_top_scorer_silver' });
    expect(url).toBe('/images/avatar/platform_top_scorer_silver.svg');
  });

  it('returns the SVG URL for a team frame', () => {
    const url = getAvatarFrameUrl({ hasTitle: true, avatarFrame: 'team_top_scorer_bronze' });
    expect(url).toBe('/images/avatar/team_top_scorer_bronze.svg');
  });

  // ─── cup → league mapping ──────────────────────────────────────────────────

  it('maps a cup_ prefix to league_ in the returned URL', () => {
    const url = getAvatarFrameUrl({ hasTitle: true, avatarFrame: 'cup_top_scorer_gold' });
    expect(url).toBe('/images/avatar/league_top_scorer_gold.svg');
  });

  it('maps cup_top_scorer_silver to the league silver frame', () => {
    const url = getAvatarFrameUrl({ hasTitle: true, avatarFrame: 'cup_top_scorer_silver' });
    expect(url).toBe('/images/avatar/league_top_scorer_silver.svg');
  });

  it('maps cup_most_appearances_bronze to the league bronze frame', () => {
    const url = getAvatarFrameUrl({ hasTitle: true, avatarFrame: 'cup_most_appearances_bronze' });
    expect(url).toBe('/images/avatar/league_most_appearances_bronze.svg');
  });

  it('does not alter a league_ prefix (no double replacement)', () => {
    const url = getAvatarFrameUrl({ hasTitle: true, avatarFrame: 'league_top_assist_gold' });
    expect(url).toBe('/images/avatar/league_top_assist_gold.svg');
  });
});
