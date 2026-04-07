/**
 * Pure (side-effect-free) business logic for the guided report wizard.
 *
 * No React or MUI imports — every function here is independently unit-testable.
 */

import type { Subject, Topic, TimeRange, WizardInitialState } from './wizardTypes';
import { TOPIC_OPTIONS } from './wizardTypes';
import type { ReportConfig } from './types';
import { DEFAULT_REPORT } from './types';

// ── Config builder ────────────────────────────────────────────────────────────

/** @visibleForTesting */
export function buildConfig(
  subject: Subject,
  topic: Topic,
  timeRange: TimeRange,
  availableDates: string[],
  selectedTeamId?: number | null,
  selectedPlayerId?: number | null,
  selectedComparisonTeamIds?: number[],
  selectedComparisonPlayerIds?: number[],
): ReportConfig {
  const base: ReportConfig = { ...DEFAULT_REPORT.config, filters: {} };
  const filters: Record<string, string> = {};

  // Time filter
  if (timeRange === 'last10' && availableDates.length > 0) {
    const dates = availableDates.slice(-10);
    filters.dateFrom = dates[0];
    filters.dateTo = dates[dates.length - 1];
  } else if (timeRange === 'last_month') {
    const now = new Date();
    const from = new Date();
    from.setDate(now.getDate() - 30);
    filters.dateFrom = from.toISOString().split('T')[0];
    filters.dateTo = now.toISOString().split('T')[0];
  } else if (timeRange === 'season') {
    const now = new Date();
    const seasonYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    filters.dateFrom = `${seasonYear}-08-01`;
  }
  // 'all' → no filter

  // Team filter (applies for 'team' subject)
  if (subject === 'team' && selectedTeamId) {
    filters.team = String(selectedTeamId);
  }

  // Player filter (applies for 'player' subject)
  if (subject === 'player' && selectedPlayerId) {
    filters.player = String(selectedPlayerId);
  }

  // Team comparison: store selected team IDs in filters.teams (comma-sep);
  // if only 1 team selected also set filters.team for backwards-compat with single-team filter
  if (subject === 'team_comparison' && selectedComparisonTeamIds && selectedComparisonTeamIds.length > 0) {
    filters.teams = selectedComparisonTeamIds.join(',');
    if (selectedComparisonTeamIds.length === 1) {
      filters.team = String(selectedComparisonTeamIds[0]);
    }
  }

  // Player comparison filter: restrict to selected players (comma-sep IDs)
  if (subject === 'player_comparison' && selectedComparisonPlayerIds && selectedComparisonPlayerIds.length > 0) {
    filters.players = selectedComparisonPlayerIds.join(',');
  }

  if (subject === 'player_comparison') {
    if (topic === 'overview') {
      return {
        ...base,
        diagramType: 'radaroverlay',
        xField: 'player',
        yField: 'goals',
        metrics: ['goals', 'assists', 'shots', 'dribbles', 'duelsWonPercent', 'passes'],
        radarNormalize: true,
        showLegend: true,
        filters,
      };
    }
    if (topic === 'assists') return { ...base, diagramType: 'bar', xField: 'player', yField: 'assists',     showLegend: false, filters };
    if (topic === 'cards')   return { ...base, diagramType: 'bar', xField: 'player', yField: 'yellowCards', showLegend: false, filters };
    if (topic === 'shots')   return { ...base, diagramType: 'bar', xField: 'player', yField: 'shots',       showLegend: false, filters };
    if (topic === 'fouls')   return { ...base, diagramType: 'bar', xField: 'player', yField: 'fouls',       showLegend: false, filters };
    if (topic === 'passes')  return { ...base, diagramType: 'bar', xField: 'player', yField: 'passes',      showLegend: false, filters };
    /* goals (default) */     return { ...base, diagramType: 'bar', xField: 'player', yField: 'goals',       showLegend: false, filters };
  }

  if (subject === 'team_comparison') {
    if (topic === 'goals')  return { ...base, diagramType: 'bar',  xField: 'team',  yField: 'goals',       showLegend: false, filters };
    if (topic === 'cards')  return { ...base, diagramType: 'bar',  xField: 'team',  yField: 'yellowCards', showLegend: false, filters };
    if (topic === 'shots')  return { ...base, diagramType: 'bar',  xField: 'team',  yField: 'shots',       showLegend: false, filters };
    if (topic === 'fouls')  return { ...base, diagramType: 'bar',  xField: 'team',  yField: 'fouls',       showLegend: false, filters };
    if (topic === 'trend')  return { ...base, diagramType: 'line', xField: 'month', yField: 'goals', groupBy: 'team', showLegend: true, filters };
    return { ...base, diagramType: 'bar', xField: 'team', yField: 'goals', showLegend: false, filters };
  }

  if (topic === 'trend') {
    return { ...base, diagramType: 'line', xField: 'month', yField: 'goals', showLegend: false, filters };
  }
  if (topic === 'overview') {
    return {
      ...base,
      diagramType: 'radaroverlay',
      xField: 'player',
      yField: 'goals',
      metrics: ['goals', 'assists', 'shots', 'dribbles', 'duelsWonPercent', 'passes'],
      radarNormalize: true,
      showLegend: true,
      filters,
    };
  }
  if (topic === 'assists') return { ...base, diagramType: 'bar', xField: 'player', yField: 'assists',     showLegend: false, filters };
  if (topic === 'cards')   return { ...base, diagramType: 'bar', xField: 'player', yField: 'yellowCards', showLegend: false, filters };
  if (topic === 'shots')   return { ...base, diagramType: 'bar', xField: 'player', yField: 'shots',       showLegend: false, filters };
  if (topic === 'fouls')   return { ...base, diagramType: 'bar', xField: 'player', yField: 'fouls',       showLegend: false, filters };
  if (topic === 'passes')  return { ...base, diagramType: 'bar', xField: 'player', yField: 'passes',      showLegend: false, filters };
  /* goals (default) */     return { ...base, diagramType: 'bar', xField: 'player', yField: 'goals',       showLegend: false, filters };
}

