import * as Crypto from 'expo-crypto';
import { getDb } from './db';

/**
 * Local identity. When accounts arrive, this id becomes (or is linked to) the cloud user id,
 * so every row already has a valid ownerId.
 */
export async function getLocalUserId(): Promise<string> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'local_user_id'",
  );
  if (row) return row.value;
  const id = Crypto.randomUUID();
  await db.runAsync("INSERT INTO settings (key, value) VALUES ('local_user_id', ?)", id);
  return id;
}
