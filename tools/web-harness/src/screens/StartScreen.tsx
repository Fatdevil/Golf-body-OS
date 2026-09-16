/**
 * StartScreen — The clean, consumer-facing landing screen.
 *
 * Shows a single primary CTA ("Starta Screening") with minimal
 * information about what to expect. No dev tools, no settings overload.
 */

import React from 'react';
import { Camera, Zap, Globe } from 'lucide-react';
import { SupportedLanguage } from '../../../../src/core/coaching/i18n/locales';
import { ScreeningPlan } from '../types/screening';

interface StartScreenProps {
  plan: ScreeningPlan;
  language: SupportedLanguage;
  onSetLanguage: (lang: SupportedLanguage) => void;
  onStartScreening: () => void;
  onOpenSwingAnalysis: () => void;
  isDevMode: boolean;
}

export default function StartScreen({
  plan,
  language,
  onSetLanguage,
  onStartScreening,
  onOpenSwingAnalysis,
  isDevMode,
}: StartScreenProps) {
  const isSv = language === 'sv-SE';
  const stepCount = plan.steps.length;
  const minutes = plan.estimatedMinutes;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-6 py-12">
      {/* Language Switcher */}
      <div className="absolute top-5 right-5 flex items-center gap-2">
        <Globe size={16} className="text-gray-500" />
        <div className="flex bg-gray-900 rounded-lg p-0.5 border border-gray-800">
          <button
            onClick={() => onSetLanguage('en-US')}
            className={`px-2.5 py-1 rounded text-xs font-bold transition ${
              language === 'en-US'
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => onSetLanguage('sv-SE')}
            className={`px-2.5 py-1 rounded text-xs font-bold transition ${
              language === 'sv-SE'
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            SV
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="text-center max-w-md mx-auto space-y-8">
        {/* Logo */}
        <div className="space-y-3">
          <div className="text-6xl">🏌️‍♂️</div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Golf Body OS
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            {isSv
              ? 'Hur rörlig är din kropp för en korrekt golfsving?'
              : 'How mobile is your body for a correct golf swing?'}
          </p>
        </div>

        {/* Primary CTA */}
        <button
          onClick={onStartScreening}
          className="group w-full flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-extrabold text-lg py-5 px-8 rounded-2xl shadow-2xl shadow-emerald-600/30 transition-all duration-200 border border-emerald-400/30"
        >
          <Camera size={24} className="group-hover:scale-110 transition-transform" />
          <span>{isSv ? 'STARTA SCREENING' : 'START SCREENING'}</span>
        </button>

        {/* Info pills */}
        <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-1.5 bg-gray-900/80 px-3 py-1.5 rounded-full border border-gray-800">
            <span>📷</span>
            <span>
              {stepCount} {isSv ? 'tester' : 'tests'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-gray-900/80 px-3 py-1.5 rounded-full border border-gray-800">
            <span>⏱️</span>
            <span>~{minutes} min</span>
          </div>
          <div className="flex items-center gap-1.5 bg-gray-900/80 px-3 py-1.5 rounded-full border border-gray-800">
            <span>🔊</span>
            <span>{isSv ? 'Röstcoach' : 'Voice Coach'}</span>
          </div>
        </div>

        {/* Test steps preview */}
        <div className="bg-gray-900/60 rounded-2xl border border-gray-800 p-4 space-y-2">
          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-3">
            {isSv ? 'Screeningen innehåller' : 'Screening includes'}
          </div>
          {plan.steps.map((step, idx) => (
            <div
              key={step.id}
              className="flex items-center gap-3 text-left py-2 px-3 rounded-xl bg-gray-800/50 border border-gray-700/50"
            >
              <div className="text-xl w-8 text-center">{step.icon}</div>
              <div className="flex-1">
                <div className="text-sm font-bold text-gray-200">
                  {idx + 1}. {isSv ? step.label.sv : step.label.en}
                </div>
                <div className="text-xs text-gray-500">
                  {isSv ? step.description.sv : step.description.en}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Secondary CTA: Swing Analysis */}
        <div className="pt-4 border-t border-gray-800/60">
          <button
            onClick={onOpenSwingAnalysis}
            className="flex items-center justify-center gap-2 mx-auto text-gray-400 hover:text-white text-sm font-semibold transition group"
          >
            <Zap
              size={16}
              className="text-emerald-500 group-hover:text-emerald-400"
            />
            <span>
              {isSv
                ? '240 fps Svinganalys →'
                : '240 fps Swing Analysis →'}
            </span>
          </button>
        </div>
      </div>

      {/* Dev mode indicator */}
      {isDevMode && (
        <div className="fixed bottom-3 left-3 bg-amber-900/60 text-amber-300 text-[10px] font-mono px-2.5 py-1 rounded-full border border-amber-500/40">
          DEV MODE
        </div>
      )}
    </div>
  );
}
