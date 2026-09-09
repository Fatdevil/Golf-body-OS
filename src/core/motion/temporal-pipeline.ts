import { PoseFrame } from '../types/pose-frame';
import { AnalysisStatus, AnalysisFailureCode } from '../types/analysis-result';
import { BodyMetric } from '../types/metric';
import { PipelineTrace } from '../types/pipeline-trace';
import { TestProtocol } from '../types/protocol';
import { PhaseConfig } from './phases/phase-engine';
import { OneEuroFilterConfig } from './filters/one-euro-filter';
import { ConfidenceResult, ConfidenceEngine } from '../confidence/confidence-engine';

import { RepetitionResult, extractRepMetrics } from '../metrics/hip-hinge-metrics';
import { PipelineTraceBuilder } from '../trace/pipeline-trace-builder';
import { LandmarkId } from '../types/landmark';
import { LandmarkSmoother } from './filters/landmark-smoother';
import { OutlierRejector } from './filters/outlier-rejector';
import { PhaseEngine } from './phases/phase-engine';
import { EndpointDetector } from './phases/endpoint-detector';
import { interiorAngle } from '../metrics/angle-calculator';

export const VERSION = 'TEMPORAL_PIPELINE_V1';

export interface TemporalPipelineConfig {
  protocol: TestProtocol;
  filterConfig?: OneEuroFilterConfig;
  phaseConfig?: PhaseConfig;
  activeStartTimeMs?: number;
}

export interface TemporalPipelineResult {
  status: AnalysisStatus;
  repetitions: RepetitionResult[];
  metrics: BodyMetric[];
  confidence: ConfidenceResult;
  trace: PipelineTrace;
  failureCode?: AnalysisFailureCode;
}

/**
 * Orchestrator for the entire motion analysis pipeline.
 */
export class TemporalPipeline {
  private config: TemporalPipelineConfig;

  constructor(config: TemporalPipelineConfig) {
    this.config = config;
  }

