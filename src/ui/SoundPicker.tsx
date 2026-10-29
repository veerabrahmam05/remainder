import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SystemSound } from '../../modules/alarm-scheduler';
import { getNative } from '../alarms/native';
import { soundUri } from '../domain/sound';
import type { AlarmSound } from '../domain/types';
import { Button } from './components';
import { Text } from './Text';
import { useTheme } from './theme';

const MAX_IMPORT_BYTES = 15 * 1024 * 1024;

interface Row {
  key: string;
  label: string;
  hint?: string;
  sound: AlarmSound | null;
  /** The "use the default" row has nothing of its own to preview. */
  previewable: boolean;
}

function sameSound(a: AlarmSound | null, b: AlarmSound | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  return a.kind === 'default' || (a as { uri: string }).uri === (b as { uri: string }).uri;
}

/**
 * Full-screen sound chooser. Tapping a row selects it and plays a short preview on the alarm
 * volume. `inheritLabel` adds a "use the default" row (task level); without it the value is never null.
 */
export function SoundPicker({
  visible,
  value,
  inheritLabel,
  onChange,
  onClose,
}: {
  visible: boolean;
  value: AlarmSound | null;
  inheritLabel?: string;
  onChange: (sound: AlarmSound | null) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const native = getNative();
  const [tones, setTones] = useState<SystemSound[] | null>(null);
  const [defaultTitle, setDefaultTitle] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible || !native) return;
    let alive = true;
    setDefaultTitle(native.defaultAlarmSoundTitle());
    native
      .listAlarmSounds()
      .then((list) => alive && setTones(list))
      .catch(() => alive && setTones([]));
    return () => {
      alive = false;
      native.stopPreview();
    };
  }, [visible, native]);

  const rows: Row[] = [];
  if (inheritLabel) rows.push({ key: 'inherit', label: inheritLabel, sound: null, previewable: false });
  rows.push({
    key: 'default',
    label: 'Phone default',
    hint: defaultTitle || undefined,
    sound: { kind: 'default' },
    previewable: true,
  });
  // A previously imported file isn't in the system list, so show it so the user can see what's selected.
  if (value?.kind === 'file') {
    rows.push({ key: `file:${value.uri}`, label: value.name, hint: 'Imported file', sound: value, previewable: true });
  }
  for (const tone of tones ?? []) {
    rows.push({
      key: `tone:${tone.uri}`,
      label: tone.title,
      sound: { kind: 'system', uri: tone.uri, title: tone.title },
      previewable: true,
    });
  }

  const choose = async (row: Row) => {
    onChange(row.sound);
    if (!row.previewable || !native) return;
    const played = await native.previewSound(soundUri(row.sound)).catch(() => false);
    if (!played) Alert.alert('Can’t play this sound', 'Choose another one. An alarm falls back to the phone’s default sound if this one is unavailable.');
  };

  const importFile = async () => {
    if (!native || busy) return;
    setBusy(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      if (asset.size !== undefined && asset.size > MAX_IMPORT_BYTES) {
        Alert.alert('File too large', 'Choose an audio file under 15 MB.');
        return;
      }

      // Copy into the app's own storage: the picker's cache copy can be cleared at any time.
      const dir = new Directory(Paths.document, 'sounds');
      if (!dir.exists) dir.create();
      const dest = new File(dir, `${Date.now()}-${asset.name.replace(/[^\w.\- ]/g, '_')}`);
      new File(asset.uri).copy(dest);

      const played = await native.previewSound(dest.uri).catch(() => false);
      if (!played) {
        dest.delete();
        Alert.alert('Can’t use this file', 'That file couldn’t be played. Try an MP3, M4A, WAV or OGG file.');
        return;
      }
      onChange({ kind: 'file', uri: dest.uri, name: asset.name });
    } catch (e) {
      Alert.alert('Could not import the file', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.screen, { backgroundColor: t.bg, paddingTop: insets.top }]}>
        <View style={[styles.header, { backgroundColor: t.card, borderBottomColor: t.border }]}>
          <Text style={[styles.headerTitle, { color: t.text }]}>Alarm sound</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
            <Text style={{ color: t.primary, fontWeight: '700', fontSize: 16 }}>Done</Text>
          </Pressable>
        </View>

        {!native ? (
          <Text style={{ color: t.muted, padding: 24 }}>Alarm sounds aren’t available in this build.</Text>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(r) => r.key}
            contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16) + 16 }}
            ListFooterComponent={
              tones === null ? (
                <ActivityIndicator color={t.primary} style={{ marginTop: 16 }} />
              ) : (
                <View style={{ marginTop: 16 }}>
                  <Button label="Choose an audio file…" variant="secondary" onPress={importFile} disabled={busy} />
                  <Text style={{ color: t.muted, marginTop: 8 }}>
                    The file is copied into the app, so it keeps working if you move or delete the original.
                  </Text>
                </View>
              )
            }
            renderItem={({ item }) => {
              const selected = sameSound(item.sound, value);
              return (
                <Pressable
                  onPress={() => void choose(item)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.row,
                    { borderBottomColor: t.border, backgroundColor: pressed ? t.card : 'transparent' },
                  ]}
                >
                  <View style={[styles.radio, { borderColor: selected ? t.primary : t.muted }]}>
                    {selected ? <View style={[styles.radioDot, { backgroundColor: t.primary }]} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontWeight: selected ? '700' : '400', fontSize: 16 }}>{item.label}</Text>
                    {item.hint ? <Text style={{ color: t.muted, marginTop: 2 }}>{item.hint}</Text> : null}
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
