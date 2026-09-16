/**
 * ResultScreen — Full-screen screening result display.
 *
 * Shows the Golf Body Score hero, N pillar cards via .map(),
 * strengths/bottlenecks, and action buttons.
 * No dev tools visible in consumer mode.
 */

import React from 'react';
import { Trophy, RefreshCw, Zap, ChevronDown } from 'lucide-react';
import { SupportedLanguage } from '../../../../src/core/coaching/i18n/locales';
import { ScreeningResult } from '../types/screening';
import PillarCard from '../components/PillarCard';

interface ResultScreenProps {
  result: ScreeningResult;
  language: SupportedLanguage;
  onRestartScreening: () => void;
  onOpenSwingAnalysis: () => void;
  onBackToStart: () => void;
  onCreateProgram?: () => void;
}

export default function ResultScreen({
  result,
  language,
  onRestartScreening,
  onOpenSwingAnalysis,
  onBackToStart,
  onCreateProgram,
}: ResultScreenProps) {
  const isSv = language === 'sv-SE';

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Hero Score */}
        <div className="text-center space-y-4 pt-6">
          <div className="inline-flex items-center gap-2 bg-emerald-900/30 px-4 py-1.5 rounded-full border border-emerald-500/30 text-emerald-400 text-sm font-semibold">
            <Trophy size={16} />
            <span>{isSv ? 'SCREENING GENOMFÖRD' : 'SCREENING COMPLETE'}</span>
          </div>

          {/* Score circle */}
          <div className="relative w-44 h-44 mx-auto">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 144 144">
              <circle
                cx="72"
                cy="72"
                r="64"
                fill="none"
                stroke="#1e293b"
                strokeWidth="10"
              />
              <circle
                cx="72"
                cy="72"
                r="64"
                fill="none"
                stroke={result.tierColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(result.totalScore / 100) * 402} 402`}
                className="transition-all duration-1500 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-5xl font-black text-white">{result.totalScore}</div>
              <div className="text-sm text-gray-400 font-medium">/ 100</div>
            </div>
          </div>

          {/* Tier badge */}
          <div
            className="inline-block px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide"
            style={{
              backgroundColor: `${result.tierColor}20`,
              color: result.tierColor,
              border: `1px solid ${result.tierColor}50`,
            }}
          >
            {result.tierLabel}
          </div>

          {/* Summary */}
          <p className="text-gray-400 text-sm leading-relaxed max-w-lg mx-auto">
            {result.summary}
          </p>
        </div>

        {/* Pillar Cards */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
            <ChevronDown size={18} className="text-gray-500" />
            {isSv ? 'Detaljerad Analys' : 'Detailed Analysis'}
          </h2>
          <div className={`grid gap-4 ${result.stepResults.length > 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
            {result.stepResults.map((stepResult, idx) => (
              <PillarCard
                key={stepResult.stepId}
                result={stepResult}
                index={idx}
                totalPillars={result.stepResults.length}
                language={language}
              />
            ))}
          </div>
        </div>

        {/* Strengths & Bottlenecks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Strengths */}
          <div className="bg-emerald-950/20 rounded-xl border border-emerald-500/20 p-4 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <span>💪</span>
              <span>{isSv ? 'Dina Styrkor' : 'Your Strengths'}</span>
            </div>
            {result.keyStrengths.map((s, i) => (
              <div key={i} className="text-xs text-gray-300 leading-relaxed pl-6">
                ✓ {s}
              </div>
            ))}
          </div>

          {/* Bottlenecks */}
          <div className="bg-amber-950/20 rounded-xl border border-amber-500/20 p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <span>🎯</span>
              <span>{isSv ? 'Fokusområden' : 'Focus Areas'}</span>
            </div>
            {result.primaryBottlenecks.map((b, i) => (
              <div key={i} className="text-xs text-gray-300 leading-relaxed pl-6">
                → {b}
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col items-center gap-3 pt-4 pb-8">
          {onCreateProgram && (
            <button
              onClick={onCreateProgram}
              className="w-full max-w-sm flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-6 py-4 rounded-xl font-bold text-lg transition shadow-lg shadow-emerald-600/20"
            >
              <Zap size={20} />
              <span>{isSv ? 'Skapa Dagens Program' : 'Create Daily Program'}</span>
            </button>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={onRestartScreening}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 px-5 py-2.5 rounded-xl font-semibold text-sm transition border border-gray-700"
            >
              <RefreshCw size={14} />
              <span>{isSv ? 'Gör om screening' : 'Redo Screening'}</span>
            </button>
            <button
              onClick={onOpenSwingAnalysis}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 px-5 py-2.5 rounded-xl font-semibold text-sm transition border border-gray-700"
            >
              <Zap size={14} />
              <span>{isSv ? 'Svinganalys' : 'Swing Analysis'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
