/**
 * video-mode-clock.test.ts
 * MediaPipe VIDEO mode rejects any timestamp that does not advance, and stays
 * broken afterwards. The clock must stay strictly increasing through the
 * harness's real call pattern: coarse pass → dense re-scan → next video.
 */

import { createVideoModeClock, NEW_SEQUENCE_GAP_MS } from '../../../src/core/pose/video-mode-clock';

function expectStrictlyIncreasing(values: number[]): void {
  for (let i = 1; i < values.length; i++) {
    expect(values[i]).toBeGreaterThan(values[i - 1]!);
  }
}

describe('createVideoModeClock', () => {
  test('keeps real spacing between consecutive frames without rounding drift', () => {
    const clock = createVideoModeClock();
    const out = [0, 1, 2, 3, 4, 5, 6].map((i) => clock((i * 1000) / 30));
    expect(out).toEqual([0, 33, 67, 100, 133, 167, 200]);
  });

  test('stays strictly increasing through coarse pass, dense re-scan and a second video', () => {
    const clock = createVideoModeClock();
    const coarse = Array.from({ length: 91 }, (_, i) => (i * 1000) / 30);            // 0–3 s @ 30 fps
    const dense = Array.from({ length: 61 }, (_, j) => 1200 + (j * 1000) / 120);     // 1.2–1.7 s @ 120 fps
    const nextVideo = Array.from({ length: 31 }, (_, i) => (i * 1000) / 30);         // new clip from 0 s

    const all = [...coarse, ...dense, ...nextVideo].map(clock);
    expectStrictlyIncreasing(all);

    // dense pass keeps its real 120 fps spacing (≈ 8 ms)
    const densePart = all.slice(coarse.length, coarse.length + dense.length);
    expect(densePart[1]! - densePart[0]!).toBe(8);
    // and starts a new sequence after the gap instead of reusing earlier times
    expect(densePart[0]! - all[coarse.length - 1]!).toBe(NEW_SEQUENCE_GAP_MS);
  });

  test('repeated identical timestamps (e.g. single photos at t = 0) never collide', () => {
    const clock = createVideoModeClock();
    expectStrictlyIncreasing([0, 0, 0].map(clock));
  });
});
