export const VERSION = 'PHASE_ENGINE_V1';

export type MovementPhase = 'READY' | 'MOVEMENT_START' | 'DESCENT' | 'ENDPOINT' | 'RETURN' | 'COMPLETE';

export interface PhaseTransition {
  from: MovementPhase;
  to: MovementPhase;
  frameId: number;
  timestampMs: number;
  triggerMetric: string;
  triggerValue: number;
}

export interface PhaseConfig {
  startVelocityThreshold: number;     // °/s to trigger movement start (default: 15)
  endpointVelocityThreshold: number;  // °/s near-zero for endpoint (default: 5)
  endpointStableFrames: number;       // min frames at endpoint (default: 5)
  minDescentAngle: number;            // min hip angle change for descent (default: 20°)
  standingAngleThreshold: number;     // angle to confirm return to standing (default: 165°)
  hysteresisMargin: number;           // prevents oscillation (default: 3°)
}

export const DEFAULT_HIP_HINGE_PHASE_CONFIG: PhaseConfig = {
  startVelocityThreshold: 15,
  endpointVelocityThreshold: 5,
  endpointStableFrames: 5,
  minDescentAngle: 20,
  standingAngleThreshold: 165,
  hysteresisMargin: 3
};

/**
 * Tracks movement phases for a repetition based on kinematic data.
 */
export class PhaseEngine {
  private config: PhaseConfig;
  private phase: MovementPhase = 'READY';
  private reps: number = 0;
  private history: PhaseTransition[] = [];

  constructor(config: Partial<PhaseConfig> = {}) {
    this.config = { ...DEFAULT_HIP_HINGE_PHASE_CONFIG, ...config };
  }

  /**
   * Gets the current phase of the movement.
   */
  get currentPhase(): MovementPhase {
    return this.phase;
  }

  /**
   * Gets the number of completed repetitions.
   */
  get completedReps(): number {
    return this.reps;
  }

  /**
   * Gets the transition history.
   */
  get transitions(): PhaseTransition[] {
    return this.history;
  }

  /**
   * Resets the phase engine state.
   */
  public reset(): void {
    this.phase = 'READY';
    this.reps = 0;
    this.history = [];
  }

  private transitionTo(
    newPhase: MovementPhase,
    frameId: number,
    timestampMs: number,
    triggerMetric: string,
    triggerValue: number
  ): MovementPhase {
    this.history.push({
      from: this.phase,
      to: newPhase,
      frameId,
      timestampMs,
      triggerMetric,
      triggerValue
    });
    this.phase = newPhase;

    return this.phase;
  }

  /**
   * Processes a new frame of data to update the movement phase.
   * @param hipHingeAngle2D The current hip hinge angle in degrees.
   * @param angularVelocity The angular velocity in degrees per second.
   * @param frameId The frame identifier.
   * @param timestampMs The timestamp in milliseconds.
   * @returns The updated movement phase.
   */
  public processFrame(hipHingeAngle2D: number, angularVelocity: number, frameId: number, timestampMs: number): MovementPhase {
    const { startVelocityThreshold, endpointVelocityThreshold, minDescentAngle, standingAngleThreshold, hysteresisMargin } = this.config;

    switch (this.phase) {
      case 'READY':
        if (angularVelocity < -startVelocityThreshold && hipHingeAngle2D < (160 - hysteresisMargin)) {
          return this.transitionTo('DESCENT', frameId, timestampMs, 'angularVelocity', angularVelocity);
        }
        break;

      case 'DESCENT':
        // crosses zero (sign change) AND hip angle < (180 - minDescentAngle)
        if (angularVelocity > -endpointVelocityThreshold && hipHingeAngle2D < (180 - minDescentAngle)) {
          return this.transitionTo('ENDPOINT', frameId, timestampMs, 'angularVelocity', angularVelocity);
        }
        if (hipHingeAngle2D > standingAngleThreshold) {
          return this.transitionTo('READY', frameId, timestampMs, 'hipHingeAngle2D', hipHingeAngle2D);
        }
        break;

      case 'ENDPOINT':
        if (angularVelocity > startVelocityThreshold) {
          return this.transitionTo('RETURN', frameId, timestampMs, 'angularVelocity', angularVelocity);
        }
        break;

      case 'RETURN':
        if (hipHingeAngle2D > (standingAngleThreshold + hysteresisMargin)) {
          this.reps++;
          return this.transitionTo('COMPLETE', frameId, timestampMs, 'hipHingeAngle2D', hipHingeAngle2D);
        }
        break;
        
      case 'COMPLETE':
        return this.transitionTo('READY', frameId, timestampMs, 'AutoTransition', 0);

      case 'MOVEMENT_START':
        break;
    }

    return this.phase;
  }
}
