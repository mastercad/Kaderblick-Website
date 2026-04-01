/**
 * useFieldDrag
 *
 * Verantwortlich für:
 * - Pointer- und Touch-Drag von Tokens, die bereits auf dem Feld liegen
 * - Drag von der Bank aufs Feld via Pointer/Touch
 * - Tauschen zweier Feld-Tokens per Drag & Drop (wenn beim Loslassen ein
 *   anderer Spieler in der Nähe liegt, werden die Positionen getauscht)
 *
 * Benutzt kein HTML5-Drag-API (das übernimmt useSquadDrop).
 *
 * Performance: Während des Drags wird kein React-State verändert.
 * Die Position des gezogenen Tokens wird direkt per DOM-Stil-Mutation
 * (via requestAnimationFrame) aktualisiert. setPlayers wird nur einmal
 * beim Loslassen (finalizeDrop) mit der finalen Position aufgerufen.
 */
import React, { useState, useRef, useCallback } from 'react';
import { getRelativePosition, getZoneColor } from './helpers';
import type { DragSource, PlayerData } from './types';

/** In % der Felddimensionen – Token gilt als "Ziel" wenn Abstand kleiner. */
const SWAP_THRESHOLD = 9;

interface UseFieldDragParams {
  players: PlayerData[];
  setPlayers: React.Dispatch<React.SetStateAction<PlayerData[]>>;
  benchPlayers: PlayerData[];
  setBenchPlayers: React.Dispatch<React.SetStateAction<PlayerData[]>>;
  pitchRef: React.RefObject<HTMLDivElement | null>;
  /** Map von Spieler-ID → DOM-Element des Tokens (für direkte Stil-Mutation). */
  tokenRefs: React.RefObject<Map<number, HTMLDivElement>>;
}

