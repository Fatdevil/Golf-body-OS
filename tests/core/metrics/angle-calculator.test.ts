import {
  distance2D,
  vectorAngle,
  interiorAngle,
  trunkInclination,
  shankInclination,
  posteriorHipShift,
  calculateHipHingeAngle2D
} from '../../../src/core/metrics/angle-calculator';

describe('Angle Calculator', () => {
  describe('distance2D', () => {
    it('calculates distance correctly', () => {
      expect(distance2D({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
      expect(distance2D({ x: -1, y: -1 }, { x: -1, y: -1 })).toBe(0);
    });
  });

  describe('vectorAngle', () => {
    it('calculates vector angle correctly', () => {
      expect(vectorAngle({ x: 1, y: 0 })).toBe(0);
      expect(vectorAngle({ x: 0, y: 1 })).toBe(90);
      expect(vectorAngle({ x: -1, y: 0 })).toBe(180);
      expect(vectorAngle({ x: 0, y: -1 })).toBe(-90);
    });
  });

  describe('interiorAngle', () => {
    it('calculates right angle (90°)', () => {
      const a = { x: 0, y: 1 };
      const b = { x: 0, y: 0 };
      const c = { x: 1, y: 0 };
      expect(interiorAngle(a, b, c)).toBeCloseTo(90);
    });

    it('calculates straight line (180°)', () => {
      const a = { x: -1, y: 0 };
      const b = { x: 0, y: 0 };
      const c = { x: 1, y: 0 };
      expect(interiorAngle(a, b, c)).toBeCloseTo(180);
    });

    it('calculates 45° angle', () => {
      const a = { x: 1, y: 1 };
      const b = { x: 0, y: 0 };
      const c = { x: 1, y: 0 };
      expect(interiorAngle(a, b, c)).toBeCloseTo(45);
    });

    it('handles collinear points edge case', () => {
      const a = { x: 1, y: 1 };
      const b = { x: 2, y: 2 };
      const c = { x: 3, y: 3 };
      expect(interiorAngle(a, b, c)).toBeCloseTo(180);
      
      const d = { x: 2, y: 2 };
      expect(interiorAngle(a, b, d)).toBeCloseTo(0);
    });

    it('handles zero-length vector edge case', () => {
      const a = { x: 0, y: 0 };
      const b = { x: 0, y: 0 };
      const c = { x: 1, y: 0 };
      expect(interiorAngle(a, b, c)).toBe(0);
    });
  });

  describe('trunkInclination', () => {
    it('standing upright (≈0°)', () => {
      expect(trunkInclination({ x: 0, y: 10 }, { x: 0, y: 0 })).toBeCloseTo(0);
    });

    it('horizontal (≈90°)', () => {
      expect(trunkInclination({ x: 10, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(90);
    });

    it('45° lean', () => {
      expect(trunkInclination({ x: 10, y: 10 }, { x: 0, y: 0 })).toBeCloseTo(45);
    });
  });

  describe('shankInclination', () => {
    it('vertical (0°)', () => {
      expect(shankInclination({ x: 0, y: 10 }, { x: 0, y: 0 })).toBeCloseTo(0);
    });

    it('forward lean', () => {
      expect(shankInclination({ x: 5, y: 5 }, { x: 0, y: 0 })).toBeCloseTo(45);
    });
  });

  describe('posteriorHipShift', () => {
    it('positive shift when hips behind ankle facing right', () => {
      // Facing right: positive is left of ankle (smaller X)
      expect(posteriorHipShift({ x: -2, y: 10 }, { x: 0, y: 0 }, 10, true)).toBe(0.2);
    });

    it('negative shift when hips in front of ankle facing right', () => {
      expect(posteriorHipShift({ x: 2, y: 10 }, { x: 0, y: 0 }, 10, true)).toBe(-0.2);
    });

    it('positive shift when hips behind ankle facing left', () => {
      // Facing left: posterior is right of ankle (larger X)
      expect(posteriorHipShift({ x: 2, y: 10 }, { x: 0, y: 0 }, 10, false)).toBe(0.2);
    });

    it('handles zero leg length safely', () => {
      expect(posteriorHipShift({ x: 2, y: 10 }, { x: 0, y: 0 }, 0, false)).toBe(0);
    });
  });

  describe('calculateHipHingeAngle2D', () => {
    it('standing (≈180°)', () => {
      const shoulder = { x: 0, y: 20 };
      const hip = { x: 0, y: 10 };
      const knee = { x: 0, y: 0 };
      expect(calculateHipHingeAngle2D(shoulder, hip, knee)).toBeCloseTo(180);
    });

    it('hinged (≈90°)', () => {
      const shoulder = { x: 10, y: 10 };
      const hip = { x: 0, y: 10 };
      const knee = { x: 0, y: 0 };
      expect(calculateHipHingeAngle2D(shoulder, hip, knee)).toBeCloseTo(90);
    });
  });
});
