/**
 * Screening Diagnostics
 *
 * Collects what happened during one live screening (camera, pose model,
 * frame throughput, landmark quality, pipeline outcome) into a small JSON
 * log the tester can share from the result screen. Without it a failed
 * device test gives no clue why: angles, rep counts and camera problems are
 * otherwise only visible in the Metro console.
 *
 * Contains no images or landmark coordinates — only counts, rates, angles
 * and status codes.
 *
 * @module screening-diagnostics
 * @version SCREENING_DIAGNOSTICS_V1
 */

import type { PoseFrame } from '../types/pose-frame';
import { LandmarkId } from '../types/landmark';
import type { FrameSourceInfo, LivePoseProcessorStats } from '../capture/live-pose-processor';
import type {
  HingeAnalysisDiagnostics,
  LiveHingeMeasurement,
  LiveRotationMeasurement,
} from '../analysis/live-screening-session';

export const VERSION = 'SCREENING_DIAGNOSTICS_V1';

/** At most this many error messages are kept (the first ones explain the most). */
export const MAX_DIAGNOSTIC_ERRORS = 20;

/** Landmarks both tests depend on; their mean confidence is reported. */
const KEY_LANDMARKS: readonly LandmarkId[] = [
  LandmarkId.LEFT_SHOULDER, LandmarkId.RIGHT_SHOULDER,
  LandmarkId.LEFT_HIP, LandmarkId.RIGHT_HIP,
  LandmarkId.LEFT_KNEE, LandmarkId.RIGHT_KNEE,
  LandmarkId.LEFT_ANKLE, LandmarkId.RIGHT_ANKLE,
];

export interface PoseModelDiagnostics {
  ready: boolean;
  model: string | null;
  version: string | null;
  variant: string | null;
  sha256: string | null;
  initError: string | null;
}

export interface ScreeningDiagnostics {
  version: string;
  createdAt: string;
  testType: string;
  isSimulated: boolean;
  device: { os: string; osVersion: string };
  camera: { position: string; firstFrame: FrameSourceInfo | null };
  poseModel: PoseModelDiagnostics;
  /** Camera images handed to the pose processor (null if it never started). */
  processor: LivePoseProcessorStats | null;
  /** Pose frames that reached the screening (a person was detected). */
  poseFrames: {
    count: number;
    durationMs: number;
    fps: number | null;
    landmarksPerFrame: number | null;
    /** Mean visibility/presence of shoulders, hips, knees and ankles, 0–1. */
    keyLandmarkConfidence: number | null;
  };
  hinge: {
    analysis: HingeAnalysisDiagnostics | null;
    result: LiveHingeMeasurement | null;
  } | null;
  rotation: {
    sampleCount: number;
    result: LiveRotationMeasurement | null;
  } | null;
  errors: string[];
}

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

function landmarkConfidence(visibility?: number, presence?: number): number | null {
  if (visibility !== undefined && presence !== undefined) return (visibility + presence) / 2;
  const c = visibility ?? presence;
  return c === undefined ? null : c;
}

function describeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return typeof err === 'string' ? err : JSON.stringify(err) ?? String(err);
}

export class ScreeningDiagnosticsRecorder {
  private readonly testType: string;
  private cameraPosition = 'unknown';
  private firstFrame: FrameSourceInfo | null = null;
  private poseModel: PoseModelDiagnostics = {
    ready: false, model: null, version: null, variant: null, sha256: null, initError: null,
  };
  private frameCount = 0;
  private firstFrameMs: number | null = null;
  private lastFrameMs: number | null = null;
  private landmarkTotal = 0;
  private confidenceSum = 0;
  private confidenceCount = 0;
  private hinge: ScreeningDiagnostics['hinge'] = null;
  private rotation: ScreeningDiagnostics['rotation'] = null;
  private readonly errors: string[] = [];
  private droppedErrors = 0;

  constructor(testType: string) {
    this.testType = testType;
  }

  setCameraPosition(position: string): void {
    this.cameraPosition = position;
  }

  setFirstFrameInfo(info: FrameSourceInfo): void {
    if (!this.firstFrame) this.firstFrame = { ...info };
  }

  setPoseModelReady(info: { model: string; version: string; variant: string; sha256: string }): void {
    this.poseModel = { ...this.poseModel, ready: true, ...info };
  }

  setPoseModelFailed(err: unknown): void {
    this.poseModel = { ...this.poseModel, ready: false, initError: describeError(err) };
  }

  recordError(context: string, err: unknown): void {
    if (this.errors.length >= MAX_DIAGNOSTIC_ERRORS) {
      this.droppedErrors++;
      return;
    }
    this.errors.push(`${context}: ${describeError(err)}`);
  }

  recordPoseFrame(frame: PoseFrame): void {
    this.frameCount++;
    if (this.firstFrameMs === null) this.firstFrameMs = frame.timestampMs;
    this.lastFrameMs = frame.timestampMs;
    this.landmarkTotal += frame.landmarks.length;
    for (const lm of frame.landmarks) {
      if (!KEY_LANDMARKS.includes(lm.id)) continue;
      const c = landmarkConfidence(lm.visibility, lm.presence);
      if (c !== null && Number.isFinite(c)) {
        this.confidenceSum += c;
        this.confidenceCount++;
      }
    }
  }

  setHinge(analysis: HingeAnalysisDiagnostics | null, result: LiveHingeMeasurement | null): void {
    this.hinge = { analysis, result };
  }

  setRotation(sampleCount: number, result: LiveRotationMeasurement | null): void {
    this.rotation = { sampleCount, result };
  }

  build(options: {
    isSimulated: boolean;
    device: { os: string; osVersion: string };
    processorStats: LivePoseProcessorStats | null;
    now?: Date;
  }): ScreeningDiagnostics {
    const durationMs = this.firstFrameMs !== null && this.lastFrameMs !== null
      ? Math.max(0, this.lastFrameMs - this.firstFrameMs)
      : 0;
    const errors = [...this.errors];
    if (this.droppedErrors > 0) errors.push(`… ${this.droppedErrors} more error(s) not recorded`);
    return {
      version: VERSION,
      createdAt: (options.now ?? new Date()).toISOString(),
      testType: this.testType,
      isSimulated: options.isSimulated,
      device: { ...options.device },
      camera: { position: this.cameraPosition, firstFrame: this.firstFrame },
      poseModel: { ...this.poseModel },
      processor: options.processorStats ? { ...options.processorStats } : null,
      poseFrames: {
        count: this.frameCount,
        durationMs: Math.round(durationMs),
        fps: this.frameCount > 1 && durationMs > 0 ? round(((this.frameCount - 1) * 1000) / durationMs, 1) : null,
        landmarksPerFrame: this.frameCount > 0 ? round(this.landmarkTotal / this.frameCount, 1) : null,
        keyLandmarkConfidence: this.confidenceCount > 0 ? round(this.confidenceSum / this.confidenceCount, 2) : null,
      },
      hinge: this.hinge,
      rotation: this.rotation,
      errors,
    };
  }
}

/** Text shared from the result screen: a short header plus the JSON log. */
export function formatDiagnosticsForSharing(d: ScreeningDiagnostics): string {
  return `Golf Body OS – testlogg (${d.testType}, ${d.createdAt})\n\n${JSON.stringify(d, null, 2)}`;
}
