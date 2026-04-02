import { getBestFreeTemplateSlot, getRecommendedRoleZone, getRoleZoneSnapPosition, getSlotHintLabel, getSlotMatchLevel } from '../templateGuidance';
import type { PlayerData } from '../types';

describe('templateGuidance', () => {
  it('bewertet exakte, alternative und kategorielle Treffer korrekt', () => {
    expect(getSlotMatchLevel({ name: 'Test', position: 'ST', alternativePositions: ['RA'] }, 'ST')).toBe('exact');
    expect(getSlotMatchLevel({ name: 'Test', position: 'ST', alternativePositions: ['RA'] }, 'RA')).toBe('alternative');
    expect(getSlotMatchLevel({ name: 'Test', position: 'ZM', alternativePositions: [] }, 'DM')).toBe('category');
    expect(getSlotMatchLevel({ name: 'Test', position: 'TW', alternativePositions: [] }, 'ST')).toBe('none');
  });

  it('liefert passende Hinweislabels', () => {
    expect(getSlotHintLabel('exact')).toBe('Ideal');
    expect(getSlotHintLabel('alternative')).toBe('Alternativ');
    expect(getSlotHintLabel('category')).toBe('Machbar');
    expect(getSlotHintLabel('none')).toBeNull();
  });

  it('wählt den besten freien Slot der aktiven Vorlage', () => {
    const occupyingPlayer: PlayerData = {
      id: 1,
      x: 62,
      y: 14,
      number: 11,
      name: 'Besetzt',
      playerId: 11,
      isRealPlayer: true,
      position: 'ST',
      alternativePositions: [],
    };

    const bestSlot = getBestFreeTemplateSlot({
      templateCode: '4-4-2',
      profile: { name: 'Stürmer', position: 'ST', alternativePositions: [] },
      players: [occupyingPlayer],
      anchorPosition: { x: 50, y: 20 },
    });

    expect(bestSlot?.slot.position).toBe('ST');
    expect(bestSlot?.slot.x).toBe(38);
    expect(bestSlot?.slot.y).toBe(14);
    expect(bestSlot?.matchLevel).toBe('exact');
  });

  it('liefert ohne aktive Vorlage eine sinnvolle Rollen-Zone und Snap-Position', () => {
    const zone = getRecommendedRoleZone({ name: 'Achter', position: 'ZM', alternativePositions: ['DM'] });
    const snapPosition = getRoleZoneSnapPosition(
      { name: 'Achter', position: 'ZM', alternativePositions: ['DM'] },
      { x: 71, y: 88 },
    );

    expect(zone?.label).toBe('MITTELFELD');
    expect(snapPosition?.x).toBe(71);
    expect(snapPosition?.y).toBe(39);
    expect(snapPosition?.zone.label).toBe('MITTELFELD');
  });
});