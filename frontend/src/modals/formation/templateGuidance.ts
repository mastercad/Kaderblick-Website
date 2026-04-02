import { positionCategory } from './helpers';
import { FOOTBALL_TEMPLATES, type FormationTemplate, type TemplatePlayer } from './templates';
import type { Player, PlayerData } from './types';

export type SlotMatchLevel = 'exact' | 'alternative' | 'category' | 'none';

export interface DragGuideProfile {
  name: string;
  position?: string | null;
  alternativePositions?: string[];
}

export interface TemplateSlotCandidate {
  slot: TemplatePlayer;
  slotIndex: number;
  matchLevel: SlotMatchLevel;
}

export interface RoleZoneGuide {
  label: string;
  category: 'FWD' | 'MID' | 'DEF' | 'GK';
  top: number;
  height: number;
  centerY: number;
}

export interface FreeformGuideTarget {
  label: string;
  position: string;
  x: number;
  y: number;
  isAlternative: boolean;
}

const SLOT_OCCUPANCY_THRESHOLD = 8;

const MATCH_LEVEL_SCORE: Record<SlotMatchLevel, number> = {
  exact: 4,
  alternative: 3,
  category: 2,
  none: 0,
};

export const ROLE_ZONE_GUIDES: RoleZoneGuide[] = [
  { label: 'ANGRIFF', category: 'FWD', top: 4, height: 18, centerY: 13 },
  { label: 'MITTELFELD', category: 'MID', top: 27, height: 24, centerY: 39 },
  { label: 'ABWEHR', category: 'DEF', top: 56, height: 21, centerY: 66.5 },
  { label: 'TOR', category: 'GK', top: 81, height: 13, centerY: 87.5 },
];

export const getTemplateByCode = (templateCode: string | null | undefined): FormationTemplate | null => {
  if (!templateCode) return null;
  return FOOTBALL_TEMPLATES.find(template => template.code === templateCode) ?? null;
};

export const getDragGuideProfile = (player: PlayerData | Player | null | undefined): DragGuideProfile | null => {
  if (!player) return null;
  return {
    name: player.name,
    position: player.position ?? null,
    alternativePositions: player.alternativePositions ?? [],
  };
};

export const getSlotMatchLevel = (profile: DragGuideProfile | null, slotPosition: string): SlotMatchLevel => {
  if (!profile) return 'none';

  const mainPosition = profile.position?.toUpperCase().trim();
  const alternatives = (profile.alternativePositions ?? []).map(position => position.toUpperCase().trim());
  const normalizedSlot = slotPosition.toUpperCase().trim();

  if (mainPosition && mainPosition === normalizedSlot) return 'exact';
  if (alternatives.includes(normalizedSlot)) return 'alternative';

  const slotCategory = positionCategory(slotPosition);
  if (!slotCategory) return 'none';
  if (mainPosition && positionCategory(mainPosition) === slotCategory) return 'category';
  if (alternatives.some(position => positionCategory(position) === slotCategory)) return 'category';
  return 'none';
};

export const getSlotHintLabel = (matchLevel: SlotMatchLevel): string | null => {
  switch (matchLevel) {
    case 'exact':
      return 'Ideal';
    case 'alternative':
      return 'Alternativ';
    case 'category':
      return 'Machbar';
    default:
      return null;
  }
};

export const getRecommendedRoleZone = (profile: DragGuideProfile | null): RoleZoneGuide | null => {
  if (!profile) return null;

  const mainCategory = positionCategory(profile.position ?? undefined);
  if (mainCategory) {
    return ROLE_ZONE_GUIDES.find(zone => zone.category === mainCategory) ?? null;
  }

  for (const alternative of profile.alternativePositions ?? []) {
    const alternativeCategory = positionCategory(alternative);
    if (!alternativeCategory) continue;
    const zone = ROLE_ZONE_GUIDES.find(entry => entry.category === alternativeCategory);
    if (zone) return zone;
  }

  return null;
};

export const getRoleZoneSnapPosition = (
  profile: DragGuideProfile | null,
  anchorPosition: { x: number; y: number } | null | undefined,
): { x: number; y: number; zone: RoleZoneGuide } | null => {
  const zone = getRecommendedRoleZone(profile);
  if (!zone || !anchorPosition) return null;

  return {
    x: Math.max(8, Math.min(92, anchorPosition.x)),
    y: zone.centerY,
    zone,
  };
};

