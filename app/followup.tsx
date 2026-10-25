import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { completionFor, indexCompletions } from '../src/domain/history';
import { useApp } from '../src/store/app';
import { Button, Card, Checkbox, Empty } from '../src/ui/components';
import { formatDate, formatTime } from '../src/ui/format';
import { Text } from '../src/ui/Text';
import { type as typeScale, useTheme } from '../src/ui/theme';

/** Opened from the "Did you do it?" notification. */
export default function FollowUpScreen() {
  const t = useTheme();
  const router = useRouter();
  const { taskId, date } = useLocalSearchParams<{ taskId: string; date: string }>();
  const { tasks, completions, ready, setStatus, disableFollowUp } = useApp();
  const [never, setNever] = useState(false);

  const task = tasks.find((x) => x.id === taskId);
  const existing = useMemo(
    () => (taskId && date ? completionFor(indexCompletions(completions), taskId, date) : undefined),
    [completions, taskId, date],
  );

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!ready) return null;
  if (!task || !date) return <Empty text="This task no longer exists." />;

  const answer = async (status: 'done' | 'skipped' | null) => {
    if (never) await disableFollowUp(task.id);
    if (status) await setStatus(task.id, date, status);
    close();
  };

  return (
    <View style={styles.container}>
      <Card style={{ gap: 6 }}>
        <Text style={[styles.title, { color: t.text }]}>{task.title}</Text>
        <Text style={{ color: t.muted }}>
          {formatDate(date)} · {formatTime(task.timeOfDay)}
        </Text>
        {existing ? (
          <Text style={{ color: t.muted, marginTop: 6 }}>
            Already marked {existing.status === 'done' ? 'done' : 'skipped'}. You can change it below.
          </Text>
        ) : null}
      </Card>

      <View style={{ gap: 12, marginTop: 24 }}>
        <Button label="Yes, I did it" onPress={() => answer('done')} />
        <Button label="Skipped it" variant="secondary" onPress={() => answer('skipped')} />
        <Button label="Not yet" variant="secondary" onPress={() => answer(null)} />
      </View>

      <View style={{ marginTop: 28 }}>
        <Checkbox
          checked={never}
          onToggle={() => setNever((v) => !v)}
          label="Don’t ask me about this task again"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: typeScale.h5, fontWeight: '700' },
});
