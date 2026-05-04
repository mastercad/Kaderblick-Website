/**
 * Gemeinsame Gruppierungslogik für Ereignistypen.
 * Wird in GameEventModal (Spielereignis anlegen) und StepFilters (Report-Filter) verwendet.
 */

export interface EventTypeGroupInfo {
  group: string;
  groupOrder: number;
}

/** Codes die in der Gruppe "★ Häufig genutzt" erscheinen */
export const FAVORITE_CODES = new Set([
  'goal', 'own_goal', 'penalty_goal', 'freekick_goal', 'header_goal',
  'assist',
  'yellow_card', 'red_card', 'yellow_red_card',
  'substitution', 'substitution_in', 'substitution_out', 'substitution_injury',
  'foul', 'penalty_foul',
  'shot_on_target', 'corner',
]);

export function getGroupInfo(code: string): EventTypeGroupInfo {
  if (FAVORITE_CODES.has(code)) return { group: '★ Häufig genutzt', groupOrder: 0 };
  if (/_goal$/.test(code) || code === 'own_goal_attempt') return { group: 'Tore', groupOrder: 1 };
  if (code.includes('_card') || code === 'dangerous_play' ||
      (code.startsWith('foul') && code !== 'foul') ||
      ['handball', 'unsporting', 'obstruct_keeper', 'dive', 'time_wasting',
       'bad_throw_in', 'delay_of_game', 'technical_offense', 'offside'].includes(code))
    return { group: 'Karten & Fouls', groupOrder: 2 };
  if (code.startsWith('substitution') || code === 'sub_goal') return { group: 'Auswechslungen', groupOrder: 3 };
  if (code.startsWith('shot') || ['header_on_target', 'header_off_target', 'volley',
      'bicycle_kick', 'long_shot', 'shot_post', 'shot_bar'].includes(code))
    return { group: 'Schüsse & Kopfbälle', groupOrder: 4 };
  if (code.startsWith('keeper') || code === 'save' || code === 'penalty_save')
    return { group: 'Torhüter', groupOrder: 5 };
  if (code.startsWith('pass') || ['cross', 'chip_ball', 'long_ball', 'switch_play', 'header_pass',
      'throw_in_pass', 'ball_control', 'bad_control', 'first_touch',
      'dribble_success', 'dribble_fail'].includes(code))
    return { group: 'Pässe & Dribbling', groupOrder: 6 };
  if (['ball_win', 'ball_loss_unforced', 'ball_loss_forced'].includes(code))
    return { group: 'Ballgewinn/-verlust', groupOrder: 7 };
  if (code.startsWith('tackle') || code.startsWith('block') || code.startsWith('def_') ||
      ['clearance', 'interception', 'intercept_cross', 'positioning'].includes(code))
    return { group: 'Defensiv', groupOrder: 8 };
  if (code.startsWith('corner') || code.startsWith('freekick') || code.startsWith('penalty') ||
      ['throw_in', 'long_throw_in', 'kickoff', 'goal_kick_2', 'referee_ball', 'backpass_to_keeper'].includes(code))
    return { group: 'Standardsituationen', groupOrder: 9 };
  if (code.startsWith('halftime') || code.startsWith('var') || code.startsWith('match') ||
      ['extra_time', 'injury_break', 'drink_break', 'penalty_shootout',
       'advantage', 'advantage_shown'].includes(code))
    return { group: 'Spielverlauf', groupOrder: 10 };
  return { group: 'Sonstiges', groupOrder: 11 };
}

/** Erweitert ein EventType-Objekt mit Gruppen-Metadaten und sortiert. */
export function withGroups<T extends { name: string; code?: string }>(
  items: T[],
): (T & EventTypeGroupInfo)[] {
  return [...items]
    .map(item => ({ ...item, ...getGroupInfo(item.code ?? '') }))
    .sort((a, b) =>
      a.groupOrder !== b.groupOrder
        ? a.groupOrder - b.groupOrder
        : a.name.localeCompare(b.name, 'de'),
    );
}
