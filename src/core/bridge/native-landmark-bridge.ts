import { Landmark, LandmarkId } from '../types/landmark';
import { PoseFrame } from '../types/pose-frame';
import { NativeLandmarkResult, NativeModelInfo } from '../../../modules/golf-body-pose';

export const VERSION = 'NATIVE_LANDMARK_BRIDGE_V1';

/** Expected SHA-256 of the bundled pose_landmarker_full.task model */
export const EXPECTED_MODEL_SHA256 = '5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1';

/**
 * Custom error for native bridge validation failures.
 */
export class NativeBridgeError extends Error {
  code: string;
  constructor(message: string, code: string = 'INVALID_NATIVE_POSE_PAYLOAD') {
    super(message);
    this.name = 'NativeBridgeError';
    this.code = code;
  }
}

/**
 * Validates model integrity by comparing runtime SHA against expected
 * @param runtimeSha256 - The SHA-256 hash of the loaded model
 * @returns true if valid
 */
export function validateModelIntegrity(runtimeSha256: string): boolean {
  return runtimeSha256 === EXPECTED_MODEL_SHA256;
}

function parseAndValidateLandmarks(flatArray: number[]): Landmark[] {
  if (!flatArray || flatArray.length !== 198) {
    throw new NativeBridgeError('Invalid landmark array length, expected 198');
  }

  const landmarks: Landmark[] = [];
  const seenIds = new Set<number>();

  for (let i = 0; i < 198; i += 6) {
    const id = flatArray[i];
    const x = flatArray[i + 1];
    const y = flatArray[i + 2];
    const z = flatArray[i + 3];
    const visibility = flatArray[i + 4];
    const presence = flatArray[i + 5];

    if (!Number.isFinite(id) || !Number.isFinite(x) || !Number.isFinite(y) ||
        !Number.isFinite(z) || !Number.isFinite(visibility) || !Number.isFinite(presence)) {
      throw new NativeBridgeError('Landmark values must be finite');
    }

    if (id < 0 || id > 32) {
      throw new NativeBridgeError(`Invalid landmark ID: ${id}`);
    }

    if (seenIds.has(id)) {
      throw new NativeBridgeError(`Duplicate landmark ID: ${id}`);
    }

    seenIds.add(id);

    landmarks.push({
      id: id as LandmarkId,
      x,
      y,
      z,
      visibility,
      presence
    });
  }

  if (seenIds.size !== 33) {
    throw new NativeBridgeError('Expected exactly 33 unique landmark IDs');
  }

  return landmarks.sort((a, b) => a.id - b.id);
}

/**
 * Converts native flat-array landmarks into a canonical PoseFrame.
 */
export function convertNativeResultToPoseFrame(
  nativeResult: NativeLandmarkResult,
  modelInfo: NativeModelInfo,
  frameId: number
): PoseFrame {
  const landmarks = parseAndValidateLandmarks(nativeResult.landmarks);
  let worldLandmarks: Landmark[] | undefined;

  if (nativeResult.worldLandmarks && nativeResult.worldLandmarks.length === 198) {
    worldLandmarks = parseAndValidateLandmarks(nativeResult.worldLandmarks);
  }

  return {
    frameId,
    timestampMs: nativeResult.timestampMs,
    width: nativeResult.width,
    height: nativeResult.height,
    landmarks,
    worldLandmarks,
    model: modelInfo.model,
    modelVersion: modelInfo.version
  };
}
