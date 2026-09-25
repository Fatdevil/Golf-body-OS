/**
 * types.ts
 * Golf-Body-OS — Video Quality Gate
 *
 * Types, status codes, warning definitions and interfaces for video quality checks.
 *
 * @module quality/types
 * @version VIDEO_QUALITY_ENGINE_V1
 */

import { VideoMetadata } from '../video/mp4-inspector';

/** Overall status for quality evaluations */
export type QualityStatus = 'PASS' | 'WARNING' | 'FAIL';

/** Severity level for a quality warning */
export type QualitySeverity = 'info' | 'warning' | 'error';

/** Error and warning identification codes */
export type QualityWarningCode =
  | 'NO_FRAMES'
  | 'LOW_REGION_VISIBILITY'
  | 'NO_LANDMARKS'
  | 'GOLFER_TOO_SMALL'
  | 'GOLFER_TOO_LARGE'
  | 'TOO_FEW_RELIABLE_FRAMES'
  | 'LOW_RELIABLE_RATIO'
  | 'VIDEO_TOO_SHORT'
  | 'VIDEO_TOO_LONG'
  | 'VIDEO_TOO_LONG_HARD'
  | 'LOW_RESOLUTION'
  | 'LANDSCAPE_ORIENTATION'
  | 'SLOW_MOTION_DETECTED';

/** Individual warning item with localized messages */
export interface QualityWarning {
  readonly code: QualityWarningCode;
  readonly message: string;
  readonly messageSv: string;
  readonly severity: QualitySeverity;
  readonly details?: Record<string, any>;
}

/** 7 anatomical body regions for pose verification */
export type BodyRegionName =
  | 'head'
  | 'shoulders'
  | 'elbows'
  | 'wrists'
  | 'hips'
  | 'knees'
  | 'ankles';

/** Visibility statistics for a single body region */
export interface BodyRegionVisibility {
  readonly region: BodyRegionName;
  /** Fraction of frames [0, 1] where at least one landmark in the region is visible */
  readonly availability: number;
  /** Average landmark confidence across frames where detected */
  readonly averageConfidence: number;
  readonly status: QualityStatus;
}

/** Result from anatomical body visibility check */
export interface BodyVisibilityResult {
  readonly status: QualityStatus;
  readonly confidence: number;
  readonly regions: BodyRegionVisibility[];
  readonly warnings: QualityWarning[];
}

/** Result from golfer size / bounding box analysis */
export interface GolferSizeResult {
  readonly status: QualityStatus;
  /** Normalized bounding-box diagonal ratio relative to frame diagonal */
  readonly bodyRatio: number;
  readonly confidence: number;
  readonly warnings: QualityWarning[];
}

/** Result from pose frame coverage analysis */
export interface PoseCoverageResult {
  readonly status: QualityStatus;
  readonly totalFrames: number;
  readonly validFrames: number;
  readonly reliableFrames: number;
  readonly reliableRatio: number;
  readonly confidence: number;
  readonly warnings: QualityWarning[];
}

/** Result from video container / metadata suitability analysis */
export interface VideoSuitabilityResult {
  readonly status: QualityStatus;
  readonly durationSec: number;
  readonly effectiveDurationSec: number;
  readonly orientation: 'portrait' | 'landscape' | 'square';
  readonly resolution?: { width: number; height: number };
  readonly nominalFps?: number;
  readonly confidence: number;
  readonly warnings: QualityWarning[];
}

/** Comprehensive result returned by VideoQualityEngine */
export interface QualityCheckResult {
  /** Overall gate status: FAIL if any check fails, WARNING if warnings present, else PASS */
  readonly overallStatus: QualityStatus;
  /** Composite confidence score [0, 1] */
  readonly confidence: number;
  /** Individual check breakdowns */
  readonly checks: {
    readonly bodyVisibility: BodyVisibilityResult;
    readonly golferSize: GolferSizeResult;
    readonly poseCoverage: PoseCoverageResult;
    readonly videoSuitability: VideoSuitabilityResult;
  };
  /** All warnings aggregated across checks */
  readonly warnings: QualityWarning[];
  /** True when quality is sufficient to proceed with swing kinematics analysis */
  readonly analysisRecommended: boolean;
  /** High-level localized summary messages */
  readonly summaryMessageEn: string;
  readonly summaryMessageSv: string;
}

/** Optional configuration overrides for VideoQualityEngine */
export interface QualityEngineOptions {
  /** Threshold customizations */
  thresholds?: Partial<import('./quality-thresholds').QualityThresholds>;
  /** Language preference for summaries ('sv-SE' | 'en-US') */
  language?: 'sv-SE' | 'en-US';
}
