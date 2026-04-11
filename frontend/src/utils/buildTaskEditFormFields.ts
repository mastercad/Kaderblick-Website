import { parseTaskRecurrenceRule } from './taskConfig';
import type { CalendarEvent } from '../types/calendar';

type Task = NonNullable<CalendarEvent['task']>;

/**
 * Flattens a nested task object from a CalendarEvent into the individual
 * `task*` form fields that TaskEventFields reads from EventData/EventFormData.
 *
 * This is the single source of truth for mapping API task data → wizard form
 * state when opening an existing task event for editing.
 */
export function buildTaskEditFormFields(task: Task | undefined): {
  task?: Task;
  taskIsRecurring?: boolean;
  taskRecurrenceMode?: string;
  taskRecurrenceRule?: string;
  taskFreq?: string;
  taskInterval?: number;
  taskByDay?: string;
  taskByMonthDay?: number;
  taskRotationUsers?: string[];
  taskRotationCount?: number;
  taskOffset?: number;
} {
  if (!task) return {};

  const parsedRule = parseTaskRecurrenceRule(task.recurrenceRule);

  return {
    task,
    taskIsRecurring: task.isRecurring,
    taskRecurrenceMode: task.recurrenceMode,
    taskRecurrenceRule: task.recurrenceRule ?? undefined,
    taskFreq: parsedRule.freq,
    taskInterval: parsedRule.interval,
    taskByDay: parsedRule.byDay,
    taskByMonthDay: parsedRule.byMonthDay,
    taskRotationUsers: (task.rotationUsers ?? []).map(u => String(u.id)),
    taskRotationCount: task.rotationCount,
    taskOffset: task.offset,
  };
}
