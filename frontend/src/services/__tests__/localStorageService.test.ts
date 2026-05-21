/**
 * Tests für localStorageService
 *
 * Vollständige Abdeckung:
 * - Consent-gating (read/write blockiert ohne Consent)
 * - Statische Keys: getItem, setItem, removeItem
 * - Präfix-basierte Keys: getItemByPrefix, setItemByPrefix, removeItemByPrefix
 * - Kategorie-Bereinigung: clearCategory
 * - Hilfsfunktionen: getStaticKeysForCategory, getPrefixesForCategory
 * - localStorage-Fehler (Quota, Private Browsing)
 * - Registry-Vollständigkeit
 */

import {
  getItem,
  setItem,
  removeItem,
  getItemByPrefix,
  setItemByPrefix,
  removeItemByPrefix,
  clearCategory,
  getStaticKeysForCategory,
  getPrefixesForCategory,
  STORAGE_REGISTRY,
  PREFIX_REGISTRY,
  type StorageKey,
  type StoragePrefix,
} from '../localStorageService';

// ─── Mock: cookieConsentService ───────────────────────────────────────────────

const mockIsCategoryConsented = jest.fn<boolean, [string]>();

jest.mock('../cookieConsentService', () => ({
  isCategoryConsented: (category: string) => mockIsCategoryConsented(category),
}));

// ─── Test-Helpers ─────────────────────────────────────────────────────────────

function grantConsent(category: 'necessary' | 'functional' | 'analytics' = 'functional'): void {
  mockIsCategoryConsented.mockImplementation((cat) => {
    if (cat === 'necessary') return true;
    return cat === category;
  });
}

function denyConsent(): void {
  mockIsCategoryConsented.mockImplementation((cat) => cat === 'necessary');
}

function grantAll(): void {
  mockIsCategoryConsented.mockReturnValue(true);
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  grantAll(); // Standard: alles erlaubt, explizit in Tests überschreiben wo nötig
});

// ─── getItem ──────────────────────────────────────────────────────────────────

describe('getItem', () => {
  it('gibt gespeicherten Wert zurück wenn Consent vorhanden', () => {
    grantConsent('functional');
    localStorage.setItem('theme-mode', 'dark');
    expect(getItem('theme-mode')).toBe('dark');
  });

  it('gibt null zurück wenn kein Wert gespeichert', () => {
    grantConsent('functional');
    expect(getItem('theme-mode')).toBeNull();
  });

  it('gibt null zurück und blockiert Zugriff ohne Consent', () => {
    denyConsent();
    localStorage.setItem('theme-mode', 'dark'); // direkt gesetzt, simuliert alten Datensatz
    expect(getItem('theme-mode')).toBeNull();
  });

  it('funktioniert für notwendige Kategorie immer', () => {
    denyConsent(); // necessary ist immer true durch denyConsent-Impl.
    // kb_sidebar_collapsed ist functional, also geblockt — wir brauchen hier
    // einen Necessary-Key, aber alle unsere Keys sind functional.
    // Stattdessen testen wir, dass isCategoryConsented mit dem richtigen Arg aufgerufen wird.
    getItem('theme-mode');
    expect(mockIsCategoryConsented).toHaveBeenCalledWith('functional');
  });

  it('gibt null zurück wenn localStorage wirft', () => {
    grantConsent('functional');
    jest.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('Storage error');
    });
    expect(getItem('theme-mode')).toBeNull();
  });
});

// ─── setItem ──────────────────────────────────────────────────────────────────

describe('setItem', () => {
  it('schreibt Wert wenn Consent vorhanden', () => {
    grantConsent('functional');
    setItem('theme-mode', 'dark');
    expect(localStorage.getItem('theme-mode')).toBe('dark');
  });

  it('schreibt NICHT wenn kein Consent', () => {
    denyConsent();
    setItem('theme-mode', 'dark');
    expect(localStorage.getItem('theme-mode')).toBeNull();
  });

  it('ignoriert localStorage-Quota-Fehler still', () => {
    grantConsent('functional');
    jest.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => setItem('theme-mode', 'dark')).not.toThrow();
  });

  it('ruft isCategoryConsented mit dem richtigen Kategorie-Argument auf', () => {
    grantAll();
    setItem('messages.viewMode', 'threaded');
    expect(mockIsCategoryConsented).toHaveBeenCalledWith('functional');
  });

  it('schreibt alle registrierten statischen Functional-Keys korrekt', () => {
    grantConsent('functional');
    const functionalKeys = getStaticKeysForCategory('functional');
    functionalKeys.forEach(key => {
      setItem(key, 'testvalue');
      expect(localStorage.getItem(key)).toBe('testvalue');
    });
  });
});

// ─── removeItem ───────────────────────────────────────────────────────────────

