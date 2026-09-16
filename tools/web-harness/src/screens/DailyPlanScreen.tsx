/**
 * DailyPlanScreen — Shows today's generated training plan.
 *
 * Displays:
 * - Focus summary + total time
 * - Distribution bar (mobility/control/strength/recovery %)
 * - Exercise cards with dose, rationale, and golf relevance
 * - Safety mode banner if pain detected
 * - Actions: start session, redo screening, back to results
 */

import React from 'react';
import {
  ArrowLeft, Clock, Dumbbell, Shield, AlertTriangle,
  ChevronDown, Target, Zap, RefreshCw, RotateCcw,
} from 'lucide-react';
import type { SupportedLanguage } from '../../../../src/core/coaching/i18n/locales';
import type { DailyPlan, ExerciseAssignment } from '../../../../src/core/training/types/daily-plan';

interface DailyPlanScreenProps {
  plan: DailyPlan;
  language: SupportedLanguage;
  onBackToResults: () => void;
  onRedoCheckin: () => void;
  onRestartScreening: () => void;
}

// Category colors
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  MOBILITY: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
  CONTROL: { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30' },
  STRENGTH: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  RECOVERY: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  POWER: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
};

const CATEGORY_LABELS: Record<string, { sv: string; en: string }> = {
  MOBILITY: { sv: 'Rörlighet', en: 'Mobility' },
  CONTROL: { sv: 'Kontroll', en: 'Control' },
  STRENGTH: { sv: 'Styrka', en: 'Strength' },
  RECOVERY: { sv: 'Återhämtning', en: 'Recovery' },
  POWER: { sv: 'Explosivitet', en: 'Power' },
};

function ExerciseCard({ assignment, language, index }: { assignment: ExerciseAssignment; language: SupportedLanguage; index: number }) {
  const isSv = language === 'sv-SE';
  const ex = assignment.exercise;
  const dose = assignment.dose;
  const colors = CATEGORY_COLORS[ex.category] ?? CATEGORY_COLORS.MOBILITY;
  const catLabel = CATEGORY_LABELS[ex.category] ?? CATEGORY_LABELS.MOBILITY;

  const doseStr = dose.reps
    ? `${dose.sets} × ${dose.reps} reps`
    : `${dose.sets} × ${dose.holdSeconds}s`;

  const durationMin = Math.ceil(assignment.estimatedDurationSec / 60);

  return (
    <div className={`rounded-2xl border ${colors.border} ${colors.bg} p-5`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${colors.text} bg-white/5`}>
            {index + 1}
          </div>
          <div>
            <h3 className="font-bold text-white">{isSv ? ex.name.sv : ex.name.en}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-semibold ${colors.text}`}>{isSv ? catLabel.sv : catLabel.en}</span>
              <span className="text-gray-600">·</span>
              <span className="text-xs text-gray-400">{doseStr}</span>
              <span className="text-gray-600">·</span>
              <span className="text-xs text-gray-400">~{durationMin} min</span>
            </div>
          </div>
        </div>
        {ex.equipment.length > 0 && ex.equipment[0] !== 'NONE' && (
          <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full whitespace-nowrap">
            {ex.equipment.join(', ')}
          </span>
        )}
      </div>

      {/* Instructions */}
      <p className="text-sm text-gray-300 leading-relaxed mb-3">
        {isSv ? ex.instructions.sv : ex.instructions.en}
      </p>

      {/* Golf relevance */}
      {ex.golfRelevance.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-emerald-400/80 bg-emerald-500/5 rounded-lg px-3 py-2 border border-emerald-500/10">
          <Target size={14} className="mt-0.5 shrink-0" />
          <span>{isSv ? ex.golfRelevance[0].explanation.sv : ex.golfRelevance[0].explanation.en}</span>
        </div>
      )}
    </div>
  );
}

