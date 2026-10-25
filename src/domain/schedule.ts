import type { Completion, OccurrenceStatus, Repeat, Task, Weekday } from './types';

export const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5];
export const WEEKENDS: Weekday[] = [0, 6];

/** Bitmask of weekdays: bit 0 = Sunday ... bit 6 = Saturday. */
export const daysToMask = (days: Weekday[]): number => days.reduce<number>((m, d) => m | (1 << d), 0);
export const maskToDays = (mask: number): Weekday[] => ALL_DAYS.filter((d) => (mask & (1 << d)) !== 0);

export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export function parseTime(hhmm: string): { hour: number; minute: number } {
  const [hour, minute] = hhmm.split(':').map(Number);
  return { hour, minute };
}

/** Local Date at which `task` fires on `key`. */
export function fireTime(task: Pick<Task, 'timeOfDay'>, key: string): Date {
  const d = parseDateKey(key);
  const { hour, minute } = parseTime(task.timeOfDay);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function occursOn(repeat: Repeat, key: string): boolean {
  if (repeat.kind === 'once') return repeat.date === key;
  return repeat.days.includes(parseDateKey(key).getDay() as Weekday);
}

export function repeatLabel(repeat: Repeat): string {
  if (repeat.kind === 'once') return `Once on ${repeat.date}`;
  const set = new Set(repeat.days);
  const same = (a: Weekday[]) => a.length === set.size && a.every((x) => set.has(x));
  if (same(ALL_DAYS)) return 'Every day';
  if (same(WEEKDAYS)) return 'Weekdays';
  if (same(WEEKENDS)) return 'Weekends';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return [...repeat.days].sort().map((d) => names[d]).join(', ');
}

/**
 * Status of one occurrence. "Missed" is derived: unresolved and the day has ended.
 * Never stored, so editing a task never rewrites history.
 */
export function occurrenceStatus(
  completion: Completion | undefined,
  key: string,
  todayKey: string,
): OccurrenceStatus {
  if (completion && completion.deletedAt === null) return completion.status;
  return key < todayKey ? 'missed' : 'pending';
}
