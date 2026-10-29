import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseBackup } from './backup';
import { DEFAULT_SOUND, parseAlarmSound, portableSound, soundLabel, soundUri } from './sound';
import type { AlarmSound } from './types';

const system: AlarmSound = { kind: 'system', uri: 'content://media/internal/audio/media/42', title: 'Cesium' };
const file: AlarmSound = { kind: 'file', uri: 'file:///data/user/0/app/files/sounds/1-wake.mp3', name: 'wake.mp3' };

test('parseAlarmSound accepts the three kinds', () => {
  assert.deepEqual(parseAlarmSound({ kind: 'default' }), DEFAULT_SOUND);
  assert.deepEqual(parseAlarmSound(system), system);
  assert.deepEqual(parseAlarmSound(file), file);
});

test('parseAlarmSound rejects anything else', () => {
  const bad: unknown[] = [
    null,
    undefined,
    'default',
    42,
    [],
    {},
    { kind: 'ringtone' },
    { kind: 'system' }, // no uri
    { kind: 'system', uri: '', title: 'x' },
    { kind: 'system', uri: 'https://evil.example/a.mp3', title: 'x' }, // only the phone's own tones
    { kind: 'system', uri: 'file:///etc/passwd', title: 'x' },
    { kind: 'file', uri: 'content://media/1', name: 'x' }, // imported files are always file://
    { kind: 'file', uri: 'http://evil.example/a.mp3', name: 'x' },
  ];
  for (const value of bad) assert.equal(parseAlarmSound(value), null, JSON.stringify(value));
});

test('parseAlarmSound supplies a label when the title or name is missing', () => {
  assert.equal(
    (parseAlarmSound({ kind: 'system', uri: 'content://x/1' }) as { title: string }).title,
    'Alarm tone',
  );
  assert.equal((parseAlarmSound({ kind: 'file', uri: 'file:///x.mp3' }) as { name: string }).name, 'Audio file');
});

test('soundUri is null for the default and for no choice', () => {
  assert.equal(soundUri(null), null);
  assert.equal(soundUri(undefined), null);
  assert.equal(soundUri(DEFAULT_SOUND), null);
  assert.equal(soundUri(system), system.kind === 'system' ? system.uri : '');
  assert.equal(soundUri(file), file.kind === 'file' ? file.uri : '');
});

test('soundLabel is human readable', () => {
  assert.equal(soundLabel(null), 'Phone default');
  assert.equal(soundLabel(DEFAULT_SOUND), 'Phone default');
  assert.equal(soundLabel(system), 'Cesium');
  assert.equal(soundLabel(file), 'wake.mp3');
});

test('portableSound drops imported files only', () => {
  assert.equal(portableSound(file), null);
  assert.deepEqual(portableSound(system), system);
  assert.deepEqual(portableSound(DEFAULT_SOUND), DEFAULT_SOUND);
  assert.equal(portableSound(null), null);
});

// ---- backups ---------------------------------------------------------------

const baseTask = {
  id: 't1',
  ownerId: 'u',
  title: 'Gym',
  notes: '',
  timeOfDay: '06:30',
  timezone: 'UTC',
  repeat: { kind: 'weekly', days: [1] },
  alertType: 'alarm',
  enabled: true,
  askFollowUp: true,
  createdAt: 1,
  updatedAt: 2,
  deletedAt: null,
};

const backupWith = (task: object, settings?: object) =>
  parseBackup(JSON.stringify({ app: 'remainder', version: 1, tasks: [task], completions: [], settings }));

test('a backup from before alarm sounds existed still restores, with no custom sound', () => {
  const r = backupWith(baseTask); // no alarmSound key at all
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.backup.tasks[0].alarmSound, null);
});

test('a task keeps a system tone through a backup', () => {
  const r = backupWith({ ...baseTask, alarmSound: system });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.backup.tasks[0].alarmSound, system);
});

test('imported files are dropped from a backup because they cannot travel to another install', () => {
  const r = backupWith({ ...baseTask, alarmSound: file }, { defaultAlarmSound: file, themeMode: 'dark' });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.backup.tasks[0].alarmSound, null);
  assert.deepEqual(r.backup.settings, { themeMode: 'dark' }); // default sound omitted, other settings kept
});

test('a corrupt sound in a backup falls back to the default instead of failing the whole restore', () => {
  const r = backupWith({ ...baseTask, alarmSound: { kind: 'system', uri: 'javascript:alert(1)' } });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.backup.tasks[0].alarmSound, null);
});
