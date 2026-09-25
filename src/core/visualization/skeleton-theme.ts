/**
 * @module skeleton-theme
 * Bilateral color coding & confidence-based opacity for pose skeleton overlays.
 * Inspired by SwingSwang skeleton overlay design.
 */

import { Landmark, LandmarkId } from '../types/landmark';

export const SKELETON_THEME_VERSION = 'SKELETON_THEME_V1';

/**
 * Anatomical side classification for landmarks.
 */
export type LandmarkSide = 'left' | 'right' | 'center';

/**
 * Connection between two landmarks forming a bone segment.
 */
export interface BoneConnection {
  readonly from: LandmarkId;
  readonly to: LandmarkId;
  readonly side?: LandmarkSide | 'cross';
  readonly isGrip?: boolean;
}

/**
 * Visual styling theme for skeleton overlays.
 */
export interface SkeletonTheme {
  /** Left side limbs and joints (default: #60A5FA - blue-400) */
  readonly leftSideColor: string;
  /** Right side limbs and joints (default: #F87171 - red-400) */
  readonly rightSideColor: string;
  /** Center landmarks: nose, face midline (default: #A78BFA - violet-400) */
  readonly centerColor: string;
  /** Cross-body bones: shoulder-to-shoulder, hip-to-hip (default: #94A3B8 - slate-400) */
  readonly torsoCrossColor: string;
  /** Grip connection & wrist joints (default: #FACC15 - amber/gold) */
  readonly gripColor: string;
  /** Minimum rendering opacity for low-confidence landmarks [0.0 - 1.0] */
  readonly minOpacity: number;
  /** Maximum rendering opacity [0.0 - 1.0] */
  readonly maxOpacity: number;
  /** Default bone line width in pixels */
  readonly boneLineWidth: number;
  /** Default joint circle radius in pixels */
  readonly jointRadius: number;
  /** Highlighted grip / hand joint radius in pixels */
  readonly gripJointRadius: number;
}

/**
 * Default bilateral theme matching Swingswang color conventions.
 */
export const DEFAULT_SKELETON_THEME: SkeletonTheme = {
  leftSideColor: '#60A5FA',    // Sky blue (Swingswang blue-400)
  rightSideColor: '#F87171',   // Coral red (Swingswang red-400)
  centerColor: '#A78BFA',      // Violet-400
  torsoCrossColor: '#94A3B8',  // Slate-400 neutral
  gripColor: '#FACC15',        // Gold yellow-400
  minOpacity: 0.25,
  maxOpacity: 1.0,
  boneLineWidth: 3.0,
  jointRadius: 4.0,
  gripJointRadius: 6.0,
};

/**
 * Classic neon cyan theme for backwards compatibility or high-contrast styling.
 */
export const CYAN_SKELETON_THEME: SkeletonTheme = {
  leftSideColor: '#00f0ff',
  rightSideColor: '#00f0ff',
  centerColor: '#00f0ff',
  torsoCrossColor: '#00f0ff',
  gripColor: '#facc15',
  minOpacity: 0.35,
  maxOpacity: 1.0,
  boneLineWidth: 3.0,
  jointRadius: 4.0,
  gripJointRadius: 6.0,
};

/**
 * Standard bone connections for the MediaPipe 33-landmark pose model.
 */
