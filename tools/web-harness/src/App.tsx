/**
 * App.tsx — Tabbed Application Router with LocalStorage.
 *
 * Tabs:
 * 1. HOME (Dagens) - Check-in & Daily Plan
 * 2. ANALYZE (Analys) - Run Screening & Swing Analysis
 * 3. PROFILE (Profil) - View Results & Body Profile
 */

import React, { useEffect, useState } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { Home, Camera, User, AlertCircle, CheckCircle2, ArrowRight, Lock, Globe, ChevronDown, Clock } from 'lucide-react';
import { SupportedLanguage } from '../../../src/core/coaching/i18n/locales';
import { ScreeningResult } from './types/screening';
import { FULL_SCREENING } from './config/screening-plans';

// Screens
import StartScreen from './screens/StartScreen';
import ScreeningFlowScreen from './screens/ScreeningFlowScreen';
import BodyScreen from './screens/BodyScreen';
import TodayScreen from './screens/TodayScreen';
import SwingAnalysisView from './components/SwingAnalysisView';

// Training Engine
import type { BodyProfile } from '../../../src/core/training/types/body-profile';
import type { DailyState } from '../../../src/core/training/types/daily-state';
import type { GolfContext } from '../../../src/core/training/types/golf-context';
import type { DailyPlan } from '../../../src/core/training/types/daily-plan';
import { screeningToProfile } from '../../../src/core/training/adapters/screening-to-profile';
import { buildDailyPlan } from '../../../src/core/training/engine/plan-builder';
import { EXERCISE_LIBRARY } from '../../../src/core/training/data/exercise-library';

type Tab = 'TODAY' | 'ANALYZE' | 'BODY';
type AnalyzeSubScreen = 'IDLE' | 'SCREENING' | 'SWING';
type TodaySubScreen = 'CHECKIN' | 'DAILY_PLAN';

async function computeSha256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// LocalStorage Helpers
// ---------------------------------------------------------------------------
const STORAGE_KEYS = {
  PROFILE: 'gbo_body_profile',
  RESULT: 'gbo_screening_result',
};

function loadFromStorage<T>(key: string): T | null {
  try {
    const data = localStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data, (k, v) => {
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
        return new Date(v);
      }
      return v;
    });
  } catch (e) {
    console.error(`Error loading ${key} from storage`, e);
    return null;
  }
}

