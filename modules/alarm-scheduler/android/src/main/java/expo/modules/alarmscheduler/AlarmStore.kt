package expo.modules.alarmscheduler

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * One scheduled reminder. Weekly entries repeat via [daysMask] (bit 0 = Sunday ... bit 6 = Saturday);
 * one-off entries have daysMask == 0 and an [onceDate]. Snoozes / test alarms set [snoozeEpoch].
 * The fire time is (hour:minute on the occurrence day) + [offsetMin] minutes.
 */
data class AlarmEntry(
  val key: String,
  val taskId: String,
  val kind: String, // alarm | notification | followup
  val title: String,
  val body: String,
  val hour: Int,
  val minute: Int,
  val daysMask: Int,
  val onceDate: String?,
  val offsetMin: Int,
  val snoozeEpoch: Long = 0L,
  val snoozeDate: String? = null,
  /** content:// or file:// URI of the alarm sound; null means the phone's default alarm sound. */
  val sound: String? = null,
  /** Minutes the Snooze button delays an alarm. */
  val snoozeMin: Int = 10,
) {
  fun toJson(): JSONObject = JSONObject().apply {
    put("key", key)
    put("taskId", taskId)
    put("kind", kind)
    put("title", title)
    put("body", body)
    put("hour", hour)
    put("minute", minute)
    put("daysMask", daysMask)
    put("onceDate", onceDate ?: JSONObject.NULL)
    put("offsetMin", offsetMin)
    put("snoozeEpoch", snoozeEpoch)
    put("snoozeDate", snoozeDate ?: JSONObject.NULL)
    put("sound", sound ?: JSONObject.NULL)
    put("snoozeMin", snoozeMin)
  }

  companion object {
    fun fromJson(o: JSONObject) = AlarmEntry(
      key = o.getString("key"),
      taskId = o.getString("taskId"),
      kind = o.getString("kind"),
      title = o.getString("title"),
      body = o.getString("body"),
      hour = o.getInt("hour"),
      minute = o.getInt("minute"),
      daysMask = o.getInt("daysMask"),
      onceDate = if (o.isNull("onceDate")) null else o.getString("onceDate"),
      offsetMin = o.getInt("offsetMin"),
      snoozeEpoch = o.optLong("snoozeEpoch", 0L),
      snoozeDate = if (o.isNull("snoozeDate")) null else o.getString("snoozeDate"),
      // Entries saved by older builds have no "sound" key; isNull() is true for a missing key too.
      sound = if (o.isNull("sound")) null else o.getString("sound"),
      // Entries saved by older builds have no "snoozeMin": optInt falls back to the old fixed 10.
      snoozeMin = o.optInt("snoozeMin", 10),
    )
  }
}

/**
 * Persistent state shared by receivers (which run without JS):
 *  - scheduled entries (so alarms can be rescheduled after boot / after firing)
 *  - "resolved" occurrences (done/skipped) so a later alarm or follow-up is suppressed
 *  - a queue of actions taken from notifications, drained by JS when the app opens
 */
object AlarmStore {
  private const val PREFS = "remainder_alarms"
  private const val KEY_ENTRIES = "entries"
  private const val KEY_RESOLVED = "resolved"
  private const val KEY_ACTIONS = "actions"

  private fun prefs(ctx: Context) =
    ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  @Synchronized
  fun entries(ctx: Context): List<AlarmEntry> {
    val raw = prefs(ctx).getString(KEY_ENTRIES, null) ?: return emptyList()
    val arr = JSONArray(raw)
    return (0 until arr.length()).map { AlarmEntry.fromJson(arr.getJSONObject(it)) }
  }

  @Synchronized
  fun saveEntries(ctx: Context, list: List<AlarmEntry>) {
    val arr = JSONArray()
    list.forEach { arr.put(it.toJson()) }
    prefs(ctx).edit().putString(KEY_ENTRIES, arr.toString()).commit()
  }

  @Synchronized
  fun isResolved(ctx: Context, taskId: String, date: String): Boolean =
    prefs(ctx).getStringSet(KEY_RESOLVED, emptySet())!!.contains("$taskId|$date")

  @Synchronized
  fun markResolved(ctx: Context, taskId: String, date: String) {
    val set = prefs(ctx).getStringSet(KEY_RESOLVED, emptySet())!!.toMutableSet()
    set.add("$taskId|$date")
    // Keep the set small: drop anything older than the newest 200 entries by date.
    val pruned = if (set.size > 200) set.sortedByDescending { it.substringAfter('|') }.take(200).toSet() else set
    prefs(ctx).edit().putStringSet(KEY_RESOLVED, pruned).commit()
  }

  @Synchronized
  fun clearResolved(ctx: Context, taskId: String, date: String) {
    val set = prefs(ctx).getStringSet(KEY_RESOLVED, emptySet())!!.toMutableSet()
    set.remove("$taskId|$date")
    prefs(ctx).edit().putStringSet(KEY_RESOLVED, set).commit()
  }

  @Synchronized
  fun enqueueAction(ctx: Context, type: String, taskId: String, date: String) {
    val arr = JSONArray(prefs(ctx).getString(KEY_ACTIONS, "[]"))
    arr.put(
      JSONObject().apply {
        put("type", type) // done | skipped | never_ask
        put("taskId", taskId)
        put("date", date)
        put("at", System.currentTimeMillis())
      },
    )
    prefs(ctx).edit().putString(KEY_ACTIONS, arr.toString()).commit()
  }

  /** Returns the queued actions as a JSON array string and clears the queue. */
  @Synchronized
  fun drainActions(ctx: Context): String {
    val raw = prefs(ctx).getString(KEY_ACTIONS, "[]") ?: "[]"
    prefs(ctx).edit().putString(KEY_ACTIONS, "[]").commit()
    return raw
  }
}
