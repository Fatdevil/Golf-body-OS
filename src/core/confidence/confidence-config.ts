/**
 * Confidence Engine Configuration
 * EXPERIMENTAL validation status.
 * These are HYPOTHESES, not scientifically determined. Will be calibrated in R-1D.
 */

export const VERSION = 'CONFIDENCE_CONFIG_V1';

export const CONFIDENCE_V0_EXPERIMENTAL = {
  version: 'CONFIDENCE_V0_EXPERIMENTAL' as const,
  weights: {
    landmarkVisibility: 0.20,
    frameCoverage: 0.15,
    movementStability: 0.15,
    endpointQuality: 0.15,
    repetitionConsistency: 0.15,
    protocolCompliance: 0.10,
    cameraStability: 0.10,
  },
  abstentionThreshold: 0.5,
} as const;

export type ConfidenceConfigType = typeof CONFIDENCE_V0_EXPERIMENTAL;
