import {
  ScreeningDiagnosticsRecorder,
  formatDiagnosticsForSharing,
  MAX_DIAGNOSTIC_ERRORS,
  MAX_FRAME_SOURCES,
} from "../../../src/core/diagnostics/screening-diagnostics";
import { LiveScreeningSession } from "../../../src/core/analysis/live-screening-session";
import { LandmarkId } from "../../../src/core/types/landmark";
import type { PoseFrame } from "../../../src/core/types/pose-frame";
import { hingeSession } from "../../customer-readiness/fixtures";

const device = { os: "android", osVersion: "35" };
const now = new Date("2026-10-06T08:00:00Z");

function frame(t: number, visibility = 0.9): PoseFrame {
  return {
    frameId: t,
    timestampMs: t,
    width: 480,
    height: 640,
    model: "TEST",
    modelVersion: "1",
    landmarks: Array.from({ length: 33 }, (_, i) => ({
      id: i as LandmarkId,
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility,
      presence: visibility,
    })),
  };
}

describe("ScreeningDiagnosticsRecorder", () => {
  it("summarises frame throughput and key landmark confidence", () => {
    const r = new ScreeningDiagnosticsRecorder("HIP_HINGE");
    r.setCameraPosition("back");
    for (let i = 0; i <= 30; i++) r.recordPoseFrame(frame(i * 100, 0.8));
    const d = r.build({
      isSimulated: false,
      device,
      processorStats: null,
      now,
    });

    expect(d.createdAt).toBe("2026-10-06T08:00:00.000Z");
    expect(d.camera.position).toBe("back");
    expect(d.poseFrames).toEqual({
      count: 31,
      durationMs: 3000,
      fps: 10,
      byStage: { CAPTURE: { count: 31, durationMs: 3000, fps: 10 } },
      landmarksPerFrame: 33,
      keyLandmarkConfidence: 0.8,
    });
  });

  it("excludes the camera-off pause between stages from duration and fps", () => {
    const r = new ScreeningDiagnosticsRecorder("FULL_BATTERY");
    // Hinge: 0–3 s at 10 fps; 60 s transition with no frames; rotation: 63–65 s at 20 fps.
    for (let i = 0; i <= 30; i++) r.recordPoseFrame(frame(i * 100), "HINGE");
    for (let i = 0; i <= 40; i++)
      r.recordPoseFrame(frame(63000 + i * 50), "ROTATION");
    const d = r.build({
      isSimulated: false,
      device,
      processorStats: null,
      now,
    });

    expect(d.poseFrames.byStage).toEqual({
      HINGE: { count: 31, durationMs: 3000, fps: 10 },
      ROTATION: { count: 41, durationMs: 2000, fps: 20 },
    });
    expect(d.poseFrames.count).toBe(72);
    expect(d.poseFrames.durationMs).toBe(5000);
    expect(d.poseFrames.fps).toBe(14); // 70 intervals / 5 s, not 71 / 65 s
  });

  it("reports nulls instead of invented values when no frame arrived", () => {
    const d = new ScreeningDiagnosticsRecorder("HIP_HINGE").build({
      isSimulated: true,
      device,
      processorStats: null,
      now,
    });
    expect(d.poseFrames).toEqual({
      count: 0,
      durationMs: 0,
      fps: null,
      byStage: {},
      landmarksPerFrame: null,
      keyLandmarkConfidence: null,
    });
    expect(d.hinge).toBeNull();
    expect(d.rotation).toBeNull();
    expect(d.isSimulated).toBe(true);
  });

  it("records pose model state, camera sources and processor stats", () => {
    const r = new ScreeningDiagnosticsRecorder("FULL_BATTERY");
    r.setPoseModelReady({
      model: "MEDIAPIPE_POSE",
      version: "1",
      variant: "FULL",
      sha256: "abc",
    });
    const info = {
      pixelFormat: "rgb",
      orientation: "up",
      isMirrored: true,
      sourceWidth: 960,
      sourceHeight: 720,
      outputWidth: 360,
      outputHeight: 480,
    };
    r.setCameraPosition("front");
    r.recordFrameSource(info);
    // User flips to the back camera mid-test: the new source is tagged "back".
    r.setCameraPosition("back");
    r.recordFrameSource({ ...info, isMirrored: false });
    const stats = {
      received: 100,
      droppedBusy: 40,
      noPerson: 5,
      errors: 1,
      emitted: 54,
    };
    const d = r.build({
      isSimulated: false,
      device,
      processorStats: stats,
      now,
    });

    expect(d.poseModel).toMatchObject({
      ready: true,
      model: "MEDIAPIPE_POSE",
      sha256: "abc",
      initError: null,
    });
    expect(d.camera.position).toBe("back");
    expect(
      d.camera.frameSources.map((f) => [f.cameraPosition, f.isMirrored]),
    ).toEqual([
      ["front", true],
      ["back", false],
    ]);
    expect(d.processor).toEqual(stats);
  });

  it("caps the number of recorded camera sources", () => {
    const r = new ScreeningDiagnosticsRecorder("HIP_HINGE");
    const info = {
      pixelFormat: "rgb",
      orientation: "up",
      isMirrored: false,
      sourceWidth: 960,
      sourceHeight: 720,
      outputWidth: 360,
      outputHeight: 480,
    };
    for (let i = 0; i < MAX_FRAME_SOURCES + 3; i++)
      r.recordFrameSource({ ...info, sourceWidth: 100 + i });
    const d = r.build({
      isSimulated: false,
      device,
      processorStats: null,
      now,
    });
    expect(d.camera.frameSources).toHaveLength(MAX_FRAME_SOURCES);
  });

  it("keeps model init failures and caps the error list", () => {
    const r = new ScreeningDiagnosticsRecorder("HIP_HINGE");
    r.setPoseModelFailed(new Error("model asset missing"));
    for (let i = 0; i < MAX_DIAGNOSTIC_ERRORS + 5; i++)
      r.recordError("pose detection", `fail ${i}`);
    const d = r.build({
      isSimulated: false,
      device,
      processorStats: null,
      now,
    });

    expect(d.poseModel.ready).toBe(false);
    expect(d.poseModel.initError).toBe("Error: model asset missing");
    expect(d.errors).toHaveLength(MAX_DIAGNOSTIC_ERRORS + 1);
    expect(d.errors[0]).toBe("pose detection: fail 0");
    expect(d.errors[MAX_DIAGNOSTIC_ERRORS]).toContain("5 more");
  });

  it("formats a shareable text that round-trips as JSON", () => {
    const d = new ScreeningDiagnosticsRecorder("HIP_HINGE").build({
      isSimulated: false,
      device,
      processorStats: null,
      now,
    });
    const text = formatDiagnosticsForSharing(d);
    expect(text.startsWith("Golf Body OS – testlogg (HIP_HINGE")).toBe(true);
    expect(JSON.parse(text.slice(text.indexOf("{")))).toEqual(d);
  });
});

