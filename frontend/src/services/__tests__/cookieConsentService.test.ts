/**
 * Tests für cookieConsentService
 *
 * Vollständige Abdeckung:
 * - loadConsent: null bei leerem Storage, null bei Version-Mismatch, gültige Daten
 * - hasConsented
 * - isCategoryConsented: necessary immer true, optional nur mit Consent
 * - saveConsent: korrekte Struktur, Timestamp, Version
 * - acceptAll / acceptNecessaryOnly
 * - revokeConsent
 * - clearConsent
 * - isAnalyticsAllowed / isFunctionalAllowed
 * - getConsentSummary
 * - COOKIE_CATEGORIES: Vollständigkeit und Korrektheit
 */

import {
  loadConsent,
  hasConsented,
  isCategoryConsented,
  saveConsent,
  acceptAll,
  acceptNecessaryOnly,
  revokeConsent,
  clearConsent,
  isAnalyticsAllowed,
  isFunctionalAllowed,
  getConsentSummary,
  COOKIE_CATEGORIES,
  CONSENT_POLICY_VERSION,
  type ConsentRecord,
} from '../cookieConsentService';

// ─── Setup ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cookie_consent';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function writeConsent(categories: Record<string, boolean>, version = CONSENT_POLICY_VERSION): void {
  const record: ConsentRecord = {
    timestamp: new Date().toISOString(),
    policyVersion: version,
    categories: categories as ConsentRecord['categories'],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

// ─── loadConsent ──────────────────────────────────────────────────────────────

describe('loadConsent', () => {
  it('gibt null zurück wenn localStorage leer', () => {
    expect(loadConsent()).toBeNull();
  });

  it('gibt null zurück bei ungültigem JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'kein-json{');
    expect(loadConsent()).toBeNull();
  });

  it('gibt null zurück bei Versions-Mismatch', () => {
    writeConsent({ necessary: true, functional: true, analytics: false }, 'veraltete-version');
    expect(loadConsent()).toBeNull();
  });

  it('gibt gespeicherten Datensatz zurück wenn Version übereinstimmt', () => {
    writeConsent({ necessary: true, functional: true, analytics: false });
    const result = loadConsent();
    expect(result).not.toBeNull();
    expect(result!.policyVersion).toBe(CONSENT_POLICY_VERSION);
    expect(result!.categories.necessary).toBe(true);
    expect(result!.categories.functional).toBe(true);
    expect(result!.categories.analytics).toBe(false);
  });

  it('gibt null zurück wenn localStorage.getItem wirft', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('Storage error');
    });
    expect(loadConsent()).toBeNull();
  });
});

// ─── hasConsented ─────────────────────────────────────────────────────────────

describe('hasConsented', () => {
  it('gibt false zurück ohne gespeicherten Consent', () => {
    expect(hasConsented()).toBe(false);
  });

  it('gibt true zurück mit gültigem Consent', () => {
    writeConsent({ necessary: true, functional: false, analytics: false });
    expect(hasConsented()).toBe(true);
  });

  it('gibt false zurück bei Versions-Mismatch', () => {
    writeConsent({ necessary: true, functional: true, analytics: true }, 'old-version');
    expect(hasConsented()).toBe(false);
  });
});

// ─── isCategoryConsented ─────────────────────────────────────────────────────

describe('isCategoryConsented', () => {
  it('gibt true für "necessary" zurück unabhängig vom Consent-Status', () => {
    expect(isCategoryConsented('necessary')).toBe(true);
  });

  it('gibt true für "necessary" auch ohne jeglichen Consent', () => {
    // kein localStorage-Eintrag
    expect(isCategoryConsented('necessary')).toBe(true);
  });

  it('gibt false für "functional" ohne Consent-Eintrag', () => {
    expect(isCategoryConsented('functional')).toBe(false);
  });

  it('gibt false für "analytics" ohne Consent-Eintrag', () => {
    expect(isCategoryConsented('analytics')).toBe(false);
  });

  it('gibt true für "functional" wenn eingewilligt', () => {
    writeConsent({ necessary: true, functional: true, analytics: false });
    expect(isCategoryConsented('functional')).toBe(true);
  });

  it('gibt false für "functional" wenn abgelehnt', () => {
    writeConsent({ necessary: true, functional: false, analytics: false });
    expect(isCategoryConsented('functional')).toBe(false);
  });

  it('gibt true für "analytics" wenn eingewilligt', () => {
    writeConsent({ necessary: true, functional: false, analytics: true });
    expect(isCategoryConsented('analytics')).toBe(true);
  });
});

