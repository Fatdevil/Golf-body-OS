export const VERSION = 'COMPENSATION_DETECTOR_V1';

export type CompensationType =
  | 'EXCESSIVE_KNEE_BEND'
  | 'CERVICAL_CRANING'
  | 'LOCKED_KNEES'
  | 'NO_POSTERIOR_SHIFT';

export interface CompensationFlag {
  type: CompensationType;
  severity: 'WARNING' | 'FAIL';
  description: string;
  triggeredRule: string;
  observedValue: number;
  threshold: number;
  unit: string;
  repIndex: number;
  frameRange?: [number, number];
}

/**
 * Detects compensations for the hip hinge protocol.
 */
export function detectCompensations(
  kneeAngle: number,
  shankInclination: number,
  neckAlignment: number,
  posteriorHipShift: number,
  trunkInclination: number,
  hipHingeAngle2D: number,
  repIndex: number
): CompensationFlag[] {
  const flags: CompensationFlag[] = [];

  // EXCESSIVE_KNEE_BEND: kneeAngle < 135° OR shankInclination > 18°
  if (kneeAngle < 135) {
    flags.push({
      type: 'EXCESSIVE_KNEE_BEND',
      severity: 'FAIL',
      description: 'Excessive knee bend during hinge',
      triggeredRule: 'KNEE_ANGLE_LT_135',
      observedValue: kneeAngle,
      threshold: 135,
      unit: 'degrees',
      repIndex
    });
  } else if (shankInclination > 18) {
    flags.push({
      type: 'EXCESSIVE_KNEE_BEND',
      severity: 'FAIL',
      description: 'Forward shin angle during hinge',
      triggeredRule: 'SHANK_INCLINATION_GT_18',
      observedValue: shankInclination,
      threshold: 18,
      unit: 'degrees',
      repIndex
    });
  }

  // CERVICAL_CRANING: |neckAlignment - 180| > 30°
  if (Math.abs(neckAlignment - 180) > 30) {
    flags.push({
      type: 'CERVICAL_CRANING',
      severity: 'WARNING',
      description: 'Cervical spine not neutral with torso',
      triggeredRule: 'NECK_ALIGNMENT_DEV_GT_30',
      observedValue: Math.abs(neckAlignment - 180),
      threshold: 30,
      unit: 'degrees',
      repIndex
    });
  }

  // LOCKED_KNEES: kneeAngle > 175° AND hipHingeAngle2D < 135°
  if (kneeAngle > 175 && hipHingeAngle2D < 135) {
    flags.push({
      type: 'LOCKED_KNEES',
      severity: 'WARNING',
      description: 'Knees completely locked during hinge',
      triggeredRule: 'KNEE_GT_175_AND_HINGE_LT_135',
      observedValue: kneeAngle,
      threshold: 175,
      unit: 'degrees',
      repIndex
    });
  }

  // NO_POSTERIOR_SHIFT: posteriorHipShift < 0.05 AND trunkInclination > 40°
  if (posteriorHipShift < 0.05 && trunkInclination > 40) {
    flags.push({
      type: 'NO_POSTERIOR_SHIFT',
      severity: 'FAIL',
      description: 'Insufficient posterior weight shift during hinge',
      triggeredRule: 'HIP_SHIFT_LT_0.05_AND_TRUNK_GT_40',
      observedValue: posteriorHipShift,
      threshold: 0.05,
      unit: 'ratio',
      repIndex
    });
  }

  return flags;
}
