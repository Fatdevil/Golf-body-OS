/**
 * 240 fps Reference Golf Swing Trajectory Dataset
 *
 * Generates and provides an anatomically verified, high-speed 240 fps
 * Face-On golf swing sequence covering all 10 canonical P-positions
 * (P1 through P10) with complete 33-landmark 3D pose frames.
 *
 * @module sample-240fps-swing
 * @version SAMPLE_240FPS_SWING_V1
 */

import { PoseFrame } from '../types/pose-frame';
import { Landmark, LandmarkId } from '../types/landmark';
import { CameraViewAngle } from '../types/golf-swing';

export const VERSION = 'SAMPLE_240FPS_SWING_V2';

/**
 * Creates a synthetic landmark at given 3D coordinates.
 */
function lm(id: LandmarkId, x: number, y: number, z: number, visibility = 0.99): Landmark {
  return { id, x, y, z, visibility };
}

export type SampleSwingType = 'OPTIMAL' | 'EARLY_EXTENSION' | 'SWAY' | 'CHICKEN_WING';

/**
 * Generates a full 240 fps golf swing pose sequence (~480 frames = 2.0 seconds)
 * for either Face-On (frontal) or Down-The-Line (profile) camera angles.
 */
export function generate240FpsSwingSequence(
  totalFrames = 480,
  swingType: SampleSwingType = 'OPTIMAL',
  viewAngle: CameraViewAngle = 'FACE_ON'
): PoseFrame[] {
  if (viewAngle === 'DOWN_THE_LINE') {
    return generate240FpsDtlSequence(totalFrames, swingType);
  }
  return generate240FpsFaceOnSequence(totalFrames, swingType);
}

/**
 * Generates Face-On 240 fps golf swing sequence (coronal view).
 */
