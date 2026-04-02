// ─── TacticsBoard – pitch canvas with SVG drawing layer ───────────────────────
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { getZoneColor, truncateName } from '../formation/helpers';
import { PALETTE } from './constants';
import { arrowPath, clipLine } from './utils';
import type {
  DrawElement, OpponentToken,
  ElDragState, OppDragState, OwnPlayerDragState, Tool,
} from './types';
import type { PlayerData } from '../formation/types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PitchCanvasProps {
  pitchRef: React.RefObject<HTMLDivElement | null>;
  svgRef: React.RefObject<SVGSVGElement | null>;

  // Layout
  fullPitch: boolean;
  fitPitchToHeight: boolean;
  pitchAspect: string;
  pitchAX: number;
  svgCursor: string;

  // Data
  elements: DrawElement[];
  opponents: OpponentToken[];
  ownPlayers: Array<PlayerData & { sx: number; sy: number }>;
  tool: Tool;
  color: string;
  elDrag: ElDragState | null;
  oppDrag: OppDragState | null;
  ownPlayerDrag: OwnPlayerDragState | null;

  // Handlers
  onSvgDown: (e: React.MouseEvent | React.TouchEvent) => void;
  onSvgMove: (e: React.MouseEvent | React.TouchEvent) => void;
  onSvgUp: () => void;
  onSvgLeave: () => void;
  onElDown: (e: React.MouseEvent | React.TouchEvent, id: string, mode?: 'move' | 'start' | 'end' | 'resize') => void;
  onOppDown: (e: React.MouseEvent | React.TouchEvent, id: string) => void;
  onOppDblClick: (id: string) => void;
  onOwnPlayerDown: (e: React.MouseEvent | React.TouchEvent, id: number, sx: number, sy: number) => void;

  // Marker id helper (scoped to the current useId)
  markerId: (hex: string, kind: 'solid' | 'dashed') => string;

  // Selection
  selectedId: string | null;

  // DOM ref registration (for imperative drag updates)
  registerElRef: (id: string, el: SVGGElement | null) => void;
  registerOppRef: (id: string, el: HTMLElement | null) => void;
  registerPlayerRef: (id: number, el: HTMLElement | null) => void;
  registerPreviewPathRef: (el: SVGPathElement | null) => void;
  registerPreviewEllipseRef: (el: SVGEllipseElement | null) => void;

  /** Show step-order number badges on arrows and zones */
  showStepNumbers: boolean;
  presentationMode: boolean;
}

// ─── Zone labels per pitch mode ───────────────────────────────────────────────
// Each label provides { label, left, top } – this way both landscape and
// portrait layouts use the same rendering logic.

const FULL_ZONE_LABELS = [
  { label: 'GEGNER',        left: '24%', top: '50%' },
  { label: 'MITTELLINIE',   left: '50%', top: '50%' },
  { label: 'EIGENE HÄLFTE', left: '76%', top: '50%' },
];
// Portrait half-pitch: attack at top, own goal at bottom
const HALF_ZONE_LABELS = [
  { label: 'ANGRIFF / MITTE', left: '50%', top: '7%'  },
  { label: 'EIGENES TOR',     left: '50%', top: '92%' },
];

function getArrowControlPoint(x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  if (len < 0.5) return { x: midX, y: midY };

  const verticalBias = (midY - 50) / 50;
  const distanceFromMidfield = Math.abs(midY - 50) / 50;
  const curveStrength = Math.min(len * 0.22, 10) * Math.pow(distanceFromMidfield, 0.8);
  return {
    x: midX,
    y: midY + Math.sign(verticalBias) * curveStrength,
  };
}

function getQuadraticPoint(t: number, p0: number, p1: number, p2: number) {
  const mt = 1 - t;
  return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
}

function pointSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

