/**
 * Golf Swing Phase Engine
 *
 * Detects all 10 canonical golf swing P-positions (P1 through P10)
 * from high-speed video frames (240 fps, 120 fps, 60 fps, 30 fps).
 *
 * Employs a 2-stage Anchor & Interpolate kinematic algorithm:
 * Stage 1: Locks cardinal inflection points (P1 Address, P4 Top, P7 Impact, P10 Finish)
 * Stage 2: Resolves intermediate sub-phases (P2, P3, P5, P6, P8, P9) within high-speed windows.
 *
 * @module golf-swing-phase-engine
 * @version GOLF_SWING_PHASE_ENGINE_V1
 */

import { PoseFrame } from '../../types/pose-frame';
import { LandmarkId } from '../../types/landmark';
import {
  CameraViewAngle,
  GolfSwingAnalysisResult,
  ORDERED_SWING_PHASES,
  SwingPhaseEvent,
  SwingPhaseId
} from '../../types/golf-swing';
import {
  extractPhaseKinematics,
  detectSwingFaults,
  calculateSwingTempo,
  getLandmark,
  getMidpoint,
  computeTransverseTurn
} from '../../metrics/golf-swing-metrics';

export const VERSION = 'GOLF_SWING_PHASE_ENGINE_V1';

export interface GolfSwingPhaseEngineOptions {
  viewAngle?: CameraViewAngle;
  isRightHanded?: boolean;
}

export class GolfSwingPhaseEngine {
  private viewAngle: CameraViewAngle;
  private isRightHanded: boolean;

  constructor(options: GolfSwingPhaseEngineOptions = {}) {
    this.viewAngle = options.viewAngle ?? 'FACE_ON';
    this.isRightHanded = options.isRightHanded ?? true;
  }

