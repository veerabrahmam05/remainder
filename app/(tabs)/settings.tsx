import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, ScrollView, StyleSheet, View } from 'react-native';
import { getNative } from '../../src/alarms/native';
import { FOLLOW_UP_DELAY_OPTIONS, type ThemeMode } from '../../src/data/settings';
import { useApp } from '../../src/store/app';
import { Button, Card, Chip, SectionTitle } from '../../src/ui/components';
import { Text } from '../../src/ui/Text';
import { useTheme } from '../../src/ui/theme';

interface PermissionState {
  available: boolean;
  notifications: boolean;
  exactAlarms: boolean;
  fullScreen: boolean;
}

function readPermissions(): PermissionState {
  const native = getNative();
  if (!native) return { available: false, notifications: false, exactAlarms: false, fullScreen: false };
  return {
    available: true,
    notifications: native.areNotificationsEnabled(),
    exactAlarms: native.canScheduleExactAlarms(),
    fullScreen: native.canUseFullScreenIntent(),
  };
}

const THEME_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
];

const delayLabel =(min: number) => (min < 60 ? `${min} min` : `${min / 60} h`);

export default function SettingsScreen() {
  const t = useTheme();
  const { settings, updateSettings } = useApp();
  const [perms, setPerms] = useState<PermissionState>(readPermissions);

  const refreshPerms = useCallback(() => setPerms(readPermissions()), []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refreshPerms());
    return () => sub.remove();
  }, [refreshPerms]);

  const native = getNative();

  const test = async (kind: 'alarm' | 'notification') => {
    try {
      await native?.scheduleTest(kind, 10);
      Alert.alert('Scheduled', `A test ${kind} will fire in 10 seconds. Lock your phone to test the lock screen.`);
    } catch (e) {
      Alert.alert('Could not schedule', String(e));
    }
  };

  const PermissionRow = ({
    label,
    ok,
    hint,
    onFix,
  }: {
    label: string;
    ok: boolean;
    hint: string;
    onFix: () => void;
  }) => (
    <View style={styles.permRow}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontWeight: '700' }}>
          {label} <Text style={{ color: ok ? t.done : t.missed }}>{ok ? '✓ Allowed' : '✗ Not allowed'}</Text>
        </Text>
        <Text style={{ color: t.muted, marginTop: 2 }}>{hint}</Text>
      </View>
      {ok ? null : <Chip label="Fix" selected={false} onPress={onFix} />}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionTitle>Appearance</SectionTitle>
      <View style={styles.wrap}>
        {THEME_OPTIONS.map((o) => (
          <Chip
            key={o.mode}
            label={o.label}
            selected={settings.themeMode === o.mode}
            onPress={() => updateSettings({ themeMode: o.mode })}
          />
        ))}
      </View>
      <Text style={{ color: t.muted, marginTop: 8 }}>“System” follows your phone’s light / dark setting.</Text>

      <SectionTitle>Default alert type</SectionTitle>
      <View style={styles.wrap}>
        <Chip
          label="Alarm"
          selected={settings.defaultAlertType === 'alarm'}
          onPress={() => updateSettings({ defaultAlertType: 'alarm' })}
        />
        <Chip
          label="Notification"
          selected={settings.defaultAlertType === 'notification'}
          onPress={() => updateSettings({ defaultAlertType: 'notification' })}
        />
      </View>
      <Text style={{ color: t.muted, marginTop: 8 }}>Used for new tasks. Each task can override it.</Text>

      <SectionTitle>“Did you do it?” prompt</SectionTitle>
      <View style={styles.wrap}>
        {FOLLOW_UP_DELAY_OPTIONS.map((m) => (
          <Chip
            key={m}
            label={delayLabel(m)}
            selected={settings.followUpDelayMin === m}
            onPress={() => updateSettings({ followUpDelayMin: m })}
          />
        ))}
      </View>
      <Text style={{ color: t.muted, marginTop: 8 }}>How long after a task’s time to ask whether you did it.</Text>

      <SectionTitle>Permissions</SectionTitle>
      {perms.available ? (
        <Card style={{ gap: 14 }}>
          <PermissionRow
            label="Notifications"
            ok={perms.notifications}
            hint="Required for reminders and alarms."
            onFix={() => native?.openNotificationSettings()}
          />
          <PermissionRow
            label="Exact alarms"
            ok={perms.exactAlarms}
            hint="Keeps notification reminders on time."
            onFix={() => native?.openExactAlarmSettings()}
          />
          <PermissionRow
            label="Full-screen alarms"
            ok={perms.fullScreen}
            hint="Lets alarms take over the lock screen."
            onFix={() => native?.openFullScreenIntentSettings()}
          />
        </Card>
      ) : (
        <Text style={{ color: t.muted }}>Alarm support isn’t available in this build.</Text>
      )}

      {perms.available ? (
        <>
          <SectionTitle>Test</SectionTitle>
          <View style={{ gap: 10 }}>
            <Button label="Test alarm in 10 s" variant="secondary" onPress={() => test('alarm')} />
            <Button label="Test notification in 10 s" variant="secondary" onPress={() => test('notification')} />
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
