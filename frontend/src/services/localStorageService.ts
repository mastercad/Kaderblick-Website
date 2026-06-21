/**
 * LocalStorageService – Zentraler Gateway für ALLE localStorage-Zugriffe
 *
 * Warum dieser Service existiert:
 * - Einzige Stelle, an der localStorage-Keys definiert und gepflegt werden
 * - Kein Code im Projekt darf localStorage direkt beschreiben (außer cookieConsentService,
 *   der den Consent-Datensatz selbst verwaltet – das ist die Bootstrap-Ausnahme)
 * - Automatische Consent-Prüfung vor jedem Lese-/Schreibzugriff (DSGVO / TTDSG §25)
 * - TypeScript-Typisierung: unbekannte Keys führen zu Compile-Fehlern
 *
 * ────────────────────────────────────────────────────────────────────────────
 * NEUE KEYS HINZUFÜGEN:
 * 1. Key und Kategorie in STORAGE_REGISTRY oder PREFIX_REGISTRY eintragen
 * 2. Kategorie wählen:
 *    - 'necessary'  → immer erlaubt (z. B. Auth-Tokens, kritische UI-Zustände)
 *    - 'functional' → erfordert Consent (UI-Präferenzen, Caches, Draft-Daten)
 *    - 'analytics'  → erfordert Consent (Nutzungsstatistiken, Tracking)
 * 3. Den neuen Key über localStorageService.getItem/setItem verwenden
 * ────────────────────────────────────────────────────────────────────────────
 *
 * NICHT in diesem Registry:
 * - 'cookie_consent' → wird ausschließlich von cookieConsentService verwaltet
 *   (Bootstrap-Problem: Consent-Prüfung kann nicht durch den Consent-Record
 *    selbst gesichert werden)
 */

import { isCategoryConsented, type ConsentCategory } from './cookieConsentService';

// ─── Typ-Definitionen ──────────────────────────────────────────────────────────

/**
 * Registry aller statischen localStorage-Keys mit ihrer Consent-Kategorie.
 * Jeder neue Key MUSS hier eingetragen werden.
 */
export const STORAGE_REGISTRY = {
  /** Persistierte Theme-Präferenz (System/hell/dunkel) */
  'theme-mode':                    'functional',
  /** Letzte Ansicht im Nachrichten-Dialog (chronologisch / nach Kontakt) */
  'messages.viewMode':             'functional',
  /** Ob die Einführungs-Karte im Report-Builder weggeklickt wurde */
  'reportBuilder.introDismissed':  'functional',
  /** Zeitstempel der letzten Push-Warning-Ablehnung */
  'push-warning-dismissed':        'functional',
  /** Sidebar-Collapse-Status (ausgeklappt / eingeklappt) */
  'kb_sidebar_collapsed':          'functional',
  /** Gecachte Benachrichtigungen (API-Fallback bei Offline/Fehler) */
  'notifications':                 'functional',
  /** Zuletzt gewählte Team-ID auf der Spiele-Seite */
  'games_selectedTeamId':          'functional',
  /** Ob Feiertage im Kalender angezeigt werden */
  'calendar.holidays.enabled':     'functional',
  /** Bundesland-Code für Feiertagsanzeige im Kalender (NATIONAL, BY, BW, …) */
  'calendar.holidays.state':       'functional',
} as const satisfies Record<string, ConsentCategory>;

/**
 * Registry aller präfix-basierten localStorage-Keys (dynamische Suffixe).
 * Jeder neue Präfix MUSS hier eingetragen werden.
 */
export const PREFIX_REGISTRY = {
  /** Taktik-Draft-Entwürfe pro Formation: 'tactics-board-draft:{formationId}' */
  'tactics-board-draft:': 'functional',
} as const satisfies Record<string, ConsentCategory>;

/** Union-Typ aller bekannten statischen localStorage-Keys */
export type StorageKey = keyof typeof STORAGE_REGISTRY;

/** Union-Typ aller bekannten localStorage-Präfixe */
export type StoragePrefix = keyof typeof PREFIX_REGISTRY;

// ─── Interne Hilfsfunktionen ──────────────────────────────────────────────────

function isConsentGiven(category: ConsentCategory): boolean {
  return isCategoryConsented(category);
}

function warnNotAllowed(key: string, category: ConsentCategory, operation: 'read' | 'write'): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `[LocalStorageService] ${operation === 'write' ? 'Write' : 'Read'} to "${key}" blocked: ` +
      `no consent for category "${category}". ` +
      `Call localStorageService.setItem() only after consent is given.`,
    );
  }
}

// ─── Statische Keys ────────────────────────────────────────────────────────────

/**
 * Liest einen registrierten localStorage-Wert.
 * Gibt null zurück wenn:
 * - Kein Consent für die Kategorie vorhanden
 * - Kein Wert gespeichert
 * - localStorage nicht verfügbar
 *
 * @param key - Registrierter Storage-Key (muss in STORAGE_REGISTRY stehen)
 */
