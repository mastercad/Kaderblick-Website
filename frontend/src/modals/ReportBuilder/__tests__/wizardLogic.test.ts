/**
 * Unit-Tests für die reinen Logik-Funktionen in GuidedWizard.tsx
 *
 * Geprüft wird:
 *  buildConfig
 *   – subject=player/player_comparison + topic=overview → diagramType: 'radaroverlay'
 *   – subject=player + topic=goals/assists/cards/trend   → korrekte Typen & Felder
 *   – subject=team_comparison + topic=trend              → groupBy: 'team'
 *   – timeRange=last10 wählt aus availableDates
 *   – timeRange=season erzeugt korrektes dateFrom
 *   – timeRange=last_month erzeugt dateFrom/dateTo im ~30-Tage-Fenster
 *   – timeRange=all → keine Datumsfilter
 *   – Kontext-IDs landen in den richtigen filters-Feldern
 *
 *  reverseMapWizardConfig
 *   – Subject-Erkennung über filters.players/teams/player/team und xField
 *   – Topic-Erkennung über diagramType und yField
 *   – TimeRange-Erkennung (last_month, last10, season, all)
 *   – Extraktion von playerId, teamId, comparisonPlayerIds, comparisonTeamIds
 *   – Gibt null zurück bei nicht-unterstützten Configs
 *   – Gibt null zurück wenn Topic nicht zum Subject passt
 *
 *  isWizardCompatible
 *   – Akzeptiert alle vom Wizard erzeugten Configs
 *   – Lehnt unbekannte diagramType / xField / yField ab
 */

import { buildConfig, reverseMapWizardConfig, isWizardCompatible } from '../wizardLogic';

// ── Hilfskonstante ────────────────────────────────────────────────────────────

const NO_DATES: string[] = [];
const DATES_10 = [
  '2024-08-10', '2024-08-17', '2024-08-24',
  '2024-09-07', '2024-09-14', '2024-09-21',
  '2024-10-05', '2024-10-12', '2024-10-19', '2024-10-26',
];

// ─────────────────────────────────────────────────────────────────────────────
// buildConfig
// ─────────────────────────────────────────────────────────────────────────────

