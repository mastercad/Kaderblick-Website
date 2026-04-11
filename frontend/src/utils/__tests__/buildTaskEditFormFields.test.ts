import { buildTaskEditFormFields } from '../buildTaskEditFormFields';
import type { CalendarEvent } from '../../types/calendar';

// ── Helpers ─────────────────────────────────────────────────────────────────

type Task = NonNullable<CalendarEvent['task']>;

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 1,
  isRecurring: false,
  recurrenceMode: 'classic',
  recurrenceRule: null,
  rotationUsers: [],
  rotationCount: 1,
  offset: 0,
  ...overrides,
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('buildTaskEditFormFields', () => {
  // ── undefined / missing task ──────────────────────────────────────────────

  it('returns an object with all task* fields undefined when task is undefined', () => {
    const result = buildTaskEditFormFields(undefined);
    expect(result.task).toBeUndefined();
    expect(result.taskIsRecurring).toBeUndefined();
    expect(result.taskRecurrenceMode).toBeUndefined();
    expect(result.taskFreq).toBeUndefined();
    expect(result.taskInterval).toBeUndefined();
    expect(result.taskByDay).toBeUndefined();
    expect(result.taskByMonthDay).toBeUndefined();
    expect(result.taskRecurrenceRule).toBeUndefined();
    expect(result.taskRotationUsers).toBeUndefined();
    expect(result.taskRotationCount).toBeUndefined();
    expect(result.taskOffset).toBeUndefined();
  });

  // ── non-recurring task ────────────────────────────────────────────────────

  it('maps a non-recurring task with a single rotation user to flat fields', () => {
    const task = makeTask({
      isRecurring: false,
      rotationUsers: [{ id: 5, fullName: 'Anna Müller' }],
      rotationCount: 1,
      offset: 0,
    });
    const result = buildTaskEditFormFields(task);

    expect(result.taskIsRecurring).toBe(false);
    expect(result.taskRotationUsers).toEqual(['5']);
    expect(result.taskRotationCount).toBe(1);
    expect(result.taskOffset).toBe(0);
  });

  it('preserves the nested task object for non-recurring task', () => {
    const task = makeTask({ id: 42, isRecurring: false, rotationUsers: [] });
    const result = buildTaskEditFormFields(task);
    expect(result.task?.id).toBe(42);
    expect(result.task?.isRecurring).toBe(false);
  });

  it('sets taskRecurrenceMode to "classic" for a non-recurring task', () => {
    const task = makeTask({ isRecurring: false, recurrenceMode: 'classic' });
    const result = buildTaskEditFormFields(task);
    expect(result.taskRecurrenceMode).toBe('classic');
  });

  // ── per-match recurring task ──────────────────────────────────────────────

  it('sets taskIsRecurring=true and taskRecurrenceMode=per_match for a per-match task', () => {
    const task = makeTask({
      isRecurring: true,
      recurrenceMode: 'per_match',
      recurrenceRule: null,
      rotationUsers: [{ id: 2, fullName: 'Bob' }],
      rotationCount: 1,
      offset: -1,
    });
    const result = buildTaskEditFormFields(task);

    expect(result.taskIsRecurring).toBe(true);
    expect(result.taskRecurrenceMode).toBe('per_match');
    expect(result.taskOffset).toBe(-1);
    expect(result.taskRotationUsers).toEqual(['2']);
  });

  it('stores a positive offset correctly for per-match tasks', () => {
    const task = makeTask({ isRecurring: true, recurrenceMode: 'per_match', offset: 3 });
    const result = buildTaskEditFormFields(task);
    expect(result.taskOffset).toBe(3);
  });

  // ── classic recurring — WEEKLY ────────────────────────────────────────────

  it('parses a WEEKLY classic recurrenceRule into flat freq/interval/byDay fields', () => {
    const ruleStr = JSON.stringify({ freq: 'WEEKLY', interval: 2, byday: ['FR'] });
    const task = makeTask({
      isRecurring: true,
      recurrenceMode: 'classic',
      recurrenceRule: ruleStr,
      rotationUsers: [{ id: 3, fullName: 'Chris' }],
    });
    const result = buildTaskEditFormFields(task);

    expect(result.taskIsRecurring).toBe(true);
    expect(result.taskRecurrenceMode).toBe('classic');
    expect(result.taskFreq).toBe('WEEKLY');
    expect(result.taskInterval).toBe(2);
    expect(result.taskByDay).toBe('FR');
    expect(result.taskRecurrenceRule).toBe(ruleStr);
  });

  // ── classic recurring — MONTHLY ───────────────────────────────────────────

  it('parses a MONTHLY classic recurrenceRule into flat freq/interval/byMonthDay fields', () => {
    const task = makeTask({
      isRecurring: true,
      recurrenceMode: 'classic',
      recurrenceRule: JSON.stringify({ freq: 'MONTHLY', interval: 1, bymonthday: 15 }),
      rotationUsers: [{ id: 4, fullName: 'Dana' }],
    });
    const result = buildTaskEditFormFields(task);

    expect(result.taskFreq).toBe('MONTHLY');
    expect(result.taskInterval).toBe(1);
    expect(result.taskByMonthDay).toBe(15);
  });

  // ── classic recurring — DAILY ─────────────────────────────────────────────

  it('parses a DAILY classic recurrenceRule with interval correctly', () => {
    const task = makeTask({
      isRecurring: true,
      recurrenceMode: 'classic',
      recurrenceRule: JSON.stringify({ freq: 'DAILY', interval: 3 }),
      rotationUsers: [{ id: 7, fullName: 'Eve' }],
    });
    const result = buildTaskEditFormFields(task);

    expect(result.taskFreq).toBe('DAILY');
    expect(result.taskInterval).toBe(3);
  });

  // ── null recurrenceRule defaults ──────────────────────────────────────────

  it('falls back to default WEEKLY/1/MO/1 when recurrenceRule is null', () => {
    const task = makeTask({ isRecurring: true, recurrenceMode: 'classic', recurrenceRule: null });
    const result = buildTaskEditFormFields(task);

    expect(result.taskFreq).toBe('WEEKLY');
    expect(result.taskInterval).toBe(1);
    expect(result.taskByDay).toBe('MO');
    expect(result.taskByMonthDay).toBe(1);
  });

  // ── malformed recurrenceRule ──────────────────────────────────────────────

  it('falls back to defaults when recurrenceRule is not valid JSON', () => {
    const task = makeTask({
      isRecurring: true,
      recurrenceMode: 'classic',
      recurrenceRule: '{not-valid-json',
    });
    const result = buildTaskEditFormFields(task);

    expect(result.taskFreq).toBe('WEEKLY');
    expect(result.taskInterval).toBe(1);
    expect(result.taskByDay).toBe('MO');
    expect(result.taskByMonthDay).toBe(1);
  });

  // ── multiple rotation users ───────────────────────────────────────────────

  it('maps multiple rotation users to an array of string IDs', () => {
    const task = makeTask({
      rotationUsers: [
        { id: 10, fullName: 'Alice' },
        { id: 20, fullName: 'Bob' },
        { id: 30, fullName: 'Charlie' },
      ],
      rotationCount: 2,
    });
    const result = buildTaskEditFormFields(task);

    expect(result.taskRotationUsers).toEqual(['10', '20', '30']);
    expect(result.taskRotationCount).toBe(2);
  });

  it('returns an empty array for taskRotationUsers when task has no rotation users', () => {
    const task = makeTask({ rotationUsers: [] });
    const result = buildTaskEditFormFields(task);
    expect(result.taskRotationUsers).toEqual([]);
  });

  // ── taskRecurrenceRule as raw string ──────────────────────────────────────

  it('stores taskRecurrenceRule as the raw recurrenceRule string from the task object', () => {
    const ruleStr = JSON.stringify({ freq: 'WEEKLY', interval: 1, byday: ['MO'] });
    const task = makeTask({
      isRecurring: true,
      recurrenceMode: 'classic',
      recurrenceRule: ruleStr,
    });
    const result = buildTaskEditFormFields(task);
    expect(result.taskRecurrenceRule).toBe(ruleStr);
  });

  it('sets taskRecurrenceRule to undefined when recurrenceRule is null', () => {
    const task = makeTask({ recurrenceRule: null });
    const result = buildTaskEditFormFields(task);
    expect(result.taskRecurrenceRule).toBeUndefined();
  });

  // ── nested task object preservation ──────────────────────────────────────

  it('preserves all fields of the nested task object verbatim', () => {
    const task = makeTask({
      id: 99,
      isRecurring: true,
      recurrenceMode: 'per_match',
      recurrenceRule: null,
      rotationUsers: [{ id: 7, fullName: 'Test User' }],
      rotationCount: 1,
      offset: 2,
    });
    const result = buildTaskEditFormFields(task);

    expect(result.task).toEqual({
      id: 99,
      isRecurring: true,
      recurrenceMode: 'per_match',
      recurrenceRule: null,
      rotationUsers: [{ id: 7, fullName: 'Test User' }],
      rotationCount: 1,
      offset: 2,
    });
  });

  // ── real-world scenario (exact data from bug report) ─────────────────────

  it('correctly maps the exact task data from the bug report', () => {
    const task: Task = {
      id: 3,
      isRecurring: true,
      offset: 0,
      recurrenceMode: 'per_match',
      recurrenceRule: null,
      rotationCount: 1,
      rotationUsers: [
        { id: 1, fullName: 'User A' },
        { id: 2, fullName: 'User B' },
        { id: 3, fullName: 'User C' },
        { id: 4, fullName: 'User D' },
        { id: 5, fullName: 'User E' },
        { id: 6, fullName: 'User F' },
        { id: 7, fullName: 'User G' },
      ],
    };
    const result = buildTaskEditFormFields(task);

    expect(result.taskIsRecurring).toBe(true);
    expect(result.taskRecurrenceMode).toBe('per_match');
    expect(result.taskOffset).toBe(0);
    expect(result.taskRotationCount).toBe(1);
    expect(result.taskRotationUsers).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    // When per_match, recurrenceRule is null so rule fields fall back to defaults
    expect(result.taskFreq).toBe('WEEKLY');
    expect(result.taskInterval).toBe(1);
  });
});
