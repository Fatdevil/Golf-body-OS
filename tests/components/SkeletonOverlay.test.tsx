/**
 * SkeletonOverlay.test.tsx
 * - Hooks run before the early return (rules of hooks); the overlay must keep
 *   rendering as the pose frame toggles between null and a frame.
 * - Landmarks must be mapped onto the displayed (letterboxed) video rectangle.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { SkeletonOverlay } from '../../src/components/pose/SkeletonOverlay';
import { calculateAspectFitTransform } from '../../src/core/coordinates/coordinate-transform';
import { PoseFrame } from '../../src/core/types/pose-frame';
import { LandmarkId } from '../../src/core/types/landmark';

const drawnCircles: { cx: number; cy: number }[] = [];

jest.mock('@shopify/react-native-skia', () => {
  const { View } = require('react-native');
  return {
    Canvas: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    Line: () => null,
    Circle: (props: { cx: number; cy: number }) => {
      drawnCircles.push({ cx: props.cx, cy: props.cy });
      return null;
    },
    vec: (x: number, y: number) => ({ x, y }),
  };
});

/** Portrait 1080×1920 frame with a single visible landmark at the image centre-top. */
function frameWithNoseAt(x: number, y: number): PoseFrame {
  return {
    frameId: 0,
    timestampMs: 0,
    width: 1080,
    height: 1920,
    model: 'TEST',
    modelVersion: '1',
    landmarks: [{ id: LandmarkId.NOSE, x, y, visibility: 1 }],
  } as PoseFrame;
}

describe('SkeletonOverlay', () => {
  beforeEach(() => {
    drawnCircles.length = 0;
  });

  test('survives the pose frame toggling between null and a frame', async () => {
    const { rerender } = await render(
      <SkeletonOverlay poseFrame={frameWithNoseAt(0.5, 0.5)} displayWidth={400} displayHeight={400} />,
    );
    await rerender(<SkeletonOverlay poseFrame={null} displayWidth={400} displayHeight={400} />);
    await rerender(<SkeletonOverlay poseFrame={frameWithNoseAt(0.5, 0.5)} displayWidth={400} displayHeight={400} />);
    expect(drawnCircles).toHaveLength(2);
  });

  test('maps landmarks into the pillarboxed video area (contain)', async () => {
    // 9:16 portrait video in a 400×400 view → video is 225×400, offset 87.5 px from the left.
    await render(<SkeletonOverlay poseFrame={frameWithNoseAt(0, 0.5)} displayWidth={400} displayHeight={400} />);
    expect(drawnCircles).toHaveLength(1);
    expect(drawnCircles[0]!.cx).toBeCloseTo(87.5, 6); // left edge of the video, not of the view
    expect(drawnCircles[0]!.cy).toBeCloseTo(200, 6);
  });

  test('supports cover fit when the video view crops', async () => {
    // cover: scale = max(400/1080, 400/1920) → video 400×711.1, offsetY −155.6
    await render(
      <SkeletonOverlay poseFrame={frameWithNoseAt(0.5, 0)} displayWidth={400} displayHeight={400} contentFit="cover" />,
    );
    expect(drawnCircles[0]!.cx).toBeCloseTo(200, 6);
    expect(drawnCircles[0]!.cy).toBeCloseTo((400 - 1920 * (400 / 1080)) / 2, 4);
  });
});

describe('calculateAspectFitTransform', () => {
  test('letterboxes a landscape video in a portrait view', () => {
    const t = calculateAspectFitTransform(1920, 1080, 360, 640);
    expect(t.scale).toBeCloseTo(360 / 1920, 9);
    expect(t.offsetX).toBeCloseTo(0, 9);
    expect(t.offsetY).toBeCloseTo((640 - 1080 * (360 / 1920)) / 2, 9);
  });

  test('is the identity scale when aspect ratios match', () => {
    const t = calculateAspectFitTransform(1080, 1920, 540, 960);
    expect(t).toEqual({ scale: 0.5, offsetX: 0, offsetY: 0 });
  });
});
