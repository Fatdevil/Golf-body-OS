/**
 * Split Squat Capacity Metrics & Quality Analyzer
 *
 * Computes functional capacity, repetition consistency, fatigue onset,
 * and left/right asymmetry for the Split Squat Capacity assessment.
 *
 * @module split-squat-metrics
 */

import type { SplitSquatRepetition } from '../motion/phases/split-squat-phase-engine';

export type SplitSquatCompensation =
  | 'SHALLOW_DEPTH'
  | 'EXCESSIVE_FORWARD_LEAN'
  | 'EARLY_FATIGUE_DROPOFF'
  | 'ERRATIC_TEMPO';

export interface SplitSquatSetResult {
  side: 'LEFT' | 'RIGHT';
  totalReps: number;
  validReps: number;
  averageDepthDeg: number;
  depthConsistencyScore: number;  // 0 - 100
  tempoConsistencyScore: number;  // 0 - 100
  fatiguePointRep: number | null; // First rep where significant form degradation occurred
  quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  compensations: SplitSquatCompensation[];
  reps: SplitSquatRepetition[];
}

export interface SplitSquatAsymmetryResult {
  leftValidReps: number;
  rightValidReps: number;
  repDifference: number; // Left - Right
  dominantSide: 'LEFT' | 'RIGHT' | 'SYMMETRIC';
  asymmetryPercentage: number;
  severity: 'NONE' | 'MILD' | 'SIGNIFICANT';
  findingDescription?: { sv: string; en: string };
}

/**
 * Evaluates a single side set of split squat repetitions.
 */
export function evaluateSplitSquatSet(
  side: 'LEFT' | 'RIGHT',
  reps: SplitSquatRepetition[]
): SplitSquatSetResult {
  if (reps.length === 0) {
    return {
      side,
      totalReps: 0,
      validReps: 0,
      averageDepthDeg: 0,
      depthConsistencyScore: 0,
      tempoConsistencyScore: 0,
      fatiguePointRep: null,
      quality: 'POOR',
      compensations: ['SHALLOW_DEPTH'],
      reps: [],
    };
  }

  const totalReps = reps.length;
  const validReps = reps.filter(r => r.isValidDepth).length;
  const depths = reps.map(r => r.minKneeAngleDeg);
  const avgDepth = Math.round(depths.reduce((sum, d) => sum + d, 0) / totalReps);

  // 1. Depth consistency score (lower variance in knee angle = higher score)
  const depthVariance = depths.reduce((sum, d) => sum + Math.pow(d - avgDepth, 2), 0) / totalReps;
  const depthStdDev = Math.sqrt(depthVariance);
  const depthConsistencyScore = Math.max(0, Math.min(100, Math.round(100 - depthStdDev * 4)));

  // 2. Tempo consistency score (total duration per rep = descent + ascent)
  const durations = reps.map(r => r.descentDurationMs + r.ascentDurationMs);
  const avgDuration = durations.reduce((sum, d) => sum + d, 0) / totalReps;
  const durationVariance = durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / totalReps;
  const durationStdDev = Math.sqrt(durationVariance);
  const tempoConsistencyScore = Math.max(0, Math.min(100, Math.round(100 - (durationStdDev / 1000) * 20)));

  // 3. Detect Fatigue Point
  // Baseline depth and trunk angle from first 3 reps
  const baselineReps = reps.slice(0, Math.min(3, reps.length));
  const baselineDepth = baselineReps.reduce((sum, r) => sum + r.minKneeAngleDeg, 0) / baselineReps.length;
  const baselineTrunk = baselineReps.reduce((sum, r) => sum + r.trunkAngleAtBottomDeg, 0) / baselineReps.length;

  let fatiguePointRep: number | null = null;
  for (let i = 3; i < reps.length; i++) {
    const rep = reps[i];
    // Form degradation: depth becomes 15° shallower or trunk leans forward by > 12°
    const depthLoss = rep.minKneeAngleDeg - baselineDepth; // higher angle = shallower
    const trunkLeanIncrease = rep.trunkAngleAtBottomDeg - baselineTrunk;

    if (depthLoss >= 15 || trunkLeanIncrease >= 12) {
      fatiguePointRep = rep.repIndex;
      break;
    }
  }

  // 4. Compensations
  const compensations: SplitSquatCompensation[] = [];
  const invalidRatio = (totalReps - validReps) / totalReps;

  if (invalidRatio >= 0.3) {
    compensations.push('SHALLOW_DEPTH');
  }

  const avgTrunkLean = reps.reduce((sum, r) => sum + r.trunkAngleAtBottomDeg, 0) / totalReps;
  if (avgTrunkLean > 25) {
    compensations.push('EXCESSIVE_FORWARD_LEAN');
  }

  if (fatiguePointRep !== null && fatiguePointRep <= 4) {
    compensations.push('EARLY_FATIGUE_DROPOFF');
  }

  if (tempoConsistencyScore < 50) {
    compensations.push('ERRATIC_TEMPO');
  }

  // 5. Quality rating
  let quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' = 'POOR';
  if (validReps >= 12 && depthConsistencyScore >= 75) {
    quality = 'EXCELLENT';
  } else if (validReps >= 8 && depthConsistencyScore >= 60) {
    quality = 'GOOD';
  } else if (validReps >= 5) {
    quality = 'FAIR';
  }

  return {
    side,
    totalReps,
    validReps,
    averageDepthDeg: avgDepth,
    depthConsistencyScore,
    tempoConsistencyScore,
    fatiguePointRep,
    quality,
    compensations,
    reps,
  };
}

/**
 * Compares Left and Right sets to detect functional asymmetry.
 */
export function evaluateSplitSquatAsymmetry(
  left: SplitSquatSetResult,
  right: SplitSquatSetResult
): SplitSquatAsymmetryResult {
  const diff = left.validReps - right.validReps;
  const maxReps = Math.max(left.validReps, right.validReps);
  const minReps = Math.min(left.validReps, right.validReps);

  let dominantSide: 'LEFT' | 'RIGHT' | 'SYMMETRIC' = 'SYMMETRIC';
  if (diff > 0) dominantSide = 'LEFT';
  if (diff < 0) dominantSide = 'RIGHT';

  const pct = maxReps > 0 ? Math.round(((maxReps - minReps) / maxReps) * 100) : 0;

  let severity: 'NONE' | 'MILD' | 'SIGNIFICANT' = 'NONE';
  let findingDescription: { sv: string; en: string } | undefined;

  if (Math.abs(diff) >= 4 || pct >= 30) {
    severity = 'SIGNIFICANT';
    findingDescription = {
      sv: `Betydande asymmetri i benkapacitet (${Math.abs(diff)} reps skillnad, ${pct}%). Detta kan leda till kompensationer i nedsvingens viktöverföring.`,
      en: `Significant asymmetry in single-leg capacity (${Math.abs(diff)} rep difference, ${pct}%). May cause compensations in downswing weight transfer.`,
    };
  } else if (Math.abs(diff) >= 2 || pct >= 20) {
    severity = 'MILD';
    findingDescription = {
      sv: `Måttlig sidoskillnad i benuthållighet (${Math.abs(diff)} reps skillnad).`,
      en: `Moderate asymmetry in single-leg endurance (${Math.abs(diff)} rep difference).`,
    };
  }

  return {
    leftValidReps: left.validReps,
    rightValidReps: right.validReps,
    repDifference: diff,
    dominantSide,
    asymmetryPercentage: pct,
    severity,
    findingDescription,
  };
}
