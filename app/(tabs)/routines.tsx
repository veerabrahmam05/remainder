import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { repeatLabel } from '../../src/domain/schedule';
import type { Task } from '../../src/domain/types';
import { useApp } from '../../src/store/app';
import { Button, Card, Empty, SectionTitle, Toggle } from '../../src/ui/components';
import { formatTime } from '../../src/ui/format';
import { Text } from '../../src/ui/Text';
import { useTheme } from '../../src/ui/theme';

const GROUPS = ['Every day', 'Weekdays', 'Weekends', 'Custom days', 'One-off'] as const;

function groupOf(task: Task): (typeof GROUPS)[number] {
  if (task.repeat.kind === 'once') return 'One-off';
  const label = repeatLabel(task.repeat);
  if (label === 'Every day' || label === 'Weekdays' || label === 'Weekends') return label;
  return 'Custom days';
}

export default function RoutinesScreen() {
  const t = useTheme();
  const router = useRouter();
  const { tasks, setEnabled, ready } = useApp();

  const sections = useMemo(
    () =>
      GROUPS.map((title) => ({ title, data: tasks.filter((x) => groupOf(x) === title) })).filter(
        (s) => s.data.length > 0,
      ),
    [tasks],
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={(x) => x.id}
      contentContainerStyle={styles.list}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={<Button label="+ New task" onPress={() => router.push('/task/edit')} />}
      ListEmptyComponent={ready ? <Empty text="No routines yet. Tap “New task” to add your first one." /> : undefined}
      renderSectionHeader={({ section }) => <SectionTitle>{section.title}</SectionTitle>}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item }) => (
        <Card style={[styles.row, !item.enabled && { opacity: 0.55 }]}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/task/edit', params: { id: item.id } })}
          >
            <Text style={[styles.title, { color: t.text }]}>{item.title}</Text>
            <Text style={{ color: t.muted, marginTop: 2 }}>
              {formatTime(item.timeOfDay)} · {repeatLabel(item.repeat)} ·{' '}
              {item.alertType === 'alarm' ? 'Alarm' : 'Notification'}
            </Text>
          </Pressable>
          <Toggle value={item.enabled} onValueChange={(v) => setEnabled(item.id, v)} />
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 17, fontWeight: '700' },
});
