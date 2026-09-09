/**
 * @module readiness-engine
 * Readiness Engine for Camera Positioning Guide.
 */
import { PoseFrame } from '../types/pose-frame';
import { LandmarkId } from '../types/landmark';

export type ReadinessState = 'NOT_READY' | 'ADJUSTING' | 'READY_CANDIDATE' | 'READY';

export type ReadinessFeedback =
  | 'STEP_INTO_FRAME'
  | 'NO_POSE'
  | 'WHOLE_BODY_NOT_VISIBLE'
  | 'SHOW_HEAD'
  | 'SHOW_FEET'
  | 'TURN_LEFT_SIDE_TO_CAMERA'
  | 'FACE_CAMERA'
  | 'MOVE_BACK'
  | 'MOVE_CLOSER'
  | 'MOVE_LEFT'
  | 'MOVE_RIGHT'
  | 'HOLD_STILL';

export interface ReadinessResult {
  state: ReadinessState;
  feedback: ReadinessFeedback | null;
  heldMs: number;
}

export interface ReadinessEngineConfig {
  requiredView?: 'SIDE' | 'FRONT';
}

export class ReadinessEngine {
  private currentState: ReadinessState = 'NOT_READY';
  private currentFeedback: ReadinessFeedback | null = 'NO_POSE';
  private requiredView: 'SIDE' | 'FRONT' = 'SIDE';
  
  private candidateStartTimeMs: number = -1;
  private lastUpdateTimeMs: number = -1;

  constructor(config: ReadinessEngineConfig = {}) {
    if (config.requiredView) {
      this.requiredView = config.requiredView;
    }
  }

  public setRequiredView(view: 'SIDE' | 'FRONT'): void {
    this.requiredView = view;
    this.reset();
  }

  public getRequiredView(): 'SIDE' | 'FRONT' {
    return this.requiredView;
  }

  // Configuration thresholds
  private readonly ENTER_READY_MS = 1000;
  private readonly EXIT_READY_GRACE_MS = 200;
  private graceStartTimeMs: number = -1;

  public process(frame: PoseFrame): ReadinessResult {
    this.lastUpdateTimeMs = frame.timestampMs;
    const lms = frame.landmarks;

    if (!lms || lms.length === 0) {
      return this.transition('NOT_READY', 'STEP_INTO_FRAME', frame.timestampMs);
    }

    // 1. VALID PERSON GATE
    // We require a coherent set of body landmarks to confirm a valid person.
    // e.g. at least one shoulder, one hip, and some head component.
    const hasShoulder = this.isAnyVisible(lms, [LandmarkId.LEFT_SHOULDER, LandmarkId.RIGHT_SHOULDER]);
    const hasHip = this.isAnyVisible(lms, [LandmarkId.LEFT_HIP, LandmarkId.RIGHT_HIP]);
    const hasHead = this.isAnyVisible(lms, [LandmarkId.NOSE, LandmarkId.LEFT_EAR, LandmarkId.RIGHT_EAR]);
    
    if (!hasShoulder || !hasHip || !hasHead) {
      return this.transition('NOT_READY', 'STEP_INTO_FRAME', frame.timestampMs);
    }

    // Calculate Bounding Box
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let visibleCount = 0;
    
    for (const lm of lms) {
      if (lm.visibility !== undefined && lm.visibility > 0.4) {
        visibleCount++;
        if (lm.x < minX) minX = lm.x;
        if (lm.x > maxX) maxX = lm.x;
        if (lm.y < minY) minY = lm.y;
        if (lm.y > maxY) maxY = lm.y;
      }
    }

    if (visibleCount < 8) {
      return this.transition('NOT_READY', 'WHOLE_BODY_NOT_VISIBLE', frame.timestampMs);
    }

    // 2. Whole body visibility (Head and Feet/Lower-Body landmarks)
    const headVisible = this.isAnyVisible(lms, [LandmarkId.NOSE, LandmarkId.LEFT_EAR, LandmarkId.RIGHT_EAR, LandmarkId.LEFT_EYE, LandmarkId.RIGHT_EYE]);
    const feetVisible = this.isAnyVisible(lms, [LandmarkId.LEFT_ANKLE, LandmarkId.RIGHT_ANKLE, LandmarkId.LEFT_HEEL, LandmarkId.RIGHT_HEEL]);
    const lowerBodyVisible = this.requiredView === 'FRONT'
      ? (feetVisible || this.isAnyVisible(lms, [LandmarkId.LEFT_KNEE, LandmarkId.RIGHT_KNEE]))
      : feetVisible;

    if (!headVisible) {
      return this.transition('ADJUSTING', 'SHOW_HEAD', frame.timestampMs);
    }
    if (!lowerBodyVisible) {
      return this.transition('ADJUSTING', 'SHOW_FEET', frame.timestampMs);
    }

    // 3. Distance & Vertical Framing
    // In BODY_METRIC_SPACE, Y is UP (+0.5 is top, -0.5 is bottom).
    const bodyHeight = maxY - minY;

    // If clipping edges or body is too large:
    if (bodyHeight > 0.88 || maxY > 0.485 || minY < -0.485) {
      return this.transition('ADJUSTING', 'MOVE_BACK', frame.timestampMs);
    }
    // If body is too small in the frame:
    const minHeight = this.requiredView === 'FRONT' ? 0.30 : 0.45;
    if (bodyHeight < minHeight) {
      return this.transition('ADJUSTING', 'MOVE_CLOSER', frame.timestampMs);
    }

    // 4. Orientation Check
    const leftShoulder = lms.find(l => l.id === LandmarkId.LEFT_SHOULDER);
    const rightShoulder = lms.find(l => l.id === LandmarkId.RIGHT_SHOULDER);
    const leftHip = lms.find(l => l.id === LandmarkId.LEFT_HIP);
    const rightHip = lms.find(l => l.id === LandmarkId.RIGHT_HIP);

    if (this.requiredView === 'FRONT') {
      // In FRONT view, user should face camera squarely:
      // Both shoulders and both hips should be visible and spread laterally across the frontal plane.
      if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
        return this.transition('ADJUSTING', 'FACE_CAMERA', frame.timestampMs);
      }

      const torsoHeight = Math.max(0.08, Math.abs(((leftShoulder.y + rightShoulder.y) / 2) - ((leftHip.y + rightHip.y) / 2)));
      const shoulderDx = Math.abs(rightShoulder.x - leftShoulder.x);
      const hipDx = Math.abs(rightHip.x - leftHip.x);
      const shoulderDz = Math.abs((leftShoulder.z ?? 0) - (rightShoulder.z ?? 0));
      const hipDz = Math.abs((leftHip.z ?? 0) - (rightHip.z ?? 0));

      const shoulderRatio = shoulderDx / torsoHeight;
      const hipRatio = hipDx / torsoHeight;

      // In FRONT view, shoulders and hips have significant lateral spread relative to torso height.
      // If user is turned sideways (profile view):
      // - shoulderRatio is typically < 0.35
      // - hipRatio is typically < 0.22
      // - shoulderDz or hipDz is large (> 0.35)
      const isTurnedSideways = 
        shoulderRatio < 0.35 || 
        hipRatio < 0.22 || 
        (shoulderDz > 0.35 && hipDz > 0.22) ||
        shoulderDz > 0.48;

      if (isTurnedSideways) {
        return this.transition('ADJUSTING', 'FACE_CAMERA', frame.timestampMs);
      }
    } else {
      // SIDE view (Left side closest to camera)
      if (
        leftShoulder?.z !== undefined && 
        rightShoulder?.z !== undefined && 
        leftHip?.z !== undefined && 
        rightHip?.z !== undefined
      ) {
        const shoulderZDiff = leftShoulder.z - rightShoulder.z;
        const hipZDiff = leftHip.z - rightHip.z;
        
        // If right side is noticeably closer to camera than left side
        if (shoulderZDiff > 0.06 || hipZDiff > 0.06) {
          return this.transition('ADJUSTING', 'TURN_LEFT_SIDE_TO_CAMERA', frame.timestampMs);
        }
      } else {
        return this.transition('ADJUSTING', 'TURN_LEFT_SIDE_TO_CAMERA', frame.timestampMs);
      }
    }

