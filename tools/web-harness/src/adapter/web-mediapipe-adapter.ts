import { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { Landmark, LandmarkId } from '../../../../src/core/types/landmark';
import { PoseFrame } from '../../../../src/core/types/pose-frame';

export class WebBridgeError extends Error {
  code: string;
  constructor(message: string, code: string = 'INVALID_WEB_POSE_PAYLOAD') {
    super(message);
    this.name = 'WebBridgeError';
    this.code = code;
  }
}

export function convertWebResultToPoseFrame(
  webResult: PoseLandmarkerResult,
  frameId: number,
  timestampMs: number,
  width: number,
  height: number,
  modelInfo: { model: string; modelVersion: string }
): PoseFrame | null {
  if (!webResult.landmarks || webResult.landmarks.length === 0) {
    return null;
  }

  const rawLandmarks = webResult.landmarks[0];
  if (rawLandmarks.length !== 33) {
    throw new WebBridgeError(`Expected exactly 33 landmarks, got ${rawLandmarks.length}`);
  }

  const landmarks: Landmark[] = [];
  
  for (let i = 0; i < 33; i++) {
    const lm = rawLandmarks[i] as any;
    const visibility = lm.visibility ?? 1.0;
    const presence = lm.presence ?? visibility;

    if (!Number.isFinite(lm.x) || !Number.isFinite(lm.y) || !Number.isFinite(lm.z) || 
        !Number.isFinite(visibility) || !Number.isFinite(presence)) {
      throw new WebBridgeError('Landmark values must be finite');
    }
    landmarks.push({
      id: i as LandmarkId,
      x: lm.x,
      y: lm.y,
      z: lm.z,
      visibility,
      presence
    });
  }

  let worldLandmarks: Landmark[] | undefined;
  if (webResult.worldLandmarks && webResult.worldLandmarks.length > 0) {
    const rawWorldLandmarks = webResult.worldLandmarks[0];
    if (rawWorldLandmarks.length === 33) {
      worldLandmarks = [];
      for (let i = 0; i < 33; i++) {
        const lm = rawWorldLandmarks[i] as any;
        const visibility = lm.visibility ?? 1.0;
        const presence = lm.presence ?? visibility;
        worldLandmarks.push({
          id: i as LandmarkId,
          x: lm.x,
          y: lm.y,
          z: lm.z,
          visibility,
          presence
        });
      }
    }
  }

  return {
    frameId,
    timestampMs,
    width,
    height,
    landmarks,
    worldLandmarks,
    model: modelInfo.model,
    modelVersion: modelInfo.modelVersion
  };
}
