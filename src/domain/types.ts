export type AlertType = 'alarm' | 'notification';

/** 0 = Sunday ... 6 = Saturday (matches Date.getDay()). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Repeat =
  | { kind: 'once'; date: string } // 'YYYY-MM-DD' local date
  | { kind: 'weekly'; days: Weekday[] }; // daily / weekdays / weekends / custom

export type CompletionStatus = 'done' | 'skipped';

/**
 * What an alarm plays.
 *  - default: the phone's default alarm sound
 *  - system:  one of the phone's alarm tones (content:// URI, may not exist on another phone)
 *  - file:    an audio file the user imported, copied into the app's own storage
 */
export type AlarmSound =
  | { kind: 'default' }
  | { kind: 'system'; uri: string; title: string }
  | { kind: 'file'; uri: string; name: string };

/** Fields every synced row carries. Soft-delete only, so a future sync can propagate deletes. */
export interface SyncMeta {
  id: string; // UUID
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
  deletedAt: number | null;
}

export interface Task extends SyncMeta {
  ownerId: string;
  title: string;
  notes: string;
  timeOfDay: string; // 'HH:mm' local wall-clock
  timezone: string; // IANA tz the task was created in
  repeat: Repeat;
  alertType: AlertType;
  /** Sound for this task's alarm. null = use the global default from Settings. Alarms only. */
  alarmSound: AlarmSound | null;
  enabled: boolean;
  askFollowUp: boolean; // "did you do it?" prompt; false once user opts out
}

export interface Completion extends SyncMeta {
  taskId: string;
  date: string; // 'YYYY-MM-DD' occurrence date
  status: CompletionStatus;
}

export type OccurrenceStatus = CompletionStatus | 'pending' | 'missed';

export type NewTask = Omit<Task, keyof SyncMeta>;
