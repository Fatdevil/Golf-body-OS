/**
 * PoseEngine Factory — Returns the appropriate PoseEngine implementation.
 *
 * Production: Always returns MediaPipePoseEngine.
 * Tests: Returns a test double ONLY when explicitly configured via
 *        __DEV__ + POSE_ENGINE_MOCK=true environment variable.
 *
 * CRITICAL: There is no try/catch fallback to mocks. This is forbidden (spec §12).
 *
 * @module pose-engine.factory
 * @version POSE_ENGINE_FACTORY_V1
 */

import { PoseEngine } from './pose-engine.interface';

export const VERSION = 'POSE_ENGINE_FACTORY_V1';

/**
 * Creates the production PoseEngine instance.
 *
 * This factory exists to:
 * 1. Enforce the single construction path
 * 2. Enable test doubles in __DEV__ mode only
 * 3. Prevent accidental mock usage in production
 */
export function createPoseEngine(): PoseEngine {
  // In production, always return the real MediaPipe engine.
  // The actual MediaPipePoseEngine import is deferred to avoid
  // circular dependencies and to keep this file testable.
  //
  // NOTE: The real implementation will be:
  //   const { MediaPipePoseEngine } = require('./mediapipe-pose-engine');
  //   return new MediaPipePoseEngine();
  //
  // For now, we throw to indicate this must be wired up during S4/S5.
  throw new Error(
    'MediaPipePoseEngine not yet available. ' +
    'This will be implemented in S4 (iOS) / S5 (Android).'
  );
}
