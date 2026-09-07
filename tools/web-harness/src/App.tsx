import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { Play, Upload, Camera, RefreshCw } from 'lucide-react';
import { convertWebResultToPoseFrame } from './adapter/web-mediapipe-adapter';
import { TemporalPipeline } from '../../../src/core/motion/temporal-pipeline';
import { PoseFrame, PoseSequence } from '../../../src/core/types/pose-frame';
import { DeviceValidationReport } from '../../../src/validation/device-validation-report';
import { MetricValue } from '../../../src/core/metrics/hip-hinge-metrics';

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
  const [runningDeterminism, setRunningDeterminism] = useState(false);
  
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

  const runPipeline = (frames: PoseSequence): DeviceValidationReport => {
    const pipeline = new TemporalPipeline({
      protocol: harnessProtocol
    });
    const result = pipeline.process(frames);

    return {
      status: result.status,
      device: { model: 'Web Browser', osVersion: navigator.userAgent },
      model: { variant: 'FULL', version: '0.10.14', sha256: modelSha },
      capture: {
        resolution: 'Unknown',
        cameraFps: 30,
        processedFps: 30,
        durationMs: frames.length > 0 ? frames[frames.length - 1].timestampMs - frames[0].timestampMs : 0,
        rawFrameCount: frames.length,
        processedFrameCount: frames.length,
        droppedFrameCount: 0
      },
      inference: { meanLatencyMs: 0, p50LatencyMs: 0, p95LatencyMs: 0, maxLatencyMs: 0 }, // Stub for web
      landmarks: {
        expectedPerPose: 33,
        validPoseFrameCount: frames.length,
        rejectedPoseFrameCount: 0,
        interpolatedGapCount: 0
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

  const processVideoFrame = async (autoQueue: boolean = true) => {
    if (!videoRef.current || !canvasRef.current || !landmarker) return;
    const video = videoRef.current;
    
    const currentMode = modeRef.current;
    if (currentMode === 'IDLE') return;

    const timestampMs = performance.now();
    // Use timestampMs for webcam, video.currentTime for video file to ensure stability
    const timeCheck = currentMode === 'WEBCAM' ? timestampMs : video.currentTime;
    
    if (timeCheck > lastVideoTimeRef.current) {
      lastVideoTimeRef.current = timeCheck;
      
      const result = landmarker.detectForVideo(video, timestampMs);
      
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(video, 0, 0, canvasRef.current.width, canvasRef.current.height);
        
        if (result.landmarks && result.landmarks.length > 0) {
          ctx.fillStyle = 'red';
          for (const lm of result.landmarks[0]) {
            ctx.beginPath();
            ctx.arc(lm.x * canvasRef.current.width, lm.y * canvasRef.current.height, 3, 0, 2 * Math.PI);
            ctx.fill();
          }
        }
      }

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
      }
    }
    
    if (autoQueue) {
      if (currentMode === 'WEBCAM' || (currentMode === 'VIDEO' && !video.paused && !video.ended)) {
        requestRef.current = requestAnimationFrame(() => processVideoFrame(true));
      } else if (currentMode === 'VIDEO' && video.ended) {
        const rep = runPipeline(poseSequenceRef.current);
        setReport(rep);
      }
    }
  };

  const startWebcam = async () => {
    if (!videoRef.current) return;
    poseSequenceRef.current = [];
    frameCountRef.current = 0;
    setReport(null);
    setDeterminismReports(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setMode('WEBCAM');
      modeRef.current = 'WEBCAM';
      processVideoFrame();
    } catch (e) {
      console.error('Webcam error', e);
    }
  };

  const stopWebcam = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    cancelAnimationFrame(requestRef.current);
    setMode('IDLE');
    modeRef.current = 'IDLE';
    if (poseSequenceRef.current.length > 0) {
      setReport(runPipeline(poseSequenceRef.current));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !videoRef.current) return;
    
    stopWebcam();
    setReport(null);
    setDeterminismReports(null);
    poseSequenceRef.current = [];
    frameCountRef.current = 0;
    
    const url = URL.createObjectURL(file);
    videoRef.current.src = url;
    videoRef.current.onloadeddata = async () => {
      setMode('VIDEO');
      modeRef.current = 'VIDEO';
      await videoRef.current!.play();
      processVideoFrame();
    };
  };

  const runDeterminismTest = async () => {
    if (!videoRef.current || !videoRef.current.src) return;
    setRunningDeterminism(true);
    setDeterminismReports(null);
    
    const reports: DeviceValidationReport[] = [];
    
    for (let i = 0; i < 10; i++) {
      poseSequenceRef.current = [];
      frameCountRef.current = 0;
      lastVideoTimeRef.current = -1;
      
      videoRef.current.currentTime = 0;
      await videoRef.current.play();
      
      await new Promise<void>((resolve) => {
        const loop = () => {
          if (videoRef.current!.ended) {
            reports.push(runPipeline(poseSequenceRef.current));
            resolve();
          } else {
            processVideoFrame(false).then(() => requestAnimationFrame(loop));
          }
        };
        requestAnimationFrame(loop);
      });
    }
    
    setDeterminismReports(reports);
    setRunningDeterminism(false);
  };

  if (isInitializing) return <div className="p-8 text-white">Loading MediaPipe Tasks Vision...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">WEB-DV-1A Harness</h1>
        <p className="text-gray-400 mb-8 font-mono text-sm">Model SHA-256: {modelSha}</p>

        <div className="flex gap-4 mb-8">
          {mode === 'WEBCAM' ? (
            <button onClick={stopWebcam} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-semibold">
              Stop Capture & Analyze
            </button>
          ) : (
            <button onClick={startWebcam} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold">
              <Camera size={20} /> Live Webcam
            </button>
          )}

          <div className="relative">
            <input type="file" accept="video/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" ref={fileInputRef} />
            <button className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-semibold">
              <Upload size={20} /> Upload Video
            </button>
          </div>
          
          <button onClick={runDeterminismTest} disabled={mode !== 'VIDEO' || runningDeterminism} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-4 py-2 rounded-lg font-semibold ml-auto">
            <RefreshCw size={20} className={runningDeterminism ? 'animate-spin' : ''} /> 
            {runningDeterminism ? 'Running Determinism (10x)...' : 'Determinism Test (10x)'}
          </button>
        </div>

        <div className="flex gap-8">
          {/* Video Feed */}
          <div className="relative w-[640px] h-[480px] bg-black rounded-xl overflow-hidden shadow-2xl">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-contain hidden" playsInline muted />
            <canvas ref={canvasRef} width={640} height={480} className="absolute inset-0 w-full h-full object-contain" />
          </div>

          {/* Report Panel */}
          <div className="flex-1 bg-gray-800 p-6 rounded-xl overflow-y-auto max-h-[800px]">
            <h2 className="text-xl font-semibold mb-4">Pipeline Report</h2>
            {report ? (
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

                <details className="mt-4">
                  <summary className="cursor-pointer text-blue-400 hover:text-blue-300">Show Full JSON Report</summary>
                  <pre className="mt-2 text-xs font-mono text-gray-300 overflow-x-auto p-4 bg-black rounded-lg">
                    {JSON.stringify(report, null, 2)}
                  </pre>
                </details>
              </div>
            ) : (
              <div className="text-gray-500 text-center py-12">No data yet. Start webcam or upload video.</div>
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
      </div>
    </div>
  );
}
