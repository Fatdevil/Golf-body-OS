import React, { useState, useEffect } from 'react';
import { Sparkles, Key, Send, HelpCircle, Dumbbell, Lightbulb, Bot, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { DeviceValidationReport } from '../../../../src/validation/device-validation-report';
import { SpokenCueLogEntry } from '../../../../src/core/coaching/audio-coach';
import { SupportedLanguage } from '../../../../src/core/coaching/i18n/locales';
import { AiCoachService } from '../../../../src/core/ai/ai-coach-service';
import { AiCoachAnalysis, ChatMessage } from '../../../../src/core/ai/types';
import { PRESET_QUESTIONS, PRESET_ROTATION_QUESTIONS } from '../../../../src/core/ai/golf-coach-prompts';
import { ThoracicRotationResult } from '../../../../src/core/metrics/thoracic-rotation-metrics';

interface AiCoachCardProps {
  report?: DeviceValidationReport | null;
  rotationResult?: ThoracicRotationResult | null;
  spokenCues: SpokenCueLogEntry[];
  language: SupportedLanguage;
  aiCoachService: AiCoachService;
}

export default function AiCoachCard({
  report,
  rotationResult,
  spokenCues,
  language,
  aiCoachService
}: AiCoachCardProps) {
  const isSv = language === 'sv-SE';
  const [analysis, setAnalysis] = useState<AiCoachAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(aiCoachService.getApiKey());
  const [hasKey, setHasKey] = useState(aiCoachService.hasApiKey());

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Trigger analysis when report or rotationResult arrives
  useEffect(() => {
    let isMounted = true;
    async function runAnalysis() {
      setIsLoading(true);
      try {
        let result: AiCoachAnalysis | null = null;
        if (rotationResult) {
          result = await aiCoachService.generateRotationAnalysis(rotationResult, spokenCues, language);
        } else if (report && report.measurement.detectedRepCount > 0) {
          result = await aiCoachService.generateAnalysis(report, spokenCues, language);
        }
        if (isMounted && result) {
          setAnalysis(result);
          setChatMessages([]);
        }
      } catch (err) {
        console.error('Failed to generate AI analysis:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (rotationResult || (report && report.measurement.detectedRepCount > 0)) {
      runAnalysis();
    }

    return () => {
      isMounted = false;
    };
  }, [report, rotationResult, language]);

  const handleSaveApiKey = () => {
    aiCoachService.setApiKey(tempApiKey);
    setHasKey(aiCoachService.hasApiKey());
    setShowKeyModal(false);
    // Re-run analysis with new key
    setIsLoading(true);
    if (rotationResult) {
      aiCoachService.generateRotationAnalysis(rotationResult, spokenCues, language).then(res => {
        setAnalysis(res);
        setIsLoading(false);
      });
    } else if (report) {
      aiCoachService.generateAnalysis(report, spokenCues, language).then(res => {
        setAnalysis(res);
        setIsLoading(false);
      });
    }
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
      // If no report (rotation test), build a minimal report context
      const chatReport = report || {
        measurement: {
          metrics: [
            { id: 'MAX_ROTATION_LEFT', value: rotationResult?.maxRotationLeft || 0, unit: 'degrees' },
            { id: 'MAX_ROTATION_RIGHT', value: rotationResult?.maxRotationRight || 0, unit: 'degrees' },
            { id: 'ROTATION_ASYMMETRY', value: rotationResult?.rotationAsymmetry || 0, unit: 'degrees' },
          ],
          compensations: [],
          detectedRepCount: 1,
          confidence: 0.95
        }
      } as any;

      const replyText = await aiCoachService.chat(newThread, chatReport, language);
      const modelMsg: ChatMessage = {
        id: `reply_${Date.now()}`,
        role: 'model',
        content: replyText,
        timestamp: Date.now()
      };
      setChatMessages([...newThread, modelMsg]);
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsChatLoading(false);
    }
  };

  const presetQuestions = rotationResult
    ? (PRESET_ROTATION_QUESTIONS[language] || PRESET_ROTATION_QUESTIONS['en-US'])
    : (PRESET_QUESTIONS[language] || PRESET_QUESTIONS['en-US']);

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-850 to-indigo-950/40 rounded-xl border border-indigo-500/30 p-5 shadow-2xl mt-4 space-y-5">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-700/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow">
            <Sparkles size={18} className="animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <span>{isSv ? 'AI Golf & Biomekanik Coach' : 'AI Golf & Biomechanics Coach'}</span>
            </h3>
            <span className="text-[11px] text-gray-400 font-mono">
              {hasKey 
                ? '⚡ Powered by Google Gemini 2.5 Flash' 
                : isSv ? '🧠 Körs via Inbyggd Biomekanisk Expert-motor' : '🧠 Running via Local Biomechanical Expert Engine'}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            setTempApiKey(aiCoachService.getApiKey());
            setShowKeyModal(true);
          }}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition ${
            hasKey
              ? 'bg-emerald-950/40 border-emerald-600/50 text-emerald-300 hover:bg-emerald-900/50'
              : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
          }`}
        >
          <Key size={13} />
          <span>{hasKey ? 'Gemini Key Active' : (isSv ? 'Lägg till Gemini API-nyckel' : 'Add Gemini API Key')}</span>
        </button>
      </div>

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="bg-gray-800 p-4 rounded-xl border border-indigo-500/50 shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Key size={16} className="text-indigo-400" />
              <span>{isSv ? 'Konfigurera Google Gemini API-nyckel' : 'Configure Google Gemini API Key'}</span>
            </h4>
            <button onClick={() => setShowKeyModal(false)} className="text-gray-400 hover:text-white text-xs">
              ✕
            </button>
          </div>
          <p className="text-xs text-gray-300">
            {isSv 
              ? 'Nyckeln sparas enbart lokalt i din webbläsare (localStorage) och skickas aldrig vidare.'
              : 'The key is saved strictly in your browser (localStorage) and is never shared.'}
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
            <button
              onClick={handleSaveApiKey}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-1.5 rounded-lg transition"
            >
              {isSv ? 'Spara' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-10 gap-3 text-indigo-300">
          <RefreshCw size={20} className="animate-spin text-indigo-400" />
          <span className="text-sm font-medium">
            {isSv ? 'Analyserar dina vinklar och genererar golfcoaching...' : 'Analyzing angles & synthesizing golf prescription...'}
          </span>
        </div>
      )}

      {/* Analysis Presentation */}
      {!isLoading && analysis && (
        <div className="space-y-4">
          
          {/* Headline & Summary */}
          <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-4 space-y-2">
            <h4 className="text-base font-bold text-indigo-200">
              {analysis.headline}
            </h4>
            <p className="text-xs text-gray-300 leading-relaxed">
              {analysis.summary}
            </p>
            {analysis.repetitionProgression && (
              <p className="text-[11px] text-indigo-300/90 font-medium italic border-t border-indigo-900/50 pt-2">
                📈 {analysis.repetitionProgression}
              </p>
            )}
          </div>

          {/* Golf Swing Translation Card */}
          <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-green-400 flex items-center gap-1.5">
                ⛳ {isSv ? 'Koppling till din golfsving' : 'Golf Swing Impact'}
              </span>
              <span className="text-[10px] bg-green-950/80 text-green-300 border border-green-800 px-2 py-0.5 rounded-full font-mono">
                {analysis.golfTranslation.primaryFault}
              </span>
            </div>
            <h5 className="text-sm font-bold text-white">
              {analysis.golfTranslation.title}
            </h5>
            <p className="text-xs text-gray-300 leading-relaxed">
              {analysis.golfTranslation.explanation}
            </p>
          </div>

          {/* Corrective Exercises */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Dumbbell size={14} />
              <span>{isSv ? 'Ditt Personliga Träningsrecept' : 'Your Customized Exercise Prescription'}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {analysis.exercises.map((ex, idx) => (
                <div key={idx} className="bg-gray-800/90 border border-purple-900/40 rounded-xl p-3.5 flex flex-col justify-between space-y-2 hover:border-purple-600/50 transition">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h6 className="font-bold text-xs text-white">{ex.name}</h6>
                      <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-700/60 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                        {ex.prescription}
                      </span>
                    </div>
                    <span className="text-[11px] text-purple-400/90 block mb-2 font-medium">
                      🎯 {ex.target}
                    </span>
                    <p className="text-[11px] text-gray-300 leading-relaxed">
                      {ex.instructions}
                    </p>
                  </div>
                  <div className="text-[10px] text-gray-400 bg-gray-900/60 p-2 rounded-lg border border-gray-800 italic">
                    💡 {ex.whyThisHelps}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pro Range Tip */}
          <div className="bg-amber-950/25 border border-amber-600/30 rounded-xl p-3.5 flex items-start gap-3">
            <Lightbulb size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider block">
                {isSv ? 'Coach-tips inför nästa pass på rangen' : 'Coach Range Pro Tip'}
              </span>
              <p className="text-xs text-gray-200 mt-0.5 leading-relaxed">
                {analysis.proTip}
              </p>
            </div>
          </div>

          {/* Interactive Chat with the Coach */}
          <div className="border-t border-gray-700/80 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                <Bot size={15} />
                <span>{isSv ? 'Ställ en fråga till Coachen' : 'Ask the Coach a Question'}</span>
              </span>
            </div>

            {/* Preset Question Chips */}
            <div className="flex flex-wrap gap-1.5">
              {presetQuestions.map((q) => (
                <button
                  key={q.id}
                  onClick={() => handleSendChat(q.query)}
                  disabled={isChatLoading}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-[11px] text-gray-300 hover:text-white px-2.5 py-1 rounded-full border border-gray-700 transition"
                >
                  {q.label}
                </button>
              ))}
            </div>

            {/* Message Thread */}
            {chatMessages.length > 0 && (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 bg-gray-900/70 p-3 rounded-xl border border-gray-800">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white font-medium'
                          : 'bg-gray-800 text-gray-200 border border-gray-700'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex items-center gap-2 text-xs text-indigo-400 font-mono italic">
                    <RefreshCw size={12} className="animate-spin" />
                    <span>{isSv ? 'Coachen tänker...' : 'Coach is writing...'}</span>
                  </div>
                )}
              </div>
            )}

            {/* Chat Input Field */}
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendChat();
                }}
                disabled={isChatLoading}
                placeholder={isSv ? 'Skriv din fråga här (t.ex. "Hur ska jag stå vid bollen?")...' : 'Ask anything about your movement...'}
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => handleSendChat()}
                disabled={isChatLoading || !chatInput.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Send size={13} />
                <span>{isSv ? 'Skicka' : 'Send'}</span>
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
