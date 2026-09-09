/**
 * Live Coaching Engine for Golf Body OS.
 * Analyzes real-time frames during ACTIVE exercise execution and generates
 * auditory coaching cues and automatic completion signals.
 */

import { PoseFrame } from '../types/pose-frame';
import { LandmarkId } from '../types/landmark';
import { interiorAngle } from '../metrics/angle-calculator';
import { PhaseEngine, MovementPhase } from '../motion/phases/phase-engine';
import { AudioCoachService } from './audio-coach';
import { CoachingPhraseKey } from './i18n/locales';

export interface LiveCoachingEngineCallbacks {
  onRepComplete?: (repNumber: number) => void;
  onAllRepsComplete?: () => void;
  onCueSpoken?: (key: CoachingPhraseKey) => void;
}

export class LiveCoachingEngine {
  private phaseEngine: PhaseEngine;
  private audioCoach: AudioCoachService;
  private callbacks: LiveCoachingEngineCallbacks;

  private prevAngle: number | null = null;
  private prevTimestampMs: number | null = null;
  private lastCompletedReps: number = 0;
  private lastObservedPhase: MovementPhase = 'READY';

  // Sustained compensation frame counters
  private excessiveKneeBendFrames: number = 0;
  private lockedKneeFrames: number = 0;
  private cervicalCraningFrames: number = 0;
  private shallowHingeFrames: number = 0;

  constructor(audioCoach: AudioCoachService, callbacks: LiveCoachingEngineCallbacks = {}) {
    this.audioCoach = audioCoach;
    this.callbacks = callbacks;
    this.phaseEngine = new PhaseEngine();
  }

  public reset(): void {
    this.phaseEngine.reset();
    this.prevAngle = null;
    this.prevTimestampMs = null;
    this.lastCompletedReps = 0;
    this.lastObservedPhase = 'READY';
    this.excessiveKneeBendFrames = 0;
    this.lockedKneeFrames = 0;
    this.cervicalCraningFrames = 0;
    this.shallowHingeFrames = 0;
  }

  public processFrame(frame: PoseFrame): void {
    const lms = frame.landmarks;
    if (!lms || lms.length < 33) return;

    const shoulder = lms.find(l => l.id === LandmarkId.LEFT_SHOULDER);
    const hip = lms.find(l => l.id === LandmarkId.LEFT_HIP);
    const knee = lms.find(l => l.id === LandmarkId.LEFT_KNEE);
    const ankle = lms.find(l => l.id === LandmarkId.LEFT_ANKLE);
    const ear = lms.find(l => l.id === LandmarkId.LEFT_EAR);

    if (!shoulder || !hip || !knee || !ankle) return;

    // 1. Calculate key biomechanical angles
    const hipHingeAngle = interiorAngle(shoulder, hip, knee);
    const kneeAngle = interiorAngle(hip, knee, ankle);
    const neckAngle = ear ? interiorAngle(ear, shoulder, hip) : 180;

    // 2. Compute angular velocity for PhaseEngine
    let angularVelocity = 0;
    if (this.prevAngle !== null && this.prevTimestampMs !== null) {
      const dt = (frame.timestampMs - this.prevTimestampMs) / 1000;
      if (dt > 0.005 && dt < 0.5) {
        angularVelocity = (hipHingeAngle - this.prevAngle) / dt;
      }
    }
    this.prevAngle = hipHingeAngle;
    this.prevTimestampMs = frame.timestampMs;

    // 3. Process movement phase
    const prevPhase = this.lastObservedPhase;
    this.phaseEngine.processFrame(hipHingeAngle, angularVelocity, frame.frameId, frame.timestampMs);
    const currentPhase = this.phaseEngine.currentPhase;
    this.lastObservedPhase = currentPhase;

    if (currentPhase !== prevPhase) {
      if (currentPhase === 'DESCENT' && (prevPhase === 'READY' || prevPhase === 'COMPLETE')) {
        this.speak('CUE_HINGE_DOWN', 'NORMAL', frame.timestampMs);
      } else if (currentPhase === 'RETURN') {
        this.speak('CUE_DRIVE_UP', 'NORMAL', frame.timestampMs);
      }
    }

    const completedReps = this.phaseEngine.completedReps;

    // 4. Check for newly completed repetitions
    if (completedReps > this.lastCompletedReps) {
      this.lastCompletedReps = completedReps;
      this.excessiveKneeBendFrames = 0;
      this.cervicalCraningFrames = 0;

      if (completedReps === 1) {
        this.speak('REP_1_DONE', 'HIGH', frame.timestampMs);
        this.callbacks.onRepComplete?.(1);
      } else if (completedReps === 2) {
        this.speak('REP_2_DONE', 'HIGH', frame.timestampMs);
        this.callbacks.onRepComplete?.(2);
      } else if (completedReps >= 3) {
        this.speak('ALL_REPS_DONE', 'HIGH', frame.timestampMs);
        this.callbacks.onRepComplete?.(3);
        this.callbacks.onAllRepsComplete?.();
        return;
      }
    }

    // 5. Real-time form coaching during DESCENT and ENDPOINT
    if (currentPhase === 'DESCENT' || currentPhase === 'ENDPOINT') {
      // Check Knee Flexion: if bent too much (< 140°)
      if (kneeAngle < 140) {
        this.excessiveKneeBendFrames++;
        if (this.excessiveKneeBendFrames >= 4) { // sustained for ~130ms
          this.speak('CUE_STRAIGHTEN_LEGS', 'NORMAL', frame.timestampMs);
        }
      } else {
        this.excessiveKneeBendFrames = Math.max(0, this.excessiveKneeBendFrames - 1);
      }

      // Check Locked Knees / Hyperextension: if completely locked (> 175°)
      if (kneeAngle > 175) {
        this.lockedKneeFrames++;
        if (this.lockedKneeFrames >= 5) {
          this.speak('CUE_SOFTEN_KNEES', 'NORMAL', frame.timestampMs);
        }
      } else {
        this.lockedKneeFrames = Math.max(0, this.lockedKneeFrames - 1);
      }

      // Check Cervical Craning: if neck deviated from spine by > 25°
      if (Math.abs(neckAngle - 180) > 25) {
        this.cervicalCraningFrames++;
        if (this.cervicalCraningFrames >= 5) {
          this.speak('CUE_NEUTRAL_NECK', 'NORMAL', frame.timestampMs);
        }
      } else {
        this.cervicalCraningFrames = Math.max(0, this.cervicalCraningFrames - 1);
      }

      // Check Shallow Hinge: if at bottom endpoint but didn't hinge deep enough (> 130°)
      if (currentPhase === 'ENDPOINT' && hipHingeAngle > 130) {
        this.shallowHingeFrames++;
        if (this.shallowHingeFrames >= 3) {
          this.speak('CUE_HINGE_DEEPER', 'NORMAL', frame.timestampMs);
        }
      } else {
        this.shallowHingeFrames = Math.max(0, this.shallowHingeFrames - 1);
      }
    }
  }

  private speak(key: CoachingPhraseKey, priority: 'NORMAL' | 'HIGH', timeMs: number): void {
    const spoken = this.audioCoach.speak(key, priority, timeMs);
    if (spoken) {
      this.callbacks.onCueSpoken?.(key);
    }
  }

  public getCompletedReps(): number {
    return this.lastCompletedReps;
  }
}
