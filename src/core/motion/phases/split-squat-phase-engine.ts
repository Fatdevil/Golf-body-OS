/**
 * Split Squat Phase Engine
 *
 * State machine tracking repetition lifecycles, kinematics, and phase
 * transitions during the Split Squat Capacity assessment.
 *
 * @module split-squat-phase-engine
 */

export type SplitSquatPhase =
  | 'READY'
  | 'DESCENT'
  | 'BOTTOM'
  | 'ASCENT'
  | 'REP_COMPLETED'
  | 'TERMINATED';

export interface SplitSquatRepetition {
  repIndex: number;
  startFrameId: number;
  bottomFrameId: number;
  endFrameId: number;
  startTimestampMs: number;
  bottomTimestampMs: number;
  endTimestampMs: number;
  descentDurationMs: number;
  ascentDurationMs: number;
  minKneeAngleDeg: number;       // Peak depth (interior knee angle, 180 = straight, 90 = right angle)
  trunkAngleAtBottomDeg: number; // Deviation from vertical
  isValidDepth: boolean;        // e.g. knee flexed <= 100°
}

export interface SplitSquatPhaseConfig {
  /** Knee angle indicating top of split stance (straight leg) */
  standingKneeAngleThreshold: number; // default: 155°
  /** Knee angle required to confirm descent has begun */
  descentInitiationAngle: number;     // default: 145°
  /** Target knee flexion angle for a valid deep rep */
  validDepthAngleThreshold: number;   // default: 100° (lower means deeper flexion)
  /** Maximum idle duration in standing before test terminates (ms) */
  maxIdleDurationMs: number;          // default: 3500ms
  /** Number of stable frames needed to detect bottom inflection */
  inflectionWindowFrames: number;     // default: 3
}

export const DEFAULT_SPLIT_SQUAT_CONFIG: SplitSquatPhaseConfig = {
  standingKneeAngleThreshold: 155,
  descentInitiationAngle: 145,
  validDepthAngleThreshold: 100,
  maxIdleDurationMs: 3500,
  inflectionWindowFrames: 3,
};

export class SplitSquatPhaseEngine {
  private config: SplitSquatPhaseConfig;
  private phase: SplitSquatPhase = 'READY';
  private completedRepsList: SplitSquatRepetition[] = [];

  // Current rep tracking
  private currentRepStartFrame: number = 0;
  private currentRepStartTimestamp: number = 0;
  private lastStandingFrame: number = 0;
  private lastStandingTimestamp: number = 0;
  private minKneeAngleInRep: number = 180;
  private bottomFrameId: number = 0;
  private bottomTimestamp: number = 0;
  private trunkAngleAtBottom: number = 0;
  private risingFramesCount: number = 0;

  // Stability / idle tracking
  private lastMovementTimestamp: number = 0;
  private isTerminated: boolean = false;

  constructor(config: Partial<SplitSquatPhaseConfig> = {}) {
    this.config = { ...DEFAULT_SPLIT_SQUAT_CONFIG, ...config };
  }

  get currentPhase(): SplitSquatPhase {
    return this.phase;
  }

  get completedReps(): SplitSquatRepetition[] {
    return [...this.completedRepsList];
  }

  get totalRepCount(): number {
    return this.completedRepsList.length;
  }

  get validRepCount(): number {
    return this.completedRepsList.filter(r => r.isValidDepth).length;
  }

  get terminated(): boolean {
    return this.isTerminated;
  }

