import * as SQLite from 'expo-sqlite';

// Ordered migrations; index + 1 is the schema version stored in PRAGMA user_version.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE tasks (
    id            TEXT PRIMARY KEY NOT NULL,
    owner_id      TEXT NOT NULL,
    title         TEXT NOT NULL,
    notes         TEXT NOT NULL DEFAULT '',
    time_of_day   TEXT NOT NULL,
    timezone      TEXT NOT NULL,
    repeat_kind   TEXT NOT NULL CHECK (repeat_kind IN ('once','weekly')),
    once_date     TEXT,
    days_mask     INTEGER NOT NULL DEFAULT 0,
    alert_type    TEXT NOT NULL CHECK (alert_type IN ('alarm','notification')),
    enabled       INTEGER NOT NULL DEFAULT 1,
    ask_follow_up INTEGER NOT NULL DEFAULT 1,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    deleted_at    INTEGER
  );
  CREATE INDEX idx_tasks_owner ON tasks(owner_id, deleted_at);

  CREATE TABLE completions (
    id         TEXT PRIMARY KEY NOT NULL,
    task_id    TEXT NOT NULL,
    date       TEXT NOT NULL,
    status     TEXT NOT NULL CHECK (status IN ('done','skipped')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE UNIQUE INDEX idx_completions_task_date ON completions(task_id, date);
  CREATE INDEX idx_completions_date ON completions(date);

  CREATE TABLE settings (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
  // v2: per-task alarm sound (JSON, NULL = use the global default)
  `ALTER TABLE tasks ADD COLUMN alarm_sound TEXT;`,
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = open();
  return dbPromise;
}

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('remainder.db');
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
    version += 1;
  }
  return db;
}