export default function DailyPlanScreen({
  plan,
  language,
  onBackToResults,
  onRedoCheckin,
  onRestartScreening,
}: DailyPlanScreenProps) {
  const isSv = language === 'sv-SE';
  const dist = plan.distribution;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={onBackToResults} className="text-gray-400 hover:text-white transition flex items-center gap-1 text-sm">
            <ArrowLeft size={16} />
            <span>{isSv ? 'Resultat' : 'Results'}</span>
          </button>
          <button onClick={onRedoCheckin} className="text-gray-400 hover:text-white transition flex items-center gap-1 text-sm">
            <RotateCcw size={14} />
            <span>{isSv ? 'Ny check-in' : 'Redo check-in'}</span>
          </button>
        </div>

        {/* Safety mode banner */}
        {plan.safetyModeActive && (
          <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-3">
            <Shield size={20} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-300">{isSv ? 'Skyddsläge aktivt' : 'Safety mode active'}</p>
              <p className="text-xs text-amber-400/70 mt-0.5">
                {isSv ? 'Programmet är anpassat baserat på rapporterat obehag. Övningar som kan belasta smärtande områden har filtrerats bort.' : 'Program adapted based on reported discomfort. Exercises that could load painful areas have been filtered out.'}
              </p>
            </div>
          </div>
        )}

        {/* Hero */}
        <div className="text-center space-y-3 pt-2">
          <h1 className="text-3xl font-black bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            {isSv ? 'Ditt Dagsprogram' : 'Your Daily Program'}
          </h1>
          <p className="text-gray-300 font-medium">{isSv ? plan.focusSummary.sv : plan.focusSummary.en}</p>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1.5"><Clock size={14} /> {plan.totalMinutes} min</span>
            <span className="flex items-center gap-1.5"><Dumbbell size={14} /> {plan.exercises.length} {isSv ? 'övningar' : 'exercises'}</span>
          </div>
        </div>

        {/* Distribution bar */}
        <div className="space-y-2">
          <div className="flex h-3 rounded-full overflow-hidden bg-gray-900">
            {dist.mobilityPercent > 0 && (
              <div className="bg-sky-500 transition-all" style={{ width: `${dist.mobilityPercent}%` }} />
            )}
            {dist.controlPercent > 0 && (
              <div className="bg-violet-500 transition-all" style={{ width: `${dist.controlPercent}%` }} />
            )}
            {dist.strengthPercent > 0 && (
              <div className="bg-amber-500 transition-all" style={{ width: `${dist.strengthPercent}%` }} />
            )}
            {dist.recoveryPercent > 0 && (
              <div className="bg-emerald-500 transition-all" style={{ width: `${dist.recoveryPercent}%` }} />
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            {dist.mobilityPercent > 0 && <span className="text-sky-400">● {isSv ? 'Rörlighet' : 'Mobility'} {dist.mobilityPercent}%</span>}
            {dist.controlPercent > 0 && <span className="text-violet-400">● {isSv ? 'Kontroll' : 'Control'} {dist.controlPercent}%</span>}
            {dist.strengthPercent > 0 && <span className="text-amber-400">● {isSv ? 'Styrka' : 'Strength'} {dist.strengthPercent}%</span>}
            {dist.recoveryPercent > 0 && <span className="text-emerald-400">● {isSv ? 'Återhämtning' : 'Recovery'} {dist.recoveryPercent}%</span>}
          </div>
        </div>

        {/* Rationale */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-3">
          <p className="text-sm text-gray-300 leading-relaxed">
            💬 {isSv ? plan.rationale.sv : plan.rationale.en}
          </p>
        </div>

        {/* Exercise cards */}
        <div className="space-y-4">
          {plan.exercises.map((assignment, idx) => (
            <ExerciseCard
              key={assignment.exercise.id}
              assignment={assignment}
              language={language}
              index={idx}
            />
          ))}
        </div>

        {/* Empty state */}
        {plan.exercises.length === 0 && (
          <div className="text-center py-12 text-gray-500 space-y-3">
            <AlertTriangle size={40} className="mx-auto" />
            <p className="text-lg font-medium">{isSv ? 'Inga övningar kunde väljas' : 'No exercises could be selected'}</p>
            <p className="text-sm">{isSv ? 'Prova en annan check-in eller genomför en ny screening.' : 'Try a different check-in or run a new screening.'}</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3 pt-4 pb-8">
          {plan.exercises.length > 0 && (
            <button className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-lg flex items-center justify-center gap-3 transition shadow-lg shadow-emerald-500/20">
              <Zap size={20} />
              <span>{isSv ? 'Starta pass' : 'Start session'}</span>
            </button>
          )}
          <div className="flex gap-3">
            <button
              onClick={onRedoCheckin}
              className="flex-1 py-3 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-300 font-medium text-sm flex items-center justify-center gap-2 border border-gray-800 transition"
            >
              <RotateCcw size={14} />
              <span>{isSv ? 'Ny check-in' : 'New check-in'}</span>
            </button>
            <button
              onClick={onRestartScreening}
              className="flex-1 py-3 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-300 font-medium text-sm flex items-center justify-center gap-2 border border-gray-800 transition"
            >
              <RefreshCw size={14} />
              <span>{isSv ? 'Ny screening' : 'New screening'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
