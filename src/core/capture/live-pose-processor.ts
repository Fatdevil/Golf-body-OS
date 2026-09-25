/**
 * Live Pose Processor (JS thread)
 *
 * Receives upright packed-RGB camera images (from the frame worklet), runs
 * MediaPipe in VIDEO mode through the native module and emits PoseFrames.
 *
 * - Timestamps: VisionCamera's Frame.timestamp unit is platform dependent;
 *   the unit is inferred from the first frame interval and converted to ms.
 *   PoseFrame.timestampMs keeps real elapsed time (velocities depend on it);
 *   MediaPipe gets a strictly increasing clock (VIDEO mode requirement).
 * - Back-pressure: while one detection is in flight, new images are dropped
 *   instead of queuing (a queue would add ever-growing latency).
 * - Frames without a detected person are skipped, never invented.
 *
 * Dependencies are injected so the logic is testable without a device.
 *
 * @module live-pose-processor
 * @version LIVE_POSE_PROCESSOR_V1
 */

import { PoseFrame } from '../types/pose-frame';
import { createVideoModeClock } from '../pose/video-mode-clock';
import { convertNativeResultToPoseFrame } from '../bridge/native-landmark-bridge';
import type { NativeLandmarkResult, NativeModelInfo } from '../../../modules/golf-body-pose';

export const VERSION = 'LIVE_POSE_PROCESSOR_V1';

export type DetectVideoFrame = (
  rgb: Uint8Array,
  width: number,
  height: number,
  timestampMs: number,
) => Promise<NativeLandmarkResult>;

/** Camera metadata reported once so orientation/mirroring can be verified on device. */
export interface FrameSourceInfo {
  pixelFormat: string;
  orientation: string;
  isMirrored: boolean;
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
}

export interface LivePoseProcessorOptions {
  detect: DetectVideoFrame;
  modelInfo: NativeModelInfo;
  onPoseFrame: (frame: PoseFrame) => void;
  onError?: (error: unknown) => void;
  onFirstFrameInfo?: (info: FrameSourceInfo) => void;
}

export interface LivePoseProcessorStats {
  received: number;
  droppedBusy: number;
  noPerson: number;
  errors: number;
  emitted: number;
}

/**
 * Converts raw frame timestamps (unknown unit) to milliseconds relative to
 * the first frame. The unit is inferred from the first positive interval,
 * assuming a camera rate between 5 and 240 fps.
 */
export function createTimestampNormalizer(): (raw: number) => number | null {
  let first: number | null = null;
  let toMs: number | null = null;

  return (raw: number) => {
    if (first === null) {
      first = raw;
      return 0;
    }
    const delta = raw - first;
    if (toMs === null) {
      if (delta <= 0) return null;
      // Frame interval ≈ 4–200 ms. Pick the unit that puts it in that range.
      if (delta >= 0.004 && delta <= 0.2) toMs = 1000;          // seconds
      else if (delta >= 4 && delta <= 200) toMs = 1;            // milliseconds
      else if (delta >= 4e3 && delta <= 2e5) toMs = 1e-3;       // microseconds
      else if (delta >= 4e6 && delta <= 2e8) toMs = 1e-6;       // nanoseconds
      else return null; // cannot tell yet (e.g. a dropped burst) — wait for another frame
    }
    return delta * toMs;
  };
}

export class LivePoseProcessor {
  private readonly opts: LivePoseProcessorOptions;
  private readonly clock = createVideoModeClock();
  private readonly normalize = createTimestampNormalizer();
  private busy = false;
  private frameId = 0;
  private reportedInfo = false;
  readonly stats: LivePoseProcessorStats = { received: 0, droppedBusy: 0, noPerson: 0, errors: 0, emitted: 0 };

  constructor(opts: LivePoseProcessorOptions) {
    this.opts = opts;
  }

  /**
   * Handles one upright packed-RGB image. Returns the detection promise, or
   * null when the image was dropped.
   */
  process(
    rgb: ArrayBuffer | Uint8Array,
    width: number,
    height: number,
    rawTimestamp: number,
    info?: Omit<FrameSourceInfo, 'outputWidth' | 'outputHeight'>,
  ): Promise<void> | null {
    this.stats.received++;
    if (info && !this.reportedInfo) {
      this.reportedInfo = true;
      this.opts.onFirstFrameInfo?.({ ...info, outputWidth: width, outputHeight: height });
    }

    const timestampMs = this.normalize(rawTimestamp);
    if (timestampMs === null) return null;

    if (this.busy) {
      this.stats.droppedBusy++;
      return null;
    }
    this.busy = true;

    const bytes = rgb instanceof Uint8Array ? rgb : new Uint8Array(rgb);
    const id = this.frameId++;
    return this.opts
      .detect(bytes, width, height, this.clock(timestampMs))
      .then((result) => {
        if (!result.landmarks || result.landmarks.length === 0) {
          this.stats.noPerson++;
          return;
        }
        // Keep real elapsed time on the PoseFrame (not the MediaPipe clock).
        const frame = convertNativeResultToPoseFrame({ ...result, timestampMs, width, height }, this.opts.modelInfo, id);
        this.stats.emitted++;
        this.opts.onPoseFrame(frame);
      })
      .catch((err) => {
        this.stats.errors++;
        this.opts.onError?.(err);
      })
      .finally(() => {
        this.busy = false;
      });
  }
}
