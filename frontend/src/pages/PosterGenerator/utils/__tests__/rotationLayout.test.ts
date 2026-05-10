import { computeRotationLayout, RotationLayoutParams, RotationLayoutResult } from '../rotationLayout';

// ─── AABB helper ─────────────────────────────────────────────────────────────
// Reconstructs the axis-aligned bounding box of the RESULT element so we can
// assert poster-bounds invariants independently of exact pixel values.

interface AABB {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function resultAABB(result: RotationLayoutResult, params: RotationLayoutParams): AABB {
  const { effectiveContainerW, effectiveLeftPct } = result;
  const { elY, elHeight, rotation, posterW: w, posterH: h } = params;

  const H = (elHeight / 100) * h;
  const W = effectiveContainerW;
  const θRad = Math.abs(rotation) * Math.PI / 180;
  const cosθ = Math.cos(θRad);
  const sinθ = Math.sin(θRad);

  // Horizontal center derived from the returned left position
  const leftPxResult = (effectiveLeftPct / 100) * w;
  const cxPx = leftPxResult + W / 2;

  // Vertical center is always the original value (height never changes)
  const cyPx = (elY / 100) * h + H / 2;

  const aabbHalfW = (W * cosθ + H * sinθ) / 2;
  const aabbHalfH = (W * sinθ + H * cosθ) / 2;

  return {
    left:   cxPx - aabbHalfW,
    right:  cxPx + aabbHalfW,
    top:    cyPx - aabbHalfH,
    bottom: cyPx + aabbHalfH,
  };
}

// Tolerance for floating-point comparisons (sub-pixel)
const EPS = 0.01;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('computeRotationLayout', () => {

  // ── 1. No rotation ──────────────────────────────────────────────────────────

  describe('rotation = 0 (no-op)', () => {
    it.each<RotationLayoutParams>([
      { elX: 0,  elY: 0,  elWidth: 80, elHeight: 15, rotation: 0, textAlign: 'left',   posterW: 1080, posterH: 1080 },
      { elX: 10, elY: 20, elWidth: 50, elHeight: 10, rotation: 0, textAlign: 'center', posterW: 1080, posterH: 1920 },
      { elX: 20, elY: 30, elWidth: 60, elHeight: 20, rotation: 0, textAlign: 'right',  posterW: 1920, posterH: 1080 },
    ])('returns original containerW and elX for %o', (params) => {
      const result = computeRotationLayout(params);
      expect(result.effectiveContainerW).toBeCloseTo((params.elWidth / 100) * params.posterW, 5);
      expect(result.effectiveLeftPct).toBeCloseTo(params.elX, 5);
    });
  });

  // ── 2. No constraint needed ─────────────────────────────────────────────────
  // A small element centered in the poster with moderate rotation — AABB fits easily.

  describe('no constraint needed', () => {
    const params: RotationLayoutParams = {
      elX: 40, elY: 40, elWidth: 20, elHeight: 10,
      rotation: 15, textAlign: 'center',
      posterW: 1000, posterH: 1000,
    };

    it('returns unchanged effectiveContainerW', () => {
      const result = computeRotationLayout(params);
      expect(result.effectiveContainerW).toBeCloseTo(200, 0);
    });

    it('returns unchanged effectiveLeftPct', () => {
      const result = computeRotationLayout(params);
      expect(result.effectiveLeftPct).toBeCloseTo(40, 5);
    });

    it('AABB is within poster bounds', () => {
      const aabb = resultAABB(computeRotationLayout(params), params);
      expect(aabb.left).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.right).toBeLessThanOrEqual(1000 + EPS);
      expect(aabb.top).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.bottom).toBeLessThanOrEqual(1000 + EPS);
    });
  });

  // ── 3. Vertical top constraint (center) ─────────────────────────────────────
  // Element at elY=0, large rotation → top AABB would go negative.
  // Expected: AABB top ≈ 0, effectiveContainerW << original.

