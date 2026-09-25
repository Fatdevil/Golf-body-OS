import ExpoModulesCore
import MediaPipeTasksVision
import CommonCrypto

/// Golf Body OS — Native MediaPipe Pose Landmarker Module (iOS)
///
/// This Expo Module wraps MediaPipe's PoseLandmarker for iOS.
/// It supports IMAGE mode (single frame) and VIDEO mode (temporal tracking).
///
/// CRITICAL RULES:
/// - Model variant is FULL only. No silent fallback to Lite.
/// - On failure, returns error. Never fabricates landmarks.
/// - Raw results are passed to JS; all domain logic lives in TypeScript.
public class GolfBodyPoseModule: Module {

  private var poseLandmarker: PoseLandmarker?
  private var videoModeLandmarker: PoseLandmarker?
  private var modelSha256: String = ""
  private var modelVersion: String = "0.10.14"

  public func definition() -> ModuleDefinition {
    Name("GolfBodyPose")

    // MARK: - Initialize

    AsyncFunction("initialize") { () -> Void in
      try self.initializeLandmarker()
    }

    // MARK: - Detect Image (single frame, no temporal tracking)

    AsyncFunction("detectImage") { (imageData: Data, width: Int, height: Int, timestampMs: Int64) -> [String: Any] in
      guard let landmarker = self.poseLandmarker else {
        throw GolfBodyPoseError.notInitialized
      }

      let pixelBuffer = try self.createPixelBuffer(from: imageData, width: width, height: height)
      guard let mpImage = try? MPImage(pixelBuffer: pixelBuffer) else {
        throw GolfBodyPoseError.imageConversionFailed
      }

      let result = try landmarker.detect(image: mpImage)
      return self.formatResult(result: result, timestampMs: timestampMs, width: width, height: height)
    }

    // MARK: - Detect Video Frame (temporal tracking, timestamps must increase)

    AsyncFunction("detectVideoFrame") { (imageData: Data, width: Int, height: Int, timestampMs: Int64) -> [String: Any] in
      guard let landmarker = self.videoModeLandmarker else {
        throw GolfBodyPoseError.notInitialized
      }

      let pixelBuffer = try self.createPixelBuffer(from: imageData, width: width, height: height)
      guard let mpImage = try? MPImage(pixelBuffer: pixelBuffer) else {
        throw GolfBodyPoseError.imageConversionFailed
      }

      let result = try landmarker.detect(
        videoFrame: mpImage,
        timestampInMilliseconds: Int(timestampMs)
      )
      return self.formatResult(result: result, timestampMs: timestampMs, width: width, height: height)
    }

    // MARK: - Model Info

    Function("getModelInfo") { () -> [String: Any] in
      return [
        "model": "MEDIAPIPE_POSE",
        "version": self.modelVersion,
        "variant": "FULL",
        "sha256": self.modelSha256,
      ]
    }

    // MARK: - Reset Video Mode

    AsyncFunction("resetVideoMode") { () -> Void in
      // Re-initialize the video mode landmarker to clear temporal state
      try self.initializeVideoModeLandmarker()
    }

    // MARK: - Dispose

    AsyncFunction("dispose") { () -> Void in
      self.poseLandmarker = nil
      self.videoModeLandmarker = nil
    }
  }

  // MARK: - Private: Initialization

  /// The podspec ships the model via `s.resources`: it lands in the main app
  /// bundle for static pods (Expo default) but inside the module's framework
  /// bundle when pods are built as frameworks (`use_frameworks!`).
  private func findModelPath() -> String? {
    return Bundle.main.path(forResource: "pose_landmarker_full", ofType: "task")
      ?? Bundle(for: GolfBodyPoseModule.self).path(forResource: "pose_landmarker_full", ofType: "task")
  }

  private func initializeLandmarker() throws {
    guard let modelPath = self.findModelPath() else {
      throw GolfBodyPoseError.modelNotFound
    }

    // Compute SHA-256 for PipelineTrace reproducibility
    self.modelSha256 = try self.sha256OfFile(at: modelPath)

    // IMAGE mode landmarker
    let imageOptions = PoseLandmarkerOptions()
    imageOptions.baseOptions.modelAssetPath = modelPath
    imageOptions.runningMode = .image
    imageOptions.numPoses = 1
    imageOptions.minPoseDetectionConfidence = 0.5
    imageOptions.minPosePresenceConfidence = 0.5
    imageOptions.minTrackingConfidence = 0.5

    self.poseLandmarker = try PoseLandmarker(options: imageOptions)

    // VIDEO mode landmarker (separate instance for temporal tracking)
    try self.initializeVideoModeLandmarker()
  }

  private func initializeVideoModeLandmarker() throws {
    guard let modelPath = self.findModelPath() else {
      throw GolfBodyPoseError.modelNotFound
    }

    let videoOptions = PoseLandmarkerOptions()
    videoOptions.baseOptions.modelAssetPath = modelPath
    videoOptions.runningMode = .video
    videoOptions.numPoses = 1
    videoOptions.minPoseDetectionConfidence = 0.5
    videoOptions.minPosePresenceConfidence = 0.5
    videoOptions.minTrackingConfidence = 0.5

    self.videoModeLandmarker = try PoseLandmarker(options: videoOptions)
  }