export const SKELETON_CONNECTIONS: readonly BoneConnection[] = [
  // Torso
  { from: LandmarkId.LEFT_SHOULDER, to: LandmarkId.RIGHT_SHOULDER, side: 'cross' },
  { from: LandmarkId.LEFT_HIP, to: LandmarkId.RIGHT_HIP, side: 'cross' },
  { from: LandmarkId.LEFT_SHOULDER, to: LandmarkId.LEFT_HIP, side: 'left' },
  { from: LandmarkId.RIGHT_SHOULDER, to: LandmarkId.RIGHT_HIP, side: 'right' },

  // Arms - Left
  { from: LandmarkId.LEFT_SHOULDER, to: LandmarkId.LEFT_ELBOW, side: 'left' },
  { from: LandmarkId.LEFT_ELBOW, to: LandmarkId.LEFT_WRIST, side: 'left' },

  // Arms - Right
  { from: LandmarkId.RIGHT_SHOULDER, to: LandmarkId.RIGHT_ELBOW, side: 'right' },
  { from: LandmarkId.RIGHT_ELBOW, to: LandmarkId.RIGHT_WRIST, side: 'right' },

  // Grip (Wrist to Wrist)
  { from: LandmarkId.LEFT_WRIST, to: LandmarkId.RIGHT_WRIST, side: 'cross', isGrip: true },

  // Legs - Left
  { from: LandmarkId.LEFT_HIP, to: LandmarkId.LEFT_KNEE, side: 'left' },
  { from: LandmarkId.LEFT_KNEE, to: LandmarkId.LEFT_ANKLE, side: 'left' },

  // Legs - Right
  { from: LandmarkId.RIGHT_HIP, to: LandmarkId.RIGHT_KNEE, side: 'right' },
  { from: LandmarkId.RIGHT_KNEE, to: LandmarkId.RIGHT_ANKLE, side: 'right' },

  // Feet - Left
  { from: LandmarkId.LEFT_ANKLE, to: LandmarkId.LEFT_HEEL, side: 'left' },
  { from: LandmarkId.LEFT_HEEL, to: LandmarkId.LEFT_FOOT_INDEX, side: 'left' },
  { from: LandmarkId.LEFT_ANKLE, to: LandmarkId.LEFT_FOOT_INDEX, side: 'left' },

  // Feet - Right
  { from: LandmarkId.RIGHT_ANKLE, to: LandmarkId.RIGHT_HEEL, side: 'right' },
  { from: LandmarkId.RIGHT_HEEL, to: LandmarkId.RIGHT_FOOT_INDEX, side: 'right' },
  { from: LandmarkId.RIGHT_ANKLE, to: LandmarkId.RIGHT_FOOT_INDEX, side: 'right' },

  // Head / Face
  { from: LandmarkId.LEFT_EAR, to: LandmarkId.LEFT_EYE, side: 'left' },
  { from: LandmarkId.LEFT_EYE, to: LandmarkId.NOSE, side: 'center' },
  { from: LandmarkId.NOSE, to: LandmarkId.RIGHT_EYE, side: 'center' },
  { from: LandmarkId.RIGHT_EYE, to: LandmarkId.RIGHT_EAR, side: 'right' },
];

/**
 * Classifies a MediaPipe landmark ID into its anatomical side ('left', 'right', 'center').
 */
export function getLandmarkSide(id: LandmarkId): LandmarkSide {
  switch (id) {
    case LandmarkId.LEFT_EYE_INNER:
    case LandmarkId.LEFT_EYE:
    case LandmarkId.LEFT_EYE_OUTER:
    case LandmarkId.LEFT_EAR:
    case LandmarkId.MOUTH_LEFT:
    case LandmarkId.LEFT_SHOULDER:
    case LandmarkId.LEFT_ELBOW:
    case LandmarkId.LEFT_WRIST:
    case LandmarkId.LEFT_PINKY:
    case LandmarkId.LEFT_INDEX:
    case LandmarkId.LEFT_THUMB:
    case LandmarkId.LEFT_HIP:
    case LandmarkId.LEFT_KNEE:
    case LandmarkId.LEFT_ANKLE:
    case LandmarkId.LEFT_HEEL:
    case LandmarkId.LEFT_FOOT_INDEX:
      return 'left';

    case LandmarkId.RIGHT_EYE_INNER:
    case LandmarkId.RIGHT_EYE:
    case LandmarkId.RIGHT_EYE_OUTER:
    case LandmarkId.RIGHT_EAR:
    case LandmarkId.MOUTH_RIGHT:
    case LandmarkId.RIGHT_SHOULDER:
    case LandmarkId.RIGHT_ELBOW:
    case LandmarkId.RIGHT_WRIST:
    case LandmarkId.RIGHT_PINKY:
    case LandmarkId.RIGHT_INDEX:
    case LandmarkId.RIGHT_THUMB:
    case LandmarkId.RIGHT_HIP:
    case LandmarkId.RIGHT_KNEE:
    case LandmarkId.RIGHT_ANKLE:
    case LandmarkId.RIGHT_HEEL:
    case LandmarkId.RIGHT_FOOT_INDEX:
      return 'right';

    case LandmarkId.NOSE:
    default:
      return 'center';
  }
}

/**
 * Calculates a rendering opacity clamped between [minOpacity, maxOpacity]
 * based on the landmark tracking confidence (visibility or presence).
 * Defaults gracefully to maxOpacity if confidence is undefined or NaN.
 */
export function calculateConfidenceOpacity(
  confidence: number | undefined | null,
  minOpacity = DEFAULT_SKELETON_THEME.minOpacity,
  maxOpacity = DEFAULT_SKELETON_THEME.maxOpacity
): number {
  if (confidence === undefined || confidence === null || isNaN(confidence)) {
    return maxOpacity;
  }
  return Math.max(minOpacity, Math.min(maxOpacity, confidence));
}

