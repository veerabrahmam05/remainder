import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BACKUP_VERSION, backupFileName, buildBackup, parseBackup, summarizeBackup } from './backup';
import type { Completion, Task } from './types';

const task: Task = {
  id: 't1',
  ownerId: 'old-user',
  title: 'Gym',
  notes: 'Leg day',
  timeOfDay: '06:30',
  timezone: 'Asia/Kolkata',
  repeat: { kind: 'weekly', days: [1, 3, 5] },
  alertType: 'alarm',
  alarmSound: { kind: 'system', uri: 'content://media/internal/audio/media/42', title: 'Cesium' },
  enabled: true,
  askFollowUp: false,
  createdAt: 1000,
  updatedAt: 2000,
  deletedAt: null,
};

const oneOff: Task = {
  ...task,
  id: 't2',
  title: 'Dentist',
  repeat: { kind: 'once', date: '2026-11-03' },
  alertType: 'notification',
  alarmSound: null,
  deletedAt: 3000,
};

const completion: Completion = {
  id: 'c1',
  taskId: 't1',
  date: '2026-10-26',
  status: 'done',
  createdAt: 1500,
  updatedAt: 1500,
  deletedAt: null,
};

const valid = () =>
  buildBackup({
    tasks: [task, oneOff],
    completions: [completion],
    settings: {
      defaultAlertType: 'alarm',
      followUpDelayMin: 30,
      themeMode: 'dark',
      defaultAlarmSound: { kind: 'system', uri: 'content://media/internal/audio/media/7', title: 'Argon' },
      snoozeMinutes: 15,
    },
    now: 5000,
  });

const parse = (value: unknown) => parseBackup(JSON.stringify(value));

test('a backup round-trips through JSON unchanged', () => {
  const result = parse(valid());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.backup.tasks, [task, oneOff]);
  assert.deepEqual(result.backup.completions, [completion]);
  assert.deepEqual(result.backup.settings, {
    defaultAlertType: 'alarm',
    followUpDelayMin: 30,
    themeMode: 'dark',
    defaultAlarmSound: { kind: 'system', uri: 'content://media/internal/audio/media/7', title: 'Argon' },
    snoozeMinutes: 15,
  });
  assert.equal(result.backup.version, BACKUP_VERSION);
  assert.equal(result.backup.exportedAt, 5000);
});

test('summary excludes soft-deleted rows', () => {
  const b = valid();
  assert.deepEqual(summarizeBackup(b), { tasks: 1, completions: 1 });
  assert.deepEqual(summarizeBackup({ ...b, completions: [{ ...completion, deletedAt: 9 }] }), { tasks: 1, completions: 0 });
});

test('file name carries the date', () => {
  assert.equal(backupFileName(new Date(2026, 9, 28)), 'remainder-backup-2026-10-28.json');
});

test('rejects text that is not JSON', () => {
  const r = parseBackup('not json {');
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /not valid JSON/);
});

test('rejects JSON that is not a Remainder backup', () => {
  for (const value of [null, [], 'hi', 42, {}, { app: 'other', version: 1, tasks: [], completions: [] }]) {
    const r = parse(value);
    assert.equal(r.ok, false, JSON.stringify(value));
    if (!r.ok) assert.match(r.error, /not a Remainder backup/);
  }
});

