/**
 * AI Post-Session Coach Types for Golf Body OS.
 */

import { SupportedLanguage } from '../coaching/i18n/locales';

export interface CorrectiveExercise {
  name: string;
  target: string;
  prescription: string; // e.g. "2 set x 8 reps"
  instructions: string;
  whyThisHelps: string;
}

export interface GolfSwingImpact {
  title: string;
  primaryFault: string; // e.g. "Early Extension" or "Loss of Posture"
  explanation: string;
}

export interface AiCoachAnalysis {
  headline: string;
  summary: string;
  repetitionProgression: string; // Observation of how reps changed from 1 to 3
  golfTranslation: GolfSwingImpact;
  exercises: CorrectiveExercise[];
  proTip: string;
  generatedAt: number;
  engineUsed: 'GEMINI_2_5_FLASH' | 'LOCAL_EXPERT_SYNTHESIZER';
  language: SupportedLanguage;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}
