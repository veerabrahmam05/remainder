import { create } from 'zustand';
import { applyPendingActions, clearResolved, markResolved, syncAlarms } from '../alarms/service';
import { completionRepo, taskRepo } from '../data/repositories';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '../data/settings';
import { getLocalUserId } from '../data/user';
import { dateKey } from '../domain/schedule';
import type { Completion, CompletionStatus, NewTask, Task } from '../domain/types';
import { applyThemeMode } from '../ui/appearance';

interface AppState {
  ready: boolean;
  userId: string;
  today: string;
  tasks: Task[];
  completions: Completion[];
  settings: Settings;

  init(): Promise<void>;
  /** Reloads data (and applies actions taken from notifications). Call when the app returns to foreground. */
  refresh(): Promise<void>;
  saveTask(input: Omit<NewTask, 'ownerId'>, id?: string): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  setEnabled(id: string, enabled: boolean): Promise<void>;
  /** status = null clears the occurrence back to pending/missed. */
  setStatus(taskId: string, date: string, status: CompletionStatus | null): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  disableFollowUp(taskId: string): Promise<void>;
}

export const useApp = create<AppState>((set, get) => {
  const reload = async () => {
    const { userId } = get();
    const [tasks, completions] = await Promise.all([
      taskRepo.list(userId),
      completionRepo.forRange('0000-01-01', '9999-12-31'),
    ]);
    set({ tasks, completions, today: dateKey(new Date()) });
  };

  const resync = () => syncAlarms(get().tasks, get().settings);

  return {
    ready: false,
    userId: '',
    today: dateKey(new Date()),
    tasks: [],
    completions: [],
    settings: DEFAULT_SETTINGS,

    async init() {
      const [userId, settings] = await Promise.all([getLocalUserId(), loadSettings()]);
      set({ userId, settings });
      applyThemeMode(settings.themeMode);
      await applyPendingActions();
      await reload();
      set({ ready: true });
      await resync();
    },

    async refresh() {
      if (!get().ready) return;
      await applyPendingActions();
      await reload();
    },

    async saveTask(input, id) {
      const { userId } = get();
      const saved = id
        ? await taskRepo.update(id, input)
        : await taskRepo.create({ ...input, ownerId: userId });
      await reload();
      await resync();
      return saved;
    },

    async deleteTask(id) {
      await taskRepo.remove(id);
      await reload();
      await resync();
    },

    async setEnabled(id, enabled) {
      await taskRepo.update(id, { enabled });
      await reload();
      await resync();
    },

    async setStatus(taskId, date, status) {
      if (status === null) {
        await completionRepo.clear(taskId, date);
        await clearResolved(taskId, date);
      } else {
        await completionRepo.set(taskId, date, status);
        await markResolved(taskId, date);
      }
      await reload();
    },

    async updateSettings(patch) {
      await saveSettings(patch);
      set({ settings: { ...get().settings, ...patch } });
      if (patch.themeMode) applyThemeMode(patch.themeMode);
      await resync();
    },

    async disableFollowUp(taskId) {
      await taskRepo.update(taskId, { askFollowUp: false });
      await reload();
      await resync();
    },
  };
});