const POSITION_ANCHORS: Array<{ positions: string[]; x: number; y: number; label: string }> = [
  { positions: ['TW'], x: 50, y: 88, label: 'Tor' },
  { positions: ['LV', 'LIV', 'LVB', 'LAV'], x: 18, y: 68, label: 'Links hinten' },
  { positions: ['IV', 'DV', 'AV'], x: 50, y: 70, label: 'Zentrum Abwehr' },
  { positions: ['RV', 'RIV', 'RVB', 'RAV'], x: 82, y: 68, label: 'Rechts hinten' },
  { positions: ['DM', 'DMF', 'CDM'], x: 50, y: 56, label: 'Defensives Zentrum' },
  { positions: ['LM', 'LAM'], x: 22, y: 42, label: 'Links Mittelfeld' },
  { positions: ['ZM', 'ZMF', 'CM'], x: 50, y: 42, label: 'Zentrum Mittelfeld' },
  { positions: ['RM', 'RAM'], x: 78, y: 42, label: 'Rechts Mittelfeld' },
  { positions: ['OM', 'AM', 'CAM', 'ZOM', 'VOM'], x: 50, y: 30, label: 'Offensives Zentrum' },
  { positions: ['LF', 'LA', 'LW', 'LFA'], x: 24, y: 16, label: 'Links Angriff' },
  { positions: ['ST', 'MS', 'ZST', 'CF', 'SS'], x: 50, y: 12, label: 'Sturmzentrum' },
  { positions: ['RF', 'RA', 'RW', 'RFA'], x: 76, y: 16, label: 'Rechts Angriff' },
];

const findAnchorForPosition = (position: string): Omit<FreeformGuideTarget, 'position' | 'isAlternative'> | null => {
  const normalized = position.toUpperCase().trim();
  const direct = POSITION_ANCHORS.find(anchor => anchor.positions.includes(normalized));
  if (direct) {
    return { label: direct.label, x: direct.x, y: direct.y };
  }

  const category = positionCategory(normalized);
  if (!category) return null;

  if (category === 'GK') return { label: 'Tor', x: 50, y: 88 };
  if (category === 'DEF') return { label: 'Abwehrzentrum', x: 50, y: 68 };
  if (category === 'MID') return { label: 'Mittelfeldzentrum', x: 50, y: 42 };
  return { label: 'Angriffszentrum', x: 50, y: 14 };
};

export const getFreeformGuideTargets = (profile: DragGuideProfile | null): FreeformGuideTarget[] => {
  if (!profile) return [];

  const positions = [
    profile.position ?? null,
    ...(profile.alternativePositions ?? []),
  ].filter((position): position is string => Boolean(position));

  const unique = new Set<string>();
  const targets: FreeformGuideTarget[] = [];

  positions.forEach((position, index) => {
    const normalized = position.toUpperCase().trim();
    if (unique.has(normalized)) return;
    unique.add(normalized);
    const anchor = findAnchorForPosition(normalized);
    if (!anchor) return;
    targets.push({
      position: normalized,
      label: anchor.label,
      x: anchor.x,
      y: anchor.y,
      isAlternative: index > 0,
    });
  });

  return targets;
};

export const getBestFreeformGuideTarget = (
  profile: DragGuideProfile | null,
  anchorPosition: { x: number; y: number } | null | undefined,
): FreeformGuideTarget | null => {
  const targets = getFreeformGuideTargets(profile);
  if (targets.length === 0) return null;
  if (!anchorPosition) return targets[0];

  return [...targets].sort((left, right) => {
    if (left.isAlternative !== right.isAlternative) {
      return Number(left.isAlternative) - Number(right.isAlternative);
    }

    const leftDistance = Math.hypot(left.x - anchorPosition.x, left.y - anchorPosition.y);
    const rightDistance = Math.hypot(right.x - anchorPosition.x, right.y - anchorPosition.y);
    return leftDistance - rightDistance;
  })[0];
};

interface BestFreeTemplateSlotParams {
  templateCode: string | null | undefined;
  profile: DragGuideProfile | null;
  players: PlayerData[];
  movingPlayerId?: number;
  anchorPosition?: { x: number; y: number } | null;
}

export const getBestFreeTemplateSlot = ({
  templateCode,
  profile,
  players,
  movingPlayerId,
  anchorPosition,
}: BestFreeTemplateSlotParams): TemplateSlotCandidate | null => {
  const template = getTemplateByCode(templateCode);
  if (!template || !profile) return null;

  const otherPlayers = players.filter(player => player.id !== movingPlayerId);
  const anchor = anchorPosition ?? { x: 50, y: 50 };

  const candidates = template.players
    .map((slot, slotIndex) => {
      const matchLevel = getSlotMatchLevel(profile, slot.position);
      const occupied = otherPlayers.some(player => Math.hypot(player.x - slot.x, player.y - slot.y) <= SLOT_OCCUPANCY_THRESHOLD);
      return { slot, slotIndex, matchLevel, occupied };
    })
    .filter(candidate => candidate.matchLevel !== 'none' && !candidate.occupied);

  if (candidates.length === 0) return null;

  candidates.sort((left, right) => {
    const scoreDelta = MATCH_LEVEL_SCORE[right.matchLevel] - MATCH_LEVEL_SCORE[left.matchLevel];
    if (scoreDelta !== 0) return scoreDelta;

    const leftDistance = Math.hypot(left.slot.x - anchor.x, left.slot.y - anchor.y);
    const rightDistance = Math.hypot(right.slot.x - anchor.x, right.slot.y - anchor.y);
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;

    return left.slotIndex - right.slotIndex;
  });

  const best = candidates[0];
  return {
    slot: best.slot,
    slotIndex: best.slotIndex,
    matchLevel: best.matchLevel,
  };
};