function distanceToArrowCurve(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const control = getArrowControlPoint(x1, y1, x2, y2);
  let minDistance = Number.POSITIVE_INFINITY;
  let prevX = x1;
  let prevY = y1;

  for (let index = 1; index <= 24; index += 1) {
    const t = index / 24;
    const nextX = getQuadraticPoint(t, x1, control.x, x2);
    const nextY = getQuadraticPoint(t, y1, control.y, y2);
    minDistance = Math.min(minDistance, pointSegmentDistance(px, py, prevX, prevY, nextX, nextY));
    prevX = nextX;
    prevY = nextY;
  }

  return minDistance;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PitchCanvas: React.FC<PitchCanvasProps> = ({
  pitchRef, svgRef,
  fullPitch, fitPitchToHeight, pitchAspect, pitchAX, svgCursor,
  elements, opponents, ownPlayers,
  tool, color,
  elDrag, oppDrag, ownPlayerDrag,
  onSvgDown, onSvgMove, onSvgUp, onSvgLeave,
  onElDown, onOppDown, onOppDblClick, onOwnPlayerDown,
  markerId,
  selectedId,
  registerElRef, registerOppRef, registerPlayerRef,
  registerPreviewPathRef, registerPreviewEllipseRef,
  showStepNumbers,
  presentationMode,
}) => {
  const zoneLabels = fullPitch ? FULL_ZONE_LABELS : HALF_ZONE_LABELS;
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [hoveredOpponentId, setHoveredOpponentId] = useState<string | null>(null);
  const [hoveredPlayerId, setHoveredPlayerId] = useState<number | null>(null);
  const [priorityArrowId, setPriorityArrowId] = useState<string | null>(null);
  const presenterOverlayRef = useRef<HTMLDivElement | null>(null);
  const presenterPointerRef = useRef<HTMLDivElement | null>(null);
  const presenterTrailHostRef = useRef<HTMLDivElement | null>(null);
  const presenterLastTrailRef = useRef<{ x: number; y: number; at: number } | null>(null);

  // Double-click / double-tap detection for opponent tokens.
  // onDoubleClick can NEVER fire because handleOppDown calls preventDefault() on
  // the underlying mousedown, which suppresses subsequent click/dblclick events.
  //
  // Strategy: record timestamp at mouseUP (= end of first click), then detect on
  // the NEXT mousedown. This measures the inter-click gap (end→start) which is
  // what OS double-click timers use (~300–700 ms). We use 650 ms to be generous.
  const lastOppRelease = useRef<Map<string, number>>(new Map());
  const DBLCLICK_MS = 650;

  const handleOppMouseUp = (id: string) => {
    lastOppRelease.current.set(id, Date.now());
  };

  const handleOppTouchEnd = (id: string) => {
    lastOppRelease.current.set(id, Date.now());
  };

  const handleOppMouseDown = (e: React.MouseEvent, id: string) => {
    const sinceRelease = Date.now() - (lastOppRelease.current.get(id) ?? 0);
    if (sinceRelease < DBLCLICK_MS) {
      // Second click started within threshold after first click ended → double-click
      e.stopPropagation();
      e.preventDefault();
      lastOppRelease.current.delete(id);
      onOppDblClick(id);
    } else {
      onOppDown(e, id);
    }
  };

  const handleOppTouchStart = (e: React.TouchEvent, id: string) => {
    const sinceRelease = Date.now() - (lastOppRelease.current.get(id) ?? 0);
    if (sinceRelease < DBLCLICK_MS) {
      // Double-tap
      e.stopPropagation();
      lastOppRelease.current.delete(id);
      onOppDblClick(id);
    } else {
      onOppDown(e, id);
    }
  };

  // Visual / hit-target handle sizes – compensated for landscape aspect ratio
  const hRy   = 1.9;
  const hRx   = hRy   * pitchAX;
  const hitRy = 4.0;
  const hitRx = hitRy * pitchAX;

  const setPresenterVisibility = useCallback((visible: boolean) => {
    if (presenterOverlayRef.current) {
      presenterOverlayRef.current.style.opacity = visible ? '1' : '0';
    }
  }, []);

  const spawnPresenterTrail = useCallback((x: number, y: number) => {
    if (!presentationMode || !presenterTrailHostRef.current) return;
    const now = Date.now();
    const last = presenterLastTrailRef.current;
    if (last && now - last.at < 36 && Math.hypot(last.x - x, last.y - y) < 18) return;
    presenterLastTrailRef.current = { x, y, at: now };

    const trail = document.createElement('div');
    trail.style.position = 'absolute';
    trail.style.left = `${x}px`;
    trail.style.top = `${y}px`;
    trail.style.width = '18px';
    trail.style.height = '18px';
    trail.style.borderRadius = '999px';
    trail.style.transform = 'translate(-50%, -50%)';
    trail.style.background = 'radial-gradient(circle, rgba(255,235,59,0.95) 0%, rgba(255,193,7,0.75) 32%, rgba(255,152,0,0.16) 72%, rgba(255,152,0,0) 100%)';
    trail.style.boxShadow = '0 0 18px rgba(255,193,7,0.45)';
    trail.style.pointerEvents = 'none';
    presenterTrailHostRef.current.appendChild(trail);

    const animation = trail.animate([
      { opacity: 0.95, transform: 'translate(-50%, -50%) scale(0.85)' },
      { opacity: 0.18, transform: 'translate(-50%, -50%) scale(1.7)' },
      { opacity: 0, transform: 'translate(-50%, -50%) scale(2.3)' },
    ], {
      duration: 780,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'forwards',
    });

    animation.onfinish = () => {
      trail.remove();
    };
  }, [presentationMode]);

  const updatePresenterPointer = useCallback((clientX: number, clientY: number) => {
    if (!presentationMode || !pitchRef.current || !presenterPointerRef.current) return;
    const rect = pitchRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      setPresenterVisibility(false);
      return;
    }
    presenterPointerRef.current.style.transform = `translate(${x}px, ${y}px)`;
    setPresenterVisibility(true);
    spawnPresenterTrail(x, y);
  }, [pitchRef, presentationMode, setPresenterVisibility, spawnPresenterTrail]);

  useEffect(() => {
    if (!presentationMode) {
      setPresenterVisibility(false);
      presenterTrailHostRef.current?.replaceChildren();
      presenterLastTrailRef.current = null;
    }
  }, [presentationMode, setPresenterVisibility]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      let bestArrowId: string | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;

      elements.forEach(el => {
        if (el.kind !== 'arrow' && el.kind !== 'run') return;
        const distance = distanceToArrowCurve(x, y, el.x1, el.y1, el.x2, el.y2);
        if (distance <= 3.2 && distance < bestDistance) {
          bestArrowId = el.id;
          bestDistance = distance;
        }
      });

      setPriorityArrowId(bestArrowId);
    }
    updatePresenterPointer(e.clientX, e.clientY);
    onSvgMove(e);
  }, [elements, onSvgMove, updatePresenterPointer, svgRef]);

  const handleCanvasTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100));
        const y = Math.max(0, Math.min(100, ((touch.clientY - rect.top) / rect.height) * 100));
        let bestArrowId: string | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;

        elements.forEach(el => {
          if (el.kind !== 'arrow' && el.kind !== 'run') return;
          const distance = distanceToArrowCurve(x, y, el.x1, el.y1, el.x2, el.y2);
          if (distance <= 4.2 && distance < bestDistance) {
            bestArrowId = el.id;
            bestDistance = distance;
          }
        });

        setPriorityArrowId(bestArrowId);
      }
      updatePresenterPointer(touch.clientX, touch.clientY);
    }
    onSvgMove(e);
  }, [elements, onSvgMove, updatePresenterPointer, svgRef]);

  const handleCanvasLeave = useCallback(() => {
    setPriorityArrowId(null);
    setPresenterVisibility(false);
    onSvgLeave();
  }, [onSvgLeave, setPresenterVisibility]);

  return (
    <Box
      ref={pitchRef}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={() => onSvgUp()}
      onMouseLeave={handleCanvasLeave}
      onTouchMove={handleCanvasTouchMove}
      onTouchEnd={onSvgUp}
      sx={{
        position: 'relative',
        aspectRatio: pitchAspect,
        width: fitPitchToHeight ? 'auto' : '100%',
        maxWidth: '100%',
        maxHeight: fitPitchToHeight ? '100%' : undefined,
        height: fitPitchToHeight ? '100%' : 'auto',
        alignSelf: fitPitchToHeight ? 'center' : 'flex-start',
        touchAction: 'none',
        borderRadius: 2,
        overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(0,0,0,0.85)',
        flexShrink: 0,
        cursor: presentationMode ? 'none' : undefined,
      }}
    >
      <Box
        ref={presenterOverlayRef}
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 30,
          pointerEvents: 'none',
          opacity: 0,
          transition: 'opacity 0.16s ease',
        }}
      >
        <Box ref={presenterTrailHostRef} sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        <Box
          ref={presenterPointerRef}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 0,
            height: 0,
            transform: 'translate(-9999px, -9999px)',
            '&::before': {
              content: '""',
              position: 'absolute',
              width: 18,
              height: 18,
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle, rgba(255,255,255,0.98) 0%, rgba(255,235,59,0.96) 26%, rgba(255,193,7,0.62) 46%, rgba(255,193,7,0.08) 78%, rgba(255,193,7,0) 100%)',
              boxShadow: '0 0 18px rgba(255,235,59,0.7), 0 0 42px rgba(255,152,0,0.42)',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              width: 34,
              height: 34,
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              border: '1.5px solid rgba(255,244,196,0.72)',
              boxShadow: '0 0 18px rgba(255,213,79,0.32)',
            },
          }}
        />
      </Box>
      {/* ── Pitch background ─────────────────────────────────────────────── */}
      {fullPitch ? (
        <Box sx={{
          position: 'absolute', inset: 0,
          backgroundImage: 'url(/images/formation/fussballfeld_komplett.jpg)',
          backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
          bgcolor: '#1a5229',
        }} />
      ) : (
        // Half-pitch landscape (1357×960): display image at its natural ratio
        <Box sx={{
          position: 'absolute', inset: 0,
          backgroundImage: 'url(/images/formation/fussballfeld_haelfte.jpg)',
          backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
          bgcolor: '#1a5229',
        }} />
      )}

      {/* Dark vignette for depth */}
      <Box sx={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.28) 100%)',
        pointerEvents: 'none', zIndex: 1,
      }} />

      {/* ── Zone labels ──────────────────────────────────────────────────── */}
      {zoneLabels.map(z => (
        <Typography key={z.label} variant="caption" sx={{
          position: 'absolute', left: z.left, top: z.top,
          transform: 'translate(-50%, -50%)',
          color: 'rgba(255,255,255,0.18)', fontWeight: 800,
          letterSpacing: 3, fontSize: '0.45rem',
          pointerEvents: 'none', zIndex: 2, whiteSpace: 'nowrap',
        }}>
          {z.label}
        </Typography>
      ))}

      {/* ── Own player tokens ─────────────────────────────────────────────── */}
      {/* Pointer mode: sit above SVG (z:12), draggable.                       */}
      {/* Drawing modes: stay below SVG (z:3), pass events through.            */}
      {ownPlayers.map(player => {
        const isDragging = ownPlayerDrag?.id === player.id;
        const isHovered = hoveredPlayerId === player.id;
        const showPresentationHover = presentationMode && isHovered;
        return (
          <Box
            key={player.id}
            ref={(node) => registerPlayerRef(player.id, node as HTMLElement | null)}
            onMouseDown={e => onOwnPlayerDown(e, player.id, player.sx, player.sy)}
            onTouchStart={e => onOwnPlayerDown(e, player.id, player.sx, player.sy)}
            onMouseEnter={() => setHoveredPlayerId(player.id)}
            onMouseLeave={() => setHoveredPlayerId(prev => prev === player.id ? null : prev)}
            sx={{
              position: 'absolute',
              left: `${player.sx}%`, top: `${player.sy}%`,
              transform: 'translate(-50%, -50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              zIndex: 12,
              pointerEvents: 'auto',
              userSelect: 'none',
              touchAction: 'none',
              cursor: presentationMode ? 'none' : (isDragging ? 'grabbing' : 'grab'),
            }}
          >
            <Box sx={{
              width: { xs: 30, md: 38 }, height: { xs: 30, md: 38 },
              bgcolor: getZoneColor(player.y),
              color: 'white', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: { xs: 11, md: 14 },
              border: '2.5px solid rgba(255,255,255,0.9)',
              boxShadow: isDragging
                ? '0 0 14px rgba(255,255,255,0.55), 0 2px 10px rgba(0,0,0,0.7)'
                : showPresentationHover
                  ? '0 0 0 4px rgba(255,245,200,0.12), 0 0 22px rgba(255,245,200,0.34), 0 6px 16px rgba(0,0,0,0.72)'
                  : isHovered
                  ? '0 0 18px rgba(255,255,255,0.42), 0 0 0 4px rgba(255,255,255,0.14), 0 4px 16px rgba(0,0,0,0.8)'
                  : '0 2px 10px rgba(0,0,0,0.7)',
              transform: showPresentationHover ? 'scale(1.045)' : isHovered ? 'scale(1.08)' : 'scale(1)',
              transition: 'box-shadow 0.14s, transform 0.14s',
            }}>
              {player.number}
            </Box>
            <Box sx={{
              mt: '2px', bgcolor: 'rgba(0,0,0,0.78)', color: 'white',
              borderRadius: '4px', px: '4px', lineHeight: '1.45',
              fontSize: { xs: '0.5rem', md: '0.58rem' }, fontWeight: 700,
              maxWidth: 54, textAlign: 'center',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              border: showPresentationHover
                ? '1px solid rgba(255,245,200,0.28)'
                : isHovered
                  ? '1px solid rgba(255,255,255,0.32)'
                  : '1px solid transparent',
              boxShadow: showPresentationHover
                ? '0 0 16px rgba(255,245,200,0.1)'
                : isHovered
                  ? '0 0 12px rgba(255,255,255,0.14)'
                  : 'none',
            }}>
              {truncateName(player.name, 8)}
            </Box>
          </Box>
        );
      })}

      {/* ── Ghost indicators for off-screen own players (half-pitch only) ── */}
      {/* Players in the opponent half have sy < 0 and are clipped by         */}
      {/* overflow:hidden. We pin a small semi-transparent token at top=0     */}
      {/* so the user knows "someone is up there".                            */}
      {!fullPitch && ownPlayers
        .filter(p => p.sy < 0)
        .map(player => (
          <Box
            key={`ghost-${player.id}`}
            sx={{
              position: 'absolute',
              left: `${player.sx}%`,
              top: 0,
              transform: 'translate(-50%, 0)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              zIndex: 13,
              pointerEvents: 'none',
              userSelect: 'none',
              opacity: 0.6,
            }}
          >
            {/* Small arrow pointing upward */}
            <Box sx={{
              width: 0, height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderBottom: `7px solid ${getZoneColor(player.y)}`,
              mb: '1px',
            }} />
            <Box sx={{
              width: { xs: 22, md: 28 }, height: { xs: 22, md: 28 },
              bgcolor: getZoneColor(player.y),
              color: 'white', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: { xs: 9, md: 11 },
              border: '2px dashed rgba(255,255,255,0.8)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
            }}>
              {player.number}
            </Box>
          </Box>
        ))
      }

      {/* ── Opponent tokens (HTML, z:11) ─────────────────────────────────── */}
      {/* Same layout as own players (circle + label) but hollow ring style   */}
      {/* so they are immediately distinguishable regardless of color.        */}
      {fullPitch && opponents.map(opp => {
        const dragging = oppDrag?.id === opp.id;
        const isHovered = hoveredOpponentId === opp.id;
        const showPresentationHover = presentationMode && isHovered;
        return (
          <Box
            key={opp.id}
            ref={(node) => registerOppRef(opp.id, node as HTMLElement | null)}
            onMouseDown={e => handleOppMouseDown(e, opp.id)}
            onMouseUp={() => handleOppMouseUp(opp.id)}
            onTouchStart={e => handleOppTouchStart(e, opp.id)}
            onTouchEnd={() => handleOppTouchEnd(opp.id)}
            onMouseEnter={() => setHoveredOpponentId(opp.id)}
            onMouseLeave={() => setHoveredOpponentId(prev => prev === opp.id ? null : prev)}
            sx={{
              position: 'absolute',
              left: `${opp.x}%`, top: `${opp.y}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 11, userSelect: 'none',
              cursor: presentationMode ? 'none' : (dragging ? 'grabbing' : 'grab'),
              display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}
          >
            {/* Hollow ring – clearly distinct from the filled own-player circles */}
            <Box sx={{
              width: { xs: 30, md: 38 }, height: { xs: 30, md: 38 },
              bgcolor: 'transparent',
              color: dragging ? '#ef4444' : '#f87171',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: { xs: 11, md: 14 },
              border: `3px solid ${dragging ? '#ef4444' : '#f87171'}`,
              boxShadow: dragging
                ? '0 0 14px rgba(239,68,68,0.65), 0 2px 8px rgba(0,0,0,0.7)'
                : showPresentationHover
                  ? '0 0 0 4px rgba(248,113,113,0.1), 0 0 22px rgba(248,113,113,0.28), 0 6px 16px rgba(0,0,0,0.72)'
                  : isHovered
                  ? '0 0 20px rgba(248,113,113,0.42), 0 0 0 4px rgba(248,113,113,0.12), 0 4px 14px rgba(0,0,0,0.7)'
                  : '0 2px 8px rgba(0,0,0,0.5)',
              transform: showPresentationHover ? 'scale(1.045)' : isHovered ? 'scale(1.08)' : 'scale(1)',
              transition: 'box-shadow 0.14s, border-color 0.14s, color 0.14s, transform 0.14s',
            }}>
              {opp.number}
            </Box>
            <Box sx={{
              mt: '2px', bgcolor: 'rgba(0,0,0,0.78)', color: 'rgba(239,68,68,0.85)',
              borderRadius: '4px', px: '4px', lineHeight: '1.45',
              fontSize: { xs: '0.5rem', md: '0.58rem' }, fontWeight: 700,
              whiteSpace: 'nowrap', maxWidth: 60,
              overflow: 'hidden', textOverflow: 'ellipsis',
              border: showPresentationHover
                ? '1px solid rgba(248,113,113,0.26)'
                : isHovered
                  ? '1px solid rgba(248,113,113,0.34)'
                  : '1px solid transparent',
              boxShadow: showPresentationHover
                ? '0 0 14px rgba(248,113,113,0.08)'
                : isHovered
                  ? '0 0 10px rgba(248,113,113,0.12)'
                  : 'none',
            }}>
              {opp.name || 'Gegner'}
            </Box>
          </Box>
        );
      })}

      {/* ── SVG drawing layer (z:10) ─────────────────────────────────────── */}
      {/* overflow:visible is intentional: paths with negative coordinates    */}
      {/* (opponent-half elements viewed in half-pitch) must NOT be clipped   */}
      {/* by the SVG viewBox. The parent container (overflow:hidden) does the */}
      {/* visual clipping at the pitch boundary instead.                       */}
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          overflow: 'visible',
          zIndex: 10, cursor: presentationMode ? 'none' : svgCursor,
          touchAction: 'none', pointerEvents: 'all',
        }}
        onMouseDown={onSvgDown}
        onTouchStart={onSvgDown}
      >
        <defs>
          <style>{`
            .el-handles { opacity: 0; transition: opacity 0.18s ease; }
            .el-group:hover .el-handles { opacity: 1; }
            .el-group.el-active .el-handles { opacity: 1; }
            .el-move-dragging path, .el-move-dragging ellipse { filter: none !important; }
            ${presentationMode ? '' : `
            .el-group:hover [data-role="visual"] {
              stroke-width: 1.25;
              filter: brightness(1.16) drop-shadow(0 0 10px rgba(255,255,255,0.2));
            }
            .el-group:hover [data-role="body"] {
              stroke-width: 1.05;
              filter: brightness(1.14) drop-shadow(0 0 12px rgba(255,255,255,0.18));
            }
            `}
          `}</style>
          {/* Markers for palette colors + any extra colors used by loaded elements
              (e.g. preset colors that differ from the palette) */}
          {[
            ...PALETTE.map(c => c.value),
            ...Array.from(new Set(elements.map(el => el.color)))
              .filter(v => !PALETTE.some(c => c.value === v)),
          ].map(hex => (
            <React.Fragment key={hex}>
              <marker id={markerId(hex, 'solid')}
                markerWidth="6" markerHeight="6"
                refX="5.5" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M 0 0.5 L 5.5 3 L 0 5.5 Z" fill={hex} />
              </marker>
              <marker id={markerId(hex, 'dashed')}
                markerWidth="5" markerHeight="5"
                refX="4.5" refY="2.5" orient="auto" markerUnits="strokeWidth">
                <path d="M 0 0.5 L 4.5 2.5 L 0 4.5 Z" fill={hex} />
              </marker>
            </React.Fragment>
          ))}
        </defs>

        {/* ── Finalized elements ──────────────────────────────────────────── */}
        {elements.map((el, stepIdx) => {
          const dragging  = elDrag?.id === el.id;
          const bodyMode  = elDrag?.id === el.id ? elDrag.mode : null;
          const isSelected = !presentationMode && selectedId === el.id;
          const isHovered = (priorityArrowId ?? hoveredElementId) === el.id;
          if (el.kind === 'arrow' || el.kind === 'run') {
            // Clip the visual path to the field bounds [0,100]×[0,100] so that
            // arrows crossing into the opponent half (in half-pitch mode) still
            // show a proper arrowhead at the midfield boundary instead of an
            // invisible stub with no head.
            const vis = clipLine(el.x1, el.y1, el.x2, el.y2);
            if (!vis) return null; // entirely outside the field – skip
            // Liang-Barsky preserves direction (t0 ≤ t1): vis.x1/y1 is the
            // entry point into the field, vis.x2/y2 is the exit point. The
            // arrowhead (markerEnd) therefore always appears where the arrow
            // is heading – at the clipped boundary if the endpoint is off-field.
            const { x1: vx1, y1: vy1, x2: vx2, y2: vy2 } = vis;
            return (
              <g key={el.id}
                ref={(node) => registerElRef(el.id, node)}
                className={`el-group${dragging || isSelected ? ' el-active' : ''}${dragging && bodyMode === 'move' ? ' el-move-dragging' : ''}`}
                style={{ pointerEvents: 'all' }}
                onMouseEnter={() => {
                  setPriorityArrowId(el.id);
                  setHoveredElementId(el.id);
                }}
                onMouseLeave={() => setHoveredElementId(prev => prev === el.id ? null : prev)}>
                {/* Visual path (clipped to field bounds) */}
                <path
                  data-role="visual"
                  d={arrowPath(vx1, vy1, vx2, vy2)}
                  stroke={el.color}
                  strokeWidth={presentationMode
                    ? (isHovered ? '1.35' : '0.95')
                    : dragging && bodyMode === 'move'
                      ? '1.4'
                      : isSelected
                        ? '1.2'
                        : '0.9'}
                  strokeDasharray={el.kind === 'run' ? '2.5 1.8' : undefined}
                  strokeLinecap="round" fill="none"
                  markerEnd={`url(#${markerId(el.color, el.kind === 'run' ? 'dashed' : 'solid')})`}
                  style={{
                    filter: presentationMode
                      ? isHovered
                        ? `brightness(1.12) drop-shadow(0 0 14px ${el.color}cc)`
                        : `drop-shadow(0 0 3px ${el.color}66)`
                      : dragging
                      ? `drop-shadow(0 0 6px ${el.color}cc)`
                      : isHovered
                        ? `drop-shadow(0 0 12px ${el.color}ff)`
                        : isSelected
                        ? `drop-shadow(0 0 8px ${el.color}ff)`
                        : `drop-shadow(0 0 3px ${el.color}88)`,
                    pointerEvents: 'none',
                  }}
                />
                {/* Wide invisible hit area for body-move (full path, not clipped) */}
                <path
                  data-role="hit"
                  d={arrowPath(el.x1, el.y1, el.x2, el.y2)}
                  stroke="transparent" strokeWidth="6"
                  strokeLinecap="round" fill="none"
                  cursor={presentationMode ? 'none' : (dragging && bodyMode === 'move' ? 'grabbing' : 'grab')}
                  onMouseDown={e => onElDown(e, el.id, 'move')}
                  onTouchStart={e => onElDown(e, el.id, 'move')}
                />
                {!presentationMode && (
                  <>
                    {/* START handle */}
                    <g data-role="start-handle"
                      className="el-handles"
                      transform={`translate(${el.x1}, ${el.y1})`}
                      cursor={dragging && bodyMode === 'start' ? 'grabbing' : 'crosshair'}
                      onMouseDown={e => onElDown(e, el.id, 'start')}
                      onTouchStart={e => onElDown(e, el.id, 'start')}>
                      <ellipse rx={hitRx} ry={hitRy} fill="transparent" />
                      <ellipse rx={hRx} ry={hRy}
                        fill={dragging && bodyMode === 'start' ? el.color : 'rgba(30,30,30,0.85)'}
                        stroke={el.color} strokeWidth="0.5"
                        style={{ filter: `drop-shadow(0 0 3px ${el.color}bb)` }}
                      />
                    </g>
                    {/* END handle */}
                    <g data-role="end-handle"
                      className="el-handles"
                      transform={`translate(${el.x2}, ${el.y2})`}
                      cursor={dragging && bodyMode === 'end' ? 'grabbing' : 'crosshair'}
                      onMouseDown={e => onElDown(e, el.id, 'end')}
                      onTouchStart={e => onElDown(e, el.id, 'end')}>
                      <ellipse rx={hitRx} ry={hitRy} fill="transparent" />
                      <ellipse rx={hRx} ry={hRy}
                        fill={dragging && bodyMode === 'end' ? el.color : 'rgba(30,30,30,0.85)'}
                        stroke={el.color} strokeWidth="0.5"
                        style={{ filter: `drop-shadow(0 0 3px ${el.color}bb)` }}
                      />
                    </g>
                  </>
                )}
                {/* Step number badge */}
                {showStepNumbers && (
                  <g style={{ pointerEvents: 'none' }}>
                    <ellipse data-role="badge-ellipse"
                      cx={(el.x1 + el.x2) / 2} cy={(el.y1 + el.y2) / 2} rx={2.8 * pitchAX} ry={2.8}
                      fill="rgba(15,15,30,0.85)" stroke={el.color} strokeWidth="0.4" />
                    <text data-role="badge-text"
                      x={(el.x1 + el.x2) / 2} y={(el.y1 + el.y2) / 2}
                      textAnchor="middle" dominantBaseline="central"
                      fontSize="2.5" fontWeight="bold" fill={el.color} fontFamily="sans-serif">
                      {stepIdx + 1}
                    </text>
                  </g>
                )}
              </g>
            );
          }

          if (el.kind === 'zone') {
            const rx      = el.r * pitchAX;
            const ry      = el.r;
            const resizeX = el.cx + rx;
            const resizeY = el.cy;
            const zoneHitDisabled = priorityArrowId !== null;
            return (
              <g key={el.id}
                ref={(node) => registerElRef(el.id, node)}
                className={`el-group${dragging || isSelected ? ' el-active' : ''}${dragging && bodyMode === 'move' ? ' el-move-dragging' : ''}`}
                style={{ pointerEvents: 'all' }}
                onMouseEnter={() => setHoveredElementId(el.id)}
                onMouseLeave={() => setHoveredElementId(prev => prev === el.id ? null : prev)}>
                <ellipse
                  data-role="body"
                  cx={el.cx} cy={el.cy} rx={rx} ry={ry}
                  stroke={el.color}
                  strokeWidth={presentationMode
                    ? (isHovered ? '1.0' : '0.7')
                    : dragging || isSelected
                      ? '0.9'
                      : '0.6'}
                  strokeDasharray="2.5 1.5"
                  fill={presentationMode
                    ? isHovered
                      ? `${el.color}30`
                      : `${el.color}18`
                    : dragging || isSelected
                      ? `${el.color}40`
                      : `${el.color}26`}
                  cursor={presentationMode ? 'none' : (dragging && bodyMode === 'move' ? 'grabbing' : 'grab')}
                  style={{
                    filter: presentationMode
                      ? isHovered
                        ? `brightness(1.08) drop-shadow(0 0 16px ${el.color}99)`
                        : `drop-shadow(0 0 4px ${el.color}55)`
                      : dragging
                      ? `drop-shadow(0 0 8px ${el.color}99)`
                      : isHovered
                        ? `drop-shadow(0 0 14px ${el.color}cc)`
                        : isSelected
                        ? `drop-shadow(0 0 10px ${el.color}bb)`
                        : `drop-shadow(0 0 4px ${el.color}77)`,
                    pointerEvents: zoneHitDisabled ? 'none' : 'auto',
                  }}
                  onMouseDown={e => onElDown(e, el.id, 'move')}
                  onTouchStart={e => onElDown(e, el.id, 'move')}
                />
                {!presentationMode && (
                  <>
                    {/* RESIZE handle */}
                    <g data-role="resize-handle"
                      className="el-handles"
                      transform={`translate(${resizeX}, ${resizeY})`}
                      cursor={dragging && bodyMode === 'resize' ? 'grabbing' : 'ew-resize'}
                      onMouseDown={e => onElDown(e, el.id, 'resize')}
                      onTouchStart={e => onElDown(e, el.id, 'resize')}>
                      <ellipse rx={hitRx} ry={hitRy} fill="transparent" />
                      <ellipse rx={hRx} ry={hRy}
                        fill={dragging && bodyMode === 'resize' ? el.color : 'rgba(30,30,30,0.85)'}
                        stroke={el.color} strokeWidth="0.5"
                        style={{ filter: `drop-shadow(0 0 3px ${el.color}bb)` }}
                      />
                    </g>
                  </>
                )}
                {/* Step number badge */}
                {showStepNumbers && (
                  <g style={{ pointerEvents: 'none' }}>
                    <ellipse data-role="badge-ellipse"
                      cx={el.cx} cy={el.cy} rx={2.8 * pitchAX} ry={2.8}
                      fill="rgba(15,15,30,0.85)" stroke={el.color} strokeWidth="0.4" />
                    <text data-role="badge-text"
                      x={el.cx} y={el.cy}
                      textAnchor="middle" dominantBaseline="central"
                      fontSize="2.5" fontWeight="bold" fill={el.color} fontFamily="sans-serif">
                      {stepIdx + 1}
                    </text>
                  </g>
                )}
              </g>
            );
          }

          return null;
        })}

        {/* ── Live draw preview – always in DOM, shown/hidden imperatively ── */}
        {/* Attributes are set via imperative DOM in handleSvgDown/Move (same    */}
        {/* pattern as element dragging: zero React re-renders per frame).        */}
        <path
          ref={registerPreviewPathRef}
          strokeWidth="0.9" strokeLinecap="round" strokeOpacity="0.7" fill="none"
          style={{ visibility: 'hidden' }}
          pointerEvents="none"
        />
        <ellipse
          ref={registerPreviewEllipseRef}
          strokeWidth="0.6" strokeDasharray="2.5 1.5" strokeOpacity="0.7"
          style={{ visibility: 'hidden' }}
          pointerEvents="none"
        />
      </svg>
    </Box>
  );
};