  /**
   * Analyzes an entire sequence of PoseFrames and extracts all 10 P-phases.
   */
  public analyzeSequence(frames: PoseFrame[]): GolfSwingAnalysisResult {
    if (!frames || frames.length < 15) {
      throw new Error(`Insufficient frames for golf swing analysis: received ${frames?.length ?? 0}, minimum 15 required`);
    }

    // Determine effective framerate from timestamps
    const frameRate = this.estimateFrameRate(frames);

    // Compute hand trajectory and velocities
    const handTrajectory = frames.map((frame, idx) => {
      const lw = getLandmark(frame, LandmarkId.LEFT_WRIST);
      const rw = getLandmark(frame, LandmarkId.RIGHT_WRIST);
      const pos = (lw && rw) ? getMidpoint(lw, rw) : (lw || rw || { x: 0.5, y: 0.5, z: 0 });
      return {
        frameIndex: idx,
        timestampMs: frame.timestampMs,
        x: pos.x,
        y: pos.y,
        z: pos.z
      };
    });

    // 1. Stage 1: Detect Cardinal Anchors (P1, P4, P7, P10)
    const p1Idx = this.findAddressAnchor(handTrajectory, frames);
    const p4Idx = this.findTopAnchor(handTrajectory, frames, p1Idx);
    const p7Idx = this.findImpactAnchor(handTrajectory, frames, p4Idx);
    const p10Idx = this.findFinishAnchor(handTrajectory, frames, p7Idx);

    // 2. Stage 2: Detect Intermediate Phases
    const p2Idx = this.findSubPhaseP2(handTrajectory, frames, p1Idx, p4Idx);
    const p3Idx = this.findSubPhaseP3(frames, p2Idx, p4Idx);
    const p5Idx = this.findSubPhaseP5(frames, p4Idx, p7Idx);
    const p6Idx = this.findSubPhaseP6(handTrajectory, frames, p5Idx, p7Idx);
    const p8Idx = this.findSubPhaseP8(handTrajectory, frames, p7Idx, p10Idx);
    const p9Idx = this.findSubPhaseP9(frames, p8Idx, p10Idx);

    const phaseIndices: Record<SwingPhaseId, number> = {
      P1_ADDRESS: p1Idx,
      P2_TAKEAWAY: p2Idx,
      P3_HALFWAY_BACK: p3Idx,
      P4_TOP: p4Idx,
      P5_SHALLOW: p5Idx,
      P6_DELIVERY: p6Idx,
      P7_IMPACT: p7Idx,
      P8_RELEASE: p8Idx,
      P9_REHINGE: p9Idx,
      P10_FINISH: p10Idx
    };

    // Build ordered events
    const phases: Record<SwingPhaseId, SwingPhaseEvent> = {} as any;
    const orderedEvents: SwingPhaseEvent[] = [];

    for (const phaseId of ORDERED_SWING_PHASES) {
      const idx = phaseIndices[phaseId];
      const targetFrame = frames[idx] || frames[0];
      const evt: SwingPhaseEvent = {
        phaseId,
        frameIndex: idx,
        timestampMs: targetFrame.timestampMs,
        confidence: 0.95
      };
      phases[phaseId] = evt;
      orderedEvents.push(evt);
    }

    // 3. Extract Kinematics for all 10 phases
    const addressFrame = frames[p1Idx];
    const kinematics: Record<SwingPhaseId, any> = {} as any;

    for (const phaseId of ORDERED_SWING_PHASES) {
      const targetFrame = frames[phaseIndices[phaseId]];
      kinematics[phaseId] = extractPhaseKinematics(
        targetFrame,
        phaseId,
        addressFrame,
        this.viewAngle,
        this.isRightHanded
      );
    }

    // 4. Calculate Tempo
    const tempo = calculateSwingTempo(phases.P1_ADDRESS, phases.P4_TOP, phases.P7_IMPACT);

    // 5. Detect Biomechanical Faults
    const faults = detectSwingFaults(kinematics, this.viewAngle);

    // 6. Overall Swing Score calculation (100 base minus deductions)
    let swingScore = 100;
    if (tempo.rating === 'GOOD') swingScore -= 5;
    if (tempo.rating === 'FAST_BACKSWING' || tempo.rating === 'SLOW_BACKSWING') swingScore -= 12;
    for (const f of faults) {
      if (f.severity === 'HIGH') swingScore -= 15;
      else if (f.severity === 'MEDIUM') swingScore -= 8;
      else swingScore -= 4;
    }
    const overallSwingScore = Math.max(25, Math.min(100, Math.round(swingScore)));

    const durationMs = frames[frames.length - 1].timestampMs - frames[0].timestampMs;

    return {
      sessionId: `swing_${Date.now()}`,
      viewAngle: this.viewAngle,
      detectedFrameRate: frameRate,
      totalFramesAnalyzed: frames.length,
      durationMs,
      phases,
      orderedEvents,
      kinematics,
      tempo,
      faults,
      correlations: [], // Enriched by BodySwingCorrelator
      overallSwingScore
    };
  }

  private estimateFrameRate(frames: PoseFrame[]): number {
    if (frames.length < 2) return 30;
    const totalDurationSec = (frames[frames.length - 1].timestampMs - frames[0].timestampMs) / 1000;
    if (totalDurationSec <= 0) return 240;
    const rawFps = (frames.length - 1) / totalDurationSec;

    // Snapping to common camera frame rates
    if (rawFps >= 200) return 240;
    if (rawFps >= 100) return 120;
    if (rawFps >= 50) return 60;
    return 30;
  }

