export type AlertType = 'alarm' | 'notification';

/** 0 = Sunday ... 6 = Saturday (matches Date.getDay()). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Repeat =
  | { kind: 'once'; date: string } // 'YYYY-MM-DD' local date
  | { kind: 'weekly'; days: Weekday[] }; // daily / weekdays / weekends / custom

export type CompletionStatus = 'done' | 'skipped';

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
