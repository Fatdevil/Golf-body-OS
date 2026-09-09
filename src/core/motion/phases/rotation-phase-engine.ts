/**
 * Rotation Phase Engine
 *
 * Tracks movement phases for bilateral Thoracic Rotation assessment.
 * State progression:
 * READY -> ROTATING_LEFT -> ENDPOINT_LEFT -> RETURN_FROM_LEFT -> CENTER_NEUTRAL
 *       -> ROTATING_RIGHT -> ENDPOINT_RIGHT -> RETURN_FROM_RIGHT -> COMPLETE
 *
 * @module rotation-phase-engine
 * @version ROTATION_PHASE_ENGINE_V1
 */

export const VERSION = 'ROTATION_PHASE_ENGINE_V1';

export type RotationPhase =
  | 'READY'
  | 'ROTATING_LEFT'
  | 'ENDPOINT_LEFT'
  | 'RETURN_FROM_LEFT'
  | 'CENTER_NEUTRAL'
  | 'ROTATING_RIGHT'
  | 'ENDPOINT_RIGHT'
  | 'RETURN_FROM_RIGHT'
  | 'COMPLETE';

export interface RotationPhaseTransition {
  from: RotationPhase;
  to: RotationPhase;
  frameId: number;
  timestampMs: number;
  triggerMetric: string;
  triggerValue: number;
}

export interface RotationPhaseConfig {
  minRotationThreshold: number;      // Minimum degrees to detect deliberate turn (default: 15°)
  velocityThreshold: number;         // °/s to trigger rotation (default: 10°/s)
  endpointVelocityThreshold: number; // °/s to detect turnaround/hold (default: 6°/s)
  centerTolerance: number;           // ± degrees considered centered (default: 12°)
}

export const DEFAULT_ROTATION_PHASE_CONFIG: RotationPhaseConfig = {
  minRotationThreshold: 15,
  velocityThreshold: 10,
  endpointVelocityThreshold: 6,
  centerTolerance: 12,
};

export class RotationPhaseEngine {
  private config: RotationPhaseConfig;
  private phase: RotationPhase = 'READY';
  private history: RotationPhaseTransition[] = [];
  private lastAngle: number = 0;
  private lastTimestampMs: number = -1;

  constructor(config: Partial<RotationPhaseConfig> = {}) {
    this.config = { ...DEFAULT_ROTATION_PHASE_CONFIG, ...config };
  }

  get currentPhase(): RotationPhase {
    return this.phase;
  }

  get transitions(): RotationPhaseTransition[] {
    return this.history;
  }

  get isComplete(): boolean {
    return this.phase === 'COMPLETE';
  }

  public reset(): void {
    this.phase = 'READY';
    this.history = [];
    this.lastAngle = 0;
    this.lastTimestampMs = -1;
  }

  private transitionTo(
    newPhase: RotationPhase,
    frameId: number,
    timestampMs: number,
    triggerMetric: string,
    triggerValue: number
  ): RotationPhase {
    this.history.push({
      from: this.phase,
      to: newPhase,
      frameId,
      timestampMs,
      triggerMetric,
      triggerValue,
    });
    this.phase = newPhase;
    return this.phase;
  }

  /**
   * Processes a new frame's isolated thoracic angle.
   * Angle convention: Positive = LEFT, Negative = RIGHT.
   */
  public processFrame(
    angle: number,
    angularVelocity: number,
    frameId: number,
    timestampMs: number
  ): RotationPhase {
    const { minRotationThreshold, velocityThreshold, endpointVelocityThreshold, centerTolerance } =
      this.config;

    switch (this.phase) {
      case 'READY':
        // Rotating left: angle > minRotationThreshold AND velocity > velocityThreshold
        if (angle > minRotationThreshold && angularVelocity > velocityThreshold) {
          return this.transitionTo('ROTATING_LEFT', frameId, timestampMs, 'angularVelocity', angularVelocity);
        }
        break;

      case 'ROTATING_LEFT':
        // Reached left apex when velocity drops near zero or turns negative (returning)
        if (angle > minRotationThreshold && angularVelocity <= endpointVelocityThreshold) {
          return this.transitionTo('ENDPOINT_LEFT', frameId, timestampMs, 'angle', angle);
        }
        break;

      case 'ENDPOINT_LEFT':
        // Moving back towards center
        if (angularVelocity < -velocityThreshold || angle < (minRotationThreshold + 5)) {
          return this.transitionTo('RETURN_FROM_LEFT', frameId, timestampMs, 'angularVelocity', angularVelocity);
        }
        break;

      case 'RETURN_FROM_LEFT':
        // Returned to neutral center
        if (Math.abs(angle) <= centerTolerance) {
          return this.transitionTo('CENTER_NEUTRAL', frameId, timestampMs, 'angle', angle);
        }
        break;

      case 'CENTER_NEUTRAL':
        // Now rotating right: angle < -minRotationThreshold AND velocity < -velocityThreshold
        if (angle < -minRotationThreshold && angularVelocity < -velocityThreshold) {
          return this.transitionTo('ROTATING_RIGHT', frameId, timestampMs, 'angularVelocity', angularVelocity);
        }
        break;

      case 'ROTATING_RIGHT':
        // Reached right apex when velocity slows or turns positive
        if (angle < -minRotationThreshold && angularVelocity >= -endpointVelocityThreshold) {
          return this.transitionTo('ENDPOINT_RIGHT', frameId, timestampMs, 'angle', angle);
        }
        break;

      case 'ENDPOINT_RIGHT':
        // Moving back towards center
        if (angularVelocity > velocityThreshold || angle > -(minRotationThreshold + 5)) {
          return this.transitionTo('RETURN_FROM_RIGHT', frameId, timestampMs, 'angularVelocity', angularVelocity);
        }
        break;

      case 'RETURN_FROM_RIGHT':
        // Returned to center to complete test
        if (Math.abs(angle) <= centerTolerance) {
          return this.transitionTo('COMPLETE', frameId, timestampMs, 'angle', angle);
        }
        break;

      case 'COMPLETE':
        // Terminal state
        break;
    }

    return this.phase;
  }
}
