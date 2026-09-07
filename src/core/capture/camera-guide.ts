/**
 * Camera Guide — Real-time camera setup validation.
 *
 * Analyzes pose landmarks and device IMU to determine if the camera
 * setup is adequate for a reliable body test. The START button
 * MUST be disabled until GOOD_READY is maintained for ≥ 15 frames.
 *
 * R-1A: Standardized LEFT side toward camera (correction #6).
 * Only near-side (LEFT) landmarks are required.
 *
 * @module camera-guide
 * @version CAMERA_GUIDE_V1
 */

import { Landmark, LandmarkId } from '../types/landmark';
import { PoseFrame } from '../types/pose-frame';
import { TestProtocol } from '../types/protocol';

export const VERSION = 'CAMERA_GUIDE_V1';

/** Camera guidance instructions for the user */
export type CameraGuidance =
  | 'MOVE_BACK'
  | 'MOVE_CLOSER'
  | 'RAISE_PHONE'
  | 'LOWER_PHONE'
  | 'TURN_SIDEWAYS'
  | 'FULL_BODY_NOT_VISIBLE'
  | 'CAMERA_TILTED'
  | 'GOOD_READY';

/** Result of camera guide analysis for a single frame */
export interface CameraGuideResult {
  /** Primary guidance instruction */
  guidance: CameraGuidance;
  /** True only when GOOD_READY maintained for required consecutive frames */
  isReady: boolean;
  /** Detailed diagnostics */
  details: {
    /** All near-side required landmarks visible above threshold */
    nearSideBodyInFrame: boolean;
    /** Body height as ratio of frame height (ideal: 0.50–0.85) */
    bodySizeRatio: number;
    /** Body center position in normalized coords */
    bodyCenter: { x: number; y: number };
    /** True if side-view confirmed (left shoulder much more visible than right) */
    isSideView: boolean;
    /** Phone tilt from vertical in degrees (from IMU) */
    phoneTiltDegrees: number;
    /** How many consecutive frames have been GOOD_READY */
    consecutiveReadyFrames: number;
  };
}

/** Configuration for the camera guide */
export interface CameraGuideConfig {
  /** Minimum body height ratio (body too small → MOVE_CLOSER). Default: 0.50 */
  minBodySizeRatio: number;
  /** Maximum body height ratio (body too large → MOVE_BACK). Default: 0.85 */
  maxBodySizeRatio: number;
  /** Minimum landmark visibility to be considered "visible". Default: 0.5 */
  minLandmarkVisibility: number;
  /** Maximum phone tilt from vertical (degrees). Default: 10 */
  maxPhoneTilt: number;
  /** Frames required at GOOD_READY before isReady=true. Default: 15 */
  readyFrameThreshold: number;
  /** Side-view visibility ratio (near/far shoulder). Default: 1.5 */
  sideViewVisibilityRatio: number;
  /** Max vertical offset of body center from frame center. Default: 0.15 */
  maxVerticalOffset: number;
}

export const DEFAULT_CAMERA_GUIDE_CONFIG: CameraGuideConfig = {
  minBodySizeRatio: 0.50,
  maxBodySizeRatio: 0.85,
  minLandmarkVisibility: 0.5,
  maxPhoneTilt: 10,
  readyFrameThreshold: 15,
  sideViewVisibilityRatio: 1.5,
  maxVerticalOffset: 0.15,
};

/**
 * Evaluates camera setup quality for a body test.
 */
export class CameraGuide {
  private config: CameraGuideConfig;
  private protocol: TestProtocol;
  private consecutiveReadyFrames = 0;

  constructor(protocol: TestProtocol, config: Partial<CameraGuideConfig> = {}) {
    this.config = { ...DEFAULT_CAMERA_GUIDE_CONFIG, ...config };
    this.protocol = protocol;
  }

  /**
   * Analyze a single frame for camera setup quality.
   *
   * @param frame - Current pose frame with landmarks
   * @param phoneTiltDegrees - Current phone tilt from IMU
   * @returns Camera guide result with guidance instruction
   */
  analyze(frame: PoseFrame, phoneTiltDegrees: number): CameraGuideResult {
    const details = this.computeDetails(frame, phoneTiltDegrees);
    const guidance = this.determineGuidance(details);

    if (guidance === 'GOOD_READY') {
      this.consecutiveReadyFrames++;
    } else {
      this.consecutiveReadyFrames = 0;
    }

    details.consecutiveReadyFrames = this.consecutiveReadyFrames;

    return {
      guidance,
      isReady: this.consecutiveReadyFrames >= this.config.readyFrameThreshold,
      details,
    };
  }

