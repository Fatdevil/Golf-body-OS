/**
 * index.ts
 * Golf-Body-OS — Motion Filters
 *
 * Public barrel export for temporal and spatial pose filters.
 *
 * @module motion/filters
 */

export {
  PoseSmoother,
  smoothPoseSequence,
  PoseSmootherConfig,
  DEFAULT_POSE_SMOOTHER_CONFIG,
  VERSION as POSE_SMOOTHER_VERSION,
} from './pose-smoother';

export {
  sanitizeGolfPoseFrame,
  isArmLengthPlausible,
  isHandElevationPlausible,
  dist2D,
  AnatomicalSanityConfig,
  VERSION as ANATOMICAL_FILTER_VERSION,
} from './anatomical-filter';

export {
  LandmarkSmoother,
  LandmarkSmootherConfig,
  VERSION as LANDMARK_SMOOTHER_VERSION,
} from './landmark-smoother';

export {
  OneEuroFilter,
  OneEuroFilterConfig,
  VERSION as ONE_EURO_FILTER_VERSION,
} from './one-euro-filter';

export {
  OutlierRejector,
  OutlierRejectorConfig,
  VERSION as OUTLIER_REJECTOR_VERSION,
} from './outlier-rejector';
