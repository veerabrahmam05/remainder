import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card } from './components';
import { Text } from './Text';
import { useTheme } from './theme';

/** Dismissible card asking for unrestricted battery use, so the phone doesn't delay alarms. */
export function BatteryBanner({ onAllow, onDismiss }: { onAllow: () => void; onDismiss: () => void }) {
  const t = useTheme();
  return (
    <Card style={{ borderColor: t.accent, gap: 10 }}>
      <View style={styles.header}>
        <Ionicons name="battery-charging-outline" size={22} color={t.accent} />
        <Text style={[styles.title, { color: t.text }]}>Make sure alarms ring on time</Text>
      </View>
      <Text style={{ color: t.muted }}>
        Your phone is restricting Remainder in the background, which can make alarms late or silent. Allow it to
        run without battery restrictions.
      </Text>
      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <Button label="Allow" onPress={onAllow} />
        </View>
        <Pressable onPress={onDismiss} hitSlop={10} accessibilityRole="button" style={styles.later}>
          <Text style={{ color: t.muted, fontWeight: '700' }}>Not now</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '700', flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  later: { paddingHorizontal: 8, paddingVertical: 8 },
});
