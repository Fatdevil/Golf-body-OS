/**
 * @module SkeletonOverlay
 * React Native Skia GPU-accelerated bilateral skeleton overlay for mobile.
 * Directly corresponds to SwingSwang's SkeletonOverlay component.
 */

import React, { useMemo } from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { Canvas, Line, Circle, vec } from '@shopify/react-native-skia';
import { PoseFrame } from '../../core/types/pose-frame';
import { Landmark, LandmarkId } from '../../core/types/landmark';
import {
  DEFAULT_SKELETON_THEME,
  SKELETON_CONNECTIONS,
  SkeletonTheme,
  calculateConfidenceOpacity,
  getBoneStrokeColor,
  getJointFillColor,
} from '../../core/visualization/skeleton-theme';

export interface SkeletonOverlayProps {
  /** The current pose frame to render */
  poseFrame: PoseFrame | null;
  /** Width of the target render surface in display points */
  displayWidth: number;
  /** Height of the target render surface in display points */
  displayHeight: number;
  /** Optional theme override */
  theme?: SkeletonTheme;
  /** Minimum landmark visibility required to render [0.0 - 1.0] (default: 0.20) */
  minVisibilityThreshold?: number;
  /** Optional style override for the container */
  style?: StyleProp<ViewStyle>;
}

export function SkeletonOverlay({
  poseFrame,
  displayWidth,
  displayHeight,
  theme = DEFAULT_SKELETON_THEME,
  minVisibilityThreshold = 0.20,
  style,
}: SkeletonOverlayProps) {
  if (!poseFrame || !poseFrame.landmarks || displayWidth <= 0 || displayHeight <= 0) {
    return null;
  }

  // Build indexed lookup map for the 33 MediaPipe landmarks
  const lmMap = useMemo(() => {
    const map: (Landmark | undefined)[] = new Array(33);
    const lms = poseFrame.landmarks;
    for (let i = 0; i < lms.length; i++) {
      const lm = lms[i];
      if (lm && lm.id !== undefined && lm.id >= 0 && lm.id < 33) {
        map[lm.id] = lm;
      }
    }
    return map;
  }, [poseFrame]);

  return (
    <View style={[styles.container, { width: displayWidth, height: displayHeight }, style]} pointerEvents="none">
      <Canvas style={{ width: displayWidth, height: displayHeight }}>
        {/* Render Bones */}
        {SKELETON_CONNECTIONS.map((conn, idx) => {
          const p1 = lmMap[conn.from];
          const p2 = lmMap[conn.to];
          if (!p1 || !p2) return null;

          const v1 = p1.visibility ?? 1.0;
          const v2 = p2.visibility ?? 1.0;
          if (v1 < minVisibilityThreshold || v2 < minVisibilityThreshold) return null;

          const avgConf = (v1 + v2) / 2;
          const opacity = calculateConfidenceOpacity(avgConf, theme.minOpacity, theme.maxOpacity);
          const color = getBoneStrokeColor(conn, theme);

          return (
            <Line
              key={`bone-${idx}`}
              p1={vec(p1.x * displayWidth, p1.y * displayHeight)}
              p2={vec(p2.x * displayWidth, p2.y * displayHeight)}
              color={color}
              strokeWidth={theme.boneLineWidth}
              opacity={opacity}
              strokeCap="round"
            />
          );
        })}

        {/* Render Joints */}
        {lmMap.map((p, id) => {
          if (!p) return null;
          const vis = p.visibility ?? 1.0;
          if (vis < minVisibilityThreshold) return null;

          const opacity = calculateConfidenceOpacity(vis, theme.minOpacity, theme.maxOpacity);
          const color = getJointFillColor(id as LandmarkId, theme);
          const radius = (id === LandmarkId.LEFT_WRIST || id === LandmarkId.RIGHT_WRIST)
            ? theme.gripJointRadius
            : theme.jointRadius;

          return (
            <Circle
              key={`joint-${id}`}
              cx={p.x * displayWidth}
              cy={p.y * displayHeight}
              r={radius}
              color={color}
              opacity={opacity}
            />
          );
        })}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
