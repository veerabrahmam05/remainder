import type { PendingAction } from '../../modules/alarm-scheduler';
import { completionRepo } from '../data/repositories';
import type { Settings } from '../data/settings';
import type { Task } from '../domain/types';
import { buildEntries } from './entries';
import { getNative } from './native';

/** Pushes the full schedule to the native layer. Safe to call often; it replaces the previous set. */
export async function syncAlarms(tasks: Task[], settings: Settings): Promise<void> {
  const native = getNative();
  if (!native) return;
  try {
    await native.sync(buildEntries(tasks, settings));
  } catch (e) {
    console.warn('syncAlarms failed:', e);
  }
}

/**
 * Applies done/skip actions taken from notifications or the alarm screen while the app wasn't running.
 * Returns true if anything changed (caller should refresh).
 */
export async function applyPendingActions(): Promise<boolean> {
  const native = getNative();
  if (!native) return false;
  let actions: PendingAction[];
  try {
    actions = JSON.parse(await native.drainActions()) as PendingAction[];
  } catch (e) {
    console.warn('drainActions failed:', e);
    return false;
  }
  // Oldest first so the latest action for a given occurrence wins.
  for (const a of [...actions].sort((x, y) => x.at - y.at)) {
    await completionRepo.set(a.taskId, a.date, a.type);
  }
  return actions.length > 0;
}

/** Tells native an occurrence is resolved so its alarm / follow-up stay quiet and notifications clear. */
export async function markResolved(taskId: string, date: string): Promise<void> {
  try {
    await getNative()?.markResolved(taskId, date);
  } catch (e) {
    console.warn('markResolved failed:', e);
  }
}

export async function clearResolved(taskId: string, date: string): Promise<void> {
  try {
    await getNative()?.clearResolved(taskId, date);
  } catch (e) {
    console.warn('clearResolved failed:', e);
  }
}