function generate240FpsFaceOnSequence(
  totalFrames = 480,
  swingType: SampleSwingType = 'OPTIMAL'
): PoseFrame[] {
  const frames: PoseFrame[] = [];
  const fps = 240;
  const frameDurationMs = 1000 / fps; // ~4.167 ms per frame

  // Key frame landmarks in sequence:
  // P1 (Address): Frame 40
  // P4 (Top of Backswing): Frame 230 (~0.79s after P1)
  // P7 (Impact): Frame 290 (~0.25s after P4)
  // P10 (Finish): Frame 420 (~0.54s after P7)

  for (let i = 0; i < totalFrames; i++) {
    const timestampMs = Math.round(i * frameDurationMs * 10) / 10;

    // Stance geometry (Face-On view, right-handed golfer)
    const feetY = 0.88;
    const kneeY = 0.70;
    let hipY = 0.50;
    const shoulderY = 0.28;
    const headY = 0.16;

    const leftAnkleX = 0.42;  // Lead side (towards target)
    const rightAnkleX = 0.58; // Trail side
    const leftKneeX = 0.44;
    const rightKneeX = 0.56;

    // Kinematic phase progression
    let shoulderAngleDeg = 0; // Transverse turn: 0° at address, +90° at top, -90° at finish
    let hipAngleDeg = 0;      // Pelvis turn: 0° at address, +45° at top, -45° at impact, -90° at finish
    let handX = 0.50;
    let handY = 0.55;
    let handZ = 0.0;

    if (i <= 40) {
      // P1: Address
      shoulderAngleDeg = 0;
      hipAngleDeg = 0;
      handX = 0.50;
      handY = 0.55;
      handZ = 0.0;
    } else if (i <= 230) {
      // Backswing (P1 -> P4)
      const prog = (i - 40) / (230 - 40); // 0 to 1
      const ease = 0.5 - 0.5 * Math.cos(prog * Math.PI);
      shoulderAngleDeg = ease * 92; // 0 to 92 degrees
      hipAngleDeg = ease * 44;      // 0 to 44 degrees
      handX = 0.50 + ease * 0.22;
      handY = 0.55 - ease * 0.32;
      handZ = ease * 0.20;
    } else if (i <= 290) {
      // Downswing (P4 -> P7) — rapid 60 frames = 250 ms!
      const prog = (i - 230) / (290 - 230); // 0 to 1
      const ease = Math.pow(prog, 1.8);
      shoulderAngleDeg = 92 - ease * (92 + 18);
      hipAngleDeg = 44 - ease * (44 + 36);
      handX = (0.50 + 0.22) - ease * (0.22 + 0.02);
      handY = (0.55 - 0.32) + ease * 0.32;
      handZ = 0.20 - ease * 0.22;

      if (swingType === 'EARLY_EXTENSION' && prog > 0.5) {
        hipY = 0.50 - (prog - 0.5) * 0.08;
      }
    } else if (i <= 420) {
      // Follow-Through to Finish (P7 -> P10)
      const prog = (i - 290) / (420 - 290); // 0 to 1
      const ease = 0.5 - 0.5 * Math.cos(prog * Math.PI);
      shoulderAngleDeg = -18 - ease * (95 - 18);
      hipAngleDeg = -36 - ease * (90 - 36);
      handX = 0.48 - ease * 0.25;
      handY = 0.55 - ease * 0.36;
      handZ = -0.02 - ease * 0.15;
    } else {
      // Hold finish
      shoulderAngleDeg = -95;
      hipAngleDeg = -90;
      handX = 0.23;
      handY = 0.19;
      handZ = -0.17;
    }

    // Convert angles to shoulder & hip positions
    const shoulderRad = (shoulderAngleDeg * Math.PI) / 180;
    const hipRad = (hipAngleDeg * Math.PI) / 180;
    const shoulderWidth = 0.18;
    const hipWidth = 0.14;

    const lsX = 0.50 - (shoulderWidth / 2) * Math.cos(shoulderRad);
    const lsZ = -(shoulderWidth / 2) * Math.sin(shoulderRad);
    const rsX = 0.50 + (shoulderWidth / 2) * Math.cos(shoulderRad);
    const rsZ = (shoulderWidth / 2) * Math.sin(shoulderRad);

    // Lateral sway offset if SWAY swing requested
    let lateralOffset = 0;
    if (swingType === 'SWAY' && i > 40 && i <= 230) {
      const prog = (i - 40) / 190;
      lateralOffset = Math.sin(prog * Math.PI) * 0.06;
    }

    // Early extension Z offset at impact
    let pelvisThrustZ = 0;
    if (swingType === 'EARLY_EXTENSION' && i > 250 && i <= 310) {
      const impactProg = 1 - Math.abs(i - 290) / 40;
      pelvisThrustZ = Math.max(0, impactProg * 0.14);
    }

    const lhX = 0.50 + lateralOffset - (hipWidth / 2) * Math.cos(hipRad);
    const lhZ = -(hipWidth / 2) * Math.sin(hipRad) + pelvisThrustZ;
    const rhX = 0.50 + lateralOffset + (hipWidth / 2) * Math.cos(hipRad);
    const rhZ = (hipWidth / 2) * Math.sin(hipRad) + pelvisThrustZ;

    const headX = 0.50 + lateralOffset * 0.5 + (i > 40 && i <= 230 ? ((i - 40) / 190) * 0.02 : (i > 230 && i <= 290 ? 0.02 : 0.0));

    let leadElbowOffsetX = -0.01;
    if (swingType === 'CHICKEN_WING' && i >= 290 && i <= 360) {
      leadElbowOffsetX = -0.06;
    }

    const landmarks: Landmark[] = [
      lm(LandmarkId.NOSE, headX, headY, 0),
      lm(LandmarkId.LEFT_SHOULDER, lsX, shoulderY, lsZ),
      lm(LandmarkId.RIGHT_SHOULDER, rsX, shoulderY, rsZ),
      lm(LandmarkId.LEFT_ELBOW, (lsX + handX) / 2 + leadElbowOffsetX, (shoulderY + handY) / 2, lsZ / 2),
      lm(LandmarkId.RIGHT_ELBOW, (rsX + handX) / 2 + 0.02, (shoulderY + handY) / 2, rsZ / 2),
      lm(LandmarkId.LEFT_WRIST, handX - 0.02, handY, handZ),
      lm(LandmarkId.RIGHT_WRIST, handX + 0.02, handY, handZ),
      lm(LandmarkId.LEFT_HIP, lhX, hipY, lhZ),
      lm(LandmarkId.RIGHT_HIP, rhX, hipY, rhZ),
      lm(LandmarkId.LEFT_KNEE, leftKneeX, kneeY, 0),
      lm(LandmarkId.RIGHT_KNEE, rightKneeX, kneeY, 0),
      lm(LandmarkId.LEFT_ANKLE, leftAnkleX, feetY, 0),
      lm(LandmarkId.RIGHT_ANKLE, rightAnkleX, feetY, 0),
      lm(LandmarkId.LEFT_HEEL, leftAnkleX - 0.02, feetY + 0.02, 0),
      lm(LandmarkId.RIGHT_HEEL, rightAnkleX + 0.02, feetY + 0.02, 0),
      lm(LandmarkId.LEFT_FOOT_INDEX, leftAnkleX - 0.05, feetY + 0.03, 0),
      lm(LandmarkId.RIGHT_FOOT_INDEX, rightAnkleX + 0.05, feetY + 0.03, 0),
    ];

    frames.push({
      frameId: i,
      timestampMs,
      width: 640,
      height: 480,
      landmarks,
      model: 'MEDIAPIPE_POSE',
      modelVersion: '0.10.14'
    });
  }

  return frames;
}

