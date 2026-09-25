/**
 * video-suitability-check.ts
 * Golf-Body-OS — Video Quality Gate
 *
 * Verifies container-level properties:
 * - Real-time duration (handling slow-motion factors gracefully)
 * - Video orientation (portrait vs. landscape)
 * - Resolution adequacy (>= 480p minimum dimension)
 *
 * @module quality/checks/video-suitability-check
 */

import { VideoMetadata } from '../../video/mp4-inspector';
import { PoseFrame } from '../../types/pose-frame';
import { QualityThresholds, DEFAULT_QUALITY_THRESHOLDS } from '../quality-thresholds';
import { VideoSuitabilityResult, QualityStatus, QualityWarning } from '../types';

export function checkVideoSuitability(
  frames: PoseFrame[],
  metadata?: Partial<VideoMetadata>,
  thresholds: QualityThresholds = DEFAULT_QUALITY_THRESHOLDS
): VideoSuitabilityResult {
  const warnings: QualityWarning[] = [];
  let status: QualityStatus = 'PASS';

  // 1. Determine dimensions and orientation
  const width = metadata?.width ?? (frames[0]?.width || 1080);
  const height = metadata?.height ?? (frames[0]?.height || 1920);

  let orientation: 'portrait' | 'landscape' | 'square' = 'portrait';
  if (width > height) {
    orientation = 'landscape';
  } else if (width === height) {
    orientation = 'square';
  }

  // 2. Determine raw duration and effective duration
  let durationSec = metadata?.durationSec ?? 0;
  const firstFrame = frames[0];
  const lastFrame = frames[frames.length - 1];
  if (durationSec <= 0 && firstFrame && lastFrame && frames.length >= 2) {
    const startMs = firstFrame.timestampMs;
    const endMs = lastFrame.timestampMs;
    durationSec = Math.max(0, (endMs - startMs) / 1000);
  }

  const slowMoFactor = metadata?.slowMotionFactor ?? (metadata?.isSlowMotion ? 4 : 1);
  const effectiveDurationSec = durationSec > 0 ? durationSec / Math.max(1, slowMoFactor) : 0;

  // 3. Duration checks
  if (effectiveDurationSec < thresholds.minVideoDurationSec) {
    status = 'FAIL';
    warnings.push({
      code: 'VIDEO_TOO_SHORT',
      message: `Video duration is too short (${effectiveDurationSec.toFixed(1)}s real-time, minimum: ${thresholds.minVideoDurationSec}s).`,
      messageSv: `Videoklippet är för kort (${effectiveDurationSec.toFixed(1)}s, krav: minst ${thresholds.minVideoDurationSec}s). Spela in hela rörelsen från adressering till avslut.`,
      severity: 'error',
      details: { effectiveDurationSec, minDuration: thresholds.minVideoDurationSec },
    });
  } else if (effectiveDurationSec > thresholds.absoluteMaxDurationSec) {
    status = 'FAIL';
    warnings.push({
      code: 'VIDEO_TOO_LONG_HARD',
      message: `Video exceeds absolute maximum duration (${effectiveDurationSec.toFixed(1)}s, max: ${thresholds.absoluteMaxDurationSec}s).`,
      messageSv: `Videoklippet är för långt (${effectiveDurationSec.toFixed(1)}s, max: ${thresholds.absoluteMaxDurationSec}s). Trimma klippet närmare själva svingen.`,
      severity: 'error',
      details: { effectiveDurationSec, maxDuration: thresholds.absoluteMaxDurationSec },
    });
  } else if (effectiveDurationSec > thresholds.maxVideoDurationSec) {
    status = 'WARNING';
    warnings.push({
      code: 'VIDEO_TOO_LONG',
      message: `Video duration (${effectiveDurationSec.toFixed(1)}s) is longer than recommended (${thresholds.maxVideoDurationSec}s). Trim clip to improve processing speed and accuracy.`,
      messageSv: `Klippet är längre än rekommenderat (${effectiveDurationSec.toFixed(1)}s, rekommenderat: max ${thresholds.maxVideoDurationSec}s). Trimma gärna klippet för snabbare och mer exakt analys.`,
      severity: 'warning',
      details: { effectiveDurationSec, maxRecommended: thresholds.maxVideoDurationSec },
    });
  }

  // 4. Orientation check
  if (orientation === 'landscape') {
    if (status !== 'FAIL') status = 'WARNING';
    warnings.push({
      code: 'LANDSCAPE_ORIENTATION',
      message: 'Video is recorded in landscape orientation. Portrait mode is recommended to keep full swing and club path in view.',
      messageSv: 'Videon är inspelad i liggande format. Stående format (porträtt) rekommenderas starkt för golfsvingar.',
      severity: 'warning',
      details: { orientation, width, height },
    });
  }

  // 5. Resolution check
  const minDim = Math.min(width, height);
  if (minDim > 0 && minDim < thresholds.minResolution) {
    if (status !== 'FAIL') status = 'WARNING';
    warnings.push({
      code: 'LOW_RESOLUTION',
      message: `Video resolution is low (${width}×${height}). Minimum recommended dimension is ${thresholds.minResolution}px.`,
      messageSv: `Videoupplösningen är låg (${width}×${height}). Rekommenderad minsta dimension är ${thresholds.minResolution}px för tillförlitlig leddetektering.`,
      severity: 'warning',
      details: { minDim, recommended: thresholds.minResolution },
    });
  }

  // 6. Slow motion notification (info severity)
  if (metadata?.isSlowMotion || slowMoFactor > 1) {
    warnings.push({
      code: 'SLOW_MOTION_DETECTED',
      message: `Slow-motion video recognized (${slowMoFactor}x slowdown). Effective real-time swing duration: ${effectiveDurationSec.toFixed(1)}s.`,
      messageSv: `Slow-motion-video identifierad (${slowMoFactor}x saktning). Effektiv svingtid: ${effectiveDurationSec.toFixed(1)}s.`,
      severity: 'info',
      details: { slowMoFactor, effectiveDurationSec },
    });
  }

  // Confidence assessment
  let confidence = 1.0;
  if (frames.length === 0 && (!metadata || !metadata.durationSec)) {
    confidence = 0;
  } else if (status === 'FAIL') {
    confidence = 0.25;
  } else if (status === 'WARNING') {
    confidence = 0.75;
  }

  return {
    status,
    durationSec,
    effectiveDurationSec,
    orientation,
    resolution: { width, height },
    nominalFps: metadata?.nominalFps,
    confidence,
    warnings,
  };
}
