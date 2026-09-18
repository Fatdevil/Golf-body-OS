/**
 * BodyScreen — The "My Body" Dashboard.
 *
 * This replaces the old ResultScreen. It presents the user's BodyProfile
 * as a digital twin (Lager 1 — Understand Me).
 *
 * Core features:
 * - Interactive Body Map (2D layout mapping to regions)
 * - Top Priorities & Strengths
 * - Biggest Opportunity with Golf Translation
 * - Raw Results (Lager 2)
 */

import React, { useState } from 'react';
import { Target, Zap, ChevronRight, Activity, Calendar, ShieldAlert, CheckCircle2 } from 'lucide-react';
import type { SupportedLanguage } from '../../../../src/core/coaching/i18n/locales';
import type { ScreeningResult } from '../types/screening';
import type { BodyProfile, AreaScore } from '../../../../src/core/training/types/body-profile';

interface BodyScreenProps {
  result: ScreeningResult;
  profile: BodyProfile;
  language: SupportedLanguage;
  onCreateProgram: () => void;
  onOpenSwingAnalysis: () => void;
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

// A simple interactive SVG body map wireframe
function BodyMap({ profile, onSelectArea }: { profile: BodyProfile, onSelectArea: (areaId: string | null) => void }) {
  // Mapping logic: extract qualities for different regions from profile
  const getQualityColor = (quality?: string) => {
    switch (quality) {
      case 'EXCELLENT': return 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]';
      case 'GOOD': return 'text-emerald-400';
      case 'FAIR': return 'text-amber-400';
      case 'POOR': return 'text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]';
      default: return 'text-gray-600';
    }
  };

  const getStrokeColor = (quality?: string) => {
    switch (quality) {
      case 'EXCELLENT': return 'stroke-emerald-400';
      case 'GOOD': return 'stroke-emerald-400';
      case 'FAIR': return 'stroke-amber-400';
      case 'POOR': return 'stroke-orange-500';
      default: return 'stroke-gray-700';
    }
  };

  // Find qualities (mocking some regions if untested)
  const thoracicQuality = profile.mobility.areas.find(a => a.areaId === 'thoracic-rotation-limited')?.quality;
  const hipsQuality = profile.mobility.areas.find(a => a.areaId === 'hip-hinge-limited')?.quality;