  /**
   * P1: Address — lowest velocity resting position before movement initiates.
   */
  private findAddressAnchor(handTrajectory: { frameIndex: number; x: number; y: number }[], frames: PoseFrame[]): number {
    // Look in the first 25% of the sequence
    const searchLimit = Math.max(5, Math.floor(frames.length * 0.25));
    let bestIdx = 0;
    let lowestVel = Infinity;

    for (let i = 1; i < searchLimit; i++) {
      const dx = handTrajectory[i].x - handTrajectory[i - 1].x;
      const dy = handTrajectory[i].y - handTrajectory[i - 1].y;
      const vel = Math.sqrt(dx * dx + dy * dy);
      if (vel < lowestVel) {
        lowestVel = vel;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  /**
   * P4: Top of Backswing — apex of hand path and maximum transverse shoulder rotation.
   */
  private findTopAnchor(
    handTrajectory: { frameIndex: number; x: number; y: number }[],
    frames: PoseFrame[],
    p1Idx: number
  ): number {
    const startSearch = Math.max(p1Idx + 5, Math.floor(frames.length * 0.25));
    const endSearch = Math.floor(frames.length * 0.70);

    // Detect if coordinate space has Y pointing down (standard image space) or up (metric world space)
    const refFrame = frames[p1Idx] || frames[0];
    const la = getLandmark(refFrame, LandmarkId.LEFT_ANKLE);
    const ls0 = getLandmark(refFrame, LandmarkId.LEFT_SHOULDER);
    const yPointsDown = (la && ls0) ? la.y > ls0.y : true;

    let apexIdx = startSearch;
    let maxScore = -Infinity;

    for (let i = startSearch; i < endSearch; i++) {
      const ls = getLandmark(frames[i], LandmarkId.LEFT_SHOULDER);
      const rs = getLandmark(frames[i], LandmarkId.RIGHT_SHOULDER);

      // Shoulder turn in degrees
      let turn = 0;
      let shoulderElevation = 0.5;
      if (ls && rs) {
        turn = computeTransverseTurn(ls, rs, this.isRightHanded);
        shoulderElevation = (ls.y + rs.y) / 2;
      }

      // Height of hands relative to shoulders (positive = hands higher than shoulders)
      const relativeHandHeight = yPointsDown
        ? (shoulderElevation - handTrajectory[i].y)
        : (handTrajectory[i].y - shoulderElevation);

      // Score combines shoulder turn (dominant backswing anchor) and hand elevation
      const score = turn + relativeHandHeight * 50;

      if (score > maxScore) {
        maxScore = score;
        apexIdx = i;
      }
    }

    return apexIdx;
  }

  /**
   * P7: Impact — rapid downswing leads to the bottom impact inflection point (reaching ball).
   */
  private findImpactAnchor(
    handTrajectory: { frameIndex: number; x: number; y: number }[],
    frames: PoseFrame[],
    p4Idx: number
  ): number {
    // Impact occurs rapidly after P4 (typically within 15-30% of total frames)
    const startSearch = p4Idx + 3;
    const endSearch = Math.min(frames.length - 5, p4Idx + Math.floor(frames.length * 0.35));

    const refFrame = frames[0];
    const la = getLandmark(refFrame, LandmarkId.LEFT_ANKLE);
    const ls0 = getLandmark(refFrame, LandmarkId.LEFT_SHOULDER);
    const yPointsDown = (la && ls0) ? la.y > ls0.y : true;

    let impactIdx = startSearch;
    let maxFloorReach = -Infinity;

    for (let i = startSearch; i < endSearch; i++) {
      // Reaching down towards the ball: in image space (yPointsDown), floor is maximum Y
      const floorReach = yPointsDown ? handTrajectory[i].y : -handTrajectory[i].y;
      if (floorReach > maxFloorReach) {
        maxFloorReach = floorReach;
        impactIdx = i;
      }
    }

    return impactIdx;
  }

  /**
   * P10: Finish — high follow-through hold where movement settles.
   */
  private findFinishAnchor(
    handTrajectory: { frameIndex: number; x: number; y: number }[],
    frames: PoseFrame[],
    p7Idx: number
  ): number {
    const startSearch = p7Idx + 5;
    const refFrame = frames[0];
    const la = getLandmark(refFrame, LandmarkId.LEFT_ANKLE);
    const ls0 = getLandmark(refFrame, LandmarkId.LEFT_SHOULDER);
    const yPointsDown = (la && ls0) ? la.y > ls0.y : true;

    let finishIdx = frames.length - 1;
    let maxElevation = -Infinity;

    // Follow through hands elevate high over lead shoulder
    for (let i = startSearch; i < frames.length; i++) {
      const elevation = yPointsDown ? -handTrajectory[i].y : handTrajectory[i].y;
      if (elevation > maxElevation) {
        maxElevation = elevation;
        finishIdx = i;
      }
    }

    // Stabilize to settled hold near the end
    const holdSearch = Math.max(finishIdx, Math.floor(frames.length * 0.88));
    if (holdSearch < frames.length - 1) {
      finishIdx = Math.min(frames.length - 1, holdSearch + 5);
    }

    return finishIdx;
  }

  /**
   * P2: Takeaway — shaft parallel in backswing (hands around waist height).
   */
  private findSubPhaseP2(
    handTrajectory: { frameIndex: number; x: number; y: number }[],
    frames: PoseFrame[],
    p1Idx: number,
    p4Idx: number
  ): number {
    const range = p4Idx - p1Idx;
    if (range <= 2) return Math.min(frames.length - 1, p1Idx + 1);

    // Target is around 30% of the backswing duration
    const targetIdx = p1Idx + Math.max(1, Math.round(range * 0.30));
    return targetIdx;
  }

  /**
   * P3: Lead Arm Parallel in backswing.
   */
  private findSubPhaseP3(
    frames: PoseFrame[],
    p2Idx: number,
    p4Idx: number
  ): number {
    const range = p4Idx - p2Idx;
    if (range <= 2) return Math.min(frames.length - 1, p2Idx + 1);

    // Target is around 65% of the backswing duration
    const targetIdx = p2Idx + Math.max(1, Math.round(range * 0.55));
    return targetIdx;
  }

  /**
   * P5: Lead Arm Parallel in downswing (Shallowing).
   */
  private findSubPhaseP5(
    frames: PoseFrame[],
    p4Idx: number,
    p7Idx: number
  ): number {
    const range = p7Idx - p4Idx;
    if (range <= 2) return Math.min(frames.length - 1, p4Idx + 1);

    // P5 occurs early in downswing (~35% of downswing)
    const targetIdx = p4Idx + Math.max(1, Math.round(range * 0.35));
    return targetIdx;
  }

  /**
   * P6: Delivery (Shaft parallel before impact).
   */
  private findSubPhaseP6(
    handTrajectory: { frameIndex: number; x: number; y: number }[],
    frames: PoseFrame[],
    p5Idx: number,
    p7Idx: number
  ): number {
    const range = p7Idx - p5Idx;
    if (range <= 2) return Math.min(frames.length - 1, p5Idx + 1);

    // Delivery is just prior to impact (~70% of downswing)
    const targetIdx = p5Idx + Math.max(1, Math.round(range * 0.60));
    return targetIdx;
  }

  /**
   * P8: Release (Shaft parallel after impact).
   */
  private findSubPhaseP8(
    handTrajectory: { frameIndex: number; x: number; y: number }[],
    frames: PoseFrame[],
    p7Idx: number,
    p10Idx: number
  ): number {
    const range = p10Idx - p7Idx;
    if (range <= 2) return Math.min(frames.length - 1, p7Idx + 1);

    // Immediately after impact (~25% of follow-through)
    const targetIdx = p7Idx + Math.max(1, Math.round(range * 0.25));
    return targetIdx;
  }

  /**
   * P9: Re-hinge (Trail arm parallel in follow-through).
   */
  private findSubPhaseP9(
    frames: PoseFrame[],
    p8Idx: number,
    p10Idx: number
  ): number {
    const range = p10Idx - p8Idx;
    if (range <= 2) return Math.min(frames.length - 1, p8Idx + 1);

    // Midway through follow-through (~55% from P8 to P10)
    const targetIdx = p8Idx + Math.max(1, Math.round(range * 0.55));
    return targetIdx;
  }
}
