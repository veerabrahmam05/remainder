import type { Task } from './types';

/**
 * How the system treats the app's background activity.
 *  - unrestricted: on the battery-exemption list.
 *  - optimized:    Android's default for almost every app. Exact alarms still ring on time.
 *  - restricted:   the system forbids background activity (or put the app in the restricted bucket),
 *                  so alarms can fail. The only state worth warning about.
 * Phone-maker switches such as auto-start can't be read by apps, so they aren't represented here.
 */
export type BatteryState = 'unrestricted' | 'optimized' | 'restricted';

/**
 * Whether to show the "allow unrestricted battery use" banner.
 * Only when the system is actually restricting the app (not for the harmless default), only when
 * something is scheduled, and never again after the user dismisses it. The Settings row is always there.
 */
export function shouldShowBatteryPrompt(input: {
  /** Null when the native module is missing (not an Android build, or an older build). */
  state: BatteryState | null;
  dismissed: boolean;
  hasActiveTasks: boolean;
}): boolean {
  return input.state === 'restricted' && !input.dismissed && input.hasActiveTasks;
}

/** A task that will actually fire: enabled and not deleted. */
export const hasActiveTasks = (tasks: Task[]): boolean => tasks.some((t) => t.enabled && t.deletedAt === null);
