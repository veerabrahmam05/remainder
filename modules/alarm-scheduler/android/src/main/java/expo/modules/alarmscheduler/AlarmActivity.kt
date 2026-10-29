package expo.modules.alarmscheduler

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextClock
import android.widget.TextView

/** Full-screen ring screen shown over the lock screen. Pure native; no JS needed. */
class AlarmActivity : Activity() {
  companion object {
    fun intent(ctx: Context, e: AlarmEntryView): Intent =
      Intent(ctx, AlarmActivity::class.java)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        .putExtra(AlarmScheduler.EXTRA_KEY, e.key)
        .putExtra(Notifier.EXTRA_TASK_ID, e.taskId)
        .putExtra(AlarmScheduler.EXTRA_DATE, e.date)
        .putExtra(Notifier.EXTRA_TITLE, e.title)
        .putExtra(Notifier.EXTRA_BODY, e.body)
        .putExtra(Notifier.EXTRA_SOUND, e.sound)
        .putExtra(Notifier.EXTRA_SNOOZE_MIN, e.snoozeMin)
  }

  private val stopped = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) = finish()
  }

  @Suppress("DEPRECATION")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.addFlags(
      WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD,
    )

    val view = AlarmEntryView(
      key = intent.getStringExtra(AlarmScheduler.EXTRA_KEY) ?: "",
      taskId = intent.getStringExtra(Notifier.EXTRA_TASK_ID) ?: "",
      date = intent.getStringExtra(AlarmScheduler.EXTRA_DATE) ?: "",
      title = intent.getStringExtra(Notifier.EXTRA_TITLE) ?: "",
      body = intent.getStringExtra(Notifier.EXTRA_BODY) ?: "",
      sound = intent.getStringExtra(Notifier.EXTRA_SOUND),
      snoozeMin = intent.getIntExtra(Notifier.EXTRA_SNOOZE_MIN, 10),
    )
    setContentView(buildUi(view))

    val filter = IntentFilter(AlarmService.ACTION_STOPPED_BROADCAST)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(stopped, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      registerReceiver(stopped, filter)
    }
  }

  private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

  private fun buildUi(e: AlarmEntryView): View {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.parseColor("#110C09")) // dark palette: background-50
      setPadding(dp(24), dp(48), dp(24), dp(48))
    }

    root.addView(
      TextClock(this).apply {
        format12Hour = "h:mm a"
        format24Hour = "HH:mm"
        textSize = 56f
        setTextColor(Color.parseColor("#F4F2F1")) // text-950
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER
      },
    )
    root.addView(label(e.title, 28f, Color.parseColor("#F4F2F1"), dp(16)))
    if (e.body.isNotEmpty()) root.addView(label(e.body, 16f, Color.parseColor("#A3998F"), dp(8)))

    root.addView(button("Done", "#286F2F") { send(Notifier.ACTION_DONE, e) })
    root.addView(button("Snooze ${e.snoozeMin} min", "#90623C") { send(AlarmService.ACTION_SNOOZE, e) })
    root.addView(button("Skip today", "#443022") { send(Notifier.ACTION_SKIP, e) })
    root.addView(button("Stop", "#A52A26") { send(AlarmService.ACTION_STOP, e) })
    return root
  }

  private fun label(text: String, size: Float, color: Int, topMargin: Int) = TextView(this).apply {
    this.text = text
    textSize = size
    setTextColor(color)
    gravity = Gravity.CENTER
    layoutParams = LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT,
    ).apply { setMargins(0, topMargin, 0, 0) }
  }

  private fun button(text: String, bg: String, onClick: () -> Unit) = Button(this).apply {
    this.text = text
    setTextColor(Color.WHITE)
    setBackgroundColor(Color.parseColor(bg))
    textSize = 18f
    layoutParams = LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      dp(56),
    ).apply { setMargins(0, dp(14), 0, 0) }
    setOnClickListener { onClick() }
  }

  private fun send(action: String, e: AlarmEntryView) {
    startService(AlarmService.intent(this, action, e))
    finish()
  }

  override fun onDestroy() {
    try {
      unregisterReceiver(stopped)
    } catch (_: IllegalArgumentException) {
    }
    super.onDestroy()
  }
}
