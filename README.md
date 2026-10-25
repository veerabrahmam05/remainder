# Remainder

A personal routine and reminder app for Android. Add repeating tasks (daily, weekdays, weekends, or custom days of the week) and one-off tasks, choose an alarm or a notification for each, tick them off on a Today checklist, and review your history and streaks.

## Features

- Repeating tasks: every day, weekdays, weekends, or custom days. One-off tasks on a specific date and time.
- Per-task alert type: **alarm** (rings until dismissed, shows over the lock screen) or **notification** (with Done / Skip buttons). A global default is set in Settings.
- Today checklist: mark done or skip an occurrence without disabling the routine.
- "Did you do it?" follow-up prompt a configurable time after a task, with a per-task "don't ask again" option.
- History with per-day status (done, skipped, missed) and streaks. "Missed" is derived, never stored.
- Light, dark, and system themes.

## Tech stack

- Expo SDK 58, React Native 0.88, TypeScript, Expo Router
- SQLite (`expo-sqlite`) behind repository interfaces, Zustand for state
- A local Kotlin Expo module, `modules/alarm-scheduler`, for exact alarms, the foreground alarm service, and the lock-screen alarm UI
- Android only for now

## Prerequisites

- Node.js 22 or newer
- Android Studio (it bundles a compatible JDK and installs the Android SDK)
- Environment variables:
  - `ANDROID_HOME` pointing at the SDK (on Windows, `%LOCALAPPDATA%\Android\Sdk`)
  - `JAVA_HOME` pointing at a JDK Gradle supports (Android Studio's bundled `jbr` works)
- Android SDK Tools: **CMake 3.31.6** (see [Windows notes](#windows-notes))
- An Android device with USB debugging enabled, or an emulator

## Getting started

```bash
npm install
npx expo prebuild --platform android
npx expo run:android
```

`android/` is generated and git-ignored, so run `prebuild` once after cloning (and again after changing `app.json` or a config plugin). Use `npx expo start --dev-client` afterward for day-to-day JavaScript work; only native changes (anything under `modules/`, `app.json`, or new native dependencies) need a rebuild.

### Why `.npmrc` sets `legacy-peer-deps=true`

The repo includes an `.npmrc` with `legacy-peer-deps=true`. Keep it.

- **Originally:** a plain `npm install` failed with `ERESOLVE`, because `react-dom` wanted `react@19.3.1` while Expo pins `react@19.3.0`. The conflict came from Expo's own packages. The flag tells npm to ignore peer-dependency conflicts.
- **Now:** a strict install no longer fails, but it also auto-installs optional peer packages the app does not use, including `react-native-reanimated`, `react-native-gesture-handler` and `react-native-worklets`. Those contain native code, so they would be added to the Android build for no benefit.
- **If you remove the flag**, expect those extra native modules, a longer build, and a need to rebuild and retest.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start Metro for the development build |
| `npm run android` | Build and install the app on a connected device or emulator |
| `npm run typecheck` | TypeScript check |
| `npm test` | Compile and run the domain unit tests (`src/domain`) |

## Project structure

```
app/                     Expo Router screens (tabs: Today, Routines, History, Settings; task editor; follow-up)
src/domain/              Pure logic: schedules, occurrence status, history, streaks (unit tested)
src/data/                SQLite schema + migrations, repositories, settings
src/store/               Zustand store
src/alarms/              Builds native alarm entries, syncs them, applies actions taken from notifications
src/ui/                  Theme, Text wrapper (Montserrat), shared components
modules/alarm-scheduler/ Kotlin Expo module: AlarmManager scheduling, alarm service, lock-screen UI
plugins/                 Expo config plugin pinning the CMake version
```

### How alarms work

- JavaScript computes a schedule entry per task (plus a follow-up entry) and pushes the full set to the native module.
- The native side stores the entries, schedules them with `AlarmManager`, and re-arms them after a reboot or a clock/timezone change.
- When an alarm fires, native code rings it in a foreground service. Done, Skip and Snooze taken from notifications or the alarm screen are queued natively and applied to the database when the app next opens.
- Data is local only, but the model is sync-ready: UUID keys, `updatedAt` / `deletedAt` on every row, and an `ownerId` on tasks.

## Windows notes

- **260-character path limit:** the C++ build fails with `ninja: error: ... Filename longer than 260 characters`, because the `ninja` bundled with the default CMake 3.22.1 is not long-path aware. The fix is already wired in: `plugins/withCmakeVersion.js` pins CMake **3.31.6** (whose `ninja` is), so install that version in Android Studio's SDK Manager (SDK Tools, with "Show Package Details"). Windows long paths must also be enabled (`LongPathsEnabled=1`).
- **Do not edit `android/` by hand.** It is regenerated by `prebuild`; make native config changes in `app.json` or a config plugin.

## Permissions and device settings

Alarms depend on Android permissions and on how aggressive the phone's battery manager is. In the app, **Settings > Permissions** shows the status of notifications, exact alarms, and full-screen alarms, with a shortcut to fix each. On some phones you also need to set the app's battery usage to unrestricted and allow auto-start for alarms to fire reliably while the app is closed.

## Status

Verified on a device: alarm and notification delivery (including with the phone locked) and real tasks. Long-running behavior (reboot, overnight with the app closed) is still being tested.