  // MARK: - Private: Result Formatting

  /// Converts MediaPipe result to flat arrays for efficient JS bridge transfer.
  /// Format: [id, x, y, z, visibility, presence] × 33 landmarks
  private func formatResult(
    result: PoseLandmarkerResult,
    timestampMs: Int64,
    width: Int,
    height: Int
  ) -> [String: Any] {
    var landmarks: [Double] = []
    var worldLandmarks: [Double] = []

    if let firstPose = result.landmarks.first {
      for (index, landmark) in firstPose.enumerated() {
        landmarks.append(contentsOf: [
          Double(index),
          Double(landmark.x),
          Double(landmark.y),
          Double(landmark.z),
          Double(landmark.visibility?.doubleValue ?? 0.0),
          Double(landmark.presence?.doubleValue ?? 0.0),
        ])
      }
    }

    if let firstWorldPose = result.worldLandmarks.first {
      for (index, landmark) in firstWorldPose.enumerated() {
        worldLandmarks.append(contentsOf: [
          Double(index),
          Double(landmark.x),
          Double(landmark.y),
          Double(landmark.z),
          Double(landmark.visibility?.doubleValue ?? 0.0),
          Double(landmark.presence?.doubleValue ?? 0.0),
        ])
      }
    }

    return [
      "landmarks": landmarks,
      "worldLandmarks": worldLandmarks,
      "timestampMs": timestampMs,
      "width": width,
      "height": height,
    ]
  }

  // MARK: - Private: Pixel Buffer Creation

  /// Builds a 32BGRA pixel buffer (a format MPImage accepts) from tightly
  /// packed RGB input, copying row by row: CoreVideo pads rows, so a single
  /// contiguous copy would shear the image whenever bytesPerRow > width * 4.
  private func createPixelBuffer(from data: Data, width: Int, height: Int) throws -> CVPixelBuffer {
    let expectedBytes = width * height * 3
    guard data.count == expectedBytes else {
      throw GolfBodyPoseError.invalidBufferSize(expected: expectedBytes, actual: data.count)
    }

    var pixelBuffer: CVPixelBuffer?
    let attrs: [String: Any] = [
      kCVPixelBufferCGImageCompatibilityKey as String: true,
      kCVPixelBufferCGBitmapContextCompatibilityKey as String: true,
    ]

    let status = CVPixelBufferCreate(
      kCFAllocatorDefault,
      width,
      height,
      kCVPixelFormatType_32BGRA,
      attrs as CFDictionary,
      &pixelBuffer
    )

    guard status == kCVReturnSuccess, let buffer = pixelBuffer else {
      throw GolfBodyPoseError.imageConversionFailed
    }

    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }

    guard let baseAddress = CVPixelBufferGetBaseAddress(buffer) else {
      throw GolfBodyPoseError.imageConversionFailed
    }

    let dstBytesPerRow = CVPixelBufferGetBytesPerRow(buffer)
    let dst = baseAddress.assumingMemoryBound(to: UInt8.self)
    data.withUnsafeBytes { (raw: UnsafeRawBufferPointer) in
      guard let src = raw.bindMemory(to: UInt8.self).baseAddress else { return }
      for y in 0..<height {
        let srcRow = src + y * width * 3
        let dstRow = dst + y * dstBytesPerRow
        for x in 0..<width {
          let s = srcRow + x * 3
          let d = dstRow + x * 4
          d[0] = s[2] // B
          d[1] = s[1] // G
          d[2] = s[0] // R
          d[3] = 255  // A
        }
      }
    }

    return buffer
  }

  // MARK: - Private: SHA-256

  private func sha256OfFile(at path: String) throws -> String {
    let data = try Data(contentsOf: URL(fileURLWithPath: path))
    var hash = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
    data.withUnsafeBytes { bytes in
      _ = CC_SHA256(bytes.baseAddress, CC_LONG(data.count), &hash)
    }
    return hash.map { String(format: "%02x", $0) }.joined()
  }
}

// MARK: - Errors

enum GolfBodyPoseError: Error, LocalizedError {
  case notInitialized
  case modelNotFound
  case imageConversionFailed
  case invalidBufferSize(expected: Int, actual: Int)
  case inferenceError(String)

  var errorDescription: String? {
    switch self {
    case .notInitialized:
      return "PoseLandmarker not initialized. Call initialize() first."
    case .modelNotFound:
      return "pose_landmarker_full.task not found in app bundle."
    case .imageConversionFailed:
      return "Failed to convert image data to MPImage."
    case .invalidBufferSize(let expected, let actual):
      return "Invalid buffer size: expected \(expected) bytes (width*height*3), got \(actual) bytes."
    case .inferenceError(let message):
      return "MediaPipe inference failed: \(message)"
    }
  }
}
