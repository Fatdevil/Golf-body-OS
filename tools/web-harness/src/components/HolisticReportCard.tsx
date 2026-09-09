import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Sparkles,
  Printer,
  Copy,
  Check,
  Dumbbell,
  Lightbulb,
  ShieldCheck,
  AlertTriangle,
  Send,
  HelpCircle,
  RefreshCw,
  Target,
  ChevronRight
} from 'lucide-react';
import { GolfBodyScoreResult } from '../../../../src/core/metrics/golf-body-score';
import { DeviceValidationReport } from '../../../../src/validation/device-validation-report';
import { ThoracicRotationResult } from '../../../../src/core/metrics/thoracic-rotation-metrics';
import { SpokenCueLogEntry } from '../../../../src/core/coaching/audio-coach';
import { SupportedLanguage } from '../../../../src/core/coaching/i18n/locales';
import { AiCoachService } from '../../../../src/core/ai/ai-coach-service';
import { AiCoachAnalysis, ChatMessage } from '../../../../src/core/ai/types';
import { PRESET_HOLISTIC_QUESTIONS } from '../../../../src/core/ai/golf-coach-prompts';

interface HolisticReportCardProps {
  score: GolfBodyScoreResult;
  hingeReport: DeviceValidationReport | null;
  rotationResult: ThoracicRotationResult | null;
  spokenCues: SpokenCueLogEntry[];
  language: SupportedLanguage;
  aiCoachService: AiCoachService;
  onRestartScreening?: () => void;
}

