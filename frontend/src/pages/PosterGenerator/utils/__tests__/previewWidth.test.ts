/**
 * Unit-Tests für utils/previewWidth.ts
 *
 * Deckt ab:
 * - Mobile-Viewport (≤768px): Dialog-Margin ist 16px pro Seite (32px gesamt) laut
 *   mobile-responsive.css → Paper = min(600, vw−32) → Content = Paper − 48
 * - Desktop-Viewport (>768px): MUI-Standard 32px pro Seite (64px gesamt)
 *   → Paper = min(600, vw−64) → Content = Paper − 48
 * - Minimum-Guard: nie kleiner als 200px
 * - Maximum-Cap: nie größer als 552px (DialogContent-Max: 600 − 48)
 * - REGRESSION: Mobile 390px → 310px (nicht 278px wie mit falschem 64px-Gesamtmargin)
 * - Parität: Desktop 769px und Mobile 768px ergeben denselben Wert (552px)
 */

import { getInitialPreviewWidth } from '../previewWidth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setViewportWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    configurable: true,
    writable: true,
  });
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

const originalWidth = window.innerWidth;

afterEach(() => {
  setViewportWidth(originalWidth);
});

// ─── Mobile-Viewport (≤ 768px): Margin = 16px pro Seite = 32px gesamt ────────

describe('getInitialPreviewWidth – Mobile (≤ 768px)', () => {
  it('390px: paper=358, content=310', () => {
    setViewportWidth(390);
    // paper = min(600, 390 − 32) = 358 ; content = 358 − 48 = 310
    expect(getInitialPreviewWidth()).toBe(310);
  });

  it('375px: paper=343, content=295', () => {
    setViewportWidth(375);
    expect(getInitialPreviewWidth()).toBe(295);
  });

  it('360px: paper=328, content=280', () => {
    setViewportWidth(360);
    expect(getInitialPreviewWidth()).toBe(280);
  });

  it('320px: paper=288, content=240', () => {
    setViewportWidth(320);
    expect(getInitialPreviewWidth()).toBe(240);
  });

  it('768px (Grenzfall): paper=min(600,736)=600, content=552', () => {
    setViewportWidth(768);
    // totalMargin = 32 (≤ 768), paper = min(600, 768−32) = min(600,736) = 600
    expect(getInitialPreviewWidth()).toBe(552);
  });

  it('sehr schmaler Viewport (230px): Minimum-Guard greift → 200', () => {
    setViewportWidth(230);
    // paper = min(600, 230−32) = 198; content = 198−48 = 150 → max(200,150) = 200
    expect(getInitialPreviewWidth()).toBe(200);
  });
});

// ─── Desktop-Viewport (> 768px): Margin = 32px pro Seite = 64px gesamt ───────

describe('getInitialPreviewWidth – Desktop (> 768px)', () => {
  it('769px (erster Desktop-Wert): paper=min(600,705)=600, content=552', () => {
    setViewportWidth(769);
    // totalMargin = 64 (> 768), paper = min(600, 769−64) = min(600,705) = 600
    expect(getInitialPreviewWidth()).toBe(552);
  });

  it('1024px: paper=600, content=552', () => {
    setViewportWidth(1024);
    expect(getInitialPreviewWidth()).toBe(552);
  });

  it('1920px: paper=600, content=552', () => {
    setViewportWidth(1920);
    expect(getInitialPreviewWidth()).toBe(552);
  });

  it('2560px: paper=600, content=552 (Maximum-Cap greift)', () => {
    setViewportWidth(2560);
    expect(getInitialPreviewWidth()).toBe(552);
  });
});

// ─── Grenzen ──────────────────────────────────────────────────────────────────

