import { Landmark } from './landmark';

/**
 * @module pose-frame
 * Defines the structure for an individual frame of pose data.
 */
export const VERSION = 'POSE_FRAME_V1';

/**
 * Represents a single frame of pose estimation data.
 */
export interface PoseFrame {
  /** Sequential frame identifier */
  frameId: number;
  /** Timestamp in milliseconds */
  timestampMs: number;
  /** Source image width */
  width: number;
  /** Source image height */
  height: number;
  /** Normalized landmarks */
  landmarks: Landmark[];
  /** Optional world-coordinate landmarks */
  worldLandmarks?: Landmark[];
  /** Pose estimation model used */
  model: string;
  /** Version of the model used */
  modelVersion: string;
}

/**
 * A chronological sequence of pose frames.
 */
export type PoseSequence = PoseFrame[];
