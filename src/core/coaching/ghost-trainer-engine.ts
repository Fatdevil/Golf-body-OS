/**
 * Ghost Trainer Engine for Golf Body OS.
 * Manages the P1 to P10 PGA Tour checkpoints (based on Tiger Woods 2000 kinematics),
 * compares real-time/playback skeletal poses against the Pro Ghost,
 * and generates match scores, micro-coaching cues, and audio biofeedback triggers.
 */

import { LandmarkId } from '../types/landmark';
import { PoseFrame } from '../types/pose-frame';
import { CameraViewAngle } from '../types/golf-swing';
import { CoachingPhraseKey } from './i18n/locales';
import { generate240FpsSwingSequence } from '../data/sample-240fps-swing';
import { getLandmark, extractPhaseKinematics } from '../metrics/golf-swing-metrics';
import { mirrorPoseFrame } from '../coordinates/pose-mirror';

export type GhostCheckpointId =
  | 'P1_ADDRESS'
  | 'P2_TAKEAWAY'
  | 'P3_LEAD_ARM_PARALLEL'
  | 'P4_TOP_OF_BACKSWING'
  | 'P5_SHALLOWING'
  | 'P6_DELIVERY'
  | 'P7_IMPACT'
  | 'P8_EXTENSION'
  | 'P9_FOLLOW_THROUGH'
  | 'P10_FINISH';

export interface GhostCheckpointDef {
  id: GhostCheckpointId;
  name: string;
  nameSv: string;
  pIndex: number;
  frameIndex240Fps: number;
  cueKey: CoachingPhraseKey;
  descriptionEn: string;
  descriptionSv: string;
  targetShoulderTurnDeg: number;
  targetHipTurnDeg: number;
  toleranceDeg: number;
}

