# Remainder

A personal routine and reminder app for Android. Add repeating tasks (daily, weekdays, weekends, or custom days of the week) and one-off tasks, choose an alarm or a notification for each, tick them off on a Today checklist, and review your history and streaks.

## Features

- Repeating tasks: every day, weekdays, weekends, or custom days. One-off tasks on a specific date and time.
- Per-task alert type: **alarm** (rings until dismissed, shows over the lock screen) or **notification** (with Done / Skip buttons). A global default is set in Settings.
- Custom alarm sounds: pick the phone's alarm tones (with preview) or import your own audio file, as a global default and optionally per task.
- Configurable snooze length (5, 10, 15, 20 or 30 minutes) in Settings.
- Today checklist: mark done or skip an occurrence without disabling the routine.
- "Did you do it?" follow-up prompt a configurable time after a task, with a per-task "don't ask again" option.
- History with per-day status (done, skipped, missed) and streaks. "Missed" is derived, never stored.
- Light, dark, and system themes.
- JSON backup and restore of tasks, history and settings (Settings > Backup).

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

`android/` is generated and git-ignored, so run `prebuild` once after cloning (and again after changing `app.json` or a config plugin). Use `npm start` afterward for day-to-day JavaScript work; only native changes (anything under `modules/`, `app.json`, or new native dependencies) need a rebuild.

### Running without the dev server (release build)

