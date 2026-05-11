/**
 * Hilfsfunktionen für dynamisches Text-Fitting in Poster-Elementen.
 *
 * Messung erfolgt über CanvasRenderingContext2D.measureText – das ist
 * synchron, DOM-frei und exakt genug für Binary-Search auf Schriftgröße.
 */

export type TextFitMode = 'shrink' | 'shrink-wrap';

// ─── Canvas-Singleton ─────────────────────────────────────────────────────────

let _canvas: HTMLCanvasElement | null = null;

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!_canvas) _canvas = document.createElement('canvas');
  return _canvas.getContext('2d');
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

export function applyTextTransform(
  text: string,
  transform: 'none' | 'uppercase' | 'lowercase',
): string {
  if (transform === 'uppercase') return text.toUpperCase();
  if (transform === 'lowercase') return text.toLowerCase();
  return text;
}

/**
 * Gibt die gerenderte Breite einer einzeiligen Zeichenkette in Pixel zurück.
 *
 * CSS letter-spacing wird auf jedes Zeichen addiert (auch das letzte),
 * da Browser das so implementieren.
 */
export function measureLineWidth(
  text: string,
  fontSize: number,
  cssFontFamily: string,
  fontWeight: string,
  letterSpacingEm: number,
): number {
  const ctx = getMeasureCtx();
  if (!ctx) {
    // SSR-Fallback: grobe Schätzung
    return fontSize * text.length * 0.6;
  }
  ctx.font = `${fontWeight} ${fontSize}px ${cssFontFamily}`;

  const metrics = ctx.measureText(text);
  const visualWidth = (metrics.actualBoundingBoxLeft ?? 0) + (metrics.actualBoundingBoxRight ?? metrics.width);
  const advanceWidth = metrics.width + text.length * letterSpacingEm * fontSize;
  return Math.max(visualWidth, advanceWidth);
}

/**
 * Binary-Search: Größte Integer-Schriftgröße (px), bei der `text` in `maxWidthPx` passt.
 * Liefert immer einen Wert zwischen `minFontSize` und `maxFontSize`.
 */
export function findFittingFontSize(
  text: string,
  maxWidthPx: number,
  maxFontSize: number,
  minFontSize: number,
  cssFontFamily: string,
  fontWeight: string,
  letterSpacingEm: number,
): number {
  const fits = (size: number) =>
    measureLineWidth(text, size, cssFontFamily, fontWeight, letterSpacingEm) <= maxWidthPx;

  if (fits(maxFontSize)) return maxFontSize;
  if (!fits(minFontSize)) return minFontSize;

  let lo = minFontSize;
  let hi = maxFontSize;
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo);
}

// ─── Smart Line Break ─────────────────────────────────────────────────────────

/**
 * Trennzeichen, an denen Vereins- und Teamnamen natürlich umgebrochen werden können.
 * Sortierung ist nicht relevant – wir suchen den bruchpunktnächsten zur Mitte.
 */
const BREAK_SEPS = [' / ', ' – ', ' - ', ' vs. ', ' vs ', ' & ', ' + '];

/**
 * Sucht den besten natürlichen Umbruchpunkt nahe der Textmitte.
 *
 * Gibt [Zeile1, Zeile2] zurück (getrimmt), oder `null` wenn kein Trenner gefunden.
 */
export function findNaturalBreak(text: string): [string, string] | null {
  const mid = text.length / 2;
  let best: { pos: number; sepLen: number; dist: number } | null = null;

  for (const sep of BREAK_SEPS) {
    let idx = text.indexOf(sep);
    while (idx !== -1) {
      const dist = Math.abs(idx + sep.length / 2 - mid);
      if (!best || dist < best.dist) {
        best = { pos: idx, sepLen: sep.length, dist };
      }
      idx = text.indexOf(sep, idx + 1);
    }
  }

  if (!best) return null;
  return [
    text.slice(0, best.pos).trim(),
    text.slice(best.pos + best.sepLen).trim(),
  ];
}

// ─── Haupt-Logik ─────────────────────────────────────────────────────────────