export const GHOST_CHECKPOINTS: GhostCheckpointDef[] = [
  {
    id: 'P1_ADDRESS',
    name: 'P1 - Address & Setup',
    nameSv: 'P1 - Adress & Uppställning',
    pIndex: 1,
    frameIndex240Fps: 40,
    cueKey: 'GHOST_CUE_P1',
    descriptionEn: 'Balanced posture, neutral spine, soft knees, arms hanging relaxed.',
    descriptionSv: 'Balanserad uppställning, neutral ryggrad, mjuka knän och avspända armar.',
    targetShoulderTurnDeg: 0,
    targetHipTurnDeg: 0,
    toleranceDeg: 8
  },
  {
    id: 'P2_TAKEAWAY',
    name: 'P2 - Shaft Parallel (Takeaway)',
    nameSv: 'P2 - Skaft Parallellt (Takeaway)',
    pIndex: 2,
    frameIndex240Fps: 120,
    cueKey: 'GHOST_CUE_P2',
    descriptionEn: 'Shaft parallel to ground and target line, wide chest rotation.',
    descriptionSv: 'Klubbskaft parallellt med marken och mållinjen, bred bröstrotation.',
    targetShoulderTurnDeg: 40,
    targetHipTurnDeg: 18,
    toleranceDeg: 10
  },
  {
    id: 'P3_LEAD_ARM_PARALLEL',
    name: 'P3 - Lead Arm Parallel',
    nameSv: 'P3 - Främre Arm Parallell',
    pIndex: 3,
    frameIndex240Fps: 180,
    cueKey: 'GHOST_CUE_P3',
    descriptionEn: 'Left arm parallel to ground, 90° wrist hinge set, trail arm folding.',
    descriptionSv: 'Främre arm parallell med marken, handlederna vinklade 90°, bakre armbåge börjar vika sig.',
    targetShoulderTurnDeg: 68,
    targetHipTurnDeg: 32,
    toleranceDeg: 10
  },
  {
    id: 'P4_TOP_OF_BACKSWING',
    name: 'P4 - Top of Backswing',
    nameSv: 'P4 - Toppen av Baksvingen',
    pIndex: 4,
    frameIndex240Fps: 230,
    cueKey: 'GHOST_CUE_P4',
    descriptionEn: 'Full 90° shoulder coil, 45° hip turn, trail elbow in waiter-tray position.',
    descriptionSv: 'Full 90° axelrotation, 45° höftvridning, bakre armbåge i kypargrepp.',
    targetShoulderTurnDeg: 90,
    targetHipTurnDeg: 45,
    toleranceDeg: 10
  },
  {
    id: 'P5_SHALLOWING',
    name: 'P5 - The Slot (Shallowing)',
    nameSv: 'P5 - The Slot (Shallowing)',
    pIndex: 5,
    frameIndex240Fps: 265,
    cueKey: 'GHOST_CUE_P5',
    descriptionEn: 'Hands drop vertically into the slot, trail elbow tucks, wrist hinge maintained.',
    descriptionSv: 'Händerna droppar vertikalt i The Slot, höger armbåge tät mot revbenen, behållen lagg.',
    targetShoulderTurnDeg: 62,
    targetHipTurnDeg: 30,
    toleranceDeg: 12
  },
  {
    id: 'P6_DELIVERY',
    name: 'P6 - Delivery Position',
    nameSv: 'P6 - Delivery Position',
    pIndex: 6,
    frameIndex240Fps: 280,
    cueKey: 'GHOST_CUE_P6',
    descriptionEn: 'Shaft parallel to ground and target line, hips beginning to clear open.',
    descriptionSv: 'Klubbskaft parallellt med marken mot målet, höfterna öppnar upp.',
    targetShoulderTurnDeg: 28,
    targetHipTurnDeg: 28,
    toleranceDeg: 12
  },
  {
    id: 'P7_IMPACT',
    name: 'P7 - Impact Moment',
    nameSv: 'P7 - Träffögonblick (Impact)',
    pIndex: 7,
    frameIndex240Fps: 290,
    cueKey: 'GHOST_CUE_P7',
    descriptionEn: 'Hands forward, hips 45° open, head stable behind ball, tush line maintained.',
    descriptionSv: 'Händerna pressade framåt, höfterna 45° öppna, huvudet bakom bollen, rumpan kvar på tush line.',
    targetShoulderTurnDeg: 24,
    targetHipTurnDeg: 42,
    toleranceDeg: 10
  },
  {
    id: 'P8_EXTENSION',
    name: 'P8 - Shaft Parallel (Release)',
    nameSv: 'P8 - Release / Förlängning',
    pIndex: 8,
    frameIndex240Fps: 315,
    cueKey: 'GHOST_CUE_P8',
    descriptionEn: 'Both arms fully extended towards target, trail heel releasing.',
    descriptionSv: 'Båda armarna fullt sträckta mot målet, bakre hälen släpper marken.',
    targetShoulderTurnDeg: 55,
    targetHipTurnDeg: 62,
    toleranceDeg: 12
  },
  {
    id: 'P9_FOLLOW_THROUGH',
    name: 'P9 - Follow-Through',
    nameSv: 'P9 - Genomsving',
    pIndex: 9,
    frameIndex240Fps: 345,
    cueKey: 'GHOST_CUE_P9',
    descriptionEn: 'Chest turning upwards, arms folding naturally over lead shoulder.',
    descriptionSv: 'Bröstkorgen roterar uppåt och runt, armarna viks naturligt över främre axeln.',
    targetShoulderTurnDeg: 80,
    targetHipTurnDeg: 78,
    toleranceDeg: 14
  },
  {
    id: 'P10_FINISH',
    name: 'P10 - Balanced Tour Finish',
    nameSv: 'P10 - Balanserad Tour Finish',
    pIndex: 10,
    frameIndex240Fps: 440,
    cueKey: 'GHOST_CUE_P10',
    descriptionEn: 'Tall spine, 95% weight on lead heel, belt buckle facing target, total balance.',
    descriptionSv: 'Stolt hållning, 95% av vikten på främre hälen, bältesspännet mot målet, perfekt balans.',
    targetShoulderTurnDeg: 105,
    targetHipTurnDeg: 90,
    toleranceDeg: 15
  }
];

// Pre-cached Pro reference sequences
const PRO_SEQUENCE_CACHE: Record<CameraViewAngle, PoseFrame[]> = {
  FACE_ON: generate240FpsSwingSequence(480, 'OPTIMAL', 'FACE_ON'),
  DOWN_THE_LINE: generate240FpsSwingSequence(480, 'OPTIMAL', 'DOWN_THE_LINE')
};

/**
 * Returns the exact Pro Ghost reference PoseFrame for a given checkpoint and angle.
 * Supports both right-handed and left-handed golfers, as well as mirrored/video camera views.
 */
