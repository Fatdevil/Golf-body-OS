/**
 * TodayScreen — The "Command Center".
 *
 * This screen replaces the old multi-step Check-in and basic Daily Plan view.
 * It features:
 * - 1-tap Daily Check-in
 * - The "Hero Card" for today's plan
 * - The "Why this plan?" engine rationale
 * - Quick adjusters for Time and Focus
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Play, Clock, Target as TargetIcon, Zap, Activity, Dumbbell, Wind, RefreshCw, AlertCircle } from 'lucide-react';
import type { SupportedLanguage } from '../../../../src/core/coaching/i18n/locales';
import type { BodyProfile } from '../../../../src/core/training/types/body-profile';
import type { DailyState, BodyFeel, PainRegion, PainArea } from '../../../../src/core/training/types/daily-state';
import type { GolfContext, FocusMode } from '../../../../src/core/training/types/golf-context';
import type { DailyPlan } from '../../../../src/core/training/types/daily-plan';
import { buildDailyPlan } from '../../../../src/core/training/engine/plan-builder';
import { EXERCISE_LIBRARY } from '../../../../src/core/training/data/exercise-library';

interface TodayScreenProps {
  profile: BodyProfile;
  language: SupportedLanguage;
  onStartWorkout: (plan: DailyPlan) => void;
  onRetest: () => void;
}

export default function TodayScreen({ profile, language, onStartWorkout, onRetest }: TodayScreenProps) {
  const isSv = language === 'sv-SE';

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [checkInStep, setCheckInStep] = useState<1 | 2>(1);
  
  // Base parameters for the engine
  const [dailyState, setDailyState] = useState<DailyState>({
    bodyFeel: 'NORMAL',
    painAreas: [],
    perceivedReadiness: 4,
    recordedAt: new Date()
  });

  const [golfContext, setGolfContext] = useState<GolfContext>({
    golfToday: 'NONE',
    golfTomorrow: 'NONE',
    timeBudget: 20,
    focusMode: 'AUTO'
  });

  const [plan, setPlan] = useState<DailyPlan | null>(null);

  // ---------------------------------------------------------------------------
  // Engine Trigger
  // ---------------------------------------------------------------------------
  // Rebuild the plan automatically whenever state/context changes (if checked in)
  useEffect(() => {
    if (hasCheckedIn) {
      const newPlan = buildDailyPlan(
        profile,
        dailyState,
        golfContext,
        EXERCISE_LIBRARY,
        { userId: 'default', completedPlans: [], currentStreak: 0, longestStreak: 0, totalPlansCompleted: 0, lastCompletedAt: null, averageCompletionRate: 0 } // Mock history
      );
      setPlan(newPlan);
    }
  }, [hasCheckedIn, dailyState, golfContext, profile]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleBodyFeelClick = (feel: BodyFeel) => {
    let readiness = 4;
    if (feel === 'FRESH') readiness = 5;
    if (feel === 'TIRED' || feel === 'STIFF') readiness = 3;
    if (feel === 'SORE') readiness = 2;

    setDailyState(prev => ({ ...prev, bodyFeel: feel, perceivedReadiness: readiness as 1|2|3|4|5, painAreas: [] }));
    setCheckInStep(2);
  };

  const handlePainToggle = (region: PainRegion) => {
    setDailyState(prev => {
      const exists = prev.painAreas.some(p => p.region === region);
      if (exists) {
        return { ...prev, painAreas: prev.painAreas.filter(p => p.region !== region) };
      } else {
        return { ...prev, painAreas: [...prev.painAreas, { region, intensity: prev.bodyFeel === 'SORE' ? 'SIGNIFICANT' : 'MODERATE' }] };
      }
    });
  };

  const handleGolfActivity = (type: 'NONE' | 'TODAY' | 'TOMORROW' | 'COMPETITION_TOMORROW') => {
    setGolfContext(prev => ({
      ...prev,
      golfToday: type === 'TODAY' ? 'EIGHTEEN_HOLES' : 'NONE',
      golfTomorrow: type === 'TOMORROW' ? 'EIGHTEEN_HOLES' : type === 'COMPETITION_TOMORROW' ? 'COMPETITION' : 'NONE'
    }));
  };

  const finishCheckIn = () => {
    setHasCheckedIn(true);
  };

  // ---------------------------------------------------------------------------
  // Render Helpers
  // ---------------------------------------------------------------------------
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 10) return isSv ? 'God morgon' : 'Good morning';
    if (hour < 14) return isSv ? 'God dag' : 'Good day';
    if (hour < 18) return isSv ? 'God eftermiddag' : 'Good afternoon';
    return isSv ? 'God kväll' : 'Good evening';
  };

  const getFeelLabel = (feel: BodyFeel) => {
    const labels = {
      FRESH: isSv ? 'Fräsch' : 'Fresh',
      NORMAL: 'Normal',
      STIFF: isSv ? 'Stel' : 'Stiff',
      TIRED: isSv ? 'Trött' : 'Tired',
      SORE: isSv ? 'Öm' : 'Sore'
    };
    return labels[feel];
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24">
      
      {/* Header */}
      <div className="px-6 pt-10 pb-6">
        <p className="text-gray-400 text-sm font-medium">{new Date().toLocaleDateString(isSv ? 'sv-SE' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
        <h1 className="text-2xl font-bold tracking-tight mt-1">{getGreeting()}</h1>
        
        {hasCheckedIn && (
          <div className="flex items-center gap-2 mt-3 text-sm font-medium">
            <span className="text-gray-500">{isSv ? 'Kroppen idag:' : 'Body today:'}</span>
            <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">{getFeelLabel(dailyState.bodyFeel)}</span>
            <button 
              onClick={() => setHasCheckedIn(false)}
              className="ml-auto text-xs text-gray-500 hover:text-gray-300"
            >
              {isSv ? 'Ändra' : 'Edit'}
            </button>
          </div>
        )}
      </div>

      <div className="px-5 space-y-6">
        
        {/* 1. Daily Check-in (if not done) */}
        {!hasCheckedIn && (
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4">
            
            {checkInStep === 1 ? (
              <>
                <h2 className="text-lg font-bold text-white mb-4">{isSv ? 'Hur känns kroppen idag?' : 'How does your body feel today?'}</h2>
                <div className="flex flex-wrap gap-2">
                  {(['FRESH', 'NORMAL', 'STIFF', 'TIRED', 'SORE'] as BodyFeel[]).map(feel => (
                    <button
                      key={feel}
                      onClick={() => handleBodyFeelClick(feel)}
                      className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2.5 rounded-xl font-medium text-sm transition border border-gray-700 active:scale-95"
                    >
                      {getFeelLabel(feel)}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                {(dailyState.bodyFeel === 'STIFF' || dailyState.bodyFeel === 'SORE') && (
                  <div>
                    <h2 className="text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">{isSv ? 'Någon särskild smärta eller stelhet?' : 'Any specific pain or stiffness?'}</h2>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'LOWER_BACK', label: isSv ? 'Ländrygg' : 'Lower Back' },
                        { id: 'UPPER_BACK', label: isSv ? 'Bröstrygg' : 'Upper Back' },
                        { id: 'SHOULDER_RIGHT', label: isSv ? 'Höger Axel' : 'Right Shoulder' },
                        { id: 'SHOULDER_LEFT', label: isSv ? 'Vänster Axel' : 'Left Shoulder' },
                        { id: 'HIP_RIGHT', label: isSv ? 'Höger Höft' : 'Right Hip' },
                        { id: 'HIP_LEFT', label: isSv ? 'Vänster Höft' : 'Left Hip' },
                        { id: 'KNEE_RIGHT', label: isSv ? 'Höger Knä' : 'Right Knee' },
                        { id: 'KNEE_LEFT', label: isSv ? 'Vänster Knä' : 'Left Knee' }
                      ].map(region => {
                        const isSelected = dailyState.painAreas.some(p => p.region === region.id);
                        return (
                          <button
                            key={region.id}
                            onClick={() => handlePainToggle(region.id as PainRegion)}
                            className={`px-4 py-2 rounded-xl font-medium text-sm transition border ${
                              isSelected 
                                ? 'bg-red-500/10 border-red-500/50 text-red-400' 
                                : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                            }`}
                          >
                            {region.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                <div>
                  <h2 className="text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">{isSv ? 'Golfaktivitet?' : 'Golf activity?'}</h2>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'NONE', label: isSv ? 'Nej' : 'No' },
                      { id: 'TODAY', label: isSv ? 'Spelar idag' : 'Playing today' },
                      { id: 'TOMORROW', label: isSv ? 'Spelar imorgon' : 'Playing tomorrow' },
                      { id: 'COMPETITION_TOMORROW', label: isSv ? 'Tävling imorgon' : 'Competition tomorrow' }
                    ].map(activity => {
                      const isActive = 
                        (activity.id === 'NONE' && golfContext.golfToday === 'NONE' && golfContext.golfTomorrow === 'NONE') ||
                        (activity.id === 'TODAY' && golfContext.golfToday !== 'NONE') ||
                        (activity.id === 'TOMORROW' && golfContext.golfTomorrow === 'EIGHTEEN_HOLES') ||
                        (activity.id === 'COMPETITION_TOMORROW' && golfContext.golfTomorrow === 'COMPETITION');
                        
                      return (
                        <button
                          key={activity.id}
                          onClick={() => handleGolfActivity(activity.id as any)}
                          className={`px-4 py-2 rounded-xl font-medium text-sm transition border ${
                            isActive 
                              ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' 
                              : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          {activity.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setCheckInStep(1)}
                    className="px-6 py-3 rounded-xl font-bold text-sm bg-gray-800 text-gray-300 hover:bg-gray-700"
                  >
                    {isSv ? 'Tillbaka' : 'Back'}
                  </button>
                  <button 
                    onClick={finishCheckIn}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-gray-950 py-3 rounded-xl font-black text-sm transition"
                  >
                    {isSv ? 'SKAPA PASS' : 'CREATE PLAN'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. Today's Plan (Hero Card) */}
        {hasCheckedIn && plan && (
          <>
            <div className="bg-gradient-to-br from-emerald-900/40 to-teal-900/20 border border-emerald-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4">
              
              {/* Category tag */}
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">
                <Zap size={14} />
                <span>
                  {plan.distribution.mobilityPercent > 0 ? 'Mobility ' : ''}
                  {plan.distribution.strengthPercent > 0 ? '+ Strength ' : ''}
                  {plan.distribution.controlPercent > 0 && plan.distribution.strengthPercent === 0 ? '+ Control' : ''}
                </span>
              </div>
              
              <h2 className="text-3xl font-black text-white mb-1">{isSv ? 'Dagens Pass' : "Today's Plan"}</h2>
              <div className="flex items-center gap-4 text-emerald-200/70 text-sm font-medium mb-6">
                <div className="flex items-center gap-1.5"><Clock size={16} /> {plan.totalMinutes} min</div>
                <div className="flex items-center gap-1.5"><Activity size={16} /> {plan.exercises.length} {isSv ? 'övningar' : 'exercises'}</div>
              </div>

              {/* The Mix (Distribution) */}
              <div className="space-y-2 mb-8">
                <p className="text-xs font-semibold text-emerald-500/80 uppercase">{isSv ? 'Fokusfördelning' : 'Focus Mix'}</p>
                <div className="flex w-full h-2 rounded-full overflow-hidden bg-gray-950/50">
                  {plan.distribution.mobilityPercent > 0 && <div style={{ width: `${plan.distribution.mobilityPercent}%` }} className="bg-emerald-400" />}
                  {plan.distribution.controlPercent > 0 && <div style={{ width: `${plan.distribution.controlPercent}%` }} className="bg-teal-400" />}
                  {plan.distribution.strengthPercent > 0 && <div style={{ width: `${plan.distribution.strengthPercent}%` }} className="bg-emerald-600" />}
                  {plan.distribution.recoveryPercent > 0 && <div style={{ width: `${plan.distribution.recoveryPercent}%` }} className="bg-blue-400" />}
                </div>
                <div className="flex items-center gap-4 text-xs font-medium text-emerald-200/50">
                  {plan.distribution.mobilityPercent > 0 && <span>Mob {plan.distribution.mobilityPercent}%</span>}
                  {plan.distribution.controlPercent > 0 && <span>Ctl {plan.distribution.controlPercent}%</span>}
                  {plan.distribution.strengthPercent > 0 && <span>Str {plan.distribution.strengthPercent}%</span>}
                </div>
              </div>

              <button
                onClick={() => onStartWorkout(plan)}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-gray-950 px-6 py-4 rounded-xl font-black text-lg transition shadow-lg shadow-emerald-500/25 active:scale-[0.98]"
              >
                <Play size={20} className="fill-gray-950" />
                {isSv ? 'STARTA PASS' : 'START WORKOUT'}
              </button>
            </div>

            {/* 3. Why this plan? */}
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6">
              <div className="flex items-center gap-2 mb-3 text-emerald-400">
                <TargetIcon size={18} />
                <h3 className="font-bold">{isSv ? 'Varför just detta pass?' : 'Why this plan?'}</h3>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">
                {isSv ? plan.rationale.sv : plan.rationale.en}
              </p>
            </div>

            {/* 4. Adjusters (Time & Focus) */}
            <div className="grid grid-cols-2 gap-4">
              
              {/* Time Adjuster */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <p className="text-xs font-bold text-gray-500 uppercase mb-3">{isSv ? 'Tid' : 'Time today'}</p>
                <div className="flex flex-col gap-2">
                  {[10, 20, 30].map(t => (
                    <button
                      key={t}
                      onClick={() => setGolfContext(prev => ({ ...prev, timeBudget: t as 10|20|30 }))}
                      className={`text-sm font-medium py-2 rounded-lg border transition ${
                        golfContext.timeBudget === t 
                          ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' 
                          : 'bg-gray-950 border-gray-800 text-gray-400 hover:bg-gray-800'
                      }`}
                    >
                      {t} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus Adjuster */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <p className="text-xs font-bold text-gray-500 uppercase mb-3">{isSv ? 'Fokus' : 'Focus'}</p>
                <div className="flex flex-col gap-2">
                  {(['AUTO', 'MOBILITY', 'STRENGTH'] as FocusMode[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setGolfContext(prev => ({ ...prev, focusMode: f }))}
                      className={`text-sm font-medium py-2 rounded-lg border transition capitalize ${
                        golfContext.focusMode === f 
                          ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' 
                          : 'bg-gray-950 border-gray-800 text-gray-400 hover:bg-gray-800'
                      }`}
                    >
                      {f.toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 5. Progress Teaser */}
            {profile.mobility.areas.length > 0 && (
              <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-1">{isSv ? 'Du gör framsteg' : "You're improving"}</p>
                  <p className="text-sm font-bold text-white">
                    {profile.mobility.areas[0].label[isSv ? 'sv' : 'en']}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md text-sm font-bold">
                  <span>+</span> <Activity size={14} />
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
