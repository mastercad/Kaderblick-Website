/**
 * useSquadDrop
 *
 * Verantwortlich für:
 * - HTML5-Drag aus der Squad-Liste auf das Feld
 * - Platzhalter ersetzen (Position und Koordinaten bleiben erhalten)
 * - Echten Feldspieler verdrängen → Spieler geht auf die Bank
 * - Ablage auf freier Feldfläche → Spieler wird an dieser Position eingefügt
 * - Highlight-Feedback für das nächstgelegene Token während des Drag
 */
import React, { useState } from 'react';
import { getRelativePosition } from './helpers';
import type { Player, PlayerData } from './types';

interface UseSquadDropParams {
  players: PlayerData[];
  setPlayers: React.Dispatch<React.SetStateAction<PlayerData[]>>;
  benchPlayers: PlayerData[];
  setBenchPlayers: React.Dispatch<React.SetStateAction<PlayerData[]>>;
  nextPlayerNumber: number;
  setNextPlayerNumber: React.Dispatch<React.SetStateAction<number>>;
  pitchRef: React.RefObject<HTMLDivElement | null>;
}

export function useSquadDrop({
  players,
  setPlayers,
  benchPlayers,
  setBenchPlayers,
  nextPlayerNumber,
  setNextPlayerNumber,
  pitchRef,
}: UseSquadDropParams) {
  const [squadDragPlayer, setSquadDragPlayer] = useState<Player | null>(null);
  const [highlightedTokenId, setHighlightedTokenId] = useState<number | null>(null);

  /** Gibt das nächstgelegene Feld-Token innerhalb von `threshold` % Feldbreite zurück. */
  const findNearestToken = (x: number, y: number, threshold = 9): PlayerData | null => {
    let nearest: PlayerData | null = null;
    let minDist = threshold;
    for (const p of players) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < minDist) { minDist = d; nearest = p; }
    }
    return nearest;
  };

  const handleSquadDragStart = (player: Player) => setSquadDragPlayer(player);

  const handleSquadDragEnd = () => {
    setSquadDragPlayer(null);
    setHighlightedTokenId(null);
  };

  const handlePitchDragOver = (e: React.DragEvent) => {
    if (!squadDragPlayer || !pitchRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const pos = getRelativePosition(e.clientX, e.clientY, pitchRef.current);
    const near = findNearestToken(pos.x, pos.y);
    setHighlightedTokenId(near?.id ?? null);
  };

  const handlePitchDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!pitchRef.current) return;

    const player = squadDragPlayer;
    setSquadDragPlayer(null);
    setHighlightedTokenId(null);
    if (!player) return;

    const pos = getRelativePosition(e.clientX, e.clientY, pitchRef.current);
    const nearest = findNearestToken(pos.x, pos.y);

    const alreadyOnField = players.some(p => p.playerId === player.id);
    const alreadyOnBench = benchPlayers.some(p => p.playerId === player.id);

    if (nearest) {
      if (nearest.isRealPlayer) {
        // Echten Feldspieler verdrängen → er geht auf die Bank
        if (!alreadyOnField && !alreadyOnBench) {
          const displaced = { ...nearest };
          const incomingNumber = player.shirtNumber != null ? player.shirtNumber : nextPlayerNumber;
          if (player.shirtNumber == null) setNextPlayerNumber(n => n + 1);
          setPlayers(prev => prev.map(p =>
            p.id === nearest.id
              ? { ...p, name: player.name, number: incomingNumber, playerId: player.id, isRealPlayer: true, position: player.position ?? undefined, alternativePositions: player.alternativePositions ?? [] }
              : p,
          ));
          setBenchPlayers(prev => [...prev, displaced]);
        }
      } else {
        // Platzhalter ersetzen – Position (x/y + Label) bleibt erhalten
        if (!alreadyOnField && !alreadyOnBench) {
          const incomingNumber = player.shirtNumber != null ? player.shirtNumber : nextPlayerNumber;
          if (player.shirtNumber == null) setNextPlayerNumber(n => n + 1);
          setPlayers(prev => prev.map(p =>
            p.id === nearest.id
              ? { ...p, name: player.name, number: incomingNumber, playerId: player.id, isRealPlayer: true, position: player.position ?? undefined, alternativePositions: player.alternativePositions ?? [] }
              : p,
          ));
        }
      }
    } else if (!alreadyOnField && !alreadyOnBench) {
      // Ablage auf freier Feldfläche
      setPlayers(prev => [...prev, {
        id: Date.now() + Math.floor(Math.random() * 1e6),
        ...pos,
        number: player.shirtNumber ?? nextPlayerNumber,
        name: player.name,
        playerId: player.id,
        isRealPlayer: true,
        position: player.position ?? undefined,
        alternativePositions: player.alternativePositions ?? [],
      }]);
      setNextPlayerNumber(n => n + 1);
    }
  };

  return {
    squadDragPlayer,
    highlightedTokenId,
    handleSquadDragStart,
    handleSquadDragEnd,
    handlePitchDragOver,
    handlePitchDrop,
  };
}
