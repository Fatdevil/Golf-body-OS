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
  getMidpoint
} from '../../metrics/golf-swing-metrics';
import { sanitizeGolfPoseFrame } from '../filters/anatomical-filter';

export const VERSION = 'GOLF_SWING_PHASE_ENGINE_V1';

export interface GolfSwingPhaseEngineOptions {
  viewAngle?: CameraViewAngle;
  isRightHanded?: boolean;
  autoDetectHandedness?: boolean;
  slowMotionFactor?: number;
}

export class GolfSwingPhaseEngine {
  private viewAngle: CameraViewAngle;
  private isRightHanded: boolean;
  private autoDetectHandedness: boolean;
  private slowMotionFactor: number;

  constructor(options: GolfSwingPhaseEngineOptions = {}) {
    this.viewAngle = options.viewAngle ?? 'FACE_ON';
    this.isRightHanded = options.isRightHanded ?? true;
    this.autoDetectHandedness = options.autoDetectHandedness ?? true;
    this.slowMotionFactor = options.slowMotionFactor ?? 1.0;
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

    // Sanitize frames through the anatomical bone guard to eliminate hallucinations
    const sanitizedFrames = frames.map((f) => sanitizeGolfPoseFrame(f));

    // Compute hand trajectory and velocities
    let lastKnownHandPos = { x: 0.5, y: 0.5, z: 0 };
    const handTrajectory = sanitizedFrames.map((frame, idx) => {
      const lw = getLandmark(frame, LandmarkId.LEFT_WRIST);
      const rw = getLandmark(frame, LandmarkId.RIGHT_WRIST);
      
      const isLwValid = lw && (lw.visibility ?? 1) >= 0.20;
      const isRwValid = rw && (rw.visibility ?? 1) >= 0.20;

      let pos = lastKnownHandPos;
      if (isLwValid && isRwValid) pos = getMidpoint(lw, rw);
      else if (isLwValid) pos = { x: lw.x, y: lw.y, z: lw.z ?? 0 };
      else if (isRwValid) pos = { x: rw.x, y: rw.y, z: rw.z ?? 0 };
      
      lastKnownHandPos = pos;
      
      return {
        frameIndex: idx,
        timestampMs: frame.timestampMs,
        x: pos.x,
        y: pos.y,
        z: pos.z
      };
    });

    // 1. Stage 1: Detect Cardinal Anchors (P1, P4, P7, P10)
    const { p1Idx, p4Idx, p7Idx, p10Idx, isFallback } = this.findAnchors(handTrajectory, sanitizedFrames, this.viewAngle, frameRate);

    // 2. Stage 2: Detect Intermediate Phases
    const p2Idx = this.findSubPhaseP2(handTrajectory, sanitizedFrames, p1Idx, p4Idx);
    const p3Idx = this.findSubPhaseP3(sanitizedFrames, p2Idx, p4Idx);
    const p5Idx = this.findSubPhaseP5(sanitizedFrames, p4Idx, p7Idx, p1Idx);
    const p6Idx = this.findSubPhaseP6(handTrajectory, sanitizedFrames, p5Idx, p7Idx, p1Idx);
    const p8Idx = this.findSubPhaseP8(handTrajectory, sanitizedFrames, p7Idx, p10Idx, p1Idx);
    const p9Idx = this.findSubPhaseP9(sanitizedFrames, p8Idx, p10Idx);

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

    // Strict Monotonicity Sanitizer: Guarantee p1 < p2 < p3 < p4 < p5 < p6 < p7 < p8 < p9 < p10
    const orderedKeys = ORDERED_SWING_PHASES;
    for (let k = 1; k < orderedKeys.length; k++) {
      const prevKey = orderedKeys[k - 1];
      const currKey = orderedKeys[k];
      if (prevKey && currKey && phaseIndices[currKey] <= phaseIndices[prevKey]) {
        phaseIndices[currKey] = Math.min(frames.length - (orderedKeys.length - k), phaseIndices[prevKey] + 1);
      }
    }
    for (let k = orderedKeys.length - 2; k >= 0; k--) {
      const nextKey = orderedKeys[k + 1];
      const currKey = orderedKeys[k];
      if (nextKey && currKey && phaseIndices[currKey] >= phaseIndices[nextKey]) {
        phaseIndices[currKey] = Math.max(0, phaseIndices[nextKey] - 1);
      }
    }

    // Build ordered events
    const phases: Record<SwingPhaseId, SwingPhaseEvent> = {} as any;
    const orderedEvents: SwingPhaseEvent[] = [];

    for (const phaseId of ORDERED_SWING_PHASES) {
      const idx = phaseIndices[phaseId];
      const targetFrame = frames[idx] || frames[0];
      if (!targetFrame) continue;
      const isAnchor = phaseId === 'P1_ADDRESS' || phaseId === 'P4_TOP' || phaseId === 'P7_IMPACT' || phaseId === 'P10_FINISH';
      const confidence = isFallback ? 0.35 : (isAnchor ? 0.95 : 0.90);
      const evt: SwingPhaseEvent = {
        phaseId,
        frameIndex: idx,
        timestampMs: targetFrame.timestampMs,
        confidence
      };
      phases[phaseId] = evt;
      orderedEvents.push(evt);
    }

    // 3. Extract Kinematics for all 10 phases
    const addressFrame = sanitizedFrames[phaseIndices.P1_ADDRESS] || sanitizedFrames[0]!;
    const kinematics: Record<SwingPhaseId, any> = {} as any;

    for (const phaseId of ORDERED_SWING_PHASES) {
      const targetFrame = sanitizedFrames[phaseIndices[phaseId]] || addressFrame;
      kinematics[phaseId] = extractPhaseKinematics(
        targetFrame,
        phaseId,
        addressFrame,
        this.viewAngle,
        this.isRightHanded
      );
    }

    // Auto-detect slow-motion if sequence is an exported slow-mo video (e.g. 30 fps container with stretched duration)
    let effectiveSlowMo = this.slowMotionFactor;
    const swingDurationSec = (phases.P10_FINISH.timestampMs - phases.P1_ADDRESS.timestampMs) / 1000;
    if (effectiveSlowMo <= 1.0 && swingDurationSec > 4.5) {
      if (swingDurationSec >= 9.0) {
        effectiveSlowMo = 8.0; // 240 fps slow-mo export (8x)
      } else {
        effectiveSlowMo = 4.0; // 120 fps slow-mo export (4x)
      }
    }

    // 4. Calculate Tempo (with effective slow-motion factor)
    const tempo = calculateSwingTempo(phases.P1_ADDRESS, phases.P4_TOP, phases.P7_IMPACT, effectiveSlowMo);

    // 5. Detect Biomechanical Faults
    const faults = detectSwingFaults(kinematics, this.viewAngle, this.isRightHanded);

    // 6. Overall Swing Score calculation (100 base minus deductions)
    let swingScore = 100;
    // GOOD tempo incurs no penalty; only erratic tempos (FAST/SLOW) incur deductions
    if (tempo.rating === 'FAST_BACKSWING' || tempo.rating === 'SLOW_BACKSWING') swingScore -= 10;
    for (const f of faults) {
      if (f.severity === 'HIGH') swingScore -= 12;
      else if (f.severity === 'MEDIUM') swingScore -= 7;
      else swingScore -= 3;
    }
    const overallSwingScore = Math.max(25, Math.min(100, Math.round(swingScore)));

    const firstF = frames[0];
    const lastF = frames[frames.length - 1];
    const durationMs = (lastF && firstF) ? lastF.timestampMs - firstF.timestampMs : 0;

    return {
      sessionId: `swing_${Date.now()}`,
      viewAngle: this.viewAngle,
      isRightHanded: this.isRightHanded,
      detectedFrameRate: frameRate,
      slowMotionFactor: effectiveSlowMo,
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
    const first = frames[0];
    const last = frames[frames.length - 1];
    if (frames.length < 2 || !first || !last) return 30;
    const totalDurationSec = (last.timestampMs - first.timestampMs) / 1000;
    if (totalDurationSec <= 0) return 240;
    const rawFps = (frames.length - 1) / totalDurationSec;

    // Snapping to common camera frame rates
    if (rawFps >= 200) return 240;
    if (rawFps >= 100) return 120;
    if (rawFps >= 50) return 60;
    return 30;
  }

  private computeRelativeTurn(
    frame: PoseFrame,
    addressFrame: PoseFrame,
    isRightHanded: boolean
  ): number {
    const ls = getLandmark(frame, LandmarkId.LEFT_SHOULDER);
    const rs = getLandmark(frame, LandmarkId.RIGHT_SHOULDER);
    const addrLS = getLandmark(addressFrame, LandmarkId.LEFT_SHOULDER);
    const addrRS = getLandmark(addressFrame, LandmarkId.RIGHT_SHOULDER);

    if (!ls || !rs || !addrLS || !addrRS) return 0;

    const addrDx = addrRS.x - addrLS.x;
    const addrDz = (addrRS.z ?? 0) - (addrLS.z ?? 0);
    const currDx = rs.x - ls.x;
    const currDz = (rs.z ?? 0) - (ls.z ?? 0);

    const addrAngle = Math.atan2(addrDz, addrDx);
    const currAngle = Math.atan2(currDz, currDx);

    let diff = currAngle - addrAngle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    let deg = (diff * 180) / Math.PI;

    // In standard MediaPipe Face-On view (golfer facing camera), right shoulder is at smaller X than left shoulder (addrDx < 0).
    // In camera coordinates, clockwise backswing rotation yields a negative diff,
    // so invert to ensure backswing is positive for right-handed golfers.
    if (addrDx < 0) {
      deg = -deg;
    }

    return isRightHanded ? deg : -deg;
  }

  private findAnchors(
    handTrajectory: { x: number; y: number; timestampMs: number }[],
    frames: PoseFrame[],
    viewAngle: CameraViewAngle,
    frameRate: number = 30
  ) {
    const totalFrames = frames.length;
    const f0 = frames[0];
    const la = f0 ? getLandmark(f0, LandmarkId.LEFT_ANKLE) : undefined;
    const ls0 = f0 ? getLandmark(f0, LandmarkId.LEFT_SHOULDER) : undefined;
    const yPointsDown = (la && ls0) ? la.y > ls0.y : true;

    const getElevation = (i: number) => {
      const pt = handTrajectory[i];
      if (!pt) return 0;
      return yPointsDown ? -pt.y : pt.y;
    };

    // 1. Compute overall elevation stats
    let minElev = Infinity, maxElev = -Infinity;
    for (let i = 0; i < totalFrames; i++) {
      const el = getElevation(i);
      if (el < minElev) minElev = el;
      if (el > maxElev) maxElev = el;
    }
    const elevSpan = maxElev - minElev;
    const highElevThreshold = minElev + elevSpan * 0.35;

    // 2. Identify candidate elevation peaks across the entire video
    // In any video (normal or slow-motion), P4 and P10 are high elevation points.
    const peakStep = Math.max(1, Math.round(frameRate * 0.04));
    const rawPeaks: number[] = [];
    for (let i = peakStep; i < totalFrames - peakStep; i++) {
      const el = getElevation(i);
      if (el >= highElevThreshold && el >= getElevation(i - peakStep) && el >= getElevation(i + peakStep)) {
        const lastPeak = rawPeaks[rawPeaks.length - 1];
        if (lastPeak === undefined || i - lastPeak >= peakStep * 2) {
          rawPeaks.push(i);
        } else if (el > getElevation(lastPeak)) {
          rawPeaks[rawPeaks.length - 1] = i;
        }
      }
    }

    const candidatePeaks = [...rawPeaks];
    const gridStep = Math.max(3, Math.round(totalFrames / 50));
    for (let i = Math.max(3, gridStep); i < totalFrames - 4; i += gridStep) {
      if (!candidatePeaks.includes(i) && getElevation(i) >= highElevThreshold) {
        candidatePeaks.push(i);
      }
    }
    candidatePeaks.sort((a, b) => a - b);

    // 3. Search for the authentic (P1, P4, P7, P10) swing structure under a handedness hypothesis
    const searchForHandedness = (forRightHanded: boolean, strictSpan = true) => {
      let bestScore = -Infinity;
      let finalP1 = 0, finalP4 = 0, finalP7 = 0, finalP10 = 0;

      for (let p4Candidate of candidatePeaks) {
        const p4Elev = getElevation(p4Candidate);
        const p4Frame = frames[p4Candidate];
        if (!p4Frame) continue;
        const lh = getLandmark(p4Frame, LandmarkId.LEFT_HIP);
        const rh = getLandmark(p4Frame, LandmarkId.RIGHT_HIP);
        const pelvisX = (lh && rh) ? (lh.x + rh.x) / 2 : 0.50;
        const p4Hand = handTrajectory[p4Candidate];
        if (!p4Hand) continue;
        const p4HandX = p4Hand.x;

        if (viewAngle === 'FACE_ON' && strictSpan) {
          // For righty: trail is +X (right of screen). Hands must be on trail side
          // For lefty: trail is -X (left of screen). Hands must be on trail side
          const isTrailSide = forRightHanded
            ? (p4HandX >= pelvisX - 0.08)
            : (p4HandX <= pelvisX + 0.08);
          if (!isTrailSide) continue;
        }

        // 1. Search backward from p4Candidate for the address valley (P1 plateau)
        // Descend backward from P4 to the address valley immediately preceding the backswing.
        // If elevation rises by more than 0.04 above the valley minimum walking backward,
        // we have crossed into a pre-swing waggle or routine; stop to keep the true swing address.
        let p1Elev = Infinity, lowestP1 = p4Candidate - 1;
        for (let m = p4Candidate - 1; m >= 0; m--) {
          const el = getElevation(m);
          if (el < p1Elev) {
            p1Elev = el;
            lowestP1 = m;
          } else if (el > p1Elev + 0.04 && (p4Candidate - m) > Math.max(8, Math.round(frameRate * 0.15))) {
            break;
          }
        }

        // In Face-On view: Refine P1 if lowest elevation point occurred during takeaway.
        // In takeaway (P2), hands shift laterally towards the trail hip.
        // At true Address (P1), hands are centered in front of the pelvis (|handX - pelvisX| <= 0.035).
        if (viewAngle === 'FACE_ON') {
          const p1Frame = frames[lowestP1];
          if (!p1Frame) continue;
          const p1LH = getLandmark(p1Frame, LandmarkId.LEFT_HIP);
          const p1RH = getLandmark(p1Frame, LandmarkId.RIGHT_HIP);
          const p1PelvisX = (p1LH && p1RH) ? (p1LH.x + p1RH.x) / 2 : 0.50;
          const p1Hand = handTrajectory[lowestP1];
          if (!p1Hand) continue;
          const p1HandX = p1Hand.x;

          const isLowestP1Trail = forRightHanded
            ? (p1HandX > p1PelvisX + 0.035)
            : (p1HandX < p1PelvisX - 0.035);

          if (isLowestP1Trail) {
            const searchEnd = Math.max(0, lowestP1 - Math.max(30, Math.round(frameRate * 3.5)));
            for (let m = lowestP1 - 1; m >= searchEnd; m--) {
              const frame = frames[m];
              if (!frame) continue;
              const lh = getLandmark(frame, LandmarkId.LEFT_HIP);
              const rh = getLandmark(frame, LandmarkId.RIGHT_HIP);
              const pelvisX = (lh && rh) ? (lh.x + rh.x) / 2 : 0.50;
              const handM = handTrajectory[m];
              if (!handM) continue;
              const handX = handM.x;

              const isCentered = forRightHanded
                ? (handX <= pelvisX + 0.02)
                : (handX >= pelvisX - 0.02);

              if (isCentered) {
                lowestP1 = m;
                p1Elev = getElevation(lowestP1);
                break;
              }
            }
          }
        }

        const addressFrame = frames[lowestP1];
        if (!addressFrame) continue;

        // 2. Refine P4 to the true apex of torso turn and hand elevation plateau
        let refinedP4 = p4Candidate;
        let p4MaxElev = p4Elev;
        let p4MaxTurn = -Infinity;
        const maxScanSec = this.slowMotionFactor > 1.0 ? 0.6 : 0.35;
        const maxApexScan = Math.min(frames.length - 10, p4Candidate + Math.max(4, Math.round(frameRate * maxScanSec)));

        for (let k = p4Candidate; k <= maxApexScan; k++) {
          const el = getElevation(k);
          // If hands drop significantly (> 0.05 below p4Elev), downswing descent has started
          if (el < p4Elev - 0.05) break;

          const kFrame = frames[k];
          if (!kFrame) continue;
          const turn = this.computeRelativeTurn(kFrame, addressFrame, forRightHanded);

          if (viewAngle === 'FACE_ON') {
            if (turn > p4MaxTurn) {
              p4MaxTurn = turn;
              refinedP4 = k;
              p4MaxElev = el;
            }
          } else {
            if (el > p4MaxElev) {
              p4MaxElev = el;
              refinedP4 = k;
            }
          }
        }

        const backswingRise = p4MaxElev - p1Elev;
        if (backswingRise < 0.06) continue;

        // Search for finish P10 after refinedP4
        for (let p10Candidate of candidatePeaks) {
          if (p10Candidate <= refinedP4 + 4) continue;
          const p10Elev = getElevation(p10Candidate);
          const p10Frame = frames[p10Candidate];
          if (!p10Frame) continue;
          const p10LH = getLandmark(p10Frame, LandmarkId.LEFT_HIP);
          const p10RH = getLandmark(p10Frame, LandmarkId.RIGHT_HIP);
          const p10PelvisX = (p10LH && p10RH) ? (p10LH.x + p10RH.x) / 2 : 0.50;
          const p10Hand = handTrajectory[p10Candidate];
          if (!p10Hand) continue;
          const p10HandX = p10Hand.x;

          if (viewAngle === 'FACE_ON' && strictSpan) {
            const isLeadSide = forRightHanded
              ? (p10HandX <= p10PelvisX + 0.08)
              : (p10HandX >= p10PelvisX - 0.08);
            if (!isLeadSide) continue;

            const p4Hand = handTrajectory[refinedP4];
            if (!p4Hand) continue;
            const lateralSpan = forRightHanded
              ? (p4Hand.x - p10HandX)
              : (p10HandX - p4Hand.x);
            if (lateralSpan < 0.08) continue;
          }

          // Compute backswing duration in milliseconds (independent of frame rate variations)
          const p4Frame = frames[refinedP4];
          const p1Frame = frames[lowestP1];
          if (!p4Frame || !p1Frame) continue;
          const p4TimeMs = p4Frame.timestampMs;
          const p1TimeMs = p1Frame.timestampMs;
          const backswingDurationMs = Math.max(100, p4TimeMs - p1TimeMs);

          // Downswing in golf is always faster than backswing: T_down <= 0.65 * T_back
          const maxDownswingMs = backswingDurationMs * 0.65;
          const minDownswingMs = Math.min(120, backswingDurationMs * 0.15);

          const addrHand = handTrajectory[lowestP1] || { x: p10PelvisX, y: 0.55 };
          const idealImpactX = forRightHanded ? (addrHand.x - 0.015) : (addrHand.x + 0.015);

          let p7Elev = Infinity;
          let lowestP7 = -1;

          for (let j = refinedP4 + 1; j < p10Candidate; j++) {
            const frame = frames[j];
            const handJ = handTrajectory[j];
            if (!frame || !handJ) continue;

            const frameTimeMs = frame.timestampMs;
            const dsMs = frameTimeMs - p4TimeMs;
            if (dsMs < minDownswingMs) continue;
            if (dsMs > maxDownswingMs) break;

            const lk = getLandmark(frame, LandmarkId.LEFT_KNEE);
            const rk = getLandmark(frame, LandmarkId.RIGHT_KNEE);
            const kneeY = (lk && rk) ? Math.max(lk.y, rk.y) : (lk ? lk.y : rk?.y);
            if (kneeY !== undefined && handJ.y > kneeY + 0.02) continue;

            const handYDiff = Math.abs(handJ.y - addrHand.y);
            if (handYDiff > 0.22) continue;

            // Biomechanical Impact Rotation Guard:
            // Shoulders must be square or open towards target (-42° to +20°).
            // A frame with -55° or -75° is follow-through P8/P9 and can NEVER be chosen as Impact!
            if (viewAngle === 'FACE_ON') {
              const relTurn = this.computeRelativeTurn(frame, addressFrame, forRightHanded);
              if (relTurn < -42 || relTurn > 20) continue;
            }

            const el = getElevation(j);
            if (el < p7Elev) {
              p7Elev = el;
              lowestP7 = j;
            }
          }

          if (lowestP7 === -1) {
            // No candidate met strict biomechanical impact rotation and time limits
            continue;
          }

          // Lateral Address-Crossing refinement for FACE_ON view
          const bottomHand = handTrajectory[lowestP7];
          if (viewAngle === 'FACE_ON' && bottomHand) {
            const bottomFrame = frames[lowestP7];
            if (!bottomFrame) continue;
            const bottomLH = getLandmark(bottomFrame, LandmarkId.LEFT_HIP);
            const bottomRH = getLandmark(bottomFrame, LandmarkId.RIGHT_HIP);
            const pelvisMidX = (bottomLH && bottomRH) ? (bottomLH.x + bottomRH.x) / 2 : 0.50;

            const isStillTrailSide = forRightHanded
              ? (bottomHand.x > addrHand.x + 0.015 || bottomHand.x > pelvisMidX + 0.015)
              : (bottomHand.x < addrHand.x - 0.015 || bottomHand.x < pelvisMidX - 0.015);

            if (isStillTrailSide) {
              let bestCrossingScore = Infinity;
              let bestCrossingIdx = lowestP7;
              const maxSearchIdx = Math.min(
                p10Candidate - 1,
                lowestP7 + Math.max(8, Math.round((p10Candidate - lowestP7) * 0.40))
              );

              for (let j = lowestP7; j <= maxSearchIdx; j++) {
                const hand = handTrajectory[j];
                const frame = frames[j];
                if (!hand || !frame) continue;

                const dsMs = frame.timestampMs - p4TimeMs;
                if (dsMs > maxDownswingMs) break;

                const lk = getLandmark(frame, LandmarkId.LEFT_KNEE);
                const rk = getLandmark(frame, LandmarkId.RIGHT_KNEE);
                const kneeY = (lk && rk) ? Math.max(lk.y, rk.y) : (lk ? lk.y : rk?.y);
                if (kneeY !== undefined && hand.y > kneeY + 0.02) continue;

                const dy = Math.abs(hand.y - addrHand.y);
                if (dy > 0.20) continue;

                if (viewAngle === 'FACE_ON') {
                  const relTurn = this.computeRelativeTurn(frame, addressFrame, forRightHanded);
                  if (relTurn < -42 || relTurn > 20) continue;
                }

                const dx = Math.abs(hand.x - idealImpactX);
                const candidateScore = dx + dy * 0.35;

                if (candidateScore < bestCrossingScore) {
                  bestCrossingScore = candidateScore;
                  bestCrossingIdx = j;
                }

                const passedLeadSide = forRightHanded
                  ? (hand.x < idealImpactX - 0.035)
                  : (hand.x > idealImpactX + 0.035);
                if (passedLeadSide && j > lowestP7 + 1) {
                  break;
                }
              }

              lowestP7 = bestCrossingIdx;
            }
          }

          p7Elev = getElevation(lowestP7);
          const downswingDrop = p4MaxElev - p7Elev;
          const finishRise = p10Elev - p7Elev;
          if (downswingDrop < 0.05 || finishRise < 0.05) continue;

          const lowestP7Frame = frames[lowestP7];
          if (!lowestP7Frame) continue;
          const downswingDurationMs = Math.max(1, lowestP7Frame.timestampMs - p4TimeMs);
          const tempoRatio = backswingDurationMs / downswingDurationMs;
          if (tempoRatio < 1.4) continue; // Biomechanically impossible swing tempo

          const tempoBonus = (tempoRatio >= 2.4 && tempoRatio <= 3.6) ? 1.0 : 0;
          const score = backswingRise * 1.5 + downswingDrop * 2.5 + finishRise * 1.5 + tempoBonus;

          if (score > bestScore) {
            bestScore = score;
            finalP1 = lowestP1;
            finalP4 = refinedP4;
            finalP7 = lowestP7;
            finalP10 = p10Candidate;
          }
        }
      }

      return { score: bestScore, p1Idx: finalP1, p4Idx: finalP4, p7Idx: finalP7, p10Idx: finalP10 };
    };

    // 4. Run search with auto-handedness detection (if enabled)
    let result = searchForHandedness(this.isRightHanded, true);

    // If designated handedness found nothing, check if the video is the opposite handedness (e.g. leftie)
    if (result.score === -Infinity && this.autoDetectHandedness) {
      const altResult = searchForHandedness(!this.isRightHanded, true);
      if (altResult.score > -Infinity) {
        result = altResult;
        this.isRightHanded = !this.isRightHanded; // Auto-correct handedness to match video!
      }
    }

    // Relaxed search if strict lateral span was too tight (e.g. DTL or angled camera)
    if (result.score === -Infinity) {
      result = searchForHandedness(this.isRightHanded, false);
    }
    if (result.score === -Infinity && this.autoDetectHandedness) {
      const altResult = searchForHandedness(!this.isRightHanded, false);
      if (altResult.score > -Infinity) {
        result = altResult;
        this.isRightHanded = !this.isRightHanded;
      }
    }

    // Final safety fallback if no swing pattern could be found
    if (result.score === -Infinity) {
      console.warn("Sequential decoder failed to find a golf swing, using proportional fallback");
      return { 
        p1Idx: 0, 
        p4Idx: Math.floor(totalFrames * 0.35), 
        p7Idx: Math.floor(totalFrames * 0.50), 
        p10Idx: Math.min(totalFrames - 1, Math.floor(totalFrames * 0.75)),
        isFallback: true
      };
    }

    // 5. P1 is the last resting frame of address before takeaway (found by backward search)
    const p1Refined = result.p1Idx;

    // 6. Refine P10: Find frame near finish apex where arm landmarks are clearly visible (visibility >= 0.35)
    let p10Refined = result.p10Idx;
    let bestP10Vis = 0;
    const minK = Math.max(result.p7Idx + 2, result.p10Idx - 15);
    const maxK = Math.min(totalFrames - 1, result.p10Idx + 15);

    // Scan bidirectional window around P10 candidate peak
    for (let k = result.p10Idx; k <= maxK; k++) {
      const frame = frames[k];
      if (!frame) continue;
      const lw = getLandmark(frame, LandmarkId.LEFT_WRIST);
      const rw = getLandmark(frame, LandmarkId.RIGHT_WRIST);
      const le = getLandmark(frame, LandmarkId.LEFT_ELBOW);
      const re = getLandmark(frame, LandmarkId.RIGHT_ELBOW);
      if (lw && rw && le && re) {
        const minVis = Math.min(lw.visibility ?? 1, rw.visibility ?? 1, le.visibility ?? 1, re.visibility ?? 1);
        if (minVis > bestP10Vis) {
          bestP10Vis = minVis;
          p10Refined = k;
          if (minVis >= 0.35) break;
        }
      }
    }
    if (bestP10Vis < 0.35) {
      for (let k = result.p10Idx - 1; k >= minK; k--) {
        const frame = frames[k];
        if (!frame) continue;
        const lw = getLandmark(frame, LandmarkId.LEFT_WRIST);
        const rw = getLandmark(frame, LandmarkId.RIGHT_WRIST);
        const le = getLandmark(frame, LandmarkId.LEFT_ELBOW);
        const re = getLandmark(frame, LandmarkId.RIGHT_ELBOW);
        if (lw && rw && le && re) {
          const minVis = Math.min(lw.visibility ?? 1, rw.visibility ?? 1, le.visibility ?? 1, re.visibility ?? 1);
          if (minVis > bestP10Vis) {
            bestP10Vis = minVis;
            p10Refined = k;
            if (minVis >= 0.35) break;
          }
        }
      }
    }

    return { 
      p1Idx: p1Refined, 
      p4Idx: result.p4Idx, 
      p7Idx: result.p7Idx, 
      p10Idx: p10Refined,
      isFallback: false
    };
  }

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

    const addrFrame = frames[p1Idx] || frames[0];
    if (!addrFrame) return minIdx;

    let bestIdx = minIdx;
    let minDiff = Infinity;

    for (let i = minIdx; i <= maxIdx; i++) {
      const frame = frames[i];
      const handI = handTrajectory[i];
      if (!frame || !handI) continue;

      const lh = getLandmark(frame, LandmarkId.LEFT_HIP);
      const rh = getLandmark(frame, LandmarkId.RIGHT_HIP);

      const hipY = (lh && rh) ? (lh.y + rh.y) / 2 : 0.50;
      const turn = this.computeRelativeTurn(frame, addrFrame, this.isRightHanded);

      // In Takeaway (P2), hands must have moved laterally towards trail hip
      const addrHandX = handTrajectory[p1Idx]?.x ?? 0.50;
      if (this.viewAngle === 'FACE_ON' && (maxIdx - minIdx) > 5) {
        const lateralMoved = this.isRightHanded
          ? (handI.x - addrHandX)
          : (addrHandX - handI.x);
        const pelvisWidth = (rh && lh) ? Math.abs(rh.x - lh.x) : 0.15;
        const minMove = Math.max(0.015, pelvisWidth * 0.10);
        if (lateralMoved < minMove) continue;
      }

      // Distance from hands to hip elevation
      const handDistToHip = Math.abs(handI.y - hipY);
      // Turn proximity to classic takeaway (28° per PGA Tour data)
      const turnPenalty = Math.abs(turn - 28) / 45;

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
      if (!frame) continue;
      const leadShoulder = getLandmark(frame, this.isRightHanded ? LandmarkId.LEFT_SHOULDER : LandmarkId.RIGHT_SHOULDER);
      const leadWrist = getLandmark(frame, this.isRightHanded ? LandmarkId.LEFT_WRIST : LandmarkId.RIGHT_WRIST);

      if (leadShoulder && leadWrist) {
        // Arm slope vs horizontal: when lead arm is horizontal, dy is minimal
        const dy = Math.abs(leadWrist.y - leadShoulder.y);

        // Directional validation in Face-On: lead arm/wrist must be oriented towards trail side in backswing
        let directionalPenalty = 0;
        if (this.viewAngle === 'FACE_ON') {
          const lh = getLandmark(frame, LandmarkId.LEFT_HIP);
          const rh = getLandmark(frame, LandmarkId.RIGHT_HIP);
          const pelvisMidX = (lh && rh) ? (lh.x + rh.x) / 2 : 0.50;
          const isTrailSide = this.isRightHanded
            ? (leadWrist.x > pelvisMidX - 0.04)
            : (leadWrist.x < pelvisMidX + 0.04);
          if (!isTrailSide) directionalPenalty = 0.20;
        }

        const score = dy + directionalPenalty;
        if (score < minArmSlope) {
          minArmSlope = score;
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
    p7Idx: number,
    p1Idx: number
  ): number {
    const minIdx = p4Idx + 1;
    const maxIdx = p7Idx - 2;
    if (minIdx >= maxIdx) return Math.min(frames.length - 1, p4Idx + 1);

    const addrFrame = frames[p1Idx] || frames[0];
    const p4Frame = frames[p4Idx];
    if (!addrFrame || !p4Frame) return minIdx;
    const p4Turn = this.computeRelativeTurn(p4Frame, addrFrame, this.isRightHanded);

    let bestIdx = minIdx;
    let minScore = Infinity;

    for (let i = minIdx; i <= maxIdx; i++) {
      const frame = frames[i];
      if (!frame) continue;
      const leadShoulder = getLandmark(frame, this.isRightHanded ? LandmarkId.LEFT_SHOULDER : LandmarkId.RIGHT_SHOULDER);
      const leadWrist = getLandmark(frame, this.isRightHanded ? LandmarkId.LEFT_WRIST : LandmarkId.RIGHT_WRIST);

      const currTurn = this.computeRelativeTurn(frame, addrFrame, this.isRightHanded);
      
      // Shoulder turn should have uncoiled from P4 (not still stuck at the top in Face-On)
      if (this.viewAngle === 'FACE_ON') {
        const requiredUnwound = Math.min(8, Math.max(3, (maxIdx - minIdx) * 0.35));
        const turnUnwound = p4Turn - currTurn;
        if (turnUnwound < requiredUnwound && (maxIdx - minIdx) > 2) {
          continue;
        }
      }

      if (leadShoulder && leadWrist) {
        const dy = Math.abs(leadWrist.y - leadShoulder.y);
        // Turn proximity to classic downswing shallowing (~55° per PGA Tour data) in Face-On
        const turnPenalty = this.viewAngle === 'FACE_ON' ? Math.abs(currTurn - 55) / 50 : 0;
        const score = dy + turnPenalty * 0.15;
        if (score < minScore) {
          minScore = score;
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
    p7Idx: number,
    p1Idx: number
  ): number {
    const minIdx = p5Idx + 1;
    const maxIdx = p7Idx - 1;
    if (minIdx >= maxIdx) return Math.min(p7Idx - 1, Math.max(minIdx, p5Idx + 1));

    const addrFrame = frames[p1Idx] || frames[0];
    if (!addrFrame) return minIdx;

    let bestIdx = minIdx;
    let minDiff = Infinity;

    for (let i = minIdx; i <= maxIdx; i++) {
      const frame = frames[i];
      const handI = handTrajectory[i];
      if (!frame || !handI) continue;

      const trailHip = getLandmark(frame, this.isRightHanded ? LandmarkId.RIGHT_HIP : LandmarkId.LEFT_HIP);
      const trailKnee = getLandmark(frame, this.isRightHanded ? LandmarkId.RIGHT_KNEE : LandmarkId.LEFT_KNEE);

      const thighTargetY = (trailHip && trailKnee)
        ? trailHip.y + (trailKnee.y - trailHip.y) * 0.15
        : 0.50;

      const trailHipX = trailHip ? trailHip.x : 0.50;
      const diffX = Math.abs(handI.x - trailHipX);
      const turn = this.computeRelativeTurn(frame, addrFrame, this.isRightHanded);

      // Delivery (P6) is in the downswing near trail thigh.
      // Torso has unwound towards square. A frame with turn > 30° is still in backswing/early transition!
      if (this.viewAngle === 'FACE_ON' && (maxIdx - minIdx) > 2) {
        if (turn > 30 || turn < -15) continue;
      }

      // Turn proximity to classic delivery position (~20° per PGA Tour data)
      const turnPenalty = this.viewAngle === 'FACE_ON' ? Math.abs(turn - 20) / 35 : 0;

      const diff = Math.abs(handI.y - thighTargetY) + diffX * 0.35 + turnPenalty * 0.20;
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
    p10Idx: number,
    p1Idx: number
  ): number {
    const minIdx = p7Idx + 1;
    const maxIdx = p10Idx - 2;
    if (minIdx >= maxIdx) return Math.min(p10Idx - 2, Math.max(minIdx, p7Idx + 1));

    const addrFrame = frames[p1Idx] || frames[0];
    if (!addrFrame) return minIdx;

    let bestIdx = minIdx;
    let minDiff = Infinity;

    for (let i = minIdx; i <= maxIdx; i++) {
      const frame = frames[i];
      const handI = handTrajectory[i];
      if (!frame || !handI) continue;

      const leadHip = getLandmark(frame, this.isRightHanded ? LandmarkId.LEFT_HIP : LandmarkId.RIGHT_HIP);
      const leadKnee = getLandmark(frame, this.isRightHanded ? LandmarkId.LEFT_KNEE : LandmarkId.RIGHT_KNEE);

      const targetY = (leadHip && leadKnee)
        ? leadHip.y + (leadKnee.y - leadHip.y) * 0.15
        : 0.52;

      const diffY = Math.abs(handI.y - targetY);
      const turn = this.computeRelativeTurn(frame, addrFrame, this.isRightHanded);
      const turnPenalty = this.viewAngle === 'FACE_ON' ? Math.abs(turn - (-55)) / 60 : 0;

      const diff = diffY + turnPenalty * 0.20;
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
    if (minIdx >= maxIdx) return Math.min(p10Idx - 1, Math.max(minIdx, p8Idx + 1));

    let bestIdx = minIdx;
    let minArmSlope = Infinity;

    for (let i = minIdx; i <= maxIdx; i++) {
      const frame = frames[i];
      if (!frame) continue;
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
