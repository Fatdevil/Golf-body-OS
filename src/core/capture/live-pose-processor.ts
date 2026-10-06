/**
 * Live Pose Processor (JS thread)
 *
 * Receives upright packed-RGB camera images (from the frame worklet), runs
 * MediaPipe in VIDEO mode through the native module and emits PoseFrames.
 *
 * - Timestamps: VisionCamera's Frame.timestamp unit is platform dependent;
 *   the unit is inferred from a consecutive frame interval and converted to ms.
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
  /** Called for the first frame and again whenever the camera source changes (e.g. camera flip). */
  onFrameSourceInfo?: (info: FrameSourceInfo) => void;
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
 * the first frame. The unit is inferred from the first plausible interval
 * between consecutive frames, assuming a camera rate between 5 and 240 fps,
 * so a slow start (e.g. a 250 ms warm-up gap) does not block inference.
 * Duplicate or backward timestamps return null: output is strictly increasing.
 */
export function createTimestampNormalizer(): (raw: number) => number | null {
  let first: number | null = null;
  let prev: number | null = null;
  let toMs: number | null = null;
  let lastMs = 0;

  return (raw: number) => {
    if (first === null || prev === null) {
      first = raw;
      prev = raw;
      return 0;
    }
    if (raw <= prev) return null; // duplicate or backward source time
    const step = raw - prev;
    prev = raw;
    if (toMs === null) {
      // Frame interval ≈ 4–200 ms. Pick the unit that puts it in that range.
      if (step >= 0.004 && step <= 0.2) toMs = 1000;          // seconds
      else if (step >= 4 && step <= 200) toMs = 1;            // milliseconds
      else if (step >= 4e3 && step <= 2e5) toMs = 1e-3;       // microseconds
      else if (step >= 4e6 && step <= 2e8) toMs = 1e-6;       // nanoseconds
      else return null; // cannot tell yet (e.g. a dropped burst) — wait for another frame
    }
    const ms = (raw - first) * toMs;
    if (ms <= lastMs) return null;
    lastMs = ms;
    return ms;
  };
}

export class LivePoseProcessor {
  private readonly opts: LivePoseProcessorOptions;
  private readonly clock = createVideoModeClock();
  private readonly normalize = createTimestampNormalizer();
  private busy = false;
  private frameId = 0;
  private reportedInfoKey: string | null = null;
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
    if (info) {
      const key = `${info.pixelFormat}|${info.orientation}|${info.isMirrored}|${info.sourceWidth}x${info.sourceHeight}|${width}x${height}`;
      if (key !== this.reportedInfoKey) {
        this.reportedInfoKey = key;
        this.opts.onFrameSourceInfo?.({ ...info, outputWidth: width, outputHeight: height });
      }
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
