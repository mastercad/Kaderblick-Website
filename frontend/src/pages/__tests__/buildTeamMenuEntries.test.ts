/**
 * Unit-Tests für buildTeamMenuEntries (Formations.tsx).
 *
 * Abgedeckte Fälle:
 *  - Leere Teamliste → keine Einträge
 *  - Nur zugeordnete Teams → keine Gruppenüberschriften, alle nicht abgedimmt
 *  - Nur weitere Teams → keine Gruppenüberschriften, alle nicht abgedimmt
 *  - Beide Gruppen vorhanden → Überschriften "Meine Teams" / "Weitere Teams",
 *    weitere Teams sind abgedimmt
 *  - Reihenfolge: zugeordnete Teams kommen zuerst
 */

import { buildTeamMenuEntries } from '../../utils/teamMenuEntries';

const makeTeam = (id: number, name: string, assigned?: boolean) => ({ id, name, assigned });

describe('buildTeamMenuEntries', () => {
  it('gibt leere Liste zurück wenn keine Teams vorhanden', () => {
    expect(buildTeamMenuEntries([])).toEqual([]);
  });

  it('gibt nur Items ohne Header zurück wenn alle Teams zugeordnet sind', () => {
    const teams = [makeTeam(1, 'Team A', true), makeTeam(2, 'Team B', true)];
    const entries = buildTeamMenuEntries(teams);

    expect(entries.every(e => e.type === 'item')).toBe(true);
    expect(entries).toHaveLength(2);
  });

  it('zugeordnete Teams sind nicht abgedimmt wenn nur eine Gruppe existiert', () => {
    const teams = [makeTeam(1, 'Team A', true)];
    const entries = buildTeamMenuEntries(teams);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ type: 'item', dimmed: false });
  });

  it('gibt nur Items ohne Header zurück wenn alle Teams nicht zugeordnet sind', () => {
    const teams = [makeTeam(1, 'Team A', false), makeTeam(2, 'Team B', false)];
    const entries = buildTeamMenuEntries(teams);

    expect(entries.every(e => e.type === 'item')).toBe(true);
    expect(entries).toHaveLength(2);
  });

  it('nicht-zugeordnete Teams sind nicht abgedimmt wenn nur eine Gruppe existiert', () => {
    const teams = [makeTeam(1, 'Team A', false)];
    const entries = buildTeamMenuEntries(teams);

    expect(entries[0]).toMatchObject({ type: 'item', dimmed: false });
  });

  it('behandelt Teams ohne assigned-Flag wie nicht zugeordnet', () => {
    const teams = [makeTeam(1, 'Team A')]; // assigned=undefined
    const entries = buildTeamMenuEntries(teams);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ type: 'item', dimmed: false });
  });

  describe('wenn beide Gruppen vorhanden sind', () => {
    const teams = [
      makeTeam(10, 'Mein Team', true),
      makeTeam(20, 'Anderes Team', false),
    ];

    it('fügt Header "Meine Teams" vor den zugeordneten Teams ein', () => {
      const entries = buildTeamMenuEntries(teams);
      const headerIdx = entries.findIndex(e => e.type === 'header' && e.label === 'Meine Teams');
      expect(headerIdx).toBe(0);
    });

    it('fügt Header "Weitere Teams" vor den nicht-zugeordneten Teams ein', () => {
      const entries = buildTeamMenuEntries(teams);
      const headerIdx = entries.findIndex(e => e.type === 'header' && e.label === 'Weitere Teams');
      expect(headerIdx).toBeGreaterThan(0);
    });

    it('hat insgesamt 4 Einträge (2 Header + 2 Items)', () => {
      expect(buildTeamMenuEntries(teams)).toHaveLength(4);
    });

    it('zugeordnete Team-Items sind nicht abgedimmt', () => {
      const entries = buildTeamMenuEntries(teams);
      const myItem = entries.find(e => e.type === 'item' && e.team.id === 10);
      expect(myItem).toMatchObject({ type: 'item', dimmed: false });
    });

    it('weitere Team-Items sind abgedimmt', () => {
      const entries = buildTeamMenuEntries(teams);
      const otherItem = entries.find(e => e.type === 'item' && e.team.id === 20);
      expect(otherItem).toMatchObject({ type: 'item', dimmed: true });
    });

    it('zugeordnete Teams erscheinen vor weiteren Teams', () => {
      const entries = buildTeamMenuEntries(teams);
      const myIdx = entries.findIndex(e => e.type === 'item' && e.team.id === 10);
      const otherIdx = entries.findIndex(e => e.type === 'item' && e.team.id === 20);
      expect(myIdx).toBeLessThan(otherIdx);
    });

    it('Header haben stabile keys', () => {
      const entries = buildTeamMenuEntries(teams);
      const headers = entries.filter(e => e.type === 'header');
      const keys = headers.map(e => e.key);
      expect(keys).toContain('grp-my');
      expect(keys).toContain('grp-other');
    });
  });

  it('mehrere zugeordnete und weitere Teams werden korrekt gruppiert', () => {
    const teams = [
      makeTeam(1, 'Mein A', true),
      makeTeam(2, 'Mein B', true),
      makeTeam(3, 'Anderes A', false),
      makeTeam(4, 'Anderes B', false),
    ];
    const entries = buildTeamMenuEntries(teams);

    // 2 Header + 4 Items
    expect(entries).toHaveLength(6);
    const headers = entries.filter(e => e.type === 'header');
    expect(headers).toHaveLength(2);
    const items = entries.filter(e => e.type === 'item');
    expect(items).toHaveLength(4);
    const dimmedItems = items.filter(e => e.dimmed);
    expect(dimmedItems).toHaveLength(2);
  });
});