describe('getInitialPreviewWidth – Grenzwerte', () => {
  it('ist immer mindestens 200px (Minimum-Guard)', () => {
    setViewportWidth(100);
    expect(getInitialPreviewWidth()).toBeGreaterThanOrEqual(200);
  });

  it('ist immer maximal 552px (DialogContent-Max: 600 − 48)', () => {
    setViewportWidth(2560);
    expect(getInitialPreviewWidth()).toBeLessThanOrEqual(552);
  });
});

// ─── Parität: Mobile 768px ↔ Desktop 769px ───────────────────────────────────

describe('getInitialPreviewWidth – Mobile/Desktop-Parität an der Grenze', () => {
  /**
   * An der exakten Grenze (768px ↔ 769px) darf kein Sprung entstehen.
   * Beide Viewports sind so groß, dass paper = 600px → content = 552px.
   * Ein Sprung hier würde bedeuten, dass ein Dialog bei 768px breiter aussieht
   * als bei 769px, was inkonsistent wäre.
   */
  it('768px (mobile) und 769px (desktop) liefern denselben Wert (552)', () => {
    setViewportWidth(768);
    const mobileSide = getInitialPreviewWidth();

    setViewportWidth(769);
    const desktopSide = getInitialPreviewWidth();

    expect(mobileSide).toBe(desktopSide);
    expect(mobileSide).toBe(552);
  });
});

// ─── REGRESSIONSTEST: Mobiler Schwarzrand-Bug ─────────────────────────────────

describe('getInitialPreviewWidth – REGRESSION: Schwarzer Rand auf Mobile', () => {
  /**
   * BUG (behoben): getInitialPreviewWidth() verwendete fälschlicherweise 64px
   * als Gesamtmargin (= 2 × 32px MUI-Standard) auch auf Mobile. Auf Mobile setzt
   * mobile-responsive.css jedoch margin: 16px !important (2 × 16px = 32px gesamt).
   *
   * Mit dem falschen Margin:
   *   mobile 390px → min(600, 390−64) − 48 = 326 − 48 = 278px
   *
   * Folge: previewWidth (278) < container.offsetWidth (310) → schwarzer Rand
   * auf der rechten und unteren Seite.
   *
   * Korrekte Berechnung:
   *   mobile 390px → min(600, 390−32) − 48 = 358 − 48 = 310px → kein Rand
   */
  it('390px → 310px (NICHT 278px wie mit falschem 64px-Margin)', () => {
    setViewportWidth(390);
    const width = getInitialPreviewWidth();

    // Der falsche Wert wäre 278 gewesen:
    expect(width).not.toBe(278);

    // Der korrekte Wert ist 310:
    expect(width).toBe(310);
  });

  it('375px → 295px (NICHT 263px wie mit falschem 64px-Margin)', () => {
    setViewportWidth(375);
    // Falsch:  min(600, 375−64) − 48 = 311 − 48 = 263
    // Korrekt: min(600, 375−32) − 48 = 343 − 48 = 295
    expect(getInitialPreviewWidth()).not.toBe(263);
    expect(getInitialPreviewWidth()).toBe(295);
  });

  it('360px → 280px (NICHT 248px wie mit falschem 64px-Margin)', () => {
    setViewportWidth(360);
    expect(getInitialPreviewWidth()).not.toBe(248);
    expect(getInitialPreviewWidth()).toBe(280);
  });

  /**
   * Für alle mobilen Viewports (≤768px) muss gelten:
   * Ergebnis = min(600, vw − 32) − 48 (mit 32px-Margin)
   * NICHT: min(600, vw − 64) − 48 (mit 64px-Margin)
   */
  it.each([
    [390, 310, 278],
    [375, 295, 263],
    [360, 280, 248],
    [414, 334, 302], // iPhone Plus
    [430, 350, 318], // iPhone 14 Pro Max
  ] as [number, number, number][])(
    'viewport %dpx → %dpx (nicht %dpx)',
    (vw, correct, wrong) => {
      setViewportWidth(vw);
      const result = getInitialPreviewWidth();
      expect(result).toBe(correct);
      expect(result).not.toBe(wrong);
    },
  );
});