  process(frames: PoseFrame[], injectedTraceBuilder?: PipelineTraceBuilder): TemporalPipelineResult {
    const sessionId = `session_${Date.now()}`;
    const traceBuilder = injectedTraceBuilder || new PipelineTraceBuilder(sessionId);
    
    if (!injectedTraceBuilder) {
      traceBuilder.setDevice('UNKNOWN_DEVICE', 'UNKNOWN_OS')
        .setCamera('UNKNOWN_RES', 30)
        .setPoseModel('UNKNOWN_MODEL', 'UNKNOWN_VER', null, 'UNKNOWN_SHA')
        .setVersions('V1', 'V1', this.config.protocol.id, 'V1')
        .setAnalysisMode('RECORDED', 30, 30)
        .setTimestamps(new Date().toISOString(), new Date().toISOString())
        .setConfidence(0);
    }

    if (frames.length === 0) {
      traceBuilder.setFrameCounts(0, 0, 0, 0);
      traceBuilder.setTimestamps(new Date().toISOString(), new Date().toISOString());
      traceBuilder.setVersions('V1', 'V1', 'V1', 'V1');
      traceBuilder.setConfidence(0);
      
      return {
        status: 'FAILED',
        repetitions: [],
        metrics: [],
        confidence: { overall: 0, configVersion: 'V1', components: {}, flags: ['NO_FRAMES'], isAbstained: true },
        trace: traceBuilder.build(),
        failureCode: 'INSUFFICIENT_FRAMES',
      };
    }

    const protocol = this.config.protocol;
    const minVisibility = protocol.minVisibility ?? 0.5;
    const requiredLandmarks = protocol.requiredNearSideLandmarks ?? [];
    const side = protocol.standardizedSide ?? 'LEFT';

    let validFramesCount = 0;
    let rejectedFramesCount = 0;
    let totalVisSum = 0;

    const smoother = new LandmarkSmoother({ 
      xyConfig: this.config.filterConfig, 
      zConfig: this.config.filterConfig 
    });
    const rejector = new OutlierRejector({ minThreshold: 2.0 });
    const phaseEngine = new PhaseEngine(this.config.phaseConfig);
    const endpointDetector = new EndpointDetector();
    const confidenceEngine = new ConfidenceEngine();

    let baselineLandmarks: import('../types/landmark').Landmark[] | null = null;
    let prevAngle: number | null = null;
    let prevTime: number | null = null;
    let prevPhase = phaseEngine.currentPhase;

    const reps: RepetitionResult[] = [];
    let repNumber = 1;

    const endpointBuffer = new Map<number, import('../types/landmark').Landmark[]>();

    for (const frame of frames) {
      // Before ACTIVE state, we just pass the frame through the smoother to keep it warm, 
      // but we do NOT run phase detection or metric extraction.
      if (this.config.activeStartTimeMs !== undefined && frame.timestampMs < this.config.activeStartTimeMs) {
        smoother.smooth(frame);
        continue;
      }

      // 1. validate visibility
      let visSum = 0;
      let visCount = 0;
      for (const id of requiredLandmarks) {
        const lm = frame.landmarks.find(l => l.id === id);
        if (lm && lm.visibility !== undefined) {
          visSum += lm.visibility;
          visCount++;
        }
      }
      const avgVis = visCount > 0 ? visSum / visCount : 0;
      if (avgVis < minVisibility) {
        rejectedFramesCount++;
        continue;
      }
      validFramesCount++;
      totalVisSum += avgVis;

      // 2. smooth
      const smoothedFrame = smoother.smooth(frame);
      const landmarks = smoothedFrame.landmarks;

      if (!baselineLandmarks) {
        baselineLandmarks = landmarks;
      }

      // 3. compute hipHingeAngle
      const shoulderId = side === 'LEFT' ? LandmarkId.LEFT_SHOULDER : LandmarkId.RIGHT_SHOULDER;
      const hipId = side === 'LEFT' ? LandmarkId.LEFT_HIP : LandmarkId.RIGHT_HIP;
      const kneeId = side === 'LEFT' ? LandmarkId.LEFT_KNEE : LandmarkId.RIGHT_KNEE;
      
      const shoulder = landmarks.find(l => l.id === shoulderId);
      const hip = landmarks.find(l => l.id === hipId);
      const knee = landmarks.find(l => l.id === kneeId);

      if (!shoulder || !hip || !knee) continue;

      const rawAngle = interiorAngle(shoulder, hip, knee);
      const rejectResult = rejector.process(rawAngle, smoothedFrame.timestampMs);
      
      let angleToUse = rawAngle;
      if (rejectResult.type === 'REJECTED' || rejectResult.type === 'INVALID_SEGMENT') {
        continue;
      } else if (rejectResult.type === 'INTERPOLATED') {
        angleToUse = rejectResult.value;
      }

      // 4. compute angularVelocity
      let angularVelocity = 0;
      if (prevAngle !== null && prevTime !== null && smoothedFrame.timestampMs > prevTime) {
        const dt = (smoothedFrame.timestampMs - prevTime) / 1000.0;
        angularVelocity = (angleToUse - prevAngle) / dt;
      }
      prevAngle = angleToUse;
      prevTime = smoothedFrame.timestampMs;

      // 5. run PhaseEngine.processFrame()
      const currentPhase = phaseEngine.processFrame(angleToUse, angularVelocity, smoothedFrame.frameId, smoothedFrame.timestampMs);

      // 6. Endpoint detection
      if (currentPhase === 'ENDPOINT') {
        endpointDetector.addFrame(angleToUse, avgVis, smoothedFrame.frameId);
        endpointBuffer.set(smoothedFrame.frameId, landmarks);
      } else if ((prevPhase as string) === 'ENDPOINT' && (currentPhase as string) !== 'ENDPOINT') {
        const endVel = this.config.phaseConfig?.endpointVelocityThreshold ?? 5;
        const endFrames = this.config.phaseConfig?.endpointStableFrames ?? 5;
        let endpoint = endpointDetector.detectEndpoint(endVel, endFrames, minVisibility);
        if (!endpoint) {
          endpoint = endpointDetector.detectEndpoint(endVel, 3, minVisibility);
        }
        if (!endpoint) {
          endpoint = endpointDetector.detectEndpoint(endVel * 1.5, 2, minVisibility);
        }
        if (!endpoint && endpointBuffer.size > 0) {
          let minAngle = Infinity;
          let bestFrameId = -1;
          for (const [fId, lms] of endpointBuffer.entries()) {
            const sh = lms.find(l => l.id === shoulderId);
            const h = lms.find(l => l.id === hipId);
            const kn = lms.find(l => l.id === kneeId);
            if (sh && h && kn) {
              const ang = interiorAngle(sh, h, kn);
              if (ang < minAngle) {
                minAngle = ang;
                bestFrameId = fId;
              }
            }
          }
          if (bestFrameId !== -1) {
            endpoint = {
              value: minAngle,
              stableFrameCount: 1,
              confidence: 1.0,
              frameRange: [bestFrameId, bestFrameId]
            };
          }
        }
        
        if (endpoint && baselineLandmarks) {
          const endpointFrameId = Math.floor((endpoint.frameRange[0] + endpoint.frameRange[1]) / 2);
          let targetLandmarks = endpointBuffer.get(endpointFrameId);
          if (!targetLandmarks) {
            targetLandmarks = endpointBuffer.get(endpoint.frameRange[0]);
          }
          
          if (targetLandmarks) {
            try {
              const rep = extractRepMetrics(targetLandmarks, baselineLandmarks, endpointFrameId, side as 'LEFT' | 'RIGHT', false, repNumber);
              rep.repNumber = repNumber++;
              reps.push(rep);
            } catch (e) {
              // ignore extraction failure
            }
          }
        }
        endpointDetector.reset();
        endpointBuffer.clear();
      }
      prevPhase = currentPhase;
    }

    // Check if ended in ENDPOINT phase
    if ((prevPhase as string) === 'ENDPOINT') {
      const endVel = this.config.phaseConfig?.endpointVelocityThreshold ?? 5;
      const endFrames = this.config.phaseConfig?.endpointStableFrames ?? 5;
      let endpoint = endpointDetector.detectEndpoint(endVel, endFrames, minVisibility);
      if (!endpoint) {
        endpoint = endpointDetector.detectEndpoint(endVel, 3, minVisibility);
      }
      if (!endpoint) {
        endpoint = endpointDetector.detectEndpoint(endVel * 1.5, 2, minVisibility);
      }
      if (!endpoint && endpointBuffer.size > 0) {
        let minAngle = Infinity;
        let bestFrameId = -1;
        for (const [fId, lms] of endpointBuffer.entries()) {
          const sh = lms.find(l => l.id === (side === 'LEFT' ? LandmarkId.LEFT_SHOULDER : LandmarkId.RIGHT_SHOULDER));
          const h = lms.find(l => l.id === (side === 'LEFT' ? LandmarkId.LEFT_HIP : LandmarkId.RIGHT_HIP));
          const kn = lms.find(l => l.id === (side === 'LEFT' ? LandmarkId.LEFT_KNEE : LandmarkId.RIGHT_KNEE));
          if (sh && h && kn) {
            const ang = interiorAngle(sh, h, kn);
            if (ang < minAngle) {
              minAngle = ang;
              bestFrameId = fId;
            }
          }
        }
        if (bestFrameId !== -1) {
          endpoint = {
            value: minAngle,
            stableFrameCount: 1,
            confidence: 1.0,
            frameRange: [bestFrameId, bestFrameId]
          };
        }
      }
      if (endpoint && baselineLandmarks) {
        const endpointFrameId = Math.floor((endpoint.frameRange[0] + endpoint.frameRange[1]) / 2);
        let targetLandmarks = endpointBuffer.get(endpointFrameId) || endpointBuffer.get(endpoint.frameRange[0]);
        if (targetLandmarks) {
          try {
            const rep = extractRepMetrics(targetLandmarks, baselineLandmarks, endpointFrameId, side as 'LEFT' | 'RIGHT', false, repNumber);
            rep.repNumber = repNumber++;
            reps.push(rep);
          } catch (e) {}
        }
      }
    }

    // 8. compute confidence
    const landmarkVisibility = validFramesCount > 0 ? totalVisSum / validFramesCount : 0;
    const confidenceInput = {
      landmarkVisibility,
      landmarkPresence: 1.0,
      cameraStability: 0.8,
      frameCoverage: validFramesCount / (frames.length || 1),
      movementStability: 1.0,
      protocolCompliance: 1.0,
      endpointQuality: 1.0,
      repetitionConsistency: 1.0
    };
    const confidence = confidenceEngine.calculate(confidenceInput);

    // Rules handling
    traceBuilder.setFrameCounts(frames.length, validFramesCount, 0, rejectedFramesCount);
    traceBuilder.setTimestamps(
      new Date(frames[0].timestampMs).toISOString(),
      new Date(frames[frames.length - 1].timestampMs).toISOString()
    );
    traceBuilder.setVersions('V1', 'V1', 'V1', 'V1');
    traceBuilder.setConfidence(confidence.overall);

    if (validFramesCount < (protocol.minFrames ?? 90)) {
      return {
        status: 'FAILED',
        repetitions: reps,
        metrics: [],
        confidence,
        trace: traceBuilder.build(),
        failureCode: 'INSUFFICIENT_FRAMES',
      };
    }

    if (reps.length === 0) {
      return {
        status: 'ABSTAINED',
        repetitions: reps,
        metrics: [],
        confidence,
        trace: traceBuilder.build(),
        failureCode: 'NO_VALID_ENDPOINT',
      };
    }

    if (confidence.overall < 0.5) {
      return {
        status: 'ABSTAINED',
        repetitions: reps,
        metrics: [],
        confidence,
        trace: traceBuilder.build(),
      };
    }

    return {
      status: 'SUCCESS',
      repetitions: reps,
      metrics: [],
      confidence,
      trace: traceBuilder.build()
    };
  }
}
