import { dateKey } from './schedule';
import { parseAlarmSound, portableSound } from './sound';
import type { AlarmSound, AlertType, Completion, Task, Weekday } from './types';

export const BACKUP_APP = 'remainder';
/** Bump when the file shape changes incompatibly. Older versions must keep parsing. */
export const BACKUP_VERSION = 1;

export interface BackupSettings {
  defaultAlertType?: AlertType;
  followUpDelayMin?: number;
  themeMode?: 'system' | 'light' | 'dark';
  defaultAlarmSound?: AlarmSound;
  snoozeMinutes?: number;
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: number; // epoch ms
  tasks: Task[]; // includes soft-deleted rows so a restore (and later, sync) sees deletions
  completions: Completion[];
  settings?: BackupSettings;
}

export type ParseResult = { ok: true; backup: BackupFile } | { ok: false; error: string };

export function buildBackup(input: {
  tasks: Task[];
  completions: Completion[];
  settings: Required<BackupSettings>;
  now: number;
}): BackupFile {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: input.now,
    tasks: input.tasks,
    completions: input.completions,
    settings: input.settings,
  };
}

export function backupFileName(now: Date): string {
  return `remainder-backup-${dateKey(now)}.json`;
}

/** What a backup holds, for the confirmation dialog (soft-deleted rows aren't counted). */
export function summarizeBackup(b: BackupFile): { tasks: number; completions: number } {
  return {
    tasks: b.tasks.filter((t) => t.deletedAt === null).length,
    completions: b.completions.filter((c) => c.deletedAt === null).length,
  };
}

// ---- validation -------------------------------------------------------------

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

class Invalid extends Error {}
const fail = (msg: string): never => {
  throw new Invalid(msg);
};

function parseTask(raw: unknown, i: number): Task {
  const where = `Task #${i + 1}`;
  if (!isObj(raw)) return fail(`${where} is not an object`);
  if (!isStr(raw.id) || raw.id === '') fail(`${where} has no id`);
  if (!isStr(raw.title) || raw.title.trim() === '') fail(`${where} has no title`);
  if (!isStr(raw.timeOfDay) || !TIME.test(raw.timeOfDay)) fail(`${where} has an invalid time`);
  if (raw.alertType !== 'alarm' && raw.alertType !== 'notification') fail(`${where} has an invalid alert type`);
  if (!isBool(raw.enabled) || !isBool(raw.askFollowUp)) fail(`${where} has invalid flags`);
  if (!isNum(raw.createdAt) || !isNum(raw.updatedAt)) fail(`${where} has invalid timestamps`);
  if (raw.deletedAt !== null && !isNum(raw.deletedAt)) fail(`${where} has an invalid deletion time`);

  const r = raw.repeat;
  let repeat: Task['repeat'];
  if (isObj(r) && r.kind === 'once' && isStr(r.date) && DATE.test(r.date)) {
    repeat = { kind: 'once', date: r.date };
  } else if (
    isObj(r) &&
    r.kind === 'weekly' &&
    Array.isArray(r.days) &&
    r.days.every((d) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6)
  ) {
    repeat = { kind: 'weekly', days: [...new Set(r.days as number[])].sort() as Weekday[] };
  } else {
    return fail(`${where} has an invalid repeat rule`);
  }

  // Copy only known fields so unexpected keys in a hand-edited file never reach the database.
  return {
    id: raw.id as string,
    ownerId: isStr(raw.ownerId) ? raw.ownerId : '',
    title: (raw.title as string).trim(),
    notes: isStr(raw.notes) ? raw.notes : '',
    timeOfDay: raw.timeOfDay as string,
    timezone: isStr(raw.timezone) ? raw.timezone : 'UTC',
    repeat,
    alertType: raw.alertType as AlertType,
    // Optional (absent in older backups). Imported files can't travel between installs, so they're dropped.
    alarmSound: portableSound(parseAlarmSound(raw.alarmSound)),
    enabled: raw.enabled as boolean,
    askFollowUp: raw.askFollowUp as boolean,
    createdAt: raw.createdAt as number,
    updatedAt: raw.updatedAt as number,
    deletedAt: raw.deletedAt as number | null,
  };
}

function parseCompletion(raw: unknown, i: number): Completion {
  const where = `History entry #${i + 1}`;
  if (!isObj(raw)) return fail(`${where} is not an object`);
  if (!isStr(raw.id) || raw.id === '') fail(`${where} has no id`);
  if (!isStr(raw.taskId) || raw.taskId === '') fail(`${where} has no task`);
  if (!isStr(raw.date) || !DATE.test(raw.date)) fail(`${where} has an invalid date`);
  if (raw.status !== 'done' && raw.status !== 'skipped') fail(`${where} has an invalid status`);
  if (!isNum(raw.createdAt) || !isNum(raw.updatedAt)) fail(`${where} has invalid timestamps`);
  if (raw.deletedAt !== null && !isNum(raw.deletedAt)) fail(`${where} has an invalid deletion time`);
  return {
    id: raw.id as string,
    taskId: raw.taskId as string,
    date: raw.date as string,
    status: raw.status as Completion['status'],
    createdAt: raw.createdAt as number,
    updatedAt: raw.updatedAt as number,
    deletedAt: raw.deletedAt as number | null,
  };
}

/** Settings are non-critical: keep the valid fields, silently drop the rest. */
function parseSettings(raw: unknown): BackupSettings | undefined {
  if (!isObj(raw)) return undefined;
  const out: BackupSettings = {};
  if (raw.defaultAlertType === 'alarm' || raw.defaultAlertType === 'notification') {
    out.defaultAlertType = raw.defaultAlertType;
  }
  if (isNum(raw.followUpDelayMin) && raw.followUpDelayMin > 0) out.followUpDelayMin = raw.followUpDelayMin;
  if (raw.themeMode === 'system' || raw.themeMode === 'light' || raw.themeMode === 'dark') {
    out.themeMode = raw.themeMode;
  }
  const sound = portableSound(parseAlarmSound(raw.defaultAlarmSound));
  if (sound) out.defaultAlarmSound = sound;
  // A whole number of minutes in a sane range; anything else is ignored rather than trusted.
  if (isNum(raw.snoozeMinutes) && Number.isInteger(raw.snoozeMinutes) && raw.snoozeMinutes >= 1 && raw.snoozeMinutes <= 120) {
    out.snoozeMinutes = raw.snoozeMinutes;
  }
  return out;
}

/** Parses and validates backup text. Never throws; returns a user-readable error instead. */
export function parseBackup(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }

  try {
    if (!isObj(data) || data.app !== BACKUP_APP) {
      return { ok: false, error: 'This is not a Remainder backup file.' };
    }
    if (!isNum(data.version) || data.version < 1) return { ok: false, error: 'The backup has no valid version.' };
    if (data.version > BACKUP_VERSION) {
      return { ok: false, error: 'This backup was made by a newer version of the app. Update the app and try again.' };
    }
    if (!Array.isArray(data.tasks) || !Array.isArray(data.completions)) {
      return { ok: false, error: 'The backup is missing its tasks or history.' };
    }

    const tasks = data.tasks.map(parseTask);
    const completions = data.completions.map(parseCompletion);
    return {
      ok: true,
      backup: {
        app: BACKUP_APP,
        version: data.version,
        exportedAt: isNum(data.exportedAt) ? data.exportedAt : 0,
        tasks,
        completions,
        settings: parseSettings(data.settings),
      },
    };
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: e.message };
    throw e;
  }
}
