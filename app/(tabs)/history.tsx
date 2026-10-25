import { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { indexCompletions, streakFor, summarizeDay } from '../../src/domain/history';
import { addDays } from '../../src/domain/schedule';
import type { OccurrenceStatus } from '../../src/domain/types';
import { useApp } from '../../src/store/app';
import { Card, Empty, SectionTitle } from '../../src/ui/components';
import { formatDate, formatTime } from '../../src/ui/format';
import { Text } from '../../src/ui/Text';
import { useTheme, type Theme } from '../../src/ui/theme';

const DAYS_SHOWN = 14;

const STATUS_LABEL: Record<OccurrenceStatus, string> = {
  done: 'Done',
  skipped: 'Skipped',
  missed: 'Missed',
  pending: 'Pending',
};

const statusColor = (t: Theme, s: OccurrenceStatus) =>
  s === 'done' ? t.done : s === 'skipped' ? t.skipped : s === 'missed' ? t.missed : t.muted;

export default function HistoryScreen() {
  const t = useTheme();
  const { tasks, completions, today, setStatus } = useApp();
  const index = useMemo(() => indexCompletions(completions), [completions]);

  const streaks = useMemo(
    () =>
      tasks
        .map((task) => ({ task, streak: streakFor(task, index, today) }))
        .filter((x) => x.streak > 0)
        .sort((a, b) => b.streak - a.streak),
    [tasks, index, today],
  );

  const days = useMemo(
    () =>
      Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, -i))
        .map((key) => summarizeDay(tasks, index, key, today))
        .filter((d) => d.entries.length > 0),
    [tasks, index, today],
  );

  return (
    <SectionList
      sections={days.map((d) => ({ title: d.date, summary: d, data: d.entries }))}
      keyExtractor={(e, i) => `${e.task.id}-${i}`}
      contentContainerStyle={styles.list}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        streaks.length > 0 ? (
          <View>
            <SectionTitle>Streaks</SectionTitle>
            <Card style={{ gap: 8 }}>
              {streaks.map(({ task, streak }) => (
                <View key={task.id} style={styles.streakRow}>
                  <Text style={{ color: t.text, flex: 1, fontWeight: '600' }}>{task.title}</Text>
                  <Text style={{ color: t.accent, fontWeight: '700' }}>
                    {streak} {streak === 1 ? 'day' : 'days'}
                  </Text>
                </View>
              ))}
            </Card>
          </View>
        ) : undefined
      }
      ListEmptyComponent={<Empty text="Nothing in your history yet. It fills in as your tasks come due." />}
      renderSectionHeader={({ section }) => {
        const s = section.summary;
        return (
          <View style={styles.dayHeader}>
            <Text style={[styles.dayTitle, { color: t.text }]}>
              {section.title === today ? 'Today' : formatDate(section.title)}
            </Text>
            <Text style={{ color: t.muted }}>
              {s.done}/{s.entries.length} done{s.skipped ? ` · ${s.skipped} skipped` : ''}
              {s.missed ? ` · ${s.missed} missed` : ''}
            </Text>
          </View>
        );
      }}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      renderItem={({ item, section }) => (
        <Card style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontWeight: '600', fontSize: 16 }}>{item.task.title}</Text>
            <Text style={{ color: t.muted }}>{formatTime(item.task.timeOfDay)}</Text>
          </View>
          <Text style={{ color: statusColor(t, item.status), fontWeight: '700' }}>{STATUS_LABEL[item.status]}</Text>
          {item.status === 'missed' ? (
            <Pressable
              onPress={() => setStatus(item.task.id, section.title, 'done')}
              hitSlop={8}
              accessibilityLabel="Mark as done"
            >
              <Text style={{ color: t.primary, fontWeight: '700' }}>Mark done</Text>
            </Pressable>
          ) : null}
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40 },
  streakRow: { flexDirection: 'row', alignItems: 'center' },
  dayHeader: { marginTop: 20, marginBottom: 8 },
  dayTitle: { fontSize: 18, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
