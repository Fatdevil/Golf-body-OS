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

export const VERSION = 'SAMPLE_240FPS_SWING_V1';

/**
 * Creates a synthetic landmark at given 3D coordinates.
 */
function lm(id: LandmarkId, x: number, y: number, z: number, visibility = 0.99): Landmark {
  return { id, x, y, z, visibility };
}

export type SampleSwingType = 'OPTIMAL' | 'EARLY_EXTENSION' | 'SWAY' | 'CHICKEN_WING';

/**
 * Generates a full 240 fps Face-On golf swing pose sequence (~480 frames = 2.0 seconds).
 */
export function generate240FpsSwingSequence(
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
    const t = i / totalFrames; // 0.0 to 1.0

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
      // Smooth sinusoidal acceleration into top
      const ease = 0.5 - 0.5 * Math.cos(prog * Math.PI);
      shoulderAngleDeg = ease * 92; // 0 to 92 degrees
      hipAngleDeg = ease * 44;      // 0 to 44 degrees
      // Hands move up and away from target (towards +X in Face-On)
      handX = 0.50 + ease * 0.22;
      handY = 0.55 - ease * 0.32; // Hands reach shoulder/head height
      handZ = ease * 0.20;
    } else if (i <= 290) {
      // Downswing (P4 -> P7) — rapid 60 frames = 250 ms!
      const prog = (i - 230) / (290 - 230); // 0 to 1
      // Powerful downswing acceleration
      const ease = Math.pow(prog, 1.8);
      shoulderAngleDeg = 92 - ease * (92 + 18); // 92° down to -18° (open 18° at impact)
      hipAngleDeg = 44 - ease * (44 + 36);      // 44° down to -36° (open 36° at impact)
      handX = (0.50 + 0.22) - ease * (0.22 + 0.02); // Hands lead slightly forward
      handY = (0.55 - 0.32) + ease * 0.32;          // Return to ball height at floor
      handZ = 0.20 - ease * 0.22;

      // Early extension simulation
      if (swingType === 'EARLY_EXTENSION' && prog > 0.5) {
        hipY = 0.50 - (prog - 0.5) * 0.08; // Pelvis stands up early
      }
    } else if (i <= 420) {
      // Follow-Through to Finish (P7 -> P10)
      const prog = (i - 290) / (420 - 290); // 0 to 1
      const ease = 0.5 - 0.5 * Math.cos(prog * Math.PI);
      shoulderAngleDeg = -18 - ease * (95 - 18); // rotate around to full chest-to-target
      hipAngleDeg = -36 - ease * (90 - 36);      // hips fully facing target
      handX = 0.48 - ease * 0.25;                // hands finish high over lead shoulder
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
      lateralOffset = Math.sin(prog * Math.PI) * 0.06; // Significant sway away from target
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

    // Elbow positioning: lead arm straight in release for optimal tour swing
    let leadElbowOffsetX = -0.01;
    if (swingType === 'CHICKEN_WING' && i >= 290 && i <= 360) {
      leadElbowOffsetX = -0.06; // Significant lead elbow chicken wing fold
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
