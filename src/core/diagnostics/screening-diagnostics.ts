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
/** At most this many distinct camera sources are kept (one per flip/orientation change). */
export const MAX_FRAME_SOURCES = 10;

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

export interface StageThroughput {
  count: number;
  durationMs: number;
  fps: number | null;
}

export interface ScreeningDiagnostics {
  version: string;
  createdAt: string;
  testType: string;
  isSimulated: boolean;
  device: { os: string; osVersion: string };
  camera: {
    /** Camera selected when the log was built. */
    position: string;
    /** Each distinct camera source seen, tagged with the camera selected when it arrived. */
    frameSources: Array<FrameSourceInfo & { cameraPosition: string }>;
  };
  poseModel: PoseModelDiagnostics;
  /** Camera images handed to the pose processor (null if it never started). */
  processor: LivePoseProcessorStats | null;
  /**
   * Pose frames that reached the screening (a person was detected).
   * Duration and fps cover active capture only: summed per stage, so the
   * camera-off pause between stages of a full battery is not counted.
   */
  poseFrames: {
    count: number;
    durationMs: number;
    fps: number | null;
    byStage: Record<string, StageThroughput>;
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

/** Frames per second from frame intervals over a duration; null when undefined. */
function throughput(intervals: number, durationMs: number): number | null {
  return intervals > 0 && durationMs > 0 ? round((intervals * 1000) / durationMs, 1) : null;
}

function describeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return typeof err === 'string' ? err : JSON.stringify(err) ?? String(err);
}

export class ScreeningDiagnosticsRecorder {
  private readonly testType: string;
  private cameraPosition = 'unknown';
  private readonly frameSources: Array<FrameSourceInfo & { cameraPosition: string }> = [];
  private poseModel: PoseModelDiagnostics = {
    ready: false, model: null, version: null, variant: null, sha256: null, initError: null,
  };
  private frameCount = 0;
  private readonly stages = new Map<string, { count: number; firstMs: number; lastMs: number }>();
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

  /** Records a camera source (first frame, or a change such as a camera flip) with the current position. */
  recordFrameSource(info: FrameSourceInfo): void {
    if (this.frameSources.length >= MAX_FRAME_SOURCES) return;
    this.frameSources.push({ ...info, cameraPosition: this.cameraPosition });
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

  /** `stage` separates capture periods (e.g. HINGE / ROTATION) so pauses between them are not counted. */
  recordPoseFrame(frame: PoseFrame, stage = 'CAPTURE'): void {
    this.frameCount++;
    const s = this.stages.get(stage);
    if (s) {
      s.count++;
      s.lastMs = frame.timestampMs;
    } else {
      this.stages.set(stage, { count: 1, firstMs: frame.timestampMs, lastMs: frame.timestampMs });
    }
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
    const byStage: Record<string, StageThroughput> = {};
    let durationMs = 0;
    let intervals = 0;
    for (const [stage, st] of this.stages) {
      const d = Math.max(0, st.lastMs - st.firstMs);
      byStage[stage] = { count: st.count, durationMs: Math.round(d), fps: throughput(st.count - 1, d) };
      durationMs += d;
      intervals += st.count - 1;
    }
    const errors = [...this.errors];
    if (this.droppedErrors > 0) errors.push(`… ${this.droppedErrors} more error(s) not recorded`);
    return {
      version: VERSION,
      createdAt: (options.now ?? new Date()).toISOString(),
      testType: this.testType,
      isSimulated: options.isSimulated,
      device: { ...options.device },
      camera: { position: this.cameraPosition, frameSources: this.frameSources.map((f) => ({ ...f })) },
      poseModel: { ...this.poseModel },
      processor: options.processorStats ? { ...options.processorStats } : null,
      poseFrames: {
        count: this.frameCount,
        durationMs: Math.round(durationMs),
        fps: throughput(intervals, durationMs),
        byStage,
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
