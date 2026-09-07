/**
 * @module pipeline-trace
 * Diagnostics and tracing for the processing pipeline.
 */
export const VERSION = 'PIPELINE_TRACE_V1';

/**
 * Comprehensive trace of a pipeline execution.
 */
export interface PipelineTrace {
  /** Unique session identifier */
  sessionId: string;
  /** Device model identifier */
  deviceModel: string;
  /** Operating system version */
  osVersion: string;
  /** Camera resolution */
  resolution: string;
  /** Camera frames per second */
  fps: number;
  /** Pose estimation model used */
  poseModel: string;
  /** Variant of the pose model */
  poseVariant: 'FULL';
  /** Version of the pose model */
  poseModelVersion: string;
  /** SHA256 hash of the model file */
  modelSha256: string;
  /** Version of the smoothing/filtering pipeline */
  filterVersion: string;
  /** Version of the metric calculation */
  metricVersion: string;
  /** Version of the assessment protocol */
  protocolVersion: string;
  /** Version of the confidence estimator */
  confidenceVersion: string;
  /** Overall confidence score */
  confidence: number;
  /** Array of quality flag codes */
  qualityFlags: string[];
  /** Number of raw frames captured */
  rawFrameCount: number;
  /** Number of frames that passed quality checks */
  validFrameCount: number;
  /** Number of frames synthesized via interpolation */
  interpolatedFrameCount: number;
  /** Number of frames rejected by quality checks */
  rejectedFrameCount: number;
  /** Mode of analysis */
  analysisMode: 'LIVE' | 'RECORDED';
  /** Frame rate of live guidance overlay, if applicable */
  livePoseGuidanceFps?: number;
  /** Target frame rate for the analysis pipeline, if applicable */
  analysisTargetFps?: number;
  /** ISO timestamp of capture start */
  startTimestamp: string;
  /** ISO timestamp of capture end */
  endTimestamp: string;
  /** Total duration in milliseconds */
  durationMs: number;
}