// ─── saveConsent ──────────────────────────────────────────────────────────────

describe('saveConsent', () => {
  it('speichert Datensatz mit korrekter Struktur', () => {
    const before = Date.now();
    const result = saveConsent({ necessary: true, functional: true, analytics: false });
    const after = Date.now();

    expect(result.policyVersion).toBe(CONSENT_POLICY_VERSION);
    expect(result.categories.necessary).toBe(true);
    expect(result.categories.functional).toBe(true);
    expect(result.categories.analytics).toBe(false);
    // Timestamp liegt zwischen before und after
    const ts = new Date(result.timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('erzwingt necessary=true immer', () => {
    const result = saveConsent({ necessary: false, functional: false, analytics: false });
    expect(result.categories.necessary).toBe(true);
  });

  it('schreibt tatsächlich in localStorage', () => {
    saveConsent({ necessary: true, functional: true, analytics: true });
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.categories.functional).toBe(true);
  });

  it('gibt ConsentRecord zurück (nicht void)', () => {
    const result = saveConsent({ necessary: true, functional: false, analytics: false });
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('policyVersion');
    expect(result).toHaveProperty('categories');
  });

  it('ignoriert localStorage-Fehler still', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveConsent({ necessary: true, functional: false, analytics: false })).not.toThrow();
  });
});

// ─── acceptAll ────────────────────────────────────────────────────────────────

describe('acceptAll', () => {
  it('setzt alle Kategorien auf true', () => {
    const result = acceptAll();
    expect(result.categories.necessary).toBe(true);
    expect(result.categories.functional).toBe(true);
    expect(result.categories.analytics).toBe(true);
  });

  it('speichert in localStorage', () => {
    acceptAll();
    const record = loadConsent();
    expect(record).not.toBeNull();
    expect(record!.categories.analytics).toBe(true);
  });
});

// ─── acceptNecessaryOnly ──────────────────────────────────────────────────────

describe('acceptNecessaryOnly', () => {
  it('setzt nur necessary=true, alle anderen false', () => {
    const result = acceptNecessaryOnly();
    expect(result.categories.necessary).toBe(true);
    expect(result.categories.functional).toBe(false);
    expect(result.categories.analytics).toBe(false);
  });

  it('speichert in localStorage — Banner erscheint nicht erneut', () => {
    acceptNecessaryOnly();
    const record = loadConsent();
    expect(record).not.toBeNull(); // Eintrag bleibt, Banner erscheint nicht
  });
});

// ─── revokeConsent ────────────────────────────────────────────────────────────

describe('revokeConsent', () => {
  it('setzt optionale Kategorien auf false, behält Eintrag', () => {
    acceptAll();
    revokeConsent();
    const record = loadConsent();
    expect(record).not.toBeNull();
    expect(record!.categories.functional).toBe(false);
    expect(record!.categories.analytics).toBe(false);
    expect(record!.categories.necessary).toBe(true);
  });
});

// ─── clearConsent ─────────────────────────────────────────────────────────────

describe('clearConsent', () => {
  it('entfernt Eintrag vollständig aus localStorage', () => {
    acceptAll();
    clearConsent();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(loadConsent()).toBeNull();
  });

  it('hat kein Effekt wenn kein Eintrag vorhanden', () => {
    expect(() => clearConsent()).not.toThrow();
  });

  it('ignoriert localStorage-Fehler still', () => {
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementationOnce(() => {
      throw new Error('Storage error');
    });
    expect(() => clearConsent()).not.toThrow();
  });

  it('nach clearConsent zeigt hasConsented() false', () => {
    acceptAll();
    clearConsent();
    expect(hasConsented()).toBe(false);
  });
});

// ─── isAnalyticsAllowed ───────────────────────────────────────────────────────

describe('isAnalyticsAllowed', () => {
  it('gibt false zurück ohne Consent', () => {
    expect(isAnalyticsAllowed()).toBe(false);
  });

  it('gibt false zurück wenn nur notwendige akzeptiert', () => {
    acceptNecessaryOnly();
    expect(isAnalyticsAllowed()).toBe(false);
  });

  it('gibt true zurück wenn analytics eingewilligt', () => {
    acceptAll();
    expect(isAnalyticsAllowed()).toBe(true);
  });
});

