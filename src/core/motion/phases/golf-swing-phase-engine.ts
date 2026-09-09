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
  /**
   * P2: Takeaway — shaft parallel in backswing.
   * Kinematic condition: Hands at hip/waist elevation and thoracic turn loaded (~18°–35°).
   */
  private findSubPhaseP2(
    handTrajectory: { frameIndex: number; x: number; y: number }[],
    frames: PoseFrame[],
    p1Idx: number,
    p4Idx: number
  ): number {
    const minIdx = p1Idx + 1;
    const maxIdx = p4Idx - 2;
    if (minIdx >= maxIdx) return Math.min(frames.length - 1, p1Idx + 1);

    let bestIdx = minIdx;
    let minDiff = Infinity;

    for (let i = minIdx; i <= maxIdx; i++) {
      const frame = frames[i];
      const lh = getLandmark(frame, LandmarkId.LEFT_HIP);
      const rh = getLandmark(frame, LandmarkId.RIGHT_HIP);
      const ls = getLandmark(frame, LandmarkId.LEFT_SHOULDER);
      const rs = getLandmark(frame, LandmarkId.RIGHT_SHOULDER);

      const hipY = (lh && rh) ? (lh.y + rh.y) / 2 : 0.50;
      const turn = (ls && rs) ? computeTransverseTurn(ls, rs, this.isRightHanded) : 25;

      // Distance from hands to hip elevation
      const handDistToHip = Math.abs(handTrajectory[i].y - hipY);
      // Turn proximity to classic takeaway (22°)
      const turnPenalty = Math.abs(turn - 22) / 45;

      const score = handDistToHip + turnPenalty * 0.15;
      if (score < minDiff) {
        minDiff = score;
        bestIdx = i;
      }
    }

    return bestIdx;
  }

  /**
   * P3: Lead Arm Parallel in backswing.
   * Kinematic condition: Lead arm vector is horizontal to the ground (lead wrist elevation matches lead shoulder).
   */
  private findSubPhaseP3(
    frames: PoseFrame[],
    p2Idx: number,
    p4Idx: number
  ): number {
    const minIdx = p2Idx + 1;
    const maxIdx = p4Idx - 1;
    if (minIdx >= maxIdx) return Math.min(frames.length - 1, p2Idx + 1);

    let bestIdx = minIdx;
    let minArmSlope = Infinity;

    for (let i = minIdx; i <= maxIdx; i++) {
      const frame = frames[i];
      const leadShoulder = getLandmark(frame, this.isRightHanded ? LandmarkId.LEFT_SHOULDER : LandmarkId.RIGHT_SHOULDER);
      const leadWrist = getLandmark(frame, this.isRightHanded ? LandmarkId.LEFT_WRIST : LandmarkId.RIGHT_WRIST);

      if (leadShoulder && leadWrist) {
        // Arm slope vs horizontal: when lead arm is horizontal, dy is minimal
        const dy = Math.abs(leadWrist.y - leadShoulder.y);
        if (dy < minArmSlope) {
          minArmSlope = dy;
          bestIdx = i;
        }
      }
    }

    return bestIdx;
  }

  /**
   * P5: Shallowing — Lead Arm Parallel in downswing.
   * Kinematic condition: Lead arm is horizontal to ground during rapid downswing descent.
   */
  private findSubPhaseP5(
    frames: PoseFrame[],
    p4Idx: number,
    p7Idx: number
  ): number {
    const minIdx = p4Idx + 1;
    const maxIdx = p7Idx - 2;
    if (minIdx >= maxIdx) return Math.min(frames.length - 1, p4Idx + 1);

    let bestIdx = minIdx;
    let minArmSlope = Infinity;

    for (let i = minIdx; i <= maxIdx; i++) {
      const frame = frames[i];
      const leadShoulder = getLandmark(frame, this.isRightHanded ? LandmarkId.LEFT_SHOULDER : LandmarkId.RIGHT_SHOULDER);
      const leadWrist = getLandmark(frame, this.isRightHanded ? LandmarkId.LEFT_WRIST : LandmarkId.RIGHT_WRIST);

      if (leadShoulder && leadWrist) {
        const dy = Math.abs(leadWrist.y - leadShoulder.y);
        if (dy < minArmSlope) {
          minArmSlope = dy;
          bestIdx = i;
        }
      }
    }

    return bestIdx;
  }

  /**
   * P6: Delivery — shaft parallel before impact.
   * Kinematic condition: Hands reach trail thigh elevation right before unhinging into impact.
   */
  private findSubPhaseP6(
    handTrajectory: { frameIndex: number; x: number; y: number }[],
    frames: PoseFrame[],
    p5Idx: number,
    p7Idx: number
  ): number {
    const margin = p7Idx - p5Idx >= 6 ? Math.max(2, Math.round((p7Idx - p5Idx) * 0.15)) : 1;
    const minIdx = p5Idx + 1;
    const maxIdx = p7Idx - margin;
    if (minIdx >= maxIdx) return Math.max(minIdx, p7Idx - 1);

    let bestIdx = minIdx;
    let minDiff = Infinity;

    for (let i = minIdx; i <= maxIdx; i++) {
      const frame = frames[i];
      const trailHip = getLandmark(frame, this.isRightHanded ? LandmarkId.RIGHT_HIP : LandmarkId.LEFT_HIP);
      const trailKnee = getLandmark(frame, this.isRightHanded ? LandmarkId.RIGHT_KNEE : LandmarkId.LEFT_KNEE);

      const thighTargetY = (trailHip && trailKnee)
        ? trailHip.y + (trailKnee.y - trailHip.y) * 0.10
        : 0.50;

      const diff = Math.abs(handTrajectory[i].y - thighTargetY);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = i;
      }
    }

    return bestIdx;
  }

  /**
   * P8: Release — shaft parallel after impact.
   * Kinematic condition: Hands rising to lead hip/thigh height with arms extended.
   */
  private findSubPhaseP8(
    handTrajectory: { frameIndex: number; x: number; y: number }[],
    frames: PoseFrame[],
    p7Idx: number,
    p10Idx: number
  ): number {
    const margin = p10Idx - p7Idx >= 8 ? Math.max(2, Math.round((p10Idx - p7Idx) * 0.08)) : 1;
    const minIdx = p7Idx + margin;
    const maxIdx = p10Idx - 2;
    if (minIdx >= maxIdx) return Math.min(frames.length - 1, p7Idx + 1);

    let bestIdx = minIdx;
    let minDiff = Infinity;

    for (let i = minIdx; i <= maxIdx; i++) {
      const frame = frames[i];
      const leadHip = getLandmark(frame, this.isRightHanded ? LandmarkId.LEFT_HIP : LandmarkId.RIGHT_HIP);
      const leadKnee = getLandmark(frame, this.isRightHanded ? LandmarkId.LEFT_KNEE : LandmarkId.RIGHT_KNEE);

      const targetY = (leadHip && leadKnee)
        ? leadHip.y + (leadKnee.y - leadHip.y) * 0.15
        : 0.52;

      const diff = Math.abs(handTrajectory[i].y - targetY);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = i;
      }
    }

    return bestIdx;
  }

  /**
   * P9: Re-hinge — trail arm parallel in follow-through.
   * Kinematic condition: Trail arm (trail shoulder to trail wrist) is horizontal to the ground.
   */
  private findSubPhaseP9(
    frames: PoseFrame[],
    p8Idx: number,
    p10Idx: number
  ): number {
    const minIdx = p8Idx + 1;
    const maxIdx = p10Idx - 1;
    if (minIdx >= maxIdx) return Math.min(frames.length - 1, p8Idx + 1);

    let bestIdx = minIdx;
    let minArmSlope = Infinity;

    for (let i = minIdx; i <= maxIdx; i++) {
      const frame = frames[i];
      const trailShoulder = getLandmark(frame, this.isRightHanded ? LandmarkId.RIGHT_SHOULDER : LandmarkId.LEFT_SHOULDER);
      const trailWrist = getLandmark(frame, this.isRightHanded ? LandmarkId.RIGHT_WRIST : LandmarkId.LEFT_WRIST);

      if (trailShoulder && trailWrist) {
        const dy = Math.abs(trailWrist.y - trailShoulder.y);
        if (dy < minArmSlope) {
          minArmSlope = dy;
          bestIdx = i;
        }
      }
    }

    return bestIdx;
  }
}
