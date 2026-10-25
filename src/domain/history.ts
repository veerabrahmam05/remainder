import { addDays, dateKey, occurrenceStatus, occursOn } from './schedule';
import type { Completion, OccurrenceStatus, Task } from './types';

export interface DayEntry {
  task: Task;
  status: OccurrenceStatus;
}

export type CompletionIndex = Map<string, Completion>;

const indexKey = (taskId: string, date: string) => `${taskId}|${date}`;

export function indexCompletions(completions: Completion[]): CompletionIndex {
  const map: CompletionIndex = new Map();
  for (const c of completions) {
    if (c.deletedAt === null) map.set(indexKey(c.taskId, c.date), c);
  }
  return map;
}

export function completionFor(index: CompletionIndex, taskId: string, date: string): Completion | undefined {
  return index.get(indexKey(taskId, date));
}

/** True if `task` is expected on `key`: enabled, scheduled that day, and already created by then. */
export function isDue(task: Task, key: string): boolean {
  if (!task.enabled || task.deletedAt !== null) return false;
  if (!occursOn(task.repeat, key)) return false;
  return dateKey(new Date(task.createdAt)) <= key;
}

export function entriesForDay(
  tasks: Task[],
  index: CompletionIndex,
  key: string,
  todayKey: string,
): DayEntry[] {
  return tasks
    .filter((t) => isDue(t, key))
    .sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay) || a.title.localeCompare(b.title))
    .map((task) => ({
      task,
      status: occurrenceStatus(completionFor(index, task.id, key), key, todayKey),
    }));
}

/**
 * Consecutive completed occurrences ending today / the most recent one.
 * Skipped occurrences are neutral (don't count, don't break); a missed one breaks the streak;
 * today's still-pending occurrence is ignored. One-off tasks have no streak.
 */
export function streakFor(task: Task, index: CompletionIndex, todayKey: string, maxDays = 366): number {
  if (task.repeat.kind === 'once') return 0;
  let streak = 0;
  let key = todayKey;
  for (let i = 0; i < maxDays; i++, key = addDays(key, -1)) {
    if (!isDue(task, key)) {
      if (dateKey(new Date(task.createdAt)) > key) break; // before the task existed
      continue;
    }
    const status = occurrenceStatus(completionFor(index, task.id, key), key, todayKey);
    if (status === 'done') streak++;
    else if (status === 'missed') break;
    // pending (today) and skipped: neutral
  }
  return streak;
}

export interface DaySummary {
  date: string;
  entries: DayEntry[];
  done: number;
  skipped: number;
  missed: number;
  pending: number;
}

export function summarizeDay(
  tasks: Task[],
  index: CompletionIndex,
  key: string,
  todayKey: string,
): DaySummary {
  const entries = entriesForDay(tasks, index, key, todayKey);
  const count = (s: OccurrenceStatus) => entries.filter((e) => e.status === s).length;
  return {
    date: key,
    entries,
    done: count('done'),
    skipped: count('skipped'),
    missed: count('missed'),
    pending: count('pending'),
  };
}
