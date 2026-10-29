import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { readAllForBackup } from '../data/backup';
import { backupFileName, buildBackup, parseBackup, type BackupFile } from '../domain/backup';
import { useApp } from '../store/app';

// A real backup is a few hundred KB at most; refuse anything absurd before reading it into memory.
const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

/** Writes the backup to a temporary file and opens the system share sheet (Drive, Files, chat...). */
export async function exportBackup(): Promise<{ tasks: number; completions: number }> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');

  const { userId, settings } = useApp.getState();
  const { tasks, completions } = await readAllForBackup(userId);
  const backup = buildBackup({
    tasks,
    completions,
    settings: {
      defaultAlertType: settings.defaultAlertType,
      followUpDelayMin: settings.followUpDelayMin,
      themeMode: settings.themeMode,
      defaultAlarmSound: settings.defaultAlarmSound,
      snoozeMinutes: settings.snoozeMinutes,
    },
    now: Date.now(),
  });

  const file = new File(Paths.cache, backupFileName(new Date()));
  file.create({ overwrite: true });
  await file.write(JSON.stringify(backup, null, 2));

  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save Remainder backup' });
  return { tasks: tasks.filter((t) => t.deletedAt === null).length, completions: completions.length };
}

export type PickResult =
  | { kind: 'canceled' }
  | { kind: 'error'; error: string }
  | { kind: 'ok'; backup: BackupFile; fileName: string };

/** Lets the user choose a backup file, then reads and validates it. Nothing is changed yet. */
export async function pickBackup(): Promise<PickResult> {
  // Any file type: Android labels .json inconsistently (json / octet-stream / text), so we
  // validate the content instead of trusting the MIME type.
  const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (picked.canceled) return { kind: 'canceled' };

  const asset = picked.assets[0];
  if (asset.size !== undefined && asset.size > MAX_BACKUP_BYTES) {
    return { kind: 'error', error: 'That file is too large to be a Remainder backup.' };
  }

  let text: string;
  try {
    text = await new File(asset.uri).text();
  } catch {
    return { kind: 'error', error: 'Could not read that file.' };
  }

  const parsed = parseBackup(text);
  if (!parsed.ok) return { kind: 'error', error: parsed.error };
  return { kind: 'ok', backup: parsed.backup, fileName: asset.name };
}
