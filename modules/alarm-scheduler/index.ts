import { requireNativeModule } from 'expo';

export type AlarmKind = 'alarm' | 'notification' | 'followup';

/** One scheduled reminder. daysMask: bit 0 = Sunday ... bit 6 = Saturday; 0 means one-off on `onceDate`. */
export interface AlarmEntry {
  key: string;
  taskId: string;
  kind: AlarmKind;
  title: string;
  body: string;
  hour: number;
  minute: number;
  daysMask: number;
  onceDate: string | null;
  offsetMin: number;
  /** Alarm sound URI (content:// or file://). null = the phone's default alarm sound. Alarms only. */
  sound: string | null;
  /** Minutes the alarm's Snooze button delays it. Alarms only. */
  snoozeMin: number;
}

export type PendingActionType = 'done' | 'skipped';

export interface PendingAction {
  type: PendingActionType;
  taskId: string;
  date: string;
  at: number;
}

/** A tone from the phone's alarm sound list. */
export interface SystemSound {
  title: string;
  uri: string;
}

interface AlarmSchedulerNative {
  sync(entries: AlarmEntry[]): Promise<void>;
  drainActions(): Promise<string>;
  markResolved(taskId: string, date: string): Promise<void>;
  clearResolved(taskId: string, date: string): Promise<void>;
  scheduleTest(
    kind: 'alarm' | 'notification',
    seconds: number,
    sound: string | null,
    snoozeMin: number,
  ): Promise<void>;
  /** The phone's alarm tones, for the in-app sound picker. */
  listAlarmSounds(): Promise<SystemSound[]>;
  /** Title of the phone's default alarm sound, e.g. "Cesium". */
  defaultAlarmSoundTitle(): string;
  /** Plays a short preview on the alarm volume. Resolves false if the sound can't be played. */
  previewSound(uri: string | null): Promise<boolean>;
  stopPreview(): void;
  canScheduleExactAlarms(): boolean;
  areNotificationsEnabled(): boolean;
  canUseFullScreenIntent(): boolean;
  openExactAlarmSettings(): void;
  openFullScreenIntentSettings(): void;
  openNotificationSettings(): void;
}

export default requireNativeModule<AlarmSchedulerNative>('AlarmScheduler');
