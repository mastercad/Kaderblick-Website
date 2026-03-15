// ─── TacticsBoard – pitch canvas with SVG drawing layer ───────────────────────
import React from 'react';
import { Box, Typography } from '@mui/material';
import { getZoneColor, truncateName } from '../formation/helpers';
import { PALETTE } from './constants';
import { arrowPath, clipLine } from './utils';
import type {
  DrawElement, OpponentToken, DrawPreview,
  ElDragState, OppDragState, OwnPlayerDragState, Tool,
} from './types';
import type { PlayerData } from '../formation/types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PitchCanvasProps {
  pitchRef: React.RefObject<HTMLDivElement | null>;
  svgRef: React.RefObject<SVGSVGElement | null>;

  // Layout
  fullPitch: boolean;
  pitchAspect: string;
  pitchAX: number;
  svgCursor: string;

  // Data
  elements: DrawElement[];
  opponents: OpponentToken[];
  ownPlayers: Array<PlayerData & { sx: number; sy: number }>;
  preview: DrawPreview | null;
  drawing: boolean;
  tool: Tool;
  color: string;
  elDrag: ElDragState | null;
  oppDrag: OppDragState | null;
  ownPlayerDrag: OwnPlayerDragState | null;

  // Handlers
  onSvgDown: (e: React.MouseEvent | React.TouchEvent) => void;
  onSvgMove: (e: React.MouseEvent | React.TouchEvent) => void;
  onSvgUp: () => void;
  onElDown: (e: React.MouseEvent | React.TouchEvent, id: string, mode?: 'move' | 'start' | 'end' | 'resize') => void;
  onOppDown: (e: React.MouseEvent | React.TouchEvent, id: string) => void;
  onOwnPlayerDown: (e: React.MouseEvent | React.TouchEvent, id: number, sx: number, sy: number) => void;

  // Marker id helper (scoped to the current useId)
  markerId: (hex: string, kind: 'solid' | 'dashed') => string;
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

// ─── Component ────────────────────────────────────────────────────────────────

