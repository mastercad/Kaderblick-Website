import { buildTeamMenuEntries } from '../teamMenuEntries';
import type { TeamMenuItem } from '../teamMenuEntries';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const team = (id: number, name: string, assigned?: boolean): TeamMenuItem => ({ id, name, assigned });

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildTeamMenuEntries', () => {
  it('returns empty array for empty input', () => {
    expect(buildTeamMenuEntries([])).toEqual([]);
  });

  it('returns flat list (no headers) when only assigned teams exist', () => {
    const teams = [team(1, 'A-Team', true), team(2, 'B-Team', true)];
    const entries = buildTeamMenuEntries(teams);

    const headers = entries.filter(e => e.type === 'header');
    const items = entries.filter(e => e.type === 'item');

    expect(headers).toHaveLength(0);
    expect(items).toHaveLength(2);
  });

  it('does not dim items when only assigned teams exist', () => {
    const teams = [team(1, 'A-Team', true)];
    const entries = buildTeamMenuEntries(teams);

    expect(entries).toEqual([{ type: 'item', team: teams[0], dimmed: false }]);
  });

  it('returns flat list (no headers) when only non-assigned teams exist', () => {
    const teams = [team(1, 'X-Team'), team(2, 'Y-Team')];
    const entries = buildTeamMenuEntries(teams);

    const headers = entries.filter(e => e.type === 'header');
    expect(headers).toHaveLength(0);
    expect(entries).toHaveLength(2);
  });

  it('does not dim items when only non-assigned teams exist', () => {
    const teams = [team(1, 'X-Team')];
    const entries = buildTeamMenuEntries(teams);

    const item = entries[0];
    expect(item.type).toBe('item');
    if (item.type === 'item') {
      expect(item.dimmed).toBe(false);
    }
  });

  it('inserts group headers when both assigned and non-assigned teams exist', () => {
    const teams = [team(1, 'A-Team', true), team(2, 'X-Team')];
    const entries = buildTeamMenuEntries(teams);

    const headers = entries.filter(e => e.type === 'header');
    expect(headers).toHaveLength(2);
    expect(headers[0]).toMatchObject({ type: 'header', label: 'Meine Teams' });
    expect(headers[1]).toMatchObject({ type: 'header', label: 'Weitere Teams' });
  });

  it('places assigned teams before non-assigned teams when grouped', () => {
    const teams = [team(1, 'A-Team', true), team(2, 'X-Team')];
    const entries = buildTeamMenuEntries(teams);

    const itemEntries = entries.filter(e => e.type === 'item');
    expect(itemEntries[0]).toMatchObject({ team: teams[0] }); // assigned first
    expect(itemEntries[1]).toMatchObject({ team: teams[1] }); // non-assigned second
  });

  it('dims non-assigned team items when grouped', () => {
    const teams = [team(1, 'A-Team', true), team(2, 'X-Team')];
    const entries = buildTeamMenuEntries(teams);

    const items = entries.filter(e => e.type === 'item');
    if (items[0].type === 'item') expect(items[0].dimmed).toBe(false);
    if (items[1].type === 'item') expect(items[1].dimmed).toBe(true);
  });

  it('does not dim assigned team items when grouped', () => {
    const teams = [team(1, 'A-Team', true), team(2, 'X-Team')];
    const entries = buildTeamMenuEntries(teams);

    const assignedItem = entries.find(e => e.type === 'item' && e.team.id === 1);
    expect(assignedItem?.type).toBe('item');
    if (assignedItem?.type === 'item') {
      expect(assignedItem.dimmed).toBe(false);
    }
  });

  it('uses key grp-my for the first header', () => {
    const teams = [team(1, 'A-Team', true), team(2, 'X-Team')];
    const entries = buildTeamMenuEntries(teams);

    const firstHeader = entries.find(e => e.type === 'header');
    expect(firstHeader).toMatchObject({ key: 'grp-my' });
  });

  it('uses key grp-other for the second header', () => {
    const teams = [team(1, 'A-Team', true), team(2, 'X-Team')];
    const entries = buildTeamMenuEntries(teams);

    const headers = entries.filter(e => e.type === 'header');
    expect(headers[1]).toMatchObject({ key: 'grp-other' });
  });

  it('handles single assigned team flat (no groups)', () => {
    const teams = [team(1, 'Solo', true)];
    const entries = buildTeamMenuEntries(teams);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ type: 'item', team: teams[0], dimmed: false });
  });

  it('preserves order of multiple assigned teams', () => {
    const teams = [team(1, 'A', true), team(2, 'B', true), team(3, 'C')];
    const entries = buildTeamMenuEntries(teams);

    const items = entries.filter(e => e.type === 'item');
    expect(items.map(e => e.type === 'item' && e.team.id)).toEqual([1, 2, 3]);
  });

  it('preserves order of multiple non-assigned teams when grouped', () => {
    const teams = [team(1, 'A', true), team(2, 'B'), team(3, 'C')];
    const entries = buildTeamMenuEntries(teams);

    const items = entries.filter(e => e.type === 'item');
    expect(items[1]).toMatchObject({ team: teams[1] });
    expect(items[2]).toMatchObject({ team: teams[2] });
  });

  it('treats assigned=false the same as assigned=undefined (non-assigned)', () => {
    const teams = [team(1, 'A', true), { id: 2, name: 'B', assigned: false }];
    const entries = buildTeamMenuEntries(teams);

    const headers = entries.filter(e => e.type === 'header');
    expect(headers).toHaveLength(2); // grouped
  });
});