export function getProCheckpointPoseFrame(
  checkpointId: GhostCheckpointId,
  viewAngle: CameraViewAngle = 'DOWN_THE_LINE',
  isRightHanded: boolean = true,
  isMirroredView: boolean = true
): PoseFrame {
  const def = GHOST_CHECKPOINTS.find(c => c.id === checkpointId) ?? GHOST_CHECKPOINTS[0];
  const seq = PRO_SEQUENCE_CACHE[viewAngle] || PRO_SEQUENCE_CACHE.DOWN_THE_LINE;
  const frameIdx = Math.min(seq.length - 1, Math.max(0, def.frameIndex240Fps));
  const baseFrame = seq[frameIdx];

  // Base template is right-handed in mirrored (selfie) view.
  // Flip when player is left-handed in selfie, or right-handed in unmirrored video.
  const shouldFlip = isRightHanded !== isMirroredView;
  return shouldFlip ? mirrorPoseFrame(baseFrame) : baseFrame;
}

export interface GhostMatchResult {
  checkpointId: GhostCheckpointId;
  matchScore: number; // 0 to 100%
  isLocked: boolean; // matchScore >= 82%
  shoulderTurnDeg: number;
  targetShoulderTurnDeg: number;
  hipTurnDeg: number;
  targetHipTurnDeg: number;
  leadArmAngleDeg?: number;
  primaryCorrectionCue: CoachingPhraseKey | null;
  statusMessageEn: string;
  statusMessageSv: string;
}

/**
 * Evaluates the alignment between a player's PoseFrame and a target Ghost Checkpoint.
 */
