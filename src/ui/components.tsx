import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>{children}</View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.primary : 'transparent';
  const fg = variant === 'primary' ? t.onPrimary : variant === 'danger' ? t.danger : t.primary;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: variant === 'primary' ? bg : fg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: selected ? t.primary : t.card, borderColor: selected ? t.primary : t.border },
      ]}
    >
      <Text style={{ color: selected ? t.onPrimary : t.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

/** Switch tinted with the theme (the stock one uses the system accent color). */
export function Toggle({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: t.border, true: `${t.primary}73` }} // primary at ~45% opacity
      thumbColor={value ? t.primary : t.muted}
      ios_backgroundColor={t.border}
    />
  );
}

export function Checkbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={styles.checkboxRow}
      hitSlop={8}
    >
      <View
        style={[
          styles.checkbox,
          { borderColor: checked ? t.done : t.muted, backgroundColor: checked ? t.done : 'transparent' },
        ]}
      >
        {checked ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
      {label ? <Text style={{ color: t.text, flexShrink: 1 }}>{label}</Text> : null}
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: string }) {
  const t = useTheme();
  return <Text style={[styles.sectionTitle, { color: t.muted }]}>{children.toUpperCase()}</Text>;
}

export function Empty({ text }: { text: string }) {
  const t = useTheme();
  return <Text style={[styles.empty, { color: t.muted }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  button: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  chip: { borderRadius: 999, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 14 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { color: '#fff', fontWeight: '900', fontSize: 16, lineHeight: 18 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginTop: 18, marginBottom: 8 },
  empty: { textAlign: 'center', marginTop: 24, fontSize: 15, paddingHorizontal: 24 },
});
