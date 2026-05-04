import type { ReportConfig } from './types';

export type TemplateCategory = 'spieler' | 'team' | 'vergleich' | 'wetter';

export interface TemplateMeta {
  emoji: string;
  title: string;
  desc: string;
  category: TemplateCategory;
  config: Partial<ReportConfig>;
}

export const TEMPLATE_META: Record<string, TemplateMeta> = {
  goals_per_player: {
    emoji: '⚽',
    title: 'Torjäger-Ranking',
    desc: 'Wer hat die meisten Tore geschossen?',
    category: 'spieler',
    config: { diagramType: 'bar', xField: 'player', yField: 'goals', showLegend: false, showLabels: false, filters: {} },
  },
  assists_per_player: {
    emoji: '🎯',
    title: 'Vorlagen-Ranking',
    desc: 'Wer hat die meisten Tore vorbereitet?',
    category: 'spieler',
    config: { diagramType: 'bar', xField: 'player', yField: 'assists', showLegend: false, showLabels: false, filters: {} },
  },
  cards_per_player: {
    emoji: '🟨',
    title: 'Karten & Fairness',
    desc: 'Wer hat wie viele Karten bekommen?',
    category: 'spieler',
    config: { diagramType: 'bar', xField: 'player', yField: 'yellowCards', showLegend: false, showLabels: false, filters: {} },
  },
  goals_per_month: {
    emoji: '📈',
    title: 'Saisonverlauf',
    desc: 'Wie hat sich das Team im Laufe der Saison entwickelt?',
    category: 'team',
    config: { diagramType: 'line', xField: 'month', yField: 'goals', showLegend: false, showLabels: false, filters: {} },
  },
  goals_per_team: {
    emoji: '⚔️',
    title: 'Team-Torvergleich',
    desc: 'Welches Team erzielt am meisten Tore?',
    category: 'vergleich',
    config: { diagramType: 'bar', xField: 'team', yField: 'goals', showLegend: false, showLabels: false, filters: {} },
  },
  goals_home_away: {
    emoji: '🏠',
    title: 'Heim vs. Auswärts',
    desc: 'Erzielen wir zuhause oder auswärts mehr Tore?',
    category: 'team',
    config: { diagramType: 'bar', xField: 'homeAway', yField: 'goals', showLegend: false, showLabels: false, filters: {} },
  },
  goals_per_position: {
    emoji: '🗺️',
    title: 'Tore nach Position',
    desc: 'Welche Positionen erzielen die meisten Tore?',
    category: 'team',
    config: { diagramType: 'pie', xField: 'position', yField: 'goals', showLegend: true, showLabels: false, filters: {} },
  },
  player_radar: {
    emoji: '🕸️',
    title: 'Spieler-Stärken',
    desc: 'Alle Qualitäten mehrerer Spieler auf einen Blick.',
    category: 'spieler',
    config: {
      diagramType: 'radar',
      xField: 'player',
      yField: 'goals',
      metrics: ['goals', 'assists', 'shots', 'dribbles', 'duelsWonPercent', 'passes'],
      radarNormalize: true,
      showLegend: true,
      showLabels: false,
      filters: {},
    },
  },
  performance_by_surface: {
    emoji: '🟢',
    title: 'Spielfeld-Leistung',
    desc: 'Auf welchem Untergrund spielen wir am besten?',
    category: 'wetter',
    config: {
      diagramType: 'radaroverlay',
      xField: 'surfaceType',
      yField: 'goals',
      metrics: ['goals', 'assists', 'shots', 'yellowCards', 'fouls'],
      showLegend: true,
      showLabels: false,
      filters: {},
    },
  },
  performance_by_weather: {
    emoji: '⛅',
    title: 'Wetter & Leistung',
    desc: 'Beeinflusst das Wetter unser Spiel?',
    category: 'wetter',
    config: {
      diagramType: 'radaroverlay',
      xField: 'weatherCondition',
      yField: 'goals',
      metrics: ['goals', 'assists', 'shots', 'yellowCards', 'fouls'],
      showLegend: true,
      showLabels: false,
      filters: {},
    },
  },
  goals_per_game_type: {
    emoji: '🏆',
    title: 'Liga, Pokal & Co.',
    desc: 'So unterscheidet sich die Torquote nach Spieltyp.',
    category: 'team',
    config: { diagramType: 'bar', xField: 'gameType', yField: 'goals', showLegend: false, showLabels: false, filters: {} },
  },
  shots_per_player: {
    emoji: '💥',
    title: 'Torschuss-Ranking',
    desc: 'Wer schießt am häufigsten aufs Tor?',
    category: 'spieler',
    config: { diagramType: 'bar', xField: 'player', yField: 'shots', showLegend: false, showLabels: false, filters: {} },
  },
  shots_per_month: {
    emoji: '📊',
    title: 'Torschüsse im Saisonverlauf',
    desc: 'Entwickelt sich unsere Torgefahr über die Saison?',
    category: 'team',
    config: { diagramType: 'line', xField: 'month', yField: 'shots', showLegend: false, showLabels: false, filters: {} },
  },
  shots_per_team: {
    emoji: '💥',
    title: 'Schuss-Vergleich Mannschaften',
    desc: 'Welches Team ist am torgefährlichsten?',
    category: 'vergleich',
    config: { diagramType: 'bar', xField: 'team', yField: 'shots', showLegend: false, showLabels: false, filters: {} },
  },
  shots_home_away: {
    emoji: '🏠',
    title: 'Schüsse Heim vs. Auswärts',
    desc: 'Sind wir zuhause torgefährlicher als auswärts?',
    category: 'team',
    config: { diagramType: 'bar', xField: 'homeAway', yField: 'shots', showLegend: false, showLabels: false, filters: {} },
  },
  fouls_per_player: {
    emoji: '⚠️',
    title: 'Foulspieler-Ranking',
    desc: 'Wer macht die meisten Fouls?',
    category: 'spieler',
    config: { diagramType: 'bar', xField: 'player', yField: 'fouls', showLegend: false, showLabels: false, filters: {} },
  },
  red_cards_per_player: {
    emoji: '🟥',
    title: 'Rote Karten',
    desc: 'Wer wurde am häufigsten des Feldes verwiesen?',
    category: 'spieler',
    config: { diagramType: 'bar', xField: 'player', yField: 'redCards', showLegend: false, showLabels: false, filters: {} },
  },
  fouls_per_team: {
    emoji: '⚠️',
    title: 'Fouls-Vergleich Mannschaften',
    desc: 'Welches Team fouled mehr – in der Liga und im Pokal?',
    category: 'vergleich',
    config: { diagramType: 'bar', xField: 'team', yField: 'fouls', showLegend: false, showLabels: false, filters: {} },
  },
  fouls_per_gameType: {
    emoji: '⚠️',
    title: 'Fouls nach Wettbewerb',
    desc: 'Spielen wir im Pokal fairer als in der Liga?',
    category: 'team',
    config: { diagramType: 'bar', xField: 'gameType', yField: 'fouls', showLegend: false, showLabels: false, filters: {} },
  },
  passes_per_player: {
    emoji: '🔄',
    title: 'Pass-Meister',
    desc: 'Wer ist unser aktivster Passspieler?',
    category: 'spieler',
    config: { diagramType: 'bar', xField: 'player', yField: 'passes', showLegend: false, showLabels: false, filters: {} },
  },
  passes_per_team: {
    emoji: '🔄',
    title: 'Pass-Vergleich Mannschaften',
    desc: 'Welches Team spielt mehr Pässe?',
    category: 'vergleich',
    config: { diagramType: 'bar', xField: 'team', yField: 'passes', showLegend: false, showLabels: false, filters: {} },
  },
  tackles_per_player: {
    emoji: '🛡️',
    title: 'Zweikampf-Stärke',
    desc: 'Wer gewinnt die meisten Tacklings?',
    category: 'spieler',
    config: { diagramType: 'bar', xField: 'player', yField: 'tackles', showLegend: false, showLabels: false, filters: {} },
  },
  interceptions_per_player: {
    emoji: '✋',
    title: 'Ballgewinner-Ranking',
    desc: 'Wer unterbricht die meisten gegnerischen Angriffe?',
    category: 'spieler',
    config: { diagramType: 'bar', xField: 'player', yField: 'interceptions', showLegend: false, showLabels: false, filters: {} },
  },
  saves_per_player: {
    emoji: '🧤',
    title: 'Torwart-Paraden',
    desc: 'Wer hält die meisten Schüsse – Torhüter im Vergleich.',
    category: 'spieler',
    config: { diagramType: 'bar', xField: 'player', yField: 'saves', showLegend: false, showLabels: false, filters: {} },
  },
  offensive_radar: {
    emoji: '⚔️',
    title: 'Offensiv-Profil',
    desc: 'Tore, Schüsse, Vorlagen & Pässe auf einen Blick.',
    category: 'spieler',
    config: {
      diagramType: 'radaroverlay',
      xField: 'player',
      yField: 'goals',
      metrics: ['goals', 'assists', 'shots', 'passes', 'dribbles'],
      radarNormalize: true,
      showLegend: true,
      showLabels: false,
      filters: {},
    },
  },
  defensive_radar: {
    emoji: '🛡️',
    title: 'Defensiv-Profil',
    desc: 'Tackles, Interceptions & Pässe – wer ist unser bester Verteidiger?',
    category: 'spieler',
    config: {
      diagramType: 'radaroverlay',
      xField: 'player',
      yField: 'tackles',
      metrics: ['tackles', 'interceptions', 'saves', 'passes', 'dribbles'],
      radarNormalize: true,
      showLegend: true,
      showLabels: false,
      filters: {},
    },
  },
};

/**
 * Returns the key of the first template whose core display axes match the given config.
 * Matches on diagramType + xField + yField — the three fields that uniquely identify a
 * "what is being shown" combination.  Filters and visual options (showLegend etc.) are
 * intentionally ignored so per-team customisations don't break the match.
 */
export function findMatchingTemplateKey(config: Partial<ReportConfig>): string | null {
  if (!config.diagramType && !config.xField && !config.yField) return null;
  for (const [key, meta] of Object.entries(TEMPLATE_META)) {
    if (
      meta.config.diagramType === config.diagramType &&
      meta.config.xField      === config.xField      &&
      meta.config.yField      === config.yField
    ) {
      return key;
    }
  }
  return null;
}

export const TEMPLATE_CATEGORIES = [
  { key: 'alle',      label: 'Alle' },
  { key: 'spieler',  label: 'Spieler' },
  { key: 'team',     label: 'Team & Saison' },
  { key: 'vergleich', label: 'Vergleich' },
  { key: 'wetter',   label: 'Wetter & Feld' },
] as const;
