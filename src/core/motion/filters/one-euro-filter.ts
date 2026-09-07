export const VERSION = 'FILTER_ONE_EURO_V1';

/**
 * Configuration options for the One Euro Filter.
 */
export interface OneEuroFilterConfig {
  /** Minimum cutoff frequency. Defaults to 1.0. */
  minCutoff?: number;
  /** Cutoff slope. Defaults to 0.007. */
  beta?: number;
  /** Cutoff frequency for derivative. Defaults to 1.0. */
  dCutoff?: number;
}

/**
 * A 1 Euro Filter is a first-order low-pass filter with an adaptive cutoff frequency.
 * At low speeds, a low cutoff is used to reduce jitter.
 * At high speeds, a higher cutoff is used to reduce lag.
 */
export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;

  private prevTime: number | null = null;
  private prevVal: number | null = null;
  private prevDx: number | null = null;

  constructor(config?: OneEuroFilterConfig) {
    this.minCutoff = config?.minCutoff ?? 1.0;
    this.beta = config?.beta ?? 0.007;
    this.dCutoff = config?.dCutoff ?? 1.0;
  }

  private alpha(cutoff: number, dt: number): number {
    const tau = 1.0 / (2.0 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }

  /**
   * Filters the noisy value.
   * @param value The noisy value to filter.
   * @param timestamp The timestamp in milliseconds.
   * @returns The filtered value.
   */
  public filter(value: number, timestamp: number): number {
    if (this.prevTime === null || this.prevVal === null || this.prevDx === null) {
      this.prevTime = timestamp;
      this.prevVal = value;
      this.prevDx = 0;
      return value;
    }

    const dt = (timestamp - this.prevTime) / 1000.0;
    if (dt <= 0) {
      return this.prevVal;
    }

    // Calculate derivative (speed)
    const dx = (value - this.prevVal) / dt;
    const edx = this.alpha(this.dCutoff, dt) * dx + (1 - this.alpha(this.dCutoff, dt)) * this.prevDx;
    this.prevDx = edx;

    // Calculate dynamic cutoff frequency
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    
    // Filter the value
    const a = this.alpha(cutoff, dt);
    const result = a * value + (1 - a) * this.prevVal;
    
    this.prevTime = timestamp;
    this.prevVal = result;

    return result;
  }

  /**
   * Resets the filter's internal state.
   */
  public reset(): void {
    this.prevTime = null;
    this.prevVal = null;
    this.prevDx = null;
  }
}
