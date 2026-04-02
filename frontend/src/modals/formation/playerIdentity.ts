import type { PlayerData } from './types';

let localPlayerIdCounter = Date.now();

export const nextLocalPlayerId = (): number => {
  localPlayerIdCounter += 1;
  return localPlayerIdCounter;
};

export const appendBenchPlayerUnique = (bench: PlayerData[], player: PlayerData): PlayerData[] => {
  const hasSameId = bench.some(entry => entry.id === player.id);
  const hasSameRealPlayer = player.playerId != null && bench.some(entry => entry.playerId === player.playerId);
  if (hasSameId || hasSameRealPlayer) return bench;
  return [...bench, player];
};

export const normalizeLocalPlayerIds = <T extends PlayerData>(players: T[], usedIds: Set<number> = new Set()): T[] => (
  players.map(player => {
    const currentId = typeof player.id === 'number' && Number.isFinite(player.id) ? player.id : null;
    const nextId = currentId != null && !usedIds.has(currentId) ? currentId : nextLocalPlayerId();
    usedIds.add(nextId);
    return nextId === player.id ? player : { ...player, id: nextId };
  })
);