export function getItem(key: StorageKey): string | null {
  const category = STORAGE_REGISTRY[key];
  if (!isConsentGiven(category)) {
    warnNotAllowed(key, category, 'read');
    return null;
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Schreibt einen Wert in einen registrierten localStorage-Key.
 * No-op wenn kein Consent vorhanden oder localStorage nicht verfügbar.
 *
 * @param key   - Registrierter Storage-Key
 * @param value - Zu speichernder Wert (String)
 */
export function setItem(key: StorageKey, value: string): void {
  const category = STORAGE_REGISTRY[key];
  if (!isConsentGiven(category)) {
    warnNotAllowed(key, category, 'write');
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    // Quota oder Private-Browsing-Fehler — ignorieren, App läuft weiter
  }
}

/**
 * Entfernt einen registrierten localStorage-Key.
 * Funktioniert IMMER – unabhängig vom Consent-Status.
 * (Löschoperationen dürfen nie blockiert werden – DSGVO Art. 17)
 *
 * @param key - Registrierter Storage-Key
 */
export function removeItem(key: StorageKey): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignorieren
  }
}

// ─── Präfix-basierte Keys (dynamische Suffixe) ────────────────────────────────

/**
 * Liest einen präfix-basierten localStorage-Wert.
 * Vollständiger Key = `${prefix}${suffix}`
 *
 * @param prefix - Registrierter Präfix aus PREFIX_REGISTRY
 * @param suffix - Dynamisches Suffix (z. B. Formation-ID)
 */
export function getItemByPrefix(prefix: StoragePrefix, suffix: string | number): string | null {
  const category = PREFIX_REGISTRY[prefix];
  const fullKey = `${prefix}${suffix}`;
  if (!isConsentGiven(category)) {
    warnNotAllowed(fullKey, category, 'read');
    return null;
  }
  try {
    return localStorage.getItem(fullKey);
  } catch {
    return null;
  }
}

/**
 * Schreibt einen präfix-basierten localStorage-Wert.
 * No-op wenn kein Consent vorhanden.
 *
 * @param prefix - Registrierter Präfix aus PREFIX_REGISTRY
 * @param suffix - Dynamisches Suffix (z. B. Formation-ID)
 * @param value  - Zu speichernder Wert
 */
export function setItemByPrefix(prefix: StoragePrefix, suffix: string | number, value: string): void {
  const category = PREFIX_REGISTRY[prefix];
  const fullKey = `${prefix}${suffix}`;
  if (!isConsentGiven(category)) {
    warnNotAllowed(fullKey, category, 'write');
    return;
  }
  try {
    localStorage.setItem(fullKey, value);
  } catch {
    // ignorieren
  }
}

/**
 * Entfernt einen präfix-basierten localStorage-Eintrag.
 * Funktioniert IMMER – unabhängig vom Consent-Status.
 *
 * @param prefix - Registrierter Präfix aus PREFIX_REGISTRY
 * @param suffix - Dynamisches Suffix (z. B. Formation-ID)
 */
export function removeItemByPrefix(prefix: StoragePrefix, suffix: string | number): void {
  const fullKey = `${prefix}${suffix}`;
  try {
    localStorage.removeItem(fullKey);
  } catch {
    // ignorieren
  }
}

// ─── Kategorie-Verwaltung ─────────────────────────────────────────────────────

/**
 * Entfernt ALLE localStorage-Einträge einer Kategorie.
 * Wird aufgerufen wenn der Nutzer die Einwilligung für eine Kategorie widerruft.
 *
 * Deckt sowohl statische Keys als auch Präfix-basierte Keys ab.
 *
 * @param category - Einwilligungs-Kategorie deren Daten zu löschen sind
 */
export function clearCategory(category: ConsentCategory): void {
  // Statische Keys der Kategorie entfernen
  for (const [key, cat] of Object.entries(STORAGE_REGISTRY) as [StorageKey, ConsentCategory][]) {
    if (cat === category) {
      removeItem(key);
    }
  }

  // Präfix-basierte Keys der Kategorie entfernen (alle localStorage-Einträge scannen)
  try {
    const prefixesForCategory = Object.entries(PREFIX_REGISTRY)
      .filter(([, cat]) => cat === category)
      .map(([prefix]) => prefix);

    if (prefixesForCategory.length > 0) {
      const allKeys = Object.keys(localStorage);
      for (const key of allKeys) {
        if (prefixesForCategory.some(prefix => key.startsWith(prefix))) {
          localStorage.removeItem(key);
        }
      }
    }
  } catch {
    // ignorieren
  }
}

/**
 * Gibt alle statischen Keys einer Kategorie zurück.
 * Nützlich für Tests und Diagnose.
 *
 * @param category - Kategorie
 */
export function getStaticKeysForCategory(category: ConsentCategory): StorageKey[] {
  return (Object.entries(STORAGE_REGISTRY) as [StorageKey, ConsentCategory][])
    .filter(([, cat]) => cat === category)
    .map(([key]) => key);
}

/**
 * Gibt alle registrierten Präfixe einer Kategorie zurück.
 * Nützlich für Tests und Diagnose.
 *
 * @param category - Kategorie
 */
export function getPrefixesForCategory(category: ConsentCategory): StoragePrefix[] {
  return (Object.entries(PREFIX_REGISTRY) as [StoragePrefix, ConsentCategory][])
    .filter(([, cat]) => cat === category)
    .map(([prefix]) => prefix);
}
