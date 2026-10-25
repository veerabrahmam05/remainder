package expo.modules.alarmscheduler

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import java.util.Calendar

object AlarmScheduler {
  const val ACTION_FIRE = "expo.modules.alarmscheduler.FIRE"
  const val EXTRA_KEY = "key"
  const val EXTRA_DATE = "date"

  private fun dateString(c: Calendar) =
    String.format("%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH))

  /** Next fire time (epoch ms) and the occurrence date it belongs to, or null if none remains. */
  fun nextTrigger(e: AlarmEntry, now: Long): Pair<Long, String>? {
    if (e.snoozeEpoch > 0) {
      if (e.snoozeEpoch <= now) return null
      val c = Calendar.getInstance().apply { timeInMillis = now }
      return e.snoozeEpoch to (e.snoozeDate ?: dateString(c))
    }

    if (e.daysMask == 0) {
      val date = e.onceDate ?: return null
      val (y, m, d) = date.split("-").map { it.toInt() }
      val c = Calendar.getInstance().apply {
        clear()
        set(y, m - 1, d, e.hour, e.minute, 0)
        add(Calendar.MINUTE, e.offsetMin)
      }
      return if (c.timeInMillis > now) c.timeInMillis to date else null
    }

    for (i in 0..7) {
      val c = Calendar.getInstance().apply {
        timeInMillis = now
        add(Calendar.DAY_OF_YEAR, i)
        set(Calendar.HOUR_OF_DAY, e.hour)
        set(Calendar.MINUTE, e.minute)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }
      val dow = c.get(Calendar.DAY_OF_WEEK) - 1 // Sunday = 0
      if (e.daysMask and (1 shl dow) == 0) continue
      val occurrence = dateString(c)
      c.add(Calendar.MINUTE, e.offsetMin)
      if (c.timeInMillis > now) return c.timeInMillis to occurrence
    }
    return null
  }

  private fun fireIntent(ctx: Context, key: String): Intent =
    Intent(ctx, AlarmReceiver::class.java)
      .setAction(ACTION_FIRE)
      .setData(Uri.parse("remainder-alarm://${Uri.encode(key)}"))

  private fun pending(ctx: Context, key: String, date: String?): PendingIntent {
    val intent = fireIntent(ctx, key).putExtra(EXTRA_KEY, key)
    if (date != null) intent.putExtra(EXTRA_DATE, date)
    return PendingIntent.getBroadcast(
      ctx,
      key.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  fun canScheduleExact(ctx: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    return ctx.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()
  }

  private fun setAlarm(ctx: Context, e: AlarmEntry, trigger: Long, date: String) {
    val am = ctx.getSystemService(AlarmManager::class.java)
    val pi = pending(ctx, e.key, date)
    if (e.kind == "alarm") {
      // Alarm-clock alarms are exempt from Doze and need no special permission.
      val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
      val show = PendingIntent.getActivity(ctx, 0, launch, PendingIntent.FLAG_IMMUTABLE)
      am.setAlarmClock(AlarmManager.AlarmClockInfo(trigger, show), pi)
    } else if (canScheduleExact(ctx)) {
      am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi)
    } else {
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi)
    }
  }

  fun cancel(ctx: Context, key: String) {
    ctx.getSystemService(AlarmManager::class.java).cancel(pending(ctx, key, null))
  }

  /** Schedules the next occurrence of [e]; removes it from the store when none remains. */
  fun scheduleOne(ctx: Context, e: AlarmEntry) {
    val next = nextTrigger(e, System.currentTimeMillis())
    if (next == null) {
      cancel(ctx, e.key)
      AlarmStore.saveEntries(ctx, AlarmStore.entries(ctx).filter { it.key != e.key })
    } else {
      Log.d("RemainderAlarm", "scheduled key=${e.key} kind=${e.kind} at=${java.util.Date(next.first)} date=${next.second}")
      setAlarm(ctx, e, next.first, next.second)
    }
  }

  fun scheduleAll(ctx: Context) {
    AlarmStore.entries(ctx).forEach { scheduleOne(ctx, it) }
  }

  /** Replaces all JS-managed entries; keeps still-pending snoozes / test alarms. */
  fun sync(ctx: Context, incoming: List<AlarmEntry>) {
    val now = System.currentTimeMillis()
    val old = AlarmStore.entries(ctx)
    old.forEach { cancel(ctx, it.key) }
    val keepers = old.filter { it.snoozeEpoch > now }
    AlarmStore.saveEntries(ctx, incoming + keepers)
    scheduleAll(ctx)
  }

  /** One-shot entry that fires at [epoch]; used for snooze and the in-app test button. */
  fun scheduleOneShot(ctx: Context, e: AlarmEntry, epoch: Long, date: String) {
    val entry = e.copy(snoozeEpoch = epoch, snoozeDate = date)
    val others = AlarmStore.entries(ctx).filter { it.key != entry.key }
    AlarmStore.saveEntries(ctx, others + entry)
    scheduleOne(ctx, entry)
  }
}
