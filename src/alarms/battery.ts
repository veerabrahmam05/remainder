import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { BatteryState } from '../domain/battery';
import { getNative } from './native';

/** Null when the status can't be read (not Android, or an installed build from before this feature). */
function readBattery(): BatteryState | null {
  const native = getNative();
  if (!native) return null;
  try {
    return native.batteryState();
  } catch {
    return null;
  }
}

/** Battery state that re-reads itself when the app returns to the foreground (e.g. from the system dialog). */
export function useBatteryState(): { state: BatteryState | null; refresh: () => void } {
  const [state, setState] = useState<BatteryState | null>(readBattery);
  const refresh = useCallback(() => setState(readBattery()), []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  return { state, refresh };
}

export function requestBatteryExemption(): void {
  try {
    getNative()?.requestIgnoreBatteryOptimizations();
  } catch (e) {
    console.warn('requestBatteryExemption failed:', e);
  }
}

export function openAppSettings(): void {
  try {
    getNative()?.openAppSettings();
  } catch (e) {
    console.warn('openAppSettings failed:', e);
  }
}
