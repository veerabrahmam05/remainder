import type { BackupFile } from '../domain/backup';
import { daysToMask } from '../domain/schedule';
import type { Completion, Task } from '../domain/types';
import { getDb } from './db';
import { toCompletion, toTask, type CompletionRow, type TaskRow } from './repositories';

/** Every row for export, including soft-deleted ones, so deletions survive a restore. */
export async function readAllForBackup(ownerId: string): Promise<{ tasks: Task[]; completions: Completion[] }> {
  const db = await getDb();
  const taskRows = await db.getAllAsync<TaskRow>(
    'SELECT * FROM tasks WHERE owner_id = ? ORDER BY created_at',
    ownerId,
  );
  const ids = new Set(taskRows.map((r) => r.id));
  const completionRows = await db.getAllAsync<CompletionRow>('SELECT * FROM completions ORDER BY date');
  return {
    tasks: taskRows.map(toTask),
    completions: completionRows.filter((r) => ids.has(r.task_id)).map(toCompletion),
  };
}

export interface MergeResult {
  tasksAdded: number;
  tasksUpdated: number;
  completionsAdded: number;
  completionsUpdated: number;
}

/**
 * Merges a backup into the local database, all-or-nothing.
 *  - Rows are matched by id (tasks) or by task + date (history).
 *  - A row that exists locally is replaced only if the backup copy is newer (`updatedAt`),
 *    so restoring an old backup never overwrites newer edits.
 *  - Tasks are re-owned by the current local user: after a reinstall the local user id is
 *    new, and tasks owned by the old id would otherwise be invisible.
 */
export async function mergeBackup(backup: BackupFile, ownerId: string): Promise<MergeResult> {
  const db = await getDb();
  const result: MergeResult = { tasksAdded: 0, tasksUpdated: 0, completionsAdded: 0, completionsUpdated: 0 };

  await db.withTransactionAsync(async () => {
    const localTasks = new Map(
      (await db.getAllAsync<{ id: string; updated_at: number }>('SELECT id, updated_at FROM tasks')).map((r) => [
        r.id,
        r.updated_at,
      ]),
    );

    for (const t of backup.tasks) {
      const local = localTasks.get(t.id);
      if (local === undefined) result.tasksAdded++;
      else if (t.updatedAt > local) result.tasksUpdated++;
      else continue; // local copy is as new or newer

      await db.runAsync(
        `INSERT INTO tasks (id, owner_id, title, notes, time_of_day, timezone, repeat_kind, once_date,
           days_mask, alert_type, enabled, ask_follow_up, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET owner_id = excluded.owner_id, title = excluded.title,
           notes = excluded.notes, time_of_day = excluded.time_of_day, timezone = excluded.timezone,
           repeat_kind = excluded.repeat_kind, once_date = excluded.once_date, days_mask = excluded.days_mask,
           alert_type = excluded.alert_type, enabled = excluded.enabled, ask_follow_up = excluded.ask_follow_up,
           updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`,
        t.id,
        ownerId,
        t.title,
        t.notes,
        t.timeOfDay,
        t.timezone,
        t.repeat.kind,
        t.repeat.kind === 'once' ? t.repeat.date : null,
        t.repeat.kind === 'weekly' ? daysToMask(t.repeat.days) : 0,
        t.alertType,
        t.enabled ? 1 : 0,
        t.askFollowUp ? 1 : 0,
        t.createdAt,
        t.updatedAt,
        t.deletedAt,
      );
    }

    const localCompletions = new Map(
      (
        await db.getAllAsync<{ task_id: string; date: string; updated_at: number }>(
          'SELECT task_id, date, updated_at FROM completions',
        )
      ).map((r) => [`${r.task_id}|${r.date}`, r.updated_at]),
    );

    for (const c of backup.completions) {
      const local = localCompletions.get(`${c.taskId}|${c.date}`);
      if (local === undefined) result.completionsAdded++;
      else if (c.updatedAt > local) result.completionsUpdated++;
      else continue;

      await db.runAsync(
        `INSERT INTO completions (id, task_id, date, status, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(task_id, date) DO UPDATE SET status = excluded.status,
           updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`,
        c.id,
        c.taskId,
        c.date,
        c.status,
        c.createdAt,
        c.updatedAt,
        c.deletedAt,
      );
    }
  });

  return result;
}
