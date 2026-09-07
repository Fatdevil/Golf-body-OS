/**
 * golf-body-pose — Local Expo Module
 *
 * Native MediaPipe Pose Landmarker integration for Golf Body OS.
 * This module owns all native MediaPipe code, keeping it:
 * - Isolated from the generated ios/ and android/ app directories
 * - Testable independently
 * - CNG-safe (Continuous Native Generation)
 * - Reusable for future projects (e.g., Swing analysis)
 *
 * @module golf-body-pose
 * @version 0.1.0
 */

import { requireNativeModule } from 'expo-modules-core';

/** Raw landmark data from native MediaPipe inference */
export interface NativeLandmarkResult {
  /** Flat array: [id, x, y, z, visibility, presence, ...] × 33 landmarks = 198 elements */
  landmarks: number[];
  /** World landmarks in meters, hip-centered origin. Same flat format. */
  worldLandmarks: number[];
  /** Timestamp of the processed frame in milliseconds */
  timestampMs: number;
  /** Frame dimensions */
  width: number;
  height: number;
}

/** Model identification for PipelineTrace */
export interface NativeModelInfo {
  /** Model name, e.g., 'MEDIAPIPE_POSE' */
  model: string;
  /** Model file version string */
  version: string;
  /** R-1A: Always 'FULL'. No silent variant switching allowed. */
  variant: 'FULL';
  /** SHA-256 hash of the bundled model file for exact reproducibility */
  sha256: string;
}

/**
 * Status of the native pose engine initialization.
 */
export type NativeInitStatus = 'UNINITIALIZED' | 'INITIALIZING' | 'READY' | 'ERROR';

// Access the native module. This will throw if native code is not linked
// (e.g., running in Expo Go — which is not supported for this project).
const GolfBodyPose = requireNativeModule('GolfBodyPose');

/**
 * Initialize the MediaPipe PoseLandmarker with the bundled Full model.
 * Must be called before any detection methods.
 * @throws If the model file is missing or MediaPipe initialization fails.
 */
export async function initialize(): Promise<void> {
  return GolfBodyPose.initialize();
}

/**
 * Process a single image frame (IMAGE mode).
 * Used for individual frame analysis in Measurement Lab.
 *
 * @param imageData - Raw pixel data (RGB format)
 * @param width - Frame width in pixels
 * @param height - Frame height in pixels
 * @param timestampMs - Frame timestamp in milliseconds
 * @returns Landmark detection result
 */
export async function detectImage(
  imageData: ArrayBuffer,
  width: number,
  height: number,
  timestampMs: number,
): Promise<NativeLandmarkResult> {
  return GolfBodyPose.detectImage(imageData, width, height, timestampMs);
}

/**
 * Process a video frame (VIDEO mode).
 * Uses MediaPipe's temporal tracking for better consistency.
 * Timestamps MUST be monotonically increasing.
 *
 * @param imageData - Raw pixel data (RGB format)
 * @param width - Frame width in pixels
 * @param height - Frame height in pixels
 * @param timestampMs - Frame timestamp (must increase with each call)
 * @returns Landmark detection result
 */
export async function detectVideoFrame(
  imageData: ArrayBuffer,
  width: number,
  height: number,
  timestampMs: number,
): Promise<NativeLandmarkResult> {
  return GolfBodyPose.detectVideoFrame(imageData, width, height, timestampMs);
}

/**
 * Get information about the loaded pose model.
 * Used to populate PipelineTrace with exact model identification.
 *
 * @returns Model name, version, variant ('FULL'), and SHA-256 hash
 */
export function getModelInfo(): NativeModelInfo {
  return GolfBodyPose.getModelInfo();
}

/**
 * Reset the video mode tracker state.
 * Call between different video analyses to ensure clean temporal tracking.
 */
export async function resetVideoMode(): Promise<void> {
  return GolfBodyPose.resetVideoMode();
}

/**
 * Release all native resources (model, GPU delegate, buffers).
 * Call when the pose engine is no longer needed.
 */
export async function dispose(): Promise<void> {
  return GolfBodyPose.dispose();
}
