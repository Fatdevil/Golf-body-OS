import {
  normalizedToPreview,
  previewToNormalized,
  normalizedToBodyMetric,
  rotateByGravity,
  TransformParams,
} from '../../../src/core/coordinates/coordinate-transform';

describe('Coordinate Transform Engine', () => {
  const defaultParams: TransformParams = {
    sensorOrientation: 0,
    imageWidth: 1080,
    imageHeight: 1920,
    previewWidth: 1080,
    previewHeight: 1920,
    isMirrored: false,
    gravityVector: { x: 0, y: -1, z: 0 },
  };

  describe('normalizedToPreview', () => {
    it('maps center point correctly', () => {
      const point = { x: 0.5, y: 0.5 };
      const preview = normalizedToPreview(point, defaultParams);
      expect(preview.x).toBeCloseTo(540);
      expect(preview.y).toBeCloseTo(960);
    });

    it('maps corner points correctly', () => {
      const tl = normalizedToPreview({ x: 0, y: 0 }, defaultParams);
      expect(tl.x).toBeCloseTo(0);
      expect(tl.y).toBeCloseTo(0);

      const br = normalizedToPreview({ x: 1, y: 1 }, defaultParams);
      expect(br.x).toBeCloseTo(1080);
      expect(br.y).toBeCloseTo(1920);
    });

    it('handles mirroring correctly', () => {
      const params = { ...defaultParams, isMirrored: true };
      const point = { x: 0.25, y: 0.5 };
      const preview = normalizedToPreview(point, params);
      expect(preview.x).toBeCloseTo(1080 * 0.75);
    });

    it('handles different aspect ratios with aspect-fill', () => {
      const params = { ...defaultParams, previewWidth: 1920, previewHeight: 1920 };
      const point = { x: 0, y: 0 };
      const preview = normalizedToPreview(point, params);
      expect(preview.x).toBeCloseTo(0);
      expect(preview.y).toBeLessThan(0);
    });
  });

  describe('previewToNormalized', () => {
    it('round-trips correctly', () => {
      const point = { x: 0.33, y: 0.66 };
      const preview = normalizedToPreview(point, defaultParams);
      const restored = previewToNormalized(preview, defaultParams);
      
      expect(restored.x).toBeCloseTo(point.x);
      expect(restored.y).toBeCloseTo(point.y);
    });
  });

  describe('normalizedToBodyMetric', () => {
    it('flips Y for perfect vertical gravity', () => {
      const params = { ...defaultParams, gravityVector: { x: 0, y: -1, z: 0 } };
      const point = { x: 0, y: 0 };
      const metric = normalizedToBodyMetric(point, params);
      expect(metric.x).toBeCloseTo(-0.5);
      expect(metric.y).toBeCloseTo(0.5);
    });

    it('corrects for gravity tilt', () => {
      const params = { ...defaultParams, gravityVector: { x: 1, y: 0, z: 0 } };
      const point = { x: 1, y: 0.5 };
      const metric = normalizedToBodyMetric(point, params);
      expect(metric).toBeDefined();
    });
  });
});
