/**
 * PoseEngine Interface — Abstraction layer for pose detection.
 *
 * Features MUST NOT import MediaPipe directly (spec §11).
 * All pose detection goes through this interface.
 *
 * @module pose-engine.interface
 * @version POSE_ENGINE_INTERFACE_V1
 */

import { PoseFrame, PoseSequence } from '../types/pose-frame';
import { AnalysisResult } from '../types/analysis-result';

export const VERSION = 'POSE_ENGINE_INTERFACE_V1';

/** Configuration for live camera pose detection */
export interface LivePoseConfig {
  /** Which camera to use */
  camera: 'front' | 'back';

  /**
   * Frame rate for live pose guidance overlay.
   * Separate from analysis FPS to save power and reduce heat.
   * Typically 10–15 fps for guidance, while camera runs at 30/60 fps.
   */
  guidanceFps: number;
}

/** Configuration for recorded video analysis */
export interface VideoAnalysisConfig {
  /** File URI of the recorded video */
  sourceUri: string;

  /**
   * Frame rate for analysis. Higher = more data but slower.
   * 30 fps is the standard for R-1A analysis.
   */
  analysisFps: number;
}

/** Model identification for PipelineTrace */
export interface PoseModelInfo {
  /** Model name, e.g., 'MEDIAPIPE_POSE' */
  model: string;
  /** Model file version */
  version: string;
  /** R-1A: Always 'FULL' */
  variant: 'FULL';
  /** SHA-256 hash of the exact model file */
  sha256: string;
}

/**
 * Abstraction over the pose detection backend.
 *
 * Production implementation: MediaPipePoseEngine
 * Test implementation: Only via explicit __DEV__ + POSE_ENGINE_MOCK=true
 *
 * CRITICAL: No mock fallback in production. If detection fails,
 * return AnalysisResult with status 'FAILED' and appropriate failureCode.
 */
export interface PoseEngine {
  /** Initialize the pose detection model. Must be called before detection. */
  initialize(): Promise<void>;

  /**
   * Start live pose detection from camera feed.
   * Frames are delivered at guidanceFps for real-time overlay.
   */
  startLive(config: LivePoseConfig): Promise<void>;

  /** Stop live detection and release camera resources. */
  stopLive(): Promise<void>;

  /**
   * Analyze a recorded video file end-to-end.
   * Uses VIDEO running mode for temporal tracking.
   * Same video input must produce identical output (determinism).
   */
  analyzeRecordedVideo(config: VideoAnalysisConfig): Promise<AnalysisResult>;

  /** Get model identification for PipelineTrace. */
  getModelInfo(): PoseModelInfo;

  /** Release all native resources. */
  dispose(): void;
}
