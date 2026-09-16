/**
 * PillarCard — Renders a single test result as a visual card.
 *
 * Used in HolisticReportCard via .map() over TestStepResult[].
 * Supports any test — not hardcoded for hinge or rotation.
 */

import React from 'react';
import { TestStepResult } from '../types/screening';
import { getQualityColor, getQualityBg, getQualityLabel } from '../utils/human-readable';

interface PillarCardProps {
  result: TestStepResult;
  index: number;
  totalPillars: number;
  language: 'sv-SE' | 'en-US';
}

export default function PillarCard({ result, index, totalPillars, language }: PillarCardProps) {
  const isSv = language === 'sv-SE';
  const label = isSv ? result.label.sv : result.label.en;
  const scorePercent = result.maxScore > 0 ? (result.pillarScore / result.maxScore) * 100 : 0;

  // Dynamic border color from step config
  const borderColorMap: Record<string, string> = {
    blue: 'border-blue-500/40',
    purple: 'border-purple-500/40',
    teal: 'border-teal-500/40',
    amber: 'border-amber-500/40',
    emerald: 'border-emerald-500/40',
    red: 'border-red-500/40',
  };
  const textColorMap: Record<string, string> = {
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    teal: 'text-teal-400',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    red: 'text-red-400',
  };
  const bgColorMap: Record<string, string> = {
    blue: 'from-blue-600/20 to-blue-900/10',
    purple: 'from-purple-600/20 to-purple-900/10',
    teal: 'from-teal-600/20 to-teal-900/10',
    amber: 'from-amber-600/20 to-amber-900/10',
    emerald: 'from-emerald-600/20 to-emerald-900/10',
    red: 'from-red-600/20 to-red-900/10',
  };
  const barColorMap: Record<string, string> = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    teal: 'bg-teal-500',
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
    red: 'bg-red-500',
  };

  const borderColor = borderColorMap[result.color] || 'border-gray-600/40';
  const textColor = textColorMap[result.color] || 'text-gray-400';
  const bgGradient = bgColorMap[result.color] || 'from-gray-600/20 to-gray-900/10';
  const barColor = barColorMap[result.color] || 'bg-gray-500';

  return (
    <div className={`bg-gradient-to-br ${bgGradient} rounded-2xl border ${borderColor} p-5 space-y-4`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{result.icon}</span>
          <div>
            <div className={`text-xs font-semibold uppercase tracking-wider ${textColor}`}>
              {isSv ? `Pelare ${index + 1}` : `Pillar ${index + 1}`}
            </div>
            <div className="text-base font-bold text-white">{label}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-white font-mono">
            {result.pillarScore}
            <span className="text-sm font-normal text-gray-400">/{result.maxScore}</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-1000 ease-out`}
          style={{ width: `${Math.min(100, scorePercent)}%` }}
        />
      </div>

      {/* Sub-metrics */}
      {result.subMetrics.length > 0 && (
        <div className="space-y-1.5">
          {result.subMetrics.map((metric) => (
            <div
              key={metric.id}
              className="flex items-center justify-between text-xs px-2.5 py-2 rounded-lg bg-gray-900/60 border border-gray-700/40"
            >
              <span className="text-gray-300 font-medium">
                {isSv ? metric.label.sv : metric.label.en}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-white">
                  {metric.value}/{metric.maxValue}
                </span>
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${getQualityBg(metric.quality)} ${getQualityColor(metric.quality)}`}>
                  {getQualityLabel(metric.quality, isSv ? 'sv' : 'en')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Key angles */}
      {result.angles.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {result.angles.map((angle) => (
            <div
              key={angle.id}
              className="bg-gray-900/40 rounded-lg p-2.5 text-center border border-gray-700/30"
            >
              <div className="text-[10px] text-gray-400 font-medium">
                {isSv ? angle.label.sv : angle.label.en}
              </div>
              <div className={`text-xl font-bold font-mono ${getQualityColor(angle.quality)}`}>
                {angle.value.toFixed(1)}{angle.unit}
              </div>
              <div className="text-[9px] text-gray-500">
                {isSv ? 'Optimalt' : 'Optimal'}: {angle.optimal}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Compensations */}
      {result.compensations.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
            {isSv ? 'Observationer' : 'Observations'}
          </div>
          {result.compensations.map((comp, i) => (
            <div
              key={i}
              className={`text-xs px-3 py-2 rounded-lg border ${
                comp.severity === 'HIGH'
                  ? 'bg-red-950/30 border-red-500/30 text-red-300'
                  : comp.severity === 'MEDIUM'
                  ? 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                  : 'bg-gray-800/50 border-gray-700/40 text-gray-300'
              }`}
            >
              <div className="font-semibold">
                ⚠️ {isSv ? comp.label.sv : comp.label.en}
              </div>
              <div className="text-[11px] mt-0.5 opacity-80">
                💡 {isSv ? comp.tip.sv : comp.tip.en}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
