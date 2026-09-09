import { AnalysisFailureCode } from '../core/types/analysis-result';
import { PipelineTrace } from '../core/types/pipeline-trace';
import { CompensationFlag } from '../core/metrics/compensation-detector';
import { MetricValue } from '../core/metrics/hip-hinge-metrics';

export const VERSION = 'DEVICE_VALIDATION_REPORT_V1';

export interface DeviceValidationReport {
  status: 'SUCCESS' | 'ABSTAINED' | 'FAILED' | 'CANCELLED';

  device: {
    model: string;
    osVersion: string;
  };

  model: {
    variant: 'FULL';
    assetVersion: string | null;
    runtimeVersion: string;
    sha256: string;
  };

  capture: {
    resolution: string;
    cameraFps: number;
    processedFps: number;
    durationMs: number;
    rawFrameCount: number;
    processedFrameCount: number;
    droppedFrameCount: number;
    sourceDecodedFrameCount: number;
    poseInferenceFrameCount: number;
    presentedFrameCallbacks: number;
    missedPresentedFrames: number;
    duplicateMediaTimestamps: number;
  };

  inference: {
    meanLatencyMs: number | null;
    p50LatencyMs: number | null;
    p95LatencyMs: number | null;
    maxLatencyMs: number | null;
  };

  landmarks: {
    expectedPerPose: 33;
    validPoseFrameCount: number;
    rejectedPoseFrameCount: number;
    interpolatedGapCount: number;
  };

  measurement: {
    detectedRepCount: number;
    validRepCount: number;
    metrics: MetricValue[];
    compensations: CompensationFlag[];
    confidence: number;
    qualityFlags: string[];
  };

  failureCodes: AnalysisFailureCode[];

  trace: PipelineTrace;
}

/**
 * Computes latency statistics from an array of latencies.
 * 
 * @param latencies - Array of latency measurements in ms
 * @returns Latency statistics suitable for DeviceValidationReport.inference
 */
export function computeLatencyStats(latencies: number[]): DeviceValidationReport['inference'] {
  if (!latencies || latencies.length === 0) {
    return {
      meanLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      maxLatencyMs: 0,
    };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  
  const mean = sum / sorted.length;
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const max = sorted[sorted.length - 1];

  return {
    meanLatencyMs: mean,
    p50LatencyMs: p50,
    p95LatencyMs: p95,
    maxLatencyMs: max,
  };
}
