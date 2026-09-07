import { PipelineTrace } from '../types/pipeline-trace';

export const VERSION = 'PIPELINE_TRACE_BUILDER_V1';

export class PipelineTraceBuilder {
  private trace: Partial<PipelineTrace>;

  constructor(sessionId: string) {
    this.trace = {
      sessionId,
      qualityFlags: [],
      poseVariant: 'FULL', // Always FULL in R-1A
    };
  }

  setDevice(deviceModel: string, osVersion: string): this {
    this.trace.deviceModel = deviceModel;
    this.trace.osVersion = osVersion;
    return this;
  }

  setCamera(resolution: string, fps: number): this {
    this.trace.resolution = resolution;
    this.trace.fps = fps;
    return this;
  }

  setPoseModel(poseModel: string, poseModelVersion: string, modelSha256: string): this {
    this.trace.poseModel = poseModel;
    this.trace.poseModelVersion = poseModelVersion;
    this.trace.modelSha256 = modelSha256;
    return this;
  }

  setVersions(filterVersion: string, metricVersion: string, protocolVersion: string, confidenceVersion: string): this {
    this.trace.filterVersion = filterVersion;
    this.trace.metricVersion = metricVersion;
    this.trace.protocolVersion = protocolVersion;
    this.trace.confidenceVersion = confidenceVersion;
    return this;
  }

  setFrameCounts(rawFrameCount: number, validFrameCount: number, interpolatedFrameCount: number, rejectedFrameCount: number): this {
    this.trace.rawFrameCount = rawFrameCount;
    this.trace.validFrameCount = validFrameCount;
    this.trace.interpolatedFrameCount = interpolatedFrameCount;
    this.trace.rejectedFrameCount = rejectedFrameCount;
    return this;
  }

  setAnalysisMode(analysisMode: 'LIVE' | 'RECORDED', livePoseGuidanceFps?: number, analysisTargetFps?: number): this {
    this.trace.analysisMode = analysisMode;
    if (livePoseGuidanceFps !== undefined) this.trace.livePoseGuidanceFps = livePoseGuidanceFps;
    if (analysisTargetFps !== undefined) this.trace.analysisTargetFps = analysisTargetFps;
    return this;
  }

  setConfidence(confidence: number): this {
    this.trace.confidence = confidence;
    return this;
  }

  addQualityFlag(flag: string): this {
    if (!this.trace.qualityFlags) {
      this.trace.qualityFlags = [];
    }
    this.trace.qualityFlags.push(flag);
    return this;
  }

  setTimestamps(startTimestamp: string, endTimestamp: string): this {
    this.trace.startTimestamp = startTimestamp;
    this.trace.endTimestamp = endTimestamp;
    this.trace.durationMs = new Date(endTimestamp).getTime() - new Date(startTimestamp).getTime();
    return this;
  }

  build(): PipelineTrace {
    const requiredFields: (keyof PipelineTrace)[] = [
      'sessionId', 'deviceModel', 'osVersion', 'resolution', 'fps',
      'poseModel', 'poseVariant', 'poseModelVersion', 'modelSha256',
      'filterVersion', 'metricVersion', 'protocolVersion', 'confidenceVersion',
      'confidence', 'qualityFlags', 'rawFrameCount', 'validFrameCount',
      'interpolatedFrameCount', 'rejectedFrameCount', 'analysisMode',
      'startTimestamp', 'endTimestamp', 'durationMs'
    ];

    for (const field of requiredFields) {
      if (this.trace[field] === undefined) {
        throw new Error(`Missing required trace field: ${field}`);
      }
    }

    return this.trace as PipelineTrace;
  }
}
