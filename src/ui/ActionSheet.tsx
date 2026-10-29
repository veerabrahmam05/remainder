import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { useTheme } from './theme';

export interface SheetAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

/**
 * Themed bottom sheet with a list of actions. Android's native Alert caps at three buttons,
 * which isn't enough for a task menu. The sheet closes itself before running an action.
 */
export function ActionSheet({
  visible,
  title,
  subtitle,
  actions,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu">
        {/* Inner Pressable swallows taps so touching the sheet doesn't close it. */}
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: t.card, borderColor: t.border, paddingBottom: Math.max(insets.bottom, 12) + 4 },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={{ color: t.muted, marginTop: 2 }} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          {actions.map((a) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              onPress={() => {
                onClose();
                a.onPress();
              }}
              style={({ pressed }) => [
                styles.action,
                { borderTopColor: t.border, backgroundColor: pressed ? t.border : 'transparent' },
              ]}
            >
              <Text style={[styles.actionText, { color: a.destructive ? t.danger : t.text }]}>{a.label}</Text>
            </Pressable>
          ))}

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.action,
              { borderTopColor: t.border, backgroundColor: pressed ? t.border : 'transparent' },
            ]}
          >
            <Text style={[styles.actionText, { color: t.muted }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingTop: 6,
    overflow: 'hidden',
  },
  header: { paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 18, fontWeight: '700' },
  action: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth },
  actionText: { fontSize: 16, fontWeight: '600' },
});
