import { useCallback, useRef, useState } from 'react';
import type { PlayerData } from './types';

interface Snapshot {
  players: PlayerData[];
  benchPlayers: PlayerData[];
}

const MAX_HISTORY = 50;

function cloneSnapshot(players: PlayerData[], benchPlayers: PlayerData[]): Snapshot {
  return {
    players: players.map(p => ({ ...p, alternativePositions: [...(p.alternativePositions ?? [])] })),
    benchPlayers: benchPlayers.map(p => ({ ...p, alternativePositions: [...(p.alternativePositions ?? [])] })),
  };
}

export function useUndoRedo() {
  const pastRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  /** Snapshot VOR einer Aktion pushen. Löscht die Redo-History. */
  const push = useCallback((players: PlayerData[], benchPlayers: PlayerData[]) => {
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), cloneSnapshot(players, benchPlayers)];
    futureRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback((
    currentPlayers: PlayerData[],
    currentBenchPlayers: PlayerData[],
    setPlayers: React.Dispatch<React.SetStateAction<PlayerData[]>>,
    setBenchPlayers: React.Dispatch<React.SetStateAction<PlayerData[]>>,
  ) => {
    if (pastRef.current.length === 0) return;
    const prev = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [cloneSnapshot(currentPlayers, currentBenchPlayers), ...futureRef.current];
    setPlayers(prev.players);
    setBenchPlayers(prev.benchPlayers);
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback((
    currentPlayers: PlayerData[],
    currentBenchPlayers: PlayerData[],
    setPlayers: React.Dispatch<React.SetStateAction<PlayerData[]>>,
    setBenchPlayers: React.Dispatch<React.SetStateAction<PlayerData[]>>,
  ) => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current, cloneSnapshot(currentPlayers, currentBenchPlayers)];
    setPlayers(next.players);
    setBenchPlayers(next.benchPlayers);
    setCanUndo(true);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const reset = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  return { push, undo, redo, reset, canUndo, canRedo };
}
