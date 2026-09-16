import React, { useEffect, useRef, useState } from 'react';
import { PoseLandmarker } from '@mediapipe/tasks-vision';
import { convertWebResultToPoseFrame } from '../adapter/web-mediapipe-adapter';
import { TemporalPipeline } from '../../../../src/core/motion/temporal-pipeline';
import { PoseFrame, PoseSequence } from '../../../../src/core/types/pose-frame';
import { DeviceValidationReport } from '../../../../src/validation/device-validation-report';
import { PipelineTraceBuilder } from '../../../../src/core/trace/pipeline-trace-builder';
import { DecodedFrameTrace } from '../../../../src/core/types/pipeline-trace';
import { ReadinessEngine, ReadinessResult } from '../../../../src/core/motion/readiness-engine';
import CameraGuideOverlay, { AppTestState } from '../components/CameraGuideOverlay';
import { AudioCoachService, CoachingMode, SpokenCueLogEntry } from '../../../../src/core/coaching/audio-coach';
import { LiveCoachingEngine } from '../../../../src/core/coaching/live-coaching-engine';
import { SupportedLanguage, CoachingPhraseKey } from '../../../../src/core/coaching/i18n/locales';
import { LiveRotationCoachingEngine } from '../../../../src/core/coaching/live-rotation-coaching-engine';
import { summarizeThoracicRotation, ThoracicRotationResult } from '../../../../src/core/metrics/thoracic-rotation-metrics';
import { calculateGolfBodyScore, GolfBodyScoreResult } from '../../../../src/core/metrics/golf-body-score';
import { ScreeningPlan, ScreeningResult, TestStepResult, CompensationResult } from '../types/screening';
import { COMPENSATION_LABELS, assessHingeAngleQuality, assessKneeAngleQuality, assessRotationQuality } from '../utils/human-readable';
import { Volume2, SwitchCamera, Maximize2, Minimize2, X } from 'lucide-react';

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