describe("LiveScreeningSession.lastHingeAnalysis", () => {
  it("explains a successful hinge analysis", () => {
    const session = new LiveScreeningSession();
    hingeSession(100).forEach((f) => session.addHingeFrame(f));
    const measured = session.finalizeHinge();
    const a = session.lastHingeAnalysis!;

    expect(measured).not.toBeNull();
    expect(a.status).toBe("SUCCESS");
    expect(a.failureCode).toBeNull();
    expect(a.frameCount).toBe(session.hingeFrameCount);
    expect(a.repetitionsFound).toBe(3);
    expect(a.estimatedFps).toBe(30);
    expect(a.confidence).toBeGreaterThan(0.5);
  });

  it("explains why a too-short recording produced no measurement", () => {
    const session = new LiveScreeningSession();
    hingeSession(100)
      .slice(0, 20)
      .forEach((f) => session.addHingeFrame(f));
    expect(session.finalizeHinge()).toBeNull();
    expect(session.lastHingeAnalysis).toMatchObject({
      status: "FAILED",
      failureCode: "INSUFFICIENT_FRAMES",
      frameCount: 20,
    });
  });

  it("is cleared by reset", () => {
    const session = new LiveScreeningSession();
    hingeSession(100).forEach((f) => session.addHingeFrame(f));
    session.finalizeHinge();
    session.reset();
    expect(session.lastHingeAnalysis).toBeNull();
  });
});
