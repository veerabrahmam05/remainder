package expo.modules.alarmscheduler

import android.content.Context
import android.media.MediaPlayer
import android.os.Handler
import android.os.Looper

/** One short preview at a time, on the alarm volume so it matches what the real alarm will sound like. */
object SoundPreview {
  private const val MAX_PREVIEW_MS = 8000L

  private val handler = Handler(Looper.getMainLooper())
  private val autoStop = Runnable { stop() }
  private var player: MediaPlayer? = null

  /** Returns false if the sound can't be played (no fallback: the caller should tell the user). */
  @Synchronized
  fun play(ctx: Context, uri: String?): Boolean {
    stop()
    val p = SoundPlayer.create(ctx, uri, loop = false, fallbackToDefault = false) ?: return false
    p.setOnCompletionListener { stop() }
    player = p
    handler.postDelayed(autoStop, MAX_PREVIEW_MS)
    return true
  }

  @Synchronized
  fun stop() {
    handler.removeCallbacks(autoStop)
    player?.let {
      try {
        it.stop()
      } catch (_: IllegalStateException) {
      }
      it.release()
    }
    player = null
  }
}
