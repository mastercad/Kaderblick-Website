import {
  buildTaskRecurrenceRule,
  getTaskConfigFromEvent,
  parseTaskRecurrenceRule,
  validateTaskConfiguration,
} from '../taskConfig';

describe('taskConfig helpers', () => {
  it('parses a weekly recurrence rule into task config fields', () => {
    const config = getTaskConfigFromEvent({
      taskIsRecurring: true,
      taskRecurrenceMode: 'classic',
      taskRecurrenceRule: JSON.stringify({ freq: 'WEEKLY', interval: 2, byday: ['FR'] }),
      taskRotationUsers: ['12', '14'],
      taskRotationCount: 1,
    });

    expect(config.freq).toBe('WEEKLY');
    expect(config.interval).toBe(2);
    expect(config.byDay).toBe('FR');
    expect(config.rotationUserIds).toEqual(['12', '14']);
  });

  it('builds a monthly recurrence rule from config values', () => {
    const rule = buildTaskRecurrenceRule({
      isRecurring: true,
      recurrenceMode: 'classic',
      freq: 'MONTHLY',
      interval: 1,
      byDay: 'MO',
      byMonthDay: 15,
      rotationUserIds: ['3'],
      rotationCount: 1,
      offset: 0,
    });

    expect(JSON.parse(rule)).toEqual({ freq: 'MONTHLY', interval: 1, bymonthday: 15 });
  });

  it('rejects invalid rotation sizes and missing users', () => {
    const result = validateTaskConfiguration({
      isRecurring: true,
      recurrenceMode: 'classic',
      freq: 'WEEKLY',
      interval: 1,
      byDay: 'MO',
      byMonthDay: 1,
      rotationUserIds: [],
      rotationCount: 2,
      offset: 0,
    }, { requireRecurring: true });

    expect(result.isValid).toBe(false);
    expect(result.errors.rotationUserIds).toMatch(/mindestens einen benutzer/i);
  });

  it('rejects per-match offsets outside the allowed range', () => {
    const result = validateTaskConfiguration({
      isRecurring: true,
      recurrenceMode: 'per_match',
      freq: 'WEEKLY',
      interval: 1,
      byDay: 'MO',
      byMonthDay: 1,
      rotationUserIds: ['8'],
      rotationCount: 1,
      offset: 400,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.offset).toMatch(/-365 und 365/i);
  });

  it('accepts one-off tasks without recurring configuration', () => {
    const result = validateTaskConfiguration({
      isRecurring: false,
      recurrenceMode: 'classic',
      freq: 'WEEKLY',
      interval: 1,
      byDay: 'MO',
      byMonthDay: 1,
      rotationUserIds: ['8'],
      rotationCount: 1,
      offset: 0,
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('keeps default values when recurrence rule is malformed', () => {
    const parsed = parseTaskRecurrenceRule('{not-json');

    expect(parsed).toEqual({
      freq: 'WEEKLY',
      interval: 1,
      byDay: 'MO',
      byMonthDay: 1,
    });
  });
});