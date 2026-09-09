/**
 * Golf Swing Metrics & Fault Detection
 *
 * Computes 2D/3D biomechanical kinematics at golf swing P-positions
 * and detects standard biomechanical swing faults (Early Extension,
 * Sway, Reverse Spine, Chicken Wing, Loss of Posture).
 *
 * @module golf-swing-metrics
 * @version GOLF_SWING_METRICS_V1
 */

import { PoseFrame } from '../types/pose-frame';
import { Landmark, LandmarkId } from '../types/landmark';
import {
  CameraViewAngle,
  SwingKinematics,
  SwingPhaseId,
  SwingFault
} from '../types/golf-swing';
import { interiorAngle } from './angle-calculator';

export const VERSION = 'GOLF_SWING_METRICS_V1';

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export function getLandmark(frame: PoseFrame, id: LandmarkId): Landmark | undefined {
  return frame.landmarks.find(l => l.id === id);
}

export function getMidpoint(a: { x: number; y: number; z?: number }, b: { x: number; y: number; z?: number }): Point3D {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z ?? 0) + (b.z ?? 0)) / 2
  };
}

export function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Computes transverse rotation angle (degrees) between left and right landmarks.
 * 0° = parallel to target line / perpendicular to camera optical axis.
 * Positive = turned away from target (backswing for right-handed golfer).
 */
export function computeTransverseTurn(
  left: { x: number; z?: number },
  right: { x: number; z?: number },
  isRightHanded = true
): number {
  const dx = Math.abs(right.x - left.x);
  const zLeft = left.z ?? 0;
  const zRight = right.z ?? 0;
  const dz = isRightHanded ? (zRight - zLeft) : (zLeft - zRight);

  if (dx < 0.001 && Math.abs(dz) < 0.001) return 0;
  return toDegrees(Math.atan2(dz, dx));
}

/**
 * Computes spine inclination from vertical (degrees).
 * In BODY_METRIC coordinates (Y points UP):
 * Vector from hip center to shoulder center vs vertical (0, 1).
 */
export function computeSpineInclination(frame: PoseFrame, view: CameraViewAngle): number {
  const ls = getLandmark(frame, LandmarkId.LEFT_SHOULDER);
  const rs = getLandmark(frame, LandmarkId.RIGHT_SHOULDER);
  const lh = getLandmark(frame, LandmarkId.LEFT_HIP);
  const rh = getLandmark(frame, LandmarkId.RIGHT_HIP);

  if (!ls || !rs || !lh || !rh) return 0;

  const shoulderCenter = getMidpoint(ls, rs);
  const hipCenter = getMidpoint(lh, rh);

  const dx = shoulderCenter.x - hipCenter.x;
  const dy = shoulderCenter.y - hipCenter.y;
  const dz = shoulderCenter.z - hipCenter.z;

  if (view === 'FACE_ON') {
    // Lateral spine tilt in coronal plane (XY)
    const angle = toDegrees(Math.atan2(dx, Math.abs(dy)));
    return Math.round(angle * 10) / 10;
  } else {
    // Forward spine flexion in sagittal plane (ZY or XY depending on projection)
    const planarLen = Math.sqrt(dx * dx + dz * dz);
    const angle = toDegrees(Math.atan2(planarLen, Math.abs(dy)));
    return Math.round(angle * 10) / 10;
  }
}

/**
 * Extracts complete kinematic metrics for a single P-phase frame.
 */
