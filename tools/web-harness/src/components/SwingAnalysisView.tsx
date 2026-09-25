import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, Activity, AlertTriangle, Compass, Target, Film, Clock, Zap, RefreshCw, CheckCircle2, ShieldAlert, Palette } from 'lucide-react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

import { CameraViewAngle, GolfSwingAnalysisResult, ORDERED_SWING_PHASES, SWING_PHASE_INFO, SwingKinematics, BodySwingCorrelation, SwingPhaseId } from '../../../../src/core/types/golf-swing';
import { GolfSwingPhaseEngine, NoSwingDetectedError } from '../../../../src/core/motion/phases/golf-swing-phase-engine';
import { BodySwingCorrelator } from '../../../../src/core/correlation/body-swing-correlator';
import { PoseFrame } from '../../../../src/core/types/pose-frame';
import { Landmark, LandmarkId } from '../../../../src/core/types/landmark';
import { extractPhaseKinematics } from '../../../../src/core/metrics/golf-swing-metrics';
import { sanitizeGolfPoseFrame } from '../../../../src/core/motion/filters/anatomical-filter';
import { Mp4Inspector, VideoMetadata } from '../../../../src/core/video/mp4-inspector';
import { createVideoModeClock } from '../../../../src/core/pose/video-mode-clock';
import { evaluateVideoQuality, QualityCheckResult } from '../../../../src/core/quality';
import { smoothPoseSequence } from '../../../../src/core/motion/filters/pose-smoother';
import {
  renderSkeletonCanvas,
  DEFAULT_SKELETON_THEME,
  CYAN_SKELETON_THEME,
} from '../../../../src/core/visualization';

export interface SwingAnalysisViewProps {
  currentBodyScore: any | null;
  language: string;
  onNavigateToScreening?: () => void;
}

