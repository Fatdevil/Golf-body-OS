/**
 * frame-rgb-converter.test.ts
 * Builds a known UPRIGHT image, stores it the way the camera would (rotated,
 * mirrored, 4-byte pixels, padded rows) and checks the converter recovers it.
 */

import {
  convertFrameToPackedRgb,
  FrameOrientation,
  SupportedRgbPixelFormat,
} from '../../../src/core/capture/frame-rgb-converter';

type RGB = [number, number, number];

/** Upright W×H test image with a unique colour per pixel. */
function uprightImage(w: number, h: number): RGB[][] {
  return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => [x * 10 + 1, y * 10 + 2, (x + y) % 250] as RGB));
}

/** Rotate an image by the given orientation (+90° = clockwise), then optionally mirror the upright first. */
function store(up: RGB[][], orientation: FrameOrientation, mirrored: boolean): RGB[][] {
  const img = mirrored ? up.map((row) => [...row].reverse()) : up;
  const h = img.length, w = img[0]!.length;
  if (orientation === 'up') return img;
  if (orientation === 'down') return img.map((row) => [...row].reverse()).reverse();
  if (orientation === 'right') {
    // clockwise: stored[sy][sx] = upright[h-1-sx][sy], stored is h wide, w tall
    return Array.from({ length: w }, (_, sy) => Array.from({ length: h }, (_, sx) => img[h - 1 - sx]![sy]!));
  }
  // left, counter-clockwise: stored[sy][sx] = upright[sx][w-1-sy]
  return Array.from({ length: w }, (_, sy) => Array.from({ length: h }, (_, sx) => img[sx]![w - 1 - sy]!));
}

/** Encode as 4-byte pixels with row padding. */
function encode(img: RGB[][], format: SupportedRgbPixelFormat, padding: number) {
  const h = img.length, w = img[0]!.length;
  const bytesPerRow = w * 4 + padding;
  const buf = new Uint8Array(bytesPerRow * h).fill(0xee); // padding bytes are garbage
  img.forEach((row, y) => row.forEach(([r, g, b], x) => {
    const i = y * bytesPerRow + x * 4;
    if (format === 'rgb-bgra-8-bit') { buf[i] = b; buf[i + 1] = g; buf[i + 2] = r; buf[i + 3] = 255; }
    else { buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255; }
  }));
  return { buffer: buf.buffer, width: w, height: h, bytesPerRow };
}

function decode(data: ArrayBuffer, w: number, h: number): RGB[][] {
  const b = new Uint8Array(data);
  return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => {
    const i = (y * w + x) * 3;
    return [b[i]!, b[i + 1]!, b[i + 2]!] as RGB;
  }));
}

describe('convertFrameToPackedRgb', () => {
  const up = uprightImage(6, 4); // landscape-ish so rotations are distinguishable

  test.each([
    ['up', false], ['right', false], ['down', false], ['left', false],
    ['up', true], ['right', true], ['down', true], ['left', true],
  ] as [FrameOrientation, boolean][])('recovers the upright image for orientation=%s mirrored=%s', (orientation, mirrored) => {
    for (const format of ['rgb-bgra-8-bit', 'rgb-rgba-8-bit'] as SupportedRgbPixelFormat[]) {
      const s = encode(store(up, orientation, mirrored), format, 8);
      const out = convertFrameToPackedRgb(s.buffer, s.width, s.height, s.bytesPerRow, format, orientation, mirrored, 1000);
      expect([out.width, out.height]).toEqual([6, 4]);
      expect(out.data.byteLength).toBe(6 * 4 * 3); // tightly packed, as the native module requires
      expect(decode(out.data, out.width, out.height)).toEqual(up);
    }
  });

  test('downsamples with an integer step so the long side fits', () => {
    const big = uprightImage(40, 20);
    const s = encode(big, 'rgb-bgra-8-bit', 0);
    const out = convertFrameToPackedRgb(s.buffer, s.width, s.height, s.bytesPerRow, 'rgb-bgra-8-bit', 'up', false, 10);
    expect([out.width, out.height]).toEqual([10, 5]); // step 4
    expect(decode(out.data, 10, 5)[1]![2]).toEqual(big[4]![8]); // sampled every 4th pixel
  });

  test('a portrait phone frame stored landscape (orientation right) comes out portrait', () => {
    const portrait = uprightImage(9, 16);
    const s = encode(store(portrait, 'right', false), 'rgb-bgra-8-bit', 0);
    expect([s.width, s.height]).toEqual([16, 9]); // sensor-native landscape
    const out = convertFrameToPackedRgb(s.buffer, s.width, s.height, s.bytesPerRow, 'rgb-bgra-8-bit', 'right', false, 100);
    expect([out.width, out.height]).toEqual([9, 16]);
    expect(decode(out.data, 9, 16)).toEqual(portrait);
  });

  test('handles packed 3-byte rgb-rgb-8-bit frames', () => {
    const img = uprightImage(5, 3);
    const bytesPerRow = 5 * 3 + 1;
    const buf = new Uint8Array(bytesPerRow * 3);
    img.forEach((row, y) => row.forEach(([r, g, b], x) => {
      const i = y * bytesPerRow + x * 3;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
    }));
    const out = convertFrameToPackedRgb(buf.buffer, 5, 3, bytesPerRow, 'rgb-rgb-8-bit', 'up', false, 100);
    expect(decode(out.data, 5, 3)).toEqual(img);
  });
});
