/**
 * Screening-to-Profile Adapter
 *
 * Converts the existing GolfBodyScoreResult (from screening)
 * into a BodyProfile (for the training engine).
 *
 * This is the ONLY file that bridges old architecture to new.
 * All future test additions make this adapter wider —
 * the rest of the system stays unchanged.
 *
 * PURE FUNCTION — no side effects.
 *
 * @module screening-to-profile
 */

import type {
  GolfBodyScoreResult,
  HipHingeSubScore,
  ThoracicSubScore,
} from '../../metrics/golf-body-score';
import type { BodyProfile, DomainAssessment, AreaScore, AreaQuality, GolfBodyTier } from '../types/body-profile';
import type { BodyFinding } from '../types/body-finding';
import type { SplitSquatSetResult } from '../../metrics/split-squat-metrics';
import { evaluateSplitSquatAsymmetry } from '../../metrics/split-squat-metrics';

export interface SplitSquatAssessmentData {
  left: SplitSquatSetResult;
  right: SplitSquatSetResult;
}

// ---------------------------------------------------------------------------
// Quality assessment helpers
// ---------------------------------------------------------------------------

function scoreToQuality(score: number, maxScore: number): AreaQuality {
  const pct = maxScore > 0 ? score / maxScore : 0;
  if (pct >= 0.85) return 'EXCELLENT';
  if (pct >= 0.65) return 'GOOD';
  if (pct >= 0.40) return 'FAIR';
  return 'POOR';
}

function tierToGolfBodyTier(tier: string): GolfBodyTier {
  switch (tier) {
    case 'TOUR_ELITE': return 'TOUR_ELITE';
    case 'SOLID': return 'SOLID';
    case 'MODERATE': return 'MODERATE';
    case 'RESTRICTED': return 'RESTRICTED';
    default: return 'MODERATE';
  }
}

// ---------------------------------------------------------------------------
// Hip Hinge → Area Scores
// ---------------------------------------------------------------------------

function mapHipHingeToAreas(hinge: HipHingeSubScore): AreaScore[] {
  const areas: AreaScore[] = [];

  // Hinge depth (ROM)
  areas.push({
    areaId: 'hip-hinge-limited',
    label: { sv: 'Höftfällningsdjup', en: 'Hip Hinge Depth' },
    score: hinge.depthScore,
    maxScore: 25,
    quality: scoreToQuality(hinge.depthScore, 25),
    rawMeasurements: { avgHingeAngleDeg: Math.round(hinge.avgHingeAngle) },
    compensations: hinge.compensations.filter(c =>
      c === 'EXCESSIVE_FORWARD_LEAN' || c === 'CERVICAL_CRANING'
    ),
    lastTestedAt: new Date(),
  });

  // Knee strategy
  areas.push({
    areaId: 'hip-hinge-compensation-knee',
    label: { sv: 'Knästrategi vid fällning', en: 'Knee Strategy in Hinge' },
    score: hinge.kneeScore,
    maxScore: 15,
    quality: scoreToQuality(hinge.kneeScore, 15),
    rawMeasurements: { avgKneeAngleDeg: Math.round(hinge.avgKneeAngle) },
    compensations: hinge.compensations.filter(c =>
      c === 'EXCESSIVE_KNEE_BEND' || c === 'KNEE_DOMINANT_STRATEGY'
    ),
    lastTestedAt: new Date(),
  });

  // Spine/cervical control
  areas.push({
    areaId: 'hip-hinge-compensation-cervical',
    label: { sv: 'Ryggrad & nackkontroll', en: 'Spine & Cervical Control' },
    score: hinge.spineScore,
    maxScore: 10,
    quality: scoreToQuality(hinge.spineScore, 10),
    rawMeasurements: {},
    compensations: hinge.compensations.filter(c =>
      c === 'CERVICAL_CRANING' || c === 'EXCESSIVE_SPINAL_FLEXION'
    ),
    lastTestedAt: new Date(),
  });

  return areas;
}

// ---------------------------------------------------------------------------
// Thoracic → Area Scores
// ---------------------------------------------------------------------------

