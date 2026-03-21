/**
 * WCAG Kontrast-Tests für Light- und Dark-Theme
 *
 * Schützt vor Regressionen wie dem #131111ff-Bug, bei dem text.secondary
 * versehentlich auf fast-Schwarz gesetzt war und auf dunklem Untergrund
 * völlig unlesbar wurde.
 *
 * WCAG 2.1 Mindestanforderungen:
 *   - AA Normaltext:       4.5 : 1
 *   - AA Großtext / UI:    3.0 : 1  (Buttons, Icons, …)
 *
 * Quellen:
 *   https://www.w3.org/TR/WCAG21/#contrast-minimum
 *   https://www.w3.org/TR/WCAG21/#relative-luminance
 */

import { lightTheme, darkTheme } from '../theme';

// ─── WCAG-Helfer ─────────────────────────────────────────────────────────────

/** Konvertiert einen #rrggbb-Hex-Wert in [r, g, b] (0-255). */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) throw new Error(`Ungültiger Hex-Wert: ${hex}`);
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/** Parst rgba(r, g, b, a) oder rgb(r, g, b).  Gibt [r, g, b, a] zurück (a = 1 wenn nicht angegeben). */
function parseRgba(color: string): [number, number, number, number] {
  const m = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (!m) throw new Error(`Kann Farbe nicht parsen: ${color}`);
  return [
    parseFloat(m[1]),
    parseFloat(m[2]),
    parseFloat(m[3]),
    m[4] !== undefined ? parseFloat(m[4]) : 1,
  ];
}

/**
 * Gibt [r, g, b] (0-255) für einen beliebigen CSS-Farbstring zurück.
 * Unterstützt #rrggbb, rgb(), rgba().
 */
function toRgb(color: string): [number, number, number] {
  if (color.startsWith('#')) return hexToRgb(color);
  const [r, g, b] = parseRgba(color);
  return [r, g, b];
}

/**
 * Parst Alpha-Wert einer Farbe (1.0 wenn keine Angabe / Hex-Farbe).
 */
function getAlpha(color: string): number {
  if (color.startsWith('#')) return 1;
  return parseRgba(color)[3];
}

/**
 * Blendet fg (inkl. Alpha) über bg.
 * Ergebnis: sRGB-Wert wie er auf dem Bildschirm erscheint.
 */
function blendOnBackground(
  fg: string,
  bg: string,
): [number, number, number] {
  const [fr, fg_, fb] = toRgb(fg);
  const [br, bg_, bb] = toRgb(bg);
  const a = getAlpha(fg);
  return [
    Math.round(a * fr + (1 - a) * br),
    Math.round(a * fg_ + (1 - a) * bg_),
    Math.round(a * fb + (1 - a) * bb),
  ];
}