export function evaluateGhostPoseMatch(
  playerFrame: PoseFrame,
  targetCheckpoint: GhostCheckpointDef,
  addressBaselineFrame: PoseFrame,
  viewAngle: CameraViewAngle = 'DOWN_THE_LINE',
  isRightHanded: boolean = true,
  isMirroredView: boolean = true
): GhostMatchResult {
  const proFrame = getProCheckpointPoseFrame(targetCheckpoint.id, viewAngle, isRightHanded, isMirroredView);

  // Key landmarks for golf posture comparison
  const compareLandmarks = [
    { id: LandmarkId.LEFT_SHOULDER, weight: 1.0 },
    { id: LandmarkId.RIGHT_SHOULDER, weight: 1.0 },
    { id: LandmarkId.LEFT_ELBOW, weight: 1.3 },
    { id: LandmarkId.RIGHT_ELBOW, weight: 1.3 },
    { id: LandmarkId.LEFT_WRIST, weight: 1.8 },
    { id: LandmarkId.RIGHT_WRIST, weight: 1.8 },
    { id: LandmarkId.LEFT_HIP, weight: 1.0 },
    { id: LandmarkId.RIGHT_HIP, weight: 1.0 },
    { id: LandmarkId.LEFT_KNEE, weight: 0.9 },
    { id: LandmarkId.RIGHT_KNEE, weight: 0.9 },
    { id: LandmarkId.NOSE, weight: 0.5 },
    { id: LandmarkId.LEFT_EAR, weight: 0.4 },
    { id: LandmarkId.RIGHT_EAR, weight: 0.4 }
  ];

  const playerLH = getLandmark(playerFrame, LandmarkId.LEFT_HIP);
  const playerRH = getLandmark(playerFrame, LandmarkId.RIGHT_HIP);
  const proLH = getLandmark(proFrame, LandmarkId.LEFT_HIP);
  const proRH = getLandmark(proFrame, LandmarkId.RIGHT_HIP);

  const playerMidHipX = playerLH && playerRH ? (playerLH.x + playerRH.x) / 2 : 0.5;
  const playerMidHipY = playerLH && playerRH ? (playerLH.y + playerRH.y) / 2 : 0.5;
  const proMidHipX = proLH && proRH ? (proLH.x + proRH.x) / 2 : 0.5;
  const proMidHipY = proLH && proRH ? (proLH.y + proRH.y) / 2 : 0.5;

  let totalWeight = 0;
  let weightedDistSum = 0;

  for (const item of compareLandmarks) {
    const plm = getLandmark(playerFrame, item.id);
    const glm = getLandmark(proFrame, item.id);
    if (plm && glm) {
      const pRelX = plm.x - playerMidHipX;
      const pRelY = plm.y - playerMidHipY;
      const gRelX = glm.x - proMidHipX;
      const gRelY = glm.y - proMidHipY;
      const d = Math.sqrt((pRelX - gRelX) ** 2 + (pRelY - gRelY) ** 2);
      weightedDistSum += d * item.weight;
      totalWeight += item.weight;
    }
  }

  const avgDistance = totalWeight > 0 ? weightedDistSum / totalWeight : 0;
  // avgDistance = 0 -> 100%. avgDistance = 0.25 -> 0%
  const landmarkScore = Math.max(0, 100 - avgDistance * 380);

  // Position-specific kinematic and fault detection
  const leadWristId = isRightHanded ? LandmarkId.LEFT_WRIST : LandmarkId.RIGHT_WRIST;
  const playerLW = getLandmark(playerFrame, leadWristId);
  const proLW = getLandmark(proFrame, leadWristId);

  let primaryCue: CoachingPhraseKey | null = null;
  let statusEn = 'Aligning with Ghost...';
  let statusSv = 'Söker position...';

  // 1. Check Shoulder turn / backswing elevation at P4 (Top)
  if (targetCheckpoint.id === 'P4_TOP_OF_BACKSWING') {
    if (playerLW && proLW && playerLW.y > proLW.y + 0.10) {
      primaryCue = 'GHOST_ROTATE_MORE';
      statusEn = 'Rotate your chest to the top!';
      statusSv = 'Rotera bröstkorgen till toppen!';
    }
  }

  // 2. Check Early Extension / Tush line in DTL at Delivery & Impact
  if (viewAngle === 'DOWN_THE_LINE' && (targetCheckpoint.id === 'P6_DELIVERY' || targetCheckpoint.id === 'P7_IMPACT')) {
    const addrLH = getLandmark(addressBaselineFrame, LandmarkId.LEFT_HIP);
    const addrRH = getLandmark(addressBaselineFrame, LandmarkId.RIGHT_HIP);
    if (addrLH && addrRH && playerLH && playerRH) {
      const isButtOnRight = isRightHanded;
      const addrHipX = isButtOnRight ? Math.max(addrLH.x, addrRH.x) : Math.min(addrLH.x, addrRH.x);
      const currHipX = isButtOnRight ? Math.max(playerLH.x, playerRH.x) : Math.min(playerLH.x, playerRH.x);
      const pelvisThrust = isButtOnRight ? (addrHipX - currHipX) : (currHipX - addrHipX);
      if (pelvisThrust > 0.035) {
        primaryCue = 'GHOST_TUSH_LINE_HOLD';
        statusEn = 'Keep glutes back on Tush Line!';
        statusSv = 'Håll kvar sätet mot Tush Line!';
      }
    }
  }

  // 3. Check Trail elbow fold at P4 / P5
  if (targetCheckpoint.id === 'P4_TOP_OF_BACKSWING' || targetCheckpoint.id === 'P5_SHALLOWING') {
    const trailS = getLandmark(playerFrame, isRightHanded ? LandmarkId.RIGHT_SHOULDER : LandmarkId.LEFT_SHOULDER);
    const trailE = getLandmark(playerFrame, isRightHanded ? LandmarkId.RIGHT_ELBOW : LandmarkId.LEFT_ELBOW);
    const trailW = getLandmark(playerFrame, isRightHanded ? LandmarkId.RIGHT_WRIST : LandmarkId.LEFT_WRIST);

    if (trailS && trailE && trailW) {
      const v1x = trailS.x - trailE.x;
      const v1y = trailS.y - trailE.y;
      const v2x = trailW.x - trailE.x;
      const v2y = trailW.y - trailE.y;
      const dot = v1x * v2x + v1y * v2y;
      const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
      const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);
      const trailAngle = mag1 && mag2 ? Math.round((Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * 180) / Math.PI) : 90;

      if (trailAngle < 65 || trailAngle > 125) {
        if (!primaryCue) {
          primaryCue = 'GHOST_LOWER_TRAIL_ELBOW';
          statusEn = 'Keep trail elbow folded ~90°';
          statusSv = 'Håll bakre armbåge i ~90° kypargrepp';
        }
      }
    }
  }

  const matchScore = Math.min(100, Math.max(0, Math.round(landmarkScore)));
  const isLocked = matchScore >= 82;

  if (isLocked) {
    primaryCue = null;
    statusEn = '✨ Position Locked! Hold steady.';
    statusSv = '✨ Position låst! Håll kvar.';
  }

  return {
    checkpointId: targetCheckpoint.id,
    matchScore,
    isLocked,
    shoulderTurnDeg: targetCheckpoint.targetShoulderTurnDeg,
    targetShoulderTurnDeg: targetCheckpoint.targetShoulderTurnDeg,
    hipTurnDeg: targetCheckpoint.targetHipTurnDeg,
    targetHipTurnDeg: targetCheckpoint.targetHipTurnDeg,
    primaryCorrectionCue: primaryCue,
    statusMessageEn: statusEn,
    statusMessageSv: statusSv
  };
}