function mapThoracicToAreas(thoracic: ThoracicSubScore): AreaScore[] {
  const areas: AreaScore[] = [];

  // Rotation ROM
  areas.push({
    areaId: 'thoracic-rotation-limited',
    label: { sv: 'Bröstryggsrotation', en: 'Thoracic Rotation' },
    score: thoracic.rotationScore,
    maxScore: 25,
    quality: scoreToQuality(thoracic.rotationScore, 25),
    rawMeasurements: {
      maxLeftDeg: Math.round(thoracic.maxLeft),
      maxRightDeg: Math.round(thoracic.maxRight),
    },
    compensations: thoracic.asymmetry > 8 ? ['asymmetry'] : [],
    lastTestedAt: new Date(),
  });

  // Pelvic dissociation
  areas.push({
    areaId: 'pelvic-over-rotation',
    label: { sv: 'Bäckendissociation', en: 'Pelvic Dissociation' },
    score: thoracic.disassociationScore,
    maxScore: 15,
    quality: scoreToQuality(thoracic.disassociationScore, 15),
    rawMeasurements: { maxPelvicTurnDeg: Math.round(thoracic.maxPelvicTurn) },
    compensations: thoracic.hasExcessivePelvic ? ['EXCESSIVE_PELVIC_ROTATION'] : [],
    lastTestedAt: new Date(),
  });

  // Symmetry
  if (thoracic.asymmetry > 5) {
    areas.push({
      areaId: 'thoracic-rotation-asymmetry',
      label: { sv: 'Rotationssymmetri', en: 'Rotation Symmetry' },
      score: thoracic.symmetryScore,
      maxScore: 5,
      quality: scoreToQuality(thoracic.symmetryScore, 5),
      rawMeasurements: { asymmetryDeg: Math.round(thoracic.asymmetry) },
      compensations: ['asymmetry'],
      lastTestedAt: new Date(),
    });
  }

  return areas;
}

// ---------------------------------------------------------------------------
// Findings extraction
// ---------------------------------------------------------------------------

