/** Acceptance tests: failures are unresolved product defects, not expected successes. */
import { LiveScreeningSession } from "../../src/core/analysis/live-screening-session";
import { TemporalPipeline } from "../../src/core/motion/temporal-pipeline";
import { calculateGolfBodyScore } from "../../src/core/metrics/golf-body-score";
import { calculateFrontalTilt } from "../../src/core/metrics/thoracic-rotation-metrics";
import { LiveRotationCoachingEngine } from "../../src/core/coaching/live-rotation-coaching-engine";
import { ConfidenceEngine } from "../../src/core/confidence/confidence-engine";
import { LandmarkId } from "../../src/core/types/landmark";
import { hingeSession, framePx, report } from "./fixtures";

afterEach(() => jest.restoreAllMocks());

test.each(["FAILED", "ABSTAINED"] as const)(
  "M01 %s pipeline output must not become a live measurement",
  (status) => {
    jest.spyOn(TemporalPipeline.prototype, "process").mockReturnValue({
      status,
      repetitions: [
        {
          hipHingeAngle2D: { value: 100 },
          kneeAngleAtEndpoint: { value: 160 },
          compensations: [],
        },
      ],
      confidence: { overall: 0.1, isAbstained: true },
    } as any);
    const session = new LiveScreeningSession();
    session.addHingeFrame(framePx(100, 0, 0));
    expect(session.finalizeHinge()).toBeNull();
  },
);
test.each(["FAILED", "ABSTAINED"] as const)(
  "M02 %s report must not produce a measured pillar",
  (status) => {
    expect(calculateGolfBodyScore(report(status), null).hipHinge.measured).toBe(
      false,
    );
  },
);
test.each([
  [0.3, 0.7],
  [0.7, 0.3],
])("M03 horizontal shoulders have zero tilt for x=%s/%s", (left, right) => {
  expect(
    Math.abs(calculateFrontalTilt({ x: left, y: 0.4 }, { x: right, y: 0.4 })),
  ).toBeCloseTo(0);
});
test("M04 rotation excludes landmarks with low visibility and presence", () => {
  const engine = new LiveRotationCoachingEngine({ speak: jest.fn() } as any);
  const frame = framePx(100, 0, 0);
  frame.landmarks = frame.landmarks.map((l) => ({
    ...l,
    visibility: 0.01,
    presence: 0.01,
  }));
  engine.processFrame(frame);
  expect(engine.getSamples()).toHaveLength(0);
});
test("M05 NaN confidence input must abstain", () => {
  const result = new ConfidenceEngine().calculate({
    landmarkVisibility: NaN,
    landmarkPresence: 1,
    cameraStability: 1,
    frameCoverage: 1,
    movementStability: 1,
    protocolCompliance: 1,
    endpointQuality: 1,
    repetitionConsistency: 1,
  });
  expect(result.isAbstained).toBe(true);
  expect(Number.isFinite(result.overall)).toBe(true);
});
test("M06 a real valid synthetic movement reaches scoring with measured angles", () => {
  const session = new LiveScreeningSession();
  hingeSession(100).forEach((f) => session.addHingeFrame(f));
  const m = session.finalizeHinge()!;
  expect(m.repCount).toBe(3);
  const r = report();
  r.measurement.metrics[0]!.value = m.hingeAngle;
  r.measurement.metrics[1]!.value = m.kneeAngle;
  const score = calculateGolfBodyScore(r, null);
  expect(score.hipHinge.measured).toBe(true);
  expect(score.hipHinge.avgHingeAngle).toBeCloseTo(100, 0);
  expect(score.thoracic.measured).toBe(false);
});
test("M07 all invisible hinge frames produce no measurement", () => {
  const session = new LiveScreeningSession();
  hingeSession(100).forEach((f) =>
    session.addHingeFrame({
      ...f,
      landmarks: f.landmarks.map((l) => ({ ...l, visibility: 0, presence: 0 })),
    }),
  );
  expect(session.finalizeHinge()).toBeNull();
});
test("M08 reset removes previous measurement data", () => {
  const session = new LiveScreeningSession();
  hingeSession(100).forEach((f) => session.addHingeFrame(f));
  session.reset();
  expect(session.hingeFrameCount).toBe(0);
  expect(session.finalizeHinge()).toBeNull();
});
test("M09 missing required ankles must not yield a successful hinge analysis", () => {
  const session = new LiveScreeningSession();
  hingeSession(100).forEach((f) =>
    session.addHingeFrame({
      ...f,
      landmarks: f.landmarks.filter(
        (l) =>
          l.id !== LandmarkId.LEFT_ANKLE && l.id !== LandmarkId.RIGHT_ANKLE,
      ),
    }),
  );
  expect(session.finalizeHinge()).toBeNull();
});

test("M10 confidence must reflect substantially inconsistent repetition depths", () => {
  const spy = jest.spyOn(ConfidenceEngine.prototype, "calculate");
  const session = new LiveScreeningSession();
  const varied = [80, 110, 130].flatMap((depth) => hingeSession(depth));
  varied.forEach((f, i) =>
    session.addHingeFrame({ ...f, frameId: i, timestampMs: (i * 1000) / 30 }),
  );
  const result = session.finalizeHinge();
  expect(result!.repCount).toBeGreaterThanOrEqual(3);
  expect(spy).toHaveBeenCalled();
  expect(spy.mock.calls[0]![0].repetitionConsistency).toBeLessThan(1);
});
