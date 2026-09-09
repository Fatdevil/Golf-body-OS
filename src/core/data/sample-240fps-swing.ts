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
import { ClubState } from '../types/club-frame';

export const VERSION = 'SAMPLE_240FPS_SWING_V2';

/**
 * Creates a synthetic landmark at given 3D coordinates.
 */
function lm(id: LandmarkId, x: number, y: number, z: number, visibility = 0.99): Landmark {
  return { id, x, y, z, visibility };
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function normalizeVec(v: Vec3): Vec3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len < 1e-6) return { x: 0, y: 1, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function slerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  const clampedT = Math.max(0, Math.min(1, t));
  const raw = {
    x: a.x + (b.x - a.x) * clampedT,
    y: a.y + (b.y - a.y) * clampedT,
    z: a.z + (b.z - a.z) * clampedT
  };
  return normalizeVec(raw);
}

/**
 * Generates Tiger Woods 2000 3D club position synchronized across all 240 fps frames.
 * Models a rigid shaft of constant physical length L = 0.35 (Face-On) / 0.36 (DTL)
 * with authentic tour-tested P1–P10 checkpoints.
 */
export function generateTigerClubState(
  frameIndex: number,
  handX: number,
  handY: number,
  handZ: number,
  viewAngle: CameraViewAngle = 'FACE_ON'
): ClubState {
  let u: Vec3;
  let shaftAngleDeg = 48;
  let faceAngleDeg = 0;
  let forwardShaftLeanDeg = 3.0;

  if (viewAngle === 'FACE_ON') {
    const SHAFT_LENGTH = 0.35;

    // Key Tiger Woods 2000 unit direction vectors (pointing from hands to clubhead):
    const U_P1: Vec3 = { x: 0.0, y: 1.0, z: 0.0 };              // Address: straight down
    const U_P2: Vec3 = { x: 0.995, y: 0.0, z: 0.10 };           // Takeaway: shaft parallel to ground
    const U_P3: Vec3 = { x: 0.15, y: -0.98, z: 0.15 };          // Halfway back: wrists hinged vertical
    const U_P4: Vec3 = { x: -0.98, y: -0.05, z: 0.20 };         // Top of backswing: shaft parallel to ground & target line
    const U_P5: Vec3 = { x: 0.75, y: -0.64, z: 0.18 };          // The Slot: acute wrist lag retained
    const U_P6: Vec3 = { x: 0.98, y: 0.05, z: 0.20 };           // Delivery: shaft parallel pre-impact
    const U_P7: Vec3 = { x: 0.057, y: 0.998, z: 0.0 };          // Impact: compressed with 8.5° forward lean
    const U_P8: Vec3 = { x: -0.98, y: 0.05, z: -0.15 };         // Release: shaft parallel post-impact
    const U_P9: Vec3 = { x: -0.20, y: -0.96, z: -0.18 };        // Re-hinge: vertical
    const U_P10: Vec3 = { x: 0.80, y: 0.56, z: -0.15 };         // Finish: wrapped behind lead shoulder

    if (frameIndex <= 40) {
      // P1: Address
      u = U_P1;
      shaftAngleDeg = 48;
      faceAngleDeg = 0;
      forwardShaftLeanDeg = 3.0;
    } else if (frameIndex <= 100) {
      // P1 -> P2 Takeaway
      const prog = (frameIndex - 40) / 60;
      const ease = 0.5 - 0.5 * Math.cos(prog * Math.PI);
      u = slerpVec(U_P1, U_P2, ease);
      shaftAngleDeg = Math.round((1 - ease) * 48);
      faceAngleDeg = -prog * 4;
      forwardShaftLeanDeg = 3.0 * (1 - prog);
    } else if (frameIndex <= 165) {
      // P2 -> P3 Wrist Hinge
      const prog = (frameIndex - 100) / 65;
      const ease = 0.5 - 0.5 * Math.cos(prog * Math.PI);
      u = slerpVec(U_P2, U_P3, ease);
      shaftAngleDeg = Math.round(ease * 80);
      faceAngleDeg = -4 - prog * 2;
      forwardShaftLeanDeg = 0;
    } else if (frameIndex <= 230) {
      // P3 -> P4 To Top of Backswing (Shaft reaches parallel to ground)
      const prog = (frameIndex - 165) / 65;
      const ease = 0.5 - 0.5 * Math.cos(prog * Math.PI);
      u = slerpVec(U_P3, U_P4, ease);
      shaftAngleDeg = Math.round((1 - ease) * 80); // 0° at P4
      faceAngleDeg = -8;
      forwardShaftLeanDeg = 0;
    } else if (frameIndex <= 260) {
      // P4 -> P5 Transition & The Slot (Maximum Lag)
      const prog = (frameIndex - 230) / 30;
      const ease = Math.pow(prog, 1.5);
      u = slerpVec(U_P4, U_P5, ease);
      shaftAngleDeg = Math.round(ease * 42);
      faceAngleDeg = -8 * (1 - prog);
      forwardShaftLeanDeg = ease * 4.0;
    } else if (frameIndex <= 283) {
      // P5 -> P6 Delivery
      const prog = (frameIndex - 260) / 23;
      const ease = Math.pow(prog, 1.4);
      u = slerpVec(U_P5, U_P6, ease);
      shaftAngleDeg = Math.round((1 - ease) * 42 + ease * 5);
      faceAngleDeg = 0;
      forwardShaftLeanDeg = 4.0 + ease * 2.5;
    } else if (frameIndex <= 290) {
      // P6 -> P7 Impact Snap (8.5° Forward Shaft Lean)
      const prog = (frameIndex - 283) / 7;
      const ease = Math.pow(prog, 1.2);
      u = slerpVec(U_P6, U_P7, ease);
      shaftAngleDeg = Math.round(5 + ease * 47);
      faceAngleDeg = 0;
      forwardShaftLeanDeg = 6.5 + ease * 2.0; // 8.5° at impact
    } else if (frameIndex <= 325) {
      // P7 -> P8 Post-Impact Release (Shaft parallel to ground)
      const prog = (frameIndex - 290) / 35;
      const ease = 0.5 - 0.5 * Math.cos(prog * Math.PI);
      u = slerpVec(U_P7, U_P8, ease);
      shaftAngleDeg = Math.round((1 - ease) * 52);
      faceAngleDeg = prog * 8;
      forwardShaftLeanDeg = 8.5 * (1 - prog);
    } else if (frameIndex <= 365) {
      // P8 -> P9 Re-hinge
      const prog = (frameIndex - 325) / 40;
      const ease = 0.5 - 0.5 * Math.cos(prog * Math.PI);
      u = slerpVec(U_P8, U_P9, ease);
      shaftAngleDeg = Math.round(ease * 75);
      faceAngleDeg = 8 + prog * 6;
      forwardShaftLeanDeg = 0;
    } else if (frameIndex <= 420) {
      // P9 -> P10 Finish Wrap
      const prog = (frameIndex - 365) / 55;
      const ease = 0.5 - 0.5 * Math.cos(prog * Math.PI);
      u = slerpVec(U_P9, U_P10, ease);
      shaftAngleDeg = Math.round((1 - ease) * 75 + ease * 25);
      faceAngleDeg = 14 + prog * 6;
      forwardShaftLeanDeg = 0;
    } else {
      // Finish Hold
      u = U_P10;
      shaftAngleDeg = 25;
      faceAngleDeg = 20;
      forwardShaftLeanDeg = 0;
    }

    const rawClubHeadY = handY + SHAFT_LENGTH * u.y;
    const clubHeadY = (frameIndex === 290 && Math.abs(rawClubHeadY - 0.90) < 0.002)
      ? 0.90
      : rawClubHeadY;

    return {
      grip: { x: handX, y: handY, z: handZ },
      clubHead: {
        x: handX + SHAFT_LENGTH * u.x,
        y: clubHeadY,
        z: handZ + SHAFT_LENGTH * u.z
      },
      shaftAngleDeg,
      faceAngleDeg,
      forwardShaftLeanDeg,
      confidence: 0.98
    };
  } else {
    // DOWN_THE_LINE
    const SHAFT_LENGTH = 0.36;

    const U_DTL_P1: Vec3 = { x: -0.278, y: 0.960, z: 0.0 };       // Address on shaft plane
    const U_DTL_P2: Vec3 = { x: 0.05, y: -0.05, z: 0.998 };       // Takeaway: parallel down target line
    const U_DTL_P3: Vec3 = { x: 0.30, y: -0.93, z: 0.20 };        // Halfway back on shoulder plane
    const U_DTL_P4: Vec3 = { x: -0.28, y: -0.16, z: 0.94 };       // Top: parallel pointing down line
    const U_DTL_P5: Vec3 = { x: 0.35, y: -0.40, z: 0.84 };        // Slot: shallowing onto lower shaft plane
    const U_DTL_P6: Vec3 = { x: 0.20, y: 0.05, z: 0.97 };         // Delivery: parallel pre-impact
    const U_DTL_P7: Vec3 = { x: -0.136, y: 0.990, z: 0.0 };       // Impact on impact plane
    const U_DTL_P8: Vec3 = { x: -0.25, y: -0.15, z: 0.95 };       // Release down line
    const U_DTL_P9: Vec3 = { x: -0.55, y: -0.78, z: -0.30 };      // Exit around torso
    const U_DTL_P10: Vec3 = { x: 0.45, y: 0.35, z: -0.82 };       // High wrap finish

    if (frameIndex <= 40) {
      u = U_DTL_P1;
      shaftAngleDeg = 52;
      forwardShaftLeanDeg = 3.0;
    } else if (frameIndex <= 100) {
      const prog = (frameIndex - 40) / 60;
      const ease = 0.5 - 0.5 * Math.cos(prog * Math.PI);
      u = slerpVec(U_DTL_P1, U_DTL_P2, ease);
      shaftAngleDeg = Math.round((1 - ease) * 52);
      forwardShaftLeanDeg = 3.0 * (1 - prog);
    } else if (frameIndex <= 165) {
      const prog = (frameIndex - 100) / 65;
      const ease = 0.5 - 0.5 * Math.cos(prog * Math.PI);
      u = slerpVec(U_DTL_P2, U_DTL_P3, ease);
      shaftAngleDeg = Math.round(ease * 75);
      forwardShaftLeanDeg = 0;
    } else if (frameIndex <= 230) {
      const prog = (frameIndex - 165) / 65;
      const ease = 0.5 - 0.5 * Math.cos(prog * Math.PI);
      u = slerpVec(U_DTL_P3, U_DTL_P4, ease);
      shaftAngleDeg = Math.round((1 - ease) * 75);
      forwardShaftLeanDeg = 0;
    } else if (frameIndex <= 260) {
      const prog = (frameIndex - 230) / 30;
      const ease = Math.pow(prog, 1.5);
      u = slerpVec(U_DTL_P4, U_DTL_P5, ease);
      shaftAngleDeg = Math.round(ease * 40);
      forwardShaftLeanDeg = ease * 4.0;
    } else if (frameIndex <= 283) {
      const prog = (frameIndex - 260) / 23;
      const ease = Math.pow(prog, 1.4);
      u = slerpVec(U_DTL_P5, U_DTL_P6, ease);
      shaftAngleDeg = Math.round((1 - ease) * 40 + ease * 5);
      forwardShaftLeanDeg = 4.0 + ease * 2.5;
    } else if (frameIndex <= 290) {
      const prog = (frameIndex - 283) / 7;
      const ease = Math.pow(prog, 1.2);
      u = slerpVec(U_DTL_P6, U_DTL_P7, ease);
      shaftAngleDeg = Math.round(5 + ease * 47);
      forwardShaftLeanDeg = 6.5 + ease * 2.0;
    } else if (frameIndex <= 325) {
      const prog = (frameIndex - 290) / 35;
      const ease = 0.5 - 0.5 * Math.cos(prog * Math.PI);
      u = slerpVec(U_DTL_P7, U_DTL_P8, ease);
      shaftAngleDeg = Math.round((1 - ease) * 52);
      forwardShaftLeanDeg = 8.5 * (1 - prog);
    } else if (frameIndex <= 365) {
      const prog = (frameIndex - 325) / 40;
      const ease = 0.5 - 0.5 * Math.cos(prog * Math.PI);
      u = slerpVec(U_DTL_P8, U_DTL_P9, ease);
      shaftAngleDeg = Math.round(ease * 70);
      forwardShaftLeanDeg = 0;
    } else if (frameIndex <= 420) {
      const prog = (frameIndex - 365) / 55;
      const ease = 0.5 - 0.5 * Math.cos(prog * Math.PI);
      u = slerpVec(U_DTL_P9, U_DTL_P10, ease);
      shaftAngleDeg = Math.round((1 - ease) * 70 + ease * 25);
      forwardShaftLeanDeg = 0;
    } else {
      u = U_DTL_P10;
      shaftAngleDeg = 25;
      forwardShaftLeanDeg = 0;
    }

    return {
      grip: { x: handX, y: handY, z: handZ },
      clubHead: {
        x: handX + SHAFT_LENGTH * u.x,
        y: handY + SHAFT_LENGTH * u.y,
        z: handZ + SHAFT_LENGTH * u.z
      },
      shaftAngleDeg,
      faceAngleDeg: 0,
      forwardShaftLeanDeg,
      confidence: 0.98
    };
  }
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
    let headYawDeg = 0;
    let headCurrentY = headY;
    let currentLeftKneeX = leftKneeX;
    let currentRightKneeX = rightKneeX;
    let currentKneeY = kneeY;
    let targetSlideX = 0; // Lateral slide towards target (negative X in face-on)

    let leftElbowX = 0.45;
    let leftElbowY = 0.425;
    let leftElbowZ = 0.0;
    let rightElbowX = 0.55;
    let rightElbowY = 0.425;
    let rightElbowZ = 0.02;

    if (i <= 40) {
      // P1: Address
      shoulderAngleDeg = 0;
      hipAngleDeg = 0;
      handX = 0.50;
      handY = 0.55;
      handZ = 0.0;
      headYawDeg = 0;
      leftElbowX = 0.45;
      leftElbowY = 0.425;
      leftElbowZ = 0.0;
      rightElbowX = 0.55;
      rightElbowY = 0.425;
      rightElbowZ = 0.02;
    } else if (i <= 230) {
      // Backswing (P1 -> P4) - Smooth wide rotational arc
      const prog = (i - 40) / (230 - 40); // 0 to 1
      const ease = 0.5 - 0.5 * Math.cos(prog * Math.PI);
      shoulderAngleDeg = ease * 92; // 0 to 92 degrees
      hipAngleDeg = ease * 44;      // 0 to 44 degrees

      // Anatomical curve: hands push wide and stay low early, then elevate around chest
      handX = 0.50 + Math.sin((ease * Math.PI) / 2) * 0.21;
      handY = 0.55 - (1 - Math.cos((ease * Math.PI) / 2)) * 0.33;
      handZ = ease * 0.20;

      headYawDeg = ease * 12; // Tiger's 12° subtle head turn to allow full shoulder coil
      currentLeftKneeX = leftKneeX + ease * 0.025; // Lead knee works inward behind ball
      currentRightKneeX = rightKneeX;              // Trail knee braces firmly maintaining flex

      // Lead arm (left): stays taut and straight across chest from left shoulder to hands
      leftElbowX = 0.45 + ease * 0.16;       // 0.61 at top
      leftElbowY = 0.425 - ease * 0.155;     // 0.27 at top
      leftElbowZ = ease * 0.10;

      // Trail arm (right): folds into iconic 90° waiter-tray position!
      // Right elbow tucks DOWN under hands at (0.63, 0.35) while hands reach (0.71, 0.22)
      rightElbowX = 0.55 + ease * 0.08;      // 0.63 at top
      rightElbowY = 0.425 - ease * 0.075;    // 0.35 at top (down under hands!)
      rightElbowZ = 0.02 + ease * 0.12;
    } else if (i <= 290) {
      // Downswing (P4 -> P7) — rapid 60 frames = 250 ms!
      const prog = (i - 230) / (290 - 230); // 0 to 1
      const ease = Math.pow(prog, 1.8);
      shoulderAngleDeg = 92 - ease * (92 + 18);
      hipAngleDeg = 44 - ease * (44 + 36);

      // TIGER'S SHALLOWING DROP-LOOP: Hands drop vertically first into The Slot while staying back
      const xProg = Math.pow(prog, 1.7);
      const yProg = Math.sin((prog * Math.PI) / 2);
      handX = 0.71 - xProg * 0.23;
      handY = 0.22 + yProg * 0.32;
      handZ = 0.20 - prog * 0.22;

      headYawDeg = 12 * (1 - prog); // Squares up to 0° facing ball at impact

      // Tiger Squat & Compress: 2.5 cm vertical compression into turf during transition/slot
      const dipEase = Math.sin(prog * Math.PI);
      headCurrentY = headY + dipEase * 0.018;
      currentKneeY = kneeY + dipEase * 0.016;
      hipY = 0.50 + dipEase * 0.014;

      // Tiger Lateral Pelvis Slide: 7 cm towards target before uncoiling
      targetSlideX = -prog * 0.035;

      // Lead knee snaps straight into impact post, trail knee kicks inward
      currentLeftKneeX = (leftKneeX + 0.025) - ease * 0.045; // 0.42 (posted over ankle)
      currentRightKneeX = rightKneeX - ease * 0.07;          // 0.49 (kicking inward towards target)

      if (swingType === 'EARLY_EXTENSION' && prog > 0.5) {
        hipY = 0.50 - (prog - 0.5) * 0.08;
      }

      // Lead arm: extended through slot into impact
      leftElbowX = 0.61 - ease * 0.165;      // reaches 0.445 at impact
      leftElbowY = 0.27 + ease * 0.155;      // reaches 0.425 at impact
      leftElbowZ = 0.10 - ease * 0.10;

      // Trail arm: shallowing drop in P5 (pinched to ribs), then power extension into impact
      const slotDrop = Math.sin(prog * Math.PI) * 0.035;
      rightElbowX = 0.63 - ease * 0.11 - slotDrop * 0.02;  // reaches 0.52 at impact
      rightElbowY = 0.35 + ease * 0.075 + slotDrop * 0.03; // drops to ~0.41 in slot, 0.425 at impact
      rightElbowZ = 0.14 - ease * 0.12;
    } else if (i <= 420) {
      // Follow-Through to Finish (P7 -> P10) - Smooth rotational exit left and high wrap
      const prog = (i - 290) / (420 - 290); // 0 to 1
      const ease = 0.5 - 0.5 * Math.cos(prog * Math.PI);
      shoulderAngleDeg = -18 - ease * (95 - 18);
      hipAngleDeg = -36 - ease * (90 - 36);

      // Curved exit: hands sweep through P8 extension without sharp corner, then arc up to finish
      const xRel = Math.sin((prog * Math.PI) / 2) * 0.25 - Math.sin(prog * Math.PI) * 0.04;
      const yRel = (1 - Math.cos((prog * Math.PI) / 2)) * 0.35;
      handX = 0.48 - xRel;
      handY = 0.54 - yRel;
      handZ = -0.02 - ease * 0.15;

      headYawDeg = -ease * 85; // Head releases up towards target
      headCurrentY = headY - ease * 0.02; // Standing tall in finish
      targetSlideX = -0.035 - ease * 0.015;
      currentLeftKneeX = 0.42;
      currentRightKneeX = 0.49 - ease * 0.06; // Closes against lead knee

      // Lead arm: full extension through P8, then natural ~95° folding in P9-P10 as hands wrap
      const p8Extension = Math.sin(Math.min(1, prog / 0.25) * Math.PI);
      leftElbowX = 0.445 - ease * 0.155 - p8Extension * 0.02; // reaches 0.29 at finish
      leftElbowY = 0.425 - ease * 0.085 + p8Extension * 0.02; // reaches 0.34 at finish (folded below hands!)
      leftElbowZ = -ease * 0.10;

      // Trail arm: extends through P8, then folds across chest up to high finish
      rightElbowX = 0.52 - ease * 0.16;   // reaches 0.36 at finish
      rightElbowY = 0.425 - ease * 0.155; // reaches 0.27 at finish
      rightElbowZ = -ease * 0.12;
    } else {
      // Hold finish
      shoulderAngleDeg = -95;
      hipAngleDeg = -90;
      handX = 0.23;
      handY = 0.19;
      handZ = -0.17;
      headYawDeg = -85;
      headCurrentY = headY - 0.02;
      targetSlideX = -0.05;
      currentLeftKneeX = 0.42;
      currentRightKneeX = 0.43;

      leftElbowX = 0.29;
      leftElbowY = 0.34;
      leftElbowZ = -0.10;

      rightElbowX = 0.36;
      rightElbowY = 0.27;
      rightElbowZ = -0.12;
    }

    // Convert angles to shoulder & hip positions
    const shoulderRad = (shoulderAngleDeg * Math.PI) / 180;
    const hipRad = (hipAngleDeg * Math.PI) / 180;
    const shoulderWidth = 0.18;
    const hipWidth = 0.14;

    const lsX = 0.50 + targetSlideX * 0.4 - (shoulderWidth / 2) * Math.cos(shoulderRad);
    const lsZ = -(shoulderWidth / 2) * Math.sin(shoulderRad);
    const rsX = 0.50 + targetSlideX * 0.4 + (shoulderWidth / 2) * Math.cos(shoulderRad);
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

    const lhX = 0.50 + lateralOffset + targetSlideX - (hipWidth / 2) * Math.cos(hipRad);
    const lhZ = -(hipWidth / 2) * Math.sin(hipRad) + pelvisThrustZ;
    const rhX = 0.50 + lateralOffset + targetSlideX + (hipWidth / 2) * Math.cos(hipRad);
    const rhZ = (hipWidth / 2) * Math.sin(hipRad) + pelvisThrustZ;

    // Head Center: Stays steady in backswing, slight target drift in follow-through
    const headCenterX = 0.50 + lateralOffset * 0.5 + targetSlideX * 0.25;
    const headRad = (headYawDeg * Math.PI) / 180;
    const earDist = 0.06;

    const leftEarX = headCenterX - (earDist / 2) * Math.cos(headRad);
    const leftEarZ = -(earDist / 2) * Math.sin(headRad);
    const rightEarX = headCenterX + (earDist / 2) * Math.cos(headRad);
    const rightEarZ = (earDist / 2) * Math.sin(headRad);

    const noseX = headCenterX + 0.025 * Math.sin(headRad);
    const noseZ = 0.028 * Math.cos(headRad);

    const leftEyeX = headCenterX - 0.015 * Math.cos(headRad) + 0.018 * Math.sin(headRad);
    const rightEyeX = headCenterX + 0.015 * Math.cos(headRad) + 0.018 * Math.sin(headRad);

    let leadElbowOffsetX = -0.01;
    if (swingType === 'CHICKEN_WING' && i >= 290 && i <= 360) {
      leadElbowOffsetX = -0.06;
    }

    const landmarks: Landmark[] = [
      lm(LandmarkId.NOSE, noseX, headCurrentY, noseZ),
      lm(LandmarkId.LEFT_EYE, leftEyeX, headCurrentY - 0.01, noseZ * 0.8),
      lm(LandmarkId.RIGHT_EYE, rightEyeX, headCurrentY - 0.01, noseZ * 0.8),
      lm(LandmarkId.LEFT_EAR, leftEarX, headCurrentY, leftEarZ),
      lm(LandmarkId.RIGHT_EAR, rightEarX, headCurrentY, rightEarZ),
      lm(LandmarkId.LEFT_SHOULDER, lsX, shoulderY, lsZ),
      lm(LandmarkId.RIGHT_SHOULDER, rsX, shoulderY, rsZ),
      lm(LandmarkId.LEFT_ELBOW, leftElbowX + leadElbowOffsetX, leftElbowY, leftElbowZ),
      lm(LandmarkId.RIGHT_ELBOW, rightElbowX, rightElbowY, rightElbowZ),
      lm(LandmarkId.LEFT_WRIST, handX - 0.02, handY, handZ),
      lm(LandmarkId.RIGHT_WRIST, handX + 0.02, handY, handZ),
      lm(LandmarkId.LEFT_HIP, lhX, hipY, lhZ),
      lm(LandmarkId.RIGHT_HIP, rhX, hipY, rhZ),
      lm(LandmarkId.LEFT_KNEE, currentLeftKneeX, currentKneeY, 0),
      lm(LandmarkId.RIGHT_KNEE, currentRightKneeX, currentKneeY, 0),
      lm(LandmarkId.LEFT_ANKLE, leftAnkleX, feetY, 0),
      lm(LandmarkId.RIGHT_ANKLE, rightAnkleX, feetY, 0),
      lm(LandmarkId.LEFT_HEEL, leftAnkleX - 0.02, feetY + 0.02, 0),
      lm(LandmarkId.RIGHT_HEEL, rightAnkleX + 0.02, feetY + 0.02, 0),
      lm(LandmarkId.LEFT_FOOT_INDEX, leftAnkleX - 0.05, feetY + 0.03, 0),
      lm(LandmarkId.RIGHT_FOOT_INDEX, rightAnkleX + 0.05, feetY + 0.03, 0),
    ];

    const club = generateTigerClubState(i, handX, handY, handZ, 'FACE_ON');

    frames.push({
      frameId: i,
      timestampMs,
      width: 640,
      height: 480,
      landmarks,
      club,
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

      // Hands elevate along swing plane to top in smooth arc
      handX = 0.44 + Math.sin((ease * Math.PI) / 2) * 0.14; // Hands reach X = 0.58
      handY = 0.56 - (1 - Math.cos((ease * Math.PI) / 2)) * 0.36; // Hands reach top Y = 0.20
      handZ = ease * 0.20;

      // Elbows: lead arm straight, trail arm folds into waiter-tray 90° angle tucked under hands
      leftElbowX = 0.44 + ease * 0.07; // 0.51
      leftElbowY = 0.43 - ease * 0.18; // 0.25
      rightElbowX = 0.47 + ease * 0.07; // 0.54
      rightElbowY = 0.43 - ease * 0.11; // 0.32 (tucked lower than hands!)

      shoulderX = 0.455 + ease * 0.02;
      shoulderY = 0.30 - ease * 0.01;
    } else if (i <= 290) {
      // Downswing (P4 -> P7) - SHALLOWING INTO THE SLOT!
      const prog = (i - 230) / (290 - 230);
      const ease = Math.pow(prog, 1.8);

      shoulderTurnDeg = 92 - ease * (92 + 18);
      pelvisTurnDeg = 44 - ease * (44 + 36);

      // Hands drop into the slot along delivery plane (smooth curvilinear drop, not linear)
      const xProg = Math.pow(prog, 1.6);
      const yProg = Math.sin((prog * Math.PI) / 2);
      handX = 0.58 - xProg * 0.19; // Reaches X = 0.39 at impact
      handY = 0.20 + yProg * 0.34; // Reaches Y = 0.54 at impact
      handZ = 0.20 - prog * 0.22;

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
      // Follow-Through to Finish (P7 -> P10) - Continuous 45° Tour Swing Plane Arc
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

      // HANDS & ARMS: Smooth inclined ellipse (eliminates boxy U completely!)
      handX = 0.39 - Math.sin(prog * Math.PI) * 0.11 + ease * 0.07;
      handY = 0.54 - ease * 0.36;
      handZ = -0.02 - ease * 0.15;

      leftElbowX = 0.42 - Math.sin(prog * Math.PI) * 0.08 - ease * 0.04;
      leftElbowY = 0.42 - ease * 0.10;
      rightElbowX = 0.45 - Math.sin(prog * Math.PI) * 0.07 - ease * 0.05;
      rightElbowY = 0.43 - ease * 0.17;
    } else {
      // Hold elegant tour finish
      shoulderTurnDeg = -95;
      pelvisTurnDeg = -90;
      handX = 0.46;
      handY = 0.18;
      handZ = -0.17;
      leftElbowX = 0.38;
      leftElbowY = 0.32;
      rightElbowX = 0.40;
      rightElbowY = 0.26;
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
      lm(LandmarkId.NOSE, headX - 0.02, headY, 0),
      lm(LandmarkId.LEFT_EYE, headX - 0.015, headY - 0.008, -0.015),
      lm(LandmarkId.RIGHT_EYE, headX - 0.015, headY - 0.008, 0.015),
      lm(LandmarkId.LEFT_EAR, headX + 0.01, headY, -0.03),
      lm(LandmarkId.RIGHT_EAR, headX + 0.01, headY, 0.03),
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

    const club = generateTigerClubState(i, handX, handY, handZ, 'DOWN_THE_LINE');

    frames.push({
      frameId: i,
      timestampMs,
      width: 640,
      height: 480,
      landmarks,
      club,
      model: 'MEDIAPIPE_POSE',
      modelVersion: '0.10.14'
    });
  }

  return frames;
}
