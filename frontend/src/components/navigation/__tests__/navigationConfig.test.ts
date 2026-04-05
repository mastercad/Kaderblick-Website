/**
 * Tests for navigationConfig.tsx
 *
 * Pure unit tests — no React rendering required.
 */
import {
  isNavItemActive,
  getAdminMenuSections,
  navigationItems,
  trainerMenuItems,
  navItemIconMap,
} from '../navigationConfig';

// ── isNavItemActive ───────────────────────────────────────────────────────────

describe('isNavItemActive', () => {
  describe('home key', () => {
    it('matches "/"', () => {
      expect(isNavItemActive('/', 'home')).toBe(true);
    });

    it('matches empty string', () => {
      expect(isNavItemActive('', 'home')).toBe(true);
    });

    it('does not match "/dashboard"', () => {
      expect(isNavItemActive('/dashboard', 'home')).toBe(false);
    });

    it('does not match "/home"', () => {
      expect(isNavItemActive('/home', 'home')).toBe(false);
    });
  });

  describe('surveys key', () => {
    it('matches "/surveys"', () => {
      expect(isNavItemActive('/surveys', 'surveys')).toBe(true);
    });

    it('matches "/surveys/123"', () => {
      expect(isNavItemActive('/surveys/123', 'surveys')).toBe(true);
    });

    it('matches "/survey/456" (detail route)', () => {
      expect(isNavItemActive('/survey/456', 'surveys')).toBe(true);
    });

    it('does not match "/survey-results"', () => {
      expect(isNavItemActive('/survey-results', 'surveys')).toBe(false);
    });

    it('does not match "/my-surveys"', () => {
      expect(isNavItemActive('/my-surveys', 'surveys')).toBe(false);
    });
  });

  describe('standard keys', () => {
    it('matches exact route "/dashboard"', () => {
      expect(isNavItemActive('/dashboard', 'dashboard')).toBe(true);
    });

    it('matches sub-route "/dashboard/stats"', () => {
      expect(isNavItemActive('/dashboard/stats', 'dashboard')).toBe(true);
    });

    it('does not match a different route', () => {
      expect(isNavItemActive('/calendar', 'dashboard')).toBe(false);
    });

    it('does not match a route that only starts with the key', () => {
      expect(isNavItemActive('/games-live', 'games')).toBe(false);
    });

    it('matches /calendar', () => {
      expect(isNavItemActive('/calendar', 'calendar')).toBe(true);
    });

    it('matches /my-team and sub-routes', () => {
      expect(isNavItemActive('/my-team', 'my-team')).toBe(true);
      expect(isNavItemActive('/my-team/123', 'my-team')).toBe(true);
    });

    it('matches /mein-feedback', () => {
      expect(isNavItemActive('/mein-feedback', 'mein-feedback')).toBe(true);
    });

    it('matches /tasks', () => {
      expect(isNavItemActive('/tasks', 'tasks')).toBe(true);
    });
  });
});

// ── navigationItems ───────────────────────────────────────────────────────────

describe('navigationItems', () => {
  it('contains 12 items', () => {
    expect(navigationItems).toHaveLength(12);
  });

  it('first item has key "home"', () => {
    expect(navigationItems[0].key).toBe('home');
  });

  it('every item has key, label and disabled flag', () => {
    navigationItems.forEach(item => {
      expect(typeof item.key).toBe('string');
      expect(typeof item.label).toBe('string');
      expect(typeof item.disabled).toBe('boolean');
    });
  });

  it('no item is disabled by default', () => {
    expect(navigationItems.every(i => !i.disabled)).toBe(true);
  });

  it('contains expected keys', () => {
    const keys = navigationItems.map(i => i.key);
    expect(keys).toEqual(
      expect.arrayContaining(['home', 'dashboard', 'my-team', 'calendar', 'games', 'reports', 'news', 'surveys', 'mein-feedback', 'tasks', 'mein-spieltag']),
    );
  });
});

// ── trainerMenuItems ──────────────────────────────────────────────────────────