// ─── isFunctionalAllowed ──────────────────────────────────────────────────────

describe('isFunctionalAllowed', () => {
  it('gibt false zurück ohne Consent', () => {
    expect(isFunctionalAllowed()).toBe(false);
  });

  it('gibt false zurück wenn nur notwendige akzeptiert', () => {
    acceptNecessaryOnly();
    expect(isFunctionalAllowed()).toBe(false);
  });

  it('gibt true zurück wenn functional eingewilligt', () => {
    acceptAll();
    expect(isFunctionalAllowed()).toBe(true);
  });

  it('gibt true zurück bei granularem Consent mit functional=true', () => {
    saveConsent({ necessary: true, functional: true, analytics: false });
    expect(isFunctionalAllowed()).toBe(true);
  });
});

// ─── getConsentSummary ────────────────────────────────────────────────────────

describe('getConsentSummary', () => {
  it('gibt hasConsented=false und Default-Kategorien zurück ohne Eintrag', () => {
    const summary = getConsentSummary();
    expect(summary.hasConsented).toBe(false);
    expect(summary.timestamp).toBeNull();
    expect(summary.categories.necessary).toBe(true);
    expect(summary.categories.functional).toBe(false);
    expect(summary.categories.analytics).toBe(false);
  });

  it('gibt aktuellen Consent zurück mit gespeichertem Eintrag', () => {
    acceptAll();
    const summary = getConsentSummary();
    expect(summary.hasConsented).toBe(true);
    expect(summary.timestamp).not.toBeNull();
    expect(typeof summary.timestamp).toBe('string');
    expect(summary.categories.functional).toBe(true);
    expect(summary.categories.analytics).toBe(true);
  });
});

// ─── COOKIE_CATEGORIES ────────────────────────────────────────────────────────

describe('COOKIE_CATEGORIES', () => {
  it('enthält genau 3 Einträge (necessary, functional, analytics)', () => {
    expect(COOKIE_CATEGORIES).toHaveLength(3);
  });

  it('hat "necessary" als erste Kategorie mit required=true', () => {
    const necessary = COOKIE_CATEGORIES[0];
    expect(necessary.key).toBe('necessary');
    expect(necessary.required).toBe(true);
  });

  it('hat "functional" als zweite Kategorie mit required=false', () => {
    const functional = COOKIE_CATEGORIES[1];
    expect(functional.key).toBe('functional');
    expect(functional.required).toBe(false);
  });

  it('hat "analytics" als dritte Kategorie mit required=false', () => {
    const analytics = COOKIE_CATEGORIES[2];
    expect(analytics.key).toBe('analytics');
    expect(analytics.required).toBe(false);
  });

  it('jede Kategorie hat label, description und examples', () => {
    COOKIE_CATEGORIES.forEach(cat => {
      expect(typeof cat.label).toBe('string');
      expect(cat.label.length).toBeGreaterThan(0);
      expect(typeof cat.description).toBe('string');
      expect(cat.description.length).toBeGreaterThan(0);
      expect(Array.isArray(cat.examples)).toBe(true);
      expect(cat.examples.length).toBeGreaterThan(0);
    });
  });

  it('alle Keys sind gültige ConsentCategory-Werte', () => {
    const validKeys = ['necessary', 'functional', 'analytics'];
    COOKIE_CATEGORIES.forEach(cat => {
      expect(validKeys).toContain(cat.key);
    });
  });
});

// ─── CONSENT_POLICY_VERSION ───────────────────────────────────────────────────

describe('CONSENT_POLICY_VERSION', () => {
  it('ist ein nicht-leerer String', () => {
    expect(typeof CONSENT_POLICY_VERSION).toBe('string');
    expect(CONSENT_POLICY_VERSION.length).toBeGreaterThan(0);
  });

  it('bewirkt Consent-Ungültigmachung bei Version-Änderung', () => {
    // Alten Eintrag mit anderer Version simulieren
    writeConsent({ necessary: true, functional: true, analytics: true }, 'old-version-99');
    expect(loadConsent()).toBeNull(); // soll null sein wegen Version-Mismatch
    expect(hasConsented()).toBe(false);
  });
});
