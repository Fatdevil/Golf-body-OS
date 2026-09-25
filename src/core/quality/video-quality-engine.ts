/**
 * video-quality-engine.ts
 * Golf-Body-OS — Video Quality Gate
 *
 * Orchestrates pre-flight quality verification on extracted pose frames
 * and video container metadata before running swing phase and kinematic analysis.
 *
 * @module quality/video-quality-engine
 * @version VIDEO_QUALITY_ENGINE_V1
 */

import { PoseFrame } from '../types/pose-frame';
import { VideoMetadata } from '../video/mp4-inspector';
import {
  QualityCheckResult,
  QualityEngineOptions,
  QualityStatus,
  QualityWarning,
} from './types';
import {
  DEFAULT_QUALITY_THRESHOLDS,
  QualityThresholds,
} from './quality-thresholds';
import { checkBodyVisibility } from './checks/body-visibility-check';
import { checkGolferSize } from './checks/golfer-size-check';
import { checkPoseCoverage } from './checks/pose-coverage-check';
import { checkVideoSuitability } from './checks/video-suitability-check';

/** Weights for composite confidence score */
const CHECK_WEIGHTS = {
  bodyVisibility: 0.30,
  golferSize: 0.15,
  poseCoverage: 0.35,
  videoSuitability: 0.20,
} as const;

function resolveOverallStatus(statuses: QualityStatus[]): QualityStatus {
  if (statuses.includes('FAIL')) return 'FAIL';
  if (statuses.includes('WARNING')) return 'WARNING';
  return 'PASS';
}

function buildSummaryMessages(
  status: QualityStatus,
  warnings: QualityWarning[]
): { summaryEn: string; summarySv: string } {
  if (status === 'PASS') {
    return {
      summaryEn: 'Video quality is excellent. Full kinematic swing analysis recommended.',
      summarySv: 'Videokvaliteten är utmärkt. Sekvensen är optimal för svinganalys och kinematik.',
    };
  }

  if (status === 'WARNING') {
    const topWarning = warnings[0];
    const topMsgSv = topWarning?.messageSv || '';
    return {
      summaryEn: `Video quality is acceptable with ${warnings.length} warning(s). Analysis can proceed, but results may have minor inaccuracies.`,
      summarySv: `Videokvaliteten är godkänd med ${warnings.length} anmärkning(ar). Analys rekommenderas, men observera: ${topMsgSv}`,
    };
  }

  const errorWarnings = warnings.filter((w) => w.severity === 'error');
  const mainErrorSv = errorWarnings[0]?.messageSv || warnings[0]?.messageSv || '';
  return {
    summaryEn: 'Video quality is insufficient for reliable golf swing analysis. Please adjust camera setup and re-record.',
    summarySv: `Videokvaliteten är otillräcklig för pålitlig svinganalys. ${mainErrorSv}`,
  };
}

/**
 * Functional entrypoint to evaluate video quality on a sequence of frames.
 */
export function evaluateVideoQuality(
  frames: PoseFrame[],
  metadata?: Partial<VideoMetadata>,
  options: QualityEngineOptions = {}
): QualityCheckResult {
  const thresholds: QualityThresholds = {
    ...DEFAULT_QUALITY_THRESHOLDS,
    ...(options.thresholds || {}),
  };

  // Run individual sub-checks
  const bodyVisibility = checkBodyVisibility(frames, thresholds);
  const golferSize = checkGolferSize(frames, thresholds);
  const poseCoverage = checkPoseCoverage(frames, thresholds);
  const videoSuitability = checkVideoSuitability(frames, metadata, thresholds);

  // Combine statuses
  const overallStatus = resolveOverallStatus([
    bodyVisibility.status,
    golferSize.status,
    poseCoverage.status,
    videoSuitability.status,
  ]);

  // Weighted composite confidence
  const rawConfidence =
    frames.length === 0
      ? 0
      : bodyVisibility.confidence * CHECK_WEIGHTS.bodyVisibility +
        golferSize.confidence * CHECK_WEIGHTS.golferSize +
        poseCoverage.confidence * CHECK_WEIGHTS.poseCoverage +
        videoSuitability.confidence * CHECK_WEIGHTS.videoSuitability;

  const confidence = Math.min(1, Math.max(0, rawConfidence));

  // Collect all warnings
  const warnings: QualityWarning[] = [
    ...bodyVisibility.warnings,
    ...golferSize.warnings,
    ...poseCoverage.warnings,
    ...videoSuitability.warnings,
  ];

  const analysisRecommended = overallStatus !== 'FAIL';
  const { summaryEn, summarySv } = buildSummaryMessages(overallStatus, warnings);

  return {
    overallStatus,
    confidence: Number(confidence.toFixed(3)),
    checks: {
      bodyVisibility,
      golferSize,
      poseCoverage,
      videoSuitability,
    },
    warnings,
    analysisRecommended,
    summaryMessageEn: summaryEn,
    summaryMessageSv: summarySv,
  };
}

/**
 * Class-based VideoQualityEngine for configurable pre-flight quality instances.
 */
export class VideoQualityEngine {
  private options: QualityEngineOptions;

  constructor(options: QualityEngineOptions = {}) {
    this.options = options;
  }

  public evaluate(
    frames: PoseFrame[],
    metadata?: Partial<VideoMetadata>
  ): QualityCheckResult {
    return evaluateVideoQuality(frames, metadata, this.options);
  }
}
