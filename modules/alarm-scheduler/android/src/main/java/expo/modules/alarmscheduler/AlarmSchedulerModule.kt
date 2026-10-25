package expo.modules.alarmscheduler

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
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
    AsyncFunction("scheduleTest") { kind: String, seconds: Int ->
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
      )
      AlarmScheduler.scheduleOneShot(context, entry, at, date)
    }

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

    Function("openNotificationSettings") {
      val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
        .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }
  }
}
