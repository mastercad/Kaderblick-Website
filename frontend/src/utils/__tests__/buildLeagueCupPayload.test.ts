import { buildLeagueCupPayload } from '../buildLeagueCupPayload';
import type { SelectOption } from '../../types/event';

const gameTypes: SelectOption[] = [
  { value: '1', label: 'Freundschaftsspiel' },
  { value: '2', label: 'Ligaspiel' },
  { value: '3', label: 'Kreispokal' },
  { value: '4', label: 'Bezirksliga' },
  { value: '5', label: 'Turnier' },
  { value: '6', label: 'DFB-Pokal' },
];

describe('buildLeagueCupPayload', () => {
  // ── leagueId ──────────────────────────────────────────────────────────────

  it('returns leagueId as number when game type label contains "liga" and leagueId is provided', () => {
    const result = buildLeagueCupPayload('2', gameTypes, '10', undefined);
    expect(result.leagueId).toBe(10);
  });

  it('returns leagueId as number for multi-word label containing "liga"', () => {
    const result = buildLeagueCupPayload('4', gameTypes, '99', undefined);
    expect(result.leagueId).toBe(99);
  });

  it('returns leagueId: null when game type label contains "liga" but leagueId is empty string', () => {
    const result = buildLeagueCupPayload('2', gameTypes, '', undefined);
    expect(result.leagueId).toBeNull();
  });

  it('returns leagueId: null when game type label contains "liga" but leagueId is undefined', () => {
    const result = buildLeagueCupPayload('2', gameTypes, undefined, undefined);
    expect(result.leagueId).toBeNull();
  });

  it('returns leagueId: null when game type label does NOT contain "liga"', () => {
    // Freundschaftsspiel — no liga
    const result = buildLeagueCupPayload('1', gameTypes, '10', undefined);
    expect(result.leagueId).toBeNull();
  });

  it('returns leagueId: null for tournament event type (no liga in label)', () => {
    const result = buildLeagueCupPayload('5', gameTypes, '10', undefined);
    expect(result.leagueId).toBeNull();
  });

  it('returns leagueId: null when gameType is undefined', () => {
    const result = buildLeagueCupPayload(undefined, gameTypes, '10', undefined);
    expect(result.leagueId).toBeNull();
  });

  it('returns leagueId: null when gameTypes array is empty', () => {
    const result = buildLeagueCupPayload('2', [], '10', undefined);
    expect(result.leagueId).toBeNull();
  });

  // ── cupId ─────────────────────────────────────────────────────────────────

  it('returns cupId as number when game type label contains "pokal" and cupId is provided', () => {
    const result = buildLeagueCupPayload('3', gameTypes, undefined, '20');
    expect(result.cupId).toBe(20);
  });

  it('returns cupId as number for multi-word label containing "pokal"', () => {
    const result = buildLeagueCupPayload('6', gameTypes, undefined, '77');
    expect(result.cupId).toBe(77);
  });

  it('returns cupId: null when game type label contains "pokal" but cupId is empty string', () => {
    const result = buildLeagueCupPayload('3', gameTypes, undefined, '');
    expect(result.cupId).toBeNull();
  });

  it('returns cupId: null when game type label contains "pokal" but cupId is undefined', () => {
    const result = buildLeagueCupPayload('3', gameTypes, undefined, undefined);
    expect(result.cupId).toBeNull();
  });

  it('returns cupId: null when game type label does NOT contain "pokal"', () => {
    // Ligaspiel — no pokal
    const result = buildLeagueCupPayload('2', gameTypes, undefined, '20');
    expect(result.cupId).toBeNull();
  });

  it('returns cupId: null for tournament event type (no pokal in label)', () => {
    const result = buildLeagueCupPayload('5', gameTypes, undefined, '20');
    expect(result.cupId).toBeNull();
  });

  // ── Both keys always present ──────────────────────────────────────────────

  it('always returns both keys in the result object', () => {
    const result = buildLeagueCupPayload('1', gameTypes, undefined, undefined);
    expect(result).toHaveProperty('leagueId');
    expect(result).toHaveProperty('cupId');
  });

  it('returns null for both when switching from liga to Freundschaftsspiel', () => {
    // Simulates saving after user changed game type away from a liga type
    const result = buildLeagueCupPayload('1', gameTypes, '10', '20');
    expect(result.leagueId).toBeNull();
    expect(result.cupId).toBeNull();
  });

  it('returns correct independent values when liga and pokal labels do not overlap', () => {
    // Liga type → leagueId set, cupId null
    const liga = buildLeagueCupPayload('2', gameTypes, '10', '20');
    expect(liga.leagueId).toBe(10);
    expect(liga.cupId).toBeNull();

    // Pokal type → cupId set, leagueId null
    const pokal = buildLeagueCupPayload('3', gameTypes, '10', '20');
    expect(pokal.leagueId).toBeNull();
    expect(pokal.cupId).toBe(20);
  });
});
