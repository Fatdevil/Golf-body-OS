import { PoseFrame } from '../../types/pose-frame';
import { Landmark, LandmarkId } from '../../types/landmark';
import { OneEuroFilter, OneEuroFilterConfig } from './one-euro-filter';

export const VERSION = 'LANDMARK_SMOOTHER_V1';

export interface LandmarkSmootherConfig {
  xyConfig?: OneEuroFilterConfig;
  zConfig?: OneEuroFilterConfig;
}

/**
 * Smoothes landmarks using a bank of 1 Euro Filters.
 */
export class LandmarkSmoother {
  private filters: Map<string, OneEuroFilter> = new Map();
  private xyConfig: OneEuroFilterConfig;
  private zConfig: OneEuroFilterConfig;

  constructor(config?: LandmarkSmootherConfig) {
    this.xyConfig = config?.xyConfig || { minCutoff: 1.0, beta: 0.007, dCutoff: 1.0 };
    this.zConfig = config?.zConfig || { minCutoff: 0.1, beta: 0.005, dCutoff: 1.0 };
  }

  /**
   * Smoothes a pose frame.
   * @param frame The raw pose frame.
   * @returns A new pose frame with smoothed landmarks.
   */
  public smooth(frame: PoseFrame): PoseFrame {
    const smoothedLandmarks: Landmark[] = [];

    for (const lm of frame.landmarks) {
      const fx = this.getFilter(lm.id, 'x', this.xyConfig);
      const fy = this.getFilter(lm.id, 'y', this.xyConfig);
      const fz = this.getFilter(lm.id, 'z', this.zConfig);

      const smoothedLm: Landmark = {
        id: lm.id,
        x: fx.filter(lm.x, frame.timestampMs),
        y: fy.filter(lm.y, frame.timestampMs)
      };

      if (lm.z !== undefined) {
        smoothedLm.z = fz.filter(lm.z, frame.timestampMs);
      }
      if (lm.visibility !== undefined) {
        smoothedLm.visibility = lm.visibility;
      }
      if (lm.presence !== undefined) {
        smoothedLm.presence = lm.presence;
      }

      smoothedLandmarks.push(smoothedLm);
    }

    let smoothedWorldLandmarks: Landmark[] | undefined = undefined;
    
    if (frame.worldLandmarks) {
      smoothedWorldLandmarks = [];
      for (const lm of frame.worldLandmarks) {
        const fx = this.getFilter(lm.id, 'wx', this.xyConfig);
        const fy = this.getFilter(lm.id, 'wy', this.xyConfig);
        const fz = this.getFilter(lm.id, 'wz', this.zConfig);

        const smoothedLm: Landmark = {
          id: lm.id,
          x: fx.filter(lm.x, frame.timestampMs),
          y: fy.filter(lm.y, frame.timestampMs)
        };

        if (lm.z !== undefined) {
          smoothedLm.z = fz.filter(lm.z, frame.timestampMs);
        }
        if (lm.visibility !== undefined) {
          smoothedLm.visibility = lm.visibility;
        }
        if (lm.presence !== undefined) {
          smoothedLm.presence = lm.presence;
        }

        smoothedWorldLandmarks.push(smoothedLm);
      }
    }

    return {
      frameId: frame.frameId,
      timestampMs: frame.timestampMs,
      width: frame.width,
      height: frame.height,
      model: frame.model,
      modelVersion: frame.modelVersion,
      landmarks: smoothedLandmarks,
      ...(smoothedWorldLandmarks && { worldLandmarks: smoothedWorldLandmarks })
    };
  }

  private getFilter(id: LandmarkId, axis: string, config: OneEuroFilterConfig): OneEuroFilter {
    const key = `${id}_${axis}`;
    if (!this.filters.has(key)) {
      this.filters.set(key, new OneEuroFilter(config));
    }
    return this.filters.get(key)!;
  }
}
