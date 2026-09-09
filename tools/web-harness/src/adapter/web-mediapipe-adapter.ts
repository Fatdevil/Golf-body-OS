import { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { Landmark, LandmarkId } from '../../../../src/core/types/landmark';
import { PoseFrame } from '../../../../src/core/types/pose-frame';
import { normalizedToBodyMetric, TransformParams } from '../../../../src/core/coordinates/coordinate-transform';

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
  
  // Mock transform params for browser (assumes upright camera)
  const transformParams: TransformParams = {
    sensorOrientation: 0,
    imageWidth: width,
    imageHeight: height,
    previewWidth: width,
    previewHeight: height,
    isMirrored: false,
    gravityVector: { x: 0, y: -1, z: 0 }
  };
  
  for (let i = 0; i < 33; i++) {
    const lm = rawLandmarks[i] as any;
    const visibility = lm.visibility ?? 1.0;
    const presence = lm.presence ?? visibility;
    const lmZ = lm.z ?? 0;

    if (!Number.isFinite(lm.x) || !Number.isFinite(lm.y)) {
      throw new WebBridgeError('Landmark X and Y values must be finite');
    }
    
    // Transform to BODY_METRIC_SPACE
    const metric = normalizedToBodyMetric({ x: lm.x, y: lm.y }, transformParams);

    landmarks.push({
      id: i as LandmarkId,
      x: metric.x,
      y: metric.y,
      z: lmZ,
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
        const lmZ = lm.z ?? 0;
        
        // Transform to BODY_METRIC_SPACE
        const metric = normalizedToBodyMetric({ x: lm.x, y: lm.y }, transformParams);
        
        worldLandmarks.push({
          id: i as LandmarkId,
          x: metric.x,
          y: metric.y,
          z: lmZ,
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
