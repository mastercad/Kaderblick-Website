/**
 * Tests für AVAILABLE_FONTS / FontOption (posterTemplate.ts)
 *
 * Geprüft wird:
 * - Welche Fonts haben Gewichte (Multi-Weight) und welche nicht (Single-Weight)
 * - Multi-Weight-Fonts haben mindestens 2 Gewichte, 'normal' ist immer enthalten
 * - Single-Weight-Fonts haben kein `weights`-Feld (undefined)
 * - Gewichtswerte sind gültige CSS font-weight-Werte
 * - Keine doppelten Font-IDs
 * - Jedes Gewicht einer Multi-Weight-Font ist ein gültiger CSS-Wert
 */

import { AVAILABLE_FONTS } from '../posterTemplate';

// ── Konstanten ────────────────────────────────────────────────────────────────

const MULTI_WEIGHT_FONTS = ['Inter', 'Oswald', 'Barlow Condensed', 'Exo 2'] as const;

// Alle anderen Fonts sollen Single-Weight sein (kein weights-Feld)
const SINGLE_WEIGHT_FONT_IDS = AVAILABLE_FONTS
  .filter(f => !MULTI_WEIGHT_FONTS.includes(f.id as typeof MULTI_WEIGHT_FONTS[number]))
  .map(f => f.id);

const VALID_CSS_WEIGHTS = new Set([
  '100', '200', '300', 'normal', '500', '600', 'bold', '800', '900',
]);

// ── Allgemeine Struktur ───────────────────────────────────────────────────────

describe('AVAILABLE_FONTS – Struktur', () => {
  it('enthält keine doppelten IDs', () => {
    const ids = AVAILABLE_FONTS.map(f => f.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('jede Font hat id, label und cssFamily', () => {
    for (const font of AVAILABLE_FONTS) {
      expect(font.id).toBeTruthy();
      expect(font.label).toBeTruthy();
      expect(font.cssFamily).toBeTruthy();
    }
  });
});

// ── Multi-Weight-Fonts ────────────────────────────────────────────────────────

describe('AVAILABLE_FONTS – Multi-Weight-Fonts', () => {
  it.each(MULTI_WEIGHT_FONTS)('%s hat ein weights-Array', (fontId) => {
    const font = AVAILABLE_FONTS.find(f => f.id === fontId);
    expect(font).toBeDefined();
    expect(font?.weights).toBeDefined();
    expect(Array.isArray(font?.weights)).toBe(true);
  });

  it.each(MULTI_WEIGHT_FONTS)('%s hat mindestens 2 Gewichte', (fontId) => {
    const font = AVAILABLE_FONTS.find(f => f.id === fontId)!;
    expect(font.weights!.length).toBeGreaterThanOrEqual(2);
  });

  it.each(MULTI_WEIGHT_FONTS)('%s enthält "normal"', (fontId) => {
    const font = AVAILABLE_FONTS.find(f => f.id === fontId)!;
    expect(font.weights).toContain('normal');
  });

  it.each(MULTI_WEIGHT_FONTS)('%s enthält nur gültige CSS font-weight-Werte', (fontId) => {
    const font = AVAILABLE_FONTS.find(f => f.id === fontId)!;
    for (const w of font.weights!) {
      expect(VALID_CSS_WEIGHTS.has(w)).toBe(true);
    }
  });

  it.each(MULTI_WEIGHT_FONTS)('%s enthält "bold" oder "900"', (fontId) => {
    const font = AVAILABLE_FONTS.find(f => f.id === fontId)!;
    const hasBold = font.weights!.includes('bold') || font.weights!.includes('900');
    expect(hasBold).toBe(true);
  });

  describe('Inter', () => {
    it('hat alle erwarteten Gewichte', () => {
      const font = AVAILABLE_FONTS.find(f => f.id === 'Inter')!;
      expect(font.weights).toEqual(['normal', '500', '600', 'bold', '800', '900']);
    });
  });

  describe('Oswald', () => {
    it('hat light (300) bis bold', () => {
      const font = AVAILABLE_FONTS.find(f => f.id === 'Oswald')!;
      expect(font.weights).toContain('300');
      expect(font.weights).toContain('bold');
    });
  });
});

// ── Single-Weight-Fonts ───────────────────────────────────────────────────────

describe('AVAILABLE_FONTS – Single-Weight-Fonts', () => {
  it.each(SINGLE_WEIGHT_FONT_IDS)(
    '%s hat kein weights-Feld (undefined)',
    (fontId) => {
      const font = AVAILABLE_FONTS.find(f => f.id === fontId)!;
      expect(font.weights).toBeUndefined();
    },
  );

  it('Anton, Bebas Neue, Impact, Bambe sind Single-Weight', () => {
    const singleWeightCheck = ['Anton', 'Bebas Neue', 'Impact', 'ImpactWeb', 'Bambe', 'Bambe Swash', 'Larthez'];
    for (const id of singleWeightCheck) {
      const font = AVAILABLE_FONTS.find(f => f.id === id);
      expect(font).toBeDefined();
      expect(font?.weights).toBeUndefined();
    }
  });

  it('alle Brush- und Pinsel-Fonts sind Single-Weight', () => {
    const brushFonts = ['Grindy Brush', 'Storm Gust', 'RetroBrush', 'Caveat Brush', 'Rock Salt', 'Rye', 'Rubik Dirt'];
    for (const id of brushFonts) {
      const font = AVAILABLE_FONTS.find(f => f.id === id);
      expect(font).toBeDefined();
      expect(font?.weights).toBeUndefined();
    }
  });
});

// ── Keine unerwarteten Multi-Weight-Fonts ─────────────────────────────────────

describe('AVAILABLE_FONTS – nur bekannte Multi-Weight-Fonts', () => {
  it('genau 4 Fonts haben weights', () => {
    const multiWeightCount = AVAILABLE_FONTS.filter(f => f.weights && f.weights.length > 0).length;
    expect(multiWeightCount).toBe(4);
  });

  it('nur Inter, Oswald, Barlow Condensed und Exo 2 haben weights', () => {
    const multiWeightIds = AVAILABLE_FONTS
      .filter(f => f.weights && f.weights.length > 0)
      .map(f => f.id);
    expect(multiWeightIds.sort()).toEqual([...MULTI_WEIGHT_FONTS].sort());
  });
});
