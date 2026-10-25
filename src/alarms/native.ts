import { Platform } from 'react-native';
import type { AlarmEntry } from '../../modules/alarm-scheduler';

type NativeModule = typeof import('../../modules/alarm-scheduler').default;

/**
 * Safe accessor for the native alarm module. Returns null off-Android or when the dev build
 * doesn't include the module yet, so the rest of the app keeps working (alarms just don't fire).
 */
let cached: NativeModule | null | undefined;

export function getNative(): NativeModule | null {
  if (cached !== undefined) return cached;
  if (Platform.OS !== 'android') {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('../../modules/alarm-scheduler').default as NativeModule;
  } catch (e) {
    console.warn('AlarmScheduler native module unavailable:', e);
    cached = null;
  }
  return cached;
}

export type { AlarmEntry };
