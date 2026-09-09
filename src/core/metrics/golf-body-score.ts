/**
 * Golf Body Score — Unified Biomechanical Scoring Engine
 *
 * Combines Hip Hinge (Pillar A, 50 pts) and Thoracic Rotation (Pillar B, 50 pts)
 * into a single holistic 0–100 athletic mobility and separation score.
 *
 * @module golf-body-score
 * @version GOLF_BODY_SCORE_V1
 */

import { DeviceValidationReport } from '../../validation/device-validation-report';
import { ThoracicRotationResult } from './thoracic-rotation-metrics';
import { SupportedLanguage } from '../coaching/i18n/locales';

export const VERSION = 'GOLF_BODY_SCORE_V1';

export type GolfBodyTier = 'TOUR_ELITE' | 'SOLID' | 'MODERATE' | 'RESTRICTED';

export interface HipHingeSubScore {
  total: number;             // 0–50
  depthScore: number;        // 0–25
  kneeScore: number;         // 0–15
  spineScore: number;        // 0–10
  avgHingeAngle: number;     // degrees
  avgKneeAngle: number;      // degrees
  compensations: string[];
}

export interface ThoracicSubScore {
  total: number;             // 0–50
  rotationScore: number;     // 0–25
  disassociationScore: number; // 0–15
  symmetryScore: number;     // 0–5
  dipScore: number;          // 0–5
  maxLeft: number;           // degrees
  maxRight: number;          // degrees
  asymmetry: number;         // degrees
  maxPelvicTurn: number;     // degrees
  hasExcessiveDip: boolean;
  hasExcessivePelvic: boolean;
}

export interface GolfBodyScoreResult {
  totalScore: number;        // 0–100
  tier: GolfBodyTier;
  tierLabel: string;
  tierColor: string;         // Hex or Tailwind color class
  hipHinge: HipHingeSubScore;
  thoracic: ThoracicSubScore;
  keyStrengths: string[];
  primaryBottlenecks: string[];
  summary: string;
}

/**
 * Calculates the complete Golf Body Score (0–100) from hip hinge and thoracic rotation results.
 */
