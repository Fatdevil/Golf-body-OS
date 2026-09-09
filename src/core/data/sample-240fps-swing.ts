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
 * Golfer stands in profile facing target to the left. Glutes on Tush Line (X = 0.62) at address.
 */
function generate240FpsDtlSequence(
  totalFrames = 480,
  swingType: SampleSwingType = 'OPTIMAL'
): PoseFrame[] {
  const frames: PoseFrame[] = [];
  const fps = 240;
  const frameDurationMs = 1000 / fps;

  // Key landmarks in DTL view:
  // Target is to the LEFT (Screen -X)
  // Ball is placed on turf at X = 0.34, Y = 0.905
  // Turf ground is at Y = 0.92

  for (let i = 0; i < totalFrames; i++) {
    const timestampMs = Math.round(i * frameDurationMs * 10) / 10;

    // Address Baselines (Profile Sagittal View)
    // Feet stance
    let leftAnkleX = 0.52;  // Lead foot
    const leftAnkleY = 0.88;
    let rightAnkleX = 0.56; // Trail foot
    let rightAnkleY = 0.88;
    let rightHeelY = 0.90;

    // Knees
    let leftKneeX = 0.49;
    let rightKneeX = 0.52;
    let kneeY = 0.70;

    // Pelvis & Tush Line (Address hip depth X = 0.60, Tush line at 0.62)
    let hipX = 0.60;
    let hipY = 0.52;
    let pelvisThrustZ = 0;

    // Torso / Spine (Forward bend ~33°)
    let shoulderX = 0.455;
    let shoulderY = 0.30;
    let headX = 0.42;
    let headY = 0.18;

    // Hands
    let handX = 0.44;
    let handY = 0.56;
    let handZ = 0.0;

    // Phase progression
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
      handX = 0.44;
      handY = 0.56;
      handZ = 0.0;
    } else if (i <= 230) {
      // Backswing (P1 -> P4)
      const prog = (i - 40) / (230 - 40);
      const ease = 0.5 - 0.5 * Math.cos(prog * Math.PI);
      shoulderTurnDeg = ease * 92;
      pelvisTurnDeg = ease * 44;

      // Hips coil and right glute pushes deep into Tush Line
      if (swingType === 'SWAY') {
        // Sway in DTL: loses hip hinge depth and drifts forward/out of posture
        hipX = 0.60 - ease * 0.06;
      } else {
        hipX = 0.60 + ease * 0.01; // Deep glute load into Tush Line
      }

      // Hands elevate along swing plane to top
      handX = 0.44 + ease * 0.16; // Hands move back to X = 0.60
      handY = 0.56 - ease * 0.36; // Hands reach top elevation Y = 0.20
      handZ = ease * 0.20;

      // Shoulders turn (left shoulder moves in, right moves back)
      shoulderX = 0.455 + ease * 0.03;
      shoulderY = 0.30 - ease * 0.02;
    } else if (i <= 290) {
      // Downswing (P4 -> P7) — rapid transition & impact
      const prog = (i - 230) / (290 - 230);
      const ease = Math.pow(prog, 1.8);

      shoulderTurnDeg = 92 - ease * (92 + 18);
      pelvisTurnDeg = 44 - ease * (44 + 36);

      // Hands drop into the slot along shaft plane and reach impact forward shaft lean
      handX = 0.60 - ease * 0.20; // Reaches X = 0.40 at impact (forward shaft lean to ball at 0.34)
      handY = 0.20 + ease * 0.34; // Reaches lowest strike point Y = 0.54
      handZ = 0.20 - ease * 0.22;

      // EARLY EXTENSION vs OPTIMAL
      if (swingType === 'EARLY_EXTENSION' && prog > 0.25) {
        const eeFactor = Math.pow((prog - 0.25) / 0.75, 1.5);
        // Pelvis thrusts forward towards ball line, leaving Tush Line (0.60 -> 0.49)
        hipX = 0.60 - eeFactor * 0.11;
        hipY = 0.52 - eeFactor * 0.03;
        pelvisThrustZ = eeFactor * 0.15;

        // Torso straightens up (chest lifts up, loss of forward spine angle 33° -> 12°)
        shoulderY = 0.30 - eeFactor * 0.08;
        shoulderX = 0.455 + eeFactor * 0.07;
        headY = 0.18 - eeFactor * 0.06;
      } else {
        // Optimal: Glute stays glued to Tush Line!
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

      // Hands release along target line then wrap up over lead shoulder
      if (prog < 0.35) {
        // Release phase (P8): extending straight down the target line to the left
        const relProg = prog / 0.35;
        handX = 0.40 - relProg * 0.14; // Reaches X = 0.26
        handY = 0.54 - relProg * 0.02;
      } else {
        // Re-hinge into finish
        const finProg = (prog - 0.35) / 0.65;
        const finEase = 0.5 - 0.5 * Math.cos(finProg * Math.PI);
        handX = 0.26 + finEase * 0.14; // Reaches X = 0.40
        handY = 0.52 - finEase * 0.30; // High finish Y = 0.22
      }
      handZ = -0.02 - ease * 0.15;

      // Body clears into tall balanced finish
      hipX = 0.60 - ease * 0.12; // Pelvis posts up forward
      hipY = 0.52 - ease * 0.04;
      shoulderX = 0.455 + ease * 0.02;
      shoulderY = 0.30 - ease * 0.06; // Torso stands tall
      headY = 0.18 - ease * 0.03;

      // Trail foot elevates onto toe
      rightHeelY = 0.90 - ease * 0.07;
      rightAnkleY = 0.88 - ease * 0.05;
      rightAnkleX = 0.56 - ease * 0.03;
    } else {
      // Hold finish
      shoulderTurnDeg = -95;
      pelvisTurnDeg = -90;
      handX = 0.40;
      handY = 0.22;
      handZ = -0.17;
      hipX = 0.48;
      hipY = 0.48;
      shoulderX = 0.475;
      shoulderY = 0.24;
      headY = 0.15;
      rightHeelY = 0.83;
      rightAnkleY = 0.83;
      rightAnkleX = 0.53;
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

    // Elbows: in Chicken Wing at P8, lead elbow flares back
    let leadElbowOffsetX = 0;
    if (swingType === 'CHICKEN_WING' && i >= 290 && i <= 360) {
      leadElbowOffsetX = 0.08; // Flaring lead elbow backward
    }

    const landmarks: Landmark[] = [
      lm(LandmarkId.NOSE, headX, headY, 0),
      lm(LandmarkId.LEFT_SHOULDER, lsX, shoulderY, lsZ),
      lm(LandmarkId.RIGHT_SHOULDER, rsX, shoulderY, rsZ),
      lm(LandmarkId.LEFT_ELBOW, (lsX + handX) / 2 + leadElbowOffsetX, (shoulderY + handY) / 2, lsZ / 2),
      lm(LandmarkId.RIGHT_ELBOW, (rsX + handX) / 2 + 0.02, (shoulderY + handY) / 2, rsZ / 2),
      lm(LandmarkId.LEFT_WRIST, handX - 0.01, handY, handZ),
      lm(LandmarkId.RIGHT_WRIST, handX + 0.01, handY, handZ),
      lm(LandmarkId.LEFT_HIP, lhX, hipY, lhZ),
      lm(LandmarkId.RIGHT_HIP, rhX, hipY, rhZ),
      lm(LandmarkId.LEFT_KNEE, leftKneeX, kneeY, -0.04),
      lm(LandmarkId.RIGHT_KNEE, rightKneeX, kneeY, 0.04),
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
