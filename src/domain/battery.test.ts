import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasActiveTasks, shouldShowBatteryPrompt, type BatteryState } from './battery';
import type { Task } from './types';

const base = { state: 'restricted' as BatteryState | null, dismissed: false, hasActiveTasks: true };

test('shows only when the system is actually restricting the app', () => {
  assert.equal(shouldShowBatteryPrompt(base), true);
});

test('does not nag for the harmless default ("optimized"), which is what most apps are in', () => {
  assert.equal(shouldShowBatteryPrompt({ ...base, state: 'optimized' }), false);
});

test('hides once the app is unrestricted', () => {
  assert.equal(shouldShowBatteryPrompt({ ...base, state: 'unrestricted' }), false);
});

test('hides when the native module is unavailable (not an Android build, or an older build)', () => {
  assert.equal(shouldShowBatteryPrompt({ ...base, state: null }), false);
});

test('hides after the user dismisses it', () => {
  assert.equal(shouldShowBatteryPrompt({ ...base, dismissed: true }), false);
});

test('hides when there is nothing scheduled to be affected', () => {
  assert.equal(shouldShowBatteryPrompt({ ...base, hasActiveTasks: false }), false);
});

test('only enabled, undeleted tasks count as active', () => {
  const task = (over: Partial<Task>): Task => ({
    id: 't',
    ownerId: 'u',
    title: 'x',
    notes: '',
    timeOfDay: '07:00',
    timezone: 'UTC',
    repeat: { kind: 'weekly', days: [1] },
    alertType: 'alarm',
    alarmSound: null,
    enabled: true,
    askFollowUp: true,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    ...over,
  });
  assert.equal(hasActiveTasks([]), false);
  assert.equal(hasActiveTasks([task({ enabled: false })]), false);
  assert.equal(hasActiveTasks([task({ deletedAt: 5 })]), false);
  assert.equal(hasActiveTasks([task({ enabled: false }), task({})]), true);
});
