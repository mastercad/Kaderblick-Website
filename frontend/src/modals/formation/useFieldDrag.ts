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
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { getRelativePosition, getZoneColor } from './helpers';
import type { DragSource, PlayerData } from './types';

/** In % der Felddimensionen – Token gilt als "Ziel" wenn Abstand kleiner. */
const SWAP_THRESHOLD = 13;

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
  const playersRef = useRef<PlayerData[]>(players);
  const benchPlayersRef = useRef<PlayerData[]>(benchPlayers);
  /** Ref-Spiegel von draggedFrom – wird synchron aktualisiert, damit rapidfire
   *  mousemove-Handler stets den aktuellen Wert lesen (stale-closure-Safe). */
  const draggedFromRef = useRef<DragSource | null>(null);
  /** Ref-Spiegel von draggedPlayerId – stale-closure-Safe für Move-Handler. */
  const draggedPlayerIdRef = useRef<number | null>(null);
  /** Ursprungsposition des gezogenen Tokens (für Swap-Logik). */
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  /** Letzte berechnete Drag-Position in % – wird im rAF-Callback gelesen. */
  const dragPosRef = useRef<{ x: number; y: number } | null>(null);
  /** Abstand zwischen Pointer und Token-Mittelpunkt in % der Pitchgröße. */
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  /** Live erkanntes Tauschziel für visuelles Feedback und konsistenten Drop. */
  const swapTargetIdRef = useRef<number | null>(null);
  /** Dynamischer Swap-Radius, abgeleitet aus der tatsächlichen Token-Größe. */
  const swapThresholdRef = useRef<number>(8);
  /** Pending requestAnimationFrame-ID – verhindert mehrfach-Scheduling. */
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    benchPlayersRef.current = benchPlayers;
  }, [benchPlayers]);

  const clampPercent = (value: number) => Math.max(2, Math.min(98, value));

  const getClientPoint = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if ('touches' in e) {
      const touch = e.touches[0] ?? e.changedTouches[0];
      return touch ? { clientX: touch.clientX, clientY: touch.clientY } : null;
    }
    return { clientX: e.clientX, clientY: e.clientY };
  };

  const updateDraggedFrom = (val: DragSource | null) => {
    draggedFromRef.current = val;
    setDraggedFrom(val);
  };

  const updateSwapTarget = (id: number | null) => {
    if (swapTargetIdRef.current === id) return;

    const previousId = swapTargetIdRef.current;
    if (previousId != null) {
      const previousEl = tokenRefs.current.get(previousId);
      previousEl?.removeAttribute('data-swap-target');
    }

    swapTargetIdRef.current = id;

    if (id != null) {
      const targetEl = tokenRefs.current.get(id);
      targetEl?.setAttribute('data-swap-target', 'true');
    }
  };

  const calibrateSwapThreshold = useCallback((id: number) => {
    const pitchEl = pitchRef.current;
    const tokenEl = tokenRefs.current.get(id);
    if (!pitchEl || !tokenEl) {
      swapThresholdRef.current = 8;
      return;
    }

    const pitchRect = pitchEl.getBoundingClientRect();
    const tokenRect = tokenEl.getBoundingClientRect();
    const widthPercent = (tokenRect.width / pitchRect.width) * 100;
    const heightPercent = (tokenRect.height / pitchRect.height) * 100;
    swapThresholdRef.current = Math.max(6, Math.max(widthPercent, heightPercent) * 0.95);
  }, [pitchRef, tokenRefs]);

  const findNearestSwapTarget = useCallback((list: PlayerData[], draggedId: number, x: number, y: number) => {
    let nearest: PlayerData | null = null;
    let minDist = swapThresholdRef.current;
    for (const player of list) {
      if (player.id === draggedId) continue;
      const distance = Math.hypot(player.x - x, player.y - y);
      if (distance < minDist) {
        minDist = distance;
        nearest = player;
      }
    }
    return nearest;
  }, []);

  const isStillWithinSwapHysteresis = useCallback((targetId: number, draggedId: number, x: number, y: number) => {
    const target = playersRef.current.find(player => player.id === targetId && player.id !== draggedId);
    if (!target) return false;
    const distance = Math.hypot(target.x - x, target.y - y);
    return distance <= swapThresholdRef.current * 1.35;
  }, []);

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

  const readPreviewPosition = useCallback((id: number, fallback: { x: number; y: number }) => {
    const tokenEl = tokenRefs.current.get(id);
    const rawLeft = tokenEl?.style.left?.trim();
    const rawTop = tokenEl?.style.top?.trim();
    const parsedLeft = rawLeft ? parseFloat(rawLeft) : Number.NaN;
    const parsedTop = rawTop ? parseFloat(rawTop) : Number.NaN;

    return {
      x: Number.isFinite(parsedLeft) ? parsedLeft : fallback.x,
      y: Number.isFinite(parsedTop) ? parsedTop : fallback.y,
    };
  }, [tokenRefs]);

  const startDragFromField = useCallback((id: number, e: React.MouseEvent | React.TouchEvent) => {
    const origin = playersRef.current.find(p => p.id === id);
    const initialPos = origin ? { x: origin.x, y: origin.y } : null;
    const pointer = pitchRef.current ? getClientPoint(e) : null;
    const pointerPos = pointer && pitchRef.current
      ? getRelativePosition(pointer.clientX, pointer.clientY, pitchRef.current)
      : null;

    draggedPlayerIdRef.current = id;
    dragOriginRef.current = initialPos;
    dragPosRef.current = initialPos;
    dragOffsetRef.current = initialPos && pointerPos
      ? { x: pointerPos.x - initialPos.x, y: pointerPos.y - initialPos.y }
      : { x: 0, y: 0 };
    if (initialPos) {
      updateDraggedTokenPreview(id, initialPos.x, initialPos.y);
    }
    calibrateSwapThreshold(id);
    updateSwapTarget(null);
    setDraggedPlayerId(id);
    updateDraggedFrom('field');
    e.preventDefault();
    e.stopPropagation();
  }, [calibrateSwapThreshold, pitchRef, updateDraggedTokenPreview]);

  const startDragFromBench = useCallback((id: number, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); // Verhindert Textmarkierung beim Ziehen
    draggedPlayerIdRef.current = id;
    dragOriginRef.current = null;
    dragPosRef.current = null;
    dragOffsetRef.current = { x: 0, y: 0 };
    updateSwapTarget(null);
    setDraggedPlayerId(id);
    updateDraggedFrom('bench');
    e.stopPropagation();
  }, []);

  const applyDragMove = useCallback((clientX: number, clientY: number) => {
    const id = draggedPlayerIdRef.current;
    if (id === null || !pitchRef.current) return;

    const pointerPos = getRelativePosition(clientX, clientY, pitchRef.current);
    const currentFrom = draggedFromRef.current;

    if (currentFrom === 'bench') {
      // Bank→Feld: erst den Spieler von der Bank nehmen (einmalig via React),
      // dann normal als Feld-Token behandeln
      const benched = benchPlayersRef.current.find(p => p.id === id);
      if (benched) {
        draggedFromRef.current = 'field';
        setDraggedFrom('field');
        dragOriginRef.current = null;
        dragPosRef.current = pointerPos;
        setBenchPlayers(prev => prev.filter(p => p.id !== id));
        setPlayers(prev => [...prev, { ...benched, ...pointerPos }]);
        // DOM-Element ist jetzt neu gemountet – nächster Move-Event setzt es direkt
      }
      return;
    }

    if (currentFrom !== 'field') return;

    const pos = {
      x: clampPercent(pointerPos.x - dragOffsetRef.current.x),
      y: clampPercent(pointerPos.y - dragOffsetRef.current.y),
    };

    const nearest = findNearestSwapTarget(playersRef.current, id, pos.x, pos.y);
    if (nearest) {
      updateSwapTarget(nearest.id);
    } else if (
      swapTargetIdRef.current != null
      && !isStillWithinSwapHysteresis(swapTargetIdRef.current, id, pos.x, pos.y)
    ) {
      updateSwapTarget(null);
    }

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
  }, [findNearestSwapTarget, isStillWithinSwapHysteresis, setBenchPlayers, setPlayers, pitchRef, updateDraggedTokenPreview]);

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
    const currentSwapTargetId = swapTargetIdRef.current;

    if (id !== null && currentFrom === 'field') {
      const origin = dragOriginRef.current;
      if (origin) {
        // Field-to-field: Positionen tauschen
        setPlayers(prev => {
          const actualPos = readPreviewPosition(id, finalPos ?? origin);

          // State auf finale DOM-Position bringen
          const withFinal = prev.map(p => p.id === id ? { ...p, ...actualPos } : p);
          const dragged = withFinal.find(p => p.id === id);
          if (!dragged) return prev;

          const nearest = currentSwapTargetId != null
            ? withFinal.find(p => p.id === currentSwapTargetId) ?? null
            : findNearestSwapTarget(withFinal, id, dragged.x, dragged.y);

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
          const draggedPlayer = prev.find(p => p.id === id);
          const actualPos = readPreviewPosition(id, finalPos ?? {
            x: draggedPlayer?.x ?? 50,
            y: draggedPlayer?.y ?? 50,
          });

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
    dragOffsetRef.current = { x: 0, y: 0 };
    updateSwapTarget(null);

    setDraggedPlayerId(null);
    setDraggedFrom(null);
  }, [findNearestSwapTarget, readPreviewPosition, setPlayers, setBenchPlayers]);

  const handlePitchMouseMove = useCallback((e: React.MouseEvent) => applyDragMove(e.clientX, e.clientY), [applyDragMove]);

  const handlePitchTouchMove = useCallback((e: React.TouchEvent) => {
    applyDragMove(e.touches[0].clientX, e.touches[0].clientY);
  }, [applyDragMove]);

  useEffect(() => {
    if (draggedPlayerId === null) return undefined;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      applyDragMove(e.clientX, e.clientY);
    };
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      e.preventDefault();
      applyDragMove(touch.clientX, touch.clientY);
    };
    const handleMouseUp = () => {
      finalizeDrop();
    };
    const handleTouchEnd = () => {
      finalizeDrop();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [applyDragMove, draggedPlayerId, finalizeDrop]);

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
