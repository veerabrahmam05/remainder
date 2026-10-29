import assert from 'node:assert/strict';
import { test } from 'node:test';
import { entriesForDay, indexCompletions, streakFor, summarizeDay } from './history';
import {
  addDays,
  ALL_DAYS,
  dateKey,
  daysToMask,
  maskToDays,
  occurrenceStatus,
  occursOn,
  repeatLabel,
  WEEKDAYS,
  WEEKENDS,
} from './schedule';
import type { Completion, Task } from './types';

// 2026-10-19 is a Monday, 2026-10-24 a Saturday.
const MON = '2026-10-19';
const SAT = '2026-10-24';
const SUN = '2026-10-25';

const created = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 8).getTime();
};

function task(over: Partial<Task> = {}): Task {
  return {
    id: 't1',
    ownerId: 'u',
    title: 'Gym',
    notes: '',
    timeOfDay: '06:00',
    timezone: 'UTC',
    repeat: { kind: 'weekly', days: WEEKDAYS },
    alertType: 'alarm',
    alarmSound: null,
    enabled: true,
    askFollowUp: true,
    createdAt: created('2026-10-01'),
    updatedAt: 0,
    deletedAt: null,
    ...over,
  };
}

function done(date: string, status: Completion['status'] = 'done', taskId = 't1'): Completion {
  return { id: `${taskId}-${date}`, taskId, date, status, createdAt: 0, updatedAt: 0, deletedAt: null };
}

test('day mask round-trips', () => {
  assert.equal(daysToMask(WEEKDAYS), 0b0111110);
  assert.equal(daysToMask(WEEKENDS), 0b1000001);
  assert.deepEqual(maskToDays(daysToMask([0, 3, 6])), [0, 3, 6]);
  assert.deepEqual(maskToDays(daysToMask(ALL_DAYS)), ALL_DAYS);
});

test('occursOn respects weekday / weekend / once', () => {
  assert.equal(occursOn({ kind: 'weekly', days: WEEKDAYS }, MON), true);
  assert.equal(occursOn({ kind: 'weekly', days: WEEKDAYS }, SAT), false);
  assert.equal(occursOn({ kind: 'weekly', days: WEEKENDS }, SUN), true);
  assert.equal(occursOn({ kind: 'once', date: MON }, MON), true);
  assert.equal(occursOn({ kind: 'once', date: MON }, addDays(MON, 1)), false);
});

test('addDays / dateKey cross month boundaries', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(dateKey(new Date(2026, 0, 5)), '2026-01-05');
});

test('repeatLabel names presets', () => {
  assert.equal(repeatLabel({ kind: 'weekly', days: ALL_DAYS }), 'Every day');
  assert.equal(repeatLabel({ kind: 'weekly', days: WEEKDAYS }), 'Weekdays');
  assert.equal(repeatLabel({ kind: 'weekly', days: WEEKENDS }), 'Weekends');
  assert.equal(repeatLabel({ kind: 'weekly', days: [1, 3, 5] }), 'Mon, Wed, Fri');
});

test('occurrenceStatus derives missed / pending', () => {
  assert.equal(occurrenceStatus(undefined, MON, MON), 'pending');
  assert.equal(occurrenceStatus(undefined, MON, addDays(MON, 1)), 'missed');
  assert.equal(occurrenceStatus(done(MON, 'skipped'), MON, addDays(MON, 3)), 'skipped');
  assert.equal(occurrenceStatus({ ...done(MON), deletedAt: 1 }, MON, addDays(MON, 3)), 'missed');
});

test('entriesForDay hides disabled, deleted, wrong-day and not-yet-created tasks', () => {
  const tasks = [
    task({ id: 'a' }),
    task({ id: 'b', enabled: false }),
    task({ id: 'c', deletedAt: 5 }),
    task({ id: 'd', repeat: { kind: 'weekly', days: WEEKENDS } }),
    task({ id: 'e', createdAt: created('2026-10-20') }), // created after MON
  ];
  const ids = entriesForDay(tasks, indexCompletions([]), MON, MON).map((e) => e.task.id);
  assert.deepEqual(ids, ['a']);
});

test('streak counts done days, ignores skipped and pending today, stops at missed', () => {
  const t = task();
  const today = '2026-10-23'; // Friday
  // Fri pending, Thu done, Wed skipped, Tue done, Mon done, (previous Fri missed)
  const idx = indexCompletions([done('2026-10-22'), done('2026-10-21', 'skipped'), done('2026-10-20'), done('2026-10-19')]);
  assert.equal(streakFor(t, idx, today), 3);
});

test('streak skips non-scheduled days (weekend) without breaking', () => {
  const t = task();
  const today = '2026-10-26'; // Monday, pending
  const idx = indexCompletions([done('2026-10-23'), done('2026-10-22'), done('2026-10-21'), done('2026-10-20'), done('2026-10-19')]);
  assert.equal(streakFor(t, idx, today), 5);
});

test('streak is 0 for one-off tasks and stops at creation date', () => {
  assert.equal(streakFor(task({ repeat: { kind: 'once', date: MON } }), indexCompletions([done(MON)]), MON), 0);
  const fresh = task({ createdAt: created('2026-10-22') });
  const idx = indexCompletions([done('2026-10-22'), done('2026-10-23')]);
  assert.equal(streakFor(fresh, idx, '2026-10-23'), 2);
});

test('summarizeDay tallies statuses', () => {
  const tasks = [task({ id: 'a' }), task({ id: 'b' }), task({ id: 'c' })];
  const idx = indexCompletions([done(MON, 'done', 'a'), done(MON, 'skipped', 'b')]);
  const s = summarizeDay(tasks, idx, MON, addDays(MON, 1));
  assert.deepEqual([s.done, s.skipped, s.missed, s.pending], [1, 1, 1, 0]);
});