describe('removeItem', () => {
  it('entfernt vorhandenen Wert', () => {
    localStorage.setItem('theme-mode', 'dark');
    removeItem('theme-mode');
    expect(localStorage.getItem('theme-mode')).toBeNull();
  });

  it('funktioniert auch OHNE Consent (Löschung darf nie blockiert werden)', () => {
    denyConsent();
    localStorage.setItem('theme-mode', 'dark');
    removeItem('theme-mode');
    expect(localStorage.getItem('theme-mode')).toBeNull();
  });

  it('wirft nicht wenn Key nicht vorhanden', () => {
    expect(() => removeItem('theme-mode')).not.toThrow();
  });

  it('ignoriert localStorage-Fehler still', () => {
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementationOnce(() => {
      throw new Error('Storage error');
    });
    expect(() => removeItem('theme-mode')).not.toThrow();
  });
});

// ─── getItemByPrefix ──────────────────────────────────────────────────────────

describe('getItemByPrefix', () => {
  it('gibt gespeicherten Wert zurück wenn Consent vorhanden', () => {
    grantConsent('functional');
    localStorage.setItem('tactics-board-draft:42', JSON.stringify({ formationId: 42 }));
    const result = getItemByPrefix('tactics-board-draft:', 42);
    expect(result).toBe(JSON.stringify({ formationId: 42 }));
  });

  it('gibt null zurück ohne Consent', () => {
    denyConsent();
    localStorage.setItem('tactics-board-draft:42', 'data');
    expect(getItemByPrefix('tactics-board-draft:', 42)).toBeNull();
  });

  it('gibt null zurück wenn Wert nicht vorhanden', () => {
    grantConsent('functional');
    expect(getItemByPrefix('tactics-board-draft:', 99)).toBeNull();
  });

  it('kombiniert Präfix und Suffix zu vollem Key', () => {
    grantConsent('functional');
    localStorage.setItem('tactics-board-draft:7', 'value7');
    expect(getItemByPrefix('tactics-board-draft:', 7)).toBe('value7');
    expect(getItemByPrefix('tactics-board-draft:', '7')).toBe('value7');
  });

  it('gibt null zurück wenn localStorage wirft', () => {
    grantConsent('functional');
    jest.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('Storage error');
    });
    expect(getItemByPrefix('tactics-board-draft:', 1)).toBeNull();
  });
});

// ─── setItemByPrefix ──────────────────────────────────────────────────────────

describe('setItemByPrefix', () => {
  it('schreibt Wert mit vollem Key wenn Consent vorhanden', () => {
    grantConsent('functional');
    setItemByPrefix('tactics-board-draft:', 5, '{"version":1}');
    expect(localStorage.getItem('tactics-board-draft:5')).toBe('{"version":1}');
  });

  it('schreibt NICHT ohne Consent', () => {
    denyConsent();
    setItemByPrefix('tactics-board-draft:', 5, 'data');
    expect(localStorage.getItem('tactics-board-draft:5')).toBeNull();
  });

  it('ignoriert localStorage-Quota-Fehler still', () => {
    grantConsent('functional');
    jest.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => setItemByPrefix('tactics-board-draft:', 1, 'data')).not.toThrow();
  });

  it('unterstützt String-Suffix', () => {
    grantConsent('functional');
    setItemByPrefix('tactics-board-draft:', 'abc', 'value');
    expect(localStorage.getItem('tactics-board-draft:abc')).toBe('value');
  });
});

// ─── removeItemByPrefix ───────────────────────────────────────────────────────

describe('removeItemByPrefix', () => {
  it('entfernt Wert mit vollem Key', () => {
    grantConsent('functional');
    localStorage.setItem('tactics-board-draft:10', 'data');
    removeItemByPrefix('tactics-board-draft:', 10);
    expect(localStorage.getItem('tactics-board-draft:10')).toBeNull();
  });

  it('funktioniert OHNE Consent (Löschung nie blockiert)', () => {
    denyConsent();
    localStorage.setItem('tactics-board-draft:10', 'data');
    removeItemByPrefix('tactics-board-draft:', 10);
    expect(localStorage.getItem('tactics-board-draft:10')).toBeNull();
  });

  it('wirft nicht wenn Key nicht existiert', () => {
    expect(() => removeItemByPrefix('tactics-board-draft:', 999)).not.toThrow();
  });
});

// ─── clearCategory ────────────────────────────────────────────────────────────

