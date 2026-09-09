import React from 'react';
import { ReadinessFeedback, ReadinessState } from '../../../../src/core/motion/readiness-engine';
import { SupportedLanguage, getPhrase, CoachingPhraseKey } from '../../../../src/core/coaching/i18n/locales';
import { CoachingMode } from '../../../../src/core/coaching/audio-coach';
import { Volume2, RotateCcw, FastForward, Compass } from 'lucide-react';

export type AppTestState = 'SETUP' | 'USER_START' | 'COUNTDOWN' | 'ACTIVE';

interface CameraGuideOverlayProps {
  readinessState: ReadinessState;
  feedback: ReadinessFeedback | null;
  appState: AppTestState;
  language?: SupportedLanguage;
  viewMode?: 'SIDE' | 'FRONT';
  isBriefingActive?: boolean;
  onReplayBriefing?: () => void;
  onSkipBriefing?: () => void;
  coachingMode?: CoachingMode;
}

export default function CameraGuideOverlay({
  readinessState,
  feedback,
  appState,
  language = 'en-US',
  viewMode = 'SIDE',
  isBriefingActive = false,
  onReplayBriefing,
  onSkipBriefing,
  coachingMode = 'GUIDED'
}: CameraGuideOverlayProps) {
  if (appState === 'ACTIVE') {
    return null; // completely hidden during active test
  }

  const isFading = appState === 'COUNTDOWN' || appState === 'USER_START';

  const getStatusColor = () => {
    if (readinessState === 'READY') return 'text-green-400 border-green-500 bg-black/80';
    if (readinessState === 'READY_CANDIDATE') return 'text-yellow-400 border-yellow-500 bg-black/80';
    return 'text-red-400 border-red-500 bg-black/80';
  };

  const isFront = viewMode === 'FRONT';

  return (
    <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${isFading ? 'opacity-30' : 'opacity-100'} flex items-center justify-center`}>
      
      {/* SVG Silhouette Guide */}
      <svg className="absolute w-[55%] h-[95%] opacity-30 text-white pointer-events-none" viewBox="0 0 120 200" preserveAspectRatio="xMidYMid meet">
        {isFront ? (
          <>
            {/* Front View Silhouette */}
            <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              {/* Head */}
              <ellipse cx="60" cy="20" rx="10" ry="13" />
              {/* Shoulders */}
              <line x1="30" y1="42" x2="90" y2="42" />
              {/* Torso */}
              <path d="M 35 42 L 42 100 L 78 100 L 85 42" />
              {/* Crossed Arms over Chest */}
              <path d="M 35 45 Q 60 75 85 45" strokeWidth="2.5" />
              <path d="M 40 55 L 80 55" strokeWidth="1.5" strokeDasharray="3 3" />
              {/* Pelvis / Hips */}
              <line x1="42" y1="100" x2="78" y2="100" strokeWidth="3" />
              {/* Legs */}
              <line x1="45" y1="100" x2="45" y2="175" />
              <line x1="75" y1="100" x2="75" y2="175" />
              {/* Feet */}
              <ellipse cx="45" cy="180" rx="7" ry="3" />
              <ellipse cx="75" cy="180" rx="7" ry="3" />
            </g>

            {/* Target Zones for Front View */}
            <g stroke="rgba(168,85,247,0.5)" strokeWidth="1" strokeDasharray="2 2" fill="none">
              <circle cx="60" cy="20" r="14" /> {/* Head */}
              <rect x="25" y="35" width="70" height="20" rx="6" /> {/* Shoulders */}
              <rect x="35" y="90" width="50" height="20" rx="6" /> {/* Hips */}
              <rect x="35" y="170" width="50" height="15" rx="5" /> {/* Feet */}
            </g>
          </>
        ) : (
          <>
            {/* Subtle Forward Movement Safe Zone (for Hip Hinge) */}
            <path d="M 50 100 Q 15 100 15 20 L 50 20 Z" fill="rgba(255, 255, 255, 0.03)" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1" strokeDasharray="4 4" />
            <text x="25" y="60" fill="rgba(255, 255, 255, 0.3)" fontSize="4" transform="rotate(-90 25,60)">MOVEMENT ZONE</text>

            {/* Generic Side View Silhouette */}
            <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="50" cy="20" rx="12" ry="15" />
              <circle cx="58" cy="18" r="1" fill="currentColor" />
              <path d="M 50 35 Q 60 70 50 100" />
              <path d="M 50 35 Q 40 70 50 100" />
              <path d="M 50 100 L 55 140 L 50 180" />
              <path d="M 50 100 L 45 140 L 50 180" />
              <path d="M 45 180 L 65 180" />
              <path d="M 50 40 L 50 70 L 55 100" />
            </g>
            
            {/* Target Zones */}
            <g stroke="rgba(0,255,0,0.5)" strokeWidth="1" strokeDasharray="2 2" fill="none">
              <circle cx="50" cy="20" r="16" />
              <circle cx="50" cy="40" r="10" />
              <circle cx="50" cy="100" r="12" />
              <circle cx="52" cy="140" r="10" />
              <rect x="40" y="170" width="30" height="15" rx="5" />
            </g>
          </>
        )}
      </svg>

      {/* Mobile Top Pill (< sm screens) */}
      <div className="sm:hidden absolute top-3 left-3 right-14 z-20 pointer-events-auto flex items-center justify-between bg-black/85 backdrop-blur-md px-3.5 py-2 rounded-full border border-gray-700/80 shadow-lg text-xs">
        <div className="flex items-center gap-1.5 font-bold text-white truncate">
          <Compass size={15} className="text-emerald-400 shrink-0" />
          <span className="truncate">
            {isFront 
              ? (language === 'sv-SE' ? '2. Bröstrygg (Fram)' : '2. Thoracic (Front)') 
              : (language === 'sv-SE' ? '1. Höftfällning (Sida)' : '1. Hip Hinge (Side)')}
          </span>
        </div>
        {isBriefingActive && onSkipBriefing && (
          <button
            onClick={onSkipBriefing}
            className="flex items-center gap-1 px-2.5 py-1 bg-purple-600 active:bg-purple-700 text-white rounded-full text-[11px] font-bold shrink-0 ml-2 shadow"
          >
            <FastForward size={11} />
            <span>{language === 'sv-SE' ? 'Hoppa över' : 'Skip'}</span>
          </button>
        )}
      </div>

      {/* Desktop Persistent Step-by-Step Instructions Card (sm and above) */}
      <div className="hidden sm:block absolute top-4 left-4 max-w-sm bg-black/85 backdrop-blur-md p-4 rounded-xl text-white border border-gray-700 shadow-2xl pointer-events-auto">
        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-gray-700/60">
          <h3 className="font-bold text-xs tracking-wider uppercase flex items-center gap-1.5 text-blue-300">
            <Compass size={14} className="text-emerald-400" />
            {isFront 
              ? (language === 'sv-SE' ? 'BRÖSTRYGGSROTATION (TEST #2)' : 'THORACIC ROTATION (TEST #2)') 
              : (language === 'sv-SE' ? 'HÖFTFÄLLNING (TEST #1)' : 'HIP HINGE (TEST #1)')}
          </h3>
          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
            {coachingMode === 'CORRECTIVE' ? (language === 'sv-SE' ? 'Korrigerande' : 'Corrective') : (language === 'sv-SE' ? 'Guidad' : 'Guided')}
          </span>
        </div>

        {/* Numbered Step-by-Step Breakdown */}
        <div className="space-y-1.5 text-xs text-gray-200">
          {isFront ? (
            language === 'sv-SE' ? (
              <>
                <div className="flex items-start gap-1.5">
                  <span className="font-bold text-emerald-400">1.</span>
                  <span><strong>Uppställning:</strong> Ställ dig axelbrett och fronta kameran rakt.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="font-bold text-emerald-400">2.</span>
                  <span><strong>Position:</strong> Korsa armarna över bröstet.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="font-bold text-emerald-400">3.</span>
                  <span><strong>Rörelse:</strong> Rotera överkroppen långsamt åt vänster, håll kvar, tillbaka till mitten, och repetera åt höger.</span>
                </div>
                <div className="flex items-start gap-1.5 text-purple-300">
                  <span className="font-bold text-purple-400">★</span>
                  <span><strong>Fokus:</strong> Håll höfterna stilla – isolera bröstryggen!</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-1.5">
                  <span className="font-bold text-emerald-400">1.</span>
                  <span><strong>Setup:</strong> Stand shoulder-width apart, facing camera squarely.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="font-bold text-emerald-400">2.</span>
                  <span><strong>Position:</strong> Cross arms over your chest.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="font-bold text-emerald-400">3.</span>
                  <span><strong>Movement:</strong> Slowly rotate torso left, hold, return to center, repeat right.</span>
                </div>
                <div className="flex items-start gap-1.5 text-purple-300">
                  <span className="font-bold text-purple-400">★</span>
                  <span><strong>Focus:</strong> Keep hips quiet – isolate thoracic spine!</span>
                </div>
              </>
            )
          ) : (
            language === 'sv-SE' ? (
              <>
                <div className="flex items-start gap-1.5">
                  <span className="font-bold text-emerald-400">1.</span>
                  <span><strong>Uppställning:</strong> Vänd VÄNSTER sida mot kameran så hela kroppen syns.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="font-bold text-emerald-400">2.</span>
                  <span><strong>Position:</strong> Axelbrett med lätt böjda, mjuka knän.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="font-bold text-emerald-400">3.</span>
                  <span><strong>Rörelse:</strong> Fäll överkroppen framåt från höften med rak rygg och skjut bak sätet. Res dig upp.</span>
                </div>
                <div className="flex items-start gap-1.5 text-purple-300">
                  <span className="font-bold text-purple-400">★</span>
                  <span><strong>Fokus:</strong> Böj i höften, inte knäna – håll nacken rak!</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-1.5">
                  <span className="font-bold text-emerald-400">1.</span>
                  <span><strong>Setup:</strong> Turn LEFT side to camera, entire body visible head-to-toe.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="font-bold text-emerald-400">2.</span>
                  <span><strong>Position:</strong> Feet shoulder-width apart, soft knees.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="font-bold text-emerald-400">3.</span>
                  <span><strong>Movement:</strong> Hinge forward from hips pushing glutes back with flat spine. Stand back up.</span>
                </div>
                <div className="flex items-start gap-1.5 text-purple-300">
                  <span className="font-bold text-purple-400">★</span>
                  <span><strong>Focus:</strong> Hinge from hips, not knees – keep neck neutral!</span>
                </div>
              </>
            )
          )}
        </div>

        {/* Audio Briefing Status & Controls */}
        {isBriefingActive ? (
          <div className="mt-3 pt-2.5 border-t border-purple-500/40 flex items-center justify-between gap-2 bg-purple-950/40 p-2 rounded-lg">
            <div className="flex items-center gap-1.5 text-xs text-purple-300 font-semibold animate-pulse">
              <Volume2 size={15} className="text-purple-400 shrink-0" />
              <span>{language === 'sv-SE' ? 'Coachen förklarar övningen...' : 'Coach explaining exercise...'}</span>
            </div>
            {onSkipBriefing && (
              <button
                onClick={onSkipBriefing}
                className="flex items-center gap-1 px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-bold shrink-0 shadow"
              >
                <FastForward size={12} />
                <span>{language === 'sv-SE' ? 'Hoppa över' : 'Skip'}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="mt-3 pt-2 border-t border-gray-700/60 flex items-center justify-between">
            <span className="text-[11px] text-gray-400">
              {language === 'sv-SE' ? 'Ställ dig i position för autostart' : 'Get in position for auto-start'}
            </span>
            {onReplayBriefing && (
              <button
                onClick={onReplayBriefing}
                className="flex items-center gap-1 px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-[11px] font-semibold border border-gray-600 shadow transition shrink-0"
              >
                <RotateCcw size={11} />
                <span>{language === 'sv-SE' ? 'Hör genomgång' : 'Replay'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Primary Actionable Instruction Banner at Bottom */}
      <div className="absolute bottom-5 sm:bottom-12 left-2 right-2 flex justify-center pointer-events-none z-20">
        {isBriefingActive ? (
          <div className="bg-purple-950/95 border-[3px] border-purple-400 px-6 py-3.5 sm:px-8 sm:py-4 rounded-2xl flex flex-col items-center shadow-2xl backdrop-blur-md max-w-[95%] sm:max-w-sm text-center">
            <span className="text-lg sm:text-2xl font-extrabold uppercase tracking-wide text-purple-200 flex items-center gap-2">
              <Volume2 className="animate-pulse text-purple-400" size={22} />
              {language === 'sv-SE' ? 'LYSSNA PÅ COACHEN' : 'LISTEN TO COACH'}
            </span>
            <span className="text-xs sm:text-sm text-purple-300 mt-1 font-medium">
              {language === 'sv-SE' ? 'Nedräkningen startar automatiskt i position' : 'Countdown starts automatically in position'}
            </span>
          </div>
        ) : (
          <div className={`px-6 py-3.5 sm:px-8 sm:py-4 rounded-2xl border-[3px] ${getStatusColor()} flex flex-col items-center shadow-2xl backdrop-blur-md max-w-[95%] sm:max-w-sm text-center`}>
            <span className="text-lg sm:text-2xl font-black uppercase tracking-wide leading-tight">
              {feedback ? getPhrase(feedback as CoachingPhraseKey, language) : getPhrase('READY', language)}
            </span>
            {readinessState === 'READY_CANDIDATE' && (
              <span className="text-xs sm:text-sm mt-1 font-bold text-yellow-300 animate-pulse">
                {language === 'sv-SE' ? 'Håll kvar – kollar stabilitet...' : 'Hold still – checking stability...'}
              </span>
            )}
          </div>
        )}
      </div>
      
    </div>
  );
}