/**
 * Resolves stroke color for a bone connection given the active theme.
 */
export function getBoneStrokeColor(
  connection: BoneConnection,
  theme: SkeletonTheme = DEFAULT_SKELETON_THEME
): string {
  if (connection.isGrip || (connection.from === LandmarkId.LEFT_WRIST && connection.to === LandmarkId.RIGHT_WRIST)) {
    return theme.gripColor;
  }
  if (connection.side === 'left') return theme.leftSideColor;
  if (connection.side === 'right') return theme.rightSideColor;
  if (connection.side === 'cross') return theme.torsoCrossColor;
  return theme.centerColor;
}

/**
 * Resolves fill color for a landmark joint given the active theme.
 */
export function getJointFillColor(
  id: LandmarkId,
  theme: SkeletonTheme = DEFAULT_SKELETON_THEME
): string {
  if (id === LandmarkId.LEFT_WRIST || id === LandmarkId.RIGHT_WRIST) {
    return theme.gripColor;
  }
  const side = getLandmarkSide(id);
  if (side === 'left') return theme.leftSideColor;
  if (side === 'right') return theme.rightSideColor;
  return theme.centerColor;
}

/**
 * Options for Canvas 2D skeleton rendering.
 */
export interface SkeletonCanvasRenderOptions {
  theme?: SkeletonTheme;
  minVisibilityThreshold?: number;
  showBones?: boolean;
  showJoints?: boolean;
  clearFirst?: boolean;
}

/**
 * Renders a full bilateral skeleton onto an HTML5 Canvas 2D context.
 * Uses confidence-weighted alpha for every bone and joint.
 */
export function renderSkeletonCanvas(
  ctx: CanvasRenderingContext2D,
  landmarks: Array<{ x: number; y: number; id?: number; visibility?: number; presence?: number }> | readonly Landmark[] | undefined | null,
  width: number,
  height: number,
  options: SkeletonCanvasRenderOptions = {}
): void {
  if (options.clearFirst) {
    ctx.clearRect(0, 0, width, height);
  }
  if (!landmarks || landmarks.length === 0 || width <= 0 || height <= 0) {
    return;
  }

  const theme = options.theme ?? DEFAULT_SKELETON_THEME;
  const minVisibility = options.minVisibilityThreshold ?? 0.20;
  const showBones = options.showBones ?? true;
  const showJoints = options.showJoints ?? true;

  // Build fast O(1) direct lookup map for up to 33 landmarks
  // Supports both Landmark objects with .id and raw arrays where index corresponds to landmark id
  const lmMap: (any | undefined)[] = new Array(33);
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    if (lm) {
      const id = lm.id !== undefined ? lm.id : i;
      if (id >= 0 && id < 33) {
        lmMap[id] = lm;
      }
    }
  }

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Draw Bones
  if (showBones) {
    ctx.lineWidth = theme.boneLineWidth;

    for (let i = 0; i < SKELETON_CONNECTIONS.length; i++) {
      const conn = SKELETON_CONNECTIONS[i];
      if (!conn) continue;

      const p1 = lmMap[conn.from];
      const p2 = lmMap[conn.to];
      if (!p1 || !p2) continue;

      const v1 = p1.visibility ?? 1.0;
      const v2 = p2.visibility ?? 1.0;

      if (v1 >= minVisibility && v2 >= minVisibility) {
        const avgConfidence = (v1 + v2) / 2;
        ctx.globalAlpha = calculateConfidenceOpacity(avgConfidence, theme.minOpacity, theme.maxOpacity);
        ctx.strokeStyle = getBoneStrokeColor(conn, theme);

        ctx.beginPath();
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
        ctx.stroke();
      }
    }
  }

  // 2. Draw Joints
  if (showJoints) {
    for (let id = 0; id < 33; id++) {
      const p = lmMap[id];
      if (!p) continue;

      const vis = p.visibility ?? 1.0;
      if (vis >= minVisibility) {
        ctx.globalAlpha = calculateConfidenceOpacity(vis, theme.minOpacity, theme.maxOpacity);
        ctx.fillStyle = getJointFillColor(id as LandmarkId, theme);

        const radius = (id === LandmarkId.LEFT_WRIST || id === LandmarkId.RIGHT_WRIST)
          ? theme.gripJointRadius
          : theme.jointRadius;

        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, radius, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}