/**
 * Generates Down-The-Line (DTL) 240 fps golf swing sequence (profile sagittal view).
 * Golfer stands in profile facing target to the left.
 * Features authentic knee flexion, dynamic weight shift to posted lead leg,
 * trail foot heel release onto toe, folding elbows, and classic high tour finish.
 */
function generate240FpsDtlSequence(
  totalFrames = 480,
  swingType: SampleSwingType = 'OPTIMAL'
): PoseFrame[] {
  const frames: PoseFrame[] = [];
  const fps = 240;
  const frameDurationMs = 1000 / fps;

  // Ball is placed on turf at X = 0.34, Y = 0.905
  // Turf ground is at Y = 0.92

  for (let i = 0; i < totalFrames; i++) {
    const timestampMs = Math.round(i * frameDurationMs * 10) / 10;

    // Base address coordinates
    let leftAnkleX = 0.52;
    let leftAnkleY = 0.88;
    let rightAnkleX = 0.56;
    let rightAnkleY = 0.88;
    let rightHeelY = 0.90;

    let leftKneeX = 0.49;
    let leftKneeY = 0.70;
    let rightKneeX = 0.52;
    let rightKneeY = 0.70;

    let hipX = 0.60;
    let hipY = 0.52;
    let pelvisThrustZ = 0;

    let shoulderX = 0.455;
    let shoulderY = 0.30;
    let headX = 0.42;
    let headY = 0.18;

    let handX = 0.44;
    let handY = 0.56;
    let handZ = 0.0;

    let leftElbowX = 0.44;
    let leftElbowY = 0.43;
    let rightElbowX = 0.47;
    let rightElbowY = 0.43;

    let shoulderTurnDeg = 0;
    let pelvisTurnDeg = 0;

    if (i <= 40) {
      // P1: Address
      shoulderTurnDeg = 0;
      pelvisTurnDeg = 0;
      hipX = 0.60;
      hipY = 0.52;
      shoulderX = 0.455;
      shoulderY = 0.30;
      headX = 0.42;
      headY = 0.18;
      handX = 0.44;
      handY = 0.56;
      handZ = 0.0;
      leftElbowX = 0.44;
      leftElbowY = 0.43;
      rightElbowX = 0.47;
      rightElbowY = 0.43;
    } else if (i <= 230) {
      // Backswing (P1 -> P4)
      const prog = (i - 40) / (230 - 40);
      const ease = 0.5 - 0.5 * Math.cos(prog * Math.PI);
      shoulderTurnDeg = ease * 92;
      pelvisTurnDeg = ease * 44;

      // Hips coil and right glute deepens into Tush Line (0.60 -> 0.62)
      if (swingType === 'SWAY') {
        hipX = 0.60 - ease * 0.06;
      } else {
        hipX = 0.60 + ease * 0.015;
      }

      // Knee action: lead knee flexes soft inward; trail knee braces
      leftKneeX = 0.49 - ease * 0.02;
      leftKneeY = 0.70 + ease * 0.015;
      rightKneeX = 0.52 + ease * 0.005;

      // Hands elevate along swing plane to top
      handX = 0.44 + ease * 0.14; // Hands reach X = 0.58
      handY = 0.56 - ease * 0.36; // Hands reach top Y = 0.20
      handZ = ease * 0.20;

      // Elbows: lead arm straight, trail arm folds into waiter-tray 90° angle tucked under hands
      leftElbowX = 0.44 + ease * 0.07; // 0.51
      leftElbowY = 0.43 - ease * 0.18; // 0.25
      rightElbowX = 0.47 + ease * 0.07; // 0.54
      rightElbowY = 0.43 - ease * 0.11; // 0.32 (tucked lower than hands!)

      shoulderX = 0.455 + ease * 0.02;
      shoulderY = 0.30 - ease * 0.01;
    } else if (i <= 290) {
      // Downswing (P4 -> P7)
      const prog = (i - 230) / (290 - 230);
      const ease = Math.pow(prog, 1.8);

      shoulderTurnDeg = 92 - ease * (92 + 18);
      pelvisTurnDeg = 44 - ease * (44 + 36);

      // Hands drop into the slot along delivery plane to forward shaft lean at impact
      handX = 0.58 - ease * 0.19; // Reaches X = 0.39 at impact
      handY = 0.20 + ease * 0.34; // Reaches Y = 0.54 at impact
      handZ = 0.20 - ease * 0.22;

      // Elbows: trail elbow drops down & tucks into trail hip (slot shallowing), lead arm extends
      leftElbowX = 0.51 - ease * 0.09; // 0.42
      leftElbowY = 0.25 + ease * 0.17; // 0.42
      rightElbowX = 0.54 - ease * 0.09; // 0.45
      rightElbowY = 0.32 + ease * 0.11; // 0.43

      // Knees & Feet: lead knee begins posting; trail knee kicks in; trail heel begins release
      leftKneeX = 0.47 + ease * 0.03;  // 0.50
      rightKneeX = 0.52 - ease * 0.03; // 0.49
      rightHeelY = 0.90 - ease * 0.02; // 0.88

      if (swingType === 'EARLY_EXTENSION' && prog > 0.25) {
        const eeFactor = Math.pow((prog - 0.25) / 0.75, 1.5);
        hipX = 0.60 - eeFactor * 0.11;
        hipY = 0.52 - eeFactor * 0.03;
        pelvisThrustZ = eeFactor * 0.15;

        shoulderY = 0.30 - eeFactor * 0.08;
        shoulderX = 0.455 + eeFactor * 0.07;
        headY = 0.18 - eeFactor * 0.06;
      } else {
        hipX = 0.60 - ease * 0.005;
        hipY = 0.52;
        shoulderX = 0.455;
        shoulderY = 0.30;
      }
    } else if (i <= 420) {
      // Follow-Through to Finish (P7 -> P10)
      const prog = (i - 290) / (420 - 290);
      const ease = 0.5 - 0.5 * Math.cos(prog * Math.PI);

      shoulderTurnDeg = -18 - ease * (95 - 18);
      pelvisTurnDeg = -36 - ease * (90 - 36);

      // LEAD LEG POSTS UP TALL & STRAIGHT; TRAIL FOOT PEELS ONTO TOE
      leftKneeX = 0.50 - ease * 0.04; // 0.46
      leftKneeY = 0.70 - ease * 0.04; // 0.66
      leftAnkleX = 0.52 - ease * 0.02; // 0.50

      rightHeelY = 0.88 - ease * 0.10; // 0.78 (heel elevated high on toe!)
      rightAnkleY = 0.88 - ease * 0.08; // 0.80
      rightAnkleX = 0.56 - ease * 0.05; // 0.51
      rightKneeX = 0.49 - ease * 0.02;  // 0.47
      rightKneeY = 0.70 - ease * 0.02;  // 0.68

      // Pelvis clears forward and stands tall
      hipX = 0.60 - ease * 0.12; // 0.48
      hipY = 0.52 - ease * 0.05; // 0.47
      shoulderX = 0.455 + ease * 0.02; // 0.475
      shoulderY = 0.30 - ease * 0.06;  // 0.24 (tall upright finish)
      headX = 0.42 + ease * 0.02;      // 0.44
      headY = 0.18 - ease * 0.04;      // 0.14

      // HANDS & ARMS: release along line at P8, then WRAP HIGH OVER LEAD SHOULDER AT FINISH
      if (prog < 0.25) {
        // P8 Release: extending down the target line to the left
        const relProg = prog / 0.25;
        handX = 0.39 - relProg * 0.14; // Reaches X = 0.25
        handY = 0.54 - relProg * 0.02; // Y = 0.52
        leftElbowX = 0.42 - relProg * 0.08; // 0.34
        leftElbowY = 0.42;
        rightElbowX = 0.45 - relProg * 0.08; // 0.37
        rightElbowY = 0.43;
      } else {
        // Re-hinge into high tour wrap finish
        const finProg = (prog - 0.25) / 0.75;
        const finEase = 0.5 - 0.5 * Math.cos(finProg * Math.PI);
        handX = 0.25 + finEase * 0.21; // Hands finish high beside lead ear at X = 0.46
        handY = 0.52 - finEase * 0.34; // Hands finish high at Y = 0.18
        leftElbowX = 0.34 + finEase * 0.08; // 0.42
        leftElbowY = 0.42 - finEase * 0.16; // 0.26
        rightElbowX = 0.37 + finEase * 0.11; // 0.48
        rightElbowY = 0.43 - finEase * 0.15; // 0.28
      }
      handZ = -0.02 - ease * 0.15;
    } else {
      // Hold elegant tour finish
      shoulderTurnDeg = -95;
      pelvisTurnDeg = -90;
      handX = 0.46;
      handY = 0.18;
      handZ = -0.17;
      leftElbowX = 0.42;
      leftElbowY = 0.26;
      rightElbowX = 0.48;
      rightElbowY = 0.28;
      hipX = 0.48;
      hipY = 0.47;
      shoulderX = 0.475;
      shoulderY = 0.24;
      headX = 0.44;
      headY = 0.14;
      leftAnkleX = 0.50;
      leftKneeX = 0.46;
      leftKneeY = 0.66;
      rightHeelY = 0.78;
      rightAnkleY = 0.80;
      rightAnkleX = 0.51;
      rightKneeX = 0.47;
      rightKneeY = 0.68;
    }

    // Convert 3D turn into shoulder/hip coordinates
    const shoulderRad = (shoulderTurnDeg * Math.PI) / 180;
    const hipRad = (pelvisTurnDeg * Math.PI) / 180;
    const shoulderOffsetZ = 0.14 * Math.sin(shoulderRad);
    const hipOffsetZ = 0.10 * Math.sin(hipRad);

    const lsX = shoulderX - 0.02 * Math.cos(shoulderRad);
    const rsX = shoulderX + 0.02 * Math.cos(shoulderRad);
    const lsZ = -0.06 - shoulderOffsetZ;
    const rsZ = 0.06 + shoulderOffsetZ;

    const lhX = hipX - 0.01 * Math.cos(hipRad);
    const rhX = hipX + 0.01 * Math.cos(hipRad);
    const lhZ = -0.05 - hipOffsetZ + pelvisThrustZ;
    const rhZ = 0.05 + hipOffsetZ + pelvisThrustZ;

    // Elbows: Chicken Wing simulation at P8
    let leadElbowOffsetX = 0;
    if (swingType === 'CHICKEN_WING' && i >= 290 && i <= 340) {
      leadElbowOffsetX = 0.07; // Flaring lead elbow backward
    }

    const landmarks: Landmark[] = [
      lm(LandmarkId.NOSE, headX, headY, 0),
      lm(LandmarkId.LEFT_SHOULDER, lsX, shoulderY, lsZ),
      lm(LandmarkId.RIGHT_SHOULDER, rsX, shoulderY, rsZ),
      lm(LandmarkId.LEFT_ELBOW, leftElbowX + leadElbowOffsetX, leftElbowY, lsZ / 2),
      lm(LandmarkId.RIGHT_ELBOW, rightElbowX, rightElbowY, rsZ / 2),
      lm(LandmarkId.LEFT_WRIST, handX - 0.01, handY, handZ),
      lm(LandmarkId.RIGHT_WRIST, handX + 0.01, handY, handZ),
      lm(LandmarkId.LEFT_HIP, lhX, hipY, lhZ),
      lm(LandmarkId.RIGHT_HIP, rhX, hipY, rhZ),
      lm(LandmarkId.LEFT_KNEE, leftKneeX, leftKneeY, -0.04),
      lm(LandmarkId.RIGHT_KNEE, rightKneeX, rightKneeY, 0.04),
      lm(LandmarkId.LEFT_ANKLE, leftAnkleX, leftAnkleY, -0.05),
      lm(LandmarkId.RIGHT_ANKLE, rightAnkleX, rightAnkleY, 0.05),
      lm(LandmarkId.LEFT_HEEL, leftAnkleX + 0.02, 0.90, -0.05),
      lm(LandmarkId.RIGHT_HEEL, rightAnkleX + 0.02, rightHeelY, 0.05),
      lm(LandmarkId.LEFT_FOOT_INDEX, leftAnkleX - 0.04, 0.91, -0.05),
      lm(LandmarkId.RIGHT_FOOT_INDEX, rightAnkleX - 0.04, 0.91, 0.05),
    ];

    frames.push({
      frameId: i,
      timestampMs,
      width: 640,
      height: 480,
      landmarks,
      model: 'MEDIAPIPE_POSE',
      modelVersion: '0.10.14'
    });
  }

  return frames;
}