function extractFindings(score: GolfBodyScoreResult): {
  bottlenecks: BodyFinding[];
  strengths: BodyFinding[];
} {
  const bottlenecks: BodyFinding[] = [];
  const strengths: BodyFinding[] = [];

  // Hip hinge findings
  if (score.hipHinge.depthScore < 13) {
    bottlenecks.push({
      id: 'hip-hinge-limited',
      domain: 'MOBILITY',
      areaId: 'hip-hinge-limited',
      type: 'LIMITATION',
      severity: score.hipHinge.depthScore < 8 ? 'SIGNIFICANT' : 'MODERATE',
      label: { sv: 'Begränsat höftfällningsdjup', en: 'Limited hip hinge depth' },
      description: {
        sv: `Höftfällningsvinkeln (${Math.round(score.hipHinge.avgHingeAngle)}°) indikerar begränsad rörlighet i höftleden`,
        en: `Hip hinge angle (${Math.round(score.hipHinge.avgHingeAngle)}°) indicates limited hip joint mobility`,
      },
      compatibleExerciseTags: ['hip-hinge-limited', 'hip-mobility-poor', 'glute-activation-poor'],
      confidence: 'HIGH',
    });
  } else if (score.hipHinge.depthScore >= 20) {
    strengths.push({
      id: 'hip-hinge-good',
      domain: 'MOBILITY',
      areaId: 'hip-hinge-limited',
      type: 'STRENGTH',
      severity: 'MILD',
      label: { sv: 'Bra höftfällning', en: 'Good hip hinge' },
      description: { sv: 'Höftfällningsdjupet är inom optimalt intervall', en: 'Hip hinge depth is within optimal range' },
      compatibleExerciseTags: [],
      confidence: 'HIGH',
    });
  }

  // Knee strategy finding
  if (score.hipHinge.kneeScore < 8) {
    bottlenecks.push({
      id: 'hip-hinge-compensation-knee',
      domain: 'MOTOR_CONTROL',
      areaId: 'hip-hinge-compensation-knee',
      type: 'COMPENSATION',
      severity: 'MODERATE',
      label: { sv: 'Knädominant strategi', en: 'Knee-dominant strategy' },
      description: {
        sv: `Knävinkeln (${Math.round(score.hipHinge.avgKneeAngle)}°) tyder på att knäna kompenserar för begränsad höftrörlighet`,
        en: `Knee angle (${Math.round(score.hipHinge.avgKneeAngle)}°) suggests knees compensate for limited hip mobility`,
      },
      compatibleExerciseTags: ['hip-hinge-compensation-knee', 'hip-hinge-limited'],
      confidence: 'HIGH',
    });
  }

  // Thoracic rotation findings
  if (score.thoracic.rotationScore < 13) {
    bottlenecks.push({
      id: 'thoracic-rotation-limited',
      domain: 'MOBILITY',
      areaId: 'thoracic-rotation-limited',
      type: 'LIMITATION',
      severity: score.thoracic.rotationScore < 8 ? 'SIGNIFICANT' : 'MODERATE',
      label: { sv: 'Begränsad bröstryggsrotation', en: 'Limited thoracic rotation' },
      description: {
        sv: `Rotationsomfånget (V: ${Math.round(score.thoracic.maxLeft)}° / H: ${Math.round(score.thoracic.maxRight)}°) är under optimal nivå`,
        en: `Rotation range (L: ${Math.round(score.thoracic.maxLeft)}° / R: ${Math.round(score.thoracic.maxRight)}°) is below optimal level`,
      },
      compatibleExerciseTags: ['thoracic-rotation-limited', 'thoracic-mobility-poor'],
      confidence: 'HIGH',
    });
  } else if (score.thoracic.rotationScore >= 20) {
    strengths.push({
      id: 'thoracic-rotation-good',
      domain: 'MOBILITY',
      areaId: 'thoracic-rotation-limited',
      type: 'STRENGTH',
      severity: 'MILD',
      label: { sv: 'Bra bröstryggsrotation', en: 'Good thoracic rotation' },
      description: { sv: 'Rotationsomfånget är inom optimalt intervall', en: 'Rotation range is within optimal range' },
      compatibleExerciseTags: [],
      confidence: 'HIGH',
    });
  }

  // Asymmetry finding
  if (score.thoracic.asymmetry > 8) {
    bottlenecks.push({
      id: 'thoracic-rotation-asymmetry',
      domain: 'MOBILITY',
      areaId: 'thoracic-rotation-asymmetry',
      type: 'ASYMMETRY',
      severity: score.thoracic.asymmetry > 15 ? 'SIGNIFICANT' : 'MODERATE',
      label: { sv: 'Rotationssymmetri-obalans', en: 'Rotation symmetry imbalance' },
      description: {
        sv: `${Math.round(score.thoracic.asymmetry)}° skillnad mellan vänster och höger rotation`,
        en: `${Math.round(score.thoracic.asymmetry)}° difference between left and right rotation`,
      },
      compatibleExerciseTags: ['thoracic-rotation-asymmetry', 'thoracic-rotation-limited'],
      confidence: 'HIGH',
    });
  }

  // Pelvic over-rotation
  if (score.thoracic.hasExcessivePelvic) {
    bottlenecks.push({
      id: 'pelvic-over-rotation',
      domain: 'MOTOR_CONTROL',
      areaId: 'pelvic-over-rotation',
      type: 'COMPENSATION',
      severity: 'MODERATE',
      label: { sv: 'Överdriven bäckenrotation', en: 'Excessive pelvic rotation' },
      description: {
        sv: `Bäckenet roterar ${Math.round(score.thoracic.maxPelvicTurn)}° — bör vara under 15° för isolerad bröstryggsrotation`,
        en: `Pelvis rotates ${Math.round(score.thoracic.maxPelvicTurn)}° — should be under 15° for isolated thoracic rotation`,
      },
      compatibleExerciseTags: ['pelvic-over-rotation', 'trunk-control-poor'],
      confidence: 'HIGH',
    });
  }

  return { bottlenecks, strengths };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Converts a GolfBodyScoreResult from screening into a BodyProfile
 * for the training engine.
 *
 * PURE FUNCTION — same input → same output.
 *
 * @param score     The screening result
 * @param userId    User identifier
 * @param profileId Optional profile ID (auto-generated if not provided)
 */
export function screeningToProfile(
  score: GolfBodyScoreResult,
  userId: string = 'default-user',
  profileId?: string,
  capacityData?: SplitSquatAssessmentData,
): BodyProfile {
  const now = new Date();

  // Map sub-scores to area scores
  const mobilityAreas: AreaScore[] = [
    ...mapHipHingeToAreas(score.hipHinge),
    ...mapThoracicToAreas(score.thoracic),
  ];

  // Compute mobility composite (0-100)
  const mobilityTotal = mobilityAreas.reduce((sum, a) => sum + a.score, 0);
  const mobilityMax = mobilityAreas.reduce((sum, a) => sum + a.maxScore, 0);
  const mobilityComposite = mobilityMax > 0 ? Math.round((mobilityTotal / mobilityMax) * 100) : 0;

  // Mobility domain
  const mobility: DomainAssessment = {
    domain: 'MOBILITY',
    status: 'MEASURED',
    areas: mobilityAreas,
    compositeScore: mobilityComposite,
    confidence: 'HIGH',
    lastTestedAt: now,
    source: 'SCREENING',
  };

  // Motor Control domain (inferred from compensations)
  const controlAreas: AreaScore[] = [];

  // Spine control from hinge test
  if (score.hipHinge.spineScore < 10) {
    controlAreas.push({
      areaId: 'trunk-control-poor',
      label: { sv: 'Bålkontroll', en: 'Trunk Control' },
      score: score.hipHinge.spineScore * 2.5, // Normalize 0-10 → 0-25
      maxScore: 25,
      quality: scoreToQuality(score.hipHinge.spineScore, 10),
      rawMeasurements: {},
      compensations: score.hipHinge.compensations.filter(c => c === 'CERVICAL_CRANING'),
      lastTestedAt: now,
    });
  }

  // Pelvic control from rotation test
  if (score.thoracic.disassociationScore < 15) {
    controlAreas.push({
      areaId: 'pelvic-stability-poor',
      label: { sv: 'Bäckenstabilitet', en: 'Pelvic Stability' },
      score: Math.round((score.thoracic.disassociationScore / 15) * 25),
      maxScore: 25,
      quality: scoreToQuality(score.thoracic.disassociationScore, 15),
      rawMeasurements: { maxPelvicTurnDeg: Math.round(score.thoracic.maxPelvicTurn) },
      compensations: score.thoracic.hasExcessivePelvic ? ['EXCESSIVE_PELVIC_ROTATION'] : [],
      lastTestedAt: now,
    });
  }

  const controlTotal = controlAreas.reduce((sum, a) => sum + a.score, 0);
  const controlMax = controlAreas.reduce((sum, a) => sum + a.maxScore, 0);
  const controlComposite = controlMax > 0 ? Math.round((controlTotal / controlMax) * 100) : 50; // Default 50 if no data

  const motorControl: DomainAssessment = {
    domain: 'MOTOR_CONTROL',
    status: controlAreas.length > 0 ? 'DERIVED' : 'NOT_TESTED',
    areas: controlAreas,
    compositeScore: controlComposite,
    confidence: controlAreas.length > 0 ? 'MODERATE' : 'LOW',
    lastTestedAt: controlAreas.length > 0 ? now : null,
    source: controlAreas.length > 0 ? 'INFERRED' : 'INFERRED',
  };

  // Capacity domain
  let capacity: DomainAssessment = {
    domain: 'CAPACITY',
    status: 'NOT_TESTED',
    areas: [],
    compositeScore: 0,
    confidence: 'LOW',
    lastTestedAt: null,
    source: 'INFERRED',
  };

  // Power domain (not tested in base screening)
  const power: DomainAssessment = {
    domain: 'POWER',
    status: 'NOT_TESTED',
    areas: [],
    compositeScore: 0,
    confidence: 'LOW',
    lastTestedAt: null,
    source: 'INFERRED',
  };

  // Extract findings
  const { bottlenecks, strengths } = extractFindings(score);

  const baseProfile: BodyProfile = {
    id: profileId ?? `profile-${Date.now()}`,
    userId,
    createdAt: now,
    updatedAt: now,
    mobility,
    motorControl,
    capacity,
    power,
    golfBodyScore: score.totalScore,
    golfBodyTier: tierToGolfBodyTier(score.tier),
    primaryBottlenecks: bottlenecks,
    keyStrengths: strengths,
  };

  return capacityData ? applySplitSquatAssessment(baseProfile, capacityData) : baseProfile;
}

/**
 * Pure function to augment an existing BodyProfile with Split Squat Capacity assessment results.
 */
export function applySplitSquatAssessment(
  profile: BodyProfile,
  data: SplitSquatAssessmentData
): BodyProfile {
  const now = new Date();
  const maxTargetReps = 15;

  const leftNormScore = Math.min(25, Math.round((data.left.validReps / maxTargetReps) * 25));
  const rightNormScore = Math.min(25, Math.round((data.right.validReps / maxTargetReps) * 25));

  const leftArea: AreaScore = {
    areaId: 'split-squat-capacity-left',
    label: { sv: 'Benkapacitet Vänster', en: 'Left Leg Capacity' },
    score: leftNormScore,
    maxScore: 25,
    quality: data.left.quality,
    rawMeasurements: {
      totalReps: data.left.totalReps,
      validReps: data.left.validReps,
      averageDepthDeg: data.left.averageDepthDeg,
      depthConsistencyScore: data.left.depthConsistencyScore,
    },
    compensations: data.left.compensations,
    lastTestedAt: now,
  };

  const rightArea: AreaScore = {
    areaId: 'split-squat-capacity-right',
    label: { sv: 'Benkapacitet Höger', en: 'Right Leg Capacity' },
    score: rightNormScore,
    maxScore: 25,
    quality: data.right.quality,
    rawMeasurements: {
      totalReps: data.right.totalReps,
      validReps: data.right.validReps,
      averageDepthDeg: data.right.averageDepthDeg,
      depthConsistencyScore: data.right.depthConsistencyScore,
    },
    compensations: data.right.compensations,
    lastTestedAt: now,
  };

  const areas: AreaScore[] = [leftArea, rightArea];
  const totalScore = leftNormScore + rightNormScore;
  const compositeScore = Math.round((totalScore / 50) * 100);

  const updatedCapacity: DomainAssessment = {
    domain: 'CAPACITY',
    status: 'MEASURED',
    areas,
    compositeScore,
    confidence: 'HIGH',
    lastTestedAt: now,
    source: 'TARGETED_RETEST',
  };

  // Evaluate asymmetry
  const asymmetry = evaluateSplitSquatAsymmetry(data.left, data.right);
  const additionalBottlenecks: BodyFinding[] = [];
  const additionalStrengths: BodyFinding[] = [];

  if (asymmetry.severity !== 'NONE') {
    additionalBottlenecks.push({
      id: 'split-squat-asymmetry',
      domain: 'CAPACITY',
      areaId: 'split-squat-asymmetry',
      type: 'ASYMMETRY',
      severity: asymmetry.severity === 'SIGNIFICANT' ? 'SIGNIFICANT' : 'MODERATE',
      label: { sv: 'Asymmetri i benkapacitet', en: 'Leg capacity asymmetry' },
      description: asymmetry.findingDescription ?? {
        sv: `Skillnad mellan vänster och höger benkapacitet`,
        en: `Difference between left and right leg capacity`,
      },
      compatibleExerciseTags: ['split-squat-asymmetry', 'hip-mobility-poor', 'glute-activation-poor'],
      confidence: 'HIGH',
    });
  }

  // Check for low overall capacity (< 6 valid reps on either side)
  if (data.left.validReps < 6 || data.right.validReps < 6) {
    additionalBottlenecks.push({
      id: 'leg-capacity-low',
      domain: 'CAPACITY',
      areaId: 'split-squat-capacity-low',
      type: 'LIMITATION',
      severity: (data.left.validReps < 4 || data.right.validReps < 4) ? 'SIGNIFICANT' : 'MODERATE',
      label: { sv: 'Begränsad funktionell benkapacitet', en: 'Limited functional leg capacity' },
      description: {
        sv: `Repetitionsantal under målnivå (V: ${data.left.validReps}, H: ${data.right.validReps})`,
        en: `Rep count below target (L: ${data.left.validReps}, R: ${data.right.validReps})`,
      },
      compatibleExerciseTags: ['leg-capacity-low', 'glute-activation-poor'],
      confidence: 'HIGH',
    });
  } else if (data.left.validReps >= 12 && data.right.validReps >= 12) {
    additionalStrengths.push({
      id: 'leg-capacity-good',
      domain: 'CAPACITY',
      areaId: 'split-squat-capacity-good',
      type: 'STRENGTH',
      severity: 'MILD',
      label: { sv: 'God funktionell benkapacitet', en: 'Good functional leg capacity' },
      description: {
        sv: 'Hög och symmetrisk repetitionsuthållighet i båda benen',
        en: 'High and symmetrical repetition endurance in both legs',
      },
      compatibleExerciseTags: [],
      confidence: 'HIGH',
    });
  }

  return {
    ...profile,
    updatedAt: now,
    capacity: updatedCapacity,
    primaryBottlenecks: [...profile.primaryBottlenecks, ...additionalBottlenecks],
    keyStrengths: [...profile.keyStrengths, ...additionalStrengths],
  };
}