    // 5. Horizontal positioning (X ranges -0.5 to 0.5)
    if (minX < -0.46) return this.transition('ADJUSTING', 'MOVE_RIGHT', frame.timestampMs);
    if (maxX > 0.46) return this.transition('ADJUSTING', 'MOVE_LEFT', frame.timestampMs);

    // 6. Stability (Hold Still) & 7. READY are handled in transitionToCandidate
    return this.transitionToCandidate(frame.timestampMs);
  }

  private isAnyVisible(lms: any[], ids: LandmarkId[]): boolean {
    return ids.some(id => {
      const lm = lms.find(l => l.id === id);
      return lm && lm.visibility > 0.5;
    });
  }

  private transition(state: ReadinessState, feedback: ReadinessFeedback, timeMs: number): ReadinessResult {
    if (this.currentState === 'READY') {
      // Hysteresis: wait for grace period before dropping out of READY
      if (this.graceStartTimeMs === -1) {
        this.graceStartTimeMs = timeMs;
        return this.makeResult('READY', 'HOLD_STILL', timeMs);
      } else if (timeMs - this.graceStartTimeMs < this.EXIT_READY_GRACE_MS) {
        return this.makeResult('READY', 'HOLD_STILL', timeMs);
      }
    }
    
    // Actually drop state
    this.currentState = state;
    this.currentFeedback = feedback;
    this.candidateStartTimeMs = -1;
    this.graceStartTimeMs = -1;
    
    return this.makeResult();
  }

  private transitionToCandidate(timeMs: number): ReadinessResult {
    if (this.currentState === 'NOT_READY' || this.currentState === 'ADJUSTING') {
      this.currentState = 'READY_CANDIDATE';
      this.currentFeedback = 'HOLD_STILL';
      this.candidateStartTimeMs = timeMs;
      this.graceStartTimeMs = -1;
    } else if (this.currentState === 'READY_CANDIDATE') {
      if (timeMs - this.candidateStartTimeMs >= this.ENTER_READY_MS) {
        this.currentState = 'READY';
        this.currentFeedback = null;
      }
    } else if (this.currentState === 'READY') {
      this.graceStartTimeMs = -1; // Reset grace on good frame
    }
    return this.makeResult();
  }

  private makeResult(overrideState?: ReadinessState, overrideFeedback?: ReadinessFeedback, timeMs?: number): ReadinessResult {
    const heldMs = this.currentState === 'READY' || this.currentState === 'READY_CANDIDATE' 
      ? ((timeMs || this.lastUpdateTimeMs) - this.candidateStartTimeMs) 
      : 0;

    return {
      state: overrideState || this.currentState,
      feedback: overrideFeedback !== undefined ? overrideFeedback : this.currentFeedback,
      heldMs: Math.max(0, heldMs)
    };
  }

  public reset() {
    this.currentState = 'NOT_READY';
    this.currentFeedback = 'STEP_INTO_FRAME';
    this.candidateStartTimeMs = -1;
    this.lastUpdateTimeMs = -1;
    this.graceStartTimeMs = -1;
  }
}
