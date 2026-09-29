import {
  LivePoseProcessor,
  createTimestampNormalizer,
} from "../../src/core/capture/live-pose-processor";
const modelInfo = {
  model: "TEST",
  version: "1",
  variant: "FULL" as const,
  sha256: "test",
};
const rgb = new Uint8Array(36);
function native() {
  return {
    landmarks: Array.from({ length: 33 }, (_, i) => [
      i,
      0.5,
      0.5,
      0,
      0.9,
      0.9,
    ]).flat(),
    worldLandmarks: [],
    timestampMs: 0,
    width: 4,
    height: 3,
  };
}
test.each([1, 1000, 1e6])(
  "C01 recovers after initial 250ms camera delay (unit scale %s)",
  (scale) => {
    const n = createTimestampNormalizer();
    n(0);
    const results = [250, 283, 316, 349].map((t) => n(t * scale));
    expect(results.some((t) => t !== null && t >= 250 && t <= 350)).toBe(true);
  },
);
test("C02 resumes after an inference rejection", async () => {
  const detect = jest
    .fn()
    .mockRejectedValueOnce(new Error("native"))
    .mockResolvedValue(native());
  const onPoseFrame = jest.fn(),
    onError = jest.fn();
  const p = new LivePoseProcessor({ detect, modelInfo, onPoseFrame, onError });
  await p.process(rgb, 4, 3, 0);
  await p.process(rgb, 4, 3, 33);
  expect(onError).toHaveBeenCalledTimes(1);
  expect(onPoseFrame).toHaveBeenCalledTimes(1);
});
test("C03 malformed landmark payload is rejected and next frame recovers", async () => {
  const detect = jest
    .fn()
    .mockResolvedValueOnce({ ...native(), landmarks: [0, 1] })
    .mockResolvedValue(native());
  const onPoseFrame = jest.fn(),
    onError = jest.fn();
  const p = new LivePoseProcessor({ detect, modelInfo, onPoseFrame, onError });
  await p.process(rgb, 4, 3, 0);
  await p.process(rgb, 4, 3, 33);
  expect(onError).toHaveBeenCalledTimes(1);
  expect(onPoseFrame).toHaveBeenCalledTimes(1);
});
test("C04 100 incoming frames cannot create an unbounded inference queue", async () => {
  let finish: any;
  const detect = jest.fn(
    () =>
      new Promise<any>((r) => {
        finish = r;
      }),
  );
  const p = new LivePoseProcessor({
    detect,
    modelInfo,
    onPoseFrame: jest.fn(),
  });
  const first = p.process(rgb, 4, 3, 0);
  for (let i = 1; i <= 100; i++) p.process(rgb, 4, 3, i * 33);
  expect(detect).toHaveBeenCalledTimes(1);
  expect(p.stats.droppedBusy).toBe(100);
  finish(native());
  await first;
});
test("C05 duplicate or backward camera time must not emit duplicate/backward measurement time", async () => {
  const onPoseFrame = jest.fn();
  const p = new LivePoseProcessor({
    detect: async () => native(),
    modelInfo,
    onPoseFrame,
  });
  for (const t of [0, 33, 33, 20, 66]) await p.process(rgb, 4, 3, t);
  const times = onPoseFrame.mock.calls.map((c) => c[0].timestampMs);
  expect(times.every((t, i) => i === 0 || t > times[i - 1])).toBe(true);
});
