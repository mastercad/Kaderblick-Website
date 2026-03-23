import { EventData } from '../types/event';

export type TaskRecurrenceMode = 'classic' | 'per_match';
export type TaskFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface TaskConfigValues {
  isRecurring: boolean;
  recurrenceMode: TaskRecurrenceMode;
  freq: TaskFrequency;
  interval: number;
  byDay: string;
  byMonthDay: number;
  rotationUserIds: string[];
  rotationCount: number;
  offset: number;
}

export type TaskConfigField =
  | 'isRecurring'
  | 'recurrenceMode'
  | 'freq'
  | 'interval'
  | 'byDay'
  | 'byMonthDay'
  | 'rotationUserIds'
  | 'rotationCount'
  | 'offset';

export type TaskConfigErrors = Partial<Record<TaskConfigField, string>>;

export interface TaskConfigValidationResult {
  isValid: boolean;
  errors: TaskConfigErrors;
}

const DEFAULT_VALUES: TaskConfigValues = {
  isRecurring: false,
  recurrenceMode: 'classic',
  freq: 'WEEKLY',
  interval: 1,
  byDay: 'MO',
  byMonthDay: 1,
  rotationUserIds: [],
  rotationCount: 1,
  offset: 0,
};

function normalizeRecurrenceMode(value?: string): TaskRecurrenceMode {
  return value === 'per_match' ? 'per_match' : 'classic';
}

function normalizeFrequency(value?: string): TaskFrequency {
  if (value === 'DAILY' || value === 'MONTHLY') return value;
  return 'WEEKLY';
}

export function parseTaskRecurrenceRule(recurrenceRule?: string | null): Pick<TaskConfigValues, 'freq' | 'interval' | 'byDay' | 'byMonthDay'> {
  if (!recurrenceRule) {
    return {
      freq: DEFAULT_VALUES.freq,
      interval: DEFAULT_VALUES.interval,
      byDay: DEFAULT_VALUES.byDay,
      byMonthDay: DEFAULT_VALUES.byMonthDay,
    };
  }

  try {
    const parsed = JSON.parse(recurrenceRule);
    return {
      freq: normalizeFrequency(parsed?.freq),
      interval: Number(parsed?.interval) > 0 ? Number(parsed.interval) : DEFAULT_VALUES.interval,
      byDay: Array.isArray(parsed?.byday) && parsed.byday[0] ? String(parsed.byday[0]) : DEFAULT_VALUES.byDay,
      byMonthDay: Number(parsed?.bymonthday) > 0 ? Number(parsed.bymonthday) : DEFAULT_VALUES.byMonthDay,
    };
  } catch {
    return {
      freq: DEFAULT_VALUES.freq,
      interval: DEFAULT_VALUES.interval,
      byDay: DEFAULT_VALUES.byDay,
      byMonthDay: DEFAULT_VALUES.byMonthDay,
    };
  }
}

export function getTaskConfigFromEvent(event: EventData, options?: { defaultRecurring?: boolean }): TaskConfigValues {
  const parsedRule = parseTaskRecurrenceRule(event.taskRecurrenceRule ?? event.task?.recurrenceRule);
  const rotationUsers = event.taskRotationUsers ?? event.task?.rotationUsers?.map(user => String(user.id)) ?? [];

  return {
    isRecurring: event.taskIsRecurring ?? event.task?.isRecurring ?? options?.defaultRecurring ?? DEFAULT_VALUES.isRecurring,
    recurrenceMode: normalizeRecurrenceMode(event.taskRecurrenceMode ?? event.task?.recurrenceMode),
    freq: normalizeFrequency(event.taskFreq ?? parsedRule.freq),
    interval: Number(event.taskInterval) > 0 ? Number(event.taskInterval) : parsedRule.interval,
    byDay: event.taskByDay || parsedRule.byDay,
    byMonthDay: Number(event.taskByMonthDay) > 0 ? Number(event.taskByMonthDay) : parsedRule.byMonthDay,
    rotationUserIds: rotationUsers.map(String),
    rotationCount: Number(event.taskRotationCount) > 0 ? Number(event.taskRotationCount) : DEFAULT_VALUES.rotationCount,
    offset: Number.isFinite(Number(event.taskOffset)) ? Number(event.taskOffset) : DEFAULT_VALUES.offset,
  };
}

export function buildTaskRecurrenceRule(values: TaskConfigValues): string {
  if (!values.isRecurring || values.recurrenceMode !== 'classic') {
    return '';
  }

  const rule: Record<string, unknown> = {
    freq: values.freq,
    interval: values.interval,
  };

  if (values.freq === 'WEEKLY') {
    rule.byday = [values.byDay];
  }

  if (values.freq === 'MONTHLY') {
    rule.bymonthday = values.byMonthDay;
  }

  return JSON.stringify(rule);
}

export function validateTaskConfiguration(values: TaskConfigValues, options?: { requireRecurring?: boolean }): TaskConfigValidationResult {
  const errors: TaskConfigErrors = {};

  if (options?.requireRecurring && !values.isRecurring) {
    errors.isRecurring = 'Auf dieser Seite werden nur wiederkehrende Aufgaben oder Aufgaben pro Spiel angelegt.';
  }

  if (!values.rotationUserIds.length) {
    errors.rotationUserIds = 'Bitte mindestens einen Benutzer für die Rotation auswählen.';
  }

  if (!Number.isInteger(values.rotationCount) || values.rotationCount < 1) {
    errors.rotationCount = 'Bitte eine gültige Anzahl Personen pro Aufgabe angeben.';
  } else if (values.rotationUserIds.length > 0 && values.rotationCount > values.rotationUserIds.length) {
    errors.rotationCount = 'Die Anzahl gleichzeitig eingeteilter Personen darf nicht größer sein als die ausgewählte Rotation.';
  }

  if (!values.isRecurring) {
    return { isValid: Object.keys(errors).length === 0, errors };
  }

  if (values.recurrenceMode !== 'classic' && values.recurrenceMode !== 'per_match') {
    errors.recurrenceMode = 'Bitte einen gültigen Wiederkehr-Modus wählen.';
  }

  if (values.recurrenceMode === 'classic') {
    if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(values.freq)) {
      errors.freq = 'Bitte eine gültige Frequenz wählen.';
    }

    if (!Number.isInteger(values.interval) || values.interval < 1) {
      errors.interval = 'Bitte ein gültiges Intervall angeben.';
    }

    if (values.freq === 'WEEKLY' && !values.byDay) {
      errors.byDay = 'Bitte einen Wochentag auswählen.';
    }

    if (values.freq === 'MONTHLY' && (!Number.isInteger(values.byMonthDay) || values.byMonthDay < 1 || values.byMonthDay > 31)) {
      errors.byMonthDay = 'Bitte einen gültigen Monatstag zwischen 1 und 31 angeben.';
    }
  }

  if (values.recurrenceMode === 'per_match' && (!Number.isInteger(values.offset) || values.offset < -365 || values.offset > 365)) {
    errors.offset = 'Bitte einen gültigen Versatz zwischen -365 und 365 Tagen angeben.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}