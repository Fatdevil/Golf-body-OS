/**
 * MP4 & MOV Video Inspector (Zero-dependency ISOBMFF Box Parser)
 * 
 * Extracts video track parameters directly from MP4/MOV container headers:
 * - Nominal Framerate (FPS: 30, 60, 120, 240, etc.)
 * - Exact Total Frame Count
 * - Duration in Seconds
 * - Video Dimensions (width, height)
 * - Slow-Motion Detection & Speed Multiplier
 * 
 * Works in Browser (ArrayBuffer / File) and Node.js.
 */

export interface VideoMetadata {
  nominalFps: number;
  totalFrames: number;
  durationSec: number;
  timescale: number;
  width: number;
  height: number;
  isSlowMotion: boolean;
  slowMotionFactor: number; // e.g. 1 (normal), 2 (60fps->30fps), 4 (120fps->30fps), 8 (240fps->30fps)
  formatDescription: string;
}

export class Mp4Inspector {
  /**
   * Parse an ArrayBuffer containing MP4/MOV data.
   */
  public static inspectBuffer(buffer: ArrayBuffer): VideoMetadata | null {
    const view = new DataView(buffer);
    const length = buffer.byteLength;

    let offset = 0;
    let moovOffset = -1;
    let moovSize = 0;

    // Scan top-level boxes for 'moov'
    while (offset + 8 <= length) {
      let boxSize = view.getUint32(offset);
      const boxType = this.getString(view, offset + 4, 4);

      if (boxSize === 1) {
        // 64-bit size
        if (offset + 16 > length) break;
        boxSize = Number(view.getBigUint64(offset + 8));
        if (boxSize < 16) break;
      } else if (boxSize === 0) {
        // Extends to EOF
        boxSize = length - offset;
      }

      if (boxType === 'moov') {
        moovOffset = offset;
        moovSize = boxSize;
        break;
      }

      offset += boxSize;
      if (boxSize <= 0) break;
    }

    if (moovOffset === -1) {
      return null;
    }

    // Parse 'moov' box
    return this.parseMoov(view, moovOffset, Math.min(moovOffset + moovSize, length));
  }

  /**
   * Parse video track inside 'moov' box
   */
  private static parseMoov(view: DataView, start: number, end: number): VideoMetadata | null {
    let offset = start + 8; // skip moov header (size + type)

    // Find all 'trak' boxes inside 'moov'
    while (offset + 8 <= end) {
      const boxSize = view.getUint32(offset);
      const boxType = this.getString(view, offset + 4, 4);

      if (boxSize <= 0 || offset + boxSize > end) break;

      if (boxType === 'trak') {
        const videoMeta = this.parseTrak(view, offset, offset + boxSize);
        if (videoMeta) {
          return videoMeta;
        }
      }

      offset += boxSize;
    }

    return null;
  }