  return (
    <div className="relative w-full max-w-[200px] mx-auto aspect-[1/2] mt-4 mb-8">
      <svg viewBox="0 0 100 200" className="w-full h-full">
        {/* Base wireframe */}
        <path 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="1.5"
          className="text-gray-800"
          d="M50 10 C55 10 59 14 59 19 C59 24 55 28 50 28 C45 28 41 24 41 19 C41 14 45 10 50 10 Z M35 35 C42 32 58 32 65 35 L75 75 L65 80 L60 55 L60 110 L70 190 L55 195 L50 120 L45 195 L30 190 L40 110 L40 55 L35 80 L25 75 Z" 
        />

        {/* Thoracic Node */}
        <g 
          className="cursor-pointer transition-transform hover:scale-110 origin-center" 
          style={{ transformOrigin: '50px 55px' }}
          onClick={() => onSelectArea('thoracic-rotation-limited')}
        >
          <circle cx="50" cy="55" r="8" className={`fill-gray-950 stroke-2 ${getStrokeColor(thoracicQuality)}`} />
          <circle cx="50" cy="55" r="3" className={`fill-current ${getQualityColor(thoracicQuality)}`} />
        </g>

        {/* Hips Nodes */}
        <g 
          className="cursor-pointer transition-transform hover:scale-110 origin-center" 
          style={{ transformOrigin: '40px 110px' }}
          onClick={() => onSelectArea('hip-hinge-limited')}
        >
          <circle cx="40" cy="110" r="6" className={`fill-gray-950 stroke-2 ${getStrokeColor(hipsQuality)}`} />
          <circle cx="40" cy="110" r="2" className={`fill-current ${getQualityColor(hipsQuality)}`} />
        </g>
        <g 
          className="cursor-pointer transition-transform hover:scale-110 origin-center" 
          style={{ transformOrigin: '60px 110px' }}
          onClick={() => onSelectArea('hip-hinge-limited')}
        >
          <circle cx="60" cy="110" r="6" className={`fill-gray-950 stroke-2 ${getStrokeColor(hipsQuality)}`} />
          <circle cx="60" cy="110" r="2" className={`fill-current ${getQualityColor(hipsQuality)}`} />
        </g>

        {/* Untested Nodes (Shoulders, Knees, Ankles) */}
        <circle cx="35" cy="35" r="4" className="fill-gray-950 stroke-2 stroke-gray-700" />
        <circle cx="65" cy="35" r="4" className="fill-gray-950 stroke-2 stroke-gray-700" />
        <circle cx="30" cy="150" r="4" className="fill-gray-950 stroke-2 stroke-gray-700" />
        <circle cx="70" cy="150" r="4" className="fill-gray-950 stroke-2 stroke-gray-700" />
      </svg>
      <div className="absolute -right-4 top-4 text-[10px] text-gray-500 space-y-1">
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400" /> Bra</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400" /> Potential</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500" /> Prioritet</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-gray-700" /> Ej testat</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function BodyScreen({
  result,
  profile,
  language,
  onCreateProgram,
  onOpenSwingAnalysis,
}: BodyScreenProps) {
  const isSv = language === 'sv-SE';
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);

  // Extract top bottleneck for the "Biggest Opportunity" section
  const topBottleneck = profile.primaryBottlenecks[0];

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(isSv ? 'sv-SE' : 'en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-6">
      
      {/* Header */}
      <div className="text-center pt-8 pb-4">
        <h1 className="text-sm font-bold text-gray-500 uppercase tracking-widest">{isSv ? 'Din Golfkropp' : 'Your Golf Body'}</h1>
      </div>

      {/* Body Map */}
      <BodyMap profile={profile} onSelectArea={setSelectedAreaId} />

      {/* Detail Overlay (when an area is clicked) */}
      {selectedAreaId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-gray-900 border border-gray-800 w-full max-w-md rounded-3xl p-6 space-y-6 shadow-2xl transform transition-transform translate-y-0">
            <div className="flex items-start justify-between">
              <h2 className="text-2xl font-bold text-white capitalize">
                {profile.mobility.areas.find(a => a.areaId === selectedAreaId)?.label[isSv ? 'sv' : 'en'] || selectedAreaId}
              </h2>
              <button onClick={() => setSelectedAreaId(null)} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white">
                ✕
              </button>
            </div>
            
            {/* Detail stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-950 rounded-xl p-4 border border-gray-800">
                <p className="text-xs text-gray-500 mb-1">{isSv ? 'Senaste test' : 'Last test'}</p>
                <p className="text-xl font-bold">
                  {profile.mobility.areas.find(a => a.areaId === selectedAreaId)?.score || 0} pts
                </p>
              </div>
              <div className="bg-gray-950 rounded-xl p-4 border border-gray-800">
                <p className="text-xs text-gray-500 mb-1">{isSv ? 'Status' : 'Status'}</p>
                <p className="text-sm font-bold text-orange-400">{isSv ? 'Begränsad' : 'Limited'}</p>
              </div>
            </div>

            {/* Golf Translation */}
            <div>
              <h3 className="text-sm font-bold text-gray-400 mb-2">{isSv ? 'Varför det spelar roll' : 'Why it matters'}</h3>
              <p className="text-sm text-gray-300 leading-relaxed bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                {isSv 
                  ? 'Detta kan göra det svårare att bibehålla en stabil överkroppsrotation under baksvingen utan att kompensera.' 
                  : 'This may make it harder to maintain stable upper-body rotation during your backswing without compensating.'}
              </p>
            </div>

            <button onClick={() => setSelectedAreaId(null)} className="w-full py-3 bg-gray-800 text-white rounded-xl font-semibold">
              {isSv ? 'Stäng' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="max-w-md mx-auto px-5 space-y-8">
        
        {/* Today's Profile Summary */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-lg">{isSv ? 'Dagens Profil' : "Today's Profile"}</h2>
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
              <Activity size={12} />
              <span>{formatDate(profile.createdAt)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">{isSv ? 'Prioriteringar' : 'Priorities'}</p>
              <div className="space-y-2">
                {profile.primaryBottlenecks.slice(0, 2).map((b, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <ShieldAlert size={14} className="text-orange-500 mt-0.5 shrink-0" />
                    <span className="text-gray-200">{isSv ? b.label.sv : b.label.en}</span>
                  </div>
                ))}
                {profile.primaryBottlenecks.length === 0 && (
                  <span className="text-sm text-gray-500">{isSv ? 'Inga flaskhalsar' : 'No bottlenecks'}</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">{isSv ? 'Styrkor' : 'Strengths'}</p>
              <div className="space-y-2">
                {profile.keyStrengths.slice(0, 2).map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-gray-200">{isSv ? s.label.sv : s.label.en}</span>
                  </div>
                ))}
                {profile.keyStrengths.length === 0 && (
                  <span className="text-sm text-gray-500">{isSv ? 'Inga uttalade styrkor' : 'No distinct strengths'}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Biggest Opportunity / Golf Translation */}
        {topBottleneck && (
          <div className="bg-gradient-to-br from-emerald-900/40 to-teal-900/20 border border-emerald-500/30 rounded-3xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Target size={100} />
            </div>
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
              {isSv ? 'Största möjligheten' : 'Biggest Opportunity'}
            </p>
            <h3 className="text-xl font-black text-white mb-1">
              {isSv ? topBottleneck.label.sv : topBottleneck.label.en}
            </h3>
            <p className="text-sm text-emerald-200/70 mb-4">
              {isSv ? 'Begränsad i förhållande till din nuvarande profil.' : 'Limited relative to your current profile.'}
            </p>
            
            <div className="bg-black/40 rounded-xl p-4 border border-white/5 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={14} className="text-amber-400" />
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">{isSv ? 'Golf Translation' : 'Golf Translation'}</span>
              </div>
              <p className="text-sm text-gray-200 leading-relaxed">
                {isSv 
                  ? 'Kan göra det svårare att bibehålla en kraftfull överkroppsrotation under baksvingen utan att överanvända ländryggen.' 
                  : 'May make it harder to maintain a powerful upper-body rotation during your backswing without overusing the lower back.'}
              </p>
            </div>
          </div>
        )}

        {/* Create Program CTA */}
        <button
          onClick={onCreateProgram}
          className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-6 py-4 rounded-xl font-bold text-lg transition shadow-lg shadow-emerald-600/20"
        >
          <Zap size={20} />
          <span>{isSv ? 'Skapa Dagens Program' : 'Create Daily Program'}</span>
        </button>

        {/* Lager 2: Domains */}
        <div className="pt-4">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 px-2">{isSv ? 'Dina Domäner' : 'Your Domains'}</h3>
          <div className="space-y-3">
            
            {/* Mobility */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-200">Mobility</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400">
                    {profile.mobility.status === 'NOT_TESTED' ? (isSv ? 'Inte testad' : 'Not tested') : `${profile.mobility.areas.length} ${isSv ? 'områden mätta' : 'areas measured'}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Motor Control */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-200">Motor Control</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400">
                    {profile.motorControl.status === 'NOT_TESTED' ? (isSv ? 'Inte testad' : 'Not tested') : `${profile.motorControl.areas.length} ${isSv ? 'områden mätta' : 'areas measured'}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Capacity */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-200">Capacity</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400">
                    {profile.capacity.status === 'NOT_TESTED' ? (isSv ? 'Inte testad' : 'Not tested') : `${profile.capacity.areas.length} ${isSv ? 'områden mätta' : 'areas measured'}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Power */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-200 flex items-center gap-2">
                  Power
                  <span className="text-[10px] font-bold tracking-wider text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full uppercase">{isSv ? 'Valfri' : 'Optional'}</span>
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400">
                    {profile.power.status === 'NOT_TESTED' ? (isSv ? 'Inte testad' : 'Not tested') : `${profile.power.areas.length} ${isSv ? 'områden mätta' : 'areas measured'}`}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Retest indicator */}
        <div className="text-center pt-8 pb-4">
          <div className="inline-flex items-center gap-2 text-xs text-gray-500 bg-gray-900 px-4 py-2 rounded-full border border-gray-800">
            <Calendar size={14} />
            <span>{isSv ? 'Ny screening rekommenderas om 18 dagar' : 'Retest recommended in 18 days'}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