/** Lineare Helligkeit eines einzelnen sRGB-Kanals (0-255 → 0-1). */
function linearize(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Relative Leuchtdichte nach WCAG 2.1. */
function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * Berechnet das Kontraktverhältnis zwischen Vorder- und Hintergrundfarbe.
 * fg und bg können #rrggbb, rgb() oder rgba() sein.
 * Bei rgba wird fg über bg geblendet (Alpha-Compositing).
 */
function contrastRatio(fg: string, bg: string): number {
  const [r, g, b] = blendOnBackground(fg, bg);
  const [br, bg_, bb] = toRgb(bg);
  const l1 = relativeLuminance(r, g, b);
  const l2 = relativeLuminance(br, bg_, bb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ─── Schwellenwerte ───────────────────────────────────────────────────────────

const WCAG_AA_NORMAL_TEXT = 4.5;  // Normaltext (< 18pt / < 14pt bold)
const WCAG_AA_LARGE_UI    = 3.0;  // Große Texte, Buttons, Icons

// ─── Extraktion der Theme-Farben ──────────────────────────────────────────────

const light = {
  textPrimary:       lightTheme.palette.text.primary,
  textSecondary:     lightTheme.palette.text.secondary,
  bgDefault:         lightTheme.palette.background.default,
  bgPaper:           lightTheme.palette.background.paper,
  primaryMain:       lightTheme.palette.primary.main,
  primaryContrast:   lightTheme.palette.primary.contrastText,
  secondaryMain:     lightTheme.palette.secondary.main,
  secondaryContrast: lightTheme.palette.secondary.contrastText,
};

const dark = {
  textPrimary:       darkTheme.palette.text.primary,
  textSecondary:     darkTheme.palette.text.secondary,
  bgDefault:         darkTheme.palette.background.default,
  bgPaper:           darkTheme.palette.background.paper,
  primaryMain:       darkTheme.palette.primary.main,
  primaryContrast:   darkTheme.palette.primary.contrastText,
  secondaryMain:     darkTheme.palette.secondary.main,
  secondaryContrast: darkTheme.palette.secondary.contrastText,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Theme – WCAG Kontrastanforderungen', () => {

  // Hilfsfunktion für aussagekräftige Fehlermeldung
  const assertContrast = (
    fg: string,
    bg: string,
    minRatio: number,
    label: string,
  ) => {
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(minRatio);
    // Ausgabe im Fehlerfall: `expect(2.78).toBeGreaterThanOrEqual(4.5) › ${label}`
    if (ratio < minRatio) {
      // Explizite Meldung damit der Fehler sofort verständlich ist
      throw new Error(
        `[${label}]\n  fg: ${fg}\n  bg: ${bg}\n  Kontrast: ${ratio.toFixed(2)}:1\n  Minimum:  ${minRatio}:1`,
      );
    }
  };

  // ── Light Theme ──────────────────────────────────────────────────────────

  describe('Light Theme', () => {
    it('text.primary auf background.paper (≥ 4.5:1)', () => {
      assertContrast(light.textPrimary, light.bgPaper, WCAG_AA_NORMAL_TEXT,
        'light text.primary / background.paper');
    });

    it('text.primary auf background.default (≥ 4.5:1)', () => {
      assertContrast(light.textPrimary, light.bgDefault, WCAG_AA_NORMAL_TEXT,
        'light text.primary / background.default');
    });

    it('text.secondary auf background.paper (≥ 4.5:1)', () => {
      assertContrast(light.textSecondary, light.bgPaper, WCAG_AA_NORMAL_TEXT,
        'light text.secondary / background.paper');
    });

    it('text.secondary auf background.default (≥ 4.5:1)', () => {
      assertContrast(light.textSecondary, light.bgDefault, WCAG_AA_NORMAL_TEXT,
        'light text.secondary / background.default');
    });

    it('primary.contrastText auf primary.main – Buttons (≥ 4.5:1)', () => {
      assertContrast(light.primaryContrast, light.primaryMain, WCAG_AA_NORMAL_TEXT,
        'light primary.contrastText / primary.main');
    });

    it('secondary.contrastText auf secondary.main – Buttons (≥ 3:1)', () => {
      assertContrast(light.secondaryContrast, light.secondaryMain, WCAG_AA_LARGE_UI,
        'light secondary.contrastText / secondary.main');
    });
  });

  // ── Dark Theme ───────────────────────────────────────────────────────────

  describe('Dark Theme', () => {
    it('text.primary auf background.paper (≥ 4.5:1)', () => {
      assertContrast(dark.textPrimary, dark.bgPaper, WCAG_AA_NORMAL_TEXT,
        'dark text.primary / background.paper');
    });

    it('text.primary auf background.default (≥ 4.5:1)', () => {
      assertContrast(dark.textPrimary, dark.bgDefault, WCAG_AA_NORMAL_TEXT,
        'dark text.primary / background.default');
    });

    it('text.secondary auf background.paper (≥ 4.5:1)', () => {
      // rgba(255,255,255,0.60) auf #1e1e1e → effektiv rgb(165,165,165) → 6.76:1
      assertContrast(dark.textSecondary, dark.bgPaper, WCAG_AA_NORMAL_TEXT,
        'dark text.secondary / background.paper [der klassische #131111ff-Bug]');
    });

    it('text.secondary auf background.default (≥ 4.5:1)', () => {
      // rgba(255,255,255,0.60) auf #121212 → 7.16:1
      assertContrast(dark.textSecondary, dark.bgDefault, WCAG_AA_NORMAL_TEXT,
        'dark text.secondary / background.default');
    });

    it('primary.contrastText auf primary.main – Buttons (≥ 4.5:1)', () => {
      // #000000 auf #4caf50 → 7.55:1
      assertContrast(dark.primaryContrast, dark.primaryMain, WCAG_AA_NORMAL_TEXT,
        'dark primary.contrastText / primary.main');
    });

    it('secondary.contrastText auf secondary.main – Buttons (≥ 4.5:1)', () => {
      // #000000 auf #00e676 → 12.6:1
      assertContrast(dark.secondaryContrast, dark.secondaryMain, WCAG_AA_NORMAL_TEXT,
        'dark secondary.contrastText / secondary.main');
    });
  });

  // ── Regressionsschutz: text.secondary darf NICHT dunkel sein ─────────────

  describe('Regressionsschutz', () => {
    it('dark text.secondary ist NICHT fast-schwarz (kein #131111-Bug)', () => {
      // Stellt sicher dass niemand versehentlich wieder einen dunklen Wert einträgt.
      // Blended effective color muss heller als 50% sein (L > 0.20).
      const [r, g, b] = blendOnBackground(dark.textSecondary, dark.bgPaper);
      const L = relativeLuminance(r, g, b);
      expect(L).toBeGreaterThan(0.20);
    });

    it('dark text.primary ist NICHT fast-schwarz', () => {
      const [r, g, b] = blendOnBackground(dark.textPrimary, dark.bgPaper);
      const L = relativeLuminance(r, g, b);
      expect(L).toBeGreaterThan(0.40);
    });

    it('dark primary.contrastText ist NICHT der alte #131111ff-Wert', () => {
      expect(dark.primaryContrast.toLowerCase()).not.toBe('#131111ff');
      expect(dark.primaryContrast.toLowerCase()).not.toContain('131111');
    });

    it('light text.secondary passt NICHT zu dark backgrounds', () => {
      // Light text.secondary (#424242) wäre auf dark bg (#1e1e1e) ≈ 1.4:1 – komplett unlesbar.
      // Dieser Test existiert als Dokumentation, warum BEIDE Themes eigene Werte brauchen.
      const ratio = contrastRatio(light.textSecondary, dark.bgPaper);
      expect(ratio).toBeLessThan(WCAG_AA_NORMAL_TEXT);
    });
  });
});
