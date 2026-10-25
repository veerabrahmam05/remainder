import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ALL_DAYS, dateKey, fireTime, parseDateKey, WEEKDAYS, WEEKENDS } from '../../src/domain/schedule';
import type { AlertType, Repeat, Weekday } from '../../src/domain/types';
import { useApp } from '../../src/store/app';
import { Button, Card, Chip, SectionTitle, Toggle } from '../../src/ui/components';
import { formatDate, formatTime, timeToDate, toHHmm } from '../../src/ui/format';
import { Text } from '../../src/ui/Text';
import { fonts, useTheme } from '../../src/ui/theme';

type RepeatMode = 'once' | 'daily' | 'weekdays' | 'weekends' | 'custom';

const MODES: { mode: RepeatMode; label: string }[] = [
  { mode: 'once', label: 'Once' },
  { mode: 'daily', label: 'Every day' },
  { mode: 'weekdays', label: 'Weekdays' },
  { mode: 'weekends', label: 'Weekends' },
  { mode: 'custom', label: 'Custom' },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const sameDays = (a: Weekday[], b: Weekday[]) => a.length === b.length && a.every((d) => b.includes(d));

function modeOf(repeat: Repeat): RepeatMode {
  if (repeat.kind === 'once') return 'once';
  if (sameDays(repeat.days, ALL_DAYS)) return 'daily';
  if (sameDays(repeat.days, WEEKDAYS)) return 'weekdays';
  if (sameDays(repeat.days, WEEKENDS)) return 'weekends';
  return 'custom';
}

export default function EditTaskScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { tasks, settings, saveTask, deleteTask } = useApp();
  const existing = useMemo(() => tasks.find((x) => x.id === id), [tasks, id]);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [time, setTime] = useState(existing?.timeOfDay ?? '07:00');
  const [mode, setMode] = useState<RepeatMode>(existing ? modeOf(existing.repeat) : 'weekdays');
  const [customDays, setCustomDays] = useState<Weekday[]>(
    existing?.repeat.kind === 'weekly' ? existing.repeat.days : [1, 3, 5],
  );
  const [onceDate, setOnceDate] = useState(
    existing?.repeat.kind === 'once' ? existing.repeat.date : dateKey(new Date()),
  );
  const [alertType, setAlertType] = useState<AlertType>(existing?.alertType ?? settings.defaultAlertType);
  const [askFollowUp, setAskFollowUp] = useState(existing?.askFollowUp ?? true);
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [picker, setPicker] = useState<'time' | 'date' | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleDay = (d: Weekday) =>
    setCustomDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort() as Weekday[]));

  const onPick = (event: DateTimePickerEvent, value?: Date) => {
    const which = picker;
    setPicker(null); // Android picker is a dialog; always close it
    if (event.type !== 'set' || !value) return;
    if (which === 'time') setTime(toHHmm(value));
    else if (which === 'date') setOnceDate(dateKey(value));
  };

  const buildRepeat = (): Repeat => {
    switch (mode) {
      case 'once':
        return { kind: 'once', date: onceDate };
      case 'daily':
        return { kind: 'weekly', days: ALL_DAYS };
      case 'weekdays':
        return { kind: 'weekly', days: WEEKDAYS };
      case 'weekends':
        return { kind: 'weekly', days: WEEKENDS };
      case 'custom':
        return { kind: 'weekly', days: customDays };
    }
  };

  const onSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) return Alert.alert('Add a title', 'Give the task a name.');
    if (mode === 'custom' && customDays.length === 0) {
      return Alert.alert('Pick days', 'Select at least one day of the week.');
    }
    if (mode === 'once' && enabled && fireTime({ timeOfDay: time }, onceDate).getTime() <= Date.now()) {
      return Alert.alert('Time has passed', 'Choose a date and time in the future for a one-off task.');
    }
    setSaving(true);
    try {
      await saveTask(
        {
          title: trimmed,
          notes: notes.trim(),
          timeOfDay: time,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          repeat: buildRepeat(),
          alertType,
          enabled,
          askFollowUp,
        },
        existing?.id,
      );
      router.back();
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', String(e));
    }
  };

  const onDelete = () => {
    if (!existing) return;
    Alert.alert('Delete task?', `“${existing.title}” will stop reminding you. History is kept.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTask(existing.id);
          router.back();
        },
      },
    ]);
  };

  const inputStyle = [styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.card }];

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: existing ? 'Edit task' : 'New task' }} />

      <SectionTitle>Title</SectionTitle>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Morning workout"
        placeholderTextColor={t.muted}
        style={inputStyle}
        autoFocus={!existing}
      />

      <SectionTitle>Notes (optional)</SectionTitle>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Shown in the reminder"
        placeholderTextColor={t.muted}
        style={[inputStyle, { minHeight: 70, textAlignVertical: 'top' }]}
        multiline
      />

      <SectionTitle>Time</SectionTitle>
      <Pressable onPress={() => setPicker('time')} style={[styles.input, { borderColor: t.border, backgroundColor: t.card }]}>
        <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>{formatTime(time)}</Text>
      </Pressable>

      <SectionTitle>Repeat</SectionTitle>
      <View style={styles.wrap}>
        {MODES.map((m) => (
          <Chip key={m.mode} label={m.label} selected={mode === m.mode} onPress={() => setMode(m.mode)} />
        ))}
      </View>

      {mode === 'custom' ? (
        <View style={[styles.wrap, { marginTop: 10 }]}>
          {DAY_LABELS.map((label, d) => (
            <Chip key={label} label={label} selected={customDays.includes(d as Weekday)} onPress={() => toggleDay(d as Weekday)} />
          ))}
        </View>
      ) : null}

      {mode === 'once' ? (
        <Pressable
          onPress={() => setPicker('date')}
          style={[styles.input, { borderColor: t.border, backgroundColor: t.card, marginTop: 10 }]}
        >
          <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{formatDate(onceDate)}</Text>
        </Pressable>
      ) : null}

      <SectionTitle>Alert</SectionTitle>
      <View style={styles.wrap}>
        <Chip label="Alarm" selected={alertType === 'alarm'} onPress={() => setAlertType('alarm')} />
        <Chip label="Notification" selected={alertType === 'notification'} onPress={() => setAlertType('notification')} />
      </View>
      <Text style={{ color: t.muted, marginTop: 8 }}>
        {alertType === 'alarm'
          ? 'Rings until you dismiss it, even on the lock screen.'
          : 'A normal notification with Done / Skip buttons.'}
      </Text>

      <Card style={{ marginTop: 18, gap: 14 }}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchTitle, { color: t.text }]}>Ask “did you do it?”</Text>
            <Text style={{ color: t.muted }}>A follow-up prompt if you haven’t ticked it off.</Text>
          </View>
          <Toggle value={askFollowUp} onValueChange={setAskFollowUp} />
        </View>
        {existing ? (
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchTitle, { color: t.text }]}>Enabled</Text>
              <Text style={{ color: t.muted }}>Turn off to pause without deleting.</Text>
            </View>
            <Toggle value={enabled} onValueChange={setEnabled} />
          </View>
        ) : null}
      </Card>

      <View style={{ marginTop: 24, gap: 12 }}>
        <Button label={existing ? 'Save changes' : 'Add task'} onPress={onSave} disabled={saving} />
        {existing ? <Button label="Delete task" variant="danger" onPress={onDelete} /> : null}
      </View>

      {picker === 'time' ? <DateTimePicker value={timeToDate(time)} mode="time" onChange={onPick} /> : null}
      {picker === 'date' ? (
        <DateTimePicker value={parseDateKey(onceDate)} mode="date" minimumDate={new Date()} onChange={onPick} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: fonts.regular,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchTitle: { fontSize: 16, fontWeight: '700' },
});
