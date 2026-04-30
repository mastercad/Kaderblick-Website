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
import { appendBenchPlayerUnique } from './playerIdentity';
import { getBestFreeTemplateSlot, getBestFreeformGuideTarget, getDragGuideProfile } from './templateGuidance';
import type { DragSource, PlayerData } from './types';

interface UseFieldDragParams {
  autoSnapEnabled: boolean;
  currentTemplateCode: string | null;
  players: PlayerData[];
  setPlayers: React.Dispatch<React.SetStateAction<PlayerData[]>>;
  benchPlayers: PlayerData[];
  setBenchPlayers: React.Dispatch<React.SetStateAction<PlayerData[]>>;
  pitchRef: React.RefObject<HTMLDivElement | null>;
  /** Map von Spieler-ID → DOM-Element des Tokens (für direkte Stil-Mutation). */
  tokenRefs: React.RefObject<Map<number, HTMLDivElement>>;
}

export function useFieldDrag({
  autoSnapEnabled,
  currentTemplateCode,
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
  /** Ghost-Element für Bank-Drag: folgt dem Finger über das Feld (kein React-State). */
  const benchGhostRef = useRef<HTMLDivElement | null>(null);
  /** Spielerdaten des aktuell von der Bank gezogenen Spielers. */
  const benchDragPlayerRef = useRef<PlayerData | null>(null);

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
      swapThresholdRef.current = 6;
      return;
    }

    const pitchRect = pitchEl.getBoundingClientRect();
    const tokenRect = tokenEl.getBoundingClientRect();
    const widthPercent = (tokenRect.width / pitchRect.width) * 100;
    const heightPercent = (tokenRect.height / pitchRect.height) * 100;
    // Threshold = halbe Token-Größe in %, gedeckelt auf 8 damit auf Mobile
    // (kleines Pitch, große Tokens) der Swap nicht schon aus einem Icon-Abstand triggt.
    swapThresholdRef.current = Math.min(8, Math.max(5, Math.max(widthPercent, heightPercent) * 0.5));
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

  const resetDraggedTokenPreview = useCallback((id: number) => {
    const tokenEl = tokenRefs.current.get(id);
    if (!tokenEl) return;

    tokenEl.style.removeProperty('left');
    tokenEl.style.removeProperty('top');

    const circleEl = tokenEl.querySelector<HTMLElement>('[data-token-circle="true"]');
    circleEl?.style.removeProperty('background-color');
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
    e.stopPropagation();
  }, [calibrateSwapThreshold, pitchRef, updateDraggedTokenPreview]);

  const startDragFromBench = useCallback((id: number, e: React.MouseEvent | React.TouchEvent) => {
    const benched = benchPlayersRef.current.find(p => p.id === id);
    if (!benched) return;
    benchDragPlayerRef.current = benched;
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
      // Ghost dem Pointer nachführen; Feldposition speichern falls über dem Pitch.
      const rect = pitchRef.current.getBoundingClientRect();
      const rawX = ((clientX - rect.left) / rect.width) * 100;
      const rawY = ((clientY - rect.top) / rect.height) * 100;
      const overPitch = rawX >= 0 && rawX <= 100 && rawY >= 0 && rawY <= 100;

      if (benchGhostRef.current) {
        if (overPitch) {
          benchGhostRef.current.style.display = 'flex';
          benchGhostRef.current.style.left = clientX + 'px';
          benchGhostRef.current.style.top  = clientY + 'px';
          // Zonenfarbe live aktualisieren – identisches Verhalten wie Feld-Tokens
          const circleEl = benchGhostRef.current.querySelector<HTMLElement>('[data-token-circle="true"]');
          if (circleEl) {
            circleEl.style.backgroundColor = getZoneColor(clampPercent(rawY));
          }
        } else {
          benchGhostRef.current.style.display = 'none';
        }
      }

      dragPosRef.current = overPitch
        ? { x: clampPercent(rawX), y: clampPercent(rawY) }
        : null;
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
    // Pending rAF abbrechen
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const id = draggedPlayerIdRef.current;
    const currentFrom = draggedFromRef.current;
    const finalPos = dragPosRef.current;
    const currentSwapTargetId = swapTargetIdRef.current;

    // ── Bank → Feld ───────────────────────────────────────────────────────
    if (currentFrom === 'bench') {
      // Ghost ausblenden
      if (benchGhostRef.current) {
        benchGhostRef.current.style.display = 'none';
      }

      const benched = benchDragPlayerRef.current;
      benchDragPlayerRef.current = null;

      if (id !== null && finalPos !== null && benched) {
        setPlayers(prev => {
          const withNew = [...prev, { ...benched, x: finalPos.x, y: finalPos.y }];
          const dragged = withNew.find(p => p.id === id)!;

          // Kollision: liegt ein Feldspieler an der Ablagestelle?
          let nearest: PlayerData | null = null;
          let minDist = swapThresholdRef.current;
          for (const p of prev) {
            const d = Math.hypot(p.x - finalPos.x, p.y - finalPos.y);
            if (d < minDist) { minDist = d; nearest = p; }
          }

          if (nearest) {
            const targetPos = { x: nearest.x, y: nearest.y };
            setBenchPlayers(pb => appendBenchPlayerUnique(pb.filter(p => p.id !== id), { ...nearest! }));
            return withNew
              .filter(p => p.id !== nearest!.id)
              .map(p => p.id === id ? { ...p, ...targetPos } : p);
          }

          if (!autoSnapEnabled) {
            setBenchPlayers(pb => pb.filter(p => p.id !== id));
            return withNew;
          }

          const dragProfile = getDragGuideProfile(dragged);
          const snappedSlot = getBestFreeTemplateSlot({
            templateCode: currentTemplateCode,
            profile: dragProfile,
            players: withNew,
            movingPlayerId: id,
            anchorPosition: finalPos,
          });

          if (snappedSlot) {
            setBenchPlayers(pb => pb.filter(p => p.id !== id));
            return withNew.map(p => p.id === id
              ? { ...p, x: snappedSlot.slot.x, y: snappedSlot.slot.y }
              : p);
          }

          const fallbackTarget = getBestFreeformGuideTarget(dragProfile, finalPos);
          if (fallbackTarget) {
            setBenchPlayers(pb => pb.filter(p => p.id !== id));
            return withNew.map(p => p.id === id
              ? { ...p, x: fallbackTarget.x, y: fallbackTarget.y }
              : p);
          }

          setBenchPlayers(pb => pb.filter(p => p.id !== id));
          return withNew;
        });
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
      return;
    }

    // ── Feld → Feld ───────────────────────────────────────────────────────
    if (id !== null && currentFrom === 'field') {
      const origin = dragOriginRef.current;
        // Field-to-field: Positionen tauschen
        setPlayers(prev => {
          const actualPos = readPreviewPosition(id, finalPos ?? origin ?? { x: 0, y: 0 });

          // State auf finale DOM-Position bringen
          const withFinal = prev.map(p => p.id === id ? { ...p, ...actualPos } : p);
          const dragged = withFinal.find(p => p.id === id);
          if (!dragged) return prev;

          const nearest = currentSwapTargetId != null
            ? withFinal.find(p => p.id === currentSwapTargetId) ?? null
            : findNearestSwapTarget(withFinal, id, dragged.x, dragged.y);

          if (!nearest) {
            if (!autoSnapEnabled) return withFinal;

            const dragProfile = getDragGuideProfile(dragged);
            const snappedSlot = getBestFreeTemplateSlot({
              templateCode: currentTemplateCode,
              profile: dragProfile,
              players: withFinal,
              movingPlayerId: id,
              anchorPosition: actualPos,
            });

            if (!snappedSlot) {
              const fallbackTarget = getBestFreeformGuideTarget(dragProfile, actualPos);
              if (!fallbackTarget) return withFinal;

              return withFinal.map(player => (
                player.id === id
                  ? { ...player, x: fallbackTarget.x, y: fallbackTarget.y }
                  : player
              ));
            }

            return withFinal.map(player => (
              player.id === id
                ? { ...player, x: snappedSlot.slot.x, y: snappedSlot.slot.y }
                : player
            ));
          }

          // Swap: gezogener Token → Position des Ziel-Tokens, Ziel-Token → Ursprung
          const targetPos = { x: nearest.x, y: nearest.y };
          return withFinal.map(p => {
            if (p.id === id)         return { ...p, x: targetPos.x, y: targetPos.y };
            if (p.id === nearest!.id) return { ...p, x: origin!.x,   y: origin!.y   };
            return p;
          });
        });
    }

    // Refs zurücksetzen
    draggedPlayerIdRef.current = null;
    dragPosRef.current = null;
    dragOriginRef.current = null;
    draggedFromRef.current = null;
    dragOffsetRef.current = { x: 0, y: 0 };
    updateSwapTarget(null);

    if (id !== null) {
      resetDraggedTokenPreview(id);
    }

    setDraggedPlayerId(null);
    setDraggedFrom(null);
  }, [autoSnapEnabled, currentTemplateCode, findNearestSwapTarget, readPreviewPosition, resetDraggedTokenPreview, setPlayers, setBenchPlayers]);

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
    isDraggingFromBench: draggedFrom === 'bench',
    benchGhostRef,
    startDragFromField,
    startDragFromBench,
    handlePitchMouseMove,
    handlePitchMouseUp: finalizeDrop,
    handlePitchTouchMove,
    handlePitchTouchEnd: finalizeDrop,
  };
}
