/**
 * @module manual-adapter
 * Adapter to translate manual 2D annotations into body metrics.
 */
import { Point2D, normalizedToBodyMetric, TransformParams } from '../../../../src/core/coordinates/coordinate-transform';
import { Landmark, LandmarkId } from '../../../../src/core/types/landmark';
import { ManualAnnotation } from '../../../../src/core/math/annotation-stats';
import { extractRepMetrics, RepetitionResult } from '../../../../src/core/metrics/hip-hinge-metrics';

export function processManualAnnotation(
  annotation: ManualAnnotation,
  imageWidth: number,
  imageHeight: number,
  side: 'LEFT' | 'RIGHT'
): RepetitionResult {
  const transformParams: TransformParams = {
    sensorOrientation: 0,
    imageWidth,
    imageHeight,
    previewWidth: imageWidth,
    previewHeight: imageHeight,
    isMirrored: false,
    gravityVector: { x: 0, y: -1, z: 0 }
  };

  const toMetric = (p: { x: number, y: number }) => normalizedToBodyMetric(p, transformParams);

  const metricShoulder = toMetric(annotation.shoulder);
  const metricHip = toMetric(annotation.hip);
  const metricKnee = toMetric(annotation.knee);
  const metricAnkle = toMetric(annotation.ankle);

  const landmarks: Landmark[] = [
    { id: side === 'LEFT' ? LandmarkId.LEFT_SHOULDER : LandmarkId.RIGHT_SHOULDER, x: metricShoulder.x, y: metricShoulder.y, z: 0, visibility: 1.0, presence: 1.0 },
    { id: side === 'LEFT' ? LandmarkId.LEFT_HIP : LandmarkId.RIGHT_HIP, x: metricHip.x, y: metricHip.y, z: 0, visibility: 1.0, presence: 1.0 },
    { id: side === 'LEFT' ? LandmarkId.LEFT_KNEE : LandmarkId.RIGHT_KNEE, x: metricKnee.x, y: metricKnee.y, z: 0, visibility: 1.0, presence: 1.0 },
    { id: side === 'LEFT' ? LandmarkId.LEFT_ANKLE : LandmarkId.RIGHT_ANKLE, x: metricAnkle.x, y: metricAnkle.y, z: 0, visibility: 1.0, presence: 1.0 },
  ];

  if (annotation.heel) {
    const metricHeel = toMetric(annotation.heel);
    landmarks.push({ id: side === 'LEFT' ? LandmarkId.LEFT_HEEL : LandmarkId.RIGHT_HEEL, x: metricHeel.x, y: metricHeel.y, z: 0, visibility: 1.0, presence: 1.0 });
  }

  // We provide dummy baseline since we don't have it for manual yet (Posterior shift is excluded from GT-1 for now)
  const dummyBaseline = [...landmarks];

  return extractRepMetrics(landmarks, dummyBaseline, 0, side, false, annotation.repIndex);
}
