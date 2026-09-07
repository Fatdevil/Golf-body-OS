/**
 * @module metric
 * Core metric definition types.
 */
export const VERSION = 'METRIC_V1';

/** Unit of measurement for a metric */
export type MetricUnit = 'DEGREES' | 'SECONDS' | 'METERS' | 'PERCENTAGE' | 'RATIO';

/** Assessment of metric quality */
export type MetricQuality = 'VALID' | 'LOW_CONFIDENCE' | 'ABSTAINED';

/** Scientific validation status of a metric */
export type ValidationStatus = 'EXPERIMENTAL' | 'TREND_VALIDATED' | 'VALIDATED';

/**
 * Measured biological or kinematic metric.
 */
export interface BodyMetric {
  /** Unique metric identifier */
  id: string;
  /** Calculated value, null if abstained */
  value: number | null;
  /** Measurement unit */
  unit: MetricUnit;
  /** Measured side, if applicable */
  side?: 'LEFT' | 'RIGHT';
  /** Overall confidence [0.0, 1.0] */
  confidence: number;
  /** Quality classification */
  quality: MetricQuality;
  /** Version of the protocol used */
  protocolVersion: string;
  /** Version of the metric calculation logic */
  metricVersion: string;
  /** Version of the underlying pose model */
  poseBackendVersion: string;
  /** ISO timestamp of measurement */
  timestamp: string;
  /** Scientific validation status (always EXPERIMENTAL for now) */
  validationStatus: ValidationStatus;
}
