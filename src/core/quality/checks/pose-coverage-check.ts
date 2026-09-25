/**
 * pose-coverage-check.ts
 * Golf-Body-OS — Video Quality Gate
 *
 * Verifies tracking continuity across the sequence:
 * total frames, frames with detected landmarks, reliable frames (high confidence),
 * and checks against minimum required frames for swing analysis.
 *
 * @module quality/checks/pose-coverage-check
 */

import { PoseFrame } from '../../types/pose-frame';
import { QualityThresholds, DEFAULT_QUALITY_THRESHOLDS } from '../quality-thresholds';
import { PoseCoverageResult, QualityStatus, QualityWarning } from '../types';

export function checkPoseCoverage(
  frames: PoseFrame[],
  thresholds: QualityThresholds = DEFAULT_QUALITY_THRESHOLDS
): PoseCoverageResult {
  const totalFrames = frames.length;
  const warnings: QualityWarning[] = [];

  if (totalFrames === 0) {
    return {
      status: 'FAIL',
      totalFrames: 0,
      validFrames: 0,
      reliableFrames: 0,
      reliableRatio: 0,
      confidence: 0,
      warnings: [
        {
          code: 'NO_FRAMES',
          message: 'Zero frames provided for pose coverage evaluation.',
          messageSv: 'Inga bildrutor levererades för granskning av spårningstäckning.',
          severity: 'error',
        },
      ],
    };
  }

  let validFrames = 0;
  let reliableFrames = 0;

  for (const frame of frames) {
    const lms = frame.landmarks;
    if (!lms || lms.length === 0) continue;

    validFrames++;

    let confSum = 0;
    for (const lm of lms) {
      confSum += lm.visibility ?? lm.presence ?? 1.0;
    }
    const avgConf = confSum / lms.length;

    if (avgConf >= thresholds.minFrameConfidence) {
      reliableFrames++;
    }
  }

  const reliableRatio = reliableFrames / totalFrames;
  let status: QualityStatus = 'PASS';

  if (reliableFrames < thresholds.minAnalyzableFrames) {
    status = 'FAIL';
    warnings.push({
      code: 'TOO_FEW_RELIABLE_FRAMES',
      message: `Only ${reliableFrames} reliable pose frames detected (minimum required: ${thresholds.minAnalyzableFrames}).`,
      messageSv: `Endast ${reliableFrames} pålitliga bildrutor hittades (krav: minst ${thresholds.minAnalyzableFrames} st). Svingen kan inte analyseras säkert.`,
      severity: 'error',
      details: { reliableFrames, minRequired: thresholds.minAnalyzableFrames },
    });
  }

  if (reliableRatio < thresholds.minReliableFrameRatio) {
    if (status !== 'FAIL') {
      status = 'WARNING';
    }
    const pct = Math.round(reliableRatio * 100);
    const req = Math.round(thresholds.minReliableFrameRatio * 100);
    warnings.push({
      code: 'LOW_RELIABLE_RATIO',
      message: `Only ${pct}% of frames have high-confidence tracking (recommended: ${req}%). Lighting or background clutter may affect results.`,
      messageSv: `Bara ${pct}% av bildrutorna har tillräckligt hög säkerhet (rekommenderat: minst ${req}%). Förbättra belysningen eller undvik motljus för bättre resultat.`,
      severity: 'warning',
      details: { reliableRatio, minRequired: thresholds.minReliableFrameRatio },
    });
  }

  const confidence = Math.min(1, Math.max(0, reliableRatio / thresholds.minReliableFrameRatio));

  return {
    status,
    totalFrames,
    validFrames,
    reliableFrames,
    reliableRatio,
    confidence,
    warnings,
  };
}
