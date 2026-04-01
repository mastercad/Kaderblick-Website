// ─── TacticsBoard – pure utility functions ─────────────────────────────────────
import React from 'react';

/**
 * Liang-Barsky line clipping to a [xMin,xMax] × [yMin,yMax] rectangle.
 * Returns clipped endpoints, or null if the segment lies entirely outside.
 */
export function clipLine(
  x1: number, y1: number, x2: number, y2: number,
  xMin = 0, yMin = 0, xMax = 100, yMax = 100,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0, t1 = 1;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else       { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  if (!clip(-dx, x1 - xMin)) return null;
  if (!clip(dx,  xMax - x1)) return null;
  if (!clip(-dy, y1 - yMin)) return null;
  if (!clip(dy,  yMax - y1)) return null;
  if (t0 > t1) return null;
  return {
    x1: x1 + t0 * dx, y1: y1 + t0 * dy,
    x2: x1 + t1 * dx, y2: y1 + t1 * dy,
  };
}

/**
 * Build a quadratic Bézier path for arrows / runs.
 * The control point depends only on the arrow's vertical field position:
 * arrows in the upper field half arch upward, arrows in the lower half arch
 * downward, and arrows near midfield stay almost straight.
 */
export function arrowPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return `M ${x1} ${y1} L ${x2} ${y2}`;

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const verticalBias = (midY - 50) / 50;
  const distanceFromMidfield = Math.abs(midY - 50) / 50;
  const curveStrength = Math.min(len * 0.22, 10) * Math.pow(distanceFromMidfield, 0.8);
  const cpx = midX;
  const cpy = midY + Math.sign(verticalBias) * curveStrength;

  return `M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`;
}

/**
 * Convert a mouse or touch event position to SVG-viewBox coordinates (0–100).
 * The SVG viewBox is `0 0 100 100` with `preserveAspectRatio="none"`.
 */
export function svgCoords(
  e: React.MouseEvent | React.TouchEvent,
  svgEl: SVGSVGElement,
): { x: number; y: number } {
  const rect = svgEl.getBoundingClientRect();
  const src = 'touches' in e
    ? (e as React.TouchEvent).touches[0]
    : (e as React.MouseEvent);
  return {
    x: Math.max(0, Math.min(100, ((src.clientX - rect.left) / rect.width)  * 100)),
    y: Math.max(0, Math.min(100, ((src.clientY - rect.top)  / rect.height) * 100)),
  };
}

/**
 * Map y from half-pitch space (0 = attack/center, 100 = own goal)
 * to full-pitch portrait space (0 = top = opponent goal, 100 = bottom = own goal).
 * Own team → bottom half (50–100 %).
 */
export function halfToFull(y: number): number {
  return 50 + y * 0.5;
}

/**
 * Build a unique SVG arrow-marker id that is scoped to the current component
 * instance via the `uid` prefix (returned by React.useId).
 */
export function makeMarkerId(uid: string, hex: string, kind: 'solid' | 'dashed'): string {
  return `${uid}-ah-${kind}-${hex.replace('#', '')}`;
}
