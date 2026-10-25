import type { AlertType } from '../domain/types';
import { getDb } from './db';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Settings {
  defaultAlertType: AlertType;
  /** Minutes after a task's time at which the "did you do it?" prompt fires. */
  followUpDelayMin: number;
  themeMode: ThemeMode;
}

export const DEFAULT_SETTINGS: Settings = {
  defaultAlertType: 'notification',
  followUpDelayMin: 60,
  themeMode: 'system',
};

export const FOLLOW_UP_DELAY_OPTIONS = [15, 30, 60, 120, 240];

export async function loadSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    "SELECT key, value FROM settings WHERE key IN ('default_alert_type', 'follow_up_delay_min', 'theme_mode')",
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const alert = map.get('default_alert_type');
  const delay = Number(map.get('follow_up_delay_min'));
  const theme = map.get('theme_mode');
  return {
    defaultAlertType: alert === 'alarm' || alert === 'notification' ? alert : DEFAULT_SETTINGS.defaultAlertType,
    followUpDelayMin: Number.isFinite(delay) && delay > 0 ? delay : DEFAULT_SETTINGS.followUpDelayMin,
    themeMode: theme === 'light' || theme === 'dark' || theme === 'system' ? theme : DEFAULT_SETTINGS.themeMode,
  };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const db = await getDb();
  const put = (key: string, value: string) =>
    db.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      value,
    );
  if (patch.defaultAlertType) await put('default_alert_type', patch.defaultAlertType);
  if (patch.followUpDelayMin) await put('follow_up_delay_min', String(patch.followUpDelayMin));
  if (patch.themeMode) await put('theme_mode', patch.themeMode);
}
