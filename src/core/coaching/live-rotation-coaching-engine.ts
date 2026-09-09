/**
 * Live Rotation Coaching Engine for Golf Body OS.
 * Guides user through Thoracic Rotation assessment with real-time auditory prompts.
 *
 * @module live-rotation-coaching-engine
 */

import { PoseFrame } from '../types/pose-frame';
import { RotationPhaseEngine, RotationPhase } from '../motion/phases/rotation-phase-engine';
import { extractRotationSample, RotationSample } from '../metrics/thoracic-rotation-metrics';
import { AudioCoachService, CuePriority } from './audio-coach';
import { CoachingPhraseKey } from './i18n/locales';

export interface LiveRotationCoachingCallbacks {
  onPhaseChange?: (phase: RotationPhase) => void;
  onComplete?: () => void;
  onCueSpoken?: (key: CoachingPhraseKey) => void;
}

export class LiveRotationCoachingEngine {
  private rotationPhaseEngine: RotationPhaseEngine;
  private audioCoach: AudioCoachService;
  private callbacks: LiveRotationCoachingCallbacks;

  private prevAngle: number | null = null;
  private prevTimestampMs: number | null = null;
  private samples: RotationSample[] = [];

  private lastSpokenPhase: RotationPhase | null = null;
  private lastSpokenCueTime: number = 0;
  private excessiveHipCount: number = 0;

  constructor(audioCoach: AudioCoachService, callbacks: LiveRotationCoachingCallbacks = {}) {
    this.audioCoach = audioCoach;
    this.callbacks = callbacks;
    this.rotationPhaseEngine = new RotationPhaseEngine();
  }

  public getSamples(): RotationSample[] {
    return this.samples;
  }

  public reset(): void {
    this.rotationPhaseEngine.reset();
    this.prevAngle = null;
    this.prevTimestampMs = null;
    this.samples = [];
    this.lastSpokenPhase = null;
    this.lastSpokenCueTime = 0;
    this.excessiveHipCount = 0;
  }

  public processFrame(frame: PoseFrame): void {
    const lms = frame.landmarks;
    if (!lms || lms.length < 33) return;

    const sample = extractRotationSample(lms, frame.frameId, frame.timestampMs);
    if (!sample) return;

    this.samples.push(sample);

    // Compute angular velocity
    let angularVelocity = 0;
    if (this.prevAngle !== null && this.prevTimestampMs !== null) {
      const dt = (frame.timestampMs - this.prevTimestampMs) / 1000;
      if (dt > 0.005 && dt < 0.5) {
        angularVelocity = (sample.isolatedThoracic - this.prevAngle) / dt;
      }
    }
    this.prevAngle = sample.isolatedThoracic;
    this.prevTimestampMs = frame.timestampMs;

    const prevPhase = this.rotationPhaseEngine.currentPhase;
    this.rotationPhaseEngine.processFrame(
      sample.isolatedThoracic,
      angularVelocity,
      frame.frameId,
      frame.timestampMs
    );
    const currentPhase = this.rotationPhaseEngine.currentPhase;

    if (currentPhase !== prevPhase) {
      this.callbacks.onPhaseChange?.(currentPhase);
      this.handlePhaseTransition(currentPhase, frame.timestampMs);
    }

    // Real-time compensation cue: excessive pelvic spin (> 22°)
    if (Math.abs(sample.pelvicRotation) > 22 && currentPhase.startsWith('ROTAT')) {
      this.excessiveHipCount++;
      if (this.excessiveHipCount > 10 && frame.timestampMs - this.lastSpokenCueTime > 4000) {
        this.speak('KEEP_HIPS_STILL', 'NORMAL', frame.timestampMs);
        this.excessiveHipCount = 0;
      }
    } else {
      this.excessiveHipCount = Math.max(0, this.excessiveHipCount - 1);
    }
  }

  private handlePhaseTransition(phase: RotationPhase, timeMs: number): void {
    switch (phase) {
      case 'ROTATING_LEFT':
        // User started left rotation
        break;

      case 'ENDPOINT_LEFT':
        this.speak('HOLD_POSITION', 'HIGH', timeMs);
        break;

      case 'RETURN_FROM_LEFT':
        this.speak('RETURN_CENTER', 'HIGH', timeMs);
        break;

      case 'CENTER_NEUTRAL':
        this.speak('ROTATE_RIGHT', 'HIGH', timeMs);
        break;

      case 'ENDPOINT_RIGHT':
        this.speak('HOLD_POSITION', 'HIGH', timeMs);
        break;

      case 'RETURN_FROM_RIGHT':
        this.speak('RETURN_CENTER', 'HIGH', timeMs);
        break;

      case 'COMPLETE':
        this.speak('ROTATION_DONE', 'HIGH', timeMs);
        this.callbacks.onComplete?.();
        break;
    }
  }

  private speak(key: CoachingPhraseKey, priority: CuePriority, timeMs: number): void {
    this.audioCoach.speak(key, priority, timeMs);
    this.lastSpokenCueTime = timeMs;
    this.callbacks.onCueSpoken?.(key);
  }
}
