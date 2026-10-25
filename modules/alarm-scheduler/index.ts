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
}

export type PendingActionType = 'done' | 'skipped';

export interface PendingAction {
  type: PendingActionType;
  taskId: string;
  date: string;
  at: number;
}

interface AlarmSchedulerNative {
  sync(entries: AlarmEntry[]): Promise<void>;
  drainActions(): Promise<string>;
  markResolved(taskId: string, date: string): Promise<void>;
  clearResolved(taskId: string, date: string): Promise<void>;
  scheduleTest(kind: 'alarm' | 'notification', seconds: number): Promise<void>;
  canScheduleExactAlarms(): boolean;
  areNotificationsEnabled(): boolean;
  canUseFullScreenIntent(): boolean;
  openExactAlarmSettings(): void;
  openFullScreenIntentSettings(): void;
  openNotificationSettings(): void;
}

export default requireNativeModule<AlarmSchedulerNative>('AlarmScheduler');
