/**
 * Unit-Tests für utils/gameEventTime.ts
 *
 * Abgedeckt:
 *  secondsToMinute      – Sekunden → Spielminute
 *  minuteToSeconds      – Minute + Nachspielzeit → Sekunden
 *  secondsToFootballTime – Nachspielzeit-Erkennung
 *  elapsedSecondsToFormTime – Live-Uhr → Formularwerte (inkl. NS-Erkennung)
 *  formatFootballTime   – Anzeigestring
 *  isNearHalfEnd        – Schwellenwert für NS-Chips
 */

import {
  secondsToMinute,
  minuteToSeconds,
  secondsToFootballTime,
  elapsedSecondsToFormTime,
  formatFootballTime,
  formatSecondsAsClockTime,
  isNearHalfEnd,
  DEFAULT_HALF_DURATION,
  parseFootballTimeInputToSeconds,
} from '../gameEventTime';

// ─────────────────────────────────────────────────────────────────────────────
// secondsToMinute
// ─────────────────────────────────────────────────────────────────────────────

describe('secondsToMinute', () => {
  it('gibt mindestens 1 zurück', () => {
    expect(secondsToMinute(0)).toBe(1);
    expect(secondsToMinute(-100)).toBe(1);
  });

  it('rundet Sekunden auf ganze Minuten auf', () => {
    expect(secondsToMinute(60)).toBe(1);
    expect(secondsToMinute(61)).toBe(2);
    expect(secondsToMinute(120)).toBe(2);
  });

  it('berechnet 45. Minute korrekt', () => {
    expect(secondsToMinute(2700)).toBe(45); // exakt 45:00
    expect(secondsToMinute(2699)).toBe(45); // 44:59 → rundet auf 45
  });

  it('berechnet 67. Minute korrekt', () => {
    expect(secondsToMinute(4020)).toBe(67); // exakt 67:00
    expect(secondsToMinute(3961)).toBe(67); // 66:01 → rundet auf 67
  });

  it('berechnet 90. Minute korrekt', () => {
    expect(secondsToMinute(5400)).toBe(90);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// minuteToSeconds
// ─────────────────────────────────────────────────────────────────────────────

describe('minuteToSeconds', () => {
  it('erlaubt Minute 0 für Spielbeginn', () => {
    expect(minuteToSeconds(0, 0)).toBe(0);
  });

  it('konvertiert normale Minuten korrekt', () => {
    expect(minuteToSeconds(1, 0)).toBe(60);
    expect(minuteToSeconds(45, 0)).toBe(2700);
    expect(minuteToSeconds(67, 0)).toBe(4020);
    expect(minuteToSeconds(90, 0)).toBe(5400);
  });

  it('addiert Nachspielzeit korrekt', () => {
    // 45+2' = (45+2)*60 = 2820
    expect(minuteToSeconds(45, 2)).toBe(2820);
    // 90+3' = (90+3)*60 = 5580
    expect(minuteToSeconds(90, 3)).toBe(5580);
  });

  it('ist umkehrbar mit secondsToMinute (ohne NS)', () => {
    const minute = 67;
    const sec = minuteToSeconds(minute, 0);
    expect(secondsToMinute(sec)).toBe(minute);
  });
});

describe('parseFootballTimeInputToSeconds', () => {
  it('parst ganze Minuten inklusive 0', () => {
    expect(parseFootballTimeInputToSeconds('0')).toBe(0);
    expect(parseFootballTimeInputToSeconds('12')).toBe(720);
  });

  it('parst mm:ss für sekundengenaue Ereignisse', () => {
    expect(parseFootballTimeInputToSeconds('0:15')).toBe(15);
    expect(parseFootballTimeInputToSeconds('12:34')).toBe(754);
  });

  it('addiert Nachspielzeit nur bei Minuten-Eingabe', () => {
    expect(parseFootballTimeInputToSeconds('45', 2)).toBe(2820);
    expect(parseFootballTimeInputToSeconds('45:30', 2)).toBe(2730);
  });

  it('lehnt ungültige Sekunden ab', () => {
    expect(parseFootballTimeInputToSeconds('12:99')).toBeNull();
    expect(parseFootballTimeInputToSeconds('abc')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// secondsToFootballTime
// ─────────────────────────────────────────────────────────────────────────────

describe('secondsToFootballTime', () => {
  describe('mit Standard-Halbzeitdauer (45 Min.)', () => {
    it('normale Minute ohne Nachspielzeit', () => {
      expect(secondsToFootballTime(4020)).toEqual({ minute: 67, stoppage: 0 });
    });

    it('genau 45. Minute – keine Nachspielzeit', () => {
      expect(secondsToFootballTime(2700)).toEqual({ minute: 45, stoppage: 0 });
    });

    it('45+2\' Nachspielzeit 1. Halbzeit', () => {
      // (45+2)*60 = 2820
      expect(secondsToFootballTime(2820)).toEqual({ minute: 45, stoppage: 2 });
    });

    it('45+5\' Nachspielzeit 1. Halbzeit', () => {
      expect(secondsToFootballTime(3000)).toEqual({ minute: 45, stoppage: 5 });
    });

    it('genau 90. Minute – keine Nachspielzeit', () => {
      expect(secondsToFootballTime(5400)).toEqual({ minute: 90, stoppage: 0 });
    });

    it('90+3\' Nachspielzeit 2. Halbzeit', () => {
      // (90+3)*60 = 5580
      expect(secondsToFootballTime(5580)).toEqual({ minute: 90, stoppage: 3 });
    });

    it('überschreitet die maximale erkennbare NS (>15) → behandelt als normale Minute', () => {
      // 45+16' = 3660s → rawMinute = 61; 61 > 45+15= 60 → kein NS-Match
      expect(secondsToFootballTime(3660)).toEqual({ minute: 61, stoppage: 0 });
    });
  });

  describe('mit kurzer Halbzeitdauer (20 Min. – Juniorenformat)', () => {
    it('20+2\' Nachspielzeit', () => {
      // (20+2)*60 = 1320
      expect(secondsToFootballTime(1320, 20)).toEqual({ minute: 20, stoppage: 2 });
    });

    it('40+1\' Nachspielzeit Ende 2. Halbzeit', () => {
      expect(secondsToFootballTime(2460, 20)).toEqual({ minute: 40, stoppage: 1 });
    });

    it('normale Minute mitten im Spiel', () => {
      expect(secondsToFootballTime(900, 20)).toEqual({ minute: 15, stoppage: 0 });
    });
  });

  describe('mit 30-Minuten-Halbzeit (Halbfeld)', () => {
    it('30+2\' Nachspielzeit', () => {
      expect(secondsToFootballTime(1920, 30)).toEqual({ minute: 30, stoppage: 2 });
    });

    it('60+1\' Nachspielzeit 2. Halbzeit', () => {
      expect(secondsToFootballTime(3660, 30)).toEqual({ minute: 60, stoppage: 1 });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// elapsedSecondsToFormTime
// ─────────────────────────────────────────────────────────────────────────────

describe('elapsedSecondsToFormTime', () => {
  it('setzt normale Minute ohne Nachspielzeit', () => {
    expect(elapsedSecondsToFormTime(4020)).toEqual({ minute: 67, stoppage: 0 });
  });

  it('erkennt Nachspielzeit nach 45. Minute (45+2 = 47 Min. real)', () => {
    // 47 echte Minuten vergangen → 47' > HZ-Ende 45 → NS
    expect(elapsedSecondsToFormTime(47 * 60)).toEqual({ minute: 45, stoppage: 2 });
  });

  it('erkennt Nachspielzeit nach 90. Minute (90+3 = 93 Min. real)', () => {
    expect(elapsedSecondsToFormTime(93 * 60)).toEqual({ minute: 90, stoppage: 3 });
  });

  it('setzt normale Minute in 2. Halbzeit korrekt', () => {
    // 74 Minuten vergangen → keine NS-Nähe
    expect(elapsedSecondsToFormTime(74 * 60)).toEqual({ minute: 74, stoppage: 0 });
  });

  it('funktioniert mit kurzer Halbzeitdauer (20 Min.)', () => {
    // 22 Minuten vergangen → 2 Min. NS nach der 20.
    expect(elapsedSecondsToFormTime(22 * 60, 20)).toEqual({ minute: 20, stoppage: 2 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatFootballTime
// ─────────────────────────────────────────────────────────────────────────────

describe('formatFootballTime', () => {
  it('zeigt Spielbeginn als 0. Minute', () => {
    expect(formatFootballTime(0, 0)).toBe("0'");
  });

  it('zeigt normale Minute mit Apostroph', () => {
    expect(formatFootballTime(67, 0)).toBe("67'");
  });

  it('zeigt Minute + Nachspielzeit', () => {
    expect(formatFootballTime(45, 2)).toBe("45+2'");
    expect(formatFootballTime(90, 3)).toBe("90+3'");
  });
});

describe('formatSecondsAsClockTime', () => {
  it('formatiert absolute Sekunden als m:ss', () => {
    expect(formatSecondsAsClockTime(0)).toBe('0:00');
    expect(formatSecondsAsClockTime(15)).toBe('0:15');
    expect(formatSecondsAsClockTime(754)).toBe('12:34');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isNearHalfEnd
// ─────────────────────────────────────────────────────────────────────────────

describe('isNearHalfEnd', () => {
  it('liefert true bei 45. Minute (Ende 1. Halbzeit)', () => {
    expect(isNearHalfEnd(45)).toBe(true);
  });

  it('liefert true bei 43-44. Minute (Toleranzbereich)', () => {
    expect(isNearHalfEnd(43)).toBe(true);
    expect(isNearHalfEnd(44)).toBe(true);
  });

  it('liefert false bei 42. Minute (außerhalb Toleranz)', () => {
    expect(isNearHalfEnd(42)).toBe(false);
  });

  it('liefert true bei 90. Minute (Ende 2. Halbzeit)', () => {
    expect(isNearHalfEnd(90)).toBe(true);
  });

  it('liefert true bei 88-89. Minute (Toleranzbereich)', () => {
    expect(isNearHalfEnd(88)).toBe(true);
    expect(isNearHalfEnd(89)).toBe(true);
  });

  it('liefert false bei 67. Minute (Spielmitte)', () => {
    expect(isNearHalfEnd(67)).toBe(false);
  });

  it('respektiert angepasste Halbzeitdauer (20 Min.)', () => {
    expect(isNearHalfEnd(20, 20)).toBe(true);
    expect(isNearHalfEnd(18, 20)).toBe(true);
    expect(isNearHalfEnd(17, 20)).toBe(false);
    expect(isNearHalfEnd(40, 20)).toBe(true); // Ende 2. HZ
  });

  it('respektiert angepasste Toleranz', () => {
    expect(isNearHalfEnd(44, DEFAULT_HALF_DURATION, 0)).toBe(false); // Toleranz 0
    expect(isNearHalfEnd(45, DEFAULT_HALF_DURATION, 0)).toBe(true);
  });
});
