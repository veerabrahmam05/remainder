import { Montserrat_400Regular, Montserrat_700Bold, useFonts } from '@expo-google-fonts/montserrat';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, PermissionsAndroid, Platform, useColorScheme } from 'react-native';
import { useApp } from '../src/store/app';
import { fonts, useTheme } from '../src/ui/theme';

export default function RootLayout() {
  const t = useTheme();
  const scheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({ Montserrat_400Regular, Montserrat_700Bold });
  const init = useApp((s) => s.init);
  const refresh = useApp((s) => s.refresh);
  const ready = useApp((s) => s.ready);
  const [initFailed, setInitFailed] = useState(false);

  useEffect(() => {
    (async () => {
      // Android 13+ needs a runtime grant for notifications (and therefore alarms' heads-up UI).
      if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }
      await init();
    })().catch((e) => {
      console.warn('init failed:', e);
      setInitFailed(true);
    });

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh().catch((e) => console.warn('refresh failed:', e));
    });
    return () => sub.remove();
  }, [init, refresh]);

  // Hold the first frame until fonts and saved settings (theme) are ready, so the app doesn't flash
  // the wrong theme or an empty list. Falls back to rendering if either step fails.
  if (!fontsLoaded && !fontError) return null;
  if (!ready && !initFailed) return null;

  // Navigation's own theme drives the background behind every screen (including tab screens,
  // which the Stack's contentStyle doesn't reach), so feed it our palette.
  const navTheme = {
    ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      primary: t.primary,
      background: t.bg,
      card: t.card,
      text: t.text,
      border: t.border,
      notification: t.accent,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.card },
          headerTintColor: t.text,
          headerTitleStyle: { fontFamily: fonts.bold, color: t.text },
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="task/edit" options={{ presentation: 'modal', title: 'Task' }} />
        <Stack.Screen name="followup" options={{ presentation: 'modal', title: 'Did you do it?' }} />
      </Stack>
    </ThemeProvider>
  );
}