function buildScreeningResult(
  golfScore: GolfBodyScoreResult,
  plan: ScreeningPlan,
  language: SupportedLanguage
): ScreeningResult {
  const stepResults: TestStepResult[] = [];
  
  // Hinge pillar
  const hingeStep = plan.steps.find(s => s.id === 'HIP_HINGE');
  if (hingeStep) {
    stepResults.push({
      stepId: 'HIP_HINGE',
      pillarScore: golfScore.hipHinge.total,
      maxScore: 50,
      label: hingeStep.label,
      icon: hingeStep.icon,
      color: hingeStep.color,
      subMetrics: [
        { id: 'depth', label: { sv: 'Fällningsdjup', en: 'Hinge Depth' }, value: golfScore.hipHinge.depthScore, maxValue: 25, quality: golfScore.hipHinge.depthScore >= 20 ? 'EXCELLENT' : golfScore.hipHinge.depthScore >= 16 ? 'GOOD' : golfScore.hipHinge.depthScore >= 10 ? 'FAIR' : 'POOR' },
        { id: 'knee', label: { sv: 'Knäkontroll', en: 'Knee Control' }, value: golfScore.hipHinge.kneeScore, maxValue: 15, quality: golfScore.hipHinge.kneeScore >= 12 ? 'EXCELLENT' : golfScore.hipHinge.kneeScore >= 8 ? 'GOOD' : 'FAIR' },
        { id: 'spine', label: { sv: 'Rygghållning', en: 'Spine Posture' }, value: golfScore.hipHinge.spineScore, maxValue: 10, quality: golfScore.hipHinge.spineScore >= 8 ? 'EXCELLENT' : golfScore.hipHinge.spineScore >= 5 ? 'GOOD' : 'POOR' },
      ],
      compensations: golfScore.hipHinge.compensations.map(c => {
        const label = COMPENSATION_LABELS[c];
        return label ? { type: c, label: { sv: label.sv, en: label.en }, tip: { sv: label.tipSv, en: label.tipEn }, severity: label.severity } : { type: c, label: { sv: c, en: c }, tip: { sv: '', en: '' }, severity: 'MEDIUM' as const };
      }),
      angles: [
        { id: 'hinge', label: { sv: 'Höftfällning', en: 'Hip Hinge' }, value: golfScore.hipHinge.avgHingeAngle, unit: '°', optimal: '≤ 90°', quality: assessHingeAngleQuality(golfScore.hipHinge.avgHingeAngle) },
        { id: 'knee', label: { sv: 'Knävinkel', en: 'Knee Angle' }, value: golfScore.hipHinge.avgKneeAngle, unit: '°', optimal: '150–165°', quality: assessKneeAngleQuality(golfScore.hipHinge.avgKneeAngle) },
      ],
    });
  }
  
  // Thoracic pillar
  const thoracicStep = plan.steps.find(s => s.id === 'THORACIC_ROTATION');
  if (thoracicStep) {
    const thoracicComps: CompensationResult[] = [];
    if (golfScore.thoracic.hasExcessiveDip) thoracicComps.push({ type: 'excessiveLateralTilt', label: COMPENSATION_LABELS['excessiveLateralTilt'] ? { sv: COMPENSATION_LABELS['excessiveLateralTilt'].sv, en: COMPENSATION_LABELS['excessiveLateralTilt'].en } : { sv: 'Dip', en: 'Dip' }, tip: COMPENSATION_LABELS['excessiveLateralTilt'] ? { sv: COMPENSATION_LABELS['excessiveLateralTilt'].tipSv, en: COMPENSATION_LABELS['excessiveLateralTilt'].tipEn } : { sv: '', en: '' }, severity: 'MEDIUM' });
    if (golfScore.thoracic.hasExcessivePelvic) thoracicComps.push({ type: 'excessivePelvicRotation', label: COMPENSATION_LABELS['excessivePelvicRotation'] ? { sv: COMPENSATION_LABELS['excessivePelvicRotation'].sv, en: COMPENSATION_LABELS['excessivePelvicRotation'].en } : { sv: 'Pelvic', en: 'Pelvic' }, tip: COMPENSATION_LABELS['excessivePelvicRotation'] ? { sv: COMPENSATION_LABELS['excessivePelvicRotation'].tipSv, en: COMPENSATION_LABELS['excessivePelvicRotation'].tipEn } : { sv: '', en: '' }, severity: 'HIGH' });
    if (golfScore.thoracic.asymmetry > 15) thoracicComps.push({ type: 'severeAsymmetry', label: COMPENSATION_LABELS['severeAsymmetry'] ? { sv: COMPENSATION_LABELS['severeAsymmetry'].sv, en: COMPENSATION_LABELS['severeAsymmetry'].en } : { sv: 'Asymmetri', en: 'Asymmetry' }, tip: COMPENSATION_LABELS['severeAsymmetry'] ? { sv: COMPENSATION_LABELS['severeAsymmetry'].tipSv, en: COMPENSATION_LABELS['severeAsymmetry'].tipEn } : { sv: '', en: '' }, severity: 'HIGH' });
    
    stepResults.push({
      stepId: 'THORACIC_ROTATION',
      pillarScore: golfScore.thoracic.total,
      maxScore: 50,
      label: thoracicStep.label,
      icon: thoracicStep.icon,
      color: thoracicStep.color,
      subMetrics: [
        { id: 'rotation', label: { sv: 'Isolerad Rotation', en: 'Isolated Rotation' }, value: golfScore.thoracic.rotationScore, maxValue: 25, quality: golfScore.thoracic.rotationScore >= 20 ? 'EXCELLENT' : golfScore.thoracic.rotationScore >= 15 ? 'GOOD' : golfScore.thoracic.rotationScore >= 8 ? 'FAIR' : 'POOR' },
        { id: 'dissociation', label: { sv: 'Bäckendissociation', en: 'Pelvic Disassociation' }, value: golfScore.thoracic.disassociationScore, maxValue: 15, quality: golfScore.thoracic.disassociationScore >= 12 ? 'EXCELLENT' : golfScore.thoracic.disassociationScore >= 8 ? 'GOOD' : 'FAIR' },
        { id: 'symmetry', label: { sv: 'Symmetri', en: 'Symmetry' }, value: golfScore.thoracic.symmetryScore, maxValue: 5, quality: golfScore.thoracic.symmetryScore >= 4 ? 'EXCELLENT' : golfScore.thoracic.symmetryScore >= 3 ? 'GOOD' : 'POOR' },
        { id: 'dip', label: { sv: 'Stabilitet', en: 'Stability' }, value: golfScore.thoracic.dipScore, maxValue: 5, quality: golfScore.thoracic.dipScore >= 5 ? 'EXCELLENT' : 'POOR' },
      ],
      compensations: thoracicComps,
      angles: [
        { id: 'left', label: { sv: 'Rotation Vänster', en: 'Rotation Left' }, value: golfScore.thoracic.maxLeft, unit: '°', optimal: '≥ 45°', quality: assessRotationQuality(golfScore.thoracic.maxLeft) },
        { id: 'right', label: { sv: 'Rotation Höger', en: 'Rotation Right' }, value: golfScore.thoracic.maxRight, unit: '°', optimal: '≥ 45°', quality: assessRotationQuality(golfScore.thoracic.maxRight) },
      ],
    });
  }
  
  return {
    totalScore: golfScore.totalScore,
    tier: golfScore.tier,
    tierLabel: golfScore.tierLabel,
    tierColor: golfScore.tierColor,
    stepResults,
    keyStrengths: golfScore.keyStrengths,
    primaryBottlenecks: golfScore.primaryBottlenecks,
    summary: golfScore.summary,
  };
}

