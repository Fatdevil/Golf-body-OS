export const VERSION = 'OUTLIER_REJECTOR_V1';

export const MAX_INTERPOLATION_GAP_FRAMES = 3;

export type OutlierResult = 
  | { type: 'VALID'; value: number }
  | { type: 'INTERPOLATED'; value: number; gapSize: number }
  | { type: 'REJECTED'; reason: string }
  | { type: 'INVALID_SEGMENT'; gapSize: number; reason: string };

/**
 * Configuration for the OutlierRejector.
 */
export interface OutlierRejectorConfig {
  /**
   * Number of standard deviations to use as threshold.
   * Default: 3 (3-sigma rule).
   */
  sigmaMultiplier?: number;
  /**
   * Minimum threshold to prevent over-rejection when std is near zero.
   * MUST be chosen based on the unit of the data being processed:
   * - Normalized coordinates [0,1]: 0.01–0.05
   * - Degrees [0,180]: 2.0–5.0
   * - BODY_METRIC space: depends on normalization
   * Default: 0.01
   */
  minThreshold?: number;
  /** History length for running mean/std calculation. Default: 30 */
  maxHistory?: number;
  /**
   * Number of frames to collect during warm-up before initializing stats.
   * During warm-up, all values are accepted. After warm-up, the running
   * mean/std is initialized from the MEDIAN of collected values to resist
   * outliers from MediaPipe model warm-up artifacts.
   * Default: 5
   */
  warmupFrames?: number;
}

/**
 * Tracks running mean and std dev to detect jumps > configured sigma threshold.
 * Supports linear interpolation for small gaps.
 */
export class OutlierRejector {
  private values: number[] = [];
  private readonly maxHistory: number;
  private readonly sigmaMultiplier: number;
  private readonly minThreshold: number;
  private readonly warmupFrames: number;
  private warmupBuffer: { value: number; timestamp: number }[] = [];
  private warmupComplete = false;
  private gapSize = 0;
  private lastValidValue: number | null = null;
  private lastValidTimestamp: number | null = null;
  private gapBuffer: { timestamp: number, rejectedValue: number }[] = [];

  constructor(config?: OutlierRejectorConfig) {
    this.sigmaMultiplier = config?.sigmaMultiplier ?? 3;
    this.minThreshold = config?.minThreshold ?? 0.01;
    this.maxHistory = config?.maxHistory ?? 30;
    this.warmupFrames = config?.warmupFrames ?? 5;
  }

  /**
   * Processes a new value.
   * @param value The value to process.
   * @param timestamp The timestamp in ms.
   * @returns The OutlierResult indicating if it was accepted, rejected, interpolated, or invalid.
   */
  public process(value: number, timestamp: number): OutlierResult {
    // Warm-up phase: collect frames, then initialize with median
    if (!this.warmupComplete) {
      this.warmupBuffer.push({ value, timestamp });

      if (this.warmupBuffer.length >= this.warmupFrames) {
        // Initialize running history with the median value to resist outliers
        const medianValue = this.computeMedian(this.warmupBuffer.map((f) => f.value));
        // Seed history with median repeated, so mean ≈ median and std ≈ 0
        // This makes the first post-warmup frame evaluated fairly
        this.values = Array(this.warmupFrames).fill(medianValue);
        this.lastValidValue = medianValue;
        this.lastValidTimestamp = this.warmupBuffer[this.warmupBuffer.length - 1]!.timestamp;
        this.warmupComplete = true;
        this.warmupBuffer = []; // Free memory
      }

      return { type: 'VALID', value };
    }

    const { mean, std } = this.calculateStats();
    
    // Check if outlier (> configured sigma × std, with configurable minimum)
    const threshold = Math.max(std * this.sigmaMultiplier, this.minThreshold);
    if (Math.abs(value - mean) > threshold) {
      this.gapSize++;
      this.gapBuffer.push({ timestamp, rejectedValue: value });

      if (this.gapSize > MAX_INTERPOLATION_GAP_FRAMES) {
        // Gap too large, mark segment invalid
        const size = this.gapSize;
        this.resetGap();
        this.values = []; // Reset history as well
        return { type: 'INVALID_SEGMENT', gapSize: size, reason: 'Gap exceeded max interpolation frames' };
      }

      return { type: 'REJECTED', reason: `Value ${value} exceeds 3 sigma threshold (mean: ${mean}, std: ${std})` };
    }

    // Value is valid. Did we just close a gap?
    if (this.gapSize > 0) {
      const size = this.gapSize;
      
      // We found a valid point, meaning previous REJECTED points could have been interpolated, 
      // but the API is streaming. For streaming, we might just return VALID and let caller handle.
      // But we can flag it. We'll return INTERPOLATED for the current value just to signal a gap was closed.
      // In a real system, we might need a delayed buffer to rewrite history.
      this.resetGap();
      this.acceptValue(value, timestamp);
      return { type: 'INTERPOLATED', value, gapSize: size };
    }

    this.acceptValue(value, timestamp);
    return { type: 'VALID', value };
  }

  private acceptValue(value: number, timestamp: number) {
    this.values.push(value);
    if (this.values.length > this.maxHistory) {
      this.values.shift();
    }
    this.lastValidValue = value;
    this.lastValidTimestamp = timestamp;
  }

  private resetGap() {
    this.gapSize = 0;
    this.gapBuffer = [];
  }

  private calculateStats() {
    const n = this.values.length;
    const mean = this.values.reduce((a, b) => a + b, 0) / n;
    const variance = this.values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
    return { mean, std: Math.sqrt(variance) };
  }

  private computeMedian(arr: number[]): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1]! + sorted[mid]!) / 2;
    }
    return sorted[mid]!;
  }
}
