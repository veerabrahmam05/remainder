import type { AlarmEntry } from '../../modules/alarm-scheduler';
import type { Settings } from '../data/settings';
import { daysToMask, parseTime } from '../domain/schedule';
import type { Task } from '../domain/types';

/** Native entries for every enabled task: the main alert, plus an optional follow-up prompt. */
export function buildEntries(tasks: Task[], settings: Settings): AlarmEntry[] {
  const entries: AlarmEntry[] = [];

  for (const task of tasks) {
    if (!task.enabled || task.deletedAt !== null) continue;
    const { hour, minute } = parseTime(task.timeOfDay);
    const schedule = {
      hour,
      minute,
      daysMask: task.repeat.kind === 'weekly' ? daysToMask(task.repeat.days) : 0,
      onceDate: task.repeat.kind === 'once' ? task.repeat.date : null,
    };

    // A weekly task with no days would never fire; native treats mask 0 as one-off, so skip it.
    if (task.repeat.kind === 'weekly' && schedule.daysMask === 0) continue;

    entries.push({
      key: `${task.id}:main`,
      taskId: task.id,
      kind: task.alertType,
      title: task.title,
      body: task.notes || 'Time for your routine',
      offsetMin: 0,
      ...schedule,
    });

    if (task.askFollowUp) {
      entries.push({
        key: `${task.id}:followup`,
        taskId: task.id,
        kind: 'followup',
        title: 'Did you do it?',
        body: task.title,
        offsetMin: settings.followUpDelayMin,
        ...schedule,
      });
    }
  }

  return entries;
}
