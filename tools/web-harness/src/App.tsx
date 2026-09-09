import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { Play, Upload, Camera, RefreshCw, Volume2, VolumeX, Globe, Key, Bot, Sparkles, X, Check, Compass, Target, Trophy, SwitchCamera, Smartphone, QrCode, Maximize2, Minimize2 } from 'lucide-react';
import { convertWebResultToPoseFrame } from './adapter/web-mediapipe-adapter';
import { TemporalPipeline } from '../../../src/core/motion/temporal-pipeline';
import { PoseFrame, PoseSequence } from '../../../src/core/types/pose-frame';
import { DeviceValidationReport } from '../../../src/validation/device-validation-report';
import { PipelineTraceBuilder } from '../../../src/core/trace/pipeline-trace-builder';
import { DecodedFrameTrace } from '../../../src/core/types/pipeline-trace';
import { MetricValue, RepetitionResult } from '../../../src/core/metrics/hip-hinge-metrics';
import AnnotatorView from './components/AnnotatorView';
import { ReadinessEngine, ReadinessResult } from '../../../src/core/motion/readiness-engine';
import CameraGuideOverlay, { AppTestState } from './components/CameraGuideOverlay';
import { AudioCoachService, CoachingMode, SpokenCueLogEntry } from '../../../src/core/coaching/audio-coach';
import { LiveCoachingEngine } from '../../../src/core/coaching/live-coaching-engine';
import { SupportedLanguage, getPhrase, CoachingPhraseKey } from '../../../src/core/coaching/i18n/locales';
import { AiCoachService } from '../../../src/core/ai/ai-coach-service';
import AiCoachCard from './components/AiCoachCard';
import { LiveRotationCoachingEngine } from '../../../src/core/coaching/live-rotation-coaching-engine';
import { summarizeThoracicRotation, ThoracicRotationResult } from '../../../src/core/metrics/thoracic-rotation-metrics';
import { THORACIC_ROTATION_V1 } from '../../../src/protocols/thoracic-rotation-v1';
import HolisticReportCard from './components/HolisticReportCard';
import { calculateGolfBodyScore, GolfBodyScoreResult } from '../../../src/core/metrics/golf-body-score';

// Dummy Test Protocol for Harness
const harnessProtocol = {
  id: 'HIP_HINGE_V1',
  version: '1.0',
  requiredView: 'SIDE' as const,
  standardizedSide: 'LEFT' as const,
  requiredNearSideLandmarks: [7, 11, 23, 25, 27], // Ear, Shoulder, Hip, Knee, Ankle
  optionalFarSideLandmarks: [],
  minVisibility: 0.5,
  minFrames: 30, // Relaxed for harness testing
  setupInstructions: [],
  movementInstructions: [],
  repetitionCount: 3,
  qualityRules: [],
  phaseDetector: 'HIP_HINGE_PHASES',
  metricIds: []
};

async function computeSha256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function playAudioTone(freq: number, durationMs: number = 150) {
  try {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return;
    const audioCtx = new AudioCtxClass();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + durationMs / 1000);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + durationMs / 1000);
  } catch {
    // Audio might be muted or blocked by autoplay policy until user gesture
  }
}