interface ScreeningFlowScreenProps {
  plan: ScreeningPlan;
  landmarker: PoseLandmarker;
  modelSha: string;
  language: SupportedLanguage;
  isDevMode: boolean;
  onComplete: (result: ScreeningResult) => void;
  onCancel: () => void;
}

export default function ScreeningFlowScreen({
  plan,
  landmarker,
  modelSha,
  language,
  isDevMode,
  onComplete,
  onCancel,
}: ScreeningFlowScreenProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = plan.steps[currentStepIndex];

  const rawResultsRef = useRef<Record<string, any>>({});
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseSequenceRef = useRef<PoseSequence>([]);
  const frameCountRef = useRef(0);
  const decodedFramesRef = useRef<DecodedFrameTrace[]>([]);
  const lastVideoTimeRef = useRef<number>(-1);
  const requestRef = useRef<number>(0);
  const stopWebcamRef = useRef<() => void>(() => {});
  
  const [appTestState, setAppTestState] = useState<AppTestState>('SETUP');
  const appTestStateRef = useRef<AppTestState>('SETUP');
  
  const readinessEngineRef = useRef<ReadinessEngine>(new ReadinessEngine());
  const [readinessResult, setReadinessResult] = useState<ReadinessResult | null>(null);
  const lastReadinessRef = useRef<ReadinessResult | null>(null);
  
  const [activeSubtitle, setActiveSubtitle] = useState<string | null>(null);
  const audioCoachRef = useRef<AudioCoachService>(new AudioCoachService({ defaultLanguage: language }));
  const lastReadinessCueTimeRef = useRef<number>(0);
  
  const liveCoachingEngineRef = useRef<LiveCoachingEngine | null>(null);
  const liveRotationCoachingEngineRef = useRef<LiveRotationCoachingEngine | null>(null);
  
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const cameraFacingRef = useRef<'user' | 'environment'>('user');
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [isMobileFullscreen, setIsMobileFullscreen] = useState(false);
  
  const [isBriefingActive, setIsBriefingActive] = useState(false);
  const isBriefingActiveRef = useRef(false);
  
  const autoStartTriggeredRef = useRef(false);
  const [countdownNumber, setCountdownNumber] = useState<number | null>(null);
  const activeStartTimeRef = useRef<number | undefined>(undefined);
  
  const [phase, setPhase] = useState<'CAMERA' | 'TRANSITION'>('CAMERA');

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

  useEffect(() => {
    audioCoachRef.current.setLanguage(language);
  }, [language]);

  const runPipeline = (frames: PoseSequence, traceBuilder: PipelineTraceBuilder): DeviceValidationReport => {
    const pipeline = new TemporalPipeline({
      protocol: harnessProtocol,
      activeStartTimeMs: activeStartTimeRef.current
    });
    const result = pipeline.process(frames, traceBuilder);
    const trace = result.trace;

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
      inference: { meanLatencyMs: null, p50LatencyMs: null, p95LatencyMs: null, maxLatencyMs: null },
      landmarks: {
        expectedPerPose: 33,
        validPoseFrameCount: trace.validFrameCount,
        rejectedPoseFrameCount: trace.rejectedFrameCount,
        interpolatedGapCount: trace.interpolatedFrameCount
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

  const handleStepComplete = (stepId: string) => {
    setTimeout(() => {
      stopWebcamRef.current();
      
      // Find current index manually to avoid closure capture issues
      const currentIdx = plan.steps.findIndex(s => s.id === stepId);
      const nextIndex = currentIdx + 1;
      
      if (nextIndex < plan.steps.length) {
        setPhase('TRANSITION');
        audioCoachRef.current.speak('SCREENING_STEP_TRANSITION', 'HIGH');
        
        setTimeout(() => {
          setCurrentStepIndex(nextIndex);
          startWebcamForStep(nextIndex);
        }, 3500);
      } else {
        finishScreening();
      }
    }, 1500);
  };

  useEffect(() => {
    audioCoachRef.current.onSpoken((entry) => {
      setActiveSubtitle(entry.text);
      setTimeout(() => {
        setActiveSubtitle(current => current === entry.text ? null : current);
      }, 3500);
    });

    liveCoachingEngineRef.current = new LiveCoachingEngine(audioCoachRef.current, {
      onAllRepsComplete: () => {
        try {
          const traceBuilder = new PipelineTraceBuilder(`session_screening_${Date.now()}`)
            .setAnalysisMode('LIVE')
            .setPoseModel('MEDIAPIPE_POSE', '0.10.14', '1', modelSha)
            .setCamera('640x480', 30)
            .setDevice('Web Browser', navigator.userAgent)
            .setDecodedFrames(decodedFramesRef.current);

          const rep = runPipeline(poseSequenceRef.current, traceBuilder);
          rawResultsRef.current['HIP_HINGE'] = rep; 
        } catch (err) {
          console.error('Failed to run pipeline:', err);
        }
        
        handleStepComplete('HIP_HINGE');
      }
    });

    liveRotationCoachingEngineRef.current = new LiveRotationCoachingEngine(audioCoachRef.current, {
      onComplete: () => {
        const rotSamples = liveRotationCoachingEngineRef.current?.getSamples() || [];
        const rotSummary = summarizeThoracicRotation(rotSamples);
        rawResultsRef.current['THORACIC_ROTATION'] = rotSummary;
        
        handleStepComplete('THORACIC_ROTATION');
      }
    });
    
    startWebcamForStep(0);
    
    return () => {
      stopWebcamRef.current();
    };
  }, []);

  const cancelBriefing = () => {
    audioCoachRef.current.cancel();
    setIsBriefingActive(false);
    isBriefingActiveRef.current = false;
  };

  const playBriefingForStep = (stepIndexToPlay: number) => {
    const step = plan.steps[stepIndexToPlay];
    if (audioCoachRef.current.getMuted()) return;
    setIsBriefingActive(true);
    isBriefingActiveRef.current = true;

    const keys: CoachingPhraseKey[] = step.engineType === 'rotation'
      ? ['BRIEFING_ROTATION_1', 'BRIEFING_ROTATION_2', 'BRIEFING_ROTATION_3']
      : ['BRIEFING_HINGE_1', 'BRIEFING_HINGE_2', 'BRIEFING_HINGE_3'];

    if (stepIndexToPlay === 0) {
      keys.unshift('SCREENING_WELCOME');
    }

    audioCoachRef.current.speakSequence(
      keys,
      () => {
        setIsBriefingActive(false);
        isBriefingActiveRef.current = false;
      },
      'HIGH'
    );
  };

  const stopWebcam = () => {
    cancelAnimationFrame(requestRef.current);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };
  stopWebcamRef.current = stopWebcam;

  const processWebcamFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !landmarker) return;
    const video = videoRef.current;
    
    const timestampMs = performance.now();
    
    if (timestampMs > lastVideoTimeRef.current) {
      lastVideoTimeRef.current = timestampMs;

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
          drawSkeleton(ctx, result.landmarks[0], canvasRef.current.width, canvasRef.current.height);
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
            const rResult = readinessEngineRef.current.process(poseFrame);
            if (
              !lastReadinessRef.current || 
              lastReadinessRef.current.state !== rResult.state || 
              lastReadinessRef.current.feedback !== rResult.feedback
            ) {
              lastReadinessRef.current = { ...rResult };
              setReadinessResult(rResult);
            }

            if (
              !isBriefingActiveRef.current &&
              rResult.feedback &&
              rResult.state !== 'READY' &&
              timestampMs - lastReadinessCueTimeRef.current > 4000
            ) {
              audioCoachRef.current.speak(rResult.feedback as CoachingPhraseKey, 'NORMAL', timestampMs);
              lastReadinessCueTimeRef.current = timestampMs;
            }

            if (!isBriefingActiveRef.current && rResult.state === 'READY' && rResult.heldMs >= 1200 && !autoStartTriggeredRef.current) {
              handleStartTest();
            }
          } else if (appTestStateRef.current === 'ACTIVE') {
            const currentStepLive = plan.steps[currentStepIndex];
            if (currentStepLive && currentStepLive.engineType === 'rotation') {
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
    
    if (!video.paused && !video.ended) {
      requestRef.current = requestAnimationFrame(processWebcamFrame);
    }
  };

  const startWebcamForStep = async (stepIndex: number) => {
    const step = plan.steps[stepIndex];
    setPhase('CAMERA');
    
    poseSequenceRef.current = [];
    frameCountRef.current = 0;
    decodedFramesRef.current = [];
    
    setAppTestState('SETUP');
    appTestStateRef.current = 'SETUP';
    
    readinessEngineRef.current.reset();
    readinessEngineRef.current.setRequiredView(step.requiredView);
    setReadinessResult(null);
    lastReadinessRef.current = null;
    
    activeStartTimeRef.current = undefined;
    autoStartTriggeredRef.current = false;
    setCountdownNumber(null);
    
    liveCoachingEngineRef.current?.reset();
    liveRotationCoachingEngineRef.current?.reset();
    
    audioCoachRef.current.clearHistory();
    setActiveSubtitle(null);
    cancelBriefing();
    
    unlockAudio();
    
    playBriefingForStep(stepIndex);
    
    if (videoRef.current && !videoRef.current.srcObject) {
       try {
         const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: cameraFacingRef.current } },
            audio: false
         });
         videoRef.current.srcObject = stream;
         await videoRef.current.play();
         if (typeof window !== 'undefined' && window.innerWidth < 1024) {
           setIsMobileFullscreen(true);
         }
         processWebcamFrame();
       } catch (err) {
         console.warn('getUserMedia error', err);
         try {
           const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
           videoRef.current.srcObject = stream;
           await videoRef.current.play();
           processWebcamFrame();
         } catch (fallbackErr) {
           console.error('Webcam fallback error', fallbackErr);
         }
       }
    } else if (videoRef.current) {
       processWebcamFrame();
    }
  };

  const toggleCameraFacing = async () => {
    if (isSwitchingCamera) return;
    setIsSwitchingCamera(true);
    unlockAudio();
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextFacing);
    cameraFacingRef.current = nextFacing;

    if (videoRef.current) {
      if (videoRef.current.srcObject) {
        const currentStream = videoRef.current.srcObject as MediaStream;
        currentStream.getTracks().forEach(track => {
          try { track.stop(); } catch (e) { }
        });
        videoRef.current.srcObject = null;
        try { videoRef.current.pause(); } catch (e) { }
      }

      await new Promise(resolve => setTimeout(resolve, 250));

      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: nextFacing } },
            audio: false
          });
        } catch (errFacing) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
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
      } catch { }
    } else {
      try {
        if (typeof document !== 'undefined' && document.exitFullscreen && document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      } catch { }
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
        playAudioTone(880, 450); 
        audioCoachRef.current.speak('COUNTDOWN_GO', 'HIGH', activeStartTimeRef.current);
      }
    }, 1000);
  };

  const finishScreening = () => {
    const hingeRaw = rawResultsRef.current['HIP_HINGE'];
    const rotRaw = rawResultsRef.current['THORACIC_ROTATION'];
    
    if (!hingeRaw || !rotRaw) {
      console.warn('Missing results for scoring', rawResultsRef.current);
    }
    
    const finalScore = calculateGolfBodyScore(hingeRaw, rotRaw, language);
    const screeningResult = buildScreeningResult(finalScore, plan, language);
    
    audioCoachRef.current.speak('SCREENING_ALL_COMPLETE', 'HIGH');
    onComplete(screeningResult);
  };

  return (
    <div className="flex flex-col h-full bg-black text-white relative">
      <div className="absolute top-0 left-0 right-0 z-50 p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="flex items-center justify-between pointer-events-auto">
          <button onClick={onCancel} className="p-2 bg-gray-800/80 rounded-full hover:bg-gray-700">
            <X size={24} />
          </button>
          
          <div className="flex items-center gap-2">
            {plan.steps.map((step, idx) => (
              <div 
                key={step.id} 
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  idx === currentStepIndex ? `bg-${step.color}-600 text-white shadow-lg shadow-${step.color}-500/50 scale-105` 
                  : idx < currentStepIndex ? 'bg-emerald-600/80 text-white' 
                  : 'bg-gray-800/80 text-gray-400'
                }`}
              >
                <span>{step.icon}</span>
                <span className="hidden sm:inline">{step.label[language === 'sv-SE' ? 'sv' : 'en']}</span>
              </div>
            ))}
          </div>
          
          <div className="w-10"></div>
        </div>
      </div>

      {phase === 'TRANSITION' ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-950 p-6 text-center">
          <div className={`w-24 h-24 rounded-3xl bg-${plan.steps[currentStepIndex]?.color}-500/20 flex items-center justify-center text-6xl mb-6 border-2 border-${plan.steps[currentStepIndex]?.color}-500/50 animate-pulse`}>
            {plan.steps[currentStepIndex]?.icon}
          </div>
          <h2 className="text-3xl font-bold mb-4">
            {language === 'sv-SE' ? `Byt till ${plan.steps[currentStepIndex]?.label.sv}` : `Switch to ${plan.steps[currentStepIndex]?.label.en}`}
          </h2>
          <p className="text-xl text-gray-400 max-w-md">
            {plan.steps[currentStepIndex]?.description[language === 'sv-SE' ? 'sv' : 'en']}
          </p>
        </div>
      ) : (
        <div className={isMobileFullscreen ? "fixed inset-0 z-40 bg-black" : "flex-1 relative flex items-center justify-center bg-black overflow-hidden"}>
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover sm:object-contain"
            style={{ transform: cameraFacing === 'user' ? 'scaleX(-1)' : 'none' }}
            playsInline
            muted
            autoPlay
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover sm:object-contain pointer-events-none"
            style={{ transform: cameraFacing === 'user' ? 'scaleX(-1)' : 'none' }}
          />
          
          <div className="absolute top-20 right-4 z-50 flex flex-col gap-3">
            <button
              onClick={toggleCameraFacing}
              disabled={isSwitchingCamera}
              className="bg-black/70 p-3 rounded-full border border-white/20 text-white backdrop-blur-md"
            >
              <SwitchCamera size={24} className={isSwitchingCamera ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={toggleFullscreen}
              className="bg-black/70 p-3 rounded-full border border-white/20 text-white backdrop-blur-md"
            >
              {isMobileFullscreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
            </button>
          </div>

          {activeSubtitle && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 max-w-[90%] bg-black/90 backdrop-blur-md border-2 border-blue-400 text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2.5 font-bold animate-pulse text-center">
              <Volume2 size={20} className="text-blue-400 flex-shrink-0" />
              <span className="truncate">"{activeSubtitle}"</span>
            </div>
          )}

          <CameraGuideOverlay 
            readinessState={readinessResult?.state || 'NOT_READY'} 
            feedback={readinessResult?.feedback || 'STEP_INTO_FRAME'} 
            appState={appTestState}
            language={language}
            viewMode={currentStep.requiredView}
            isBriefingActive={isBriefingActive}
            onReplayBriefing={() => { cancelBriefing(); playBriefingForStep(currentStepIndex); }}
            onSkipBriefing={cancelBriefing}
            coachingMode="GUIDED"
            isFullscreen={isMobileFullscreen}
          />
          
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
            {appTestState === 'SETUP' && readinessResult?.state === 'READY' && !isBriefingActive && (
              <div className="absolute bottom-12 pointer-events-auto">
                <button onClick={handleStartTest} className="bg-green-600 text-white font-bold py-3 px-8 rounded-full shadow-2xl flex items-center gap-3 animate-pulse border-2 border-white/20">
                  {language === 'sv-SE' ? 'STARTAR...' : 'STARTING...'}
                </button>
              </div>
            )}
            {appTestState === 'COUNTDOWN' && (
              <div className="flex flex-col items-center animate-bounce">
                <div className="w-32 h-32 rounded-full bg-black/85 border-4 border-green-400 flex items-center justify-center">
                  <span className="text-white text-8xl font-black">{countdownNumber}</span>
                </div>
              </div>
            )}
            {appTestState === 'ACTIVE' && (
              <div className="absolute bottom-12 flex flex-col items-center">
                <div className="bg-red-600/95 text-white font-black py-3 px-8 rounded-full shadow-2xl animate-pulse flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-white animate-ping"></span>
                  {currentStep.engineType === 'rotation'
                    ? (language === 'sv-SE' ? 'TEST PÅGÅR – ROTERA FRAM & TILLBAKA' : 'TEST ACTIVE – ROTATE BACK & FORTH')
                    : (language === 'sv-SE' ? 'TEST PÅGÅR – GÖR DINA FÄLLNINGAR' : 'TEST ACTIVE – PERFORM REPS')}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
