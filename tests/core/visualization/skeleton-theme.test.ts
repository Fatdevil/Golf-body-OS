/**
 * skeleton-theme.test.ts
 * Unit tests for bilateral skeleton color theme, side classification,
 * confidence opacity calculation, and canvas rendering.
 */

import {
  SKELETON_THEME_VERSION,
  DEFAULT_SKELETON_THEME,
  CYAN_SKELETON_THEME,
  SKELETON_CONNECTIONS,
  getLandmarkSide,
  calculateConfidenceOpacity,
  getBoneStrokeColor,
  getJointFillColor,
  renderSkeletonCanvas,
  BoneConnection,
} from '../../../src/core/visualization/skeleton-theme';
import { LandmarkId, Landmark } from '../../../src/core/types/landmark';

describe('Skeleton Theme & Visualization', () => {
  describe('Constants and Version', () => {
    test('has version identifier', () => {
      expect(SKELETON_THEME_VERSION).toBe('SKELETON_THEME_V1');
    });

    test('default bilateral theme has distinct left and right colors', () => {
      expect(DEFAULT_SKELETON_THEME.leftSideColor).toBe('#60A5FA'); // Sky blue
      expect(DEFAULT_SKELETON_THEME.rightSideColor).toBe('#F87171'); // Coral red
      expect(DEFAULT_SKELETON_THEME.centerColor).toBe('#A78BFA'); // Violet
      expect(DEFAULT_SKELETON_THEME.gripColor).toBe('#FACC15'); // Gold
      expect(DEFAULT_SKELETON_THEME.minOpacity).toBe(0.25);
      expect(DEFAULT_SKELETON_THEME.maxOpacity).toBe(1.0);
    });

    test('cyan neon theme is defined', () => {
      expect(CYAN_SKELETON_THEME.leftSideColor).toBe('#00f0ff');
      expect(CYAN_SKELETON_THEME.rightSideColor).toBe('#00f0ff');
      expect(CYAN_SKELETON_THEME.torsoCrossColor).toBe('#00f0ff');
    });
  });

  describe('Landmark Side Classification (getLandmarkSide)', () => {
    test('classifies nose as center', () => {
      expect(getLandmarkSide(LandmarkId.NOSE)).toBe('center');
    });

    test('classifies all left landmarks as left', () => {
      const leftIds = [
        LandmarkId.LEFT_EYE_INNER,
        LandmarkId.LEFT_EYE,
        LandmarkId.LEFT_EYE_OUTER,
        LandmarkId.LEFT_EAR,
        LandmarkId.MOUTH_LEFT,
        LandmarkId.LEFT_SHOULDER,
        LandmarkId.LEFT_ELBOW,
        LandmarkId.LEFT_WRIST,
        LandmarkId.LEFT_PINKY,
        LandmarkId.LEFT_INDEX,
        LandmarkId.LEFT_THUMB,
        LandmarkId.LEFT_HIP,
        LandmarkId.LEFT_KNEE,
        LandmarkId.LEFT_ANKLE,
        LandmarkId.LEFT_HEEL,
        LandmarkId.LEFT_FOOT_INDEX,
      ];

      for (const id of leftIds) {
        expect(getLandmarkSide(id)).toBe('left');
      }
    });

    test('classifies all right landmarks as right', () => {
      const rightIds = [
        LandmarkId.RIGHT_EYE_INNER,
        LandmarkId.RIGHT_EYE,
        LandmarkId.RIGHT_EYE_OUTER,
        LandmarkId.RIGHT_EAR,
        LandmarkId.MOUTH_RIGHT,
        LandmarkId.RIGHT_SHOULDER,
        LandmarkId.RIGHT_ELBOW,
        LandmarkId.RIGHT_WRIST,
        LandmarkId.RIGHT_PINKY,
        LandmarkId.RIGHT_INDEX,
        LandmarkId.RIGHT_THUMB,
        LandmarkId.RIGHT_HIP,
        LandmarkId.RIGHT_KNEE,
        LandmarkId.RIGHT_ANKLE,
        LandmarkId.RIGHT_HEEL,
        LandmarkId.RIGHT_FOOT_INDEX,
      ];

      for (const id of rightIds) {
        expect(getLandmarkSide(id)).toBe('right');
      }
    });

    test('falls back to center for unmapped/unknown IDs', () => {
      expect(getLandmarkSide(999 as LandmarkId)).toBe('center');
    });
  });

  describe('Skeleton Connections (SKELETON_CONNECTIONS)', () => {
    test('contains connections covering arms, legs, torso, feet, and head', () => {
      expect(SKELETON_CONNECTIONS.length).toBeGreaterThanOrEqual(18);
    });

    test('every connection references valid LandmarkIds [0..32]', () => {
      for (const conn of SKELETON_CONNECTIONS) {
        expect(conn.from).toBeGreaterThanOrEqual(0);
        expect(conn.from).toBeLessThanOrEqual(32);
        expect(conn.to).toBeGreaterThanOrEqual(0);
        expect(conn.to).toBeLessThanOrEqual(32);
      }
    });

    test('includes dedicated grip connection between wrists', () => {
      const grip = SKELETON_CONNECTIONS.find(
        (c) =>
          (c.from === LandmarkId.LEFT_WRIST && c.to === LandmarkId.RIGHT_WRIST) ||
          (c.from === LandmarkId.RIGHT_WRIST && c.to === LandmarkId.LEFT_WRIST)
      );
      expect(grip).toBeDefined();
      expect(grip?.isGrip).toBe(true);
    });
  });

  describe('Confidence Opacity Calculation (calculateConfidenceOpacity)', () => {
    test('clamps values within [minOpacity, maxOpacity]', () => {
      expect(calculateConfidenceOpacity(0.0)).toBe(0.25);
      expect(calculateConfidenceOpacity(0.1)).toBe(0.25);
      expect(calculateConfidenceOpacity(0.25)).toBe(0.25);
      expect(calculateConfidenceOpacity(0.70)).toBeCloseTo(0.70);
      expect(calculateConfidenceOpacity(1.0)).toBe(1.0);
      expect(calculateConfidenceOpacity(1.5)).toBe(1.0);
    });

    test('gracefully falls back to maxOpacity when confidence is undefined, null, or NaN', () => {
      expect(calculateConfidenceOpacity(undefined)).toBe(1.0);
      expect(calculateConfidenceOpacity(null)).toBe(1.0);
      expect(calculateConfidenceOpacity(NaN)).toBe(1.0);
    });

    test('respects custom min and max opacity parameters', () => {
      expect(calculateConfidenceOpacity(0.05, 0.4, 0.8)).toBe(0.4);
      expect(calculateConfidenceOpacity(0.6, 0.4, 0.8)).toBeCloseTo(0.6);
      expect(calculateConfidenceOpacity(0.95, 0.4, 0.8)).toBe(0.8);
    });
  });

  describe('Color Resolution (getBoneStrokeColor & getJointFillColor)', () => {
    test('resolves bone colors correctly by anatomical side', () => {
      const leftBone: BoneConnection = {
        from: LandmarkId.LEFT_SHOULDER,
        to: LandmarkId.LEFT_ELBOW,
        side: 'left',
      };
      const rightBone: BoneConnection = {
        from: LandmarkId.RIGHT_SHOULDER,
        to: LandmarkId.RIGHT_ELBOW,
        side: 'right',
      };
      const crossBone: BoneConnection = {
        from: LandmarkId.LEFT_SHOULDER,
        to: LandmarkId.RIGHT_SHOULDER,
        side: 'cross',
      };
      const gripBone: BoneConnection = {
        from: LandmarkId.LEFT_WRIST,
        to: LandmarkId.RIGHT_WRIST,
        side: 'cross',
        isGrip: true,
      };

      expect(getBoneStrokeColor(leftBone, DEFAULT_SKELETON_THEME)).toBe('#60A5FA');
      expect(getBoneStrokeColor(rightBone, DEFAULT_SKELETON_THEME)).toBe('#F87171');
      expect(getBoneStrokeColor(crossBone, DEFAULT_SKELETON_THEME)).toBe('#94A3B8');
      expect(getBoneStrokeColor(gripBone, DEFAULT_SKELETON_THEME)).toBe('#FACC15');
    });

    test('resolves joint colors correctly including grip highlight', () => {
      expect(getJointFillColor(LandmarkId.LEFT_ELBOW, DEFAULT_SKELETON_THEME)).toBe('#60A5FA');
      expect(getJointFillColor(LandmarkId.RIGHT_ELBOW, DEFAULT_SKELETON_THEME)).toBe('#F87171');
      expect(getJointFillColor(LandmarkId.NOSE, DEFAULT_SKELETON_THEME)).toBe('#A78BFA');
      expect(getJointFillColor(LandmarkId.LEFT_WRIST, DEFAULT_SKELETON_THEME)).toBe('#FACC15');
      expect(getJointFillColor(LandmarkId.RIGHT_WRIST, DEFAULT_SKELETON_THEME)).toBe('#FACC15');
    });

    test('supports cyan theme overrides', () => {
      const leftBone: BoneConnection = {
        from: LandmarkId.LEFT_HIP,
        to: LandmarkId.LEFT_KNEE,
        side: 'left',
      };
      expect(getBoneStrokeColor(leftBone, CYAN_SKELETON_THEME)).toBe('#00f0ff');
      expect(getJointFillColor(LandmarkId.LEFT_HIP, CYAN_SKELETON_THEME)).toBe('#00f0ff');
    });
  });

  describe('Canvas 2D Rendering (renderSkeletonCanvas)', () => {
    let mockCtx: any;

    beforeEach(() => {
      mockCtx = {
        clearRect: jest.fn(),
        save: jest.fn(),
        restore: jest.fn(),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        stroke: jest.fn(),
        arc: jest.fn(),
        fill: jest.fn(),
        strokeStyle: '',
        fillStyle: '',
        lineWidth: 0,
        lineCap: '',
        lineJoin: '',
        globalAlpha: 1.0,
      };
    });

    test('handles empty or null landmarks gracefully without error', () => {
      expect(() => renderSkeletonCanvas(mockCtx, [], 1000, 1000)).not.toThrow();
      expect(() => renderSkeletonCanvas(mockCtx, null, 1000, 1000)).not.toThrow();
      expect(() => renderSkeletonCanvas(mockCtx, undefined, 1000, 1000)).not.toThrow();
      expect(mockCtx.beginPath).not.toHaveBeenCalled();
    });

    test('handles zero or negative canvas dimensions gracefully', () => {
      const landmarks: Landmark[] = [{ id: LandmarkId.NOSE, x: 0.5, y: 0.5, visibility: 0.9 }];
      expect(() => renderSkeletonCanvas(mockCtx, landmarks, 0, 100)).not.toThrow();
      expect(() => renderSkeletonCanvas(mockCtx, landmarks, 100, -10)).not.toThrow();
      expect(mockCtx.beginPath).not.toHaveBeenCalled();
    });

    test('clears rect when clearFirst option is enabled', () => {
      const landmarks: Landmark[] = [{ id: LandmarkId.NOSE, x: 0.5, y: 0.5, visibility: 0.9 }];
      renderSkeletonCanvas(mockCtx, landmarks, 800, 600, { clearFirst: true });
      expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
    });

    test('renders bones and joints with confidence-scaled alpha', () => {
      const landmarks: Landmark[] = [
        { id: LandmarkId.LEFT_SHOULDER, x: 0.4, y: 0.3, visibility: 0.8 },
        { id: LandmarkId.LEFT_ELBOW, x: 0.35, y: 0.45, visibility: 0.6 },
        { id: LandmarkId.RIGHT_SHOULDER, x: 0.6, y: 0.3, visibility: 0.1 }, // Low visibility
      ];

      renderSkeletonCanvas(mockCtx, landmarks, 1000, 1000, { minVisibilityThreshold: 0.20 });

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();

      // Left shoulder -> left elbow bone should be drawn
      expect(mockCtx.moveTo).toHaveBeenCalledWith(400, 300);
      expect(mockCtx.lineTo).toHaveBeenCalledWith(350, 450);
      expect(mockCtx.stroke).toHaveBeenCalled();

      // Should not draw right shoulder (vis 0.1 < 0.20)
      expect(mockCtx.lineTo).not.toHaveBeenCalledWith(600, 300);
    });

    test('supports raw landmark array where index represents landmark ID', () => {
      // Raw array without .id property
      const rawLandmarks = new Array(33).fill(null).map((_, i) => ({
        x: 0.5,
        y: 0.5,
        visibility: 0.95,
      }));

      expect(() => renderSkeletonCanvas(mockCtx, rawLandmarks, 1000, 1000)).not.toThrow();
      expect(mockCtx.stroke).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
    });
  });
});