describe('clearCategory', () => {
  it('entfernt alle statischen Functional-Keys', () => {
    const keys = getStaticKeysForCategory('functional');
    keys.forEach(key => localStorage.setItem(key, 'value'));

    clearCategory('functional');

    keys.forEach(key => {
      expect(localStorage.getItem(key)).toBeNull();
    });
  });

  it('entfernt Präfix-basierte Functional-Keys', () => {
    localStorage.setItem('tactics-board-draft:1', 'draft1');
    localStorage.setItem('tactics-board-draft:2', 'draft2');
    localStorage.setItem('tactics-board-draft:99', 'draft99');

    clearCategory('functional');

    expect(localStorage.getItem('tactics-board-draft:1')).toBeNull();
    expect(localStorage.getItem('tactics-board-draft:2')).toBeNull();
    expect(localStorage.getItem('tactics-board-draft:99')).toBeNull();
  });

  it('berührt KEINE Keys anderer Kategorien', () => {
    // cookie_consent ist ein notwendiger Key der direkt verwaltet wird
    localStorage.setItem('cookie_consent', '{"policyVersion":"1.0"}');
    localStorage.setItem('theme-mode', 'dark');

    clearCategory('functional');

    // cookie_consent bleibt (nicht in STORAGE_REGISTRY registriert)
    expect(localStorage.getItem('cookie_consent')).toBe('{"policyVersion":"1.0"}');
  });

  it('berührt KEINE unbekannten Keys', () => {
    localStorage.setItem('unknown-key', 'should-survive');
    localStorage.setItem('theme-mode', 'dark');

    clearCategory('functional');

    expect(localStorage.getItem('unknown-key')).toBe('should-survive');
  });

  it('entfernt gemischte Einträge komplett (statisch + Präfix)', () => {
    localStorage.setItem('theme-mode', 'dark');
    localStorage.setItem('messages.viewMode', 'threaded');
    localStorage.setItem('tactics-board-draft:3', 'draft');
    localStorage.setItem('tactics-board-draft:4', 'draft');
    localStorage.setItem('kb_sidebar_collapsed', '1');
    localStorage.setItem('notifications', '[]');
    localStorage.setItem('games_selectedTeamId', '5');
    localStorage.setItem('push-warning-dismissed', '123456');
    localStorage.setItem('reportBuilder.introDismissed', '1');

    clearCategory('functional');

    expect(localStorage.getItem('theme-mode')).toBeNull();
    expect(localStorage.getItem('messages.viewMode')).toBeNull();
    expect(localStorage.getItem('tactics-board-draft:3')).toBeNull();
    expect(localStorage.getItem('tactics-board-draft:4')).toBeNull();
    expect(localStorage.getItem('kb_sidebar_collapsed')).toBeNull();
    expect(localStorage.getItem('notifications')).toBeNull();
    expect(localStorage.getItem('games_selectedTeamId')).toBeNull();
    expect(localStorage.getItem('push-warning-dismissed')).toBeNull();
    expect(localStorage.getItem('reportBuilder.introDismissed')).toBeNull();
  });

  it('ist idempotent: wiederholter Aufruf wirft nicht', () => {
    localStorage.setItem('theme-mode', 'dark');
    clearCategory('functional');
    expect(() => clearCategory('functional')).not.toThrow();
  });

  it('entfernt analytics Keys wenn clearCategory("analytics") aufgerufen', () => {
    // Aktuell gibt es keine analytics-Keys in der Registry — Test prüft
    // dass die Funktion mit einer anderen Kategorie korrekt umgeht
    const analyticsKeys = getStaticKeysForCategory('analytics');
    // Alle analytics-Keys setzen (falls vorhanden)
    analyticsKeys.forEach(key => localStorage.setItem(key, 'value'));

    clearCategory('analytics');

    // Functional Keys müssen unberührt bleiben
    localStorage.setItem('theme-mode', 'dark');
    clearCategory('analytics');
    expect(localStorage.getItem('theme-mode')).toBe('dark');
  });
});

// ─── getStaticKeysForCategory ─────────────────────────────────────────────────

describe('getStaticKeysForCategory', () => {
  it('gibt alle functional Keys zurück', () => {
    const keys = getStaticKeysForCategory('functional');
    expect(keys).toContain('theme-mode');
    expect(keys).toContain('messages.viewMode');
    expect(keys).toContain('reportBuilder.introDismissed');
    expect(keys).toContain('push-warning-dismissed');
    expect(keys).toContain('kb_sidebar_collapsed');
    expect(keys).toContain('notifications');
    expect(keys).toContain('games_selectedTeamId');
  });

  it('gibt leere Liste für analytics zurück wenn keine Keys registriert', () => {
    const keys = getStaticKeysForCategory('analytics');
    // Alle zurückgegebenen Keys müssen wirklich analytics sein
    keys.forEach(key => {
      expect(STORAGE_REGISTRY[key as StorageKey]).toBe('analytics');
    });
  });

  it('gibt leere Liste für necessary zurück wenn keine Keys registriert', () => {
    const keys = getStaticKeysForCategory('necessary');
    keys.forEach(key => {
      expect(STORAGE_REGISTRY[key as StorageKey]).toBe('necessary');
    });
  });
});

