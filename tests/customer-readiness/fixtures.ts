/**
 * Shared synthetic fixtures for the customer readiness acceptance tests:
 * image-space hip hinge frames from a PORTRAIT phone video, a device
 * validation report and a stored screening session.
 */

import type { PoseFrame } from "../../src/core/types/pose-frame";
import { Landmark, LandmarkId } from "../../src/core/types/landmark";
import type { DeviceValidationReport } from "../../src/validation/device-validation-report";
import type { StoredScreeningSession } from "../../src/storage/screening-repository";

const W = 1080;
const H = 1920;
const FPS = 30;
const rad = (d: number) => (d * Math.PI) / 180;

/**
 * Side view, golfer facing −x (left side toward camera). Pixel geometry:
 * thigh and shank fixed with a 160° knee; trunk hinges forward so that the
 * shoulder→hip→knee angle equals `hingeDeg`. Image y points down.
 */
export function framePx(hingeDeg: number, t: number, id: number): PoseFrame {
  const knee = { x: 540, y: 1400 };
  const hip = {
    x: knee.x + 450 * Math.sin(rad(10)),
    y: knee.y - 450 * Math.cos(rad(10)),
  }; // thigh 10° off vertical
  const ankle = {
    x: knee.x + 420 * Math.sin(rad(10)),
    y: knee.y + 420 * Math.cos(rad(10)),
  }; // shank 10° → knee 160°
  // thigh direction from hip to knee, rotate by hingeDeg (toward −x) to get the trunk direction
  const thighDir = Math.atan2(knee.y - hip.y, knee.x - hip.x);
  const trunkDir = thighDir + rad(hingeDeg); // screen coords: rotating clockwise leans toward −x
  const shoulder = {
    x: hip.x + 520 * Math.cos(trunkDir),
    y: hip.y + 520 * Math.sin(trunkDir),
  };
  const ear = {
    x: hip.x + 680 * Math.cos(trunkDir),
    y: hip.y + 680 * Math.sin(trunkDir),
  };
  const heel = { x: ankle.x + 40, y: ankle.y + 20 };

  const place: Partial<Record<LandmarkId, { x: number; y: number }>> = {
    [LandmarkId.LEFT_EAR]: ear,
    [LandmarkId.RIGHT_EAR]: ear,
    [LandmarkId.LEFT_SHOULDER]: shoulder,
    [LandmarkId.RIGHT_SHOULDER]: shoulder,
    [LandmarkId.LEFT_HIP]: hip,
    [LandmarkId.RIGHT_HIP]: hip,
    [LandmarkId.LEFT_KNEE]: knee,
    [LandmarkId.RIGHT_KNEE]: knee,
    [LandmarkId.LEFT_ANKLE]: ankle,
    [LandmarkId.RIGHT_ANKLE]: ankle,
    [LandmarkId.LEFT_HEEL]: heel,
    [LandmarkId.RIGHT_HEEL]: heel,
  };
  const landmarks: Landmark[] = Array.from({ length: 33 }, (_, i) => {
    const p = place[i as LandmarkId] ?? hip;
    return {
      id: i as LandmarkId,
      x: p.x / W,
      y: p.y / H,
      z: 0,
      visibility: 0.95,
      presence: 0.95,
    };
  });
  return {
    frameId: id,
    timestampMs: t,
    width: W,
    height: H,
    landmarks,
    model: "TEST",
    modelVersion: "1",
  };
}

/** 3 reps: stand → hinge to `bottomDeg` → hold → stand. */
export function hingeSession(bottomDeg: number): PoseFrame[] {
  const frames: PoseFrame[] = [];
  const phase = (deg0: number, deg1: number, sec: number) => {
    const n = Math.round(sec * FPS);
    for (let i = 0; i < n; i++) {
      const p = i / n;
      const deg = deg0 + (deg1 - deg0) * (0.5 - 0.5 * Math.cos(Math.PI * p));
      frames.push(framePx(deg, (frames.length * 1000) / FPS, frames.length));
    }
  };
  phase(178, 178, 1.0);
  for (let r = 0; r < 3; r++) {
    phase(178, bottomDeg, 1.2);
    phase(bottomDeg, bottomDeg, 0.8);
    phase(bottomDeg, 178, 1.2);
    phase(178, 178, 0.8);
  }
  return frames;
}

export function report(
  status: DeviceValidationReport["status"] = "SUCCESS",
): DeviceValidationReport {
  return {
    status,
    device: { model: "SYNTHETIC", osVersion: "test" },
    model: {
      variant: "FULL",
      runtimeVersion: "test",
      assetVersion: "test",
      sha256: "test",
    },
    capture: {
      resolution: "1080x1920",
      cameraFps: 30,
      processedFps: 30,
      durationMs: 13000,
      rawFrameCount: 390,
      processedFrameCount: 390,
      droppedFrameCount: 0,
      sourceDecodedFrameCount: 390,
      poseInferenceFrameCount: 390,
      presentedFrameCallbacks: 390,
      missedPresentedFrames: 0,
      duplicateMediaTimestamps: 0,
    },
    inference: {
      meanLatencyMs: null,
      p50LatencyMs: null,
      p95LatencyMs: null,
      maxLatencyMs: null,
    },
    landmarks: {
      expectedPerPose: 33,
      validPoseFrameCount: 390,
      rejectedPoseFrameCount: 0,
      interpolatedGapCount: 0,
    },
    measurement: {
      detectedRepCount: 3,
      validRepCount: 3,
      metrics: [
        {
          id: "HIP_HINGE_ANGLE_2D",
          value: 100,
          unit: "degrees",
          confidence: 0.9,
        },
        {
          id: "KNEE_ANGLE_AT_ENDPOINT",
          value: 160,
          unit: "degrees",
          confidence: 0.9,
        },
      ],
      compensations: [],
      confidence: 0.9,
      qualityFlags: [],
    },
    failureCodes: [],
    trace: {} as any,
  };
}
export function stored(id = "s1", score = 65): StoredScreeningSession {
  return {
    id,
    timestampMs: 1000,
    testType: "HIP_HINGE",
    golfBodyScore: score,
    tier: "MODERATE",
    tierLabel: "Test",
    tierColor: "#fff",
    subScores: { hipHinge: 32, thoracicRotation: 0 },
    angles: { hipHingeFlexionDeg: 100 },
    compensations: [],
    primaryBottlenecks: [],
    predictedSwingFaults: [],
    prescribedExercises: [],
  };
}
