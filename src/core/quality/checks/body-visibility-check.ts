/**
 * body-visibility-check.ts
 * Golf-Body-OS — Video Quality Gate
 *
 * Evaluates visibility and tracking stability across 7 key anatomical regions:
 * Head, Shoulders, Elbows, Wrists, Hips, Knees, Ankles/Feet.
 *
 * @module quality/checks/body-visibility-check
 */

import { LandmarkId, Landmark } from '../../types/landmark';
import { PoseFrame } from '../../types/pose-frame';
import { QualityThresholds, DEFAULT_QUALITY_THRESHOLDS } from '../quality-thresholds';
import {
  BodyVisibilityResult,
  BodyRegionVisibility,
  BodyRegionName,
  QualityStatus,
  QualityWarning,
} from '../types';

interface BodyRegionDefinition {
  readonly name: BodyRegionName;
  readonly nameSv: string;
  readonly nameEn: string;
  readonly landmarks: readonly LandmarkId[];
}

const BODY_REGIONS: readonly BodyRegionDefinition[] = [
  {
    name: 'head',
    nameSv: 'huvud/ansikte',
    nameEn: 'head/face',
    landmarks: [
      LandmarkId.NOSE,
      LandmarkId.LEFT_EYE,
      LandmarkId.RIGHT_EYE,
      LandmarkId.LEFT_EAR,
      LandmarkId.RIGHT_EAR,
    ],
  },
  {
    name: 'shoulders',
    nameSv: 'axlar',
    nameEn: 'shoulders',
    landmarks: [LandmarkId.LEFT_SHOULDER, LandmarkId.RIGHT_SHOULDER],
  },
  {
    name: 'elbows',
    nameSv: 'armbågar',
    nameEn: 'elbows',
    landmarks: [LandmarkId.LEFT_ELBOW, LandmarkId.RIGHT_ELBOW],
  },
  {
    name: 'wrists',
    nameSv: 'handleder',
    nameEn: 'wrists',
    landmarks: [LandmarkId.LEFT_WRIST, LandmarkId.RIGHT_WRIST],
  },
  {
    name: 'hips',
    nameSv: 'höfter/bäcken',
    nameEn: 'hips/pelvis',
    landmarks: [LandmarkId.LEFT_HIP, LandmarkId.RIGHT_HIP],
  },
  {
    name: 'knees',
    nameSv: 'knän',
    nameEn: 'knees',
    landmarks: [LandmarkId.LEFT_KNEE, LandmarkId.RIGHT_KNEE],
  },
  {
    name: 'ankles',
    nameSv: 'fötter/fotleder',
    nameEn: 'feet/ankles',
    landmarks: [
      LandmarkId.LEFT_ANKLE,
      LandmarkId.RIGHT_ANKLE,
      LandmarkId.LEFT_HEEL,
      LandmarkId.RIGHT_HEEL,
      LandmarkId.LEFT_FOOT_INDEX,
      LandmarkId.RIGHT_FOOT_INDEX,
    ],
  },
];

function getLandmarkConfidence(lm: Landmark): number {
  if (lm.visibility !== undefined && lm.presence !== undefined) {
    return (lm.visibility + lm.presence) / 2;
  }
  return lm.visibility ?? lm.presence ?? 1.0;
}

/**
 * Checks whether an anatomical region is sufficiently visible across the pose sequence.
 */
export function checkBodyVisibility(
  frames: PoseFrame[],
  thresholds: QualityThresholds = DEFAULT_QUALITY_THRESHOLDS
): BodyVisibilityResult {
  const totalFrames = frames.length;

  if (totalFrames === 0) {
    return {
      status: 'FAIL',
      confidence: 0,
      regions: BODY_REGIONS.map((r) => ({
        region: r.name,
        availability: 0,
        averageConfidence: 0,
        status: 'FAIL',
      })),
      warnings: [
        {
          code: 'NO_FRAMES',
          message: 'No pose frames available for body visibility evaluation.',
          messageSv: 'Inga bildrutor tillgängliga för granskning av kroppssynlighet.',
          severity: 'error',
        },
      ],
    };
  }

  const regions: BodyRegionVisibility[] = [];
  const warnings: QualityWarning[] = [];
  let failCount = 0;
  let totalAvailability = 0;

  for (const regDef of BODY_REGIONS) {
    let framesWithRegion = 0;
    let confidenceSum = 0;
    let confidenceCount = 0;

    for (const frame of frames) {
      if (!frame.landmarks || frame.landmarks.length === 0) continue;

      let regionVisibleInFrame = false;

      for (const targetId of regDef.landmarks) {
        const lm = frame.landmarks.find((l) => l.id === targetId);
        if (lm) {
          const conf = getLandmarkConfidence(lm);
          if (conf >= thresholds.minLandmarkConfidence) {
            regionVisibleInFrame = true;
            confidenceSum += conf;
            confidenceCount++;
          }
        }
      }

      if (regionVisibleInFrame) {
        framesWithRegion++;
      }
    }

    const availability = framesWithRegion / totalFrames;
    const averageConfidence = confidenceCount > 0 ? confidenceSum / confidenceCount : 0;
    const status: QualityStatus =
      availability >= thresholds.bodyRegionVisibilityThreshold ? 'PASS' : 'FAIL';

    totalAvailability += availability;

    if (status === 'FAIL') {
      failCount++;
      const availPct = Math.round(availability * 100);
      const reqPct = Math.round(thresholds.bodyRegionVisibilityThreshold * 100);

      warnings.push({
        code: 'LOW_REGION_VISIBILITY',
        message: `Body region '${regDef.nameEn}' visible in only ${availPct}% of frames (minimum required: ${reqPct}%).`,
        messageSv: `Kroppsposition '${regDef.nameSv}' syns bara i ${availPct}% av bildrutorna (krav: minst ${reqPct}%). Se till att hela kroppen ryms i kameravinkeln.`,
        severity: 'warning',
        details: { region: regDef.name, availability, averageConfidence },
      });
    }

    regions.push({
      region: regDef.name,
      availability,
      averageConfidence,
      status,
    });
  }

  const meanAvailability = totalAvailability / BODY_REGIONS.length;

  // Crucial regions: shoulders, hips, ankles. If both hips or ankles fail, severe penalty.
  const hipsFailed = regions.find((r) => r.region === 'hips')?.status === 'FAIL';
  const anklesFailed = regions.find((r) => r.region === 'ankles')?.status === 'FAIL';
  const shouldersFailed = regions.find((r) => r.region === 'shoulders')?.status === 'FAIL';

  let overallStatus: QualityStatus = 'PASS';
  if (failCount >= thresholds.maxFailedRegionsForFail || (hipsFailed && anklesFailed)) {
    overallStatus = 'FAIL';
  } else if (failCount > 0 || hipsFailed || anklesFailed || shouldersFailed) {
    overallStatus = 'WARNING';
  }

  return {
    status: overallStatus,
    confidence: Math.max(0, Math.min(1, meanAvailability)),
    regions,
    warnings,
  };
}