describe('buildConfig — diagramType', () => {
  it('player + overview → radaroverlay', () => {
    const cfg = buildConfig('player', 'overview', 'all', NO_DATES);
    expect(cfg.diagramType).toBe('radaroverlay');
  });

  it('player_comparison + overview → radaroverlay', () => {
    const cfg = buildConfig('player_comparison', 'overview', 'all', NO_DATES);
    expect(cfg.diagramType).toBe('radaroverlay');
  });

  it('player + goals → bar by month, xField=month, yField=goals, showLabels', () => {
    const cfg = buildConfig('player', 'goals', 'all', NO_DATES);
    expect(cfg.diagramType).toBe('bar');
    expect(cfg.xField).toBe('month');
    expect(cfg.yField).toBe('goals');
    expect(cfg.showLabels).toBe(true);
  });

  it('player + assists → bar by month, xField=month, yField=assists', () => {
    const cfg = buildConfig('player', 'assists', 'all', NO_DATES);
    expect(cfg.diagramType).toBe('bar');
    expect(cfg.xField).toBe('month');
    expect(cfg.yField).toBe('assists');
  });

  it('player + cards → bar by month, xField=month, yField=yellowCards', () => {
    const cfg = buildConfig('player', 'cards', 'all', NO_DATES);
    expect(cfg.diagramType).toBe('bar');
    expect(cfg.xField).toBe('month');
    expect(cfg.yField).toBe('yellowCards');
  });

  it('team + trend → line, xField=month', () => {
    const cfg = buildConfig('team', 'trend', 'all', NO_DATES);
    expect(cfg.diagramType).toBe('line');
    expect(cfg.xField).toBe('month');
  });

  it('team + goals → doughnut (Anteil), xField=player, showLegend', () => {
    const cfg = buildConfig('team', 'goals', 'all', NO_DATES);
    expect(cfg.diagramType).toBe('doughnut');
    expect(cfg.xField).toBe('player');
    expect(cfg.showLegend).toBe(true);
  });

  it('player_comparison + goals → bar, xField=player, multiColor', () => {
    const cfg = buildConfig('player_comparison', 'goals', 'all', NO_DATES);
    expect(cfg.diagramType).toBe('bar');
    expect(cfg.xField).toBe('player');
    expect(cfg.multiColor).toBe(true);
    expect(cfg.showLegend).toBe(false);
  });

  it('team_comparison + goals → bar, xField=team, multiColor', () => {
    const cfg = buildConfig('team_comparison', 'goals', 'all', NO_DATES);
    expect(cfg.diagramType).toBe('bar');
    expect(cfg.xField).toBe('team');
    expect(cfg.multiColor).toBe(true);
    expect(cfg.showLegend).toBe(false);
  });

  it('team_comparison + trend → line, xField=month, groupBy=team', () => {
    const cfg = buildConfig('team_comparison', 'trend', 'all', NO_DATES);
    expect(cfg.diagramType).toBe('line');
    expect(cfg.xField).toBe('month');
    expect(cfg.groupBy).toBe('team');
  });

  it('player + minutesPlayed → bar by month, yField=minutesPlayed', () => {
    const cfg = buildConfig('player', 'minutesPlayed', 'all', NO_DATES);
    expect(cfg.diagramType).toBe('bar');
    expect(cfg.xField).toBe('month');
    expect(cfg.yField).toBe('minutesPlayed');
    expect(cfg.showLabels).toBe(true);
  });

  it('player + distance → bar by month, yField=distanceCovered', () => {
    const cfg = buildConfig('player', 'distance', 'all', NO_DATES);
    expect(cfg.diagramType).toBe('bar');
    expect(cfg.xField).toBe('month');
    expect(cfg.yField).toBe('distanceCovered');
    expect(cfg.showLabels).toBe(true);
  });

  it('team + minutesPlayed → bar, xField=player, yField=minutesPlayed, multiColor', () => {
    const cfg = buildConfig('team', 'minutesPlayed', 'all', NO_DATES);
    expect(cfg.diagramType).toBe('bar');
    expect(cfg.xField).toBe('player');
    expect(cfg.yField).toBe('minutesPlayed');
    expect(cfg.multiColor).toBe(true);
    expect(cfg.showLegend).toBe(false);
  });

  it('team + distance → bar, xField=player, yField=distanceCovered, multiColor', () => {
    const cfg = buildConfig('team', 'distance', 'all', NO_DATES);
    expect(cfg.diagramType).toBe('bar');
    expect(cfg.xField).toBe('player');
    expect(cfg.yField).toBe('distanceCovered');
    expect(cfg.multiColor).toBe(true);
    expect(cfg.showLegend).toBe(false);
  });

  it('player_comparison + minutesPlayed → bar, yField=minutesPlayed, multiColor', () => {
    const cfg = buildConfig('player_comparison', 'minutesPlayed', 'all', NO_DATES);
    expect(cfg.diagramType).toBe('bar');
    expect(cfg.yField).toBe('minutesPlayed');
    expect(cfg.multiColor).toBe(true);
    expect(cfg.showLegend).toBe(false);
  });

  it('player_comparison + distance → bar, yField=distanceCovered, multiColor', () => {
    const cfg = buildConfig('player_comparison', 'distance', 'all', NO_DATES);
    expect(cfg.diagramType).toBe('bar');
    expect(cfg.yField).toBe('distanceCovered');
    expect(cfg.multiColor).toBe(true);
    expect(cfg.showLegend).toBe(false);
  });
});

describe('buildConfig — overview-Metadaten', () => {
  it('overview enthält Metriken und radarNormalize=true', () => {
    const cfg = buildConfig('player', 'overview', 'all', NO_DATES);
    expect(cfg.radarNormalize).toBe(true);
    expect(cfg.metrics?.length).toBeGreaterThan(0);
    expect(cfg.showLegend).toBe(true);
  });
});

