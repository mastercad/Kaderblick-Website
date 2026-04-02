/**
 * useSquadDrop
 *
 * Verantwortlich für:
 * - HTML5-Drag aus der Squad-Liste auf das Feld (Maus, Desktop)
 * - Touch-Drag aus der Squad-Liste auf das Feld (Tablet/Touch über globale Handler)
 * - Platzhalter ersetzen (Position und Koordinaten bleiben erhalten)
 * - Echten Feldspieler verdrängen → Spieler geht auf die Bank
 * - Ablage auf freier Feldfläche → Spieler wird an dieser Position eingefügt
 * - Highlight-Feedback für das nächstgelegene Token während des Drag
 *
 * Hintergrund: Das HTML5-Drag-API (draggable / onDragStart / onDrop) funktioniert
 * auf Touch-Geräten nicht – Touch-Events lösen keinen „dragstart" aus. Deshalb
 * werden für Touch globale document-Listener (touchmove / touchend) aktiviert,
 * sobald ein Kader-Spieler angefasst wird (handleSquadDragStart). Die Handler
 * lesen via Refs (playersRef, benchPlayersRef, …) immer den aktuellen State,
 * ohne Stale-Closure-Probleme.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getRelativePosition } from './helpers';
import { appendBenchPlayerUnique, nextLocalPlayerId } from './playerIdentity';
import { getBestFreeTemplateSlot, getBestFreeformGuideTarget, getDragGuideProfile } from './templateGuidance';
import type { Player, PlayerData } from './types';

const SNAP_THRESHOLD = 9;

interface UseSquadDropParams {
  autoSnapEnabled: boolean;
  currentTemplateCode: string | null;
  players: PlayerData[];
  setPlayers: React.Dispatch<React.SetStateAction<PlayerData[]>>;
  benchPlayers: PlayerData[];
  setBenchPlayers: React.Dispatch<React.SetStateAction<PlayerData[]>>;
  nextPlayerNumber: number;
  setNextPlayerNumber: React.Dispatch<React.SetStateAction<number>>;
  pitchRef: React.RefObject<HTMLDivElement | null>;
}

export function useSquadDrop({
  autoSnapEnabled,
  currentTemplateCode,
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

  // Refs für stale-closure-sicheren Zugriff in globalen Event-Handlern
  const squadDragPlayerRef = useRef<Player | null>(null);
  const playersRef         = useRef<PlayerData[]>(players);
  const benchPlayersRef    = useRef<PlayerData[]>(benchPlayers);
  const nextNumRef         = useRef<number>(nextPlayerNumber);

  useEffect(() => { playersRef.current      = players;          }, [players]);
  useEffect(() => { benchPlayersRef.current = benchPlayers;     }, [benchPlayers]);
  useEffect(() => { nextNumRef.current      = nextPlayerNumber; }, [nextPlayerNumber]);

  /** Nächstes Token in der übergebenen Liste innerhalb von `threshold` % Feldbreite. */
  const findNearestInList = (
    list: PlayerData[],
    x: number,
    y: number,
    threshold = SNAP_THRESHOLD,
  ): PlayerData | null => {
    let nearest: PlayerData | null = null;
    let minDist = threshold;
    for (const p of list) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < minDist) { minDist = d; nearest = p; }
    }
    return nearest;
  };

  /**
   * Gemeinsame Drop-Logik für Maus (HTML5 ondrop) und Touch.
   * Liest alle nötigen Werte aus Refs → kein Stale-Closure-Problem.
   */
  const executeDropAt = useCallback((clientX: number, clientY: number) => {
    const player = squadDragPlayerRef.current;
    const pitch  = pitchRef.current;
    setSquadDragPlayer(null);
    squadDragPlayerRef.current = null;
    setHighlightedTokenId(null);
    if (!player || !pitch) return;

    const pos            = getRelativePosition(clientX, clientY, pitch);
    const currentPlayers = playersRef.current;
    const currentBench   = benchPlayersRef.current;
    const currentNextNum = nextNumRef.current;

    const nearest        = findNearestInList(currentPlayers, pos.x, pos.y);
    const alreadyOnField = currentPlayers.some(p => p.playerId === player.id);
    const alreadyOnBench = currentBench.some(p  => p.playerId === player.id);

    if (nearest) {
      if (nearest.isRealPlayer) {
        // Echten Feldspieler verdrängen → er geht auf die Bank
        if (!alreadyOnField && !alreadyOnBench) {
          const displaced   = { ...nearest };
          const incomingNum = player.shirtNumber != null ? player.shirtNumber : currentNextNum;
          if (player.shirtNumber == null) setNextPlayerNumber(n => n + 1);
          setPlayers(prev => prev.map(p =>
            p.id === nearest!.id
              ? { ...p, name: player.name, number: incomingNum, playerId: player.id, isRealPlayer: true, position: player.position ?? undefined, alternativePositions: player.alternativePositions ?? [] }
              : p,
          ));
          setBenchPlayers(prev => appendBenchPlayerUnique(prev, displaced));
        }
      } else {
        // Platzhalter ersetzen – Position (x/y + Label) bleibt erhalten
        if (!alreadyOnField && !alreadyOnBench) {
          const incomingNum = player.shirtNumber != null ? player.shirtNumber : currentNextNum;
          if (player.shirtNumber == null) setNextPlayerNumber(n => n + 1);
          setPlayers(prev => prev.map(p =>
            p.id === nearest!.id
              ? { ...p, name: player.name, number: incomingNum, playerId: player.id, isRealPlayer: true, position: player.position ?? undefined, alternativePositions: player.alternativePositions ?? [] }
              : p,
          ));
        }
      }
    } else if (!alreadyOnField && !alreadyOnBench) {
      const finalPos = autoSnapEnabled
        ? (() => {
            const profile = getDragGuideProfile(player);
            const snappedSlot = getBestFreeTemplateSlot({
              templateCode: currentTemplateCode,
              profile,
              players: currentPlayers,
              anchorPosition: pos,
            });
            const fallbackTarget = snappedSlot ? null : getBestFreeformGuideTarget(profile, pos);

            if (snappedSlot) return { x: snappedSlot.slot.x, y: snappedSlot.slot.y };
            if (fallbackTarget) return { x: fallbackTarget.x, y: fallbackTarget.y };
            return pos;
          })()
        : pos;

      // Ablage auf freier Feldfläche
      setPlayers(prev => [...prev, {
        id: nextLocalPlayerId(),
        ...finalPos,
        number: player.shirtNumber ?? currentNextNum,
        name: player.name,
        playerId: player.id,
        isRealPlayer: true,
        position: player.position ?? undefined,
        alternativePositions: player.alternativePositions ?? [],
      }]);
      setNextPlayerNumber(n => n + 1);
    }
  }, [autoSnapEnabled, currentTemplateCode, pitchRef, setPlayers, setBenchPlayers, setNextPlayerNumber]);

  /**
   * Globale Touch-Handler – aktiv nur wenn ein Kader-Spieler gezogen wird.
   * Nötig weil Touch-Events auf dem Element feuern, wo der Touch BEGANN
   * (die Squad-Liste), nicht auf dem Element unter dem Finger (das Feld).
   */
  useEffect(() => {
    if (!squadDragPlayer) return;

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const pitch = pitchRef.current;
      if (!pitch) return;
      const rect     = pitch.getBoundingClientRect();
      const overPitch = touch.clientX >= rect.left && touch.clientX <= rect.right &&
                        touch.clientY >= rect.top  && touch.clientY <= rect.bottom;
      if (overPitch) {
        // Scroll unterdrücken wenn der Finger über dem Feld ist
        e.preventDefault();
        const pos  = getRelativePosition(touch.clientX, touch.clientY, pitch);
        const near = findNearestInList(playersRef.current, pos.x, pos.y);
        setHighlightedTokenId(near?.id ?? null);
      } else {
        setHighlightedTokenId(null);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      const pitch = pitchRef.current;
      if (pitch) {
        const rect     = pitch.getBoundingClientRect();
        const overPitch = touch.clientX >= rect.left && touch.clientX <= rect.right &&
                          touch.clientY >= rect.top  && touch.clientY <= rect.bottom;
        if (overPitch) {
          executeDropAt(touch.clientX, touch.clientY);
          return;
        }
      }
      // Touch endete außerhalb des Feldes → Drag abbrechen
      setSquadDragPlayer(null);
      squadDragPlayerRef.current = null;
      setHighlightedTokenId(null);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend',  handleTouchEnd);
    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend',  handleTouchEnd);
    };
  }, [squadDragPlayer, executeDropAt, pitchRef]);

  const handleSquadDragStart = (player: Player) => {
    setSquadDragPlayer(player);
    squadDragPlayerRef.current = player;
  };

  const handleSquadDragEnd = () => {
    setSquadDragPlayer(null);
    squadDragPlayerRef.current = null;
    setHighlightedTokenId(null);
  };

  const handlePitchDragOver = (e: React.DragEvent) => {
    if (!squadDragPlayer || !pitchRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const pos  = getRelativePosition(e.clientX, e.clientY, pitchRef.current);
    const near = findNearestInList(players, pos.x, pos.y);
    setHighlightedTokenId(near?.id ?? null);
  };

  const handlePitchDrop = (e: React.DragEvent) => {
    e.preventDefault();
    executeDropAt(e.clientX, e.clientY);
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
