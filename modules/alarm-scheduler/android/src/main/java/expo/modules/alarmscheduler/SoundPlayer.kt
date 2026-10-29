package expo.modules.alarmscheduler

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.util.Log

/** Creates started MediaPlayers on the alarm audio stream, with a fallback chain for alarms. */
object SoundPlayer {
  private const val TAG = "RemainderAlarm"

  /**
   * Starts playing [soundUri] (content:// or file://) and returns the player, or null if nothing played.
   *
   * With [fallbackToDefault] (real alarms), a missing or unplayable sound falls back to the phone's
   * default alarm sound, then its ringtone, so an alarm is never silent because a file went missing.
   * Without it (previews), failure is reported to the caller instead of masking it with another sound.
   * A null [soundUri] means "the phone's default alarm sound".
   */
  fun create(ctx: Context, soundUri: String?, loop: Boolean, fallbackToDefault: Boolean): MediaPlayer? {
    val candidates = mutableListOf<Uri>()
    if (!soundUri.isNullOrEmpty()) candidates.add(Uri.parse(soundUri))
    if (soundUri.isNullOrEmpty() || fallbackToDefault) {
      RingtoneManager.getActualDefaultRingtoneUri(ctx, RingtoneManager.TYPE_ALARM)?.let { candidates.add(it) }
      RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)?.let { candidates.add(it) }
      RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)?.let { candidates.add(it) }
    }

    for (uri in candidates.distinct()) {
      val player = MediaPlayer()
      try {
        player.setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
        )
        player.setDataSource(ctx, uri)
        player.isLooping = loop
        player.prepare()
        player.start()
        return player
      } catch (e: Exception) {
        Log.w(TAG, "cannot play $uri: ${e.message}")
        try {
          player.release()
        } catch (_: Exception) {
        }
      }
    }
    return null
  }
}
