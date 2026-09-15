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
  SwingFault,
  SwingTempo
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
  const dx = right.x - left.x;
  const zLeft = left.z ?? 0;
  const zRight = right.z ?? 0;
  const dz = zRight - zLeft;

  if (Math.abs(dx) < 0.001 && Math.abs(dz) < 0.001) return 0;
  const deg = toDegrees(Math.atan2(dz, dx));
  return isRightHanded ? deg : -deg;
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
 * Computes the 3D cranial center of the head.
 * Prefers the midpoint between LEFT_EAR and RIGHT_EAR for rotation-invariant tracking,
 * with fallback to NOSE if ears are not detected.
 */
export function getCranialCenter(frame: PoseFrame): { x: number; y: number; z: number } | null {
  const earL = getLandmark(frame, LandmarkId.LEFT_EAR);
  const earR = getLandmark(frame, LandmarkId.RIGHT_EAR);
  if (earL && earR) {
    return {
      x: (earL.x + earR.x) / 2,
      y: (earL.y + earR.y) / 2,
      z: ((earL.z ?? 0) + (earR.z ?? 0)) / 2
    };
  }
  const nose = getLandmark(frame, LandmarkId.NOSE);
  if (nose) {
    return { x: nose.x, y: nose.y, z: nose.z ?? 0 };
  }
  return null;
}

/**
 * Computes head rotation (Yaw) and head tilt (Roll) in degrees.
 */
