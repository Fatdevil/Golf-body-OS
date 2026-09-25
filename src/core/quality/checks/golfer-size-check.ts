/**
 * golfer-size-check.ts
 * Golf-Body-OS — Video Quality Gate
 *
 * Verifies that the golfer occupies an adequate portion of the camera frame.
 * Flags cases where golfer is too small (camera too far away) or too large (clipping risks).
 *
 * @module quality/checks/golfer-size-check
 */

import { PoseFrame } from '../../types/pose-frame';
import { QualityThresholds, DEFAULT_QUALITY_THRESHOLDS } from '../quality-thresholds';
import { GolferSizeResult, QualityStatus, QualityWarning } from '../types';

/**
 * Calculates the bounding box diagonal ratio relative to frame diagonal.
 */
export function checkGolferSize(
  frames: PoseFrame[],
  thresholds: QualityThresholds = DEFAULT_QUALITY_THRESHOLDS
): GolferSizeResult {
  const totalFrames = frames.length;

  if (totalFrames === 0) {
    return {
      status: 'FAIL',
      bodyRatio: 0,
      confidence: 0,
      warnings: [
        {
          code: 'NO_FRAMES',
          message: 'No frames available for golfer size evaluation.',
          messageSv: 'Inga bildrutor tillgängliga för beräkning av golfarens storlek i bild.',
          severity: 'error',
        },
      ],
    };
  }

  let ratioSum = 0;
  let validFrames = 0;
  let borderClipCount = 0;

  const FRAME_DIAG = Math.SQRT2; // sqrt(1^2 + 1^2)

  for (const frame of frames) {
    if (!frame.landmarks || frame.landmarks.length === 0) continue;

    let minX = 1.0;
    let maxX = 0.0;
    let minY = 1.0;
    let maxY = 0.0;
    let count = 0;

    for (const lm of frame.landmarks) {
      const conf = lm.visibility ?? lm.presence ?? 1.0;
      if (conf >= thresholds.minLandmarkConfidence) {
        if (lm.x < minX) minX = lm.x;
        if (lm.x > maxX) maxX = lm.x;
        if (lm.y < minY) minY = lm.y;
        if (lm.y > maxY) maxY = lm.y;
        count++;
      }
    }

    if (count < 4) continue;

    const width = Math.max(0, maxX - minX);
    const height = Math.max(0, maxY - minY);
    const diag = Math.sqrt(width * width + height * height);
    const ratio = diag / FRAME_DIAG;

    ratioSum += ratio;
    validFrames++;

    // Check if joints are pressed right against borders
    if (minY <= 0.01 || maxY >= 0.99 || minX <= 0.01 || maxX >= 0.99) {
      borderClipCount++;
    }
  }

  if (validFrames === 0) {
    return {
      status: 'FAIL',
      bodyRatio: 0,
      confidence: 0,
      warnings: [
        {
          code: 'NO_LANDMARKS',
          message: 'No valid pose landmarks detected in any frame for size estimation.',
          messageSv: 'Inga giltiga ledpunkter hittades för att beräkna golfarens storlek i bild.',
          severity: 'error',
        },
      ],
    };
  }

  const avgRatio = ratioSum / validFrames;
  const warnings: QualityWarning[] = [];
  let status: QualityStatus = 'PASS';

  if (avgRatio < thresholds.minBodyRatio) {
    status = 'WARNING';
    const pct = (avgRatio * 100).toFixed(1);
    const req = (thresholds.minBodyRatio * 100).toFixed(0);
    warnings.push({
      code: 'GOLFER_TOO_SMALL',
      message: `Golfer appears too small in frame (${pct}% of frame diagonal, recommended minimum: ${req}%). Move camera closer for higher kinematic accuracy.`,
      messageSv: `Golfaren är för liten i bild (${pct}% av bilddiagonalen, rekommenderat: minst ${req}%). Placera kameran närmare för bättre precision i ledvinklar och svingplan.`,
      severity: 'warning',
      details: { bodyRatio: avgRatio, requiredMin: thresholds.minBodyRatio },
    });
  } else if (avgRatio > thresholds.maxBodyRatio || borderClipCount / validFrames > 0.4) {
    status = 'WARNING';
    warnings.push({
      code: 'GOLFER_TOO_LARGE',
      message: 'Golfer appears too close or partially clipped at video borders. Back up camera slightly to ensure club and full body stay in frame.',
      messageSv: 'Golfaren är mycket nära kameran eller klipper bildkanten. Backa kameran något så att hela kroppen och klubbrörelsen ryms.',
      severity: 'warning',
      details: { bodyRatio: avgRatio, borderClipRatio: borderClipCount / validFrames },
    });
  }

  // Confidence is optimal between minBodyRatio and ~0.85
  let confidence = 1.0;
  if (avgRatio < thresholds.minBodyRatio) {
    confidence = Math.max(0.2, avgRatio / thresholds.minBodyRatio);
  } else if (avgRatio > thresholds.maxBodyRatio) {
    confidence = 0.7;
  }

  return {
    status,
    bodyRatio: avgRatio,
    confidence,
    warnings,
  };
}
