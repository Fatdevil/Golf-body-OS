/**
 * Anatomical Plausibility Filter (Kinematic Bone Guard)
 *
 * Enforces human biomechanical constraints on raw PoseFrames.
 * Specifically detects and eliminates MediaPipe BlazePose hallucinations where
 * wrists are placed on the shins, ankles, or dirt due to white-on-white clothing
 * occlusion, rapid motion blur, or bare-leg skin-tone confusion.
 *
 * @module anatomical-filter
 * @version ANATOMICAL_FILTER_V1
 */

import { PoseFrame } from '../../types/pose-frame';
import { Landmark, LandmarkId } from '../../types/landmark';

export const VERSION = 'ANATOMICAL_FILTER_V1';

export interface AnatomicalSanityConfig {
  /** Maximum arm length relative to torso length (default: 1.35) */
  maxArmToTorsoRatio?: number;
  /** Maximum forearm length relative to torso length (default: 0.85) */
  maxForearmToTorsoRatio?: number;
  /** Buffer below knee elevation allowed for hands before rejection (default: 0.02) */
  kneeFloorBuffer?: number;
  /** Minimum visibility required for wrist to be considered anatomically trustworthy (default: 0.35) */
  minTrustedVisibility?: number;
}

/**
 * Computes 2D Euclidean distance between two landmarks with optional aspect ratio compensation.
 */