export function computeHeadRotation(
  frame: PoseFrame,
  isRightHanded = true
): { yawDeg: number; tiltDeg: number } {
  const earL = getLandmark(frame, LandmarkId.LEFT_EAR);
  const earR = getLandmark(frame, LandmarkId.RIGHT_EAR);
  const nose = getLandmark(frame, LandmarkId.NOSE);

  let yawDeg = 0;
  let tiltDeg = 0;

  if (earL && earR) {
    const dx = earR.x - earL.x;
    const dy = earR.y - earL.y;
    const dz = (earR.z ?? 0) - (earL.z ?? 0);

    // Roll / Tilt: angle of ear line vs horizontal
    tiltDeg = Math.round(toDegrees(Math.atan2(dy, dx)));

    // Yaw (Head turn around vertical cervical spine):
    if (Math.abs(dz) > 0.005) {
      // 3D calculation if depth is available
      yawDeg = Math.round(toDegrees(Math.atan2(dz, Math.abs(dx))));
    } else if (nose) {
      // 2D projection: nose offset relative to ear midpoint
      const earMidX = (earL.x + earR.x) / 2;
      const earHalfDist = Math.abs(dx) / 2 || 0.04;
      const ratio = Math.max(-1, Math.min(1, (nose.x - earMidX) / earHalfDist));
      yawDeg = Math.round(toDegrees(Math.asin(ratio)));
    }
  }

  return { yawDeg, tiltDeg };
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

  // Helper to normalize angle difference into [-180, 180]
  const angleDelta = (curr: number, addr: number) => {
    let diff = (curr - addr) % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return diff;
  };

  // 1. Shoulder & Pelvis Turn (Calibrated relative to address baseline)
  let shoulderTurn = 0;
  let pelvisTurn = 0;

  if (viewAngle === 'FACE_ON') {
    // Foreshortening proxy from projected width in coronal plane (XY)
    const addrShoulderWidth = (addrLS && addrRS) ? Math.abs(addrRS.x - addrLS.x) : 0.2;
    const currShoulderWidth = (ls && rs) ? Math.abs(rs.x - ls.x) : 0.2;
    const ratioS = Math.min(1.0, Math.max(0.0, currShoulderWidth / Math.max(0.05, addrShoulderWidth)));
    const projST = toDegrees(Math.acos(ratioS));

    const addrPelvisWidth = (addrLH && addrRH) ? Math.abs(addrRH.x - addrLH.x) : 0.15;
    const currPelvisWidth = (lh && rh) ? Math.abs(rh.x - lh.x) : 0.15;
    const ratioP = Math.min(1.0, Math.max(0.0, currPelvisWidth / Math.max(0.05, addrPelvisWidth)));
    const projPT = toDegrees(Math.acos(ratioP));

    const currST = (ls && rs) ? computeTransverseTurn(ls, rs, isRightHanded) : 0;
    const addrST = (addrLS && addrRS) ? computeTransverseTurn(addrLS, addrRS, isRightHanded) : 0;
    const zST = angleDelta(currST, addrST);

    const currPT = (lh && rh) ? computeTransverseTurn(lh, rh, isRightHanded) : 0;
    const addrPT = (addrLH && addrRH) ? computeTransverseTurn(addrLH, addrRH, isRightHanded) : 0;
    const zPT = angleDelta(currPT, addrPT);

    // Coronal plane shoulder and pelvis tilt (in degrees from horizontal)
    // When turning around a forward-tilted spine in backswing, the lead shoulder drops
    // creating a 2D tilt that directly correlates with 3D torso turn (approx 2.5x coronal tilt).
    const shoulderTiltDeg = (ls && rs)
      ? toDegrees(Math.atan2(Math.abs(rs.y - ls.y), Math.max(0.01, Math.abs(rs.x - ls.x))))
      : 0;
    const addrShoulderTiltDeg = (addrLS && addrRS)
      ? toDegrees(Math.atan2(Math.abs(addrRS.y - addrLS.y), Math.max(0.01, Math.abs(addrRS.x - addrLS.x))))
      : 0;
    const deltaShoulderTilt = Math.max(0, shoulderTiltDeg - addrShoulderTiltDeg);
    const tiltST = Math.min(105, deltaShoulderTilt * 2.55);

    const pelvisTiltDeg = (lh && rh)
      ? toDegrees(Math.atan2(Math.abs(rh.y - lh.y), Math.max(0.01, Math.abs(rh.x - lh.x))))
      : 0;
    const addrPelvisTiltDeg = (addrLH && addrRH)
      ? toDegrees(Math.atan2(Math.abs(addrRH.y - addrLH.y), Math.max(0.01, Math.abs(addrRH.x - addrLH.x))))
      : 0;
    const deltaPelvisTilt = Math.max(0, pelvisTiltDeg - addrPelvisTiltDeg);
    const tiltPT = Math.min(65, deltaPelvisTilt * 2.5);

    const isExactAddress = (frame === addressFrame) || (frame.frameId !== undefined && addressFrame.frameId !== undefined && frame.frameId === addressFrame.frameId);

    // Determine turn direction (+ = backswing away from target, - = follow-through towards target)
    let isBackswing = true;
    if (phaseId === 'P7_IMPACT' || phaseId === 'P8_RELEASE' || phaseId === 'P9_REHINGE' || phaseId === 'P10_FINISH') {
      isBackswing = false;
    } else if (phaseId === 'P2_TAKEAWAY' || phaseId === 'P3_HALFWAY_BACK' || phaseId === 'P4_TOP' || phaseId === 'P5_SHALLOW' || phaseId === 'P6_DELIVERY') {
      isBackswing = true;
    } else if (isExactAddress) {
      isBackswing = true;
    } else {
      const currHand = getMidpoint(getLandmark(frame, LandmarkId.LEFT_WRIST) || { x: 0.5, y: 0.5 }, getLandmark(frame, LandmarkId.RIGHT_WRIST) || { x: 0.5, y: 0.5 });
      const addrHand = getMidpoint(getLandmark(addressFrame, LandmarkId.LEFT_WRIST) || { x: 0.5, y: 0.5 }, getLandmark(addressFrame, LandmarkId.RIGHT_WRIST) || { x: 0.5, y: 0.5 });
      isBackswing = isRightHanded ? (currHand.x >= addrHand.x - 0.03) : (currHand.x <= addrHand.x + 0.03);
    }

    const sign = isBackswing ? 1 : -1;
    let magST = 0;
    let magPT = 0;

    if (isBackswing) {
      // In backswing: 2D coronal tilt (lead shoulder drop) provides a strong proxy for 3D turn around tilted spine
      magST = Math.min(105, Math.max(Math.abs(zST), Math.max(projST, tiltST)));
      magPT = Math.min(50, Math.max(Math.abs(zPT), Math.max(projPT, tiltPT)));
    } else {
      // In downswing and follow-through: use direct transverse turn & projected body clearing
      const zMagST = Math.abs(zST) > 10 ? Math.abs(zST) : projST;
      const zMagPT = Math.abs(zPT) > 10 ? Math.abs(zPT) : projPT;
      magST = Math.min(100, Math.max(zMagST, projST));
      magPT = Math.min(75, Math.max(zMagPT, projPT));
    }

    shoulderTurn = isExactAddress ? 0 : Math.round(sign * magST);
    pelvisTurn = isExactAddress ? 0 : Math.round(sign * magPT);
  } else {
    // In DTL: Transverse rotation is relative to address target line alignment
    const currST = (ls && rs) ? computeTransverseTurn(ls, rs, isRightHanded) : 0;
    const addrST = (addrLS && addrRS) ? computeTransverseTurn(addrLS, addrRS, isRightHanded) : 0;
    shoulderTurn = Math.round(angleDelta(currST, addrST));

    const currPT = (lh && rh) ? computeTransverseTurn(lh, rh, isRightHanded) : 0;
    const addrPT = (addrLH && addrRH) ? computeTransverseTurn(addrLH, addrRH, isRightHanded) : 0;
    pelvisTurn = Math.round(angleDelta(currPT, addrPT));
  }

  const xFactor = shoulderTurn - pelvisTurn;

  // 2. Spine Inclination
  const spineInclination = computeSpineInclination(frame, viewAngle);
  const addrSpine = computeSpineInclination(addressFrame, viewAngle);
  const spineAngleDelta = Math.round((spineInclination - addrSpine) * 10) / 10;

  // 3. Knee Kinematics (Lead & Trail)
  const leadHip = isRightHanded ? lh : rh;
  const leadKnee = isRightHanded ? lk : rk;
  const leadAnkle = isRightHanded ? la : ra;
  const trailHip = isRightHanded ? rh : lh;
  const trailKnee = isRightHanded ? rk : lk;
  const trailAnkle = isRightHanded ? ra : la;

  let leadKneeFlexionDeg = 160;
  let trailKneeFlexionDeg = 160;
  let kneeFlex = 20;

  if (leadHip && leadKnee && leadAnkle) {
    leadKneeFlexionDeg = Math.round(interiorAngle(leadHip, leadKnee, leadAnkle));
    kneeFlex = Math.round(180 - leadKneeFlexionDeg); // Backwards compatible knee flex angle
  }
  if (trailHip && trailKnee && trailAnkle) {
    trailKneeFlexionDeg = Math.round(interiorAngle(trailHip, trailKnee, trailAnkle));
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

  // 5. 3D Head Motion & True Cranial Center
  const addrHeadCenter = getCranialCenter(addressFrame);
  const currHeadCenter = getCranialCenter(frame);
  const headOrientation = computeHeadRotation(frame, isRightHanded);

  let lateralHeadSway = 0;
  let headVerticalDip = 0;
  let stanceWidth = 0.25;
  if (viewAngle === 'FACE_ON' && la && ra) {
    stanceWidth = Math.max(0.15, Math.abs(ra.x - la.x));
  } else if (addrLH && addrLS) {
    stanceWidth = Math.max(0.20, Math.abs(addrLH.y - addrLS.y) * 0.7);
  }
  if (addrHeadCenter && currHeadCenter) {
    // Normalised to stance width percentage
    const rawShift = currHeadCenter.x - addrHeadCenter.x;
    lateralHeadSway = Math.round((rawShift / stanceWidth) * 100);

    // Vertical displacement (+ = downward dip/compression, - = upward lift)
    const rawDip = currHeadCenter.y - addrHeadCenter.y;
    headVerticalDip = Math.round((rawDip / stanceWidth) * 100);
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
  if (viewAngle === 'DOWN_THE_LINE') {
    if (addrLH && addrRH && lh && rh) {
      const isButtOnRight = isRightHanded;
      const addrHipX = isButtOnRight ? Math.max(addrLH.x, addrRH.x) : Math.min(addrLH.x, addrRH.x);
      const currHipX = isButtOnRight ? Math.max(lh.x, rh.x) : Math.min(lh.x, rh.x);
      const thrustX = isButtOnRight ? (addrHipX - currHipX) : (currHipX - addrHipX);
      pelvisThrust = Math.round((thrustX / stanceWidth) * 100);
    }
  } else {
    if (addrLH && addrRH && lh && rh) {
      const addrZ = ((addrLH.z ?? 0) + (addrRH.z ?? 0)) / 2;
      const currZ = ((lh.z ?? 0) + (rh.z ?? 0)) / 2;
      pelvisThrust = Math.round((currZ - addrZ) * 100);
    }
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
    headRotationDeg: headOrientation.yawDeg,
    headTiltDeg: headOrientation.tiltDeg,
    headVerticalDip,
    leadKneeFlexionDeg,
    trailKneeFlexionDeg,
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
  viewAngle: CameraViewAngle,
  isRightHanded = true
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
  // In Face-On:
  // For right-handed, target is -X (left), trail side is +X (right). Sway = shift > +15%.
  // For left-handed, target is +X (right), trail side is -X (left). Sway = shift < -15%.
  if (p4 && viewAngle === 'FACE_ON') {
    const isSway = isRightHanded
      ? ((p4.lateralPelvisShift ?? 0) > 15 || (p4.lateralHeadSway ?? 0) > 15)
      : ((p4.lateralPelvisShift ?? 0) < -15 || (p4.lateralHeadSway ?? 0) < -15);
    if (isSway) {
      const swayVal = Math.max(Math.abs(p4.lateralPelvisShift ?? 0), Math.abs(p4.lateralHeadSway ?? 0));
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
  // In Face-On:
  // Normal spine tilt at address has shoulders neutral or tilted slightly away from target.
  // Leaning toward target at P4 means negative tilt for right-handed (< -5°), or significant loss of secondary tilt.
  if (p4 && p1) {
    const isReverseSpine = isRightHanded
      ? (p4.spineInclination < -5 || (p1.spineInclination - p4.spineInclination) > 12)
      : (p4.spineInclination > 5 || (p4.spineInclination - p1.spineInclination) > 12);
    if (viewAngle === 'FACE_ON' && isReverseSpine) {
      const metricValue = Math.round(Math.abs(p4.spineInclination) * 10) / 10;
      faults.push({
        id: 'REVERSE_SPINE',
        name: { 'sv-SE': 'Omvänd ryggradsvinkel (Reverse Spine)', 'en-US': 'Reverse Spine Angle' },
        severity: metricValue > 12 ? 'HIGH' : 'MEDIUM',
        phaseDetected: 'P4_TOP',
        metricValue,
        threshold: 10,
        unit: '°',
        description: {
          'sv-SE': `Överkroppen lutar ${metricValue}° mot målet vid toppen av baksvingen, vilket sätter hög belastning på ländryggen och leder till slice eller pull.`,
          'en-US': `Torso tilts ${metricValue}° toward target at the top of swing, causing excessive lumbar shear stress and pulled/sliced shots.`
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
 * Accepts optional timeScaleFactor (e.g. 4 for 120fps slow-mo or 8 for 240fps slow-mo)
 * to normalize recorded timestamps to actual real-world milliseconds.
 */
export function calculateSwingTempo(
  p1: { timestampMs: number },
  p4: { timestampMs: number },
  p7: { timestampMs: number },
  timeScaleFactor = 1.0
): SwingTempo {
  const factor = Math.max(0.1, timeScaleFactor);
  const rawBackswingMs = Math.max(1, p4.timestampMs - p1.timestampMs);
  const rawDownswingMs = Math.max(1, p7.timestampMs - p4.timestampMs);

  const backswingDurationMs = Math.round(rawBackswingMs / factor);
  const downswingDurationMs = Math.round(rawDownswingMs / factor);
  const totalDurationMs = backswingDurationMs + downswingDurationMs;
  const ratio = Math.round((backswingDurationMs / downswingDurationMs) * 10) / 10;

  let rating: 'EXCELLENT' | 'GOOD' | 'FAST_BACKSWING' | 'SLOW_BACKSWING' = 'GOOD';
  if (ratio >= 2.5 && ratio <= 3.5) {
    rating = 'EXCELLENT'; // Tour benchmark ~3.0:1 (2.5:1 - 3.5:1)
  } else if (ratio < 2.1) {
    rating = 'FAST_BACKSWING';
  } else if (ratio > 4.0) {
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
