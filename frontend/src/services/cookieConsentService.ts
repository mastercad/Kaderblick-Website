/**
 * Cookie Consent Service
 *
 * Verwaltet die Einwilligung des Nutzers gemäß:
 * - DSGVO (Datenschutz-Grundverordnung, EU 2016/679)
 * - TTDSG (Telekommunikation-Telemedien-Datenschutz-Gesetz, § 25)
 * - Anforderungen der deutschen Datenschutzbehörden (DSK)
 *
 * Rechtliche Grundsätze:
 * - Keine voreingestellten optionalen Cookies ("Opt-in", kein "Opt-out")
 * - Gleichwertige Möglichkeit zur Ablehnung (keine Dark Patterns)
 * - Einwilligung muss freiwillig, informiert, spezifisch und eindeutig sein
 * - Widerruf muss jederzeit möglich und ebenso einfach sein wie die Einwilligung
 * - Einwilligung wird mit Zeitstempel und Version gespeichert
 */

export type ConsentCategory = 'necessary' | 'functional' | 'analytics';

export interface ConsentRecord {
  /** Zeitstempel der Einwilligung (ISO 8601) */
  timestamp: string;
  /** Version der Cookie-Richtlinie */
  policyVersion: string;
  /** Eingewilligte Kategorien */
  categories: Record<ConsentCategory, boolean>;
}

export interface CookieCategoryInfo {
  key: ConsentCategory;
  label: string;
  description: string;
  required: boolean;
  examples: string[];
}

/** Aktuelle Version der Datenschutz-/Cookie-Richtlinie.
 *  Bei Änderungen der Datenverarbeitung erhöhen, damit bestehende Einwilligungen neu abgefragt werden. */
export const CONSENT_POLICY_VERSION = '1.0';

const STORAGE_KEY = 'cookie_consent';

export const COOKIE_CATEGORIES: CookieCategoryInfo[] = [
  {
    key: 'necessary',
    label: 'Notwendig',
    description:
      'Diese Cookies sind für das ordnungsgemäße Funktionieren der Website unbedingt erforderlich. Sie ermöglichen grundlegende Funktionen wie Authentifizierung und Sitzungsverwaltung. Ohne diese Cookies kann die Webseite nicht korrekt funktionieren.',
    required: true,
    examples: [
      'Authentifizierungs-Token (JWT)',
      'Sicherheits-Tokens (CSRF-Schutz)',
      'Sitzungsverwaltung',
      'Basiseinstellungen der Benutzeroberfläche',
    ],
  },
  {
    key: 'functional',
    label: 'Funktional',
    description:
      'Diese Cookies ermöglichen erweiterte Funktionalität und Personalisierung, die über das technisch Notwendige hinausgehen. Die Webseite funktioniert auch ohne diese Cookies, bietet jedoch eine eingeschränktere Nutzererfahrung.',
    required: false,
    examples: [
      'Gespeicherte UI-Einstellungen (z. B. Sidebar-Status)',
      'Farbschema-Präferenz (Hell-/Dunkel-Modus)',
      'Zuletzt besuchte Seiten',
    ],
  },
  {
    key: 'analytics',
    label: 'Analyse',
    description:
      'Diese Cookies helfen uns zu verstehen, wie Besucher die Webseite nutzen. Die Daten werden ausschließlich zu statistischen Zwecken verwendet, um die Webseite zu verbessern. Es werden keine personenbezogenen Daten an Dritte weitergegeben.',
    required: false,
    examples: [
      'Anonymisierte Nutzungsstatistiken',
      'Fehlerprotokollierung',
      'Performance-Messung',
    ],
  },
];

/**
 * Liest die gespeicherte Einwilligung aus dem localStorage.
 * Gibt null zurück, wenn noch keine Einwilligung vorliegt oder die Richtlinienversion veraltet ist.
 */
export function loadConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: ConsentRecord = JSON.parse(raw);
    // Einwilligung ungültig machen, wenn sich die Richtlinienversion geändert hat
    if (parsed.policyVersion !== CONSENT_POLICY_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Prüft ob eine gültige Einwilligung vorliegt (unabhängig vom Inhalt).
 */
export function hasConsented(): boolean {
  return loadConsent() !== null;
}

/**
 * Prüft ob eine bestimmte Kategorie eingewilligt wurde.
 * Notwendige Cookies gelten immer als eingewilligt.
 */
export function isCategoryConsented(category: ConsentCategory): boolean {
  if (category === 'necessary') return true;
  const record = loadConsent();
  if (!record) return false;
  return record.categories[category] === true;
}

/**
 * Speichert die Einwilligung mit Zeitstempel und Richtlinienversion.
 */
export function saveConsent(categories: Record<ConsentCategory, boolean>): ConsentRecord {
  const record: ConsentRecord = {
    timestamp: new Date().toISOString(),
    policyVersion: CONSENT_POLICY_VERSION,
    categories: {
      necessary: true, // notwendige Cookies sind immer aktiv
      functional: categories.functional,
      analytics: categories.analytics,
    },
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // localStorage nicht verfügbar (z. B. Private Browsing ohne Erlaubnis) – ignorieren
  }
  return record;
}

/**
 * Akzeptiert alle Cookie-Kategorien.
 */
export function acceptAll(): ConsentRecord {
  return saveConsent({ necessary: true, functional: true, analytics: true });
}

/**
 * Akzeptiert nur technisch notwendige Cookies.
 */
export function acceptNecessaryOnly(): ConsentRecord {
  return saveConsent({ necessary: true, functional: false, analytics: false });
}

/**
 * Widerruft die Einwilligung vollständig.
 * Setzt alle optionalen Kategorien auf false, entfernt aber nicht den Eintrag,
 * damit der Banner nicht erneut erscheint (der Nutzer hat aktiv "nur notwendige" gewählt).
 */
export function revokeConsent(): void {
  saveConsent({ necessary: true, functional: false, analytics: false });
}

/**
 * Löscht die gespeicherte Einwilligung vollständig, sodass der Banner wieder erscheint.
 * Nur für expliziten Reset-Anwendungsfall (z. B. "Einstellungen zurücksetzen").
 */
export function clearConsent(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignorieren
  }
}

/**
 * Prüft ob Analytics-Tracking aktuell erlaubt ist.
 * Vor jeder Analytics-Initialisierung aufrufen.
 *
 * Beispiel:
 *   if (isAnalyticsAllowed()) {
 *     initPlausible();  // oder initGoogleAnalytics() etc.
 *   }
 */
export function isAnalyticsAllowed(): boolean {
  return isCategoryConsented('analytics');
}

/**
 * Prüft ob funktionale Speicherung aktuell erlaubt ist.
 * Vor nicht-notwendigen localStorage.setItem()-Aufrufen verwenden.
 */
export function isFunctionalAllowed(): boolean {
  return isCategoryConsented('functional');
}

/**
 * Gibt ein lesbares Einwilligungs-Objekt zurück (für Datenschutz-Einstellungsseite).
 */
export function getConsentSummary(): {
  hasConsented: boolean;
  timestamp: string | null;
  categories: Record<ConsentCategory, boolean>;
} {
  const record = loadConsent();
  return {
    hasConsented: record !== null,
    timestamp: record?.timestamp ?? null,
    categories: record?.categories ?? {
      necessary: true,
      functional: false,
      analytics: false,
    },
  };
}
