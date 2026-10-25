package expo.modules.alarmscheduler

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/** Applies a user action taken from a notification / alarm UI. JS picks it up later via the queue. */
object ActionHandler {
  /** Task id used by the Settings "test alarm / notification" buttons. Not a real task. */
  const val TEST_TASK_ID = "test"

  fun apply(ctx: Context, type: String, taskId: String, date: String) {
    // Tests must never be recorded as resolved (that would silence every later test that day)
    // or queued for JS (there is no such task).
    if (taskId == TEST_TASK_ID) {
      Notifier.cancelFor(ctx, taskId, date)
      return
    }
    when (type) {
      "done", "skipped" -> {
        AlarmStore.markResolved(ctx, taskId, date)
        AlarmStore.enqueueAction(ctx, type, taskId, date)
      }
      else -> AlarmStore.enqueueAction(ctx, type, taskId, date)
    }
    Notifier.cancelFor(ctx, taskId, date)
  }
}

/** Fires when an alarm-manager alarm goes off. */
class AlarmReceiver : BroadcastReceiver() {
  private companion object {
    const val TAG = "RemainderAlarm"
  }

  override fun onReceive(context: Context, intent: Intent) {
    val key = intent.getStringExtra(AlarmScheduler.EXTRA_KEY) ?: return
    val date = intent.getStringExtra(AlarmScheduler.EXTRA_DATE) ?: return
    Log.d(TAG, "fired key=$key date=$date")
    val entry = AlarmStore.entries(context).firstOrNull { it.key == key }
    if (entry == null) {
      Log.w(TAG, "no stored entry for key=$key; ignoring")
      return
    }

    // Line up the next occurrence (or drop one-shots) before doing anything that might throw.
    AlarmScheduler.scheduleOne(context, entry)

    // Already handled in the app or from another notification: stay quiet.
    if (AlarmStore.isResolved(context, entry.taskId, date)) {
      Log.d(TAG, "suppressed: ${entry.taskId} on $date already resolved")
      return
    }

    if (entry.kind == "alarm") {
      val view = AlarmEntryView(entry.key, entry.taskId, date, entry.title, entry.body)
      context.startForegroundService(AlarmService.intent(context, AlarmService.ACTION_START, view))
    } else {
      Notifier.postReminder(context, entry, date)
    }
  }
}

/** Handles the Done / Skip buttons on reminder and follow-up notifications. */
class ActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val taskId = intent.getStringExtra(Notifier.EXTRA_TASK_ID) ?: return
    val date = intent.getStringExtra(AlarmScheduler.EXTRA_DATE) ?: return
    when (intent.action) {
      Notifier.ACTION_DONE -> ActionHandler.apply(context, "done", taskId, date)
      Notifier.ACTION_SKIP -> ActionHandler.apply(context, "skipped", taskId, date)
    }
  }
}

/** Re-arms everything after reboot, app update, or a clock / timezone change. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    AlarmScheduler.scheduleAll(context)
  }
}
