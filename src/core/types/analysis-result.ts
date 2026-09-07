import { PoseSequence } from './pose-frame';

/**
 * @module analysis-result
 * Result types and failure codes for pose analysis.
 */
export const VERSION = 'ANALYSIS_RESULT_V1';

/**
 * High-level status of an analysis run.
 */
export type AnalysisStatus = 'SUCCESS' | 'ABSTAINED' | 'FAILED' | 'CANCELLED';

/**
 * Specific failure codes.
 */
export type AnalysisFailureCode = 
  | 'POSE_INIT_FAILED' 
  | 'CAMERA_UNAVAILABLE' 
  | 'INSUFFICIENT_VISIBILITY' 
  | 'CAMERA_UNSTABLE' 
  | 'INVALID_PROTOCOL' 
  | 'INSUFFICIENT_FRAMES' 
  | 'NO_VALID_ENDPOINT' 
  | 'INFERENCE_FAILED';

/**
 * Complete result of an analysis operation.
 */
export interface AnalysisResult {
  /** Overall status of the analysis */
  status: AnalysisStatus;
  /** Recorded pose sequence, if available */
  frames?: PoseSequence;
  /** Failure code, if status is FAILED */
  failureCode?: AnalysisFailureCode;
  /** Human-readable failure message */
  failureMessage?: string;
  /** Reason for abstaining, if status is ABSTAINED */
  abstentionReason?: string;
}