  describe('vertical top constraint (center alignment)', () => {
    const params: RotationLayoutParams = {
      elX: 10, elY: 0, elWidth: 80, elHeight: 10,
      rotation: 30, textAlign: 'center',
      posterW: 1000, posterH: 1000,
    };
    // maxW_ytop = (2*50 - 100*cos30°) / sin30° = (100 - 86.603) / 0.5 = 26.79 px

    it('constrains effectiveContainerW to ~26.8 px', () => {
      const { effectiveContainerW } = computeRotationLayout(params);
      expect(effectiveContainerW).toBeCloseTo(26.8, 0);
    });

    it('AABB top is ≈ 0 (exactly touches poster top)', () => {
      const aabb = resultAABB(computeRotationLayout(params), params);
      expect(aabb.top).toBeCloseTo(0, 1);
    });

    it('AABB is fully within poster', () => {
      const aabb = resultAABB(computeRotationLayout(params), params);
      expect(aabb.left).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.right).toBeLessThanOrEqual(1000 + EPS);
      expect(aabb.top).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.bottom).toBeLessThanOrEqual(1000 + EPS);
    });
  });

  // ── 4. Vertical bottom constraint (center) ──────────────────────────────────
  // Symmetric to top constraint.

  describe('vertical bottom constraint (center alignment)', () => {
    const params: RotationLayoutParams = {
      elX: 10, elY: 90, elWidth: 80, elHeight: 10,
      rotation: 30, textAlign: 'center',
      posterW: 1000, posterH: 1000,
    };

    it('constrains effectiveContainerW to ~26.8 px', () => {
      const { effectiveContainerW } = computeRotationLayout(params);
      expect(effectiveContainerW).toBeCloseTo(26.8, 0);
    });

    it('AABB bottom is ≈ posterH', () => {
      const aabb = resultAABB(computeRotationLayout(params), params);
      expect(aabb.bottom).toBeCloseTo(1000, 1);
    });

    it('AABB is fully within poster', () => {
      const aabb = resultAABB(computeRotationLayout(params), params);
      expect(aabb.left).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.right).toBeLessThanOrEqual(1000 + EPS);
      expect(aabb.top).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.bottom).toBeLessThanOrEqual(1000 + EPS);
    });
  });

  // ── 5. Real-world screenshot case (left alignment, top overflow) ─────────────
  // "VfB Mittelstadt B-Junioren (U17)": elX=0, elY=7.2, elW=80, elH=15,
  // rotation=-14.2°, format 1:1 (1080×1080).
  // The vertical-top constraint dominates; leftOverflow shifts the container
  // slightly right so the AABB left edge doesn't go negative either.

  describe('screenshot case: left-aligned, top overflow', () => {
    const params: RotationLayoutParams = {
      elX: 0, elY: 7.2, elWidth: 80, elHeight: 15,
      rotation: -14.2, textAlign: 'left',
      posterW: 1080, posterH: 1080,
    };

    it('reduces effectiveContainerW (< original 864 px)', () => {
      const { effectiveContainerW } = computeRotationLayout(params);
      expect(effectiveContainerW).toBeLessThan(864);
      expect(effectiveContainerW).toBeGreaterThan(500); // still meaningful
    });

    it('AABB top is ≈ 0', () => {
      // The vertical-top constraint was the binding one.
      const aabb = resultAABB(computeRotationLayout(params), params);
      expect(aabb.top).toBeCloseTo(0, 0);
    });

    it('AABB is fully within 1080×1080 poster', () => {
      const aabb = resultAABB(computeRotationLayout(params), params);
      expect(aabb.left).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.right).toBeLessThanOrEqual(1080 + EPS);
      expect(aabb.top).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.bottom).toBeLessThanOrEqual(1080 + EPS);
    });

    it('effectiveLeftPct is slightly > 0 (leftOverflow correction)', () => {
      // Without rotation the left would be 0%; with rotation the AABB would
      // protrude past x=0, so the container is shifted right by a few pixels.
      const { effectiveLeftPct } = computeRotationLayout(params);
      expect(effectiveLeftPct).toBeGreaterThan(0);
      expect(effectiveLeftPct).toBeLessThan(5); // only a tiny shift
    });
  });

  // ── 6. Same case but 9:16 format ────────────────────────────────────────────

  describe('screenshot case: left-aligned, top overflow, 9:16', () => {
    const params: RotationLayoutParams = {
      elX: 0, elY: 7.2, elWidth: 80, elHeight: 15,
      rotation: -14.2, textAlign: 'left',
      posterW: 1080, posterH: 1920,
    };

    it('AABB is fully within 1080×1920 poster', () => {
      const aabb = resultAABB(computeRotationLayout(params), params);
      expect(aabb.left).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.right).toBeLessThanOrEqual(1080 + EPS);
      expect(aabb.top).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.bottom).toBeLessThanOrEqual(1920 + EPS);
    });
  });

  // ── 7. Horizontal constraint: left alignment ─────────────────────────────────
  // Element with leftPx>0 where the right AABB would overflow.
  // maxW_x reduces width; leftOverflow is zero (no left-side conflict).

  describe('horizontal constraint: left alignment', () => {
    const params: RotationLayoutParams = {
      elX: 10, elY: 40, elWidth: 90, elHeight: 20,
      rotation: 25, textAlign: 'left',
      posterW: 1000, posterH: 1000,
    };
    // containerW=900, H=200, leftPx=100;
    // maxW_x = 2*(1000-100-200*sin25°/2)/(1+cos25°) ≈ 899.5 px < 900 → constraint

    it('reduces effectiveContainerW', () => {
      const { effectiveContainerW } = computeRotationLayout(params);
      expect(effectiveContainerW).toBeLessThan(900);
      expect(effectiveContainerW).toBeGreaterThan(880);
    });

    it('AABB is fully within poster', () => {
      const aabb = resultAABB(computeRotationLayout(params), params);
      expect(aabb.left).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.right).toBeLessThanOrEqual(1000 + EPS);
      expect(aabb.top).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.bottom).toBeLessThanOrEqual(1000 + EPS);
    });
  });

  // ── 8. Horizontal constraint: right alignment ────────────────────────────────
  // Element right edge at x=800px (not poster edge), small rotation.
  // maxW_x keeps AABB left ≥ 0.

  describe('horizontal constraint: right alignment', () => {
    const params: RotationLayoutParams = {
      elX: 0, elY: 40, elWidth: 80, elHeight: 10,
      rotation: 10, textAlign: 'right',
      posterW: 1000, posterH: 1000,
    };
    // rightPx=800; maxW_x ≈ 797.3 px < containerW=800

    it('reduces effectiveContainerW slightly', () => {
      const { effectiveContainerW } = computeRotationLayout(params);
      expect(effectiveContainerW).toBeLessThan(800);
      expect(effectiveContainerW).toBeGreaterThan(790);
    });

    it('AABB left ≈ 0 (touches left poster edge)', () => {
      const aabb = resultAABB(computeRotationLayout(params), params);
      expect(aabb.left).toBeCloseTo(0, 1);
    });

    it('AABB is fully within poster', () => {
      const aabb = resultAABB(computeRotationLayout(params), params);
      expect(aabb.left).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.right).toBeLessThanOrEqual(1000 + EPS);
      expect(aabb.top).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.bottom).toBeLessThanOrEqual(1000 + EPS);
    });
  });

  // ── 9. Center alignment: off-center element, horizontal constraint ───────────
  // Element with cx far from center; spaceX is small enough to constrain.

  describe('center alignment: limited horizontal space', () => {
    const params: RotationLayoutParams = {
      elX: 0, elY: 40, elWidth: 60, elHeight: 25,
      rotation: 45, textAlign: 'center',
      posterW: 1000, posterH: 1000,
    };
    // containerW=600, H=250, cxPx=300, spaceX=300;
    // maxW_x = (2*300 - 250*sin45°) / cos45° ≈ 598.6 px < 600 → constraint

    it('reduces effectiveContainerW', () => {
      const { effectiveContainerW } = computeRotationLayout(params);
      expect(effectiveContainerW).toBeLessThan(600);
    });

    it('AABB is fully within poster', () => {
      const aabb = resultAABB(computeRotationLayout(params), params);
      expect(aabb.left).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.right).toBeLessThanOrEqual(1000 + EPS);
      expect(aabb.top).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.bottom).toBeLessThanOrEqual(1000 + EPS);
    });
  });

  // ── 10. Negative rotation equals positive rotation ───────────────────────────

  describe('negative rotation yields same result as positive', () => {
    const base: Omit<RotationLayoutParams, 'rotation'> = {
      elX: 5, elY: 5, elWidth: 70, elHeight: 12,
      textAlign: 'left', posterW: 1080, posterH: 1080,
    };

    it('effectiveContainerW is identical for ±rotation', () => {
      const pos = computeRotationLayout({ ...base, rotation:  20 });
      const neg = computeRotationLayout({ ...base, rotation: -20 });
      expect(neg.effectiveContainerW).toBeCloseTo(pos.effectiveContainerW, 5);
    });

    it('effectiveLeftPct is identical for ±rotation', () => {
      const pos = computeRotationLayout({ ...base, rotation:  20 });
      const neg = computeRotationLayout({ ...base, rotation: -20 });
      expect(neg.effectiveLeftPct).toBeCloseTo(pos.effectiveLeftPct, 5);
    });
  });

  // ── 11. 90° rotation (degenerate case) ──────────────────────────────────────
  // cosθ ≈ 0, sinθ ≈ 1 → maxW_x threshold not reachable; vertical constraints dominate.

  describe('90° rotation', () => {
    const params: RotationLayoutParams = {
      elX: 20, elY: 20, elWidth: 60, elHeight: 10,
      rotation: 90, textAlign: 'center',
      posterW: 1000, posterH: 1000,
    };

    it('does not throw', () => {
      expect(() => computeRotationLayout(params)).not.toThrow();
    });

    it('AABB is within poster bounds', () => {
      const aabb = resultAABB(computeRotationLayout(params), params);
      expect(aabb.left).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.right).toBeLessThanOrEqual(1000 + EPS);
      expect(aabb.top).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.bottom).toBeLessThanOrEqual(1000 + EPS);
    });
  });

  // ── 12. Multiple formats: 16:9 ──────────────────────────────────────────────

  describe('16:9 format (1920×1080)', () => {
    const params: RotationLayoutParams = {
      elX: 0, elY: 7.2, elWidth: 80, elHeight: 15,
      rotation: -14.2, textAlign: 'left',
      posterW: 1920, posterH: 1080,
    };

    it('AABB is fully within 1920×1080 poster', () => {
      const aabb = resultAABB(computeRotationLayout(params), params);
      expect(aabb.left).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.right).toBeLessThanOrEqual(1920 + EPS);
      expect(aabb.top).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.bottom).toBeLessThanOrEqual(1080 + EPS);
    });
  });

  // ── 13. Left alignment: no leftOverflow correction needed ────────────────────
  // Element in the middle of the poster (elX=40) — the AABB left edge
  // won't go below zero even without correction.

  describe('left alignment: no leftOverflow correction', () => {
    const params: RotationLayoutParams = {
      elX: 40, elY: 5, elWidth: 60, elHeight: 10,
      rotation: 30, textAlign: 'left',
      posterW: 1000, posterH: 1000,
    };

    it('AABB left is ≥ 0', () => {
      const aabb = resultAABB(computeRotationLayout(params), params);
      expect(aabb.left).toBeGreaterThanOrEqual(-EPS);
    });

    it('AABB is fully within poster', () => {
      const aabb = resultAABB(computeRotationLayout(params), params);
      expect(aabb.right).toBeLessThanOrEqual(1000 + EPS);
      expect(aabb.top).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.bottom).toBeLessThanOrEqual(1000 + EPS);
    });
  });

  // ── 14. Right alignment: rightOverflow correction ────────────────────────────
  // Right-anchored element where the AABB would protrude past posterW.
  // rightOverflow shifts the container left.

  describe('right alignment: rightOverflow correction', () => {
    const params: RotationLayoutParams = {
      elX: 20, elY: 7.2, elWidth: 80, elHeight: 15,
      rotation: 14.2, textAlign: 'right',
      posterW: 1080, posterH: 1080,
    };
    // rightPx=1080; vertical-top constraint: effectiveContainerW ≈ 657.9 px
    // Without correction AABB right > 1080; rightOverflow shifts container left.

    it('AABB right ≤ posterW', () => {
      const aabb = resultAABB(computeRotationLayout(params), params);
      expect(aabb.right).toBeLessThanOrEqual(1080 + EPS);
    });

    it('AABB is fully within poster', () => {
      const aabb = resultAABB(computeRotationLayout(params), params);
      expect(aabb.left).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.right).toBeLessThanOrEqual(1080 + EPS);
      expect(aabb.top).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.bottom).toBeLessThanOrEqual(1080 + EPS);
    });
  });

  // ── 15. Element already tiny: maxW > containerW → no change ─────────────────

  describe('maxW > containerW: no shrink', () => {
    const params: RotationLayoutParams = {
      elX: 45, elY: 45, elWidth: 10, elHeight: 5,
      rotation: 45, textAlign: 'center',
      posterW: 1000, posterH: 1000,
    };

    it('effectiveContainerW equals original containerW', () => {
      const { effectiveContainerW } = computeRotationLayout(params);
      expect(effectiveContainerW).toBeCloseTo(100, 0); // 10% of 1000
    });

    it('AABB is within poster', () => {
      const aabb = resultAABB(computeRotationLayout(params), params);
      expect(aabb.left).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.right).toBeLessThanOrEqual(1000 + EPS);
      expect(aabb.top).toBeGreaterThanOrEqual(-EPS);
      expect(aabb.bottom).toBeLessThanOrEqual(1000 + EPS);
    });
  });

});
