import { arrowPath, halfToFull, makeMarkerId, clipLine } from '../utils';

describe('arrowPath', () => {
  it('returns a straight line for very short distances (len < 0.5)', () => {
    const result = arrowPath(10, 10, 10.1, 10.1);
    expect(result).toBe('M 10 10 L 10.1 10.1');
  });

  it('returns a quadratic bezier path for normal lengths', () => {
    const result = arrowPath(0, 0, 100, 0);
    expect(result).toMatch(/^M 0 0 Q .+ 100 0$/);
  });

  it('starts with M x1 y1 and ends with x2 y2', () => {
    const result = arrowPath(20, 30, 70, 80);
    expect(result).toMatch(/^M 20 30 Q /);
    expect(result).toMatch(/ 70 80$/);
  });

  it('handles diagonal lines without throwing', () => {
    expect(() => arrowPath(5, 5, 95, 95)).not.toThrow();
  });
});

describe('halfToFull', () => {
  it('maps 0 (attack) to 50% on full pitch', () => {
    expect(halfToFull(0)).toBe(50);
  });

  it('maps 100 (own goal) to 100% on full pitch', () => {
    expect(halfToFull(100)).toBe(100);
  });

  it('maps 50 (midpoint) to 75% on full pitch', () => {
    expect(halfToFull(50)).toBe(75);
  });
});

describe('makeMarkerId', () => {
  it('combines uid, kind and hex without the # sign', () => {
    expect(makeMarkerId(':r1:', '#ff0000', 'solid')).toBe(':r1:-ah-solid-ff0000');
  });

  it('works for dashed kind', () => {
    expect(makeMarkerId('uid', '#00ff00', 'dashed')).toBe('uid-ah-dashed-00ff00');
  });

  it('strips the # character from the hex value', () => {
    const id = makeMarkerId('x', '#abc123', 'solid');
    expect(id).not.toContain('#');
    expect(id).toContain('abc123');
  });
});

describe('clipLine', () => {
  // ── Fully inside the [0,100]×[0,100] box ─────────────────────────────────
  it('returns the original segment when both endpoints are inside the box', () => {
    const result = clipLine(10, 10, 90, 90);
    expect(result).not.toBeNull();
    expect(result!.x1).toBeCloseTo(10);
    expect(result!.y1).toBeCloseTo(10);
    expect(result!.x2).toBeCloseTo(90);
    expect(result!.y2).toBeCloseTo(90);
  });

  // ── Fully outside ─────────────────────────────────────────────────────────
  it('returns null when the segment lies entirely above the box (y < yMin)', () => {
    // Both points have y = -10, which is < 0
    expect(clipLine(20, -20, 80, -10)).toBeNull();
  });

  it('returns null when the segment lies entirely to the left', () => {
    expect(clipLine(-50, 10, -20, 80)).toBeNull();
  });

  // ── Partially crossing one boundary ──────────────────────────────────────
  it('clips a segment that enters the box from the left (x1 < 0)', () => {
    // Horizontal line at y=50, from x=-50 to x=50
    const result = clipLine(-50, 50, 50, 50);
    expect(result).not.toBeNull();
    expect(result!.x1).toBeCloseTo(0);   // clipped at left boundary
    expect(result!.y1).toBeCloseTo(50);
    expect(result!.x2).toBeCloseTo(50);
    expect(result!.y2).toBeCloseTo(50);
  });

  it('clips a segment that exits the box to the right (x2 > 100)', () => {
    const result = clipLine(50, 50, 150, 50);
    expect(result).not.toBeNull();
    expect(result!.x2).toBeCloseTo(100); // clipped at right boundary
    expect(result!.y2).toBeCloseTo(50);
  });

  it('clips a segment entering from the top (y1 < 0)', () => {
    // Vertical segment from y=-20 to y=60
    const result = clipLine(50, -20, 50, 60);
    expect(result).not.toBeNull();
    expect(result!.x1).toBeCloseTo(50);
    expect(result!.y1).toBeCloseTo(0);   // clipped at top boundary
    expect(result!.y2).toBeCloseTo(60);
  });

  it('clips a diagonal segment crossing two boundaries', () => {
    // Line from (-100, -100) to (100, 100): crosses left+top → right+bottom
    const result = clipLine(-100, -100, 100, 100);
    expect(result).not.toBeNull();
    expect(result!.x1).toBeCloseTo(0);
    expect(result!.y1).toBeCloseTo(0);
    expect(result!.x2).toBeCloseTo(100);
    expect(result!.y2).toBeCloseTo(100);
  });

  // ── Custom bounding box ───────────────────────────────────────────────────
  it('respects custom xMin/xMax/yMin/yMax when provided', () => {
    const result = clipLine(10, 10, 50, 50, 20, 20, 80, 80);
    expect(result).not.toBeNull();
    expect(result!.x1).toBeCloseTo(20);
    expect(result!.y1).toBeCloseTo(20);
  });

  // ── Exactly on boundary ───────────────────────────────────────────────────
  it('returns the segment unchanged when endpoints touch but do not cross the boundary', () => {
    const result = clipLine(0, 0, 100, 100);
    expect(result).not.toBeNull();
    expect(result!.x1).toBeCloseTo(0);
    expect(result!.y1).toBeCloseTo(0);
    expect(result!.x2).toBeCloseTo(100);
    expect(result!.y2).toBeCloseTo(100);
  });

  // ── Point segment ─────────────────────────────────────────────────────────
  it('returns the point as-is when start equals end and is inside the box', () => {
    const result = clipLine(50, 50, 50, 50);
    expect(result).not.toBeNull();
    expect(result!.x1).toBeCloseTo(50);
    expect(result!.x2).toBeCloseTo(50);
  });
});
