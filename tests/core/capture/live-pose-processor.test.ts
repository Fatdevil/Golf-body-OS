/**
 * live-pose-processor.test.ts
 */

import { LivePoseProcessor, createTimestampNormalizer, DetectVideoFrame } from '../../../src/core/capture/live-pose-processor';
import { PoseFrame } from '../../../src/core/types/pose-frame';

const modelInfo = { model: 'MEDIAPIPE_POSE', version: 'test', variant: 'FULL' as const, sha256: 'x' };

/** A native result with 33 landmarks in the flat [id, x, y, z, vis, presence] format. */
function nativeResult(width: number, height: number) {
  const flat: number[] = [];
  for (let i = 0; i < 33; i++) flat.push(i, 0.5, 0.5, 0, 0.9, 0.9);
  return { landmarks: flat, worldLandmarks: [], timestampMs: 0, width, height };
}

describe('createTimestampNormalizer', () => {
  test.each([
    ['seconds', 1 / 30],
    ['milliseconds', 1000 / 30],
    ['microseconds', 1e6 / 30],
    ['nanoseconds', 1e9 / 30],
  ])('infers %s from the first interval and returns ms since the first frame', (_unit, interval) => {
    const norm = createTimestampNormalizer();
    const base = 123456;
    expect(norm(base)).toBe(0);
    expect(norm(base + interval)).toBeCloseTo(1000 / 30, 6);
    expect(norm(base + 10 * interval)).toBeCloseTo(10000 / 30, 6);
  });

  test('waits for a usable interval instead of guessing', () => {
    const norm = createTimestampNormalizer();
    norm(1000);
    expect(norm(1000)).toBeNull(); // no progress yet
    expect(norm(1033)).toBeCloseTo(33, 6);
  });
});

describe('LivePoseProcessor', () => {
  const rgb = new Uint8Array(4 * 3 * 3);

  test('emits PoseFrames with real elapsed time and a strictly increasing MediaPipe clock', async () => {
    const clockCalls: number[] = [];
    const frames: PoseFrame[] = [];
    const detect: DetectVideoFrame = async (_b, w, h, ts) => { clockCalls.push(ts); return nativeResult(w, h); };
    const p = new LivePoseProcessor({ detect, modelInfo, onPoseFrame: (f) => frames.push(f) });

    for (let i = 0; i < 3; i++) await p.process(rgb, 4, 3, i / 30); // seconds
    expect(frames.map((f) => Math.round(f.timestampMs))).toEqual([0, 33, 67]);
    expect(frames[0]!.width).toBe(4);
    expect(frames[0]!.landmarks).toHaveLength(33);
    for (let i = 1; i < clockCalls.length; i++) expect(clockCalls[i]!).toBeGreaterThan(clockCalls[i - 1]!);
  });

  test('drops images while a detection is in flight (no growing queue)', async () => {
    let release!: () => void;
    const detect: DetectVideoFrame = (_b, w, h) => new Promise((res) => { release = () => res(nativeResult(w, h)); });
    const frames: PoseFrame[] = [];
    const p = new LivePoseProcessor({ detect, modelInfo, onPoseFrame: (f) => frames.push(f) });

    const first = p.process(rgb, 4, 3, 0)!;
    expect(p.process(rgb, 4, 3, 0.033)).toBeNull();
    expect(p.process(rgb, 4, 3, 0.066)).toBeNull();
    release();
    await first;
    expect(p.stats.droppedBusy).toBe(2);
    expect(frames).toHaveLength(1);
    expect(p.process(rgb, 4, 3, 0.1)).not.toBeNull(); // free again
  });

  test('skips frames without a person and reports native errors without emitting', async () => {
    const errors: unknown[] = [];
    const frames: PoseFrame[] = [];
    let n = 0;
    const detect: DetectVideoFrame = async (_b, w, h) => {
      n++;
      if (n === 1) return { landmarks: [], worldLandmarks: [], timestampMs: 0, width: w, height: h };
      throw new Error('native failure');
    };
    const p = new LivePoseProcessor({ detect, modelInfo, onPoseFrame: (f) => frames.push(f), onError: (e) => errors.push(e) });
    await p.process(rgb, 4, 3, 0);
    await p.process(rgb, 4, 3, 1 / 30);
    expect(frames).toHaveLength(0);
    expect(p.stats.noPerson).toBe(1);
    expect(errors).toHaveLength(1);
  });

  test('reports camera metadata once per source for on-device verification', async () => {
    const infos: unknown[] = [];
    const detect: DetectVideoFrame = async (_b, w, h) => nativeResult(w, h);
    const p = new LivePoseProcessor({ detect, modelInfo, onPoseFrame: () => {}, onFrameSourceInfo: (i) => infos.push(i) });
    const info = { pixelFormat: 'rgb-bgra-8-bit', orientation: 'right', isMirrored: true, sourceWidth: 640, sourceHeight: 480 };
    await p.process(rgb, 4, 3, 0, info);
    await p.process(rgb, 4, 3, 1 / 30, info);
    expect(infos).toEqual([{ ...info, outputWidth: 4, outputHeight: 3 }]);
  });

  test('reports the new source again after a camera flip', async () => {
    const infos: Array<{ isMirrored: boolean }> = [];
    const detect: DetectVideoFrame = async (_b, w, h) => nativeResult(w, h);
    const p = new LivePoseProcessor({ detect, modelInfo, onPoseFrame: () => {}, onFrameSourceInfo: (i) => infos.push(i) });
    const front = { pixelFormat: 'rgb', orientation: 'right', isMirrored: true, sourceWidth: 640, sourceHeight: 480 };
    await p.process(rgb, 4, 3, 0, front);
    await p.process(rgb, 4, 3, 1 / 30, { ...front, isMirrored: false });
    await p.process(rgb, 4, 3, 2 / 30, { ...front, isMirrored: false });
    expect(infos.map((i) => i.isMirrored)).toEqual([true, false]);
  });
});