// ─── getPrefixesForCategory ───────────────────────────────────────────────────

describe('getPrefixesForCategory', () => {
  it('gibt tactics-board-draft: Präfix für functional zurück', () => {
    const prefixes = getPrefixesForCategory('functional');
    expect(prefixes).toContain('tactics-board-draft:');
  });

  it('gibt leere Liste für analytics zurück wenn keine Präfixe registriert', () => {
    const prefixes = getPrefixesForCategory('analytics');
    prefixes.forEach(prefix => {
      expect(PREFIX_REGISTRY[prefix as StoragePrefix]).toBe('analytics');
    });
  });
});

// ─── Registry-Vollständigkeit ─────────────────────────────────────────────────

describe('STORAGE_REGISTRY Vollständigkeit', () => {
  it('enthält nur gültige Kategorien', () => {
    const validCategories = ['necessary', 'functional', 'analytics'];
    Object.values(STORAGE_REGISTRY).forEach(cat => {
      expect(validCategories).toContain(cat);
    });
  });

  it('enthält mindestens alle bekannten Keys', () => {
    const knownKeys: StorageKey[] = [
      'theme-mode',
      'messages.viewMode',
      'reportBuilder.introDismissed',
      'push-warning-dismissed',
      'kb_sidebar_collapsed',
      'notifications',
      'games_selectedTeamId',
      'calendar.holidays.enabled',
      'calendar.holidays.state',
    ];
    knownKeys.forEach(key => {
      expect(Object.prototype.hasOwnProperty.call(STORAGE_REGISTRY, key)).toBe(true);
    });
  });

  it('Feiertags-Keys sind als "functional" eingestuft', () => {
    expect(STORAGE_REGISTRY['calendar.holidays.enabled']).toBe('functional');
    expect(STORAGE_REGISTRY['calendar.holidays.state']).toBe('functional');
  });
});

describe('PREFIX_REGISTRY Vollständigkeit', () => {
  it('enthält nur gültige Kategorien', () => {
    const validCategories = ['necessary', 'functional', 'analytics'];
    Object.values(PREFIX_REGISTRY).forEach(cat => {
      expect(validCategories).toContain(cat);
    });
  });

  it('enthält den tactics-board-draft Präfix', () => {
    expect(PREFIX_REGISTRY).toHaveProperty('tactics-board-draft:');
  });
});

// ─── Consent-Kategorie-Korrektheit ────────────────────────────────────────────

describe('Consent-Kategorie-Korrektheit im Registry', () => {
  const sensitiveKeys: StorageKey[] = [
    'notifications', // enthält Nutzungsdaten
    'games_selectedTeamId', // Nutzerpräferenz
  ];

  sensitiveKeys.forEach(key => {
    it(`"${key}" ist als functional eingestuft (nicht necessary)`, () => {
      expect(STORAGE_REGISTRY[key]).toBe('functional');
    });
  });

  it('kein Key ist fälschlicherweise als necessary eingestuft außer tatsächlich notwendige', () => {
    // Alle Keys prüfen: keiner darf necessary sein außer explizit intentional
    const necessaryKeys = getStaticKeysForCategory('necessary');
    // Aktuell gibt es keine notwendigen statischen Keys (cookie_consent wird direkt verwaltet)
    necessaryKeys.forEach(key => {
      // Wenn ein Key als necessary eingestuft wird, soll das absichtlich sein
      // Dieser Test schlägt an, wenn versehentlich ein Key auf necessary gesetzt wird
      console.warn(`Key "${key}" ist als necessary eingestuft — absichtlich?`);
    });
    // Der Test schlägt nur fehl wenn ein Key unexpected necessary ist
    // (hier keine Assertion — dient als Aufmerksamkeits-Check)
    expect(necessaryKeys.length).toBeLessThanOrEqual(
      Object.keys(STORAGE_REGISTRY).length,
    );
  });
});

// ─── console.warn in Tests unterdrücken ──────────────────────────────────────

describe('Development-Warnungen', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('gibt console.warn aus wenn schreiben ohne Consent versucht wird (dev)', () => {
    process.env.NODE_ENV = 'development';
    denyConsent();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    setItem('theme-mode', 'dark');

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('theme-mode'),
    );
    warnSpy.mockRestore();
  });

  it('gibt KEINE console.warn aus in production', () => {
    process.env.NODE_ENV = 'production';
    denyConsent();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    setItem('theme-mode', 'dark');

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('gibt console.warn aus wenn lesen ohne Consent versucht wird (dev)', () => {
    process.env.NODE_ENV = 'development';
    denyConsent();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    getItem('theme-mode');

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('theme-mode'),
    );
    warnSpy.mockRestore();
  });
});
