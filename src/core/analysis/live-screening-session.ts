/**
 * Live Screening Session
 *
 * Turns live pose frames into the per-test results the screening screen
 * scores. The live coaching engines only count repetitions and speak cues;
 * the measurements come from here:
 *
 * - Hip hinge: frames are collected while the test runs and the full
 *   TemporalPipeline (same as the web harness) extracts per-rep angles and
 *   compensations when the last repetition completes.
 * - Thoracic rotation: the rotation engine's samples are summarized with
 *   summarizeThoracicRotation.
 *
 * Both return null when nothing valid was measured, so the caller can abstain
 * instead of scoring invented values.
 *
 * @module live-screening-session
 * @version LIVE_SCREENING_SESSION_V1
 */

import { PoseFrame } from '../types/pose-frame';
import { TemporalPipeline } from '../motion/temporal-pipeline';
import { HIP_HINGE_V1 } from '../../protocols/hip-hinge-v1';
import { RotationSample, summarizeThoracicRotation } from '../metrics/thoracic-rotation-metrics';
import { normalizedToBodyMetric, TransformParams } from '../coordinates/coordinate-transform';
import { PipelineTraceBuilder } from '../trace/pipeline-trace-builder';

export const VERSION = 'LIVE_SCREENING_SESSION_V1';

/** Hip hinge result in the shape the screening screen stores and scores. */
export interface LiveHingeMeasurement {
  hingeAngle: number;      // mean HIP_HINGE_ANGLE_2D over valid reps (degrees)
  kneeAngle: number;       // mean KNEE_ANGLE_AT_ENDPOINT over valid reps (degrees)
  compensations: string[]; // distinct compensation types
  repCount: number;
}

/** Thoracic rotation result in the shape the screening screen stores and scores. */
export interface LiveRotationMeasurement {
  leftDeg: number;
  rightDeg: number;
  asymmetryDeg: number;
  pelvicTurnDeg: number;
  compensations: string[];
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Native frames arrive in image space (y down). The hip hinge metrics work in
 * BODY_METRIC space (y up, centered), which the web harness produces in its
 * MediaPipe adapter; apply the same transform (device upright) here.
 */
function toBodyMetricFrame(frame: PoseFrame): PoseFrame {
  const params: TransformParams = {
    sensorOrientation: 0,
    imageWidth: frame.width,
    imageHeight: frame.height,
    previewWidth: frame.width,
    previewHeight: frame.height,
    isMirrored: false,
    gravityVector: { x: 0, y: -1, z: 0 },
  };
  return {
    ...frame,
    landmarks: frame.landmarks.map((lm) => ({ ...lm, ...normalizedToBodyMetric({ x: lm.x, y: lm.y }, params) })),
  };
}

export class LiveScreeningSession {
  private hingeFrames: PoseFrame[] = [];

  /** Record a frame captured during the hip hinge test (image-space landmarks, as from the native module). */
  addHingeFrame(frame: PoseFrame): void {
    this.hingeFrames.push(toBodyMetricFrame(frame));
  }

  get hingeFrameCount(): number {
    return this.hingeFrames.length;
  }

  /**
   * Runs the hip hinge pipeline over the recorded frames.
   * Returns null when no valid repetition was measured.
   */
  finalizeHinge(): LiveHingeMeasurement | null {
    if (this.hingeFrames.length === 0) return null;
    const first = this.hingeFrames[0]!;
    const last = this.hingeFrames[this.hingeFrames.length - 1]!;
    const spanSec = Math.max(0.001, (last.timestampMs - first.timestampMs) / 1000);
    const fps = Math.round((this.hingeFrames.length - 1) / spanSec) || 30;
    // TemporalPipeline's own default trace lacks required fields; supply a
    // complete one, as the web harness does.
    const trace = new PipelineTraceBuilder(`live_hinge_${first.timestampMs}`)
      .setDevice('MOBILE', 'UNKNOWN_OS')
      .setCamera(`${first.width}x${first.height}`, fps)
      .setPoseModel(first.model || 'MEDIAPIPE_POSE', first.modelVersion || 'UNKNOWN', null, 'UNKNOWN_SHA')
      .setAnalysisMode('LIVE', fps, fps)
      .setDecodedFrames([]);
    const result = new TemporalPipeline({ protocol: HIP_HINGE_V1 }).process(this.hingeFrames, trace);
    // Only a SUCCESS analysis is a measurement; FAILED/ABSTAINED may still
    // carry residual repetitions that must not be shown or scored.
    if (result.status !== 'SUCCESS') return null;
    const reps = result.repetitions;
    if (reps.length === 0) return null;

    const compensations: string[] = [];
    for (const c of reps.flatMap((r) => r.compensations)) {
      if (!compensations.includes(c.type)) compensations.push(c.type);
    }
    return {
      hingeAngle: mean(reps.map((r) => r.hipHingeAngle2D.value)),
      kneeAngle: mean(reps.map((r) => r.kneeAngleAtEndpoint.value)),
      compensations,
      repCount: reps.length,
    };
  }

  /** Clears recorded frames (new attempt). */
  reset(): void {
    this.hingeFrames = [];
  }

  /**
   * Summarizes rotation samples from LiveRotationCoachingEngine.
   * Returns null when there are no samples.
   */
  static summarizeRotation(samples: RotationSample[]): LiveRotationMeasurement | null {
    if (samples.length === 0) return null;
    const r = summarizeThoracicRotation(samples);
    const compensations: string[] = [];
    if (r.compensations.excessiveLateralTilt) compensations.push('EXCESSIVE_LATERAL_TILT');
    if (r.compensations.excessivePelvicRotation) compensations.push('EXCESSIVE_PELVIC_ROTATION');
    if (r.compensations.severeAsymmetry) compensations.push('SEVERE_ASYMMETRY');
    return {
      leftDeg: r.maxRotationLeft,
      rightDeg: r.maxRotationRight,
      asymmetryDeg: r.rotationAsymmetry,
      pelvicTurnDeg: Math.max(r.pelvicTurnAtPeakLeft, r.pelvicTurnAtPeakRight),
      compensations,
    };
  }
}
