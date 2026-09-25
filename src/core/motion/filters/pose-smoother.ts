/**
 * pose-smoother.ts
 * Golf-Body-OS — Velocity-Adaptive Pose Stabilization Engine
 *
 * Velocity-adaptive exponential moving average (EMA) smoother for pose landmarks.
 *
 * For each landmark independently across time:
 *   v = normalizedVelocity(current, previous, dt)
 *   alpha = 1.0 - (1.0 - minFactor) * exp(-velocityScale * v)
 *   smoothed = alpha * current + (1.0 - alpha) * previousSmoothed
 *
 * Key benefits for golf swing analysis:
 * - At Address (P1) and Top (P4): velocity is near zero -> alpha ~ minFactor (heavy smoothing, eliminates all jitter)
 * - During Downswing (P5–P6) and Impact (P7): velocity is high -> alpha -> 1.0 (zero phase lag, preserving peak speed and exact impact geometry)
 *
 * @module motion/filters/pose-smoother
 * @version POSE_SMOOTHER_V1
 */

import { Landmark, LandmarkId } from '../../types/landmark';
import { PoseFrame } from '../../types/pose-frame';

export const POSE_SMOOTHER_VERSION = 'POSE_SMOOTHER_V1';
export const VERSION = POSE_SMOOTHER_VERSION;

/** Configuration parameters for velocity-adaptive EMA smoothing */
export interface PoseSmootherConfig {
  /**
   * Minimum smoothing factor alpha (applied at zero velocity, maximum smoothing).
   * Range: (0, 1]. Lower = heavier smoothing at standstill. Default: 0.15.
   */
  minFactor: number;

  /**
   * Controls how rapidly alpha approaches 1.0 as velocity increases.
   * Higher = faster disengagement of smoothing during movement. Default: 20.0.
   */
  velocityScale: number;

  /**
   * Reference frame rate for time normalization. Default: 30 fps.
   */
  nominalFps: number;

  /**
   * Whether to scale landmark displacement by delta time (dt) for fps invariance.
   * When true, smoothing behavior is identical across 30, 60, 120, and 240 fps.
   * Default: true.
   */
  normalizeByFps: boolean;
}

export const DEFAULT_POSE_SMOOTHER_CONFIG: PoseSmootherConfig = {
  minFactor: 0.15,
  velocityScale: 20.0,
  nominalFps: 30,
  normalizeByFps: true,
};

/**
 * Calculates 3D distance between two landmark positions in normalized coordinate space.
 * Z-axis is weighted by 0.5 due to monocular depth noise.
 */
