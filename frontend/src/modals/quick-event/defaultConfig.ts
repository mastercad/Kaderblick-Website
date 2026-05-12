import { QuickEventConfig } from './types';

/**
 * Standard-Konfiguration der Fernbedienung.
 * Orientiert sich an FAVORITE_CODES aus eventTypeGroups.ts.
 * Long-Press öffnet das Radialmenü mit verwandten Ereignistypen.
 */
export const DEFAULT_QUICK_EVENT_CONFIG: QuickEventConfig = {
  buttons: [
    {
      eventTypeCode: 'goal',
      label: 'Tor',
      icon: 'fas fa-futbol',
      radialItems: [
        { eventTypeCode: 'header_goal', label: 'Kopfballtor' },
        { eventTypeCode: 'penalty_goal', label: 'Elfmeter' },
        { eventTypeCode: 'freekick_goal', label: 'Freistoßtor' },
        { eventTypeCode: 'own_goal', label: 'Eigentor' },
      ],
    },
    {
      eventTypeCode: 'shot_on_target',
      label: 'Schuss',
      icon: 'fas fa-crosshairs',
      radialItems: [
        { eventTypeCode: 'shot_post', label: 'Pfosten' },
        { eventTypeCode: 'shot_bar', label: 'Latte' },
      ],
    },
    {
      eventTypeCode: 'corner',
      label: 'Ecke',
      icon: 'fas fa-flag',
    },
    {
      eventTypeCode: 'assist',
      label: 'Vorlage',
      icon: 'fas fa-hands-helping',
    },
    {
      eventTypeCode: 'yellow_card',
      label: 'Karte',
      icon: 'fas fa-square',
      radialItems: [
        { eventTypeCode: 'red_card', label: 'Rot' },
        { eventTypeCode: 'yellow_red_card', label: 'Gelb-Rot' },
      ],
    },
    {
      eventTypeCode: 'substitution',
      label: 'Wechsel',
      icon: 'fas fa-exchange-alt',
      radialItems: [
        { eventTypeCode: 'substitution_injury', label: 'Verletzt' },
      ],
    },
    {
      eventTypeCode: 'foul',
      label: 'Foul',
      icon: 'fas fa-hand-paper',
      radialItems: [
        { eventTypeCode: 'penalty_foul', label: 'Elfmeter' },
      ],
    },
  ],
};
