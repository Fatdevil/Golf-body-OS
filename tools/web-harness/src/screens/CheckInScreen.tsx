/**
 * CheckInScreen — 5-second daily check-in.
 *
 * Three quick questions:
 * 1. How does your body feel? (5 options)
 * 2. Golf today/tomorrow? (2 rows)
 * 3. Time available? (10/20/30 min)
 *
 * Produces: DailyState + GolfContext
 */

import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Zap } from 'lucide-react';
import type { SupportedLanguage } from '../../../../src/core/coaching/i18n/locales';
import type { BodyFeel, DailyState } from '../../../../src/core/training/types/daily-state';
import type { GolfActivity, GolfContext, FocusMode } from '../../../../src/core/training/types/golf-context';

interface CheckInScreenProps {
  language: SupportedLanguage;
  onComplete: (state: DailyState, context: GolfContext) => void;
  onBack: () => void;
}

type CheckInStep = 'BODY_FEEL' | 'GOLF' | 'TIME';

const BODY_FEEL_OPTIONS: { value: BodyFeel; emoji: string; sv: string; en: string }[] = [
  { value: 'FRESH', emoji: '💪', sv: 'Fräsch', en: 'Fresh' },
  { value: 'NORMAL', emoji: '👍', sv: 'Normal', en: 'Normal' },
  { value: 'STIFF', emoji: '🦴', sv: 'Stel', en: 'Stiff' },
  { value: 'TIRED', emoji: '😴', sv: 'Trött', en: 'Tired' },
  { value: 'SORE', emoji: '🤕', sv: 'Öm', en: 'Sore' },
];

const GOLF_OPTIONS: { value: GolfActivity; emoji: string; sv: string; en: string }[] = [
  { value: 'NONE', emoji: '🏠', sv: 'Inget golf', en: 'No golf' },
  { value: 'PRACTICE', emoji: '🏌️', sv: 'Träning', en: 'Practice' },
  { value: 'NINE_HOLES', emoji: '⛳', sv: '9 hål', en: '9 holes' },
  { value: 'EIGHTEEN_HOLES', emoji: '🏆', sv: '18 hål', en: '18 holes' },
  { value: 'COMPETITION', emoji: '🥇', sv: 'Tävling', en: 'Competition' },
];

const TIME_OPTIONS: { value: 10 | 20 | 30; sv: string; en: string }[] = [
  { value: 10, sv: '10 min — Snabbpass', en: '10 min — Quick' },
  { value: 20, sv: '20 min — Standard', en: '20 min — Standard' },
  { value: 30, sv: '30 min — Fullständig', en: '30 min — Full' },
];

export default function CheckInScreen({ language, onComplete, onBack }: CheckInScreenProps) {
  const isSv = language === 'sv-SE';
  const [step, setStep] = useState<CheckInStep>('BODY_FEEL');

  const [bodyFeel, setBodyFeel] = useState<BodyFeel | null>(null);
  const [golfToday, setGolfToday] = useState<GolfActivity>('NONE');
  const [golfTomorrow, setGolfTomorrow] = useState<GolfActivity>('NONE');
  const [timeBudget, setTimeBudget] = useState<10 | 20 | 30>(20);

  const handleComplete = () => {
    if (!bodyFeel) return;

    const dailyState: DailyState = {
      bodyFeel,
      painAreas: [],
      perceivedReadiness: bodyFeel === 'FRESH' ? 5 : bodyFeel === 'NORMAL' ? 4 : bodyFeel === 'STIFF' ? 3 : bodyFeel === 'TIRED' ? 2 : 1,
      recordedAt: new Date(),
    };

    const golfContext: GolfContext = {
      golfToday,
      golfTomorrow,
      timeBudget,
      focusMode: 'AUTO' as FocusMode,
    };

    onComplete(dailyState, golfContext);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition flex items-center gap-1 text-sm">
          <ArrowLeft size={16} />
          <span>{isSv ? 'Tillbaka' : 'Back'}</span>
        </button>
        <div className="flex gap-2">
          {(['BODY_FEEL', 'GOLF', 'TIME'] as CheckInStep[]).map((s, i) => (
            <div
              key={s}
              className={`w-16 h-1.5 rounded-full transition-all ${
                s === step ? 'bg-emerald-400' :
                (['BODY_FEEL', 'GOLF', 'TIME'].indexOf(step) > i) ? 'bg-emerald-600' :
                'bg-gray-800'
              }`}
            />
          ))}
        </div>
        <div className="w-16" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-lg mx-auto w-full">
        {step === 'BODY_FEEL' && (
          <div className="w-full space-y-6 animate-in fade-in">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">{isSv ? 'Hur känns kroppen idag?' : 'How does your body feel today?'}</h2>
              <p className="text-gray-400 text-sm">{isSv ? 'Välj det som bäst stämmer' : 'Choose what fits best'}</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {BODY_FEEL_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setBodyFeel(opt.value); setStep('GOLF'); }}
                  className={`flex items-center gap-4 px-5 py-4 rounded-2xl border-2 transition-all text-left ${
                    bodyFeel === opt.value
                      ? 'border-emerald-400 bg-emerald-500/10'
                      : 'border-gray-800 bg-gray-900/50 hover:border-gray-600'
                  }`}
                >
                  <span className="text-3xl">{opt.emoji}</span>
                  <span className="text-lg font-semibold">{isSv ? opt.sv : opt.en}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'GOLF' && (
          <div className="w-full space-y-6 animate-in fade-in">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">{isSv ? 'Spelar du golf?' : 'Playing golf?'}</h2>
            </div>

            {/* Golf today */}
            <div className="space-y-2">
              <p className="text-sm text-gray-400 font-medium">{isSv ? 'Idag' : 'Today'}</p>
              <div className="flex flex-wrap gap-2">
                {GOLF_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setGolfToday(opt.value)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                      golfToday === opt.value
                        ? 'bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300'
                        : 'bg-gray-900 border-2 border-gray-800 text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    <span>{opt.emoji}</span>
                    <span>{isSv ? opt.sv : opt.en}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Golf tomorrow */}
            <div className="space-y-2">
              <p className="text-sm text-gray-400 font-medium">{isSv ? 'Imorgon' : 'Tomorrow'}</p>
              <div className="flex flex-wrap gap-2">
                {GOLF_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setGolfTomorrow(opt.value)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                      golfTomorrow === opt.value
                        ? 'bg-sky-500/20 border-2 border-sky-400 text-sky-300'
                        : 'bg-gray-900 border-2 border-gray-800 text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    <span>{opt.emoji}</span>
                    <span>{isSv ? opt.sv : opt.en}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep('TIME')}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 transition"
            >
              <span>{isSv ? 'Nästa' : 'Next'}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {step === 'TIME' && (
          <div className="w-full space-y-6 animate-in fade-in">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">{isSv ? 'Hur lång tid har du?' : 'How much time do you have?'}</h2>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {TIME_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setTimeBudget(opt.value); }}
                  className={`px-5 py-5 rounded-2xl border-2 text-left transition-all ${
                    timeBudget === opt.value
                      ? 'border-emerald-400 bg-emerald-500/10'
                      : 'border-gray-800 bg-gray-900/50 hover:border-gray-600'
                  }`}
                >
                  <span className="text-lg font-bold">{isSv ? opt.sv : opt.en}</span>
                </button>
              ))}
            </div>

            <button
              onClick={handleComplete}
              disabled={!bodyFeel}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-lg flex items-center justify-center gap-3 transition shadow-lg shadow-emerald-500/20"
            >
              <Zap size={20} />
              <span>{isSv ? 'Skapa mitt program' : 'Create my program'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
