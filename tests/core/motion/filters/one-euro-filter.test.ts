import { OneEuroFilter } from '../../../../src/core/motion/filters/one-euro-filter';

describe('One Euro Filter', () => {
  it('reduces jitter on stationary signal', () => {
    const filter = new OneEuroFilter({ minCutoff: 0.1, beta: 0.0, dCutoff: 1.0 });
    let value = 10;
    const out = [];
    
    for (let i = 0; i < 100; i++) {
      // Add random noise [-0.5, 0.5]
      const noise = Math.random() - 0.5;
      out.push(filter.filter(value + noise, i * 16));
    }
    
    // The variance of the output should be much smaller than the input variance
    const variance = out.reduce((acc, val) => acc + Math.pow(val - 10, 2), 0) / out.length;
    expect(variance).toBeLessThan(0.1);
  });

  it('handles step input with reasonable latency', () => {
    const filter = new OneEuroFilter({ minCutoff: 1.0, beta: 0.1, dCutoff: 1.0 });
    
    filter.filter(0, 0);
    filter.filter(0, 16);
    
    // Step input
    const val = filter.filter(100, 32);
    
    // Output should adapt quickly due to high speed (dx)
    expect(val).toBeGreaterThan(10);
  });

  it('resets correctly', () => {
    const filter = new OneEuroFilter();
    
    filter.filter(0, 0);
    filter.filter(10, 16);
    
    filter.reset();
    
    const val = filter.filter(100, 32);
    // After reset, it should just return the first value
    expect(val).toBe(100);
  });
});