test('rejects a backup from a newer app version', () => {
  const r = parse({ ...valid(), version: BACKUP_VERSION + 1 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /newer version/);
});

test('rejects missing or invalid version and missing arrays', () => {
  assert.equal(parse({ ...valid(), version: 'one' }).ok, false);
  assert.equal(parse({ ...valid(), version: 0 }).ok, false);
  assert.equal(parse({ app: 'remainder', version: 1, tasks: [] }).ok, false);
  assert.equal(parse({ app: 'remainder', version: 1, completions: [] }).ok, false);
});

test('rejects malformed tasks with a message naming the entry', () => {
  const cases: [string, Partial<Record<keyof Task, unknown>>, RegExp][] = [
    ['empty id', { id: '' }, /Task #1 has no id/],
    ['blank title', { title: '   ' }, /no title/],
    ['bad time', { timeOfDay: '25:00' }, /invalid time/],
    ['bad time format', { timeOfDay: '7:00' }, /invalid time/],
    ['bad alert', { alertType: 'siren' }, /alert type/],
    ['bad flag', { enabled: 'yes' }, /flags/],
    ['bad timestamp', { updatedAt: 'now' }, /timestamps/],
    ['bad deletedAt', { deletedAt: 'x' }, /deletion time/],
    ['bad repeat kind', { repeat: { kind: 'monthly' } }, /repeat rule/],
    ['bad once date', { repeat: { kind: 'once', date: '11/03/2026' } }, /repeat rule/],
    ['bad weekday', { repeat: { kind: 'weekly', days: [7] } }, /repeat rule/],
    ['non-integer weekday', { repeat: { kind: 'weekly', days: [1.5] } }, /repeat rule/],
  ];
  for (const [name, patch, expected] of cases) {
    const r = parse({ ...valid(), tasks: [{ ...task, ...patch }] });
    assert.equal(r.ok, false, name);
    if (!r.ok) assert.match(r.error, expected, name);
  }
  const r = parse({ ...valid(), tasks: [task, 'oops'] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /Task #2/);
});

test('rejects malformed history entries', () => {
  const cases: [Partial<Record<keyof Completion, unknown>>, RegExp][] = [
    [{ taskId: '' }, /no task/],
    [{ date: '2026-1-1' }, /invalid date/],
    [{ status: 'missed' }, /invalid status/], // "missed" is derived, never stored
    [{ createdAt: null }, /timestamps/],
  ];
  for (const [patch, expected] of cases) {
    const r = parse({ ...valid(), completions: [{ ...completion, ...patch }] });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, expected);
  }
});

test('unknown fields are dropped so they never reach the database', () => {
  const r = parse({
    ...valid(),
    extra: 'ignored',
    tasks: [{ ...task, evil: 'DROP TABLE tasks', ownerId: undefined }],
    completions: [{ ...completion, surprise: 1 }],
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal('evil' in r.backup.tasks[0], false);
  assert.equal(r.backup.tasks[0].ownerId, '');
  assert.equal('surprise' in r.backup.completions[0], false);
});

test('weekly days are de-duplicated and sorted', () => {
  const r = parse({ ...valid(), tasks: [{ ...task, repeat: { kind: 'weekly', days: [5, 1, 5, 3] } }] });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.backup.tasks[0].repeat, { kind: 'weekly', days: [1, 3, 5] });
});

test('invalid settings are dropped without failing the restore', () => {
  const r = parse({
    ...valid(),
    settings: { defaultAlertType: 'siren', followUpDelayMin: -5, themeMode: 'dark' },
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.backup.settings, { themeMode: 'dark' });

  const none = parse({ ...valid(), settings: 'garbage' });
  assert.equal(none.ok, true);
  if (none.ok) assert.equal(none.backup.settings, undefined);
});

test('snooze length is restored only when it is a sane whole number of minutes', () => {
  const snooze = (value: unknown) => {
    const r = parse({ ...valid(), settings: { snoozeMinutes: value } });
    assert.equal(r.ok, true);
    return r.ok ? r.backup.settings?.snoozeMinutes : undefined;
  };
  assert.equal(snooze(5), 5);
  assert.equal(snooze(30), 30);
  assert.equal(snooze(120), 120);
  for (const bad of [0, -5, 121, 7.5, '10', null, NaN, Infinity]) {
    assert.equal(snooze(bad), undefined, String(bad));
  }
});

test('an empty backup is valid', () => {
  const r = parse({ app: 'remainder', version: 1, tasks: [], completions: [] });
  assert.equal(r.ok, true);
});