describe('trainerMenuItems', () => {
  it('contains 4 items', () => {
    expect(trainerMenuItems).toHaveLength(4);
  });

  it('every item has key, label and icon', () => {
    trainerMenuItems.forEach(item => {
      expect(typeof item.key).toBe('string');
      expect(typeof item.label).toBe('string');
      expect(item.icon).toBeDefined();
    });
  });

  it('contains expected keys', () => {
    const keys = trainerMenuItems.map(i => i.key);
    expect(keys).toEqual(
      expect.arrayContaining(['team-size-guide', 'formations', 'players', 'teams']),
    );
  });
});

// ── navItemIconMap ────────────────────────────────────────────────────────────

describe('navItemIconMap', () => {
  const expectedKeys = ['home', 'dashboard', 'my-team', 'calendar', 'games', 'reports', 'news', 'surveys', 'mein-feedback', 'tasks', 'mein-spieltag', 'player-tips'];

  it('defines an icon for every nav key', () => {
    expectedKeys.forEach(key => {
      expect(navItemIconMap[key]).toBeDefined();
    });
  });

  it('contains exactly the expected keys', () => {
    expect(Object.keys(navItemIconMap).sort()).toEqual(expectedKeys.sort());
  });
});

// ── getAdminMenuSections ──────────────────────────────────────────────────────

describe('getAdminMenuSections', () => {
  it('returns exactly 3 sections', () => {
    expect(getAdminMenuSections(false)).toHaveLength(3);
    expect(getAdminMenuSections(true)).toHaveLength(3);
  });

  it('section names are Stammdaten, Verwaltung, Zuweisungen', () => {
    const sections = getAdminMenuSections(false);
    expect(sections.map(s => s.section)).toEqual(['Stammdaten', 'Verwaltung', 'Zuweisungen']);
  });

  it('every item has a label and an icon', () => {
    getAdminMenuSections(true).forEach(section => {
      section.items.forEach(item => {
        expect(typeof item.label).toBe('string');
        expect(item.icon).toBeDefined();
      });
    });
  });

  describe('without superAdmin (isSuperAdmin=false)', () => {
    let verwaltung: ReturnType<typeof getAdminMenuSections>[number];

    beforeEach(() => {
      verwaltung = getAdminMenuSections(false).find(s => s.section === 'Verwaltung')!;
    });

    it('does not include XP-Konfiguration', () => {
      expect(verwaltung.items.map(i => i.label)).not.toContain('XP-Konfiguration');
    });

    it('does not include Nutzeraktivität', () => {
      expect(verwaltung.items.map(i => i.label)).not.toContain('Nutzeraktivität');
    });

    it('does not include System-Einstellungen', () => {
      expect(verwaltung.items.map(i => i.label)).not.toContain('System-Einstellungen');
    });
  });

  describe('with superAdmin (isSuperAdmin=true)', () => {
    let verwaltung: ReturnType<typeof getAdminMenuSections>[number];

    beforeEach(() => {
      verwaltung = getAdminMenuSections(true).find(s => s.section === 'Verwaltung')!;
    });

    it('includes XP-Konfiguration', () => {
      expect(verwaltung.items.map(i => i.label)).toContain('XP-Konfiguration');
    });

    it('includes Nutzeraktivität', () => {
      expect(verwaltung.items.map(i => i.label)).toContain('Nutzeraktivität');
    });

    it('includes System-Einstellungen', () => {
      expect(verwaltung.items.map(i => i.label)).toContain('System-Einstellungen');
    });
  });

  describe('Stammdaten section', () => {
    it('contains Altersgruppen and Ligen', () => {
      const stammdaten = getAdminMenuSections(false).find(s => s.section === 'Stammdaten')!;
      const labels = stammdaten.items.map(i => i.label);
      expect(labels).toContain('Altersgruppen');
      expect(labels).toContain('Ligen');
    });
  });

  describe('Zuweisungen section', () => {
    it('contains Benutzer and Videos', () => {
      const zuweisungen = getAdminMenuSections(false).find(s => s.section === 'Zuweisungen')!;
      const labels = zuweisungen.items.map(i => i.label);
      expect(labels).toContain('Benutzer');
      expect(labels).toContain('Videos');
    });
  });
});
