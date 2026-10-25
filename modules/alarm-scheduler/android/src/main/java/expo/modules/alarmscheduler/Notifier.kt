package expo.modules.alarmscheduler

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build

object Notifier {
  const val CHANNEL_REMINDERS = "reminders"
  const val CHANNEL_FOLLOWUPS = "followups"
  const val CHANNEL_ALARM = "alarm"

  // Intent actions handled by ActionReceiver (reminders / follow-ups) and AlarmService (alarms).
  const val ACTION_DONE = "expo.modules.alarmscheduler.DONE"
  const val ACTION_SKIP = "expo.modules.alarmscheduler.SKIP"

  const val EXTRA_TASK_ID = "taskId"
  const val EXTRA_TITLE = "title"
  const val EXTRA_BODY = "body"

  fun notificationId(taskId: String, date: String, kind: String): Int = "$taskId|$date|$kind".hashCode()

  fun ensureChannels(ctx: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = ctx.getSystemService(NotificationManager::class.java)
    nm.createNotificationChannel(
      NotificationChannel(CHANNEL_REMINDERS, "Reminders", NotificationManager.IMPORTANCE_HIGH),
    )
    nm.createNotificationChannel(
      NotificationChannel(CHANNEL_FOLLOWUPS, "Did you do it?", NotificationManager.IMPORTANCE_DEFAULT),
    )
    // Silent: AlarmService plays the sound itself so it keeps looping regardless of heads-up state.
    nm.createNotificationChannel(
      NotificationChannel(CHANNEL_ALARM, "Alarms", NotificationManager.IMPORTANCE_HIGH).apply {
        setSound(null, null)
        enableVibration(false)
      },
    )
  }

  private fun builder(ctx: Context, channel: String): Notification.Builder =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(ctx, channel)
    else @Suppress("DEPRECATION") Notification.Builder(ctx)

  private fun deepLink(ctx: Context, uri: String, requestCode: Int): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri))
      .setPackage(ctx.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(
      ctx,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun action(label: String, pi: PendingIntent): Notification.Action =
    Notification.Action.Builder(Icon.createWithResource("android", android.R.drawable.ic_menu_send), label, pi).build()

  private fun receiverAction(ctx: Context, action: String, taskId: String, date: String, id: Int): PendingIntent =
    PendingIntent.getBroadcast(
      ctx,
      (action + id).hashCode(),
      Intent(ctx, ActionReceiver::class.java)
        .setAction(action)
        .setData(Uri.parse("remainder-action://$id/${Uri.encode(action)}"))
        .putExtra(EXTRA_TASK_ID, taskId)
        .putExtra(AlarmScheduler.EXTRA_DATE, date),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  /** Plain reminder ("notification" alert type) or the follow-up "did you do it?" prompt. */
  fun postReminder(ctx: Context, e: AlarmEntry, date: String) {
    ensureChannels(ctx)
    val isFollowUp = e.kind == "followup"
    val id = notificationId(e.taskId, date, e.kind)
    val link = if (isFollowUp) {
      "remainder://followup?taskId=${Uri.encode(e.taskId)}&date=$date"
    } else {
      "remainder://"
    }

    val n = builder(ctx, if (isFollowUp) CHANNEL_FOLLOWUPS else CHANNEL_REMINDERS)
      .setSmallIcon(android.R.drawable.ic_popup_reminder)
      .setContentTitle(e.title)
      .setContentText(e.body)
      .setAutoCancel(true)
      .setContentIntent(deepLink(ctx, link, id))
      .addAction(action(if (isFollowUp) "Yes, done" else "Done", receiverAction(ctx, ACTION_DONE, e.taskId, date, id)))
      .addAction(action("Skip today", receiverAction(ctx, ACTION_SKIP, e.taskId, date, id)))
      .build()

    ctx.getSystemService(NotificationManager::class.java).notify(id, n)
  }

  /** Ongoing notification for the ringing alarm; its full-screen intent opens [AlarmActivity]. */
  fun alarmNotification(ctx: Context, e: AlarmEntryView): Notification {
    ensureChannels(ctx)
    val id = notificationId(e.taskId, e.date, "alarm")

    fun service(action: String, code: Int) = PendingIntent.getService(
      ctx,
      code,
      AlarmService.intent(ctx, action, e),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val activity = PendingIntent.getActivity(
      ctx,
      id,
      AlarmActivity.intent(ctx, e),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    return builder(ctx, CHANNEL_ALARM)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle(e.title)
      .setContentText(e.body)
      .setCategory(Notification.CATEGORY_ALARM)
      .setOngoing(true)
      .setContentIntent(activity)
      .setFullScreenIntent(activity, true)
      .addAction(action("Done", service(ACTION_DONE, id + 1)))
      .addAction(action("Snooze", service(AlarmService.ACTION_SNOOZE, id + 2)))
      .addAction(action("Stop", service(AlarmService.ACTION_STOP, id + 3)))
      .build()
  }

  fun cancelFor(ctx: Context, taskId: String, date: String) {
    val nm = ctx.getSystemService(NotificationManager::class.java)
    listOf("alarm", "notification", "followup").forEach { nm.cancel(notificationId(taskId, date, it)) }
  }
}

/** The bits of an alarm the service / activity need, passed around through intent extras. */
data class AlarmEntryView(val key: String, val taskId: String, val date: String, val title: String, val body: String)
