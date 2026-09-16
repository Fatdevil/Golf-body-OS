/**
 * @module types
 * Canonical Type System for Golf Body OS
 */

// landmark
export { LandmarkId } from './landmark';
export { type Landmark } from './landmark';

// pose-frame
export { type PoseFrame } from './pose-frame';
export { type PoseSequence } from './pose-frame';

// analysis-result
export { type AnalysisStatus } from './analysis-result';
export { type AnalysisFailureCode } from './analysis-result';
export { type AnalysisResult } from './analysis-result';

// metric
export { type MetricUnit } from './metric';
export { type MetricQuality } from './metric';
export { type ValidationStatus } from './metric';
export { type BodyMetric } from './metric';

// pipeline-trace
export { type DecodedFrameTrace } from './pipeline-trace';
export { type PipelineTrace } from './pipeline-trace';

// protocol
export { type CameraView } from './protocol';
export { type BodySide } from './protocol';
export { type Instruction } from './protocol';
export { type QualityRule } from './protocol';
export { type TestProtocol } from './protocol';