export function extractPhaseKinematics(
  frame: PoseFrame,
  phaseId: SwingPhaseId,
  addressFrame: PoseFrame,
  viewAngle: CameraViewAngle,
  isRightHanded = true
): SwingKinematics {
  const ls = getLandmark(frame, LandmarkId.LEFT_SHOULDER);
  const rs = getLandmark(frame, LandmarkId.RIGHT_SHOULDER);
  const lh = getLandmark(frame, LandmarkId.LEFT_HIP);
  const rh = getLandmark(frame, LandmarkId.RIGHT_HIP);
  const lk = getLandmark(frame, LandmarkId.LEFT_KNEE);
  const rk = getLandmark(frame, LandmarkId.RIGHT_KNEE);
  const la = getLandmark(frame, LandmarkId.LEFT_ANKLE);
  const ra = getLandmark(frame, LandmarkId.RIGHT_ANKLE);

  const leadShoulder = isRightHanded ? ls : rs;
  const leadElbow = getLandmark(frame, isRightHanded ? LandmarkId.LEFT_ELBOW : LandmarkId.RIGHT_ELBOW);
  const leadWrist = getLandmark(frame, isRightHanded ? LandmarkId.LEFT_WRIST : LandmarkId.RIGHT_WRIST);

  // Address baselines
  const addrLS = getLandmark(addressFrame, LandmarkId.LEFT_SHOULDER);
  const addrRS = getLandmark(addressFrame, LandmarkId.RIGHT_SHOULDER);
  const addrLH = getLandmark(addressFrame, LandmarkId.LEFT_HIP);
  const addrRH = getLandmark(addressFrame, LandmarkId.RIGHT_HIP);
  const addrNose = getLandmark(addressFrame, LandmarkId.NOSE);
  const currentNose = getLandmark(frame, LandmarkId.NOSE);

  // 1. Shoulder & Pelvis Turn (Calibrated relative to address baseline)
  let shoulderTurn = 0;
  let pelvisTurn = 0;

  if (viewAngle === 'FACE_ON') {
    shoulderTurn = (ls && rs) ? Math.round(computeTransverseTurn(ls, rs, isRightHanded)) : 0;
    pelvisTurn = (lh && rh) ? Math.round(computeTransverseTurn(lh, rh, isRightHanded)) : 0;
  } else {
    // In DTL: Transverse rotation is relative to address target line alignment
    const currST = (ls && rs) ? computeTransverseTurn(ls, rs, isRightHanded) : 0;
    const addrST = (addrLS && addrRS) ? computeTransverseTurn(addrLS, addrRS, isRightHanded) : 0;
    shoulderTurn = Math.round(currST - addrST);

    const currPT = (lh && rh) ? computeTransverseTurn(lh, rh, isRightHanded) : 0;
    const addrPT = (addrLH && addrRH) ? computeTransverseTurn(addrLH, addrRH, isRightHanded) : 0;
    pelvisTurn = Math.round(currPT - addrPT);
  }

  const xFactor = shoulderTurn - pelvisTurn;

  // 2. Spine Inclination
  const spineInclination = computeSpineInclination(frame, viewAngle);
  const addrSpine = computeSpineInclination(addressFrame, viewAngle);
  const spineAngleDelta = Math.round((spineInclination - addrSpine) * 10) / 10;

  // 3. Knee Flexion (Lead leg)
  const leadHip = isRightHanded ? lh : rh;
  const leadKnee = isRightHanded ? lk : rk;
  const leadAnkle = isRightHanded ? la : ra;
  let kneeFlex = 160;
  if (leadHip && leadKnee && leadAnkle) {
    const rawKneeAngle = interiorAngle(leadHip, leadKnee, leadAnkle);
    kneeFlex = Math.round(180 - rawKneeAngle); // Flexion from straight (0° = straight)
  }

  // 4. Lead Arm & Elbow Angle
  let leadArmAngle = 0;
  let leadElbowAngle = 180;
  if (leadShoulder && leadWrist) {
    const dx = leadWrist.x - leadShoulder.x;
    const dy = leadWrist.y - leadShoulder.y;
    leadArmAngle = Math.round(toDegrees(Math.atan2(dy, dx)));
  }
  if (leadShoulder && leadElbow && leadWrist) {
    leadElbowAngle = Math.round(interiorAngle(leadShoulder, leadElbow, leadWrist));
  }

  // 5. Lateral Head Sway (Target Line relative shift in mm or stance ratio)
  let lateralHeadSway = 0;
  let stanceWidth = 0.5;
  if (la && ra) {
    stanceWidth = Math.abs(ra.x - la.x) || 0.5;
  }
  if (addrNose && currentNose) {
    // Normalised to stance width percentage
    const rawShift = currentNose.x - addrNose.x;
    lateralHeadSway = Math.round((rawShift / stanceWidth) * 100);
  }

  // 6. Lateral Pelvis Shift
  let lateralPelvisShift = 0;
  if (addrLH && addrRH && lh && rh) {
    const addrMid = (addrLH.x + addrRH.x) / 2;
    const currMid = (lh.x + rh.x) / 2;
    lateralPelvisShift = Math.round(((currMid - addrMid) / stanceWidth) * 100);
  }

  // 7. Pelvis Thrust (Towards Ball / Early Extension in DTL view or Z displacement)
  let pelvisThrust = 0;
  if (addrLH && addrRH && lh && rh) {
    const addrZ = ((addrLH.z ?? 0) + (addrRH.z ?? 0)) / 2;
    const currZ = ((lh.z ?? 0) + (rh.z ?? 0)) / 2;
    pelvisThrust = Math.round((currZ - addrZ) * 100);
  }

  return {
    phaseId,
    timestampMs: frame.timestampMs,
    frameIndex: frame.frameId,
    shoulderTurn,
    pelvisTurn,
    xFactor,
    spineInclination,
    spineAngleDelta,
    kneeFlex,
    leadArmAngle,
    leadElbowAngle,
    lateralHeadSway,
    lateralPelvisShift,
    pelvisThrust
  };
}

