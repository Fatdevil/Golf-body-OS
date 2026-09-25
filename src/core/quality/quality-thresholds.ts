/**
 * quality-thresholds.ts
 * Golf-Body-OS — Video Quality Gate
 *
 * Configurable thresholds for video quality verification.
 * Tuned for mobile camera setup and golf swing kinematic fidelity.
 *
 * @module quality/quality-thresholds
 * @version QUALITY_THRESHOLDS_V1
 */

export interface QualityThresholds {
  /** Minimum bounding-box diagonal to frame diagonal ratio (below this, golfer is too far) */
  minBodyRatio: number;

  /** Maximum bounding-box diagonal ratio (above this, limbs are likely clipped at borders) */
  maxBodyRatio: number;

  /** Minimum visibility score for an individual landmark to be considered detected */
  minLandmarkConfidence: number;

  /** Minimum frame-average landmark confidence for the frame to be 'reliable' */
  minFrameConfidence: number;

  /** Minimum ratio of reliable frames to total frames */
  minReliableFrameRatio: number;

  /** Absolute minimum number of usable frames needed for swing phase detection (P1–P10) */
  minAnalyzableFrames: number;

  /** Minimum real-time video duration in seconds */
  minVideoDurationSec: number;

  /** Maximum recommended real-time video duration in seconds */
  maxVideoDurationSec: number;

  /** Hard upper limit for video duration in seconds */
  absoluteMaxDurationSec: number;

  /** Minimum pixel dimension (width or height) recommended for pose precision */
  minResolution: number;

  /** Minimum frame availability ratio for each of the 7 anatomical regions */
  bodyRegionVisibilityThreshold: number;

  /** Number of failing body regions required to trigger a hard FAIL (otherwise WARNING) */
  maxFailedRegionsForFail: number;
}

export const DEFAULT_QUALITY_THRESHOLDS: QualityThresholds = {
  minBodyRatio: 0.15,
  maxBodyRatio: 0.98,
  minLandmarkConfidence: 0.35,
  minFrameConfidence: 0.50,
  minReliableFrameRatio: 0.60,
  minAnalyzableFrames: 15,
  minVideoDurationSec: 1.0,
  maxVideoDurationSec: 15.0,
  absoluteMaxDurationSec: 60.0,
  minResolution: 480,
  bodyRegionVisibilityThreshold: 0.55,
  maxFailedRegionsForFail: 3,
};