export default function HolisticReportCard({
  score,
  hingeReport,
  rotationResult,
  spokenCues,
  language,
  aiCoachService,
  onRestartScreening
}: HolisticReportCardProps) {
  const isSv = language === 'sv-SE';
  const [analysis, setAnalysis] = useState<AiCoachAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function runAnalysis() {
      setIsLoading(true);
      try {
        const result = await aiCoachService.generateHolisticScreeningAnalysis(
          hingeReport,
          rotationResult,
          score,
          spokenCues,
          language
        );
        if (isMounted) {
          setAnalysis(result);
          setChatMessages([]);
        }
      } catch (err) {
        console.error('Failed to generate holistic AI analysis:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    runAnalysis();

    return () => {
      isMounted = false;
    };
  }, [score, hingeReport, rotationResult, language]);

  const handleCopySummary = () => {
    const textToCopy = `=== GOLF BODY SCORE REPORT ===
Resultat: ${score.totalScore}/100 (${score.tierLabel})
Pelare A (Höftfällning): ${score.hipHinge.total}/50 (Vinkel: ${score.hipHinge.avgHingeAngle}°)
Pelare B (Bröstryggsmobilitet): ${score.thoracic.total}/50 (Vänster: ${score.thoracic.maxLeft}°, Höger: ${score.thoracic.maxRight}°, Asymmetri: ${score.thoracic.asymmetry}°)

Styrkor:
${score.keyStrengths.map(s => `• ${s}`).join('\n')}

Flaskhalsar:
${score.primaryBottlenecks.map(b => `• ${b}`).join('\n')}

Svingpåverkan (${analysis?.golfTranslation.primaryFault || 'SWOT'}):
${analysis?.golfTranslation.explanation || score.summary}

Korrigerande övningar:
${analysis?.exercises.map((e, idx) => `${idx + 1}. ${e.name} (${e.prescription}) - ${e.whyThisHelps}`).join('\n\n') || ''}

Range Pro Tip:
${analysis?.proTip || ''}
`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendChat = async (queryText?: string) => {
    const textToSend = queryText || chatInput;
    if (!textToSend.trim() || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      timestamp: Date.now()
    };

    const newThread = [...chatMessages, userMsg];
    setChatMessages(newThread);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const reply = await aiCoachService.chat(
        newThread,
        hingeReport,
        language,
        rotationResult,
        score
      );

      const modelMsg: ChatMessage = {
        id: `msg_${Date.now()}_reply`,
        role: 'model',
        content: reply,
        timestamp: Date.now()
      };
      setChatMessages([...newThread, modelMsg]);
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsChatLoading(false);
    }
  };

  const presetQuestions = PRESET_HOLISTIC_QUESTIONS[language] || PRESET_HOLISTIC_QUESTIONS['sv-SE'];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-100 mt-6 print:border-none print:shadow-none print:p-0">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {isSv ? 'Komplett Screening' : 'Full Assessment'}
              </span>
              <span className="text-xs text-slate-400">
                {analysis?.engineUsed === 'GEMINI_2_5_FLASH' ? '⚡ Gemini 2.5 Flash' : '🧠 Local Expert Synthesizer'}
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white mt-0.5">
              {isSv ? 'Helkroppsscreening & Golf Body Score' : 'Full Body Screening & Golf Body Score'}
            </h2>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={handleCopySummary}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
            title="Kopiera text-sammanfattning"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? (isSv ? 'Kopierad!' : 'Copied!') : (isSv ? 'Kopiera' : 'Copy')}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
            title="Skriv ut / Spara PDF"
          >
            <Printer className="w-4 h-4" />
            {isSv ? 'Skriv ut / PDF' : 'Print / PDF'}
          </button>
          {onRestartScreening && (
            <button
              onClick={onRestartScreening}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 transition-colors border border-emerald-500/40 ml-2"
            >
              <RefreshCw className="w-4 h-4" />
              {isSv ? 'Starta om screening' : 'Retest Screening'}
            </button>
          )}
        </div>
      </div>

      {/* HERO GOLF BODY SCORE GAUGE & HEADLINE */}
      <div className="my-6 bg-gradient-to-br from-slate-800/80 to-slate-950/80 rounded-2xl p-6 border border-slate-700/60 shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Main Circular / Meter Score Display */}
          <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-900/60 rounded-xl border border-slate-800">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
              GOLF BODY SCORE
            </div>
            <div className="relative flex items-center justify-center my-2">
              <div
                className="w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center shadow-inner"
                style={{
                  borderColor: score.tierColor,
                  backgroundColor: `${score.tierColor}15`,
                  boxShadow: `0 0 24px ${score.tierColor}33`
                }}
              >
                <span className="text-4xl font-extrabold text-white tracking-tight">
                  {score.totalScore}
                </span>
                <span className="text-xs font-medium text-slate-400">/ 100</span>
              </div>
            </div>
            <div
              className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mt-1"
              style={{
                backgroundColor: `${score.tierColor}25`,
                color: score.tierColor,
                border: `1px solid ${score.tierColor}50`
              }}
            >
              {score.tierLabel}
            </div>
          </div>

          {/* Headline & Overview */}
          <div className="md:col-span-8 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2 text-emerald-400">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider font-semibold">
                {isSv ? 'Huvudanalys' : 'Key Insight'}
              </span>
            </div>
            <h3 className="text-lg md:text-xl font-bold text-slate-100 leading-snug">
              {isLoading ? (isSv ? 'Sammanställer analys...' : 'Analyzing movement...') : (analysis?.headline || score.summary)}
            </h3>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              {analysis?.summary || score.summary}
            </p>
            {analysis?.repetitionProgression && (
              <div className="mt-3 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-400 flex items-start gap-2">
                <Target className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>{analysis.repetitionProgression}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DUAL PILLAR BREAKDOWN (50 pts + 50 pts) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
        {/* PILLAR A: HIP HINGE */}
        <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 mb-4">
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {isSv ? 'Pelare A (Sidovy)' : 'Pillar A (Side View)'}
              </div>
              <h4 className="font-bold text-white text-base">
                {isSv ? 'Höftfällning & Bäckenstabilitet' : 'Hip Hinge & Posture Stability'}
              </h4>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-sky-400">{score.hipHinge.total}</span>
              <span className="text-xs text-slate-400"> / 50</span>
            </div>
          </div>

          <div className="space-y-3.5 text-xs">
            {/* Hinge Depth */}
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>{isSv ? 'Fällningsdjup (Optimalt ≤90°)' : 'Hinge Depth (Optimal ≤90°)'}</span>
                <span className="font-semibold text-white">{score.hipHinge.avgHingeAngle}° ({score.hipHinge.depthScore}/25 p)</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-sky-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(score.hipHinge.depthScore / 25) * 100}%` }}
                />
              </div>
            </div>

            {/* Knee Angle */}
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>{isSv ? 'Knävinkel (Optimalt 150°–165°)' : 'Knee Flex (Optimal 150°–165°)'}</span>
                <span className="font-semibold text-white">{score.hipHinge.avgKneeAngle}° ({score.hipHinge.kneeScore}/15 p)</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-sky-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(score.hipHinge.kneeScore / 15) * 100}%` }}
                />
              </div>
            </div>

            {/* Neutral Spine & Neck */}
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>{isSv ? 'Neutral Ryggrad & Nacke' : 'Neutral Spine & Cervical'}</span>
                <span className="font-semibold text-white">{score.hipHinge.spineScore}/10 p</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${score.hipHinge.spineScore === 10 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${(score.hipHinge.spineScore / 10) * 100}%` }}
                />
              </div>
            </div>

            {/* Compensations list */}
            {score.hipHinge.compensations.length > 0 && (
              <div className="pt-2 text-amber-400 flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{isSv ? 'Kompensationer: ' : 'Compensations: '}{score.hipHinge.compensations.join(', ')}</span>
              </div>
            )}
          </div>
        </div>

        {/* PILLAR B: THORACIC MOBILITY */}
        <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 mb-4">
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {isSv ? 'Pelare B (Framifrån)' : 'Pillar B (Front View)'}
              </div>
              <h4 className="font-bold text-white text-base">
                {isSv ? 'Bröstryggsmobilitet & X-Factor' : 'Thoracic Mobility & X-Factor'}
              </h4>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-indigo-400">{score.thoracic.total}</span>
              <span className="text-xs text-slate-400"> / 50</span>
            </div>
          </div>

          <div className="space-y-3.5 text-xs">
            {/* Rotation */}
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>{isSv ? 'Isolerad Rotation (V / H)' : 'Isolated Rotation (L / R)'}</span>
                <span className="font-semibold text-white">V: {score.thoracic.maxLeft}° | H: {score.thoracic.maxRight}° ({score.thoracic.rotationScore}/25 p)</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(score.thoracic.rotationScore / 25) * 100}%` }}
                />
              </div>
            </div>

            {/* Pelvic Disassociation */}
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>{isSv ? 'Bäckendissociation (Håll höft stilla ≤15°)' : 'Pelvic Disassociation (Quiet Hips ≤15°)'}</span>
                <span className="font-semibold text-white">Max höft: {score.thoracic.maxPelvicTurn}° ({score.thoracic.disassociationScore}/15 p)</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(score.thoracic.disassociationScore / 15) * 100}%` }}
                />
              </div>
            </div>

            {/* Symmetry & Dip */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>{isSv ? 'Symmetri' : 'Symmetry'}</span>
                  <span className="font-semibold text-white">{score.thoracic.asymmetry}° ({score.thoracic.symmetryScore}/5 p)</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-2 rounded-full"
                    style={{ width: `${(score.thoracic.symmetryScore / 5) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>{isSv ? 'Axel-Dip (≤12°)' : 'Shoulder Dip (≤12°)'}</span>
                  <span className="font-semibold text-white">{score.thoracic.dipScore}/5 p</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full ${score.thoracic.dipScore === 5 ? 'bg-emerald-500' : 'bg-red-500'}`}
                    style={{ width: `${(score.thoracic.dipScore / 5) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* GOLF-SWOT: STRENGTHS, BOTTLENECKS, SWING IMPACT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
        {/* Strengths */}
        <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-4">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm mb-3">
            <ShieldCheck className="w-4 h-4" />
            <span>{isSv ? 'Golfarens Främsta Styrkor' : 'Key Athletic Strengths'}</span>
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            {score.keyStrengths.map((str, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <span>{str}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottlenecks */}
        <div className="bg-rose-950/30 border border-rose-800/40 rounded-xl p-4">
          <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm mb-3">
            <AlertTriangle className="w-4 h-4" />
            <span>{isSv ? 'Prioriterade Flaskhalsar' : 'Movement Bottlenecks'}</span>
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            {score.primaryBottlenecks.map((btn, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                <span>{btn}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* GOLF SWING IMPACT TRANSLATION */}
      {analysis?.golfTranslation && (
        <div className="bg-slate-800/60 rounded-xl p-5 border border-slate-700 my-6">
          <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm mb-2">
            <Target className="w-4 h-4" />
            <span>{analysis.golfTranslation.title}</span>
            <span className="ml-auto px-2 py-0.5 rounded text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
              {analysis.golfTranslation.primaryFault}
            </span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            {analysis.golfTranslation.explanation}
          </p>
        </div>
      )}

      {/* 7-DAY CORRECTIVE EXERCISE PRESCRIPTION (3 PRIORITY DRILLS) */}
      {analysis?.exercises && analysis.exercises.length > 0 && (
        <div className="my-6">
          <div className="flex items-center gap-2 mb-4">
            <Dumbbell className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">
              {isSv ? '7-Dagars Korrigerande Träningsrecept' : '7-Day Corrective Exercise Prescription'}
            </h3>
            <span className="text-xs text-slate-400 ml-auto">
              {isSv ? '3 prioriterade övningar' : '3 priority drills'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {analysis.exercises.map((ex, idx) => (
              <div
                key={idx}
                className="bg-slate-800/60 rounded-xl p-4 border border-slate-700 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {ex.target}
                    </span>
                    <span className="text-xs font-mono text-slate-400">{ex.prescription}</span>
                  </div>
                  <h4 className="font-bold text-slate-100 text-sm mb-2">{ex.name}</h4>
                  <p className="text-xs text-slate-300 mb-3 leading-relaxed">{ex.instructions}</p>
                </div>
                <div className="pt-2 border-t border-slate-700/60 text-[11px] text-emerald-400/90 font-medium">
                  ★ {ex.whyThisHelps}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RANGE PRO TIP */}
      {analysis?.proTip && (
        <div className="my-6 bg-gradient-to-r from-amber-500/20 via-slate-800 to-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
              RANGE PRO TIP
            </div>
            <p className="text-sm text-slate-200 leading-relaxed font-medium">
              {analysis.proTip}
            </p>
          </div>
        </div>
      )}

      {/* INTERACTIVE COACH Q&A CHAT */}
      <div className="mt-8 pt-6 border-t border-slate-800 print:hidden">
        <div className="flex items-center gap-2 mb-3">
          <HelpCircle className="w-4 h-4 text-emerald-400" />
          <h4 className="font-bold text-white text-sm">
            {isSv ? 'Fråga Coachen om dina testresultat' : 'Ask Coach About Your Results'}
          </h4>
        </div>

        {/* Preset Questions Chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {presetQuestions.map((q) => (
            <button
              key={q.id}
              onClick={() => handleSendChat(q.query)}
              disabled={isChatLoading}
              className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 flex items-center gap-1.5"
            >
              <span>{q.label}</span>
              <ChevronRight className="w-3 h-3 text-slate-400" />
            </button>
          ))}
        </div>

        {/* Chat Thread */}
        {chatMessages.length > 0 && (
          <div className="space-y-3 mb-4 max-h-64 overflow-y-auto pr-1">
            {chatMessages.map((m) => (
              <div
                key={m.id}
                className={`p-3 rounded-xl text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-emerald-950/40 border border-emerald-800/40 text-emerald-200 ml-8'
                    : 'bg-slate-800/90 border border-slate-700 text-slate-200 mr-8'
                }`}
              >
                <div className="font-semibold text-[10px] text-slate-400 uppercase mb-1">
                  {m.role === 'user' ? (isSv ? 'Du' : 'You') : 'Coach Biomechanic'}
                </div>
                <div>{m.content}</div>
              </div>
            ))}
          </div>
        )}

        {/* Chat Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendChat();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={isSv ? 'Skriv din fråga här (t.ex. "Hur undviker jag Early Extension?")...' : 'Ask your question here...'}
            disabled={isChatLoading}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || isChatLoading}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSv ? 'Skicka' : 'Send'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
