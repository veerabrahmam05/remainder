import { DEFAULT_SOUND, parseAlarmSound } from '../domain/sound';
import type { AlarmSound, AlertType } from '../domain/types';
import { getDb } from './db';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Settings {
  defaultAlertType: AlertType;
  /** Minutes after a task's time at which the "did you do it?" prompt fires. */
  followUpDelayMin: number;
  themeMode: ThemeMode;
  /** Sound for alarms that don't set their own. */
  defaultAlarmSound: AlarmSound;
  /** How long the alarm's Snooze button delays it, in minutes. */
  snoozeMinutes: number;
}

export const DEFAULT_SETTINGS: Settings = {
  defaultAlertType: 'notification',
  followUpDelayMin: 60,
  themeMode: 'system',
  defaultAlarmSound: DEFAULT_SOUND,
  snoozeMinutes: 10,
};

export const FOLLOW_UP_DELAY_OPTIONS = [15, 30, 60, 120, 240];
export const SNOOZE_OPTIONS = [5, 10, 15, 20, 30];

function readSoundSetting(json: string | undefined): AlarmSound {
  if (!json) return DEFAULT_SOUND;
  try {
    return parseAlarmSound(JSON.parse(json)) ?? DEFAULT_SOUND;
  } catch {
    return DEFAULT_SOUND;
  }
}

export async function loadSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings
     WHERE key IN ('default_alert_type', 'follow_up_delay_min', 'theme_mode', 'default_alarm_sound', 'snooze_minutes')`,
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const alert = map.get('default_alert_type');
  const delay = Number(map.get('follow_up_delay_min'));
  const theme = map.get('theme_mode');
  const snooze = Number(map.get('snooze_minutes'));
  return {
    defaultAlertType: alert === 'alarm' || alert === 'notification' ? alert : DEFAULT_SETTINGS.defaultAlertType,
    followUpDelayMin: Number.isFinite(delay) && delay > 0 ? delay : DEFAULT_SETTINGS.followUpDelayMin,
    themeMode: theme === 'light' || theme === 'dark' || theme === 'system' ? theme : DEFAULT_SETTINGS.themeMode,
    defaultAlarmSound: readSoundSetting(map.get('default_alarm_sound')),
    snoozeMinutes: Number.isInteger(snooze) && snooze > 0 ? snooze : DEFAULT_SETTINGS.snoozeMinutes,
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
  if (patch.defaultAlarmSound) await put('default_alarm_sound', JSON.stringify(patch.defaultAlarmSound));
  if (patch.snoozeMinutes) await put('snooze_minutes', String(patch.snoozeMinutes));
}
