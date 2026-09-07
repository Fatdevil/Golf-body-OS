/**
 * Confidence Engine
 * EXPERIMENTAL validation status.
 */

import { CONFIDENCE_V0_EXPERIMENTAL, ConfidenceConfigType } from './confidence-config';

export const VERSION = 'CONFIDENCE_ENGINE_V1';

export interface ConfidenceInput {
  /** [0,1] avg visibility of required landmarks */
  landmarkVisibility: number;
  /** [0,1] avg presence */
  landmarkPresence: number;
  /** [0,1] from IMU stability */
  cameraStability: number;
  /** validFrames / totalFrames */
  frameCoverage: number;
  /** [0,1] endpoint variance */
  movementStability: number;
  /** [0,1] quality rules passed */
  protocolCompliance: number;
  /** [0,1] stable frames / threshold */
  endpointQuality: number;
  /** [0,1] 1 - (std/mean) of ROM across reps */
  repetitionConsistency: number;
}

export interface ConfidenceResult {
  overall: number;
  configVersion: string; // e.g., 'CONFIDENCE_V0_EXPERIMENTAL'
  components: Record<string, number>;
  flags: string[];
  isAbstained: boolean;
}

export class ConfidenceEngine {
  private config: ConfidenceConfigType;

  constructor(config: ConfidenceConfigType = CONFIDENCE_V0_EXPERIMENTAL) {
    this.config = config;
  }

  /**
   * Calculates overall confidence and generates flags.
   * @param input Confidence input metrics.
   * @returns ConfidenceResult containing overall score, components, flags, and abstention status.
   */
  public calculate(input: ConfidenceInput): ConfidenceResult {
    const w = this.config.weights;
    
    // Calculate components (clamped [0,1])
    const components: Record<string, number> = {
      landmarkVisibility: this.clamp(input.landmarkVisibility) * w.landmarkVisibility,
      frameCoverage: this.clamp(input.frameCoverage) * w.frameCoverage,
      movementStability: this.clamp(input.movementStability) * w.movementStability,
      endpointQuality: this.clamp(input.endpointQuality) * w.endpointQuality,
      repetitionConsistency: this.clamp(input.repetitionConsistency) * w.repetitionConsistency,
      protocolCompliance: this.clamp(input.protocolCompliance) * w.protocolCompliance,
      cameraStability: this.clamp(input.cameraStability) * w.cameraStability,
    };

    let overall = 0;
    for (const key in components) {
      overall += components[key];
    }

    const flags: string[] = [];

    if (input.landmarkVisibility < 0.5) {
      flags.push('LOW_VISIBILITY');
    }
    if (input.cameraStability < 0.3) {
      flags.push('CAMERA_UNSTABLE');
    }
    if (input.frameCoverage < 0.7) {
      flags.push('LOW_FRAME_COVERAGE');
    }
    if (input.protocolCompliance < 0.6) {
      flags.push('LOW_PROTOCOL_COMPLIANCE');
    }
    if (input.movementStability < 0.4) {
      flags.push('UNSTABLE_MOVEMENT');
    }

    const isAbstained = overall < this.config.abstentionThreshold;

    return {
      overall: this.clamp(overall),
      configVersion: this.config.version,
      components,
      flags,
      isAbstained,
    };
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