export interface FitTextResult {
  fontSize: number;
  /** Ein oder zwei Zeilen – je nach Modus und Textlänge. */
  lines: [string] | [string, string];
}

/**
 * Berechnet Schriftgröße und Zeilenaufteilung für ein Poster-Element.
 *
 * @param text         Anzuzeigender Text (nach Platzhalter-Auflösung, vor textTransform).
 * @param mode         Fitting-Modus.
 * @param maxFontSize  Maximale Schriftgröße in px (skalierter Wert).
 * @param minFontSize  Minimale Schriftgröße in px (skalierter Wert).
 * @param containerW   Tatsächliche Container-Breite in px.
 * @param containerH   Tatsächliche Container-Höhe in px.
 * @param fontFamily   CSS-Fontfamilie (z. B. '"Anton", sans-serif').
 * @param fontWeight   CSS-Fontgewicht (z. B. 'normal', '700').
 * @param letterSpacingEm  letter-spacing in em.
 * @param textTransform    CSS textTransform-Wert.
 * @param lineHeight   CSS lineHeight (Zahl, z. B. 1.1).
 */
export function computeFitText(
  text: string,
  mode: TextFitMode,
  maxFontSize: number,
  minFontSize: number,
  containerW: number,
  containerH: number,
  fontFamily: string,
  fontWeight: string,
  letterSpacingEm: number,
  textTransform: 'none' | 'uppercase' | 'lowercase',
  lineHeight: number,
): FitTextResult {
  // Horizontales Padding abziehen (je Seite 3 % der Containerbreite, min. 6 px).
  // Fängt Metriken-Unterschiede zwischen DOM-SVG-Rendering und SVG-als-Blob
  // (PNG-Export) auf – Browser rendern SVG-Blobs minimal breiter als canvas.measureText misst.
  const PADDING = Math.max(6, containerW * 0.03);
  const availW = Math.max(1, containerW - PADDING * 2);

  const transformed = applyTextTransform(text, textTransform);

  // Höhenbeschränkung: Schrift darf nicht größer sein als der Container hoch ist
  const maxFontSizeByHeight = Math.floor(containerH / lineHeight);
  const effectiveMaxFontSize = Math.min(maxFontSize, Math.max(minFontSize, maxFontSizeByHeight));

  // ── shrink: einzeilig, Schrift schrumpft ────────────────────────────────────
  if (mode === 'shrink') {
    const fontSize = findFittingFontSize(
      transformed, availW, effectiveMaxFontSize, minFontSize, fontFamily, fontWeight, letterSpacingEm,
    );
    return { fontSize, lines: [text] };
  }

  // ── shrink-wrap: zuerst 2-Zeilen-Layout versuchen ──────────────────────────
  const broken = findNaturalBreak(text);

  if (broken) {
    const [l1, l2] = broken;
    const t1 = applyTextTransform(l1, textTransform);
    const t2 = applyTextTransform(l2, textTransform);

    // Größte Schrift, bei der BEIDE Zeilen in die Breite passen
    const f1 = findFittingFontSize(t1, availW, effectiveMaxFontSize, minFontSize, fontFamily, fontWeight, letterSpacingEm);
    const f2 = findFittingFontSize(t2, availW, effectiveMaxFontSize, minFontSize, fontFamily, fontWeight, letterSpacingEm);
    const twoLineFontSize = Math.min(f1, f2);

    // Passt das 2-Zeilen-Layout auch in die Höhe?
    const twoLineHeight = twoLineFontSize * lineHeight * 2;
    if (twoLineHeight <= containerH && twoLineFontSize > minFontSize) {
      return { fontSize: twoLineFontSize, lines: [l1, l2] };
    }
  }

  // Kein natürlicher Umbruch oder Höhe reicht nicht → einzeilig schrumpfen
  const fontSize = findFittingFontSize(
    transformed, availW, effectiveMaxFontSize, minFontSize, fontFamily, fontWeight, letterSpacingEm,
  );
  return { fontSize, lines: [text] };
}