  /**
   * Parse a single 'trak' box and return metadata if it's a video track
   */
  private static parseTrak(view: DataView, start: number, end: number): VideoMetadata | null {
    let offset = start + 8;

    let isVideoTrack = false;
    let width = 0;
    let height = 0;
    let timescale = 0;
    let duration = 0;
    let totalFrames = 0;
    let nominalFps = 30;

    // Boxes we need: 'tkhd' (width/height), 'mdia' -> 'hdlr', 'mdhd', 'minf' -> 'stbl' -> 'stts', 'stsz'
    const findBoxes = (boxStart: number, boxEnd: number) => {
      let cur = boxStart;
      while (cur + 8 <= boxEnd) {
        const bSize = view.getUint32(cur);
        const bType = this.getString(view, cur + 4, 4);
        if (bSize <= 0 || cur + bSize > boxEnd) break;

        const payloadStart = cur + 8;
        const payloadEnd = cur + bSize;

        if (bType === 'tkhd') {
          // Track Header: extract width and height (fixed-point 16.16)
          const version = view.getUint8(payloadStart);
          const widthOffset = version === 1 ? payloadStart + 88 : payloadStart + 76;
          if (widthOffset + 8 <= payloadEnd) {
            width = view.getUint32(widthOffset) >>> 16;
            height = view.getUint32(widthOffset + 4) >>> 16;
          }
        } else if (bType === 'mdia') {
          findBoxes(payloadStart, payloadEnd);
        } else if (bType === 'hdlr') {
          // Handler reference: check component_subtype (bytes 8-12 of payload)
          if (payloadStart + 12 <= payloadEnd) {
            const subtype = this.getString(view, payloadStart + 8, 4);
            if (subtype === 'vide') {
              isVideoTrack = true;
            }
          }
        } else if (bType === 'mdhd') {
          // Media Header: timescale & duration
          const version = view.getUint8(payloadStart);
          if (version === 0) {
            if (payloadStart + 20 <= payloadEnd) {
              timescale = view.getUint32(payloadStart + 12);
              duration = view.getUint32(payloadStart + 16);
            }
          } else if (version === 1) {
            if (payloadStart + 28 <= payloadEnd) {
              timescale = view.getUint32(payloadStart + 20);
              duration = Number(view.getBigUint64(payloadStart + 24));
            }
          }
        } else if (bType === 'minf' || bType === 'stbl') {
          findBoxes(payloadStart, payloadEnd);
        } else if (bType === 'stts') {
          // Time-to-Sample: entries with (sample_count, sample_delta)
          if (payloadStart + 8 <= payloadEnd) {
            const entryCount = view.getUint32(payloadStart + 4);
            let sampleCountSum = 0;
            let firstDelta = 0;

            let entryOffset = payloadStart + 8;
            for (let i = 0; i < entryCount && entryOffset + 8 <= payloadEnd; i++) {
              const count = view.getUint32(entryOffset);
              const delta = view.getUint32(entryOffset + 4);
              if (i === 0) firstDelta = delta;
              sampleCountSum += count;
              entryOffset += 8;
            }

            if (sampleCountSum > 0) {
              totalFrames = sampleCountSum;
            }
            if (timescale > 0 && firstDelta > 0) {
              nominalFps = Math.round((timescale / firstDelta) * 100) / 100;
            }
          }
        } else if (bType === 'stsz') {
          // Sample Size table: sample_count
          if (payloadStart + 8 <= payloadEnd) {
            const sampleCount = view.getUint32(payloadStart + 4);
            if (sampleCount > 0 && totalFrames === 0) {
              totalFrames = sampleCount;
            }
          }
        }

        cur += bSize;
      }
    };

    findBoxes(offset, end);

    if (!isVideoTrack) return null;

    const durationSec = timescale > 0 ? duration / timescale : 0;

    // If nominalFps couldn't be determined from stts, estimate from totalFrames / duration
    if ((nominalFps <= 0 || isNaN(nominalFps)) && totalFrames > 0 && durationSec > 0) {
      nominalFps = Math.round((totalFrames / durationSec) * 100) / 100;
    }

    // Standardize FPS to common video rates (e.g. 29.97 -> 30, 59.94 -> 60, 119.88 -> 120, 239.76 -> 240)
    const normalizedFps = this.roundToStandardFps(nominalFps);

    // Detect slow-motion characteristics:
    // 1. High native FPS (>= 50 fps)
    // 2. Or slow-motion export (e.g. 240 fps recorded, exported as 30 fps playback -> factor = 8x)
    let isSlowMotion = false;
    let slowMotionFactor = 1;

    if (normalizedFps >= 110 && normalizedFps <= 130) {
      isSlowMotion = true;
      slowMotionFactor = 4;
    } else if (normalizedFps >= 220 && normalizedFps <= 260) {
      isSlowMotion = true;
      slowMotionFactor = 8;
    } else if (normalizedFps >= 55 && normalizedFps <= 65) {
      isSlowMotion = true;
      slowMotionFactor = 2;
    }

    let formatDesc = `${normalizedFps} fps`;
    if (isSlowMotion) {
      formatDesc += ` (Slow-Motion ${slowMotionFactor}x)`;
    } else {
      formatDesc += ` (Standard)`;
    }

    return {
      nominalFps: normalizedFps,
      totalFrames: totalFrames > 0 ? totalFrames : Math.round(durationSec * normalizedFps),
      durationSec: Math.round(durationSec * 100) / 100,
      timescale,
      width,
      height,
      isSlowMotion,
      slowMotionFactor,
      formatDescription: formatDesc
    };
  }

  /**
   * Helper: Round common camera rates (29.97 -> 30, 59.94 -> 60, etc.)
   */
  public static roundToStandardFps(rawFps: number): number {
    if (Math.abs(rawFps - 24) < 0.5) return 24;
    if (Math.abs(rawFps - 25) < 0.5) return 25;
    if (Math.abs(rawFps - 30) < 0.5 || Math.abs(rawFps - 29.97) < 0.5) return 30;
    if (Math.abs(rawFps - 50) < 0.5) return 50;
    if (Math.abs(rawFps - 60) < 0.5 || Math.abs(rawFps - 59.94) < 0.5) return 60;
    if (Math.abs(rawFps - 120) < 2 || Math.abs(rawFps - 119.88) < 2) return 120;
    if (Math.abs(rawFps - 240) < 3 || Math.abs(rawFps - 239.76) < 3) return 240;
    return Math.round(rawFps);
  }

  private static getString(view: DataView, offset: number, length: number): string {
    let res = '';
    for (let i = 0; i < length; i++) {
      res += String.fromCharCode(view.getUint8(offset + i));
    }
    return res;
  }
}
