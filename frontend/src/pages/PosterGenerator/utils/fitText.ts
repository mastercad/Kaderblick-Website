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
 * Trennzeichen für natürliche Umbrüche in Vereins- und Teamnamen.
 * Spezifischere (längere) Trenner stehen zuerst, damit sie beim Deduplizieren
 * Vorrang vor kürzeren überlappenden Trennern haben. '/' ohne Leerzeichen
 * steht zuletzt als Fallback für Schreibweisen wie „SG Wurgwitz/SG 90 Braunsdorf".
 */
const BREAK_SEPS = [' vs. ', ' vs ', ' / ', ' – ', ' - ', ' & ', ' + ', '/'];

interface BreakPoint {
  pos: number;
  sepLen: number;
}

/**
 * Findet alle natürlichen Umbruchpunkte im Text (positionssortiert, überlappungsfrei).
 * Frühere (pos-niedrigere) Trenner gewinnen bei Überlappung.
 */
function findAllBreakPoints(text: string): BreakPoint[] {
  const points: BreakPoint[] = [];
  for (const sep of BREAK_SEPS) {
    let idx = text.indexOf(sep);
    while (idx !== -1) {
      points.push({ pos: idx, sepLen: sep.length });
      idx = text.indexOf(sep, idx + 1);
    }
  }
  points.sort((a, b) => a.pos - b.pos);
  const result: BreakPoint[] = [];
  for (const p of points) {
    const last = result[result.length - 1];
    if (!last || p.pos >= last.pos + last.sepLen) {
      result.push(p);
    }
  }
  return result;
}

/** Teilt Text an den angegebenen Umbruchpunkten in getrimme Segmente. */
function splitAtBreakPoints(text: string, bps: BreakPoint[]): string[] {
  const segs: string[] = [];
  let start = 0;
  for (const bp of bps) {
    const seg = text.slice(start, bp.pos).trim();
    if (seg) segs.push(seg);
    start = bp.pos + bp.sepLen;
  }
  const last = text.slice(start).trim();
  if (last) segs.push(last);
  return segs;
}

/**
 * Minimale Schriftgröße, bei der alle Segmente in die Breite passen
 * (= limitierende Schriftgröße für dieses Zeilenlayout).
 */
function fontSizeForSegments(
  segments: string[],
  textTransform: 'none' | 'uppercase' | 'lowercase',
  availW: number,
  maxFontSize: number,
  minFontSize: number,
  fontFamily: string,
  fontWeight: string,
  letterSpacingEm: number,
): number {
  let minFs = maxFontSize;
  for (const seg of segments) {
    const t = applyTextTransform(seg, textTransform);
    const fs = findFittingFontSize(t, availW, maxFontSize, minFontSize, fontFamily, fontWeight, letterSpacingEm);
    minFs = Math.min(minFs, fs);
  }
  return minFs;
}

/** Alle k-elementigen Kombinationen aus arr (Reihenfolge bleibt erhalten). */
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  const result: T[][] = [];
  for (let i = 0; i <= arr.length - k; i++) {
    for (const rest of combinations(arr.slice(i + 1), k - 1)) {
      result.push([arr[i], ...rest]);
    }
  }
  return result;
}

/**
 * Sucht den besten natürlichen Umbruchpunkt nahe der Textmitte.
 * @deprecated Wird intern nicht mehr verwendet – nutze computeFitText mit mode='shrink-wrap'.
 */
export function findNaturalBreak(text: string): [string, string] | null {
  const bps = findAllBreakPoints(text);
  if (bps.length === 0) return null;
  const mid = text.length / 2;
  let best: BreakPoint | null = null;
  let bestDist = Infinity;
  for (const bp of bps) {
    const dist = Math.abs(bp.pos + bp.sepLen / 2 - mid);
    if (dist < bestDist) { bestDist = dist; best = bp; }
  }
  if (!best) return null;
  return [text.slice(0, best.pos).trim(), text.slice(best.pos + best.sepLen).trim()];
}

// ─── Haupt-Logik ─────────────────────────────────────────────────────────────

export interface FitTextResult {
  fontSize: number;
  /** Ein oder mehrere Zeilen – je nach Modus, Textlänge und maxLines. */
  lines: string[];
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
 * @param maxLines     Maximale Zeilenanzahl für shrink-wrap (Standard: 3).
 *                     Der Algorithmus probiert alle Zeilenanzahlen von 1 bis
 *                     maxLines und wählt die Variante mit der GRÖSSTEN Schrift.
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
  maxLines = 3,
): FitTextResult {
  // Horizontales Padding abziehen (je Seite 3 % der Containerbreite, min. 6 px).
  // Fängt Metriken-Unterschiede zwischen DOM-SVG-Rendering und SVG-als-Blob
  // (PNG-Export) auf – Browser rendern SVG-Blobs minimal breiter als canvas.measureText misst.
  const PADDING = Math.max(6, containerW * 0.03);
  const availW = Math.max(1, containerW - PADDING * 2);

  const transformed = applyTextTransform(text, textTransform);

  // ── shrink: einzeilig, Schrift schrumpft ────────────────────────────────────
  if (mode === 'shrink') {
    const maxFsByH = Math.max(minFontSize, Math.floor(containerH / lineHeight));
    const effectiveMax = Math.min(maxFontSize, maxFsByH);
    const fontSize = findFittingFontSize(
      transformed, availW, effectiveMax, minFontSize, fontFamily, fontWeight, letterSpacingEm,
    );
    return { fontSize, lines: [text] };
  }

  // ── shrink-wrap: optimale Zeilenanzahl und Aufteilung suchen ────────────────
  //
  // Für jede mögliche Zeilenanzahl (1 bis maxLines) werden alle Kombinationen
  // natürlicher Umbruchpunkte ausprobiert. Die Variante, bei der die
  // Schriftgröße am GRÖSSTEN ist (und in den Container passt), gewinnt.
  // Das bedeutet: mehr Zeilen sind besser, solange die Höhe ausreicht.
  const allBreakPoints = findAllBreakPoints(text);
  let bestFontSize = -1;
  let bestLines: string[] = [text];

  for (let nLines = 1; nLines <= Math.max(1, maxLines); nLines++) {
    // Höhenbeschränkung für dieses Zeilenlayout
    const maxFsByH = Math.max(minFontSize, Math.floor(containerH / (lineHeight * nLines)));
    const effectiveMax = Math.min(maxFontSize, maxFsByH);

    if (nLines === 1) {
      const fs = findFittingFontSize(
        transformed, availW, effectiveMax, minFontSize, fontFamily, fontWeight, letterSpacingEm,
      );
      if (fs > bestFontSize) {
        bestFontSize = fs;
        bestLines = [text];
      }
    } else {
      const nBreaks = nLines - 1;
      if (allBreakPoints.length < nBreaks) continue;

      for (const combo of combinations(allBreakPoints, nBreaks)) {
        const segs = splitAtBreakPoints(text, combo);
        if (segs.length !== nLines) continue;
        const fs = fontSizeForSegments(
          segs, textTransform, availW, effectiveMax, minFontSize,
          fontFamily, fontWeight, letterSpacingEm,
        );
        if (fs > bestFontSize) {
          bestFontSize = fs;
          bestLines = segs;
        }
      }
    }
  }

  return { fontSize: Math.max(minFontSize, bestFontSize), lines: bestLines };
}
