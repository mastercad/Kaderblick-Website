/**
 * Computes the effective container width and left position for a rotated text element,
 * ensuring its axis-aligned bounding box (AABB) stays within the poster bounds.
 *
 * Background
 * ----------
 * CSS `transform: rotate(θ)` rotates an element around its own center. The resulting
 * AABB is larger than the un-rotated element:
 *
 *   AABB width  = W·|cosθ| + H·|sinθ|
 *   AABB height = W·|sinθ| + H·|cosθ|
 *
 * The element center stays fixed, but the AABB extends equally in both directions.
 * textAlign determines which anchor point is kept fixed when the container width
 * is reduced:
 *   - 'left'   → left edge of container stays at elX %
 *   - 'right'  → right edge of container stays at (elX + elWidth) %
 *   - 'center' → center of container stays at (elX + elWidth/2) %
 */

export interface RotationLayoutParams {
  /** Element left edge in percent (0–100) */
  elX: number;
  /** Element top edge in percent (0–100) */
  elY: number;
  /** Element width in percent (0–100) */
  elWidth: number;
  /** Element height in percent (0–100) */
  elHeight: number;
  /** Rotation in degrees — sign is irrelevant, only magnitude matters */
  rotation: number;
  /** Text alignment anchor */
  textAlign: 'left' | 'center' | 'right';
  /** Poster width in pixels */
  posterW: number;
  /** Poster height in pixels */
  posterH: number;
}

export interface RotationLayoutResult {
  /** Constrained container width in pixels */
  effectiveContainerW: number;
  /** Adjusted left position in percent */
  effectiveLeftPct: number;
}

/**
 * Returns the rotation-corrected container width (px) and left offset (%) so that
 * the AABB of the rotated element stays within [0, posterW] × [0, posterH].
 * When rotation is 0, the original dimensions are returned unchanged.
 */
export function computeRotationLayout(params: RotationLayoutParams): RotationLayoutResult {
  const { elX, elY, elWidth, elHeight, rotation, textAlign, posterW: w, posterH: h } = params;

  const containerW = (elWidth / 100) * w;
  const containerH = (elHeight / 100) * h;

  if (!rotation) {
    return { effectiveContainerW: containerW, effectiveLeftPct: elX };
  }

  const θRad = Math.abs(rotation) * Math.PI / 180;
  const cosθ = Math.cos(θRad);
  const sinθ = Math.sin(θRad);
  const H = containerH;

  // Horizontal anchors (in px)
  const leftPx  = (elX / 100) * w;
  const rightPx = ((elX + elWidth) / 100) * w;
  const cxPx    = (leftPx + rightPx) / 2;

  // Vertical center is fixed (height never changes)
  const cyPx = (elY / 100) * h + H / 2;

  // ── Vertical constraints ───────────────────────────────────────────────────
  // AABB height = W·sinθ + H·cosθ ≤ 2·spaceY  →  W ≤ (2·spaceY − H·cosθ) / sinθ
  const maxW_ytop = sinθ > 0.001 ? (2 * cyPx       - H * cosθ) / sinθ : Infinity;
  const maxW_ybot = sinθ > 0.001 ? (2 * (h - cyPx) - H * cosθ) / sinθ : Infinity;

  // ── Horizontal constraints (anchor-dependent) ──────────────────────────────
  // Derivation for each anchor:
  //   left:   AABB right = leftPx  + W·(1+cosθ)/2 + H·sinθ/2 ≤ w
  //   right:  AABB left  = rightPx − W·(1+cosθ)/2 − H·sinθ/2 ≥ 0
  //   center: AABB half-width = (W·cosθ + H·sinθ)/2 ≤ spaceX
  let maxW_x: number;
  if (textAlign === 'left') {
    maxW_x = (1 + cosθ) > 0.001
      ? 2 * (w - leftPx - H * sinθ / 2) / (1 + cosθ)
      : Infinity;
  } else if (textAlign === 'right') {
    maxW_x = (1 + cosθ) > 0.001
      ? 2 * (rightPx - H * sinθ / 2) / (1 + cosθ)
      : Infinity;
  } else {
    const spaceX = Math.min(cxPx, w - cxPx);
    maxW_x = cosθ > 0.001 ? (2 * spaceX - H * sinθ) / cosθ : Infinity;
  }

  const maxW = Math.min(maxW_ytop, maxW_ybot, maxW_x);
  const effectiveContainerW = maxW > 0 && maxW < containerW ? maxW : containerW;

  // ── Left position + AABB overflow correction ───────────────────────────────
  // After width is constrained, compute left (%) and shift if a corner still
  // protrudes past the poster edge.
  const aabbHalfW = (effectiveContainerW * cosθ + H * sinθ) / 2;

  let effectiveLeftPct: number;

  if (textAlign === 'left') {
    // Left edge of container is the anchor.
    // The AABB may still protrude left (e.g. counter-clockwise rotation with leftPx≈0).
    const newCx = leftPx + effectiveContainerW / 2;
    const leftOverflow = Math.max(0, aabbHalfW - newCx);
    effectiveLeftPct = (leftPx + leftOverflow) / w * 100;
  } else if (textAlign === 'right') {
    // Right edge of container is the anchor.
    // The AABB may still protrude right (e.g. clockwise rotation with rightPx≈w).
    const newCx = rightPx - effectiveContainerW / 2;
    const rightOverflow = Math.max(0, newCx + aabbHalfW - w);
    effectiveLeftPct = (rightPx - effectiveContainerW - rightOverflow) / w * 100;
  } else {
    // Center stays fixed.
    effectiveLeftPct = (cxPx - effectiveContainerW / 2) / w * 100;
  }

  return { effectiveContainerW, effectiveLeftPct };
}
