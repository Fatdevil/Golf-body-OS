import { OutlierRejector, MAX_INTERPOLATION_GAP_FRAMES } from '../../../../src/core/motion/filters/outlier-rejector';

describe('Outlier Rejector', () => {
  it('accepts normal values', () => {
    const rejector = new OutlierRejector({ minThreshold: 1.0 });
    for (let i = 0; i < 10; i++) {
      const res = rejector.process(10 + Math.random() * 0.1, i * 16);
      expect(res.type).toBe('VALID');
    }
  });

  it('rejects a single outlier and interpolates upon recovery', () => {
    const rejector = new OutlierRejector();
    for (let i = 0; i < 10; i++) {
      rejector.process(10, i * 16);
    }
    
    // Outlier
    const resOutlier = rejector.process(100, 10 * 16);
    expect(resOutlier.type).toBe('REJECTED');
    
    // Recovery
    const resRecovery = rejector.process(10, 11 * 16);
    expect(resRecovery.type).toBe('INTERPOLATED');
    if (resRecovery.type === 'INTERPOLATED') {
      expect(resRecovery.gapSize).toBe(1);
    }
  });

  it('returns INVALID_SEGMENT for gap > 3', () => {
    const rejector = new OutlierRejector();
    for (let i = 0; i < 10; i++) {
      rejector.process(10, i * 16);
    }
    
    let res;
    // 4 consecutive outliers
    for (let i = 0; i < 4; i++) {
      res = rejector.process(100, (10 + i) * 16);
    }
    
    expect(res!.type).toBe('INVALID_SEGMENT');
  });

  it('does not fabricate movement beyond limit (gap <= 3)', () => {
    const rejector = new OutlierRejector();
    for (let i = 0; i < 10; i++) {
      rejector.process(10, i * 16);
    }
    
    rejector.process(100, 10 * 16);
    rejector.process(100, 11 * 16);
    rejector.process(100, 12 * 16);
    // Gap size is 3, these are REJECTED. Next valid will interpolate.
    
    const res = rejector.process(10, 13 * 16);
    expect(res.type).toBe('INTERPOLATED');
    if (res.type === 'INTERPOLATED') {
      expect(res.gapSize).toBe(3);
    }
  });

  it('resists warm-up poisoning from outlier initial frames', () => {
    const rejector = new OutlierRejector({ minThreshold: 0.5 });

    // Warm-up: 4 normal values and 1 extreme outlier
    rejector.process(10, 0);
    rejector.process(10, 16);
    rejector.process(1000, 32);  // Extreme outlier during model warm-up
    rejector.process(10, 48);
    rejector.process(10, 64);    // 5th frame → warm-up complete, median = 10

    // After warm-up: normal values should be accepted, not rejected
    // If warm-up were naive (mean of all 5), mean would be ~208, std ~396
    // and normal values like 10 would pass but the baseline would be wrong
    const res = rejector.process(10, 80);
    expect(res.type).toBe('VALID');

    // A real outlier should still be rejected
    const res2 = rejector.process(1000, 96);
    expect(res2.type).toBe('REJECTED');
  });
});
