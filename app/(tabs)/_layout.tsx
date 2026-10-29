import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { fonts, useTheme } from '../../src/ui/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Tab button without Android's Material ripple (the grey "shadow" that flashes around the tab on
 * touch). It receives the navigator's props: some are specific to the stock button and must not
 * reach the native view, so they are pulled out and dropped.
 */
function TabButton({
  children,
  style,
  // Props of the stock PlatformPressable that a plain Pressable doesn't understand.
  pressColor: _pressColor,
  pressOpacity: _pressOpacity,
  hoverEffect: _hoverEffect,
  href: _href,
  ...rest
}: PressableProps & {
  children?: ReactNode;
  pressColor?: unknown;
  pressOpacity?: unknown;
  hoverEffect?: unknown;
  href?: unknown;
}) {
  return (
    <Pressable
      {...rest}
      // No android_ripple prop: a plain Pressable has no ripple, unlike the navigator's stock button.
      // A light dim while pressed, so a tap still feels acknowledged. Remove for no feedback at all.
      style={(state) => [typeof style === 'function' ? style(state) : style, state.pressed && { opacity: 0.6 }]}
    >
      {children}
    </Pressable>
  );
}

export default function TabsLayout() {
  const t = useTheme();

  /** Filled icon when the tab is focused, outline otherwise. Colors come from our theme tokens. */
  const tabIcon =
    (active: IconName, inactive: IconName) =>
    ({ focused, size }: { focused: boolean; size: number }) => (
      <Ionicons name={focused ? active : inactive} size={size} color={focused ? t.primary : t.muted} />
    );

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.card },
        headerTintColor: t.text,
        headerTitleStyle: { fontFamily: fonts.bold, color: t.text },
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.muted,
        tabBarLabelStyle: { fontSize: 11, fontFamily: fonts.bold },
        tabBarButton: (props) => <TabButton {...props} />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: tabIcon('today', 'today-outline') }} />
      <Tabs.Screen name="routines" options={{ title: 'Routines', tabBarIcon: tabIcon('repeat', 'repeat-outline') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: tabIcon('time', 'time-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: tabIcon('settings', 'settings-outline') }} />
    </Tabs>
  );
}
