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

  setPoseModel(poseModel: string, runtimeVersion: string, assetVersion: string | null, modelSha256: string): this {
    this.trace.poseModel = poseModel;
    this.trace.runtimeVersion = runtimeVersion;
    this.trace.assetVersion = assetVersion;
    this.trace.modelSha256 = modelSha256;
    return this;
  }

  setMediaMetadata(sha256?: string, startTimestamp?: string, endTimestamp?: string, durationMs?: number): this {
    if (sha256) this.trace.inputMediaSha256 = sha256;
    if (startTimestamp) this.trace.mediaStartTimestamp = startTimestamp;
    if (endTimestamp) this.trace.mediaEndTimestamp = endTimestamp;
    if (durationMs !== undefined) this.trace.mediaDurationMs = durationMs;
    return this;
  }

  setVersions(filterVersion: string, metricVersion: string, protocolVersion: string, confidenceVersion: string): this {
    this.trace.filterVersion = filterVersion;
    this.trace.metricVersion = metricVersion;
    this.trace.protocolVersion = protocolVersion;
    this.trace.confidenceVersion = confidenceVersion;
    return this;
  }

  setFrameCounts(
    rawFrameCount: number, 
    validFrameCount: number, 
    interpolatedFrameCount: number, 
    rejectedFrameCount: number,
    sourceDecodedFrameCount: number = 0,
    poseInferenceFrameCount: number = 0
  ): this {
    this.trace.rawFrameCount = rawFrameCount;
    this.trace.validFrameCount = validFrameCount;
    this.trace.interpolatedFrameCount = interpolatedFrameCount;
    this.trace.rejectedFrameCount = rejectedFrameCount;
    this.trace.sourceDecodedFrameCount = sourceDecodedFrameCount;
    this.trace.poseInferenceFrameCount = poseInferenceFrameCount;
    return this;
  }

  setDecodedFrames(frames: import('../types/pipeline-trace').DecodedFrameTrace[]): this {
    this.trace.decodedFrames = frames;
    
    this.trace.presentedFrameCallbacks = frames.length;
    let missed = 0;
    let duplicates = 0;
    let poseInferenceCount = 0;
    let lastPresented = -1;
    let minPresented = -1;
    let maxPresented = -1;
    
    for (const f of frames) {
      if (f.duplicateTimestamp) {
        duplicates++;
      } else {
        poseInferenceCount++;
      }
      
      if (f.presentedFrame !== undefined) {
        if (minPresented === -1 || f.presentedFrame < minPresented) minPresented = f.presentedFrame;
        if (maxPresented === -1 || f.presentedFrame > maxPresented) maxPresented = f.presentedFrame;
        
        if (lastPresented !== -1 && f.presentedFrame > lastPresented + 1) {
          missed += (f.presentedFrame - lastPresented - 1);
        }
        lastPresented = f.presentedFrame;
      }
    }
    
    this.trace.missedPresentedFrames = missed;
    this.trace.duplicateMediaTimestamps = duplicates;
    this.trace.poseInferenceFrameCount = poseInferenceCount;
    
    if (minPresented !== -1 && maxPresented !== -1) {
      this.trace.sourceDecodedFrameCount = maxPresented - minPresented + 1;
    } else {
      this.trace.sourceDecodedFrameCount = frames.length + missed - duplicates;
    }
    
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
    this.trace.wallClockDurationMs = new Date(endTimestamp).getTime() - new Date(startTimestamp).getTime();
    return this;
  }

  build(): PipelineTrace {
    const requiredFields: (keyof PipelineTrace)[] = [
      'sessionId', 'deviceModel', 'osVersion', 'resolution', 'fps',
      'poseModel', 'poseVariant', 'runtimeVersion', 'modelSha256',
      'filterVersion', 'metricVersion', 'protocolVersion', 'confidenceVersion',
      'confidence', 'qualityFlags', 'rawFrameCount', 'validFrameCount',
      'interpolatedFrameCount', 'rejectedFrameCount', 'analysisMode',
      'startTimestamp', 'endTimestamp', 'wallClockDurationMs',
      'presentedFrameCallbacks', 'missedPresentedFrames', 'duplicateMediaTimestamps',
      'sourceDecodedFrameCount', 'poseInferenceFrameCount'
    ];

    for (const field of requiredFields) {
      if (this.trace[field] === undefined) {
        throw new Error(`Missing required trace field: ${field}`);
      }
    }

    return this.trace as PipelineTrace;
  }
}
