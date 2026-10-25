import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { fonts, useTheme } from '../../src/ui/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

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
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: tabIcon('today', 'today-outline') }} />
      <Tabs.Screen name="routines" options={{ title: 'Routines', tabBarIcon: tabIcon('repeat', 'repeat-outline') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: tabIcon('time', 'time-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: tabIcon('settings', 'settings-outline') }} />
    </Tabs>
  );
}
