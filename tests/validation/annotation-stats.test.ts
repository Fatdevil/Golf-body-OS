import { calculateSummary, sampleStandardDeviation, pixelDistance, normalizedImageDistance } from '../../src/core/math/annotation-stats';

describe('Annotation Stats (GT-1)', () => {
  it('should calculate sample standard deviation correctly', () => {
    // Known values: 10, 12, 23, 23, 16, 23, 21, 16
    // Mean: 18, Sample SD: ~5.237
    const values = [10, 12, 23, 23, 16, 23, 21, 16];
    const sd = sampleStandardDeviation(values);
    expect(sd).toBeCloseTo(5.237, 3);

    // SD of identical values is 0
    expect(sampleStandardDeviation([5, 5, 5])).toBeCloseTo(0, 5);
  });

  it('should calculate summary correctly', () => {
    const manualValues = [10, 12, 14]; // mean = 12
    const mediapipeValue = 15;

    const summary = calculateSummary(manualValues, mediapipeValue);
    
    expect(summary.manualMean).toBe(12);
    expect(summary.manualMin).toBe(10);
    expect(summary.manualMax).toBe(14);
    expect(summary.manualRange).toBe(4);
    expect(summary.frameLocalMediaPipeValue).toBe(15);
    expect(summary.signedError).toBe(3); // 15 - 12
    expect(summary.absoluteError).toBe(3);
  });

  it('should calculate distances correctly', () => {
    const p1 = { x: 0.1, y: 0.2 };
    const p2 = { x: 0.4, y: 0.6 }; // dx = 0.3, dy = 0.4 -> dist = 0.5 in normalized space
    
    expect(normalizedImageDistance(p1, p2)).toBeCloseTo(0.5, 5);
    
    // In a 1000x1000 image, 0.5 normalized dist = 500 pixels
    expect(pixelDistance(p1, p2, 1000, 1000)).toBeCloseTo(500, 5);
  });
});
