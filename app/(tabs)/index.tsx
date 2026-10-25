import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { entriesForDay, indexCompletions, streakFor, type DayEntry } from '../../src/domain/history';
import { fireTime, repeatLabel } from '../../src/domain/schedule';
import { useApp } from '../../src/store/app';
import { Button, Card, Checkbox, Empty } from '../../src/ui/components';
import { formatDate, formatTime } from '../../src/ui/format';
import { Text } from '../../src/ui/Text';
import { type as typeScale, useTheme } from '../../src/ui/theme';

export default function TodayScreen() {
  const t = useTheme();
  const router = useRouter();
  const { tasks, completions, today, ready, setStatus } = useApp();

  const index = useMemo(() => indexCompletions(completions), [completions]);
  const entries = useMemo(() => entriesForDay(tasks, index, today, today), [tasks, index, today]);
  const resolved = entries.filter((e) => e.status === 'done' || e.status === 'skipped').length;

  const renderItem = ({ item }: { item: DayEntry }) => {
    const { task, status } = item;
    const overdue = status === 'pending' && fireTime(task, today).getTime() < Date.now();
    const streak = streakFor(task, index, today);
    return (
      <Card style={styles.row}>
        <Checkbox
          checked={status === 'done'}
          onToggle={() => setStatus(task.id, today, status === 'done' ? null : 'done')}
        />
        <Pressable
          style={styles.rowBody}
          onPress={() => router.push({ pathname: '/task/edit', params: { id: task.id } })}
        >
          <Text
            style={[
              styles.title,
              { color: t.text },
              status === 'done' && { textDecorationLine: 'line-through', color: t.muted },
            ]}
          >
            {task.title}
          </Text>
          <Text style={{ color: overdue ? t.missed : t.muted, marginTop: 2 }}>
            {formatTime(task.timeOfDay)} · {repeatLabel(task.repeat)}
            {task.alertType === 'alarm' ? ' · Alarm' : ''}
            {streak > 1 ? ` · ${streak} day streak` : ''}
          </Text>
        </Pressable>
        {status === 'skipped' ? (
          <Pressable onPress={() => setStatus(task.id, today, null)} hitSlop={8}>
            <Text style={{ color: t.skipped, fontWeight: '700' }}>Skipped · Undo</Text>
          </Pressable>
        ) : status === 'pending' ? (
          <Pressable onPress={() => setStatus(task.id, today, 'skipped')} hitSlop={8}>
            <Text style={{ color: t.muted, fontWeight: '600' }}>Skip</Text>
          </Pressable>
        ) : null}
      </Card>
    );
  };

  return (
    <FlatList
      data={entries}
      keyExtractor={(e) => e.task.id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListHeaderComponent={
        <View style={{ marginBottom: 12, gap: 10 }}>
          <View>
            <Text style={[styles.date, { color: t.text }]}>{formatDate(today)}</Text>
            <Text style={{ color: t.muted, marginTop: 2 }}>
              {entries.length === 0 ? 'Nothing scheduled' : `${resolved} of ${entries.length} handled`}
            </Text>
          </View>
          <Button label="+ New task" onPress={() => router.push('/task/edit')} />
        </View>
      }
      ListEmptyComponent={
        ready ? <Empty text="No tasks due today. Add a routine or a one-off task to get started." /> : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40 },
  date: { fontSize: typeScale.h4, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBody: { flex: 1 },
  title: { fontSize: 17, fontWeight: '700' },
});
