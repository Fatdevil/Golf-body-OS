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

  describe('trunkInclination (unsigned magnitude from vertical)', () => {
    it('perfectly vertical upright = 0°', () => {
      expect(trunkInclination({ x: 0, y: 10 }, { x: 0, y: 0 })).toBeCloseTo(0);
    });

    it('30° forward tilt = 30°', () => {
      // 30 degrees from vertical means dy = cos(30), dx = sin(30)
      const dy = Math.cos(30 * Math.PI / 180) * 10;
      const dx = Math.sin(30 * Math.PI / 180) * 10;
      expect(trunkInclination({ x: dx, y: dy }, { x: 0, y: 0 })).toBeCloseTo(30);
    });

    it('45° forward tilt = 45°', () => {
      expect(trunkInclination({ x: 10, y: 10 }, { x: 0, y: 0 })).toBeCloseTo(45);
    });

    it('horizontal = 90°', () => {
      expect(trunkInclination({ x: 10, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(90);
    });

    it('backward lean (signed direction omitted) = unsigned magnitude', () => {
      // 30 degrees BACKWARD (negative dx) should still return +30°
      const dy = Math.cos(30 * Math.PI / 180) * 10;
      const dx = -Math.sin(30 * Math.PI / 180) * 10;
      expect(trunkInclination({ x: dx, y: dy }, { x: 0, y: 0 })).toBeCloseTo(30);
    });

    it('image Y-axis inversion handling (if raw image coords are passed, it should yield >90)', () => {
      // If someone accidentally passes raw Image (Y-down) coords where hip.y > shoulder.y
      // The math assumes Y-up, so it will interpret the torso as pointing DOWNWARDS, yielding ~150° instead of 30°.
      // The fix is applied in the adapter via Coordinate Transform Engine.
      const dy = -Math.cos(30 * Math.PI / 180) * 10; // Inverted Y
      const dx = Math.sin(30 * Math.PI / 180) * 10;
      expect(trunkInclination({ x: dx, y: dy }, { x: 0, y: 0 })).toBeCloseTo(150);
    });
  });

  describe('shankInclination (unsigned magnitude from vertical)', () => {
    it('perfectly vertical tibia = 0°', () => {
      expect(shankInclination({ x: 0, y: 10 }, { x: 0, y: 0 })).toBeCloseTo(0);
    });

    it('5° forward lean = 5°', () => {
      const dy = Math.cos(5 * Math.PI / 180) * 10;
      const dx = Math.sin(5 * Math.PI / 180) * 10;
      expect(shankInclination({ x: dx, y: dy }, { x: 0, y: 0 })).toBeCloseTo(5);
    });

    it('10° forward lean = 10°', () => {
      const dy = Math.cos(10 * Math.PI / 180) * 10;
      const dx = Math.sin(10 * Math.PI / 180) * 10;
      expect(shankInclination({ x: dx, y: dy }, { x: 0, y: 0 })).toBeCloseTo(10);
    });

    it('10° backward lean = 10° (unsigned convention)', () => {
      const dy = Math.cos(10 * Math.PI / 180) * 10;
      const dx = -Math.sin(10 * Math.PI / 180) * 10; // backward
      expect(shankInclination({ x: dx, y: dy }, { x: 0, y: 0 })).toBeCloseTo(10);
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
