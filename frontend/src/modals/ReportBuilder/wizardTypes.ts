/**
 * Vocabulary types and option-data constants for the guided report wizard.
 *
 * This file is intentionally free of business logic and React dependencies
 * so it can be imported by both the hook, the logic module, and the UI.
 */

// ── Domain types ───────────────────────────────────────────────────────────────

export type Subject   = 'team' | 'player' | 'team_comparison' | 'player_comparison';
export type Topic     = 'goals' | 'assists' | 'cards' | 'trend' | 'overview' | 'shots' | 'fouls' | 'passes' | 'minutesPlayed' | 'distance';
export type TimeRange = 'season' | 'last10' | 'last_month' | 'all';

/** A selectable option card (subject, topic, or time-range step). */
export interface WizardOption<T extends string> {
  value: T;
  emoji: string;
  title: string;
  desc: string;
}

/** Reverse-mapped wizard state produced from an existing ReportConfig. */
export type WizardInitialState = {
  subject: Subject;
  topic: Topic;
  timeRange: TimeRange;
  teamId?: number;
  playerId?: number;
  comparisonTeamIds: number[];
  comparisonPlayerIds: number[];
};

/** Player search result entry (shared between step 1 variants). */
export type PlayerOption = {
  id: number;
  fullName: string;
  teamName?: string | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

/** Delay in ms before the wizard auto-advances after a card is tapped. */
export const AUTO_ADVANCE_DELAY = 420;

// Step indices:
// 0 = Subject  (Über wen?)
// 1 = Context  (Team/Spieler auswählen — only for some subjects)
// 2 = Topic    (Was soll angezeigt werden?)
// 3 = Time     (Welcher Zeitraum?)
// 4 = Confirm  (Name + Vorschau)

/** Static step labels; step 1 (context) is provided dynamically at render time. */
export const STEP_LABELS = [
  'Über wen?',
  '',
  'Was soll angezeigt werden?',
  'Welcher Zeitraum?',
] as const;

// ── Option data ───────────────────────────────────────────────────────────────

export const SUBJECT_OPTIONS: WizardOption<Subject>[] = [
  { value: 'team',              emoji: '👥', title: 'Unsere Mannschaft',        desc: 'Auswertung für eine bestimmte Mannschaft' },
  { value: 'player',            emoji: '🧑', title: 'Einen bestimmten Spieler', desc: 'Alles rund um eine einzelne Person' },
  { value: 'team_comparison',   emoji: '⚔️', title: 'Mannschaften vergleichen',  desc: 'Wie schneiden verschiedene Teams im Vergleich ab?' },
  { value: 'player_comparison', emoji: '🆚', title: 'Spieler vergleichen',       desc: 'Mehrere Spieler direkt nebeneinander vergleichen' },
];

export const TOPIC_OPTIONS: Record<Subject, WizardOption<Topic>[]> = {
  team: [
    { value: 'goals',        emoji: '⚽', title: 'Tore & Torjäger',  desc: 'Wer hat am häufigsten getroffen?' },
    { value: 'assists',      emoji: '🎯', title: 'Vorlagen',          desc: 'Wer bereitet die meisten Tore vor?' },
    { value: 'shots',        emoji: '💥', title: 'Torschüsse',        desc: 'Wer schießt am häufigsten aufs Tor?' },
    { value: 'cards',        emoji: '🟨', title: 'Karten & Fairness', desc: 'Wer hat Gelbe oder Rote Karten gesammelt?' },
    { value: 'fouls',        emoji: '⚠️', title: 'Fouls',             desc: 'Wer macht die meisten Fouls?' },
    { value: 'passes',       emoji: '🔄', title: 'Pässe',             desc: 'Wer spielt die meisten Pässe?' },
    { value: 'minutesPlayed',emoji: '⏱️', title: 'Einsatzminuten',    desc: 'Wer hat die meisten Spielminuten gesammelt?' },
    { value: 'distance',     emoji: '🏃', title: 'Laufleistung',      desc: 'Wer hat die meisten Meter zurückgelegt?' },
    { value: 'trend',        emoji: '📈', title: 'Saisonverlauf',     desc: 'Wie lief die Saison bisher?' },
  ],
  player: [
    { value: 'goals',        emoji: '⚽', title: 'Tore',            desc: 'Wie viele Tore hat der Spieler erzielt?' },
    { value: 'assists',      emoji: '🎯', title: 'Vorlagen',        desc: 'Wie viele Tore hat er vorbereitet?' },
    { value: 'shots',        emoji: '💥', title: 'Torschüsse',      desc: 'Wie oft schießt der Spieler aufs Tor?' },
    { value: 'cards',        emoji: '🟨', title: 'Karten',          desc: 'Welche Karten hat er bekommen?' },
    { value: 'fouls',        emoji: '⚠️', title: 'Fouls',           desc: 'Wie viele Fouls hat er begangen?' },
    { value: 'passes',       emoji: '🔄', title: 'Pässe',           desc: 'Wie viele Pässe spielt der Spieler?' },
    { value: 'minutesPlayed',emoji: '⏱️', title: 'Spielminuten',    desc: 'Wie viele Minuten hat der Spieler gespielt?' },
    { value: 'distance',     emoji: '🏃', title: 'Laufleistung',    desc: 'Wie viele Meter hat der Spieler zurückgelegt?' },
    { value: 'overview',     emoji: '🕸️', title: 'Stärken-Profil', desc: 'Alle Qualitäten auf einen Blick (Radar)' },
  ],
  team_comparison: [
    { value: 'goals', emoji: '⚽', title: 'Tore im Vergleich',    desc: 'Welches Team schießt am meisten?' },
    { value: 'shots', emoji: '💥', title: 'Schüsse im Vergleich', desc: 'Welches Team ist torgefährlicher?' },
    { value: 'cards', emoji: '🟨', title: 'Karten im Vergleich',  desc: 'Welches Team hat mehr Karten?' },
    { value: 'fouls', emoji: '⚠️', title: 'Fouls im Vergleich',   desc: 'Welches Team fouled mehr?' },
    { value: 'trend', emoji: '📈', title: 'Saisonverlauf',        desc: 'Wie entwickeln sich die Teams im Laufe der Saison?' },
  ],
  player_comparison: [
    { value: 'goals',        emoji: '⚽', title: 'Tore im Vergleich',           desc: 'Wer hat die meisten Tore erzielt?' },
    { value: 'assists',      emoji: '🎯', title: 'Vorlagen im Vergleich',        desc: 'Wer bereitet die meisten Tore vor?' },
    { value: 'shots',        emoji: '💥', title: 'Schüsse im Vergleich',        desc: 'Wer schießt öfter aufs Tor?' },
    { value: 'cards',        emoji: '🟨', title: 'Karten im Vergleich',         desc: 'Wer hat die meisten Karten gesammelt?' },
    { value: 'fouls',        emoji: '⚠️', title: 'Fouls im Vergleich',          desc: 'Wer macht mehr Fouls?' },
    { value: 'passes',       emoji: '🔄', title: 'Pässe im Vergleich',          desc: 'Wer spielt mehr Pässe?' },
    { value: 'minutesPlayed',emoji: '⏱️', title: 'Spielminuten im Vergleich',   desc: 'Wer hat mehr gespielt?' },
    { value: 'distance',     emoji: '🏃', title: 'Laufleistung im Vergleich',   desc: 'Wer hat mehr Meter zurückgelegt?' },
    { value: 'overview',     emoji: '🕸️', title: 'Stärken-Profil Vergleich',   desc: 'Alle Qualitäten der Spieler gleichzeitig (Radar)' },
  ],
};

export const TIME_OPTIONS: WizardOption<TimeRange>[] = [
  { value: 'season',     emoji: '📅', title: 'Diese Saison',           desc: 'Alle Spiele seit Saisonbeginn' },
  { value: 'last10',     emoji: '🔟', title: 'Letzte 10 Spiele',       desc: 'Die 10 zuletzt ausgetragenen Spiele' },
  { value: 'last_month', emoji: '📆', title: 'Letzter Monat',          desc: 'Die vergangenen 30 Tage' },
  { value: 'all',        emoji: '📚', title: 'Alle verfügbaren Daten', desc: 'Gesamte Datenhistorie' },
];