describe('buildConfig — Zeitfilter', () => {
  it('timeRange=all → keine Datumsfilter gesetzt', () => {
    const cfg = buildConfig('player', 'goals', 'all', NO_DATES);
    expect(cfg.filters?.dateFrom).toBeUndefined();
    expect(cfg.filters?.dateTo).toBeUndefined();
  });

  it('timeRange=last10 → dateFrom/dateTo aus den letzten 10 Einträgen', () => {
    const cfg = buildConfig('player', 'goals', 'last10', DATES_10);
    expect(cfg.filters?.dateFrom).toBe('2024-08-10');
    expect(cfg.filters?.dateTo).toBe('2024-10-26');
  });

  it('timeRange=last10 mit leeren availableDates → keine Datumsfilter', () => {
    const cfg = buildConfig('player', 'goals', 'last10', NO_DATES);
    expect(cfg.filters?.dateFrom).toBeUndefined();
  });

  it('timeRange=season → dateFrom enthält YYYY-08-01 oder YYYY-07-01 Muster', () => {
    const cfg = buildConfig('player', 'goals', 'season', NO_DATES);
    expect(cfg.filters?.dateFrom).toMatch(/^\d{4}-0[78]-01$/);
    expect(cfg.filters?.dateTo).toBeUndefined();
  });

  it('timeRange=last_month → dateFrom und dateTo gesetzt, diff ≤ 35 Tage', () => {
    const cfg = buildConfig('player', 'goals', 'last_month', NO_DATES);
    const from = new Date(cfg.filters!.dateFrom!);
    const to   = new Date(cfg.filters!.dateTo!);
    const diffDays = (to.getTime() - from.getTime()) / 86_400_000;
    expect(diffDays).toBeGreaterThanOrEqual(28);
    expect(diffDays).toBeLessThanOrEqual(35);
  });
});

