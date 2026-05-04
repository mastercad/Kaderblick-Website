/**
 * Pure (side-effect-free) business logic for the guided report wizard.
 *
 * No React or MUI imports — every function here is independently unit-testable.
 */

import type { Subject, Topic, TimeRange, WizardInitialState } from './wizardTypes';
import { TOPIC_OPTIONS } from './wizardTypes';
import type { ReportConfig } from './types';
import { DEFAULT_REPORT } from './types';

// ── Suggested diagram types ───────────────────────────────────────────────────

/** Labels for the subset of chart types shown in the wizard type-switcher. */
export const WIZARD_DIAGRAM_TYPE_LABELS: Record<string, string> = {
  bar:          'Balken',
  doughnut:     'Donut',
  pie:          'Kreis',
  line:         'Linie',
  area:         'Fläche',
  radaroverlay: 'Radar',
};

/**
 * Returns an ordered list of chart types that make sense for the given subject + topic.
 * First entry = recommended default (used by buildConfig).
 * The list is shown as a type-switcher on the wizard confirm step.
 */
export function getSuggestedTypes(subject: Subject, topic: Topic): string[] {
  if (topic === 'overview') return ['radaroverlay'];
  if (topic === 'trend')    return ['line', 'area', 'bar'];
  if (subject === 'player') return ['bar', 'line', 'area'];

  // For team distribution: proportional topics (who scored what share?) → doughnut first
  const proportional: Topic[] = ['goals', 'assists', 'shots'];
  if (subject === 'team' && proportional.includes(topic)) {
    return ['doughnut', 'bar', 'pie'];
  }

  // Everything else (absolute metrics, comparisons) → bar is most readable
  return ['bar', 'doughnut', 'pie'];
}

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
    // Store semantic value — resolved dynamically at query time (frontend display + backend)
    filters.seasonFilter = 'current';
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
    // Bar chart, one bar per player, each bar gets its own colour via multiColor
    if (topic === 'assists')      return { ...base, diagramType: 'bar', xField: 'player', yField: 'assists',         multiColor: true, showLegend: false, showLabels: true, filters };
    if (topic === 'cards')        return { ...base, diagramType: 'bar', xField: 'player', yField: 'yellowCards',     multiColor: true, showLegend: false, showLabels: true, filters };
    if (topic === 'shots')        return { ...base, diagramType: 'bar', xField: 'player', yField: 'shots',           multiColor: true, showLegend: false, showLabels: true, filters };
    if (topic === 'fouls')        return { ...base, diagramType: 'bar', xField: 'player', yField: 'fouls',           multiColor: true, showLegend: false, showLabels: true, filters };
    if (topic === 'passes')       return { ...base, diagramType: 'bar', xField: 'player', yField: 'passes',          multiColor: true, showLegend: false, showLabels: true, filters };
    if (topic === 'minutesPlayed') return { ...base, diagramType: 'bar', xField: 'player', yField: 'minutesPlayed',  multiColor: true, showLegend: false, showLabels: true, filters };
    if (topic === 'distance')     return { ...base, diagramType: 'bar', xField: 'player', yField: 'distanceCovered', multiColor: true, showLegend: false, showLabels: true, filters };
    if (topic === 'trend')        return { ...base, diagramType: 'line', xField: 'month', yField: 'goals', groupBy: 'player', showLegend: true, filters };
    /* goals (default) */          return { ...base, diagramType: 'bar', xField: 'player', yField: 'goals',           multiColor: true, showLegend: false, showLabels: true, filters };
  }

  if (subject === 'team_comparison') {
    // Bar chart, one bar per team, each bar gets its own colour via multiColor
    if (topic === 'cards')  return { ...base, diagramType: 'bar', xField: 'team', yField: 'yellowCards', multiColor: true, showLegend: false, showLabels: true, filters };
    if (topic === 'shots')  return { ...base, diagramType: 'bar', xField: 'team', yField: 'shots',       multiColor: true, showLegend: false, showLabels: true, filters };
    if (topic === 'fouls')  return { ...base, diagramType: 'bar', xField: 'team', yField: 'fouls',       multiColor: true, showLegend: false, showLabels: true, filters };
    if (topic === 'trend')  return { ...base, diagramType: 'line', xField: 'month', yField: 'goals', groupBy: 'team', showLegend: true, filters };
    /* goals (default) */    return { ...base, diagramType: 'bar', xField: 'team', yField: 'goals',       multiColor: true, showLegend: false, showLabels: true, filters };
  }

  // subject === 'player': show the metric over time (bar per month) — one colour is fine
  // since it's a single player's progression, not a comparison.
  if (subject === 'player') {
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
    if (topic === 'assists')       return { ...base, diagramType: 'bar', xField: 'month', yField: 'assists',         showLegend: false, showLabels: true, filters };
    if (topic === 'shots')         return { ...base, diagramType: 'bar', xField: 'month', yField: 'shots',           showLegend: false, showLabels: true, filters };
    if (topic === 'cards')         return { ...base, diagramType: 'bar', xField: 'month', yField: 'yellowCards',     showLegend: false, showLabels: true, filters };
    if (topic === 'fouls')         return { ...base, diagramType: 'bar', xField: 'month', yField: 'fouls',           showLegend: false, showLabels: true, filters };
    if (topic === 'passes')        return { ...base, diagramType: 'bar', xField: 'month', yField: 'passes',          showLegend: false, showLabels: true, filters };
    if (topic === 'minutesPlayed') return { ...base, diagramType: 'bar', xField: 'month', yField: 'minutesPlayed',   showLegend: false, showLabels: true, filters };
    if (topic === 'distance')      return { ...base, diagramType: 'bar', xField: 'month', yField: 'distanceCovered', showLegend: false, showLabels: true, filters };
    /* goals (default) */           return { ...base, diagramType: 'bar', xField: 'month', yField: 'goals',           showLegend: false, showLabels: true, filters };
  }

  // subject === 'team': distribution among players
  // Proportional topics (part-of-whole) → doughnut; absolute metrics → bar+multiColor
  if (topic === 'trend')         return { ...base, diagramType: 'line',     xField: 'month',  yField: 'goals',           showLegend: false, filters };
  if (topic === 'goals')         return { ...base, diagramType: 'doughnut', xField: 'player', yField: 'goals',            showLegend: true,  filters };
  if (topic === 'assists')       return { ...base, diagramType: 'doughnut', xField: 'player', yField: 'assists',          showLegend: true,  filters };
  if (topic === 'shots')         return { ...base, diagramType: 'doughnut', xField: 'player', yField: 'shots',            showLegend: true,  filters };
  if (topic === 'cards')         return { ...base, diagramType: 'bar',      xField: 'player', yField: 'yellowCards',      multiColor: true, showLegend: false, showLabels: true, filters };
  if (topic === 'fouls')         return { ...base, diagramType: 'bar',      xField: 'player', yField: 'fouls',            multiColor: true, showLegend: false, showLabels: true, filters };
  if (topic === 'passes')        return { ...base, diagramType: 'bar',      xField: 'player', yField: 'passes',           multiColor: true, showLegend: false, showLabels: true, filters };
  if (topic === 'minutesPlayed') return { ...base, diagramType: 'bar',      xField: 'player', yField: 'minutesPlayed',    multiColor: true, showLegend: false, showLabels: true, filters };
  if (topic === 'distance')      return { ...base, diagramType: 'bar',      xField: 'player', yField: 'distanceCovered',  multiColor: true, showLegend: false, showLabels: true, filters };
  /* goals (default) */           return { ...base, diagramType: 'doughnut', xField: 'player', yField: 'goals',            showLegend: true,  filters };
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
  if (config.diagramType === 'radaroverlay') {
    topic = 'overview';
  } else if (config.xField === 'month' && f.player) {
    // New wizard format: single player metric displayed as bars-by-month
    if      (config.yField === 'goals')          topic = 'goals';
    else if (config.yField === 'assists')        topic = 'assists';
    else if (config.yField === 'yellowCards')    topic = 'cards';
    else if (config.yField === 'shots')          topic = 'shots';
    else if (config.yField === 'fouls')          topic = 'fouls';
    else if (config.yField === 'passes')         topic = 'passes';
    else if (config.yField === 'minutesPlayed')  topic = 'minutesPlayed';
    else if (config.yField === 'distanceCovered') topic = 'distance';
    else return null;
  } else if (config.xField === 'month') {
    topic = 'trend';
  } else if (config.yField === 'goals')           topic = 'goals';
  else if (config.yField === 'assists')          topic = 'assists';
  else if (config.yField === 'yellowCards')      topic = 'cards';
  else if (config.yField === 'shots')            topic = 'shots';
  else if (config.yField === 'fouls')            topic = 'fouls';
  else if (config.yField === 'passes')           topic = 'passes';
  else if (config.yField === 'minutesPlayed')    topic = 'minutesPlayed';
  else if (config.yField === 'distanceCovered')  topic = 'distance';
  else return null;

  // Validate topic exists for this subject
  if (!TOPIC_OPTIONS[subject]?.some(o => o.value === topic)) return null;

  // ── TimeRange
  let timeRange: TimeRange = 'all';
  const { dateFrom, dateTo, seasonFilter } = f;
  if (seasonFilter === 'current' || (seasonFilter && /^\d{4}$/.test(seasonFilter))) {
    // New semantic filter — both 'current' and fixed-year '2024' map back to the season step
    timeRange = 'season';
  } else if (dateFrom && dateTo) {
    const diffDays = (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86_400_000;
    if (diffDays <= 35) {
      timeRange = 'last_month';
    } else if (availableDates.length >= 10) {
      const l10from = availableDates.slice(-10)[0];
      const l10to   = availableDates[availableDates.length - 1];
      timeRange = (dateFrom === l10from && dateTo === l10to) ? 'last10' : 'all';
    }
  } else if (dateFrom && !dateTo) {
    // Legacy: static season start date saved before seasonFilter was introduced
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
  // Accept bar and line (new wizard output) as well as doughnut (legacy wizard output before the fix)
  // and radaroverlay (overview topic).
  if (!['bar', 'line', 'radaroverlay', 'doughnut'].includes(config.diagramType)) return false;
  if (!['player', 'team', 'month'].includes(config.xField ?? '')) return false;
  if (config.diagramType !== 'radaroverlay' &&
      !['goals', 'assists', 'yellowCards', 'shots', 'fouls', 'passes', 'minutesPlayed', 'distanceCovered'].includes(config.yField ?? '')) return false;
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
  const topicLabel:   Record<Topic, string>     = { goals: 'Tore', assists: 'Vorlagen', cards: 'Karten', trend: 'Saisonverlauf', overview: 'Stärken-Profil', shots: 'Torschüsse', fouls: 'Fouls', passes: 'Pässe', minutesPlayed: 'Spielminuten', distance: 'Laufleistung' };
  const timeLabel:    Record<TimeRange, string> = { season: 'aktuelle Saison', last10: 'letzte 10 Spiele', last_month: 'letzter Monat', all: '' };
  const time = timeLabel[timeRange];
  const label = contextLabel || subjectLabel[subject];
  return `${label}: ${topicLabel[topic]}${time ? ` (${time})` : ''}`;
}
