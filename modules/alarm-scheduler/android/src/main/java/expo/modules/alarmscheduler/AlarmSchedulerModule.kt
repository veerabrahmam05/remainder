package expo.modules.alarmscheduler

import android.app.AppOpsManager
import android.app.NotificationManager
import android.app.usage.UsageStatsManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.Process
import android.media.RingtoneManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Calendar

class AlarmSchedulerModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context is not available")

  private fun entryFrom(m: Map<String, Any?>) = AlarmEntry(
    key = m["key"] as String,
    taskId = m["taskId"] as String,
    kind = m["kind"] as String,
    title = m["title"] as String,
    body = m["body"] as String,
    hour = (m["hour"] as Number).toInt(),
    minute = (m["minute"] as Number).toInt(),
    daysMask = (m["daysMask"] as Number).toInt(),
    onceDate = m["onceDate"] as String?,
    offsetMin = (m["offsetMin"] as Number).toInt(),
    sound = m["sound"] as String?,
    snoozeMin = (m["snoozeMin"] as? Number)?.toInt() ?: 10,
  )

  private fun openSettings(action: String) {
    val intent = Intent(action, Uri.parse("package:${context.packageName}"))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }

  override fun definition() = ModuleDefinition {
    Name("AlarmScheduler")

    /** Replace every task-managed alarm with [entries] and schedule them. */
    AsyncFunction("sync") { entries: List<Map<String, Any?>> ->
      Notifier.ensureChannels(context)
      AlarmScheduler.sync(context, entries.map { entryFrom(it) })
    }

    /** Queued actions taken from notifications / the alarm screen, as a JSON array string. */
    AsyncFunction("drainActions") { AlarmStore.drainActions(context) }

    AsyncFunction("markResolved") { taskId: String, date: String ->
      AlarmStore.markResolved(context, taskId, date)
      Notifier.cancelFor(context, taskId, date)
    }

    AsyncFunction("clearResolved") { taskId: String, date: String ->
      AlarmStore.clearResolved(context, taskId, date)
    }

    /** Fires a one-off test alarm / notification after [seconds]. */
    AsyncFunction("scheduleTest") { kind: String, seconds: Int, sound: String?, snoozeMin: Int ->
      Notifier.ensureChannels(context)
      val at = System.currentTimeMillis() + seconds * 1000L
      val cal = Calendar.getInstance().apply { timeInMillis = at }
      val date = String.format(
        "%04d-%02d-%02d",
        cal.get(Calendar.YEAR),
        cal.get(Calendar.MONTH) + 1,
        cal.get(Calendar.DAY_OF_MONTH),
      )
      // Clear any stale "resolved" flag left by older builds, so today's tests aren't suppressed.
      AlarmStore.clearResolved(context, ActionHandler.TEST_TASK_ID, date)
      val entry = AlarmEntry(
        key = "test:$kind",
        taskId = ActionHandler.TEST_TASK_ID,
        kind = kind,
        title = "Test ${if (kind == "alarm") "alarm" else "reminder"}",
        body = "If you can see this, scheduling works.",
        hour = cal.get(Calendar.HOUR_OF_DAY),
        minute = cal.get(Calendar.MINUTE),
        daysMask = 0,
        onceDate = null,
        offsetMin = 0,
        sound = if (kind == "alarm") sound else null,
        snoozeMin = snoozeMin,
      )
      AlarmScheduler.scheduleOneShot(context, entry, at, date)
    }

    /** The phone's alarm tones (title + content URI) for the in-app picker. No permission needed. */
    AsyncFunction("listAlarmSounds") {
      val manager = RingtoneManager(context).apply { setType(RingtoneManager.TYPE_ALARM) }
      val cursor = manager.cursor
      val sounds = mutableListOf<Map<String, String>>()
      if (cursor.moveToFirst()) {
        do {
          sounds.add(
            mapOf(
              "title" to cursor.getString(RingtoneManager.TITLE_COLUMN_INDEX),
              "uri" to manager.getRingtoneUri(cursor.position).toString(),
            ),
          )
        } while (cursor.moveToNext())
      }
      sounds
    }

    Function("defaultAlarmSoundTitle") {
      val uri = RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_ALARM)
        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      uri?.let { RingtoneManager.getRingtone(context, it)?.getTitle(context) } ?: "Default alarm"
    }

    AsyncFunction("previewSound") { uri: String? -> SoundPreview.play(context, uri) }

    Function("stopPreview") { SoundPreview.stop() }

    Function("canScheduleExactAlarms") { AlarmScheduler.canScheduleExact(context) }

    Function("areNotificationsEnabled") {
      context.getSystemService(NotificationManager::class.java).areNotificationsEnabled()
    }

    Function("canUseFullScreenIntent") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        context.getSystemService(NotificationManager::class.java).canUseFullScreenIntent()
      } else {
        true
      }
    }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        openSettings(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
      }
    }

    Function("openFullScreenIntentSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        openSettings(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
      }
    }

    /**
     * How the system treats this app's background activity:
     *  - "unrestricted": on the battery-exemption list.
     *  - "restricted":   the system forbids background activity or put the app in the restricted standby
     *                    bucket. Alarms can fail. This is the only state worth warning about.
     *  - "optimized":    Android's default for almost every app. Exact alarms still ring on time.
     * Phone-maker switches (auto-start, "high background power use") are invisible to apps.
     */
    Function("batteryState") {
      val pm = context.getSystemService(PowerManager::class.java)
      if (pm.isIgnoringBatteryOptimizations(context.packageName)) {
        "unrestricted"
      } else {
        var restricted = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          val appOps = context.getSystemService(AppOpsManager::class.java)
          val mode = appOps.unsafeCheckOpNoThrow(
            "android:run_any_in_background",
            Process.myUid(),
            context.packageName,
          )
          val bucket = context.getSystemService(UsageStatsManager::class.java).appStandbyBucket
          // 45 = STANDBY_BUCKET_RESTRICTED
          restricted = mode == AppOpsManager.MODE_IGNORED || mode == AppOpsManager.MODE_ERRORED || bucket >= 45
        }
        if (restricted) "restricted" else "optimized"
      }
    }

    /** Shows Android's one-tap "allow unrestricted battery use?" dialog; falls back to the full list. */
    Function("requestIgnoreBatteryOptimizations") {
      val request = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(request)
      } catch (_: ActivityNotFoundException) {
        context.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }

    /** The app's own settings page: where phone-specific switches (auto-start, background activity) live. */
    Function("openAppSettings") {
      val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    Function("openNotificationSettings") {
      val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
        .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }
  }
}