export default function SwingAnalysisView({ currentBodyScore, language, onNavigateToScreening }: SwingAnalysisViewProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  
  // Analytics State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [scanStage, setScanStage] = useState<string>('');
  const [frames, setFrames] = useState<PoseFrame[]>([]);
  const [enableSmoothing, setEnableSmoothing] = useState<boolean>(true);
  const [activeFrame, setActiveFrame] = useState<PoseFrame | null>(null);
  const [analysisResult, setAnalysisResult] = useState<GolfSwingAnalysisResult | null>(null);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [qualityResult, setQualityResult] = useState<QualityCheckResult | null>(null);
  const [correlations, setCorrelations] = useState<BodySwingCorrelation[]>([]);
  const [viewAngle, setViewAngle] = useState<CameraViewAngle>('FACE_ON');
  const [handednessMode, setHandednessMode] = useState<'AUTO' | 'RIGHT' | 'LEFT'>('AUTO');
  const [skeletonThemeMode, setSkeletonThemeMode] = useState<'BILATERAL' | 'CYAN'>('BILATERAL');
  const skeletonThemeModeRef = useRef(skeletonThemeMode);

  // Velocity-Adaptive EMA Smoothing
  const activeSequence = useMemo(() => {
    if (!enableSmoothing || frames.length <= 1) return frames;
    return smoothPoseSequence(frames);
  }, [frames, enableSmoothing]);

  // Video Track & Slow-Motion Settings
  const [videoMeta, setVideoMeta] = useState<VideoMetadata | null>(null);
  const [scanMode, setScanMode] = useState<'SMART_ADAPTIVE' | 'NATIVE' | 'FPS_60' | 'FPS_30'>('SMART_ADAPTIVE');
  const [slowMoOverride, setSlowMoOverride] = useState<'AUTO' | 'NORMAL' | 'SLOW_4X' | 'SLOW_8X'>('AUTO');

  const effectiveSlowMoFactor = slowMoOverride === 'AUTO'
    ? (analysisResult?.slowMotionFactor ?? videoMeta?.slowMotionFactor ?? 1)
    : slowMoOverride === 'SLOW_4X'
    ? 4
    : slowMoOverride === 'SLOW_8X'
    ? 8
    : 1;

  const passedSlowMoFactor = slowMoOverride === 'AUTO'
    ? (videoMeta?.slowMotionFactor ?? 1)
    : effectiveSlowMoFactor;

  const effectiveIsRightHanded = handednessMode === 'AUTO'
    ? (analysisResult?.isRightHanded ?? true)
    : (handednessMode === 'RIGHT');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const videoClockRef = useRef<(mediaTimestampMs: number) => number>(createVideoModeClock());
  const requestRef = useRef<number | null>(null);

  const isSv = language === 'sv-SE';
  const langKey: 'sv-SE' | 'en-US' = isSv ? 'sv-SE' : 'en-US';

  // 1. Ladda MediaPipe modellen en gång vid start
  useEffect(() => {
    let isMounted = true;
    const initModel = async () => {
      setIsModelLoading(true);
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
        );
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/pose_landmarker_full.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        if (isMounted) {
          poseLandmarkerRef.current = landmarker;
          // One clock per landmarker: the dense pass and later videos re-scan
          // earlier media times, which VIDEO mode would otherwise reject.
          videoClockRef.current = createVideoModeClock();
          setIsModelLoading(false);
        }
      } catch (err) {
        console.error('Failed to load MediaPipe model:', err);
        if (isMounted) {
          setModelError(String(err));
          setIsModelLoading(false);
        }
      }
    };
    initModel();
    return () => {
      isMounted = false;
      if (poseLandmarkerRef.current) poseLandmarkerRef.current.close();
    };
  }, []);

  const runScan = async (url: string, meta: VideoMetadata | null, currentScanMode = scanMode) => {
    if (!poseLandmarkerRef.current) return;
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setFrames([]);
    setAnalysisResult(null);
    setDetectionError(null);
    setCorrelations([]);

    const scanVideo = document.createElement('video');
    scanVideo.src = url;
    scanVideo.muted = true;
    scanVideo.playsInline = true;
    scanVideo.crossOrigin = 'anonymous';
    scanVideo.load();

    await new Promise<void>((resolve) => {
      if (scanVideo.readyState >= 1) {
        resolve();
      } else {
        scanVideo.onloadedmetadata = () => resolve();
      }
    });

    const duration = scanVideo.duration || 2.0;

    const extractPoseAt = async (timeSec: number, frameId: number): Promise<PoseFrame | null> => {
      scanVideo.currentTime = timeSec;
      await new Promise<void>(res => { 
        let timeout = setTimeout(() => res(), 500);
        scanVideo.onseeked = () => {
          clearTimeout(timeout);
          res();
        }; 
      });

      try {
        const result = poseLandmarkerRef.current!.detectForVideo(scanVideo, videoClockRef.current(timeSec * 1000));
        if (result.landmarks && result.landmarks[0]) {
          const lms: Landmark[] = result.landmarks[0].map((lm, idx) => ({
            id: idx as LandmarkId,
            x: lm.x, y: lm.y, z: lm.z ?? 0, visibility: lm.visibility ?? 1
          }));

          const rawFrame: PoseFrame = {
            frameId,
            timestampMs: timeSec * 1000,
            width: scanVideo.videoWidth || 1080,
            height: scanVideo.videoHeight || 1920,
            landmarks: lms,
            model: 'MVP_VIDEO_SEEK',
            modelVersion: '2.1'
          };

          return sanitizeGolfPoseFrame(rawFrame);
        }
      } catch (err) {
        console.warn("Frame detection failed at time", timeSec, err);
      }
      return null;
    };

    let extractedFrames: PoseFrame[] = [];

    if (currentScanMode === 'SMART_ADAPTIVE') {
      // PASS 1: Quick 30 fps scan across whole video (0% - 60% progress)
      setScanStage(isSv ? 'Steg 1/2: Snabb översikt (30 fps)...' : 'Pass 1/2: Fast overview (30 fps)...');
      const coarseFps = 30;
      const coarseTotal = Math.floor(duration * coarseFps);
      const coarseStep = duration / Math.max(1, coarseTotal);
      const pass1Frames: PoseFrame[] = [];

      for (let i = 0; i <= coarseTotal; i++) {
        const time = i * coarseStep;
        const frame = await extractPoseAt(time, i);
        if (frame) pass1Frames.push(frame);
        setAnalysisProgress(Math.round((i / coarseTotal) * 60));
      }

      // Try preliminary phase detection to locate downswing
      let downswingStartSec = 0;
      let downswingEndSec = 0;

      if (pass1Frames.length >= 15) {
        try {
          const tempEngine = new GolfSwingPhaseEngine({
            viewAngle,
            isRightHanded: handednessMode === 'RIGHT' ? true : (handednessMode === 'LEFT' ? false : true),
            autoDetectHandedness: handednessMode === 'AUTO',
            slowMotionFactor: effectiveSlowMoFactor
          });
          const prelim = tempEngine.analyzeSequence(pass1Frames);
          const topEvt = prelim.phases.P4_TOP;
          const relEvt = prelim.phases.P8_RELEASE;
          if (topEvt && relEvt) {
            downswingStartSec = Math.max(0, (topEvt.timestampMs / 1000) - 0.25);
            downswingEndSec = Math.min(duration, (relEvt.timestampMs / 1000) + 0.35);
          }
        } catch (e) {
          console.warn("Preliminary detection warning:", e);
        }
      }

      // PASS 2: If swing window found, perform dense scan over downswing/impact zone (60% - 100% progress)
      if (downswingEndSec > downswingStartSec) {
        const denseFps = Math.min(240, Math.max(60, meta?.nominalFps || 120));
        setScanStage(isSv ? `Steg 2/2: Kirurgisk Impact-zoom (${denseFps} fps)...` : `Pass 2/2: Dense impact zoom (${denseFps} fps)...`);
        
        const denseDuration = downswingEndSec - downswingStartSec;
        const denseTotal = Math.floor(denseDuration * denseFps);
        const denseStep = denseDuration / Math.max(1, denseTotal);
        const denseFrames: PoseFrame[] = [];

        for (let j = 0; j <= denseTotal; j++) {
          const time = downswingStartSec + j * denseStep;
          const frame = await extractPoseAt(time, pass1Frames.length + j);
          if (frame) denseFrames.push(frame);
          setAnalysisProgress(60 + Math.round((j / Math.max(1, denseTotal)) * 40));
        }

        // Merge: keep pass1 frames strictly outside [downswingStartSec, downswingEndSec]
        const keptPass1 = pass1Frames.filter(
          f => f.timestampMs < downswingStartSec * 1000 || f.timestampMs > downswingEndSec * 1000
        );
        const merged = [...keptPass1, ...denseFrames].sort((a, b) => a.timestampMs - b.timestampMs);
        merged.forEach((f, idx) => { f.frameId = idx; });
        extractedFrames = merged;
      } else {
        extractedFrames = pass1Frames;
      }
    } else {
      // Uniform scan mode: NATIVE, FPS_60, or FPS_30
      let fps = 30;
      if (currentScanMode === 'FPS_60') fps = 60;
      else if (currentScanMode === 'NATIVE') fps = Math.min(240, Math.max(30, meta?.nominalFps || 60));

      setScanStage(isSv ? `Skannar i ${fps} fps...` : `Scanning at ${fps} fps...`);
      const totalFrames = Math.floor(duration * fps);
      const step = duration / Math.max(1, totalFrames);

      for (let i = 0; i <= totalFrames; i++) {
        const time = i * step;
        const frame = await extractPoseAt(time, i);
        if (frame) extractedFrames.push(frame);
        setAnalysisProgress(Math.round((i / Math.max(1, totalFrames)) * 100));
      }
    }

    setFrames(extractedFrames);
    setIsAnalyzing(false);
    setScanStage('');
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !poseLandmarkerRef.current) return;

    // Inspect MP4 header for FPS, slow-mo, frame count
    let meta: VideoMetadata | null = null;
    try {
      const slice = file.slice(0, Math.min(file.size, 4 * 1024 * 1024));
      const buf = await slice.arrayBuffer();
      meta = Mp4Inspector.inspectBuffer(buf);
      if (!meta && file.size > 4 * 1024 * 1024) {
        const endSlice = file.slice(file.size - 4 * 1024 * 1024);
        const endBuf = await endSlice.arrayBuffer();
        meta = Mp4Inspector.inspectBuffer(endBuf);
      }
    } catch (err) {
      console.warn("Could not parse MP4 header:", err);
    }

    setVideoMeta(meta);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);

    await runScan(url, meta);
  };

  // KÖR ANALYSEN REAKTIVT: Om användaren byter till Leftie eller DTL, räkna om P1-P10!
  useEffect(() => {
    if (activeSequence.length === 0) {
      setQualityResult(null);
      setDetectionError(null);
      return;
    }
    try {
      setDetectionError(null);
      // 1. Run Pre-flight Video Quality Gate
      const quality = evaluateVideoQuality(activeSequence, videoMeta ? {
        durationSec: videoMeta.durationSec,
        width: videoMeta.width,
        height: videoMeta.height,
        nominalFps: videoMeta.nominalFps,
        isSlowMotion: videoMeta.isSlowMotion,
        slowMotionFactor: passedSlowMoFactor
      } : undefined);
      setQualityResult(quality);

      const isForcedRight = handednessMode === 'RIGHT';
      const isForcedLeft = handednessMode === 'LEFT';
      const shouldAutoDetect = handednessMode === 'AUTO';

      const engine = new GolfSwingPhaseEngine({
        viewAngle,
        isRightHanded: isForcedRight ? true : (isForcedLeft ? false : true),
        autoDetectHandedness: shouldAutoDetect,
        slowMotionFactor: passedSlowMoFactor
      });
      const analysis = engine.analyzeSequence(activeSequence);
      setAnalysisResult(analysis);
      setDetectionError(null);

      // CORRELATE: Knyt ihop Swing Faults med Body Screening
      const detectedCorrelations = BodySwingCorrelator.correlate(currentBodyScore, analysis);
      setCorrelations(detectedCorrelations);
    } catch (err: any) {
      console.warn("Could not analyze phases:", err);
      setAnalysisResult(null);
      setCorrelations([]);
      if (err instanceof NoSwingDetectedError || err?.code === 'NO_SWING_DETECTED') {
        setDetectionError(
          isSv
            ? 'Ingen fullständig golfsving kunde identifieras i videon. Kontrollera att hela rörelsen (adress till finish) och hela kroppen är synliga.'
            : 'No complete golf swing could be detected in the video. Ensure the full motion (address to finish) and whole body are clearly visible.'
        );
      } else {
        setDetectionError(err?.message || (isSv ? 'Ett fel uppstod vid svinganalysen.' : 'An error occurred during swing analysis.'));
      }
    }
  }, [activeSequence, viewAngle, handednessMode, currentBodyScore, language, passedSlowMoFactor, videoMeta, isSv]);

  // 3. Ritfunktion för skelettet (Bilateral färgkodning & konfidens-opacitet)
  const drawSkeleton = (ctx: CanvasRenderingContext2D, frame: PoseFrame, width: number, height: number) => {
    const activeTheme = skeletonThemeModeRef.current === 'BILATERAL' ? DEFAULT_SKELETON_THEME : CYAN_SKELETON_THEME;
    renderSkeletonCanvas(ctx, frame.landmarks, width, height, {
      theme: activeTheme,
      minVisibilityThreshold: 0.20,
      clearFirst: true,
    });
  };

  // 4. Uppspelningsloop (Hitta rätt frame baserat på video.currentTime)
  const renderLoop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && activeSequence.length > 0 && video.videoWidth > 0) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const timeMs = video.currentTime * 1000;
      
      // Hitta den pre-scannade bildruta som är närmast videons aktuella tid
      let closest = activeSequence[0];
      let minDiff = Infinity;
      for (let i = 0; i < activeSequence.length; i++) {
        const frameCandidate = activeSequence[i];
        if (!frameCandidate) continue;
        const diff = Math.abs(frameCandidate.timestampMs - timeMs);
        if (diff < minDiff) { 
          minDiff = diff; 
          closest = frameCandidate; 
        }
      }

      if (closest) {
        setActiveFrame(closest);

        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawSkeleton(ctx, closest, canvas.width, canvas.height);
        }
      }
    }

    requestRef.current = requestAnimationFrame(renderLoop);
  };

  useEffect(() => {
    if (activeSequence.length > 0) {
      requestRef.current = requestAnimationFrame(renderLoop);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [activeSequence]); // Starta uppspelning när skanning är klar

  // Direkt omritning vid växling av skelettfärgtema (även i pausat läge)
  useEffect(() => {
    skeletonThemeModeRef.current = skeletonThemeMode;
    if (activeFrame && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        drawSkeleton(ctx, activeFrame, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, [skeletonThemeMode, activeFrame]);

  // 5. Live Biomekanik-beräkning baserat på aktuell bildruta
  const currentKinematics = useMemo<SwingKinematics | null>(() => {
    if (!activeFrame || activeSequence.length === 0) return null;
    const addressFrame = analysisResult?.phases['P1_ADDRESS'] 
      ? activeSequence.find(f => f.frameId === analysisResult.phases['P1_ADDRESS']!.frameIndex) || activeSequence[0]
      : activeSequence[0];
    
    // Fastställ närmaste svingfas baserat på aktuell bildrutas tidsstämpel
    let activePhaseId: SwingPhaseId = 'P1_ADDRESS';
    if (analysisResult) {
      let minDiff = Infinity;
      for (const phaseId of ORDERED_SWING_PHASES) {
        const ev = analysisResult.phases[phaseId];
        if (ev) {
          const diff = Math.abs(ev.timestampMs - activeFrame.timestampMs);
          if (diff < minDiff) {
            minDiff = diff;
            activePhaseId = phaseId;
          }
        }
      }
    }
    
    return addressFrame ? extractPhaseKinematics(activeFrame, activePhaseId, addressFrame, viewAngle, effectiveIsRightHanded) : null;
  }, [activeFrame, activeSequence, analysisResult, viewAngle, effectiveIsRightHanded]);


  return (
    <div className="flex flex-col gap-5 text-white">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black text-xl shadow-lg">
            <Activity size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight">
              {isSv ? 'Golf Body OS (Video Analytics MVP)' : 'Golf Body OS (Analytics MVP)'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isSv ? 'Automatisk P1-P10 Fas-detektering & Live Biomekanik.' : 'Auto P1-P10 Phase Detection & Live Biomechanics.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Kamera / Spelare inställningar */}
          <select 
            value={viewAngle}
            onChange={(e) => setViewAngle(e.target.value as CameraViewAngle)}
            className="bg-slate-950 border border-slate-700 text-xs font-bold rounded-lg px-2 py-2"
          >
            <option value="FACE_ON">Face-On</option>
            <option value="DOWN_THE_LINE">Down-The-Line</option>
          </select>
          
          <div className="flex bg-slate-950 border border-slate-700 rounded-lg p-0.5 text-xs font-bold">
            <button 
              onClick={() => setHandednessMode('AUTO')}
              className={`px-2.5 py-1.5 rounded-md transition ${handednessMode === 'AUTO' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              title={isSv ? 'Automatisk detektering av svingriktning' : 'Auto-detect swing handedness'}
            >
              Auto {analysisResult ? (analysisResult.isRightHanded ? '(RH)' : '(LH)') : ''}
            </button>
            <button 
              onClick={() => setHandednessMode('RIGHT')}
              className={`px-2.5 py-1.5 rounded-md transition ${handednessMode === 'RIGHT' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              title={isSv ? 'Tvinga högerspelare' : 'Force right-handed'}
            >
              {isSv ? 'Höger' : 'Right'}
            </button>
            <button 
              onClick={() => setHandednessMode('LEFT')}
              className={`px-2.5 py-1.5 rounded-md transition ${handednessMode === 'LEFT' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              title={isSv ? 'Tvinga vänsterspelare' : 'Force left-handed'}
            >
              {isSv ? 'Vänster' : 'Left'}
            </button>
          </div>

          <label className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white px-4 py-2 rounded-xl font-bold text-xs transition cursor-pointer shadow-md">
            <Upload size={16} />
            <span>{isSv ? 'Välj Video' : 'Upload Video'}</span>
            <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Progress Bar (Visible during scan) */}
      {isAnalyzing && (
        <div className="bg-slate-900 border border-blue-500 p-4 rounded-2xl flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center animate-spin text-sm">
              ⚙️
            </div>
            <div>
              <div className="font-bold text-sm">
                {isSv ? 'Skannar svingsekvens...' : 'Scanning swing sequence...'}
              </div>
              {scanStage && (
                <div className="text-xs text-blue-400 font-semibold mt-0.5">
                  {scanStage}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-black text-blue-400">{analysisProgress}%</span>
            <div className="w-32 bg-slate-950 rounded-full h-2 overflow-hidden">
              <div className="bg-blue-500 h-full transition-all" style={{ width: `${analysisProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Video Track Info & Mode Controls Banner */}
      {videoUrl && (
        <div className="bg-slate-900/90 border border-slate-800 px-4 py-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-center flex-wrap gap-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-200">
              <Film size={15} className="text-blue-400" />
              <span>{isSv ? 'Video:' : 'Video:'}</span>
            </div>

            {videoMeta ? (
              <>
                <span className="px-2 py-0.5 rounded-md bg-blue-950 border border-blue-600/50 text-blue-300 font-mono font-black">
                  {videoMeta.nominalFps} FPS
                </span>
                <span className="text-slate-400 font-mono">
                  {videoMeta.totalFrames} {isSv ? 'rutor' : 'frames'} • {videoMeta.durationSec.toFixed(1)}s
                </span>
                {(videoMeta.isSlowMotion || effectiveSlowMoFactor > 1) && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-950/80 border border-amber-500/60 text-amber-300 font-bold flex items-center gap-1">
                    <span>🐌 Slow-Motion ({effectiveSlowMoFactor}x)</span>
                  </span>
                )}
              </>
            ) : (
              <span className="text-slate-400 font-mono">
                {effectiveSlowMoFactor > 1 ? `Standard MP4 (Slow-Mo ${effectiveSlowMoFactor}x)` : 'Standard MP4'}
              </span>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-3">
            {/* Scan Mode selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-semibold">{isSv ? 'Skanning:' : 'Scan:'}</span>
              <select
                value={scanMode}
                onChange={(e) => setScanMode(e.target.value as any)}
                className="bg-slate-950 border border-slate-700 text-xs font-bold rounded-lg px-2 py-1.5 text-slate-200 focus:border-blue-500 outline-none"
              >
                <option value="SMART_ADAPTIVE">{isSv ? '⚡ Smart Adaptiv (Grov + Tät Impact)' : '⚡ Smart Adaptive (Coarse + Dense Impact)'}</option>
                <option value="NATIVE">{isSv ? `Native (${videoMeta ? videoMeta.nominalFps : 'Auto'} FPS)` : `Native (${videoMeta ? videoMeta.nominalFps : 'Auto'} FPS)`}</option>
                <option value="FPS_60">60 FPS</option>
                <option value="FPS_30">{isSv ? '30 FPS (Snabb)' : '30 FPS (Fast)'}</option>
              </select>
            </div>

            {/* Slow-mo normalizer selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-semibold">{isSv ? 'Tempo-skala:' : 'Tempo Scale:'}</span>
              <select
                value={slowMoOverride}
                onChange={(e) => setSlowMoOverride(e.target.value as any)}
                className="bg-slate-950 border border-slate-700 text-xs font-bold rounded-lg px-2 py-1.5 text-slate-200 focus:border-blue-500 outline-none"
              >
                <option value="AUTO">{isSv ? `Auto (${effectiveSlowMoFactor}x)` : `Auto (${effectiveSlowMoFactor}x)`}</option>
                <option value="NORMAL">{isSv ? 'Realtid (1x)' : 'Real-Time (1x)'}</option>
                <option value="SLOW_4X">{isSv ? 'Slow-Mo 4x (120fps)' : 'Slow-Mo 4x (120fps)'}</option>
                <option value="SLOW_8X">{isSv ? 'Slow-Mo 8x (240fps)' : 'Slow-Mo 8x (240fps)'}</option>
              </select>
            </div>

            {/* Adaptive Smoothing toggle button */}
            <button
              onClick={() => setEnableSmoothing((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold text-xs transition cursor-pointer ${
                enableSmoothing
                  ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
              title={isSv ? 'Koppla till/från hastighetsadaptiv EMA-glättare' : 'Toggle velocity-adaptive EMA smoother'}
            >
              <Activity size={12} />
              <span>{isSv ? (enableSmoothing ? 'EMA: På' : 'EMA: Av') : (enableSmoothing ? 'EMA: On' : 'EMA: Off')}</span>
            </button>

            {/* Skeleton Theme toggle */}
            <button
              onClick={() => setSkeletonThemeMode((prev) => (prev === 'BILATERAL' ? 'CYAN' : 'BILATERAL'))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold text-xs transition cursor-pointer ${
                skeletonThemeMode === 'BILATERAL'
                  ? 'bg-blue-950/80 border-blue-500/50 text-blue-300'
                  : 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
              }`}
              title={isSv ? 'Växla mellan bilateralt färgkodat skelett och cyan neon' : 'Toggle between bilateral color-coded skeleton and cyan neon'}
            >
              <Palette size={12} />
              <span>
                {skeletonThemeMode === 'BILATERAL'
                  ? (isSv ? 'Skelett: Bilateralt' : 'Skeleton: Bilateral')
                  : (isSv ? 'Skelett: Cyan' : 'Skeleton: Cyan')}
              </span>
            </button>

            {/* Rescan button */}
            {!isAnalyzing && (
              <button
                onClick={() => runScan(videoUrl, videoMeta, scanMode)}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 font-bold rounded-lg border border-blue-500/50 transition cursor-pointer"
                title={isSv ? 'Skanna om videon med valt läge' : 'Rescan video with selected mode'}
              >
                <RefreshCw size={12} />
                <span>{isSv ? 'Skanna om' : 'Rescan'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Video Quality Gate Banner */}
      {qualityResult && (
        <div className={`px-4 py-3 rounded-2xl border text-xs shadow-md transition-all ${
          qualityResult.overallStatus === 'PASS'
            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
            : qualityResult.overallStatus === 'WARNING'
            ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
            : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold">
              {qualityResult.overallStatus === 'PASS' ? (
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              ) : qualityResult.overallStatus === 'WARNING' ? (
                <AlertTriangle size={16} className="text-amber-400 shrink-0" />
              ) : (
                <ShieldAlert size={16} className="text-rose-400 shrink-0" />
              )}
              <span className="text-sm font-black">
                {qualityResult.overallStatus === 'PASS'
                  ? (isSv ? 'Videokvalitet: Utmärkt' : 'Video Quality: Excellent')
                  : qualityResult.overallStatus === 'WARNING'
                  ? (isSv ? 'Kvalitetskontroll: Godkänd med anmärkning' : 'Quality Check: Acceptable with warnings')
                  : (isSv ? 'Kvalitetskontroll: Otillräcklig videokvalitet' : 'Quality Check: Insufficient Video Quality')}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/40 border border-current">
                {Math.round(qualityResult.confidence * 100)}% {isSv ? 'konfidens' : 'confidence'}
              </span>
            </div>
            <div className="text-[11px] font-medium opacity-90">
              {isSv ? qualityResult.summaryMessageSv : qualityResult.summaryMessageEn}
            </div>
          </div>

          {qualityResult.warnings.length > 0 && (
            <div className="mt-2.5 pt-2.5 border-t border-current/20 flex flex-col gap-1.5">
              {qualityResult.warnings.map((w, idx) => (
                <div key={idx} className="flex items-start gap-1.5 text-[11px] opacity-90">
                  <span className="font-bold">•</span>
                  <span>{isSv ? w.messageSv : w.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detection Error Banner */}
      {detectionError && (
        <div className="px-4 py-3 rounded-2xl border border-rose-500/50 bg-rose-950/40 text-rose-200 text-xs shadow-md transition-all">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm text-rose-300">
                {isSv ? 'Sving kunde inte detekteras' : 'Swing could not be detected'}
              </div>
              <p className="mt-0.5 text-rose-200/90 leading-relaxed text-[11px]">
                {detectionError}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left: Video Player */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl shadow-lg">
            {!videoUrl ? (
              <div className="aspect-[16/9] w-full bg-slate-950 rounded-xl border border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500">
                <Upload size={48} className="mb-4 opacity-50" />
                <p>{isSv ? 'Ladda upp en video för analys' : 'Upload a video to analyze'}</p>
              </div>
            ) : (
              <div className="relative w-full rounded-xl overflow-hidden bg-black shadow-inner border border-slate-800 flex items-center justify-center">
                <video 
                  ref={videoRef} 
                  src={videoUrl} 
                  controls 
                  className="w-full h-auto max-h-[60vh] object-contain"
                  crossOrigin="anonymous" 
                  playsInline
                />
                <canvas 
                  ref={canvasRef} 
                  className="absolute inset-0 w-full h-full pointer-events-none object-contain" 
                />
              </div>
            )}
          </div>

          {/* Timeline / P-Phases Strip */}
          {analysisResult && (
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl shadow-lg">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                {isSv ? 'Sving-faser (Detekterade)' : 'Detected Swing Phases'}
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                {ORDERED_SWING_PHASES.map((phaseId) => {
                  const info = SWING_PHASE_INFO[phaseId];
                  const phaseEvent = analysisResult.phases[phaseId];
                  const timeSec = (phaseEvent && frames[phaseEvent.frameIndex]) 
                    ? frames[phaseEvent.frameIndex].timestampMs / 1000 
                    : 0;
                  const isCurrent = currentKinematics?.phaseId === phaseId;
                  
                  return (
                    <button
                      key={phaseId}
                      disabled={!phaseEvent}
                      onClick={() => {
                        if (videoRef.current && phaseEvent) {
                          videoRef.current.currentTime = timeSec;
                        }
                      }}
                      className={`flex flex-col items-center justify-center p-1.5 rounded-xl border text-center transition ${
                        isCurrent
                          ? 'bg-blue-600 border-blue-400 text-white shadow-lg ring-2 ring-blue-400/60 scale-105 z-10 cursor-pointer'
                          : phaseEvent?.status === 'DETECTED_PROXY'
                          ? 'bg-amber-950/40 border-amber-500/40 hover:bg-amber-800/60 text-amber-300 cursor-pointer'
                          : phaseEvent
                          ? 'bg-emerald-950/40 border-emerald-500/40 hover:bg-emerald-800/60 text-emerald-300 cursor-pointer'
                          : 'bg-slate-950 border-slate-800 text-slate-600 opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-0.5">
                        <span className="font-black text-xs font-mono">{info.id}</span>
                        {phaseEvent?.status === 'DETECTED_PROXY' && (
                          <span className="text-[9px] text-amber-400" title={isSv ? 'Rörelseproxy (utan klubbsignal)' : 'Motion proxy (no club signal)'}>⚡</span>
                        )}
                      </div>
                      <span className="text-[8px] font-semibold truncate w-full mt-0.5">{info.name[langKey]}</span>
                      {phaseEvent && (
                        <span className="text-[8px] font-mono text-cyan-300 font-bold mt-0.5">{timeSec.toFixed(2)}s</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Live Kinematics Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Compass size={18} className="text-blue-400" />
                <h3 className="text-sm font-bold">{isSv ? 'Biomekanik i Realtid' : 'Live Kinematics'}</h3>
              </div>
              {currentKinematics && (
                <div className="flex items-center gap-1.5">
                  {analysisResult?.phases[currentKinematics.phaseId]?.status === 'DETECTED_PROXY' && (
                    <span 
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-300 border border-amber-500/40 cursor-help"
                      title={isSv ? 'Rörelseproxy: MediaPipe mäter kroppsrörelse, ej klubba/boll' : 'Motion proxy: MediaPipe tracks body motion, not club/ball'}
                    >
                      ⚡ PROXY
                    </span>
                  )}
                  <span className="text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-500/40 shadow-sm">
                    {currentKinematics.phaseId}
                  </span>
                </div>
              )}
            </div>

            {currentKinematics ? (
              <div className="flex flex-col gap-3">
                {/* Shoulders & Pelvis */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{isSv ? 'Axelvridning' : 'Shoulder Turn'}</div>
                    <div className="text-2xl font-black text-amber-400 font-mono mt-1">{currentKinematics.shoulderTurn}°</div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{isSv ? 'Bäckenvridning' : 'Pelvis Turn'}</div>
                    <div className="text-2xl font-black text-cyan-400 font-mono mt-1">{currentKinematics.pelvisTurn}°</div>
                  </div>
                </div>

                {/* X-Factor & Spine */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">X-Factor</div>
                    <div className="text-2xl font-black text-emerald-400 font-mono mt-1">{currentKinematics.xFactor}°</div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{isSv ? 'Ryggradslutning' : 'Spine Tilt'}</div>
                    <div className="text-2xl font-black text-purple-400 font-mono mt-1">{currentKinematics.spineInclination}°</div>
                  </div>
                </div>

                {/* Swing Tempo Block */}
                {analysisResult && (
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5">
                        <Clock size={12} className="text-blue-400" />
                        <span>{isSv ? 'Svingtempo (Ratio)' : 'Swing Tempo (Ratio)'}</span>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        analysisResult.tempo.rating === 'EXCELLENT'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                          : 'bg-blue-950 text-blue-300 border border-blue-500/50'
                      }`}>
                        {analysisResult.tempo.rating}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between mt-1">
                      <div className="text-2xl font-black text-blue-400 font-mono">
                        {analysisResult.tempo.tempoRatio.toFixed(1)} : 1
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {analysisResult.tempo.backswingDurationMs}ms / {analysisResult.tempo.downswingDurationMs}ms
                      </div>
                    </div>

                    {effectiveSlowMoFactor > 1 && (
                      <div className="text-[9px] text-amber-400/90 font-medium mt-1">
                        {isSv ? `* Normaliserad från ${effectiveSlowMoFactor}x slow-motion` : `* Normalized from ${effectiveSlowMoFactor}x slow-motion`}
                      </div>
                    )}
                  </div>
                )}

                {/* Swing Faults Box */}
                {analysisResult && analysisResult.faults.length > 0 && (
                  <div className="mt-4 flex flex-col gap-3">
                    <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40">
                      <div className="flex items-center gap-1.5 text-amber-400 mb-2">
                        <AlertTriangle size={14} />
                        <span className="text-xs font-bold uppercase">{isSv ? 'Svingfel Detekterade' : 'Faults Detected'}</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {analysisResult.faults.map(f => (
                          <div key={f.id} className="text-[11px] text-slate-300">
                            <strong className="text-white block">{f.name[langKey]}</strong>
                            {f.description[langKey]}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ROOT CAUSE ANALYSIS - THE MAGIC */}
                    {correlations.length > 0 ? (
                      <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/50 shadow-lg">
                        <div className="flex items-center gap-2 text-indigo-400 mb-3">
                          <Activity size={16} />
                          <span className="text-xs font-black uppercase tracking-wider">{isSv ? 'Golf Body OS: Orsaksanalys' : 'Root Cause Analysis'}</span>
                        </div>
                        <div className="flex flex-col gap-4">
                          {correlations.map((c, idx) => (
                            <div key={idx} className="bg-slate-900/50 p-3 rounded-lg border border-indigo-500/20">
                              <div className="text-[10px] font-bold text-indigo-300 uppercase mb-1">
                                {c.title[langKey]}
                              </div>
                              <div className="text-[11px] text-slate-300 mb-2">
                                {c.explanation[langKey]}
                              </div>
                              <div className="bg-indigo-900/30 border border-indigo-500/30 p-2 rounded text-[10px] text-indigo-200">
                                <strong>{isSv ? 'Åtgärd: ' : 'Fix: '}</strong>{c.prescription[langKey]}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      currentBodyScore === null && (
                        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/50 text-[11px] text-slate-400">
                          {isSv ? 'Gör en Body Screening för att se varför dessa svingfel uppstår.' : 'Complete a Body Screening to find the root cause of these swing faults.'}
                          <button 
                            onClick={onNavigateToScreening}
                            className="block mt-2 text-emerald-400 font-bold hover:underline"
                          >
                            {isSv ? 'Gå till Screening →' : 'Go to Screening →'}
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}
                
                {/* All clear */}
                {analysisResult && analysisResult.faults.length === 0 && (
                   <div className="mt-4 p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 flex items-center gap-2 text-emerald-400 text-xs font-bold">
                     <Target size={14} />
                     {isSv ? 'Utmärkt sving, inga stora fel.' : 'Excellent swing, no major faults.'}
                   </div>
                )}

              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-xs text-center p-4">
                {isSv ? 'Ladda upp en video för att se biomekanik och kroppsvinklar.' : 'Upload a video to see biomechanics and body angles.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
