/**
 * Zeithelfer für Spielereignisse.
 *
 * Konzept: Spielminuten zählen durchgängig (1 → 45 → 90 …).
 * Nachspielzeit wird separat als +X Minuten erfasst.
 * Gespeichert wird als absolute Sekunden ab Spielstart:
 *   (minute + stoppage) * 60
 *
 * Die Halbzeitdauer ist je nach Spielmodus unterschiedlich (20, 30, 45 Min.)
 * und wird als `halfDuration` aus dem GameType bezogen.
 * Steht kein Wert bereit, gilt 45 als Fallback.
 */

export const DEFAULT_HALF_DURATION = 45;

// ── Basis-Konvertierungen ────────────────────────────────────────────────────

/**
 * Absolute Sekunden ab Spielstart → Spielminute (aufgerundet, min 1).
 * Beispiel: 2700s → 45, 2820s → 47
 */
export const secondsToMinute = (seconds: number): number =>
  Math.max(1, Math.ceil(seconds / 60));

/**
 * Spielminute + Nachspielzeit → absolute Sekunden ab Spielstart.
 * Beispiel: minute=45, stoppage=2 → 2820s
 */
export const minuteToSeconds = (minute: number, stoppage: number): number =>
  (minute + stoppage) * 60;

export const parseFootballTimeInputToSeconds = (
  value: string,
  stoppage = 0,
): number | null => {
  const trimmed = value.trim();
  if (trimmed === '') return null;

  if (/^\d+$/.test(trimmed)) {
    return (Number(trimmed) + stoppage) * 60;
  }

  const match = trimmed.match(/^(\d{1,3}):([0-5]?\d)$/);
  if (!match) return null;

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);

  return minutes * 60 + seconds;
};

export const formatSecondsAsClockTime = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;

  return `${minutes}:${String(rest).padStart(2, '0')}`;
};

// ── Nachspielzeit-Erkennung ──────────────────────────────────────────────────

/**
 * Ermittelt aus absoluten Sekunden die Fußball-Notation mit getrennter
 * Nachspielzeit, sofern die Sekunden knapp über einem Halbzeitende liegen.
 *
 * Beispiele mit halfDuration=45:
 *   secondsToFootballTime(2700)  → { minute: 45, stoppage: 0 }  (45')
 *   secondsToFootballTime(2820)  → { minute: 45, stoppage: 2 }  (45+2')
 *   secondsToFootballTime(4020)  → { minute: 67, stoppage: 0 }  (67')
 *   secondsToFootballTime(5520)  → { minute: 90, stoppage: 2 }  (90+2')
 */
export const secondsToFootballTime = (
  seconds: number,
  halfDuration = DEFAULT_HALF_DURATION,
): { minute: number; stoppage: number } => {
  const rawMinute = secondsToMinute(seconds);
  const firstHalfEnd = halfDuration;
  const secondHalfEnd = halfDuration * 2;
  const maxStoppage = 15; // über 15 Min NS wird nicht mehr erkannt

  if (rawMinute > firstHalfEnd && rawMinute <= firstHalfEnd + maxStoppage) {
    return { minute: firstHalfEnd, stoppage: rawMinute - firstHalfEnd };
  }
  if (rawMinute > secondHalfEnd && rawMinute <= secondHalfEnd + maxStoppage) {
    return { minute: secondHalfEnd, stoppage: rawMinute - secondHalfEnd };
  }
  return { minute: rawMinute, stoppage: 0 };
};

// ── Live-Uhr ─────────────────────────────────────────────────────────────────

/**
 * Setzt die aktuelle Spielzeit (live) und erkennt automatisch Nachspielzeit.
 * Gibt minute + stoppage zurück – ggf. mit Nachspielzeit wenn Halbzeit-Ende
 * erkennbar überschritten.
 */
export const elapsedSecondsToFormTime = (
  elapsedSeconds: number,
  halfDuration = DEFAULT_HALF_DURATION,
): { minute: number; stoppage: number } => {
  const rawMinute = secondsToMinute(elapsedSeconds);
  const firstHalfWindow = halfDuration + 15;
  const secondHalfWindow = halfDuration * 2 + 15;

  if (rawMinute > halfDuration && rawMinute <= firstHalfWindow) {
    return { minute: halfDuration, stoppage: rawMinute - halfDuration };
  }
  if (rawMinute > halfDuration * 2 && rawMinute <= secondHalfWindow) {
    return { minute: halfDuration * 2, stoppage: rawMinute - halfDuration * 2 };
  }
  return { minute: rawMinute, stoppage: 0 };
};

// ── Anzeigehelfer ─────────────────────────────────────────────────────────────

/**
 * Gibt den Anzeigestring im Fußball-Format zurück.
 * Beispiele: "45+2'", "67'", "–"
 */
export const formatFootballTime = (minute: number, stoppage: number): string => {
  if (minute < 0) return '–';
  if (minute === 0 && stoppage === 0) return "0'";
  if (stoppage > 0) return `${minute}+${stoppage}'`;
  return `${minute}'`;
};

/**
 * Prüft ob die Nachspielzeit-Chips für eine gegebene Minute aktiviert
 * werden sollen (nahe am Ende einer Halbzeit).
 */
export const isNearHalfEnd = (
  minute: number,
  halfDuration = DEFAULT_HALF_DURATION,
  tolerance = 2,
): boolean => {
  const firstHalfEnd = halfDuration;
  const secondHalfEnd = halfDuration * 2;
  return (
    (minute >= firstHalfEnd - tolerance && minute <= firstHalfEnd) ||
    (minute >= secondHalfEnd - tolerance && minute <= secondHalfEnd)
  );
};