export function calculateGolfBodyScore(
  hingeReport: DeviceValidationReport | null,
  rotationResult: ThoracicRotationResult | null,
  language: SupportedLanguage = 'sv-SE'
): GolfBodyScoreResult {
  const isSv = language === 'sv-SE';

  // --- PILLAR A: HIP HINGE (0–50) ---
  let depthScore = 0;
  let kneeScore = 0;
  let spineScore = 0;
  let avgHingeAngle = 0;
  let avgKneeAngle = 0;
  const hingeComps: string[] = [];

  if (hingeReport && hingeReport.measurement) {
    const metrics = hingeReport.measurement.metrics || [];
    const comps = hingeReport.measurement.compensations || [];
    comps.forEach(c => {
      if (!hingeComps.includes(c.type)) hingeComps.push(c.type);
    });

    const hingeAngles = metrics.filter(m => m.id === 'HIP_HINGE_ANGLE_2D').map(m => m.value);
    const kneeAngles = metrics.filter(m => m.id === 'KNEE_ANGLE_AT_ENDPOINT').map(m => m.value);

    avgHingeAngle = hingeAngles.length > 0
      ? hingeAngles.reduce((a, b) => a + b, 0) / hingeAngles.length
      : 85;

    avgKneeAngle = kneeAngles.length > 0
      ? kneeAngles.reduce((a, b) => a + b, 0) / kneeAngles.length
      : 155;

    // 1. Depth score (0–25)
    // Optimal: <= 90° = 25 pts. 90°-105° = 25 -> 13. 105°-125° = 13 -> 0. > 125° = 0.
    if (avgHingeAngle <= 90) {
      depthScore = 25;
    } else if (avgHingeAngle <= 105) {
      depthScore = Math.max(13, 25 - (avgHingeAngle - 90) * 0.8);
    } else if (avgHingeAngle <= 125) {
      depthScore = Math.max(0, 13 - (avgHingeAngle - 105) * 0.65);
    } else {
      depthScore = 0;
    }

    // 2. Knee angle control (0–15)
    // Optimal soft knees: 150°–165° = 15 pts.
    // Squatting: < 140° or EXCESSIVE_KNEE_BEND = 5 pts (or 0 if < 125°).
    // Locked: > 175° or LOCKED_KNEES = 5 pts.
    const hasSquat = hingeComps.includes('EXCESSIVE_KNEE_BEND') || avgKneeAngle < 140;
    const hasLocked = hingeComps.includes('LOCKED_KNEES') || avgKneeAngle > 175;

    if (hasSquat) {
      kneeScore = avgKneeAngle < 125 ? 0 : 5;
    } else if (hasLocked) {
      kneeScore = 5;
    } else if (avgKneeAngle >= 150 && avgKneeAngle <= 165) {
      kneeScore = 15;
    } else if (avgKneeAngle >= 140 && avgKneeAngle < 150) {
      kneeScore = 11;
    } else {
      kneeScore = 10;
    }

    // 3. Neutral spine & neck (0–10)
    spineScore = 10;
    if (hingeComps.includes('CERVICAL_CRANING')) spineScore -= 5;
    if (hingeComps.includes('NO_POSTERIOR_SHIFT')) spineScore -= 5;
    spineScore = Math.max(0, spineScore);
  }

  const hipHingeTotal = Math.round(depthScore + kneeScore + spineScore);

  // --- PILLAR B: THORACIC MOBILITY & SEPARATION (0–50) ---
  let rotationScore = 0;
  let disassociationScore = 0;
  let symmetryScore = 0;
  let dipScore = 0;
  let maxLeft = 0;
  let maxRight = 0;
  let asymmetry = 0;
  let maxPelvicTurn = 0;
  let hasExcessiveDip = false;
  let hasExcessivePelvic = false;

  if (rotationResult) {
    maxLeft = rotationResult.maxRotationLeft;
    maxRight = rotationResult.maxRotationRight;
    asymmetry = rotationResult.rotationAsymmetry;
    maxPelvicTurn = Math.max(rotationResult.pelvicTurnAtPeakLeft, rotationResult.pelvicTurnAtPeakRight);
    hasExcessiveDip = rotationResult.compensations.excessiveLateralTilt;
    hasExcessivePelvic = rotationResult.compensations.excessivePelvicRotation;

    const avgRot = (maxLeft + maxRight) / 2;

    // 1. Isolated Thoracic Rotation (0–25)
    // Elite: >= 45° = 25 pts.
    // 30°–45°: 15–25 pts.
    // 15°–30°: 5–15 pts.
    // < 15°: 0–5 pts.
    if (avgRot >= 45) {
      rotationScore = 25;
    } else if (avgRot >= 30) {
      rotationScore = 15 + ((avgRot - 30) / 15) * 10;
    } else if (avgRot >= 15) {
      rotationScore = 5 + ((avgRot - 15) / 15) * 10;
    } else {
      rotationScore = Math.max(0, (avgRot / 15) * 5);
    }

    // 2. Pelvic Disassociation (0–15)
    // Hips quiet: <= 15° = 15 pts.
    // 15°–25°: 7–15 pts.
    // > 25° or excessivePelvic: 0–7 pts.
    if (maxPelvicTurn <= 15 && !hasExcessivePelvic) {
      disassociationScore = 15;
    } else if (maxPelvicTurn <= 25 && !hasExcessivePelvic) {
      disassociationScore = Math.max(7, 15 - (maxPelvicTurn - 15) * 0.8);
    } else {
      disassociationScore = Math.max(0, 7 - (maxPelvicTurn - 25) * 0.5);
    }

    // 3. Rotational Symmetry (0–5)
    // <= 5°: 5 pts.
    // 5°–15°: 3 pts.
    // > 15° or severeAsymmetry: 0 pts.
    if (asymmetry <= 5 && !rotationResult.compensations.severeAsymmetry) {
      symmetryScore = 5;
    } else if (asymmetry <= 15 && !rotationResult.compensations.severeAsymmetry) {
      symmetryScore = 3;
    } else {
      symmetryScore = 0;
    }

    // 4. Dip / Frontal Plane Stability (0–5)
    dipScore = hasExcessiveDip ? 0 : 5;
  }

  const thoracicTotal = Math.round(rotationScore + disassociationScore + symmetryScore + dipScore);

  // Total Golf Body Score (0–100)
  const totalScore = Math.min(100, Math.max(0, hipHingeTotal + thoracicTotal));

  // --- TIER DETERMINATION ---
  let tier: GolfBodyTier = 'RESTRICTED';
  let tierLabel = '';
  let tierColor = '#EF4444'; // Red

  if (totalScore >= 90) {
    tier = 'TOUR_ELITE';
    tierLabel = isSv ? 'Tour-nivå' : 'Tour Elite';
    tierColor = '#10B981'; // Green
  } else if (totalScore >= 75) {
    tier = 'SOLID';
    tierLabel = isSv ? 'Stabil Golfkropp' : 'Solid Athletic';
    tierColor = '#3B82F6'; // Blue
  } else if (totalScore >= 60) {
    tier = 'MODERATE';
    tierLabel = isSv ? 'Måttlig Rörlighet' : 'Moderate Restr.';
    tierColor = '#F59E0B'; // Amber
  } else {
    tier = 'RESTRICTED';
    tierLabel = isSv ? 'Betydande Begränsning' : 'Restricted';
    tierColor = '#EF4444'; // Red
  }

  // --- STRENGTHS & BOTTLENECKS ---
  const keyStrengths: string[] = [];
  const primaryBottlenecks: string[] = [];

  // Hip hinge evaluations
  if (depthScore >= 20) {
    keyStrengths.push(isSv
      ? 'Djup och rörlig höftfällning som möjliggör stabil ryggradsvinkel i baksvingen'
      : 'Deep and mobile hip hinge enabling stable posture maintenance in the swing');
  } else if (depthScore < 16) {
    primaryBottlenecks.push(isSv
      ? 'Stram baksida lår begränsar fällningen och skapar risk för krum ländrygg'
      : 'Restricted posterior chain mobility limiting hinge depth and risking lumbar rounding');
  }

  if (kneeScore >= 12) {
    keyStrengths.push(isSv
      ? 'God knävinkelkontroll med bibehållen sätesaktivering utan att knäböja'
      : 'Solid knee flex control maintaining glute loading without squatting');
  } else if (hingeComps.includes('EXCESSIVE_KNEE_BEND') || avgKneeAngle < 140) {
    primaryBottlenecks.push(isSv
      ? 'Tendens till knäböj i fällningen – ökar risken för Early Extension i nedsvingen'
      : 'Squat pattern compensation during hinge – increases risk of Early Extension');
  }

  if (hingeComps.includes('CERVICAL_CRANING')) {
    primaryBottlenecks.push(isSv
      ? 'Nacklyft (blicken lyfts) i bottenläget blockerar bröstryggens rotation och belastar nacken'
      : 'Cervical craning at bottom of hinge blocks thoracic rotation and strains the neck');
  }

  // Thoracic evaluations
  const avgRot = (maxLeft + maxRight) / 2;
  if (rotationScore >= 20) {
    keyStrengths.push(isSv
      ? `Stark bröstryggsrörlighet (${avgRot.toFixed(1)}° i snitt) ger stor svingbåge utan att behöva lyfta armarna`
      : `High thoracic mobility (${avgRot.toFixed(1)}° avg) creates full swing turn without forced arm lift`);
  } else if (rotationScore < 15) {
    primaryBottlenecks.push(isSv
      ? `Begränsad bröstryggsrörlighet (${avgRot.toFixed(1)}°) – tvingar fram kompensatoriskt armlyft och svingplansavvikelser`
      : `Restricted thoracic rotation (${avgRot.toFixed(1)}°) – forces compensatory arm lifting and swing plane issues`);
  }

  if (disassociationScore >= 12) {
    keyStrengths.push(isSv
      ? 'Utmärkt bäckendissociation – förmåga att hålla höften stilla medan överkroppen vrider sig (X-Factor)'
      : 'Excellent pelvic disassociation – ability to isolate thoracic turn while stabilizing pelvis (X-Factor)');
  } else if (hasExcessivePelvic || maxPelvicTurn > 22) {
    primaryBottlenecks.push(isSv
      ? `Höften snurrar med överkroppen (${maxPelvicTurn.toFixed(1)}°) vilket urladdar spänningen och minskar svingkraften`
      : `Excessive pelvic rotation (${maxPelvicTurn.toFixed(1)}°) dissipates rotational torque and X-Factor power`);
  }

  if (symmetryScore >= 4) {
    keyStrengths.push(isSv
      ? `God rotationsbalans mellan vänster (${maxLeft.toFixed(1)}°) och höger (${maxRight.toFixed(1)}°)`
      : `Well-balanced rotation between left (${maxLeft.toFixed(1)}°) and right (${maxRight.toFixed(1)}°)`);
  } else if (asymmetry > 12) {
    primaryBottlenecks.push(isSv
      ? `Rotationsasymmetri på ${asymmetry.toFixed(1)}° mellan baksving och genomgång skapar ojämn svingdynamik`
      : `Rotational asymmetry of ${asymmetry.toFixed(1)}° between sides causes uneven swing mechanics`);
  }

  if (hasExcessiveDip) {
    primaryBottlenecks.push(isSv
      ? 'Lateral axellutning (dip) under rotation – risk för sway/slide eller omvänd ryggradsvinkel (Reverse Spine)'
      : 'Excessive lateral shoulder dip during turn – risk for lateral sway or reverse spine angle');
  }

  // Fallback defaults if empty
  if (keyStrengths.length === 0) {
    keyStrengths.push(isSv ? 'God grundläggande rörelsemedvetenhet' : 'Good foundational movement awareness');
  }
  if (primaryBottlenecks.length === 0) {
    primaryBottlenecks.push(isSv ? 'Inga allvarliga rörelsebegränsningar identifierade' : 'No severe movement restrictions identified');
  }

  // Summary statement
  const summary = isSv
    ? `Ditt Golf Body Score är ${totalScore}/100 (${tierLabel}). Med ${hipHingeTotal}/50 på höftfällningen och ${thoracicTotal}/50 på bröstryggsrörligheten har du ${tier === 'TOUR_ELITE' || tier === 'SOLID' ? 'en stark atletisk grund för en konsekvent sving.' : 'tydliga utvecklingsområden för att öka svinghastigheten och skydda ländryggen.'}`
    : `Your Golf Body Score is ${totalScore}/100 (${tierLabel}). With ${hipHingeTotal}/50 in the hip hinge and ${thoracicTotal}/50 in thoracic mobility, you have ${tier === 'TOUR_ELITE' || tier === 'SOLID' ? 'a strong athletic foundation for consistent ball striking.' : 'clear priority areas to unlock swing speed and protect your lumbar spine.'}`;

  return {
    totalScore,
    tier,
    tierLabel,
    tierColor,
    hipHinge: {
      total: hipHingeTotal,
      depthScore: Math.round(depthScore),
      kneeScore: Math.round(kneeScore),
      spineScore: Math.round(spineScore),
      avgHingeAngle: Number(avgHingeAngle.toFixed(1)),
      avgKneeAngle: Number(avgKneeAngle.toFixed(1)),
      compensations: hingeComps,
    },
    thoracic: {
      total: thoracicTotal,
      rotationScore: Math.round(rotationScore),
      disassociationScore: Math.round(disassociationScore),
      symmetryScore: Math.round(symmetryScore),
      dipScore: Math.round(dipScore),
      maxLeft: Number(maxLeft.toFixed(1)),
      maxRight: Number(maxRight.toFixed(1)),
      asymmetry: Number(asymmetry.toFixed(1)),
      maxPelvicTurn: Number(maxPelvicTurn.toFixed(1)),
      hasExcessiveDip,
      hasExcessivePelvic,
    },
    keyStrengths,
    primaryBottlenecks,
    summary,
  };
}
