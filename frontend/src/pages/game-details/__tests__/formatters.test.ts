import { formatDateNice, formatTimeNice, formatVideoLength } from '../formatters';

// ── formatDateNice ──────────────────────────────────────────────────────────

describe('formatDateNice', () => {
  it('returns a string matching the "Xy, D. Month YYYY" pattern', () => {
    const result = formatDateNice('2025-07-16T12:00:00.000Z');
    expect(result).toMatch(/^\w{2}, \d{1,2}\. \w{3} \d{4}$/);
  });

  it('uses the correct year', () => {
    expect(formatDateNice('2025-07-16T12:00:00.000Z')).toContain('2025');
    expect(formatDateNice('2030-07-16T12:00:00.000Z')).toContain('2030');
  });

  it('uses German month abbreviations', () => {
    // Using noon UTC keeps the date stable across all ±14h timezones
    expect(formatDateNice('2025-01-15T12:00:00.000Z')).toContain('Jan');
    expect(formatDateNice('2025-02-15T12:00:00.000Z')).toContain('Feb');
    expect(formatDateNice('2025-03-15T12:00:00.000Z')).toContain('Mär');
    expect(formatDateNice('2025-04-15T12:00:00.000Z')).toContain('Apr');
    expect(formatDateNice('2025-05-15T12:00:00.000Z')).toContain('Mai');
    expect(formatDateNice('2025-06-15T12:00:00.000Z')).toContain('Jun');
    expect(formatDateNice('2025-07-15T12:00:00.000Z')).toContain('Jul');
    expect(formatDateNice('2025-08-15T12:00:00.000Z')).toContain('Aug');
    expect(formatDateNice('2025-09-15T12:00:00.000Z')).toContain('Sep');
    expect(formatDateNice('2025-10-15T12:00:00.000Z')).toContain('Okt');
    expect(formatDateNice('2025-11-15T12:00:00.000Z')).toContain('Nov');
    expect(formatDateNice('2025-12-15T12:00:00.000Z')).toContain('Dez');
  });

  it('includes a German day abbreviation', () => {
    const result = formatDateNice('2025-07-16T12:00:00.000Z');
    // Day-of-week abbreviations in the formatter
    const germanDays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const startsWithDayAbbr = germanDays.some((d) => result.startsWith(d));
    expect(startsWithDayAbbr).toBe(true);
  });

  it('includes the day of month', () => {
    // At noon UTC, July 16 is still the 16th in every timezone
    expect(formatDateNice('2025-07-16T12:00:00.000Z')).toContain('16.');
  });
});

// ── formatTimeNice ──────────────────────────────────────────────────────────

describe('formatTimeNice', () => {
  it('returns a string matching the HH:MM pattern', () => {
    const result = formatTimeNice('2025-07-16T10:05:00.000Z');
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it('zero-pads the minutes part', () => {
    // Minutes are always parsed the same regardless of timezone
    const result = formatTimeNice('2025-07-16T10:05:00.000Z');
    const [, minutes] = result.split(':');
    expect(minutes).toBe('05');
  });

  it('outputs exactly two digits for hours', () => {
    const result = formatTimeNice('2025-07-16T10:05:00.000Z');
    const [hours] = result.split(':');
    expect(hours).toHaveLength(2);
  });

  it('different times produce different outputs', () => {
    const r1 = formatTimeNice('2025-07-16T10:05:00.000Z');
    const r2 = formatTimeNice('2025-07-16T10:30:00.000Z');
    expect(r1).not.toBe(r2);
  });
});

// ── formatVideoLength ───────────────────────────────────────────────────────

describe('formatVideoLength', () => {
  it('formats 0 seconds as "0:00"', () => {
    expect(formatVideoLength(0)).toBe('0:00');
  });

  it('formats seconds below a minute', () => {
    expect(formatVideoLength(35)).toBe('0:35');
  });

  it('formats exactly one minute', () => {
    expect(formatVideoLength(60)).toBe('1:00');
  });

  it('formats minutes and single-digit seconds with zero-pad', () => {
    expect(formatVideoLength(65)).toBe('1:05');
  });

  it('formats two-digit minutes and two-digit seconds', () => {
    expect(formatVideoLength(125)).toBe('2:05');
  });

  it('does not zero-pad the minutes part', () => {
    expect(formatVideoLength(600)).toBe('10:00');
  });

  it('handles a full 90-minute game', () => {
    expect(formatVideoLength(5400)).toBe('90:00');
  });

  it('handles one second', () => {
    expect(formatVideoLength(1)).toBe('0:01');
  });

  it('handles 59 seconds', () => {
    expect(formatVideoLength(59)).toBe('0:59');
  });
});
