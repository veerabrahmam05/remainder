import { parseDateKey, parseTime } from '../domain/schedule';

export function formatTime(hhmm: string): string {
  const { hour, minute } = parseTime(hhmm);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDate(key: string): string {
  return parseDateKey(key).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function toHHmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function timeToDate(hhmm: string): Date {
  const { hour, minute } = parseTime(hhmm);
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}