describe('buildConfig — Kontext-IDs in filters', () => {
  it('subject=player mit selectedPlayerId → filters.player', () => {
    const cfg = buildConfig('player', 'goals', 'all', NO_DATES, null, 42);
    expect(cfg.filters?.player).toBe('42');
  });

  it('subject=team mit selectedTeamId → filters.team', () => {
    const cfg = buildConfig('team', 'goals', 'all', NO_DATES, 7);
    expect(cfg.filters?.team).toBe('7');
  });

  it('subject=player_comparison mit IDs → filters.players als Kommaliste', () => {
    const cfg = buildConfig('player_comparison', 'goals', 'all', NO_DATES, null, null, [], [3, 5]);
    expect(cfg.filters?.players).toBe('3,5');
  });

  it('subject=team_comparison mit IDs → filters.teams als Kommaliste', () => {
    const cfg = buildConfig('team_comparison', 'goals', 'all', NO_DATES, null, null, [1, 2]);
    expect(cfg.filters?.teams).toBe('1,2');
  });

  it('team_comparison mit genau 1 Team → setzt filters.teams UND filters.team (Rückwärtskompatibilität)', () => {
    const cfg = buildConfig('team_comparison', 'goals', 'all', NO_DATES, null, null, [5]);
    expect(cfg.filters?.teams).toBe('5');
    expect(cfg.filters?.team).toBe('5');
  });

  it('team_comparison mit ungültigem topic → Bar-Default (xField=team, yField=goals, multiColor)', () => {
    // topic='assists' existiert nicht als eigener Branch für team_comparison → fällt zum goals-Default
    const cfg = buildConfig('team_comparison', 'assists' as any, 'all', NO_DATES, null, null, []);
    expect(cfg.diagramType).toBe('bar');
    expect(cfg.xField).toBe('team');
    expect(cfg.yField).toBe('goals');
    expect(cfg.multiColor).toBe(true);
  });

  it('subject=player ohne selectedPlayerId → kein filters.player', () => {
    const cfg = buildConfig('player', 'goals', 'all', NO_DATES, null, null);
    expect(cfg.filters?.player).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// reverseMapWizardConfig
// ─────────────────────────────────────────────────────────────────────────────

/** Minimalconfig-Helfer */
function cfg(overrides: Record<string, any>) {
  return {
    diagramType: 'bar',
    xField: 'player',
    yField: 'goals',
    filters: {},
    ...overrides,
  } as any;
}

describe('reverseMapWizardConfig — Subject-Erkennung', () => {
  it('filters.players → player_comparison', () => {
    const r = reverseMapWizardConfig(cfg({ filters: { players: '1,2' } }), NO_DATES);
    expect(r?.subject).toBe('player_comparison');
  });

  it('filters.teams → team_comparison', () => {
    const r = reverseMapWizardConfig(cfg({ xField: 'team', filters: { teams: '1,2' } }), NO_DATES);
    expect(r?.subject).toBe('team_comparison');
  });

  it('filters.player → player', () => {
    const r = reverseMapWizardConfig(cfg({ filters: { player: '5' } }), NO_DATES);
    expect(r?.subject).toBe('player');
  });

  it('filters.team → team', () => {
    const r = reverseMapWizardConfig(cfg({ filters: { team: '3' } }), NO_DATES);
    expect(r?.subject).toBe('team');
  });

  it('xField=player, keine filter → player', () => {
    const r = reverseMapWizardConfig(cfg({ xField: 'player' }), NO_DATES);
    expect(r?.subject).toBe('player');
  });

  it('xField=team, keine filter → team_comparison', () => {
    const r = reverseMapWizardConfig(cfg({ xField: 'team', yField: 'goals' }), NO_DATES);
    expect(r?.subject).toBe('team_comparison');
  });

  it('xField=month, groupBy=team → team_comparison', () => {
    const r = reverseMapWizardConfig(cfg({ xField: 'month', groupBy: 'team', diagramType: 'line' }), NO_DATES);
    expect(r?.subject).toBe('team_comparison');
  });

  it('xField=month, kein groupBy=team → team (single)', () => {
    const r = reverseMapWizardConfig(cfg({ xField: 'month', diagramType: 'line' }), NO_DATES);
    expect(r?.subject).toBe('team');
  });
});

describe('reverseMapWizardConfig — Topic-Erkennung', () => {
  it('diagramType=radaroverlay → overview', () => {
    const r = reverseMapWizardConfig(cfg({ diagramType: 'radaroverlay', xField: 'player' }), NO_DATES);
    expect(r?.topic).toBe('overview');
  });

  it('xField=month (kein player-Filter) → trend', () => {
    const r = reverseMapWizardConfig(cfg({ xField: 'month', diagramType: 'line' }), NO_DATES);
    expect(r?.topic).toBe('trend');
  });

  it('xField=month + filters.player → topic aus yField (nicht trend)', () => {
    const r = reverseMapWizardConfig(
      cfg({ xField: 'month', diagramType: 'bar', yField: 'goals', filters: { player: '5' } }),
      NO_DATES,
    );
    expect(r?.topic).toBe('goals');
    expect(r?.subject).toBe('player');
  });

  it('xField=month + filters.player + yField=assists → assists', () => {
    const r = reverseMapWizardConfig(
      cfg({ xField: 'month', diagramType: 'bar', yField: 'assists', filters: { player: '5' } }),
      NO_DATES,
    );
    expect(r?.topic).toBe('assists');
  });

  it('yField=goals → goals', () => {
    const r = reverseMapWizardConfig(cfg({ yField: 'goals' }), NO_DATES);
    expect(r?.topic).toBe('goals');
  });

  it('yField=assists → assists', () => {
    const r = reverseMapWizardConfig(cfg({ yField: 'assists' }), NO_DATES);
    expect(r?.topic).toBe('assists');
  });

  it('yField=yellowCards → cards', () => {
    const r = reverseMapWizardConfig(cfg({ yField: 'yellowCards' }), NO_DATES);
    expect(r?.topic).toBe('cards');
  });

  it('yField=minutesPlayed → minutesPlayed', () => {
    const r = reverseMapWizardConfig(cfg({ diagramType: 'doughnut', xField: 'player', yField: 'minutesPlayed' }), NO_DATES);
    expect(r?.topic).toBe('minutesPlayed');
  });

  it('yField=distanceCovered → distance', () => {
    const r = reverseMapWizardConfig(cfg({ diagramType: 'doughnut', xField: 'player', yField: 'distanceCovered' }), NO_DATES);
    expect(r?.topic).toBe('distance');
  });

  it('xField=month + filters.player + yField=minutesPlayed → minutesPlayed', () => {
    const r = reverseMapWizardConfig(
      cfg({ xField: 'month', diagramType: 'bar', yField: 'minutesPlayed', filters: { player: '5' } }),
      NO_DATES,
    );
    expect(r?.topic).toBe('minutesPlayed');
  });

  it('xField=month + filters.player + yField=distanceCovered → distance', () => {
    const r = reverseMapWizardConfig(
      cfg({ xField: 'month', diagramType: 'bar', yField: 'distanceCovered', filters: { player: '5' } }),
      NO_DATES,
    );
    expect(r?.topic).toBe('distance');
  });
});

describe('reverseMapWizardConfig — TimeRange-Erkennung', () => {
  it('kein Datumsfilter → all', () => {
    const r = reverseMapWizardConfig(cfg({}), NO_DATES);
    expect(r?.timeRange).toBe('all');
  });

  it('dateFrom + dateTo mit diff ≤ 35 Tage → last_month', () => {
    const r = reverseMapWizardConfig(
      cfg({ filters: { dateFrom: '2024-10-01', dateTo: '2024-10-30' } }),
      NO_DATES,
    );
    expect(r?.timeRange).toBe('last_month');
  });

  it('dateFrom + dateTo == last 10 availableDates → last10', () => {
    const r = reverseMapWizardConfig(
      cfg({ filters: { dateFrom: DATES_10[0], dateTo: DATES_10[DATES_10.length - 1] } }),
      DATES_10,
    );
    expect(r?.timeRange).toBe('last10');
  });

  it('nur dateFrom mit YYYY-08-01-Muster → season', () => {
    const r = reverseMapWizardConfig(
      cfg({ filters: { dateFrom: '2024-08-01' } }),
      NO_DATES,
    );
    expect(r?.timeRange).toBe('season');
  });

  it('nur dateFrom mit YYYY-07-01-Muster → season', () => {
    const r = reverseMapWizardConfig(
      cfg({ filters: { dateFrom: '2024-07-01' } }),
      NO_DATES,
    );
    expect(r?.timeRange).toBe('season');
  });

  it('dateFrom + dateTo mit diff > 35 Tage und < 10 availableDates → all', () => {
    const r = reverseMapWizardConfig(
      cfg({ filters: { dateFrom: '2024-01-01', dateTo: '2024-06-01' } }),
      NO_DATES,
    );
    expect(r?.timeRange).toBe('all');
  });
});

describe('reverseMapWizardConfig — Kontext-Extraktion', () => {
  it('filters.player → playerId als Zahl', () => {
    const r = reverseMapWizardConfig(cfg({ filters: { player: '42' } }), NO_DATES);
    expect(r?.playerId).toBe(42);
  });

  it('filters.team → teamId als Zahl', () => {
    const r = reverseMapWizardConfig(cfg({ filters: { team: '7' } }), NO_DATES);
    expect(r?.teamId).toBe(7);
  });

  it('filters.players → comparisonPlayerIds als Zahlen-Array', () => {
    const r = reverseMapWizardConfig(cfg({ filters: { players: '3,5,8' } }), NO_DATES);
    expect(r?.comparisonPlayerIds).toEqual([3, 5, 8]);
  });

  it('filters.teams → comparisonTeamIds als Zahlen-Array', () => {
    const r = reverseMapWizardConfig(cfg({ xField: 'team', filters: { teams: '1,2' } }), NO_DATES);
    expect(r?.comparisonTeamIds).toEqual([1, 2]);
  });

  it('kein Kontext → leere Arrays und undefined-IDs', () => {
    const r = reverseMapWizardConfig(cfg({}), NO_DATES);
    expect(r?.playerId).toBeUndefined();
    expect(r?.teamId).toBeUndefined();
    expect(r?.comparisonPlayerIds).toEqual([]);
    expect(r?.comparisonTeamIds).toEqual([]);
  });
});

describe('reverseMapWizardConfig — gibt null zurück', () => {
  it('unbekanntes xField (z.B. event_type) → null (Subject nicht erkennbar)', () => {
    expect(reverseMapWizardConfig(cfg({ xField: 'event_type' }), NO_DATES)).toBeNull();
  });

  it('unbekanntes yField ohne andere Erkennungsmerkmale → null (Topic nicht erkennbar)', () => {
    expect(reverseMapWizardConfig(cfg({ yField: 'duelsWonPercent' }), NO_DATES)).toBeNull();
  });

  it('Topic passt nicht zum Subject → null (z.B. overview für team)', () => {
    // 'team' subject hat kein 'overview' in TOPIC_OPTIONS
    const r = reverseMapWizardConfig(
      cfg({ filters: { team: '1' }, diagramType: 'radaroverlay' }),
      NO_DATES,
    );
    expect(r).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isWizardCompatible
// ─────────────────────────────────────────────────────────────────────────────

describe('isWizardCompatible', () => {
  const yes = (overrides: Record<string, any>) =>
    expect(isWizardCompatible({ diagramType: 'bar', xField: 'player', yField: 'goals', filters: {}, ...overrides } as any)).toBe(true);
  const no = (overrides: Record<string, any>) =>
    expect(isWizardCompatible({ diagramType: 'bar', xField: 'player', yField: 'goals', filters: {}, ...overrides } as any)).toBe(false);

  it('bar + player + goals → kompatibel', () => yes({}));
  it('bar + player + assists → kompatibel', () => yes({ yField: 'assists' }));
  it('bar + player + yellowCards → kompatibel', () => yes({ yField: 'yellowCards' }));
  it('bar + player + shots → kompatibel (Wizard kann shots erzeugen)', () => yes({ yField: 'shots' }));
  it('bar + player + fouls → kompatibel (Wizard kann fouls erzeugen)', () => yes({ yField: 'fouls' }));
  it('bar + player + passes → kompatibel (Wizard kann passes erzeugen)', () => yes({ yField: 'passes' }));
  it('bar + player + minutesPlayed → kompatibel (PlayerGameStats)', () => yes({ yField: 'minutesPlayed' }));
  it('bar + player + distanceCovered → kompatibel (PlayerGameStats)', () => yes({ yField: 'distanceCovered' }));
  it('line + month + goals → kompatibel', () => yes({ diagramType: 'line', xField: 'month' }));
  it('bar + team + goals → kompatibel', () => yes({ xField: 'team' }));
  it('bar + team + shots → kompatibel (team_comparison shots)', () => yes({ xField: 'team', yField: 'shots' }));
  it('doughnut + player + goals → kompatibel (neue Wizard-Ausgabe)', () => yes({ diagramType: 'doughnut' }));
  it('doughnut + team + goals → kompatibel (team-Verteilung)', () => yes({ diagramType: 'doughnut', xField: 'team' }));
  it('bar + month + goals → kompatibel (Spieler über Zeit)', () => yes({ diagramType: 'bar', xField: 'month' }));
  it('radaroverlay + player → kompatibel (yField wird ignoriert)', () => yes({ diagramType: 'radaroverlay' }));
  it('radaroverlay + unbekanntes yField → trotzdem kompatibel', () => yes({ diagramType: 'radaroverlay', yField: 'shots' }));

  it('pie → nicht kompatibel', () => no({ diagramType: 'pie' }));
  it('scatter → nicht kompatibel', () => no({ diagramType: 'scatter' }));
  it('unbekanntes xField → nicht kompatibel', () => no({ xField: 'event_type' }));
  it('bar + player + duelsWonPercent → nicht kompatibel (kein Wizard-Thema)', () => no({ yField: 'duelsWonPercent' }));
});