export function useFieldDrag({
  players,
  setPlayers,
  benchPlayers,
  setBenchPlayers,
  pitchRef,
  tokenRefs,
}: UseFieldDragParams) {
  const [draggedPlayerId, setDraggedPlayerId] = useState<number | null>(null);
  const [draggedFrom, setDraggedFrom] = useState<DragSource | null>(null);
  /** Ref-Spiegel von draggedFrom – wird synchron aktualisiert, damit rapidfire
   *  mousemove-Handler stets den aktuellen Wert lesen (stale-closure-Safe). */
  const draggedFromRef = useRef<DragSource | null>(null);
  /** Ref-Spiegel von draggedPlayerId – stale-closure-Safe für Move-Handler. */
  const draggedPlayerIdRef = useRef<number | null>(null);
  /** Ursprungsposition des gezogenen Tokens (für Swap-Logik). */
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  /** Letzte berechnete Drag-Position in % – wird im rAF-Callback gelesen. */
  const dragPosRef = useRef<{ x: number; y: number } | null>(null);
  /** Pending requestAnimationFrame-ID – verhindert mehrfach-Scheduling. */
  const rafRef = useRef<number | null>(null);

  const updateDraggedFrom = (val: DragSource | null) => {
    draggedFromRef.current = val;
    setDraggedFrom(val);
  };

  const updateDraggedTokenPreview = useCallback((id: number, x: number, y: number) => {
    const tokenEl = tokenRefs.current.get(id);
    if (!tokenEl) return;

    tokenEl.style.left = x + '%';
    tokenEl.style.top = y + '%';

    const circleEl = tokenEl.querySelector<HTMLElement>('[data-token-circle="true"]');
    if (circleEl) {
      circleEl.style.backgroundColor = getZoneColor(y);
    }
  }, [tokenRefs]);

  const startDragFromField = (id: number, e: React.MouseEvent | React.TouchEvent) => {
    const origin = players.find(p => p.id === id);
    draggedPlayerIdRef.current = id;
    dragOriginRef.current = origin ? { x: origin.x, y: origin.y } : null;
    setDraggedPlayerId(id);
    updateDraggedFrom('field');
    e.stopPropagation();
  };

  const startDragFromBench = (id: number, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); // Verhindert Textmarkierung beim Ziehen
    draggedPlayerIdRef.current = id;
    dragOriginRef.current = null;
    setDraggedPlayerId(id);
    updateDraggedFrom('bench');
    e.stopPropagation();
  };

  const applyDragMove = useCallback((clientX: number, clientY: number) => {
    const id = draggedPlayerIdRef.current;
    if (id === null || !pitchRef.current) return;

    const pos = getRelativePosition(clientX, clientY, pitchRef.current);
    const currentFrom = draggedFromRef.current;

    if (currentFrom === 'bench') {
      // Bank→Feld: erst den Spieler von der Bank nehmen (einmalig via React),
      // dann normal als Feld-Token behandeln
      const benched = benchPlayers.find(p => p.id === id);
      if (benched) {
        draggedFromRef.current = 'field';
        setDraggedFrom('field');
        dragOriginRef.current = null;
        setBenchPlayers(prev => prev.filter(p => p.id !== id));
        setPlayers(prev => [...prev, { ...benched, ...pos }]);
        // DOM-Element ist jetzt neu gemountet – nächster Move-Event setzt es direkt
      }
      return;
    }

    if (currentFrom !== 'field') return;

    // Drag-Position im Ref speichern (kein setState!)
    dragPosRef.current = pos;

    // Direkte DOM-Stil-Mutation, throttled auf 1× pro Frame
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const currentId = draggedPlayerIdRef.current;
        const currentPos = dragPosRef.current;
        if (currentId === null || currentPos === null) return;
        updateDraggedTokenPreview(currentId, currentPos.x, currentPos.y);
      });
    }
  }, [benchPlayers, setBenchPlayers, setPlayers, pitchRef, updateDraggedTokenPreview]);

  /**
   * Beim Loslassen:
   * - Field→Field: prüfe ob der gezogene Token auf einem anderen Feld-Token
   *   abgelegt wurde. Falls ja → Positionen tauschen statt überlappen.
   * - Bank→Feld: prüfe ob der Bank-Spieler auf einem Feld-Token abgelegt wurde.
   *   Falls ja → Feld-Spieler geht auf die Bank, Bank-Spieler übernimmt seine Position.
   */
  const finalizeDrop = useCallback(() => {
    // Pending rAF abbrechen – wir setzen gleich den State mit der finalen Position
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const id = draggedPlayerIdRef.current;
    const currentFrom = draggedFromRef.current;
    const finalPos = dragPosRef.current;

    if (id !== null && currentFrom === 'field') {
      const origin = dragOriginRef.current;
      if (origin) {
        // Field-to-field: Positionen tauschen
        setPlayers(prev => {
          // Hole finale Position aus DOM (falls rAF noch nicht gefeuert hat)
          const el = tokenRefs.current.get(id);
          const actualPos: { x: number; y: number } = el
            ? {
                x: parseFloat(el.style.left || String(finalPos?.x ?? 0)),
                y: parseFloat(el.style.top  || String(finalPos?.y ?? 0)),
              }
            : (finalPos ?? { x: origin.x, y: origin.y });

          // State auf finale DOM-Position bringen
          const withFinal = prev.map(p => p.id === id ? { ...p, ...actualPos } : p);
          const dragged = withFinal.find(p => p.id === id);
          if (!dragged) return prev;

          // Nächsten anderen Token in SWAP_THRESHOLD-Nähe suchen
          let nearest: PlayerData | null = null;
          let minDist = SWAP_THRESHOLD;
          for (const p of withFinal) {
            if (p.id === id) continue;
            const d = Math.hypot(p.x - dragged.x, p.y - dragged.y);
            if (d < minDist) { minDist = d; nearest = p; }
          }

          if (!nearest) return withFinal; // kein Ziel → Token bleibt wo er ist

          // Swap: gezogener Token → Position des Ziel-Tokens, Ziel-Token → Ursprung
          const targetPos = { x: nearest.x, y: nearest.y };
          return withFinal.map(p => {
            if (p.id === id)         return { ...p, x: targetPos.x, y: targetPos.y };
            if (p.id === nearest!.id) return { ...p, x: origin!.x,   y: origin!.y   };
            return p;
          });
        });
      } else {
        // Bank→Feld: verdränge Feldspieler auf die Bank
        setPlayers(prev => {
          const el = tokenRefs.current.get(id);
          const actualPos: { x: number; y: number } = el
            ? {
                x: parseFloat(el.style.left || String(finalPos?.x ?? 50)),
                y: parseFloat(el.style.top  || String(finalPos?.y ?? 50)),
              }
            : (finalPos ?? { x: 50, y: 50 });

          const withFinal = prev.map(p => p.id === id ? { ...p, ...actualPos } : p);
          const dragged = withFinal.find(p => p.id === id);
          if (!dragged) return prev;

          let nearest: PlayerData | null = null;
          let minDist = SWAP_THRESHOLD;
          for (const p of withFinal) {
            if (p.id === id) continue;
            const d = Math.hypot(p.x - dragged.x, p.y - dragged.y);
            if (d < minDist) { minDist = d; nearest = p; }
          }

          if (!nearest) return withFinal; // kein Ziel → Bank-Spieler bleibt wo er ist

          // Feldspieler geht auf die Bank, Bank-Spieler übernimmt seine Position
          const targetPos = { x: nearest.x, y: nearest.y };
          setBenchPlayers(b => [...b, { ...nearest! }]);
          return withFinal
            .filter(p => p.id !== nearest!.id)
            .map(p => p.id === id ? { ...p, ...targetPos } : p);
        });
      }
    }

    // Refs zurücksetzen
    draggedPlayerIdRef.current = null;
    dragPosRef.current = null;
    dragOriginRef.current = null;
    draggedFromRef.current = null;

    setDraggedPlayerId(null);
    setDraggedFrom(null);
  }, [setPlayers, setBenchPlayers, tokenRefs]);

  const handlePitchMouseMove = useCallback((e: React.MouseEvent) => applyDragMove(e.clientX, e.clientY), [applyDragMove]);

  const handlePitchTouchMove = useCallback((e: React.TouchEvent) => {
    applyDragMove(e.touches[0].clientX, e.touches[0].clientY);
  }, [applyDragMove]);

  return {
    draggedPlayerId,
    startDragFromField,
    startDragFromBench,
    handlePitchMouseMove,
    handlePitchMouseUp: finalizeDrop,
    handlePitchTouchMove,
    handlePitchTouchEnd: finalizeDrop,
  };
}