The build above is a **debug** build: it contains no JavaScript and loads the app from Metro, so it only opens while `npm start` is running. The project deliberately does **not** use `expo-dev-client` (see [App size](#app-size)): a debug build has no launcher screen and connects to Metro directly. With the phone connected over USB, Expo sets that up automatically (`adb reverse`). Over Wi-Fi only, open the app's dev menu (shake the phone), choose **Dev Settings > Debug server host & port**, and enter your PC's `address:8081`. For a standalone app that opens on its own, build the **release** variant, which bundles the JavaScript into the APK:

```bash
npm run android:release
```

- It runs `npm run prebuild` first, so changes to the icon, splash, `app.json` or plugins are always picked up. `npm run android` (debug) does **not** do this; run `npm run prebuild` yourself before it after such changes.
- It installs over the existing app (both variants are signed with the same keystore), so your tasks and history are kept. Never uninstall the app to refresh it: that deletes the local database.
- Every JavaScript change needs a new release build to show up. Use the debug build and `npm start` for day-to-day development, then switch back to release when you want the standalone app. The two can be swapped freely.
- The release variant is signed with the debug keystore, which is fine for personal use. Generate a proper keystore before distributing the app to anyone else or publishing it.
- Use `npm run android:release` rather than running Gradle directly: Expo builds only your device's CPU architecture, whereas Gradle by default compiles all four, which is much slower.
- A release build has no dev menu and no red error screen. If it crashes on startup, read the log with `adb logcat -d -s ReactNativeJS:V AndroidRuntime:E`.

### Why `.npmrc` sets `legacy-peer-deps=true`

The repo includes an `.npmrc` with `legacy-peer-deps=true`. Keep it.

- **Originally:** a plain `npm install` failed with `ERESOLVE`, because `react-dom` wanted `react@19.3.1` while Expo pins `react@19.3.0`. The conflict came from Expo's own packages. The flag tells npm to ignore peer-dependency conflicts.
- **Now:** a strict install no longer fails, but it also auto-installs optional peer packages the app does not use, including `react-native-reanimated`, `react-native-gesture-handler` and `react-native-worklets`. Those contain native code, so they would be added to the Android build for no benefit.
- **If you remove the flag**, expect those extra native modules, a longer build, and a need to rebuild and retest.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start Metro for the development build |
| `npm run prebuild` | Regenerate the native `android/` folder from `app.json`, `assets/` and config plugins. Run it after changing the app icon, splash, `app.json`, a config plugin, or native dependencies, **before** building |
| `npm run android` | Build and install the debug app on a connected device (arm64 only, see [App size](#app-size)) |
| `npm run android:release` | Run `prebuild`, then build and install the standalone release app (no dev server needed) |
| `npm run typecheck` | TypeScript check |
| `npm test` | Compile and run the domain unit tests (`src/domain`) |

## Project structure

```
app/                     Expo Router screens (tabs: Today, Routines, History, Settings; task editor; follow-up)
src/domain/              Pure logic: schedules, occurrence status, history, streaks (unit tested)
src/data/                SQLite schema + migrations, repositories, settings
src/store/               Zustand store
src/alarms/              Builds native alarm entries, syncs them, applies actions taken from notifications
src/backup/              Export (write file + share sheet) and restore (file picker + validate)
src/ui/                  Theme, Text wrapper (Montserrat), shared components
modules/alarm-scheduler/ Kotlin Expo module: AlarmManager scheduling, alarm service, lock-screen UI
plugins/                 Expo config plugin pinning the CMake version
```

### How alarms work

- JavaScript computes a schedule entry per task (plus a follow-up entry) and pushes the full set to the native module.
- The native side stores the entries, schedules them with `AlarmManager`, and re-arms them after a reboot or a clock/timezone change.
- When an alarm fires, native code rings it in a foreground service. Done, Skip and Snooze taken from notifications or the alarm screen are queued natively and applied to the database when the app next opens.
- Data is local only, but the model is sync-ready: UUID keys, `updatedAt` / `deletedAt` on every row, and an `ownerId` on tasks.

## Alarm sounds

Alarms (not notification-type reminders, whose sound Android fixes per channel) can play a custom sound:

- **Settings > Alarm sound** sets the default. In a task's editor (alert type Alarm), **Alarm sound** overrides it for that task, or says "Use default".
- The picker lists the phone's own alarm tones and previews each on tap (at the alarm volume, so it matches the real thing). **Choose an audio file** imports an MP3, M4A, WAV or OGG file up to 15 MB; it is copied into the app's private storage (`documentDirectory/sounds`), so it keeps working if the original is moved or deleted.
- **An alarm is never silent because of a bad sound.** If the chosen sound can't be played (deleted file, or a tone that doesn't exist on this phone), the alarm falls back to the phone's default alarm sound, then its ringtone.
- Snoozing keeps the same sound. Alarms that were scheduled before this feature existed use the default until you pick another.
- **Settings > Snooze length** (5, 10, 15, 20 or 30 min, default 10) sets how long the alarm's Snooze button delays it. A snoozed alarm snoozes for the same length again, and the lock-screen button shows the current length ("Snooze 15 min"). It is global; there is no per-task snooze length.
- The sound is stored per task as JSON in `tasks.alarm_sound` (`NULL` = use the default), and the default sound in the `settings` table. Playback and the fallback chain live in `modules/alarm-scheduler/.../SoundPlayer.kt`.

## Backup and restore

All data lives in the phone's local database, and **uninstalling the app deletes it**. Use **Settings > Backup** to protect it:

- **Export backup** writes `remainder-backup-YYYY-MM-DD.json` and opens the share sheet, so you can save it to Drive or Files, or send it to yourself.
- **Restore from backup** lets you pick a backup file, shows what it contains, and merges it into the phone. It is all-or-nothing: if anything fails, nothing is changed.

How a restore merges:

- Tasks match by id and history entries by task + date. An item already on the phone is replaced only if the backup copy has a newer `updatedAt`, so restoring an old backup never overwrites newer edits. Deletions are included: a task deleted after the backup was made stays deleted.
- Restored tasks are assigned to the current local user. After a reinstall the local user id is new, so tasks would otherwise be invisible.
- Settings (theme, default alert type, follow-up delay, default alarm sound) are restored too, and alarms are rescheduled.
- **Imported audio files are not included in a backup**, because they live in the old install's private storage. A task that used one comes back using the default sound. The phone's own alarm tones are kept, and used if the new phone has them.
- The file is validated before anything is touched: wrong app, a newer format version, or malformed tasks or history entries are rejected with a message. Unknown fields are ignored.

The file format is versioned (`"version": 1`) and the parser lives in `src/domain/backup.ts`, with tests in `src/domain/backup.test.ts`.

## App size

A release APK was measured at **71.6 MB** (arm64), and Android showed about 128 MB once installed, because it also builds an optimized copy of the code. Our own JavaScript and assets were under 1 MB; the weight was the React Native engine (`libreactnative.so`, 23 MB) and Java/Kotlin code, including a lot of Expo dev-client tooling that a standalone app never uses (the dev launcher and menu, Jetpack Compose, and an ML Kit barcode scanner used for the launcher's QR code).

After removing the dev client the APK measured **28.0 MB** (from 71.6 MB): native libraries 47.8 to 18.3 MB, Java/Kotlin code 19.2 to 2.4 MB packed (49.6 to 5.3 MB raw). R8 was already enabled by default in the generated project (`android.enableMinifyInReleaseBuilds=true`); the dev client's blanket keep rules appear to have been stopping it from shrinking anything.

After the font and resource-shrinking changes the APK is **25.5 MB** and Android reports **32.97 MB** installed (excluding data), down from 71.6 MB and about 128 MB. Fonts dropped from 19 files (6.2 MB raw) to 3, resources from 3.5 to 1.2 MB packed. What remains is mostly the unavoidable runtime: native libraries are 18.3 MB of the APK (React Native 6.7 MB, Hermes 2.6 MB, SQLite 1.8 MB), so there is little left to cut without dropping a major dependency.

What was done about it:

- **Fonts are imported per weight** (`@expo-google-fonts/montserrat/400Regular` and `/700Bold`, not the package root). Metro bundles every font file it can see, and the root re-exports all 18 weights, so the app was shipping 18 Montserrat files (about 6 MB raw, 2.7 MB packed) for the two it uses. Never import from the package root.
- **R8 resource shrinking is on**, and a keep rule protects `expo.modules.alarmscheduler.**` (added in `app.json` through `expo-build-properties`). Because R8 rewrites release code, always test alarms, the sound picker, backup and notifications on a release build after changing dependencies.
- **`expo-dev-client` is not installed.** Its launcher, dev menu, Compose and ML Kit were all being shipped inside the release app. The cost is a different dev workflow: a debug build has no launcher screen and connects to Metro directly (USB is automatic; over Wi-Fi you enter your PC's address once in the dev menu).
- **`gifEnabled` / `webpEnabled` are off** (via `expo-build-properties` in `app.json`): the app displays no GIF or WebP images, so the decoders are left out.
- **`buildArchs` is `arm64-v8a` only**, so a plain Gradle build can't add other CPU architectures. This means the app **won't run on an x86 emulator**; use a physical phone, or add `x86_64` to `buildArchs` in `app.json` and re-run `prebuild`.

To measure a build, pull the installed APK with `adb shell pm path com.veera.remainder` then `adb pull <path> installed.apk` and compare the sizes of `lib/` and the `classes*.dex` files inside it.

## Windows notes

- **260-character path limit:** the C++ build fails with `ninja: error: ... Filename longer than 260 characters`, because the `ninja` bundled with the default CMake 3.22.1 is not long-path aware. The fix is already wired in: `plugins/withCmakeVersion.js` pins CMake **3.31.6** (whose `ninja` is), so install that version in Android Studio's SDK Manager (SDK Tools, with "Show Package Details"). Windows long paths must also be enabled (`LongPathsEnabled=1`).
- **Do not edit `android/` by hand.** It is regenerated by `prebuild`; make native config changes in `app.json` or a config plugin.

## Permissions and device settings

Alarms depend on Android permissions and on how aggressive the phone's battery manager is. In the app, **Settings > Permissions** shows the status of notifications, exact alarms, full-screen alarms, and battery, with a shortcut to fix each.

**Battery status.** The app reads one of three states (`batteryState` in the native module):

- **Unrestricted**: on Android's battery-exemption list.
- **Optimized (default)**: what almost every app is in. Exact alarms (`setAlarmClock`) are exempt from Doze and still ring on time, so this is shown neutrally in Settings, with an **Allow** button for anyone who wants the extra margin. It does **not** trigger the banner.
- **Restricted**: the system forbids background activity (`RUN_ANY_IN_BACKGROUND` denied) or put the app in the restricted standby bucket. Alarms can fail. This is the only state that shows a banner.

When the app is restricted and at least one task is enabled, the Today screen shows a banner ("Make sure alarms ring on time") with **Allow**, which opens Android's own "allow unrestricted battery use?" dialog, and **Not now**, which hides the banner for good (`battery_prompt_dismissed` in the settings table; it is device-specific, so it is not part of backups). The state is re-read whenever the app returns to the foreground. The decision logic is `shouldShowBatteryPrompt` in `src/domain/battery.ts`, with tests.

An earlier version treated "not on the exemption list" as a red "Not allowed". On a vivo phone that was wrong: the system was not restricting the app at all (background activity allowed, active standby bucket), the app was simply in the default optimized state, and the phone maker's own "allow background running" setting does not add apps to Android's exemption list. Hence the three states.

Android can only report and request the standard battery exemption (`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`). Phone-specific switches such as "auto-start" or "background activity" cannot be detected, so Settings also has an **Open app settings** shortcut. If you publish the app on Google Play, note that Play restricts that permission to apps whose core function needs it (alarm and reminder apps are an accepted case, but it must be declared).

## Status

Verified on a device: alarm and notification delivery (including with the phone locked), real tasks, overnight alarms with the app closed, and the "did you do it?" follow-up prompt. Not yet verified: whether alarms survive a phone reboot.