export function dist2D(a: { x: number; y: number }, b: { x: number; y: number }, aspect = 1.0): number {
  const dx = (b.x - a.x) * aspect;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Checks if arm length (shoulder to wrist) is biologically plausible relative to torso length.
 */
export function isArmLengthPlausible(
  shoulder: { x: number; y: number },
  wrist: { x: number; y: number },
  torsoLength: number,
  maxRatio = 1.35,
  aspect = 1.0
): boolean {
  if (torsoLength <= 0.01) return true;
  const armLen = dist2D(shoulder, wrist, aspect);
  return armLen <= maxRatio * torsoLength;
}

/**
 * Checks if wrist elevation is plausible in a golf swing (i.e. never below knee level).
 * In image coordinates, y=0 is top, y=1 is bottom.
 */
export function isHandElevationPlausible(
  wrist: { y: number },
  knee: { y: number } | undefined,
  buffer = 0.02
): boolean {
  if (!knee) return true;
  // If wrist is below knee + buffer (higher Y in screen space), it's physically impossible in golf
  return wrist.y <= knee.y + buffer;
}

/**
 * Sanitizes a single PoseFrame by enforcing anatomical bone guards.
 * If an arm/wrist landmark violates human anatomy:
 * - Its visibility is downgraded to 0.05 (untrusted).
 * - If the elbow is valid, the wrist position is reconstructed along the forearm vector
 *   capped at an anatomically realistic length (~0.45 * torsoLength).
 *
 * @param frame The raw PoseFrame to sanitize
 * @param config Optional configuration thresholds
 * @returns A sanitized clone of PoseFrame with anatomically sound landmarks
 */
export function sanitizeGolfPoseFrame(
  frame: PoseFrame,
  config?: AnatomicalSanityConfig
): PoseFrame {
  // Compute aspect ratio (width / height) so that portrait videos (9:16) do not distort horizontal limb lengths
  const aspect = (frame.width && frame.height && frame.height > 0) ? frame.width / frame.height : 1.0;
  const maxArmRatio = config?.maxArmToTorsoRatio ?? 2.10;
  const maxForearmRatio = config?.maxForearmToTorsoRatio ?? 1.35;
  const kneeBuffer = config?.kneeFloorBuffer ?? 0.02;

  const lmMap = new Map<LandmarkId, Landmark>();
  frame.landmarks.forEach((lm) => lmMap.set(lm.id, { ...lm }));

  const ls = lmMap.get(LandmarkId.LEFT_SHOULDER);
  const rs = lmMap.get(LandmarkId.RIGHT_SHOULDER);
  const lh = lmMap.get(LandmarkId.LEFT_HIP);
  const rh = lmMap.get(LandmarkId.RIGHT_HIP);
  const lk = lmMap.get(LandmarkId.LEFT_KNEE);
  const rk = lmMap.get(LandmarkId.RIGHT_KNEE);

  // Compute reference torso length (shoulder to hip) with aspect ratio compensation
  let torsoLength = 0.25; // Default safe fallback
  if (ls && lh && rs && rh) {
    const leftTorso = dist2D(ls, lh, aspect);
    const rightTorso = dist2D(rs, rh, aspect);
    torsoLength = Math.max(0.08, (leftTorso + rightTorso) / 2);
  } else if (ls && lh) {
    torsoLength = Math.max(0.08, dist2D(ls, lh, aspect));
  } else if (rs && rh) {
    torsoLength = Math.max(0.08, dist2D(rs, rh, aspect));
  }

  // Reference knee elevation (lowest knee in screen space = highest Y)
  const kneeY = (lk && rk) ? Math.max(lk.y, rk.y) : (lk ? lk.y : rk?.y);

  // Helper to sanitize an arm side
  const sanitizeArm = (
    shoulderId: LandmarkId,
    elbowId: LandmarkId,
    wristId: LandmarkId,
    kneeSide?: Landmark
  ) => {
    const shoulder = lmMap.get(shoulderId);
    const elbow = lmMap.get(elbowId);
    const wrist = lmMap.get(wristId);

    if (!shoulder || !wrist) return;

    let isPlausible = true;

    // 1. Floor guard check: hands never go below knees in golf
    const checkKnee = kneeSide || (kneeY !== undefined ? { y: kneeY } : undefined);
    if (checkKnee && !isHandElevationPlausible(wrist, checkKnee, kneeBuffer)) {
      isPlausible = false;
    }

    // 2. Full arm length check: shoulder to wrist cannot exceed maxArmRatio x torso (aspect ratio aware)
    if (isPlausible && !isArmLengthPlausible(shoulder, wrist, torsoLength, maxArmRatio, aspect)) {
      isPlausible = false;
    }

    // 3. Forearm length check: elbow to wrist cannot exceed maxForearmRatio x torso (aspect ratio aware)
    if (isPlausible && elbow) {
      const forearmLen = dist2D(elbow, wrist, aspect);
      if (forearmLen > maxForearmRatio * torsoLength) {
        isPlausible = false;
      }
    }

    // If violated, reconstruct or invalidate
    if (!isPlausible) {
      wrist.visibility = 0.05; // Mark as untrusted hallucination

      if (elbow && (elbow.visibility ?? 1) > 0.25) {
        // Reconstruct wrist position using plausible forearm length along elbow direction
        const realisticForearm = torsoLength * 0.45;
        const dx = (wrist.x - elbow.x) * aspect;
        const dy = wrist.y - elbow.y;
        const currentLen = Math.hypot(dx, dy);

        if (currentLen > 1e-4) {
          wrist.x = elbow.x + (dx / currentLen / Math.max(0.01, aspect)) * realisticForearm;
          wrist.y = elbow.y + (dy / currentLen) * realisticForearm;
          // Ensure reconstructed wrist does not exceed knee floor
          if (checkKnee && wrist.y > checkKnee.y) {
            wrist.y = checkKnee.y - 0.02;
          }
        } else {
          wrist.x = elbow.x;
          wrist.y = elbow.y + realisticForearm;
        }
      } else {
        // No valid elbow: collapse wrist to shoulder + slight natural offset
        wrist.x = shoulder.x;
        wrist.y = shoulder.y + torsoLength * 0.5;
      }
      lmMap.set(wristId, wrist);
    }
  };

  sanitizeArm(LandmarkId.LEFT_SHOULDER, LandmarkId.LEFT_ELBOW, LandmarkId.LEFT_WRIST, lk);
  sanitizeArm(LandmarkId.RIGHT_SHOULDER, LandmarkId.RIGHT_ELBOW, LandmarkId.RIGHT_WRIST, rk);

  return {
    ...frame,
    landmarks: Array.from(lmMap.values())
  };
}
