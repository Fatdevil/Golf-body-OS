import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Upload,
  ChevronLeft,
  ChevronRight,
  Info,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Activity,
  Compass,
  ArrowRight,
  Layers,
  Sparkles,
  Dumbbell,
  Volume2,
  VolumeX,
  Target,
  Award,
  Check,
  Download
} from 'lucide-react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { PoseFrame } from '../../../../src/core/types/pose-frame';
import { mirrorPoseFrame } from '../../../../src/core/coordinates/pose-mirror';
import { Landmark, LandmarkId } from '../../../../src/core/types/landmark';
import {
  CameraViewAngle,
  GolfSwingAnalysisResult,
  ORDERED_SWING_PHASES,
  SWING_PHASE_INFO,
  SwingPhaseId,
  SwingKinematics
} from '../../../../src/core/types/golf-swing';
import { GolfSwingPhaseEngine } from '../../../../src/core/motion/phases/golf-swing-phase-engine';
import { BodySwingCorrelator } from '../../../../src/core/correlation/body-swing-correlator';
import {
  generate240FpsSwingSequence,
  generateTigerClubState,
  SampleSwingType
} from '../../../../src/core/data/sample-240fps-swing';
import { renderSportsboxAvatar } from './SportsboxAvatarRenderer';
import NeonSentinel3DView from './NeonSentinel3DView';
import { GolfBodyScoreResult } from '../../../../src/core/metrics/golf-body-score';
import { SupportedLanguage, getPhrase } from '../../../../src/core/coaching/i18n/locales';
import { getLandmark, extractPhaseKinematics } from '../../../../src/core/metrics/golf-swing-metrics';
import {
  GHOST_CHECKPOINTS,
  GhostCheckpointId,
  getProCheckpointPoseFrame,
  evaluateGhostPoseMatch,
  GhostMatchResult
} from '../../../../src/core/coaching/ghost-trainer-engine';
import { AudioCoachService } from '../../../../src/core/coaching/audio-coach';

export interface SwingAnalysisViewProps {
  currentBodyScore: GolfBodyScoreResult | null;
  language: SupportedLanguage;
  onNavigateToScreening?: () => void;
}