export const PitchCanvas: React.FC<PitchCanvasProps> = ({
  pitchRef, svgRef,
  fullPitch, pitchAspect, pitchAX, svgCursor,
  elements, opponents, ownPlayers,
  preview, drawing, tool, color,
  elDrag, oppDrag, ownPlayerDrag,
  onSvgDown, onSvgMove, onSvgUp,
  onElDown, onOppDown, onOwnPlayerDown,
  markerId,
}) => {
  const zoneLabels = fullPitch ? FULL_ZONE_LABELS : HALF_ZONE_LABELS;

  // Visual / hit-target handle sizes – compensated for landscape aspect ratio
  const hRy   = 1.9;
  const hRx   = hRy   * pitchAX;
  const hitRy = 4.0;
  const hitRx = hitRy * pitchAX;

  return (
    <Box
      ref={pitchRef}
      onMouseMove={onSvgMove}
      onMouseUp={onSvgUp}
      onMouseLeave={() => { /* up-handler cancels drag; move-handler stops preview */ onSvgUp(); }}
      onTouchMove={onSvgMove}
      onTouchEnd={onSvgUp}
      sx={{
        position: 'relative',
        aspectRatio: pitchAspect,
        maxWidth:  '100%',
        maxHeight: '100%',
        height: '100%',
        width: 'auto',
        borderRadius: 2,
        overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(0,0,0,0.85)',
        flexShrink: 0,
      }}
    >
      {/* ── Pitch background ─────────────────────────────────────────────── */}
      {fullPitch ? (
        <Box sx={{
          position: 'absolute', inset: 0,
          backgroundImage: 'url(/images/formation/fussballfeld_komplett.jpg)',
          backgroundSize: 'cover', backgroundPosition: 'center',
          bgcolor: '#1a5229',
        }} />
      ) : (
        // Half-pitch landscape (1357×960): display image at its natural ratio
        <Box sx={{
          position: 'absolute', inset: 0,
          backgroundImage: 'url(/images/formation/fussballfeld_haelfte.jpg)',
          backgroundSize: 'cover', backgroundPosition: 'center',
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
        const isPointer  = tool === 'pointer';
        const isDragging = ownPlayerDrag?.id === player.id;
        return (
          <Box
            key={player.id}
            onMouseDown={isPointer ? e => onOwnPlayerDown(e, player.id, player.sx, player.sy) : undefined}
            onTouchStart={isPointer ? e => onOwnPlayerDown(e, player.id, player.sx, player.sy) : undefined}
            sx={{
              position: 'absolute',
              left: `${player.sx}%`, top: `${player.sy}%`,
              transform: 'translate(-50%, -50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              zIndex: isPointer ? 12 : 3,
              pointerEvents: isPointer ? 'auto' : 'none',
              userSelect: 'none',
              cursor: isDragging ? 'grabbing' : isPointer ? 'grab' : 'default',
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
                : '0 2px 10px rgba(0,0,0,0.7)',
              transition: 'box-shadow 0.12s',
            }}>
              {player.number}
            </Box>
            <Box sx={{
              mt: '2px', bgcolor: 'rgba(0,0,0,0.78)', color: 'white',
              borderRadius: '4px', px: '4px', lineHeight: '1.45',
              fontSize: { xs: '0.5rem', md: '0.58rem' }, fontWeight: 700,
              maxWidth: 54, textAlign: 'center',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
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
      {fullPitch && opponents.map(opp => {
        const dragging = oppDrag?.id === opp.id;
        return (
          <Box
            key={opp.id}
            onMouseDown={e => onOppDown(e, opp.id)}
            onTouchStart={e => onOppDown(e, opp.id)}
            sx={{
              position: 'absolute',
              left: `${opp.x}%`, top: `${opp.y}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 11, userSelect: 'none',
              cursor: dragging ? 'grabbing' : 'grab',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              '&:hover .opp-hint': { opacity: 1 },
            }}
          >
            <Box sx={{
              width: { xs: 28, md: 34 }, height: { xs: 28, md: 34 },
              bgcolor: dragging ? '#d32f2f' : '#c62828',
              color: 'white', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: { xs: 11, md: 13 },
              border: '2.5px solid rgba(255,255,255,0.9)',
              boxShadow: dragging
                ? '0 0 14px rgba(244,67,54,0.9), 0 2px 8px rgba(0,0,0,0.7)'
                : '0 2px 10px rgba(0,0,0,0.7)',
              transition: 'box-shadow 0.12s',
            }}>
              {opp.number}
            </Box>
            <Box className="opp-hint" sx={{
              mt: '2px', bgcolor: 'rgba(0,0,0,0.78)', color: 'rgba(255,255,255,0.65)',
              borderRadius: '4px', px: '4px', lineHeight: '1.45',
              fontSize: { xs: '0.42rem', md: '0.5rem' }, fontWeight: 600,
              whiteSpace: 'nowrap', opacity: 0, transition: 'opacity 0.15s',
              pointerEvents: 'none',
            }}>
              tippen = löschen
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
          zIndex: 10, cursor: svgCursor,
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
        {elements.map(el => {
          const dragging  = elDrag?.id === el.id;
          const bodyMode  = elDrag?.id === el.id ? elDrag.mode : null;

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
                className={`el-group${dragging ? ' el-active' : ''}`}
                style={{ pointerEvents: 'all' }}>
                {/* Visual path (clipped to field bounds) */}
                <path
                  d={arrowPath(vx1, vy1, vx2, vy2)}
                  stroke={el.color}
                  strokeWidth={dragging && bodyMode === 'move' ? '1.4' : '0.9'}
                  strokeDasharray={el.kind === 'run' ? '2.5 1.8' : undefined}
                  strokeLinecap="round" fill="none"
                  markerEnd={`url(#${markerId(el.color, el.kind === 'run' ? 'dashed' : 'solid')})`}
                  style={{
                    filter: dragging
                      ? `drop-shadow(0 0 6px ${el.color}cc)`
                      : `drop-shadow(0 0 3px ${el.color}88)`,
                    pointerEvents: 'none',
                  }}
                />
                {/* Wide invisible hit area for body-move (full path, not clipped) */}
                <path
                  d={arrowPath(el.x1, el.y1, el.x2, el.y2)}
                  stroke="transparent" strokeWidth="6"
                  strokeLinecap="round" fill="none"
                  cursor={dragging && bodyMode === 'move' ? 'grabbing' : 'grab'}
                  onMouseDown={e => onElDown(e, el.id, 'move')}
                  onTouchStart={e => onElDown(e, el.id, 'move')}
                />
                {/* START handle */}
                <g className="el-handles"
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
                <g className="el-handles"
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
              </g>
            );
          }

          if (el.kind === 'zone') {
            const rx      = el.r * pitchAX;
            const ry      = el.r;
            const resizeX = el.cx + rx;
            const resizeY = el.cy;
            return (
              <g key={el.id}
                className={`el-group${dragging ? ' el-active' : ''}`}
                style={{ pointerEvents: 'all' }}>
                <ellipse
                  cx={el.cx} cy={el.cy} rx={rx} ry={ry}
                  stroke={el.color}
                  strokeWidth={dragging ? '0.9' : '0.6'}
                  strokeDasharray="2.5 1.5"
                  fill={dragging ? `${el.color}40` : `${el.color}26`}
                  cursor={dragging && bodyMode === 'move' ? 'grabbing' : 'grab'}
                  style={{
                    filter: dragging
                      ? `drop-shadow(0 0 8px ${el.color}99)`
                      : `drop-shadow(0 0 4px ${el.color}77)`,
                  }}
                  onMouseDown={e => onElDown(e, el.id, 'move')}
                  onTouchStart={e => onElDown(e, el.id, 'move')}
                />
                {/* RESIZE handle */}
                <g className="el-handles"
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
              </g>
            );
          }

          return null;
        })}

        {/* ── Live draw preview ───────────────────────────────────────────── */}
        {drawing && preview && (tool === 'arrow' || tool === 'run') && (
          <path
            d={arrowPath(preview.x1, preview.y1, preview.x2, preview.y2)}
            stroke={color} strokeWidth="0.9"
            strokeDasharray={tool === 'run' ? '2.5 1.8' : undefined}
            strokeLinecap="round" strokeOpacity="0.7" fill="none"
            markerEnd={`url(#${markerId(color, tool === 'run' ? 'dashed' : 'solid')})`}
            pointerEvents="none"
          />
        )}
        {drawing && preview && tool === 'zone' && (() => {
          const r = Math.hypot(preview.x2 - preview.x1, preview.y2 - preview.y1);
          return (
            <ellipse
              cx={preview.x1} cy={preview.y1}
              rx={r * pitchAX} ry={r}
              stroke={color} strokeWidth="0.6" strokeDasharray="2.5 1.5"
              strokeOpacity="0.7" fill={`${color}1a`} pointerEvents="none"
            />
          );
        })()}
      </svg>
    </Box>
  );
};