// ── Config reverse-mapper ─────────────────────────────────────────────────────

/**
 * Attempts to reverse a ReportConfig back into the wizard's selection state.
 * Returns null if the config cannot be unambiguously mapped.
 * @visibleForTesting
 */
export function reverseMapWizardConfig(
  config: ReportConfig,
  availableDates: string[],
): WizardInitialState | null {
  const f = config.filters ?? {};

  // ── Subject
  let subject: Subject;
  if (f.players)                     subject = 'player_comparison';
  else if (f.teams)                  subject = 'team_comparison';
  else if (f.player)                 subject = 'player';
  else if (f.team)                   subject = 'team';
  else if (config.xField === 'team') subject = 'team_comparison';
  else if (config.xField === 'month') {
    const gb = config.groupBy;
    subject = (gb === 'team' || (Array.isArray(gb) && (gb as string[]).includes('team')))
      ? 'team_comparison' : 'team';
  }
  else if (config.xField === 'player') subject = 'player';
  else return null;

  // ── Topic
  let topic: Topic;
  if (config.diagramType === 'radaroverlay')  topic = 'overview';
  else if (config.xField === 'month')         topic = 'trend';
  else if (config.yField === 'goals')         topic = 'goals';
  else if (config.yField === 'assists')       topic = 'assists';
  else if (config.yField === 'yellowCards')   topic = 'cards';
  else if (config.yField === 'shots')         topic = 'shots';
  else if (config.yField === 'fouls')         topic = 'fouls';
  else if (config.yField === 'passes')        topic = 'passes';
  else return null;

  // Validate topic exists for this subject
  if (!TOPIC_OPTIONS[subject]?.some(o => o.value === topic)) return null;

  // ── TimeRange
  let timeRange: TimeRange = 'all';
  const { dateFrom, dateTo } = f;
  if (dateFrom && dateTo) {
    const diffDays = (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86_400_000;
    if (diffDays <= 35) {
      timeRange = 'last_month';
    } else if (availableDates.length >= 10) {
      const l10from = availableDates.slice(-10)[0];
      const l10to   = availableDates[availableDates.length - 1];
      timeRange = (dateFrom === l10from && dateTo === l10to) ? 'last10' : 'all';
    }
  } else if (dateFrom && !dateTo) {
    if (/\d{4}-0[78]-01/.test(dateFrom)) timeRange = 'season';
  }

  return {
    subject, topic, timeRange,
    teamId:              f.team    ? Number(f.team)                                   : undefined,
    playerId:            f.player  ? Number(f.player)                                 : undefined,
    comparisonTeamIds:   f.teams   ? f.teams.split(',').map(Number).filter(Boolean)   : [],
    comparisonPlayerIds: f.players ? f.players.split(',').map(Number).filter(Boolean) : [],
  };
}

// ── Compatibility check ───────────────────────────────────────────────────────

/**
 * Returns true when a saved config was likely generated by the guided wizard
 * and can be cleanly reverse-mapped for re-editing.
 * @visibleForTesting
 */
export function isWizardCompatible(config: ReportConfig): boolean {
  if (!['bar', 'line', 'radaroverlay'].includes(config.diagramType)) return false;
  if (!['player', 'team', 'month'].includes(config.xField ?? '')) return false;
  if (config.diagramType !== 'radaroverlay' &&
      !['goals', 'assists', 'yellowCards'].includes(config.yField ?? '')) return false;
  return true;
}

// ── Name builder ──────────────────────────────────────────────────────────────

export function buildName(
  subject: Subject,
  topic: Topic,
  timeRange: TimeRange,
  contextLabel?: string,
): string {
  const subjectLabel: Record<Subject, string>   = { team: 'Mannschaft', player: 'Spieler', team_comparison: 'Vergleich', player_comparison: 'Spielervergleich' };
  const topicLabel:   Record<Topic, string>     = { goals: 'Tore', assists: 'Vorlagen', cards: 'Karten', trend: 'Saisonverlauf', overview: 'Stärken-Profil', shots: 'Torschüsse', fouls: 'Fouls', passes: 'Pässe' };
  const timeLabel:    Record<TimeRange, string> = { season: 'diese Saison', last10: 'letzte 10 Spiele', last_month: 'letzter Monat', all: '' };
  const time = timeLabel[timeRange];
  const label = contextLabel || subjectLabel[subject];
  return `${label}: ${topicLabel[topic]}${time ? ` (${time})` : ''}`;
}