function landmarkDistance3D(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = ((a.z ?? 0) - (b.z ?? 0)) * 0.5;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Smooths an individual landmark using velocity-adaptive EMA.
 */
function smoothLandmark(
  curr: Landmark,
  prev: Landmark | undefined,
  dtSec: number,
  config: PoseSmootherConfig
): Landmark {
  if (!prev) {
    return { ...curr };
  }

  // 1. Calculate displacement
  const dist = landmarkDistance3D(curr, prev);

  // 2. Normalize velocity
  let velocity = dist;
  if (config.normalizeByFps && dtSec > 0) {
    // Equivalent displacement at nominalFps (e.g. 30 fps)
    velocity = (dist / dtSec) * (1 / config.nominalFps);
  }

  // 3. Velocity-adaptive alpha:
  //    v -> 0 => alpha -> minFactor
  //    v >> 0 => alpha -> 1.0
  const rawAlpha = 1.0 - (1.0 - config.minFactor) * Math.exp(-config.velocityScale * velocity);
  const alpha = Math.max(config.minFactor, Math.min(1.0, rawAlpha));

  // 4. Exponential moving average
  const x = alpha * curr.x + (1.0 - alpha) * prev.x;
  const y = alpha * curr.y + (1.0 - alpha) * prev.y;

  let z: number | undefined;
  if (curr.z !== undefined && prev.z !== undefined) {
    z = alpha * curr.z + (1.0 - alpha) * prev.z;
  } else {
    z = curr.z;
  }

  return {
    id: curr.id,
    x,
    y,
    z,
    visibility: curr.visibility,
    presence: curr.presence,
  };
}

/**
 * Pure function: applies velocity-adaptive EMA smoothing to a sequence of PoseFrames.
 * Non-mutating; returns a new array with smoothed landmark coordinates.
 *
 * @param frames Sequence of PoseFrames to smooth.
 * @param options Optional configuration overrides.
 * @returns New sequence of smoothed PoseFrames.
 */
export function smoothPoseSequence(
  frames: readonly PoseFrame[],
  options?: Partial<PoseSmootherConfig>
): PoseFrame[] {
  if (frames.length <= 1) {
    return frames.map((f) => ({ ...f }));
  }

  const config: PoseSmootherConfig = {
    ...DEFAULT_POSE_SMOOTHER_CONFIG,
    ...(options || {}),
  };

  const prevLandmarks = new Map<LandmarkId, Landmark>();
  const prevWorldLandmarks = new Map<LandmarkId, Landmark>();
  let prevTimestampMs: number | undefined;

  return frames.map((frame, frameIdx) => {
    // Determine dt in seconds
    let dtSec = 1 / config.nominalFps;
    if (prevTimestampMs !== undefined && frame.timestampMs > prevTimestampMs) {
      dtSec = Math.max(0.001, (frame.timestampMs - prevTimestampMs) / 1000);
    }
    prevTimestampMs = frame.timestampMs;

    // Smooth standard normalized landmarks
    const smoothedLandmarks: Landmark[] = [];
    for (const lm of frame.landmarks) {
      const prev = frameIdx === 0 ? undefined : prevLandmarks.get(lm.id);
      const smoothed = smoothLandmark(lm, prev, dtSec, config);
      smoothedLandmarks.push(smoothed);
      prevLandmarks.set(lm.id, smoothed);
    }

    // Smooth optional world landmarks
    let smoothedWorldLandmarks: Landmark[] | undefined;
    if (frame.worldLandmarks && frame.worldLandmarks.length > 0) {
      smoothedWorldLandmarks = [];
      for (const lm of frame.worldLandmarks) {
        const prev = frameIdx === 0 ? undefined : prevWorldLandmarks.get(lm.id);
        const smoothed = smoothLandmark(lm, prev, dtSec, config);
        smoothedWorldLandmarks.push(smoothed);
        prevWorldLandmarks.set(lm.id, smoothed);
      }
    }

    return {
      frameId: frame.frameId,
      timestampMs: frame.timestampMs,
      width: frame.width,
      height: frame.height,
      landmarks: smoothedLandmarks,
      worldLandmarks: smoothedWorldLandmarks,
      club: frame.club,
      model: frame.model,
      modelVersion: frame.modelVersion,
    };
  });
}

/**
 * Stateful class for velocity-adaptive pose smoothing in streaming or real-time pipelines.
 */
export class PoseSmoother {
  private config: PoseSmootherConfig;
  private prevLandmarks = new Map<LandmarkId, Landmark>();
  private prevWorldLandmarks = new Map<LandmarkId, Landmark>();
  private prevTimestampMs: number | undefined;

  constructor(options?: Partial<PoseSmootherConfig>) {
    this.config = {
      ...DEFAULT_POSE_SMOOTHER_CONFIG,
      ...(options || {}),
    };
  }

  /**
   * Resets internal history. Call between takes or when a new session starts.
   */
  public reset(): void {
    this.prevLandmarks.clear();
    this.prevWorldLandmarks.clear();
    this.prevTimestampMs = undefined;
  }

  /**
   * Smooths a single incoming live PoseFrame.
   */
  public smoothFrame(frame: PoseFrame): PoseFrame {
    let dtSec = 1 / this.config.nominalFps;
    if (this.prevTimestampMs !== undefined && frame.timestampMs > this.prevTimestampMs) {
      dtSec = Math.max(0.001, (frame.timestampMs - this.prevTimestampMs) / 1000);
    }
    this.prevTimestampMs = frame.timestampMs;

    const smoothedLandmarks: Landmark[] = [];
    for (const lm of frame.landmarks) {
      const prev = this.prevLandmarks.get(lm.id);
      const smoothed = smoothLandmark(lm, prev, dtSec, this.config);
      smoothedLandmarks.push(smoothed);
      this.prevLandmarks.set(lm.id, smoothed);
    }

    let smoothedWorldLandmarks: Landmark[] | undefined;
    if (frame.worldLandmarks && frame.worldLandmarks.length > 0) {
      smoothedWorldLandmarks = [];
      for (const lm of frame.worldLandmarks) {
        const prev = this.prevWorldLandmarks.get(lm.id);
        const smoothed = smoothLandmark(lm, prev, dtSec, this.config);
        smoothedWorldLandmarks.push(smoothed);
        this.prevWorldLandmarks.set(lm.id, smoothed);
      }
    }

    return {
      frameId: frame.frameId,
      timestampMs: frame.timestampMs,
      width: frame.width,
      height: frame.height,
      landmarks: smoothedLandmarks,
      worldLandmarks: smoothedWorldLandmarks,
      club: frame.club,
      model: frame.model,
      modelVersion: frame.modelVersion,
    };
  }

  /**
   * Batch processes a sequence of frames, resetting state beforehand.
   */
  public smoothSequence(frames: readonly PoseFrame[]): PoseFrame[] {
    this.reset();
    return frames.map((f) => this.smoothFrame(f));
  }
}