function saveToStorage(key: string, data: any) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error saving ${key} to storage`, e);
  }
}

export default function App() {
  // ---------------------------------------------------------------------------
  // MediaPipe initialization
  // ---------------------------------------------------------------------------
  const [landmarker, setLandmarker] = useState<PoseLandmarker | null>(null);
  const [modelSha, setModelSha] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        const resp = await fetch('/pose_landmarker_full.task');
        const blob = await resp.blob();
        const sha = await computeSha256(blob);
        setModelSha(sha);
        const pm = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/pose_landmarker_full.task', delegate: 'GPU' },
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
        setInitError(String(err));
        setIsInitializing(false);
      }
    }
    init();
  }, []);

  // ---------------------------------------------------------------------------
  // App State
  // ---------------------------------------------------------------------------
  const [language, setLanguage] = useState<SupportedLanguage>('en-US');
  const isSv = language === 'sv-SE';

  // Data State
  const [bodyProfile, setBodyProfile] = useState<BodyProfile | null>(() => loadFromStorage(STORAGE_KEYS.PROFILE));
  const [screeningResult, setScreeningResult] = useState<ScreeningResult | null>(() => loadFromStorage(STORAGE_KEYS.RESULT));
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);

  // Navigation State
  const [activeTab, setActiveTab] = useState<Tab>(bodyProfile ? 'TODAY' : 'ANALYZE');
  const [analyzeScreen, setAnalyzeScreen] = useState<AnalyzeSubScreen>('IDLE');
  const [todayScreen, setTodayScreen] = useState<TodaySubScreen>('CHECKIN');

  const isDevMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('dev');

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleScreeningComplete = (result: ScreeningResult) => {
    setScreeningResult(result);
    saveToStorage(STORAGE_KEYS.RESULT, result);

    const mockGolfScore = {
      totalScore: result.totalScore,
      tier: (result.totalScore >= 85 ? 'TOUR_ELITE' : result.totalScore >= 65 ? 'SOLID' : result.totalScore >= 40 ? 'MODERATE' : 'RESTRICTED') as any,
      tierLabel: '', tierColor: '',
      hipHinge: {
        total: result.stepResults.find(s => s.stepId === 'HIP_HINGE')?.pillarScore ?? 25,
        depthScore: 15, kneeScore: 8, spineScore: 5, avgHingeAngle: 95, avgKneeAngle: 155, compensations: [] as string[],
      },
      thoracic: {
        total: result.stepResults.find(s => s.stepId === 'THORACIC_ROTATION')?.pillarScore ?? 25,
        rotationScore: 15, disassociationScore: 8, symmetryScore: 3, dipScore: 3, maxLeft: 35, maxRight: 40, asymmetry: 5, maxPelvicTurn: 12, hasExcessiveDip: false, hasExcessivePelvic: false,
      },
      keyStrengths: result.keyStrengths,
      primaryBottlenecks: result.primaryBottlenecks,
      summary: result.summary,
    };

    for (const step of result.stepResults) {
      if (step.stepId === 'HIP_HINGE' && step.subMetrics) {
        const depthMetric = step.subMetrics.find(m => m.id === 'depthScore');
        const kneeMetric = step.subMetrics.find(m => m.id === 'kneeScore');
        const spineMetric = step.subMetrics.find(m => m.id === 'spineScore');
        if (depthMetric) mockGolfScore.hipHinge.depthScore = depthMetric.value;
        if (kneeMetric) mockGolfScore.hipHinge.kneeScore = kneeMetric.value;
        if (spineMetric) mockGolfScore.hipHinge.spineScore = spineMetric.value;
        const hingeAngle = step.angles?.find(a => a.id === 'avgHingeAngle');
        const kneeAngle = step.angles?.find(a => a.id === 'avgKneeAngle');
        if (hingeAngle) mockGolfScore.hipHinge.avgHingeAngle = hingeAngle.value;
        if (kneeAngle) mockGolfScore.hipHinge.avgKneeAngle = kneeAngle.value;
        if (step.compensations) mockGolfScore.hipHinge.compensations = step.compensations.map(c => c.type);
      }
      if (step.stepId === 'THORACIC_ROTATION' && step.subMetrics) {
        const rotMetric = step.subMetrics.find(m => m.id === 'rotationScore');
        const disMetric = step.subMetrics.find(m => m.id === 'disassociationScore');
        const symMetric = step.subMetrics.find(m => m.id === 'symmetryScore');
        const dipMetric = step.subMetrics.find(m => m.id === 'dipScore');
        if (rotMetric) mockGolfScore.thoracic.rotationScore = rotMetric.value;
        if (disMetric) mockGolfScore.thoracic.disassociationScore = disMetric.value;
        if (symMetric) mockGolfScore.thoracic.symmetryScore = symMetric.value;
        if (dipMetric) mockGolfScore.thoracic.dipScore = dipMetric.value;
        const leftAngle = step.angles?.find(a => a.id === 'maxLeft');
        const rightAngle = step.angles?.find(a => a.id === 'maxRight');
        const asymAngle = step.angles?.find(a => a.id === 'asymmetry');
        const pelvicAngle = step.angles?.find(a => a.id === 'maxPelvicTurn');
        if (leftAngle) mockGolfScore.thoracic.maxLeft = leftAngle.value;
        if (rightAngle) mockGolfScore.thoracic.maxRight = rightAngle.value;
        if (asymAngle) mockGolfScore.thoracic.asymmetry = asymAngle.value;
        if (pelvicAngle) mockGolfScore.thoracic.maxPelvicTurn = pelvicAngle.value;
      }
    }

    const profile = screeningToProfile(mockGolfScore);
    setBodyProfile(profile);
    saveToStorage(STORAGE_KEYS.PROFILE, profile);
    
    setAnalyzeScreen('IDLE');
    setActiveTab('BODY');
  };

  // ---------------------------------------------------------------------------
  // Render Tab Content
  // ---------------------------------------------------------------------------
  const renderTabContent = () => {
    switch (activeTab) {
      case 'TODAY':
        if (!bodyProfile) {
          return (
            <div className="flex-1 overflow-y-auto px-6 text-center pt-16 pb-32 relative">
              
              {/* Huge subtle anatomical map background */}
              <div className="absolute top-0 left-0 w-full h-[600px] pointer-events-none flex items-start justify-center opacity-[0.03]">
                <svg viewBox="0 0 100 200" className="w-[180%] max-w-3xl h-auto -mt-20">
                  <path fill="none" stroke="currentColor" strokeWidth="1" d="M50 20 C56 20 60 25 60 30 C60 36 56 40 50 40 C44 40 40 36 40 30 C40 25 44 20 50 20 Z M30 50 C40 45 60 45 70 50 L80 100 L70 105 L65 70 L65 140 L80 230 L65 240 L50 150 L35 240 L20 230 L35 140 L35 70 L30 105 L20 100 Z" />
                  <circle cx="30" cy="50" r="3" fill="currentColor" />
                  <circle cx="70" cy="50" r="3" fill="currentColor" />
                  <circle cx="35" cy="140" r="3" fill="currentColor" />
                  <circle cx="65" cy="140" r="3" fill="currentColor" />
                  <circle cx="28" cy="185" r="3" fill="currentColor" />
                  <circle cx="72" cy="185" r="3" fill="currentColor" />
                  <line x1="50" y1="40" x2="50" y2="150" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,2" />
                </svg>
              </div>

              <div className="relative z-10 w-full max-w-xs mx-auto flex flex-col items-center">
                
                <h2 className="text-sm font-black text-gray-500 uppercase tracking-[0.2em] mb-4">
                  {isSv ? 'Bygg din Golf Body Profile' : 'Build Your Golf Body Profile'}
                </h2>
                
                <p className="text-gray-300 mb-8 leading-relaxed font-medium">
                  {isSv 
                    ? "En 3-minuters screening hjälper oss förstå hur din kropp rör sig — och vad du bör fokusera på."
                    : "A 3-minute screening helps us understand how your body moves — and what to work on."}
                </p>
                
                <div className="flex items-center gap-3 mb-8">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                    <Camera size={14} />
                    <span>2 tests</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                    <Clock size={14} />
                    <span>~3 min</span>
                  </div>
                </div>

                <button 
                  onClick={() => { setActiveTab('ANALYZE'); setAnalyzeScreen('SCREENING'); }}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-4 rounded-xl font-black text-lg transition shadow-lg shadow-emerald-500/20 mb-3"
                >
                  {isSv ? 'STARTA SCREENING' : 'START SCREENING'}
                  <ArrowRight size={20} />
                </button>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-12">
                  {isSv ? 'Ingen utrustning krävs' : 'No equipment needed'}
                </p>

                {/* Value Props Checklist */}
                <div className="w-full text-left space-y-4 mb-12">
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">{isSv ? "Du får:" : "You'll get:"}</p>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0"><CheckCircle2 size={14} /></div>
                    <span className="text-sm font-medium text-gray-300">{isSv ? 'Din rörlighetsprofil' : 'Your mobility profile'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0"><CheckCircle2 size={14} /></div>
                    <span className="text-sm font-medium text-gray-300">{isSv ? 'Dina största prioriteringar' : 'Your biggest priorities'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0"><CheckCircle2 size={14} /></div>
                    <span className="text-sm font-medium text-gray-300">{isSv ? 'Ditt första personliga pass' : 'Your personalized first plan'}</span>
                  </div>
                </div>

                {/* Locked Preview Teaser */}
                <div className="w-full relative rounded-3xl border border-gray-800 bg-gray-900/40 p-6 overflow-hidden">
                  {/* Fade out gradient to mask the locked content */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-950/80 to-gray-950 z-10" />
                  
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4 text-left">{isSv ? 'Din profil' : 'Your Profile'}</p>
                  <div className="space-y-4 opacity-40">
                    <div className="flex justify-between items-center"><span className="text-sm font-medium text-gray-300">Thoracic rotation</span><span className="text-xs text-gray-500">—</span></div>
                    <div className="flex justify-between items-center"><span className="text-sm font-medium text-gray-300">Hip mobility</span><span className="text-xs text-gray-500">—</span></div>
                    <div className="flex justify-between items-center"><span className="text-sm font-medium text-gray-300">Shoulder control</span><span className="text-xs text-gray-500">—</span></div>
                  </div>
                  
                  <div className="absolute bottom-5 left-0 w-full text-center z-20">
                    <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                      <Lock size={12} />
                      {isSv ? 'Gör screening för att låsa upp' : 'Complete screening to unlock'}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          );
        }
        return (
          <TodayScreen 
            profile={bodyProfile}
            language={language}
            onStartWorkout={(plan) => console.log('Starting workout', plan)}
            onRetest={() => { setActiveTab('ANALYZE'); setAnalyzeScreen('SCREENING'); }}
          />
        );

      case 'ANALYZE':
        if (analyzeScreen === 'SCREENING' && landmarker) {
          return (
            <ScreeningFlowScreen
              plan={FULL_SCREENING}
              landmarker={landmarker}
              modelSha={modelSha}
              language={language}
              isDevMode={isDevMode}
              onComplete={handleScreeningComplete}
              onCancel={() => setAnalyzeScreen('IDLE')}
            />
          );
        }
        if (analyzeScreen === 'SWING') {
          return (
            <div className="relative h-full w-full">
              <div className="absolute top-4 left-4 z-50">
                <button
                  onClick={() => setAnalyzeScreen('IDLE')}
                  className="bg-gray-800/80 hover:bg-gray-700 backdrop-blur-md text-gray-300 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-700 transition"
                >
                  ← {isSv ? 'Tillbaka' : 'Back'}
                </button>
              </div>
              <SwingAnalysisView
                currentBodyScore={screeningResult}
                language={language}
                onNavigateToScreening={() => setAnalyzeScreen('SCREENING')}
              />
            </div>
          );
        }
        return (
          <StartScreen
            plan={FULL_SCREENING}
            language={language}
            onSetLanguage={setLanguage}
            onStartScreening={() => setAnalyzeScreen('SCREENING')}
            onOpenSwingAnalysis={() => setAnalyzeScreen('SWING')}
            isDevMode={isDevMode}
          />
        );

      case 'BODY':
        if (!screeningResult || !bodyProfile) {
          // Create a visually appealing mock profile for the blurred background
          const mockProfile: BodyProfile = {
            id: 'mock', userId: 'mock', createdAt: new Date(), updatedAt: new Date(),
            mobility: { domain: 'MOBILITY', compositeScore: 65, confidence: 'HIGH', lastTestedAt: new Date(), source: 'SCREENING', areas: [
              { areaId: 'thoracic-rotation-limited', label: { sv: 'Bröstrygg', en: 'Thoracic' }, score: 12, maxScore: 25, quality: 'POOR', rawMeasurements: {}, compensations: [], lastTestedAt: new Date() },
              { areaId: 'hip-hinge-limited', label: { sv: 'Höfter', en: 'Hips' }, score: 20, maxScore: 25, quality: 'GOOD', rawMeasurements: {}, compensations: [], lastTestedAt: new Date() }
            ]},
            motorControl: { domain: 'MOTOR_CONTROL', compositeScore: 50, confidence: 'LOW', lastTestedAt: new Date(), source: 'SCREENING', areas: [] },
            loadTolerance: { domain: 'LOAD_TOLERANCE', compositeScore: 50, confidence: 'LOW', lastTestedAt: new Date(), source: 'SCREENING', areas: [] },
            golfBodyScore: 65, golfBodyTier: 'MODERATE',
            primaryBottlenecks: [{ id: 'mock1', domain: 'MOBILITY', areaId: 'thoracic-rotation-limited', type: 'LIMITATION', severity: 'SIGNIFICANT', label: { sv: 'Begränsad bröstrygg', en: 'Limited thoracic' }, description: { sv: '', en: '' }, compatibleExerciseTags: [], confidence: 'HIGH' }],
            keyStrengths: [{ id: 'mock2', domain: 'MOBILITY', areaId: 'hip-hinge-limited', type: 'STRENGTH', severity: 'MILD', label: { sv: 'Stark höftfällning', en: 'Strong hip hinge' }, description: { sv: '', en: '' }, compatibleExerciseTags: [], confidence: 'HIGH' }]
          };

          return (
            <div className="relative w-full h-full overflow-hidden bg-gray-950">
              {/* Blurred Mock Dashboard Background */}
              <div className="absolute inset-0 opacity-100 blur-[8px] pointer-events-none scale-[1.02] origin-top">
                <BodyScreen
                  result={{} as any}
                  profile={mockProfile}
                  language={language}
                  onOpenSwingAnalysis={() => {}}
                  onCreateProgram={() => {}}
                />
              </div>

              {/* Overlay Content */}
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center bg-gradient-to-b from-gray-950/20 via-gray-950/70 to-gray-950 pb-12">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 mb-6 shadow-[0_0_40px_rgba(16,185,129,0.3)] backdrop-blur-md border border-emerald-500/20">
                  <User size={32} />
                </div>
                <div className="space-y-3 mb-8">
                  <h2 className="text-3xl font-bold text-white tracking-tight drop-shadow-md">{isSv ? 'Din Golfkropp' : 'Your Golf Body'}</h2>
                  <p className="text-gray-200 max-w-sm mx-auto leading-relaxed text-sm font-medium drop-shadow-md">
                    {isSv 
                      ? 'Bygg din Golf Body Profile. Se var din rörlighet är begränsad, vad som är starkt, och exakt vad du behöver fokusera på.' 
                      : "Build your Golf Body Profile. See where your mobility is limited, what's strong, and exactly what to focus on."}
                  </p>
                </div>
                <button 
                  onClick={() => { setActiveTab('ANALYZE'); setAnalyzeScreen('SCREENING'); }}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-8 py-4 rounded-xl font-bold transition shadow-xl shadow-emerald-900/50 flex items-center gap-2 border border-emerald-400/20"
                >
                  <Camera size={18} />
                  {isSv ? 'Starta din första Screening' : 'Start your first Screening'}
                </button>
              </div>
            </div>
          );
        }
        return (
          <BodyScreen
            result={screeningResult}
            profile={bodyProfile}
            language={language}
            onOpenSwingAnalysis={() => { setActiveTab('ANALYZE'); setAnalyzeScreen('SWING'); }}
            onCreateProgram={() => { setActiveTab('TODAY'); setTodayScreen('CHECKIN'); }}
          />
        );

      default:
        return null;
    }
  };

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------
  return (
    <div className="h-[100dvh] w-full max-w-md mx-auto bg-black text-white flex flex-col font-sans overflow-hidden relative">
      {/* Top Header */}
      <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-white/5 relative z-10 bg-black/50 backdrop-blur-md">
        <div className="font-bold tracking-widest text-sm text-gray-300">GOLF BODY <span className="text-emerald-500">OS</span></div>
        <div className="flex items-center gap-4">
          <button onClick={() => setLanguage(l => l === 'sv-SE' ? 'en-US' : 'sv-SE')} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 hover:text-white bg-gray-900/50 px-2.5 py-1.5 rounded-lg border border-gray-800 transition">
            <Globe size={12} />
            {isSv ? 'SV' : 'EN'}
            <ChevronDown size={12} className="opacity-50" />
          </button>
          {isDevMode && (
            <button onClick={() => { clearStorage(); window.location.reload(); }} className="text-[10px] text-gray-600 hover:text-red-400">
              RESET
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col bg-gray-950">
        {renderTabContent()}
      </div>

      {/* Bottom Navigation */}
      <div className="h-20 shrink-0 bg-gray-950 border-t border-white/5 relative z-10 pb-safe">
        <div className="h-full flex items-center justify-around px-2">
          
          <button
            onClick={() => setActiveTab('TODAY')}
            className={`flex flex-col items-center gap-1 p-2 w-20 transition-colors ${
              activeTab === 'TODAY' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Home size={24} strokeWidth={activeTab === 'TODAY' ? 2.5 : 2} />
              <span className="text-[10px] font-semibold">{isSv ? 'Dagens' : 'Today'}</span>
            </button>
            
            <button
              onClick={() => setActiveTab('ANALYZE')}
              className={`flex flex-col items-center gap-1 p-2 w-20 transition-colors ${
                activeTab === 'ANALYZE' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Camera size={24} strokeWidth={activeTab === 'ANALYZE' ? 2.5 : 2} />
              <span className="text-[10px] font-semibold">{isSv ? 'Analys' : 'Analyze'}</span>
            </button>
            
            <button
              onClick={() => setActiveTab('BODY')}
              className={`flex flex-col items-center gap-1 p-2 w-20 transition-colors ${
                activeTab === 'BODY' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <User size={24} strokeWidth={activeTab === 'BODY' ? 2.5 : 2} />
              <span className="text-[10px] font-semibold">{isSv ? 'Kropp' : 'Body'}</span>
            </button>
          </div>
        </div>
    </div>
  );
}
