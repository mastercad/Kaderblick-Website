/**
 * resolveTextStyle – intelligente Schriftfarbe & Schatten für Poster-Elemente
 *
 * Ziel: Die Schrift soll wirken als hätte ein Grafiker sie gesetzt.
 * Kein generisches Schwarz/Weiß-Toggle, sondern:
 *  - Vereinsfarben als erste Wahl (wenn Kontrast ausreicht)
 *  - Warme Off-Whites / tiefe Navys statt reinem Weiß/Schwarz
 *  - Zweilagige Schatten (weicher Ambient + scharfe Kante) wie in Sportplakaten
 *  - Stärkere Schatten bei Bilderhintergründen
 */

import type { PosterBackground, PosterElement } from '../types/posterTemplate';
import type { ClubColors } from './parseClubColors';

// ─── Farb-Mathematik ─────────────────────────────────────────────────────────

export function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace(/^#/, '');
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return [r, g, b];
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return [r, g, b];
  }
  return null;
}

/**
 * WCAG-relative Leuchtdichte (0 = schwarz, 1 = weiß).
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function hexLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return relativeLuminance(...rgb);
}

function contrastRatio(l1: number, l2: number): number {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

// ─── Hintergrund-Leuchtdichte schätzen ───────────────────────────────────────

/**
 * Schätzt die wahrgenommene Helligkeit des Hintergrunds (0=dunkel, 1=hell).
 *
 * Für Bild-Hintergründe ohne Overlay wird konservativ dunkel angenommen –
 * Sportfotos sind fast immer kontrastreich mit dunklen Bereichen.
 */
export function estimateBackgroundLuminance(bg: PosterBackground): number {
  if (bg.type === 'solid' && bg.color) {
    return hexLuminance(bg.color) ?? 0.08;
  }

  if (bg.type === 'gradient' && bg.gradientColors && bg.gradientColors.length >= 1) {
    const luminances = bg.gradientColors
      .map(c => hexLuminance(c))
      .filter((l): l is number => l !== null);
    if (luminances.length === 0) return 0.08;
    return luminances.reduce((a, b) => a + b, 0) / luminances.length;
  }

  if (bg.type === 'image') {
    if (bg.overlayColor && bg.overlayOpacity != null && bg.overlayOpacity > 0) {
      const overlayL = hexLuminance(bg.overlayColor) ?? 0;
      const opacity  = bg.overlayOpacity;
      // Bild-Basis-Leuchtdichte: Sportfotos liegen im Schnitt bei ~0.12
      return overlayL * opacity + 0.12 * (1 - opacity);
    }
    // Kein Overlay → dunkler Foto-Hintergrund
    return 0.08;
  }

  return 0.08;
}

// ─── Automatische Farb-Auswahl ────────────────────────────────────────────────

/**
 * Erste Kandidaten-Farbe mit ausreichendem Kontrast (WCAG AA = 4.5:1).
 */
function pickContrastingColor(
  candidates: (string | undefined)[],
  bgLuminance: number,
  minContrast = 4.5,
): string | null {
  for (const c of candidates) {
    if (!c) continue;
    const l = hexLuminance(c);
    if (l === null) continue;
    if (contrastRatio(l, bgLuminance) >= minContrast) return c;
  }
  return null;
}

/**
 * Automatische Farb-Auswahl: zuerst Vereinsfarben prüfen, dann kuratierten
 * Fallback verwenden. Bewusst keine reinen Weiß/Schwarz-Werte – off-tone
 * Farben wirken gestalterischer.
 */
function autoColor(bgLuminance: number, clubColors?: ClubColors): string {
  const isDark = bgLuminance < 0.35;

  if (isDark) {
    // Heller Text – Reihenfolge: Vereins-Sekundär → Vereins-Primär (falls hell) → kuratiertes Off-White
    return (
      pickContrastingColor(
        [clubColors?.secondary, clubColors?.primary, '#F0ECD8', '#E8E3D2', '#FFFFFF'],
        bgLuminance,
      ) ?? '#F0ECD8'
    );
  }

  // Dunkler Text – Reihenfolge: Vereins-Primär → Vereins-Sekundär (falls dunkel) → tiefes Navy
  return (
    pickContrastingColor(
      [clubColors?.primary, clubColors?.secondary, '#0F1523', '#1A1A2E', '#111111'],
      bgLuminance,
    ) ?? '#0F1523'
  );
}

// ─── Text-Schatten: zweilagig, wie vom Grafiker ───────────────────────────────

/**
 * Berechnet einen Schatten der sich nach bewusster Designarbeit anfühlt.
 *
 * Prinzipien:
 *  - Nie das generische `1px 1px 2px black`
 *  - Zweilagig: weicher Ambient (Tiefe) + enger scharfer Kern (Kantendefinition)
 *  - Bilderhintergründe: stärker – Sportfotos brauchen mehr Kontrast
 *  - Helle Schrift auf dunklem Grund: klassischer Sportplakat-Look
 *  - Dunkle Schrift auf hellem Grund: kaum Schatten, nur feiner Lift
 */
function computeTextShadow(
  textLuminance: number,
  bgLuminance: number,
  bgType: 'solid' | 'gradient' | 'image',
): string {
  const textIsLight = textLuminance > 0.35;

  if (bgType === 'image') {
    // Bild-Hintergrund: maximale Unterstützung, zweilagig
    return '0 2px 20px rgba(0,0,0,0.65), 0 1px 4px rgba(0,0,0,0.88)';
  }

  if (textIsLight && bgLuminance < 0.35) {
    // Helles Wort auf dunklem Plakat: Ambient-Glow + scharfe Kante
    return '0 2px 14px rgba(0,0,0,0.40), 0 1px 3px rgba(0,0,0,0.70)';
  }

  if (!textIsLight && bgLuminance > 0.65) {
    // Dunkle Schrift auf hellem Hintergrund: dezenter Lift
    return '0 1px 6px rgba(0,0,0,0.08)';
  }

  // Mittlere Kontrastverhältnisse (farbiger Text, gemischte Hintergründe)
  if (textIsLight) {
    return '0 2px 10px rgba(0,0,0,0.48), 0 1px 2px rgba(0,0,0,0.72)';
  }
  return '0 1px 8px rgba(0,0,0,0.16)';
}

// ─── Öffentliche API ─────────────────────────────────────────────────────────

export interface ResolvedTextStyle {
  /** Endgültige CSS-Farbe */
  color: string;
  /** CSS text-shadow – zweilagig und hintergrundbewusst */
  textShadow: string;
}

/**
 * Löst Farbe und Schatten für ein Poster-Text-Element auf.
 *
 * - `el.color === 'auto'`     → beste Farbe aus Vereinspalette + Hintergrund
 * - Jede andere Farbe         → Nutzerfarbe beibehalten, passenden Schatten ergänzen
 *
 * In beiden Fällen entsteht ein Schatten, der Lesbarkeit und optische Tiefe
 * erzeugt – wie bei handgesetztem Sportplakatdesign.
 */
export function resolveTextStyle(
  el: Pick<PosterElement, 'color'>,
  bg: PosterBackground,
  clubColors?: ClubColors,
): ResolvedTextStyle {
  const bgLuminance = estimateBackgroundLuminance(bg);

  const color = el.color === 'auto'
    ? autoColor(bgLuminance, clubColors)
    : el.color;

  const textLuminance = hexLuminance(color) ?? (bgLuminance < 0.5 ? 1 : 0);
  const textShadow = computeTextShadow(textLuminance, bgLuminance, bg.type);

  return { color, textShadow };
}
