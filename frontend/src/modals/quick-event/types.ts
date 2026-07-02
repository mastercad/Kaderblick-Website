/** Ein einzelnes Element im Radialmenü (Long-Press auf einen Button). */
export interface RadialItem {
  eventTypeCode: string;
  label: string;
}

export type QuickEventButtonGroup = 'player-event' | 'match-state';

/** Ein konfigurierbarer Button auf der Fernbedienung. */
export interface QuickEventButton {
  eventTypeCode: string;
  label: string;
  /** Gruppiert Buttons in unterschiedliche Bereiche der Quick-Event-Ansicht. */
  group?: QuickEventButtonGroup;
  /** Font-Awesome-Klasse, z.B. "fas fa-futbol" */
  icon?: string;
  /** Wird per Long-Press geöffnet. Leer = kein Radialmenü. */
  radialItems?: RadialItem[];
}

/** Gesamte Trainer-Konfiguration der Fernbedienung. */
export interface QuickEventConfig {
  buttons: QuickEventButton[];
}