/**
 * Detects common biomechanical faults across the full swing sequence.
 */
export function detectSwingFaults(
  kinematics: Record<SwingPhaseId, SwingKinematics>,
  viewAngle: CameraViewAngle
): SwingFault[] {
  const faults: SwingFault[] = [];

  const p1 = kinematics.P1_ADDRESS;
  const p4 = kinematics.P4_TOP;
  const p7 = kinematics.P7_IMPACT;
  const p8 = kinematics.P8_RELEASE;

  // 1. Early Extension / Loss of Posture at Impact (P7)
  // Characterized by hips thrusting toward the ball or spine straightening by > 8°
  if (p1 && p7) {
    const spineLoss = p7.spineAngleDelta; // Positive or negative straightening
    if (Math.abs(spineLoss) > 8 || p7.pelvisThrust > 8) {
      faults.push({
        id: 'EARLY_EXTENSION',
        name: { 'sv-SE': 'Early Extension (Höftskjut mot bollen)', 'en-US': 'Early Extension' },
        severity: Math.abs(spineLoss) > 12 ? 'HIGH' : 'MEDIUM',
        phaseDetected: 'P7_IMPACT',
        metricValue: Math.abs(spineLoss),
        threshold: 8,
        unit: '°',
        description: {
          'sv-SE': `Bäckenet rör sig mot bollen och ryggraden rätas upp ${Math.abs(spineLoss)}° i träffen, vilket leder till push, hook eller tunn träff.`,
          'en-US': `Pelvis moves forward toward ball line and spine straightens by ${Math.abs(spineLoss)}° at impact, causing push, hook, or thin contact.`
        },
        relatedBodyLimitation: {
          'sv-SE': 'Begränsad rörlighet i höftfällningen (Hip Hinge) och svaga sätesmuskler gör att kroppen måste resa sig för att skapa plats för armarna.',
          'en-US': 'Limited hip hinge mechanics and glute activation force the body to stand up early to make room for arm clearance.'
        }
      });
    }
  }

  // 2. Sway in Backswing (P4)
  // Lateral movement of pelvis/head away from target by > 15% of stance width
  if (p4) {
    if (p4.lateralPelvisShift < -15 || p4.lateralHeadSway < -15) {
      const swayVal = Math.max(Math.abs(p4.lateralPelvisShift), Math.abs(p4.lateralHeadSway));
      faults.push({
        id: 'SWAY_BACKSWING',
        name: { 'sv-SE': 'Höftsvaj i baksvingen (Sway)', 'en-US': 'Backswing Sway' },
        severity: swayVal > 22 ? 'HIGH' : 'MEDIUM',
        phaseDetected: 'P4_TOP',
        metricValue: swayVal,
        threshold: 15,
        unit: '%',
        description: {
          'sv-SE': `Kroppen glider ${swayVal}% i sidled bort från målet istället för att rotera runt en stabil axel.`,
          'en-US': `Pelvis or torso slides ${swayVal}% laterally away from target instead of rotating around a stable center.`
        },
        relatedBodyLimitation: {
          'sv-SE': 'Dålig inåtrotation i höger höft eller bristande bålstabilitet tvingar höften att glida åt sidan.',
          'en-US': 'Restricted trail hip internal rotation or core stability deficits cause lateral sliding instead of rotation.'
        }
      });
    }
  }

  // 3. Reverse Spine Angle (P4)
  // Upper body tilts backward toward target at the top of backswing
  if (p4 && p1) {
    if (viewAngle === 'FACE_ON' && p4.spineInclination > 10) {
      faults.push({
        id: 'REVERSE_SPINE',
        name: { 'sv-SE': 'Omvänd ryggradsvinkel (Reverse Spine)', 'en-US': 'Reverse Spine Angle' },
        severity: p4.spineInclination > 15 ? 'HIGH' : 'MEDIUM',
        phaseDetected: 'P4_TOP',
        metricValue: p4.spineInclination,
        threshold: 10,
        unit: '°',
        description: {
          'sv-SE': `Överkroppen lutar ${p4.spineInclination}° mot målet vid toppen av baksvingen, vilket sätter hög belastning på ländryggen och leder till slice eller pull.`,
          'en-US': `Torso tilts ${p4.spineInclination}° toward target at the top of swing, causing excessive lumbar shear stress and pulled/sliced shots.`
        },
        relatedBodyLimitation: {
          'sv-SE': 'Begränsad bröstryggsrotation gör att ryggraden tvingas böjas bakåt/i sidled för att få upp klubban.',
          'en-US': 'Restricted thoracic rotation forces the lumbar spine into hyperextension and lateral bend to create swing length.'
        }
      });
    }
  }

  // 4. Chicken Wing at Release (P8)
  // Lead elbow bends excessively (> 25° from straight) after impact
  if (p8) {
    const elbowFlex = 180 - p8.leadElbowAngle;
    if (elbowFlex > 25) {
      faults.push({
        id: 'CHICKEN_WING',
        name: { 'sv-SE': 'Chicken Wing vid release (P8)', 'en-US': 'Chicken Wing' },
        severity: elbowFlex > 35 ? 'HIGH' : 'MEDIUM',
        phaseDetected: 'P8_RELEASE',
        metricValue: elbowFlex,
        threshold: 25,
        unit: '°',
        description: {
          'sv-SE': `Främre armbågen böjs ${elbowFlex}° utåt direkt efter träff istället för att bibehålla full sträckning och rotation.`,
          'en-US': `Lead elbow folds ${elbowFlex}° outward through impact instead of extending and rotating naturally.`
        },
        relatedBodyLimitation: {
          'sv-SE': 'Bristande utåtrotation i främre axeln eller otillräcklig höftrotation tvingar armen att kompensera genom att vika sig.',
          'en-US': 'Limited lead shoulder external rotation or stalled pelvis turn forces the elbow to collapse to clear the club.'
        }
      });
    }
  }

  // 5. Over-Rotation of Pelvis at Top (P4)
  // If pelvis rotates > 55° (normal is ~40-45°), reducing X-Factor torque
  if (p4) {
    if (p4.pelvisTurn > 55) {
      faults.push({
        id: 'OVER_ROTATION_PELVIS',
        name: { 'sv-SE': 'Överroterat bäcken vid toppen (P4)', 'en-US': 'Over-Rotated Pelvis' },
        severity: p4.pelvisTurn > 65 ? 'HIGH' : 'MEDIUM',
        phaseDetected: 'P4_TOP',
        metricValue: p4.pelvisTurn,
        threshold: 55,
        unit: '°',
        description: {
          'sv-SE': `Bäckenet vrids ${p4.pelvisTurn}° i baksvingen (optimalt är 40–45°), vilket tömmer kroppen på torsionsspänning och skapar timingproblem i nedsvingen.`,
          'en-US': `Pelvis turns ${p4.pelvisTurn}° in backswing (tour average is 40–45°), collapsing the elastic X-Factor stretch.`
        },
        relatedBodyLimitation: {
          'sv-SE': 'Stel bröstrygg (Test 2) tvingar höfterna att vrida sig extra mycket för att få upp klubban till toppen.',
          'en-US': 'Thoracic spine stiffness forces excessive hip rotation to compensate for lack of upper body turn.'
        }
      });
    }
  }

  return faults;
}

/**
 * Calculates swing tempo (backswing ms, downswing ms, and ratio).
 */
export function calculateSwingTempo(
  p1: { timestampMs: number },
  p4: { timestampMs: number },
  p7: { timestampMs: number }
) {
  const backswingDurationMs = Math.max(1, p4.timestampMs - p1.timestampMs);
  const downswingDurationMs = Math.max(1, p7.timestampMs - p4.timestampMs);
  const totalDurationMs = backswingDurationMs + downswingDurationMs;
  const ratio = Math.round((backswingDurationMs / downswingDurationMs) * 10) / 10;

  let rating: 'EXCELLENT' | 'GOOD' | 'FAST_BACKSWING' | 'SLOW_BACKSWING' = 'GOOD';
  if (ratio >= 2.7 && ratio <= 3.3) {
    rating = 'EXCELLENT'; // Tour benchmark ~3.0:1
  } else if (ratio < 2.3) {
    rating = 'FAST_BACKSWING';
  } else if (ratio > 3.7) {
    rating = 'SLOW_BACKSWING';
  }

  return {
    backswingDurationMs,
    downswingDurationMs,
    totalDurationMs,
    tempoRatio: ratio,
    rating
  };
}