function drawSkeleton(ctx: CanvasRenderingContext2D, landmarks: any[], width: number, height: number) {
  const POSE_CONNECTIONS = [
    [11, 12], [11, 23], [12, 24], [23, 24], // Torso
    [23, 25], [24, 26], [25, 27], [26, 28], // Legs
    [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32], // Feet
    [11, 13], [12, 14], [13, 15], [14, 16], // Arms
    [7, 8], [8, 0], [7, 0], [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8] // Head
  ];

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#00FF00';
  for (const [start, end] of POSE_CONNECTIONS) {
    if (landmarks[start] && landmarks[end]) {
      const p1 = landmarks[start];
      const p2 = landmarks[end];
      if (p1.visibility > 0.5 && p2.visibility > 0.5) {
        ctx.beginPath();
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
        ctx.stroke();
      }
    }
  }

  ctx.fillStyle = '#FF0000';
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    if (lm.visibility > 0.5) {
      ctx.beginPath();
      ctx.arc(lm.x * width, lm.y * height, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}

export default function App() {
  const [landmarker, setLandmarker] = useState<PoseLandmarker | null>(null);
  const [modelSha, setModelSha] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [mode, setMode] = useState<'IDLE' | 'WEBCAM' | 'VIDEO'>('IDLE');
  const modeRef = useRef<'IDLE' | 'WEBCAM' | 'VIDEO'>('IDLE');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [report, setReport] = useState<DeviceValidationReport | null>(null);
  const [determinismReports, setDeterminismReports] = useState<DeviceValidationReport[] | null>(null);
  const [running1C, setRunning1C] = useState(false);
  const [running1D, setRunning1D] = useState(false);
  const [lastReps, setLastReps] = useState<RepetitionResult[]>([]);
  const [annotationMode, setAnnotationMode] = useState(false);
  
  const [appTestState, setAppTestState] = useState<AppTestState>('SETUP');
  const appTestStateRef = useRef<AppTestState>('SETUP');
  const [readinessResult, setReadinessResult] = useState<ReadinessResult | null>(null);
  const readinessEngineRef = useRef<ReadinessEngine>(new ReadinessEngine());
  const lastReadinessRef = useRef<ReadinessResult | null>(null);
  const activeStartTimeRef = useRef<number | undefined>(undefined);
  const [countdownNumber, setCountdownNumber] = useState<number | null>(null);
  const autoStartTriggeredRef = useRef(false);
  const [language, setLanguage] = useState<SupportedLanguage>('en-US');
  const [coachingMode, setCoachingMode] = useState<CoachingMode>('GUIDED');
  const [spokenCues, setSpokenCues] = useState<SpokenCueLogEntry[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState<string | null>(null);
  const audioCoachRef = useRef<AudioCoachService>(new AudioCoachService({ defaultLanguage: 'en-US' }));
  const liveCoachingEngineRef = useRef<LiveCoachingEngine | null>(null);
  const liveRotationCoachingEngineRef = useRef<LiveRotationCoachingEngine | null>(null);
  const aiCoachServiceRef = useRef<AiCoachService>(new AiCoachService());
  const stopWebcamRef = useRef<() => void>(() => {});

  const [activeProtocol, setActiveProtocol] = useState<'HIP_HINGE_V1' | 'THORACIC_ROTATION_V1'>('HIP_HINGE_V1');
  const activeProtocolRef = useRef<'HIP_HINGE_V1' | 'THORACIC_ROTATION_V1'>('HIP_HINGE_V1');
  const [rotationResult, setRotationResult] = useState<ThoracicRotationResult | null>(null);

  // Screening Flow state
  const [isScreeningFlow, setIsScreeningFlow] = useState(false);
  const isScreeningFlowRef = useRef(false);
  const [screeningStep, setScreeningStep] = useState<'IDLE' | 'STEP_1_HINGE' | 'TRANSITION' | 'STEP_2_ROTATION' | 'COMPLETE'>('IDLE');
  const screeningStepRef = useRef<'IDLE' | 'STEP_1_HINGE' | 'TRANSITION' | 'STEP_2_ROTATION' | 'COMPLETE'>('IDLE');
  const [screeningHingeReport, setScreeningHingeReport] = useState<DeviceValidationReport | null>(null);
  const screeningHingeReportRef = useRef<DeviceValidationReport | null>(null);
  const [screeningRotationResult, setScreeningRotationResult] = useState<ThoracicRotationResult | null>(null);
  const [golfBodyScoreResult, setGolfBodyScoreResult] = useState<GolfBodyScoreResult | null>(null);
  const modelShaRef = useRef('');
  const runPipelineRef = useRef<(frames: PoseSequence, traceBuilder: PipelineTraceBuilder) => DeviceValidationReport>(() => ({} as any));

  // Mobile state & Safari Audio unlock
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const cameraFacingRef = useRef<'user' | 'environment'>('user');
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [isMobileFullscreen, setIsMobileFullscreen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'TEST' | 'REPORT'>('TEST');
  const [showQrModal, setShowQrModal] = useState(false);

  const unlockAudio = () => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const silent = new SpeechSynthesisUtterance('');
        window.speechSynthesis.speak(silent);
      }
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
      }
    } catch {
      // Ignore unlock errors
    }
  };

  const [isBriefingActive, setIsBriefingActive] = useState(false);
  const isBriefingActiveRef = useRef(false);
  const lastReadinessCueTimeRef = useRef<number>(0);
  const coachingModeRef = useRef<CoachingMode>('GUIDED');

  const playGuidedBriefing = (protocolId?: 'HIP_HINGE_V1' | 'THORACIC_ROTATION_V1') => {
    const proto = protocolId || activeProtocolRef.current;
    if (audioCoachRef.current.getMuted()) return;

    audioCoachRef.current.cancel();
    setIsBriefingActive(true);
    isBriefingActiveRef.current = true;

    const keys: CoachingPhraseKey[] = proto === 'THORACIC_ROTATION_V1'
      ? ['BRIEFING_ROTATION_1', 'BRIEFING_ROTATION_2', 'BRIEFING_ROTATION_3']
      : ['BRIEFING_HINGE_1', 'BRIEFING_HINGE_2', 'BRIEFING_HINGE_3'];

    audioCoachRef.current.speakSequence(
      keys,
      () => {
        setIsBriefingActive(false);
        isBriefingActiveRef.current = false;
      },
      'HIGH'
    );
  };

  const playScreeningBriefing = () => {
    if (audioCoachRef.current.getMuted()) return;
    if (coachingModeRef.current !== 'GUIDED' && coachingModeRef.current !== 'FULL') return;

    audioCoachRef.current.cancel();
    setIsBriefingActive(true);
    isBriefingActiveRef.current = true;

    audioCoachRef.current.speakSequence(
      [
        'SCREENING_WELCOME',
        'BRIEFING_HINGE_1',
        'BRIEFING_HINGE_2',
        'BRIEFING_HINGE_3'
      ],
      () => {
        setIsBriefingActive(false);
        isBriefingActiveRef.current = false;
      },
      'HIGH'
    );
  };

  const cancelBriefing = () => {
    audioCoachRef.current.cancel();
    setIsBriefingActive(false);
    isBriefingActiveRef.current = false;
  };

  const handleStartScreeningFlow = () => {
    setIsScreeningFlow(true);
    isScreeningFlowRef.current = true;
    setScreeningStep('STEP_1_HINGE');
    screeningStepRef.current = 'STEP_1_HINGE';
    setScreeningHingeReport(null);
    screeningHingeReportRef.current = null;
    setScreeningRotationResult(null);
    setGolfBodyScoreResult(null);
    setReport(null);
    setRotationResult(null);
    setSpokenCues([]);

    setActiveProtocol('HIP_HINGE_V1');
    activeProtocolRef.current = 'HIP_HINGE_V1';
    readinessEngineRef.current.setRequiredView('SIDE');
    readinessEngineRef.current.reset();
    setReadinessResult(null);
    lastReadinessRef.current = null;
    autoStartTriggeredRef.current = false;
    liveCoachingEngineRef.current?.reset();
    liveRotationCoachingEngineRef.current?.reset();
    cancelBriefing();

    if (modeRef.current === 'WEBCAM') {
      poseSequenceRef.current = [];
      frameCountRef.current = 0;
      decodedFramesRef.current = [];
      setAppTestState('SETUP');
      appTestStateRef.current = 'SETUP';
      playScreeningBriefing();
    } else {
      startWebcam();
    }
  };

  const handleSwitchProtocol = (protocolId: 'HIP_HINGE_V1' | 'THORACIC_ROTATION_V1') => {
    setIsScreeningFlow(false);
    isScreeningFlowRef.current = false;
    setScreeningStep('IDLE');
    screeningStepRef.current = 'IDLE';
    setScreeningHingeReport(null);
    screeningHingeReportRef.current = null;
    setScreeningRotationResult(null);
    setGolfBodyScoreResult(null);

    setActiveProtocol(protocolId);
    activeProtocolRef.current = protocolId;
    setReport(null);
    setRotationResult(null);
    setSpokenCues([]);
    readinessEngineRef.current.setRequiredView(protocolId === 'THORACIC_ROTATION_V1' ? 'FRONT' : 'SIDE');
    readinessEngineRef.current.reset();
    setReadinessResult(null);
    lastReadinessRef.current = null;
    autoStartTriggeredRef.current = false;
    liveCoachingEngineRef.current?.reset();
    liveRotationCoachingEngineRef.current?.reset();
    cancelBriefing();

    if (modeRef.current === 'WEBCAM' && (coachingModeRef.current === 'GUIDED' || coachingModeRef.current === 'FULL')) {
      playGuidedBriefing(protocolId);
    }
  };

  const [showGlobalKeyModal, setShowGlobalKeyModal] = useState(false);
  const [hasGlobalKey, setHasGlobalKey] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');

  useEffect(() => {
    setHasGlobalKey(aiCoachServiceRef.current.hasApiKey());
  }, []);

  const openKeyModal = () => {
    setTempApiKey(aiCoachServiceRef.current.getApiKey() || '');
    setShowGlobalKeyModal(true);
  };

  const handleSaveApiKey = () => {
    const cleaned = tempApiKey.trim();
    if (cleaned) {
      aiCoachServiceRef.current.setApiKey(cleaned);
      setHasGlobalKey(true);
    }
    setShowGlobalKeyModal(false);
    setTempApiKey('');
  };

  const handleClearApiKey = () => {
    aiCoachServiceRef.current.setApiKey('');
    setHasGlobalKey(false);
    setTempApiKey('');
  };

  useEffect(() => {
    audioCoachRef.current.onSpoken((entry) => {
      setSpokenCues(prev => [...prev, entry]);
      setActiveSubtitle(entry.text);
      setTimeout(() => {
        setActiveSubtitle(current => current === entry.text ? null : current);
      }, 3500);
    });

    liveCoachingEngineRef.current = new LiveCoachingEngine(audioCoachRef.current, {
      onAllRepsComplete: () => {
        if (isScreeningFlowRef.current && screeningStepRef.current === 'STEP_1_HINGE') {
          try {
            const traceBuilder = new PipelineTraceBuilder(`session_screening_hinge_${Date.now()}`)
              .setAnalysisMode('LIVE')
              .setPoseModel('MEDIAPIPE_POSE', '0.10.14', '1', modelShaRef.current)
              .setCamera('640x480', 30)
              .setDevice('Web Browser', navigator.userAgent)
              .setDecodedFrames(decodedFramesRef.current);

            const rep = runPipelineRef.current(poseSequenceRef.current, traceBuilder);
            screeningHingeReportRef.current = rep;
            setScreeningHingeReport(rep);
          } catch (err) {
            console.error('Failed to run screening hinge pipeline:', err);
          }

          screeningStepRef.current = 'TRANSITION';
          setScreeningStep('TRANSITION');

          audioCoachRef.current.speak(
            'SCREENING_STEP_TRANSITION',
            'HIGH'
          );

          setActiveProtocol('THORACIC_ROTATION_V1');
          activeProtocolRef.current = 'THORACIC_ROTATION_V1';
          readinessEngineRef.current.setRequiredView('FRONT');
          readinessEngineRef.current.reset();
          setReadinessResult(null);
          lastReadinessRef.current = null;
          activeStartTimeRef.current = undefined;
          autoStartTriggeredRef.current = false;
          setCountdownNumber(null);
          setAppTestState('SETUP');
          appTestStateRef.current = 'SETUP';
          liveRotationCoachingEngineRef.current?.reset();

          setTimeout(() => {
            if (isScreeningFlowRef.current) {
              screeningStepRef.current = 'STEP_2_ROTATION';
              setScreeningStep('STEP_2_ROTATION');
              audioCoachRef.current.speak(
                'CROSS_ARMS',
                'HIGH'
              );
            }
          }, 3500);
          return;
        }

        // Allow the final rep completion announcement to be spoken before stopping
        setTimeout(() => {
          stopWebcamRef.current();
        }, 1500);
      }
    });

    liveRotationCoachingEngineRef.current = new LiveRotationCoachingEngine(audioCoachRef.current, {
      onComplete: () => {
        if (isScreeningFlowRef.current && screeningStepRef.current === 'STEP_2_ROTATION') {
          const rotSamples = liveRotationCoachingEngineRef.current?.getSamples() || [];
          const rotSummary = summarizeThoracicRotation(rotSamples);
          setScreeningRotationResult(rotSummary);

          const finalScore = calculateGolfBodyScore(
            screeningHingeReportRef.current,
            rotSummary,
            audioCoachRef.current.getLanguage()
          );
          setGolfBodyScoreResult(finalScore);

          audioCoachRef.current.speak(
            'SCREENING_ALL_COMPLETE',
            'HIGH'
          );

          setTimeout(() => {
            stopWebcamRef.current();
            setScreeningStep('COMPLETE');
            screeningStepRef.current = 'COMPLETE';
          }, 2000);
          return;
        }

        setTimeout(() => {
          stopWebcamRef.current();
        }, 1500);
      }
    });
  }, []);

  useEffect(() => {
    audioCoachRef.current.setLanguage(language);
    if (isBriefingActiveRef.current) {
      playGuidedBriefing(activeProtocolRef.current);
    }
  }, [language]);

  useEffect(() => {
    audioCoachRef.current.setMode(coachingMode);
    coachingModeRef.current = coachingMode;
    if (coachingMode !== 'GUIDED' && coachingMode !== 'FULL') {
      cancelBriefing();
    } else if (appTestStateRef.current === 'SETUP' && modeRef.current === 'WEBCAM') {
      playGuidedBriefing(activeProtocolRef.current);
    }
  }, [coachingMode]);
  
  interface CachedFrame {
    sequenceIndex: number;
    mediaTimeMs: number;
    presentedFrame: number;
    bitmap: ImageBitmap;
  }
  const frameCacheRef = useRef<Map<number, CachedFrame>>(new Map());
  
  const poseSequenceRef = useRef<PoseSequence>([]);
  const requestRef = useRef<number>(0);
  const lastVideoTimeRef = useRef<number>(-1);
  const frameCountRef = useRef(0);

  // Initialize MediaPipe
  useEffect(() => {
    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        
        // Fetch model to compute SHA
        const resp = await fetch('/pose_landmarker_full.task');
        const blob = await resp.blob();
        const sha = await computeSha256(blob);
        setModelSha(sha);
        modelShaRef.current = sha;

        const pm = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/pose_landmarker_full.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        
        setLandmarker(pm);
        setIsInitializing(false);
      } catch (err) {
        console.error('Failed to initialize MediaPipe', err);
      }
    }
    init();
  }, []);

  const decodedFramesRef = useRef<DecodedFrameTrace[]>([]);
  const lastPresentedFramesRef = useRef<number>(-1);
  const vfcCallbackId = useRef<number>(0);

  const runPipeline = (frames: PoseSequence, traceBuilder: PipelineTraceBuilder): DeviceValidationReport => {
    const pipeline = new TemporalPipeline({
      protocol: harnessProtocol,
      activeStartTimeMs: activeStartTimeRef.current
    });
    const result = pipeline.process(frames, traceBuilder);
    const trace = result.trace;
    setLastReps(result.repetitions || []);

    return {
      status: result.status,
      device: { model: trace.deviceModel, osVersion: trace.osVersion },
      model: { variant: 'FULL', runtimeVersion: trace.runtimeVersion, assetVersion: trace.assetVersion, sha256: trace.modelSha256 },
      capture: {
        resolution: trace.resolution,
        cameraFps: trace.fps,
        processedFps: trace.analysisTargetFps || trace.fps,
        durationMs: trace.mediaDurationMs || trace.wallClockDurationMs,
        rawFrameCount: trace.rawFrameCount,
        processedFrameCount: trace.validFrameCount,
        droppedFrameCount: trace.rejectedFrameCount,
        sourceDecodedFrameCount: trace.sourceDecodedFrameCount,
        poseInferenceFrameCount: trace.poseInferenceFrameCount,
        presentedFrameCallbacks: trace.presentedFrameCallbacks,
        missedPresentedFrames: trace.missedPresentedFrames,
        duplicateMediaTimestamps: trace.duplicateMediaTimestamps
      },
      inference: { meanLatencyMs: null, p50LatencyMs: null, p95LatencyMs: null, maxLatencyMs: null }, // Stub for web
      landmarks: {
        expectedPerPose: 33,
        validPoseFrameCount: result.trace.validFrameCount,
        rejectedPoseFrameCount: result.trace.rejectedFrameCount,
        interpolatedGapCount: result.trace.interpolatedFrameCount
      },
      measurement: {
        detectedRepCount: result.repetitions.length,
        validRepCount: result.repetitions.length,
        metrics: result.repetitions.flatMap(r => [
          r.hipHingeAngle2D, r.trunkInclination, r.kneeAngleAtEndpoint, r.shankInclination, r.posteriorHipShift
        ]),
        compensations: result.repetitions.flatMap(r => r.compensations),
        confidence: result.confidence.overall,
        qualityFlags: result.confidence.flags
      },
      failureCodes: result.failureCode ? [result.failureCode] : [],
      trace: result.trace
    };
  };
  runPipelineRef.current = runPipeline;

  const processWebcamFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !landmarker) return;
    const video = videoRef.current;
    
    if (modeRef.current !== 'WEBCAM') return;

    const timestampMs = performance.now();
    
    if (timestampMs > lastVideoTimeRef.current) {
      lastVideoTimeRef.current = timestampMs;

      // Auto-sync canvas resolution with native video stream resolution
      if (video.videoWidth > 0 && canvasRef.current) {
        if (canvasRef.current.width !== video.videoWidth || canvasRef.current.height !== video.videoHeight) {
          canvasRef.current.width = video.videoWidth;
          canvasRef.current.height = video.videoHeight;
        }
      }
      
      const result = landmarker.detectForVideo(video, timestampMs);
      
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(video, 0, 0, canvasRef.current.width, canvasRef.current.height);
        
        if (result.landmarks && result.landmarks.length > 0) {
          drawSkeleton(ctx, result.landmarks[0], canvasRef.current!.width, canvasRef.current!.height);
        }
      }

      try {
        const poseFrame = convertWebResultToPoseFrame(
          result,
          frameCountRef.current++,
          timestampMs,
          video.videoWidth,
          video.videoHeight,
          { model: 'MEDIAPIPE_POSE', modelVersion: '0.10.14' }
        );

        if (poseFrame) {
          poseSequenceRef.current.push(poseFrame);
          decodedFramesRef.current.push({
            sequenceIndex: frameCountRef.current - 1,
            mediaTimeMs: timestampMs,
            duplicateTimestamp: false
          });

          if (appTestStateRef.current === 'SETUP') {
            if (isScreeningFlowRef.current && screeningStepRef.current === 'TRANSITION') {
              return;
            }
            const rResult = readinessEngineRef.current.process(poseFrame);
            if (
              !lastReadinessRef.current || 
              lastReadinessRef.current.state !== rResult.state || 
              lastReadinessRef.current.feedback !== rResult.feedback
            ) {
              lastReadinessRef.current = { ...rResult };
              setReadinessResult(rResult);
            }

            // Spoken setup assistance in GUIDED mode (only when briefing is not playing)
            if (
              !isBriefingActiveRef.current &&
              (coachingModeRef.current === 'GUIDED' || coachingModeRef.current === 'FULL') &&
              rResult.feedback &&
              rResult.state !== 'READY' &&
              timestampMs - lastReadinessCueTimeRef.current > 4000
            ) {
              audioCoachRef.current.speak(rResult.feedback as CoachingPhraseKey, 'NORMAL', timestampMs);
              lastReadinessCueTimeRef.current = timestampMs;
            }

            // Hands-free Auto-Start:
            // When user enters and holds READY for 1200ms AND briefing is not active, trigger countdown!
            if (!isBriefingActiveRef.current && rResult.state === 'READY' && rResult.heldMs >= 1200 && !autoStartTriggeredRef.current) {
              handleStartTest();
            }
          } else if (appTestStateRef.current === 'ACTIVE') {
            if (activeProtocolRef.current === 'THORACIC_ROTATION_V1') {
              liveRotationCoachingEngineRef.current?.processFrame(poseFrame);
            } else {
              liveCoachingEngineRef.current?.processFrame(poseFrame);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to convert frame:', e);
      }
    }
    
    if (modeRef.current === 'WEBCAM' && !video.paused && !video.ended) {
      requestRef.current = requestAnimationFrame(processWebcamFrame);
    }
  };

  const videoFrameCallback = async (now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) => {
    if (modeRef.current !== 'VIDEO' || !videoRef.current || !landmarker) return;
    
    const mediaTimeMs = metadata.mediaTime * 1000;
    const isDuplicate = mediaTimeMs <= lastVideoTimeRef.current;
    
    if (metadata.presentedFrames > lastPresentedFramesRef.current + 1 && lastPresentedFramesRef.current !== -1) {
       console.warn(`Missed ${metadata.presentedFrames - lastPresentedFramesRef.current - 1} frames`);
    }
    
    decodedFramesRef.current.push({
      sequenceIndex: frameCountRef.current,
      mediaTimeMs,
      presentedFrame: metadata.presentedFrames,
      duplicateTimestamp: isDuplicate
    });
    
    lastPresentedFramesRef.current = metadata.presentedFrames;

    if (!isDuplicate) {
      lastVideoTimeRef.current = mediaTimeMs;
      
      // Synchronous frame capture for GT-1 Annotation
      try {
        const offscreen = new OffscreenCanvas(videoRef.current.videoWidth, videoRef.current.videoHeight);
        const octx = offscreen.getContext('2d');
        if (octx) {
          octx.drawImage(videoRef.current, 0, 0);
          const bitmap = offscreen.transferToImageBitmap();
          
          frameCacheRef.current.set(frameCountRef.current, {
            sequenceIndex: frameCountRef.current,
            mediaTimeMs,
            presentedFrame: metadata.presentedFrames,
            bitmap
          });
          
          // Keep last 150 frames to avoid OOM
          if (frameCacheRef.current.size > 150) {
            const oldestKey = Math.min(...Array.from(frameCacheRef.current.keys()));
            const oldest = frameCacheRef.current.get(oldestKey);
            if (oldest) {
              oldest.bitmap.close();
              frameCacheRef.current.delete(oldestKey);
            }
          }
        }
      } catch (e) {
        console.warn('Frame capture failed', e);
      }

      // We must pass a strictly increasing timestamp to MediaPipe
      const mpTimestamp = performance.now();
      const result = landmarker.detectForVideo(videoRef.current, mpTimestamp);
      
      const ctx = canvasRef.current!.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
        ctx.drawImage(videoRef.current, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
        
        if (result.landmarks && result.landmarks.length > 0) {
          drawSkeleton(ctx, result.landmarks[0], canvasRef.current!.width, canvasRef.current!.height);
        }
      }

      try {
        const poseFrame = convertWebResultToPoseFrame(
          result,
          frameCountRef.current++,
          mediaTimeMs, // Canonical timestamp
          videoRef.current.videoWidth,
          videoRef.current.videoHeight,
          { model: 'MEDIAPIPE_POSE', modelVersion: '0.10.14' }
        );

        if (poseFrame) {
          poseSequenceRef.current.push(poseFrame);
        }
      } catch (e) {
        console.warn('Failed to convert frame:', e);
      }
    }
    
    if (!videoRef.current.ended) {
      vfcCallbackId.current = (videoRef.current as any).requestVideoFrameCallback(videoFrameCallback);
    }
  };

  const handleVideoEnded = () => {
    if (modeRef.current === 'VIDEO' && !running1C && !running1D) {
      const traceBuilder = new PipelineTraceBuilder(`session_${Date.now()}`)
        .setAnalysisMode('RECORDED')
        .setPoseModel('MEDIAPIPE_POSE', '0.10.14', '1', modelSha)
        .setCamera('Unknown', 30)
        .setDevice('Web Browser', navigator.userAgent)
        .setDecodedFrames(decodedFramesRef.current);
      
      const rep = runPipeline(poseSequenceRef.current, traceBuilder);
      setReport(rep);
    }
  };

  const startWebcam = async () => {
    if (!videoRef.current) return;
    poseSequenceRef.current = [];
    frameCountRef.current = 0;
    decodedFramesRef.current = [];
    if (!isScreeningFlowRef.current) {
      setReport(null);
      setRotationResult(null);
      setDeterminismReports(null);
      setLastReps([]);
    }

    setAppTestState('SETUP');
    appTestStateRef.current = 'SETUP';
    readinessEngineRef.current.reset();
    readinessEngineRef.current.setRequiredView(activeProtocolRef.current === 'THORACIC_ROTATION_V1' ? 'FRONT' : 'SIDE');
    setReadinessResult(null);
    lastReadinessRef.current = null;
    activeStartTimeRef.current = undefined;
    autoStartTriggeredRef.current = false;
    setCountdownNumber(null);
    liveCoachingEngineRef.current?.reset();
    liveRotationCoachingEngineRef.current?.reset();
    audioCoachRef.current.clearHistory();
    setSpokenCues([]);
    setActiveSubtitle(null);
    cancelBriefing();

    // Clear old cache
    frameCacheRef.current.forEach(c => c.bitmap.close());
    frameCacheRef.current.clear();
    
    unlockAudio();
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: cameraFacingRef.current }
        },
        audio: false
      };
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.warn('getUserMedia facingMode fallback to basic video', err);
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setMode('WEBCAM');
      modeRef.current = 'WEBCAM';
      setMobileTab('TEST');
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setIsMobileFullscreen(true);
      }
      processWebcamFrame();
      if (isScreeningFlowRef.current) {
        playScreeningBriefing();
      } else if (coachingModeRef.current === 'GUIDED' || coachingModeRef.current === 'FULL') {
        playGuidedBriefing(activeProtocolRef.current);
      }
    } catch (e) {
      console.error('Webcam error', e);
    }
  };

  const toggleCameraFacing = async () => {
    if (isSwitchingCamera) return;
    setIsSwitchingCamera(true);
    unlockAudio();
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextFacing);
    cameraFacingRef.current = nextFacing;

    if (modeRef.current === 'WEBCAM' && videoRef.current) {
      if (videoRef.current.srcObject) {
        const currentStream = videoRef.current.srcObject as MediaStream;
        currentStream.getTracks().forEach(track => {
          try { track.stop(); } catch (e) { /* ignore */ }
        });
        videoRef.current.srcObject = null;
        try { videoRef.current.pause(); } catch (e) { /* ignore */ }
      }

      // iOS Safari requires a short delay for camera hardware session release before requesting new sensor
      await new Promise(resolve => setTimeout(resolve, 250));

      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: nextFacing }
            },
            audio: false
          });
        } catch (errFacing) {
          console.warn('FacingMode toggle fallback to basic video', errFacing);
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        console.error('Failed to flip camera:', err);
      }
    }
    setIsSwitchingCamera(false);
  };

  const toggleFullscreen = () => {
    const next = !isMobileFullscreen;
    setIsMobileFullscreen(next);
    if (next) {
      try {
        if (typeof document !== 'undefined' && document.documentElement.requestFullscreen && !document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch {
        // Ignore fullscreen error
      }
    } else {
      try {
        if (typeof document !== 'undefined' && document.exitFullscreen && document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      } catch {
        // Ignore exit error
      }
    }
  };

  const stopWebcam = () => {
    setIsMobileFullscreen(false);
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    cancelBriefing();
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setMobileTab('REPORT');
    if (isScreeningFlowRef.current) {
      liveCoachingEngineRef.current?.reset();
      liveRotationCoachingEngineRef.current?.reset();
    } else {
      if (activeProtocolRef.current === 'THORACIC_ROTATION_V1') {
        const rotSamples = liveRotationCoachingEngineRef.current?.getSamples() || [];
        const rotSummary = summarizeThoracicRotation(rotSamples);
        setRotationResult(rotSummary);
        liveRotationCoachingEngineRef.current?.reset();
      } else {
        liveCoachingEngineRef.current?.reset();
      }
    }

    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    cancelAnimationFrame(requestRef.current);
    setMode('IDLE');
    modeRef.current = 'IDLE';
    setAppTestState('SETUP');
    appTestStateRef.current = 'SETUP';

    if (!isScreeningFlowRef.current && activeProtocolRef.current === 'HIP_HINGE_V1' && poseSequenceRef.current.length > 0) {
      try {
        const traceBuilder = new PipelineTraceBuilder(`session_${Date.now()}`)
          .setAnalysisMode('LIVE')
          .setPoseModel('MEDIAPIPE_POSE', '0.10.14', '1', modelSha)
          .setCamera('640x480', 30)
          .setDevice('Web Browser', navigator.userAgent)
          .setDecodedFrames(decodedFramesRef.current);

        const rep = runPipeline(poseSequenceRef.current, traceBuilder);
        setReport(rep);
      } catch (err) {
        console.error('Failed to run pipeline on webcam stop:', err);
      }
    }
  };

  useEffect(() => {
    stopWebcamRef.current = stopWebcam;
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !videoRef.current) return;
    
    stopWebcam();
    setReport(null);
    setDeterminismReports(null);
    setLastReps([]);
    
    // Clear old cache
    frameCacheRef.current.forEach(c => c.bitmap.close());
    frameCacheRef.current.clear();
    
    poseSequenceRef.current = [];
    frameCountRef.current = 0;
    
    const url = URL.createObjectURL(file);
    videoRef.current.src = url;
    videoRef.current.onloadeddata = async () => {
      setMode('VIDEO');
      modeRef.current = 'VIDEO';
      lastPresentedFramesRef.current = -1;
      decodedFramesRef.current = [];
      await videoRef.current!.play();
      vfcCallbackId.current = (videoRef.current as any).requestVideoFrameCallback(videoFrameCallback);
    };
  };

  const runDeterminism1C = async () => {
    if (poseSequenceRef.current.length === 0) {
      alert('Vänta tills videon har spelats upp minst en gång (eller ladda upp den igen).');
      return;
    }
    setRunning1C(true);
    setDeterminismReports(null);
    
    try {
      // Hash the deterministic parts of the report for 10 runs
      const frozenSequence = [...poseSequenceRef.current];
      const hashes: string[] = [];
      
      for (let i = 0; i < 10; i++) {
        const traceBuilder = new PipelineTraceBuilder(`det1c_${i}`)
          .setAnalysisMode('RECORDED')
          .setPoseModel('MEDIAPIPE_POSE', '0.10.14', '1', modelSha)
          .setCamera('Unknown', 30)
          .setDevice('Web Browser', navigator.userAgent)
          .setDecodedFrames(decodedFramesRef.current);
        
        const rep = runPipeline(frozenSequence, traceBuilder);
        
        // Remove volatile fields before hashing
        const deterministicRep = JSON.parse(JSON.stringify(rep));
        delete deterministicRep.trace.sessionId;
        delete deterministicRep.trace.startTimestamp;
        delete deterministicRep.trace.endTimestamp;
        delete deterministicRep.trace.wallClockDurationMs;
        
        const hash = await computeSha256(new Blob([JSON.stringify(deterministicRep)]));
        hashes.push(hash);
      }
      
      const allMatch = hashes.every(h => h === hashes[0]);
      console.log(`WEB-DV-1C Result: ${allMatch ? 'PASS' : 'FAIL'}`, hashes);
      alert(`WEB-DV-1C: ${allMatch ? 'PASS (All 10 hashes match)' : 'FAIL (Hashes differ)'}\nHash: ${hashes[0]}`);
    } catch (e) {
      console.error(e);
      alert('Kunde inte köra 1C testet: ' + String(e));
    } finally {
      setRunning1C(false);
    }
  };

  const runDeterminism1D = async () => {
    if (!videoRef.current || !videoRef.current.src) return;
    setRunning1D(true);
    setDeterminismReports(null);
    
    try {
      const reports: DeviceValidationReport[] = [];
      
      for (let i = 0; i < 10; i++) {
      poseSequenceRef.current = [];
      frameCountRef.current = 0;
      lastVideoTimeRef.current = -1;
      lastPresentedFramesRef.current = -1;
      decodedFramesRef.current = [];
      
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      await new Promise<void>(resolve => {
        const onSeeked = () => {
          videoRef.current!.removeEventListener('seeked', onSeeked);
          resolve();
        };
        videoRef.current!.addEventListener('seeked', onSeeked);
      });
      await new Promise(r => setTimeout(r, 100)); // allow media pipeline to settle
      await videoRef.current.play();
      
      await new Promise<void>((resolve) => {
        const onEnded = () => {
          videoRef.current!.removeEventListener('ended', onEnded);
          const traceBuilder = new PipelineTraceBuilder(`det1d_${i}`)
            .setAnalysisMode('RECORDED')
            .setPoseModel('MEDIAPIPE_POSE', '0.10.14', '1', modelSha)
            .setCamera('Unknown', 30)
            .setDevice('Web Browser', navigator.userAgent)
            .setDecodedFrames(decodedFramesRef.current);
          reports.push(runPipeline(poseSequenceRef.current, traceBuilder));
          resolve();
        };
        videoRef.current!.addEventListener('ended', onEnded);

        const loop = (now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) => {
          // Re-use logic from videoFrameCallback but isolated for the test
          const mediaTimeMs = metadata.mediaTime * 1000;
          const isDuplicate = mediaTimeMs <= lastVideoTimeRef.current;
          
          decodedFramesRef.current.push({
            sequenceIndex: frameCountRef.current,
            mediaTimeMs,
            presentedFrame: metadata.presentedFrames,
            duplicateTimestamp: isDuplicate
          });
          
          lastPresentedFramesRef.current = metadata.presentedFrames;
      
          if (!isDuplicate) {
            lastVideoTimeRef.current = mediaTimeMs;
            const mpTimestamp = performance.now();
            const result = landmarker!.detectForVideo(videoRef.current!, mpTimestamp);
            try {
              const poseFrame = convertWebResultToPoseFrame(
                result, frameCountRef.current++, mediaTimeMs, videoRef.current!.videoWidth, videoRef.current!.videoHeight,
                { model: 'MEDIAPIPE_POSE', modelVersion: '0.10.14' }
              );
              if (poseFrame) poseSequenceRef.current.push(poseFrame);
            } catch (e) {}
          }
          if (!videoRef.current!.ended) {
            (videoRef.current as any).requestVideoFrameCallback(loop);
          }
        };
        (videoRef.current as any).requestVideoFrameCallback(loop);
      });
    }
    
    setDeterminismReports(reports);
    } catch (e) {
      console.error(e);
      alert('Kunde inte köra 1D testet: ' + String(e));
    } finally {
      setRunning1D(false);
    }
  };

  const handleStartTest = () => {
    if (appTestStateRef.current !== 'SETUP') return;
    autoStartTriggeredRef.current = true;
    setAppTestState('COUNTDOWN');
    appTestStateRef.current = 'COUNTDOWN';
    let count = 3;
    setCountdownNumber(count);
    playAudioTone(520, 180);
    audioCoachRef.current.speak('COUNTDOWN_3', 'HIGH', performance.now());

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdownNumber(count);
        playAudioTone(520, 180);
        if (count === 2) audioCoachRef.current.speak('COUNTDOWN_2', 'HIGH', performance.now());
        if (count === 1) audioCoachRef.current.speak('COUNTDOWN_1', 'HIGH', performance.now());
      } else {
        clearInterval(interval);
        setCountdownNumber(null);
        setAppTestState('ACTIVE');
        appTestStateRef.current = 'ACTIVE';
        activeStartTimeRef.current = performance.now();
        playAudioTone(880, 450); // GO!
        audioCoachRef.current.speak('COUNTDOWN_GO', 'HIGH', activeStartTimeRef.current);
      }
    }, 1000);
  };

  if (isInitializing) return <div className="p-8 text-white">Loading MediaPipe Tasks Vision...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-3 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4 pb-2 border-b border-gray-800">
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏌️‍♂️</span>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Golf Body OS
                </h1>
              </div>

              {/* Protocol Switcher */}
              <div className="flex flex-wrap bg-gray-900 p-1 rounded-xl border border-gray-800 shadow-md">
                <button
                  onClick={() => {
                    unlockAudio();
                    handleStartScreeningFlow();
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    isScreeningFlow
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg border border-emerald-400/50'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span>🏆</span>
                  <span>{language === 'sv-SE' ? 'Hel screening' : 'Full Screening'}</span>
                </button>
                <button
                  onClick={() => {
                    unlockAudio();
                    handleSwitchProtocol('HIP_HINGE_V1');
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    !isScreeningFlow && activeProtocol === 'HIP_HINGE_V1'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span>🏋️</span>
                  <span>{language === 'sv-SE' ? '1. Höftfällning' : '1. Hip Hinge'}</span>
                </button>
                <button
                  onClick={() => {
                    unlockAudio();
                    handleSwitchProtocol('THORACIC_ROTATION_V1');
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    !isScreeningFlow && activeProtocol === 'THORACIC_ROTATION_V1'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span>🏌️</span>
                  <span>{language === 'sv-SE' ? '2. Bröstrygg' : '2. Thoracic'}</span>
                </button>
              </div>
            </div>
            <p className="text-gray-400 font-mono text-xs mt-1">
              {isScreeningFlow
                ? (language === 'sv-SE' ? 'Sammanhängande: Test 1 Höftfällning (Sida) → Övergång → Test 2 Bröstryggsrotation (Fram) → Score' : 'Continuous: Test 1 Hip Hinge (Side) → Transition → Test 2 Thoracic (Front) → Score')
                : activeProtocol === 'HIP_HINGE_V1'
                ? (language === 'sv-SE' ? 'Sidovy (vänster) – Mäter höftvinkel, knävinkel och hållning' : 'Side view (left) – Measures hip hinge, knee flex & posture')
                : (language === 'sv-SE' ? 'Framifrån – Mäter bröstryggsrotation (L/R), bäckenstabilitet och X-Factor' : 'Front view – Measures thoracic turn (L/R), pelvic stability & X-Factor')}
            </p>
          </div>

          {/* Audio Coach & Language Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-gray-900/90 px-3 py-1.5 rounded-xl border border-gray-800 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-gray-300 font-medium">
              <Globe size={15} className="text-blue-400" />
              <div className="flex bg-gray-950 rounded-lg p-0.5 border border-gray-800">
                <button 
                  onClick={() => { unlockAudio(); setLanguage('en-US'); }}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${language === 'en-US' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                >
                  EN
                </button>
                <button 
                  onClick={() => { unlockAudio(); setLanguage('sv-SE'); }}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${language === 'sv-SE' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                >
                  SV
                </button>
              </div>
            </div>

            <div className="w-[1px] h-5 bg-gray-800" />

            <div className="flex bg-gray-950 rounded-lg p-0.5 border border-gray-800">
              <button
                onClick={() => { unlockAudio(); setCoachingMode('GUIDED'); }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition ${
                  coachingMode === 'GUIDED' || coachingMode === 'FULL'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
                title={language === 'sv-SE' ? 'Guidad: Leder tempot steg-för-steg + korrigeringar (Nybörjare / Screening)' : 'Guided: Leads movement tempo & all phases step-by-step + corrections'}
              >
                <Compass size={13} />
                <span className="hidden sm:inline">{language === 'sv-SE' ? 'Guidad' : 'Guided'}</span>
              </button>

              <button
                onClick={() => { unlockAudio(); setCoachingMode('CORRECTIVE'); }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition ${
                  coachingMode === 'CORRECTIVE'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
                title={language === 'sv-SE' ? 'Korrigerande: Helt tyst vid god teknik – griper bara in med röst vid fel' : 'Corrective: Silent during clean technique – only intervenes on faults'}
              >
                <Target size={13} />
                <span className="hidden sm:inline">{language === 'sv-SE' ? 'Korrigerande' : 'Corrective'}</span>
              </button>

              <button
                onClick={() => { unlockAudio(); setCoachingMode('REPS_ONLY'); }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition ${
                  coachingMode === 'REPS_ONLY'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
                title={language === 'sv-SE' ? 'Bara Reps: Räknar repetitioner utan avbrott' : 'Reps Only: Counts reps only'}
              >
                <span className="font-mono font-black text-xs">#</span>
              </button>

              <button
                onClick={() => { unlockAudio(); setCoachingMode('MUTED'); }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition ${
                  coachingMode === 'MUTED'
                    ? 'bg-red-700 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
                title={language === 'sv-SE' ? 'Stäng av röstcoachen helt' : 'Mute all audio'}
              >
                <VolumeX size={13} />
              </button>
            </div>

            <div className="w-[1px] h-5 bg-gray-800" />

            {/* Gemini API Key Button */}
            <button
              onClick={openKeyModal}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                hasGlobalKey
                  ? 'bg-purple-950/50 border-purple-500/60 text-purple-200 hover:bg-purple-900/60 shadow-sm'
                  : 'bg-amber-950/40 border-amber-500/50 text-amber-200 hover:bg-amber-900/50'
              }`}
              title={language === 'sv-SE' ? 'Hantera Google Gemini API-nyckel' : 'Manage Google Gemini API Key'}
            >
              <Key size={13} className={hasGlobalKey ? 'text-purple-400' : 'text-amber-400'} />
              <span className="hidden sm:inline">{hasGlobalKey ? 'Gemini AI' : 'API-nyckel'}</span>
              {hasGlobalKey && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {mode === 'WEBCAM' ? (
            <button
              onClick={stopWebcam}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 active:scale-95 px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-red-600/30 transition"
            >
              <span>⏹</span> {language === 'sv-SE' ? 'Avsluta & Analysera' : 'Stop Capture & Analyze'}
            </button>
          ) : (
            <button
              onClick={() => { unlockAudio(); startWebcam(); }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-600/30 transition"
            >
              <Camera size={18} /> {language === 'sv-SE' ? 'Starta Kamera' : 'Live Camera'}
            </button>
          )}

          {mode === 'WEBCAM' && (
            <button
              onClick={toggleCameraFacing}
              disabled={isSwitchingCamera}
              type="button"
              className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 active:scale-95 text-gray-200 px-3.5 py-2.5 rounded-xl font-medium text-xs border border-gray-700 transition"
              title={language === 'sv-SE' ? 'Växla mellan fram/bakkamera' : 'Switch between front/rear camera'}
            >
              <SwitchCamera size={16} className={isSwitchingCamera ? 'animate-spin' : ''} />
              <span>{cameraFacing === 'user' ? (language === 'sv-SE' ? 'Selfie' : 'Front') : (language === 'sv-SE' ? 'Bakre' : 'Rear')}</span>
            </button>
          )}

          {mode === 'WEBCAM' && (
            <button
              onClick={toggleFullscreen}
              type="button"
              className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 active:scale-95 text-gray-200 px-3.5 py-2.5 rounded-xl font-medium text-xs border border-gray-700 transition"
              title={isMobileFullscreen ? (language === 'sv-SE' ? 'Lämna helskärm' : 'Exit Fullscreen') : (language === 'sv-SE' ? 'Helskärm' : 'Fullscreen')}
            >
              {isMobileFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              <span>{isMobileFullscreen ? (language === 'sv-SE' ? 'Mindre vy' : 'Exit') : (language === 'sv-SE' ? 'Helskärm' : 'Fullscreen')}</span>
            </button>
          )}

          <div className="relative">
            <input type="file" accept="video/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" ref={fileInputRef} />
            <button className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 active:scale-95 text-gray-300 px-3.5 py-2.5 rounded-xl font-medium text-xs border border-gray-700 transition">
              <Upload size={16} /> {language === 'sv-SE' ? 'Ladda upp Video' : 'Upload Video'}
            </button>
          </div>

          {/* Wi-Fi Guide & QR Code Button */}
          <button
            onClick={() => setShowQrModal(true)}
            type="button"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 text-[11px] text-emerald-300 font-mono transition active:scale-95 cursor-pointer shadow-sm"
            title="Klicka för att visa QR-kod att scanna med mobilen"
          >
            <QrCode size={14} className="text-emerald-400" />
            <span>Mobil:</span>
            <span className="font-bold underline">Scanna QR</span>
          </button>

          {/* Mobile-Friendly Segmented View Switcher (Visible on screens < lg) */}
          <div className="lg:hidden flex ml-auto bg-gray-900 rounded-xl p-1 border border-gray-800 shadow-inner">
            <button
              onClick={() => setMobileTab('TEST')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                mobileTab === 'TEST' ? 'bg-blue-600 text-white shadow' : 'text-gray-400'
              }`}
            >
              📹 {language === 'sv-SE' ? 'Kamera' : 'Camera'}
            </button>
            <button
              onClick={() => setMobileTab('REPORT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                mobileTab === 'REPORT' ? 'bg-purple-600 text-white shadow' : 'text-gray-400'
              }`}
            >
              <span>📊 {language === 'sv-SE' ? 'Rapport' : 'Report'}</span>
              {(golfBodyScoreResult || report) && <span className="w-2 h-2 rounded-full bg-emerald-400"></span>}
            </button>
          </div>
          
          <div className="hidden lg:flex gap-2 ml-auto">
            <button onClick={runDeterminism1C} disabled={mode !== 'VIDEO' || running1C || running1D} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-semibold">
              <RefreshCw size={14} className={running1C ? 'animate-spin' : ''} /> 
              {running1C ? 'Running...' : 'WEB-DV-1C'}
            </button>
            <button onClick={runDeterminism1D} disabled={mode !== 'VIDEO' || running1C || running1D} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-semibold">
              <RefreshCw size={14} className={running1D ? 'animate-spin' : ''} /> 
              {running1D ? 'Running...' : 'WEB-DV-1D'}
            </button>
            <button onClick={() => setAnnotationMode(true)} disabled={mode !== 'VIDEO' || running1C || running1D || lastReps.length !== 3} className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-semibold">
              GT-1
            </button>
          </div>
        </div>

        {annotationMode ? (
          <AnnotatorView 
            endpoints={lastReps.map(r => ({ 
              rep: r, 
              rawFrame: poseSequenceRef.current.find(pf => pf.frameId === r.endpointFrameId),
              cache: frameCacheRef.current.get(r.endpointFrameId) 
            }))} 
            onClose={() => setAnnotationMode(false)} 
          />
        ) : (
          <div>
            {isScreeningFlow && (
              <div className="bg-slate-800/90 border border-emerald-500/40 rounded-xl p-3.5 mb-6 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg border border-emerald-500/30">
                    🏆
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                      {language === 'sv-SE' ? 'Hel screening (Test 1+2)' : 'Full Screening (1+2)'}
                    </div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      {screeningStep === 'STEP_1_HINGE' && (
                        <>
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping"></span>
                          <span>{language === 'sv-SE' ? 'Steg 1 av 2: Höftfällning (Sidovy, 3 reps)' : 'Step 1 of 2: Hip Hinge (Side view, 3 reps)'}</span>
                        </>
                      )}
                      {screeningStep === 'TRANSITION' && (
                        <>
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
                          <span>{language === 'sv-SE' ? 'Övergång: Vänd dig rakt mot kameran!' : 'Transition: Turn and face the camera!'}</span>
                        </>
                      )}
                      {screeningStep === 'STEP_2_ROTATION' && (
                        <>
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping"></span>
                          <span>{language === 'sv-SE' ? 'Steg 2 av 2: Bröstryggsrotation (Framifrån)' : 'Step 2 of 2: Thoracic Rotation (Front view)'}</span>
                        </>
                      )}
                      {screeningStep === 'COMPLETE' && (
                        <>
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                          <span>{language === 'sv-SE' ? 'Screening klar! Se sammanställd rapport nedan' : 'Screening complete! See full report below'}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold transition ${screeningStep === 'STEP_1_HINGE' ? 'bg-blue-600 text-white shadow' : 'bg-slate-700 text-slate-400'}`}>
                    1. {language === 'sv-SE' ? 'Höftfällning' : 'Hip Hinge'}
                  </span>
                  <span className="text-slate-500">→</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold transition ${screeningStep === 'STEP_2_ROTATION' ? 'bg-purple-600 text-white shadow' : 'bg-slate-700 text-slate-400'}`}>
                    2. {language === 'sv-SE' ? 'Rotation' : 'Rotation'}
                  </span>
                </div>
              </div>
            )}
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            {/* Video Feed */}
            <div className={
              isMobileFullscreen
                ? "fixed inset-0 z-50 w-screen h-[100dvh] bg-black overflow-hidden flex flex-col justify-between"
                : `relative w-full max-w-[640px] aspect-[3/4] sm:aspect-[4/3] min-h-[480px] sm:min-h-0 mx-auto bg-black rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 border border-gray-800 ${mobileTab !== 'TEST' ? 'hidden lg:block' : 'block'}`
            }>
              <video
                ref={videoRef}
                onEnded={handleVideoEnded}
                className={mode === 'VIDEO' ? "absolute inset-0 w-full h-full object-contain" : "absolute inset-0 w-full h-full object-cover sm:object-contain"}
                style={{ transform: mode === 'WEBCAM' && cameraFacing === 'user' ? 'scaleX(-1)' : 'none' }}
                playsInline
                muted
                autoPlay
                controls={mode === 'VIDEO'}
              />
              <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className={mode === 'VIDEO' ? "absolute inset-0 w-full h-full object-contain pointer-events-none" : "absolute inset-0 w-full h-full object-cover sm:object-contain pointer-events-none"}
                style={{ transform: mode === 'WEBCAM' && cameraFacing === 'user' ? 'scaleX(-1)' : 'none' }}
              />

              {/* Floating Camera Controls (Flip Camera & Fullscreen Toggle) */}
              {mode === 'WEBCAM' && (
                <div 
                  className="absolute top-3 right-3 z-30 flex items-center gap-2 pointer-events-auto"
                  style={{ top: isMobileFullscreen ? 'max(env(safe-area-inset-top), 12px)' : undefined }}
                >
                  <button
                    onClick={toggleCameraFacing}
                    disabled={isSwitchingCamera}
                    type="button"
                    className="bg-black/70 hover:bg-black/90 active:scale-95 text-white p-2.5 sm:p-3 rounded-full border border-white/30 backdrop-blur-md shadow-xl transition flex items-center gap-1.5 text-xs font-bold min-h-[44px] min-w-[44px] justify-center"
                    title={language === 'sv-SE' ? 'Växla kamera (Fram/Bak)' : 'Flip Camera (Front/Rear)'}
                  >
                    <SwitchCamera size={20} className={`text-white ${isSwitchingCamera ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">{cameraFacing === 'user' ? (language === 'sv-SE' ? 'Selfie' : 'Front') : (language === 'sv-SE' ? 'Bakre' : 'Rear')}</span>
                  </button>

                  <button
                    onClick={toggleFullscreen}
                    type="button"
                    className="bg-black/70 hover:bg-black/90 active:scale-95 text-white p-2.5 sm:p-3 rounded-full border border-white/30 backdrop-blur-md shadow-xl transition flex items-center justify-center min-h-[44px] min-w-[44px]"
                    title={isMobileFullscreen ? (language === 'sv-SE' ? 'Mindre vy' : 'Exit Fullscreen') : (language === 'sv-SE' ? 'Helskärm' : 'Fullscreen')}
                  >
                    {isMobileFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                  </button>
                </div>
              )}
              
              {/* Live Audio Coach Subtitle Banner */}
              {activeSubtitle && (
                <div 
                  className="absolute top-4 left-1/2 -translate-x-1/2 z-20 max-w-[90%] bg-black/90 backdrop-blur-md border-2 border-blue-400 text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2.5 text-sm sm:text-base font-bold animate-pulse pointer-events-none text-center"
                  style={{ top: isMobileFullscreen ? 'max(env(safe-area-inset-top), 60px)' : undefined }}
                >
                  <Volume2 size={20} className="text-blue-400 flex-shrink-0" />
                  <span className="truncate">"{activeSubtitle}"</span>
                </div>
              )}
              
              {mode === 'WEBCAM' && (
                <CameraGuideOverlay 
                  readinessState={readinessResult?.state || 'NOT_READY'} 
                  feedback={readinessResult?.feedback || 'STEP_INTO_FRAME'} 
                  appState={appTestState}
                  language={language}
                  viewMode={activeProtocol === 'THORACIC_ROTATION_V1' ? 'FRONT' : 'SIDE'}
                  isBriefingActive={isBriefingActive}
                  onReplayBriefing={() => playGuidedBriefing(activeProtocol)}
                  onSkipBriefing={cancelBriefing}
                  coachingMode={coachingMode}
                  isFullscreen={isMobileFullscreen}
                />
              )}
              
              {mode === 'WEBCAM' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  {appTestState === 'SETUP' && readinessResult?.state === 'READY' && !isBriefingActive && (
                    <div className={`absolute ${isMobileFullscreen ? 'bottom-20' : 'bottom-4'} pointer-events-auto`}>
                      <button onClick={handleStartTest} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-full shadow-2xl text-lg animate-pulse flex items-center gap-3 border-2 border-white/20">
                        <span className="w-3 h-3 rounded-full bg-white animate-ping"></span>
                        {language === 'sv-SE' ? 'STARTA TEST (Startar automatiskt...)' : 'START TEST (Auto-starting...)'}
                      </button>
                    </div>
                  )}
                  {appTestState === 'COUNTDOWN' && (
                    <div className="flex flex-col items-center justify-center animate-bounce">
                      <div className="w-32 h-32 rounded-full bg-black/85 border-4 border-green-400 flex items-center justify-center shadow-2xl">
                        <span className="text-white text-8xl font-black">{countdownNumber}</span>
                      </div>
                      <span className="text-green-300 font-bold tracking-widest text-sm mt-3 uppercase bg-black/75 px-5 py-1.5 rounded-full shadow-lg border border-green-500/30">
                        {language === 'sv-SE' ? 'Gör dig redo' : 'Get Ready'}
                      </span>
                    </div>
                  )}
                  {appTestState === 'ACTIVE' && (
                    <div className={`absolute ${isMobileFullscreen ? 'bottom-20' : 'bottom-4'} flex flex-col items-center gap-1 pointer-events-auto`}>
                      <div className="bg-red-600/95 text-white font-black py-3 px-6 sm:px-8 rounded-2xl shadow-2xl animate-pulse flex items-center gap-3 border-2 border-red-300 text-base sm:text-xl uppercase tracking-wider backdrop-blur-md">
                        <span className="w-3.5 h-3.5 rounded-full bg-white animate-ping"></span>
                        {activeProtocol === 'THORACIC_ROTATION_V1'
                          ? (language === 'sv-SE' ? 'SPELAR IN — ROTERA VÄNSTER & HÖGER' : 'RECORDING — ROTATE LEFT & RIGHT')
                          : (language === 'sv-SE' ? 'SPELAR IN — GÖR 3 REPS' : 'RECORDING — DO 3 REPS')}
                      </div>
                      <span className="text-xs text-gray-300 bg-black/70 px-3 py-1 rounded-full shadow">
                        {activeProtocol === 'THORACIC_ROTATION_V1'
                          ? (language === 'sv-SE' ? 'Stoppas automatiskt efter rotation (eller klicka Stopp)' : 'Auto-stops after rotation (or click Stop to finish)')
                          : (language === 'sv-SE' ? 'Stoppas automatiskt efter 3 reps (eller klicka Stopp)' : 'Auto-stops after 3 reps (or click Stop to finish)')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Floating Bottom Bar (Stop Capture & Analyze in Fullscreen Mode) */}
              {isMobileFullscreen && mode === 'WEBCAM' && (
                <div 
                  className="absolute bottom-0 left-0 right-0 z-30 flex justify-center pb-4 sm:pb-6 pointer-events-none"
                  style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
                >
                  <button
                    onClick={stopWebcam}
                    className="pointer-events-auto flex items-center gap-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white px-6 py-3 rounded-full font-extrabold text-sm shadow-2xl shadow-red-900/60 border-2 border-red-400 backdrop-blur-md transition"
                  >
                    <span>⏹</span>
                    <span>{language === 'sv-SE' ? 'Avsluta & Analysera' : 'Stop Capture & Analyze'}</span>
                  </button>
                </div>
              )}
            </div>

          {/* Report Panel */}
          <div className={`flex-1 bg-gray-800 p-4 sm:p-6 rounded-2xl overflow-y-auto max-h-[800px] border border-gray-700/60 ${mobileTab !== 'REPORT' ? 'hidden lg:block' : 'block'}`}>
            <h2 className="text-xl font-semibold mb-4">Pipeline Report</h2>
            {golfBodyScoreResult ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl text-center font-bold text-xl bg-gradient-to-r from-emerald-900/60 to-teal-900/60 text-emerald-300 border border-emerald-600/50 shadow-lg">
                  🏆 {language === 'sv-SE' ? 'HEL SCREENING GENOMFÖRD' : 'FULL SCREENING COMPLETE'}
                </div>

                <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 text-center">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">GOLF BODY SCORE</div>
                  <div className="text-5xl font-black text-white my-1">{golfBodyScoreResult.totalScore}<span className="text-base font-normal text-slate-400"> / 100</span></div>
                  <div className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase mt-1" style={{ backgroundColor: `${golfBodyScoreResult.tierColor}25`, color: golfBodyScoreResult.tierColor, border: `1px solid ${golfBodyScoreResult.tierColor}50` }}>
                    {golfBodyScoreResult.tierLabel}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700/60 text-center">
                    <div className="text-xs text-sky-400 font-semibold">{language === 'sv-SE' ? '1. Höftfällning' : '1. Hip Hinge'}</div>
                    <div className="text-2xl font-bold font-mono text-white mt-1">{golfBodyScoreResult.hipHinge.total}<span className="text-xs text-slate-400">/50</span></div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{golfBodyScoreResult.hipHinge.avgHingeAngle}° {language === 'sv-SE' ? 'snitt' : 'avg'}</div>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700/60 text-center">
                    <div className="text-xs text-purple-400 font-semibold">{language === 'sv-SE' ? '2. Bröstrygg' : '2. Thoracic'}</div>
                    <div className="text-2xl font-bold font-mono text-white mt-1">{golfBodyScoreResult.thoracic.total}<span className="text-xs text-slate-400">/50</span></div>
                    <div className="text-[11px] text-slate-400 mt-0.5">V: {golfBodyScoreResult.thoracic.maxLeft}° | H: {golfBodyScoreResult.thoracic.maxRight}°</div>
                  </div>
                </div>

                <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/60 text-xs text-slate-300">
                  <span className="font-semibold text-emerald-400">★ {language === 'sv-SE' ? 'Sammanfattning:' : 'Summary:'} </span>
                  {golfBodyScoreResult.summary}
                </div>

                <div className="text-center pt-2">
                  <span className="text-xs text-emerald-400 font-medium animate-pulse">
                    👇 {language === 'sv-SE' ? 'Se fullständigt träningsrecept och analys nedan' : 'See full exercise prescription and analysis below'}
                  </span>
                </div>
              </div>
            ) : rotationResult ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg text-center font-bold text-xl bg-purple-900/50 text-purple-300 border border-purple-600/40">
                  {language === 'sv-SE' ? 'ROTATIONSTEST GENOMFÖRT' : 'ROTATION ASSESSMENT COMPLETE'}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-700/50 p-3 rounded-lg text-center border border-gray-600/40">
                    <div className="text-xs text-gray-300 font-semibold">{language === 'sv-SE' ? 'Isolerad Vänster' : 'Isolated Left'}</div>
                    <div className="text-2xl font-bold font-mono text-purple-300">{rotationResult.maxRotationLeft}°</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {language === 'sv-SE' 
                        ? `Axel ${rotationResult.totalShoulderTurnLeft}° – Höft ${rotationResult.pelvicTurnAtPeakLeft}°` 
                        : `Shoulder ${rotationResult.totalShoulderTurnLeft}° – Hip ${rotationResult.pelvicTurnAtPeakLeft}°`}
                    </div>
                  </div>
                  <div className="bg-gray-700/50 p-3 rounded-lg text-center border border-gray-600/40">
                    <div className="text-xs text-gray-300 font-semibold">{language === 'sv-SE' ? 'Isolerad Höger' : 'Isolated Right'}</div>
                    <div className="text-2xl font-bold font-mono text-purple-300">{rotationResult.maxRotationRight}°</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {language === 'sv-SE' 
                        ? `Axel ${rotationResult.totalShoulderTurnRight}° – Höft ${rotationResult.pelvicTurnAtPeakRight}°` 
                        : `Shoulder ${rotationResult.totalShoulderTurnRight}° – Hip ${rotationResult.pelvicTurnAtPeakRight}°`}
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg text-center border ${
                    rotationResult.compensations.severeAsymmetry 
                      ? 'bg-amber-950/40 border-amber-500/60 text-amber-300' 
                      : 'bg-gray-700/50 border-gray-600/40 text-gray-300'
                  }`}>
                    <div className="text-xs text-gray-400">{language === 'sv-SE' ? 'Asymmetri' : 'Asymmetry'}</div>
                    <div className="text-2xl font-bold font-mono">{rotationResult.rotationAsymmetry}°</div>
                    <div className="text-[10px] font-semibold">{rotationResult.compensations.severeAsymmetry ? '⚠️ Obalans' : '✓ Balanserad'}</div>
                  </div>
                </div>

                {/* Pelvis & Shoulder Breakdown */}
                <div className="bg-gray-700/50 p-4 rounded-lg space-y-2">
                  <h3 className="font-semibold text-sm text-gray-200">{language === 'sv-SE' ? 'Kinematisk Uppdelning (X-Factor)' : 'Kinematic Breakdown (X-Factor)'}</h3>
                  <div className="flex justify-between text-xs py-1 border-b border-gray-600/50">
                    <span className="text-gray-400">{language === 'sv-SE' ? 'Axelvridning Vänster / Höftvridning' : 'Shoulder Turn Left / Hip Turn'}</span>
                    <span className="font-mono text-white">{rotationResult.totalShoulderTurnLeft}° / {rotationResult.pelvicTurnAtPeakLeft}°</span>
                  </div>
                  <div className="flex justify-between text-xs py-1 border-b border-gray-600/50">
                    <span className="text-gray-400">{language === 'sv-SE' ? 'Axelvridning Höger / Höftvridning' : 'Shoulder Turn Right / Hip Turn'}</span>
                    <span className="font-mono text-white">{rotationResult.totalShoulderTurnRight}° / {rotationResult.pelvicTurnAtPeakRight}°</span>
                  </div>
                  <div className="flex justify-between text-xs py-1">
                    <span className="text-gray-400">{language === 'sv-SE' ? 'Lateral Axellutning (Dip)' : 'Lateral Shoulder Tilt'}</span>
                    <span className="font-mono text-white">{rotationResult.compensations.excessiveLateralTilt ? '⚠️ >12° (Dip)' : '✓ Normal'}</span>
                  </div>
                </div>

                {/* Spoken Audio Coach Log */}
                {spokenCues.length > 0 && (
                  <div className="bg-gray-700/50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold flex items-center gap-2 text-sm text-blue-300">
                        <Volume2 size={16} className="text-blue-400" />
                        Spoken Audio Coach Log ({spokenCues.length})
                      </h3>
                      <span className="text-[11px] font-mono text-gray-400">Web Speech API</span>
                    </div>
                    <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                      {spokenCues.map((cue, idx) => {
                        return (
                          <div key={idx} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded border bg-purple-950/40 border-purple-700/60">
                            <span className="text-gray-200 font-medium">"{cue.text}"</span>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-purple-900 text-purple-300">
                              {cue.key}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* AI Golf & Biomechanics Coach */}
                <AiCoachCard
                  rotationResult={rotationResult}
                  spokenCues={spokenCues}
                  language={language}
                  aiCoachService={aiCoachServiceRef.current}
                />

                <details className="mt-4">
                  <summary className="cursor-pointer text-purple-400 hover:text-purple-300">Show Rotation JSON</summary>
                  <pre className="mt-2 text-xs font-mono text-gray-300 overflow-x-auto p-4 bg-black rounded-lg">
                    {JSON.stringify(rotationResult, null, 2)}
                  </pre>
                </details>
              </div>
            ) : report ? (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg text-center font-bold text-xl ${report.status === 'SUCCESS' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                  {report.status} {report.failureCodes.length > 0 && `(${report.failureCodes.join(', ')})`}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-700/50 p-4 rounded-lg">
                    <div className="text-sm text-gray-400">Reps Detected</div>
                    <div className="text-2xl font-semibold">{report.measurement.detectedRepCount}</div>
                  </div>
                  <div className="bg-gray-700/50 p-4 rounded-lg">
                    <div className="text-sm text-gray-400">Overall Confidence</div>
                    <div className="text-2xl font-semibold">{(report.measurement.confidence * 100).toFixed(0)}%</div>
                  </div>
                </div>

                <div className="bg-gray-700/50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Capture Telemetry</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
                    <div>Source Decoded: <span className="font-mono text-white">{report.capture.sourceDecodedFrameCount}</span></div>
                    <div>Pose Inference: <span className="font-mono text-white">{report.capture.poseInferenceFrameCount}</span></div>
                    <div>VFC Callbacks: <span className="font-mono text-white">{report.capture.presentedFrameCallbacks}</span></div>
                    <div>Missed Frames: <span className="font-mono text-white">{report.capture.missedPresentedFrames}</span></div>
                  </div>
                </div>

                <div className="bg-gray-700/50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Metrics</h3>
                  {report.measurement.metrics.map((m, i) => (
                    <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-600/50 last:border-0">
                      <span>{m.id}</span>
                      <span className="font-mono">{m.value.toFixed(1)} {m.unit}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-gray-700/50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Compensations</h3>
                  {report.measurement.compensations.length === 0 ? (
                    <div className="text-sm text-gray-400">None detected</div>
                  ) : report.measurement.compensations.map((c, i) => (
                    <div key={i} className="text-sm text-red-400 py-1">⚠️ {c.type} (Severity: {c.severity})</div>
                  ))}
                </div>

                {/* Spoken Audio Coach Log */}
                {spokenCues.length > 0 && (
                  <div className="bg-gray-700/50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold flex items-center gap-2 text-sm text-blue-300">
                        <Volume2 size={16} className="text-blue-400" />
                        Spoken Audio Coach Log ({spokenCues.length})
                      </h3>
                      <span className="text-[11px] font-mono text-gray-400">Web Speech API</span>
                    </div>
                    <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                      {spokenCues.map((cue, idx) => {
                        const elapsedSec = activeStartTimeRef.current 
                          ? ((cue.timestampMs - activeStartTimeRef.current) / 1000).toFixed(1)
                          : '0.0';
                        const isCountdown = Number(elapsedSec) < 0;
                        const isRep = cue.key.startsWith('REP_') || cue.key === 'ALL_REPS_DONE';
                        const isCue = cue.key.startsWith('CUE_');
                        return (
                          <div key={idx} className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded border ${
                            isRep ? 'bg-green-950/40 border-green-700/60' :
                            isCue ? 'bg-amber-950/40 border-amber-700/60' :
                            'bg-gray-800/80 border-gray-700/70'
                          }`}>
                            <div className="flex items-center gap-2">
                              <span className={`font-mono text-[11px] font-bold ${isCountdown ? 'text-gray-400' : isRep ? 'text-green-400' : isCue ? 'text-amber-400' : 'text-blue-400'}`}>
                                {Number(elapsedSec) > 0 ? `+${elapsedSec}s` : `${elapsedSec}s`}
                              </span>
                              <span className="text-gray-200 font-medium">"{cue.text}"</span>
                            </div>
                            <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded ${
                              isRep ? 'bg-green-900 text-green-300' :
                              isCue ? 'bg-amber-900 text-amber-300' :
                              'bg-gray-700 text-gray-300'
                            }`}>
                              {cue.key}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* AI Golf & Biomechanics Coach */}
                <AiCoachCard
                  report={report}
                  spokenCues={spokenCues}
                  language={language}
                  aiCoachService={aiCoachServiceRef.current}
                />

                <details className="mt-4">
                  <summary className="cursor-pointer text-blue-400 hover:text-blue-300">Show Full JSON Report</summary>
                  <pre className="mt-2 text-xs font-mono text-gray-300 overflow-x-auto p-4 bg-black rounded-lg">
                    {JSON.stringify(report, null, 2)}
                  </pre>
                </details>
              </div>
            ) : (
              <div className="bg-gray-800/40 border border-gray-700/60 rounded-xl p-8 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center mx-auto shadow-lg shadow-purple-500/20">
                  <Bot className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-100 mb-1">
                    {language === 'sv-SE' ? 'AI Golf & Biomekanikcoach redo' : 'AI Golf & Biomechanics Coach Ready'}
                  </h3>
                  <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
                    {language === 'sv-SE'
                      ? 'Klicka på "Live Webcam" och gör 3 repetitioner av Hip Hinge. Vår AI analyserar din rörelse och ger golfspecifika råd.'
                      : 'Click "Live Webcam" and complete 3 reps of Hip Hinge. Our AI analyzes your motion and delivers golf-specific swing insights.'}
                  </p>
                </div>

                <div className="max-w-md mx-auto pt-2">
                  <div className="flex items-center justify-between p-3.5 rounded-lg bg-gray-900/80 border border-gray-700 text-left">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${hasGlobalKey ? 'bg-purple-900/40 text-purple-400' : 'bg-amber-900/30 text-amber-400'}`}>
                        <Key size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-200 flex items-center gap-2">
                          <span>{hasGlobalKey ? 'Gemini 2.5 Flash Aktiv' : 'Google Gemini API-nyckel'}</span>
                          {hasGlobalKey && <span className="w-2 h-2 rounded-full bg-emerald-400"></span>}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {hasGlobalKey
                            ? (language === 'sv-SE' ? 'Kopplad via lokal webbläsarlagring' : 'Connected via local browser storage')
                            : (language === 'sv-SE' ? 'Valfritt – inbyggd expertmotor körs annars' : 'Optional – local expert engine runs otherwise')}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={openKeyModal}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium text-xs transition"
                    >
                      {hasGlobalKey ? (language === 'sv-SE' ? 'Ändra' : 'Edit') : (language === 'sv-SE' ? 'Lägg till' : 'Add Key')}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Determinism Report Summary */}
            {determinismReports && (
              <div className="mt-8 border-t border-gray-700 pt-8">
                <h2 className="text-xl font-semibold mb-4">Determinism Test Results</h2>
                <div className="bg-gray-700/50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2 text-purple-400">Rep Count Variance</h3>
                  <pre className="text-xs font-mono">
                    {determinismReports.map(r => r.measurement.detectedRepCount).join(', ')}
                  </pre>
                  
                  <h3 className="font-semibold mt-4 mb-2 text-purple-400">Confidence Variance</h3>
                  <pre className="text-xs font-mono">
                    {determinismReports.map(r => r.measurement.confidence.toFixed(3)).join(', ')}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Full-Width Holistic Screening Report Card */}
        {golfBodyScoreResult && (
          <div className={`mt-8 ${mobileTab !== 'REPORT' ? 'hidden lg:block' : 'block'}`}>
            <HolisticReportCard
              score={golfBodyScoreResult}
              hingeReport={screeningHingeReport}
              rotationResult={screeningRotationResult}
              spokenCues={spokenCues}
              language={language}
              aiCoachService={aiCoachServiceRef.current}
              onRestartScreening={() => {
                setMobileTab('TEST');
                handleStartScreeningFlow();
              }}
            />
          </div>
        )}
      </div>
      )}
    </div>

      {/* Global Gemini API Key Modal */}
      {showGlobalKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Google Gemini API-nyckel</h3>
                  <p className="text-xs text-gray-400">
                    {language === 'sv-SE' ? 'Drivs av Gemini 2.5 Flash för personlig analys' : 'Powered by Gemini 2.5 Flash for personalized insights'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowGlobalKeyModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-sm text-gray-300">
              <p className="leading-relaxed">
                {language === 'sv-SE'
                  ? 'Klistra in din API-nyckel från Google AI Studio här. Nyckeln sparas endast lokalt i din webbläsare (localStorage) och skickas aldrig till någon tredjepartsserver.'
                  : 'Paste your API key from Google AI Studio below. The key is stored solely in your local browser (localStorage) and never transmitted to any third-party server.'}
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 underline font-medium"
                >
                  {language === 'sv-SE' ? '→ Hämta gratis nyckel i Google AI Studio' : '→ Get free key at Google AI Studio'}
                </a>

                {hasGlobalKey && (
                  <button
                    type="button"
                    onClick={handleClearApiKey}
                    className="text-red-400 hover:text-red-300 text-xs hover:underline"
                  >
                    {language === 'sv-SE' ? 'Rensa / Ta bort nyckel' : 'Clear / Remove key'}
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-800">
              <button
                onClick={() => setShowGlobalKeyModal(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition"
              >
                {language === 'sv-SE' ? 'Avbryt' : 'Cancel'}
              </button>
              <button
                onClick={handleSaveApiKey}
                className="flex items-center gap-1.5 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition shadow-lg shadow-purple-600/30"
              >
                <Check size={16} />
                <span>{language === 'sv-SE' ? 'Spara nyckel' : 'Save Key'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal for Mobile Quick Scan */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2.5 text-left">
                <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
                  <QrCode size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Scanna med mobilen</h3>
                  <p className="text-xs text-gray-400">Golf Body OS på Wi-Fi</p>
                </div>
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl inline-block shadow-inner">
              <img
                src="/golf_body_qr.png"
                alt="QR Code"
                className="w-56 h-56 mx-auto object-contain"
              />
            </div>

            <div className="space-y-1 text-xs text-gray-300">
              <p className="font-mono text-emerald-400 font-semibold break-all text-[11px]">
                https://192.168.68.54:5173/
              </p>
              <p className="text-[11px] text-gray-400 pt-1">
                {language === 'sv-SE' 
                  ? 'Öppna mobilens kamera och rikta den mot koden ovan för att öppna direkt.'
                  : 'Point your phone camera at the QR code above to open directly.'}
              </p>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-semibold transition"
            >
              {language === 'sv-SE' ? 'Stäng' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
