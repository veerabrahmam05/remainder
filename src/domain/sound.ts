import type { AlarmSound } from './types';

export const DEFAULT_SOUND: AlarmSound = { kind: 'default' };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** Validates untrusted data (database JSON, backup files) into an AlarmSound, or null if it isn't one. */
export function parseAlarmSound(raw: unknown): AlarmSound | null {
  if (!isObj(raw)) return null;
  if (raw.kind === 'default') return { kind: 'default' };
  if (raw.kind === 'system' && isNonEmpty(raw.uri) && raw.uri.startsWith('content://')) {
    return { kind: 'system', uri: raw.uri, title: isNonEmpty(raw.title) ? raw.title : 'Alarm tone' };
  }
  if (raw.kind === 'file' && isNonEmpty(raw.uri) && raw.uri.startsWith('file://')) {
    return { kind: 'file', uri: raw.uri, name: isNonEmpty(raw.name) ? raw.name : 'Audio file' };
  }
  return null;
}

/** URI handed to the native player, or null for "the phone's default alarm sound". */
export function soundUri(sound: AlarmSound | null | undefined): string | null {
  return sound && sound.kind !== 'default' ? sound.uri : null;
}

export function soundLabel(sound: AlarmSound | null | undefined): string {
  if (!sound || sound.kind === 'default') return 'Phone default';
  return sound.kind === 'system' ? sound.title : sound.name;
}

/**
 * Imported files live in this install's private storage, so a backup can't carry them to another
 * install. Keep system tones and the default; drop file sounds (the task falls back to the default).
 */
export function portableSound(sound: AlarmSound | null): AlarmSound | null {
  return sound && sound.kind === 'file' ? null : sound;
}