export default function SwingAnalysisView({
  currentBodyScore,
  language,
  onNavigateToScreening
}: SwingAnalysisViewProps) {
  const isSv = language === 'sv-SE';

  // Analysis settings
  const [viewAngle, setViewAngle] = useState<CameraViewAngle>('FACE_ON');
  const [avatarRenderMode, setAvatarRenderMode] = useState<'3D_NEON' | '2D_STUDIO'>('3D_NEON');
  const [isRightHanded, setIsRightHanded] = useState<boolean>(true);
  const [isMirroredView, setIsMirroredView] = useState<boolean>(false);
  const [sampleType, setSampleType] = useState<SampleSwingType>('OPTIMAL');
  const [useSampleScreening, setUseSampleScreening] = useState<boolean>(false);

  // Frames & engine
  const [frames, setFrames] = useState<PoseFrame[]>(() =>
    generate240FpsSwingSequence(480, 'OPTIMAL')
  );
  const [analysis, setAnalysis] = useState<GolfSwingAnalysisResult | null>(null);

  // Playback state
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(0.1); // 0.1x slow-mo for 240 fps inspection

  // Visual overlay toggles
  const [showSkeleton, setShowSkeleton] = useState<boolean>(true);
  const [showAngles, setShowAngles] = useState<boolean>(true);
  const [showClubTrajectory, setShowClubTrajectory] = useState<boolean>(true);
  const [showHandTrajectory, setShowHandTrajectory] = useState<boolean>(true);
  const [showGhost, setShowGhost] = useState<boolean>(false);

  // Ghost Mode & Trainer State
  const [trainerMode, setTrainerMode] = useState<boolean>(false);
  const [activeCheckpointId, setActiveCheckpointId] = useState<GhostCheckpointId>('P1_ADDRESS');
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [audioVoiceEnabled, setAudioVoiceEnabled] = useState<boolean>(true);
  const [dwellHoldProgress, setDwellHoldProgress] = useState<number>(0); // 0 to 100%
  const [completedCheckpoints, setCompletedCheckpoints] = useState<Set<GhostCheckpointId>>(new Set());

  // Video Extraction State
  const [isExtractingVideo, setIsExtractingVideo] = useState<boolean>(false);
  const [extractionProgress, setExtractionProgress] = useState<number>(0);
  const [extractedFileName, setExtractedFileName] = useState<string | null>(null);

  const audioCoachRef = useRef<AudioCoachService | null>(null);
  if (!audioCoachRef.current) {
    audioCoachRef.current = new AudioCoachService({
      defaultLanguage: language,
      mode: 'FULL'
    });
  }

  useEffect(() => {
    if (audioCoachRef.current) {
      audioCoachRef.current.setLanguage(language);
      audioCoachRef.current.setMuted(!audioVoiceEnabled);
    }
  }, [language, audioVoiceEnabled]);

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Active screening score to use for correlation
  const activeBodyScore = useMemo<GolfBodyScoreResult | null>(() => {
    if (currentBodyScore) return currentBodyScore;
    if (useSampleScreening) {
      return {
        totalScore: 68,
        tier: 'MODERATE',
        tierLabel: isSv ? 'Måttlig rörlighet' : 'Moderate Mobility',
        tierColor: '#f59e0b',
        hipHinge: {
          total: 34,
          depthScore: 18,
          kneeScore: 10,
          spineScore: 6,
          avgHingeAngle: 42,
          avgKneeAngle: 152,
          compensations: ['LUMBAR_COLLAPSE']
        },
        thoracic: {
          total: 34,
          rotationScore: 16,
          disassociationScore: 10,
          symmetryScore: 4,
          dipScore: 4,
          maxLeft: 34,
          maxRight: 46,
          asymmetry: 12,
          maxPelvicTurn: 38,
          hasExcessiveDip: false,
          hasExcessivePelvic: true
        },
        keyStrengths: ['God stabilitet i knävinkel under uppställning'],
        primaryBottlenecks: [
          'Begränsad höftfällning (34/50): tenderar att resa bröstkorgen under dynamisk sving',
          'Rotationsasymmetri (12°): svårare att rotera åt vänster än höger'
        ],
        summary: 'Måttlig rörlighet med begränsad bäckendjup och asymmetrisk rotation.'
      };
    }
    return null;
  }, [currentBodyScore, useSampleScreening]);

  // Load / Analyze sequence when frames, viewAngle or rightHanded changes
  useEffect(() => {
    if (frames.length === 0) return;
    const engine = new GolfSwingPhaseEngine({ viewAngle, isRightHanded });
    const rawAnalysis = engine.analyzeSequence(frames);

    // Run body correlation
    const correlator = new BodySwingCorrelator();
    const correlations = correlator.correlate(activeBodyScore, rawAnalysis);
    rawAnalysis.correlations = correlations;

    setAnalysis(rawAnalysis);
  }, [frames, viewAngle, isRightHanded, activeBodyScore]);

  // Switch camera view angle and immediately load matching reference sequence
  const handleViewAngleChange = (newAngle: CameraViewAngle) => {
    if (newAngle === viewAngle) return;
    setIsPlaying(false);
    setViewAngle(newAngle);
    const baseSeq = generate240FpsSwingSequence(480, sampleType, newAngle);
    const seq = isRightHanded ? baseSeq : baseSeq.map(mirrorPoseFrame);
    setFrames(seq);
    setCurrentFrameIndex(0);
  };

  // Load sample swing preset
  const handleLoadSample = (type: SampleSwingType) => {
    setIsPlaying(false);
    setSampleType(type);
    const baseSeq = generate240FpsSwingSequence(480, type, viewAngle);
    const seq = isRightHanded ? baseSeq : baseSeq.map(mirrorPoseFrame);
    setFrames(seq);
    setCurrentFrameIndex(0);
  };

  // Switch handedness and reload matching sequence
  const handleHandednessChange = (rightHanded: boolean) => {
    if (rightHanded === isRightHanded) return;
    setIsPlaying(false);
    setIsRightHanded(rightHanded);
    const baseSeq = generate240FpsSwingSequence(480, sampleType, viewAngle);
    const seq = rightHanded ? baseSeq : baseSeq.map(mirrorPoseFrame);
    setFrames(seq);
    setCurrentFrameIndex(0);
  };

  // Jump to specific P-phase
  const handleJumpToPhase = (phaseId: SwingPhaseId) => {
    if (!analysis) return;
    const phase = analysis.phases[phaseId];
    if (phase) {
      setIsPlaying(false);
      setCurrentFrameIndex(phase.frameIndex);
    }
  };

  // Export extracted Tiger Woods frames to JSON
  const handleExportTigerJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(frames, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `tiger_2000_${viewAngle.toLowerCase()}_extracted.json`);
    dlAnchorElem.click();
  };

  // Real MediaPipe slow-mo video upload handler
  const handleCustomVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsPlaying(false);
    setIsExtractingVideo(true);
    setExtractionProgress(0);
    setExtractedFileName(file.name);

    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
      const pm = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/pose_landmarker_full.task',
          delegate: 'GPU'
        },
        runningMode: 'IMAGE',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.playsInline = true;
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = (err) => reject(err);
      });

      const duration = video.duration || 2.0;
      const totalSteps = Math.min(240, Math.max(30, Math.round(duration * 60)));
      const stepDuration = duration / totalSteps;

      const offCanvas = document.createElement('canvas');
      offCanvas.width = video.videoWidth || 640;
      offCanvas.height = video.videoHeight || 480;
      const offCtx = offCanvas.getContext('2d');

      const extracted: PoseFrame[] = [];

      for (let step = 0; step < totalSteps; step++) {
        const time = step * stepDuration;
        video.currentTime = time;
        await new Promise<void>((res) => {
          video.onseeked = () => res();
        });

        if (offCtx) {
          offCtx.drawImage(video, 0, 0, offCanvas.width, offCanvas.height);
          const result = pm.detect(offCanvas);
          if (result.landmarks && result.landmarks[0] && result.landmarks[0].length === 33) {
            const raw = result.landmarks[0];
            const landmarks: Landmark[] = raw.map((lm, idx) => ({
              id: idx as LandmarkId,
              x: lm.x,
              y: lm.y,
              z: lm.z ?? 0,
              visibility: lm.visibility ?? 0.95
            }));
            const lw = landmarks[LandmarkId.LEFT_WRIST];
            const rw = landmarks[LandmarkId.RIGHT_WRIST];
            const hx = (lw && rw) ? (lw.x + rw.x) / 2 : 0.5;
            const hy = (lw && rw) ? (lw.y + rw.y) / 2 : 0.5;
            const club = generateTigerClubState(Math.round((step / totalSteps) * 480), hx, hy, 0, viewAngle);

            extracted.push({
              frameId: step,
              timestampMs: time * 1000,
              width: offCanvas.width,
              height: offCanvas.height,
              landmarks,
              club,
              model: 'MEDIAPIPE_POSE_VIDEO_EXTRACT',
              modelVersion: '0.10.14'
            });
          }
        }
        setExtractionProgress(Math.round(((step + 1) / totalSteps) * 100));
      }

      if (extracted.length >= 15) {
        setFrames(extracted);
        setCurrentFrameIndex(0);
      } else {
        alert(isSv ? 'Kunde inte detektera tillräckligt många poser i videon.' : 'Could not detect enough poses in video.');
      }
    } catch (err) {
      console.error('Video extraction failed', err);
      alert(isSv ? 'Fel vid videoextraktion: ' + String(err) : 'Video extraction failed: ' + String(err));
    } finally {
      setIsExtractingVideo(false);
    }
  };

  // Animation playback loop
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    lastTimeRef.current = performance.now();

    const loop = (now: number) => {
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      // At 240 fps, 1 second = 240 frames.
      // Target advance: (delta / 1000) * 240 * playbackSpeed
      const framesToAdvance = (delta / 1000) * 240 * playbackSpeed;

      setCurrentFrameIndex((prev) => {
        const next = prev + framesToAdvance;
        if (next >= frames.length - 1) {
          setIsPlaying(false);
          return 0; // Loop or stop
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, frames.length, playbackSpeed]);

  const activeIntFrame = Math.min(frames.length - 1, Math.floor(currentFrameIndex));
  const currentFrame = frames[activeIntFrame];

  // Determine which phase we are closest to
  const activePhase = useMemo<SwingPhaseId | null>(() => {
    if (!analysis) return null;
    let closestPhase: SwingPhaseId | null = null;
    let minDiff = Infinity;

    for (const phaseId of ORDERED_SWING_PHASES) {
      const p = analysis.phases[phaseId];
      if (p) {
        const diff = Math.abs(p.frameIndex - activeIntFrame);
        if (diff < minDiff && diff <= 12) {
          minDiff = diff;
          closestPhase = phaseId;
        }
      }
    }
    return closestPhase;
  }, [analysis, activeIntFrame]);

  // Live kinematics at current frame
  const currentKinematics = useMemo<SwingKinematics | null>(() => {
    if (!currentFrame || !frames[0]) return null;
    return extractPhaseKinematics(
      currentFrame,
      activePhase || 'P1_ADDRESS',
      frames[0],
      viewAngle,
      isRightHanded
    );
  }, [currentFrame, frames, activePhase, viewAngle, isRightHanded]);

  // Active Ghost Checkpoint Definition
  const currentCheckpointDef = useMemo(() => {
    return GHOST_CHECKPOINTS.find((c) => c.id === activeCheckpointId) || GHOST_CHECKPOINTS[0];
  }, [activeCheckpointId]);

  // Real-time evaluation against Ghost Target Checkpoint
  const ghostMatchResult = useMemo<GhostMatchResult | null>(() => {
    if (!currentFrame || !frames[0]) return null;
    return evaluateGhostPoseMatch(
      currentFrame,
      currentCheckpointDef,
      frames[0],
      viewAngle,
      isRightHanded,
      isMirroredView
    );
  }, [currentFrame, currentCheckpointDef, frames, viewAngle, isRightHanded, isMirroredView]);

  // Checkpoint selection handler
  const handleSelectCheckpoint = (cpId: GhostCheckpointId) => {
    setIsPlaying(false);
    setActiveCheckpointId(cpId);
    const cp = GHOST_CHECKPOINTS.find((c) => c.id === cpId);
    if (cp) {
      setCurrentFrameIndex(cp.frameIndex240Fps);
      if (audioVoiceEnabled && audioCoachRef.current) {
        audioCoachRef.current.speak(cp.cueKey, 'HIGH');
      }
    }
  };

  // Dwell timer for position lock & auto-advance
  const lockStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!trainerMode) return;

    let intervalId: any = null;
    if (ghostMatchResult?.isLocked) {
      if (!lockStartTimeRef.current) {
        lockStartTimeRef.current = Date.now();
      }
      intervalId = setInterval(() => {
        if (!lockStartTimeRef.current) return;
        const elapsed = Date.now() - lockStartTimeRef.current;
        const progress = Math.min(100, Math.round((elapsed / 1500) * 100));
        setDwellHoldProgress(progress);

        if (elapsed >= 1500) {
          clearInterval(intervalId);
          audioCoachRef.current?.playSuccessChime();
          setCompletedCheckpoints((prev) => new Set([...prev, activeCheckpointId]));

          if (autoAdvance) {
            const currentIdx = GHOST_CHECKPOINTS.findIndex((c) => c.id === activeCheckpointId);
            if (currentIdx < GHOST_CHECKPOINTS.length - 1) {
              const nextCp = GHOST_CHECKPOINTS[currentIdx + 1];
              setActiveCheckpointId(nextCp.id);
              setCurrentFrameIndex(nextCp.frameIndex240Fps);
              lockStartTimeRef.current = null;
              setDwellHoldProgress(0);
              if (audioVoiceEnabled && audioCoachRef.current) {
                audioCoachRef.current.speak(nextCp.cueKey, 'HIGH');
              }
            } else {
              if (audioVoiceEnabled && audioCoachRef.current) {
                audioCoachRef.current.speak('GHOST_TRAINER_COMPLETE', 'HIGH');
              }
            }
          }
        }
      }, 50);
    } else {
      lockStartTimeRef.current = null;
      setDwellHoldProgress(0);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [trainerMode, ghostMatchResult?.isLocked, activeCheckpointId, autoAdvance, audioVoiceEnabled]);

  // Draw on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentFrame) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Unified Mirroring for Display:
    // Base synthetic sequence is stored in standard broadcast view.
    // In video mode (isMirroredView = false), display directly without flip.
    // In selfie mode (isMirroredView = true), flip horizontally to match mirror perspective.
    const shouldFlipDisplay = isMirroredView;
    const displayFrame = shouldFlipDisplay ? mirrorPoseFrame(currentFrame) : currentFrame;
    const displayAddrFrame = frames[0] ? (shouldFlipDisplay ? mirrorPoseFrame(frames[0]) : frames[0]) : null;

    // 1. Clear & draw golf simulator studio background
    ctx.clearRect(0, 0, width, height);

    // Studio gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.85, '#090d16');
    bgGrad.addColorStop(1, '#052e16'); // green turf reflection
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Ground turf line
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.92);
    ctx.lineTo(width, height * 0.92);
    ctx.stroke();

    // Turf hash lines (grass texture)
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 1;
    for (let x = 10; x < width; x += 25) {
      ctx.beginPath();
      ctx.moveTo(x, height * 0.92);
      ctx.lineTo(x - 8, height);
      ctx.stroke();
    }

    // Grid alignment lines (subtle)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let y = height * 0.1; y < height * 0.9; y += height * 0.1) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2a. Clubhead trajectory trace (Backswing Plane, Impact Delivery Arc & Active Comet Tail)
    if (showClubTrajectory && frames.length > 0) {
      ctx.save();

      const pAddressIdx = analysis?.phases.P1_ADDRESS?.frameIndex ?? 40;
      const pTopIdx = analysis?.phases.P4_TOP?.frameIndex ?? 212;
      const pReleaseIdx = analysis?.phases.P8_RELEASE?.frameIndex ?? 320;

      // 1. Backswing Arc (Address to Top): Subtle dashed ice-blue
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.40)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      let startedBack = false;
      for (let i = pAddressIdx; i <= pTopIdx && i < frames.length; i += 2) {
        const rawF = frames[i];
        if (!rawF) continue;
        const f = shouldFlipDisplay ? mirrorPoseFrame(rawF) : rawF;
        const clubHead = f.club?.clubHead;
        if (clubHead) {
          const cx = clubHead.x * width;
          const cy = clubHead.y * height;
          if (!startedBack) {
            ctx.moveTo(cx, cy);
            startedBack = true;
          } else {
            ctx.lineTo(cx, cy);
          }
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Downswing Delivery Arc (Top to Release): Luminous neon cyan with glow
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.8;
      ctx.shadowColor = 'rgba(0, 240, 255, 0.85)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      let startedDown = false;
      for (let i = pTopIdx; i <= pReleaseIdx && i < frames.length; i += 2) {
        const rawF = frames[i];
        if (!rawF) continue;
        const f = shouldFlipDisplay ? mirrorPoseFrame(rawF) : rawF;
        const clubHead = f.club?.clubHead;
        if (clubHead) {
          const cx = clubHead.x * width;
          const cy = clubHead.y * height;
          if (!startedDown) {
            ctx.moveTo(cx, cy);
            startedDown = true;
          } else {
            ctx.lineTo(cx, cy);
          }
        }
      }
      ctx.stroke();

      // 3. Dynamic Toptracer Comet Tail (Last 30 frames trailing current frame)
      const trailStart = Math.max(0, activeIntFrame - 30);
      if (activeIntFrame > trailStart) {
        ctx.lineWidth = 3.5;
        ctx.shadowBlur = 10;
        for (let i = trailStart; i < activeIntFrame; i += 2) {
          const rawF1 = frames[i];
          const rawF2 = frames[Math.min(frames.length - 1, i + 2)];
          if (rawF1?.club && rawF2?.club) {
            const f1 = shouldFlipDisplay ? mirrorPoseFrame(rawF1) : rawF1;
            const f2 = shouldFlipDisplay ? mirrorPoseFrame(rawF2) : rawF2;
            const progress = (i - trailStart) / (activeIntFrame - trailStart);
            ctx.strokeStyle = `rgba(0, 240, 255, ${progress.toFixed(2)})`;
            ctx.beginPath();
            ctx.moveTo(f1.club!.clubHead.x * width, f1.club!.clubHead.y * height);
            ctx.lineTo(f2.club!.clubHead.x * width, f2.club!.clubHead.y * height);
            ctx.stroke();
          }
        }

        // Glowing ping at active clubhead position
        const activeFrameData = frames[activeIntFrame];
        if (activeFrameData?.club) {
          const fAct = shouldFlipDisplay ? mirrorPoseFrame(activeFrameData) : activeFrameData;
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(fAct.club!.clubHead.x * width, fAct.club!.clubHead.y * height, 5, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    // 2b. Hand trajectory trace (Golden/amber shallowing drop-loop)
    if (showHandTrajectory && frames.length > 0) {
      ctx.save();
      const pTopIdx = analysis?.phases.P4_TOP?.frameIndex ?? 212;
      const pImpactIdx = analysis?.phases.P7_IMPACT?.frameIndex ?? 290;

      // Shallowing Drop-Loop (Top to Impact)
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      let startedHands = false;
      for (let i = pTopIdx; i <= pImpactIdx && i < frames.length; i += 2) {
        const rawF = frames[i];
        if (!rawF) continue;
        const f = shouldFlipDisplay ? mirrorPoseFrame(rawF) : rawF;
        const lw = getLandmark(f, LandmarkId.LEFT_WRIST);
        const rw = getLandmark(f, LandmarkId.RIGHT_WRIST);
        if (lw && rw) {
          const hx = ((lw.x + rw.x) / 2) * width;
          const hy = ((lw.y + rw.y) / 2) * height;
          if (!startedHands) {
            ctx.moveTo(hx, hy);
            startedHands = true;
          } else {
            ctx.lineTo(hx, hy);
          }
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // 3. Draw Address Reference Lines
    if (viewAngle === 'FACE_ON') {
      // Face-On: Draw Iconic Tiger Head Box for true Sway & Dip detection
      if (displayAddrFrame) {
        const addrEarL = getLandmark(displayAddrFrame, LandmarkId.LEFT_EAR);
        const addrEarR = getLandmark(displayAddrFrame, LandmarkId.RIGHT_EAR);
        const addrNose = getLandmark(displayAddrFrame, LandmarkId.NOSE);
        const addrHeadX = addrEarL && addrEarR ? (addrEarL.x + addrEarR.x) / 2 : addrNose?.x;
        const addrHeadY = addrEarL && addrEarR ? (addrEarL.y + addrEarR.y) / 2 : addrNose?.y;
        if (addrHeadX !== undefined && addrHeadY !== undefined) {
          const hx = addrHeadX * width;
          const hy = addrHeadY * height;
          const boxW = 38;
          const boxH = 40;

          ctx.strokeStyle = 'rgba(234, 179, 8, 0.55)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(hx - boxW / 2, hy - boxH / 2, boxW, boxH);
          ctx.setLineDash([]);

          // Label
          ctx.fillStyle = 'rgba(234, 179, 8, 0.85)';
          ctx.font = 'bold 8.5px monospace';
          ctx.fillText('TIGER HEAD BOX', hx - 34, hy - boxH / 2 - 5);
        }
      }
    } else {
      // Down-The-Line (DTL): Draw Iconic PGA Tush Line & Shaft Plane
      if (displayAddrFrame) {
        const addrLH = getLandmark(displayAddrFrame, LandmarkId.LEFT_HIP);
        const addrRH = getLandmark(displayAddrFrame, LandmarkId.RIGHT_HIP);
        const currLH = getLandmark(displayFrame, LandmarkId.LEFT_HIP);
        const currRH = getLandmark(displayFrame, LandmarkId.RIGHT_HIP);

        // 1. TUSH LINE: Vertical reference line at posterior glute boundary
        const addrHipX = (addrLH?.x !== undefined && addrRH?.x !== undefined)
          ? (shouldFlipDisplay ? Math.min(addrLH.x, addrRH.x) - 0.015 : Math.max(addrLH.x, addrRH.x) + 0.015)
          : (shouldFlipDisplay ? 0.385 : 0.615);
        const tushX = addrHipX * width;
        const currHipX = (currLH?.x !== undefined && currRH?.x !== undefined)
          ? (shouldFlipDisplay ? Math.min(currLH.x, currRH.x) - 0.015 : Math.max(currLH.x, currRH.x) + 0.015)
          : (shouldFlipDisplay ? 0.385 : 0.615);
        const currHipPx = currHipX * width;

        // Detect Early Extension (hip moves forward towards ball away from Tush Line during downswing/impact)
        const isImpactPhase = activeIntFrame >= 240 && activeIntFrame <= 310;
        const hipLossPx = shouldFlipDisplay ? (currHipPx - tushX) : (tushX - currHipPx);
        const isEarlyExt = isImpactPhase && hipLossPx > 14;

        ctx.strokeStyle = isEarlyExt ? '#ef4444' : '#06b6d4';
        ctx.lineWidth = isEarlyExt ? 2.5 : 1.8;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(tushX, height * 0.35);
        ctx.lineTo(tushX, height * 0.92);
        ctx.stroke();
        ctx.setLineDash([]);

        // Tush Line Pill Badge
        ctx.fillStyle = isEarlyExt ? 'rgba(239, 68, 68, 0.95)' : 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = isEarlyExt ? '#ef4444' : '#06b6d4';
        ctx.lineWidth = 1;
        ctx.roundRect(tushX - 38, height * 0.35 - 18, 76, 17, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isEarlyExt ? '#ffffff' : '#06b6d4';
        ctx.font = 'bold 8.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(isEarlyExt ? '⚠️ TUSH LOST' : 'TUSH LINE', tushX, height * 0.35 - 6);
        ctx.textAlign = 'start';

        // 2. PGA DUAL SWING PLANES: The Slot (Shaft Plane & Shoulder Plane)
        const ballX = (shouldFlipDisplay ? (1 - 0.34) : 0.34) * width;
        const ballY = 0.905 * height;

        // Lower Plane: SHAFT PLANE (from ball through address hands and beltline)
        const shaftPlaneTopX = (shouldFlipDisplay ? (1 - 0.62) : 0.62) * width;
        const shaftPlaneTopY = 0.22 * height;

        // Upper Plane: SHOULDER PLANE (from ball through address shoulders)
        const shoulderPlaneTopX = (shouldFlipDisplay ? (1 - 0.52) : 0.52) * width;
        const shoulderPlaneTopY = 0.12 * height;

        // Draw "The Slot" delivery corridor
        ctx.fillStyle = 'rgba(234, 179, 8, 0.05)';
        ctx.beginPath();
        ctx.moveTo(ballX, ballY);
        ctx.lineTo(shoulderPlaneTopX, shoulderPlaneTopY);
        ctx.lineTo(shaftPlaneTopX, shaftPlaneTopY);
        ctx.closePath();
        ctx.fill();

        // Draw Shaft Plane Line (Amber)
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(ballX, ballY);
        ctx.lineTo(shaftPlaneTopX, shaftPlaneTopY);
        ctx.stroke();

        // Draw Shoulder Plane Line (Sky Blue)
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(ballX, ballY);
        ctx.lineTo(shoulderPlaneTopX, shoulderPlaneTopY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Labels
        ctx.fillStyle = 'rgba(234, 179, 8, 0.75)';
        ctx.font = '8.5px monospace';
        ctx.fillText('SHAFT PLANE', shaftPlaneTopX - 10, shaftPlaneTopY + 4);

        ctx.fillStyle = 'rgba(56, 189, 248, 0.65)';
        ctx.font = '8.5px monospace';
        ctx.fillText('SHOULDER PLANE', shoulderPlaneTopX - 25, shoulderPlaneTopY - 4);
      }
    }

    // 3.5 Draw Pro Ghost Avatar (Tiger Woods 2000 Baseline, in Trainer Mode or when explicitly enabled)
    if (showGhost || trainerMode) {
      const ghostFrame = trainerMode
        ? getProCheckpointPoseFrame(activeCheckpointId, viewAngle, isRightHanded, isMirroredView)
        : (() => {
            const tigerSeq = generate240FpsSwingSequence(480, 'OPTIMAL', viewAngle);
            const tigerProg = frames.length > 1 ? activeIntFrame / (frames.length - 1) : 0;
            const refIdx = Math.min(tigerSeq.length - 1, Math.max(0, Math.round(tigerProg * (tigerSeq.length - 1))));
            const rawRef = tigerSeq[refIdx];
            const shouldFlip = (!isRightHanded) !== isMirroredView;
            return shouldFlip ? mirrorPoseFrame(rawRef) : rawRef;
          })();

      if (ghostFrame && ghostFrame.landmarks) {
        const isMatched = ghostMatchResult?.isLocked;
        renderSportsboxAvatar(ctx, ghostFrame, width, height, {
          isGhost: true,
          ghostMatched: isMatched,
          viewAngle,
          showSkewers: false
        });

        // Ghost Head & Match Badge
        const ghNose = getLandmark(ghostFrame, LandmarkId.NOSE);
        if (ghNose) {
          ctx.save();
          ctx.fillStyle = isMatched ? '#34d399' : '#fbbf24';
          ctx.font = 'bold 9px monospace';
          const ghostTag = isRightHanded ? 'TIGER GHOST' : 'TIGER GHOST (L)';
          const matchTag = isRightHanded ? 'TIGER MATCHED ✨' : 'TIGER MATCHED (L) ✨';
          ctx.fillText(
            isMatched ? matchTag : `👻 ${ghostTag}`,
            ghNose.x * width - 40,
            ghNose.y * height - 20
          );
          ctx.restore();
        }
      }
    }

    // 4. Draw Sportsbox AI 3D Mannequin Avatar (Primary Golfer)
    if (showSkeleton && displayFrame.landmarks) {
      renderSportsboxAvatar(ctx, displayFrame, width, height, {
        isGhost: false,
        viewAngle,
        chestTurnDeg: currentKinematics?.shoulderTurn,
        pelvisTurnDeg: currentKinematics?.pelvisTurn,
        showSkewers: showAngles
      });

      // Ball on turf
      const ballX = (viewAngle === 'FACE_ON' ? 0.50 : (shouldFlipDisplay ? (1 - 0.34) : 0.34)) * width;
      const ballY = 0.905 * height;

      if (activeIntFrame <= 292) {
        // Ball shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.ellipse(ballX, ballY + 4, 5, 2, 0, 0, 2 * Math.PI);
        ctx.fill();

        // Golf Ball
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ballX, ballY, 3.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    // 5. Draw Biomechanical Vector Lines (Spine Angle, Shoulder Line, Pelvis Line)
    if (showAngles) {
      const ls = getLandmark(displayFrame, LandmarkId.LEFT_SHOULDER);
      const rs = getLandmark(displayFrame, LandmarkId.RIGHT_SHOULDER);
      const lh = getLandmark(displayFrame, LandmarkId.LEFT_HIP);
      const rh = getLandmark(displayFrame, LandmarkId.RIGHT_HIP);

      if (ls && rs && lh && rh) {
        const midShoulderX = ((ls.x + rs.x) / 2) * width;
        const midShoulderY = ((ls.y + rs.y) / 2) * height;
        const midHipX = ((lh.x + rh.x) / 2) * width;
        const midHipY = ((lh.y + rh.y) / 2) * height;

        // SPINE LINE (Emerald Green)
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(midHipX, midHipY);
        ctx.lineTo(midShoulderX, midShoulderY);
        ctx.stroke();

        // Spine Angle Tag (Badge pill positioned cleanly beside the spine)
        if (currentKinematics) {
          const midSpineX = (midHipX + midShoulderX) / 2 + 10;
          const midSpineY = (midHipY + midShoulderY) / 2;
          // Posture loss / Early Extension is evaluated during downswing into impact (240 to 305)
          const isLoss = Math.abs(currentKinematics.spineAngleDelta) > 8 && activeIntFrame >= 240 && activeIntFrame <= 305;

          ctx.fillStyle = isLoss ? 'rgba(239, 68, 68, 0.95)' : 'rgba(15, 23, 42, 0.85)';
          ctx.strokeStyle = isLoss ? '#ef4444' : '#10b981';
          ctx.lineWidth = 1;
          ctx.roundRect(midSpineX, midSpineY - 11, viewAngle === 'DOWN_THE_LINE' ? 108 : 88, 22, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isLoss ? '#ffffff' : '#10b981';
          ctx.font = 'bold 10.5px sans-serif';
          ctx.fillText(
            viewAngle === 'DOWN_THE_LINE'
              ? `${isSv ? 'Lutning' : 'Spine'}: ${currentKinematics.spineInclination}°`
              : `${isSv ? 'Ryggrad' : 'Spine'}: ${currentKinematics.spineInclination}°`,
            midSpineX + 7,
            midSpineY + 4
          );
        }

        // SHOULDER LINE (Bright Gold)
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        if (viewAngle === 'FACE_ON') {
          ctx.moveTo(ls.x * width, ls.y * height);
          ctx.lineTo(rs.x * width, rs.y * height);
        } else {
          // In DTL: Draw transverse shoulder tilt line through mid-shoulder
          const sTilt = Math.sin((currentKinematics?.shoulderTurn ?? 0) * Math.PI / 180);
          ctx.moveTo(midShoulderX - 18, midShoulderY + sTilt * 12);
          ctx.lineTo(midShoulderX + 18, midShoulderY - sTilt * 12);
        }
        ctx.stroke();

        // PELVIS LINE (Cyan)
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        if (viewAngle === 'FACE_ON') {
          ctx.moveTo(lh.x * width, lh.y * height);
          ctx.lineTo(rh.x * width, rh.y * height);
        } else {
          // In DTL: Draw pelvis tilt line through mid-hip
          const pTilt = Math.sin((currentKinematics?.pelvisTurn ?? 0) * Math.PI / 180);
          ctx.moveTo(midHipX - 16, midHipY + pTilt * 10);
          ctx.lineTo(midHipX + 16, midHipY - pTilt * 10);
        }
        ctx.stroke();
      }
    }

    // 6. HUD Phase Badge on Canvas
    const phaseInfo = activePhase ? SWING_PHASE_INFO[activePhase] : null;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.roundRect(width - 195, 12, 183, 64, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(phaseInfo ? `${phaseInfo.id}: ${phaseInfo.name[language]}` : 'SWING ENGINE 240 FPS', width - 185, 32);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText(`${isSv ? 'Bildruta' : 'Frame'}: ${activeIntFrame} / ${frames.length - 1}`, width - 185, 48);
    ctx.fillText(`${isSv ? 'Tid' : 'Time'}: ${Math.round(currentFrame.timestampMs)} ms`, width - 185, 62);

    // 240 FPS Live indicator badge
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(22, 22, 5, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('240 FPS SLOW-MO', 34, 26);
  }, [
    currentFrame,
    showSkeleton,
    showAngles,
    showClubTrajectory,
    showHandTrajectory,
    showGhost,
    trainerMode,
    activeCheckpointId,
    ghostMatchResult,
    frames,
    activePhase,
    activeIntFrame,
    language,
    currentKinematics,
    viewAngle
  ]);

  return (
    <div className="flex flex-col gap-5 text-white">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-black text-xl shadow-lg shadow-emerald-500/20">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight">
                {isSv ? '240 fps Svinganalys (P1–P10)' : '240 fps Swing Engine (P1–P10)'}
              </h2>
              <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                240 FPS
              </span>
              <span className="bg-blue-500/20 border border-blue-500/40 text-blue-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                {viewAngle === 'FACE_ON' ? (isSv ? 'Framifrån' : 'Face-On') : (isSv ? 'Bakifrån' : 'DTL')}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isSv
                ? 'Millisekund-precision genom MediaPipe 3D biomekanik & automatisk fasdetektering.'
                : 'Sub-millisecond phase extraction through MediaPipe 3D kinematics.'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher: 240fps Analysis vs Tiger Ghost Trainer */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
            <button
              onClick={() => {
                setTrainerMode(false);
                audioCoachRef.current?.cancel();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                !trainerMode
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🎬</span>
              <span>{isSv ? '240 fps Analys' : '240 fps Studio'}</span>
            </button>
            <button
              onClick={() => {
                setTrainerMode(true);
                handleSelectCheckpoint(activeCheckpointId);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                trainerMode
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black shadow-lg shadow-amber-500/30 ring-1 ring-amber-300'
                  : 'text-amber-400 hover:text-white'
              }`}
            >
              <span>👻</span>
              <span>{isSv ? 'Tiger Ghost Trainer' : 'Tiger Ghost Trainer'}</span>
            </button>
          </div>

          {/* Sample Swings Selector */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => handleLoadSample('OPTIMAL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                sampleType === 'OPTIMAL' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title={isSv ? 'Ladda optimal 240 fps tour-sving' : 'Load optimal 240 fps tour swing'}
            >
              <span>⛳</span>
              <span>{isSv ? 'Optimal Sving' : 'Tour Swing'}</span>
            </button>
            <button
              onClick={() => handleLoadSample('EARLY_EXTENSION')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                sampleType === 'EARLY_EXTENSION' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title={isSv ? 'Simulera sving med Early Extension' : 'Simulate swing with Early Extension'}
            >
              <span>⚠️</span>
              <span>{isSv ? 'Early Extension' : 'Early Ext.'}</span>
            </button>
            <button
              onClick={() => handleLoadSample('SWAY')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                sampleType === 'SWAY' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title={isSv ? 'Simulera sving med Sway' : 'Simulate swing with Sway'}
            >
              <span>↔️</span>
              <span>Sway</span>
            </button>
            <button
              onClick={() => handleLoadSample('CHICKEN_WING')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                sampleType === 'CHICKEN_WING' ? 'bg-orange-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title={isSv ? 'Simulera sving med Chicken Wing (P8)' : 'Simulate swing with Chicken Wing (P8)'}
            >
              <span>🍗</span>
              <span>{isSv ? 'Chicken Wing' : 'Chicken Wing'}</span>
            </button>
          </div>

          {/* Upload Slow-Mo Video & Export */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 px-3 py-1.5 rounded-xl font-medium text-xs border border-slate-700 transition cursor-pointer shadow-sm">
              <Upload size={14} />
              <span>{isSv ? 'Ladda upp 240 fps Video' : 'Upload Video'}</span>
              <input type="file" accept="video/*" onChange={handleCustomVideoUpload} className="hidden" />
            </label>

            {extractedFileName && (
              <button
                onClick={handleExportTigerJson}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-3 py-1.5 rounded-xl font-bold text-xs border border-emerald-500 transition shadow-sm"
                title={isSv ? 'Ladda ner extraherade Tiger Woods punkter som JSON' : 'Download extracted Tiger Woods landmarks as JSON'}
              >
                <Download size={14} />
                <span>{isSv ? 'Exportera Tiger JSON' : 'Export Tiger JSON'}</span>
              </button>
            )}
          </div>

          {/* Camera View Angle Selector */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => handleViewAngleChange('FACE_ON')}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition ${
                viewAngle === 'FACE_ON' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Face-On
            </button>
            <button
              onClick={() => handleViewAngleChange('DOWN_THE_LINE')}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition ${
                viewAngle === 'DOWN_THE_LINE' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              DTL
            </button>
          </div>

          {/* Player Handedness Selector */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => handleHandednessChange(true)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                isRightHanded ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title={isSv ? 'Högerhänt golfare' : 'Right-handed golfer'}
            >
              <span>🏌️‍♂️</span>
              <span>{isSv ? 'Höger' : 'Right'}</span>
            </button>
            <button
              onClick={() => handleHandednessChange(false)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                !isRightHanded ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title={isSv ? 'Vänsterhänt golfare (speglar Tiger Ghost)' : 'Left-handed golfer (flips Tiger Ghost)'}
            >
              <span>🏌️‍♀️</span>
              <span>{isSv ? 'Vänster' : 'Left'}</span>
            </button>
          </div>

          {/* Camera Mirroring Mode Selector */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setIsMirroredView(true)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                isMirroredView ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title={isSv ? 'Spegelläge (för selfie/frontkamera)' : 'Mirrored mode (selfie camera)'}
            >
              <span>🪞</span>
              <span>{isSv ? 'Spegel' : 'Selfie'}</span>
            </button>
            <button
              onClick={() => setIsMirroredView(false)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                !isMirroredView ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title={isSv ? 'Normal vy (för bakre kamera eller video)' : 'Normal view (rear camera or video)'}
            >
              <span>📹</span>
              <span>{isSv ? 'Normal' : 'Video'}</span>
            </button>
          </div>

          {/* Avatar Render Mode: 3D Neon Sentinel vs 2D Studio */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setAvatarRenderMode('3D_NEON')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                avatarRenderMode === '3D_NEON'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-950'
                  : 'text-slate-400 hover:text-white'
              }`}
              title={isSv ? '3D Neon Sentinel (Three.js WebGL med 360° rotation)' : '3D Neon Sentinel (Three.js WebGL with 360° orbit)'}
            >
              <span>🤖</span>
              <span>3D Sentinel</span>
            </button>
            <button
              onClick={() => setAvatarRenderMode('2D_STUDIO')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                avatarRenderMode === '2D_STUDIO'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title={isSv ? '2D Biomekanisk Studio' : '2D Biomechanical Studio'}
            >
              <span>📊</span>
              <span>2D Studio</span>
            </button>
          </div>
        </div>
      </div>

      {/* 1.1 Video Extraction Progress Banner */}
      {isExtractingVideo && (
        <div className="bg-gradient-to-r from-blue-900/90 to-indigo-900/90 border border-blue-500 p-4 rounded-2xl flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center text-lg animate-spin">
              ⚙️
            </div>
            <div>
              <div className="font-bold text-sm text-white">
                {isSv ? `Analyserar Tiger Woods video: ${extractedFileName}` : `Analyzing Tiger Woods video: ${extractedFileName}`}
              </div>
              <div className="text-xs text-blue-200">
                {isSv ? 'MediaPipe Pose extraherar 33 skelettpunkter i realtid...' : 'MediaPipe Pose extracting 33 skeleton landmarks in real-time...'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-black text-xl text-cyan-400">{extractionProgress}%</span>
            <div className="w-36 bg-slate-950 rounded-full h-3 overflow-hidden border border-blue-700">
              <div
                className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-full transition-all duration-150"
                style={{ width: `${extractionProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 1b. Dedicated Tiger Ghost Checkpoint Trainer Panel (Active when trainerMode is ON) */}
      {trainerMode && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-900 border-2 border-amber-500/40 p-4 rounded-2xl shadow-2xl flex flex-col gap-3 relative overflow-hidden">
          {/* Subtle gold glow behind header */}
          <div className="absolute top-0 right-0 w-80 h-32 bg-amber-500/10 blur-3xl pointer-events-none rounded-full" />

          {/* Trainer Header: Status, Match Score & Audio Feedback */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold text-lg shadow-inner">
                👻
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-white">
                    {isSv ? 'Tiger Woods 2000 Ghost Trainer' : 'Tiger Woods 2000 Ghost Trainer'}
                  </h3>
                  <span className="bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles size={11} />
                    {currentCheckpointDef.name}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 font-medium">
                  {isSv ? currentCheckpointDef.descriptionSv : currentCheckpointDef.descriptionEn}
                </p>
              </div>
            </div>

            {/* Match Gauge & Controls */}
            <div className="flex items-center gap-2.5">
              {/* Match Score Badge */}
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition shadow-lg ${
                  ghostMatchResult?.isLocked
                    ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300 shadow-emerald-500/20'
                    : (ghostMatchResult?.matchScore ?? 0) >= 65
                    ? 'bg-amber-950/80 border-amber-500/80 text-amber-300 shadow-amber-500/20'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <Target size={16} className={ghostMatchResult?.isLocked ? 'text-emerald-400 animate-pulse' : 'text-amber-400'} />
                <div className="flex flex-col items-start leading-none">
                  <span className="text-[9px] uppercase tracking-wider font-semibold opacity-70">
                    {isSv ? 'Matchning' : 'Match'}
                  </span>
                  <span className="text-sm font-black font-mono">
                    {ghostMatchResult?.matchScore ?? 0}%
                  </span>
                </div>
              </div>

              {/* Dwell hold circular / bar progress */}
              {dwellHoldProgress > 0 && (
                <div className="flex flex-col items-center bg-slate-950 px-2.5 py-1 rounded-xl border border-emerald-500/50 text-emerald-400">
                  <span className="text-[9px] font-bold uppercase tracking-wider">
                    {isSv ? 'Låser...' : 'Locking...'}
                  </span>
                  <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                    <div
                      className="bg-emerald-400 h-full transition-all duration-75"
                      style={{ width: `${dwellHoldProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Audio Voice Guidance Toggle */}
              <button
                onClick={() => {
                  setAudioVoiceEnabled((v) => !v);
                  if (audioVoiceEnabled) audioCoachRef.current?.cancel();
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition ${
                  audioVoiceEnabled
                    ? 'bg-emerald-600/30 border-emerald-500/60 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
                title={isSv ? 'Slå på/av röstguidning' : 'Toggle voice guidance'}
              >
                {audioVoiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                <span>{isSv ? 'Röst' : 'Voice'}</span>
              </button>

              {/* Auto-Advance Toggle */}
              <button
                onClick={() => setAutoAdvance((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition ${
                  autoAdvance
                    ? 'bg-amber-600/30 border-amber-500/60 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
                title={isSv ? 'Hoppa automatiskt till nästa position vid godkänd låsning' : 'Auto advance to next position on lock'}
              >
                <span>⚡</span>
                <span>Auto</span>
              </button>

              {/* Re-listen prompt button */}
              <button
                onClick={() => {
                  if (audioCoachRef.current) {
                    audioCoachRef.current.speak(currentCheckpointDef.cueKey, 'HIGH');
                  }
                }}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                title={isSv ? 'Lyssna på instruktionen igen' : 'Replay cue'}
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* Advice Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-amber-400 font-bold">💡 {isSv ? 'Instruktion:' : 'Instruction:'}</span>
              <span className="text-slate-200">
                {isSv ? ghostMatchResult?.statusMessageSv : ghostMatchResult?.statusMessageEn}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
              <span>
                {isSv ? 'Mål axlar:' : 'Target Shoulders:'}{' '}
                <strong className="text-amber-400">{currentCheckpointDef.targetShoulderTurnDeg}°</strong>
              </span>
              <span>
                {isSv ? 'Höfter:' : 'Hips:'}{' '}
                <strong className="text-emerald-400">{currentCheckpointDef.targetHipTurnDeg}°</strong>
              </span>
            </div>
          </div>

          {/* 10 Checkpoints Navigation Strip */}
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 pt-1">
            {GHOST_CHECKPOINTS.map((cp) => {
              const isCurrent = cp.id === activeCheckpointId;
              const isDone = completedCheckpoints.has(cp.id);
              return (
                <button
                  key={cp.id}
                  onClick={() => handleSelectCheckpoint(cp.id)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition active:scale-95 ${
                    isCurrent
                      ? 'bg-gradient-to-b from-amber-500 to-yellow-600 border-amber-300 text-slate-950 font-black shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/50'
                      : isDone
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                      : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1 font-mono text-xs font-black">
                    <span>P{cp.pIndex}</span>
                    {isDone && <Check size={12} className="text-emerald-400" />}
                  </div>
                  <span className="text-[8.5px] truncate w-full mt-0.5 opacity-90 font-medium">
                    {isSv ? cp.nameSv.replace(/P\d+\s*-\s*/, '') : cp.name.replace(/P\d+\s*-\s*/, '')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Main Interactive Workspace (Canvas + P1-P10 Scrubber + Kinematics) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: 240 fps Canvas + Player Controls (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {/* Main Visualizer Container */}
          <div className={`relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center shadow-2xl transition-all ${
            avatarRenderMode === '3D_NEON' ? 'h-[460px]' : 'aspect-[16/10] max-h-[360px]'
          }`}>
            {avatarRenderMode === '3D_NEON' ? (
              <NeonSentinel3DView
                currentFrame={currentFrame}
                addressFrame={frames[0]}
                frames={frames}
                activeIntFrame={activeIntFrame}
                viewAngle={viewAngle}
                isRightHanded={isRightHanded}
                isMirroredView={isMirroredView}
                showClubheadPath={showClubTrajectory}
                showHandTrajectory={showHandTrajectory}
                metrics={currentKinematics}
                onViewAngleChange={handleViewAngleChange}
                className="w-full h-full"
              />
            ) : (
              <>
                <canvas ref={canvasRef} width={640} height={480} className="w-full h-full object-contain" />

                {/* Overlay toggle chips */}
                <div className="absolute bottom-3 left-3 flex gap-1.5 bg-slate-900/80 backdrop-blur p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setShowSkeleton((v) => !v)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                      showSkeleton ? 'bg-blue-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    Skelett
                  </button>
                  <button
                    onClick={() => setShowAngles((v) => !v)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                      showAngles ? 'bg-emerald-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    Vinklar
                  </button>
                  <button
                    onClick={() => setShowClubTrajectory((v) => !v)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                      showClubTrajectory ? 'bg-cyan-600 text-white shadow' : 'text-slate-400'
                    }`}
                    title={isSv ? 'Visa klubbhuvudets bana' : 'Show clubhead path'}
                  >
                    <span>⛳</span>
                    <span>{isSv ? 'Klubbana' : 'Club Arc'}</span>
                  </button>
                  <button
                    onClick={() => setShowHandTrajectory((v) => !v)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                      showHandTrajectory ? 'bg-amber-600 text-white shadow' : 'text-slate-400'
                    }`}
                    title={isSv ? 'Visa händernas rörelsebana' : 'Show hand path'}
                  >
                    <span>🖐️</span>
                    <span>{isSv ? 'Handbana' : 'Hand Path'}</span>
                  </button>
                  <button
                    onClick={() => setShowGhost((v) => !v)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                      showGhost ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-400'
                    }`}
                  >
                    <span>👻</span>
                    <span>Tiger Ghost</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Scrubber Timeline Bar */}
          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl flex flex-col gap-2.5 shadow-lg">
            {/* Timeline Slider with Phase Ticks */}
            <div className="relative flex items-center">
              <input
                type="range"
                min={0}
                max={frames.length - 1}
                value={activeIntFrame}
                onChange={(e) => {
                  setIsPlaying(false);
                  setCurrentFrameIndex(Number(e.target.value));
                }}
                className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
              />
            </div>

            {/* Time & Frame Readout */}
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>
                Frame <strong className="text-white">{activeIntFrame}</strong> / {frames.length - 1}
              </span>
              <span className="text-emerald-400 font-bold">
                {Math.round(currentFrame?.timestampMs || 0)} ms
              </span>
              <span>240 fps (4.16 ms/f)</span>
            </div>

            {/* Playback Controls & Speed Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsPlaying((p) => !p)}
                  className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30 transition"
                  title={isPlaying ? 'Pausa' : 'Spela upp'}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                </button>

                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentFrameIndex((f) => Math.max(0, f - 1));
                  }}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 flex items-center justify-center text-slate-200 transition"
                  title="1 bildruta bakåt (-4.16 ms)"
                >
                  <ChevronLeft size={16} />
                </button>

                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentFrameIndex((f) => Math.min(frames.length - 1, f + 1));
                  }}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 flex items-center justify-center text-slate-200 transition"
                  title="1 bildruta framåt (+4.16 ms)"
                >
                  <ChevronRight size={16} />
                </button>

                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentFrameIndex(0);
                  }}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 flex items-center justify-center text-slate-400 hover:text-white transition"
                  title="Starta om från adress (P1)"
                >
                  <RotateCcw size={14} />
                </button>
              </div>

              {/* Speed Toggles */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {[0.05, 0.1, 0.25, 0.5, 1.0].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`px-2 py-0.5 rounded-lg text-xs font-bold transition ${
                      playbackSpeed === spd ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* P1-P10 Phase Scrubbing Strip */}
          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl shadow-lg">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>{isSv ? 'P-Positioner (Klicka för att hoppa)' : 'P-Positions (Click to inspect)'}</span>
              <span className="text-emerald-400 font-mono text-[10px]">10 FASER DETEKTERADE</span>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
              {ORDERED_SWING_PHASES.map((phaseId) => {
                const info = SWING_PHASE_INFO[phaseId];
                const phaseEvent = analysis?.phases[phaseId];
                const isActive = activePhase === phaseId;
                const frameIdx = phaseEvent ? phaseEvent.frameIndex : 0;

                return (
                  <button
                    key={phaseId}
                    onClick={() => handleJumpToPhase(phaseId)}
                    className={`flex flex-col items-center justify-center p-1.5 rounded-xl border text-center transition active:scale-95 ${
                      isActive
                        ? 'bg-gradient-to-b from-emerald-600 to-teal-700 border-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                        : 'bg-slate-950/80 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="font-black text-xs font-mono">{info.id}</span>
                    <span className="text-[9px] font-semibold truncate w-full">
                      {info.name[language]}
                    </span>
                    <span className="text-[8px] font-mono text-slate-400 mt-0.5">
                      f.{frameIdx}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Kinematics, Tempo, Faults & Body Correlation (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Kinematics Live Deck */}
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-blue-400" />
                <h3 className="text-sm font-bold text-white">
                  {isSv ? 'Biomekanik i Bildruta' : 'Frame Kinematics'}
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {activePhase ? `${activePhase}` : `Frame ${activeIntFrame}`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* X-Factor */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 flex flex-col">
                <span className="text-[11px] text-slate-400 font-medium">X-Factor (Torsion)</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-black text-emerald-400 font-mono">
                    {currentKinematics ? `${currentKinematics.xFactor}°` : '--'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {currentKinematics && currentKinematics.xFactor > 40 ? 'Hög spänning' : 'Normal'}
                  </span>
                </div>
              </div>

              {/* Shoulder Turn */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 flex flex-col">
                <span className="text-[11px] text-slate-400 font-medium">
                  {isSv ? 'Axelvridning' : 'Shoulder Turn'}
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-black text-amber-400 font-mono">
                    {currentKinematics ? `${currentKinematics.shoulderTurn}°` : '--'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {currentKinematics && currentKinematics.shoulderTurn >= 90 ? 'Full vridning' : ''}
                  </span>
                </div>
              </div>

              {/* Pelvis Turn */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 flex flex-col">
                <span className="text-[11px] text-slate-400 font-medium">
                  {isSv ? 'Bäckenvridning' : 'Pelvis Turn'}
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-black text-cyan-400 font-mono">
                    {currentKinematics ? `${currentKinematics.pelvisTurn}°` : '--'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {currentKinematics && currentKinematics.pelvisTurn <= 45 ? 'Stabilt' : ''}
                  </span>
                </div>
              </div>

              {/* Spine Angle */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 flex flex-col">
                <span className="text-[11px] text-slate-400 font-medium">
                  {isSv ? 'Ryggradslutning' : 'Spine Tilt'}
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-black text-purple-400 font-mono">
                    {currentKinematics ? `${currentKinematics.spineInclination}°` : '--'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Δ {currentKinematics?.spineAngleDelta ?? 0}°
                  </span>
                </div>
              </div>

              {/* 3D Head Orientation & Dip */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 flex flex-col">
                <span className="text-[11px] text-slate-400 font-medium">
                  {isSv ? 'Huvud: Vridning / Svaj' : 'Head: Turn / Sway'}
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-black text-rose-400 font-mono">
                    {currentKinematics ? `${currentKinematics.headRotationDeg ?? 0}°` : '--'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {currentKinematics ? `Svaj ${currentKinematics.lateralHeadSway}% | Dip ${currentKinematics.headVerticalDip ?? 0}%` : ''}
                  </span>
                </div>
              </div>

              {/* Knee Kinematics & Pelvis Slide */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 flex flex-col">
                <span className="text-[11px] text-slate-400 font-medium">
                  {isSv ? 'Knän (Främre / Bakre)' : 'Knees (Lead / Trail)'}
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-black text-teal-400 font-mono">
                    {currentKinematics ? `${currentKinematics.leadKneeFlexionDeg ?? 160}°` : '--'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {currentKinematics ? `/ ${currentKinematics.trailKneeFlexionDeg ?? 160}° (Slide ${currentKinematics.lateralPelvisShift}%)` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Swing Tempo 3:1 card */}
            {analysis && (
              <div className="mt-3 bg-gradient-to-r from-slate-950 to-slate-900 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-400 font-semibold">
                    {isSv ? 'Svingtempo (PGA Standard 3:1)' : 'Swing Tempo (Tour 3:1)'}
                  </div>
                  <div className="text-base font-black text-white flex items-center gap-2 mt-0.5">
                    <span className="text-emerald-400">{analysis.tempo.tempoRatio}:1</span>
                    <span className="text-xs font-normal text-slate-400 font-mono">
                      ({Math.round(analysis.tempo.backswingDurationMs)} ms / {Math.round(analysis.tempo.downswingDurationMs)} ms)
                    </span>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    analysis.tempo.rating === 'EXCELLENT' || analysis.tempo.rating === 'GOOD'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {analysis.tempo.rating}
                </span>
              </div>
            )}
          </div>

          {/* Faults Detected */}
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  {isSv ? 'Tekniska Svingfel' : 'Detected Swing Faults'}
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">
                {analysis?.faults.length || 0} {isSv ? 'funna' : 'found'}
              </span>
            </div>

            {analysis?.faults && analysis.faults.length > 0 ? (
              <div className="flex flex-col gap-2">
                {analysis.faults.map((fault) => (
                  <div
                    key={fault.id}
                    className="bg-slate-950 p-2.5 rounded-xl border border-amber-500/30 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300">
                        {fault.name[language]}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                          {fault.phaseDetected}
                        </span>
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                            fault.severity === 'HIGH'
                              ? 'bg-rose-600 text-white'
                              : 'bg-amber-600 text-white'
                          }`}
                        >
                          {fault.severity}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      {fault.description[language]}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-950 p-3 rounded-xl border border-emerald-500/20 text-center flex items-center justify-center gap-2 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 size={16} />
                <span>{isSv ? 'Inga allvarliga svingfel funna – utmärkt biomekanik!' : 'Clean swing mechanics detected!'}</span>
              </div>
            )}
          </div>

          {/* Root-Cause Body-to-Swing Correlation Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-purple-500/30 p-4 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                <h3 className="text-sm font-bold text-purple-200">
                  {isSv ? 'Kroppskoppling (Rotorsak)' : 'Body-to-Swing Correlation'}
                </h3>
              </div>
              <span className="text-[10px] font-mono bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/40">
                Golf Body OS AI
              </span>
            </div>

            {analysis?.correlations && analysis.correlations.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {analysis.correlations.map((corr, idx) => (
                  <div
                    key={idx}
                    className="bg-purple-950/30 border border-purple-500/30 p-3 rounded-xl flex flex-col gap-1.5"
                  >
                    <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                      <Dumbbell size={13} className="text-purple-400" />
                      <span>{corr.title[language]}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {corr.explanation[language]}
                    </p>
                    <div className="bg-slate-900/90 p-2 rounded-lg border border-purple-500/20 mt-1">
                      <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">
                        {isSv ? 'Fysioterapeutisk ordination:' : 'Prescription:'}
                      </div>
                      <div className="text-[11px] text-slate-300 mt-0.5">
                        {corr.prescription[language]}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2 text-center p-3 bg-slate-950 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-400">
                  {isSv
                    ? 'Kör kroppsscreeningen för att få personliga analyser om varför eventuella svingfel uppstår.'
                    : 'Complete the body screening to unlock root-cause correlations between your joints and swing faults.'}
                </p>
                <div className="flex items-center justify-center gap-2 mt-1">
                  {onNavigateToScreening && (
                    <button
                      onClick={onNavigateToScreening}
                      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow"
                    >
                      <Dumbbell size={13} />
                      <span>{isSv ? 'Gör Screening Nu' : 'Start Screening'}</span>
                    </button>
                  )}
                  <button
                    onClick={() => setUseSampleScreening((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                      useSampleScreening
                        ? 'bg-purple-600 border-purple-400 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    {useSampleScreening
                      ? (isSv ? 'Visar Exempelscreening' : 'Sample Screening Active')
                      : (isSv ? 'Testa med Exempelscreening' : 'Preview with Sample')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
