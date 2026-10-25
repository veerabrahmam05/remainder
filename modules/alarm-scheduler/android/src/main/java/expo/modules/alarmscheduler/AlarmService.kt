package expo.modules.alarmscheduler

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import java.util.Calendar

/**
 * Foreground service that keeps an alarm ringing (sound + vibration) until the user acts,
 * and hosts the notification whose full-screen intent opens [AlarmActivity].
 */
class AlarmService : Service() {
  companion object {
    const val ACTION_START = "expo.modules.alarmscheduler.START"
    const val ACTION_SNOOZE = "expo.modules.alarmscheduler.SNOOZE"
    const val ACTION_STOP = "expo.modules.alarmscheduler.STOP"
    const val ACTION_STOPPED_BROADCAST = "expo.modules.alarmscheduler.ALARM_STOPPED"

    private const val SNOOZE_MINUTES = 10
    private const val AUTO_STOP_MS = 5 * 60 * 1000L

    fun intent(ctx: Context, action: String, e: AlarmEntryView): Intent =
      Intent(ctx, AlarmService::class.java)
        .setAction(action)
        .putExtra(AlarmScheduler.EXTRA_KEY, e.key)
        .putExtra(Notifier.EXTRA_TASK_ID, e.taskId)
        .putExtra(AlarmScheduler.EXTRA_DATE, e.date)
        .putExtra(Notifier.EXTRA_TITLE, e.title)
        .putExtra(Notifier.EXTRA_BODY, e.body)
  }

  private var player: MediaPlayer? = null
  private val handler = Handler(Looper.getMainLooper())
  private val autoStop = Runnable { stopAlarm() }
  private var current: AlarmEntryView? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val view = intent?.let {
      AlarmEntryView(
        key = it.getStringExtra(AlarmScheduler.EXTRA_KEY) ?: "",
        taskId = it.getStringExtra(Notifier.EXTRA_TASK_ID) ?: "",
        date = it.getStringExtra(AlarmScheduler.EXTRA_DATE) ?: "",
        title = it.getStringExtra(Notifier.EXTRA_TITLE) ?: "",
        body = it.getStringExtra(Notifier.EXTRA_BODY) ?: "",
      )
    }

    when (intent?.action) {
      ACTION_START -> if (view != null) start(view) else stopSelf()
      Notifier.ACTION_DONE -> {
        view?.let { ActionHandler.apply(this, "done", it.taskId, it.date) }
        stopAlarm()
      }
      Notifier.ACTION_SKIP -> {
        view?.let { ActionHandler.apply(this, "skipped", it.taskId, it.date) }
        stopAlarm()
      }
      ACTION_SNOOZE -> {
        view?.let { snooze(it) }
        stopAlarm()
      }
      ACTION_STOP -> stopAlarm()
      else -> stopSelf()
    }
    return START_NOT_STICKY
  }

  private fun start(view: AlarmEntryView) {
    silence()
    current = view
    val notification = Notifier.alarmNotification(this, view)
    val id = Notifier.notificationId(view.taskId, view.date, "alarm")
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(id, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(id, notification)
    }
    play()
    vibrate()
    handler.removeCallbacks(autoStop)
    handler.postDelayed(autoStop, AUTO_STOP_MS)
  }

  private fun play() {
    val uri = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
    try {
      player = MediaPlayer().apply {
        setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
        )
        setDataSource(this@AlarmService, uri)
        isLooping = true
        prepare()
        start()
      }
    } catch (_: Exception) {
      player?.release()
      player = null // vibration + notification still alert the user
    }
  }

  @Suppress("DEPRECATION")
  private fun vibrate() {
    val vibrator = getSystemService(Vibrator::class.java) ?: return
    val pattern = longArrayOf(0, 700, 500)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0))
    } else {
      vibrator.vibrate(pattern, 0)
    }
  }

  private fun silence() {
    handler.removeCallbacks(autoStop)
    player?.run {
      try {
        stop()
      } catch (_: IllegalStateException) {
      }
      release()
    }
    player = null
    getSystemService(Vibrator::class.java)?.cancel()
  }

  private fun snooze(view: AlarmEntryView) {
    val at = System.currentTimeMillis() + SNOOZE_MINUTES * 60_000L
    val cal = Calendar.getInstance().apply { timeInMillis = at }
    val entry = AlarmEntry(
      key = "snooze:${view.taskId}",
      taskId = view.taskId,
      kind = "alarm",
      title = view.title,
      body = view.body,
      hour = cal.get(Calendar.HOUR_OF_DAY),
      minute = cal.get(Calendar.MINUTE),
      daysMask = 0,
      onceDate = null,
      offsetMin = 0,
    )
    AlarmScheduler.scheduleOneShot(this, entry, at, view.date)
  }

  private fun stopAlarm() {
    silence()
    sendBroadcast(Intent(ACTION_STOPPED_BROADCAST).setPackage(packageName))
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  override fun onDestroy() {
    silence()
    super.onDestroy()
  }
}
