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
  hipHingeAngle2D: number
): CompensationFlag[] {
  const flags: CompensationFlag[] = [];

  // EXCESSIVE_KNEE_BEND: kneeAngle < 135° OR shankInclination > 18°
  if (kneeAngle < 135 || shankInclination > 18) {
    flags.push({
      type: 'EXCESSIVE_KNEE_BEND',
      severity: 'FAIL',
      description: 'Excessive knee bend or forward shin angle during hinge',
    });
  }

  // CERVICAL_CRANING: |neckAlignment - 180| > 30°
  if (Math.abs(neckAlignment - 180) > 30) {
    flags.push({
      type: 'CERVICAL_CRANING',
      severity: 'WARNING',
      description: 'Cervical spine not neutral with torso',
    });
  }

  // LOCKED_KNEES: kneeAngle > 175° AND hipHingeAngle2D < 135°
  if (kneeAngle > 175 && hipHingeAngle2D < 135) {
    flags.push({
      type: 'LOCKED_KNEES',
      severity: 'WARNING',
      description: 'Knees completely locked during hinge',
    });
  }

  // NO_POSTERIOR_SHIFT: posteriorHipShift < 0.05 AND trunkInclination > 40°
  if (posteriorHipShift < 0.05 && trunkInclination > 40) {
    flags.push({
      type: 'NO_POSTERIOR_SHIFT',
      severity: 'FAIL',
      description: 'Failure to shift hips backwards during torso inclination',
    });
  }

  return flags;
}