  /**
   * Process a new video/stream frame.
   *
   * @param frameId Current frame identifier
   * @param timestampMs Frame timestamp in milliseconds
   * @param leadKneeAngle Interior angle of the lead knee (180° = fully straight, 90° = deep squat)
   * @param trunkAngle Torso inclination relative to vertical (0° = vertical upright)
   */
  public processFrame(
    frameId: number,
    timestampMs: number,
    leadKneeAngle: number,
    trunkAngle: number = 0
  ): SplitSquatPhase {
    if (this.isTerminated) {
      return 'TERMINATED';
    }

    if (this.lastMovementTimestamp === 0) {
      this.lastMovementTimestamp = timestampMs;
    }

    switch (this.phase) {
      case 'READY': {
        if (leadKneeAngle >= this.config.standingKneeAngleThreshold) {
          this.lastStandingFrame = frameId;
          this.lastStandingTimestamp = timestampMs;
        }

        // Check if user starts descending
        if (leadKneeAngle < this.config.descentInitiationAngle) {
          this.phase = 'DESCENT';
          this.currentRepStartFrame = this.lastStandingFrame > 0 ? this.lastStandingFrame : frameId;
          this.currentRepStartTimestamp = this.lastStandingTimestamp > 0 ? this.lastStandingTimestamp : timestampMs;
          this.minKneeAngleInRep = leadKneeAngle;
          this.bottomFrameId = frameId;
          this.bottomTimestamp = timestampMs;
          this.trunkAngleAtBottom = trunkAngle;
          this.risingFramesCount = 0;
          this.lastMovementTimestamp = timestampMs;
        } else {
          // If in READY with completed reps, check if user has stopped for too long (test end)
          if (this.completedRepsList.length > 0 &&
              timestampMs - this.lastMovementTimestamp > this.config.maxIdleDurationMs) {
            this.phase = 'TERMINATED';
            this.isTerminated = true;
          }
        }
        break;
      }

      case 'DESCENT': {
        this.lastMovementTimestamp = timestampMs;

        if (leadKneeAngle < this.minKneeAngleInRep) {
          this.minKneeAngleInRep = leadKneeAngle;
          this.bottomFrameId = frameId;
          this.bottomTimestamp = timestampMs;
          this.trunkAngleAtBottom = trunkAngle;
          this.risingFramesCount = 0;
        } else if (leadKneeAngle > this.minKneeAngleInRep + 5) {
          this.risingFramesCount++;
          // Detect inflection point: knee angle consistently rising across inflectionWindowFrames
          if (this.risingFramesCount >= this.config.inflectionWindowFrames) {
            this.phase = 'ASCENT';
          }
        }
        break;
      }

      case 'ASCENT': {
        this.lastMovementTimestamp = timestampMs;

        // Still rising back up toward standing
        if (leadKneeAngle >= this.config.standingKneeAngleThreshold) {
          // Repetition complete!
          const descentDuration = Math.max(0, this.bottomTimestamp - this.currentRepStartTimestamp);
          const ascentDuration = Math.max(0, timestampMs - this.bottomTimestamp);

          const newRep: SplitSquatRepetition = {
            repIndex: this.completedRepsList.length + 1,
            startFrameId: this.currentRepStartFrame,
            bottomFrameId: this.bottomFrameId,
            endFrameId: frameId,
            startTimestampMs: this.currentRepStartTimestamp,
            bottomTimestampMs: this.bottomTimestamp,
            endTimestampMs: timestampMs,
            descentDurationMs: descentDuration,
            ascentDurationMs: ascentDuration,
            minKneeAngleDeg: Math.round(this.minKneeAngleInRep),
            trunkAngleAtBottomDeg: Math.round(this.trunkAngleAtBottom),
            isValidDepth: this.minKneeAngleInRep <= this.config.validDepthAngleThreshold,
          };

          this.completedRepsList.push(newRep);
          this.phase = 'READY';
          this.minKneeAngleInRep = 180;
        }
        break;
      }

      case 'REP_COMPLETED': {
        this.phase = 'READY';
        break;
      }

      default:
        break;
    }

    return this.phase;
  }

  /**
   * Explicitly finish the test (e.g. user pressed stop or timeout).
   */
  public finish(): void {
    this.phase = 'TERMINATED';
    this.isTerminated = true;
  }
}