  /** Reset the consecutive ready frame counter */
  reset(): void {
    this.consecutiveReadyFrames = 0;
  }

  // ---- Private ----

  private computeDetails(
    frame: PoseFrame,
    phoneTiltDegrees: number,
  ): CameraGuideResult['details'] {
    // Check near-side landmarks visibility
    const nearSideBodyInFrame = this.protocol.requiredNearSideLandmarks.every((id) => {
      const lm = frame.landmarks.find((l) => l.id === id);
      return lm !== undefined && (lm.visibility ?? 0) >= this.config.minLandmarkVisibility;
    });

    // Compute body bounding box from visible landmarks
    const visibleLandmarks = frame.landmarks.filter(
      (l) => (l.visibility ?? 0) >= this.config.minLandmarkVisibility,
    );

    let minY = 1;
    let maxY = 0;
    let sumX = 0;
    let sumY = 0;

    for (const lm of visibleLandmarks) {
      minY = Math.min(minY, lm.y);
      maxY = Math.max(maxY, lm.y);
      sumX += lm.x;
      sumY += lm.y;
    }

    const bodySizeRatio = visibleLandmarks.length > 0 ? maxY - minY : 0;
    const bodyCenter =
      visibleLandmarks.length > 0
        ? { x: sumX / visibleLandmarks.length, y: sumY / visibleLandmarks.length }
        : { x: 0.5, y: 0.5 };

    // Side-view detection: compare near-side vs far-side shoulder visibility
    const isSideView = this.checkSideView(frame);

    return {
      nearSideBodyInFrame,
      bodySizeRatio,
      bodyCenter,
      isSideView,
      phoneTiltDegrees,
      consecutiveReadyFrames: this.consecutiveReadyFrames,
    };
  }

  private checkSideView(frame: PoseFrame): boolean {
    // For LEFT standardized side: LEFT_SHOULDER should be much more visible than RIGHT_SHOULDER
    const nearShoulder = frame.landmarks.find(
      (l) => l.id === LandmarkId.LEFT_SHOULDER,
    );
    const farShoulder = frame.landmarks.find(
      (l) => l.id === LandmarkId.RIGHT_SHOULDER,
    );

    const nearVis = nearShoulder?.visibility ?? 0;
    const farVis = farShoulder?.visibility ?? 0;

    // If far side has very low visibility OR near/far ratio is high, it's a side view
    if (farVis < 0.1) return true;
    if (nearVis / Math.max(farVis, 0.01) >= this.config.sideViewVisibilityRatio) return true;

    return false;
  }

  private determineGuidance(
    details: CameraGuideResult['details'],
  ): CameraGuidance {
    // Priority order: most critical issues first

    // 1. Full body not visible
    if (!details.nearSideBodyInFrame) {
      return 'FULL_BODY_NOT_VISIBLE';
    }

    // 2. Camera tilted
    if (details.phoneTiltDegrees > this.config.maxPhoneTilt) {
      return 'CAMERA_TILTED';
    }

    // 3. Not side view
    if (!details.isSideView) {
      return 'TURN_SIDEWAYS';
    }

    // 4. Body too large
    if (details.bodySizeRatio > this.config.maxBodySizeRatio) {
      return 'MOVE_BACK';
    }

    // 5. Body too small
    if (details.bodySizeRatio < this.config.minBodySizeRatio) {
      return 'MOVE_CLOSER';
    }

    // 6. Body too high or too low
    const verticalOffset = Math.abs(details.bodyCenter.y - 0.5);
    if (verticalOffset > this.config.maxVerticalOffset) {
      if (details.bodyCenter.y < 0.5) {
        return 'LOWER_PHONE'; // Body is in upper part → phone is too high
      }
      return 'RAISE_PHONE'; // Body is in lower part → phone is too low
    }

    // All checks pass
    return 'GOOD_READY';
  }
}
