package expo.modules.golfbodypose

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.exception.CodedException
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerOptions
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import java.io.File
import java.security.MessageDigest

/**
 * Golf Body OS — Native MediaPipe Pose Landmarker Module (Android)
 *
 * This Expo Module wraps MediaPipe's PoseLandmarker for Android.
 * Supports IMAGE mode (single frame) and VIDEO mode (temporal tracking).
 *
 * CRITICAL RULES:
 * - Model variant is FULL only. No silent fallback to Lite.
 * - On failure, throws exception. Never fabricates landmarks.
 * - Raw results passed to JS; all domain logic lives in TypeScript.
 */
class GolfBodyPoseModule : Module() {

  private var imageLandmarker: PoseLandmarker? = null
  private var videoLandmarker: PoseLandmarker? = null
  private var modelSha256: String = ""
  private var modelVersion: String = "0.10.14"

  override fun definition() = ModuleDefinition {
    Name("GolfBodyPose")

    // Initialize the PoseLandmarker with bundled Full model
    AsyncFunction("initialize") {
      initializeLandmarker()
    }

    // Detect pose in a single image frame (IMAGE mode)
    AsyncFunction("detectImage") { imageData: ByteArray, width: Int, height: Int, timestampMs: Long ->
      val landmarker = imageLandmarker
        ?: throw CodedException("ERR_NOT_INITIALIZED", "PoseLandmarker not initialized. Call initialize() first.", null)

      val bitmap = createBitmap(imageData, width, height)
      val mpImage = BitmapImageBuilder(bitmap).build()
      val result = landmarker.detect(mpImage)

      formatResult(result, timestampMs, width, height)
    }

    // Detect pose in a video frame (VIDEO mode with temporal tracking)
    AsyncFunction("detectVideoFrame") { imageData: ByteArray, width: Int, height: Int, timestampMs: Long ->
      val landmarker = videoLandmarker
        ?: throw CodedException("ERR_NOT_INITIALIZED", "PoseLandmarker not initialized. Call initialize() first.", null)

      val bitmap = createBitmap(imageData, width, height)
      val mpImage = BitmapImageBuilder(bitmap).build()
      val result = landmarker.detectForVideo(mpImage, timestampMs)

      formatResult(result, timestampMs, width, height)
    }

    // Get model identification info for PipelineTrace
    Function("getModelInfo") {
      mapOf(
        "model" to "MEDIAPIPE_POSE",
        "version" to modelVersion,
        "variant" to "FULL",
        "sha256" to modelSha256
      )
    }

    // Reset video mode temporal state
    AsyncFunction("resetVideoMode") {
      initializeVideoModeLandmarker()
    }

    // Release all native resources
    AsyncFunction("dispose") {
      imageLandmarker?.close()
      videoLandmarker?.close()
      imageLandmarker = null
      videoLandmarker = null
    }
  }

  // MARK: - Initialization

  private fun initializeLandmarker() {
    val context = appContext.reactContext
      ?: throw CodedException("ERR_NO_CONTEXT", "React context not available", null)

    val modelFileName = "pose_landmarker_full.task"

    // Compute SHA-256 for reproducibility tracking
    modelSha256 = computeModelSha256(context, modelFileName)

    // IMAGE mode landmarker
    val imageOptions = PoseLandmarkerOptions.builder()
      .setBaseOptions(
        BaseOptions.builder()
          .setModelAssetPath(modelFileName)
          .build()
      )
      .setRunningMode(RunningMode.IMAGE)
      .setNumPoses(1)
      .setMinPoseDetectionConfidence(0.5f)
      .setMinPosePresenceConfidence(0.5f)
      .setMinTrackingConfidence(0.5f)
      .build()

    imageLandmarker = PoseLandmarker.createFromOptions(context, imageOptions)

    // VIDEO mode landmarker (separate instance)
    initializeVideoModeLandmarker()
  }

  private fun initializeVideoModeLandmarker() {
    val context = appContext.reactContext
      ?: throw CodedException("ERR_NO_CONTEXT", "React context not available", null)

    videoLandmarker?.close()

    val videoOptions = PoseLandmarkerOptions.builder()
      .setBaseOptions(
        BaseOptions.builder()
          .setModelAssetPath("pose_landmarker_full.task")
          .build()
      )
      .setRunningMode(RunningMode.VIDEO)
      .setNumPoses(1)
      .setMinPoseDetectionConfidence(0.5f)
      .setMinPosePresenceConfidence(0.5f)
      .setMinTrackingConfidence(0.5f)
      .build()

    videoLandmarker = PoseLandmarker.createFromOptions(context, videoOptions)
  }

  // MARK: - Result Formatting

  /**
   * Converts MediaPipe result to flat arrays for efficient JS bridge transfer.
   * Format: [id, x, y, z, visibility, presence] × 33 landmarks
   */
  private fun formatResult(
    result: com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult,
    timestampMs: Long,
    width: Int,
    height: Int
  ): Map<String, Any> {
    val landmarks = mutableListOf<Double>()
    val worldLandmarks = mutableListOf<Double>()

    result.landmarks().firstOrNull()?.forEachIndexed { index, landmark ->
      landmarks.addAll(listOf(
        index.toDouble(),
        landmark.x().toDouble(),
        landmark.y().toDouble(),
        landmark.z().toDouble(),
        (landmark.visibility().orElse(0f)).toDouble(),
        (landmark.presence().orElse(0f)).toDouble()
      ))
    }

    result.worldLandmarks().firstOrNull()?.forEachIndexed { index, landmark ->
      worldLandmarks.addAll(listOf(
        index.toDouble(),
        landmark.x().toDouble(),
        landmark.y().toDouble(),
        landmark.z().toDouble(),
        (landmark.visibility().orElse(0f)).toDouble(),
        (landmark.presence().orElse(0f)).toDouble()
      ))
    }

    return mapOf(
      "landmarks" to landmarks,
      "worldLandmarks" to worldLandmarks,
      "timestampMs" to timestampMs,
      "width" to width,
      "height" to height
    )
  }

  // MARK: - Bitmap Creation

  private fun createBitmap(data: ByteArray, width: Int, height: Int): Bitmap {
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val pixels = IntArray(width * height)

    // Convert RGB byte array to ARGB int array
    for (i in pixels.indices) {
      val offset = i * 3
      if (offset + 2 < data.size) {
        val r = data[offset].toInt() and 0xFF
        val g = data[offset + 1].toInt() and 0xFF
        val b = data[offset + 2].toInt() and 0xFF
        pixels[i] = (0xFF shl 24) or (r shl 16) or (g shl 8) or b
      }
    }

    bitmap.setPixels(pixels, 0, width, 0, 0, width, height)
    return bitmap
  }

  // MARK: - SHA-256

  private fun computeModelSha256(context: android.content.Context, assetName: String): String {
    return try {
      val digest = MessageDigest.getInstance("SHA-256")
      context.assets.open(assetName).use { inputStream ->
        val buffer = ByteArray(8192)
        var bytesRead: Int
        while (inputStream.read(buffer).also { bytesRead = it } != -1) {
          digest.update(buffer, 0, bytesRead)
        }
      }
      digest.digest().joinToString("") { "%02x".format(it) }
    } catch (e: Exception) {
      "UNKNOWN"
    }
  }
}
