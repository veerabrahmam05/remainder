import * as Crypto from 'expo-crypto';
import { daysToMask, maskToDays } from '../domain/schedule';
import type { Completion, CompletionStatus, NewTask, Task } from '../domain/types';
import { getDb } from './db';

/**
 * Repository interfaces are the only thing UI/services depend on.
 * A cloud-backed implementation can replace the SQLite ones without touching callers.
 */
export interface TaskRepository {
  list(ownerId: string): Promise<Task[]>;
  get(id: string): Promise<Task | null>;
  create(input: NewTask): Promise<Task>;
  update(id: string, patch: Partial<NewTask>): Promise<Task>;
  remove(id: string): Promise<void>; // soft delete
}

export interface CompletionRepository {
  forDate(date: string): Promise<Completion[]>;
  forRange(from: string, to: string): Promise<Completion[]>;
  set(taskId: string, date: string, status: CompletionStatus): Promise<Completion>;
  clear(taskId: string, date: string): Promise<void>;
}

// ---- row mapping -----------------------------------------------------------

interface TaskRow {
  id: string;
  owner_id: string;
  title: string;
  notes: string;
  time_of_day: string;
  timezone: string;
  repeat_kind: 'once' | 'weekly';
  once_date: string | null;
  days_mask: number;
  alert_type: 'alarm' | 'notification';
  enabled: number;
  ask_follow_up: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

function toTask(r: TaskRow): Task {
  return {
    id: r.id,
    ownerId: r.owner_id,
    title: r.title,
    notes: r.notes,
    timeOfDay: r.time_of_day,
    timezone: r.timezone,
    repeat:
      r.repeat_kind === 'once'
        ? { kind: 'once', date: r.once_date as string }
        : { kind: 'weekly', days: maskToDays(r.days_mask) },
    alertType: r.alert_type,
    enabled: r.enabled === 1,
    askFollowUp: r.ask_follow_up === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

interface CompletionRow {
  id: string;
  task_id: string;
  date: string;
  status: CompletionStatus;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

const toCompletion = (r: CompletionRow): Completion => ({
  id: r.id,
  taskId: r.task_id,
  date: r.date,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deletedAt: r.deleted_at,
});

// ---- SQLite implementations ------------------------------------------------

export const taskRepo: TaskRepository = {
  async list(ownerId) {
    const db = await getDb();
    const rows = await db.getAllAsync<TaskRow>(
      'SELECT * FROM tasks WHERE owner_id = ? AND deleted_at IS NULL ORDER BY time_of_day, title',
      ownerId,
    );
    return rows.map(toTask);
  },

  async get(id) {
    const db = await getDb();
    const row = await db.getFirstAsync<TaskRow>(
      'SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL',
      id,
    );
    return row ? toTask(row) : null;
  },

  async create(input) {
    const db = await getDb();
    const now = Date.now();
    const id = Crypto.randomUUID();
    await db.runAsync(
      `INSERT INTO tasks (id, owner_id, title, notes, time_of_day, timezone, repeat_kind, once_date,
         days_mask, alert_type, enabled, ask_follow_up, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.ownerId,
      input.title,
      input.notes,
      input.timeOfDay,
      input.timezone,
      input.repeat.kind,
      input.repeat.kind === 'once' ? input.repeat.date : null,
      input.repeat.kind === 'weekly' ? daysToMask(input.repeat.days) : 0,
      input.alertType,
      input.enabled ? 1 : 0,
      input.askFollowUp ? 1 : 0,
      now,
      now,
    );
    return (await this.get(id)) as Task;
  },

  async update(id, patch) {
    const current = await this.get(id);
    if (!current) throw new Error(`Task ${id} not found`);
    const next: Task = { ...current, ...patch, updatedAt: Date.now() };
    const db = await getDb();
    await db.runAsync(
      `UPDATE tasks SET title = ?, notes = ?, time_of_day = ?, timezone = ?, repeat_kind = ?,
         once_date = ?, days_mask = ?, alert_type = ?, enabled = ?, ask_follow_up = ?, updated_at = ?
       WHERE id = ?`,
      next.title,
      next.notes,
      next.timeOfDay,
      next.timezone,
      next.repeat.kind,
      next.repeat.kind === 'once' ? next.repeat.date : null,
      next.repeat.kind === 'weekly' ? daysToMask(next.repeat.days) : 0,
      next.alertType,
      next.enabled ? 1 : 0,
      next.askFollowUp ? 1 : 0,
      next.updatedAt,
      id,
    );
    return next;
  },

  async remove(id) {
    const db = await getDb();
    const now = Date.now();
    await db.runAsync('UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?', now, now, id);
  },
};

export const completionRepo: CompletionRepository = {
  async forDate(date) {
    return this.forRange(date, date);
  },

  async forRange(from, to) {
    const db = await getDb();
    const rows = await db.getAllAsync<CompletionRow>(
      'SELECT * FROM completions WHERE date >= ? AND date <= ? AND deleted_at IS NULL',
      from,
      to,
    );
    return rows.map(toCompletion);
  },

  async set(taskId, date, status) {
    const db = await getDb();
    const now = Date.now();
    // Upsert on (task_id, date); revives a soft-deleted row.
    await db.runAsync(
      `INSERT INTO completions (id, task_id, date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(task_id, date) DO UPDATE SET status = excluded.status,
         updated_at = excluded.updated_at, deleted_at = NULL`,
      Crypto.randomUUID(),
      taskId,
      date,
      status,
      now,
      now,
    );
    const row = await db.getFirstAsync<CompletionRow>(
      'SELECT * FROM completions WHERE task_id = ? AND date = ?',
      taskId,
      date,
    );
    return toCompletion(row as CompletionRow);
  },

  async clear(taskId, date) {
    const db = await getDb();
    const now = Date.now();
    await db.runAsync(
      'UPDATE completions SET deleted_at = ?, updated_at = ? WHERE task_id = ? AND date = ?',
      now,
      now,
      taskId,
      date,
    );
  },
};
